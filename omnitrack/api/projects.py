"""Projects page: the ERPNext Projects a person may see, with the numbers that manage them.

ERPNext owns Project and Task. OmniTrack adds what only it knows: the time planned in
Planned Work Blocks and the time logged against them. Nothing here keeps a copy.
"""

import frappe
from frappe.utils import flt, getdate, nowdate

from omnitrack.permissions import client_visible_people, is_project_client, projects_for

CLOSED_TASK = ("Completed", "Cancelled", "Template")
# Blocks that no longer stand for planned time
DROPPED_BLOCK = ("Cancelled", "Rescheduled")
PROJECT_FIELDS = [
	"name", "project_name", "status", "customer", "priority", "percent_complete",
	"expected_start_date", "expected_end_date", "modified",
]


def summarize(project, tasks, blocks, today, client=False, hide_logged=False):
	"""One project's row. Pure: every number comes from the rows passed in.

	tasks: Task rows with status, exp_end_date, expected_time, is_group.
	blocks: Planned Work Block rows with status, duration_hours, actual_hours.
	A client never sees planned time, and sees logged time only when the project allows it.
	"""
	today = getdate(today)
	# A group task is a heading for its subtasks, not work of its own
	open_tasks = [t for t in tasks if t.get("status") not in CLOSED_TASK and not t.get("is_group")]
	overdue = [
		t for t in open_tasks
		if t.get("status") == "Overdue" or (t.get("exp_end_date") and getdate(t["exp_end_date"]) < today)
	]
	estimate = sum(flt(t.get("expected_time")) for t in tasks if not t.get("is_group") and t.get("status") != "Cancelled")
	live = [b for b in blocks if b.get("status") not in DROPPED_BLOCK]
	planned = sum(flt(b.get("duration_hours")) for b in live)
	logged = sum(flt(b.get("actual_hours")) for b in live)

	end = project.get("expected_end_date")
	is_open = project.get("status") == "Open"
	health, reason = None, ""
	if is_open and end and getdate(end) < today:
		health, reason = "late", "Past its end date"
	elif is_open and overdue:
		health, reason = "at_risk", f"{len(overdue)} overdue task{'s' if len(overdue) != 1 else ''}"
	elif is_open and estimate > 0 and logged > estimate:
		health, reason = "at_risk", "Logged more than estimated"
	if hide_logged and reason == "Logged more than estimated":
		health, reason = None, ""

	return {
		"name": project.get("name"),
		"title": project.get("project_name") or project.get("name"),
		"status": project.get("status"),
		"customer": project.get("customer"),
		"priority": project.get("priority"),
		"percent": flt(project.get("percent_complete")),
		"start": str(project["expected_start_date"]) if project.get("expected_start_date") else None,
		"end": str(end) if end else None,
		"open_tasks": len(open_tasks),
		"overdue_tasks": len(overdue),
		"estimate_hours": round(estimate, 2),
		"planned_hours": None if client else round(planned, 2),
		"logged_hours": None if hide_logged else round(logged, 2),
		"health": health,
		"health_reason": reason,
	}


def _group(rows, key="project"):
	out = {}
	for r in rows:
		out.setdefault(r.get(key), []).append(r)
	return out


@frappe.whitelist()
def get_projects():
	"""Every project the caller may see, newest activity first."""
	if not frappe.db.exists("DocType", "Project"):
		return {"available": False, "projects": []}

	user = frappe.session.user
	allowed = projects_for(user)
	client = is_project_client(user)
	if allowed == []:
		return {"available": True, "projects": [], "is_client": client}
	filters = {} if allowed is None else {"name": ["in", allowed]}
	projects = frappe.get_all(
		"Project", filters=filters, fields=PROJECT_FIELDS,
		order_by="modified desc", limit_page_length=500, ignore_permissions=True,
	)
	names = [p.name for p in projects]
	if not names:
		return {"available": True, "projects": [], "is_client": client}

	task_filters = {"project": ["in", names], "status": ["!=", "Template"]}
	if client:
		if not frappe.db.has_column("Task", "custom_is_public_deliverable"):
			task_filters = None
		else:
			task_filters["custom_is_public_deliverable"] = 1
	tasks = _group(frappe.get_all(
		"Task", filters=task_filters,
		fields=["project", "status", "exp_end_date", "expected_time", "is_group"],
		limit_page_length=0, ignore_permissions=True,
	)) if task_filters else {}
	blocks = _group(frappe.get_all(
		"Planned Work Block", filters={"project": ["in", names]},
		fields=["project", "status", "duration_hours", "actual_hours"],
		limit_page_length=0, ignore_permissions=True,
	))
	hidden = set()
	if client:
		hidden = set(frappe.get_all(
			"Project User", filters={"parenttype": "Project", "parent": ["in", names], "user": user, "hide_timesheets": 1},
			pluck="parent", ignore_permissions=True,
		))

	today = nowdate()
	return {
		"available": True,
		"is_client": client,
		"projects": [
			summarize(p, tasks.get(p.name, []), blocks.get(p.name, []), today, client=client, hide_logged=p.name in hidden)
			for p in projects
		],
	}


