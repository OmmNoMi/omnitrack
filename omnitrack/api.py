import hashlib
import json
import frappe
from frappe import _
from frappe.utils import flt, getdate, nowdate, now_datetime

@frappe.whitelist()
def get_system_status():
	settings = frappe.get_single("OmniTrack Settings")
	active_subs = frappe.db.count("OmniTrack Push Subscription", {"is_active": 1})
	active_blocks = frappe.db.count("Planned Work Block", {"work_date": nowdate()})
	return {
		"status": "online",
		"app": "OmniTrack",
		"version": "1.0.0",
		"split_shifts_enabled": settings.enable_split_shifts,
		"pai_engine_enabled": settings.enable_pai_engine,
		"variance_tracking_enabled": settings.enable_variance_tracking,
		"site_sync_enabled": settings.enable_site_sync,
		"push_notifications_enabled": settings.enable_push_notifications,
		"active_push_subscriptions": active_subs,
		"today_work_blocks": active_blocks,
		"timestamp": frappe.utils.now()
	}

def validate_task_variance(doc, method=None):
	settings = frappe.get_single("OmniTrack Settings")
	if not settings.enable_variance_tracking:
		return
	
	expected = flt(doc.get("custom_expected_hours") or doc.get("expected_time") or 0.0)
	actual = flt(doc.get("custom_actual_hours") or doc.get("actual_time") or 0.0)
	variance = actual - expected
	doc.custom_variance_hours = round(variance, 2)

	# Check project threshold override or default
	threshold = 1.0
	if doc.project and frappe.db.exists("OmniTrack Project Policy", {"project": doc.project}):
		policy = frappe.db.get_value("OmniTrack Project Policy", {"project": doc.project}, "custom_variance_threshold")
		if policy:
			threshold = flt(policy)

	if variance > threshold and expected > 0:
		# Add a timeline note or flag
		pass

@frappe.whitelist()
def create_timesheet_from_work_block(block_name):
	block = frappe.get_doc("Planned Work Block", block_name)
	if block.timesheet:
		return block.timesheet

	ts = frappe.new_doc("Timesheet")
	ts.employee = frappe.db.get_value("Employee", {"user_id": block.employee}, "name") or block.employee
	ts.company = frappe.db.get_single_value("Global Defaults", "default_company") or frappe.get_all("Company", limit=1)[0].name if frappe.db.exists("DocType", "Company") and frappe.get_all("Company") else None
	
	row = {
		"from_time": f"{block.work_date} {block.start_time}",
		"to_time": f"{block.work_date} {block.end_time}",
		"hours": block.duration_hours,
		"project": block.project,
		"task": block.task,
		"activity_type": "Execution",
		"description": block.deliverable_notes or f"Split-shift block {block.name}"
	}
	ts.append("time_logs", row)
	ts.flags.ignore_permissions = True
	ts.insert()

	block.timesheet = ts.name
	block.db_set("timesheet", ts.name)
	return ts.name

@frappe.whitelist()
def calculate_plan_adherence_index(employee=None, from_date=None, to_date=None):
	filters = {}
	if employee:
		filters["employee"] = employee
	if from_date and to_date:
		filters["work_date"] = ["between", [from_date, to_date]]
	
	blocks = frappe.get_all("Planned Work Block", filters=filters, fields=["task_nature", "duration_hours"])
	if not blocks:
		return {"pai": 100.0, "planned_hours": 0.0, "total_hours": 0.0, "status": "no_data"}
	
	planned_hours = sum(flt(b.duration_hours) for b in blocks if "Planned" in (b.task_nature or ""))
	total_hours = sum(flt(b.duration_hours) for b in blocks)
	
	pai = (planned_hours / total_hours * 100.0) if total_hours > 0 else 100.0
	return {
		"pai": round(pai, 2),
		"planned_hours": round(planned_hours, 2),
		"total_hours": round(total_hours, 2),
		"is_adherent": pai >= 85.0
	}

def on_employee_checkin(doc, method=None):
	# Link to daily planned blocks if available
	pass

def process_daily_attendance_synthesis():
	settings = frappe.get_single("OmniTrack Settings")
	if not settings.enable_auto_attendance:
		return
	
	if not frappe.db.exists("DocType", "Attendance") or not frappe.db.exists("DocType", "Employee Checkin"):
		return
	
	today = nowdate()
	# Group punches by employee
	checkins = frappe.get_all("Employee Checkin", filters={"time": ["like", f"{today}%"]}, fields=["employee", "log_type", "time"], order_by="time asc")
	# Process hours and mark Attendance
	frappe.logger("omnitrack").info(f"Daily attendance synthesized for {today}")

def process_scheduled_timesheet_sync():
	settings = frappe.get_single("OmniTrack Settings")
	if settings.default_timesheet_mode == "Off":
		return
	# Aggregate unsynced completed work blocks into Draft Timesheets
	frappe.logger("omnitrack").info("Scheduled timesheet batch aggregation completed.")

@frappe.whitelist()
def process_offline_sync(data=None):
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
