# Copyright (c) 2026, OmmNoMi Automation LLP and contributors
# For license information, please see license.txt

import frappe
from frappe.tests.utils import FrappeTestCase
from frappe.utils import flt, nowdate

from omnitrack.api import book_work_block, log_work_session, quick_timer_punch


class TestCollaborativePairing(FrappeTestCase):
	def setUp(self):
		super().setUp()
		self.test_partner = "test_partner@ommnomi.local"
		if not frappe.db.exists("User", self.test_partner):
			u = frappe.new_doc("User")
			u.email = self.test_partner
			u.first_name = "Test Partner"
			u.save(ignore_permissions=True)

	def test_reciprocal_collaborative_pairing_block_booking(self):
		"""Phase 5 Invariant: Booking a block with a pairing partner automatically
		creates a reciprocal paired block for the partner."""
		res = book_work_block(
			work_date=nowdate(),
			start_time="14:00:00",
			end_time="16:00:00",
			work_item_label="Pairing Integration Session",
			pairing_partner=self.test_partner,
			employee="Administrator"
		)
		self.assertEqual(res["status"], "success")
		primary_block_name = res["name"]
		partner_block_name = res.get("paired_block")

		self.assertIsNotNone(partner_block_name, "Primary block must have a paired_block reference")
		primary_doc = frappe.get_doc("Planned Work Block", primary_block_name)
		self.assertEqual(primary_doc.pairing_partner, self.test_partner)
		self.assertEqual(primary_doc.paired_block, partner_block_name)

		partner_doc = frappe.get_doc("Planned Work Block", partner_block_name)
		self.assertEqual(partner_doc.employee, self.test_partner)
		self.assertEqual(partner_doc.pairing_partner, "Administrator")
		self.assertEqual(partner_doc.paired_block, primary_block_name)
		self.assertEqual(str(partner_doc.start_time), "14:00:00")
		self.assertEqual(str(partner_doc.end_time), "16:00:00")
		self.assertEqual(partner_doc.duration_hours, 2.0)

	def test_collaborative_pairing_session_mirroring(self):
		"""Phase 5 Invariant: Logging a work session on a paired block mirrors
		the session onto the partner's block."""
		res = book_work_block(
			work_date=nowdate(),
			start_time="10:00:00",
			end_time="11:30:00",
			work_item_label="Collaborative Sprint",
			pairing_partner=self.test_partner,
			employee="Administrator"
		)
		primary_block_name = res["name"]
		partner_block_name = res["paired_block"]

		# Log session on primary block
		log_res = log_work_session(
			block_name=primary_block_name,
			from_time="10:00:00",
			to_time="11:30:00",
			hours=1.5,
			notes="Executed joint data mapping and migration",
			session_date=nowdate()
		)
		self.assertEqual(log_res["status"], "success")

		# Check that session mirrored to partner block
		partner_doc = frappe.get_doc("Planned Work Block", partner_block_name)
		self.assertEqual(len(partner_doc.sessions), 1, "Session must be mirrored to partner block")
		mirrored = partner_doc.sessions[0]
		self.assertEqual(str(mirrored.from_time), "10:00:00")
		self.assertEqual(str(mirrored.to_time), "11:30:00")
		self.assertEqual(flt(mirrored.hours), 1.5)
		self.assertEqual(mirrored.notes, "Executed joint data mapping and migration")
		self.assertEqual(partner_doc.actual_hours, 1.5)

	def test_collaborative_pairing_mirrored_timesheet(self):
		"""Phase 5 Invariant: Stopping a quick punch session with a pairing
		partner generates a mirrored Planned Work Block for the partner."""
		res = quick_timer_punch(
			action="stop",
			work_date=nowdate(),
			duration_hours=2.0,
			deliverable_notes="Joint architecture pairing session on OmniTrack PWA",
			pairing_partner=self.test_partner
		)
		self.assertEqual(res["status"], "success")
		self.assertIsNotNone(res.get("partner_block"))

		partner_doc = frappe.get_doc("Planned Work Block", res["partner_block"])
		self.assertEqual(partner_doc.employee, self.test_partner)
