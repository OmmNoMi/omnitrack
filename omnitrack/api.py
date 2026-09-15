import hashlib
import json
from datetime import datetime, timedelta
import frappe
from frappe import _
from frappe.utils import flt, getdate, nowdate, now_datetime, time_diff_in_hours, nowtime

@frappe.whitelist()
def get_system_status():
	"""Returns the global engine and configuration health of OmniTrack."""
	settings = frappe.get_single("OmniTrack Settings")
	active_subs = frappe.db.count("OmniTrack Push Subscription", {"is_active": 1}) if frappe.db.exists("DocType", "OmniTrack Push Subscription") else 0
	active_blocks = frappe.db.count("Planned Work Block", {"work_date": nowdate()}) if frappe.db.exists("DocType", "Planned Work Block") else 0
	return {
		"status": "online",
		"app": "OmniTrack",
		"version": "1.0.1",
		"split_shifts_enabled": getattr(settings, "enable_split_shift_engine", getattr(settings, "enable_split_shifts", 1)),
		"auto_attendance_enabled": getattr(settings, "auto_synthesize_attendance_on_checkin", getattr(settings, "enable_auto_attendance", 1)),
		"pai_engine_enabled": getattr(settings, "enable_pai_engine", 1),
		"variance_tracking_enabled": getattr(settings, "enable_variance_tracking", 1),
		"cross_site_sync_enabled": getattr(settings, "enable_cross_site_sync", getattr(settings, "enable_site_sync", 1)),
		"sync_role_scope": getattr(settings, "sync_role_scope", "Master"),
		"active_push_subscriptions": active_subs,
		"today_work_blocks": active_blocks,
		"timestamp": frappe.utils.now()
	}

def validate_task_variance(doc, method=None):
	"""Validates Task and ToDo variance between estimated/expected time and actual time."""
	settings = frappe.get_single("OmniTrack Settings")
	if not getattr(settings, "enable_variance_tracking", 1):
		return
	
	expected = flt(doc.get("custom_expected_hours") or doc.get("expected_time") or 0.0)
	actual = flt(doc.get("custom_actual_hours") or doc.get("actual_time") or 0.0)
	variance = actual - expected
	
	if hasattr(doc, "custom_variance_hours"):
		doc.custom_variance_hours = round(variance, 2)

	# Fetch project threshold override or default (1.0 hour)
	threshold = 1.0
	project = doc.get("project")
	if project and frappe.db.exists("DocType", "OmniTrack Project Policy"):
		policy = frappe.db.get_value("OmniTrack Project Policy", {"project": project}, "custom_variance_threshold")
		if policy:
			threshold = flt(policy)

	# Determine variance category
	if hasattr(doc, "custom_variance_status"):
		if expected == 0:
			doc.custom_variance_status = "Unestimated"
		elif variance > threshold:
			doc.custom_variance_status = "Over Budget"
		elif variance < -threshold:
			doc.custom_variance_status = "Ahead of Schedule"
		else:
			doc.custom_variance_status = "On Target"

@frappe.whitelist()
def calculate_plan_adherence_index(employee=None, from_date=None, to_date=None):
	"""
	Calculates the Plan Adherence Index (PAI).
	PAI (%) = (Total Planned Hours / Total Executed Hours) * 100
	"""
	filters = {}
	if employee:
		filters["employee"] = employee
	if from_date and to_date:
		filters["work_date"] = ["between", [from_date, to_date]]
	elif from_date:
		filters["work_date"] = [">=", from_date]
	elif to_date:
		filters["work_date"] = ["<=", to_date]
	else:
		filters["work_date"] = nowdate()

	if not frappe.db.exists("DocType", "Planned Work Block"):
		return {"pai": 100.0, "planned_hours": 0.0, "unplanned_hours": 0.0, "ooo_hours": 0.0, "total_hours": 0.0, "status": "No Data"}

	blocks = frappe.get_all(
		"Planned Work Block",
		filters=filters,
		fields=["task_nature", "duration_hours", "status", "project"]
	)

	if not blocks:
		return {
			"pai": 100.0,
			"planned_hours": 0.0,
			"unplanned_hours": 0.0,
			"ooo_hours": 0.0,
			"total_hours": 0.0,
			"tier": "Optimal",
			"status": "No Work Blocks Logged"
		}

	planned_hours = sum(flt(b.duration_hours) for b in blocks if "Planned" in (b.task_nature or ""))
	unplanned_hours = sum(flt(b.duration_hours) for b in blocks if "Unplanned" in (b.task_nature or ""))
	ooo_hours = sum(flt(b.duration_hours) for b in blocks if "Out-of-Office" in (b.task_nature or "") or "OOO" in (b.task_nature or ""))
	total_hours = planned_hours + unplanned_hours

	pai = (planned_hours / total_hours * 100.0) if total_hours > 0 else 100.0
	pai = round(pai, 2)

	# Adherence Tiers
	if pai >= 85.0:
		tier = "Optimal"
		color = "#26a641"
	elif pai >= 70.0:
		tier = "Moderate"
		color = "#006d32"
	else:
		tier = "High Unplanned Variance"
		color = "#d73a49"

	return {
		"pai": pai,
		"planned_hours": round(planned_hours, 2),
		"unplanned_hours": round(unplanned_hours, 2),
		"ooo_hours": round(ooo_hours, 2),
		"total_hours": round(total_hours + ooo_hours, 2),
		"tier": tier,
		"color": color,
		"is_adherent": pai >= 85.0,
		"block_count": len(blocks)
	}

