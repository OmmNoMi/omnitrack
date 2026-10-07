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
from omnitrack.api.projects import CLOSED_TASK
from omnitrack.utils.block_tasks import (
	CHILD,
	block_tasks as _block_tasks,
	free_item as _free_item,
	new_todo as _new_todo,
	resolve_ref as _resolve_ref,
	serialize as _serialize_task,
	set_row_done as _set_row_done,
	tasks_by_block as _tasks_by_block,
	todo_subject as _todo_subject,
)
from omnitrack.utils import (
	duration_hours as _duration_hours,
	pad_time as _time_str,
	mins_of,
	require_session_notes as _require_session_notes,
	resolve_planner_user as _resolve_planner_user,
)


@frappe.whitelist()
def get_active_tasks_and_projects():
	"""Returns active Projects and Tasks for autocomplete search in desk stopwatch."""
	projects = frappe.get_all("Project", filters={"status": ["in", ["Open", "In Progress"]]}, fields=["name", "project_name"], limit=50) if frappe.db.exists("DocType", "Project") else []
	tasks = frappe.get_all("Task", filters={"status": ["in", ["Open", "Working"]]}, fields=["name", "subject", "project"], limit=50) if frappe.db.exists("DocType", "Task") else []
	return {"projects": projects, "tasks": tasks}


# Workflow states that end a ToDo whatever a site calls them: one its workflow says closes the
# ToDo (sets status to Closed or Cancelled), or one named as finished.
FINISHED_STATE_NAMES = {"Cancelled", "Closed", "Completed", "Done"}


def _finished_todo_states():
	states = set(FINISHED_STATE_NAMES)
	for wf in frappe.get_all("Workflow", filters={"document_type": "ToDo", "is_active": 1}, pluck="name"):
		for st in frappe.get_all(
			"Workflow Document State",
			filters={"parent": wf, "parenttype": "Workflow", "update_field": "status", "update_value": ["in", ["Closed", "Cancelled"]]},
			pluck="state",
		):
			states.add(st)
	return states


