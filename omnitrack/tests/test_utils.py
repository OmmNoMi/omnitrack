# Copyright (c) 2026, OmmNoMi Automation LLP and contributors
# For license information, please see license.txt

import unittest
import frappe
from frappe.tests.utils import FrappeTestCase
from frappe.utils import add_days, nowdate

from omnitrack.utils.validators import require_session_notes, validate_not_in_past
from omnitrack.utils.time_math import duration_hours, mins_of, split_over_midnight, pad_time
from omnitrack.utils.user_resolver import resolve_planner_user


class TestOmniTrackUtils(FrappeTestCase):
	def test_require_session_notes(self):
		# Valid notes pass cleanly
		self.assertEqual(require_session_notes("Fixed login button bug"), "Fixed login button bug")
		self.assertEqual(require_session_notes("• Completed PR review"), "• Completed PR review")

		# Blank or scaffolding only fails
		with self.assertRaises(frappe.ValidationError):
			require_session_notes("")
		with self.assertRaises(frappe.ValidationError):
			require_session_notes("•   •")
		with self.assertRaises(frappe.ValidationError):
			require_session_notes("hi")

	def test_validate_not_in_past(self):
		# Today is valid
		validate_not_in_past(nowdate())
		# Tomorrow is valid
		validate_not_in_past(add_days(nowdate(), 1))

		# Yesterday is strictly rejected for planning
		with self.assertRaises(frappe.ValidationError):
			validate_not_in_past(add_days(nowdate(), -1))

	def test_duration_hours(self):
		# Standard intra-day span
		self.assertEqual(duration_hours("09:00:00", "11:30:00"), 2.5)
		self.assertEqual(duration_hours("10:00:00", "10:00:00"), 0.0)

		# Midnight crossover span
		self.assertEqual(duration_hours("23:00:00", "01:30:00"), 2.5)
		self.assertEqual(duration_hours("22:00:00", "02:00:00"), 4.0)

	def test_mins_of(self):
		self.assertEqual(mins_of("00:00:00"), 0)
		self.assertEqual(mins_of("01:30:00"), 90)
		self.assertEqual(mins_of("12:15"), 735)

	def test_split_over_midnight(self):
		# Normal span does not split
		normal = split_over_midnight("10:00:00", "12:00:00")
		self.assertEqual(len(normal), 1)
		self.assertEqual(normal[0], ("10:00:00", "12:00:00"))

		# Overnight span splits into two spans
		overnight = split_over_midnight("23:00:00", "02:00:00")
		self.assertEqual(len(overnight), 2)
		self.assertEqual(overnight[0], ("23:00:00", "23:59:59"))
		self.assertEqual(overnight[1], ("00:00:00", "02:00:00"))

	def test_pad_time(self):
		self.assertEqual(pad_time("9:00"), "09:00:00")
		self.assertEqual(pad_time("14:30:15"), "14:30:15")

	def test_resolve_planner_user_self(self):
		user = resolve_planner_user(None)
		self.assertEqual(user, frappe.session.user)

	def test_week_bounds(self):
		from omnitrack.utils.time_math import week_bounds
		# 2026-09-26 is Saturday, so week bounds are Monday 2026-09-21 to Sunday 2026-09-27
		mon, sun = week_bounds("2026-09-26")
		self.assertEqual(str(mon), "2026-09-21")
		self.assertEqual(str(sun), "2026-09-27")

	def test_time_str(self):
		from omnitrack.utils.time_math import time_str
		from datetime import timedelta
		self.assertEqual(time_str("9:00"), "09:00:00")
		self.assertEqual(time_str(timedelta(seconds=3665)), "01:01:05")
		self.assertEqual(time_str(None), "")

	def test_parse_block_tasks(self):
		from omnitrack.utils.validators import parse_block_tasks
		self.assertEqual(parse_block_tasks(None), [])
		self.assertEqual(parse_block_tasks(""), [])
		self.assertEqual(parse_block_tasks('[{"id": "1", "subject": "Test"}]'), [{"id": "1", "subject": "Test"}])
		lines_parsed = parse_block_tasks("• First task\n• Second task")
		self.assertEqual(len(lines_parsed), 2)
		self.assertEqual(lines_parsed[0]["subject"], "First task")

	def test_is_planner_manager(self):
		from omnitrack.utils.user_resolver import is_planner_manager
		# Administrator is always manager
		self.assertTrue(is_planner_manager("Administrator"))

