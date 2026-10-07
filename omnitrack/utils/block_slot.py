# Copyright (c) 2026, OmmNoMi Automation LLP and contributors
# For license information, please see license.txt

"""The day and times a planned block sits on, read with Frappe's own date helpers. Needs no site.

A block planned with start_time "2026-10-08 10:45:00" and no work_date was once padded as a
time: its date was dropped, the block landed on today and came back 0.0 hrs long.
"""

from datetime import datetime, timedelta

from frappe.utils import add_days, get_datetime, get_time, getdate


def split_stamp(value):
	"""Reads '9:00', '09:00:00', a time from the database, or '2026-10-08 10:45[:00]' (a 'T'
	works too) as (date 'YYYY-MM-DD' or None, 'HH:MM:SS'). Raises ValueError for anything else,
	a date with no time among it: a full timestamp was once padded as a time, its date dropped."""
	try:
		if isinstance(value, datetime):
			return str(value.date()), get_time(value).strftime("%H:%M:%S")
		if isinstance(value, timedelta):
			return None, get_time(value).strftime("%H:%M:%S")
		text = str(value if value is not None else "").strip()
		if ":" not in text:
			raise ValueError
		parts = text.replace("T", " ").split()
		if len(parts) == 1:
			return None, get_time(text).strftime("%H:%M:%S")
		stamp = get_datetime(text)
		return str(stamp.date()), stamp.strftime("%H:%M:%S")
	except Exception:
		raise ValueError(f"'{value}' is not a time (HH:MM) or a date and time (YYYY-MM-DD HH:MM)") from None


def block_slot(start_value, end_value, work_date=None):
	"""The day and times a planned block sits on. A date in start_time sets the day when work_date
	is not given, and must agree with it when it is; an end dated the next day is an overnight
	block. Returns (day or None, start 'HH:MM:SS', end 'HH:MM:SS'); raises ValueError."""
	start_day, start = split_stamp(start_value)
	end_day, end = split_stamp(end_value)
	day = start_day or end_day
	if start_day and end_day and end_day != start_day:
		if not (getdate(end_day) == getdate(add_days(start_day, 1)) and end <= start):
			raise ValueError(f"start_time is on {start_day} but end_time is on {end_day}; a block sits on one day, so plan each day on its own")
	if day and work_date and getdate(work_date) != getdate(day):
		raise ValueError(f"start_time is on {day} but work_date is {work_date}; send one date, or the same date in both")
	if start == end:
		raise ValueError(f"the block ends when it starts ({start[:5]}); give it a length")
	return day or (str(getdate(work_date)) if work_date else None), start, end