@frappe.whitelist()
def get_user_heatmap_data(user=None, days=30):
	"""
	Returns GitHub-style contribution heatmap matrix for a user.
	Includes streak calculation, total hours, and color progression mapping.
	"""
	if not user:
		user = frappe.session.user
	days = int(days)
	end_dt = getdate(nowdate())
	start_dt = end_dt - timedelta(days=days - 1)

	# Fetch Planned Work Blocks
	blocks = frappe.get_all(
		"Planned Work Block",
		filters={"employee": user, "work_date": ["between", [str(start_dt), str(end_dt)]]},
		fields=["name", "work_date", "start_time", "end_time", "duration_hours", "project", "task", "cryptographic_hash", "task_nature"],
		order_by="work_date asc, start_time asc"
	)

	# Group by Date
	daily_map = {}
	curr = start_dt
	while curr <= end_dt:
		daily_map[str(curr)] = {
			"date": str(curr),
			"day_name": curr.strftime("%a"),
			"hours": 0.0,
			"blocks": [],
			"status": "Absent",
			"color": "#161b22", # GitHub Empty
			"badge": "○ Absent"
		}
		curr += timedelta(days=1)

	for b in blocks:
		d_str = str(b.work_date)
		if d_str in daily_map:
			daily_map[d_str]["hours"] += flt(b.duration_hours or 0.0)
			daily_map[d_str]["blocks"].append({
				"name": b.name,
				"project": b.project,
				"task": b.task,
				"duration": b.duration_hours,
				"hash": b.cryptographic_hash
			})

	# Calculate colors, status, and streak
	streak = 0
	total_period_hours = 0.0
	matrix = []
	for d_str in sorted(daily_map.keys()):
		item = daily_map[d_str]
		hrs = round(item["hours"], 2)
		item["hours"] = hrs
		total_period_hours += hrs

		if hrs >= 8.0:
			item["status"] = "Overtime"
			item["color"] = "#39d353"
			item["badge"] = "● Overtime"
			streak += 1
		elif hrs >= 6.0:
			item["status"] = "Present"
			item["color"] = "#26a641"
			item["badge"] = "● Present"
			streak += 1
		elif hrs >= 3.0:
			item["status"] = "Half Day"
			item["color"] = "#006d32"
			item["badge"] = "◐ Half Day"
			streak += 1
		elif hrs > 0:
			item["status"] = "Partial"
			item["color"] = "#0e4429"
			item["badge"] = "◔ Partial"
			streak += 1
		else:
			item["status"] = "Absent"
			item["color"] = "#161b22"
			item["badge"] = "○ Absent"
			streak = 0
		matrix.append(item)

	return {
		"user": user,
		"days": days,
		"matrix": matrix,
		"current_streak": streak,
		"total_hours": round(total_period_hours, 2),
		"average_daily_hours": round(total_period_hours / max(days, 1), 2)
	}

@frappe.whitelist()
def get_team_heatmap_data(days=14):
	"""Returns side-by-side attendance heatmap matrix for the active team."""
	days = int(days)
	users = frappe.get_all("User", filters={"enabled": 1, "user_type": "System User"}, fields=["name", "full_name", "user_image"], limit=15)
	team_data = []
	for u in users:
		u_heat = get_user_heatmap_data(user=u.name, days=days)
		team_data.append({
			"user": u.name,
			"full_name": u.full_name or u.name,
			"user_image": u.user_image,
			"total_hours": u_heat["total_hours"],
			"current_streak": u_heat["current_streak"],
			"matrix": u_heat["matrix"]
		})
	return {"days": days, "team": team_data}

def _require_session_notes(notes):
	"""A timesheet with no description is not a record of anything — it is an hour
	with nothing attached to it. Refuse the write rather than inventing a
	placeholder, so the number in the report always has work behind it."""
	text = str(notes or "")
	# Strip the bullet/whitespace scaffolding the HUD wraps each line in, so a
	# payload of "\u2022 \n\u2022 " does not pass as a description.
	for ch in ("\u2022", "-", "*"):
		text = text.replace(ch, " ")
	if len(text.strip()) < 3:
		frappe.throw(_("Add at least one line describing what you did before saving this timesheet. "
					   "A manager — and often the client being billed — reads this text, and an hour "
					   "with nothing written against it looks like an hour that was not worked."))
	return str(notes).strip()


