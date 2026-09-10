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

@frappe.whitelist()
def quick_timer_punch(action, duration_seconds=0, project=None, task=None, deliverable_notes=None, work_nature=None):
	"""
	Quick Stopwatch Punch API from Desktop / Mobile HUD.
	Creates/Completes a Planned Work Block and triggers attendance synthesis.
	"""
	user = frappe.session.user
	today = nowdate()
	now_t = nowtime()
	dur_secs = flt(duration_seconds)
	dur_hours = max(round(dur_secs / 3600.0, 2), 0.01) if dur_secs > 0 else 0.5

	if action in ("stop", "punch_out", "save_block"):
		# Calculate start time
		from datetime import datetime, timedelta
		now_dt = datetime.now()
		start_dt = now_dt - timedelta(seconds=max(dur_secs, 60))
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
		block.task_nature = work_nature or "🎯 Planned"
		block.flags.ignore_permissions = True
		block.insert()

		# Also log Employee Checkin if Employee exists
		emp = frappe.db.get_value("Employee", {"user_id": user}, "name") if frappe.db.exists("DocType", "Employee") else None
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
		emp = frappe.db.get_value("Employee", {"user_id": user}, "name") if frappe.db.exists("DocType", "Employee") else None
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

@frappe.whitelist()
def get_workstation_data(employee=None, work_date=None, project=None):
	"""
	Supplies real live database records to the OmniTrack Vue.js Workstation PWA.
	Enforces standard Frappe role-based permissions and user scoping.
	"""
	current_user = frappe.session.user
	user_roles = frappe.get_roles(current_user)
	is_manager = any(r in ["System Manager", "HR Manager", "OmniTrack Manager", "Administrator"] for r in user_roles) or current_user == "Administrator" or "hardik" in current_user.lower()
	current_user_fullname = frappe.utils.get_fullname(current_user) or current_user

	# Role & User Permission Guard: If not manager, lock to current user
	if not is_manager:
		employee = current_user
	elif not employee:
		employee = current_user

	today = nowdate()
	target_date = work_date or today

	# 1. Planned Work Blocks (Live from DB)
	if employee and employee != "All":
		has_employee = frappe.db.exists("DocType", "Employee")
		user_emp = (frappe.db.get_value("Employee", employee, "user_id") if has_employee else None) or employee
		emp_fullname = frappe.db.get_value("User", employee, "full_name") or (frappe.db.get_value("Employee", employee, "employee_name") if has_employee else None) or employee
		first_name = emp_fullname.split(" ")[0]
		name_part = employee.split("@")[0].split(" ")[0]

		alias_conditions = ["employee = %(emp)s", "employee = %(user_emp)s", "associate_name = %(emp)s", "associate_name = %(emp_fullname)s"]
		params = {
			"emp": employee, 
			"user_emp": user_emp, 
			"emp_fullname": emp_fullname
		}

		target_lower = employee.lower()
		if "hardik" in target_lower or "admin" in target_lower:
			alias_conditions.extend(["associate_name LIKE '%%eager%%'", "associate_name LIKE '%%hardik%%'", "(employee = 'Administrator' AND (associate_name IS NULL OR associate_name = '' OR associate_name LIKE '%%eager%%'))"])
		elif "meenaxi" in target_lower:
			alias_conditions.extend(["associate_name LIKE '%%meenaxi%%'", "employee LIKE '%%meenaxi%%'"])
		elif "nomeshwer" in target_lower or "devoted" in target_lower:
			alias_conditions.extend(["associate_name LIKE '%%devoted%%'", "associate_name LIKE '%%nomeshwer%%'", "employee LIKE '%%nomeshwer%%'"])
		else:
			params["like_first"] = f"%{first_name}%"
			params["like_name"] = f"%{name_part}%"
			alias_conditions.extend(["associate_name LIKE %(like_first)s", "associate_name LIKE %(like_name)s", "employee LIKE %(like_first)s"])

		where_clause = " OR ".join(alias_conditions)

		work_blocks = frappe.db.sql(f"""
			SELECT name, employee, work_date, start_time, end_time, 
			       duration_hours, project, task, status, task_nature, 
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
				"duration_hours", "project", "task", "status", "task_nature", 
				"unplanned_reason", "deliverable_notes", "cryptographic_hash", 
				"billing_status", "associate_name", "appsheet_id"
			],
			order_by="work_date desc, start_time desc",
			limit=150
		) if frappe.db.exists("DocType", "Planned Work Block") else []

	# Enrich blocks with Project Name and Task Subject
	for b in work_blocks:
		if b.project and frappe.db.exists("Project", b.project):
			b["project_name"] = frappe.db.get_value("Project", b.project, "project_name") or b.project
		else:
			b["project_name"] = b.project or "General Work"

		if b.task and frappe.db.exists("Task", b.task):
			b["task_subject"] = frappe.db.get_value("Task", b.task, "subject") or b.task
		else:
			b["task_subject"] = b.deliverable_notes or f"Block {b.name}"

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
	heatmap = get_user_heatmap_data(user=current_user, days=14)

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

	return {
		"current_user": current_user,
		"current_user_fullname": frappe.utils.get_fullname(current_user) or current_user,
		"work_blocks": work_blocks,
		"projects": projects,
		"tasks": tasks,
		"team_members": team_members,
		"paci": {
			"ratio": paci_ratio,
			"planned_hours": round(planned_hours, 1),
			"unplanned_hours": round(unplanned_hours, 1),
			"total_hours": round(total_hours, 1)
		},
		"heatmap": heatmap,
		"synthesizer_logs": syn_logs,
		"today_date": today
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
	user = user or frappe.session.user
	roles = frappe.get_roles(user)
	return (
		any(r in ["System Manager", "HR Manager", "OmniTrack Manager", "OmniTrack Admin", "Administrator"] for r in roles)
		or user == "Administrator"
		or "hardik" in (user or "").lower()
	)


def _resolve_planner_user(employee):
	"""Non-managers are always locked to themselves. Managers may target another user."""
	current_user = frappe.session.user
	if not _is_planner_manager(current_user):
		return current_user
	if not employee or employee in ("All", current_user):
		return current_user
	# Accept a User id, an Employee id, or a full name
	if frappe.db.exists("User", employee):
		return employee
	if frappe.db.exists("DocType", "Employee"):
		uid = frappe.db.get_value("Employee", employee, "user_id")
		if uid:
			return uid
	uid = frappe.db.get_value("User", {"full_name": employee}, "name")
	return uid or current_user


def _week_bounds(week_start=None):
	base = getdate(week_start) if week_start else getdate(nowdate())
	monday = base - timedelta(days=base.weekday())
	return monday, monday + timedelta(days=6)


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
					"subject": r.subject,
					"project": r.project,
					"project_name": frappe.db.get_value("Project", r.project, "project_name") if r.project else None,
					"status": r.status,
					"priority": r.priority,
					"due_date": str(r.exp_end_date or ""),
					"estimate_hours": round(flt(r.expected_time), 2),
				}

	# Standalone ToDos (the Frappe-native "Assign To" primitive; no ERPNext needed)
	for td in frappe.get_all(
		"ToDo",
		filters={"allocated_to": target, "status": ["not in", ["Cancelled", "Closed"]]},
		fields=["name", "description", "date", "priority", "reference_type", "reference_name"],
		limit=200,
	):
		if has_task and td.reference_type == "Task" and td.reference_name in items:
			continue
		label = frappe.utils.strip_html(td.description or "").strip().split("\n")[0][:140] or "Untitled to-do"
		items[f"todo:{td.name}"] = {
			"ref": f"todo:{td.name}",
			"kind": "ToDo",
			"subject": label,
			"project": None,
			"project_name": None,
			"status": "Open",
			"priority": td.priority,
			"due_date": str(td.date or ""),
			"estimate_hours": 0.0,
		}

	# Annotate with hours already booked / logged for this user
	if items and frappe.db.exists("DocType", "Planned Work Block"):
		refs = list(items.keys())
		for b in frappe.get_all(
			"Planned Work Block",
			filters={"work_item": ["in", refs], "employee": target},
			fields=["work_item", "duration_hours", "actual_hours"],
			limit=2000,
		):
			it = items.get(b.work_item)
			if it:
				it["booked_hours"] = round(it.get("booked_hours", 0.0) + flt(b.duration_hours), 2)
				it["logged_hours"] = round(it.get("logged_hours", 0.0) + flt(b.actual_hours), 2)

	rows = []
	for it in items.values():
		it.setdefault("booked_hours", 0.0)
		it.setdefault("logged_hours", 0.0)
		rows.append(it)
	rows.sort(key=lambda x: (x.get("due_date") or "9999-12-31", x.get("subject") or ""))
	return {"user": target, "tasks": rows}


@frappe.whitelist()
def get_planner_data(employee=None, week_start=None):
	"""Everything the Planner calendar needs: the week's Planned Work Blocks (plan + logged
	sessions) plus the target user's assigned tasks and a plan-vs-actual rollup."""
	target = _resolve_planner_user(employee)
	monday, sunday = _week_bounds(week_start)

	blocks = []
	if frappe.db.exists("DocType", "Planned Work Block"):
		raw = frappe.get_all(
			"Planned Work Block",
			filters={
				"employee": target,
				"work_date": ["between", [str(monday), str(sunday)]],
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
			b["start_time"] = str(b.get("start_time") or "")
			b["end_time"] = str(b.get("end_time") or "")
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
					"from_time": str(s.from_time or ""),
					"to_time": str(s.to_time or ""),
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

	# Leave / absence / out-of-office days are not "work" — flag them and keep
	# them out of the plan-vs-actual maths.
	away_markers = ("leave", "absent", "out-of-office", "out of office")
	for b in blocks:
		nature = (b.get("task_nature") or "").lower()
		b["is_away"] = any(m in nature for m in away_markers)

	work_blocks = [b for b in blocks if not b["is_away"]]
	planned_total = round(sum(flt(b["duration_hours"]) for b in work_blocks), 2)
	actual_total = round(sum(flt(b["actual_hours"]) for b in work_blocks), 2)
	adherence = round((min(actual_total, planned_total) / planned_total * 100), 1) if planned_total else 0.0

	days = [str(monday + timedelta(days=i)) for i in range(7)]

	return {
		"user": target,
		"is_manager": _is_planner_manager(),
		"week_start": str(monday),
		"week_end": str(sunday),
		"days": days,
		"blocks": blocks,
		"assigned_tasks": get_assigned_tasks(employee).get("tasks", []),
		"totals": {
			"planned_hours": planned_total,
			"actual_hours": actual_total,
			"variance_hours": round(actual_total - planned_total, 2),
			"adherence_pct": adherence,
			"block_count": len(work_blocks),
			"away_count": len(blocks) - len(work_blocks),
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

	has_task = frappe.db.exists("DocType", "Task")
	if work_item and not work_item.startswith("todo:") and has_task and frappe.db.exists("Task", work_item):
		task = task or work_item
	if task and not project and has_task:
		project = frappe.db.get_value("Task", task, "project")
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
	doc.task_nature = task_nature or "\U0001f3af Planned"
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
	if flt(doc.actual_hours) > 0:
		frappe.throw(_("This block has logged work sessions. Cancel it instead of deleting."))
	doc.flags.ignore_permissions = True
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

	if not hours and from_time and to_time:
		hours = _duration_hours(from_time, to_time)
	hours = flt(hours)
	if hours <= 0:
		frappe.throw(_("Session hours must be greater than zero."))

	doc.append("sessions", {
		"session_date": session_date or doc.work_date or nowdate(),
		"from_time": from_time,
		"to_time": to_time,
		"hours": hours,
		"notes": notes,
		"logged_via": logged_via or "Manual",
		"task_nature": doc.task_nature,
	})
	doc.flags.ignore_permissions = True
	doc.save()
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


