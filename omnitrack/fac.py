# Copyright (c) 2026, OmmNoMi Automation LLP and contributors
# For license information, please see license.txt

import json
from datetime import datetime, timedelta
import frappe
from frappe import _
from frappe.utils import (
	add_days,
	flt,
	format_date,
	format_time,
	getdate,
	now_datetime,
	nowdate,
	time_diff_in_hours,
)

from omnitrack.api import (
	_duration_hours,
	_require_session_notes,
	_resolve_planner_user,
	book_work_block,
	create_timesheet_from_work_block,
	get_active_session,
	get_assigned_tasks,
	get_workstation_data,
	sync_active_session,
	update_work_block,
)
from omnitrack.permissions import (
	check_planned_block_past_lock,
	check_timesheet_date_permission,
	is_omnitrack_manager,
)


# ==============================================================================
# 1. WORKSPACE & SCHEDULE DISCOVERY
# ==============================================================================

@frappe.whitelist()
def get_my_workspace(employee=None, work_date=None):
	"""Returns the employee's live workstation data for AI assistant context.

	Includes:
	- Current user & employee info
	- Active stopwatch session (if any)
	- Today's planned work blocks with timings, tasks, and variance
	- Total planned vs actual hours logged today
	- Assigned tasks & ToDos available to work on

	Args:
		employee (str, optional): Target user/employee. Only managers can view other users.
		work_date (str, optional): Date in YYYY-MM-DD. Defaults to today.

	Returns:
		dict: Full structured context ready for LLM consumption.
	"""
	target_user = _resolve_planner_user(employee)
	target_date = work_date or nowdate()

	# 1. Fetch active running session
	active_session = get_active_session(target_user)
	running_hud = None
	if active_session and active_session.get("status") == "active":
		start_ms = active_session.get("startTime", 0)
		elapsed_secs = 0
		if start_ms:
			now_ms = datetime.now().timestamp() * 1000
			elapsed_secs = max(0, int((now_ms - start_ms) / 1000))
		running_hud = {
			"status": "running",
			"elapsed_seconds": elapsed_secs,
			"elapsed_formatted": f"{elapsed_secs // 3600:02d}:{(elapsed_secs % 3600) // 60:02d}:{elapsed_secs % 60:02d}",
			"project": active_session.get("selectedProject"),
			"nature": active_session.get("selectedNature"),
			"notes": active_session.get("trackerNotes"),
			"block_name": active_session.get("trackerBlockName"),
		}

	# 2. Fetch planned work blocks for the date
	blocks = frappe.get_all(
		"Planned Work Block",
		filters={"employee": target_user, "work_date": target_date},
		fields=[
			"name", "work_date", "start_time", "end_time", "duration_hours",
			"actual_hours", "variance_hours", "task", "project", "work_item_label",
			"status", "task_nature", "deliverable_notes", "timesheet"
		],
		order_by="start_time asc",
		limit=100
	)

	total_planned_hours = sum(flt(b.get("duration_hours", 0)) for b in blocks)
	total_actual_hours = sum(flt(b.get("actual_hours", 0)) for b in blocks)

	# 3. Fetch assigned tasks
	assigned_tasks = get_assigned_tasks(target_user)
	task_list = assigned_tasks.get("tasks", []) if isinstance(assigned_tasks, dict) else (assigned_tasks if isinstance(assigned_tasks, list) else [])

	return {
		"user": target_user,
		"employee_name": frappe.db.get_value("User", target_user, "full_name") or target_user,
		"date": str(target_date),
		"is_today": str(target_date) == str(nowdate()),
		"active_session": running_hud,
		"planned_blocks": blocks,
		"summary": {
			"blocks_count": len(blocks),
			"total_planned_hours": round(total_planned_hours, 2),
			"total_actual_hours": round(total_actual_hours, 2),
			"variance_hours": round(total_actual_hours - total_planned_hours, 2),
			"target_hours": 8.0,
			"remaining_to_target": max(0.0, round(8.0 - total_actual_hours, 2)),
		},
		"assigned_tasks": task_list[:25],
	}


# ==============================================================================
# 2. WORK BLOCK PLANNING (THE PLAN)
# ==============================================================================

@frappe.whitelist()
def plan_work_blocks(blocks, work_date=None, employee=None):
	"""Batch schedule planned work blocks for a day.

	Enforces OmniTrack Temporal Governance:
	- Historical plan commitments in the past (work_date < today) cannot be created.

	Args:
		blocks (list|str): List of block definitions (or JSON string).
			Each block dict must specify:
			- start_time (str): e.g. "09:00:00"
			- end_time (str): e.g. "11:00:00"
			- task (str, optional): ERPNext Task ID
			- project (str, optional): Project ID
			- deliverable_notes (str, optional): Description of what will be produced
			- task_nature (str, optional): "🎯 Planned", "⚠️ Unplanned", "🚫 Out-of-Office"
		work_date (str, optional): Target work date (YYYY-MM-DD). Defaults to today.
		employee (str, optional): Target user (only managers may target others).

	Returns:
		dict: Result status and list of booked blocks.
	"""
	if isinstance(blocks, str):
		try:
			blocks = json.loads(blocks)
		except Exception as e:
			frappe.throw(_("Invalid blocks JSON: {0}").format(str(e)))

	if not isinstance(blocks, list) or not blocks:
		frappe.throw(_("Please provide a list of blocks to plan."))

	target_user = _resolve_planner_user(employee)
	target_date = work_date or nowdate()

	# Temporal lock check
	if getdate(target_date) < getdate(nowdate()):
		frappe.throw(
			_("Cannot plan work blocks in the past ({0}). Historical plans are immutable.").format(target_date),
			frappe.ValidationError
		)

	booked_blocks = []
	for item in blocks:
		s_time = item.get("start_time")
		e_time = item.get("end_time")
		if not s_time or not e_time:
			frappe.throw(_("Each block must specify start_time and end_time."))

		# Normalize time strings (e.g. "9:00" -> "09:00:00")
		if len(s_time.split(":")) == 2:
			s_time = f"{s_time}:00"
		if len(e_time.split(":")) == 2:
			e_time = f"{e_time}:00"

		task_id = item.get("task")
		proj_id = item.get("project")
		notes = item.get("deliverable_notes") or item.get("work_item_label") or item.get("notes") or ""
		nature = item.get("task_nature") or "🎯 Planned"

		res = book_work_block(
			work_date=target_date,
			start_time=s_time,
			end_time=e_time,
			task=task_id,
			project=proj_id,
			deliverable_notes=notes,
			task_nature=nature,
			employee=target_user
		)
		booked_blocks.append({
			"name": res.get("name"),
			"start_time": s_time,
			"end_time": e_time,
			"duration_hours": res.get("duration_hours"),
			"task": task_id,
			"project": proj_id,
			"deliverable_notes": notes
		})

	total_hours = sum(flt(b["duration_hours"]) for b in booked_blocks)
	return {
		"status": "success",
		"message": f"Successfully booked {len(booked_blocks)} planned work block(s) ({total_hours} hrs).",
		"work_date": str(target_date),
		"employee": target_user,
		"blocks": booked_blocks,
		"total_planned_hours": round(total_hours, 2)
	}


