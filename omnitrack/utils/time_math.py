# Copyright (c) 2026, OmmNoMi Automation LLP and contributors
# For license information, please see license.txt

from frappe.utils import time_diff_in_hours


def duration_hours(start_time, end_time):
	"""Calculate duration between two time strings, accounting for midnight crossover."""
	try:
		diff = time_diff_in_hours(end_time, start_time)
		if diff < 0:
			diff += 24.0
		return round(diff, 2)
	except Exception:
		return 0.0


def mins_of(time_str):
	"""Converts 'HH:MM' or 'HH:MM:SS' string to integer minutes from 00:00."""
	if not time_str:
		return 0
	parts = [int(p) for p in str(time_str).split(":")[:2]]
	return parts[0] * 60 + parts[1]


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


def pad_time(time_str):
	"""Normalizes '9:00' -> '09:00:00'."""
	if not time_str:
		return "00:00:00"
	parts = str(time_str).split(":")
	h = parts[0].zfill(2)
	m = parts[1].zfill(2) if len(parts) > 1 else "00"
	s = parts[2].zfill(2) if len(parts) > 2 else "00"
	return f"{h}:{m}:{s}"
