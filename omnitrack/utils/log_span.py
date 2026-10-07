# Copyright (c) 2026, OmmNoMi Automation LLP and contributors
# For license information, please see license.txt

"""Where a logged session or block sits in real time, for an ERPNext Timesheet time log.

An end at or before the start is the next morning: 23:00-04:00 on the 6th runs to 04:00 on
the 7th. Writing both on the 6th made ERPNext refuse the Timesheet, and the refusal was
swallowed, so overnight work never reached a Timesheet. Standard library only, so
scripts/check_overnight_log.mjs can run it without a site.
"""

from datetime import date, datetime, time, timedelta

FMT = "%Y-%m-%d %H:%M:%S"


def _secs(t):
	"""Seconds after midnight of a Time value: "HH:MM[:SS]", a timedelta (as the database
	returns it) or a time. None when there is no time."""
	if t is None or t == "":
		return None
	if isinstance(t, timedelta):
		return int(t.total_seconds()) % 86400
	if isinstance(t, time):
		return t.hour * 3600 + t.minute * 60 + t.second
	parts = str(t).split(":")
	h = int(parts[0])
	m = int(parts[1]) if len(parts) > 1 else 0
	s = int(float(parts[2])) if len(parts) > 2 else 0
	return h * 3600 + m * 60 + s


def log_span(day, from_time, to_time=None, hours=0, fallback_hours=0.5):
	"""("YYYY-MM-DD HH:MM:SS" from, to) for a span that starts on `day`. With no end, or an
	end equal to the start, it runs for `hours` (or `fallback_hours` when that is not set)."""
	d = day if isinstance(day, date) else date.fromisoformat(str(day)[:10])
	midnight = datetime.combine(d, time())
	start = midnight + timedelta(seconds=_secs(from_time) or 0)
	end_s = _secs(to_time)
	if end_s is None or end_s == _secs(from_time):
		length = float(hours or 0)
		end = start + timedelta(hours=length if length > 0 else fallback_hours)
	else:
		end = midnight + timedelta(seconds=end_s)
		if end <= start:
			end += timedelta(days=1)
	return start.strftime(FMT), end.strftime(FMT)
