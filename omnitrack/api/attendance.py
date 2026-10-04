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


def on_employee_checkin(doc, method=None):
	"""Event hook when an Employee Checkin record is logged."""
	pass


def process_daily_attendance_synthesis():
	"""Scheduled daily job to synthesize attendance records across all employees."""
	frappe.logger("omnitrack").info("Daily attendance synthesis cron triggered.")


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


@frappe.whitelist()
def get_attendance_presence_variance(employee=None, work_date=None):
	"""
	Pillar 2: Attendance Check-in vs. Timesheet Gap Reconciler.
	Computes shift presence duration from Employee Checkin / Attendance
	against total logged timesheet hours in Planned Work Blocks.
	Identifies unallocated office presence time.
	"""
	user = _resolve_planner_user(employee)
	target_date = work_date or nowdate()

	# 1. Calculate Logged Timesheet Hours from Planned Work Blocks
	blocks = frappe.get_all(
		"Planned Work Block",
		filters={"employee": user, "work_date": target_date},
		fields=["name", "actual_hours", "duration_hours", "status"],
		limit=100
	)
	total_logged_hours = sum(flt(b.get("actual_hours", 0)) for b in blocks)
	total_planned_hours = sum(flt(b.get("duration_hours", 0)) for b in blocks)

	# 2. Calculate Shift Presence from Employee Checkin
	shift_presence_hours = 0.0
	first_in = None
	last_out = None

	if frappe.db.exists("DocType", "Employee"):
		emp_name = frappe.db.get_value("Employee", {"user_id": user}, "name")
		if emp_name and frappe.db.exists("DocType", "Employee Checkin"):
			start_win = f"{target_date} 00:00:00"
			end_win = f"{target_date} 23:59:59"
			checkins = frappe.get_all(
				"Employee Checkin",
				filters={"employee": emp_name, "time": ["between", [start_win, end_win]]},
				fields=["log_type", "time"],
				order_by="time asc"
			)
			if checkins:
				for chk in checkins:
					ltype = (chk.log_type or "IN").upper()
					if ltype == "IN" and not first_in:
						first_in = chk.time
					elif ltype == "OUT":
						last_out = chk.time

				if first_in and last_out:
					f_dt = first_in if isinstance(first_in, datetime) else get_datetime(first_in)
					l_dt = last_out if isinstance(last_out, datetime) else get_datetime(last_out)
					diff_sec = max(0, (l_dt - f_dt).total_seconds())
					shift_presence_hours = round(diff_sec / 3600.0, 2)
				elif first_in and not last_out:
					# Still in office; calculate up to now if today
					if str(target_date) == str(nowdate()):
						f_dt = first_in if isinstance(first_in, datetime) else get_datetime(first_in)
						diff_sec = max(0, (datetime.now() - f_dt).total_seconds())
						shift_presence_hours = round(diff_sec / 3600.0, 2)

	# Fallback: Check Attendance document working hours if checkins absent
	if shift_presence_hours <= 0 and frappe.db.exists("DocType", "Attendance"):
		emp_name = frappe.db.get_value("Employee", {"user_id": user}, "name") if frappe.db.exists("DocType", "Employee") else None
		if emp_name:
			att = frappe.db.get_value(
				"Attendance",
				{"employee": emp_name, "attendance_date": target_date, "docstatus": 1},
				["working_hours", "status"],
				as_dict=True
			)
			if att and att.get("working_hours"):
				shift_presence_hours = flt(att.working_hours)

	unallocated_presence_hours = max(0.0, round(shift_presence_hours - total_logged_hours, 2))

	status_harmony = "Balanced"
	if unallocated_presence_hours > 0.5:
		status_harmony = "Deficit"
	elif total_logged_hours > shift_presence_hours and shift_presence_hours > 0:
		status_harmony = "Surplus"

	return {
		"employee": user,
		"work_date": str(target_date),
		"shift_presence_hours": shift_presence_hours,
		"total_logged_hours": round(total_logged_hours, 2),
		"total_planned_hours": round(total_planned_hours, 2),
		"unallocated_presence_hours": unallocated_presence_hours,
		"status_harmony": status_harmony,
		"first_in": str(first_in) if first_in else None,
		"last_out": str(last_out) if last_out else None,
	}



