# Copyright (c) 2026, OmmNoMi Automation LLP and contributors
# For license information, please see license.txt

import time
from datetime import datetime
from unittest.mock import patch
import frappe
from frappe.tests.utils import FrappeTestCase
from frappe.utils import flt, nowdate

from omnitrack.api import (
	get_active_session,
	get_workstation_data,
	log_work_session,
	switch_active_session,
	sync_active_session,
)


def _block(**kwargs):
	defaults = {
		"doctype": "Planned Work Block",
		"work_date": nowdate(),
		"start_time": "09:00:00",
		"end_time": "12:00:00",
		"task_nature": "🎯 Planned",
		"employee": "Administrator",
	}
	defaults.update(kwargs)
	doc = frappe.get_doc(defaults)
	doc.flags.ignore_permissions = True
	doc.flags.ignore_links = True
	return doc


class TestStopwatch(FrappeTestCase):
	def setUp(self):
		super().setUp()
		frappe.cache.hdel("omnitrack:active_session", "Administrator")
		frappe.db.delete("DefaultValue", {"defkey": "omnitrack_active_session", "parent": "Administrator"})
		commit_patcher = patch("frappe.db.commit")
		commit_patcher.start()
		self.addCleanup(commit_patcher.stop)

	def test_multi_device_active_session_sync(self):
		"""Cross-device session sync: Computer starts, mobile sees and appends lines."""
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
		"""Completing and saving a work session clears the active stopwatch session."""
		today = nowdate()
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
		"""Sessions older than 24 hours are automatically evicted."""
		past_ms = int((time.time() - 25 * 3600) * 1000)
		sync_active_session({
			"startTime": past_ms,
			"trackerNotes": "Ancient session",
			"status": "active"
		})
		self.assertIsNone(get_active_session())

	def test_switch_active_session_atomic(self):
		"""Switching active sessions atomically logs elapsed time on the prior block
		and begins a live session on the target block within one transaction."""
		today = nowdate()

		block_a = _block(work_date=today, start_time="09:00:00", end_time="10:00:00", status="In Progress")
		block_a.insert()
		block_b = _block(work_date=today, start_time="10:00:00", end_time="11:00:00", status="Planned")
		block_b.insert()

		now_ms = int(datetime.now().timestamp() * 1000)
		start_ms = now_ms - (15 * 60 * 1000)
		sync_active_session(session_data={
			"startTime": start_ms,
			"trackerBlockName": block_a.name,
			"status": "active"
		})

		res = switch_active_session(
			target_block=block_b.name,
			current_session_notes="Wrapping up sprint testing on block A"
		)

		self.assertEqual(res["status"], "success")
		self.assertEqual(res["previous_block"], block_a.name)
		self.assertEqual(res["switched_to"], block_b.name)
		self.assertGreater(res["elapsed_hours"], 0)

		block_a.reload()
		self.assertGreater(flt(block_a.actual_hours), 0)

		active = get_active_session()
		self.assertIsNotNone(active)
		self.assertEqual(active.get("status"), "active")
		self.assertEqual(active.get("trackerBlockName"), block_b.name)

	def test_multi_device_clock_skew_and_future_tolerance(self):
		"""Ensures get_active_session does not prematurely evict sessions with near-future/skewed start times."""
		now_ms = datetime.now().timestamp() * 1000
		future_start = now_ms + (300 * 1000)  # 5 minutes in future due to device clock skew

		sync_active_session({
			"startTime": future_start,
			"trackerNotes": "Clock skew tolerance session",
			"status": "active"
		})
		active = get_active_session()
		self.assertIsNotNone(active)
		self.assertEqual(active["trackerNotes"], "Clock skew tolerance session")
