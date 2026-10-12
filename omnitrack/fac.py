# Copyright (c) 2026, OmmNoMi Automation LLP and contributors
# For license information, please see license.txt

import json
import re
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
	approve_work_blocks,
	book_work_block,
	create_timesheet_from_work_block,
	get_active_session,
	get_assigned_tasks,
	get_workstation_data,
	sync_active_session,
)
from omnitrack.permissions import (
	check_planned_block_past_lock,
	check_timesheet_date_permission,
	get_earliest_log_date,
	get_log_days_back,
	get_payroll_closed_through,
	is_omnitrack_manager,
)
from omnitrack.utils.block_slot import block_slot, split_stamp
from omnitrack.utils.session_lines import compose_wrap_note
from omnitrack.utils.validators import get_min_log_line_chars, get_min_session_words
from omnitrack.utils.time_math import pad_time as _time_str


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
		"log_rules": get_log_rules(),
	}


def get_log_rules(user=None):
	"""Which days time can be logged on, and what a saved session needs: the same rules the page
	and the server use (OmniTrack Settings), so the assistant asks for a day that will be accepted
	instead of finding out from a refusal."""
	user = user or frappe.session.user
	closed = get_payroll_closed_through()
	is_manager = is_omnitrack_manager(user)
	earliest = None if is_manager else get_earliest_log_date()
	if closed:
		after_closed = getdate(add_days(closed, 1))
		earliest = max(earliest, after_closed) if earliest else after_closed
	return {
		"log_days_back": get_log_days_back(),
		"payroll_closed_through": str(closed) if closed else None,
		# The first day this person can log, change or delete time on (None: any day)
		"can_log_from": str(earliest) if earliest else None,
		"is_manager": is_manager,
		"min_session_words": get_min_session_words(),
		"min_log_line_chars": get_min_log_line_chars(),
		"rules": [
			"Time is logged, changed or deleted only on days from can_log_from to today; payroll_closed_through and earlier are paid and closed to everyone.",
			"A saved session describes what was done in at least min_session_words words, in the person's own words; never invent or pad them.",
			"Nothing is assumed for the person: ask for times, reasons and notes they have not given.",
			"Before deleting an entry, discarding a running session or cancelling a block, say which one and wait for the person's yes.",
		],
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
			- task_nature (str, optional): the activity: "Work", "Break" or "Away"
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

	# Each block's day and times. A date written into start_time used to be dropped: the block
	# landed on today, 0.0 hrs long. Now it sets the day, or is refused when it disagrees.
	slots = []
	for item in blocks:
		if not item.get("start_time") or not item.get("end_time"):
			frappe.throw(_("Each block must specify start_time and end_time."))
		try:
			slots.append(block_slot(item.get("start_time"), item.get("end_time"), work_date))
		except ValueError as e:
			frappe.throw(_("Block {0}: {1}").format(len(slots) + 1, str(e)), frappe.ValidationError)
	days = {d for d, _s, _e in slots if d}
	if len(days) > 1:
		frappe.throw(_("These blocks are on different days ({0}); plan one day per call.").format(", ".join(sorted(days))), frappe.ValidationError)
	target_date = work_date or (days.pop() if days else nowdate())

	# Temporal lock check
	if getdate(target_date) < getdate(nowdate()):
		frappe.throw(
			_("Cannot plan work blocks in the past ({0}). Historical plans are immutable.").format(target_date),
			frappe.ValidationError
		)

	booked_blocks = []
	for item, (_day, s_time, e_time) in zip(blocks, slots):
		task_id = item.get("task")
		proj_id = item.get("project")
		notes = item.get("deliverable_notes") or item.get("work_item_label") or item.get("notes") or ""
		nature = item.get("task_nature") or "Work"

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
			"deliverable_notes": notes,
			"added_to_tasks": res.get("added_to_tasks") or [],
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
	employee=None,
	match_existing_block=True
):
	"""Log a real work session against a planned block, or auto-book and log time.

	Enforces OmniTrack Invariants:
	1. Notes say what was done in at least Minimum Words per Session words (OmniTrack Settings,
	   default 15), in the person's own words.
	2. Log window: an employee logs on the last log_days_back days (default 15, today is day 1);
	   a manager on any day. Nobody logs on or before payroll_closed_through.
	3. Nothing is assumed: the length (hours, or from_time and to_time) is the person's to give,
	   and a new block needs from_time, so it sits where the work happened.
	4. Automatically syncs with ERPNext Timesheet.

	Args:
		hours (float, optional): Duration in hours.
		from_time (str, optional): Start time (HH:MM:SS).
		to_time (str, optional): End time (HH:MM:SS).
		task (str, optional): ERPNext Task name.
		project (str, optional): ERPNext Project name.
		block_name (str, optional): Existing Planned Work Block name.
		notes (str): Detailed description of work done (REQUIRED).
		session_date (str, optional): Date of work. Defaults to today.
		task_nature (str, optional): the activity: "Work", "Break" or "Away".
		auto_create_block_if_missing (bool): Auto-creates a block if none is targeted.
		logged_via (str): Source label (e.g. "AI Assistant", "Cursor", "Claude").
		employee (str, optional): Target employee/user (defaults to current human user, e.g. Nomeshwer).
		match_existing_block (bool): False when a stopped session with no block gets its own,
			as the page's Stop makes one, instead of joining the day's block for its project.

	Returns:
		dict: Session result with updated block and timesheet details.
	"""
	notes = _require_session_notes(notes)
	target_user = _resolve_planner_user(employee)
	target_date = session_date or nowdate()

	# The log window and the payroll lock, for whoever is asking (a manager reaches any open day),
	# checked before a block is made for the time
	check_timesheet_date_permission(target_date, frappe.session.user)

	# How long is the person's to say: an invented half hour was once logged and paid
	dur_hours = flt(hours)
	if dur_hours <= 0 and from_time and to_time:
		dur_hours = _duration_hours(from_time, to_time)
	if dur_hours <= 0:
		frappe.throw(_("Not logged. Say how long: hours, or from_time and to_time."), frappe.ValidationError)

	target_block = None

	if block_name:
		if not frappe.db.exists("Planned Work Block", block_name):
			frappe.throw(_("Planned Work Block {0} does not exist.").format(block_name))
		target_block = block_name
	else:
		# The day's block for this task or project. With neither, no block is guessed: the time
		# once went on whichever block came first that day.
		existing_block = None
		if match_existing_block and (task or project):
			match_filters = {"employee": target_user, "work_date": target_date, "status": ["not in", ("Cancelled", "Rescheduled")]}
			match_filters["task" if task else "project"] = task or project
			existing_block = frappe.db.get_value("Planned Work Block", match_filters, "name")
		if existing_block:
			target_block = existing_block
		elif auto_create_block_if_missing:
			# A new block sits where the work happened: its start is the person's to say, never 09:00
			if not from_time:
				frappe.throw(_("Not logged. Say when it started (from_time), or name the block it belongs to."), frappe.ValidationError)
			start_t = _time_str(from_time)
			end_t = to_time or (datetime.strptime(start_t, "%H:%M:%S") + timedelta(hours=dur_hours)).strftime("%H:%M:%S")

			nature = task_nature or "Work"
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
			# Made only to hold this logged time: no block was planned for it
			frappe.db.set_value("Planned Work Block", target_block, "unplanned", 1, update_modified=False)
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
		["name", "actual_hours", "variance_hours", "status", "timesheet", "project", "task", "duration_hours"],
		as_dict=True
	)

	# Auto-advance block status upon full delivery to preserve reporting integrity
	if updated and updated.get("status") in ("Planned", "In Progress"):
		act = flt(updated.get("actual_hours", 0))
		dur = flt(updated.get("duration_hours", 0))
		if dur > 0 and act >= dur:
			frappe.db.set_value("Planned Work Block", target_block, "status", "Logged (Full)", update_modified=False)
			updated["status"] = "Logged (Full)"
		elif act > 0:
			frappe.db.set_value("Planned Work Block", target_block, "status", "Logged (Partial)", update_modified=False)
			updated["status"] = "Logged (Partial)"

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
	block_start=None,
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
		block_start (str): Start time for the booked block; required with book_block, never assumed.
		block_end (str, optional): End time; when omitted, block_start plus expected_time (required then).
		work_date (str, optional): Work date for the booked block (default today).
		employee (str, optional): Target employee (defaults to current human user, e.g. Nomeshwer).

	Returns:
		dict: Created task details and optional booked block name.
	"""
	if not subject or not str(subject).strip():
		frappe.throw(_("Task subject cannot be empty."))

	# The block's day and times are checked before the task exists, so a bad time creates (and
	# assigns, which can notify) nothing. A dated block_start sets the day, as when planning.
	if book_block:
		# When is the person's to say: a block was once put at 10:00 for an hour on nobody's word
		if not block_start:
			frappe.throw(_("Not created. Say when the block starts (block_start), or create the task without booking a block."), frappe.ValidationError)
		if not block_end and flt(expected_time) <= 0:
			frappe.throw(_("Not created. Say when the block ends (block_end) or how long it takes (expected_time)."), frappe.ValidationError)
		try:
			start_day, block_start = split_stamp(block_start)
		except ValueError as e:
			frappe.throw(_("block_start: {0}").format(str(e)), frappe.ValidationError)
		if start_day and work_date and str(work_date) != start_day:
			frappe.throw(_("block_start is on {0} but work_date is {1}; send one date, or the same date in both").format(start_day, work_date), frappe.ValidationError)
		target_date = work_date or start_day or nowdate()
		if not block_end:
			block_end = (datetime.strptime(block_start, "%H:%M:%S") + timedelta(hours=flt(expected_time))).strftime("%H:%M:%S")
		try:
			_d, block_start, block_end = block_slot(f"{target_date} {block_start}", block_end, target_date)
		except ValueError as e:
			frappe.throw(_("block_end: {0}").format(str(e)), frappe.ValidationError)

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
		res = book_work_block(
			work_date=target_date,
			start_time=block_start,
			end_time=block_end,
			task=task_name if has_task_doctype else None,
			work_item=task_name,
			work_item_label=subject,
			project=project,
			deliverable_notes=subject,
			task_nature="Work",
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
	nature="Work",
	start_time=None,
	start_time_epoch_ms=None,
	work_date=None,
	session_date=None,
	employee=None
):
	"""Controls live stopwatch session for the target user (defaults to human operator).

	The page's rules, the same here:
	- Start refuses while a session runs: stop it, or switch to the next work.
	- Stop saves the session as the page does: its title, every log line, then notes as the last
	  line, in at least Minimum Words per Session words. Refused, the session keeps running.
	- Discard throws the running session away unsaved: ask the person first.
	- add_note adds one log line of at least Minimum Log Line Length characters.

	Args:
		action (str): "start", "stop", "discard", "status" or "add_note".
		task (str, optional): Linked task.
		project (str, optional): Linked project.
		notes (str, optional): "stop": the last line of the log; "add_note": the line; "start": the title.
		block_name (str, optional): Target Planned Work Block.
		nature (str): The activity (default "Work").
		start_time (str, optional): Scheduled/retroactive start time (e.g. "21:30:00").
		start_time_epoch_ms (int|str, optional): Exact epoch milliseconds.
		work_date (str, optional): Target work date (YYYY-MM-DD). Defaults to today.
		session_date (str, optional): Target session date alias for work_date.
		employee (str, optional): Target employee (defaults to current human user, e.g. Nomeshwer).

	Returns:
		dict: Action result.
	"""
	user = _resolve_planner_user(employee)
	action = str(action).lower().strip()
	target_date = work_date or session_date or nowdate()

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
		running = get_active_session(user)
		if running and running.get("status") == "active":
			# Starting over a running session once threw it away, unsaved
			frappe.throw(_("Not started. A session is already running{0}. Stop it, or switch to the next work.").format(
				_(" on {0}").format(running.get("trackerBlockName")) if running.get("trackerBlockName") else ""
			), frappe.ValidationError)
		start_ms = None
		if start_time_epoch_ms:
			try:
				start_ms = int(float(start_time_epoch_ms))
			except Exception:
				start_ms = None
		elif start_time:
			try:
				from zoneinfo import ZoneInfo
				tz_name = frappe.db.get_single_value("System Settings", "time_zone") or "Asia/Kolkata"
				tz = ZoneInfo(tz_name)
				today_date = getdate(target_date)
				parts = str(start_time).strip().split(":")
				h = int(parts[0]) if len(parts) > 0 else 0
				m = int(parts[1]) if len(parts) > 1 else 0
				s = int(float(parts[2])) if len(parts) > 2 else 0
				dt = datetime(today_date.year, today_date.month, today_date.day, h, m, s, tzinfo=tz)
				start_ms = int(dt.timestamp() * 1000)
			except Exception:
				# An unreadable time once started the session at now, without a word
				frappe.throw(_("Not started. {0} is not a time; send HH:MM:SS.").format(start_time), frappe.ValidationError)

		now_ms = int(datetime.now().timestamp() * 1000)
		if start_ms and start_ms > now_ms:
			frappe.throw(_("Not started. {0} is later than now.").format(start_time or start_time_epoch_ms), frappe.ValidationError)
		if not start_ms:
			start_ms = now_ms

		# The first part names the session (its title); the rest are its log lines. The whole text
		# was once both the title and the first line, so it was saved twice on stop.
		raw_notes = (notes or "").strip()
		parts = [p.strip() for p in re.split(r"[\n\u2022]", raw_notes) if p.strip()]
		title = parts[0] if parts else ""
		notes_lines = parts[1:]

		session_data = {
			"startTime": start_ms,
			"selectedNature": nature or "Work",
			"selectedProject": project or "",
			"trackerNotes": title,
			"trackerBlockName": block_name or None,
			"sessionNotesList": notes_lines,
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
		if not active or active.get("status") != "active" or not active.get("startTime"):
			frappe.throw(_("No active stopwatch session found to stop for {0}. Use log_work_session to record completed work manually.").format(user))

		start_ms = active.get("startTime", 0)
		now_dt = datetime.now()
		elapsed_secs = max(0, int((now_dt.timestamp() * 1000 - start_ms) / 1000)) if start_ms else 0
		elapsed_hours = max(round(elapsed_secs / 3600.0, 2), 0.05)

		start_dt = datetime.fromtimestamp(start_ms / 1000.0)
		from_t = start_dt.strftime("%H:%M:%S")
		to_t = now_dt.strftime("%H:%M:%S")

		# Saved as the page saves it: the title, every line logged during it, then this last line.
		# Only the notes sent here were once saved, and the session's own log was lost.
		session_notes = _require_session_notes(
			compose_wrap_note(active.get("trackerNotes"), active.get("sessionNotesList"), notes)
		)

		target_block = active.get("trackerBlockName") or block_name
		target_proj = project or active.get("selectedProject")
		target_nature = active.get("selectedNature") or nature

		# The day it started on, as the page saves it: a session past midnight belongs to its start
		res = log_work_session(
			hours=elapsed_hours,
			from_time=from_t,
			to_time=to_t,
			block_name=target_block,
			project=target_proj,
			task=task,
			notes=session_notes,
			session_date=start_dt.strftime("%Y-%m-%d"),
			task_nature=target_nature,
			logged_via="Stopwatch",
			employee=user,
			match_existing_block=False,
		)
		# Clear active session
		sync_active_session(None, user=user)
		return {
			"status": "success",
			"message": f"Stopped session and logged {elapsed_hours} hour(s) for {user}.",
			"log_result": res
		}

	elif action == "discard":
		# Nothing of it is saved. The assistant asks the person first, naming the session.
		active = get_active_session(user)
		if not active or active.get("status") != "active":
			frappe.throw(_("Nothing to discard: no session is running."), frappe.ValidationError)
		start_ms = active.get("startTime", 0)
		elapsed = int((datetime.now().timestamp() * 1000 - start_ms) / 1000) if start_ms else 0
		sync_active_session(None, user=user)
		return {
			"status": "success",
			"message": f"Discarded the running session for {user}; nothing of it was saved.",
			"discarded": {
				"block_name": active.get("trackerBlockName"),
				"title": active.get("trackerNotes"),
				"log_lines": list(active.get("sessionNotesList") or []),
				"elapsed_seconds": max(0, elapsed),
			},
		}

	elif action in ("add_line", "add_note"):
		active = get_active_session(user)
		if not active or active.get("status") != "active":
			frappe.throw(_("No active session running to append notes to."))
		new_line = str(notes or "").strip()
		min_chars = get_min_log_line_chars()
		if len(new_line) < min_chars:
			frappe.throw(_("Not added. A log line says what was done in at least {0} characters.").format(min_chars), frappe.ValidationError)
		lines = list(active.get("sessionNotesList") or [])
		if new_line not in lines:
			lines.append(new_line)
		# A line joins the log; the title stays. Stamped newest, so no page holding an older copy
		# of the log writes over it (keep_newer_lines).
		active["sessionNotesList"] = lines
		active["linesRev"] = int(datetime.now().timestamp() * 1000)
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
def start_timer(block_name=None, notes=None, project=None, task=None, nature="Work", start_time=None, start_time_epoch_ms=None, employee=None):
	"""Starts an active live stopwatch session for the target user (defaults to human operator).
	The live stopwatch immediately begins ticking in the OmniTrack workstation UI across all devices.
	Supports optional retroactive start_time (HH:MM:SS) or start_time_epoch_ms for on-time alignment.
	"""
	return quick_timer_action(
		action="start",
		block_name=block_name,
		notes=notes,
		project=project,
		task=task,
		nature=nature,
		start_time=start_time,
		start_time_epoch_ms=start_time_epoch_ms,
		employee=employee
	)


@frappe.whitelist()
def stop_timer(notes=None, block_name=None, project=None, task=None, employee=None):
	"""Stops the active live stopwatch session, calculates elapsed time, logs the actual worked session
	into the Planned Work Block and ERPNext Timesheet, and resets the workstation stopwatch to 00:00:00.
	Saved as the page saves it: the session's title and log lines, then notes as the last line, in
	at least Minimum Words per Session words (default 15). Refused, the session keeps running.
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
	"""Throws the running session away: nothing of it is saved. Ask the person first, naming it."""
	return quick_timer_action(action="discard", employee=employee)