@frappe.whitelist()
def get_assigned_tasks(employee=None):
	"""Assigned work for the target user, annotated with hours already booked / logged.

	Sources, in order of richness:
	  1. ERPNext ``Task`` (when installed) assigned via ToDo or the ``_assign`` list.
	  2. Standalone Frappe ``ToDo`` items allocated to the user (works with zero ERPNext).
	Each item carries a generic ``ref`` used as ``work_item`` on the Planned Work Block.
	"""
	target = _resolve_planner_user(employee)
	items = {}
	has_task = frappe.db.exists("DocType", "Task")

	if has_task:
		names = set()
		for td in frappe.get_all(
			"ToDo",
			filters={"allocated_to": target, "reference_type": "Task", "status": "Open"},
			fields=["reference_name"],
			limit=200,
		):
			if td.reference_name:
				names.add(td.reference_name)
		for t in frappe.get_all(
			"Task",
			filters={"_assign": ["like", f"%{target}%"], "status": ["not in", list(CLOSED_TASK)]},
			fields=["name"],
			limit=200,
		):
			names.add(t.name)
		if names:
			task_fields = ["name", "subject", "project", "status", "priority", "exp_end_date", "expected_time", "progress"]
			task_meta = frappe.get_meta("Task")
			if task_meta.has_field("custom_kpi_name"):
				task_fields.extend([
					"custom_kpi_name", "custom_kpi_target_quantity", "custom_kpi_unit",
					"custom_kpi_completed_quantity", "custom_kpi_progress_percent"
				])
			# A Task is often reached through an assignment that stays open after the Task is
			# finished (ticking it done in a session sets the Task, not its ToDo), so its own
			# status decides: a Completed Task is never listed, or flagged Overdue.
			for r in frappe.get_all(
				"Task",
				filters={"name": ["in", list(names)], "status": ["not in", list(CLOSED_TASK)]},
				fields=task_fields,
				limit=200,
			):
				items[r.name] = {
					"ref": r.name,
					"id": r.name,
					"kind": "Task",
					"doctype": "Task",
					"docname": r.name,
					"subject": r.subject,
					"project": r.project,
					"project_name": frappe.db.get_value("Project", r.project, "project_name") if r.project else None,
					"status": r.status,
					"priority": r.priority,
					"due_date": str(r.exp_end_date or ""),
					"estimate_hours": round(flt(r.expected_time), 2),
					"kpi_name": r.get("custom_kpi_name") or "",
					"kpi_target": flt(r.get("custom_kpi_target_quantity") or 0.0),
					"kpi_unit": r.get("custom_kpi_unit") or "",
					"kpi_completed": flt(r.get("custom_kpi_completed_quantity") or 0.0),
					"kpi_progress": flt(r.get("custom_kpi_progress_percent") or 0.0),
				}

	# Standalone ToDos (the Frappe-native "Assign To" primitive; no ERPNext needed)
	todo_fields = ["name", "description", "date", "priority", "reference_type", "reference_name", "status"]
	if frappe.db.has_column("ToDo", "workflow_state_todo"):
		todo_fields.append("workflow_state_todo")
	elif frappe.db.has_column("ToDo", "workflow_state"):
		todo_fields.append("workflow_state")

	finished = _finished_todo_states()
	for td in frappe.get_all(
		"ToDo",
		filters={"allocated_to": target, "status": ["not in", ["Cancelled", "Closed"]]},
		fields=todo_fields,
		limit=200,
	):
		# A ToDo on a Task is that Task's assignment: the Task is listed above while it is open,
		# and the assignment a finished Task leaves open is not a to-do of its own
		if has_task and td.reference_type == "Task":
			continue
		wf_st = td.get("workflow_state_todo") or td.get("workflow_state")
		if wf_st in finished:
			continue
		label = frappe.utils.strip_html(td.description or "").strip().split("\n")[0][:140] or "Untitled to-do"
		items[f"todo:{td.name}"] = {
			"ref": f"todo:{td.name}",
			"id": td.name,
			"kind": "ToDo",
			"doctype": "ToDo",
			"docname": td.name,
			"subject": label,
			"project": None,
			"project_name": None,
			"status": wf_st or td.status or "Open",
			"priority": td.priority,
			"due_date": str(td.date or ""),
			"estimate_hours": 0.0,
		}

	# Annotate with hours already booked / logged for this user. A block that covers
	# several tasks splits its hours evenly across them, so totals are not counted twice.
	if items and frappe.db.exists("DocType", "Planned Work Block"):
		blocks = frappe.get_all(
			"Planned Work Block",
			filters={"employee": target},
			fields=["name", "work_item", "task", "duration_hours", "actual_hours"],
			limit=2000,
		)
		refs_of = {n: [t["ref"] for t in rows] for n, rows in _tasks_by_block([b.name for b in blocks]).items()}
		for b in blocks:
			refs = refs_of.get(b.name) or [b.work_item or b.task]
			share = 1.0 / len(refs)
			for ref in refs:
				it = items.get(ref)
				if it:
					it["booked_hours"] = round(it.get("booked_hours", 0.0) + flt(b.duration_hours) * share, 2)
					it["logged_hours"] = round(it.get("logged_hours", 0.0) + flt(b.actual_hours) * share, 2)

	today_str = nowdate()
	today_date_obj = getdate(today_str)
	rows = []
	attention_rows = []

	for it in items.values():
		it.setdefault("booked_hours", 0.0)
		it.setdefault("logged_hours", 0.0)
		estimate = flt(it.get("estimate_hours", 0.0))
		booked = flt(it.get("booked_hours", 0.0))
		logged = flt(it.get("logged_hours", 0.0))
		due = str(it.get("due_date") or "").strip()
		priority = (it.get("priority") or "").lower()

		deficit = max(0.0, round(estimate - booked, 2)) if estimate > 0 else 0.0
		it["deficit_hours"] = deficit

		is_overdue = False
		is_due_today = False
		days_overdue = 0
		if due and due != "None" and len(due) >= 10:
			try:
				due_date_obj = getdate(due[:10])
				if due_date_obj < today_date_obj:
					is_overdue = True
					days_overdue = (today_date_obj - due_date_obj).days
				elif due_date_obj == today_date_obj:
					is_due_today = True
			except Exception:
				pass

		it["is_overdue"] = is_overdue
		it["is_due_today"] = is_due_today
		it["days_overdue"] = days_overdue
		it["is_unplanned"] = bool(booked <= 0.0)
		it["is_underplanned"] = bool(estimate > 0 and booked < estimate)

		# Classify urgency and reason for attention banner
		if is_overdue:
			if it["is_unplanned"]:
				it["attention_level"] = "critical"
				it["attention_badge"] = "Overdue & Unplanned"
				it["attention_reason"] = f"Overdue by {days_overdue} day{'s' if days_overdue != 1 else ''} and not scheduled in calendar"
			elif it["is_underplanned"]:
				it["attention_level"] = "critical"
				it["attention_badge"] = f"Overdue & {deficit}h Short"
				it["attention_reason"] = f"Overdue by {days_overdue} day{'s' if days_overdue != 1 else ''} with only {booked}h of {estimate}h planned"
			elif booked > 0 and logged < booked:
				it["attention_level"] = "warning"
				it["attention_badge"] = "Overdue Pending"
				it["attention_reason"] = f"Overdue by {days_overdue} day{'s' if days_overdue != 1 else ''}; planned but execution pending"
			else:
				it["attention_level"] = "warning"
				it["attention_badge"] = "Overdue"
				it["attention_reason"] = f"Overdue by {days_overdue} day{'s' if days_overdue != 1 else ''}"
		elif is_due_today:
			if it["is_unplanned"]:
				it["attention_level"] = "critical"
				it["attention_badge"] = "Due Today (Unplanned)"
				it["attention_reason"] = "Due today but zero hours booked in calendar"
			elif it["is_underplanned"]:
				it["attention_level"] = "warning"
				it["attention_badge"] = f"Due Today ({deficit}h Short)"
				it["attention_reason"] = f"Due today with {deficit}h remaining unbooked"
		elif it["is_underplanned"] and (priority in ["urgent", "high"] or deficit >= 3.0):
			it["attention_level"] = "warning"
			it["attention_badge"] = f"{deficit}h Underplanned"
			it["attention_reason"] = f"High priority with {deficit}h deficit between estimate ({estimate}h) and planned ({booked}h)"
		elif it["is_unplanned"] and priority in ["urgent", "high"]:
			it["attention_level"] = "warning"
			it["attention_badge"] = f"{it.get('priority')} Unplanned"
			it["attention_reason"] = f"{it.get('priority')} priority task with zero hours scheduled in calendar"
		else:
			it["attention_level"] = None
			it["attention_badge"] = None
			it["attention_reason"] = None

		rows.append(it)
		if it.get("attention_level"):
			attention_rows.append(it)

	attention_order = {"critical": 0, "warning": 1}
	attention_rows.sort(key=lambda x: (
		attention_order.get(x.get("attention_level"), 2),
		-x.get("days_overdue", 0),
		x.get("due_date") or "9999-12-31"
	))
	rows.sort(key=lambda x: (x.get("due_date") or "9999-12-31", x.get("subject") or ""))

	# Enrich attention rows with available workflow actions
	for it in attention_rows:
		it["workflow_actions"] = get_task_workflow_actions(
			it.get("doctype"), it.get("docname"), it.get("status")
		)

	return {"user": target, "tasks": rows, "attention_tasks": attention_rows}


