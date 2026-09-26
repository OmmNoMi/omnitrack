# Copyright (c) 2026, OmmNoMi Automation LLP and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.utils import flt, nowdate


class TimesheetBridge:
	"""
	Domain Service managing synthesis of ERPNext Timesheets from OmniTrack Planned Work Blocks:
	Modes:
	- 'Never' (default): Zero ERPNext Timesheets are created or modified; sessions remain strictly in OmniTrack.
	- 'On Approval': Timesheets are only synthesized when an HR or Manager explicitly approves the block.
	- 'Immediate': Timesheets are auto-synced upon session completion.
	"""

	@staticmethod
	def get_timesheet_sync_mode():
		"""Returns the effective timesheet sync mode: 'Never', 'On Approval', or 'Immediate'."""
		try:
			settings = frappe.get_cached_doc("OmniTrack Settings")
			mode = getattr(settings, "default_timesheet_mode", "Never") or "Never"
		except Exception:
			mode = "Never"

		if mode in ("Never", "Off"):
			return "Never"
		elif mode in ("On Approval", "Manual On-Demand"):
			return "On Approval"
		elif mode in ("Immediate", "Auto Sync Draft", "Auto Draft"):
			return "Immediate"
		return "Never"

	@classmethod
	def sync_work_block_timesheet(cls, block_or_name, force=False):
		"""Synchronizes the linked Timesheet for a Planned Work Block."""
		if not frappe.db.exists("DocType", "Timesheet"):
			return None

		sync_mode = cls.get_timesheet_sync_mode()
		if not force and sync_mode == "Never":
			return None

		doc = block_or_name if hasattr(block_or_name, "sessions") else frappe.get_doc("Planned Work Block", block_or_name)
		if not force and sync_mode == "On Approval" and getattr(doc, "approval_status", None) != "Approved":
			return None

		from omnitrack.api import create_timesheet_from_work_block
		return create_timesheet_from_work_block(doc.name, force=force)
