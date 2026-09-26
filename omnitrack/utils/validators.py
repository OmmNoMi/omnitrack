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
