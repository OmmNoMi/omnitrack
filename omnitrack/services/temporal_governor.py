# Copyright (c) 2026, OmmNoMi Automation LLP and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.utils import getdate, nowdate, add_days, flt
from omnitrack.permissions import (
	is_omnitrack_manager,
	get_timesheet_modification_horizon_hours,
	get_past_block_lock_grace_hours,
)


class TemporalGovernor:
	"""
	Domain Service enforcing temporal invariants for OmniTrack:
	1. Timesheet Modification Horizon: Regular users may only log, edit, or adjust timesheets
	   within the active horizon (default 48h / today & yesterday; configurable to 72h, 168h, etc.).
	   Earlier dates strictly require OmniTrack Manager or System Manager.
	2. Past Planned Work Blocks Lock: Once past the configured lock grace period,
	   historical plans are permanently immutable.
	"""

	@staticmethod
	def get_governance_settings():
		"""Returns (horizon_hours, grace_hours) from OmniTrack Settings."""
		return get_timesheet_modification_horizon_hours(), get_past_block_lock_grace_hours()

	@classmethod
	def check_timesheet_date_permission(cls, target_date, user=None):
		"""
		Validates if user can log/edit a timesheet session for target_date.
		Delegates to canonical permission checker in omnitrack.permissions.
		"""
		from omnitrack.permissions import check_timesheet_date_permission as perm_check
		return perm_check(target_date, user)

	@classmethod
	def validate_planned_block_not_in_past(cls, work_date, operation="modify"):
		"""
		Validates that a planned work block is NOT in the past.
		Applies to ALL users including System Manager and Administrator.
		"""
		if not work_date:
			return True

		target_dt = getdate(work_date)
		today_dt = getdate(nowdate())

		if target_dt < today_dt:
			frappe.throw(
				_("Historical plan commitments are permanently immutable. "
				  "You cannot {0} a planned work block for a past date ({1}).").format(
					operation, work_date
				),
				frappe.ValidationError
			)
		return True