@frappe.whitelist()
def get_task_workflow_actions(doctype, docname, current_status=None):
	"""Returns available workflow action dictionaries for a Task or ToDo."""
	if not doctype or not docname:
		return []

	try:
		from frappe.model.workflow import get_workflow_name, get_transitions
		wf_name = get_workflow_name(doctype)
		if wf_name:
			doc = frappe.get_doc(doctype, docname)
			transitions = get_transitions(doc)
			actions = []
			for t in transitions:
				act = t.action
				act_l = act.lower()
				style = "danger" if any(w in act_l for w in ("cancel", "reject", "drop")) \
					else "success" if any(w in act_l for w in ("close", "complete", "approve", "done")) \
					else "warning" if any(w in act_l for w in ("hold", "pause", "rework", "changes")) \
					else "primary"
				actions.append({
					"action": act,
					"next_state": t.next_state,
					"style": style
				})
			if actions:
				return actions
	except Exception:
		pass

	# Standard actions fallback if no workflow or transitions empty
	status = (current_status or "Open").lower()
	fallback = []
	if status not in ("completed", "closed"):
		fallback.append({
			"action": "Complete" if doctype == "Task" else "Close Task",
			"next_state": "Completed" if doctype == "Task" else "Closed",
			"style": "success"
		})
	if status != "cancelled":
		fallback.append({
			"action": "Cancel Task",
			"next_state": "Cancelled",
			"style": "danger"
		})
	if status not in ("on hold", "hold"):
		fallback.append({
			"action": "Put on Hold",
			"next_state": "On Hold",
			"style": "warning"
		})
	return fallback


