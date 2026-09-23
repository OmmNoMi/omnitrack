import frappe
from unittest.mock import patch
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
	def setUp(self):
		frappe.cache.hdel("omnitrack:active_session", "Administrator")
		frappe.db.delete("DefaultValue", {"defkey": "omnitrack_active_session", "parent": "Administrator"})
		# quick_timer_punch ends its stop branch in sync_active_session(), which calls
		# frappe.db.commit(). That commit flushes every row the test just inserted, so
		# tearDown's rollback cannot undo it and the blocks land in real site data.
		# Neutralise the commit itself rather than the sync: the sync still runs (two
		# tests below depend on its real behaviour), but nothing escapes the rollback.
		patcher = patch("frappe.db.commit")
		patcher.start()
		self.addCleanup(patcher.stop)

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
		today = frappe.utils.nowdate()
		doc = _block(work_date=today, start_time="09:00:00", end_time="12:00:00").insert()
		self.assertEqual(doc.status, "Planned")

		doc.append("sessions", {"session_date": today, "hours": 1.0})
		doc.save()
		self.assertEqual(doc.status, "In Progress")

		doc.append("sessions", {"session_date": today, "hours": 2.0})
		doc.save()
		self.assertIn(doc.status, ("Completed", "Logged (Full)"))

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
		self.assertIn(blk.status, ("Completed", "Logged (Full)"))

	def test_quick_timer_punch_in(self):
		from omnitrack.api import quick_timer_punch
		res = quick_timer_punch(action="punch_in")
		self.assertEqual(res["status"], "success")
		self.assertTrue(res["message"].startswith("Punched IN at "))

		res_start = quick_timer_punch(action="start")
		self.assertEqual(res_start["status"], "success")
		self.assertTrue(res_start["message"].startswith("Punched IN at "))

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

	def test_omnitrack_html_tag_balance(self):
		import html.parser
		import os
		import re

		html_path = frappe.get_app_path("omnitrack", "www", "omnitrack.html")
		self.assertTrue(os.path.exists(html_path), f"omnitrack.html not found at {html_path}")

		with open(html_path, "r", encoding="utf-8") as f:
			content = f.read()

		# Strip scripts, styles, and jinja template tags before checking HTML tag balance
		cleaned = re.sub(r"<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>", "", content, flags=re.IGNORECASE)
		cleaned = re.sub(r"<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>", "", cleaned, flags=re.IGNORECASE)
		cleaned = re.sub(r"{%.*?%}", "", cleaned)
		cleaned = re.sub(r"{{.*?}}", "", cleaned)

		void_elements = {
			"area", "base", "br", "col", "embed", "hr", "img", "input",
			"link", "meta", "param", "source", "track", "wbr"
		}

		class TagBalanceParser(html.parser.HTMLParser):
			def __init__(self):
				super().__init__()
				self.stack = []
				self.errors = []

			def handle_starttag(self, tag, attrs):
				tag_lower = tag.lower()
				if tag_lower not in void_elements:
					self.stack.append((tag_lower, self.getpos()))

			def handle_endtag(self, tag):
				tag_lower = tag.lower()
				if tag_lower in void_elements:
					return
				if not self.stack:
					self.errors.append(f"Unexpected closing tag </{tag}> at line {self.getpos()[0]}")
					return
				last_tag, pos = self.stack.pop()
				if last_tag != tag_lower:
					self.errors.append(
						f"Mismatched tag: expected </{last_tag}> (opened line {pos[0]}), got </{tag}> at line {self.getpos()[0]}"
					)

		parser = TagBalanceParser()
		parser.feed(cleaned)

		self.assertEqual(len(parser.errors), 0, f"HTML parser encountered errors: {parser.errors[:5]}")
		self.assertEqual(len(parser.stack), 0, f"Unclosed HTML tags remaining: {parser.stack[-5:]}")

	def test_omnitrack_template_setup_exports(self):
		import os
		import re

		html_path = frappe.get_app_path("omnitrack", "www", "omnitrack.html")
		self.assertTrue(os.path.exists(html_path), f"omnitrack.html not found at {html_path}")

		with open(html_path, "r", encoding="utf-8") as f:
			content = f.read()

		match = re.search(r"return\s*\{([^}]+)\};\s*\}\s*\n\s*\}\);", content)
		self.assertIsNotNone(match, "setup() return block not found in omnitrack.html")

		exports = set(
			x.strip().split(":")[0].strip()
			for x in match.group(1).split(",")
			if x.strip() and not x.strip().startswith("//")
		)

		required_exports = [
			"dashboardKPIs",
			"updateDashboardKPIs",
			"sessionNotesList",
			"sessionNotesRows",
			"newSessionPoint",
			"addSessionPoint",
			"removeSessionPoint",
			"onLogRowKey",
			"onSessionToolbarKey",
			"toggleTrack",
			"discardSession",
			"discardConfirm",
			"isTracking",
			"formattedTime",
			"trackerBlockName",
			"trackerBoundBlock",
			"getBlockTimingInfo",
			"isBlockLocked",
			"canLogTimesheet",
			"formatAmPm",
			"fetchWorkstationData",
			"syncActiveSession",
			"restoreActiveSession",
			"showAdjustModal",
			"adjustForm",
			"openAdjustModal",
			"applyAdjustedStartTime",
			"submitAdjustedTimesheet",
			"trackerProject",
			"trackerNature",
			"openTodos",
			"todayPlannedBlocks",
			"todoDropdownOpen",
			"todoSearchQuery",
			"todoSearchInput",
			"toggleTodoPicker",
			"filteredOpenTodos",
			"filteredPlannedBlocks",
			"showCustomOption",
			"selectTodoToAutofill",
			"selectPlannedBlock",
			"selectCustomTitle",
			"onTodoSearchEnter",
			"clearSelectedTodo",
			"bindSessionToBlock",
			"reconcileActiveSession",
			"handleRemoteSessionCleared",
			"checkRemoteActiveSession",
			"isSessionElevated",
			"toggleSessionFocus",
			"dayTimeline",
			"bottomBarTimer",
			"showInactivityModal",
			"inactivityMinutes",
			"lastActivityTimeHHMM",
			"suggestedStopHHMM",
			"confirmStillWorking",
			"stopInactivitySessionNow",
			"stopInactivitySessionAtLastEditPlus15",
		]

		missing = [exp for exp in required_exports if exp not in exports]
		self.assertEqual(len(missing), 0, f"Missing required setup() exports in omnitrack.html: {missing}")

	def test_omnitrack_vue_template_render(self):
		"""Compiles and renders the actual omnitrack.html template with the component setup
		state in Node.js, ensuring zero runtime ReferenceErrors or TypeErrors occur during mount/render."""
		import subprocess
		import os

		node_script = """
const fs = require('fs');
const { compile, ref, computed, reactive } = require('vue');
const html = fs.readFileSync('./omnitrack/www/omnitrack.html', 'utf8');

const appStart = html.indexOf('<div id="app"');
const appOpenTagEnd = html.indexOf('>', appStart) + 1;
const scriptStart = html.indexOf('<script', appOpenTagEnd);
const appEnd = html.lastIndexOf('</div>', scriptStart);
const template = html.substring(appOpenTagEnd, appEnd);

let idx = html.lastIndexOf('<script>');
let scriptOpenEnd = idx + '<script>'.length;
let scriptClose = html.indexOf('</script>', scriptOpenEnd);
let scriptContent = html.substring(scriptOpenEnd, scriptClose);

const vm = require('vm');
let compDef = null;
const customVue = {
  createApp: (def) => {
    compDef = def;
    return { config: { errorHandler: null }, component: () => {}, directive: () => {}, mount: () => {} };
  },
  ref: ref, computed: computed, watch: () => {}, onMounted: () => {}, onUnmounted: () => {}, nextTick: (fn) => fn && fn()
};

const context = {
  Vue: customVue, console: console,
  window: {
    OMNITRACK_SESSION: { user: 'admin@example.com', user_fullname: 'Admin', is_manager: true, csrf_token: 'csrf', active_session: null },
    addEventListener: () => {}, removeEventListener: () => {}, matchMedia: () => ({ matches: false }),
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    location: { reload: () => {}, href: '', search: '' },
    setTimeout: setTimeout, clearTimeout: clearTimeout, setInterval: setInterval, clearInterval: clearInterval,
    io: () => ({ on: () => {}, emit: () => {} }),
    OmniTrackSessionBox: { mount: () => ({}), unmount: () => {} }
  },
  document: {
    documentElement: { classList: { add: () => {}, remove: () => {} }, style: {} },
    body: { classList: { add: () => {}, remove: () => {} }, style: {} },
    addEventListener: () => {}, removeEventListener: () => {},
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => []
  },
  fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }),
  navigator: { userAgent: 'node' }
};
context.localStorage = context.window.localStorage;
context.globalThis = context;
context.window.window = context.window;
context.window.document = context.document;

vm.runInNewContext(scriptContent, context);
const state = reactive(compDef.setup());
const renderFn = compile(template);
const vnode = renderFn(state, []);
if (!vnode) throw new Error('VNode rendered as null/undefined');
console.log('SUCCESS');
"""
		app_dir = frappe.get_app_path("omnitrack", "..")
		node_path = os.path.join(app_dir, "node_modules")
		env = dict(os.environ, NODE_PATH=node_path)
		proc = subprocess.run(["node", "-e", node_script], cwd=app_dir, env=env, capture_output=True, text=True)
		self.assertEqual(proc.returncode, 0, f"Vue template render test failed in Node.js:\nSTDOUT: {proc.stdout}\nSTDERR: {proc.stderr}")
		self.assertIn("SUCCESS", proc.stdout)

	def test_multi_device_active_session_sync(self):
		from omnitrack.api import sync_active_session, get_active_session, get_workstation_data
		import time

		user = frappe.session.user
		start_ms = int(time.time() * 1000)

		# 1. Start / sync session from device A (computer)
		session_payload = {
			"startTime": start_ms,
			"selectedNature": "🎯 Planned",
			"selectedProject": "PROJ-TEST",
			"trackerNotes": "Cross-device planning session",
			"trackerBlockName": "TEST-BLOCK-1",
			"sessionNotesList": ["Initial task item from computer"],
			"status": "active"
		}
		res = sync_active_session(session_payload)
		self.assertEqual(res["status"], "success")

		# 2. Query active session as device B (mobile phone)
		active = get_active_session()
		self.assertIsNotNone(active)
		self.assertEqual(active["trackerNotes"], "Cross-device planning session")
		self.assertEqual(active["sessionNotesList"], ["Initial task item from computer"])

		# Verify workstation data includes the active session
		ws_data = get_workstation_data()
		self.assertIn("active_session", ws_data)
		self.assertEqual(ws_data["active_session"]["trackerBlockName"], "TEST-BLOCK-1")

		# 3. Add more lines from device B (mobile phone)
		session_payload["sessionNotesList"].append("Second task item from mobile outside")
		res_update = sync_active_session(session_payload)
		self.assertEqual(res_update["status"], "success")

		active_updated = get_active_session()
		self.assertEqual(len(active_updated["sessionNotesList"]), 2)
		self.assertIn("Second task item from mobile outside", active_updated["sessionNotesList"])

		# 4. Clear / stop session
		res_clear = sync_active_session(None)
		self.assertEqual(res_clear["status"], "cleared")
		self.assertIsNone(get_active_session())

	def test_active_session_cleared_on_work_session_log(self):
		from omnitrack.api import sync_active_session, get_active_session, log_work_session
		import time

		today = frappe.utils.nowdate()
		b = _block(work_date=today, start_time="11:00:00", end_time="13:00:00").insert()

		start_ms = int(time.time() * 1000)
		sync_active_session({
			"startTime": start_ms,
			"trackerBlockName": b.name,
			"trackerNotes": "Live focus",
			"sessionNotesList": ["Item 1", "Item 2"],
			"status": "active"
		})
		self.assertIsNotNone(get_active_session())

		# Logging the work session against the block auto-clears the active session
		log_work_session(
			block_name=b.name,
			session_date=today,
			from_time="11:00:00",
			to_time="12:30:00",
			hours=1.5,
			notes="Item 1\nItem 2"
		)
		self.assertIsNone(get_active_session())

	def test_active_session_24h_expiration(self):
		from omnitrack.api import sync_active_session, get_active_session
		import time

		# 25 hours in the past
		past_ms = int((time.time() - 25 * 3600) * 1000)
		sync_active_session({
			"startTime": past_ms,
			"trackerNotes": "Ancient session",
			"status": "active"
		})

		# Should auto-expire and return None
		self.assertIsNone(get_active_session())

	def test_adjust_timesheet_timing_and_temporal_permissions(self):
		from unittest.mock import patch
		from omnitrack.api import quick_timer_punch, log_work_session
		today = frappe.utils.nowdate()
		yesterday = frappe.utils.add_days(today, -1)
		two_days_ago = frappe.utils.add_days(today, -2)

		frappe.set_user("test1@example.com")
		try:
			with patch("frappe.get_roles", return_value=["OmniTrack User"]):
				# 1. Adjusting timesheet on today succeeds (e.g. 5m earlier / later)
				res_today = quick_timer_punch(
					action="stop",
					work_date=today,
					from_time="09:55:00",
					to_time="10:30:00",
					duration_hours=0.58,
					deliverable_notes="Adjusted focus session today"
				)
				self.assertEqual(res_today["status"], "success")
				b_today = frappe.get_doc("Planned Work Block", res_today["block"])
				self.assertEqual(str(b_today.work_date), today)
				from omnitrack.api import _time_str
				self.assertEqual(_time_str(b_today.start_time), "09:55:00")
				self.assertEqual(_time_str(b_today.end_time), "10:30:00")
				self.assertEqual(frappe.utils.flt(b_today.duration_hours), 0.58)

				# 2. Adjusting timesheet on yesterday succeeds
				res_yesterday = quick_timer_punch(
					action="stop",
					work_date=yesterday,
					from_time="16:00:00",
					to_time="17:00:00",
					duration_hours=1.0,
					deliverable_notes="Adjusted focus session yesterday"
				)
				self.assertEqual(res_yesterday["status"], "success")
				b_yesterday = frappe.get_doc("Planned Work Block", res_yesterday["block"])
				self.assertEqual(str(b_yesterday.work_date), yesterday)
				self.assertEqual(_time_str(b_yesterday.start_time), "16:00:00")
				self.assertEqual(_time_str(b_yesterday.end_time), "17:00:00")

				# 3. Regular user attempting to adjust before yesterday is blocked
				with self.assertRaises(frappe.PermissionError):
					quick_timer_punch(
						action="stop",
						work_date=two_days_ago,
						from_time="14:00:00",
						to_time="15:00:00",
						duration_hours=1.0,
						deliverable_notes="Attempted backdated adjustment beyond horizon"
					)
		finally:
			frappe.set_user("Administrator")

		# 4. Manager can adjust before yesterday
		with patch("frappe.get_roles", return_value=["OmniTrack Manager", "System Manager"]):
			res_mgr = quick_timer_punch(
				action="stop",
				work_date=two_days_ago,
				from_time="14:00:00",
				to_time="15:00:00",
				duration_hours=1.0,
				deliverable_notes="Manager historical timesheet adjustment"
			)
			self.assertEqual(res_mgr["status"], "success")
			b_mgr = frappe.get_doc("Planned Work Block", res_mgr["block"])
			self.assertEqual(str(b_mgr.work_date), two_days_ago)

	def test_timesheet_without_a_description_is_refused(self):
		"""An hour with nothing written against it cannot be read by a manager, and
		on a client invoice it looks like time billed for no work. Every save path
		must refuse it — including payloads that carry only bullet scaffolding."""
		from omnitrack.api import quick_timer_punch

		for empty in ("", "   ", None, "\u2022 \n\u2022 ", "ab", "- - -"):
			with self.subTest(notes=empty):
				with self.assertRaises(frappe.ValidationError):
					quick_timer_punch(
						action="stop",
						duration_hours=1.0,
						deliverable_notes=empty,
					)

		# The same call with a real description still goes through, so the guard
		# refuses emptiness rather than refusing everything.
		res = quick_timer_punch(
			action="stop",
			duration_hours=1.0,
			deliverable_notes="Reconciled the September invoice batch",
		)
		self.assertEqual(res["status"], "success")
		block = frappe.get_doc("Planned Work Block", res["block"])
		self.assertEqual(block.deliverable_notes, "Reconciled the September invoice batch")

	def test_log_work_session_without_a_description_is_refused(self):
		"""Same rule from the planner side: a session logged against a block is the
		billable record, so it cannot be blank either."""
		from omnitrack.api import log_work_session

		blk = _block(deliverable_notes="Planned block for the session guard")
		blk.insert()

		with self.assertRaises(frappe.ValidationError):
			log_work_session(block_name=blk.name, hours=1.0, notes="")

		log_work_session(blk.name, hours=1.0, notes="Wrote the migration rollback plan")
		blk.reload()
		self.assertEqual(len(blk.sessions), 1)

	def test_get_task_workflow_actions_and_execute(self):
		"""Users can fetch available workflow transitions for a task/todo and execute them."""
		from omnitrack.api import get_task_workflow_actions, execute_task_workflow_action

		todo = frappe.new_doc("ToDo")
		todo.description = "Test task for workflow action execution"
		todo.status = "Open"
		todo.insert(ignore_permissions=True)

		actions = get_task_workflow_actions(doctype="ToDo", docname=todo.name)
		self.assertIsInstance(actions, list)
		self.assertTrue(len(actions) > 0)

		target_act = next((a["action"] for a in actions if "Close" in a["action"] or a["action"] == "Closed"), actions[0]["action"])
		res = execute_task_workflow_action(
			doctype="ToDo",
			docname=todo.name,
			action=target_act,
			comment="Closing task via OmniTrack workflow action test"
		)
		self.assertEqual(res.get("status"), "success")
		self.assertTrue(res.get("new_state"))
		todo.reload()


	def test_execute_task_action_fallback_without_workflow(self):
		"""When no workflow is configured, execute_task_workflow_action cleanly transitions doc.status."""
		from omnitrack.api import execute_task_workflow_action

		todo = frappe.new_doc("ToDo")
		todo.description = "Test fallback without workflow"
		todo.status = "Open"
		todo.insert(ignore_permissions=True)

		with patch("frappe.model.workflow.get_workflow_name", return_value=None), \
		     patch.object(todo.meta, "get_workflow", return_value=None):
			res = execute_task_workflow_action(
				doctype="ToDo",
				docname=todo.name,
				action="Close Task",
				comment="Closing fallback test"
			)
			self.assertEqual(res.get("status"), "success")
			self.assertEqual(res.get("new_state"), "Closed")
			todo.reload()
			self.assertEqual(todo.status, "Closed")

			res_cancel = execute_task_workflow_action(
				doctype="ToDo",
				docname=todo.name,
				action="Cancel Task"
			)
			self.assertEqual(res_cancel.get("status"), "success")
			self.assertEqual(res_cancel.get("new_state"), "Cancelled")
			todo.reload()
			self.assertEqual(todo.status, "Cancelled")

	def test_attach_tasks_and_complete_block_task(self):
		"""Attaching tasks via text and toggling completion updates status and syncs active session."""
		from omnitrack.api import (
			attach_tasks_to_block,
			complete_block_task,
			get_block_tasks,
			sync_active_session,
			get_active_session
		)

		doc = _block(work_date="2026-09-10", start_time="10:00:00", end_time="12:00:00").insert()

		# Attach multiple action items
		res = attach_tasks_to_block(
			block_name=doc.name,
			new_task_subjects="Review OTC data schema\nInvite OTC admin users\nSetup API keys"
		)
		self.assertEqual(res.get("status"), "success")
		self.assertEqual(len(res.get("tasks", [])), 3)

		# Verify get_block_tasks
		tasks_info = get_block_tasks(doc.name)
		self.assertEqual(len(tasks_info["tasks"]), 3)
		task1_ref = tasks_info["tasks"][0]["ref"]

		# Set up active session bound to this block
		import time
		sync_active_session({
			"startTime": int(time.time() * 1000),
			"trackerBlockName": doc.name,
			"sessionNotesList": [],
			"trackerNotes": ""
		}, user="Administrator")

		# Complete task 1
		comp_res = complete_block_task(doc.name, task1_ref, completed=True)
		self.assertEqual(comp_res["status"], "success")
		self.assertIn(comp_res["task"]["status"], ("Completed", "Closed"))

		# Check active session has accomplishment recorded
		sess = get_active_session(user="Administrator")
		self.assertTrue(any("Review OTC data schema" in line for line in (sess.get("sessionNotesList") or [])))

		# Reopen task 1
		reopen_res = complete_block_task(doc.name, task1_ref, completed=False)
		self.assertEqual(reopen_res["task"]["status"], "Open")

	def test_reschedule_unfinished_tasks(self):
		"""Unfinished connected tasks are carried forward into a newly created planned work block."""
		from omnitrack.api import attach_tasks_to_block, complete_block_task, reschedule_unfinished_tasks

		doc = _block(work_date="2026-09-10", start_time="10:00:00", end_time="12:00:00").insert()
		attach_tasks_to_block(
			block_name=doc.name,
			new_task_subjects="Completed item\nUnfinished item 1\nUnfinished item 2"
		)

		tasks = doc.reload().get("connected_tasks")
		import json
		parsed = json.loads(tasks)
		complete_block_task(doc.name, parsed[0]["ref"], completed=True)

		# Reschedule unfinished items
		resched = reschedule_unfinished_tasks(doc.name, target_date="2026-09-11")
		self.assertEqual(resched["status"], "success")
		self.assertEqual(resched["rescheduled_count"], 2)
		self.assertEqual(str(resched["target_date"]), "2026-09-11")

		# Original block items marked as Rescheduled
		doc.reload()
		orig_parsed = json.loads(doc.connected_tasks)
		self.assertEqual(orig_parsed[0]["status"], "Closed")
		self.assertEqual(orig_parsed[1]["status"], "Rescheduled")
		self.assertEqual(orig_parsed[2]["status"], "Rescheduled")

		# New block has the 2 carried forward items in Open state
		new_block = frappe.get_doc("Planned Work Block", resched["new_block"])
		new_parsed = json.loads(new_block.connected_tasks)
		self.assertEqual(len(new_parsed), 2)
		self.assertEqual(new_parsed[0]["status"], "Open")
		self.assertEqual(new_parsed[1]["status"], "Open")

	def test_reschedule_work_block_non_destructive_lineage(self):
		from omnitrack.api import reschedule_work_block
		today = frappe.utils.nowdate()
		tomorrow = frappe.utils.add_days(today, 1)

		original = _block(
			work_date=today,
			start_time="21:30:00",
			end_time="22:30:00",
			deliverable_notes="Weekly Strategy Call"
		).insert()

		res = reschedule_work_block(
			block_name=original.name,
			new_date=tomorrow,
			new_start_time="10:00:00",
			new_end_time="11:00:00"
		)
		self.assertEqual(res["status"], "success")
		self.assertEqual(res["original"], original.name)
		cloned_name = res["rescheduled_to"]

		# Original block must remain in place with Rescheduled status
		original.reload()
		self.assertEqual(original.status, "Rescheduled")
		self.assertEqual(str(original.work_date), str(today))
		self.assertEqual(str(original.start_time), "21:30:00")
		self.assertEqual(original.rescheduled_to, cloned_name)

		# Cloned block must be at target time slot with status Planned and link to original
		clone = frappe.get_doc("Planned Work Block", cloned_name)
		self.assertEqual(clone.status, "Planned")
		self.assertEqual(str(clone.work_date), str(tomorrow))
		self.assertEqual(str(clone.start_time), "10:00:00")
		self.assertEqual(str(clone.end_time), "11:00:00")
		self.assertEqual(clone.rescheduled_from, original.name)

	def test_cancel_work_block_with_structured_reason(self):
		from omnitrack.api import update_work_block
		today = frappe.utils.nowdate()

		block = _block(
			work_date=today,
			start_time="14:00:00",
			end_time="15:00:00",
			deliverable_notes="Client Touchpoint"
		).insert()

		res = update_work_block(
			block_name=block.name,
			status="Cancelled",
			cancel_reason="Client No-Show"
		)
		self.assertEqual(res["status"], "success")

		block.reload()
		self.assertEqual(block.status, "Cancelled")
		self.assertEqual(block.cancel_reason, "Client No-Show")

	def test_mark_past_unworked_blocks_missed_cron(self):
		from omnitrack.api import mark_past_unworked_blocks_missed
		past_date = "2026-09-01"

		# Create an unworked past block
		past_block = _block(
			work_date=past_date,
			start_time="10:00:00",
			end_time="11:00:00",
			status="Planned"
		)
		past_block.flags.ignore_past_block_lock = True
		past_block.insert()

		mark_past_unworked_blocks_missed()

		past_block.reload()
		self.assertEqual(past_block.status, "Missed")

	def tearDown(self):
		frappe.db.rollback()


def run_test_workflow_actions():
	"""Standalone runner for workflow action tests."""
	test_case = TestPlannedWorkBlock()
	test_case.setUp()
	try:
		test_case.test_get_task_workflow_actions_and_execute()
		test_case.test_execute_task_action_fallback_without_workflow()
		print("SUCCESS: all workflow action tests passed!")
	finally:
		test_case.tearDown()