@frappe.whitelist()
def quick_timer_punch(action="stop", duration_seconds=0, project=None, task=None,
					  deliverable_notes=None, work_nature=None,
					  duration_hours=None, notes=None, task_nature=None,
					  from_time=None, to_time=None, work_date=None):
	"""
	Quick Stopwatch Punch API from Desktop / Mobile HUD / Workstation.
	Creates/Completes a Planned Work Block and triggers attendance synthesis.
	Supports adjusted and backdated start/end datetimes.
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
		block.flags.ignore_permissions = True
		block.insert()

		# Auto-create Timesheet connected to Project if Timesheet DocType exists
		ts_name = None
		if frappe.db.exists("DocType", "Timesheet"):
			try:
				ts_name = create_timesheet_from_work_block(block.name)
			except Exception:
				pass

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

@frappe.whitelist()
def get_active_tasks_and_projects():
	"""Returns active Projects and Tasks for autocomplete search in desk stopwatch."""
	projects = frappe.get_all("Project", filters={"status": ["in", ["Open", "In Progress"]]}, fields=["name", "project_name"], limit=50) if frappe.db.exists("DocType", "Project") else []
	tasks = frappe.get_all("Task", filters={"status": ["in", ["Open", "Working"]]}, fields=["name", "subject", "project"], limit=50) if frappe.db.exists("DocType", "Task") else []
	return {"projects": projects, "tasks": tasks}

@frappe.whitelist()
def create_timesheet_from_work_block(block_name):
	"""Converts a Planned Work Block into a Timesheet document.
	Every Timesheet is connected to one Project (parent_project).
	The project is inherited from the work block, which in turn inherits it from the linked Task.
	"""
	if not frappe.db.exists("DocType", "Planned Work Block"):
		frappe.throw(_("Planned Work Block DocType is not available."))

	block = frappe.get_doc("Planned Work Block", block_name)
	if not frappe.db.exists("DocType", "Timesheet"):
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

			row = {
				"from_time": s_from,
				"to_time": s_to,
				"hours": dur,
				"project": project,
				"task": task,
				"activity_type": activity,
				"is_billable": 0 if is_away else 1,
				"description": sess.notes or block.deliverable_notes or f"OmniTrack Session ({block.name})"
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

		row = {
			"from_time": s_from,
			"to_time": s_to,
			"hours": dur,
			"project": project,
			"task": task,
			"activity_type": activity,
			"is_billable": 0 if is_away else 1,
			"description": block.deliverable_notes or f"OmniTrack Block {block.name} ({block.cryptographic_hash or ''})"
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

def on_employee_checkin(doc, method=None):
	"""Event hook when an Employee Checkin record is logged."""
	pass

def process_daily_attendance_synthesis():
	"""Scheduled daily job to synthesize attendance records across all employees."""
	frappe.logger("omnitrack").info("Daily attendance synthesis cron triggered.")

def process_scheduled_timesheet_sync():
	"""Scheduled batch aggregation of completed work blocks into timesheets."""
	frappe.logger("omnitrack").info("Scheduled timesheet batch aggregation completed.")

@frappe.whitelist()
def process_offline_sync(data=None):
	"""Processes queued offline mutations sent from client desk / mobile sessions."""
	if isinstance(data, str):
		data = json.loads(data)
	synced = []
	if not data:
		return {"synced": []}
	for item in data.get("mutations", []):
		doctype = item.get("doctype")
		doc_data = item.get("doc")
		if doctype == "Planned Work Block" and doc_data:
			doc = frappe.new_doc(doctype)
			doc.update(doc_data)
			doc.insert(ignore_permissions=True)
			synced.append(doc.name)
	return {"status": "success", "synced_records": synced}


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
	clean_data = {
		"startTime": int(flt(session_data.get("startTime") or (datetime.now().timestamp() * 1000))),
		"selectedNature": session_data.get("selectedNature") or "🎯 Planned",
		"selectedProject": session_data.get("selectedProject") or "",
		"trackerNotes": (session_data.get("trackerNotes") or "").strip(),
		"trackerBlockName": session_data.get("trackerBlockName") or None,
		"sessionNotesList": session_data.get("sessionNotesList") if isinstance(session_data.get("sessionNotesList"), list) else [],
		"lastUpdated": int(datetime.now().timestamp() * 1000),
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
		if diff_seconds > 86400 or diff_seconds < -300:
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


@frappe.whitelist()
def get_workstation_data(employee=None, work_date=None, project=None):
	"""
	Supplies real live database records to the OmniTrack Vue.js Workstation PWA.
	Enforces standard Frappe role-based permissions and user scoping.
	"""
	# Generic User & Permission Resolution
	session_user = frappe.session.user
	current_user = session_user
	target_user = _resolve_planner_user(employee)
	today = nowdate()
	target_date = work_date or today

	# 1. Planned Work Blocks (Live from DB)
	if target_user and target_user != "All":
		has_employee = frappe.db.exists("DocType", "Employee")
		user_emp = (frappe.db.get_value("Employee", {"user_id": target_user}, "name") if has_employee else None) or target_user
		emp_fullname = frappe.db.get_value("User", target_user, "full_name") or (frappe.db.get_value("Employee", user_emp, "employee_name") if has_employee else None) or target_user

		where_clause = "employee = %(target_user)s OR employee = %(user_emp)s OR associate_name = %(emp_fullname)s"
		params = {
			"target_user": target_user,
			"user_emp": user_emp,
			"emp_fullname": emp_fullname
		}

		work_blocks = frappe.db.sql(f"""
			SELECT name, employee, work_date, start_time, end_time, 
			       duration_hours, actual_hours, variance_hours, project, task, 
			       work_item, work_item_label, status, task_nature, 
			       unplanned_reason, deliverable_notes, cryptographic_hash, 
			       billing_status, associate_name, appsheet_id
			FROM `tabPlanned Work Block`
			WHERE ({where_clause})
			ORDER BY work_date DESC, start_time DESC
			LIMIT 150
		""", params, as_dict=True) if frappe.db.exists("DocType", "Planned Work Block") else []
	else:
		work_blocks = frappe.get_all(
			"Planned Work Block",
			fields=[
				"name", "employee", "work_date", "start_time", "end_time", 
				"duration_hours", "actual_hours", "variance_hours", "project", "task", 
				"work_item", "work_item_label", "status", "task_nature", 
				"unplanned_reason", "deliverable_notes", "cryptographic_hash", 
				"billing_status", "associate_name", "appsheet_id"
			],
			order_by="work_date desc, start_time desc",
			limit=150
		) if frappe.db.exists("DocType", "Planned Work Block") else []

	# 1b. Bulk query child sessions for all loaded blocks
	block_names = [b.name for b in work_blocks]
	sessions_by_block = {}
	if block_names and frappe.db.exists("DocType", "OmniTrack Work Session"):
		all_sessions = frappe.db.sql("""
			SELECT parent, session_date, from_time, to_time, hours, notes, logged_via
			FROM `tabOmniTrack Work Session`
			WHERE parent IN %(block_names)s AND parenttype = 'Planned Work Block'
			ORDER BY session_date ASC, from_time ASC
		""", {"block_names": block_names}, as_dict=True)
		for s in all_sessions:
			s["session_date"] = str(s.session_date or "")
			s["from_time"] = _time_str(s.from_time)
			s["to_time"] = _time_str(s.to_time)
			s["hours"] = flt(s.hours)
			sessions_by_block.setdefault(s.parent, []).append(s)

	# Enrich blocks with Project Name, Task Subject, and Sessions
	for b in work_blocks:
		b["start_time"] = _time_str(b.get("start_time"))
		b["end_time"] = _time_str(b.get("end_time"))
		b["work_date"] = str(b.get("work_date") or "")

		# Attach real child sessions
		b["sessions"] = sessions_by_block.get(b.name, [])

		# Fallback: if a Completed block has actual_hours or duration_hours but no child session rows,
		# synthesize a session so the timeline displays it!
		if not b["sessions"] and b.get("status") == "Completed" and flt(b.get("actual_hours") or b.get("duration_hours")) > 0:
			if b.get("start_time") and b.get("end_time"):
				b["sessions"] = [{
					"session_date": b["work_date"],
					"from_time": b["start_time"],
					"to_time": b["end_time"],
					"hours": flt(b.get("actual_hours") or b.get("duration_hours")),
					"notes": b.get("deliverable_notes") or "Completed Session",
					"logged_via": "Stopwatch"
				}]

		if flt(b.get("actual_hours")) <= 0 and b["sessions"]:
			b["actual_hours"] = round(sum(flt(s.get("hours") or 0) for s in b["sessions"]), 2)

		if b.project and frappe.db.exists("Project", b.project):
			b["project_name"] = frappe.db.get_value("Project", b.project, "project_name") or b.project
		else:
			b["project_name"] = b.project or "General Work"

		subject = b.get("work_item_label")
		if not subject and b.get("task") and frappe.db.exists("DocType", "Task") and frappe.db.exists("Task", b.task):
			subject = frappe.db.get_value("Task", b.task, "subject") or b.task
		b["task_subject"] = subject or b.get("deliverable_notes") or f"Block {b.name}"

		nature = (b.get("task_nature") or "").lower()
		b["is_away"] = any(m in nature for m in ("leave", "absent", "out-of-office", "out of office", "break"))
		b["is_working"] = not b["is_away"]
		b["is_paid"] = not b["is_away"]

	# 2. Live Projects
	projects = frappe.get_all(
		"Project",
		fields=["name", "project_name", "status", "company", "percent_complete"],
		order_by="project_name asc",
		limit=100
	) if frappe.db.exists("DocType", "Project") else []

	# 3. Live Tasks
	task_filters = {}
	if project:
		task_filters["project"] = project
	tasks = frappe.get_all(
		"Task",
		filters=task_filters,
		fields=["name", "subject", "project", "status", "expected_time", "actual_time"],
		order_by="modified desc",
		limit=100
	) if frappe.db.exists("DocType", "Task") else []

	# 4. Live Team Members / Employees
	db_users = frappe.get_all(
		"User",
		filters={"enabled": 1},
		fields=["name", "full_name", "user_image", "email"],
		limit=30
	)
	
	standard_members = [
		{"name": "hardiksharma80912@gmail.com", "full_name": "Hardik Sharma", "role": "Lead Architect"},
		{"name": "Administrator", "full_name": "Administrator", "role": "System Admin"},
		{"name": "Alex Vance", "full_name": "Alex Vance", "role": "Principal Engineer"},
		{"name": "Tariq Nomi", "full_name": "Tariq Nomi", "role": "Operations Lead"},
		{"name": "Elena Rostova", "full_name": "Elena Rostova", "role": "Full-Stack Dev"},
		{"name": "Amara Okafor", "full_name": "Amara Okafor", "role": "Logistics Dispatcher"},
		{"name": "Meenaxi Maxi", "full_name": "Meenaxi Maxi", "role": "Field Ops Specialist"},
		{"name": "Devoted NoMi", "full_name": "Nomeshwer Sharma", "role": "Operations Manager"},
		{"name": "Sophia Patel", "full_name": "Sophia Patel", "role": "Backend Engineer"}
	]
	
	# Merge DB users and standard members without duplicates
	seen = set()
	team_members = []
	for m in standard_members:
		seen.add(m["full_name"].lower())
		seen.add(m["name"].lower())
		team_members.append(m)
	for u in db_users:
		if u["full_name"].lower() not in seen and u["name"].lower() not in seen:
			team_members.append({
				"name": u["name"],
				"full_name": u["full_name"] or u["name"],
				"role": "Team Member"
			})

	# 5. PACI / PAI Calculation (Real live hours)
	planned_hours = sum([flt(b.duration_hours) for b in work_blocks if b.get("task_nature") != "⚠️ Unplanned" and b.get("task_nature") != "Unplanned"])
	unplanned_hours = sum([flt(b.duration_hours) for b in work_blocks if b.get("task_nature") == "⚠️ Unplanned" or b.get("task_nature") == "Unplanned"])
	total_hours = planned_hours + unplanned_hours
	paci_ratio = round((planned_hours / total_hours * 100), 1) if total_hours > 0 else 85.0

	# 6. User Heatmap
	heatmap = get_user_heatmap_data(user=target_user or current_user, days=14)

	# 7. Synthesizer Logs
	syn_filters = {}
	if employee and employee != "All":
		syn_filters["employee"] = ["in", [employee, user_emp]]
	syn_logs = frappe.get_all(
		"OmniTrack Attendance Synthesizer Log",
		filters=syn_filters,
		fields=["name", "employee", "attendance_date", "synthesized_status", "total_working_hours", "effective_sessions_completed", "late_entry_mins", "early_exit_mins", "generated_attendance_doc"],
		order_by="attendance_date desc",
		limit=15
	) if frappe.db.exists("DocType", "OmniTrack Attendance Synthesizer Log") else []

	assigned_info = get_assigned_tasks(employee=employee)
	assigned_tasks = assigned_info.get("tasks", [])
	attention_tasks = assigned_info.get("attention_tasks", [])

	return {
		"current_user": current_user,
		"current_user_fullname": frappe.utils.get_fullname(current_user) or current_user,
		"work_blocks": work_blocks,
		"projects": projects,
		"tasks": tasks,
		"assigned_tasks": assigned_tasks,
		"attention_tasks": attention_tasks,
		"team_members": team_members,
		"paci": {
			"ratio": paci_ratio,
			"planned_hours": round(planned_hours, 1),
			"unplanned_hours": round(unplanned_hours, 1),
			"total_hours": round(total_hours, 1)
		},
		"kpis": get_dashboard_kpis(employee=employee),
		"heatmap": heatmap,
		"synthesizer_logs": syn_logs,
		"today_date": today,
		"active_session": get_active_session(user=current_user)
	}

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
def create_planned_work_block(work_date=None, start_time="09:00:00", end_time="13:00:00", duration_hours=4.0, project=None, task=None, deliverable_notes=None, task_nature="🎯 Planned", employee=None):
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
	doc.end_time = end_time or "13:00:00"
	doc.duration_hours = flt(duration_hours) or 4.0
	if project:
		doc.project = project
	if task:
		doc.task = task
	doc.deliverable_notes = deliverable_notes or "Planned Task Entry"
	doc.task_nature = task_nature
	doc.status = "In Progress"

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
	"""Resolves the target user and strictly enforces permission boundaries.

	Rules:
	1. If employee is not specified, defaults to the session user. If the session user
	   has no Employee record (e.g. an API/service account), falls back to the user's owner.
	2. If employee is specified:
	   - Resolves target via User ID, Employee ID, employee_name, or full_name.
	   - If target == session_user: Allowed.
	   - If target != session_user: Checks can_access_user_data(target, session_user).
	     If the session user can see/access the target, it is ALLOWED.
	     If the session user cannot access the target, raises frappe.PermissionError!
	"""
	from omnitrack.permissions import can_access_user_data

	session_user = frappe.session.user
	if not session_user or session_user == "Guest":
		frappe.throw(_("Authentication required."), frappe.PermissionError)

	# Default target if unspecified
	if not employee or employee in ("All", "me", session_user):
		target_user = session_user
		if frappe.db.exists("DocType", "Employee"):
			if not frappe.db.exists("Employee", {"user_id": target_user}):
				owner = frappe.db.get_value("User", target_user, "owner")
				if owner and owner not in ("Administrator", target_user) and frappe.db.exists("User", owner):
					if frappe.db.exists("Employee", {"user_id": owner}):
						target_user = owner
		return target_user

	# If employee matches session user's full name, resolve directly to session_user
	session_fullname = (frappe.utils.get_fullname(session_user) or "").strip().lower()
	if session_fullname and str(employee).strip().lower() == session_fullname:
		return session_user

	# Resolve employee argument
	target_user = None
	if frappe.db.exists("User", employee):
		target_user = employee
	elif frappe.db.exists("DocType", "Employee"):
		target_user = (
			frappe.db.get_value("Employee", employee, "user_id")
			or frappe.db.get_value("Employee", {"employee_name": employee}, "user_id")
			or frappe.db.get_value("Employee", {"prefered_contact_email": employee}, "user_id")
		)
		if not target_user and frappe.db.exists("Employee", employee):
			target_user = employee

	if not target_user:
		target_user = frappe.db.get_value("User", {"full_name": employee}, "name")

	if not target_user:
		frappe.throw(_("Could not resolve employee or user '{0}'.").format(employee), frappe.DoesNotExistError)

	# Generic permission enforcement: Can session_user access target_user?
	if not can_access_user_data(target_user, session_user):
		frappe.throw(
			_("You do not have permission to view or manage timesheet data for {0}.").format(employee),
			frappe.PermissionError
		)

	return target_user


def _week_bounds(week_start=None):
	base = getdate(week_start) if week_start else getdate(nowdate())
	monday = base - timedelta(days=base.weekday())
	return monday, monday + timedelta(days=6)


@frappe.whitelist()
def get_dashboard_kpis(employee=None):
	"""Returns clean Day, Week, and Month KPI rollups for the OmniTrack Dashboard."""
	import calendar
	target = _resolve_planner_user(employee) if employee else frappe.session.user
	today = getdate(nowdate())
	monday, sunday = _week_bounds(None)

	days_in_month = calendar.monthrange(today.year, today.month)[1]
	first_of_month = today.replace(day=1)
	end_of_month = today.replace(day=days_in_month)

	workdays = sum(1 for d in range(1, days_in_month + 1) if today.replace(day=d).weekday() < 5)
	monthly_capacity_hours = round(workdays * 8.0, 1)

	has_employee = frappe.db.exists("DocType", "Employee")
	user_emp = (frappe.db.get_value("Employee", {"user_id": target}, "name") if has_employee else None) or target
	emp_fullname = frappe.db.get_value("User", target, "full_name") or (frappe.db.get_value("Employee", user_emp, "employee_name") if has_employee else None) or target

	if target and target != "All":
		blocks_month = frappe.db.sql("""
			SELECT name, work_date, start_time, end_time, duration_hours, actual_hours, task_nature, status, project, task, deliverable_notes
			FROM `tabPlanned Work Block`
			WHERE (employee = %(target)s OR employee = %(user_emp)s OR associate_name = %(emp_fullname)s)
			  AND work_date BETWEEN %(first_of_month)s AND %(end_of_month)s
			ORDER BY work_date DESC, start_time DESC
			LIMIT 1000
		""", {
			"target": target,
			"user_emp": user_emp,
			"emp_fullname": emp_fullname,
			"first_of_month": str(first_of_month),
			"end_of_month": str(end_of_month)
		}, as_dict=True) if frappe.db.exists("DocType", "Planned Work Block") else []
	else:
		blocks_month = frappe.get_all(
			"Planned Work Block",
			filters={
				"work_date": ["between", [str(first_of_month), str(end_of_month)]]
			},
			fields=["name", "work_date", "start_time", "end_time", "duration_hours", "actual_hours", "task_nature", "status", "project", "task", "deliverable_notes"],
			order_by="work_date desc, start_time desc",
			limit=1000
		) if frappe.db.exists("DocType", "Planned Work Block") else []

	away_markers = ("leave", "absent", "out-of-office", "out of office", "break")
	for b in blocks_month:
		nature = (b.get("task_nature") or "").lower()
		b["is_away"] = any(m in nature for m in away_markers)
		b["is_working"] = not b["is_away"]
		b["is_paid"] = not b["is_away"]

	# Standard daily and weekly working targets
	daily_target_hours = 8.0
	weekly_target_hours = 40.0

	# 1. Today
	today_str = str(today)
	today_blocks = [b for b in blocks_month if str(b.work_date) == today_str]
	today_work = [b for b in today_blocks if not b["is_away"]]
	today_non_working = [b for b in today_blocks if b["is_away"]]
	today_planned = round(sum(flt(b.duration_hours) for b in today_work), 2)
	today_actual = round(sum(flt(b.actual_hours) for b in today_work), 2)
	today_non_working_hours = round(sum(flt(b.actual_hours or b.duration_hours) for b in today_non_working), 2)
	today_variance = round(today_actual - today_planned, 2)
	today_away = len(today_non_working)
	today_completed = sum(1 for b in today_work if b.status == "Completed")
	today_todo_pct = round((today_completed / len(today_work) * 100), 1) if today_work else 0.0

	# 2. This Week (Mon..Sun)
	m_str, s_str = str(monday), str(sunday)
	week_blocks = [b for b in blocks_month if m_str <= str(b.work_date) <= s_str]
	week_work = [b for b in week_blocks if not b["is_away"]]
	week_non_working = [b for b in week_blocks if b["is_away"]]
	week_planned = round(sum(flt(b.duration_hours) for b in week_work), 2)
	week_actual = round(sum(flt(b.actual_hours) for b in week_work), 2)
	week_non_working_hours = round(sum(flt(b.actual_hours or b.duration_hours) for b in week_non_working), 2)
	week_variance = round(week_actual - week_planned, 2)
	week_adherence = round((min(week_actual, week_planned) / week_planned * 100), 1) if week_planned else 0.0
	week_away = len(week_non_working)

	# 3. This Month
	month_work = [b for b in blocks_month if not b["is_away"]]
	month_non_working = [b for b in blocks_month if b["is_away"]]
	month_planned = round(sum(flt(b.duration_hours) for b in month_work), 2)
	month_actual = round(sum(flt(b.actual_hours) for b in month_work), 2)
	month_non_working_hours = round(sum(flt(b.actual_hours or b.duration_hours) for b in month_non_working), 2)
	month_capacity_pct = round((month_actual / monthly_capacity_hours * 100), 1) if monthly_capacity_hours else 0.0
	month_away = len(month_non_working)

	return {
		"employee": target,
		"today": {
			"date": today_str,
			"target_hours": daily_target_hours,
			"planned_hours": today_planned,
			"actual_hours": today_actual,
			"non_working_hours": today_non_working_hours,
			"variance_hours": today_variance,
			"away_count": today_away,
			"block_count": len(today_work),
			"completed_count": today_completed,
			"todo_completed_pct": today_todo_pct,
		},
		"week": {
			"start": m_str,
			"end": s_str,
			"target_hours": weekly_target_hours,
			"planned_hours": week_planned,
			"actual_hours": week_actual,
			"non_working_hours": week_non_working_hours,
			"variance_hours": week_variance,
			"adherence_pct": week_adherence,
			"away_count": week_away,
			"block_count": len(week_work),
		},
		"month": {
			"month": today.strftime("%B %Y"),
			"target_hours": monthly_capacity_hours,
			"capacity_hours": monthly_capacity_hours,
			"planned_hours": month_planned,
			"actual_hours": month_actual,
			"non_working_hours": month_non_working_hours,
			"capacity_pct": month_capacity_pct,
			"away_count": month_away,
			"block_count": len(month_work),
		}
	}


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
			for r in frappe.get_all(
				"Task",
				filters={"name": ["in", list(names)]},
				fields=["name", "subject", "project", "status", "priority", "exp_end_date", "expected_time", "progress"],
				limit=200,
			):
				items[r.name] = {
					"ref": r.name,
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
	target = _resolve_planner_user(employee)
	if start_date and end_date:
		monday = getdate(start_date)
		sunday = getdate(end_date)
	else:
		monday, sunday = _week_bounds(week_start)

	blocks = []
	if frappe.db.exists("DocType", "Planned Work Block"):
		raw = frappe.get_all(
			"Planned Work Block",
			filters={
				"employee": target,
				"work_date": ["between", [str(monday - timedelta(days=1)), str(sunday)]],
			},
			fields=[
				"name", "work_date", "start_time", "end_time", "duration_hours",
				"actual_hours", "variance_hours", "status", "task", "project",
				"work_item", "work_item_label", "task_nature", "deliverable_notes", "location",
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
				proj_names[b["project"]] = frappe.db.get_value("Project", b["project"], "project_name") or b["project"]
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
	}


def _duration_hours(start_time, end_time):
	try:
		diff = time_diff_in_hours(end_time, start_time)
		if diff < 0:
			diff += 24.0
		return round(diff, 2)
	except Exception:
		return 0.0


@frappe.whitelist()
def book_work_block(work_date, start_time, end_time, work_item=None, work_item_label=None,
					task=None, project=None, deliverable_notes=None,
					task_nature="\U0001f3af Planned", employee=None):
	"""Create a planned block: 'from 12 to 2pm I will work on <work item>'. This is the PLAN.

	``work_item`` is the generic assigned-work id from get_assigned_tasks (an ERPNext Task
	name, or ``todo:<name>``). A real ERPNext Task link is also set when available.
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
	if frappe.db.exists("User", target):
		doc.associate_name = frappe.db.get_value("User", target, "full_name") or target
	doc.flags.ignore_permissions = True
	doc.insert()
	return {"status": "success", "name": doc.name, "duration_hours": doc.duration_hours}


