# Copyright (c) 2026, OmmNoMi Automation LLP and contributors
# For license information, please see license.txt

import unittest
import frappe
from frappe.tests import IntegrationTestCase

from omnitrack.fac import (
	get_fac_tools,
	get_consolidated_fac_tools,
	omnitrack_session,
	omnitrack_schedule,
	omnitrack_workspace,
)


class TestFACProvider(IntegrationTestCase):
	def setUp(self):
		self.user = frappe.session.user

	def test_hooks_declaration(self):
		"""Verifies that OmniTrack properly declares fac_tools in hooks."""
		hooks = frappe.get_hooks("fac_tools")
		self.assertIn("omnitrack.fac.get_fac_tools", hooks)

	def test_get_fac_tools_consolidated(self):
		"""Verifies that get_fac_tools returns the 3 high-signal consolidated tools."""
		tools = get_fac_tools(consolidated=True)
		self.assertIsInstance(tools, list)
		names = {t["name"] for t in tools}
		self.assertEqual(len(names), 3)
		self.assertIn("omnitrack_session", names)
		self.assertIn("omnitrack_schedule", names)
		self.assertIn("omnitrack_workspace", names)

	def test_omnitrack_session_status(self):
		"""Verifies omnitrack_session executes status action."""
		res = omnitrack_session(action="status")
		self.assertIsInstance(res, dict)
		self.assertIn("status", res)

	def test_omnitrack_session_invalid_action(self):
		"""Verifies that invalid actions in omnitrack_session raise ValidationError."""
		with self.assertRaises(frappe.ValidationError):
			omnitrack_session(action="invalid_unknown_action")

	def test_omnitrack_schedule_invalid_action(self):
		"""Verifies that invalid actions in omnitrack_schedule raise ValidationError."""
		with self.assertRaises(frappe.ValidationError):
			omnitrack_schedule(action="invalid_unknown_action")

	def test_omnitrack_workspace_get_workspace(self):
		"""Verifies omnitrack_workspace executes get_workspace action."""
		res = omnitrack_workspace(action="get_workspace")
		self.assertIsInstance(res, dict)
		self.assertIn("user", res)
		self.assertIn("summary", res)
