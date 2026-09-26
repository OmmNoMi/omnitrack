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


