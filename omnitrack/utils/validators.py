# Copyright (c) 2026, OmmNoMi Automation LLP and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.utils import getdate, nowdate


def _positive_setting(fieldname, default):
	"""A positive Int from OmniTrack Settings, or the default when unset or not migrated yet."""
	try:
		if frappe.db.exists("DocType", "OmniTrack Settings"):
			meta = frappe.get_meta("OmniTrack Settings")
			if meta.has_field(fieldname):
				val = frappe.db.get_single_value("OmniTrack Settings", fieldname)
				if val is not None and str(val).strip() != "" and int(val) >= 1:
					return int(val)
	except Exception:
		pass
	return default


def get_min_session_words():
	"""Returns the configured minimum word count for work session notes (default: 15)."""
	return _positive_setting("min_session_words", 15)


def get_min_log_line_chars():
	"""Returns the configured minimum length of one session log line (default: 10)."""
	return _positive_setting("min_log_line_chars", 10)


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

