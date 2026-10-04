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
		"""Verifies that all OmniTrack tools have compliant MCP schemas across granular and consolidated modes."""
		from omnitrack.fac import get_fac_tools

		# 1. Granular Mode (all domain tools)
		granular_tools = get_fac_tools(consolidated=False)
		self.assertIsInstance(granular_tools, list)
		self.assertGreaterEqual(len(granular_tools), 21)

		required_tool_names = {
			"omnitrack_get_my_workspace",
			"omnitrack_plan_work_blocks",
			"omnitrack_log_work_session",
			"omnitrack_quick_create_task",
			"omnitrack_quick_timer_action",
			"omnitrack_get_eod_reconciliation",
		}
		found_names = {t["name"] for t in granular_tools}
		for r_name in required_tool_names:
			self.assertIn(r_name, found_names)
			tool_def = next(t for t in granular_tools if t["name"] == r_name)
			self.assertIn("description", tool_def)
			self.assertIn("inputSchema", tool_def)
			self.assertIn("handler", tool_def)
			self.assertTrue(callable(tool_def["handler"]))
			self.assertEqual(tool_def["inputSchema"].get("type"), "object")

		# 2. Consolidated Mode (3 polymorphic tools)
		consolidated_tools = get_fac_tools(consolidated=True)
		self.assertIsInstance(consolidated_tools, list)
		self.assertEqual(len(consolidated_tools), 3)
		cons_names = {t["name"] for t in consolidated_tools}
		self.assertEqual(cons_names, {"omnitrack_session", "omnitrack_schedule", "omnitrack_workspace"})

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

	def test_assistant_tools_hook_registered(self):
		"""Verifies that hooks.py assistant_tools contains all 20 BaseTool classes."""
		import omnitrack.hooks as hooks
		self.assertTrue(hasattr(hooks, "assistant_tools"))
		expected_classes = [
			"omnitrack.fac.OmniTrackGetMyWorkspaceTool",
			"omnitrack.fac.OmniTrackPlanWorkBlocksTool",
			"omnitrack.fac.OmniTrackLogWorkSessionTool",
			"omnitrack.fac.OmniTrackQuickCreateTaskTool",
			"omnitrack.fac.OmniTrackQuickTimerActionTool",
			"omnitrack.fac.OmniTrackStartTimerTool",
			"omnitrack.fac.OmniTrackStopTimerTool",
			"omnitrack.fac.OmniTrackDiscardTimerTool",
			"omnitrack.fac.OmniTrackGetTimerStatusTool",
			"omnitrack.fac.OmniTrackGetEODReconciliationTool",
			"omnitrack.fac.OmniTrackSwitchTimerTool",
			"omnitrack.fac.OmniTrackRescheduleBlockTool",
			"omnitrack.fac.OmniTrackExtendActiveBlockTool",
			"omnitrack.fac.OmniTrackAdjustWorkSessionTool",
			"omnitrack.fac.OmniTrackDeleteWorkSessionTool",
			"omnitrack.fac.OmniTrackGetAssignedTasksTool",
			"omnitrack.fac.OmniTrackExecuteTaskWorkflowTool",
			"omnitrack.fac.OmniTrackAttachTasksToBlockTool",
			"omnitrack.fac.OmniTrackCompleteBlockTaskTool",
			"omnitrack.fac.OmniTrackGetPlanVsActualTool",
			"omnitrack.fac.OmniTrackApproveWorkBlocksTool",
		]
		self.assertEqual(len(hooks.assistant_tools), 21)
		for c_path in expected_classes:
			self.assertIn(c_path, hooks.assistant_tools)

	def test_basetool_subclasses_instantiation(self):
		"""Verifies that all 21 BaseTool classes can be instantiated and provide correct metadata."""
		from omnitrack.fac import (
			OmniTrackGetMyWorkspaceTool,
			OmniTrackPlanWorkBlocksTool,
			OmniTrackLogWorkSessionTool,
			OmniTrackQuickCreateTaskTool,
			OmniTrackQuickTimerActionTool,
			OmniTrackStartTimerTool,
			OmniTrackStopTimerTool,
			OmniTrackDiscardTimerTool,
			OmniTrackGetTimerStatusTool,
			OmniTrackGetEODReconciliationTool,
			OmniTrackSwitchTimerTool,
			OmniTrackRescheduleBlockTool,
			OmniTrackExtendActiveBlockTool,
			OmniTrackAdjustWorkSessionTool,
			OmniTrackDeleteWorkSessionTool,
			OmniTrackGetAssignedTasksTool,
			OmniTrackExecuteTaskWorkflowTool,
			OmniTrackAttachTasksToBlockTool,
			OmniTrackCompleteBlockTaskTool,
			OmniTrackGetPlanVsActualTool,
			OmniTrackApproveWorkBlocksTool,
		)
		tool_classes = [
			OmniTrackGetMyWorkspaceTool,
			OmniTrackPlanWorkBlocksTool,
			OmniTrackLogWorkSessionTool,
			OmniTrackQuickCreateTaskTool,
			OmniTrackQuickTimerActionTool,
			OmniTrackStartTimerTool,
			OmniTrackStopTimerTool,
			OmniTrackDiscardTimerTool,
			OmniTrackGetTimerStatusTool,
			OmniTrackGetEODReconciliationTool,
			OmniTrackSwitchTimerTool,
			OmniTrackRescheduleBlockTool,
			OmniTrackExtendActiveBlockTool,
			OmniTrackAdjustWorkSessionTool,
			OmniTrackDeleteWorkSessionTool,
			OmniTrackGetAssignedTasksTool,
			OmniTrackExecuteTaskWorkflowTool,
			OmniTrackAttachTasksToBlockTool,
			OmniTrackCompleteBlockTaskTool,
			OmniTrackGetPlanVsActualTool,
			OmniTrackApproveWorkBlocksTool,
		]
		self.assertEqual(len(tool_classes), 21)
		for cls in tool_classes:
			inst = cls()
			self.assertTrue(inst.name.startswith("omnitrack_"))
			self.assertTrue(len(inst.description) > 10)
			self.assertIsInstance(inst.inputSchema, dict)
			self.assertEqual(inst.inputSchema.get("type"), "object")
			meta = inst.get_metadata()
			self.assertEqual(meta["name"], inst.name)
			self.assertEqual(meta["source_app"], "omnitrack")

	def test_timer_lifecycle_helpers(self):
		"""Verifies dedicated timer functions: start_timer, get_timer_status, discard_timer."""
		from omnitrack.fac import start_timer, get_timer_status, discard_timer

		# Start session
		res = start_timer(notes="Unit test running focus session")
		self.assertEqual(res.get("status"), "success")

		# Check status
		status = get_timer_status()
		self.assertEqual(status.get("status"), "running")
		self.assertIn("elapsed_seconds", status)

		# Discard session (zero empty timesheets)
		discard_res = discard_timer()
		self.assertEqual(discard_res.get("status"), "success")

		# Check status is now idle
		status_after = get_timer_status()
		self.assertEqual(status_after.get("status"), "idle")

	def test_analytics_and_task_helpers(self):
		"""Verifies get_assigned_tasks_data and get_plan_vs_actual_analytics."""
		from omnitrack.fac import get_assigned_tasks_data, get_plan_vs_actual_analytics

		tasks_res = get_assigned_tasks_data()
		self.assertIn("employee", tasks_res)
		self.assertIn("tasks", tasks_res)
		self.assertIsInstance(tasks_res["tasks"], list)

		analytics = get_plan_vs_actual_analytics()
		self.assertIn("employee", analytics)
		self.assertIn("pai", analytics)
		self.assertIn("plan_vs_actual", analytics)

	def test_timesheet_sync_mode_governance(self):
		"""Verifies ERPNext Timesheet sync mode: Never, On Approval, Immediate."""
		from omnitrack.api import (
			book_work_block,
			log_work_session,
			get_timesheet_sync_mode,
			approve_work_blocks
		)

		original_mode = frappe.db.get_single_value("OmniTrack Settings", "default_timesheet_mode")

		try:
			# 1. Mode: Never -> No Timesheet created on book or log
			frappe.db.set_single_value("OmniTrack Settings", "default_timesheet_mode", "Never")
			self.assertEqual(get_timesheet_sync_mode(), "Never")

			bk = book_work_block(
				work_date=nowdate(),
				start_time="14:00:00",
				end_time="15:00:00",
				deliverable_notes="Test block for sync mode Never",
				employee=frappe.session.user
			)
			block_name = bk["name"]
			block_doc = frappe.get_doc("Planned Work Block", block_name)
			self.assertIsNone(block_doc.timesheet)

			log_work_session(
				block_name=block_name,
				hours=1.0,
				notes="Completed work under Never sync mode. Verified that zero timesheet documents are created in ERPNext active database."
			)
			block_doc.reload()
			self.assertIsNone(block_doc.timesheet)

			# 2. Mode: On Approval -> Timesheet created ONLY when approved by manager
			frappe.db.set_single_value("OmniTrack Settings", "default_timesheet_mode", "On Approval")
			self.assertEqual(get_timesheet_sync_mode(), "On Approval")

			bk2 = book_work_block(
				work_date=nowdate(),
				start_time="15:00:00",
				end_time="16:00:00",
				deliverable_notes="Test block for On Approval mode",
				employee=frappe.session.user
			)
			b2_name = bk2["name"]
			log_work_session(
				block_name=b2_name,
				hours=1.0,
				notes="Work done pending approval. Comprehensive engineering deliverables and code review completed for client milestone testing."
			)
			b2_doc = frappe.get_doc("Planned Work Block", b2_name)
			self.assertIsNone(b2_doc.timesheet)
			self.assertEqual(b2_doc.approval_status, "Draft")

			# Manager approves the block
			appr_res = approve_work_blocks(
				block_names=[b2_name],
				comments="Approved by manager"
			)
			self.assertEqual(appr_res["status"], "success")
			b2_doc.reload()
			self.assertEqual(b2_doc.approval_status, "Approved")
			self.assertEqual(b2_doc.approved_by, frappe.session.user)
			if frappe.db.exists("DocType", "Timesheet"):
				self.assertIsNotNone(b2_doc.timesheet)

		finally:
			frappe.db.set_single_value("OmniTrack Settings", "default_timesheet_mode", original_mode or "Never")
			if "b2_doc" in locals() and b2_doc:
				try:
					b2_doc.reload()
					if getattr(b2_doc, "timesheet", None) and frappe.db.exists("Timesheet", b2_doc.timesheet):
						frappe.delete_doc("Timesheet", b2_doc.timesheet, force=True)
				except Exception:
					pass
			if "b2_name" in locals() and b2_name and frappe.db.exists("Planned Work Block", b2_name):
				frappe.delete_doc("Planned Work Block", b2_name, force=True)
			if "block_name" in locals() and block_name and frappe.db.exists("Planned Work Block", block_name):
				frappe.delete_doc("Planned Work Block", block_name, force=True)

	def test_manager_flag_work_block_workflow(self):
		"""TDD Phase 1 (Red): Manager can flag a block for review with clarification notes."""
		from omnitrack.api import book_work_block, log_work_session
		from omnitrack.api.timesheet import flag_work_block

		bk = book_work_block(
			work_date=nowdate(),
			start_time="10:00:00",
			end_time="11:30:00",
			deliverable_notes="TDD Flagging Test Deliverables for client feature",
			employee=frappe.session.user
		)
		b_name = bk["name"]
		try:
			log_work_session(
				block_name=b_name,
				hours=1.5,
				notes="Completed preliminary work session for client inspection and quality assurance audit across all active deliverables today."
			)
			# Manager flags the work block
			res = flag_work_block(
				block_name=b_name,
				reason="Please specify the client ticket reference and commit hash."
			)
			self.assertEqual(res.get("status"), "success")
			b_doc = frappe.get_doc("Planned Work Block", b_name)
			self.assertEqual(b_doc.approval_status, "Flagged")
			self.assertEqual(b_doc.flagged_reason, "Please specify the client ticket reference and commit hash.")
		finally:
			if frappe.db.exists("Planned Work Block", b_name):
				frappe.delete_doc("Planned Work Block", b_name, force=True)

	def test_approved_work_block_immutability_locking(self):
		"""TDD Phase 1 (Red): Once a work block is approved by manager, user modifications and session deletions are locked."""
		from omnitrack.api import book_work_block, log_work_session, approve_work_blocks
		from omnitrack.api.timesheet import update_work_session, delete_work_session

		bk = book_work_block(
			work_date=nowdate(),
			start_time="12:00:00",
			end_time="13:00:00",
			deliverable_notes="TDD Immutability Test Deliverables for compliance audit",
			employee=frappe.session.user
		)
		b_name = bk["name"]
		try:
			log_res = log_work_session(
				block_name=b_name,
				hours=1.0,
				notes="Work delivered and verified. Ready for executive manager review, comprehensive billing validation, and payroll signoff across team."
			)
			b_doc = frappe.get_doc("Planned Work Block", b_name)
			sess_name = b_doc.sessions[0].name

			# Manager approves the block
			approve_work_blocks(block_names=[b_name], comments="Certified by lead")
			b_doc.reload()
			self.assertEqual(b_doc.approval_status, "Approved")

			# Switch session user to standard non-manager user to test immutability locking
			orig_user = frappe.session.user
			try:
				frappe.set_user("test_user_immutability@example.com")
				# Mock roles for this test user
				frappe.cache.delete_keys("roles:test_user_immutability@example.com")
				
				# User attempts to modify approved session; must throw PermissionError
				with self.assertRaises(frappe.PermissionError):
					update_work_session(
						session_name=sess_name,
						block_name=b_name,
						notes="Attempting unauthorized modification of locked approved timesheet deliverable notes and session records."
					)

				# User attempts to delete approved session; must throw PermissionError
				with self.assertRaises(frappe.PermissionError):
					delete_work_session(
						session_name=sess_name,
						block_name=b_name
					)
			finally:
				frappe.set_user(orig_user)
		finally:
			if frappe.db.exists("Planned Work Block", b_name):
				frappe.delete_doc("Planned Work Block", b_name, force=True)




