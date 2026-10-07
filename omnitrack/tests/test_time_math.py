# Copyright (c) 2026, OmmNoMi Automation LLP and contributors
# For license information, please see license.txt

"""Times are read by Frappe's get_time, not by splitting on ":".

pad_time and mins_of split on ":", so "2026-10-08 10:45:00" became an hour of "2026-10-08 10",
and a Time field's timedelta of a day ("1 day, 0:00:00") came out as garbage.

No site, no DB: time_math.py uses only frappe.utils, so the bench's Python runs it (npm test
calls ../../env/bin/python). It is loaded by path, so the mutation tests' copy is the one tested.
"""

import importlib.util
import os
import unittest
from datetime import datetime, timedelta

APP_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_spec = importlib.util.spec_from_file_location("time_math", os.path.join(APP_DIR, "utils", "time_math.py"))
time_math = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(time_math)
SRC = open(os.path.join(APP_DIR, "utils", "time_math.py")).read()
PLANNER = open(os.path.join(APP_DIR, "api", "planner.py")).read()


class TestTimeMath(unittest.TestCase):
	def test_pad_time_reads_any_time(self):
		pad = time_math.pad_time
		self.assertEqual(pad("9:00"), "09:00:00")
		self.assertEqual(pad("14:30:15"), "14:30:15")
		self.assertEqual(pad(timedelta(hours=7, minutes=30, seconds=55)), "07:30:55")
		self.assertEqual(pad("2026-10-08 10:45:00"), "10:45:00")
		self.assertEqual(pad(datetime(2026, 10, 8, 10, 45)), "10:45:00")
		self.assertEqual(pad(None), "00:00:00")

	def test_mins_of_reads_any_time(self):
		self.assertEqual(time_math.mins_of("00:00:00"), 0)
		self.assertEqual(time_math.mins_of("9:05"), 545)
		self.assertEqual(time_math.mins_of("2026-10-08 10:45:00"), 645)
		self.assertEqual(time_math.mins_of(None), 0)
		# a stored end of midnight (24:00:00 comes back as a day) is the end of the day, not its start
		self.assertEqual(time_math.mins_of(timedelta(hours=24)), 1440)
		self.assertEqual(time_math.mins_of(timedelta(hours=1, minutes=30, seconds=59)), 90)

	def test_time_str_keeps_empty_empty(self):
		self.assertEqual(time_math.time_str(None), "")
		self.assertEqual(time_math.time_str(""), "")
		self.assertEqual(time_math.time_str(timedelta(seconds=3665)), "01:01:05")

	def test_no_hand_parser_is_left(self):
		self.assertNotRegex(SRC, r'split\(":"\)')
		self.assertNotRegex(SRC, r"zfill|divmod")
		self.assertRegex(SRC, r'return get_time\(value\)\.strftime\("%H:%M:%S"\)')
		# planner serialises with the shared time_str, not a copy of its own
		self.assertNotIn("\ndef _time_str(", PLANNER)
		self.assertIn("\ttime_str as _time_str,\n", PLANNER)


if __name__ == "__main__":
	unittest.main()
