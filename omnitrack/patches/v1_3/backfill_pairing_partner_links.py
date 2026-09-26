# Copyright (c) 2026, OmmNoMi Automation LLP and contributors
# For license information, please see license.txt

import frappe


def execute():
	"""
	[post_model_sync] Idempotent patch:
	Backfills reciprocal paired_block links on collaborative pairing blocks where
	pairing_partner is set but paired_block was omitted or unlinked.
	"""
	if not frappe.db.exists("DocType", "Planned Work Block"):
		return

	if not frappe.db.has_column("Planned Work Block", "paired_block") or not frappe.db.has_column("Planned Work Block", "pairing_partner"):
		return

	# Match reciprocal blocks on the same work_date and start_time
	frappe.db.sql("""
		UPDATE `tabPlanned Work Block` a
		INNER JOIN `tabPlanned Work Block` b
			ON a.work_date = b.work_date
			AND a.start_time = b.start_time
			AND a.pairing_partner = b.employee
			AND b.pairing_partner = a.employee
		SET a.paired_block = b.name
		WHERE (a.paired_block IS NULL OR a.paired_block = '')
		  AND a.pairing_partner IS NOT NULL
		  AND a.pairing_partner != ''
	""")
