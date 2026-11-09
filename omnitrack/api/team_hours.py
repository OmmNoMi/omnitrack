# Copyright (c) 2026, OmmNoMi Automation LLP and contributors
# For license information, please see license.txt

"""Hours each person worked in a period, for reviewing timesheets.

Worked time is the block's Work Sessions, counted on the day each session was worked (a night
session split at midnight counts on both days). A block logged before sessions existed has only
`actual_hours`, and counts on its own work date. Break and Away time is reported apart, never as
worked time.

Planned time is what was planned ahead: blocks booked before the work, never the block OmniTrack
makes to hold time logged with no plan (its `unplanned` Check). Worked time on such blocks is
`unplanned`, so a person and their manager see how much of the work was planned, day by day.

Each person also carries `entries`: every block with worked time in the period, with its sessions'
start and end, so the same page that adds the hours up is where a manager approves or flags them.
"""

import frappe
from frappe import _
from frappe.utils import add_days, date_diff, flt, getdate

from omnitrack.permissions import (
	can_change_others_time,
	get_log_days_back,
	get_payroll_closed_through,
	is_omnitrack_manager,
)
from omnitrack.utils.activity import is_away
from omnitrack.utils.time_math import time_str

MAX_DAYS = 92
NOTES_CHARS = 400
NOT_PLANNED = ("Cancelled", "Rescheduled")


def can_review_team(user=None):
	"""Managers and HR see everyone's hours; anyone else sees their own."""
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
		# Worked on a block nobody planned ahead (logged straight from the timer or by hand)
		"unplanned": 0.0,
		"away": 0.0,
		"approved": 0.0,
		"awaiting": 0.0,
		"flagged": 0.0,
		"blocks": 0,
		"by_day": {},
		# Planned-ahead hours per day, so each day says worked against planned
		"planned_by_day": {},
		"by_project": {},
		"entries": [],
		# Days with Break or Away time: those are accounted for, so never "not logged"
		"_away_days": set(),
	}


def _review(approval_status):
	if approval_status == "Approved":
		return "approved"
	if approval_status in ("Flagged", "Rejected"):
		return "flagged"
	return "awaiting"


def _recording_block(user):
	"""The block a person's running session records on, if any. A running block is not approved yet."""
	from omnitrack.api.stopwatch import get_active_session

	try:
		return (get_active_session(user=user) or {}).get("trackerBlockName") or ""
	except Exception:
		return ""


def _waiting(user, everyone, closed=None):
	"""Logged time not approved yet, on any day: what a manager has to review, or what a person
	is still waiting on (and what was flagged back to them). Not limited to the period shown.
	`closed`: hours on days payroll is already closed through, which were paid unreviewed."""
	from frappe.query_builder import Case
	from frappe.query_builder.functions import Coalesce, Count, Max, Min, Sum

	pwb = frappe.qb.DocType("Planned Work Block")
	cols = [
		pwb.employee, pwb.approval_status, pwb.task_nature,
		Sum(pwb.actual_hours).as_("hours"), Count(pwb.name).as_("entries"),
		Min(pwb.work_date).as_("oldest"), Max(pwb.work_date).as_("newest"),
	]
	if closed:
		cols.append(Sum(Case().when(pwb.work_date <= closed, pwb.actual_hours).else_(0)).as_("closed"))
	q = (
		frappe.qb.from_(pwb)
		.select(*cols)
		.where((pwb.actual_hours > 0) & (Coalesce(pwb.approval_status, "") != "Approved") & (Coalesce(pwb.employee, "") != ""))
		.groupby(pwb.employee, pwb.approval_status, pwb.task_nature)
	)
	if not everyone:
		q = q.where(pwb.employee == user)
	by = {}
	for r in q.run(as_dict=True):
		# Break and Away time is not worked time, so nobody approves it
		if is_away(r.task_nature):
			continue
		w = by.setdefault(r.employee, {
			"user": r.employee, "awaiting": 0.0, "flagged": 0.0, "entries": 0,
			# Entry counts, so the summary says how many to look at and the person's line the hours
			"awaiting_entries": 0, "flagged_entries": 0, "closed": 0.0, "oldest": None, "newest": None,
		})
		review = _review(r.approval_status)
		w[review] += flt(r.hours)
		w[review + "_entries"] += r.entries
		w["closed"] += flt(r.get("closed"))
		w["entries"] += r.entries
		w["oldest"] = min(filter(None, (w["oldest"], r.oldest)))
		w["newest"] = max(filter(None, (w["newest"], r.newest)))
	names = dict(frappe.get_all(
		"User", filters={"name": ["in", list(by)]}, fields=["name", "full_name"], as_list=True, limit_page_length=0,
	)) if by else {}
	out = []
	for w in by.values():
		w.update(full_name=names.get(w["user"]) or w["user"], awaiting=round(w["awaiting"], 2), flagged=round(w["flagged"], 2), closed=round(w["closed"], 2),
			oldest=str(w["oldest"]), newest=str(w["newest"]))
		out.append(w)
	# Flagged first, then whoever has waited longest
	out.sort(key=lambda w: (not w["flagged"], w["oldest"], w["full_name"].lower()))
	return out