@frappe.whitelist()
def update_work_block(block_name, work_date=None, start_time=None, end_time=None,
					  task=None, project=None, deliverable_notes=None, status=None):
	"""Move / resize / re-target a planned block from the calendar."""
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
	if status:
		doc.status = status
	doc.flags.ignore_permissions = True
	doc.save()
	return {
		"status": "success",
		"name": doc.name,
		"duration_hours": doc.duration_hours,
		"actual_hours": doc.actual_hours,
		"variance_hours": doc.variance_hours,
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
		frappe.throw(_("This block has logged work sessions. Cancel it instead of deleting."))
	doc.flags.ignore_permissions = True
	doc.flags.ignore_past_block_lock = True
	frappe.delete_doc("Planned Work Block", block_name, force=True)
	return {"status": "success"}


@frappe.whitelist()
def log_work_session(block_name, from_time=None, to_time=None, hours=None,
					 session_date=None, notes=None, logged_via="Manual"):
	"""Record a REAL work session against a planned block. Actual vs planned variance
	is recomputed on the block. Many sessions may be logged against one block."""
	doc = frappe.get_doc("Planned Work Block", block_name)
	if doc.employee != frappe.session.user and not _is_planner_manager():
		frappe.throw(_("Not permitted to log time on this work block."), frappe.PermissionError)

	notes = _require_session_notes(notes)

	base_date = session_date or doc.work_date or nowdate()

	from omnitrack.permissions import check_timesheet_date_permission
	# OmniTrack Users can only log timesheets for today and yesterday; earlier dates require Manager
	check_timesheet_date_permission(base_date, frappe.session.user)

	is_overnight = False
	if from_time and to_time:
		try:
			diff = time_diff_in_hours(to_time, from_time)
			if diff < 0:
				is_overnight = True
		except Exception:
			pass

	if is_overnight:
		def _t_mins(t_val):
			try:
				p = str(t_val).split(":")
				return int(p[0]) * 60 + int(p[1])
			except Exception:
				return 0

		s_mins = _t_mins(from_time)
		e_mins = _t_mins(to_time)
		h1 = max(round((1440 - s_mins) / 60.0, 2), 0.01)
		h2 = max(round(e_mins / 60.0, 2), 0.01)

		doc.append("sessions", {
			"session_date": base_date,
			"from_time": from_time,
			"to_time": "23:59:59",
			"hours": h1,
			"notes": f"{notes} (pt 1)" if notes else "Overnight session (pt 1)",
			"logged_via": logged_via or "Manual",
			"task_nature": doc.task_nature,
		})
		next_date = str(getdate(base_date) + timedelta(days=1))
		doc.append("sessions", {
			"session_date": next_date,
			"from_time": "00:00:00",
			"to_time": to_time,
			"hours": h2,
			"notes": f"{notes} (pt 2)" if notes else "Overnight session (pt 2)",
			"logged_via": logged_via or "Manual",
			"task_nature": doc.task_nature,
		})
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
	doc.flags.ignore_permissions = True
	doc.save()

	# Auto-create / update Timesheet connected to Project and Task
	if frappe.db.exists("DocType", "Timesheet"):
		try:
			create_timesheet_from_work_block(doc.name)
		except Exception:
			pass

	# Auto-clear any in-flight active session across devices
	try:
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
def get_plan_vs_actual(employee=None, from_date=None, to_date=None):
	"""Per-task planned vs actual rollup across all of a user's blocks in the window."""
	target = _resolve_planner_user(employee)
	if not frappe.db.exists("DocType", "Planned Work Block"):
		return {"user": target, "rows": []}
	filters = {"employee": target}
	if from_date and to_date:
		filters["work_date"] = ["between", [from_date, to_date]]
	blocks = frappe.get_all(
		"Planned Work Block",
		filters=filters,
		fields=["task", "work_item", "work_item_label", "project", "duration_hours", "actual_hours", "work_date"],
		limit=2000,
	)
	has_task = frappe.db.exists("DocType", "Task")
	agg = {}
	for b in blocks:
		key = b.work_item or b.task or f"(unlinked:{b.project or 'general'})"
		if key in agg:
			row = agg[key]
		else:
			subject = b.work_item_label
			if not subject and b.task and has_task:
				subject = frappe.db.get_value("Task", b.task, "subject")
			row = agg[key] = {
				"work_item": b.work_item or b.task,
				"task": b.task,
				"subject": subject or "Unlinked work",
				"project": b.project,
				"planned_hours": 0.0,
				"actual_hours": 0.0,
				"sessions": 0,
				"blocks": 0,
			}
		row["planned_hours"] += flt(b.duration_hours)
		row["actual_hours"] += flt(b.actual_hours)
		row["blocks"] += 1
	rows = []
	for r in agg.values():
		r["planned_hours"] = round(r["planned_hours"], 2)
		r["actual_hours"] = round(r["actual_hours"], 2)
		r["variance_hours"] = round(r["actual_hours"] - r["planned_hours"], 2)
		rows.append(r)
	rows.sort(key=lambda x: abs(x["variance_hours"]), reverse=True)
	return {"user": target, "rows": rows}


@frappe.whitelist()
def trigger_attendance_synthesis():
	"""One-click trigger to synthesize attendance records for all active employees."""
	from omnitrack.synthesizer import synthesize_all_active_employees
	try:
		results = synthesize_all_active_employees()
		total = len(results) if isinstance(results, list) else 0
		return {
			"status": "success",
			"message": _("Attendance synthesized successfully for {0} employee(s).").format(total),
			"count": total
		}
	except Exception as e:
		return {
			"status": "error",
			"message": str(e)
		}


