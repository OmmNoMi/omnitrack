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
	is_planner_manager as _is_planner_manager,
	parse_block_tasks as _parse_block_tasks,
)


def _require_session_notes(notes):
	from omnitrack.utils.validators import require_session_notes
	return require_session_notes(notes)


def get_timesheet_sync_mode():
	"""Returns the configured ERPNext Timesheet sync mode: 'Never', 'On Approval', or 'Immediate'."""
	from omnitrack.services import TimesheetBridge
	return TimesheetBridge.get_timesheet_sync_mode()


@frappe.whitelist()
def create_timesheet_from_work_block(block_name, force=False):
	"""Converts a Planned Work Block into a Timesheet document.
	Every Timesheet is connected to one Project (parent_project).
	The project is inherited from the work block, which in turn inherits it from the linked Task.

	Respects the configured ERPNext Timesheet sync mode ('Never', 'On Approval', 'Immediate').
	If sync_mode is 'Never' and not force: returns None.
	If sync_mode is 'On Approval' and not force: returns None unless block.approval_status == 'Approved'.
	"""
	if not frappe.db.exists("DocType", "Planned Work Block"):
		frappe.throw(_("Planned Work Block DocType is not available."))

	block = frappe.get_doc("Planned Work Block", block_name)
	if not frappe.db.exists("DocType", "Timesheet"):
		return None

	import omnitrack.api
	sync_mode = getattr(omnitrack.api, 'get_timesheet_sync_mode', get_timesheet_sync_mode)()
	if not force:
		if sync_mode == "Never":
			return None
		elif sync_mode == "On Approval" and getattr(block, "approval_status", None) != "Approved":
			return None

	# Resolve project and task from block
	project = block.project
	task = block.task
	if not task and block.work_item:
		w_item = str(block.work_item).strip()
		if w_item.startswith("task:"):
			task = w_item.split(":", 1)[1]
		elif frappe.db.exists("DocType", "Task") and frappe.db.exists("Task", w_item):
			task = w_item

	if not project and task and frappe.db.exists("DocType", "Task"):
		project = frappe.db.get_value("Task", task, "project")
		if project and block.project != project:
			block.project = project
			block.db_set("project", project)

	is_existing = False
	if block.timesheet and frappe.db.exists("Timesheet", block.timesheet):
		ts = frappe.get_doc("Timesheet", block.timesheet)
		ts.time_logs = []
		is_existing = True
	else:
		ts = frappe.new_doc("Timesheet")
		user_emp = frappe.db.get_value("Employee", {"user_id": block.employee}, "name") if frappe.db.exists("DocType", "Employee") else None
		if not user_emp and frappe.db.exists("DocType", "Employee"):
			if "+" in (block.employee or "") and "@" in (block.employee or ""):
				parts = block.employee.split("@")
				base_emp_email = f"{parts[0].split('+')[0]}@{parts[1]}"
				user_emp = frappe.db.get_value("Employee", {"user_id": base_emp_email}, "name")
			if not user_emp:
				if frappe.db.exists("Employee", block.employee):
					user_emp = block.employee
				else:
					user_emp = frappe.db.get_value("Employee", {"prefered_contact_email": block.employee}, "name")
		ts.employee = user_emp or block.employee
		
		company = frappe.db.get_single_value("Global Defaults", "default_company") if frappe.db.exists("DocType", "Global Defaults") else None
		if not company and frappe.db.exists("DocType", "Company"):
			comps = frappe.get_all("Company", limit=1)
			if comps:
				company = comps[0].name
		ts.company = company

	# Every Timesheet is connected to one Project (parent_project)
	if project:
		ts.parent_project = project
		if hasattr(ts, "project"):
			ts.project = project
		if frappe.db.exists("DocType", "Project"):
			cust = frappe.db.get_value("Project", project, "customer")
			if cust:
				ts.customer = cust

	is_away = any(m in (block.task_nature or "").lower() for m in ("leave", "absent", "out-of-office", "out of office", "break"))
	desired_activity = "Break" if "break" in (block.task_nature or "").lower() else ("Leave / Absence" if is_away else "Execution")
	activity = desired_activity
	if frappe.db.exists("DocType", "Activity Type"):
		if not frappe.db.exists("Activity Type", desired_activity):
			fallback_act = frappe.db.get_value("Activity Type", {"disabled": 0}, "name")
			activity = fallback_act or desired_activity

	# Build completed deliverables / tasks summary
	completed_deliverables = []
	if hasattr(block, "connected_tasks") and block.connected_tasks:
		for item in _parse_block_tasks(block.connected_tasks):
			if isinstance(item, dict) and item.get("status") in ("Closed", "Completed", "Done"):
				subj = item.get("subject") or item.get("title") or item.get("task")
				if subj:
					completed_deliverables.append(subj)

	accomplished_text = ""
	if completed_deliverables:
		accomplished_text = "\n\nAccomplished Tasks:\n" + "\n".join(f"• {s}" for s in completed_deliverables)

	from datetime import datetime, timedelta

	if block.sessions:
		for sess in block.sessions:
			base_date = sess.session_date or block.work_date or nowdate()
			start_t = sess.from_time or block.start_time or "09:00:00"
			s_from = f"{base_date} {start_t}"
			dur = flt(sess.hours)
			if sess.to_time and str(sess.to_time) != str(sess.from_time):
				s_to = f"{base_date} {sess.to_time}"
			else:
				try:
					fmt = "%Y-%m-%d %H:%M:%S" if len(str(start_t).split(":")) == 3 else "%Y-%m-%d %H:%M"
					dt_f = datetime.strptime(s_from, fmt)
					dt_t = dt_f + timedelta(hours=dur if dur > 0 else 0.5)
					s_to = dt_t.strftime("%Y-%m-%d %H:%M:%S")
				except Exception:
					s_to = s_from

			base_desc = sess.notes or block.deliverable_notes or f"OmniTrack Session ({block.name})"
			if accomplished_text and "Accomplished Tasks:" not in base_desc:
				base_desc = f"{base_desc}{accomplished_text}"

			row = {
				"from_time": s_from,
				"to_time": s_to,
				"hours": dur,
				"project": project,
				"task": task,
				"activity_type": activity,
				"is_billable": 0 if is_away else 1,
				"description": base_desc
			}
			ts.append("time_logs", row)
	else:
		base_date = block.work_date or nowdate()
		start_t = block.start_time or "09:00:00"
		s_from = f"{base_date} {start_t}"
		dur = flt(block.duration_hours)
		if block.end_time and str(block.end_time) != str(block.start_time):
			s_to = f"{base_date} {block.end_time}"
		else:
			try:
				fmt = "%Y-%m-%d %H:%M:%S" if len(str(start_t).split(":")) == 3 else "%Y-%m-%d %H:%M"
				dt_f = datetime.strptime(s_from, fmt)
				dt_t = dt_f + timedelta(hours=dur if dur > 0 else 1.0)
				s_to = dt_t.strftime("%Y-%m-%d %H:%M:%S")
			except Exception:
				s_to = s_from

		base_desc = block.deliverable_notes or f"OmniTrack Block {block.name} ({block.cryptographic_hash or ''})"
		if accomplished_text and "Accomplished Tasks:" not in base_desc:
			base_desc = f"{base_desc}{accomplished_text}"

		row = {
			"from_time": s_from,
			"to_time": s_to,
			"hours": dur,
			"project": project,
			"task": task,
			"activity_type": activity,
			"is_billable": 0 if is_away else 1,
			"description": base_desc
		}
		ts.append("time_logs", row)

	ts.flags.ignore_permissions = True
	if is_existing:
		ts.save()
	else:
		ts.insert()

	block.timesheet = ts.name
	block.db_set("timesheet", ts.name)
	return ts.name


