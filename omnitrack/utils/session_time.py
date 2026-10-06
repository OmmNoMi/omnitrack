# Copyright (c) 2026, OmmNoMi Automation LLP and contributors
# For license information, please see license.txt

"""Which logged time counts as doing a planned block.

Only time that falls after the block starts and has already happened. A session logged
before the block (or into a slot that is still ahead) is kept as written, but it cannot
make the block Logged, Done or On plan. src/utils/countedHours.js is the same rule for
the dashboard and must stay in step.
"""

from datetime import timedelta

from frappe.utils import flt, get_datetime, getdate

# A timer stopped a few seconds after the server's clock read "now" is not the future.
FUTURE_TOLERANCE = timedelta(minutes=1)


def _span(session):
	"""(start, end) datetimes of a session, or None when it has no times to place it."""
	if not (session.get("session_date") and session.get("from_time") and session.get("to_time")):
		return None
	start = get_datetime(f"{getdate(session.get('session_date'))} {session.get('from_time')}")
	end = get_datetime(f"{getdate(session.get('session_date'))} {session.get('to_time')}")
	if end <= start:
		end += timedelta(days=1)
	return start, end


def block_start(work_date, start_time):
	if not (work_date and start_time):
		return None
	return get_datetime(f"{getdate(work_date)} {start_time}")


def counted_hours(work_date, start_time, sessions, now):
	"""Hours of `sessions` that fall at or after the block's start and not after `now`."""
	begin = block_start(work_date, start_time)
	now = get_datetime(now)
	total = 0.0
	for s in sessions or []:
		span = _span(s)
		if span is None:
			# No times to place it: it counts once its day has come.
			day = s.get("session_date")
			if not day or getdate(day) <= now.date():
				total += flt(s.get("hours"))
			continue
		start, end = span
		full = (end - start).total_seconds()
		if begin and start < begin:
			start = begin
		if end > now:
			end = now
		if end > start:
			# The session's own hours win over its clock span (a break can be taken out),
			# so count the share of them that falls inside the window.
			total += flt(s.get("hours")) * (end - start).total_seconds() / full
	return round(total, 2)


def ends_in_future(session, now):
	"""True when a session claims time that has not happened yet."""
	span = _span(session)
	if span is None:
		day = session.get("session_date")
		return bool(day) and getdate(day) > get_datetime(now).date()
	return span[1] > get_datetime(now) + FUTURE_TOLERANCE
