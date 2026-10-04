# Copyright (c) 2026, OmmNoMi Automation LLP and contributors
# For license information, please see license.txt

import unittest
from datetime import datetime, timedelta
import frappe
from frappe.utils import nowdate, now_datetime, get_time, add_to_date
from omnitrack.notifications import (
	check_upcoming_planned_block_reminders,
	dispatch_block_notification,
	register_push_subscription
)


class TestUpcomingBlockNotifications(unittest.TestCase):
	"""TDD Test Suite for Google Calendar-Style Upcoming Planned Work Block Notifications."""

	def setUp(self):
		self.test_user = frappe.session.user or "Administrator"
		self.created_docs = []
		# Clear notification cache keys for clean test runs
		try:
			frappe.cache.delete_keys("omnitrack:notif_*")
		except Exception:
			pass

	def tearDown(self):
		"""Clean up test records created during execution."""
		for dt, dn in reversed(self.created_docs):
			if frappe.db.exists(dt, dn):
				try:
					frappe.delete_doc(dt, dn, force=True, ignore_permissions=True)
				except Exception:
					pass
		frappe.db.commit()

	def test_upcoming_10m_alert_dispatched(self):
		"""Test that a block scheduled starting in 10 minutes receives a T-10m early notification."""
		today = nowdate()
		now_dt = now_datetime()
		start_dt = now_dt + timedelta(minutes=10)
		end_dt = start_dt + timedelta(hours=1)

		block = frappe.new_doc("Planned Work Block")
		block.employee = self.test_user
		block.work_date = today
		block.start_time = start_dt.strftime("%H:%M:00")
		block.end_time = end_dt.strftime("%H:%M:00")
		block.duration_hours = 1.0
		block.work_item_label = "Prepare Client Demo"
		block.status = "Planned"
		block.insert(ignore_permissions=True)
		self.created_docs.append(("Planned Work Block", block.name))

		result = check_upcoming_planned_block_reminders(test_now=now_dt)
		self.assertGreaterEqual(result.get("alerts_10m_sent", 0), 1)

		# Deduplication invariant: Running immediately again must send 0 duplicate alerts
		repeat = check_upcoming_planned_block_reminders(test_now=now_dt)
		self.assertEqual(repeat.get("alerts_10m_sent", 0), 0)

	def test_on_time_start_alert_dispatched_with_actions(self):
		"""Test that a block scheduled starting now receives a T-0 exact start notification with action."""
		today = nowdate()
		now_dt = now_datetime()
		start_dt = now_dt
		end_dt = start_dt + timedelta(hours=1)

		block = frappe.new_doc("Planned Work Block")
		block.employee = self.test_user
		block.work_date = today
		block.start_time = start_dt.strftime("%H:%M:00")
		block.end_time = end_dt.strftime("%H:%M:00")
		block.duration_hours = 1.0
		block.work_item_label = "Quarterly Sprint Retrospective"
		block.status = "Planned"
		block.insert(ignore_permissions=True)
		self.created_docs.append(("Planned Work Block", block.name))

		result = check_upcoming_planned_block_reminders(test_now=now_dt)
		self.assertGreaterEqual(result.get("alerts_0m_sent", 0), 1)

		# Deduplication invariant
		repeat = check_upcoming_planned_block_reminders(test_now=now_dt)
		self.assertEqual(repeat.get("alerts_0m_sent", 0), 0)

	def test_active_session_suppresses_on_time_start_alert(self):
		"""If the user has already started the block, suppress the start reminder."""
		today = nowdate()
		now_dt = now_datetime()
		start_dt = now_dt
		end_dt = start_dt + timedelta(hours=1)

		block = frappe.new_doc("Planned Work Block")
		block.employee = self.test_user
		block.work_date = today
		block.start_time = start_dt.strftime("%H:%M:00")
		block.end_time = end_dt.strftime("%H:%M:00")
		block.duration_hours = 1.0
		block.work_item_label = "Deep Work Session"
		block.status = "In Progress"  # User already started early
		block.insert(ignore_permissions=True)
		self.created_docs.append(("Planned Work Block", block.name))

		result = check_upcoming_planned_block_reminders(test_now=now_dt)
		self.assertEqual(result.get("alerts_0m_sent", 0), 0)

	def test_block_outside_window_not_notified(self):
		"""A block scheduled 45 minutes in the future should not trigger early notifications."""
		today = nowdate()
		now_dt = now_datetime()
		start_dt = now_dt + timedelta(minutes=45)
		end_dt = start_dt + timedelta(hours=1)

		block = frappe.new_doc("Planned Work Block")
		block.employee = self.test_user
		block.work_date = today
		block.start_time = start_dt.strftime("%H:%M:00")
		block.end_time = end_dt.strftime("%H:%M:00")
		block.duration_hours = 1.0
		block.work_item_label = "Future Afternoon Task"
		block.status = "Planned"
		block.insert(ignore_permissions=True)
		self.created_docs.append(("Planned Work Block", block.name))

		result = check_upcoming_planned_block_reminders(test_now=now_dt)
		self.assertEqual(result.get("alerts_10m_sent", 0), 0)
		self.assertEqual(result.get("alerts_0m_sent", 0), 0)

