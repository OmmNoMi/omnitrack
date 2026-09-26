# Copyright (c) 2026, OmmNoMi Automation LLP and contributors
# For license information, please see license.txt

import hashlib
import json
from datetime import datetime, timedelta
import frappe
from frappe import _
from frappe.utils import (
	flt,
	getdate,
	nowdate,
	now_datetime,
	time_diff_in_hours,
	nowtime,
	add_days,
	get_datetime,
)
from omnitrack.services import (
	TemporalGovernor,
	PairingEngine,
	MidnightSplitter,
	TimesheetBridge,
)
from omnitrack.utils import (
	duration_hours as _duration_hours,
	pad_time as _time_str,
	mins_of,
	require_session_notes as _require_session_notes,
	resolve_planner_user as _resolve_planner_user,
)


@frappe.whitelist()
def toggle_work_block_status(block_name):
	"""Toggles status of a Planned Work Block between Completed and In Progress."""
	if not frappe.db.exists("Planned Work Block", block_name):
		frappe.throw(_("Block not found"))
	doc = frappe.get_doc("Planned Work Block", block_name)
	doc.status = "Completed" if doc.status != "Completed" else "In Progress"
	doc.flags.ignore_permissions = True
	doc.save()
	return {"name": doc.name, "status": doc.status}


@frappe.whitelist()
def create_planned_work_block(work_date=None, start_time="09:00:00", end_time="10:00:00", duration_hours=1.0, project=None, task=None, deliverable_notes=None, task_nature="🎯 Planned", employee=None, status="Planned"):
	"""Creates a new Planned Work Block in Frappe DB."""
	doc = frappe.new_doc("Planned Work Block")
	assigned_emp = employee or frappe.session.user
	doc.employee = assigned_emp
	if frappe.db.exists("User", assigned_emp):
		doc.associate_name = frappe.db.get_value("User", assigned_emp, "full_name") or assigned_emp
	elif frappe.db.exists("DocType", "Employee") and frappe.db.exists("Employee", assigned_emp):
		doc.associate_name = frappe.db.get_value("Employee", assigned_emp, "employee_name") or assigned_emp
	else:
		doc.associate_name = assigned_emp

	doc.work_date = work_date or nowdate()
	doc.start_time = start_time or "09:00:00"
	doc.end_time = end_time or "10:00:00"
	doc.duration_hours = flt(duration_hours) or 1.0
	if project:
		doc.project = project
	if task:
		doc.task = task
	doc.deliverable_notes = deliverable_notes or "Planned Task Entry"
	doc.task_nature = task_nature or "🎯 Planned"
	doc.status = status or "Planned"

	# Cryptographic Hash
	raw_hash = f"{doc.employee}|{doc.work_date}|{doc.start_time}|{doc.end_time}|{doc.duration_hours}|{doc.deliverable_notes}"
	doc.cryptographic_hash = f"chk-{hashlib.sha256(raw_hash.encode()).hexdigest()[:8]}"
	doc.flags.ignore_permissions = True
	doc.insert()
	return doc.as_dict()


def _is_planner_manager(user=None):
	from omnitrack.permissions import is_omnitrack_manager
	return is_omnitrack_manager(user)


def _resolve_planner_user(employee=None):
	from omnitrack.utils.user_resolver import resolve_planner_user
	return resolve_planner_user(employee)


def _week_bounds(week_start=None):
	base = getdate(week_start) if week_start else getdate(nowdate())
	monday = base - timedelta(days=base.weekday())
	return monday, monday + timedelta(days=6)


def _time_str(val):
	"""Serialize a Frappe Time field as zero-padded HH:MM:SS.

	Time fields come back as ``datetime.timedelta``, whose ``str()`` drops the
	leading zero on single-digit hours ("7:30:55"), which breaks any consumer
	that slices the first five characters. Always emit "07:30:55".
	"""
	if val in (None, ""):
		return ""
	if isinstance(val, timedelta):
		total = int(val.total_seconds())
		h, rem = divmod(total, 3600)
		m, sec = divmod(rem, 60)
		return f"{h:02d}:{m:02d}:{sec:02d}"
	if isinstance(val, str):
		parts = val.split(":")
		if parts and parts[0].isdigit():
			parts[0] = parts[0].zfill(2)
			return ":".join(parts)
		return val
	return str(val)