def sync_work_block_timesheet(block_or_name, force=False):
	"""Synchronizes the linked Timesheet for a Planned Work Block.
	Respects the configured ERPNext Timesheet sync mode ('Never', 'On Approval', 'Immediate').
	"""
	if not frappe.db.exists("DocType", "Timesheet"):
		return None

	sync_mode = get_timesheet_sync_mode()
	if not force and sync_mode == "Never":
		return None

	doc = block_or_name if hasattr(block_or_name, "sessions") else frappe.get_doc("Planned Work Block", block_or_name)
	if not force and sync_mode == "On Approval" and getattr(doc, "approval_status", None) != "Approved":
		return None

	if not doc.timesheet or not frappe.db.exists("Timesheet", doc.timesheet):
		if flt(doc.actual_hours) > 0:
			try:
				return create_timesheet_from_work_block(doc.name, force=force)
			except Exception:
				return None
		return None

	old_ts_name = doc.timesheet
	ts = frappe.get_doc("Timesheet", old_ts_name)

	# Case 1: Draft Timesheet
	if ts.docstatus == 0:
		if flt(doc.actual_hours) == 0 and not doc.sessions:
			try:
				ts.flags.ignore_permissions = True
				frappe.delete_doc("Timesheet", old_ts_name, force=True)
				doc.timesheet = None
				doc.db_set("timesheet", None)
			except Exception:
				pass
			return None
		else:
			return create_timesheet_from_work_block(doc.name)

	# Case 2: Submitted Timesheet
	elif ts.docstatus == 1:
		from omnitrack.permissions import is_submitted_timesheet_amendment_allowed
		if not is_submitted_timesheet_amendment_allowed():
			return old_ts_name

		# Cancel the old timesheet
		ts.flags.ignore_permissions = True
		ts.cancel()

		if flt(doc.actual_hours) == 0 and not doc.sessions:
			doc.timesheet = None
			doc.db_set("timesheet", None)
			return None

		# Create amended timesheet
		new_ts = frappe.copy_doc(ts, ignore_no_copy=True)
		new_ts.docstatus = 0
		new_ts.amended_from = old_ts_name
		new_ts.time_logs = []
		new_ts.flags.ignore_permissions = True
		new_ts.insert(ignore_permissions=True)

		doc.timesheet = new_ts.name
		doc.db_set("timesheet", new_ts.name)

		# Populate time logs from doc.sessions
		create_timesheet_from_work_block(doc.name)

		# Re-fetch and submit
		reloaded = frappe.get_doc("Timesheet", new_ts.name)
		reloaded.flags.ignore_permissions = True
		reloaded.submit()

		return new_ts.name

	return doc.timesheet


