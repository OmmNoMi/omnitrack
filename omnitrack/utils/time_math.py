# Copyright (c) 2026, OmmNoMi Automation LLP and contributors
# For license information, please see license.txt

from datetime import timedelta

from frappe.utils import get_time, time_diff_in_hours


def duration_hours(start_time, end_time):
	"""Calculate duration between two time strings, accounting for midnight crossover."""
	try:
		diff = time_diff_in_hours(end_time, start_time)
		if diff < 0:
			diff += 24.0
		return round(diff, 2)
	except Exception:
		return 0.0


def mins_of(value):
	"""Minutes from 00:00 of a time ('9:00', '09:00:00', a datetime), read by Frappe's get_time.
	A Time field's timedelta is counted as it is, so an end stored as 24:00:00 stays 1440, not 0."""
	if not value:
		return 0
	if isinstance(value, timedelta):
		return int(value.total_seconds() // 60)
	t = get_time(value)
	return t.hour * 60 + t.minute


def split_over_midnight(start_time, end_time):
	"""If end_time < start_time, splits the span into two chunks around 00:00."""
	s_mins = mins_of(start_time)
	e_mins = mins_of(end_time)
	if e_mins >= s_mins:
		return [(start_time, end_time)]
	return [
		(start_time, "23:59:59"),
		("00:00:00", end_time)
	]


def pad_time(value):
	"""A time as 'HH:MM:SS' ('9:00' -> '09:00:00'), read by Frappe's get_time: a Time field's
	timedelta and a date and time work too. Empty is '00:00:00'."""
	if not value:
		return "00:00:00"
	return get_time(value).strftime("%H:%M:%S")


def week_bounds(week_start=None):
	"""Returns (monday, sunday) dates for the week containing week_start or today."""
	from datetime import timedelta
	from frappe.utils import getdate, nowdate
	base = getdate(week_start) if week_start else getdate(nowdate())
	monday = base - timedelta(days=base.weekday())
	return monday, monday + timedelta(days=6)


def time_str(val):
	"""Serialize a Frappe Time field as zero-padded HH:MM:SS (str() of its timedelta drops the
	leading zero, "7:30:55", which breaks anything that slices five characters). Empty is ''."""
	if val in (None, ""):
		return ""
	return pad_time(val)

