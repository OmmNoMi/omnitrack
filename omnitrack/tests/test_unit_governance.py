#!/usr/bin/env python3
# Copyright (c) 2026, OmmNoMi Automation LLP and contributors
# For license information, please see license.txt

import unittest
from unittest.mock import patch, MagicMock
from datetime import date, datetime, timedelta

# Create mock frappe before importing omnitrack modules if needed
import frappe
from frappe.utils import getdate, add_days, nowdate


class TestUnitTemporalGovernance(unittest.TestCase):
	"""Fast, isolated unit tests for OmniTrack temporal governance invariants without DB overhead."""

	def setUp(self):
		self.tz_patcher = patch("frappe.utils.data.get_system_timezone", return_value="Asia/Kolkata")
		self.tz_patcher.start()
		self.addCleanup(self.tz_patcher.stop)
		self.tr_patcher = patch("omnitrack.permissions._", side_effect=lambda msg: msg)
		self.tr_patcher.start()
		self.addCleanup(self.tr_patcher.stop)
		self.mock_user = "test_user@ommnomi.in"

	@patch("omnitrack.permissions.is_omnitrack_manager")
	@patch("omnitrack.permissions.get_timesheet_modification_horizon_hours")
	def test_standard_user_allowed_today_and_yesterday(self, mock_horizon, mock_is_manager):
		"""Invariant: Standard users can log/edit for today and yesterday within 48h horizon."""
		from omnitrack.permissions import check_timesheet_date_permission

		mock_is_manager.return_value = False
		mock_horizon.return_value = 48  # 48 hours = today & yesterday

		today = nowdate()
		yesterday = add_days(today, -1)

		# Both today and yesterday must pass cleanly without exception
		self.assertTrue(check_timesheet_date_permission(today, user=self.mock_user))
		self.assertTrue(check_timesheet_date_permission(yesterday, user=self.mock_user))

	@patch("omnitrack.permissions.is_omnitrack_manager")
	@patch("omnitrack.permissions.get_timesheet_modification_horizon_hours")
	def test_standard_user_blocked_prior_to_yesterday(self, mock_horizon, mock_is_manager):
		"""Invariant: Standard users are blocked from logging 2+ days in the past."""
		from omnitrack.permissions import check_timesheet_date_permission

		mock_is_manager.return_value = False
		mock_horizon.return_value = 48

		two_days_ago = add_days(nowdate(), -2)

		with self.assertRaises(frappe.PermissionError):
			check_timesheet_date_permission(two_days_ago, user=self.mock_user)

	@patch("omnitrack.permissions.is_omnitrack_manager")
	def test_manager_allowed_any_historical_date(self, mock_is_manager):
		"""Invariant: Managers and Admins can log/edit any historical date regardless of horizon."""
		from omnitrack.permissions import check_timesheet_date_permission

		mock_is_manager.return_value = True

		ten_days_ago = add_days(nowdate(), -10)
		self.assertTrue(check_timesheet_date_permission(ten_days_ago, user="manager@ommnomi.in"))

	def test_session_time_interval_calculation(self):
		"""Invariant: Session hours must be calculated correctly from from_time and to_time."""
		from frappe.utils import time_diff_in_hours

		h = time_diff_in_hours("10:30:00", "09:00:00")
		self.assertEqual(round(h, 2), 1.50)

		# Mandatory rule: to_time must be strictly after from_time
		h_zero = time_diff_in_hours("09:00:00", "09:00:00")
		self.assertEqual(h_zero, 0.0)


if __name__ == "__main__":
	unittest.main()
