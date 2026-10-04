# Copyright (c) 2026, OmmNoMi Automation LLP and contributors
# For license information, please see license.txt

import unittest
from datetime import datetime, timedelta
import frappe
from frappe.utils import nowdate, add_days, getdate
from omnitrack.api.timesheet import convert_plan_to_actual, get_timeline_gaps
from omnitrack.api.stopwatch import check_runaway_timer_guard
from omnitrack.api.attendance import get_attendance_presence_variance


class TestTimesheetCapturePerfection(unittest.TestCase):
	"""TDD Test Suite for Zero-Leakage Timesheet Capture Features."""

	def setUp(self):
		self.test_user = frappe.session.user or "Administrator"
		self.created_docs = []

	def tearDown(self):
		"""Clean up test records created during execution."""
		for dt, dn in reversed(self.created_docs):
			if frappe.db.exists(dt, dn):
				try:
					frappe.delete_doc(dt, dn, force=True, ignore_permissions=True)
				except Exception:
					pass
		frappe.db.commit()

	def test_convert_plan_to_actual_full(self):
		"""Pillar 1: Convert an unlogged planned block to Logged (Full)."""
		today = nowdate()
		block = frappe.new_doc("Planned Work Block")
		block.employee = self.test_user
		block.work_date = today
		block.start_time = "10:00:00"
		block.end_time = "12:00:00"
		block.duration_hours = 2.0
		block.task_nature = "🎯 Planned"
		block.status = "Planned"
		block.deliverable_notes = "Original planned deliverable"
		block.insert(ignore_permissions=True)
		self.created_docs.append(("Planned Work Block", block.name))

		res = convert_plan_to_actual(block.name, session_notes="Executed exactly as planned.")
		self.assertEqual(res.get("status"), "success")

		# Reload and verify block invariants
		b = frappe.get_doc("Planned Work Block", block.name)
		self.assertEqual(b.status, "Logged (Full)")
		self.assertEqual(flt_round(b.actual_hours), 2.0)
		self.assertEqual(len(b.sessions), 1)
		self.assertEqual(str(b.sessions[0].from_time), "10:00:00")
		self.assertEqual(str(b.sessions[0].to_time), "12:00:00")
		self.assertEqual(flt_round(b.sessions[0].hours), 2.0)
		self.assertEqual(b.sessions[0].notes, "Executed exactly as planned.")

	def test_convert_plan_to_actual_partial(self):
		"""Pillar 1: Convert a planned block with partial actual hours."""
		today = nowdate()
		block = frappe.new_doc("Planned Work Block")
		block.employee = self.test_user
		block.work_date = today
		block.start_time = "14:00:00"
		block.end_time = "16:00:00"
		block.duration_hours = 2.0
		block.task_nature = "🎯 Planned"
		block.status = "Planned"
		block.deliverable_notes = "Feature sprint"
		block.insert(ignore_permissions=True)
		self.created_docs.append(("Planned Work Block", block.name))

		res = convert_plan_to_actual(block.name, actual_hours=1.5, session_notes="Finished early in 1.5h")
		self.assertEqual(res.get("status"), "success")

		b = frappe.get_doc("Planned Work Block", block.name)
		self.assertEqual(b.status, "Logged (Partial)")
		self.assertEqual(flt_round(b.actual_hours), 1.5)
		self.assertEqual(len(b.sessions), 1)
		self.assertEqual(str(b.sessions[0].from_time), "14:00:00")
		self.assertEqual(str(b.sessions[0].to_time), "15:30:00")
		self.assertEqual(flt_round(b.sessions[0].hours), 1.5)

	def test_runaway_timer_guard_detection(self):
		"""Pillar 3: Detect timers exceeding reasonable duration (e.g. > 4 hours or past block)."""
		# Timer started 5 hours ago
		start_ms = (datetime.now() - timedelta(hours=5)).timestamp() * 1000
		guard = check_runaway_timer_guard(start_ms=start_ms, scheduled_duration_hours=2.0)
		self.assertTrue(guard.get("is_runaway"))
		self.assertGreaterEqual(guard.get("elapsed_hours"), 4.9)
		self.assertEqual(guard.get("scheduled_hours"), 2.0)

	def test_timeline_gaps_calculation(self):
		"""Pillar 4: Calculate unlogged gaps between sessions."""
		today = nowdate()
		# Create two blocks with a gap between 11:00 and 12:00
		b1 = frappe.new_doc("Planned Work Block")
		b1.employee = self.test_user
		b1.work_date = today
		b1.start_time = "09:00:00"
		b1.end_time = "11:00:00"
		b1.duration_hours = 2.0
		b1.actual_hours = 2.0
		b1.status = "Logged (Full)"
		b1.deliverable_notes = "Session 1"
		b1.append("sessions", {
			"session_date": today,
			"from_time": "09:00:00",
			"to_time": "11:00:00",
			"hours": 2.0,
			"notes": "Session 1",
			"task_nature": "🎯 Planned"
		})
		b1.insert(ignore_permissions=True)
		self.created_docs.append(("Planned Work Block", b1.name))

		b2 = frappe.new_doc("Planned Work Block")
		b2.employee = self.test_user
		b2.work_date = today
		b2.start_time = "12:00:00"
		b2.end_time = "14:00:00"
		b2.duration_hours = 2.0
		b2.actual_hours = 2.0
		b2.status = "Logged (Full)"
		b2.deliverable_notes = "Session 2"
		b2.append("sessions", {
			"session_date": today,
			"from_time": "12:00:00",
			"to_time": "14:00:00",
			"hours": 2.0,
			"notes": "Session 2",
			"task_nature": "🎯 Planned"
		})
		b2.insert(ignore_permissions=True)
		self.created_docs.append(("Planned Work Block", b2.name))

		gaps = get_timeline_gaps(work_date=today, employee=self.test_user)
		self.assertIsInstance(gaps, list)
		# Look for gap between 11:00:00 and 12:00:00
		found_gap = any(g.get("from_time") == "11:00:00" and g.get("to_time") == "12:00:00" for g in gaps)
		self.assertTrue(found_gap)

	def test_attendance_presence_variance(self):
		"""Pillar 2: Presence variance calculation."""
		# Use isolated test date to avoid aggregating other test runs
		test_date = "2026-11-20"
		b = frappe.new_doc("Planned Work Block")
		b.employee = self.test_user
		b.work_date = test_date
		b.start_time = "10:00:00"
		b.end_time = "13:00:00"
		b.duration_hours = 3.0
		b.actual_hours = 3.0
		b.status = "Logged (Full)"
		b.deliverable_notes = "Sprint work"
		b.append("sessions", {
			"session_date": test_date,
			"from_time": "10:00:00",
			"to_time": "13:00:00",
			"hours": 3.0,
			"notes": "Sprint work",
			"task_nature": "🎯 Planned"
		})
		b.insert(ignore_permissions=True)
		self.created_docs.append(("Planned Work Block", b.name))

		res = get_attendance_presence_variance(employee=self.test_user, work_date=test_date)
		self.assertEqual(res.get("employee"), self.test_user)
		self.assertEqual(flt_round(res.get("total_logged_hours")), 3.0)
		self.assertIn(res.get("status_harmony"), ["Balanced", "Deficit", "Surplus"])


def flt_round(val):
	from frappe.utils import flt
	return round(flt(val), 2)

