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
	task_list = list(assigned_tasks.values()) if isinstance(assigned_tasks, dict) else []

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
	logged_via="AI Assistant"
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

	Returns:
		dict: Session result with updated block and timesheet details.
	"""
	notes = _require_session_notes(notes)
	target_user = frappe.session.user
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

	# Log session into the block
	from omnitrack.api import log_work_session as api_log_work_session
	api_log_work_session(
		block_name=target_block,
		from_time=from_time,
		to_time=to_time,
		hours=dur_hours,
		session_date=target_date,
		notes=notes,
		logged_via=logged_via
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
	work_date=None
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

	Returns:
		dict: Created task details and optional booked block name.
	"""
	if not subject or not str(subject).strip():
		frappe.throw(_("Task subject cannot be empty."))

	user = frappe.session.user
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
	nature="🎯 Planned"
):
	"""Controls live stopwatch session for the current user.

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

	Returns:
		dict: Action result.
	"""
	user = frappe.session.user
	action = str(action).lower().strip()

	if action == "status":
		active = get_active_session(user)
		if not active or active.get("status") != "active":
			return {"status": "idle", "session": None}
		start_ms = active.get("startTime", 0)
		elapsed = int((datetime.now().timestamp() * 1000 - start_ms) / 1000) if start_ms else 0
		return {
			"status": "running",
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
		sync_active_session(session_data)
		return {
			"status": "success",
			"message": "Session started.",
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
			logged_via="AI Assistant (Stopwatch)"
		)
		# Clear active session
		sync_active_session(None)
		return {
			"status": "success",
			"message": f"Stopped session and logged {elapsed_hours} hour(s).",
			"log_result": res
		}

	elif action == "discard":
		# Discard active session with zero timesheet creation
		sync_active_session(None)
		return {"status": "success", "message": "Active session discarded."}

	else:
		frappe.throw(_("Invalid timer action '{0}'. Choose 'start', 'stop', 'discard', or 'status'.").format(action))


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
# 7. MCP TOOL DEFINITIONS FOR FRACTIONLESS LLM CALLS
# ==============================================================================

def get_fac_tools():
	"""Returns MCP tool definitions so Frappe Assistant Core and any MCP client
	can expose OmniTrack domain capabilities natively.
	"""
	return [
		{
			"name": "omnitrack_get_my_workspace",
			"description": "Retrieves the employee's live workstation data: active stopwatch timer, today's planned work blocks, total actual hours logged, plan adherence, and assigned tasks.",
			"inputSchema": {
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
			},
			"handler": get_my_workspace
		},
		{
			"name": "omnitrack_plan_work_blocks",
			"description": "Batch schedules planned work blocks for a day (e.g. 'from 9am to 11am work on Task-01'). Cannot plan in the past (historical plans are immutable).",
			"inputSchema": {
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
			},
			"handler": plan_work_blocks
		},
		{
			"name": "omnitrack_log_work_session",
			"description": "Records a real work session against a planned block, or auto-books and logs time into an ERPNext Timesheet. Notes are mandatory (>= 3 chars). Users can only log for today & yesterday.",
			"inputSchema": {
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
					}
				}
			},
			"handler": log_work_session
		},
		{
			"name": "omnitrack_quick_create_task",
			"description": "Creates an ERPNext Task (or ToDo), assigns it to the current user, and optionally books a planned work block immediately.",
			"inputSchema": {
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
					}
				}
			},
			"handler": quick_create_task
		},
		{
			"name": "omnitrack_quick_timer_action",
			"description": "Controls live stopwatch session for the user ('start', 'stop', 'discard', 'status').",
			"inputSchema": {
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
					}
				}
			},
			"handler": quick_timer_action
		},
		{
			"name": "omnitrack_get_eod_reconciliation",
			"description": "Audits the employee's day: checks total logged hours vs 8h target, unallocated gaps, missing session notes, and temporal compliance.",
			"inputSchema": {
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
			},
			"handler": get_eod_reconciliation
		}
	]
