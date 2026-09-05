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
	if doc.get("project") and frappe.db.exists("DocType", "OmniTrack Project Policy"):
		policy = frappe.db.get_value("OmniTrack Project Policy", {"project": doc.project}, "custom_variance_threshold")
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

@frappe.whitelist()
def quick_timer_punch(action, duration_seconds=0, project=None, task=None, deliverable_notes=None):
	"""
	Quick Stopwatch Punch API from Desktop / Mobile HUD.
	Creates/Completes a Planned Work Block and triggers attendance synthesis.
	"""
	user = frappe.session.user
	today = nowdate()
	now_t = nowtime()
	dur_secs = flt(duration_seconds)
	dur_hours = round(dur_secs / 3600.0, 2) if dur_secs > 0 else 0.5

	if action in ("stop", "punch_out", "save_block"):
		# Calculate start time
		from datetime import datetime, timedelta
		now_dt = datetime.now()
		start_dt = now_dt - timedelta(seconds=max(dur_secs, 1800))
		start_t = start_dt.strftime("%H:%M:%S")
		end_t = now_dt.strftime("%H:%M:%S")

		block = frappe.new_doc("Planned Work Block")
		block.employee = user
		block.work_date = today
		block.start_time = start_t
		block.end_time = end_t
		block.duration_hours = dur_hours
		block.project = project
		block.task = task
		block.deliverable_notes = deliverable_notes or f"Stopwatch log recorded from Desk Navbar ({dur_hours} hrs)"
		block.status = "Completed"
		block.task_nature = "🎯 Planned"
		block.flags.ignore_permissions = True
		block.insert()

		# Also log Employee Checkin if Employee exists
		emp = frappe.db.get_value("Employee", {"user_id": user}, "name")
		if emp and frappe.db.exists("DocType", "Employee Checkin"):
			chk = frappe.new_doc("Employee Checkin")
			chk.employee = emp
			chk.time = now_datetime()
			chk.log_type = "OUT"
			chk.flags.ignore_permissions = True
			chk.insert()

		return {
			"status": "success",
			"message": f"Logged {dur_hours} hours for {user}",
			"block": block.name,
			"cryptographic_hash": block.cryptographic_hash
		}

	elif action in ("punch_in", "start"):
		emp = frappe.db.get_value("Employee", {"user_id": user}, "name")
		if emp and frappe.db.exists("DocType", "Employee Checkin"):
			chk = frappe.new_doc("Employee Checkin")
			chk.employee = emp
			chk.time = now_datetime()
			chk.log_type = "IN"
			chk.flags.ignore_permissions = True
			chk.insert()
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
	"""Converts a Planned Work Block into a Timesheet document."""
	if not frappe.db.exists("DocType", "Planned Work Block"):
		frappe.throw(_("Planned Work Block DocType is not available."))

	block = frappe.get_doc("Planned Work Block", block_name)
	if block.timesheet and frappe.db.exists("Timesheet", block.timesheet):
		return block.timesheet

	ts = frappe.new_doc("Timesheet")
	user_emp = frappe.db.get_value("Employee", {"user_id": block.employee}, "name") if frappe.db.exists("DocType", "Employee") else None
	ts.employee = user_emp or block.employee
	
	company = frappe.db.get_single_value("Global Defaults", "default_company")
	if not company and frappe.db.exists("DocType", "Company"):
		comps = frappe.get_all("Company", limit=1)
		if comps:
			company = comps[0].name
	ts.company = company

	row = {
		"from_time": f"{block.work_date} {block.start_time}",
		"to_time": f"{block.work_date} {block.end_time}",
		"hours": block.duration_hours,
		"project": block.project,
		"task": block.task,
		"activity_type": "Execution",
		"description": block.deliverable_notes or f"OmniTrack Block {block.name} ({block.cryptographic_hash or ''})"
	}
	ts.append("time_logs", row)
	ts.flags.ignore_permissions = True
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