# ==============================================================================
# 3. WORK SESSION LOGGING (THE ACTUAL / TIMESHEET)
# ==============================================================================

@frappe.whitelist()
def log_work_session(
	hours=None,
	from_time=None,
	to_time=None,
	task=None,
	project=None,
	block_name=None,
	notes=None,
	session_date=None,
	task_nature=None,
	auto_create_block_if_missing=True,
	logged_via="AI Assistant",
	employee=None
):
	"""Log a real work session against a planned block, or auto-book and log time.

	Enforces OmniTrack Invariants:
	1. Session notes are strictly mandatory (>= 3 chars) for client billing audit.
	2. Modification horizon: regular users can only log for TODAY and YESTERDAY.
	3. Automatically syncs with ERPNext Timesheet.

	Args:
		hours (float, optional): Duration in hours.
		from_time (str, optional): Start time (HH:MM:SS).
		to_time (str, optional): End time (HH:MM:SS).
		task (str, optional): ERPNext Task name.
		project (str, optional): ERPNext Project name.
		block_name (str, optional): Existing Planned Work Block name.
		notes (str): Detailed description of work done (REQUIRED).
		session_date (str, optional): Date of work. Defaults to today.
		task_nature (str, optional): "🎯 Planned", "⚠️ Unplanned", "☕ Break".
		auto_create_block_if_missing (bool): Auto-creates a block if none is targeted.
		logged_via (str): Source label (e.g. "AI Assistant", "Cursor", "Claude").
		employee (str, optional): Target employee/user (defaults to current human user, e.g. Nomeshwer).

	Returns:
		dict: Session result with updated block and timesheet details.
	"""
	notes = _require_session_notes(notes)
	target_user = _resolve_planner_user(employee)
	target_date = session_date or nowdate()

	# Enforce 2-day modification horizon
	check_timesheet_date_permission(target_date, target_user)

	# Calculate duration hours
	dur_hours = flt(hours)
	if dur_hours <= 0 and from_time and to_time:
		dur_hours = _duration_hours(from_time, to_time)
	if dur_hours <= 0:
		dur_hours = 0.5  # default 30 mins if completely unspecified

	target_block = None

	if block_name:
		if not frappe.db.exists("Planned Work Block", block_name):
			frappe.throw(_("Planned Work Block {0} does not exist.").format(block_name))
		target_block = block_name
	else:
		# Try to find an existing planned block for today matching task/project
		match_filters = {"employee": target_user, "work_date": target_date}
		if task:
			match_filters["task"] = task
		elif project:
			match_filters["project"] = project

		existing_block = frappe.db.get_value("Planned Work Block", match_filters, "name")
		if existing_block:
			target_block = existing_block
		elif auto_create_block_if_missing:
			# Auto-create block for this session
			start_t = from_time or "09:00:00"
			end_t = to_time
			if not end_t:
				try:
					st_dt = datetime.strptime(start_t, "%H:%M:%S")
					end_dt = st_dt + timedelta(hours=dur_hours)
					end_t = end_dt.strftime("%H:%M:%S")
				except Exception:
					end_t = "10:00:00"

			nature = task_nature or ("🎯 Planned" if task else "⚠️ Unplanned")
			bk_res = book_work_block(
				work_date=target_date,
				start_time=start_t,
				end_time=end_t,
				task=task,
				project=project,
				deliverable_notes=notes,
				task_nature=nature,
				employee=target_user
			)
			target_block = bk_res.get("name")
		else:
			frappe.throw(_("No matching Planned Work Block found. Specify block_name or allow auto_create_block_if_missing."))

	# Normalize logged_via to valid OmniTrack options ('Manual', 'Stopwatch', 'Import', 'AI Assistant')
	valid_logged_via = {"Manual", "Stopwatch", "Import", "AI Assistant"}
	if logged_via not in valid_logged_via:
		if "stopwatch" in (logged_via or "").lower() or "timer" in (logged_via or "").lower():
			normalized_logged_via = "Stopwatch"
		elif "import" in (logged_via or "").lower():
			normalized_logged_via = "Import"
		else:
			normalized_logged_via = "Manual"
	else:
		normalized_logged_via = logged_via

	# Log session into the block
	from omnitrack.api import log_work_session as api_log_work_session
	api_log_work_session(
		block_name=target_block,
		from_time=from_time,
		to_time=to_time,
		hours=dur_hours,
		session_date=target_date,
		notes=notes,
		logged_via=normalized_logged_via
	)

	# Fetch updated block metrics
	updated = frappe.db.get_value(
		"Planned Work Block",
		target_block,
		["name", "actual_hours", "variance_hours", "status", "timesheet", "project", "task"],
		as_dict=True
	)

	return {
		"status": "success",
		"message": f"Logged {dur_hours} hour(s) against block {target_block}.",
		"block_name": target_block,
		"hours_logged": dur_hours,
		"total_block_actual_hours": flt(updated.get("actual_hours", 0)),
		"timesheet": updated.get("timesheet"),
		"notes": notes,
		"date": str(target_date)
	}


# ==============================================================================
# 4. TASK CREATION & ASSIGNMENT
# ==============================================================================

