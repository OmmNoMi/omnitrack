# Copyright (c) 2026, OmmNoMi Automation LLP and contributors
# For license information, please see license.txt

import frappe

from omnitrack.utils.block_tasks import CHILD, normalize_status, parse_legacy, resolve_ref


def execute():
	"""
	[post_model_sync] Idempotent patch:
	Moves each Planned Work Block's tasks into the `tasks` child table: the retired
	`connected_tasks` JSON (its column survives the field's removal) and the block's main
	task (`work_item` / `task`) as the first row. Blocks that already have rows are skipped.

	Rows are written with db_insert, never by saving the block: saving would run the past
	plan lock, which refuses any change to a block older than the grace period.
	"""
	if not frappe.db.exists("DocType", CHILD) or not frappe.db.exists("DocType", "Planned Work Block"):
		return

	has_legacy = frappe.db.has_column("Planned Work Block", "connected_tasks")
	fields = ["name", "work_item", "work_item_label", "task", "project"]
	if has_legacy:
		fields.append("connected_tasks")
	done = set(frappe.get_all(CHILD, filters={"parenttype": "Planned Work Block"}, pluck="parent", distinct=True))

	for b in frappe.db.get_all("Planned Work Block", fields=fields, limit_page_length=0):
		if b.name in done:
			continue
		rows = [_legacy_row(it, b.project) for it in parse_legacy(b.get("connected_tasks"))]
		rows = [r for r in rows if r]
		primary_ref = (b.work_item or b.task or "").strip()
		if primary_ref:
			primary = next((r for r in rows if r["work_item"] == primary_ref), None)
			if primary:
				rows.remove(primary)
			else:
				primary = resolve_ref(primary_ref) or {"work_item": primary_ref, "subject": b.work_item_label or primary_ref}
			rows.insert(0, primary)
		for idx, row in enumerate(rows, 1):
			frappe.get_doc({
				"doctype": CHILD,
				"parent": b.name,
				"parenttype": "Planned Work Block",
				"parentfield": "tasks",
				"idx": idx,
				**row,
			}).db_insert()


def _legacy_row(it, project=None):
	subject = (it.get("subject") or it.get("title") or "").strip()
	if not subject:
		return None
	kind = it.get("doctype")
	ref = str(it.get("ref") or it.get("id") or "").strip()
	row = {"subject": subject[:140], "status": normalize_status(it.get("status")), "project": it.get("project") or project}
	if kind == "ToDo" and ref:
		name = ref.split(":", 1)[1] if ref.startswith("todo:") else ref
		row.update(work_item=f"todo:{name}", reference_doctype="ToDo", reference_name=name)
	elif kind == "Task" and ref:
		name = ref.split(":", 1)[1] if ref.startswith("task:") else ref
		row.update(work_item=name, reference_doctype="Task", reference_name=name)
	else:
		row["work_item"] = ref if ref.startswith("item:") and len(ref) > 7 else f"item:{frappe.generate_hash(length=8)}"
	if row.get("reference_doctype") and not frappe.db.exists(row["reference_doctype"], row["reference_name"]):
		# A ref to a Task/ToDo that no longer exists keeps its text as a plain checklist item.
		row.pop("reference_doctype")
		row.pop("reference_name")
		row["work_item"] = f"item:{frappe.generate_hash(length=8)}"
	if it.get("completed_at"):
		row["completed_at"] = it["completed_at"]
	if it.get("rescheduled_to") and frappe.db.exists("Planned Work Block", it["rescheduled_to"]):
		row["rescheduled_to"] = it["rescheduled_to"]
	return row
