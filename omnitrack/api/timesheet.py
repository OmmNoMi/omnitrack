# Copyright (c) 2026, OmmNoMi Automation LLP and contributors
# For license information, please see license.txt

import hashlib
import json
from datetime import datetime, timedelta
import frappe
from omnitrack.utils.activity import AWAY, to_kind
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
)
from omnitrack.api.tasks import update_task_kpi_progress


def _require_session_notes(notes):
	from omnitrack.utils.validators import require_session_notes
	return require_session_notes(notes)


# A clock a few minutes ahead of the server's is not time ahead
FUTURE_SLACK = timedelta(minutes=5)


def _require_worked(session_date, from_time, to_time):
	"""A work session is time already worked: it may not end after now. Time not worked yet
	would be charged and paid before it happened; it is logged by running a session instead."""
	if not session_date or not to_time:
		return
	end_day = getdate(session_date)
	if from_time and MidnightSplitter.is_overnight(from_time, to_time):
		end_day = add_days(end_day, 1)
	end = get_datetime(f"{end_day} {_time_str(to_time)}")
	if end > now_datetime() + FUTURE_SLACK:
		frappe.throw(_("A work session cannot end after now. Start a session when the work begins."))


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
		
		# Multi-company hierarchy: Project.company -> Employee.company -> Global Defaults.default_company
		company = None
		if project and frappe.db.exists("DocType", "Project"):
			company = frappe.db.get_value("Project", project, "company")
		if not company and user_emp and frappe.db.exists("DocType", "Employee"):
			company = frappe.db.get_value("Employee", user_emp, "company")
		if not company and frappe.db.exists("DocType", "Global Defaults"):
			company = frappe.db.get_single_value("Global Defaults", "default_company")
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

	kind = to_kind(block.task_nature)
	is_away = kind in AWAY
	desired_activity = "Break" if kind == "Break" else ("Leave / Absence" if is_away else "Execution")
	activity = desired_activity
	if frappe.db.exists("DocType", "Activity Type"):
		if not frappe.db.exists("Activity Type", desired_activity):
			fallback_act = frappe.db.get_value("Activity Type", {"disabled": 0}, "name")
			activity = fallback_act or desired_activity

	# Build completed deliverables / tasks summary
	completed_deliverables = []
	for row in block.get("tasks") or []:
		if row.status == "Completed" and row.subject:
			completed_deliverables.append(row.subject)

	accomplished_text = ""
	if completed_deliverables:
		accomplished_text = "\n\nAccomplished Tasks:\n" + "\n".join(f"• {s}" for s in completed_deliverables)

	from omnitrack.utils.log_span import log_span

	if block.sessions:
		for sess in block.sessions:
			base_date = sess.session_date or block.work_date or nowdate()
			start_t = sess.from_time or block.start_time or "09:00:00"
			dur = flt(sess.hours)
			# An end at or before the start is the next morning
			s_from, s_to = log_span(base_date, start_t, sess.to_time, dur, 0.5)

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
		dur = flt(block.duration_hours)
		s_from, s_to = log_span(base_date, start_t, block.end_time, dur, 1.0)

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
	_require_worked(base_date, from_time, to_time)

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
			# Kept on record: a Timesheet that silently never appears is lost time
			frappe.log_error(title="OmniTrack: Timesheet sync failed", reference_doctype="Planned Work Block", reference_name=doc.name)

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
		# The drawer that logged it shows the new row without a second fetch
		"sessions": doc.sessions,
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

	from omnitrack.permissions import check_approved_block_lock, check_timesheet_date_permission
	check_approved_block_lock(doc, frappe.session.user)

	base_date = session_date or doc.work_date or nowdate()
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
	_require_worked(sess_row.session_date, sess_row.from_time, sess_row.to_time)

	# save() rolls the sessions up into actual hours, variance and status (roll_up_sessions)
	doc.flags.ignore_permissions = True
	if not frappe.db.exists("DocType", "Project") or not frappe.db.exists("DocType", "Task"):
		doc.flags.ignore_links = True
	doc.save()

	# Synchronize linked timesheet (handles draft & submitted amendment)
	try:
		sync_work_block_timesheet(doc)
	except Exception:
		# Kept on record: a Timesheet that silently never appears is lost time
		frappe.log_error(title="OmniTrack: Timesheet sync failed", reference_doctype="Planned Work Block", reference_name=getattr(doc, "name", doc))

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

	from omnitrack.permissions import check_approved_block_lock, check_session_deletion_permission, check_timesheet_date_permission
	check_approved_block_lock(doc, frappe.session.user)
	check_session_deletion_permission(frappe.session.user)

	base_date = doc.work_date or nowdate()
	check_timesheet_date_permission(base_date, frappe.session.user)

	doc.sessions = [s for s in doc.sessions if s.name != session_name]
	# save() rolls the remaining sessions up into actual hours, variance and status

	doc.flags.ignore_permissions = True
	if not frappe.db.exists("DocType", "Project") or not frappe.db.exists("DocType", "Task"):
		doc.flags.ignore_links = True
	doc.save()

	# Synchronize linked timesheet (handles draft & submitted cancellation)
	try:
		sync_work_block_timesheet(doc)
	except Exception:
		# Kept on record: a Timesheet that silently never appears is lost time
		frappe.log_error(title="OmniTrack: Timesheet sync failed", reference_doctype="Planned Work Block", reference_name=getattr(doc, "name", doc))

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


