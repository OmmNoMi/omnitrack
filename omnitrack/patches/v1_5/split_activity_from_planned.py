# Copyright (c) 2026, OmmNoMi Automation LLP and contributors
# For license information, please see license.txt

import frappe

from omnitrack.utils.activity import said_unplanned, to_kind


def execute():
	"""
	[post_model_sync] Idempotent patch:
	`task_nature` used to say both whether time was planned and what kind of time it was
	("🎯 Planned", "⚠️ Unplanned", "🤝 Virtual Meeting"…). Planned-ness is now the block's own
	`unplanned` flag, and the activity is one plain kind (`activity.KINDS`). Blocks that said
	Unplanned get the flag first; then every stored value, on blocks and on their session rows,
	becomes its kind.

	Written with plain UPDATEs, never by saving the block: saving would run the past plan lock.
	"""
	if not frappe.db.exists("DocType", "Planned Work Block"):
		return

	block = frappe.qb.DocType("Planned Work Block")
	if frappe.db.has_column("Planned Work Block", "unplanned"):
		for value in frappe.qb.from_(block).select(block.task_nature).distinct().run(pluck=True):
			if said_unplanned(value):
				frappe.qb.update(block).set(block.unplanned, 1).where(block.task_nature == value).run()

	for doctype in ("Planned Work Block", "OmniTrack Work Session"):
		if not frappe.db.exists("DocType", doctype):
			continue
		table = frappe.qb.DocType(doctype)
		for value in frappe.qb.from_(table).select(table.task_nature).distinct().run(pluck=True):
			kind = to_kind(value)
			if value == kind:
				continue
			query = frappe.qb.update(table).set(table.task_nature, kind)
			query = query.where(table.task_nature.isnull()) if value is None else query.where(table.task_nature == value)
			query.run()
