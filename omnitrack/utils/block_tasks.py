# Copyright (c) 2026, OmmNoMi Automation LLP and contributors
# For license information, please see license.txt

"""The tasks a Planned Work Block is for, stored as `OmniTrack Block Task` child rows.

A block can cover several tasks. Its first row is always its main task (`work_item`).
API payloads keep the shape the workstation already used, so the frontend reads
`block.tasks` as a list of {id, ref, doctype, subject, project, status, ...}.
"""

import frappe

CHILD = "OmniTrack Block Task"
DONE = ("Completed", "Closed", "Done")


def todo_subject(description):
	return frappe.utils.strip_html(description or "").strip().split("\n")[0][:140] or "Untitled to-do"


def normalize_status(status):
	if status in DONE:
		return "Completed"
	if status == "Rescheduled":
		return "Rescheduled"
	return "Open"


def resolve_ref(ref):
	"""A row dict for a work-item ref (`todo:<name>`, `task:<name>` or a bare Task name), else None."""
	ref = str(ref or "").strip()
	if not ref:
		return None
	if ref.startswith("todo:"):
		name = ref.split(":", 1)[1]
		td = frappe.db.get_value("ToDo", name, ["name", "description", "status"], as_dict=True)
		if not td:
			return None
		return {
			"work_item": ref,
			"subject": todo_subject(td.description),
			"reference_doctype": "ToDo",
			"reference_name": td.name,
			"status": "Completed" if td.status == "Closed" else "Open",
		}
	name = ref.split(":", 1)[1] if ref.startswith("task:") else ref
	if frappe.db.exists("DocType", "Task"):
		t = frappe.db.get_value("Task", name, ["name", "subject", "project", "status"], as_dict=True)
		if t:
			return {
				"work_item": t.name,
				"subject": t.subject or t.name,
				"reference_doctype": "Task",
				"reference_name": t.name,
				"project": t.project,
				"status": "Completed" if t.status == "Completed" else "Open",
			}
	return None


def free_item(subject):
	"""A plain checklist row that is not linked to any Task or ToDo."""
	return {"work_item": f"item:{frappe.generate_hash(length=8)}", "subject": subject, "status": "Open"}


def new_todo(line, user, project=None, task=None):
	"""A native ToDo for a typed task name, as a row dict; a plain checklist row if it can't be made.
	Typed names (from a meeting, chat or WhatsApp) live in the Frappe ecosystem this way."""
	try:
		td = frappe.new_doc("ToDo")
		td.description = line
		td.allocated_to = user
		if project and frappe.db.exists("DocType", "Project") and frappe.db.exists("Project", project):
			td.reference_type = "Project"
			td.reference_name = project
		elif task and frappe.db.exists("DocType", "Task") and frappe.db.exists("Task", task):
			td.reference_type = "Task"
			td.reference_name = task
		td.status = "Open"
		td.flags.ignore_permissions = True
		td.insert()
		return {"work_item": f"todo:{td.name}", "subject": line, "reference_doctype": "ToDo",
			"reference_name": td.name, "status": "Open"}
	except Exception:
		return free_item(line)


def set_row_done(row, done):
	"""Ticks a block's task row on or off, and the Task or ToDo it stands for with it."""
	row.status = "Completed" if done else "Open"
	row.completed_at = frappe.utils.now_datetime() if done else None
	if row.reference_doctype == "Task" and frappe.db.exists("DocType", "Task") and frappe.db.exists("Task", row.reference_name):
		frappe.db.set_value("Task", row.reference_name, "status", "Completed" if done else "Open")
	elif row.reference_doctype == "ToDo" and frappe.db.exists("ToDo", row.reference_name):
		frappe.db.set_value("ToDo", row.reference_name, "status", "Closed" if done else "Open")


def serialize(row):
	"""Child row (doc or dict) -> the API shape the workstation reads."""
	get = row.get
	completed = get("completed_at")
	return {
		"id": get("reference_name") or get("work_item"),
		"ref": get("work_item"),
		"doctype": get("reference_doctype") or "Item",
		"subject": get("subject"),
		"project": get("project"),
		"status": get("status") or "Open",
		"completed_at": str(completed) if completed else None,
		"rescheduled_to": get("rescheduled_to"),
	}


SESSION_TASK_KEYS = ("ref", "subject", "project", "doctype", "status", "completed_at")


def clean_session_tasks(val, limit=50):
	"""The task list a running session carries before it has a block: refs and labels only."""
	import json

	if isinstance(val, str):
		try:
			val = json.loads(val)
		except Exception:
			return []
	if not isinstance(val, list):
		return []
	out, seen = [], set()
	for t in val:
		if not isinstance(t, dict) or not t.get("ref") or t["ref"] in seen:
			continue
		seen.add(t["ref"])
		row = {k: (str(t[k])[:200] if t.get(k) is not None else None) for k in SESSION_TASK_KEYS}
		row["id"] = row["ref"][5:] if row["ref"].startswith("todo:") else row["ref"]
		row["status"] = "Completed" if row["status"] == "Completed" else "Open"
		out.append(row)
		if len(out) >= limit:
			break
	return out


def attach_session_tasks(block, session_tasks):
	"""Puts a stopped session's tasks on the block it became, ticking the ones done in it."""
	for t in clean_session_tasks(session_tasks):
		row = resolve_ref(t["ref"])
		if not row:
			continue
		done = t["status"] == "Completed"
		child = block.append("tasks", row)
		set_row_done(child, done)


def block_tasks(doc):
	return [serialize(r) for r in (doc.get("tasks") or [])]


def tasks_by_block(block_names):
	"""{block name: [serialized rows]} with one query for any number of blocks."""
	out = {n: [] for n in block_names}
	if not block_names:
		return out
	for r in frappe.get_all(
		CHILD,
		filters={"parenttype": "Planned Work Block", "parent": ["in", list(block_names)]},
		fields=["parent", "work_item", "subject", "reference_doctype", "reference_name",
			"project", "status", "completed_at", "rescheduled_to"],
		order_by="parent asc, idx asc",
		limit_page_length=0,
	):
		out.setdefault(r.parent, []).append(serialize(r))
	return out


def parse_legacy(val):
	"""Parse the retired `connected_tasks` JSON / bullet text. Used only by the v1.4 patch."""
	import json

	if not val:
		return []
	if isinstance(val, list):
		return val
	val = str(val).strip()
	if not val:
		return []
	try:
		parsed = json.loads(val)
		if isinstance(parsed, list):
			return [p for p in parsed if isinstance(p, dict)]
	except Exception:
		pass
	lines = [line.strip("- •* \t") for line in val.split("\n") if line.strip("- •* \t")]
	return [{"subject": line} for line in lines]