@frappe.whitelist()
def execute_task_workflow_action(doctype, docname, action, comment=None):
	"""
	Executes a workflow action or status transition on a Task or ToDo document.
	Handles both workflow transitions and direct status changes.
	"""
	if not doctype or not docname or not action:
		frappe.throw(_("DocType, Document Name, and Action are required."))

	if doctype not in ("Task", "ToDo"):
		frappe.throw(_("Workflow actions are only supported on Task and ToDo documents."))
	if not frappe.db.exists("DocType", doctype):
		frappe.throw(_("This site has no {0}.").format(_(doctype)))

	doc = frappe.get_doc(doctype, docname)
	doc.check_permission("write")

	from frappe.model.workflow import get_workflow_name, apply_workflow

	wf_name = get_workflow_name(doctype)
	if wf_name:
		apply_workflow(doc, action)
		if comment:
			try:
				doc.add_comment("Workflow", f"Action: {action}\n{comment}")
			except Exception:
				pass
		frappe.db.commit()
		state_field = frappe.get_doc("Workflow", wf_name).workflow_state_field
		new_state = doc.get(state_field) or doc.get("status")
		return {
			"status": "success",
			"message": _("Workflow action '{0}' applied to {1} {2} (New State: {3})").format(
				action, doctype, docname, new_state
			),
			"doctype": doctype,
			"docname": docname,
			"new_state": new_state
		}
	else:
		act_lower = str(action).lower()
		if "complete" in act_lower or "close" in act_lower:
			doc.status = "Completed" if doctype == "Task" else "Closed"
		elif "cancel" in act_lower:
			doc.status = "Cancelled"
		elif "hold" in act_lower:
			doc.status = "On Hold" if doctype == "Task" else "Open"
		elif "progress" in act_lower or "start" in act_lower or "work" in act_lower:
			doc.status = "Working" if doctype == "Task" else "Open"
		else:
			doc.status = action

		doc.save()
		if comment:
			try:
				doc.add_comment("Comment", f"Status updated to {doc.status}: {comment}")
			except Exception:
				pass
		frappe.db.commit()
		return {
			"status": "success",
			"message": _("Status updated to '{0}' for {1} {2}").format(
				doc.status, doctype, docname
			),
			"doctype": doctype,
			"docname": docname,
			"new_state": doc.status
		}


@frappe.whitelist()
def get_task_details(task_id: str, doctype: str = "Task"):
	"""A Task or ToDo for its details panel: what the task form shows, plus who it is for, its
	description as the person wrote it, and the hours ERPNext has logged on it. Only for someone
	who may read the task; this once answered any name it was given, to anyone."""
	from frappe.utils.html_utils import sanitize_html

	doc = _task_doc(doctype, task_id)
	is_task = doc.doctype == "Task"
	out = _task_form(doc)
	if not is_task:
		# A to-do's description is its name too; the title is its first line
		out["subject"] = _todo_subject(doc.description)

	text = frappe.utils.strip_html(doc.get("description") or "").strip()
	# A one-line to-do is all title: showing it again below would say it twice
	out["description_html"] = sanitize_html(doc.get("description") or "") if text and text != out["subject"] else ""

	users = [doc.allocated_to] if doc.get("allocated_to") else (json.loads(doc.get("_assign") or "[]") if is_task else [])
	out["assigned_to"] = [{"user": u, "name": frappe.utils.get_fullname(u)} for u in users if u]
	out["project_name"] = (frappe.db.get_value("Project", out["project"], "project_name") if out["project"] else "") or out["project"]

	out["expected_hours"] = flt(doc.get("expected_time"), 2) if is_task else 0
	out["logged_hours"] = flt(frappe.db.sql(
		"select coalesce(sum(hours), 0) from `tabTimesheet Detail` where task = %s and docstatus < 2",
		(doc.name,),
	)[0][0], 2) if is_task else 0
	return out