@frappe.whitelist()
def quick_create_task(
	subject,
	project=None,
	priority="Medium",
	expected_time=0.0,
	description=None,
	book_block=False,
	block_start="10:00:00",
	block_end=None,
	work_date=None,
	employee=None
):
	"""Creates a new Task or ToDo, assigns it to the user, and optionally books a block.

	Args:
		subject (str): Task title/summary (REQUIRED).
		project (str, optional): Project name or ID.
		priority (str): "Low", "Medium", "High", "Urgent".
		expected_time (float): Estimated hours.
		description (str, optional): Task details.
		book_block (bool): If True, immediately books a planned work block for this task.
		block_start (str): Start time for booked block (default "10:00:00").
		block_end (str, optional): End time (auto-calculated from expected_time if omitted).
		work_date (str, optional): Work date for the booked block (default today).
		employee (str, optional): Target employee (defaults to current human user, e.g. Nomeshwer).

	Returns:
		dict: Created task details and optional booked block name.
	"""
	if not subject or not str(subject).strip():
		frappe.throw(_("Task subject cannot be empty."))

	user = _resolve_planner_user(employee)
	has_task_doctype = frappe.db.exists("DocType", "Task")
	task_name = None

	if has_task_doctype:
		task_doc = frappe.new_doc("Task")
		task_doc.subject = str(subject).strip()
		if project and frappe.db.exists("Project", project):
			task_doc.project = project
		task_doc.priority = priority or "Medium"
		task_doc.expected_time = flt(expected_time)
		task_doc.description = description or subject
		task_doc.status = "Open"
		task_doc.flags.ignore_permissions = True
		task_doc.insert()
		task_name = task_doc.name

		# Assign to user
		from frappe.desk.form.assign_to import add as add_assignment
		try:
			add_assignment({"doctype": "Task", "name": task_name, "assign_to": [user]})
		except Exception:
			pass
	else:
		# Fallback to ToDo
		todo = frappe.new_doc("ToDo")
		todo.description = subject
		todo.allocated_to = user
		todo.priority = priority or "Medium"
		todo.flags.ignore_permissions = True
		todo.insert()
		task_name = f"todo:{todo.name}"

	booked_block = None
	if book_block:
		target_date = work_date or nowdate()
		est_hours = flt(expected_time) if flt(expected_time) > 0 else 1.0
		if not block_end:
			try:
				st_dt = datetime.strptime(block_start, "%H:%M:%S" if len(block_start.split(":")) == 3 else "%H:%M")
				end_dt = st_dt + timedelta(hours=est_hours)
				block_end = end_dt.strftime("%H:%M:%S")
			except Exception:
				block_end = "12:00:00"

		res = book_work_block(
			work_date=target_date,
			start_time=block_start,
			end_time=block_end,
			task=task_name if has_task_doctype else None,
			work_item=task_name,
			work_item_label=subject,
			project=project,
			deliverable_notes=subject,
			task_nature="🎯 Planned",
			employee=user
		)
		booked_block = res.get("name")

	return {
		"status": "success",
		"task_name": task_name,
		"subject": subject,
		"project": project,
		"assigned_to": user,
		"booked_block": booked_block
	}


# ==============================================================================
# 5. LIVE STOPWATCH / SESSION CONTROLS
# ==============================================================================

@frappe.whitelist()
def quick_timer_action(
	action="status",
	task=None,
	project=None,
	notes=None,
	block_name=None,
	nature="🎯 Planned",
	employee=None
):
	"""Controls live stopwatch session for the target user (defaults to human operator).

	Terminology invariant:
	- Starting is strictly "Start Session" (Play ▶).
	- Stopping requires notes.
	- Discard allows discarding without blank timesheets.

	Args:
		action (str): "start", "stop", "discard", or "status".
		task (str, optional): Linked task.
		project (str, optional): Linked project.
		notes (str, optional): Session notes (required for "stop").
		block_name (str, optional): Target Planned Work Block.
		nature (str): Work nature (default "🎯 Planned").
		employee (str, optional): Target employee (defaults to current human user, e.g. Nomeshwer).

	Returns:
		dict: Action result.
	"""
	user = _resolve_planner_user(employee)
	action = str(action).lower().strip()

	if action == "status":
		active = get_active_session(user)
		if not active or active.get("status") != "active":
			return {"status": "idle", "session": None}
		start_ms = active.get("startTime", 0)
		elapsed = int((datetime.now().timestamp() * 1000 - start_ms) / 1000) if start_ms else 0
		return {
			"status": "running",
			"user": user,
			"elapsed_seconds": max(0, elapsed),
			"elapsed_formatted": f"{elapsed // 3600:02d}:{(elapsed % 3600) // 60:02d}:{elapsed % 60:02d}",
			"project": active.get("selectedProject"),
			"nature": active.get("selectedNature"),
			"notes": active.get("trackerNotes"),
			"block_name": active.get("trackerBlockName"),
		}

	elif action == "start":
		session_data = {
			"startTime": int(datetime.now().timestamp() * 1000),
			"selectedNature": nature or "🎯 Planned",
			"selectedProject": project or "",
			"trackerNotes": (notes or "").strip(),
			"trackerBlockName": block_name or None,
			"status": "active"
		}
		sync_active_session(session_data, user=user)
		return {
			"status": "success",
			"message": f"Session started for {user}.",
			"session": session_data
		}

	elif action == "stop":
		active = get_active_session(user)
		start_ms = active.get("startTime", 0) if active else 0
		elapsed_secs = max(0, int((datetime.now().timestamp() * 1000 - start_ms) / 1000)) if start_ms else 0
		elapsed_hours = max(round(elapsed_secs / 3600.0, 2), 0.05)

		session_notes = notes or (active.get("trackerNotes") if active else None)
		session_notes = _require_session_notes(session_notes)

		target_block = block_name or (active.get("trackerBlockName") if active else None)
		target_proj = project or (active.get("selectedProject") if active else None)

		# Log the session
		res = log_work_session(
			hours=elapsed_hours,
			block_name=target_block,
			project=target_proj,
			task=task,
			notes=session_notes,
			session_date=nowdate(),
			logged_via="Stopwatch",
			employee=user
		)
		# Clear active session
		sync_active_session(None, user=user)
		return {
			"status": "success",
			"message": f"Stopped session and logged {elapsed_hours} hour(s) for {user}.",
			"log_result": res
		}

	elif action == "discard":
		# Discard active session with zero timesheet creation
		sync_active_session(None, user=user)
		return {"status": "success", "message": f"Active session discarded for {user}."}

	elif action in ("add_line", "add_note"):
		active = get_active_session(user)
		if not active or active.get("status") != "active":
			frappe.throw(_("No active session running to append notes to."))
		if not notes or len(str(notes).strip()) < 3:
			frappe.throw(_("Note line must be at least 3 characters."))
		lines = list(active.get("sessionNotesList") or [])
		new_line = str(notes).strip()
		if new_line not in lines:
			lines.append(new_line)
		active["sessionNotesList"] = lines
		active["trackerNotes"] = "• " + "\n• ".join(lines)
		sync_active_session(active, user=user)
		return {
			"status": "success",
			"message": f"Added line to session log for {user}.",
			"sessionNotesList": lines
		}

	else:
		frappe.throw(_("Invalid timer action '{0}'. Choose 'start', 'stop', 'discard', 'status', or 'add_note'.").format(action))


