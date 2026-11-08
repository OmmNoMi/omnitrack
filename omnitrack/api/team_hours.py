# Copyright (c) 2026, OmmNoMi Automation LLP and contributors
# For license information, please see license.txt

"""Hours each person worked in a period, for reviewing timesheets.

Worked time is the block's Work Sessions, counted on the day each session was worked (a night
session split at midnight counts on both days). A block logged before sessions existed has only
`actual_hours`, and counts on its own work date. Break and Away time is reported apart, never as
worked time.
"""

import frappe
from frappe import _
from frappe.utils import add_days, date_diff, flt, getdate

from omnitrack.utils.activity import is_away

MAX_DAYS = 92
NOT_PLANNED = ("Cancelled", "Rescheduled")


def can_review_team(user=None):
	"""Managers and HR see everyone's hours; anyone else sees their own."""
	from omnitrack.permissions import is_omnitrack_manager

	user = user or frappe.session.user
	return is_omnitrack_manager(user) or bool({"HR Manager", "HR User"} & set(frappe.get_roles(user)))


def _period(from_date, to_date):
	to_d = getdate(to_date) if to_date else getdate()
	from_d = getdate(from_date) if from_date else add_days(to_d, -6)
	if from_d > to_d:
		frappe.throw(_("The period starts after it ends."))
	if date_diff(to_d, from_d) + 1 > MAX_DAYS:
		frappe.throw(_("Pick a period of at most {0} days.").format(MAX_DAYS))
	return from_d, to_d


def _person(user, full_name):
	return {
		"user": user,
		"full_name": full_name or user,
		"worked": 0.0,
		"planned": 0.0,
		"away": 0.0,
		"approved": 0.0,
		"awaiting": 0.0,
		"flagged": 0.0,
		"blocks": 0,
		"by_day": {},
		"by_project": {},
	}


@frappe.whitelist()
def get_team_hours(from_date=None, to_date=None):
	"""Per person: hours worked by day and by project, planned hours, and how much is approved."""
	user = frappe.session.user
	if not user or user == "Guest":
		frappe.throw(_("Authentication required."), frappe.PermissionError)

	from_d, to_d = _period(from_date, to_date)
	everyone = can_review_team(user)
	days = [str(add_days(from_d, i)) for i in range(date_diff(to_d, from_d) + 1)]
	in_range = set(days)

	# A night session that started the evening before can land on the first day of the period
	filters = {"work_date": ["between", [add_days(from_d, -1), to_d]], "employee": ["is", "set"]}
	if not everyone:
		filters["employee"] = user
	blocks = frappe.get_all(
		"Planned Work Block",
		filters=filters,
		fields=[
			"name", "employee", "work_date", "duration_hours", "actual_hours",
			"task_nature", "status", "approval_status", "project",
		],
		limit_page_length=0,
	)

	sessions_of = {}
	if blocks:
		for s in frappe.get_all(
			"OmniTrack Work Session",
			filters={"parenttype": "Planned Work Block", "parent": ["in", [b.name for b in blocks]]},
			fields=["parent", "session_date", "hours"],
			limit_page_length=0,
		):
			sessions_of.setdefault(s.parent, []).append(s)

	people = {}
	names = dict(frappe.get_all(
		"User", filters={"name": ["in", list({b.employee for b in blocks} | {user})]},
		fields=["name", "full_name"], as_list=True, limit_page_length=0,
	))

	project_names = {}
	project_ids = list({b.project for b in blocks if b.project})
	if project_ids and frappe.db.exists("DocType", "Project"):
		project_names = dict(frappe.get_all(
			"Project", filters={"name": ["in", project_ids]}, fields=["name", "project_name"],
			as_list=True, limit_page_length=0,
		))

	for b in blocks:
		p = people.get(b.employee)
		if not p:
			p = people[b.employee] = _person(b.employee, names.get(b.employee))
		work_date = str(b.work_date)
		if work_date in in_range and b.status not in NOT_PLANNED and not is_away(b.task_nature):
			p["planned"] += flt(b.duration_hours)

		rows = sessions_of.get(b.name)
		pieces = [(str(s.session_date or work_date), flt(s.hours)) for s in rows] if rows else [(work_date, flt(b.actual_hours))]
		pieces = [(d, h) for d, h in pieces if d in in_range and h > 0]
		if not pieces:
			continue
		hours = sum(h for _d, h in pieces)
		if is_away(b.task_nature):
			p["away"] += hours
			continue
		p["blocks"] += 1
		p["worked"] += hours
		for d, h in pieces:
			p["by_day"][d] = p["by_day"].get(d, 0.0) + h
		label = project_names.get(b.project) or b.project or _("General")
		p["by_project"][label] = p["by_project"].get(label, 0.0) + hours
		if b.approval_status == "Approved":
			p["approved"] += hours
		elif b.approval_status in ("Flagged", "Rejected"):
			p["flagged"] += hours
		else:
			p["awaiting"] += hours

	if not everyone and user not in people:
		people[user] = _person(user, names.get(user))

	r2 = lambda v: round(v, 2)  # noqa: E731
	out = []
	for p in people.values():
		if not (p["worked"] or p["planned"] or p["away"]) and p["user"] != user:
			continue
		for key in ("worked", "planned", "away", "approved", "awaiting", "flagged"):
			p[key] = r2(p[key])
		p["by_day"] = {d: r2(h) for d, h in sorted(p["by_day"].items())}
		p["by_project"] = [
			{"project": k, "hours": r2(v)} for k, v in sorted(p["by_project"].items(), key=lambda kv: -kv[1])
		]
		out.append(p)
	out.sort(key=lambda p: (-p["worked"], p["full_name"].lower()))

	return {
		"from_date": str(from_d),
		"to_date": str(to_d),
		"days": days,
		"can_review_team": everyone,
		"people": out,
		"total_worked": r2(sum(p["worked"] for p in out)),
	}
