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
)


@frappe.whitelist()
def quick_timer_punch(action="stop", duration_seconds=0, project=None, task=None,
					  deliverable_notes=None, work_nature=None,
					  duration_hours=None, notes=None, task_nature=None,
					  from_time=None, to_time=None, work_date=None,
					  output_metrics=None, pairing_partner=None):
	"""
	Quick Stopwatch Punch API from Desktop / Mobile HUD / Workstation.
	Creates/Completes a Planned Work Block and triggers attendance synthesis.
	Supports adjusted and backdated start/end datetimes, quantitative output metrics,
	and collaborative pairing sessions with mirrored partner timesheets.
	"""
	user = frappe.session.user
	today = nowdate()
	target_date = work_date or today

	from omnitrack.permissions import check_timesheet_date_permission
	check_timesheet_date_permission(target_date, user)

	deliverable_notes = deliverable_notes or notes
	work_nature = work_nature or task_nature
	if work_nature:
		wn_lower = str(work_nature).lower()
		if "unplanned" in wn_lower:
			work_nature = "⚠️ Unplanned"
		elif "break" in wn_lower:
			work_nature = "☕ Break"
		elif "leave" in wn_lower:
			work_nature = "🌴 Leave"
		elif "absent" in wn_lower:
			work_nature = "🤒 Absent"
		elif "out-of-office" in wn_lower or "out of office" in wn_lower:
			work_nature = "🚫 Out-of-Office"
		elif "review" in wn_lower or "sync" in wn_lower:
			work_nature = "🔄 Review & Sync"
		elif "planned" in wn_lower:
			work_nature = "🎯 Planned"

	dur_secs = flt(duration_seconds)
	if dur_secs <= 0 and duration_hours is not None:
		dur_secs = flt(duration_hours) * 3600.0
	elif dur_secs <= 0 and from_time and to_time:
		dur_secs = _duration_hours(from_time, to_time) * 3600.0

	dur_hours = flt(duration_hours) if duration_hours is not None and flt(duration_hours) > 0 else (max(round(dur_secs / 3600.0, 2), 0.01) if dur_secs > 0 else 0.5)

	if action in ("stop", "punch_out", "save_block"):
		# Calculate start time
		from datetime import datetime, timedelta
		if from_time and to_time:
			start_t = _time_str(from_time)
			end_t = _time_str(to_time)
		else:
			now_dt = datetime.now()
			start_dt = now_dt - timedelta(seconds=max(dur_secs, 60))
			start_t = start_dt.strftime("%H:%M:%S")
			end_t = now_dt.strftime("%H:%M:%S")

		block = frappe.new_doc("Planned Work Block")
		block.employee = user
		block.work_date = target_date
		block.start_time = start_t
		block.end_time = end_t
		block.duration_hours = dur_hours
		block.actual_hours = dur_hours
		block.variance_hours = 0.0
		block.project = project
		block.task = task
		block.deliverable_notes = _require_session_notes(deliverable_notes)
		block.status = "Completed"
		block.task_nature = work_nature or "🎯 Planned"
		block.append("sessions", {
			"session_date": target_date,
			"from_time": start_t,
			"to_time": end_t,
			"hours": dur_hours,
			"notes": block.deliverable_notes,
			"logged_via": "Stopwatch",
			"task_nature": block.task_nature,
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
						block.append("output_metrics", {
							"metric_type": m.get("metric_type") or "Records Processed",
							"quantity": flt(m.get("quantity", 1.0)),
							"unit": m.get("unit") or "",
							"reference_id": m.get("reference_id") or "",
							"notes": m.get("notes") or ""
						})

		block.flags.ignore_permissions = True
		block.insert()

		# Auto-create Timesheet connected to Project if Timesheet DocType exists and sync_mode == "Immediate"
		ts_name = None
		if frappe.db.exists("DocType", "Timesheet") and get_timesheet_sync_mode() == "Immediate":
			try:
				ts_name = create_timesheet_from_work_block(block.name)
			except Exception:
				pass

		# Phase 5: Collaborative / Pairing Sessions - Mirrored Timesheet for Partner
		partner_block_name = None
		partner_ts_name = None
		if pairing_partner and pairing_partner != user and frappe.db.exists("User", pairing_partner):
			try:
				p_doc = frappe.new_doc("Planned Work Block")
				p_doc.employee = pairing_partner
				p_doc.work_date = target_date
				p_doc.start_time = start_t
				p_doc.end_time = end_t
				p_doc.duration_hours = dur_hours
				p_doc.actual_hours = dur_hours
				p_doc.variance_hours = 0.0
				p_doc.project = project
				p_doc.task = task
				p_doc.deliverable_notes = f"[Pairing with {user}]\n{block.deliverable_notes}"
				p_doc.status = "Completed"
				p_doc.task_nature = block.task_nature
				p_doc.append("sessions", {
					"session_date": target_date,
					"from_time": start_t,
					"to_time": end_t,
					"hours": dur_hours,
					"notes": f"[Pairing with {user}] {block.deliverable_notes}",
					"logged_via": "Stopwatch",
					"task_nature": block.task_nature,
				})
				if output_metrics and isinstance(output_metrics, list):
					for m in output_metrics:
						if isinstance(m, dict) and (m.get("quantity") or m.get("metric_type")):
							p_doc.append("output_metrics", {
								"metric_type": m.get("metric_type") or "Records Processed",
								"quantity": flt(m.get("quantity", 1.0)),
								"unit": m.get("unit") or "",
								"reference_id": m.get("reference_id") or "",
								"notes": m.get("notes") or ""
							})
				p_doc.flags.ignore_permissions = True
				p_doc.insert()
				partner_block_name = p_doc.name
				if frappe.db.exists("DocType", "Timesheet") and get_timesheet_sync_mode() == "Immediate":
					try:
						partner_ts_name = create_timesheet_from_work_block(p_doc.name)
					except Exception:
						pass
			except Exception as pe:
				frappe.log_error(f"Pairing timesheet creation failed for {pairing_partner}: {pe}", "OmniTrack")

		# Also log Employee Checkin if Employee exists
		emp = frappe.db.get_value("Employee", {"user_id": user}, "name") if frappe.db.exists("DocType", "Employee") else None
		if emp and frappe.db.exists("DocType", "Employee Checkin"):
			try:
				chk = frappe.new_doc("Employee Checkin")
				chk.employee = emp
				chk.time = now_datetime()
				chk.log_type = "OUT"
				chk.flags.ignore_permissions = True
				chk.insert()
			except Exception as e:
				frappe.log_error(f"Employee Checkin punch OUT failed: {e}", "OmniTrack")

		# Auto-clear any in-flight active session across devices
		try:
			sync_active_session(None)
		except Exception:
			pass
		frappe.db.commit()

		return {
			"status": "success",
			"message": f"Logged {dur_hours} hours for {user}",
			"block": block.name,
			"timesheet": ts_name or block.timesheet,
			"partner_block": partner_block_name,
			"partner_timesheet": partner_ts_name,
			"cryptographic_hash": block.cryptographic_hash
		}

	elif action in ("punch_in", "start"):
		now_dt = now_datetime()
		now_t = now_dt.strftime("%H:%M:%S")
		emp = frappe.db.get_value("Employee", {"user_id": user}, "name") if frappe.db.exists("DocType", "Employee") else None
		if emp and frappe.db.exists("DocType", "Employee Checkin"):
			try:
				chk = frappe.new_doc("Employee Checkin")
				chk.employee = emp
				chk.time = now_dt
				chk.log_type = "IN"
				chk.flags.ignore_permissions = True
				chk.insert()
			except Exception as e:
				frappe.log_error(f"Employee Checkin punch IN failed: {e}", "OmniTrack")
		frappe.db.commit()
		return {"status": "success", "message": "Punched IN at " + now_t}

	return {"status": "ignored"}


@frappe.whitelist(allow_guest=True)
def sync_active_session(session_data=None, user=None):
	"""
	Synchronizes the in-flight stopwatch session across devices (Desktop, Mobile PWA, Tablet).
	Persists to high-speed Redis cache and durable database storage (tabDefaultValue).
	"""
	target_user = user or _resolve_planner_user() or frappe.session.user
	if not target_user or target_user == "Guest":
		return {"status": "ignored", "reason": "Guest"}

	if isinstance(session_data, str):
		try:
			session_data = json.loads(session_data)
		except Exception:
			session_data = None

	# If session_data is empty or status is stopped/cleared, delete the active session
	if not session_data or session_data.get("status") in ("stopped", "cleared", "discarded"):
		frappe.cache.hdel("omnitrack:active_session", target_user)
		frappe.defaults.clear_default("omnitrack_active_session", parent=target_user)
		frappe.db.set_default("omnitrack_active_session", None, parent=target_user)
		frappe.db.sql(
			"DELETE FROM `tabDefaultValue` WHERE defkey = 'omnitrack_active_session' AND parent = %(user)s",
			{"user": target_user}
		)
		frappe.clear_cache(user=target_user)
		frappe.db.commit()
		try:
			frappe.publish_realtime("omnitrack:active_session_cleared", {"user": target_user}, user=target_user)
		except Exception:
			pass
		return {"status": "cleared"}

	# Normalize session fields
	now_ms = int(datetime.now().timestamp() * 1000)
	start_time = int(flt(session_data.get("startTime") or now_ms))
	raw_last_act = int(flt(session_data.get("lastActivityTime") or 0))
	raw_last_updated = int(flt(session_data.get("lastUpdated") or 0))

	# Invariant: If a session started early or was backdated, lastActivityTime must
	# reflect the most recent user action/edit, never older than lastUpdated or artificially
	# stuck at a backdated start_time.
	resolved_last_act = max(raw_last_act, raw_last_updated)
	if resolved_last_act <= 0 or (start_time < (now_ms - 60000) and resolved_last_act == start_time):
		resolved_last_act = now_ms

	clean_data = {
		"startTime": start_time,
		"selectedNature": session_data.get("selectedNature") or "🎯 Planned",
		"selectedProject": session_data.get("selectedProject") or "",
		"trackerNotes": (session_data.get("trackerNotes") or "").strip(),
		"trackerBlockName": session_data.get("trackerBlockName") or None,
		"sessionNotesList": session_data.get("sessionNotesList") if isinstance(session_data.get("sessionNotesList"), list) else [],
		"lastActivityTime": resolved_last_act,
		"lastUpdated": now_ms,
		"status": "active"
	}

	# 1. High-speed cache
	frappe.cache.hset("omnitrack:active_session", target_user, clean_data)

	# 2. Durable database persistence
	json_str = json.dumps(clean_data)
	frappe.db.set_default("omnitrack_active_session", json_str, parent=target_user)
	frappe.db.commit()

	try:
		frappe.publish_realtime("omnitrack:active_session_updated", clean_data, user=target_user)
	except Exception:
		pass

	return {"status": "success", "session": clean_data}


@frappe.whitelist()
def switch_active_session(target_block=None, target_task=None, target_project=None, target_nature=None, current_session_notes=None, previous_block=None, start_time_ms=None):
	"""
	Atomically switches the user's active running timesheet session to another Planned Work Block or Task.
	1. Closes the currently running session:
	   - Computes elapsed time from session startTime to now.
	   - Appends work session to current block with current_session_notes.
	   - Synchronizes linked Timesheet.
	2. Begins new session on target_block / target_task with startTime = now.
	3. Persists to Redis and tabDefaultValue, broadcasting omnitrack:active_session_updated.
	All within a single atomic database transaction.
	"""
	from omnitrack.api.timesheet import log_work_session
	target_user = _resolve_planner_user() or frappe.session.user
	if not target_user or target_user == "Guest":
		frappe.throw(_("Authentication required to switch active session."), frappe.PermissionError)

	now_dt = datetime.now()
	now_ms = int(now_dt.timestamp() * 1000)

	# 1. Close current active session if running
	prev_block_name = None
	elapsed_hours = 0.0
	active = get_active_session(user=target_user)
	if active and active.get("status") == "active":
		prev_block_name = active.get("trackerBlockName")
		start_ms = flt(active.get("startTime", 0))
	else:
		start_ms = 0.0

	if not prev_block_name and previous_block:
		prev_block_name = previous_block
	if start_ms <= 0 and start_time_ms:
		start_ms = flt(start_time_ms)

	if prev_block_name and frappe.db.exists("Planned Work Block", prev_block_name):
		if start_ms > 0:
			diff_secs = max(60, (now_ms - start_ms) / 1000.0)
			elapsed_hours = round(diff_secs / 3600.0, 2)
			start_dt = datetime.fromtimestamp(start_ms / 1000.0)
		else:
			elapsed_hours = 0.02
			start_dt = now_dt - timedelta(minutes=1)

		log_work_session(
			block_name=prev_block_name,
			from_time=start_dt.strftime("%H:%M:%S"),
			to_time=now_dt.strftime("%H:%M:%S"),
			hours=elapsed_hours,
			session_date=start_dt.strftime("%Y-%m-%d"),
			notes=current_session_notes or f"Session completed before switching to {target_block or target_task or 'next block'}",
			logged_via="Stopwatch"
		)

	# 2. Resolve target block or task metadata
	target_notes = ""
	if target_block and frappe.db.exists("Planned Work Block", target_block):
		b_doc = frappe.get_doc("Planned Work Block", target_block)
		target_project = getattr(b_doc, "project", None) or target_project
		target_nature = getattr(b_doc, "task_nature", None) or target_nature or "🎯 Planned"
		target_notes = b_doc.get("task_subject") or b_doc.get("deliverable_notes") or b_doc.get("work_item_label") or ""
	elif target_task and frappe.db.exists("Task", target_task):
		t_doc = frappe.get_doc("Task", target_task)
		target_project = getattr(t_doc, "project", None) or target_project
		target_nature = getattr(t_doc, "task_nature", None) or target_nature or "🎯 Planned"
		target_notes = t_doc.get("subject") or t_doc.get("title") or t_doc.name or ""

	# 3. Start fresh session for target block
	new_session_data = {
		"startTime": now_ms,
		"selectedNature": target_nature or "🎯 Planned",
		"selectedProject": target_project or "",
		"trackerNotes": target_notes or "",
		"trackerBlockName": target_block if target_block else None,
		"sessionNotesList": [],
		"lastActivityTime": now_ms,
		"lastUpdated": now_ms,
		"status": "active"
	}
	sync_res = sync_active_session(session_data=new_session_data, user=target_user)

	return {
		"status": "success",
		"previous_block": prev_block_name,
		"elapsed_hours": elapsed_hours,
		"switched_to": target_block or target_task or "new_session",
		"target_label": target_notes,
		"session": sync_res.get("session")
	}


@frappe.whitelist()
def heartbeat_active_session():
	"""
	Phase 4 Heartbeat Governor:
	Extends active running session heartbeat, updates lastActivityTime in Redis cache,
	and refreshes device presence telemetry.
	"""
	user = frappe.session.user
	if not user or user == "Guest":
		return {"status": "ignored"}
	active = get_active_session(user=user)
	if active and active.get("status") == "active":
		now_ms = int(datetime.now().timestamp() * 1000)
		active["lastActivityTime"] = now_ms
		active["lastUpdated"] = now_ms
		frappe.cache.hset("omnitrack:active_session", user, active)
		return {"status": "success", "lastActivityTime": now_ms}
	return {"status": "no_active_session"}


@frappe.whitelist()
def extend_active_block_duration(extend_minutes=30):
	"""
	Phase 4 Lock-Screen / Mobile Action:
	Extends the duration of the current active Planned Work Block by extend_minutes (default +30m).
	"""
	user = frappe.session.user
	if not user or user == "Guest":
		return {"status": "ignored"}
	active = get_active_session(user=user)
	if not active or not active.get("trackerBlockName"):
		return {"status": "no_active_block"}
	block_name = active["trackerBlockName"]
	if frappe.db.exists("Planned Work Block", block_name):
		doc = frappe.get_doc("Planned Work Block", block_name)
		if doc.employee != user and not _is_planner_manager():
			frappe.throw(_("Permission denied."), frappe.PermissionError)
		add_hours = round(flt(extend_minutes) / 60.0, 2)
		doc.duration_hours = flt(doc.duration_hours or 0.0) + add_hours
		if doc.end_time:
			try:
				dt_end = datetime.strptime(str(doc.end_time), "%H:%M:%S") + timedelta(minutes=int(extend_minutes))
				doc.end_time = dt_end.strftime("%H:%M:%S")
			except Exception:
				pass
		doc.flags.ignore_permissions = True
		doc.save()
		frappe.db.commit()
		return {"status": "success", "block": doc.name, "new_duration": doc.duration_hours, "end_time": str(doc.end_time)}
	return {"status": "block_not_found"}


@frappe.whitelist()
def log_catch_up_session(work_date=None, from_time=None, to_time=None, duration_hours=None,
						 project=None, task=None, deliverable_notes=None, task_nature=None,
						 output_metrics=None, pairing_partner=None, target_block=None):
	"""
	Phase 3 Retroactive Catch-Up Flow-State Time Entry:
	Safely records sessions when engineers dive directly into flow-state work before starting a timer.
	Strictly enforces temporal governance (today and yesterday only for standard users; earlier requires manager).
	"""
	from omnitrack.api.planner import create_planned_work_block, _duration_hours
	user = frappe.session.user
	if not user or user == "Guest":
		frappe.throw(_("Authentication required."), frappe.PermissionError)

	target_date = work_date or nowdate()
	from omnitrack.permissions import check_timesheet_date_permission
	check_timesheet_date_permission(target_date, user)

	deliverable_notes = _require_session_notes(deliverable_notes)

	dur_hours = flt(duration_hours)
	if dur_hours <= 0 and from_time and to_time:
		dur_hours = _duration_hours(from_time, to_time)
	if dur_hours <= 0:
		dur_hours = 0.5

	if target_block and frappe.db.exists("Planned Work Block", target_block):
		res = log_work_session(
			block_name=target_block,
			from_time=from_time,
			to_time=to_time,
			hours=dur_hours,
			session_date=target_date,
			notes=deliverable_notes,
			logged_via="Catch-Up",
			output_metrics=output_metrics
		)
		return {"status": "success", "mode": "appended_to_block", "block": target_block, "res": res}
	else:
		res = quick_timer_punch(
			action="stop",
			work_date=target_date,
			from_time=from_time,
			to_time=to_time,
			duration_hours=dur_hours,
			project=project,
			task=task,
			deliverable_notes=deliverable_notes,
			work_nature=task_nature or "🎯 Planned",
			output_metrics=output_metrics,
			pairing_partner=pairing_partner
		)
		return {"status": "success", "mode": "new_completed_block", "punch": res}


@frappe.whitelist(allow_guest=True)
def get_active_session(user=None):
	"""
	Returns the currently in-flight active session for the user across devices.
	Automatically expires sessions older than 24 hours.
	"""
	target_user = user or _resolve_planner_user() or frappe.session.user
	if not target_user or target_user == "Guest":
		return None

	data = frappe.cache.hget("omnitrack:active_session", target_user)
	if not data:
		raw_db = frappe.db.get_default("omnitrack_active_session", target_user)
		if raw_db:
			try:
				data = json.loads(raw_db) if isinstance(raw_db, str) else raw_db
				if isinstance(data, dict):
					frappe.cache.hset("omnitrack:active_session", target_user, data)
			except Exception:
				data = None

	if not data or not isinstance(data, dict):
		return None

	# Check expiration (24h threshold)
	start_time = flt(data.get("startTime", 0))
	if start_time > 0:
		now_ms = datetime.now().timestamp() * 1000
		diff_seconds = (now_ms - start_time) / 1000.0
		if diff_seconds > 86400 or diff_seconds < -43200:
			frappe.cache.hdel("omnitrack:active_session", target_user)
			frappe.defaults.clear_default("omnitrack_active_session", parent=target_user)
			frappe.db.set_default("omnitrack_active_session", None, parent=target_user)
			frappe.db.sql(
				"DELETE FROM `tabDefaultValue` WHERE defkey = 'omnitrack_active_session' AND parent = %(user)s",
				{"user": target_user}
			)
			frappe.clear_cache(user=target_user)
			frappe.db.commit()
			return None

	return data