@frappe.whitelist()
def add_timer_note(note, employee=None):
	"""Appends an accomplishment bullet line to the user's active running session log in real time."""
	return quick_timer_action(action="add_note", notes=note, employee=employee)


@frappe.whitelist()
def start_timer(block_name=None, notes=None, project=None, task=None, nature="🎯 Planned", employee=None):
	"""Starts an active live stopwatch session for the target user (defaults to human operator).
	The live stopwatch immediately begins ticking in the OmniTrack workstation UI across all devices.
	"""
	return quick_timer_action(
		action="start",
		block_name=block_name,
		notes=notes,
		project=project,
		task=task,
		nature=nature,
		employee=employee
	)


@frappe.whitelist()
def stop_timer(notes=None, block_name=None, project=None, task=None, employee=None):
	"""Stops the active live stopwatch session, calculates elapsed time, logs the actual worked session
	into the Planned Work Block and ERPNext Timesheet, and resets the workstation stopwatch to 00:00:00.
	Session notes describing what was accomplished are strictly required (>= 3 chars).
	"""
	return quick_timer_action(
		action="stop",
		block_name=block_name,
		notes=notes,
		project=project,
		task=task,
		employee=employee
	)


@frappe.whitelist()
def discard_timer(employee=None):
	"""Discards an active live stopwatch session without creating any empty or fractional timesheet."""
	return quick_timer_action(action="discard", employee=employee)


@frappe.whitelist()
def get_timer_status(employee=None):
	"""Checks whether a stopwatch session is currently running for the user, returning elapsed time and active task/block."""
	return quick_timer_action(action="status", employee=employee)


@frappe.whitelist()
def switch_timer(target_block=None, target_task=None, target_project=None, target_nature=None, current_session_notes=None, employee=None):
	"""Atomically switches the active running stopwatch session to another block or task.
	Closes the active session, logs its elapsed time with current_session_notes, and starts
	a fresh session on the target block/task with zero dropped time.
	"""
	from omnitrack.api import switch_active_session
	return switch_active_session(
		target_block=target_block,
		target_task=target_task,
		target_project=target_project,
		target_nature=target_nature,
		current_session_notes=current_session_notes
	)


@frappe.whitelist()
def reschedule_block(block_name, new_date=None, new_start_time=None, new_end_time=None, employee=None):
	"""Non-destructively reschedules an unworked or unfinished Planned Work Block.
	Preserves the original block's history (marked 'Rescheduled') and creates a linked copy in the target time slot.
	"""
	from omnitrack.api import reschedule_work_block as api_reschedule_work_block
	return api_reschedule_work_block(
		block_name=block_name,
		new_date=new_date,
		new_start_time=new_start_time,
		new_end_time=new_end_time
	)


@frappe.whitelist()
def extend_active_block(extend_minutes=30, employee=None):
	"""Extends the scheduled end time of the user's currently active work block (default: 30 minutes)."""
	from omnitrack.api import extend_active_block_duration
	return extend_active_block_duration(extend_minutes=int(extend_minutes or 30))


@frappe.whitelist()
def adjust_work_session(session_name, block_name=None, from_time=None, to_time=None, hours=None, session_date=None, notes=None, employee=None):
	"""Adjusts a previously logged work session's time, duration, or deliverable notes.
	Automatically synchronizes or amends the linked ERPNext Timesheet. Users can only adjust today and yesterday.
	"""
	from omnitrack.api import update_work_session as api_update_work_session
	target_user = _resolve_planner_user(employee)
	target_date = session_date or nowdate()
	check_timesheet_date_permission(target_date, target_user)
	if notes:
		notes = _require_session_notes(notes)
	return api_update_work_session(
		session_name=session_name,
		block_name=block_name,
		from_time=from_time,
		to_time=to_time,
		hours=flt(hours) if hours is not None else None,
		session_date=target_date,
		notes=notes
	)


@frappe.whitelist()
def delete_work_session(session_name, block_name, employee=None):
	"""Deletes an erroneously logged work session from a Planned Work Block.
	Automatically recalculates block actuals and cancels/amends the linked ERPNext Timesheet.
	"""
	from omnitrack.api import delete_work_session as api_delete_work_session
	return api_delete_work_session(session_name=session_name, block_name=block_name)


@frappe.whitelist()
def get_assigned_tasks_data(employee=None, status=None):
	"""Retrieves assigned tasks and ToDos categorized with attention status and workflow actions."""
	target_user = _resolve_planner_user(employee)
	data = get_assigned_tasks(target_user)
	task_list = data.get("tasks", []) if isinstance(data, dict) else (data if isinstance(data, list) else [])
	if status:
		s_low = str(status).lower()
		task_list = [t for t in task_list if s_low in str(t.get("status", "")).lower() or s_low in str(t.get("attention_badge", "")).lower()]
	return {
		"employee": target_user,
		"tasks_count": len(task_list),
		"tasks": task_list
	}


@frappe.whitelist()
def execute_task_workflow(doctype, docname, action, comment=None):
	"""Executes a workflow state transition or status change on a Task or ToDo document.
	Allowed actions: 'Start Work', 'Close Task', 'Submit for Review', 'Put on Hold', 'Cancel Task'.
	"""
	from omnitrack.api import execute_task_workflow_action
	return execute_task_workflow_action(
		doctype=doctype,
		docname=docname,
		action=action,
		comment=comment
	)


@frappe.whitelist()
def attach_tasks_to_block_action(block_name, task_refs=None, new_task_subjects=None):
	"""Attaches tasks, ToDos, or new checklist items to a Planned Work Block."""
	from omnitrack.api import attach_tasks_to_block
	return attach_tasks_to_block(
		block_name=block_name,
		task_refs=task_refs,
		new_task_subjects=new_task_subjects
	)


@frappe.whitelist()
def complete_block_task_action(block_name, task_ref, completed=True):
	"""Marks a checklist item connected to a Planned Work Block as completed or pending."""
	from omnitrack.api import complete_block_task
	return complete_block_task(
		block_name=block_name,
		task_ref=task_ref,
		completed=bool(completed)
	)


@frappe.whitelist()
def get_plan_vs_actual_analytics(employee=None, from_date=None, to_date=None):
	"""Generates Plan vs Actual performance analytics and Plan Adherence Index (PAI %)."""
	from omnitrack.api import calculate_plan_adherence_index, get_plan_vs_actual
	target_user = _resolve_planner_user(employee)
	f_date = from_date or str(add_days(nowdate(), -7))
	t_date = to_date or nowdate()
	pai_data = calculate_plan_adherence_index(employee=target_user, from_date=f_date, to_date=t_date)
	pva_data = get_plan_vs_actual(employee=target_user, from_date=f_date, to_date=t_date)
	return {
		"employee": target_user,
		"from_date": str(f_date),
		"to_date": str(t_date),
		"pai": pai_data,
		"plan_vs_actual": pva_data
	}