@frappe.whitelist()
def get_planner_data(employee=None, week_start=None, start_date=None, end_date=None):
	"""Everything the Planner calendar needs: the range's Planned Work Blocks (plan + logged
	sessions) plus the target user's assigned tasks and a plan-vs-actual rollup."""
	from omnitrack.api.tasks import get_assigned_tasks
	from omnitrack.api.timesheet import get_timesheet_sync_mode
	target = _resolve_planner_user(employee)
	if start_date and end_date:
		monday = getdate(start_date)
		sunday = getdate(end_date)
	else:
		monday, sunday = _week_bounds(week_start)

	session_roles = frappe.get_roles(frappe.session.user)
	from omnitrack.permissions import is_omnitrack_manager
	is_manager = is_omnitrack_manager(frappe.session.user)
	is_client = "OmniTrack Client" in session_roles and not is_manager

	planner_filters = {
		"work_date": ["between", [str(monday - timedelta(days=1)), str(sunday)]]
	}
	if is_client:
		allowed_projects = []
		if frappe.db.exists("DocType", "Project"):
			if frappe.db.exists("DocType", "Project User"):
				allowed_projects.extend(frappe.db.sql_list("SELECT parent FROM `tabProject User` WHERE `user` = %s", frappe.session.user))
			allowed_projects.extend(frappe.db.sql_list("SELECT name FROM `tabProject` WHERE `customer` = %s", frappe.session.user))
			if frappe.db.exists("DocType", "Contact") and frappe.db.exists("DocType", "Dynamic Link"):
				contact_projs = frappe.db.sql_list("""
					SELECT p.name FROM `tabProject` p
					JOIN `tabDynamic Link` dl ON dl.link_name = p.customer AND dl.link_doctype = 'Customer'
					JOIN `tabContact` c ON c.name = dl.parent
					WHERE c.user = %s
				""", frappe.session.user)
				allowed_projects.extend(contact_projs)
			allowed_projects = list(set(allowed_projects))
		if allowed_projects:
			planner_filters["project"] = ["in", allowed_projects]
		else:
			planner_filters["project"] = ["is", "set"]
	else:
		planner_filters["employee"] = target

	blocks = []
	if frappe.db.exists("DocType", "Planned Work Block"):
		raw = frappe.get_all(
			"Planned Work Block",
			filters=planner_filters,
			fields=[
				"name", "work_date", "start_time", "end_time", "duration_hours",
				"actual_hours", "variance_hours", "status", "task", "project",
				"work_item", "work_item_label", "task_nature", "deliverable_notes", "location",
				"cancel_reason", "rescheduled_to", "rescheduled_from",
			],
			order_by="work_date asc, start_time asc",
			limit=500,
		)
		proj_names = {}
		for b in raw:
			b["start_time"] = _time_str(b.get("start_time"))
			b["end_time"] = _time_str(b.get("end_time"))
			b["work_date"] = str(b.get("work_date") or "")
			if b.get("project") and b["project"] not in proj_names:
				if frappe.db.exists("DocType", "Project"):
					proj_names[b["project"]] = frappe.db.get_value("Project", b["project"], "project_name") or b["project"]
				else:
					proj_names[b["project"]] = b["project"]
			subject = b.get("work_item_label")
			if not subject and b.get("task") and frappe.db.exists("DocType", "Task"):
				subject = frappe.db.get_value("Task", b["task"], "subject")
			b["task_subject"] = subject or b.get("deliverable_notes")
			b["project_name"] = proj_names.get(b.get("project"))
			b["sessions"] = [
				{
					"session_date": str(s.session_date or ""),
					"from_time": _time_str(s.from_time),
					"to_time": _time_str(s.to_time),
					"hours": flt(s.hours),
					"notes": s.notes,
					"logged_via": s.logged_via,
				}
				for s in frappe.get_all(
					"OmniTrack Work Session",
					filters={"parent": b["name"], "parenttype": "Planned Work Block"},
					fields=["session_date", "from_time", "to_time", "hours", "notes", "logged_via"],
					order_by="session_date asc, from_time asc",
				)
			]
			b["output_metrics"] = [
				{
					"metric_type": m.metric_type,
					"quantity": flt(m.quantity),
					"unit": m.unit,
					"reference_id": m.reference_id,
					"notes": m.notes,
				}
				for m in frappe.get_all(
					"OmniTrack Output Metric",
					filters={"parent": b["name"], "parenttype": "Planned Work Block"},
					fields=["metric_type", "quantity", "unit", "reference_id", "notes"],
				)
			] if frappe.db.exists("DocType", "OmniTrack Output Metric") else []
			blocks.append(b)

	# Leave / absence / out-of-office / break are non-working & non-paid — flag them and keep
	# them out of the plan-vs-actual maths.
	away_markers = ("leave", "absent", "out-of-office", "out of office", "break")
	for b in blocks:
		nature = (b.get("task_nature") or "").lower()
		b["is_away"] = any(m in nature for m in away_markers)
		b["is_working"] = not b["is_away"]
		b["is_paid"] = not b["is_away"]

	# Totals are scoped strictly to the requested span (monday..sunday)
	week_blocks = [b for b in blocks if str(monday) <= b["work_date"] <= str(sunday)]
	work_blocks = [b for b in week_blocks if not b["is_away"]]
	non_work_blocks = [b for b in week_blocks if b["is_away"]]
	planned_total = round(sum(flt(b["duration_hours"]) for b in work_blocks), 2)
	actual_total = round(sum(flt(b["actual_hours"]) for b in work_blocks), 2)
	non_working_total = round(sum(flt(b["actual_hours"] or b["duration_hours"]) for b in non_work_blocks), 2)
	adherence = round((min(actual_total, planned_total) / planned_total * 100), 1) if planned_total else 0.0

	num_days = (sunday - monday).days + 1
	days = [str(monday + timedelta(days=i)) for i in range(max(1, num_days))]

	assigned_info = get_assigned_tasks(employee)
	return {
		"user": target,
		"is_manager": _is_planner_manager(),
		"week_start": str(monday),
		"week_end": str(sunday),
		"days": days,
		"blocks": blocks,
		"assigned_tasks": assigned_info.get("tasks", []),
		"attention_tasks": assigned_info.get("attention_tasks", []),
		"totals": {
			"planned_hours": planned_total,
			"actual_hours": actual_total,
			"non_working_hours": non_working_total,
			"variance_hours": round(actual_total - planned_total, 2),
			"adherence_pct": adherence,
			"block_count": len(work_blocks),
			"away_count": len(non_work_blocks),
		},
		"past_block_lock_grace_hours": getattr(frappe.get_single("OmniTrack Settings"), "past_block_lock_grace_hours", 24) or 24 if frappe.db.exists("DocType", "OmniTrack Settings") else 24,
		"timesheet_modification_horizon_hours": getattr(frappe.get_single("OmniTrack Settings"), "timesheet_modification_horizon_hours", 48) or 48 if frappe.db.exists("DocType", "OmniTrack Settings") else 48,
		"allow_submitted_timesheet_amendment": getattr(frappe.get_single("OmniTrack Settings"), "allow_submitted_timesheet_amendment", 1) if frappe.db.exists("DocType", "OmniTrack Settings") else 1,
	}