def _can_change_block(block, user=None):
	"""The block's person, its creator, its pairing partner, or a manager."""
	from omnitrack.permissions import is_omnitrack_manager

	user = user or frappe.session.user
	return user in (block.employee, block.owner, block.get("pairing_partner")) or is_omnitrack_manager(user)


def _get_block(block_name, write=True):
	"""The block, if the session user may read it (write=False) or change its tasks."""
	from omnitrack.permissions import has_work_block_permission

	if not frappe.db.exists("Planned Work Block", block_name):
		frappe.throw(_("Planned Work Block {0} not found").format(block_name))
	block = frappe.get_doc("Planned Work Block", block_name)
	if not (_can_change_block(block) if write else has_work_block_permission(block, "read")):
		frappe.throw(_("Not permitted to change the tasks of work block {0}").format(block_name), frappe.PermissionError)
	return block


def _check_plan_open(block):
	"""A block past its lock grace is history: which tasks it was for can't change.
	Its tasks can still be ticked and edited, since that changes the task, not the plan."""
	from frappe.utils import get_datetime, now_datetime, time_diff_in_hours
	from omnitrack.permissions import get_past_block_lock_grace_hours

	grace = get_past_block_lock_grace_hours()
	if time_diff_in_hours(now_datetime(), get_datetime(f"{block.work_date} {block.end_time or '23:59:59'}")) > grace:
		frappe.throw(_("Work block {0} is in the past, so its tasks can't be added or taken off.").format(block.name))


def _save_block(block):
	block.flags.ignore_permissions = True
	block.save()


@frappe.whitelist()
def get_block_tasks(block_name):
	"""Returns the tasks and checklist items a work block is for."""
	return {"block_name": block_name, "tasks": _block_tasks(_get_block(block_name, write=False))}


def _split_lines(value):
	values = value if isinstance(value, list) else [value]
	lines = []
	for v in values:
		if isinstance(v, str):
			lines.extend(line.strip("- •* \t") for line in v.split("\n") if line.strip("- •* \t"))
	return lines


@frappe.whitelist()
def attach_tasks_to_block(block_name, task_refs=None, new_task_subjects=None):
	"""Adds existing Tasks/ToDos, or new to-dos from pasted lines, to a work block."""
	block = _get_block(block_name)
	_check_plan_open(block)
	existing = {r.work_item for r in block.tasks}

	if task_refs:
		if isinstance(task_refs, str):
			try:
				task_refs = json.loads(task_refs)
			except Exception:
				task_refs = [r.strip() for r in task_refs.split(",") if r.strip()]
		for ref in task_refs or []:
			row = _resolve_ref(ref)
			if row and row["work_item"] not in existing:
				block.append("tasks", row)
				existing.add(row["work_item"])

	# Pasted lines (from a meeting, chat or WhatsApp) become native ToDos
	target_user = block.employee or frappe.session.user
	for line in _split_lines(new_task_subjects) if new_task_subjects else []:
		block.append("tasks", _new_todo(line, target_user, block.project, block.task))

	_save_block(block)
	return {"status": "success", "block_name": block.name, "tasks": _block_tasks(block)}


@frappe.whitelist()
def create_session_todos(new_task_subjects, project=None):
	"""New to-dos for a running session that has no block yet. They are real ToDos at once,
	so they open in the task form; Stop puts them on the session's block."""
	user = frappe.session.user
	rows = [_new_todo(line, user, project) for line in _split_lines(new_task_subjects)]
	return {"status": "success", "tasks": [_serialize_task(r) for r in rows]}