# ==============================================================================
# 6. END-OF-DAY RECONCILIATION & AUDIT
# ==============================================================================

@frappe.whitelist()
def get_eod_reconciliation(work_date=None, employee=None):
	"""Reviews the day's time logging against targets and invariants.

	Audits:
	- Total logged vs 8.0h target
	- Gaps between planned commitments and logged sessions
	- Blocks with zero notes or missing deliverable details
	- Temporal compliance status

	Returns:
		dict: Audit insights and recommended conversational tips for the user.
	"""
	target_user = _resolve_planner_user(employee)
	target_date = work_date or nowdate()

	ws = get_my_workspace(employee=target_user, work_date=target_date)
	summary = ws["summary"]
	blocks = ws["planned_blocks"]

	missing_notes_blocks = []
	for b in blocks:
		if flt(b.get("actual_hours", 0)) > 0 and (not b.get("deliverable_notes") or len(b["deliverable_notes"].strip()) < 3):
			missing_notes_blocks.append(b["name"])

	actual_hrs = summary["total_actual_hours"]
	target_hrs = 8.0
	deficit = max(0.0, round(target_hrs - actual_hrs, 2))

	compliance = "Compliant"
	recommendations = []

	if deficit > 0:
		recommendations.append(f"You have {deficit} hour(s) remaining to reach your 8.0-hour daily commitment.")
	if missing_notes_blocks:
		recommendations.append(f"Blocks {', '.join(missing_notes_blocks)} lack descriptive deliverable notes.")
	if not blocks:
		recommendations.append("No planned blocks were created for this day.")

	return {
		"user": target_user,
		"date": str(target_date),
		"summary": summary,
		"missing_notes_blocks": missing_notes_blocks,
		"compliance_status": "Review Required" if (deficit > 1.0 or missing_notes_blocks) else "On Track",
		"recommendations": recommendations
	}


# ==============================================================================
# 7. MANAGER / HR APPROVAL & TIMESHEET GOVERNANCE
# ==============================================================================

@frappe.whitelist()
def approve_work_blocks(block_names=None, employee=None, work_date=None, comments=None):
	"""Approves Planned Work Blocks for an employee or specific block list.
	Enforces manager/HR permissions and triggers ERPNext Timesheet generation when sync mode is 'On Approval'.
	"""
	from omnitrack.api import approve_work_blocks as api_approve_work_blocks
	return api_approve_work_blocks(
		block_names=block_names,
		employee=employee,
		work_date=work_date,
		comments=comments
	)


# ==============================================================================
# 8. MCP TOOL DEFINITIONS & BASETOOL SUBCLASSES FOR FRAPPE ASSISTANT CORE
# ==============================================================================

try:
	from frappe_assistant_core.core.base_tool import BaseTool
except Exception:
	class BaseTool:
		def __init__(self):
			self.name = ""
			self.description = ""
			self.inputSchema = {}
			self.requires_permission = None
			self.category = "OmniTrack"
			self.source_app = "omnitrack"
			self.dependencies = []
			self.default_config = {}

		def execute(self, arguments):
			raise NotImplementedError

		def _safe_execute(self, arguments):
			return {"success": True, "result": self.execute(arguments)}

		def get_metadata(self):
			return {
				"name": self.name,
				"description": self.description,
				"class": self.__class__.__name__,
				"module": self.__class__.__module__,
				"source_app": self.source_app,
				"category": self.category,
				"requires_permission": self.requires_permission,
				"dependencies": self.dependencies,
				"inputSchema": self.inputSchema,
				"default_config": self.default_config,
			}


class OmniTrackGetMyWorkspaceTool(BaseTool):
	def __init__(self):
		super().__init__()
		self.name = "omnitrack_get_my_workspace"
		self.description = "Retrieves the employee's live workstation data: active stopwatch timer, today's planned work blocks, total actual hours logged, plan adherence, and assigned tasks."
		self.category = "OmniTrack"
		self.source_app = "omnitrack"
		self.inputSchema = {
			"type": "object",
			"properties": {
				"employee": {
					"type": "string",
					"description": "Optional email/user id. Non-managers are strictly scoped to themselves."
				},
				"work_date": {
					"type": "string",
					"description": "Date in YYYY-MM-DD. Defaults to today."
				}
			}
		}

	def execute(self, arguments: dict):
		return get_my_workspace(**arguments)


class OmniTrackPlanWorkBlocksTool(BaseTool):
	def __init__(self):
		super().__init__()
		self.name = "omnitrack_plan_work_blocks"
		self.description = "Batch schedules planned work blocks for a day (e.g. 'from 9am to 11am work on Task-01'). Cannot plan in the past (historical plans are immutable)."
		self.category = "OmniTrack"
		self.source_app = "omnitrack"
		self.inputSchema = {
			"type": "object",
			"required": ["blocks"],
			"properties": {
				"blocks": {
					"type": "array",
					"description": "Array of block items to schedule.",
					"items": {
						"type": "object",
						"required": ["start_time", "end_time"],
						"properties": {
							"start_time": {"type": "string", "description": "e.g. '09:00:00'"},
							"end_time": {"type": "string", "description": "e.g. '11:00:00'"},
							"task": {"type": "string", "description": "ERPNext Task ID (e.g. TASK-2026-001)"},
							"project": {"type": "string", "description": "Project ID"},
							"deliverable_notes": {"type": "string", "description": "What will be accomplished"},
							"task_nature": {"type": "string", "description": "'🎯 Planned', '⚠️ Unplanned', or '🚫 Out-of-Office'"}
						}
					}
				},
				"work_date": {
					"type": "string",
					"description": "Work date (YYYY-MM-DD). Defaults to today."
				},
				"employee": {
					"type": "string",
					"description": "Target employee email (managers only)."
				}
			}
		}

	def execute(self, arguments: dict):
		return plan_work_blocks(**arguments)