def process_scheduled_timesheet_sync():
	"""Scheduled batch aggregation of completed work blocks into timesheets."""
	frappe.logger("omnitrack").info("Scheduled timesheet batch aggregation completed.")


@frappe.whitelist()
def log_work_session(block_name, from_time=None, to_time=None, hours=None,
					 session_date=None, notes=None, logged_via="Manual",
					 output_metrics=None):
	"""Record a REAL work session against a planned block. Actual vs planned variance
	is recomputed on the block. Many sessions may be logged against one block."""
	doc = frappe.get_doc("Planned Work Block", block_name)
	if doc.employee != frappe.session.user and not _is_planner_manager():
		frappe.throw(_("Not permitted to log time on this work block."), frappe.PermissionError)

	notes = _require_session_notes(notes)

	base_date = session_date or doc.work_date or nowdate()

	from omnitrack.services import TemporalGovernor, MidnightSplitter, PairingEngine
	# OmniTrack Users can only log timesheets for today and yesterday; earlier dates require Manager
	TemporalGovernor.check_timesheet_date_permission(base_date, frappe.session.user)

	if MidnightSplitter.is_overnight(from_time, to_time):
		p1, p2 = MidnightSplitter.split_session_rows(
			base_date=base_date,
			from_time=from_time,
			to_time=to_time,
			notes=notes,
			logged_via=logged_via,
			task_nature=doc.task_nature
		)
		doc.append("sessions", p1)
		doc.append("sessions", p2)
	else:
		if not hours and from_time and to_time:
			hours = _duration_hours(from_time, to_time)
		hours = flt(hours)
		if hours <= 0:
			frappe.throw(_("Session hours must be greater than zero."))

		doc.append("sessions", {
			"session_date": base_date,
			"from_time": from_time,
			"to_time": to_time,
			"hours": hours,
			"notes": notes,
			"logged_via": logged_via or "Manual",
			"task_nature": doc.task_nature,
		})

	# Phase 2: Quantitative Deliverable Output Metrics
	if output_metrics:
		if isinstance(output_metrics, str):
			try:
				output_metrics = json.loads(output_metrics)
			except Exception:
				output_metrics = []
		if isinstance(output_metrics, list):
			for m in output_metrics:
				if isinstance(m, dict) and (m.get("quantity") or m.get("metric_type")):
					doc.append("output_metrics", {
						"metric_type": m.get("metric_type") or "Records Processed",
						"quantity": flt(m.get("quantity", 1.0)),
						"unit": m.get("unit") or "",
						"reference_id": m.get("reference_id") or "",
						"notes": m.get("notes") or ""
					})

	doc.flags.ignore_permissions = True
	if not frappe.db.exists("DocType", "Project") or not frappe.db.exists("DocType", "Task"):
		doc.flags.ignore_links = True
	doc.save()

	# Reciprocal pairing sync: mirror session row to paired partner block via PairingEngine
	PairingEngine.mirror_session_to_partner(
		source_doc=doc,
		session_date=base_date,
		from_time=from_time,
		to_time=to_time,
		hours=hours,
		notes=notes,
		logged_via=logged_via,
		output_metrics=output_metrics
	)

	# Update Task KPI progress if linked to a Task
	if doc.task:
		try:
			from omnitrack.api.tasks import update_task_kpi_progress
			update_task_kpi_progress(doc.task)
		except Exception:
			pass

	# Auto-create / update Timesheet connected to Project and Task if sync_mode is Immediate
	if frappe.db.exists("DocType", "Timesheet") and get_timesheet_sync_mode() == "Immediate":
		try:
			create_timesheet_from_work_block(doc.name)
		except Exception:
			pass

	# Auto-post structured sprint accomplishment recap to Raven task thread
	try:
		from omnitrack.raven_bridge import post_session_accomplishment_recap
		post_session_accomplishment_recap(
			work_block_name=doc.name,
			session_notes=notes,
			duration_hours=flt(hours),
			timesheet_name=getattr(doc, "timesheet", None),
		)
	except Exception:
		pass

	# Auto-clear any in-flight active session across devices
	try:
		from omnitrack.api.stopwatch import sync_active_session
		sync_active_session(None)
	except Exception:
		pass
	frappe.db.commit()

	return {
		"status": "success",
		"name": doc.name,
		"actual_hours": doc.actual_hours,
		"planned_hours": doc.duration_hours,
		"variance_hours": doc.variance_hours,
		"block_status": doc.status,
	}


