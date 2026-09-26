# Copyright (c) 2026, OmmNoMi Automation LLP and contributors
# For license information, please see license.txt

import frappe
from frappe.utils import flt
from omnitrack.services.midnight_splitter import MidnightSplitter


class PairingEngine:
	"""
	Domain Service managing bilateral collaborative pairing invariants:
	1. Paired Block Mirroring: When user books or updates a work block with a pairing_partner,
	   the engine creates or updates the reciprocal block for the collaborator.
	2. Mirrored Session Logging: Completed work sessions logged by one partner are automatically
	   synchronized to the collaborator's paired block with identical timestamps and deliverable notes.
	"""

	@classmethod
	def sync_paired_block(cls, source_doc):
		"""
		Ensures a reciprocal Planned Work Block exists for source_doc.pairing_partner.
		Updates bilateral linkage: source_doc.paired_block <-> partner_doc.paired_block.
		"""
		partner = getattr(source_doc, "pairing_partner", None)
		if not partner or partner == source_doc.employee:
			return None

		# Check if paired_block is already linked
		partner_doc = None
		if getattr(source_doc, "paired_block", None) and frappe.db.exists("Planned Work Block", source_doc.paired_block):
			partner_doc = frappe.get_doc("Planned Work Block", source_doc.paired_block)
		else:
			# Find existing matching block on same day & time or create new
			existing = frappe.db.get_value(
				"Planned Work Block",
				{
					"employee": partner,
					"work_date": source_doc.work_date,
					"start_time": source_doc.start_time,
					"end_time": source_doc.end_time,
				},
				"name"
			)
			if existing:
				partner_doc = frappe.get_doc("Planned Work Block", existing)
			else:
				partner_doc = frappe.new_doc("Planned Work Block")
				partner_doc.employee = partner
				partner_doc.work_date = source_doc.work_date
				partner_doc.start_time = source_doc.start_time
				partner_doc.end_time = source_doc.end_time
				partner_doc.duration_hours = source_doc.duration_hours
				partner_doc.project = getattr(source_doc, "project", None)
				partner_doc.task = getattr(source_doc, "task", None)
				partner_doc.work_item = getattr(source_doc, "work_item", None)
				partner_doc.work_item_label = getattr(source_doc, "work_item_label", None)
				partner_doc.task_nature = getattr(source_doc, "task_nature", "🎯 Planned")
				partner_doc.deliverable_notes = f"[Pairing with {source_doc.employee}]\n{getattr(source_doc, 'deliverable_notes', '')}"
				partner_doc.status = source_doc.status or "Planned"

		# Establish bilateral pointers
		partner_doc.pairing_partner = source_doc.employee
		partner_doc.paired_block = source_doc.name
		partner_doc.flags.ignore_permissions = True
		partner_doc.flags.ignore_links = True
		partner_doc.save()

		if not getattr(source_doc, "paired_block", None) or source_doc.paired_block != partner_doc.name:
			frappe.db.set_value("Planned Work Block", source_doc.name, "paired_block", partner_doc.name, update_modified=False)

		return partner_doc.name

	@classmethod
	def mirror_session_to_partner(cls, source_doc, session_date, from_time, to_time, hours, notes=None, logged_via="Stopwatch", output_metrics=None):
		"""
		Mirrors a completed session row into the paired partner's work block.
		Guarantees idempotency (avoids duplicate session rows on the partner block).
		"""
		paired_block_name = getattr(source_doc, "paired_block", None)
		if not paired_block_name or not frappe.db.exists("Planned Work Block", paired_block_name):
			return False

		try:
			partner_doc = frappe.get_doc("Planned Work Block", paired_block_name)
			already_logged = any(
				str(s.session_date) == str(session_date) and str(s.from_time) == str(from_time) and str(s.to_time) == str(to_time)
				for s in (partner_doc.sessions or [])
			)
			if already_logged:
				return False

			if MidnightSplitter.is_overnight(from_time, to_time):
				p1, p2 = MidnightSplitter.split_session_rows(
					base_date=session_date,
					from_time=from_time,
					to_time=to_time,
					notes=notes,
					logged_via=logged_via,
					task_nature=partner_doc.task_nature
				)
				partner_doc.append("sessions", p1)
				partner_doc.append("sessions", p2)
			else:
				partner_doc.append("sessions", {
					"session_date": str(session_date),
					"from_time": from_time,
					"to_time": to_time,
					"hours": flt(hours),
					"notes": notes,
					"logged_via": logged_via or "Manual",
					"task_nature": partner_doc.task_nature,
				})

			if output_metrics and isinstance(output_metrics, list):
				for m in output_metrics:
					if isinstance(m, dict) and (m.get("quantity") or m.get("metric_type")):
						partner_doc.append("output_metrics", {
							"metric_type": m.get("metric_type") or "Records Processed",
							"quantity": flt(m.get("quantity", 1.0)),
							"unit": m.get("unit") or "",
							"reference_id": m.get("reference_id") or "",
							"notes": m.get("notes") or ""
						})

			partner_doc.flags.ignore_permissions = True
			partner_doc.flags.ignore_links = True
			partner_doc.save()
			return True
		except Exception as e:
			frappe.log_error(f"Error mirroring session to paired block {paired_block_name}: {e}", "OmniTrack Pairing")
			return False