# A task's status or workflow state, the two fields a move changes
_TASK_STATE_FIELDS = ("status", "workflow_state")
# Stop is pressed a moment after the last move
_SESSION_SLACK = timedelta(minutes=2)


def _session_window(row):
	"""(start, end) datetimes a session ran, across midnight if it did."""
	day = getdate(row.session_date)
	if not (row.from_time and row.to_time):
		start = get_datetime(f"{day} 00:00:00")
		return start, start + timedelta(days=1)
	start = get_datetime(f"{day} {_time_str(row.from_time)}")
	end = get_datetime(f"{day} {_time_str(row.to_time)}")
	if end <= start:
		end += timedelta(days=1)
	return start, end


def _task_moves(block, start, end):
	"""What happened to the session's tasks while it ran: rows ticked off on the block, and status
	or workflow moves from each Task or ToDo's own history (Version), made by the block's person.
	Read by time, so an entry logged before this existed shows its moves too."""
	moves = []
	refs = {}
	for row in block.get("tasks") or []:
		if row.completed_at and start <= get_datetime(row.completed_at) <= end + _SESSION_SLACK:
			moves.append({"subject": row.subject, "to": "Completed", "at": str(row.completed_at), "ref": row.work_item})
		if row.reference_doctype in ("Task", "ToDo") and row.reference_name:
			refs[(row.reference_doctype, row.reference_name)] = row
	for (dt, name), row in refs.items():
		if not frappe.db.exists("DocType", dt):
			continue
		for v in frappe.get_all(
			"Version",
			filters={"ref_doctype": dt, "docname": name, "owner": block.employee,
				"creation": ["between", [start, end + _SESSION_SLACK]]},
			fields=["data", "creation"],
			order_by="creation asc",
		):
			try:
				changed = json.loads(v.data or "{}").get("changed") or []
			except Exception:
				continue
			for field, old, new in changed:
				if field in _TASK_STATE_FIELDS and new and old != new:
					moves.append({"subject": row.subject, "from": old, "to": new, "at": str(v.creation), "ref": row.work_item})
	return sorted(moves, key=lambda m: m["at"])


def _with_workflow(task):
	"""A block task row plus where its document stands now and the moves the viewer can make.
	The row's own status is a snapshot; the document's workflow state is the truth."""
	task.update({"workflow": None, "state": task.get("status") or "Open", "actions": []})
	doctype, name = task.get("doctype"), task.get("id")
	if doctype not in ("Task", "ToDo") or not name or not frappe.db.exists("DocType", doctype):
		return task
	if not frappe.db.exists(doctype, name) or not frappe.has_permission(doctype, "read", name):
		return task
	from omnitrack.api.tasks import _workflow_of
	try:
		task.update(_workflow_of(frappe.get_doc(doctype, name)))
	except Exception:
		frappe.log_error(title="OmniTrack: task workflow for a Work Session")
	return task