def _names(assign_json, only=None):
	"""Full names of the people a Task is assigned to; with `only`, just those people."""
	try:
		users = frappe.parse_json(assign_json) or []
	except Exception:
		users = []
	return [frappe.utils.get_fullname(u) or u for u in users if only is None or u in only]


@frappe.whitelist()
def get_project(name):
	"""One project with its tasks, each under its milestone (its parent group task)."""
	if not frappe.db.exists("DocType", "Project"):
		frappe.throw(frappe._("Projects are not set up on this site."))
	user = frappe.session.user
	allowed = projects_for(user)
	if allowed is not None and name not in allowed:
		frappe.throw(frappe._("You cannot see this project."), frappe.PermissionError)
	client = is_project_client(user)

	project = frappe.db.get_value("Project", name, PROJECT_FIELDS, as_dict=True)
	if not project:
		frappe.throw(frappe._("Project {0} not found").format(name), frappe.DoesNotExistError)

	filters = {"project": name, "status": ["!=", "Template"]}
	if client:
		if not frappe.db.has_column("Task", "custom_is_public_deliverable"):
			filters = None
		else:
			filters["custom_is_public_deliverable"] = 1
	tasks = frappe.get_all(
		"Task", filters=filters,
		fields=["name", "subject", "status", "priority", "exp_start_date", "exp_end_date", "expected_time",
			"progress", "is_group", "is_milestone", "parent_task", "_assign"],
		order_by="creation asc",
		limit_page_length=0, ignore_permissions=True,
	) if filters else []
	# Soonest due first, undated last. Frappe 16 refuses an expression ("x is null") in order_by.
	tasks.sort(key=lambda t: (t.exp_end_date is None, t.exp_end_date or getdate("1900-01-01")))
	blocks = frappe.get_all(
		"Planned Work Block", filters={"project": name},
		fields=["task", "status", "duration_hours", "actual_hours"],
		limit_page_length=0, ignore_permissions=True,
	)
	hide_logged = client and bool(frappe.db.exists(
		"Project User", {"parenttype": "Project", "parent": name, "user": user, "hide_timesheets": 1}))

	per_task = {}
	for b in blocks:
		if b.status in DROPPED_BLOCK or not b.task:
			continue
		row = per_task.setdefault(b.task, [0.0, 0.0])
		row[0] += flt(b.duration_hours)
		row[1] += flt(b.actual_hours)

	# A client sees a shared task, but names only the people visible to clients
	visible = client_visible_people() if client else None
	today = getdate(nowdate())
	rows = []
	for t in tasks:
		planned, logged = per_task.get(t.name, (0.0, 0.0))
		closed = t.status in CLOSED_TASK
		rows.append({
			"name": t.name,
			"subject": t.subject,
			"status": t.status,
			"priority": t.priority,
			"start": str(t.exp_start_date)[:10] if t.exp_start_date else None,
			"due": str(t.exp_end_date)[:10] if t.exp_end_date else None,
			"estimate_hours": flt(t.expected_time),
			"planned_hours": None if client else round(planned, 2),
			"logged_hours": None if hide_logged else round(logged, 2),
			"progress": flt(t.progress),
			"is_group": t.is_group,
			"is_milestone": t.is_milestone,
			"parent": t.parent_task,
			"assignees": _names(t._assign, only=visible),
			"is_overdue": not closed and not t.is_group and (
				t.status == "Overdue" or bool(t.exp_end_date and getdate(t.exp_end_date) < today)),
		})

	return {
		"project": summarize(project, tasks, blocks, nowdate(), client=client, hide_logged=hide_logged),
		"tasks": rows,
		"is_client": client,
	}