class OmniTrackLogWorkSessionTool(BaseTool):
	def __init__(self):
		super().__init__()
		self.name = "omnitrack_log_work_session"
		self.description = "Records a real work session against a planned block, or auto-books and logs time into an ERPNext Timesheet. Notes are mandatory (>= 3 chars). Users can only log for today & yesterday."
		self.category = "OmniTrack"
		self.source_app = "omnitrack"
		self.inputSchema = {
			"type": "object",
			"required": ["notes"],
			"properties": {
				"notes": {
					"type": "string",
					"description": "Mandatory detailed description of what was completed."
				},
				"hours": {
					"type": "number",
					"description": "Duration in hours (e.g. 1.5)."
				},
				"from_time": {
					"type": "string",
					"description": "Start time (HH:MM:SS)."
				},
				"to_time": {
					"type": "string",
					"description": "End time (HH:MM:SS)."
				},
				"task": {
					"type": "string",
					"description": "ERPNext Task ID."
				},
				"project": {
					"type": "string",
					"description": "Project ID."
				},
				"block_name": {
					"type": "string",
					"description": "Specific Planned Work Block ID (e.g. PWB-2026-00012)."
				},
				"session_date": {
					"type": "string",
					"description": "Date of work (YYYY-MM-DD). Defaults to today."
				},
				"auto_create_block_if_missing": {
					"type": "boolean",
					"description": "Auto-creates a planned block if none matches. Defaults to true."
				},
				"employee": {
					"type": "string",
					"description": "Target employee email or name (defaults to current human user, e.g. Nomeshwer)."
				}
			}
		}

	def execute(self, arguments: dict):
		return log_work_session(**arguments)


class OmniTrackQuickCreateTaskTool(BaseTool):
	def __init__(self):
		super().__init__()
		self.name = "omnitrack_quick_create_task"
		self.description = "Creates an ERPNext Task (or ToDo), assigns it to the user, and optionally books a planned work block immediately."
		self.category = "OmniTrack"
		self.source_app = "omnitrack"
		self.inputSchema = {
			"type": "object",
			"required": ["subject"],
			"properties": {
				"subject": {
					"type": "string",
					"description": "Title or summary of the task."
				},
				"project": {
					"type": "string",
					"description": "Project ID."
				},
				"priority": {
					"type": "string",
					"description": "'Low', 'Medium', 'High', 'Urgent'."
				},
				"expected_time": {
					"type": "number",
					"description": "Estimated hours."
				},
				"description": {
					"type": "string",
					"description": "Detailed task description."
				},
				"book_block": {
					"type": "boolean",
					"description": "If true, schedules a planned work block for this task today."
				},
				"block_start": {
					"type": "string",
					"description": "Start time for booked block (default '10:00:00')."
				},
				"employee": {
					"type": "string",
					"description": "Target employee email or name (defaults to current human user, e.g. Nomeshwer)."
				}
			}
		}

	def execute(self, arguments: dict):
		return quick_create_task(**arguments)


class OmniTrackQuickTimerActionTool(BaseTool):
	def __init__(self):
		super().__init__()
		self.name = "omnitrack_quick_timer_action"
		self.description = "Controls live stopwatch session for the user ('start', 'stop', 'discard', 'status')."
		self.category = "OmniTrack"
		self.source_app = "omnitrack"
		self.inputSchema = {
			"type": "object",
			"required": ["action"],
			"properties": {
				"action": {
					"type": "string",
					"enum": ["start", "stop", "discard", "status"],
					"description": "'start' (Start Session), 'stop' (requires notes), 'discard' (2-step discard), 'status'."
				},
				"notes": {
					"type": "string",
					"description": "Session notes (required when stopping)."
				},
				"task": {
					"type": "string",
					"description": "Task ID."
				},
				"project": {
					"type": "string",
					"description": "Project ID."
				},
				"block_name": {
					"type": "string",
					"description": "Planned Work Block ID."
				},
				"nature": {
					"type": "string",
					"description": "'🎯 Planned', '⚠️ Unplanned', or '☕ Break'."
				},
				"employee": {
					"type": "string",
					"description": "Target employee email or name (defaults to current human user, e.g. Nomeshwer)."
				}
			}
		}

	def execute(self, arguments: dict):
		return quick_timer_action(**arguments)


class OmniTrackStartTimerTool(BaseTool):
	def __init__(self):
		super().__init__()
		self.name = "omnitrack_start_timer"
		self.description = "Starts a live running stopwatch session for the user. Live ticking starts immediately in the OmniTrack workstation UI across all devices. Terminates previous idle state."
		self.category = "OmniTrack"
		self.source_app = "omnitrack"
		self.inputSchema = {
			"type": "object",
			"properties": {
				"block_name": {
					"type": "string",
					"description": "Target Planned Work Block ID (e.g. PWB-2026-12413)."
				},
				"notes": {
					"type": "string",
					"description": "Initial deliverable or focus notes for the session."
				},
				"project": {
					"type": "string",
					"description": "ERPNext Project ID."
				},
				"task": {
					"type": "string",
					"description": "ERPNext Task ID."
				},
				"nature": {
					"type": "string",
					"description": "'🎯 Planned', '⚠️ Unplanned', or '☕ Break'. Defaults to '🎯 Planned'."
				},
				"employee": {
					"type": "string",
					"description": "Target employee email or ID (defaults to current human operator)."
				}
			}
		}

	def execute(self, arguments: dict):
		return start_timer(**arguments)


class OmniTrackStopTimerTool(BaseTool):
	def __init__(self):
		super().__init__()
		self.name = "omnitrack_stop_timer"
		self.description = "Stops the active live stopwatch session, calculates elapsed time, logs the actual worked session into the Planned Work Block and ERPNext Timesheet, and resets the workstation stopwatch to 00:00:00. Session notes describing what was accomplished are strictly required (>= 3 chars)."
		self.category = "OmniTrack"
		self.source_app = "omnitrack"
		self.inputSchema = {
			"type": "object",
			"required": ["notes"],
			"properties": {
				"notes": {
					"type": "string",
					"description": "Mandatory session notes describing what was accomplished (>= 3 characters)."
				},
				"block_name": {
					"type": "string",
					"description": "Optional override Planned Work Block ID."
				},
				"project": {
					"type": "string",
					"description": "Optional Project ID."
				},
				"task": {
					"type": "string",
					"description": "Optional Task ID."
				},
				"employee": {
					"type": "string",
					"description": "Target employee email (defaults to current human user)."
				}
			}
		}

	def execute(self, arguments: dict):
		return stop_timer(**arguments)


class OmniTrackDiscardTimerTool(BaseTool):
	def __init__(self):
		super().__init__()
		self.name = "omnitrack_discard_timer"
		self.description = "Discards an active live stopwatch session without creating any empty or fractional timesheet."
		self.category = "OmniTrack"
		self.source_app = "omnitrack"
		self.inputSchema = {
			"type": "object",
			"properties": {
				"employee": {
					"type": "string",
					"description": "Target employee email (defaults to current human user)."
				}
			}
		}

	def execute(self, arguments: dict):
		return discard_timer(**arguments)


