# Copyright (c) 2026, OmmNoMi Automation LLP and contributors
# For license information, please see license.txt

import unittest
import frappe
from frappe.utils import flt
from omnitrack.raven_bridge import (
	is_raven_available,
	get_or_create_task_channel,
	get_task_messages,
	send_task_message,
	post_session_accomplishment_recap,
	pin_message_as_task_spec,
	get_task_raven_timeline_content,
	get_block_raven_timeline_content,
)


class TestRavenBridge(unittest.TestCase):
	def setUp(self):
		self.user = frappe.session.user

	def test_is_raven_available_returns_boolean(self):
		"""is_raven_available should return a boolean without throwing."""
		res = is_raven_available()
		self.assertIsInstance(res, bool)

	def test_graceful_fallback_when_task_empty(self):
		"""Empty task_id should return None or empty list without throwing."""
		self.assertIsNone(get_or_create_task_channel(""))
		self.assertEqual(get_task_messages(""), [])

	def test_timeline_content_schema(self):
		"""Timeline content items must follow Frappe additional_timeline_content schema."""
		items = get_task_raven_timeline_content("Task", "NON_EXISTENT_TASK_123")
		self.assertIsInstance(items, list)
		for item in items:
			self.assertIn("icon", item)
			self.assertIn("is_card", item)
			self.assertIn("creation", item)
			self.assertIn("content", item)

	def test_block_timeline_content_fallback(self):
		"""Block timeline should safely return empty list for non-existent blocks."""
		items = get_block_raven_timeline_content("Planned Work Block", "NON_EXISTENT_BLOCK")
		self.assertIsInstance(items, list)

	def test_send_task_message_validation(self):
		"""Empty message content without files must be rejected gracefully."""
		res = send_task_message("TASK-TEST", "")
		self.assertIsInstance(res, dict)
		self.assertFalse(res.get("success", False))

	def test_pin_spec_nonexistent_message(self):
		"""Pinning a non-existent message returns error gracefully."""
		res = pin_message_as_task_spec("MSG-DOES-NOT-EXIST", "TASK-TEST")
		self.assertIsInstance(res, dict)
		self.assertFalse(res.get("success", False))
