import hashlib
import json
from datetime import datetime, timedelta
import frappe
from frappe import _
from frappe.utils import flt, getdate, get_time, nowdate, now_datetime, time_diff_in_hours

def get_midnight_cutoff():
	"""Returns the cutoff time (default 04:00:00) before which punches map to previous day."""
	settings = frappe.get_single("OmniTrack Settings")
	return getattr(settings, "midnight_cutoff_hour", "04:00:00") or "04:00:00"

@frappe.whitelist()
def synthesize_employee_attendance(employee, attendance_date=None):
	"""
	Core Split-Shift & Midnight Spanning Attendance Synthesizer.
	Correlates multi-session IN/OUT punches across midnight boundaries,
	evaluates working hours, late entries, early exits, and generates/updates Attendance.
	"""
	if not attendance_date:
		attendance_date = nowdate()
	attendance_date = str(getdate(attendance_date))

	settings = frappe.get_single("OmniTrack Settings")
	min_present = flt(getattr(settings, "min_hours_present", 6.0) or 6.0)
	min_half_day = flt(getattr(settings, "min_hours_half_day", 3.0) or 3.0)
	grace_period = flt(getattr(settings, "grace_period_mins", 15) or 15)
	cutoff_str = str(get_midnight_cutoff())

	# Calculate window: from attendance_date 00:00:00 to attendance_date + 1 day at cutoff_str
	start_window = f"{attendance_date} 00:00:00"
	next_date = str(getdate(attendance_date) + timedelta(days=1))
	end_window = f"{next_date} {cutoff_str}"

	if not frappe.db.exists("DocType", "Employee Checkin"):
		return {"status": "skipped", "message": "Employee Checkin DocType not found"}

	# Fetch raw checkins in window
	checkins = frappe.get_all(
		"Employee Checkin",
		filters={
			"employee": employee,
			"time": ["between", [start_window, end_window]]
		},
		fields=["name", "log_type", "time", "device_id"],
		order_by="time asc"
	)

	if not checkins:
		return {
			"status": "no_punches",
			"employee": employee,
			"date": attendance_date,
			"total_hours": 0.0,
			"attendance_status": "Absent"
		}

	# Check for Shift Split Assignment
	shift_template = None
	if frappe.db.exists("DocType", "OmniTrack Shift Split Assignment"):
		assignment = frappe.get_all(
			"OmniTrack Shift Split Assignment",
			filters={
				"employee": employee,
				"status": "Active",
				"start_date": ["<=", attendance_date]
			},
			fields=["shift_template", "end_date"],
			order_by="start_date desc",
			limit=1
		)
		if assignment and (not assignment[0].end_date or str(assignment[0].end_date) >= attendance_date):
			shift_template = assignment[0].shift_template

	# Pair IN and OUT punches
	total_working_seconds = 0.0
	pairs = []
	current_in = None
	raw_uids = []

	for chk in checkins:
		raw_uids.append(chk.name)
		ltype = (chk.log_type or "IN").upper()
		chk_time = chk.time if isinstance(chk.time, datetime) else datetime.strptime(str(chk.time)[:19], "%Y-%m-%d %H:%M:%S")

		if ltype == "IN":
			if current_in is None:
				current_in = chk_time
		elif ltype == "OUT":
			if current_in:
				duration = (chk_time - current_in).total_seconds()
				if duration > 0:
					total_working_seconds += duration
					pairs.append((current_in, chk_time))
				current_in = None

	total_working_hours = round(total_working_seconds / 3600.0, 2)

	# Determine Attendance Status
	if total_working_hours >= min_present:
		status = "Present"
	elif total_working_hours >= min_half_day:
		status = "Half Day"
	else:
		status = "Absent"

	# Calculate Late Entry / Early Exit if Shift Template is available
	late_entry_mins = 0.0
	early_exit_mins = 0.0
	if shift_template and frappe.db.exists("OmniTrack Shift Template", shift_template):
		st_doc = frappe.get_doc("OmniTrack Shift Template", shift_template)
		if st_doc.sessions and pairs:
			first_session = st_doc.sessions[0]
			last_session = st_doc.sessions[-1]

			sched_start = datetime.strptime(f"{attendance_date} {first_session.start_time}", "%Y-%m-%d %H:%M:%S")
			actual_first_in = pairs[0][0]
			if actual_first_in > sched_start:
				diff_mins = (actual_first_in - sched_start).total_seconds() / 60.0
				if diff_mins > grace_period:
					late_entry_mins = round(diff_mins, 1)

			sched_end_date = next_date if getattr(last_session, "spans_midnight", 0) else attendance_date
			sched_end = datetime.strptime(f"{sched_end_date} {last_session.end_time}", "%Y-%m-%d %H:%M:%S")
			actual_last_out = pairs[-1][1]
			if actual_last_out < sched_end:
				diff_mins = (sched_end - actual_last_out).total_seconds() / 60.0
				if diff_mins > grace_period:
					early_exit_mins = round(diff_mins, 1)

	# Update or Create Attendance Doc
	att_doc_name = None
	if frappe.db.exists("DocType", "Attendance"):
		existing = frappe.get_all("Attendance", filters={"employee": employee, "attendance_date": attendance_date}, limit=1)
		if existing:
			att = frappe.get_doc("Attendance", existing[0].name)
			att.status = status
			att.working_hours = total_working_hours
			if hasattr(att, "late_entry"):
				att.late_entry = 1 if late_entry_mins > 0 else 0
			if hasattr(att, "early_exit"):
				att.early_exit = 1 if early_exit_mins > 0 else 0
			att.flags.ignore_permissions = True
			att.save()
			att_doc_name = att.name
		else:
			company = frappe.db.get_value("Employee", employee, "company") or frappe.db.get_single_value("Global Defaults", "default_company")
			att = frappe.new_doc("Attendance")
			att.employee = employee
			att.attendance_date = attendance_date
			att.status = status
			att.working_hours = total_working_hours
			att.company = company
			if hasattr(att, "late_entry"):
				att.late_entry = 1 if late_entry_mins > 0 else 0
			if hasattr(att, "early_exit"):
				att.early_exit = 1 if early_exit_mins > 0 else 0
			att.flags.ignore_permissions = True
			att.insert()
			att_doc_name = att.name

	# Create or Update Synthesizer Log
	log_name = None
	if frappe.db.exists("DocType", "OmniTrack Attendance Synthesizer Log"):
		existing_log = frappe.get_all("OmniTrack Attendance Synthesizer Log", filters={"employee": employee, "attendance_date": attendance_date}, limit=1)
		if existing_log:
			syn_log = frappe.get_doc("OmniTrack Attendance Synthesizer Log", existing_log[0].name)
		else:
			syn_log = frappe.new_doc("OmniTrack Attendance Synthesizer Log")
			syn_log.employee = employee
			syn_log.attendance_date = attendance_date

		syn_log.synthesized_status = status
		syn_log.total_working_hours = total_working_hours
		syn_log.effective_sessions_completed = len(pairs)
		syn_log.late_entry_mins = late_entry_mins
		syn_log.early_exit_mins = early_exit_mins
		syn_log.generated_attendance_doc = att_doc_name
		syn_log.raw_checkin_uids = json.dumps(raw_uids)
		syn_log.flags.ignore_permissions = True
		syn_log.save()
		log_name = syn_log.name

	return {
		"status": "success",
		"employee": employee,
		"date": attendance_date,
		"total_hours": total_working_hours,
		"sessions_completed": len(pairs),
		"attendance_status": status,
		"attendance_doc": att_doc_name,
		"synthesizer_log": log_name,
		"late_entry_mins": late_entry_mins,
		"early_exit_mins": early_exit_mins
	}

