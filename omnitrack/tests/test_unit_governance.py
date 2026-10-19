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



class TestPlanWindow(unittest.TestCase):
	"""A plan is for time still to come (permissions.plan_refusal), at 10:00 on 12 Oct 2026."""

	def setUp(self):
		from datetime import datetime

		self.settings = {}
		for target, kwargs in [
			("omnitrack.permissions._", {"side_effect": lambda msg: msg}),
			("omnitrack.permissions.formatdate", {"side_effect": lambda d: str(getdate(d))}),
			("omnitrack.permissions.frappe.throw", {"side_effect": _throw}),
			("omnitrack.permissions._setting", {"side_effect": lambda fn: self.settings.get(fn)}),
			("omnitrack.permissions.nowdate", {"return_value": "2026-10-12"}),
			("omnitrack.permissions.now_datetime", {"return_value": datetime(2026, 10, 12, 10, 0)}),
		]:
			p = patch(target, **kwargs)
			p.start()
			self.addCleanup(p.stop)

	def says(self, day, start, end):
		from omnitrack.permissions import plan_refusal

		return plan_refusal(day, start, end) or ""

	def test_earlier_days_are_logged_not_planned(self):
		self.assertIn("plan from today on", self.says("2026-10-11", "14:00:00", "15:00:00"))
		self.assertIn("plan from today on", self.says("2025-01-05", None, None))

	def test_today_from_now_on(self):
		self.assertEqual(self.says("2026-10-12", "10:00:00", "11:00:00"), "")
		# under way: started, not over
		self.assertEqual(self.says("2026-10-12", "09:00:00", "10:15:00"), "")
		self.assertIn("That time is over", self.says("2026-10-12", "08:00:00", "10:00:00"))
		self.assertIn("That time is over", self.says("2026-10-12", "08:00:00", "09:00"))
		# an end before its start is the next morning
		self.assertEqual(self.says("2026-10-12", "09:00:00", "01:00:00"), "")
		self.assertEqual(self.says("2026-10-13", "08:00:00", "09:00:00"), "")

	def test_never_on_a_closed_payroll_day(self):
		self.settings["payroll_closed_through"] = "2026-10-13"
		self.assertIn("Payroll is closed through 2026-10-13. Plan from 2026-10-14 on.", self.says("2026-10-13", "10:00:00", "11:00:00"))
		self.assertIn("Payroll is closed", self.says("2026-10-12", "11:00:00", "12:00:00"))
		self.assertEqual(self.says("2026-10-14", "10:00:00", "11:00:00"), "")

	def test_check_plan_date_refuses_with_the_reason(self):
		from omnitrack.permissions import check_plan_date

		with self.assertRaises(Refused) as ctx:
			check_plan_date("2026-10-11", "14:00:00", "15:00:00")
		self.assertIn("ValidationError", str(ctx.exception))
		self.assertTrue(check_plan_date("2026-10-12", "11:00:00", "12:00:00"))