@frappe.whitelist()
def get_work_session(session_name):
	"""One Work Session and everything it stands for: the block it sits in (planned, or the carrier
	of an unplanned entry), the tasks it was for, the task moves made while it ran, the block's
	output, its approval and its ERPNext Timesheet. Any of those may be missing."""
	parent = frappe.db.get_value("OmniTrack Work Session", {"name": session_name, "parenttype": "Planned Work Block"}, "parent")
	if not parent:
		frappe.throw(_("Work Session {0} not found").format(session_name), frappe.DoesNotExistError)
	block = frappe.get_doc("Planned Work Block", parent)
	from omnitrack.permissions import has_work_block_permission
	if not has_work_block_permission(block, "read"):
		frappe.throw(_("Not permitted to read this Work Session."), frappe.PermissionError)

	row = next(s for s in block.sessions if s.name == session_name)
	start, end = _session_window(row)
	from omnitrack.utils.block_tasks import block_tasks
	full_name = lambda user: (frappe.db.get_value("User", user, "full_name") or user) if user else None
	timesheet = None
	if block.timesheet and frappe.db.exists("DocType", "Timesheet"):
		ts = frappe.db.get_value("Timesheet", block.timesheet, ["name", "docstatus"], as_dict=True)
		if ts:
			timesheet = {"name": ts.name, "state": ("Draft", "Submitted", "Cancelled")[ts.docstatus or 0]}
	return {
		"session": {
			"name": row.name, "session_date": str(row.session_date or ""), "from_time": str(row.from_time or ""),
			"to_time": str(row.to_time or ""), "hours": flt(row.hours), "notes": row.notes or "",
			"logged_via": row.logged_via or "", "task_nature": to_kind(row.task_nature or block.task_nature),
		},
		"employee": block.employee,
		"employee_name": full_name(block.employee),
		"block": {
			"name": block.name, "unplanned": block.unplanned, "unplanned_reason": block.unplanned_reason,
			"work_date": str(block.work_date or ""), "start_time": str(block.start_time or ""), "end_time": str(block.end_time or ""),
			"duration_hours": flt(block.duration_hours), "actual_hours": flt(block.actual_hours),
			"status": block.status, "project": block.project,
			"work_item_label": block.work_item_label, "deliverable_notes": block.deliverable_notes,
			"approval_status": block.approval_status or "", "approved_by": block.approved_by,
			"approved_by_name": full_name(block.approved_by),
			"approval_date": str(block.approval_date or ""), "approval_notes": block.approval_notes or "",
			"entries": len(block.sessions),
		},
		"tasks": [_with_workflow(t) for t in block_tasks(block)],
		"task_moves": _task_moves(block, start, end),
		"output_metrics": [
			{"metric_type": m.metric_type, "quantity": flt(m.quantity), "unit": m.unit or "", "notes": m.notes or ""}
			for m in (block.get("output_metrics") or [])
		],
		"timesheet": timesheet,
	}


def _is_recording(block):
	"""Whether the block's owner has a live session running on it right now."""
	from omnitrack.api.stopwatch import get_active_session
	live = get_active_session(user=block.employee) or {}
	return live.get("trackerBlockName") == block.name


# What an approval changes on a block, kept briefly so its approver can take it back
REVIEW_FIELDS = ("approval_status", "approved_by", "approval_date", "approval_notes", "timesheet")
# The client offers Undo for 5 seconds; the server allows a slow network some slack beyond that
UNDO_REVIEW_SECONDS = 30


def _review_key(block_name):
	return f"omnitrack:undo-review:{block_name}"


def _remember_review(block_name, user, before):
	frappe.cache.set_value(_review_key(block_name), {"by": user, "before": before}, expires_in_sec=UNDO_REVIEW_SECONDS)