@frappe.whitelist()
def synthesize_all_active_employees(attendance_date=None):
	"""Batch synthesis job for all active employees."""
	if not attendance_date:
		attendance_date = nowdate()

	employees = frappe.get_all("Employee", filters={"status": "Active"}, pluck="name") if frappe.db.exists("DocType", "Employee") else []
	results = []
	for emp in employees:
		res = synthesize_employee_attendance(emp, attendance_date)
		results.append(res)
	return {"date": attendance_date, "total_processed": len(results), "results": results}

def on_checkin_event(doc, method=None):
	"""Event hook when an Employee Checkin record is inserted or updated."""
	settings = frappe.get_single("OmniTrack Settings")
	if getattr(settings, "auto_synthesize_attendance_on_checkin", 1):
		# Determine target attendance date based on midnight cutoff
		cutoff_str = str(get_midnight_cutoff())
		chk_time = doc.time if isinstance(doc.time, datetime) else datetime.strptime(str(doc.time)[:19], "%Y-%m-%d %H:%M:%S")
		cutoff_time = datetime.strptime(f"{chk_time.strftime('%Y-%m-%d')} {cutoff_str}", "%Y-%m-%d %H:%M:%S")

		target_date = chk_time.date()
		if chk_time < cutoff_time:
			# Punches before 04:00 AM belong to yesterday's shift
			target_date = target_date - timedelta(days=1)

		synthesize_employee_attendance(doc.employee, str(target_date))

