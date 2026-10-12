#!/usr/bin/env python3
# Copyright (c) 2026, OmmNoMi Automation LLP and contributors
# For license information, please see license.txt

"""Which days time can be logged on, without a site.

- log_days_back (OmniTrack Settings, default 15): an employee logs, changes or deletes time on
  the last N days, today counted as day 1. A manager reaches any day.
- payroll_closed_through: HR sets it after running payroll. Nobody, managers included, touches
  time on or before it.
"""

import unittest
from unittest.mock import patch

import frappe
from frappe.utils import add_days, getdate, nowdate


class Refused(Exception):
	pass


def _throw(msg, exc=None, *args, **kwargs):
	raise Refused(f"{getattr(exc, '__name__', exc)}: {msg}")


class TestUnitTemporalGovernance(unittest.TestCase):
	"""The day rules in omnitrack.permissions, with the settings and roles patched."""

	def setUp(self):
		self.settings = {}
		self.manager = False
		for target, kwargs in [
			("frappe.utils.data.get_system_timezone", {"return_value": "Asia/Kolkata"}),
			("omnitrack.permissions._", {"side_effect": lambda msg: msg}),
			("omnitrack.permissions.formatdate", {"side_effect": lambda d: str(getdate(d))}),
			("omnitrack.permissions.frappe.throw", {"side_effect": _throw}),
			("omnitrack.permissions._setting", {"side_effect": lambda fn: self.settings.get(fn)}),
			("omnitrack.permissions.is_omnitrack_manager", {"side_effect": lambda user=None: self.manager}),
		]:
			p = patch(target, **kwargs)
			p.start()
			self.addCleanup(p.stop)
		self.user = "employee@ommnomi.in"

	def check(self, days_ago):
		from omnitrack.permissions import check_timesheet_date_permission

		return check_timesheet_date_permission(add_days(nowdate(), -days_ago), user=self.user)

	def refused(self, days_ago, says):
		with self.assertRaises(Refused) as ctx:
			self.check(days_ago)
		self.assertIn("PermissionError", str(ctx.exception))
		self.assertIn(says, str(ctx.exception))

	def test_window_defaults_to_15_days(self):
		from omnitrack.permissions import get_log_days_back, get_timesheet_modification_horizon_hours

		self.assertEqual(get_log_days_back(), 15)
		self.assertEqual(get_timesheet_modification_horizon_hours(), 360)
		for unset in (0, "", "abc", -3):
			self.settings["log_days_back"] = unset
			self.assertEqual(get_log_days_back(), 15, unset)

	def test_employee_logs_the_last_15_days_today_included(self):
		for days_ago in (0, 1, 2, 14):
			self.assertTrue(self.check(days_ago), days_ago)
		self.refused(15, "last 15 days")

	def test_window_follows_the_setting(self):
		self.settings["log_days_back"] = 2
		self.assertTrue(self.check(1))
		self.refused(2, "last 2 days")
		self.settings["log_days_back"] = 30
		self.assertTrue(self.check(29))
		self.refused(30, "last 30 days")

	def test_manager_reaches_past_the_window(self):
		self.manager = True
		self.assertTrue(self.check(60))

	def test_payroll_closes_its_day_for_everyone(self):
		closed = getdate(add_days(nowdate(), -5))
		self.settings["payroll_closed_through"] = str(closed)
		self.refused(5, "Payroll is closed through")
		self.refused(6, "Payroll is closed through")
		self.assertTrue(self.check(4))
		self.manager = True
		self.refused(5, "Payroll is closed through")
		self.refused(40, "Payroll is closed through")
		self.assertTrue(self.check(4))

	def test_unset_payroll_date_is_none(self):
		from datetime import date

		from omnitrack.permissions import get_payroll_closed_through

		for unset in (None, "", date(1, 1, 1), "0001-01-01"):
			self.settings["payroll_closed_through"] = unset
			self.assertIsNone(get_payroll_closed_through(), unset)

	def test_payroll_message_wins_over_the_window(self):
		self.settings["payroll_closed_through"] = str(add_days(nowdate(), -20))
		self.refused(25, "Payroll is closed through")
		self.refused(17, "last 15 days")

	def test_timesheet_events_use_the_same_rule(self):
		from omnitrack.permissions import validate_timesheet_permission, validate_timesheet_trash_event

		session = patch.object(frappe, "session", frappe._dict(user=self.user))
		session.start()
		self.addCleanup(session.stop)
		old = str(add_days(nowdate(), -15))
		ok = str(add_days(nowdate(), -14))
		for event in (validate_timesheet_permission, validate_timesheet_trash_event):
			doc = frappe._dict(flags=frappe._dict(), start_date=ok, time_logs=[frappe._dict(from_time=f"{ok} 10:00:00")])
			event(doc)
			doc.time_logs.append(frappe._dict(from_time=f"{old} 10:00:00"))
			with self.assertRaises(Refused):
				event(doc)
			# OmniTrack's own saves check the day in the API and pass ignore_permissions
			doc.flags.ignore_permissions = True
			event(doc)

	def test_session_time_interval_calculation(self):
		"""Session hours come from from_time and to_time."""
		from frappe.utils import time_diff_in_hours

		self.assertEqual(round(time_diff_in_hours("10:30:00", "09:00:00"), 2), 1.50)
		self.assertEqual(time_diff_in_hours("09:00:00", "09:00:00"), 0.0)


if __name__ == "__main__":
	unittest.main()