@frappe.whitelist()
def update_work_session(session_name, block_name=None, from_time=None, to_time=None, hours=None, session_date=None, notes=None):
	"""Update an existing logged work session (timing, notes, date) on a Planned Work Block,
	recalculating block actuals, variance, and refreshing linked Timesheet."""
	if not session_name:
		frappe.throw(_("Session identifier is required."))

	if not block_name:
		block_name = frappe.db.get_value("OmniTrack Work Session", session_name, "parent")
	if not block_name:
		frappe.throw(_("Planned Work Block not found for session."))

	doc = frappe.get_doc("Planned Work Block", block_name)
	if doc.employee != frappe.session.user and not _is_planner_manager():
		frappe.throw(_("Not permitted to modify sessions on this work block."), frappe.PermissionError)

	base_date = session_date or doc.work_date or nowdate()
	from omnitrack.permissions import check_timesheet_date_permission
	check_timesheet_date_permission(base_date, frappe.session.user)

	sess_row = None
	for s in doc.sessions:
		if s.name == session_name:
			sess_row = s
			break

	if not sess_row:
		frappe.throw(_("Work session not found in work block."))

	if session_date:
		sess_row.session_date = session_date
	if from_time:
		sess_row.from_time = from_time
	if to_time:
		sess_row.to_time = to_time
	if notes is not None:
		sess_row.notes = notes

	if from_time and to_time:
		sess_row.hours = flt(_duration_hours(from_time, to_time))
	elif hours:
		sess_row.hours = flt(hours)

	# Recalculate block actual hours and variance
	doc.actual_hours = round(sum(flt(s.hours) for s in doc.sessions), 2)
	doc.variance_hours = round(doc.actual_hours - flt(doc.duration_hours), 2)
	if doc.actual_hours >= flt(doc.duration_hours):
		doc.status = "Completed" if doc.status != "Logged (Full)" else "Logged (Full)"
	elif doc.actual_hours > 0:
		doc.status = "Logged (Partial)"

	doc.flags.ignore_permissions = True
	if not frappe.db.exists("DocType", "Project") or not frappe.db.exists("DocType", "Task"):
		doc.flags.ignore_links = True
	doc.save()

	# Synchronize linked timesheet (handles draft & submitted amendment)
	try:
		sync_work_block_timesheet(doc)
	except Exception:
		pass

	# Update Task KPI progress if linked to a Task
	if doc.task:
		try:
			update_task_kpi_progress(doc.task)
		except Exception:
			pass

	frappe.db.commit()
	return {
		"status": "success",
		"name": doc.name,
		"actual_hours": doc.actual_hours,
		"planned_hours": doc.duration_hours,
		"variance_hours": doc.variance_hours,
		"block_status": doc.status,
		"sessions": doc.sessions,
	}


