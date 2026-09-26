# Copyright (c) 2026, OmmNoMi Automation LLP and contributors
# For license information, please see license.txt

from datetime import timedelta
from frappe.utils import getdate, flt
from omnitrack.utils.time_math import mins_of


class MidnightSplitter:
	"""
	Domain Service handling atomic decomposition of work sessions crossing the midnight boundary.
	Splits an overnight session (e.g., 22:00 to 02:00) into two distinct daytime session rows:
	- Part 1: base_date, from_time -> 23:59:59
	- Part 2: base_date + 1, 00:00:00 -> to_time
	"""

	@staticmethod
	def is_overnight(from_time, to_time):
		"""Returns True if the time interval crosses midnight."""
		if not from_time or not to_time:
			return False
		try:
			return mins_of(to_time) < mins_of(from_time)
		except Exception:
			return False

	@classmethod
	def split_session_rows(cls, base_date, from_time, to_time, notes=None, logged_via="Manual", task_nature="🎯 Planned"):
		"""
		Returns a tuple of two session row dicts [part1, part2] covering each calendar day.
		"""
		s_mins = mins_of(from_time)
		e_mins = mins_of(to_time)
		h1 = max(round((1440 - s_mins) / 60.0, 2), 0.01)
		h2 = max(round(e_mins / 60.0, 2), 0.01)

		next_date = str(getdate(base_date) + timedelta(days=1))

		part1 = {
			"session_date": str(base_date),
			"from_time": from_time,
			"to_time": "23:59:59",
			"hours": flt(h1),
			"notes": f"{notes} (pt 1)" if notes else "Overnight session (pt 1)",
			"logged_via": logged_via or "Manual",
			"task_nature": task_nature,
		}

		part2 = {
			"session_date": next_date,
			"from_time": "00:00:00",
			"to_time": to_time,
			"hours": flt(h2),
			"notes": f"{notes} (pt 2)" if notes else "Overnight session (pt 2)",
			"logged_via": logged_via or "Manual",
			"task_nature": task_nature,
		}

		return part1, part2