def _expected_days(users, days):
	"""Per user, the days in `days` they were expected to log time on: past days only (today is
	not over), working days by their Employee's Holiday List when ERPNext has one (else Monday to
	Friday), not on approved leave (HRMS), and within their employment, or after their account was
	made when they have no Employee. ERPNext and HRMS are optional, so each is looked up only if it
	is installed."""
	today = str(getdate())
	past = [d for d in days if d < today]
	if not users or not past:
		return {}
	lo, hi = past[0], past[-1]
	created = dict(frappe.get_all("User", filters={"name": ["in", users]}, fields=["name", "creation"], as_list=True, limit_page_length=0))
	emp_of, holidays_of, leave_of = {}, {}, {}
	if frappe.db.exists("DocType", "Employee"):
		for e in frappe.get_all(
			"Employee", filters={"user_id": ["in", users]},
			fields=["name", "user_id", "status", "date_of_joining", "relieving_date"], limit_page_length=0,
		):
			emp_of[e.user_id] = e
		lists = {}
		try:
			from erpnext.setup.doctype.employee.employee import get_holiday_list_for_employee
		except ImportError:
			get_holiday_list_for_employee = None
		for uid, e in emp_of.items():
			hl = None
			if get_holiday_list_for_employee:
				try:
					hl = get_holiday_list_for_employee(e.name, raise_exception=False)
				except Exception:
					hl = None
			if hl:
				if hl not in lists:
					lists[hl] = {str(d) for d in frappe.get_all(
						"Holiday", filters={"parent": hl, "parenttype": "Holiday List", "holiday_date": ["between", [lo, hi]]},
						pluck="holiday_date", limit_page_length=0,
					)}
				holidays_of[uid] = lists[hl]
		if emp_of and frappe.db.exists("DocType", "Leave Application"):
			uid_of = {e.name: uid for uid, e in emp_of.items()}
			for la in frappe.get_all(
				"Leave Application",
				filters={"employee": ["in", list(uid_of)], "status": "Approved", "docstatus": 1, "from_date": ["<=", hi], "to_date": [">=", lo]},
				fields=["employee", "from_date", "to_date"], limit_page_length=0,
			):
				off = leave_of.setdefault(uid_of[la.employee], set())
				for i in range(date_diff(la.to_date, la.from_date) + 1):
					off.add(str(add_days(la.from_date, i)))
	out = {}
	for u in users:
		e = emp_of.get(u)
		start = str(e.date_of_joining) if e and e.date_of_joining else str(getdate(created.get(u))) if created.get(u) else lo
		end = str(e.relieving_date) if e and e.relieving_date else hi
		off = leave_of.get(u, set())
		hol = holidays_of.get(u)
		out[u] = [
			d for d in past
			if start <= d <= end and d not in off
			# A Holiday List lists its weekly offs too; without one, Saturday and Sunday are off
			and (d not in hol if hol is not None else getdate(d).weekday() < 5)
		]
	return out


