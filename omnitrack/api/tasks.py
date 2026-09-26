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
def get_active_tasks_and_projects():
	"""Returns active Projects and Tasks for autocomplete search in desk stopwatch."""
	projects = frappe.get_all("Project", filters={"status": ["in", ["Open", "In Progress"]]}, fields=["name", "project_name"], limit=50) if frappe.db.exists("DocType", "Project") else []
	tasks = frappe.get_all("Task", filters={"status": ["in", ["Open", "Working"]]}, fields=["name", "subject", "project"], limit=50) if frappe.db.exists("DocType", "Task") else []
	return {"projects": projects, "tasks": tasks}


def _parse_block_tasks(val):
	"""Safely parses connected_tasks field from JSON, list, or newline-separated string."""
	if not val:
		return []
	if isinstance(val, list):
		return val
	if isinstance(val, str):
		val = val.strip()
		if not val:
			return []
		try:
			parsed = json.loads(val)
			if isinstance(parsed, list):
				return parsed
		except Exception:
			lines = [line.strip("- •* \t") for line in val.split("\n") if line.strip("- •* \t")]
			return [{"id": f"item:{idx}", "ref": f"item:{idx}", "doctype": "Item", "subject": line, "status": "Open"} for idx, line in enumerate(lines)]
	return []


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
			filters={"allocated_to": target, "reference_type": "Task", "status": ["!=", "Cancelled"]},
			fields=["reference_name"],
			limit=200,
		):
			if td.reference_name:
				names.add(td.reference_name)
		for t in frappe.get_all(
			"Task",
			filters={"_assign": ["like", f"%{target}%"], "status": ["not in", ["Cancelled", "Completed"]]},
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
			for r in frappe.get_all(
				"Task",
				filters={"name": ["in", list(names)]},
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

	for td in frappe.get_all(
		"ToDo",
		filters={"allocated_to": target, "status": ["not in", ["Cancelled", "Closed"]]},
		fields=todo_fields,
		limit=200,
	):
		if has_task and td.reference_type == "Task" and td.reference_name in items:
			continue
		wf_st = td.get("workflow_state_todo") or td.get("workflow_state")
		if wf_st in ("Cancelled", "Closed"):
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

	# Annotate with hours already booked / logged for this user
	if items and frappe.db.exists("DocType", "Planned Work Block"):
		for b in frappe.get_all(
			"Planned Work Block",
			filters={"employee": target},
			fields=["work_item", "task", "duration_hours", "actual_hours"],
			limit=2000,
		):
			ref = b.work_item or b.task
			it = items.get(ref)
			if it:
				it["booked_hours"] = round(it.get("booked_hours", 0.0) + flt(b.duration_hours), 2)
				it["logged_hours"] = round(it.get("logged_hours", 0.0) + flt(b.actual_hours), 2)

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
	"""Return rich details for a Task or ToDo, including full description, connected planned blocks, and timesheet logs."""
	if not task_id:
		return {}

	doc = None
	if doctype in ("Task", "ToDo") and frappe.db.exists(doctype, task_id):
		doc = frappe.get_doc(doctype, task_id)
	elif frappe.db.exists("Task", task_id):
		doctype = "Task"
		doc = frappe.get_doc("Task", task_id)
	elif frappe.db.exists("ToDo", task_id):
		doctype = "ToDo"
		doc = frappe.get_doc("ToDo", task_id)

	if not doc:
		return {}

	# Fetch connected planned work blocks
	blocks = frappe.get_all(
		"Planned Work Block",
		filters={"task": task_id, "docstatus": ["<", 2]},
		fields=["name", "work_date", "start_time", "end_time", "duration_hours", "status", "actual_hours", "task_nature", "deliverable_notes"],
		order_by="work_date desc, start_time desc",
		limit=20,
	)

	# Fetch actual logged hours across timesheets
	logged_hours = 0.0
	try:
		ts_records = frappe.db.sql(
			"""
			select coalesce(sum(hours), 0) as total_hours
			from `tabTimesheet Detail`
			where task = %s and docstatus < 2
			""",
			(task_id,),
			as_dict=True,
		)
		if ts_records:
			logged_hours = flt(ts_records[0].total_hours, 2)
	except Exception:
		pass

	return {
		"task": {
			"name": doc.name,
			"doctype": doctype,
			"subject": getattr(doc, "subject", getattr(doc, "description", doc.name)),
			"description": getattr(doc, "description", "") or "",
			"project": getattr(doc, "project", "") or "",
			"project_name": getattr(doc, "project_name", getattr(doc, "project", "")) or "",
			"status": getattr(doc, "status", "Open"),
			"priority": getattr(doc, "priority", "Medium"),
			"expected_time": flt(getattr(doc, "expected_time", 0), 2),
			"exp_start_date": str(getattr(doc, "exp_start_date", "") or ""),
			"exp_end_date": str(getattr(doc, "exp_end_date", "") or ""),
			"due_date": str(getattr(doc, "exp_end_date", getattr(doc, "date", "")) or ""),
			"logged_hours": logged_hours,
			"connected_blocks": blocks,
		}
	}


@frappe.whitelist()
def get_block_tasks(block_name):
	"""Returns the list of connected tasks and action items for a work block."""
	if not frappe.db.exists("Planned Work Block", block_name):
		frappe.throw(_("Planned Work Block {0} not found").format(block_name))
	raw_tasks = frappe.db.get_value("Planned Work Block", block_name, "connected_tasks")
	return {"block_name": block_name, "tasks": _parse_block_tasks(raw_tasks)}


@frappe.whitelist()
def attach_tasks_to_block(block_name, task_refs=None, new_task_subjects=None):
	"""Attaches existing Tasks/ToDos or creates new action items from text/paste for a work block."""
	if not frappe.db.exists("Planned Work Block", block_name):
		frappe.throw(_("Planned Work Block {0} not found").format(block_name))

	block = frappe.get_doc("Planned Work Block", block_name)
	items = _parse_block_tasks(block.connected_tasks)
	existing_refs = {it.get("ref") or it.get("id") for it in items if isinstance(it, dict)}

	# Process existing task_refs (e.g. from picker)
	if task_refs:
		if isinstance(task_refs, str):
			try:
				task_refs = json.loads(task_refs)
			except Exception:
				task_refs = [r.strip() for r in task_refs.split(",") if r.strip()]
		if isinstance(task_refs, list):
			for ref in task_refs:
				ref = str(ref).strip()
				if not ref or ref in existing_refs:
					continue
				if ref.startswith("todo:"):
					td_id = ref.split(":", 1)[1]
					if frappe.db.exists("ToDo", td_id):
						td = frappe.get_doc("ToDo", td_id)
						subj = frappe.utils.strip_html(td.description or "").strip().split("\n")[0][:140] or "Untitled to-do"
						items.append({
							"id": td.name,
							"ref": f"todo:{td.name}",
							"doctype": "ToDo",
							"subject": subj,
							"status": "Closed" if td.status in ("Closed", "Cancelled") else "Open",
							"completed_at": None
						})
						existing_refs.add(ref)
				elif ref.startswith("task:") or frappe.db.exists("Task", ref):
					t_id = ref.split(":", 1)[1] if ref.startswith("task:") else ref
					if frappe.db.exists("Task", t_id):
						t = frappe.get_doc("Task", t_id)
						items.append({
							"id": t.name,
							"ref": t.name,
							"doctype": "Task",
							"subject": t.subject or t.name,
							"project": t.project,
							"status": "Completed" if t.status in ("Completed", "Cancelled") else "Open",
							"completed_at": None
						})
						existing_refs.add(ref)

	# Process new_task_subjects (e.g. multi-line paste from meeting/chat/whatsapp)
	if new_task_subjects:
		lines = []
		if isinstance(new_task_subjects, str):
			lines = [line.strip("- •* \t") for line in new_task_subjects.split("\n") if line.strip("- •* \t")]
		elif isinstance(new_task_subjects, list):
			for s in new_task_subjects:
				if isinstance(s, str):
					lines.extend([line.strip("- •* \t") for line in s.split("\n") if line.strip("- •* \t")])
		
		target_user = block.employee or frappe.session.user
		for line in lines:
			if not line:
				continue
			# Try creating a native ToDo so it lives in the Frappe ecosystem
			created_todo = None
			try:
				if frappe.db.exists("DocType", "ToDo"):
					td = frappe.new_doc("ToDo")
					td.description = line
					td.allocated_to = target_user
					if block.project and frappe.db.exists("DocType", "Project") and frappe.db.exists("Project", block.project):
						td.reference_type = "Project"
						td.reference_name = block.project
					elif block.task and frappe.db.exists("DocType", "Task") and frappe.db.exists("Task", block.task):
						td.reference_type = "Task"
						td.reference_name = block.task
					td.status = "Open"
					td.flags.ignore_permissions = True
					td.insert()
					created_todo = td
			except Exception:
				created_todo = None

			if created_todo:
				ref = f"todo:{created_todo.name}"
				items.append({
					"id": created_todo.name,
					"ref": ref,
					"doctype": "ToDo",
					"subject": line,
					"status": "Open",
					"completed_at": None
				})
				existing_refs.add(ref)
			else:
				new_id = f"item:{frappe.generate_hash(length=8)}"
				items.append({
					"id": new_id,
					"ref": new_id,
					"doctype": "Item",
					"subject": line,
					"status": "Open",
					"completed_at": None
				})
				existing_refs.add(new_id)

	block.connected_tasks = json.dumps(items)
	block.flags.ignore_permissions = True
	block.save()

	return {"status": "success", "block_name": block.name, "tasks": items}


@frappe.whitelist()
def complete_block_task(block_name, task_ref, completed=True):
	"""Toggles completion status of a connected task, updates the underlying Task/ToDo, and syncs active session notes."""
	if not frappe.db.exists("Planned Work Block", block_name):
		frappe.throw(_("Planned Work Block {0} not found").format(block_name))

	is_done = frappe.utils.cint(completed) == 1 if isinstance(completed, (int, str)) else bool(completed)
	block = frappe.get_doc("Planned Work Block", block_name)
	items = _parse_block_tasks(block.connected_tasks)
	matched_item = None

	for it in items:
		if it.get("ref") == task_ref or it.get("id") == task_ref:
			matched_item = it
			break

	if not matched_item:
		frappe.throw(_("Item {0} not found in connected tasks of block {1}").format(task_ref, block_name))

	dtype = matched_item.get("doctype")
	item_id = matched_item.get("id") or matched_item.get("ref")

	if dtype == "Task":
		target_status = "Completed" if is_done else "Open"
		matched_item["status"] = target_status
		clean_id = item_id.split(":", 1)[1] if str(item_id).startswith("task:") else str(item_id)
		if frappe.db.exists("Task", clean_id):
			frappe.db.set_value("Task", clean_id, "status", target_status)
	elif dtype == "ToDo":
		target_status = "Closed" if is_done else "Open"
		matched_item["status"] = target_status
		clean_id = item_id.split(":", 1)[1] if str(item_id).startswith("todo:") else str(item_id)
		if frappe.db.exists("ToDo", clean_id):
			frappe.db.set_value("ToDo", clean_id, "status", target_status)
	else:
		matched_item["status"] = "Completed" if is_done else "Open"

	matched_item["completed_at"] = frappe.utils.now_datetime().strftime("%Y-%m-%d %H:%M:%S") if is_done else None

	block.connected_tasks = json.dumps(items)
	block.flags.ignore_permissions = True
	block.save()

	# If completed, append accomplishment to active session HUD and trackerNotes
	if is_done:
		from omnitrack.api.stopwatch import get_active_session, sync_active_session
		target_user = block.employee or frappe.session.user
		active_sess = get_active_session(user=target_user)
		if active_sess:
			subj = matched_item.get("subject") or "Task"
			accomplishment = f"✓ Completed: {subj}"
			sess_list = active_sess.get("sessionNotesList") or []
			if accomplishment not in sess_list:
				sess_list.append(accomplishment)
				active_sess["sessionNotesList"] = sess_list

			existing_notes = (active_sess.get("trackerNotes") or "").strip()
			if accomplishment not in existing_notes:
				active_sess["trackerNotes"] = f"{existing_notes}\n{accomplishment}".strip()

			sync_active_session(active_sess, user=target_user)

	return {"status": "success", "task": matched_item, "tasks": items}


@frappe.whitelist()
def reschedule_unfinished_tasks(block_name, target_date=None, start_time=None, end_time=None):
	"""Carries forward any incomplete tasks from a block into a newly created planned work block."""
	if not frappe.db.exists("Planned Work Block", block_name):
		frappe.throw(_("Planned Work Block {0} not found").format(block_name))

	block = frappe.get_doc("Planned Work Block", block_name)
	items = _parse_block_tasks(block.connected_tasks)
	unfinished = [it for it in items if it.get("status") not in ("Closed", "Completed", "Done", "Rescheduled")]

	if not unfinished:
		return {"status": "noop", "message": "No unfinished items to carry forward."}

	# Compute target work_date (default: tomorrow)
	if not target_date:
		target_date = frappe.utils.add_days(block.work_date or nowdate(), 1)

	# Compute time slot
	s_time = start_time or block.start_time or "09:00:00"
	e_time = end_time or block.end_time or "11:00:00"

	# Build fresh items list for the new block
	new_items = []
	for it in unfinished:
		new_items.append({
			"id": it.get("id"),
			"ref": it.get("ref"),
			"doctype": it.get("doctype"),
			"subject": it.get("subject"),
			"project": it.get("project") or block.project,
			"status": "Open",
			"completed_at": None
		})

	new_block = frappe.new_doc("Planned Work Block")
	new_block.employee = block.employee
	new_block.associate_name = block.associate_name
	new_block.project = block.project
	new_block.task = block.task
	new_block.work_item = block.work_item
	new_block.work_item_label = f"Continuation: {block.get('work_item_label') or block.get('deliverable_notes') or block.name}"
	new_block.task_nature = block.task_nature or "🎯 Planned"
	new_block.work_date = target_date
	new_block.start_time = s_time
	new_block.end_time = e_time
	new_block.duration_hours = block.duration_hours or 2.0
	new_block.status = "Planned"
	new_block.deliverable_notes = f"Carried forward from {block.name}:\n" + "\n".join(f"• {it.get('subject')}" for it in unfinished)
	new_block.connected_tasks = json.dumps(new_items)
	new_block.flags.ignore_permissions = True
	new_block.insert()

	# Mark carried forward items in original block
	for it in items:
		if it in unfinished or any(u.get("ref") == it.get("ref") for u in unfinished):
			it["status"] = "Rescheduled"
			it["rescheduled_to"] = new_block.name

	block.connected_tasks = json.dumps(items)
	block.flags.ignore_permissions = True
	block.save()

	return {
		"status": "success",
		"original_block": block.name,
		"new_block": new_block.name,
		"target_date": str(target_date),
		"rescheduled_count": len(unfinished),
		"new_tasks": new_items
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


