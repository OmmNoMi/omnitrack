# Copyright (c) 2026, OmmNoMi Automation LLP and contributors
# For license information, please see license.txt

import frappe


def execute():
	"""
	[post_model_sync] Idempotent patch:
	The logging window is set in days now (log_days_back), not hours. A site that had set hours
	keeps the same reach, rounded to whole days; a site that never set it gets 15 days, because
	the old 48-hour default left people unable to catch up after two days.
	"""
	singles = frappe.qb.DocType("Singles")
	rows = (
		frappe.qb.from_(singles)
		.select(singles.field, singles.value)
		.where(singles.doctype == "OmniTrack Settings")
		.where(singles.field.isin(["log_days_back", "timesheet_modification_horizon_hours"]))
		.run(as_dict=True)
	)
	values = {r.field: r.value for r in rows}
	if int(float(values.get("log_days_back") or 0)) > 0:
		return
	hours = int(float(values.get("timesheet_modification_horizon_hours") or 0))
	# 48 was the default, not a choice anyone made
	days = round(hours / 24) if hours > 0 and hours != 48 else 15
	frappe.db.set_single_value("OmniTrack Settings", "log_days_back", max(days, 1))