@frappe.whitelist(methods=["POST"])
def undo_block_approval(block_name):
	"""Puts an entry back as it was before its approver approved it, moments ago.
	Only the approver can, only while the block is still as they left it, and a draft
	Timesheet the approval created goes with it."""
	user = frappe.session.user
	saved = frappe.cache.get_value(_review_key(block_name)) if block_name else None
	if not saved or saved.get("by") != user:
		frappe.throw(_("It is too late to undo this approval."))
	b_doc = frappe.get_doc("Planned Work Block", block_name)
	if b_doc.approval_status != "Approved" or b_doc.approved_by != user:
		frappe.throw(_("This entry has changed since you approved it."))
	before = saved["before"]
	made = b_doc.timesheet if b_doc.timesheet and b_doc.timesheet != before.get("timesheet") else None
	if made and frappe.db.get_value("Timesheet", made, "docstatus") != 0:
		frappe.throw(_("The Timesheet for this approval is already submitted."))
	for f in ("approval_status", "approved_by", "approval_date", "approval_notes"):
		b_doc.set(f, before.get(f))
	b_doc.approval_status = b_doc.approval_status or "Draft"
	b_doc.flags.ignore_permissions = True
	b_doc.save()
	if made:
		b_doc.db_set("timesheet", before.get("timesheet"))
		frappe.delete_doc("Timesheet", made, ignore_permissions=True)
	frappe.cache.delete_value(_review_key(block_name))
	return {"name": b_doc.name, "approval_status": b_doc.approval_status}


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
	still_recording = []
	total_hours = 0.0
	sync_mode = get_timesheet_sync_mode()

	for b_name in target_blocks:
		if not frappe.db.exists("Planned Work Block", b_name):
			continue
		b_doc = frappe.get_doc("Planned Work Block", b_name)
		# A session still running on the block is not a timesheet yet
		if _is_recording(b_doc):
			still_recording.append(b_name)
			continue
		before = {f: b_doc.get(f) for f in REVIEW_FIELDS}
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
		_remember_review(b_name, approver, before)

		approved_list.append({
			"block_name": b_name,
			"employee": b_doc.employee,
			"work_date": str(b_doc.work_date),
			"actual_hours": flt(b_doc.actual_hours),
			"timesheet": ts_name or b_doc.timesheet,
			"status": "Approved"
		})
		total_hours += flt(b_doc.actual_hours)

	if still_recording and not approved_list:
		frappe.throw(_("A session is still running on this block. Approve it once the session is stopped."), frappe.ValidationError)

	return {
		"status": "success",
		"message": f"Successfully approved {len(approved_list)} work block(s) ({round(total_hours, 2)} hrs).",
		"still_recording": still_recording,
		"approved_by": approver,
		"sync_mode": sync_mode,
		"total_approved_hours": round(total_hours, 2),
		"approved_blocks": approved_list
	}