@frappe.whitelist()
def complete_block_task(block_name, task_ref, completed=True):
	"""Ticks a block's task on or off, updates the underlying Task/ToDo, and notes it on the live session."""
	is_done = frappe.utils.cint(completed) == 1 if isinstance(completed, (int, str)) else bool(completed)
	block = _get_block(block_name)
	row = _block_row(block, task_ref)

	_set_row_done(row, is_done)
	_save_block(block)

	# A ticked task is a line in the live session's log. Only the log: trackerNotes is the
	# session's title, and appending to it buried the title under "Completed:" lines.
	if is_done:
		from omnitrack.api.stopwatch import get_active_session, sync_active_session
		target_user = block.employee or frappe.session.user
		active_sess = get_active_session(user=target_user)
		if active_sess:
			# Same wording as the client (useWorkstationFocusTasks), so the two never both add a line
			accomplishment = f"Completed: {row.subject or 'Task'}"
			sess_list = active_sess.get("sessionNotesList") or []
			if accomplishment not in sess_list:
				sess_list.append(accomplishment)
				active_sess["sessionNotesList"] = sess_list
				sync_active_session(active_sess, user=target_user)

	tasks = _block_tasks(block)
	return {"status": "success", "task": next(t for t in tasks if t["ref"] == row.work_item), "tasks": tasks}


def _block_row(block, task_ref):
	row = next((r for r in block.tasks if task_ref in (r.work_item, r.reference_name)), None)
	if not row:
		frappe.throw(_("Item {0} not found in the tasks of block {1}").format(task_ref, block.name))
	return row


def _linked_doc(row):
	"""The Task or ToDo a block row stands for, while it still exists."""
	dt, name = row.reference_doctype, row.reference_name
	if dt in ("Task", "ToDo") and name and frappe.db.exists("DocType", dt) and frappe.db.exists(dt, name):
		return frappe.get_doc(dt, name)
	return None


def _priorities(doctype):
	field = frappe.get_meta(doctype).get_field("priority")
	return [p for p in ((field and field.options) or "").split("\n") if p]


# The one task form (TaskFormDialog) reads and saves through these, from a block's
# task row, the calendar's assigned work, or the dashboard.

def _task_doc(doctype, name, ptype="read"):
	if doctype not in ("Task", "ToDo") or not frappe.db.exists("DocType", doctype) or not frappe.db.exists(doctype, name):
		frappe.throw(_("{0} {1} not found").format(_(doctype), name))
	doc = frappe.get_doc(doctype, name)
	doc.check_permission(ptype)
	return doc


def _task_subject(doc):
	# A to-do's text can run to several lines; the rows show only the first
	return doc.subject if doc.doctype == "Task" else frappe.utils.strip_html(doc.description or "").strip()


def _workflow_of(doc):
	"""Where the task stands, and the moves the session user can make from there."""
	from frappe.model.workflow import get_transitions, get_workflow_name
	wf = get_workflow_name(doc.doctype)
	if wf:
		field = frappe.get_cached_value("Workflow", wf, "workflow_state_field") or "workflow_state"
		try:
			moves = [{"action": t.action, "next_state": t.next_state} for t in get_transitions(doc)]
		except Exception:
			moves = []
		return {"workflow": wf, "state": doc.get(field) or "", "actions": moves}
	moves = [{"action": m["action"], "next_state": m["next_state"]} for m in get_task_workflow_actions(doc.doctype, doc.name, doc.get("status"))]
	return {"workflow": None, "state": doc.get("status") or "Open", "actions": moves}


def _task_form(doc):
	is_task = doc.doctype == "Task"
	return {
		"doctype": doc.doctype,
		"name": doc.name,
		"subject": _task_subject(doc),
		"status": doc.get("status") or "",
		"due_date": str(doc.get("exp_end_date" if is_task else "date") or ""),
		"priority": doc.get("priority") or "",
		"priorities": _priorities(doc.doctype),
		"project": doc.get("project") or (doc.get("reference_name") if doc.get("reference_type") == "Project" else "") or "",
		"can_edit": bool(doc.has_permission("write")),
		**_workflow_of(doc),
	}


