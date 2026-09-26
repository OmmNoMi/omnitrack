# Copyright (c) 2026, OmmNoMi Automation LLP and contributors
# For license information, please see license.txt

from unittest.mock import patch
import frappe
from frappe.tests.utils import FrappeTestCase
from frappe.utils import add_days, getdate, nowdate

from omnitrack.api import book_work_block, update_work_block, delete_work_block, log_work_session
from omnitrack.permissions import (
	get_timesheet_modification_horizon_hours,
	get_past_block_lock_grace_hours,
	validate_timesheet_permission,
)


def _block(**kwargs):
	defaults = {
		"doctype": "Planned Work Block",
		"work_date": nowdate(),
		"start_time": "09:00:00",
		"end_time": "12:00:00",
		"task_nature": "🎯 Planned",
		"employee": "Administrator",
	}
	defaults.update(kwargs)
	doc = frappe.get_doc(defaults)
	doc.flags.ignore_permissions = True
	doc.flags.ignore_links = True
	return doc


class TestTemporalGovernance(FrappeTestCase):
	def setUp(self):
		super().setUp()
		commit_patcher = patch("frappe.db.commit")
		commit_patcher.start()
		self.addCleanup(commit_patcher.stop)

	def test_no_one_can_book_planned_work_block_in_past(self):
		"""Invariant: Past planned blocks are immutable. No one can book in the past."""
		today = nowdate()
		past_date = add_days(today, -1)

		with self.assertRaises(frappe.ValidationError):
			book_work_block(
				work_date=past_date,
				start_time="09:00:00",
				end_time="10:00:00",
				deliverable_notes="Trying to plan yesterday"
			)

	def test_no_one_can_modify_past_planned_work_block(self):
		"""Invariant: Once the work date has elapsed, neither user nor admin can edit or move it."""
		today = nowdate()
		past_date = add_days(today, -2)

		past_block = _block(work_date=past_date, start_time="09:00:00", end_time="11:00:00")
		past_block.flags.ignore_past_block_lock = True
		past_block.insert()

		with self.assertRaises(frappe.ValidationError):
			update_work_block(block_name=past_block.name, start_time="10:00:00")

		with self.assertRaises(frappe.ValidationError):
			update_work_block(block_name=past_block.name, work_date=today)

	def test_no_one_can_delete_past_planned_work_block(self):
		"""Invariant: Past planned blocks cannot be deleted by anyone."""
		today = nowdate()
		past_date = add_days(today, -3)

		past_block = _block(work_date=past_date, start_time="09:00:00", end_time="11:00:00")
		past_block.flags.ignore_past_block_lock = True
		past_block.insert()

		with self.assertRaises(frappe.ValidationError):
			delete_work_block(block_name=past_block.name)

	def test_user_cannot_log_session_before_yesterday(self):
		"""Invariant: Regular users can only log for today & yesterday."""
		today = nowdate()
		two_days_ago = add_days(today, -2)

		b = _block(work_date=today, start_time="14:00:00", end_time="16:00:00", employee="test1@example.com").insert()

		frappe.set_user("test1@example.com")
		try:
			with patch("frappe.get_roles", return_value=["OmniTrack User"]):
				with self.assertRaises(frappe.PermissionError):
					log_work_session(
						block_name=b.name,
						session_date=two_days_ago,
						hours=1.0,
						notes="Attempting historical log"
					)
		finally:
			frappe.set_user("Administrator")

	def test_manager_can_log_session_before_yesterday(self):
		"""Invariant: Managers can adjust/log historical sessions beyond yesterday."""
		today = nowdate()
		three_days_ago = add_days(today, -3)

		b = _block(work_date=today, start_time="14:00:00", end_time="16:00:00", employee="test1@example.com").insert()

		frappe.set_user("test2@example.com")
		try:
			with patch("frappe.get_roles", return_value=["OmniTrack Manager"]):
				res = log_work_session(
					block_name=b.name,
					session_date=three_days_ago,
					hours=1.5,
					notes="Manager approved historical adjustment"
				)
				self.assertEqual(res["status"], "success")
		finally:
			frappe.set_user("Administrator")

	def test_timesheet_permission_validator(self):
		today = nowdate()
		two_days_ago = add_days(today, -2)

		mock_ts_past = frappe._dict({
			"start_date": two_days_ago,
			"time_logs": [frappe._dict({"from_time": f"{two_days_ago} 10:00:00"})],
			"flags": frappe._dict()
		})
		mock_ts_today = frappe._dict({
			"start_date": today,
			"time_logs": [frappe._dict({"from_time": f"{today} 10:00:00"})],
			"flags": frappe._dict()
		})

		frappe.set_user("test1@example.com")
		try:
			with patch("frappe.get_roles", return_value=["OmniTrack User"]):
				with self.assertRaises(frappe.PermissionError):
					validate_timesheet_permission(mock_ts_past)
				# But can modify today's timesheet
				validate_timesheet_permission(mock_ts_today)
		finally:
			frappe.set_user("Administrator")

	def test_configurable_horizon_and_grace_hours(self):
		"""Admin-configured horizon hours dynamically expand timesheet modification windows."""
		self.assertEqual(get_timesheet_modification_horizon_hours(), 48)
		self.assertEqual(get_past_block_lock_grace_hours(), 24)
