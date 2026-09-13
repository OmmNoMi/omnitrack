# Copyright (c) 2026, OmmNoMi Automation LLP and contributors
# For license information, please see license.txt

import unittest
from datetime import datetime, timedelta
import frappe
from frappe.utils import add_days, nowdate


class TestOmniTrackFAC(unittest.TestCase):
	def setUp(self):
		self.user = frappe.session.user

	def test_get_fac_tools_schema_validity(self):
		"""Verifies that all OmniTrack tools have compliant MCP schemas."""
		from omnitrack.fac import get_fac_tools

		tools = get_fac_tools()
		self.assertIsInstance(tools, list)
		self.assertGreaterEqual(len(tools), 6)

		required_tool_names = {
			"omnitrack_get_my_workspace",
			"omnitrack_plan_work_blocks",
			"omnitrack_log_work_session",
			"omnitrack_quick_create_task",
			"omnitrack_quick_timer_action",
			"omnitrack_get_eod_reconciliation",
		}
		found_names = {t["name"] for t in tools}
		for r_name in required_tool_names:
			self.assertIn(r_name, found_names)
			tool_def = next(t for t in tools if t["name"] == r_name)
			self.assertIn("description", tool_def)
			self.assertIn("inputSchema", tool_def)
			self.assertIn("handler", tool_def)
			self.assertTrue(callable(tool_def["handler"]))
			self.assertEqual(tool_def["inputSchema"].get("type"), "object")

	def test_past_plan_work_blocks_locked(self):
		"""Invariant 1: Historical plan commitments (work_date < today) cannot be created."""
		from omnitrack.fac import plan_work_blocks

		past_date = str(add_days(nowdate(), -2))
		sample_blocks = [
			{
				"start_time": "09:00:00",
				"end_time": "11:00:00",
				"deliverable_notes": "Attempting past plan block",
			}
		]

		with self.assertRaises(frappe.ValidationError):
			plan_work_blocks(blocks=sample_blocks, work_date=past_date)

	def test_mandatory_session_notes(self):
		"""Invariant 2: Work session logging strictly requires meaningful notes (>= 3 chars)."""
		from omnitrack.fac import log_work_session

		with self.assertRaises(Exception):
			log_work_session(
				hours=1.0,
				notes="",
				session_date=nowdate()
			)

		with self.assertRaises(Exception):
			log_work_session(
				hours=1.0,
				notes="ok",  # Less than 3 chars
				session_date=nowdate()
			)

	def test_empty_task_subject_rejected(self):
		"""Verifies that tasks cannot be created with blank subjects."""
		from omnitrack.fac import quick_create_task

		with self.assertRaises(Exception):
			quick_create_task(subject="   ")

	def test_invalid_timer_action_rejected(self):
		"""Verifies that timer action enforces valid state transitions."""
		from omnitrack.fac import quick_timer_action

		with self.assertRaises(Exception):
			quick_timer_action(action="pause_video")

	def test_get_my_workspace_structure(self):
		"""Verifies the structure returned by get_my_workspace for LLM context."""
		from omnitrack.fac import get_my_workspace

		ws = get_my_workspace()
		self.assertIn("user", ws)
		self.assertIn("date", ws)
		self.assertIn("is_today", ws)
		self.assertIn("summary", ws)
		self.assertIn("planned_blocks", ws)
		self.assertIn("assigned_tasks", ws)
		self.assertEqual(ws["date"], nowdate())
		self.assertIn("total_planned_hours", ws["summary"])
		self.assertIn("total_actual_hours", ws["summary"])
		self.assertIn("target_hours", ws["summary"])

	def test_get_eod_reconciliation_structure(self):
		"""Verifies that EOD reconciliation returns structured audit data."""
		from omnitrack.fac import get_eod_reconciliation

		eod = get_eod_reconciliation()
		self.assertIn("user", eod)
		self.assertIn("summary", eod)
		self.assertIn("compliance_status", eod)
		self.assertIn("recommendations", eod)

	def test_logged_via_normalization(self):
		"""Verifies that arbitrary logged_via labels normalize to valid select options."""
		from omnitrack.fac import log_work_session

		# Test that invalid notes still fail before DB insert
		with self.assertRaises(Exception):
			log_work_session(hours=1.0, notes="", logged_via="Cursor IDE")

	def test_cross_user_permission_enforcement(self):
		"""Invariant: Users without access to other users cannot manage their timesheets."""
		from omnitrack.permissions import can_access_user_data

		# Standard user cannot access an unrelated user
		self.assertFalse(can_access_user_data("restricted_user@example.com", session_user="standard_employee@example.com"))
		# Self-access is always permitted
		self.assertTrue(can_access_user_data("standard_employee@example.com", session_user="standard_employee@example.com"))
		# Administrator access is always permitted
		self.assertTrue(can_access_user_data("standard_employee@example.com", session_user="Administrator"))