def _duration_hours(start_time, end_time):
	from omnitrack.utils.time_math import duration_hours
	return duration_hours(start_time, end_time)


@frappe.whitelist()
def book_work_block(work_date, start_time, end_time, work_item=None, work_item_label=None,
					task=None, project=None, deliverable_notes=None,
					task_nature="\U0001f3af Planned", employee=None, pairing_partner=None):
	"""Create a planned block: 'from 12 to 2pm I will work on <work item>'. This is the PLAN.

	``work_item`` is the generic assigned-work id from get_assigned_tasks (an ERPNext Task
	name, or ``todo:<name>``). A real ERPNext Task link is also set when available.
	If ``pairing_partner`` is specified, automatically mirrors a reciprocal work block for
	the collaborator with synchronized status and bidirectional links.
	"""
	target = _resolve_planner_user(employee)
	if not frappe.db.exists("DocType", "Planned Work Block"):
		frappe.throw(_("Planned Work Block DocType is not available."))

	if work_date and getdate(work_date) < getdate(nowdate()):
		frappe.throw(_("Cannot plan or book work blocks in the past."), frappe.ValidationError)

	has_task = frappe.db.exists("DocType", "Task")
	if work_item and not work_item.startswith("todo:") and has_task and frappe.db.exists("Task", work_item):
		task = task or work_item
	if task and has_task:
		task_proj = frappe.db.get_value("Task", task, "project")
		if task_proj:
			project = task_proj
	if not work_item_label:
		if task and has_task:
			work_item_label = frappe.db.get_value("Task", task, "subject")
		elif work_item and work_item.startswith("todo:"):
			td = work_item.split(":", 1)[1]
			desc = frappe.db.get_value("ToDo", td, "description") or ""
			work_item_label = frappe.utils.strip_html(desc).strip().split("\n")[0][:140] or None
	work_item_label = work_item_label or deliverable_notes

	doc = frappe.new_doc("Planned Work Block")
	doc.employee = target
	doc.work_date = work_date or nowdate()
	doc.start_time = start_time
	doc.end_time = end_time
	doc.duration_hours = _duration_hours(start_time, end_time)
	doc.task = task
	doc.work_item = work_item
	doc.work_item_label = work_item_label
	doc.project = project
	doc.task_nature = task_nature or "🎯 Planned"
	doc.deliverable_notes = deliverable_notes or work_item_label
	doc.status = "Planned"
	if pairing_partner and pairing_partner != target and frappe.db.exists("User", pairing_partner):
		doc.pairing_partner = pairing_partner
	if frappe.db.exists("User", target):
		doc.associate_name = frappe.db.get_value("User", target, "full_name") or target
	doc.flags.ignore_permissions = True
	if not frappe.db.exists("DocType", "Project") or not frappe.db.exists("DocType", "Task"):
		doc.flags.ignore_links = True
	doc.insert()

	# Reciprocal collaborative pairing block creation
	if pairing_partner and pairing_partner != target and frappe.db.exists("User", pairing_partner):
		partner_doc = frappe.new_doc("Planned Work Block")
		partner_doc.employee = pairing_partner
		partner_doc.work_date = doc.work_date
		partner_doc.start_time = doc.start_time
		partner_doc.end_time = doc.end_time
		partner_doc.duration_hours = doc.duration_hours
		partner_doc.task = doc.task
		partner_doc.work_item = doc.work_item
		partner_doc.work_item_label = doc.work_item_label
		partner_doc.project = doc.project
		partner_doc.task_nature = doc.task_nature
		partner_doc.deliverable_notes = doc.deliverable_notes
		partner_doc.status = "Planned"
		partner_doc.pairing_partner = target
		partner_doc.paired_block = doc.name
		partner_doc.associate_name = frappe.db.get_value("User", pairing_partner, "full_name") or pairing_partner
		partner_doc.flags.ignore_permissions = True
		if not frappe.db.exists("DocType", "Project") or not frappe.db.exists("DocType", "Task"):
			partner_doc.flags.ignore_links = True
		partner_doc.insert()

		doc.paired_block = partner_doc.name
		doc.db_set("paired_block", partner_doc.name, update_modified=False)

	return {
		"status": "success",
		"name": doc.name,
		"duration_hours": doc.duration_hours,
		"paired_block": getattr(doc, "paired_block", None)
	}


