import frappe
from frappe.tests.utils import FrappeTestCase

# ommnomi.local has no ERPNext: the Link targets Project / Task / Timesheet do not exist,
# so the test-record dependency scanner must not try to generate them.
IGNORE_TEST_RECORD_DEPENDENCIES = ["Project", "Task", "Timesheet"]


def _block(**kw):
	doc = frappe.new_doc("Planned Work Block")
	doc.update({
		"employee": "Administrator",
		"work_date": "2026-09-10",
		"start_time": "09:00:00",
		"end_time": "11:00:00",
	})
	doc.update(kw)
	doc.flags.ignore_permissions = True
	return doc


class TestPlannedWorkBlock(FrappeTestCase):
	"""Invariants for the plan-vs-actual roll-up. These cover future changes to
	`calculate_duration` / `roll_up_sessions` — do not weaken them.
	"""

	def test_duration_from_times(self):
		doc = _block(start_time="09:00:00", end_time="13:30:00").insert()
		self.assertEqual(doc.duration_hours, 4.5)

	def test_duration_splits_over_midnight(self):
		doc = _block(start_time="23:00:00", end_time="02:00:00").insert()
		self.assertEqual(doc.duration_hours, 3.0)

	def test_actual_is_sum_of_sessions_and_variance_is_actual_minus_planned(self):
		doc = _block(start_time="09:00:00", end_time="12:00:00")  # planned 3h
		doc.append("sessions", {"session_date": "2026-09-10", "hours": 1.25})
		doc.append("sessions", {"session_date": "2026-09-10", "hours": 0.75})
		doc.insert()
		self.assertEqual(doc.actual_hours, 2.0)
		self.assertEqual(doc.variance_hours, -1.0)

		doc.append("sessions", {"session_date": "2026-09-10", "hours": 2.0})
		doc.save()
		self.assertEqual(doc.actual_hours, 4.0)
		self.assertEqual(doc.variance_hours, 1.0)  # overran the plan

	def test_status_tracks_reality_unless_cancelled(self):
		doc = _block(start_time="09:00:00", end_time="12:00:00").insert()
		self.assertEqual(doc.status, "Planned")

		doc.append("sessions", {"session_date": "2026-09-10", "hours": 1.0})
		doc.save()
		self.assertEqual(doc.status, "In Progress")

		doc.append("sessions", {"session_date": "2026-09-10", "hours": 2.0})
		doc.save()
		self.assertEqual(doc.status, "Completed")

		doc.status = "Cancelled"
		doc.save()
		self.assertEqual(doc.status, "Cancelled")  # never auto-advanced away from Cancelled

	def tearDown(self):
		frappe.db.rollback()