def _edit_task_doc(doc, subject=None, due_date=None, priority=None):
	"""Saves the edits on the Task or ToDo, then every work block's copy of its name."""
	if not doc.has_permission("write"):
		frappe.throw(_("You can't edit {0} {1}. Ask its owner.").format(_(doc.doctype), doc.name), frappe.PermissionError)
	is_task = doc.doctype == "Task"
	old_label = doc.subject if is_task else _todo_subject(doc.description)
	if subject is not None:
		doc.set("subject" if is_task else "description", subject[:140] if is_task else subject)
	if due_date is not None:
		doc.set("exp_end_date" if is_task else "date", due_date or None)
	if priority:
		if priority not in _priorities(doc.doctype):
			frappe.throw(_("Priority {0} is not one of {1}").format(priority, ", ".join(_priorities(doc.doctype))))
		doc.priority = priority
	doc.save()
	label = doc.subject if is_task else _todo_subject(doc.description)
	if label != old_label:
		_rename_in_blocks(doc.doctype, doc.name, old_label, label)
	return label


def _rename_in_blocks(doctype, name, old_label, label):
	"""One task, one name: the block rows that hold it, and the titles that follow it."""
	for r in frappe.get_all(CHILD, filters={"parenttype": "Planned Work Block", "reference_doctype": doctype,
			"reference_name": name}, fields=["name", "parent", "work_item"], limit_page_length=0):
		frappe.db.set_value(CHILD, r.name, "subject", label, update_modified=False)
		lead, title = frappe.db.get_value("Planned Work Block", r.parent, ["work_item", "work_item_label"])
		if lead == r.work_item and (not title or title == old_label):
			frappe.db.set_value("Planned Work Block", r.parent, "work_item_label", label, update_modified=False)


def _clean_subject(subject):
	if subject is None:
		return None
	subject = str(subject).strip()
	if not subject:
		frappe.throw(_("A task needs a name"))
	return subject


@frappe.whitelist()
def get_task(doctype, name):
	"""A Task or ToDo as the task form shows it: name, due day, priority, and its workflow."""
	return _task_form(_task_doc(doctype, name))


@frappe.whitelist()
def update_task(doctype, name, subject=None, due_date=None, priority=None):
	"""Saves the task form for a Task or ToDo, wherever it was opened from."""
	doc = _task_doc(doctype, name, "write")
	_edit_task_doc(doc, _clean_subject(subject), due_date, priority)
	return {"status": "success", "task": _task_form(doc)}


@frappe.whitelist()
def get_block_task(block_name, task_ref):
	"""One task of a block, for the task form. A plain checklist item has only its name."""
	row = _block_row(_get_block(block_name, write=False), task_ref)
	doc = _linked_doc(row)
	out = {"doctype": "Item", "name": None, "subject": row.subject, "status": row.status, "due_date": "",
		"priority": "", "priorities": [], "project": row.project or "", "can_edit": True,
		"workflow": None, "state": row.status or "Open", "actions": []}
	if doc:
		out.update(_task_form(doc))
	out["ref"] = row.work_item
	return out


def _block_head(block):
	"""What the drawer shows of the block after its tasks change: which leads, and its title."""
	return {"work_item": block.work_item, "task": block.task, "work_item_label": block.work_item_label}


def _title_follows(block, subject):
	"""A block titled after its main task follows that task's name; a title someone gave the block stays."""
	return not block.work_item_label or block.work_item_label == subject


@frappe.whitelist()
def update_block_task(block_name, task_ref, subject=None, due_date=None, priority=None):
	"""Saves the task form for one of a block's tasks: on the Task or ToDo itself, then the block's copy."""
	block = _get_block(block_name)
	row = _block_row(block, task_ref)
	old_subject = row.subject
	subject = _clean_subject(subject)
	doc = _linked_doc(row)
	if doc:
		row.subject = _edit_task_doc(doc, subject, due_date, priority)
	elif subject is not None:
		row.subject = subject[:140]
	if block.work_item == row.work_item and _title_follows(block, old_subject):
		block.work_item_label = row.subject
	_save_block(block)
	tasks = _block_tasks(block)
	return {"status": "success", "task": next(t for t in tasks if t["ref"] == row.work_item), "tasks": tasks, "block": _block_head(block)}


