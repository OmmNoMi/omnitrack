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
	doc.flags.ignore_links = True
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

	def test_log_work_session_splits_over_midnight(self):
		from omnitrack.api import log_work_session
		doc = _block(start_time="22:00:00", end_time="03:00:00", work_date="2026-09-10").insert()
		res = log_work_session(
			block_name=doc.name,
			from_time="23:00:00",
			to_time="02:00:00",
			session_date="2026-09-10",
			notes="Overnight deployment"
		)
		self.assertEqual(res["status"], "success")
		self.assertEqual(res["actual_hours"], 3.0)

		reloaded = frappe.get_doc("Planned Work Block", doc.name)
		self.assertEqual(len(reloaded.sessions), 2)
		s1, s2 = reloaded.sessions[0], reloaded.sessions[1]
		self.assertEqual(str(s1.session_date), "2026-09-10")
		self.assertEqual(s1.hours, 1.0)
		self.assertEqual(str(s2.session_date), "2026-09-11")
		self.assertEqual(s2.hours, 2.0)

	def test_quick_timer_punch_flexible_args(self):
		from omnitrack.api import quick_timer_punch
		res = quick_timer_punch(
			duration_hours=1.5,
			notes="Ad-hoc debug punch",
			task_nature="⚠️ Unplanned Ops"
		)
		self.assertEqual(res["status"], "success")
		block_name = res["block"]
		blk = frappe.get_doc("Planned Work Block", block_name)
		self.assertEqual(blk.duration_hours, 1.5)
		self.assertEqual(blk.task_nature, "⚠️ Unplanned")
		self.assertEqual(blk.status, "Completed")

	def test_planner_data_away_count(self):
		from omnitrack.api import get_planner_data
		# 2026-09-07 is Monday, 2026-09-13 is Sunday
		_block(work_date="2026-09-08", task_nature="🎯 Planned", duration_hours=4.0).insert()
		_block(work_date="2026-09-09", task_nature="🌴 Leave", duration_hours=8.0).insert()
		data = get_planner_data(employee="Administrator", week_start="2026-09-07")
		totals = data["totals"]
		self.assertGreaterEqual(totals["away_count"], 1)
		# Away blocks are excluded from planned_hours
		leave_block = next((b for b in data["blocks"] if b["work_date"] == "2026-09-09"), None)
		self.assertIsNotNone(leave_block)
		self.assertTrue(leave_block["is_away"])

	def test_planner_times_are_zero_padded(self):
		"""Every time string get_planner_data emits must be zero-padded HH:MM:SS.

		Frappe Time fields come back as timedelta, and str(timedelta) drops the
		leading zero on single-digit hours ("7:30:55"), which broke the calendar's
		hhmm() slice. This is an invariant over ALL blocks and sessions in the
		payload, so it also covers fields added later.
		"""
		import re
		doc = _block(work_date="2026-09-08", start_time="07:30:55", end_time="09:05:00")
		doc.append("sessions", {"session_date": "2026-09-08", "from_time": "08:00:00",
					"to_time": "09:00:00", "hours": 1.0})
		doc.insert()
		from omnitrack.api import get_planner_data
		data = get_planner_data(employee="Administrator", week_start="2026-09-07")
		pat = re.compile(r"^\d{2}:\d{2}:\d{2}$")
		checked = 0
		for b in data["blocks"]:
			for key in ("start_time", "end_time"):
				if b.get(key):
					self.assertRegex(b[key], pat, f"block {b['name']}.{key} = {b[key]!r}")
					checked += 1
			for sess in b.get("sessions") or []:
				for key in ("from_time", "to_time"):
					if sess.get(key):
						self.assertRegex(sess[key], pat, f"session.{key} = {sess[key]!r}")
						checked += 1
		self.assertGreater(checked, 0, "no time strings in payload — test is not exercising anything")

	def test_time_str_pads_single_digit_hours(self):
		from datetime import timedelta
		from omnitrack.api import _time_str
		self.assertEqual(_time_str(timedelta(hours=7, minutes=30, seconds=55)), "07:30:55")
		self.assertEqual(_time_str(timedelta(hours=23, minutes=46)), "23:46:00")
		self.assertEqual(_time_str("7:30:55"), "07:30:55")
		self.assertEqual(_time_str(None), "")
		self.assertEqual(_time_str(""), "")

	def test_planner_data_custom_date_range_4days(self):
		from omnitrack.api import get_planner_data
		data = get_planner_data(employee="Administrator", start_date="2026-09-08", end_date="2026-09-11")
		self.assertEqual(len(data["days"]), 4)
		self.assertEqual(data["days"][0], "2026-09-08")
		self.assertEqual(data["days"][3], "2026-09-11")

	def test_assigned_tasks_attention_detection(self):
		from omnitrack.api import get_assigned_tasks
		# Create a past ToDo to test overdue detection
		td = frappe.get_doc({
			"doctype": "ToDo",
			"description": "Critical unbooked test task",
			"allocated_to": "Administrator",
			"date": "2026-08-01",
			"priority": "High",
			"status": "Open",
		}).insert()
		res = get_assigned_tasks(employee="Administrator")
		att = res.get("attention_tasks", [])
		found = next((t for t in att if t.get("ref") == f"todo:{td.name}"), None)
		self.assertIsNotNone(found, "Overdue ToDo must be flagged in attention_tasks")
		self.assertEqual(found.get("attention_level"), "critical")
		self.assertTrue(found.get("is_overdue"))

	def test_break_leave_absent_are_non_working_non_paid(self):
		from omnitrack.api import get_planner_data, create_timesheet_from_work_block
		# Create blocks for Break, Leave, and Absent in an isolated week
		b_break = _block(work_date="2027-01-05", start_time="13:00:00", end_time="14:00:00", task_nature="☕ Break").insert()
		b_leave = _block(work_date="2027-01-06", start_time="09:00:00", end_time="17:00:00", task_nature="🌴 Leave").insert()
		b_absent = _block(work_date="2027-01-07", start_time="09:00:00", end_time="17:00:00", task_nature="🤒 Absent").insert()
		b_work = _block(work_date="2027-01-05", start_time="09:00:00", end_time="13:00:00", task_nature="🎯 Planned").insert()

		data = get_planner_data(employee="Administrator", week_start="2027-01-04")
		totals = data["totals"]
		# Planned hours must only sum working blocks, NOT break/leave/absent
		self.assertEqual(totals["planned_hours"], 4.0)
		self.assertEqual(totals["non_working_hours"], 17.0)
		self.assertEqual(totals["away_count"], 3)
		self.assertEqual(totals["block_count"], 1)

		# Check block flags
		break_block = next((b for b in data["blocks"] if b["name"] == b_break.name), None)
		self.assertIsNotNone(break_block)
		self.assertTrue(break_block["is_away"])
		self.assertFalse(break_block["is_working"])
		self.assertFalse(break_block["is_paid"])

		# Timesheet detail must have is_billable = 0 for non-working/non-paid blocks if Timesheet doctype exists
		ts_name = create_timesheet_from_work_block(b_break.name)
		if ts_name and frappe.db.exists("DocType", "Timesheet"):
			ts = frappe.get_doc("Timesheet", ts_name)
			self.assertEqual(ts.time_logs[0].is_billable, 0)
			self.assertEqual(ts.time_logs[0].activity_type, "Break")

	def test_project_inherited_from_task_to_block_and_timesheet(self):
		from unittest.mock import patch, MagicMock
		from omnitrack.api import create_timesheet_from_work_block

		# 1. Planned Work Block automatically inherits project from Task.project
		with patch("frappe.db.exists", side_effect=lambda dt, name=None: True if dt in ("DocType", "Task", "Project", "Timesheet") else False), \
		     patch("frappe.db.get_value", side_effect=lambda dt, nm, fld=None: "PROJ-ALPHA-100" if dt == "Task" and fld == "project" else "Administrator"):
			b = _block(task="TASK-2026-999", project=None)
			b.resolve_project_from_task()
			self.assertEqual(b.project, "PROJ-ALPHA-100")

		# 2. When creating a Timesheet, it is connected to the single project (parent_project)
		# and child time_logs inherit both project and task
		b = _block(task="TASK-2026-999", project="PROJ-ALPHA-100", deliverable_notes="Develop timesheet sync").insert()

		mock_ts = MagicMock()
		mock_ts.name = "TS-2026-00042"
		mock_ts.time_logs = []
		def fake_append(tbl, row):
			mock_ts.time_logs.append(row)
		mock_ts.append = fake_append

		def fake_exists(dt, name=None):
			if dt == "DocType":
				return name in ("Timesheet", "Planned Work Block")
			return True

		with patch("frappe.db.exists", side_effect=fake_exists), \
		     patch("frappe.new_doc", return_value=mock_ts):
			ts_name = create_timesheet_from_work_block(b.name)
			self.assertEqual(ts_name, "TS-2026-00042")
			self.assertEqual(mock_ts.parent_project, "PROJ-ALPHA-100")
			self.assertEqual(len(mock_ts.time_logs), 1)
			self.assertEqual(mock_ts.time_logs[0]["project"], "PROJ-ALPHA-100")
			self.assertEqual(mock_ts.time_logs[0]["task"], "TASK-2026-999")

	def test_project_team_and_client_permissions_for_work_blocks(self):
		from unittest.mock import patch
		from omnitrack.permissions import get_work_block_permission_query_conditions, has_work_block_permission

		b = _block(employee="teammate@example.com", project="PROJ-BETA-200")

		# 1. Project Owner / Manager has permission
		with patch("frappe.get_roles", return_value=["OmniTrack User"]), \
		     patch("frappe.db.exists", return_value=True), \
		     patch("frappe.db.get_value", return_value="lead@example.com"):
			can_lead_access = has_work_block_permission(b, user="lead@example.com")
			self.assertTrue(can_lead_access)

		# 2. Client linked to project customer has permission
		with patch("frappe.get_roles", return_value=["OmniTrack Client"]), \
		     patch("frappe.db.exists", return_value=True), \
		     patch("frappe.db.get_value", return_value="client@acme.org"):
			can_client_access = has_work_block_permission(b, user="client@acme.org")
			self.assertTrue(can_client_access)

		# 3. Query conditions include project query for team
		with patch("frappe.get_roles", return_value=["OmniTrack User"]), \
		     patch("frappe.db.exists", return_value=True):
			cond = get_work_block_permission_query_conditions(user="lead@example.com")
			self.assertIn("`project` IN", cond)

	def test_dashboard_kpis_worked_planned_target_and_todo_completion(self):
		from omnitrack.api import get_dashboard_kpis

		today_str = frappe.utils.nowdate()
		b1 = _block(work_date=today_str, duration_hours=4.0, task_nature="🎯 Planned")
		b1.status = "Completed"
		b1.insert()

		b2 = _block(work_date=today_str, duration_hours=2.0, task_nature="🎯 Planned")
		b2.status = "In Progress"
		b2.insert()

		kpis = get_dashboard_kpis(employee="Administrator")

		# Day assertions
		self.assertIn("target_hours", kpis["today"])
		self.assertEqual(kpis["today"]["target_hours"], 8.0)
		self.assertIn("todo_completed_pct", kpis["today"])
		self.assertGreaterEqual(kpis["today"]["block_count"], 2)
		self.assertGreaterEqual(kpis["today"]["completed_count"], 1)

		# Week assertions
		self.assertIn("target_hours", kpis["week"])
		self.assertEqual(kpis["week"]["target_hours"], 40.0)
		self.assertIn("adherence_pct", kpis["week"])

		# Month assertions
		self.assertIn("target_hours", kpis["month"])
		self.assertGreater(kpis["month"]["target_hours"], 0)
		self.assertIn("capacity_pct", kpis["month"])

	def test_user_can_log_session_today_and_yesterday(self):
		from unittest.mock import patch
		from omnitrack.api import log_work_session
		today = frappe.utils.nowdate()
		yesterday = frappe.utils.add_days(today, -1)

		b = _block(work_date=today, start_time="10:00:00", end_time="12:00:00", employee="test1@example.com").insert()

		frappe.set_user("test1@example.com")
		try:
			with patch("frappe.get_roles", return_value=["OmniTrack User"]):
				res_today = log_work_session(
					block_name=b.name,
					session_date=today,
					from_time="10:00:00",
					to_time="11:00:00",
					hours=1.0,
					notes="Session today"
				)
				self.assertEqual(res_today["status"], "success")

				# User logging on yesterday succeeds
				res_yesterday = log_work_session(
					block_name=b.name,
					session_date=yesterday,
					from_time="11:00:00",
					to_time="12:00:00",
					hours=1.0,
					notes="Session yesterday"
				)
				self.assertEqual(res_yesterday["status"], "success")
		finally:
			frappe.set_user("Administrator")

	def test_user_cannot_log_session_before_yesterday(self):
		from unittest.mock import patch
		from omnitrack.api import log_work_session
		today = frappe.utils.nowdate()
		two_days_ago = frappe.utils.add_days(today, -2)

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
		from unittest.mock import patch
		from omnitrack.api import log_work_session
		today = frappe.utils.nowdate()
		three_days_ago = frappe.utils.add_days(today, -3)

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

	def test_no_one_can_modify_past_planned_work_block(self):
		from omnitrack.api import update_work_block
		today = frappe.utils.nowdate()
		past_date = frappe.utils.add_days(today, -2)

		# Create a past block
		past_block = _block(work_date=past_date, start_time="09:00:00", end_time="11:00:00")
		past_block.flags.ignore_past_block_lock = True
		past_block.insert()

		# Neither user nor manager nor admin can reschedule or modify a past planned block
		with self.assertRaises(frappe.ValidationError):
			update_work_block(block_name=past_block.name, start_time="10:00:00")

		with self.assertRaises(frappe.ValidationError):
			update_work_block(block_name=past_block.name, work_date=today)

	def test_no_one_can_book_planned_work_block_in_past(self):
		from omnitrack.api import book_work_block
		today = frappe.utils.nowdate()
		past_date = frappe.utils.add_days(today, -1)

		with self.assertRaises(frappe.ValidationError):
			book_work_block(
				work_date=past_date,
				start_time="09:00:00",
				end_time="10:00:00",
				deliverable_notes="Trying to plan yesterday"
			)

	def test_no_one_can_delete_past_planned_work_block(self):
		from omnitrack.api import delete_work_block
		today = frappe.utils.nowdate()
		past_date = frappe.utils.add_days(today, -3)

		past_block = _block(work_date=past_date, start_time="09:00:00", end_time="11:00:00")
		past_block.flags.ignore_past_block_lock = True
		past_block.insert()

		with self.assertRaises(frappe.ValidationError):
			delete_work_block(block_name=past_block.name)

	def test_timesheet_permission_validator(self):
		from unittest.mock import patch
		from omnitrack.permissions import validate_timesheet_permission
		today = frappe.utils.nowdate()
		two_days_ago = frappe.utils.add_days(today, -2)

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

				# Saving today timesheet succeeds
				validate_timesheet_permission(mock_ts_today)
		finally:
			frappe.set_user("Administrator")

		# Manager saving past timesheet succeeds
		frappe.set_user("test2@example.com")
		try:
			with patch("frappe.get_roles", return_value=["OmniTrack Manager"]):
				validate_timesheet_permission(mock_ts_past)
		finally:
			frappe.set_user("Administrator")

	def tearDown(self):
		frappe.db.rollback()