@frappe.whitelist()
def delete_work_session(session_name, block_name=None):
	"""Delete an erroneous work session from a Planned Work Block,
	recalculating block actuals, variance, and refreshing linked Timesheet."""
	if not session_name:
		frappe.throw(_("Session identifier is required."))

	if not block_name:
		block_name = frappe.db.get_value("OmniTrack Work Session", session_name, "parent")
	if not block_name:
		frappe.throw(_("Planned Work Block not found for session."))

	doc = frappe.get_doc("Planned Work Block", block_name)
	if doc.employee != frappe.session.user and not _is_planner_manager():
		frappe.throw(_("Not permitted to delete sessions on this work block."), frappe.PermissionError)

	base_date = doc.work_date or nowdate()
	from omnitrack.permissions import check_timesheet_date_permission
	check_timesheet_date_permission(base_date, frappe.session.user)

	doc.sessions = [s for s in doc.sessions if s.name != session_name]
	doc.actual_hours = round(sum(flt(s.hours) for s in doc.sessions), 2)
	doc.variance_hours = round(doc.actual_hours - flt(doc.duration_hours), 2)
	if doc.actual_hours == 0:
		doc.status = "Planned"
	elif doc.actual_hours >= flt(doc.duration_hours):
		doc.status = "Completed" if doc.status != "Logged (Full)" else "Logged (Full)"
	else:
		doc.status = "Logged (Partial)"

	doc.flags.ignore_permissions = True
	if not frappe.db.exists("DocType", "Project") or not frappe.db.exists("DocType", "Task"):
		doc.flags.ignore_links = True
	doc.save()

	# Synchronize linked timesheet (handles draft & submitted cancellation)
	try:
		sync_work_block_timesheet(doc)
	except Exception:
		pass

	# Update Task KPI progress if linked to a Task
	if doc.task:
		try:
			update_task_kpi_progress(doc.task)
		except Exception:
			pass

	frappe.db.commit()
	return {
		"status": "success",
		"name": doc.name,
		"actual_hours": doc.actual_hours,
		"planned_hours": doc.duration_hours,
		"variance_hours": doc.variance_hours,
		"block_status": doc.status,
		"sessions": doc.sessions,
	}


