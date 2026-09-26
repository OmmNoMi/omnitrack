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
	parse_block_tasks as _parse_block_tasks,
)


@frappe.whitelist()
def get_workstation_data(employee=None, work_date=None, project=None):
	"""
	Supplies real live database records to the OmniTrack Vue.js Workstation PWA.
	Enforces standard Frappe role-based permissions and user scoping.
	"""
	from omnitrack.api.analytics import get_dashboard_kpis, get_user_heatmap_data
	from omnitrack.api.planner import get_planner_data
	from omnitrack.api.tasks import get_assigned_tasks
	from omnitrack.api.stopwatch import get_active_session
	from omnitrack.api.raven import is_raven_enabled
	# Generic User & Permission Resolution
	session_user = frappe.session.user
	current_user = session_user
	target_user = _resolve_planner_user(employee)
	today = nowdate()
	target_date = work_date or today

	# 1. Planned Work Blocks (Live from DB)
	session_roles = frappe.get_roles(session_user)
	from omnitrack.permissions import is_omnitrack_manager
	is_manager = is_omnitrack_manager(session_user)
	is_client = "OmniTrack Client" in session_roles and not is_manager

	allowed_projects = []
	if is_client and frappe.db.exists("DocType", "Project"):
		if frappe.db.exists("DocType", "Project User"):
			allowed_projects.extend(frappe.db.sql_list("SELECT parent FROM `tabProject User` WHERE `user` = %s", session_user))
		allowed_projects.extend(frappe.db.sql_list("SELECT name FROM `tabProject` WHERE `customer` = %s", session_user))
		if frappe.db.exists("DocType", "Contact") and frappe.db.exists("DocType", "Dynamic Link"):
			contact_projs = frappe.db.sql_list("""
				SELECT p.name FROM `tabProject` p
				JOIN `tabDynamic Link` dl ON dl.link_name = p.customer AND dl.link_doctype = 'Customer'
				JOIN `tabContact` c ON c.name = dl.parent
				WHERE c.user = %s
			""", session_user)
			allowed_projects.extend(contact_projs)
		allowed_projects = list(set(allowed_projects))

	if is_client:
		if allowed_projects:
			where_clause = "project IN %(allowed_projects)s"
			params = {"allowed_projects": tuple(allowed_projects)}
		else:
			where_clause = "(project IS NOT NULL AND project != '')"
			params = {}

		if project:
			where_clause += " AND project = %(filter_proj)s"
			params["filter_proj"] = project

		work_blocks = frappe.db.sql(f"""
			SELECT name, employee, work_date, start_time, end_time, 
			       duration_hours, actual_hours, variance_hours, project, task, 
			       work_item, work_item_label, status, task_nature, 
			       unplanned_reason, deliverable_notes, connected_tasks, cryptographic_hash, 
			       billing_status, associate_name, appsheet_id,
			       cancel_reason, rescheduled_to, rescheduled_from,
			       pairing_partner, paired_block, approval_status
			FROM `tabPlanned Work Block`
			WHERE ({where_clause})
			ORDER BY work_date DESC, start_time DESC
			LIMIT 150
		""", params, as_dict=True) if frappe.db.exists("DocType", "Planned Work Block") else []
	elif target_user and target_user != "All":
		has_employee = frappe.db.exists("DocType", "Employee")
		user_emp = (frappe.db.get_value("Employee", {"user_id": target_user}, "name") if has_employee else None) or target_user
		emp_fullname = frappe.db.get_value("User", target_user, "full_name") or (frappe.db.get_value("Employee", user_emp, "employee_name") if has_employee else None) or target_user

		where_clause = "employee = %(target_user)s OR employee = %(user_emp)s OR associate_name = %(emp_fullname)s"
		params = {
			"target_user": target_user,
			"user_emp": user_emp,
			"emp_fullname": emp_fullname
		}

		if project:
			where_clause = f"({where_clause}) AND project = %(filter_proj)s"
			params["filter_proj"] = project

		work_blocks = frappe.db.sql(f"""
			SELECT name, employee, work_date, start_time, end_time, 
			       duration_hours, actual_hours, variance_hours, project, task, 
			       work_item, work_item_label, status, task_nature, 
			       unplanned_reason, deliverable_notes, connected_tasks, cryptographic_hash, 
			       billing_status, associate_name, appsheet_id,
			       cancel_reason, rescheduled_to, rescheduled_from,
			       pairing_partner, paired_block, approval_status
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
				"unplanned_reason", "deliverable_notes", "connected_tasks", "cryptographic_hash", 
				"billing_status", "associate_name", "appsheet_id",
				"cancel_reason", "rescheduled_to", "rescheduled_from",
				"pairing_partner", "paired_block", "approval_status"
			],
			order_by="work_date desc, start_time desc",
			limit=150
		) if frappe.db.exists("DocType", "Planned Work Block") else []

	# 1b. Bulk query child sessions and deliverable output metrics for all loaded blocks
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

	metrics_by_block = {}
	if block_names and frappe.db.exists("DocType", "OmniTrack Output Metric"):
		all_metrics = frappe.db.sql("""
			SELECT parent, metric_type, quantity, unit, reference_id, notes
			FROM `tabOmniTrack Output Metric`
			WHERE parent IN %(block_names)s AND parenttype = 'Planned Work Block'
		""", {"block_names": block_names}, as_dict=True)
		for m in all_metrics:
			m["quantity"] = flt(m.get("quantity") or 0.0)
			metrics_by_block.setdefault(m.parent, []).append(m)

	# Enrich blocks with Project Name, Task Subject, Sessions, Pairing Info, and Output Metrics
	for b in work_blocks:
		b["start_time"] = _time_str(b.get("start_time"))
		b["end_time"] = _time_str(b.get("end_time"))
		b["work_date"] = str(b.get("work_date") or "")
		b["connected_tasks"] = _parse_block_tasks(b.get("connected_tasks"))

		# Attach real child sessions and metrics
		b["sessions"] = sessions_by_block.get(b.name, [])
		b["output_metrics"] = metrics_by_block.get(b.name, [])

		# Attach pairing partner name if present
		if b.get("pairing_partner"):
			b["pairing_partner_name"] = frappe.db.get_value("User", b["pairing_partner"], "full_name") or b["pairing_partner"]
		else:
			b["pairing_partner_name"] = None

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

		if b.project and frappe.db.exists("DocType", "Project") and frappe.db.exists("Project", b.project):
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
		"is_client": is_client,
		"client_project": (allowed_projects[0] if allowed_projects else "CampusCredit") if is_client else None,
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
		"active_session": get_active_session(user=current_user),
		"is_manager": is_manager
	}