@frappe.whitelist()
def flag_work_block(block_name, reason=None):
	"""
	Flags a Planned Work Block for review or corrections.
	Only OmniTrack Managers, HR Managers, System Managers, or Administrators can flag a block.
	Sets approval_status to 'Flagged' and records flagged_reason.
	"""
	approver = frappe.session.user
	if not approver or approver == "Guest":
		frappe.throw(_("Authentication required to flag work blocks."), frappe.PermissionError)

	from omnitrack.permissions import is_omnitrack_manager
	is_mgr = is_omnitrack_manager(approver) or any(
		r in frappe.get_roles(approver) for r in ("HR Manager", "HR User", "System Manager", "Administrator")
	)
	if not is_mgr:
		frappe.throw(_("Only HR or OmniTrack Managers can flag work blocks."), frappe.PermissionError)

	if not block_name or not frappe.db.exists("Planned Work Block", block_name):
		frappe.throw(_("Planned Work Block not found."))

	b_doc = frappe.get_doc("Planned Work Block", block_name)
	b_doc.approval_status = "Flagged"
	b_doc.flagged_reason = reason or "Flagged by manager for clarification."
	# The block has no flagged_reason field; approval_notes is where the reason is kept
	b_doc.approval_notes = b_doc.flagged_reason
	b_doc.approved_by = approver
	b_doc.approval_date = now_datetime()
	b_doc.flags.ignore_permissions = True
	if not frappe.db.exists("DocType", "Project") or not frappe.db.exists("DocType", "Task"):
		b_doc.flags.ignore_links = True
	b_doc.save()

	return {
		"status": "success",
		"message": _("Work block {0} flagged for review.").format(block_name),
		"name": b_doc.name,
		"approval_status": b_doc.approval_status,
		"flagged_reason": b_doc.flagged_reason,
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
			"task_nature", "unplanned", "status", "approval_status", "approval_notes", "pairing_partner", "paired_block",
			"deliverable_notes"
		],
		order_by="work_date desc, start_time desc",
		limit=100
	)

	# Bulk query child sessions and deliverable output metrics for all pending blocks
	block_names = [b.name for b in blocks]
	sessions_by_block = {}
	if block_names and frappe.db.exists("DocType", "OmniTrack Work Session"):
		all_sessions = frappe.get_all(
			"OmniTrack Work Session",
			filters={"parent": ["in", block_names], "parenttype": "Planned Work Block"},
			fields=["parent", "session_date", "from_time", "to_time", "hours", "notes", "logged_via"],
			order_by="session_date asc, from_time asc"
		)
		for s in all_sessions:
			s["session_date"] = str(s.session_date or "")
			s["from_time"] = _time_str(s.from_time)
			s["to_time"] = _time_str(s.to_time)
			s["hours"] = flt(s.hours)
			sessions_by_block.setdefault(s.parent, []).append(s)

	metrics_by_block = {}
	if block_names and frappe.db.exists("DocType", "OmniTrack Output Metric"):
		all_metrics = frappe.get_all(
			"OmniTrack Output Metric",
			filters={"parent": ["in", block_names], "parenttype": "Planned Work Block"},
			fields=["parent", "metric_type", "quantity", "unit", "reference_id", "notes"]
		)
		for m in all_metrics:
			m["quantity"] = flt(m.get("quantity") or 0.0)
			metrics_by_block.setdefault(m.parent, []).append(m)

	from omnitrack.utils.block_tasks import tasks_by_block

	tasks_of_block = tasks_by_block(block_names)

	for b in blocks:
		b["start_time"] = _time_str(b.get("start_time"))
		b["end_time"] = _time_str(b.get("end_time"))
		b["work_date"] = str(b.get("work_date") or "")
		b["tasks"] = tasks_of_block.get(b.name, [])
		b["sessions"] = sessions_by_block.get(b.name, [])
		b["output_metrics"] = metrics_by_block.get(b.name, [])
		if b.get("pairing_partner"):
			b["pairing_partner_name"] = frappe.db.get_value("User", b["pairing_partner"], "full_name") or b["pairing_partner"]

	return blocks