@frappe.whitelist()
def get_timer_status(employee=None):
	"""Checks whether a stopwatch session is currently running for the user, returning elapsed time and active task/block."""
	return quick_timer_action(action="status", employee=employee)


@frappe.whitelist()
def switch_timer(target_block=None, target_task=None, target_project=None, target_nature=None, current_session_notes=None, employee=None):
	"""Ends the running session and starts the next work in one step, as the page's Switch does.
	The session that ends is saved with its title and log lines, then current_session_notes as
	the last line, in at least Minimum Words per Session words. Refused, it keeps running.
	"""
	from omnitrack.api import switch_active_session
	if not (target_block or target_task):
		frappe.throw(_("Not switched. Say what comes next: a block (target_block) or a task (target_task)."), frappe.ValidationError)
	user = _resolve_planner_user(employee)
	active = get_active_session(user) or {}
	running = active.get("status") == "active"
	return switch_active_session(
		target_block=target_block,
		target_task=target_task,
		target_project=target_project,
		target_nature=target_nature,
		# Only what was sent here was once saved, and the session's own log was lost
		current_session_notes=compose_wrap_note(active.get("trackerNotes"), active.get("sessionNotesList"), current_session_notes) if running else current_session_notes,
		session_tasks=json.dumps(active.get("sessionTasks") or []) if running else None,
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
	"""Adjusts a previously logged work session's time, duration, or notes, and amends the linked
	ERPNext Timesheet. The session stays on its own day unless session_date moves it; the day it is
	on and the day it moves to must both be in the log window and after payroll_closed_through.
	"""
	from omnitrack.api import update_work_session as api_update_work_session
	_resolve_planner_user(employee)
	if notes:
		notes = _require_session_notes(notes)
	# No session_date keeps the session's day. It once defaulted to today, and an edit to an
	# old entry's notes moved it to today. The api checks both days against the window.
	return api_update_work_session(
		session_name=session_name,
		block_name=block_name,
		from_time=from_time,
		to_time=to_time,
		hours=flt(hours) if hours is not None else None,
		session_date=session_date or None,
		notes=notes
	)


@frappe.whitelist()
def delete_work_session(session_name, block_name, employee=None):
	"""Deletes a logged work session from a Planned Work Block; its hours come off the block and
	the linked ERPNext Timesheet is amended. Ask the person first, naming the entry (its day, times
	and notes). Controlled by OmniTrack Settings > allow_session_deletion (always allowed for
	managers); the session's day must be in the log window and after payroll_closed_through.
	"""
	from omnitrack.permissions import check_session_deletion_permission
	check_session_deletion_permission(frappe.session.user)
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


@frappe.whitelist()
def update_work_block(
	block_name,
	work_date=None,
	start_time=None,
	end_time=None,
	task=None,
	project=None,
	deliverable_notes=None,
	status=None,
	cancel_reason=None,
	employee=None,
	cancel_note=None
):
	"""Domain-governed update of an existing Planned Work Block. Cancelling needs a cancel_reason
	from cancel_work_block_reasons(); cancel_note, the person's own words, goes on its activity."""
	from omnitrack.api.planner import update_work_block as api_update_work_block
	user = _resolve_planner_user(employee)
	if block_name and frappe.db.exists("Planned Work Block", block_name):
		block_emp = frappe.db.get_value("Planned Work Block", block_name, "employee")
		if employee and block_emp != user and not is_omnitrack_manager():
			frappe.throw(_("Not permitted to edit this work block."), frappe.PermissionError)

	return api_update_work_block(
		block_name=block_name,
		work_date=work_date,
		start_time=start_time,
		end_time=end_time,
		task=task,
		project=project,
		deliverable_notes=deliverable_notes,
		status=status,
		cancel_reason=cancel_reason,
		cancel_note=cancel_note
	)


def cancel_work_block_reasons():
	"""The reasons a block can be cancelled for (Planned Work Block.cancel_reason's options)."""
	from omnitrack.api.planner import cancel_reasons
	return cancel_reasons()


@frappe.whitelist()
def cancel_work_block(block_name, cancel_reason=None, cancel_note=None, employee=None):
	"""Cancels a planned block, as the page's "Cancel this block?" does. The reason is the
	person's to pick: ask them, never pick one for them. Refused for a block in the past, one
	already cancelled or rescheduled, and one a session is recording on (stop or switch first).
	Ask the person first, naming the block."""
	if not block_name:
		frappe.throw(_("Not cancelled. Say which block (block_name)."), frappe.ValidationError)
	res = update_work_block(
		block_name=block_name,
		status="Cancelled",
		cancel_reason=cancel_reason,
		cancel_note=cancel_note,
		employee=employee
	)
	return {"status": "success", "message": f"Cancelled block {block_name} ({cancel_reason}).", "block": res}


@frappe.whitelist()
def get_work_block(block_name, employee=None):
	"""Fetches a single Planned Work Block with its child sessions, metrics, and progress."""
	if not block_name or not frappe.db.exists("Planned Work Block", block_name):
		frappe.throw(_("Planned Work Block {0} not found.").format(block_name))

	doc = frappe.get_doc("Planned Work Block", block_name)
	user = _resolve_planner_user(employee)
	if doc.employee != user and not is_omnitrack_manager():
		frappe.throw(_("Not permitted to view this work block."), frappe.PermissionError)

	return {
		"status": "success",
		"block": {
			"name": doc.name,
			"employee": doc.employee,
			"associate_name": doc.associate_name,
			"work_date": str(doc.work_date or ""),
			"start_time": _time_str(doc.start_time),
			"end_time": _time_str(doc.end_time),
			"duration_hours": flt(doc.duration_hours),
			"actual_hours": flt(doc.actual_hours),
			"variance_hours": flt(doc.variance_hours),
			"status": doc.status,
			"task_nature": doc.task_nature,
			"project": doc.project,
			"task": doc.task,
			"work_item_label": doc.work_item_label,
			"deliverable_notes": doc.deliverable_notes,
			"timesheet": doc.timesheet,
			"sessions": [
				{
					"name": s.name,
					"session_date": str(s.session_date or ""),
					"from_time": _time_str(s.from_time),
					"to_time": _time_str(s.to_time),
					"hours": flt(s.hours),
					"notes": s.notes,
					"logged_via": s.logged_via,
					"task_nature": s.task_nature,
				}
				for s in (doc.sessions or [])
			],
			"output_metrics": [
				{
					"metric_type": m.metric_type,
					"quantity": flt(m.quantity),
					"unit": m.unit,
					"reference_id": m.reference_id,
					"notes": m.notes,
				}
				for m in (getattr(doc, "output_metrics", []) or [])
			]
		}
	}


# ==============================================================================
# 8. CONSOLIDATED POLYMORPHIC DISPATCHERS (SESSION, SCHEDULE, WORKSPACE)
# ==============================================================================

@frappe.whitelist()
def omnitrack_session(
	action,
	block_name=None,
	notes=None,
	project=None,
	task=None,
	hours=None,
	from_time=None,
	to_time=None,
	session_date=None,
	session_name=None,
	target_block=None,
	nature="Work",
	start_time=None,
	employee=None
):
	"""Unified controller for live stopwatch timers and logged Work Sessions.

	Actions:
	  - 'start': Starts a session on a block or task; refused while one is running.
	  - 'stop': Saves the running session: its title, log lines and notes as the last line.
	  - 'status': The running session, its elapsed seconds and block.
	  - 'discard': Throws the running session away, nothing saved. Ask the person first.
	  - 'add_note': Adds a log line to the running session.
	  - 'switch': Saves the running session and starts the next work (target_block or task).
	  - 'log': Records finished work: hours or from_time/to_time, nothing assumed.
	  - 'adjust': Changes a logged session's time or notes; it keeps its day unless session_date moves it.
	  - 'delete': Deletes a logged session. Ask the person first, naming the entry.
	Every date is checked against the log window and the payroll lock (get_log_rules).
	"""
	act = str(action or "").lower().strip()
	if act in ("start", "stop", "discard", "status", "add_line", "add_note"):
		return quick_timer_action(
			action=act,
			task=task,
			project=project,
			notes=notes,
			block_name=block_name,
			nature=nature,
			start_time=start_time,
			employee=employee
		)
	elif act == "switch":
		return switch_timer(
			target_block=target_block or block_name,
			target_task=task,
			target_project=project,
			target_nature=nature,
			current_session_notes=notes,
			employee=employee
		)
	elif act == "log":
		return log_work_session(
			hours=hours,
			from_time=from_time,
			to_time=to_time,
			task=task,
			project=project,
			block_name=block_name,
			notes=notes,
			session_date=session_date,
			task_nature=nature,
			employee=employee
		)
	elif act == "adjust":
		return adjust_work_session(
			session_name=session_name,
			block_name=block_name,
			from_time=from_time,
			to_time=to_time,
			hours=hours,
			session_date=session_date,
			notes=notes,
			employee=employee
		)
	elif act == "delete":
		return delete_work_session(
			session_name=session_name,
			block_name=block_name,
			employee=employee
		)
	else:
		frappe.throw(_("Invalid omnitrack_session action '{0}'. Choose 'start', 'stop', 'status', 'discard', 'add_note', 'switch', 'log', 'adjust', or 'delete'.").format(action))


@frappe.whitelist()
def omnitrack_schedule(
	action,
	blocks=None,
	block_name=None,
	new_date=None,
	new_start_time=None,
	new_end_time=None,
	extend_minutes=30,
	work_date=None,
	employee=None,
	block_names=None,
	comments=None,
	cancel_reason=None,
	cancel_note=None
):
	"""Unified controller for pre-scheduled commitments and block governance.

	Actions:
	  - 'plan': Batch schedules planned work blocks for a day (immutable in the past).
	  - 'reschedule': Moves an unworked/unfinished block to a new date and time slot.
	  - 'extend': Extends the scheduled duration of the user's active block by N minutes.
	  - 'approve': Manager or HR approval for employee work blocks.
	  - 'update': Modifies an existing Planned Work Block's schedule, notes, or status.
	  - 'get_block': Fetches single block details with sessions and adherence.
	  - 'cancel': Cancels a block for the person's own cancel_reason, with an optional cancel_note.
	    Ask them first, naming the block; never pick the reason for them.
	"""
	act = str(action or "").lower().strip()
	if act == "plan":
		return plan_work_blocks(blocks=blocks, work_date=work_date, employee=employee)
	elif act == "reschedule":
		return reschedule_block(
			block_name=block_name,
			new_date=new_date,
			new_start_time=new_start_time,
			new_end_time=new_end_time,
			employee=employee
		)
	elif act == "extend":
		return extend_active_block(extend_minutes=extend_minutes, employee=employee)
	elif act == "approve":
		return approve_work_blocks(
			block_names=block_names or ([block_name] if block_name else None),
			employee=employee,
			work_date=work_date,
			comments=comments
		)
	elif act == "update":
		return update_work_block(
			block_name=block_name,
			work_date=new_date or work_date,
			start_time=new_start_time,
			end_time=new_end_time,
			deliverable_notes=comments,
			employee=employee
		)
	elif act in ("get_block", "get"):
		return get_work_block(block_name=block_name, employee=employee)
	elif act == "cancel":
		return cancel_work_block(
			block_name=block_name,
			cancel_reason=cancel_reason,
			cancel_note=cancel_note,
			employee=employee
		)
	else:
		frappe.throw(_("Invalid omnitrack_schedule action '{0}'. Choose 'plan', 'reschedule', 'extend', 'approve', 'update', 'get_block', or 'cancel'.").format(action))


@frappe.whitelist()
def omnitrack_workspace(
	action,
	employee=None,
	work_date=None,
	status=None,
	subject=None,
	project=None,
	priority="Medium",
	expected_time=0.0,
	description=None,
	book_block=False,
	block_start=None,
	block_end=None,
	doctype=None,
	docname=None,
	workflow_action=None,
	comment=None,
	block_name=None,
	task_refs=None,
	new_task_subjects=None,
	task_ref=None,
	completed=True,
	from_date=None,
	to_date=None
):
	"""Unified controller for workstation state, tasks, checklists, and analytics.

	Actions:
	  - 'get_workspace': Retrieves live workstation data (timer HUD, today's schedule, summary)
	    and log_rules: the log window, the payroll lock and the note minimums.
	  - 'get_tasks': Retrieves assigned tasks and ToDos categorized by attention level.
	  - 'quick_create_task': Creates an ERPNext Task (or ToDo) and assigns to employee.
	  - 'task_workflow': Executes task status transition ('Start Work', 'Close Task', etc.).
	  - 'attach_tasks': Attaches task references or new checklist items to a block.
	  - 'complete_task': Marks a block checklist item completed or pending.
	  - 'analytics': Computes Plan Adherence Index (PAI) and Plan vs Actual hours.
	  - 'eod_reconcile': Audits the day against an 8-hour day and lists blocks with no notes.
	"""
	act = str(action or "").lower().strip()
	if act in ("get_workspace", "workspace"):
		return get_my_workspace(employee=employee, work_date=work_date)
	elif act in ("get_tasks", "tasks"):
		return get_assigned_tasks_data(employee=employee, status=status)
	elif act in ("quick_create_task", "create_task"):
		return quick_create_task(
			subject=subject,
			project=project,
			priority=priority,
			expected_time=expected_time,
			description=description,
			book_block=book_block,
			block_start=block_start,
			block_end=block_end,
			work_date=work_date,
			employee=employee
		)
	elif act in ("task_workflow", "workflow"):
		return execute_task_workflow(
			doctype=doctype or "Task",
			docname=docname,
			action=workflow_action,
			comment=comment
		)
	elif act == "attach_tasks":
		return attach_tasks_to_block_action(
			block_name=block_name,
			task_refs=task_refs,
			new_task_subjects=new_task_subjects
		)
	elif act == "complete_task":
		return complete_block_task_action(
			block_name=block_name,
			task_ref=task_ref,
			completed=completed
		)
	elif act in ("analytics", "plan_vs_actual"):
		return get_plan_vs_actual_analytics(
			employee=employee,
			from_date=from_date,
			to_date=to_date
		)
	elif act in ("eod_reconcile", "reconciliation"):
		return get_eod_reconciliation(
			work_date=work_date,
			employee=employee
		)
	else:
		frappe.throw(_("Invalid omnitrack_workspace action '{0}'. Choose 'get_workspace', 'get_tasks', 'quick_create_task', 'task_workflow', 'attach_tasks', 'complete_task', 'analytics', or 'eod_reconcile'.").format(action))
# 8. MCP TOOL DEFINITIONS & BASETOOL SUBCLASSES FOR FRAPPE ASSISTANT CORE
# ==============================================================================

def _cancel_reasons_from_doctype():
	"""Planned Work Block.cancel_reason's options, read from its DocType file: the tool schemas
	are built at import, before any site is connected, so frappe.get_meta is not an option."""
	import json
	import os
	path = os.path.join(os.path.dirname(__file__), "omnitrack", "doctype", "planned_work_block", "planned_work_block.json")
	with open(path) as f:
		field = next((x for x in json.load(f)["fields"] if x["fieldname"] == "cancel_reason"), {})
	return [o for o in str(field.get("options") or "").split("\n") if o.strip()]


CANCEL_REASONS = _cancel_reasons_from_doctype()

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
							"start_time": {"type": "string", "description": "A time, e.g. '09:00', or a date and time, e.g. '2026-10-08 09:00'. A date here sets the day when work_date is omitted, and must match work_date when it is given."},
							"end_time": {"type": "string", "description": "e.g. '11:00'. A date here must be start_time's day (or the next day, for a block past midnight)."},
							"task": {"type": "string", "description": "ERPNext Task ID (e.g. TASK-2026-001). The block's employee is added to the task's assignees if they are not on it yet (its other assignees stay); added_to_tasks in the result lists them."},
							"project": {"type": "string", "description": "Project ID"},
							"deliverable_notes": {"type": "string", "description": "What will be accomplished"},
							"task_nature": {"type": "string", "description": "The activity: 'Work', 'Break' or 'Away'."}
						}
					}
				},
				"work_date": {
					"type": "string",
					"description": "Work date (YYYY-MM-DD). Defaults to the date in start_time, else today."
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
		self.description = (
			"Records a real work session against a planned block, or auto-books and logs time into an ERPNext Timesheet. "
			"Notes are mandatory (at least 15 words by default; configured via OmniTrack Settings). "
			"An employee logs on the last log_days_back days (OmniTrack Settings, default 15, today is day 1); a manager on any day; nobody on or before payroll_closed_through (get_workspace returns log_rules.can_log_from). "
			"Nothing is assumed: ask the person how long (hours, or from_time and to_time) and, for time not on a block, when it started. "
			"Format notes with deliverable context, bulleted accomplishments, and meaningful progress suitable for billing, audit, and operational tracking across any organization."
		)
		self.category = "OmniTrack"
		self.source_app = "omnitrack"
		self.inputSchema = {
			"type": "object",
			"required": ["notes"],
			"properties": {
				"notes": {
					"type": "string",
					"description": "Mandatory structured description of work completed (minimum words configured in OmniTrack Settings, default: 15 words; include workstream context and key deliverables)."
				},
				"hours": {
					"type": "number",
					"description": "Duration in hours (e.g. 1.25). Required unless from_time and to_time are given; never assumed."
				},
				"from_time": {
					"type": "string",
					"description": "Start time (HH:MM:SS). Required when no block_name is given and no block matches task or project."
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
					"description": "Specific Planned Work Block ID (e.g. PWB-2026-00012). Without it, the day's block for task or project, else a new block."
				},
				"session_date": {
					"type": "string",
					"description": "Date of work (YYYY-MM-DD), inside the log window. Defaults to today."
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
					"description": "If true, also plans a block for this task; needs block_start, and block_end or expected_time."
				},
				"block_start": {
					"type": "string",
					"description": "Start time of the booked block (HH:MM, or 'YYYY-MM-DD HH:MM'). Ask the person; never assumed."
				},
				"block_end": {
					"type": "string",
					"description": "End time of the booked block. When omitted, block_start plus expected_time."
				},
				"work_date": {
					"type": "string",
					"description": "Day of the booked block (YYYY-MM-DD). Defaults to today."
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
		self.description = (
			"Controls the person's running session: 'start' (refused while one runs: stop or switch), 'stop' (saves the title, every log line and notes as the last line, at least 15 words by default; refused, it keeps running), "
			"'discard' (throws it away unsaved: ask the person first, naming it), 'status', 'add_note' (one log line)."
		)
		self.category = "OmniTrack"
		self.source_app = "omnitrack"
		self.inputSchema = {
			"type": "object",
			"required": ["action"],
			"properties": {
				"action": {
					"type": "string",
					"enum": ["start", "stop", "discard", "status", "add_note"],
					"description": "'start', 'stop', 'discard' (only after the person says yes), 'status', 'add_note'."
				},
				"notes": {
					"type": "string",
					"description": "'start': its title. 'stop': the last line of its log, in the person's words. 'add_note': the line."
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
					"description": "The activity: 'Work', 'Break' or 'Away'."
				},
				"work_date": {
					"type": "string",
					"description": "Target work date (YYYY-MM-DD). Defaults to today."
				},
				"session_date": {
					"type": "string",
					"description": "Alias for work_date."
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
		self.description = "Starts a live running session for the person; it ticks at once in the OmniTrack workstation on every device. Refused while a session runs: stop it, or switch."
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
					"description": "The activity: 'Work', 'Break' or 'Away'. Defaults to 'Work'."
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
		self.description = (
			"Stops the active live stopwatch session, calculates elapsed time, logs the actual worked session into the Planned Work Block and ERPNext Timesheet, and resets the workstation stopwatch to 00:00:00. "
			"It is saved as the page saves it: its title, every line logged during it, then notes as the last line, together at least Minimum Words per Session words (default 15) in the person's own words. "
			"Refused, the session keeps running and nothing is lost."
		)
		self.category = "OmniTrack"
		self.source_app = "omnitrack"
		self.inputSchema = {
			"type": "object",
			"properties": {
				"notes": {
					"type": "string",
					"description": "The last line of the session's log: what got done, in the person's words. Its existing log lines are kept."
				},
				"block_name": {
					"type": "string",
					"description": "Block to save it on when the session is not recording on one."
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
		self.description = "Throws the running session away; nothing of it is saved. Ask the person first, naming the session and how long it has run, and call only after their yes."
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
		self.description = "Audits the employee's day: total logged hours against an 8-hour day, blocks with logged time but no notes, and planning gaps."
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
		self.description = (
			"Ends the running session and starts the next work in one step, as the page's Switch does. Needs target_block or target_task. "
			"The session that ends is saved with its title and log lines, then current_session_notes as the last line, together at least 15 words by default in the person's words. Refused, it keeps running and nothing starts."
		)
		self.category = "OmniTrack"
		self.source_app = "omnitrack"
		self.inputSchema = {
			"type": "object",
			"properties": {
				"target_block": {"type": "string", "description": "Target Planned Work Block ID to switch to."},
				"target_task": {"type": "string", "description": "Target Task ID to switch to."},
				"target_project": {"type": "string", "description": "Target Project ID."},
				"target_nature": {"type": "string", "description": "The activity: 'Work', 'Break' or 'Away'."},
				"current_session_notes": {"type": "string", "description": "The last line of the ending session's log: what got done, in the person's words. Its log lines are kept."},
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
		self.description = (
			"Adjusts a logged work session's time, duration or notes; recalculates block totals and amends the linked ERPNext Timesheet. "
			"The session keeps its day unless session_date moves it. Both days must be in the log window: an employee's last log_days_back days (default 15, today is day 1), a manager any day, nobody on or before payroll_closed_through."
		)
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
				"session_date": {"type": "string", "description": "Only to move it to another day (YYYY-MM-DD); omit to keep its day."},
				"notes": {"type": "string", "description": "Its notes in full, in the person's words (at least 15 words by default)."},
				"employee": {"type": "string", "description": "Target employee email (defaults to current human user)."}
			}
		}

	def execute(self, arguments: dict):
		return adjust_work_session(**arguments)


class OmniTrackDeleteWorkSessionTool(BaseTool):
	def __init__(self):
		super().__init__()
		self.name = "omnitrack_delete_work_session"
		self.description = (
			"Deletes a logged work session from a Planned Work Block; its hours come off the block and the linked ERPNext Timesheet is amended. "
			"Ask the person first, naming the entry (its day, times and notes), and call only after their yes. "
			"Governed by OmniTrack Settings > allow_session_deletion (managers always may) and the log window: the entry's day must be within log_days_back for an employee and after payroll_closed_through for everyone."
		)
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


class OmniTrackUpdateWorkBlockTool(BaseTool):
	def __init__(self):
		super().__init__()
		self.name = "omnitrack_update_work_block"
		self.description = (
			"Updates a Planned Work Block's schedule (start_time, end_time, work_date), deliverable notes or status. "
			"To cancel, prefer omnitrack_cancel_work_block: it needs the person's cancel_reason, and it is refused for a block in the past or one a session is recording on."
		)
		self.category = "OmniTrack"
		self.source_app = "omnitrack"
		self.inputSchema = {
			"type": "object",
			"required": ["block_name"],
			"properties": {
				"block_name": {"type": "string", "description": "Planned Work Block ID to update (e.g. 'PWB-2026-12446')."},
				"work_date": {"type": "string", "description": "Target work date (YYYY-MM-DD)."},
				"start_time": {"type": "string", "description": "Start time (HH:MM:SS)."},
				"end_time": {"type": "string", "description": "End time (HH:MM:SS)."},
				"task": {"type": "string", "description": "ERPNext Task ID."},
				"project": {"type": "string", "description": "ERPNext Project ID."},
				"deliverable_notes": {"type": "string", "description": "Updated deliverable notes describing the block's focus."},
				"status": {"type": "string", "description": "Block status ('Planned', 'In Progress', 'Completed', 'Logged (Full)', 'Cancelled')."},
				"cancel_reason": {"type": "string", "enum": CANCEL_REASONS, "description": "Why it is cancelled, the person's pick (required with status 'Cancelled'). Ask; never pick one."},
				"cancel_note": {"type": "string", "description": "Optional, the person's own words; goes on the block's activity."},
				"employee": {"type": "string", "description": "Target employee email (defaults to current human user)."}
			}
		}

	def execute(self, arguments: dict):
		return update_work_block(**arguments)


class OmniTrackCancelWorkBlockTool(BaseTool):
	def __init__(self):
		super().__init__()
		self.name = "omnitrack_cancel_work_block"
		self.description = (
			"Cancels a planned block, as the page's \"Cancel this block?\" does. Ask the person first, naming the block, "
			"and ask why: cancel_reason is theirs to pick, never pick one for them. "
			"Refused for a block in the past (it is recorded as Missed), one already cancelled or rescheduled, and one a session is recording on (stop or switch first). "
			"A refusal changes nothing; say why to the person."
		)
		self.category = "OmniTrack"
		self.source_app = "omnitrack"
		self.inputSchema = {
			"type": "object",
			"required": ["block_name", "cancel_reason"],
			"properties": {
				"block_name": {"type": "string", "description": "Planned Work Block ID to cancel (e.g. 'PWB-2026-12446')."},
				"cancel_reason": {"type": "string", "enum": CANCEL_REASONS, "description": "Why it is cancelled, in the person's words mapped to one of these."},
				"cancel_note": {"type": "string", "description": "Optional, the person's own words; goes on the block's activity."},
				"employee": {"type": "string", "description": "Target employee email (defaults to current human user)."}
			}
		}

	def execute(self, arguments: dict):
		return cancel_work_block(**arguments)


class OmniTrackGetWorkBlockTool(BaseTool):
	def __init__(self):
		super().__init__()
		self.name = "omnitrack_get_work_block"
		self.description = "Retrieves full details for a single Planned Work Block, including child session rows, output metrics, variance, and status."
		self.category = "OmniTrack"
		self.source_app = "omnitrack"
		self.inputSchema = {
			"type": "object",
			"required": ["block_name"],
			"properties": {
				"block_name": {"type": "string", "description": "Planned Work Block ID to fetch (e.g. 'PWB-2026-12446')."},
				"employee": {"type": "string", "description": "Target employee email (defaults to current human user)."}
			}
		}

	def execute(self, arguments: dict):
		return get_work_block(**arguments)


class OmniTrackSessionTool(BaseTool):
	def __init__(self):
		super().__init__()
		self.name = "omnitrack_session"
		self.description = (
			"Unified tracker for live stopwatch sessions and logged Work Sessions. "
			"Actions: 'start' (starts a session; refused while one runs), 'stop' (saves the running session: title, log lines, then notes as the last line), "
			"'status' (the running session), 'discard' (throws it away unsaved: ask the person first), "
			"'add_note' (adds a log line), 'switch' (saves the running session and starts target_block or task), "
			"'log' (records finished work: hours or from_time/to_time; nothing is assumed), 'adjust' (a logged session's time or notes; it keeps its day unless session_date moves it), "
			"'delete' (a logged session, per OmniTrack Settings > allow_session_deletion: ask the person first, naming the entry). "
			"Dates: an employee's last log_days_back days (default 15, today is day 1), a manager any day, nobody on or before payroll_closed_through. "
			"Notes are the person's own words: at least 15 words per session and 10 characters per log line by default (log_rules). Never invent them; a refusal saves nothing, say why to the person."
		)
		self.category = "OmniTrack"
		self.source_app = "omnitrack"
		self.inputSchema = {
			"type": "object",
			"required": ["action"],
			"properties": {
				"action": {
					"type": "string",
					"enum": ["start", "stop", "status", "discard", "add_note", "switch", "log", "adjust", "delete"],
					"description": "Session or stopwatch operation to execute."
				},
				"notes": {
					"type": "string",
					"description": (
						"Audit-ready accomplishment notes (required for 'stop', 'add_note', 'log'). "
						"Format professionally for any industry: include workstream/client context, concise bulleted deliverables "
						"or milestones accomplished, and outcomes (minimum 15 words by default; configured in OmniTrack Settings)."
					)
				},
				"block_name": {"type": "string", "description": "Target Planned Work Block ID (e.g. PWB-2026-12440)."},
				"project": {"type": "string", "description": "ERPNext Project ID."},
				"task": {"type": "string", "description": "ERPNext Task ID."},
				"hours": {"type": "number", "description": "Duration in decimal hours (e.g. 1.25, 2.5, 4.0; for manual log or adjustment)."},
				"from_time": {"type": "string", "description": "Start time (HH:MM:SS)."},
				"to_time": {"type": "string", "description": "End time (HH:MM:SS)."},
				"session_date": {"type": "string", "description": "Date of work (YYYY-MM-DD) for 'log'; for 'adjust' only to move it to another day."},
				"session_name": {"type": "string", "description": "Child session row ID (for 'adjust' or 'delete')."},
				"start_time": {"type": "string", "description": "For 'start': when it began (HH:MM:SS), if earlier than now."},
				"target_block": {"type": "string", "description": "New target block ID (for 'switch' action)."},
				"nature": {"type": "string", "description": "The activity: 'Work', 'Break' or 'Away' (default 'Work')."},
				"employee": {"type": "string", "description": "Target employee email (defaults to current user)."}
			}
		}

	def execute(self, arguments: dict):
		return omnitrack_session(**arguments)


class OmniTrackScheduleTool(BaseTool):
	def __init__(self):
		super().__init__()
		self.name = "omnitrack_schedule"
		self.description = (
			"Manages Planned Work Blocks and commitments. "
			"Actions: 'plan' (batch schedules work blocks for a day), 'reschedule' (moves unworked block to a new date/time), "
			"'extend' (extends scheduled end of active block by minutes), 'approve' (manager approval for employee blocks), "
			"'update' (a block's date, times or deliverable notes), 'get_block' (one block with its sessions), "
			"'cancel' (cancels a block for the person's cancel_reason: ask them first, naming the block, and never pick the reason; "
			"refused for a past block, one already cancelled, or one a session is recording on)."
		)
		self.category = "OmniTrack"
		self.source_app = "omnitrack"
		self.inputSchema = {
			"type": "object",
			"required": ["action"],
			"properties": {
				"action": {
					"type": "string",
					"enum": ["plan", "reschedule", "extend", "approve", "update", "get_block", "cancel"],
					"description": "Scheduling operation to execute."
				},
				"blocks": {"type": "array", "description": "List of block objects with start_time, end_time, project, task, deliverable_notes."},
				"block_name": {"type": "string", "description": "Target block ID to reschedule or extend."},
				"new_date": {"type": "string", "description": "Target date for reschedule (YYYY-MM-DD)."},
				"new_start_time": {"type": "string", "description": "New start time (HH:MM:SS)."},
				"new_end_time": {"type": "string", "description": "New end time (HH:MM:SS)."},
				"extend_minutes": {"type": "integer", "description": "Minutes to extend (default 30)."},
				"work_date": {"type": "string", "description": "Work date (YYYY-MM-DD)."},
				"block_names": {"type": "array", "items": {"type": "string"}, "description": "List of block IDs for approval."},
				"comments": {"type": "string", "description": "Manager review comments ('approve'), or the new deliverable notes ('update')."},
				"cancel_reason": {"type": "string", "enum": CANCEL_REASONS, "description": "For 'cancel': why, the person's pick."},
				"cancel_note": {"type": "string", "description": "For 'cancel': optional, the person's own words."},
				"employee": {"type": "string", "description": "Target employee email."}
			}
		}

	def execute(self, arguments: dict):
		return omnitrack_schedule(**arguments)


class OmniTrackWorkspaceTool(BaseTool):
	def __init__(self):
		super().__init__()
		self.name = "omnitrack_workspace"
		self.description = (
			"Reads workstation context, manages tasks, and inspects adherence. "
			"Actions: 'get_workspace' (fetches live workstation summary, active timer, today's schedule), "
			"'get_tasks' (retrieves assigned tasks & ToDos), 'quick_create_task' (creates and assigns a task/ToDo), "
			"'task_workflow' (transitions task state: 'Start Work', 'Close Task', etc.), "
			"'attach_tasks' (attaches task references or new checklist items to a block), "
			"'complete_task' (marks a checklist item completed or pending), "
			"'analytics' (computes Plan Adherence Index PAI and Plan vs Actual hours), "
			"'eod_reconcile' (end-of-day audit against an 8-hour day). "
			"get_workspace returns log_rules: the log window, payroll_closed_through and the note minimums. Read them before logging or adjusting."
		)
		self.category = "OmniTrack"
		self.source_app = "omnitrack"
		self.inputSchema = {
			"type": "object",
			"required": ["action"],
			"properties": {
				"action": {
					"type": "string",
					"enum": ["get_workspace", "get_tasks", "quick_create_task", "task_workflow", "attach_tasks", "complete_task", "analytics", "eod_reconcile"],
					"description": "Workspace operation to execute."
				},
				"subject": {"type": "string", "description": "Task title/summary (for quick_create_task)."},
				"project": {"type": "string", "description": "Project ID."},
				"priority": {"type": "string", "description": "Priority ('Low', 'Medium', 'High', 'Urgent')."},
				"expected_time": {"type": "number", "description": "Estimated hours."},
				"description": {"type": "string", "description": "Task description."},
				"book_block": {"type": "boolean", "description": "True to book a block for the task too; needs block_start and block_end (or expected_time)."},
				"block_start": {"type": "string", "description": "Start of the booked block (HH:MM:SS), as the person says; nothing is assumed."},
				"block_end": {"type": "string", "description": "End of the booked block (HH:MM:SS); else expected_time sets its length."},
				"doctype": {"type": "string", "description": "DocType ('Task' or 'ToDo')."},
				"docname": {"type": "string", "description": "Document ID for workflow transition."},
				"workflow_action": {"type": "string", "description": "State transition to apply (e.g. 'Start Work', 'Close Task')."},
				"block_name": {"type": "string", "description": "Planned Work Block ID for checklist attachment."},
				"task_refs": {"type": "array", "items": {"type": "string"}, "description": "List of task references to attach."},
				"new_task_subjects": {"type": "array", "items": {"type": "string"}, "description": "Checklist items to create."},
				"task_ref": {"type": "string", "description": "Checklist item reference to complete."},
				"completed": {"type": "boolean", "description": "True for completed, False for pending."},
				"from_date": {"type": "string", "description": "Analytics start date (YYYY-MM-DD)."},
				"to_date": {"type": "string", "description": "Analytics end date (YYYY-MM-DD)."},
				"work_date": {"type": "string", "description": "Target date (YYYY-MM-DD)."},
				"employee": {"type": "string", "description": "Target employee email."}
			}
		}

	def execute(self, arguments: dict):
		return omnitrack_workspace(**arguments)


def get_consolidated_fac_tools():
	"""Returns the 3 high-signal, token-efficient polymorphic tools."""
	classes = [
		OmniTrackSessionTool,
		OmniTrackScheduleTool,
		OmniTrackWorkspaceTool,
	]
	tools = []
	for cls in classes:
		inst = cls()
		tools.append({
			"name": inst.name,
			"description": inst.description,
			"inputSchema": inst.inputSchema,
			"handler": inst.execute,
		})
	return tools


def get_fac_tools(consolidated=True):
	"""Returns MCP tool definitions so Frappe Assistant Core and any MCP client
	can expose OmniTrack domain capabilities natively.
	"""
	if consolidated:
		return get_consolidated_fac_tools()

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
		OmniTrackUpdateWorkBlockTool,
		OmniTrackGetWorkBlockTool,
		OmniTrackCancelWorkBlockTool,
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