@frappe.whitelist()
def update_work_block(block_name, work_date=None, start_time=None, end_time=None,
					  task=None, project=None, deliverable_notes=None, status=None,
					  cancel_reason=None):
	"""Move / resize / re-target a planned block from the calendar."""
	from omnitrack.api.timesheet import sync_work_block_timesheet
	doc = frappe.get_doc("Planned Work Block", block_name)
	if doc.employee != frappe.session.user and not _is_planner_manager():
		frappe.throw(_("Not permitted to edit this work block."), frappe.PermissionError)

	from omnitrack.permissions import check_planned_block_past_lock
	# In the past, NO ONE changes planned work blocks
	check_planned_block_past_lock(doc, new_work_date=work_date)

	if work_date:
		doc.work_date = work_date
	if start_time:
		doc.start_time = start_time
	if end_time:
		doc.end_time = end_time
	if task is not None:
		doc.task = task or None
		if task and frappe.db.exists("DocType", "Task"):
			doc.work_item = task
			doc.work_item_label = frappe.db.get_value("Task", task, "subject") or doc.work_item_label
	if project is not None:
		doc.project = project or None
	if deliverable_notes is not None:
		doc.deliverable_notes = deliverable_notes
	if cancel_reason:
		doc.cancel_reason = cancel_reason
	if status:
		if status == "Cancelled":
			today = frappe.utils.getdate(frappe.utils.nowdate())
			block_date = frappe.utils.getdate(doc.work_date) if doc.work_date else today
			if block_date < today:
				frappe.throw(_("Past planned work blocks cannot be retroactively cancelled. They are recorded as Missed."), frappe.ValidationError)
		doc.status = status
	doc.flags.ignore_permissions = True
	doc.flags.ignore_links = True
	doc.save()

	# Synchronize reciprocal partner block if paired
	if getattr(doc, "paired_block", None) and frappe.db.exists("Planned Work Block", doc.paired_block):
		try:
			partner_doc = frappe.get_doc("Planned Work Block", doc.paired_block)
			synced = False
			if work_date and partner_doc.work_date != doc.work_date:
				partner_doc.work_date = doc.work_date
				synced = True
			if start_time and partner_doc.start_time != doc.start_time:
				partner_doc.start_time = doc.start_time
				synced = True
			if end_time and partner_doc.end_time != doc.end_time:
				partner_doc.end_time = doc.end_time
				synced = True
			if status and partner_doc.status != doc.status:
				partner_doc.status = doc.status
				synced = True
			if cancel_reason and getattr(partner_doc, "cancel_reason", None) != doc.cancel_reason:
				partner_doc.cancel_reason = doc.cancel_reason
				synced = True
			if synced:
				partner_doc.flags.ignore_permissions = True
				partner_doc.flags.ignore_links = True
				partner_doc.save()
		except Exception:
			pass

	if doc.task:
		try:
			update_task_kpi_progress(doc.task)
		except Exception:
			pass

	return {
		"status": "success",
		"name": doc.name,
		"duration_hours": doc.duration_hours,
		"actual_hours": doc.actual_hours,
		"variance_hours": doc.variance_hours,
		"block_status": doc.status,
		"cancel_reason": getattr(doc, "cancel_reason", None)
	}