class OmniTrackGetTimerStatusTool(BaseTool):
	def __init__(self):
		super().__init__()
		self.name = "omnitrack_get_timer_status"
		self.description = "Checks whether a stopwatch session is currently running for the user, returning elapsed time and active task/block."
		self.category = "OmniTrack"
		self.source_app = "omnitrack"
		self.inputSchema = {
			"type": "object",
			"properties": {
				"employee": {
					"type": "string",
					"description": "Target employee email (defaults to current human user)."
				}
			}
		}

	def execute(self, arguments: dict):
		return get_timer_status(**arguments)


class OmniTrackGetEODReconciliationTool(BaseTool):
	def __init__(self):
		super().__init__()
		self.name = "omnitrack_get_eod_reconciliation"
		self.description = "Audits the employee's day: checks total logged hours vs 8h target, unallocated gaps, missing session notes, and temporal compliance."
		self.category = "OmniTrack"
		self.source_app = "omnitrack"
		self.inputSchema = {
			"type": "object",
			"properties": {
				"work_date": {
					"type": "string",
					"description": "Date in YYYY-MM-DD. Defaults to today."
				},
				"employee": {
					"type": "string",
					"description": "Target employee email (managers only)."
				}
			}
		}

	def execute(self, arguments: dict):
		return get_eod_reconciliation(**arguments)


class OmniTrackSwitchTimerTool(BaseTool):
	def __init__(self):
		super().__init__()
		self.name = "omnitrack_switch_timer"
		self.description = "Atomically switches the active running stopwatch session to another block or task. Closes the current session, logs its elapsed time with session notes, and starts a fresh session on the target block/task with zero dropped time."
		self.category = "OmniTrack"
		self.source_app = "omnitrack"
		self.inputSchema = {
			"type": "object",
			"properties": {
				"target_block": {"type": "string", "description": "Target Planned Work Block ID to switch to."},
				"target_task": {"type": "string", "description": "Target Task ID to switch to."},
				"target_project": {"type": "string", "description": "Target Project ID."},
				"target_nature": {"type": "string", "description": "'🎯 Planned', '⚠️ Unplanned', or '☕ Break'."},
				"current_session_notes": {"type": "string", "description": "Session notes to log for the block/session being closed."},
				"employee": {"type": "string", "description": "Target employee email (defaults to current human user)."}
			}
		}

	def execute(self, arguments: dict):
		return switch_timer(**arguments)


class OmniTrackRescheduleBlockTool(BaseTool):
	def __init__(self):
		super().__init__()
		self.name = "omnitrack_reschedule_block"
		self.description = "Non-destructively reschedules an unworked or unfinished Planned Work Block. Preserves original block with 'Rescheduled' status and clones it to the target date/time."
		self.category = "OmniTrack"
		self.source_app = "omnitrack"
		self.inputSchema = {
			"type": "object",
			"required": ["block_name"],
			"properties": {
				"block_name": {"type": "string", "description": "Planned Work Block ID to reschedule."},
				"new_date": {"type": "string", "description": "New work date (YYYY-MM-DD). Defaults to original date."},
				"new_start_time": {"type": "string", "description": "New start time (HH:MM:SS)."},
				"new_end_time": {"type": "string", "description": "New end time (HH:MM:SS)."},
				"employee": {"type": "string", "description": "Target employee email (defaults to current human user)."}
			}
		}

	def execute(self, arguments: dict):
		return reschedule_block(**arguments)


class OmniTrackExtendActiveBlockTool(BaseTool):
	def __init__(self):
		super().__init__()
		self.name = "omnitrack_extend_active_block"
		self.description = "Extends the scheduled end time of the user's currently active work block (default: 30 minutes) when work requires more time."
		self.category = "OmniTrack"
		self.source_app = "omnitrack"
		self.inputSchema = {
			"type": "object",
			"properties": {
				"extend_minutes": {"type": "integer", "description": "Minutes to add to the block's scheduled end time (default: 30)."},
				"employee": {"type": "string", "description": "Target employee email (defaults to current human user)."}
			}
		}

	def execute(self, arguments: dict):
		return extend_active_block(**arguments)


class OmniTrackAdjustWorkSessionTool(BaseTool):
	def __init__(self):
		super().__init__()
		self.name = "omnitrack_adjust_work_session"
		self.description = "Adjusts a previously logged work session's time, duration, or deliverable notes in a Planned Work Block. Automatically recalculates block totals and updates/amends the linked ERPNext Timesheet."
		self.category = "OmniTrack"
		self.source_app = "omnitrack"
		self.inputSchema = {
			"type": "object",
			"required": ["session_name"],
			"properties": {
				"session_name": {"type": "string", "description": "Row name of the session child table entry to modify."},
				"block_name": {"type": "string", "description": "Parent Planned Work Block ID."},
				"from_time": {"type": "string", "description": "Updated start time (HH:MM:SS)."},
				"to_time": {"type": "string", "description": "Updated end time (HH:MM:SS)."},
				"hours": {"type": "number", "description": "Updated duration in hours."},
				"session_date": {"type": "string", "description": "Work date (YYYY-MM-DD). Regular users can only adjust today and yesterday."},
				"notes": {"type": "string", "description": "Updated deliverable notes describing work accomplished."},
				"employee": {"type": "string", "description": "Target employee email (defaults to current human user)."}
			}
		}

	def execute(self, arguments: dict):
		return adjust_work_session(**arguments)


class OmniTrackDeleteWorkSessionTool(BaseTool):
	def __init__(self):
		super().__init__()
		self.name = "omnitrack_delete_work_session"
		self.description = "Deletes an erroneously logged work session from a Planned Work Block. Automatically recalculates block actuals and cancels/amends the linked ERPNext Timesheet."
		self.category = "OmniTrack"
		self.source_app = "omnitrack"
		self.inputSchema = {
			"type": "object",
			"required": ["session_name", "block_name"],
			"properties": {
				"session_name": {"type": "string", "description": "Row name of the session child table entry to remove."},
				"block_name": {"type": "string", "description": "Parent Planned Work Block ID."},
				"employee": {"type": "string", "description": "Target employee email (defaults to current human user)."}
			}
		}

	def execute(self, arguments: dict):
		return delete_work_session(**arguments)