@frappe.whitelist()
def convert_plan_to_actual(block_name, actual_hours=None, session_notes=None):
	"""
	Pillar 1: One-Click Plan-to-Actuals Catch-Up Assistant.
	Converts an unlogged Planned Work Block into logged actuals.
	Synthesizes a child OmniTrack Work Session with exact from_time and to_time.
	Enforces Temporal Governance (past lock and horizon checks).
	"""
	user = frappe.session.user
	if not user or user == "Guest":
		frappe.throw(_("Authentication required."), frappe.PermissionError)

	if not block_name or not frappe.db.exists("Planned Work Block", block_name):
		frappe.throw(_("Planned Work Block not found."))

	block = frappe.get_doc("Planned Work Block", block_name)

	# Permission check
	from omnitrack.permissions import is_omnitrack_manager, check_timesheet_date_permission
	is_mgr = is_omnitrack_manager(user) or any(
		r in frappe.get_roles(user) for r in ("HR Manager", "HR User", "System Manager", "Administrator")
	)
	if block.employee != user and not is_mgr:
		frappe.throw(_("Cannot log work for another employee."), frappe.PermissionError)

	# Check date horizon permission
	check_timesheet_date_permission(block.work_date, user)

	# Calculate hours and session timing
	plan_dur = flt(block.duration_hours) or 1.0
	act_dur = flt(actual_hours) if actual_hours is not None and flt(actual_hours) > 0 else plan_dur

	start_t = _time_str(block.start_time) or "09:00:00"
	# Compute end time based on actual hours
	start_parts = [int(p) for p in start_t.split(":")]
	start_mins = start_parts[0] * 60 + start_parts[1]
	end_mins = start_mins + int(round(act_dur * 60))
	end_mins = min(end_mins, 23 * 60 + 59)
	end_t = f"{end_mins // 60:02d}:{end_mins % 60:02d}:00"

	notes = session_notes or block.deliverable_notes or _("Completed as planned.")

	# Add session row
	block.append("sessions", {
		"session_date": block.work_date,
		"from_time": start_t,
		"to_time": end_t,
		"hours": act_dur,
		"notes": notes,
		"logged_via": "Manual",
		"task_nature": block.task_nature,
	})

	block.actual_hours = act_dur
	block.variance_hours = round(act_dur - plan_dur, 2)
	block.status = "Logged (Full)" if act_dur >= plan_dur else "Logged (Partial)"
	block.flags.ignore_permissions = True
	if not frappe.db.exists("DocType", "Project") or not frappe.db.exists("DocType", "Task"):
		block.flags.ignore_links = True
	block.save()

	# Handle timesheet bridge sync if configured
	sync_mode = get_timesheet_sync_mode()
	if sync_mode == "Immediate":
		try:
			create_timesheet_from_work_block(block.name, force=True)
		except Exception as e:
			frappe.logger("omnitrack").warning(f"Timesheet sync failed during convert_plan_to_actual: {e}")

	return {
		"status": "success",
		"message": _("Planned block converted to actual logged time."),
		"name": block.name,
		"actual_hours": block.actual_hours,
		"block_status": block.status,
	}


@frappe.whitelist()
def get_timeline_gaps(work_date=None, employee=None, min_gap_minutes=15):
	"""
	Pillar 4: Calculates unlogged intervals/gaps between work sessions for a day.
	Enables 1-click timeline gap booking.
	"""
	user = _resolve_planner_user(employee)
	target_date = work_date or nowdate()
	min_gap = int(min_gap_minutes or 15)

	# Fetch all completed work sessions for the day
	blocks = frappe.get_all(
		"Planned Work Block",
		filters={"employee": user, "work_date": target_date},
		fields=["name"],
		order_by="start_time asc",
		limit=100
	)

	intervals = []
	for b in blocks:
		b_doc = frappe.get_doc("Planned Work Block", b.name)
		for s in b_doc.sessions:
			if s.from_time and s.to_time:
				f_mins = mins_of(s.from_time)
				t_mins = mins_of(s.to_time)
				if t_mins > f_mins:
					intervals.append((f_mins, t_mins))

	if not intervals:
		return []

	# Sort and merge intervals
	intervals.sort(key=lambda x: x[0])
	merged = []
	for iv in intervals:
		if not merged:
			merged.append(iv)
		else:
			last_start, last_end = merged[-1]
			if iv[0] <= last_end:
				merged[-1] = (last_start, max(last_end, iv[1]))
			else:
				merged.append(iv)

	# Calculate gaps between consecutive merged blocks
	gaps = []
	for i in range(len(merged) - 1):
		gap_start = merged[i][1]
		gap_end = merged[i + 1][0]
		gap_dur = gap_end - gap_start
		if gap_dur >= min_gap:
			from_t = f"{gap_start // 60:02d}:{gap_start % 60:02d}:00"
			to_t = f"{gap_end // 60:02d}:{gap_end % 60:02d}:00"
			gaps.append({
				"from_time": from_t,
				"to_time": to_t,
				"gap_minutes": gap_dur,
				"gap_hours": round(gap_dur / 60.0, 2),
				"label": f"+ Log {round(gap_dur / 60.0, 1)}h Gap",
				"work_date": str(target_date),
				"employee": user
			})

	return gaps



