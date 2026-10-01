# Copyright (c) 2026, OmmNoMi Automation LLP and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.utils import getdate, nowdate


def get_min_session_words():
	"""Returns the configured minimum word count for work session notes (default: 15)."""
	min_words = 15
	try:
		if frappe.db.exists("DocType", "OmniTrack Settings"):
			meta = frappe.get_meta("OmniTrack Settings")
			if meta.has_field("min_session_words"):
				val = frappe.db.get_single_value("OmniTrack Settings", "min_session_words")
				if val is not None and str(val).strip() != "":
					val_int = int(val)
					if val_int >= 1:
						min_words = val_int
	except Exception:
		pass
	return min_words


def require_session_notes(notes):
	"""A timesheet with no description is not a record of anything — it is an hour
	with nothing attached to it. Refuse the write rather than inventing a
	placeholder, so the record has authentic, verifiable work behind it."""
	text = str(notes or "")
	for ch in ("\u2022", "-", "*", "\n", "\r", "\t", ",", ";", ":", "."):
		text = text.replace(ch, " ")
	words = [w for w in text.split() if len(w) > 0]
	min_words = get_min_session_words()

	if len(words) < min_words:
		frappe.throw(
			_("Session notes must contain at least {0} words describing what was accomplished (found {1} word{2}). "
			  "A manager, auditor, or client reviews these records. Concise, meaningful details ensure accurate billing, "
			  "payroll compliance, and operational traceability across all industries.").format(
				min_words, len(words), "" if len(words) == 1 else "s"
			)
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