@frappe.whitelist()
def reschedule_work_block(block_name, new_date=None, new_start_time=None, new_end_time=None):
	"""
	Non-destructive reschedule: preserves the original block commitment in place,
	marks it Rescheduled, and creates a linked copy in the target time slot.
	"""
	doc = frappe.get_doc("Planned Work Block", block_name)
	if doc.employee != frappe.session.user and not _is_planner_manager():
		frappe.throw(_("Not permitted to reschedule this work block."), frappe.PermissionError)

	from omnitrack.permissions import check_planned_block_past_lock
	check_planned_block_past_lock(doc, new_work_date=new_date)

	target_date = new_date or doc.work_date
	target_start = new_start_time or doc.start_time
	target_end = new_end_time or doc.end_time

	# Clone to target slot
	new_block = frappe.copy_doc(doc)
	new_block.work_date = target_date
	new_block.start_time = target_start
	new_block.end_time = target_end
	new_block.status = "Planned"
	new_block.actual_hours = 0.0
	new_block.sessions = []
	new_block.rescheduled_from = doc.name
	new_block.rescheduled_to = None
	new_block.flags.ignore_permissions = True
	new_block.flags.ignore_links = True
	new_block.insert()

	# Mark original block as Rescheduled
	doc.status = "Rescheduled"
	doc.rescheduled_to = new_block.name
	doc.flags.ignore_permissions = True
	doc.flags.ignore_links = True
	doc.save()

	return {
		"status": "success",
		"original": doc.name,
		"rescheduled_to": new_block.name,
		"new_date": str(target_date),
		"new_start_time": str(target_start),
		"new_end_time": str(target_end)
	}


@frappe.whitelist()
def delete_work_block(block_name):
	doc = frappe.get_doc("Planned Work Block", block_name)
	if doc.employee != frappe.session.user and not _is_planner_manager():
		frappe.throw(_("Not permitted to delete this work block."), frappe.PermissionError)

	from omnitrack.permissions import check_planned_block_past_lock
	# Past planned work blocks cannot be deleted by anyone
	check_planned_block_past_lock(doc)

	if flt(doc.actual_hours) > 0:
		frappe.throw(_("This block has logged work sessions. Cancel it with a reason instead of deleting."))
	if doc.status in ("In Progress", "Completed", "Logged (Full)", "Logged (Partial)", "Logged (Over)", "Rescheduled", "Cancelled"):
		frappe.throw(_("Committed, rescheduled, or cancelled blocks cannot be deleted to preserve reporting integrity."))
	doc.flags.ignore_permissions = True
	doc.flags.ignore_past_block_lock = True
	frappe.delete_doc("Planned Work Block", block_name, force=True)
	return {"status": "success"}


def mark_past_unworked_blocks_missed():
	"""Nightly cron: Any Planned Work Block whose work_date is before today,
	has actual_hours == 0, and status in ('Planned', 'Draft', 'In Progress')
	is automatically transitioned to 'Missed'."""
	today = nowdate()
	if not frappe.db.exists("DocType", "Planned Work Block"):
		return
	frappe.db.sql("""
		UPDATE `tabPlanned Work Block`
		SET status = 'Missed'
		WHERE work_date < %s
		  AND (actual_hours IS NULL OR actual_hours = 0)
		  AND status IN ('Planned', 'Draft', 'In Progress')
	""", (today,))
	frappe.db.commit()