class OmniTrackGetAssignedTasksTool(BaseTool):
	def __init__(self):
		super().__init__()
		self.name = "omnitrack_get_assigned_tasks"
		self.description = "Retrieves assigned tasks and ToDos categorized by attention level ('Overdue & Unplanned', 'Due Today', 'Open'), deficit hours, and available workflow actions."
		self.category = "OmniTrack"
		self.source_app = "omnitrack"
		self.inputSchema = {
			"type": "object",
			"properties": {
				"employee": {"type": "string", "description": "Target employee email (defaults to current human user)."},
				"status": {"type": "string", "description": "Optional filter by status or attention level ('Open', 'Overdue', 'Working')."}
			}
		}

	def execute(self, arguments: dict):
		return get_assigned_tasks_data(**arguments)


class OmniTrackExecuteTaskWorkflowTool(BaseTool):
	def __init__(self):
		super().__init__()
		self.name = "omnitrack_execute_task_workflow"
		self.description = "Executes a workflow state transition or status change on an ERPNext Task or ToDo document ('Start Work', 'Close Task', 'Submit for Review', 'Put on Hold', 'Cancel Task')."
		self.category = "OmniTrack"
		self.source_app = "omnitrack"
		self.inputSchema = {
			"type": "object",
			"required": ["doctype", "docname", "action"],
			"properties": {
				"doctype": {"type": "string", "enum": ["Task", "ToDo"], "description": "DocType ('Task' or 'ToDo')."},
				"docname": {"type": "string", "description": "Document name or ID."},
				"action": {"type": "string", "description": "Action/Transition to apply (e.g. 'Start Work', 'Close Task', 'Put on Hold', 'Submit for Review')."},
				"comment": {"type": "string", "description": "Optional comment recorded in document timeline."}
			}
		}

	def execute(self, arguments: dict):
		return execute_task_workflow(**arguments)


class OmniTrackAttachTasksToBlockTool(BaseTool):
	def __init__(self):
		super().__init__()
		self.name = "omnitrack_attach_tasks_to_block"
		self.description = "Attaches existing Tasks/ToDos or creates new checklist items on a Planned Work Block."
		self.category = "OmniTrack"
		self.source_app = "omnitrack"
		self.inputSchema = {
			"type": "object",
			"required": ["block_name"],
			"properties": {
				"block_name": {"type": "string", "description": "Target Planned Work Block ID."},
				"task_refs": {"type": "array", "items": {"type": "string"}, "description": "List of task or todo references (e.g. ['TASK-2026-0001', 'todo:12345'])."},
				"new_task_subjects": {"type": "array", "items": {"type": "string"}, "description": "List of new checklist item subjects to create."}
			}
		}

	def execute(self, arguments: dict):
		return attach_tasks_to_block_action(**arguments)


class OmniTrackCompleteBlockTaskTool(BaseTool):
	def __init__(self):
		super().__init__()
		self.name = "omnitrack_complete_block_task"
		self.description = "Marks a checklist item connected to a Planned Work Block as completed or pending."
		self.category = "OmniTrack"
		self.source_app = "omnitrack"
		self.inputSchema = {
			"type": "object",
			"required": ["block_name", "task_ref"],
			"properties": {
				"block_name": {"type": "string", "description": "Target Planned Work Block ID."},
				"task_ref": {"type": "string", "description": "Checklist item reference or task ID."},
				"completed": {"type": "boolean", "description": "True to mark completed, False to mark pending."}
			}
		}

	def execute(self, arguments: dict):
		return complete_block_task_action(**arguments)


class OmniTrackGetPlanVsActualTool(BaseTool):
	def __init__(self):
		super().__init__()
		self.name = "omnitrack_get_plan_vs_actual"
		self.description = "Generates Plan vs Actual performance analytics, Plan Adherence Index (PAI %), total planned hours, actual hours, variance, and project distribution."
		self.category = "OmniTrack"
		self.source_app = "omnitrack"
		self.inputSchema = {
			"type": "object",
			"properties": {
				"employee": {"type": "string", "description": "Target employee email (defaults to current human user)."},
				"from_date": {"type": "string", "description": "Start date (YYYY-MM-DD). Defaults to 7 days ago."},
				"to_date": {"type": "string", "description": "End date (YYYY-MM-DD). Defaults to today."}
			}
		}

	def execute(self, arguments: dict):
		return get_plan_vs_actual_analytics(**arguments)


class OmniTrackApproveWorkBlocksTool(BaseTool):
	def __init__(self):
		super().__init__()
		self.name = "omnitrack_approve_work_blocks"
		self.description = "Approves Planned Work Blocks for an employee or specific block IDs as Manager or HR. When timesheet sync mode is configured as 'On Approval', triggers generation/synchronization of ERPNext Timesheets."
		self.category = "OmniTrack"
		self.source_app = "omnitrack"
		self.inputSchema = {
			"type": "object",
			"properties": {
				"employee": {
					"type": "string",
					"description": "Target employee email whose unapproved blocks will be approved."
				},
				"work_date": {
					"type": "string",
					"description": "Date of work (YYYY-MM-DD) to approve. Defaults to today."
				},
				"block_names": {
					"type": "array",
					"items": {"type": "string"},
					"description": "Specific Planned Work Block IDs to approve (e.g. ['PWB-2026-12413'])."
				},
				"comments": {
					"type": "string",
					"description": "Manager approval comments or review notes."
				}
			}
		}

	def execute(self, arguments: dict):
		return approve_work_blocks(**arguments)


def get_fac_tools():
	"""Returns MCP tool definitions so Frappe Assistant Core and any MCP client
	can expose OmniTrack domain capabilities natively.
	"""
	tool_classes = [
		OmniTrackGetMyWorkspaceTool,
		OmniTrackPlanWorkBlocksTool,
		OmniTrackLogWorkSessionTool,
		OmniTrackQuickCreateTaskTool,
		OmniTrackQuickTimerActionTool,
		OmniTrackStartTimerTool,
		OmniTrackStopTimerTool,
		OmniTrackDiscardTimerTool,
		OmniTrackGetTimerStatusTool,
		OmniTrackGetEODReconciliationTool,
		OmniTrackSwitchTimerTool,
		OmniTrackRescheduleBlockTool,
		OmniTrackExtendActiveBlockTool,
		OmniTrackAdjustWorkSessionTool,
		OmniTrackDeleteWorkSessionTool,
		OmniTrackGetAssignedTasksTool,
		OmniTrackExecuteTaskWorkflowTool,
		OmniTrackAttachTasksToBlockTool,
		OmniTrackCompleteBlockTaskTool,
		OmniTrackGetPlanVsActualTool,
		OmniTrackApproveWorkBlocksTool,
	]
	tools = []
	for cls in tool_classes:
		instance = cls()
		tools.append({
			"name": instance.name,
			"description": instance.description,
			"inputSchema": instance.inputSchema,
			"handler": instance.execute,
		})
	return tools