@frappe.whitelist()
def approve_work_blocks(block_names=None, employee=None, work_date=None, comments=None):
	"""Approves Planned Work Blocks for an employee or specific block list.
	Enforces:
	1. Caller must be an OmniTrack Manager, HR Manager, System Manager, or Administrator.
	2. Transitions approval_status to 'Approved', records approved_by, approval_date, and approval_notes.
	3. If ERPNext Timesheet sync mode is 'On Approval' or 'Immediate', generates/syncs the linked Timesheets.

	Args:
		block_names (list|str, optional): List of block IDs or single block ID.
		employee (str, optional): Employee/User email to approve all completed/unapproved blocks for.
		work_date (str, optional): Date (YYYY-MM-DD) when approving by employee. Defaults to today.
		comments (str, optional): Review/approval remarks.

	Returns:
		dict: Summary of approved blocks, total hours approved, and created timesheets.
	"""
	approver = frappe.session.user
	if not approver or approver == "Guest":
		frappe.throw(_("Authentication required to approve timesheets."), frappe.PermissionError)

	from omnitrack.permissions import is_omnitrack_manager
	is_mgr = is_omnitrack_manager(approver) or any(
		r in frappe.get_roles(approver) for r in ("HR Manager", "HR User", "System Manager", "Administrator")
	)
	if not is_mgr:
		frappe.throw(_("Only HR or OmniTrack Managers can approve timesheets."), frappe.PermissionError)

	target_blocks = []
	if block_names:
		if isinstance(block_names, str):
			try:
				parsed = json.loads(block_names)
				if isinstance(parsed, list):
					target_blocks = parsed
				else:
					target_blocks = [block_names]
			except Exception:
				target_blocks = [b.strip() for b in block_names.split(",") if b.strip()]
		elif isinstance(block_names, list):
			target_blocks = block_names
	elif employee:
		target_user = _resolve_planner_user(employee)
		target_date = work_date or nowdate()
		target_blocks = frappe.get_all(
			"Planned Work Block",
			filters={
				"employee": target_user,
				"work_date": target_date,
				"approval_status": ["!=", "Approved"]
			},
			pluck="name"
		)
	else:
		frappe.throw(_("Specify block_names or employee to approve timesheets."))

	approved_list = []
	total_hours = 0.0
	sync_mode = get_timesheet_sync_mode()

	for b_name in target_blocks:
		if not frappe.db.exists("Planned Work Block", b_name):
			continue
		b_doc = frappe.get_doc("Planned Work Block", b_name)
		b_doc.approval_status = "Approved"
		b_doc.approved_by = approver
		b_doc.approval_date = now_datetime()
		if comments:
			b_doc.approval_notes = comments
		b_doc.flags.ignore_permissions = True
		b_doc.save()

		ts_name = None
		if sync_mode in ("On Approval", "Immediate") and frappe.db.exists("DocType", "Timesheet"):
			try:
				ts_name = create_timesheet_from_work_block(b_doc.name, force=True)
			except Exception as te:
				frappe.log_error(f"Error syncing approved timesheet for {b_name}: {te}", "OmniTrack Approval")

		approved_list.append({
			"block_name": b_name,
			"employee": b_doc.employee,
			"work_date": str(b_doc.work_date),
			"actual_hours": flt(b_doc.actual_hours),
			"timesheet": ts_name or b_doc.timesheet,
			"status": "Approved"
		})
		total_hours += flt(b_doc.actual_hours)

	return {
		"status": "success",
		"message": f"Successfully approved {len(approved_list)} work block(s) ({round(total_hours, 2)} hrs).",
		"approved_by": approver,
		"sync_mode": sync_mode,
		"total_approved_hours": round(total_hours, 2),
		"approved_blocks": approved_list
	}


@frappe.whitelist()
def get_pending_team_approvals(work_date=None, employee=None):
	"""
	Returns Planned Work Blocks requiring manager approval.
	Blocks that have actual work logged (actual_hours > 0) and approval_status != 'Approved'.
	Enforces Manager / HR / Admin role permissions.
	"""
	approver = frappe.session.user
	if not approver or approver == "Guest":
		frappe.throw(_("Authentication required to view pending approvals."), frappe.PermissionError)

	from omnitrack.permissions import is_omnitrack_manager
	is_mgr = is_omnitrack_manager(approver) or any(
		r in frappe.get_roles(approver) for r in ("HR Manager", "HR User", "System Manager", "Administrator")
	)
	if not is_mgr:
		frappe.throw(_("Only HR or OmniTrack Managers can view team approvals."), frappe.PermissionError)

	filters = {
		"approval_status": ["!=", "Approved"],
		"actual_hours": [">", 0]
	}
	if work_date:
		filters["work_date"] = work_date
	if employee and employee != "All":
		filters["employee"] = employee

	blocks = frappe.get_all(
		"Planned Work Block",
		filters=filters,
		fields=[
			"name", "employee", "associate_name", "work_date",
			"start_time", "end_time", "duration_hours", "actual_hours",
			"variance_hours", "work_item_label", "project", "task",
			"task_nature", "status", "approval_status", "pairing_partner", "paired_block"
		],
		order_by="work_date desc, start_time desc",
		limit=100
	)

	for b in blocks:
		b["start_time"] = _time_str(b.get("start_time"))
		b["end_time"] = _time_str(b.get("end_time"))
		b["work_date"] = str(b.get("work_date") or "")
		if b.get("pairing_partner"):
			b["pairing_partner_name"] = frappe.db.get_value("User", b["pairing_partner"], "full_name") or b["pairing_partner"]

	return blocks