class TestTeamMembersFiltering(unittest.TestCase):
	"""Teammate dropdown lists only real OmniTrack users and active Employees, never mocks or system bots."""

	def setUp(self):
		from unittest.mock import MagicMock
		self.orig_db = getattr(frappe.local, "db", None)
		frappe.local.db = MagicMock()
		self.addCleanup(lambda: setattr(frappe.local, "db", self.orig_db))

		self.roles_by_user = {}
		self.users = {}
		self.employees = []

		patches = [
			patch("frappe.db.sql_list", side_effect=self._mock_sql_list),
			patch("frappe.get_all", side_effect=self._mock_get_all),
			patch("frappe.db.get_value", side_effect=self._mock_get_value),
			patch("frappe.db.exists", side_effect=lambda dt, n=None: True if dt in ("DocType", "User") else False),
			patch("frappe.get_roles", side_effect=lambda u: self.roles_by_user.get(u, [])),
		]
		for p in patches:
			p.start()
			self.addCleanup(p.stop)

	def _mock_sql_list(self, query, params=None):
		if "tabHas Role" in query:
			roles = params[0] if params else ()
			return [u for u, rlist in self.roles_by_user.items() if any(r in roles for r in rlist)]
		return []

	def _mock_get_all(self, doctype, filters=None, fields=None, **kwargs):
		filters = filters or {}
		if doctype == "Employee":
			return [e for e in self.employees if e.get("status") == filters.get("status", "Active")]
		if doctype == "User":
			names = filters.get("name", [])
			if isinstance(names, list) and len(names) == 2 and names[0] == "in":
				allowed = set(names[1])
			else:
				allowed = set(self.users.keys())
			res = []
			for name, u in self.users.items():
				if name in allowed:
					if filters.get("enabled") is not None and u.get("enabled") != filters.get("enabled"):
						continue
					user_type_cond = filters.get("user_type")
					if isinstance(user_type_cond, list) and len(user_type_cond) == 2 and user_type_cond[0] == "!=":
						if u.get("user_type") == user_type_cond[1]:
							continue
					res.append(u)
			return res
		return []

	def _mock_get_value(self, doctype, name, fieldname=None):
		if doctype == "User" and name in self.users:
			return self.users[name].get(fieldname)
		return None

	def test_fictional_mock_members_are_never_returned(self):
		from omnitrack.api.workstation import get_team_members

		self.users = {
			"nomi@ommnomi.in": {"name": "nomi@ommnomi.in", "full_name": "Nomeshwer Sharma", "enabled": 1, "user_type": "System User"},
		}
		self.roles_by_user = {"nomi@ommnomi.in": ["OmniTrack User"]}

		members = get_team_members()
		names = {m.get("full_name") or m.get("name") for m in members}
		for mock in ["Alex Vance", "Tariq Nomi", "Elena Rostova", "Amara Okafor", "Sophia Patel"]:
			self.assertNotIn(mock, names)
		self.assertIn("Nomeshwer Sharma", names)

	def test_system_bots_and_non_omnitrack_users_are_excluded(self):
		from omnitrack.api.workstation import get_team_members

		self.users = {
			"OmniStack": {"name": "OmniStack", "full_name": "OmniStack Bot", "enabled": 1, "user_type": "System User"},
			"portal_customer@example.com": {"name": "portal_customer@example.com", "full_name": "Portal Customer", "enabled": 1, "user_type": "Website User"},
			"engineer@ommnomi.in": {"name": "engineer@ommnomi.in", "full_name": "Active Engineer", "enabled": 1, "user_type": "System User"},
		}
		self.roles_by_user = {
			"OmniStack": ["System User"],
			"portal_customer@example.com": ["Customer"],
			"engineer@ommnomi.in": ["OmniTrack User"],
		}

		members = get_team_members()
		member_names = {m["name"] for m in members}
		self.assertNotIn("OmniStack", member_names)
		self.assertNotIn("portal_customer@example.com", member_names)
		self.assertIn("engineer@ommnomi.in", member_names)

	def test_active_employees_are_included_and_take_designation(self):
		from omnitrack.api.workstation import get_team_members

		self.users = {
			"emp_user@ommnomi.in": {"name": "emp_user@ommnomi.in", "full_name": "Employee User", "enabled": 1, "user_type": "System User"},
		}
		self.employees = [
			{"name": "EMP-001", "employee_name": "Employee User", "user_id": "emp_user@ommnomi.in", "status": "Active", "designation": "Lead Architect"},
			{"name": "EMP-002", "employee_name": "Left Company", "user_id": "ex_user@ommnomi.in", "status": "Left", "designation": "Old Staff"},
		]
		self.roles_by_user = {}

		members = get_team_members()
		member_names = {m["name"] for m in members}
		self.assertIn("emp_user@ommnomi.in", member_names)
		self.assertNotIn("ex_user@ommnomi.in", member_names)

		hit = next(m for m in members if m["name"] == "emp_user@ommnomi.in")
		self.assertEqual(hit["role"], "Lead Architect")
		self.assertEqual(hit["employee"], "EMP-001")


if __name__ == "__main__":
	unittest.main()
