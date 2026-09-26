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
	week_bounds as _week_bounds,
)


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
		"output_metrics_enabled": getattr(settings, "enable_output_metrics", 1),
		"flow_state_catch_up_enabled": getattr(settings, "enable_flow_state_catch_up", 1),
		"task_switching_enabled": getattr(settings, "enable_task_switching", 1),
		"pairing_sessions_enabled": getattr(settings, "enable_pairing_sessions", 1),
		"lock_screen_actions_enabled": getattr(settings, "enable_lock_screen_actions", 1),
		"past_block_lock_grace_hours": getattr(settings, "past_block_lock_grace_hours", 24) or 24,
		"timesheet_modification_horizon_hours": getattr(settings, "timesheet_modification_horizon_hours", 48) or 48,
		"allow_submitted_timesheet_amendment": 1 if getattr(settings, "allow_submitted_timesheet_amendment", 1) is None or getattr(settings, "allow_submitted_timesheet_amendment", 1) == 1 else 0,
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