@frappe.whitelist()
def remove_block_task(block_name, task_ref):
	"""Takes a task off a block. The Task or ToDo itself stays."""
	block = _get_block(block_name)
	_check_plan_open(block)
	row = _block_row(block, task_ref)
	block.remove(row)
	if row.work_item in (block.work_item, block.task):
		# sync_primary_task would add the main task back; the next one leads instead
		lead = block.tasks[0] if block.tasks else None
		block.work_item = lead.work_item if lead else None
		block.task = lead.reference_name if lead and lead.reference_doctype == "Task" else None
		if lead and _title_follows(block, row.subject):
			block.work_item_label = lead.subject
	_save_block(block)
	return {"status": "success", "tasks": _block_tasks(block), "block": _block_head(block)}


@frappe.whitelist()
def reschedule_unfinished_tasks(block_name, target_date=None, start_time=None, end_time=None):
	"""Carries forward any open tasks from a block into a newly created planned work block."""
	block = _get_block(block_name)
	unfinished = [r for r in block.tasks if r.status == "Open"]
	if not unfinished:
		return {"status": "noop", "message": "No unfinished items to carry forward."}

	if not target_date:
		target_date = frappe.utils.add_days(block.work_date or nowdate(), 1)

	new_block = frappe.new_doc("Planned Work Block")
	new_block.employee = block.employee
	new_block.associate_name = block.associate_name
	new_block.project = block.project
	new_block.work_item = unfinished[0].work_item
	new_block.work_item_label = f"Continuation: {block.get('work_item_label') or block.get('deliverable_notes') or block.name}"
	new_block.task_nature = block.task_nature
	new_block.work_date = target_date
	new_block.start_time = start_time or block.start_time or "09:00:00"
	new_block.end_time = end_time or block.end_time or "11:00:00"
	new_block.duration_hours = block.duration_hours or 2.0
	new_block.status = "Planned"
	new_block.deliverable_notes = f"Carried forward from {block.name}:\n" + "\n".join(f"• {r.subject}" for r in unfinished)
	for r in unfinished:
		new_block.append("tasks", {
			"work_item": r.work_item, "subject": r.subject, "reference_doctype": r.reference_doctype,
			"reference_name": r.reference_name, "project": r.project or block.project, "status": "Open",
		})
	new_block.flags.ignore_permissions = True
	new_block.insert()

	for r in unfinished:
		r.status = "Rescheduled"
		r.rescheduled_to = new_block.name
	_save_block(block)

	return {
		"status": "success",
		"original_block": block.name,
		"new_block": new_block.name,
		"target_date": str(target_date),
		"rescheduled_count": len(unfinished),
		"new_tasks": _block_tasks(new_block),
	}


@frappe.whitelist()
def update_task_kpi_progress(task_name):
	"""
	Rolls up completed KPI output metrics across all Planned Work Blocks linked to this Task
	and updates Task.custom_kpi_completed_quantity and Task.custom_kpi_progress_percent.
	"""
	if not task_name or not frappe.db.exists("DocType", "Task") or not frappe.db.exists("Task", task_name):
		return None

	meta = frappe.get_meta("Task")
	if not meta.has_field("custom_kpi_completed_quantity"):
		return None

	blocks = frappe.get_all(
		"Planned Work Block",
		filters={"task": task_name, "status": ["!=", "Cancelled"]},
		pluck="name"
	)
	if not blocks or not frappe.db.exists("DocType", "OmniTrack Output Metric"):
		total_completed = 0.0
	else:
		res = frappe.db.sql("""
			SELECT SUM(quantity) as total_qty
			FROM `tabOmniTrack Output Metric`
			WHERE parent IN %(blocks)s AND parenttype = 'Planned Work Block'
		""", {"blocks": tuple(blocks)}, as_dict=True)
		total_completed = flt(res[0].total_qty) if res and res[0].total_qty else 0.0

	target_qty = flt(frappe.db.get_value("Task", task_name, "custom_kpi_target_quantity") or 0.0)
	progress_pct = round((total_completed / target_qty * 100.0), 2) if target_qty > 0 else 0.0

	frappe.db.set_value("Task", task_name, {
		"custom_kpi_completed_quantity": total_completed,
		"custom_kpi_progress_percent": progress_pct
	}, update_modified=False)

	return {
		"task": task_name,
		"target_quantity": target_qty,
		"completed_quantity": total_completed,
		"progress_percent": progress_pct
	}


