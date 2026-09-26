# Copyright (c) 2026, OmmNoMi Automation LLP and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.utils import getdate, nowdate


def require_session_notes(notes):
	"""A timesheet with no description is not a record of anything — it is an hour
	with nothing attached to it. Refuse the write rather than inventing a
	placeholder, so the number in the report always has work behind it."""
	text = str(notes or "")
	for ch in ("\u2022", "-", "*"):
		text = text.replace(ch, " ")
	if len(text.strip()) < 3:
		frappe.throw(
			_("Add at least one line describing what you did before saving this timesheet. "
			  "A manager — and often the client being billed — reads this text, and an hour "
			  "with nothing written against it looks like an hour that was not worked.")
		)
	return str(notes).strip()


def validate_not_in_past(work_date):
	"""Historical plan commitments in the past (work_date < today) cannot be created or moved."""
	if work_date and getdate(work_date) < getdate(nowdate()):
		frappe.throw(_("Cannot plan or book work blocks in the past."), frappe.ValidationError)


def parse_block_tasks(val):
	"""Safely parses connected_tasks field from JSON, list, or newline-separated string."""
	import json
	if not val:
		return []
	if isinstance(val, list):
		return val
	if isinstance(val, str):
		val = val.strip()
		if not val:
			return []
		try:
			parsed = json.loads(val)
			if isinstance(parsed, list):
				return parsed
		except Exception:
			lines = [line.strip("- •* \t") for line in val.split("\n") if line.strip("- •* \t")]
			return [{"id": f"item:{idx}", "ref": f"item:{idx}", "doctype": "Item", "subject": line, "status": "Open"} for idx, line in enumerate(lines)]
	return []