def _team(user):
	"""Who is expected to log time: the OmniTrack team (omnitrack.api.workstation.get_team_members),
	without the Administrator account."""
	from omnitrack.api.workstation import get_team_members

	return [m["name"] for m in get_team_members(user) if m.get("name") and m["name"] != "Administrator"]


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
			"task_nature", "status", "approval_status", "project", "unplanned",
			# What each entry shows: its title, the first line of its notes, and a flag's reason
			"work_item_label", "deliverable_notes", "approval_notes",
		],
		limit_page_length=0,
	)

	sessions_of = {}
	if blocks:
		for s in frappe.get_all(
			"OmniTrack Work Session",
			filters={"parenttype": "Planned Work Block", "parent": ["in", [b.name for b in blocks]]},
			fields=["name", "parent", "session_date", "from_time", "to_time", "hours", "notes"],
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
		# Planned ahead only: the block made to hold unplanned time is not a plan
		if work_date in in_range and not b.unplanned and b.status not in NOT_PLANNED and not is_away(b.task_nature):
			p["planned"] += flt(b.duration_hours)
			p["planned_by_day"][work_date] = p["planned_by_day"].get(work_date, 0.0) + flt(b.duration_hours)

		rows = sessions_of.get(b.name)
		pieces = (
			[(str(s.session_date or work_date), flt(s.hours), s) for s in rows]
			if rows else [(work_date, flt(b.actual_hours), None)]
		)
		pieces = [(d, h, s) for d, h, s in pieces if d in in_range and h > 0]
		if not pieces:
			continue
		hours = sum(h for _d, h, _s in pieces)
		if is_away(b.task_nature):
			p["away"] += hours
			p["_away_days"].update(d for d, _h, _s in pieces)
			continue
		p["blocks"] += 1
		p["worked"] += hours
		if b.unplanned:
			p["unplanned"] += hours
		for d, h, _s in pieces:
			p["by_day"][d] = p["by_day"].get(d, 0.0) + h
		label = project_names.get(b.project) or b.project or _("General")
		p["by_project"][label] = p["by_project"].get(label, 0.0) + hours
		review = _review(b.approval_status)
		p[review] += hours
		p["entries"].append({
			"name": b.name,
			"work_date": work_date,
			"work_item_label": b.work_item_label or "",
			# Only the first line: the title falls back to it, and the rest is the block's to show
			"deliverable_notes": next((ln.strip() for ln in (b.deliverable_notes or "").splitlines() if ln.strip()), ""),
			"project": label,
			"hours": hours,
			"review": review,
			"unplanned": bool(b.unplanned),
			"approval_notes": (b.approval_notes or "") if review == "flagged" else "",
			"sessions": [
				{
					"name": s.name, "date": d, "from_time": time_str(s.from_time), "to_time": time_str(s.to_time), "hours": round(h, 2),
					# What was written for that time; the row shows two lines, so a long log is cut short here
					"notes": (s.notes or "")[:NOTES_CHARS],
				}
				for d, h, s in pieces if s is not None
			],
		})

	# Who is expected to log time: a manager's whole team, so someone who logged nothing in the
	# period is listed too; anyone else, themselves
	expected_users = _team(user) if everyone else [user]
	missing_names = [u for u in expected_users if u not in names]
	if missing_names:
		names.update(frappe.get_all(
			"User", filters={"name": ["in", missing_names]}, fields=["name", "full_name"], as_list=True, limit_page_length=0,
		))
	for u in expected_users:
		if u not in people:
			people[u] = _person(u, names.get(u))
	# Someone who logged time in the period is expected to log it, OmniTrack role or not
	expected = _expected_days(sorted(set(expected_users) | (set(people) - {"Administrator"} if everyone else set())), days)

	r2 = lambda v: round(v, 2)  # noqa: E731
	out = []
	for p in people.values():
		logged = set(p["by_day"]) | p.pop("_away_days")
		# Working days in the period with nothing logged, newest first, as the day list reads
		p["not_logged"] = sorted((d for d in expected.get(p["user"], []) if d not in logged), reverse=True)
		if not (p["worked"] or p["planned"] or p["away"] or p["not_logged"]) and p["user"] != user:
			continue
		for key in ("worked", "planned", "unplanned", "away", "approved", "awaiting", "flagged"):
			p[key] = r2(p[key])
		p["by_day"] = {d: r2(h) for d, h in sorted(p["by_day"].items())}
		p["planned_by_day"] = {d: r2(h) for d, h in sorted(p["planned_by_day"].items())}
		p["by_project"] = [
			{"project": k, "hours": r2(v)} for k, v in sorted(p["by_project"].items(), key=lambda kv: -kv[1])
		]
		running = _recording_block(p["user"]) if p["awaiting"] else ""
		for e in p["entries"]:
			e["hours"] = r2(e["hours"])
			e["recording"] = bool(running) and e["name"] == running
		# Newest first, as a timesheet is read back
		p["entries"].sort(key=lambda e: (e["work_date"], e["sessions"][0]["from_time"] if e["sessions"] else ""), reverse=True)
		out.append(p)
	# Whoever has time to review comes first, then whoever worked most
	out.sort(key=lambda p: (not (p["awaiting"] or p["flagged"]), -p["worked"], p["full_name"].lower()))

	closed = get_payroll_closed_through()
	return {
		"from_date": str(from_d),
		"to_date": str(to_d),
		"days": days,
		"can_review_team": everyone,
		# Changing someone else's times: an OmniTrack Manager or Admin only, never HR alone
		"can_edit_times": can_change_others_time(user),
		# Which days the viewer may still log on, for "Log time" on a day with nothing logged
		# (the client's logDayRefusal; check_timesheet_date_permission has the last word)
		"log_days_back": get_log_days_back(),
		"log_any_day": is_omnitrack_manager(user),
		"payroll_closed_through": str(closed) if closed else "",
		"people": out,
		"total_worked": r2(sum(p["worked"] for p in out)),
		# The period's team line: worked, planned ahead, unplanned, and where the review stands
		"totals": {k: r2(sum(p[k] for p in out)) for k in ("worked", "planned", "unplanned", "approved", "awaiting", "flagged")},
		# Not approved yet, on any day: a manager sees the team, anyone else their own
		"waiting": _waiting(user, everyone, closed),
	}
