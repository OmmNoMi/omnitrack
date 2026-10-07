# Copyright (c) 2026, OmmNoMi Automation LLP and contributors
# For license information, please see license.txt

"""A planned block's day comes from its timestamp, or the mismatch is refused.

Background: omnitrack_plan_work_blocks was called with start_time "2026-10-08 10:45:00" and no
work_date. The timestamp was padded as a time, its date dropped: the block was booked on today,
came back "duration_hours": 0.0 with success, and drew as a past event on the calendar.

No site, no DB: block_slot.py uses only frappe.utils, so the bench's Python runs it (npm test calls
../../env/bin/python). It is loaded by path, so the mutation tests' copy is the one tested.
"""

import importlib.util
import os
import re
import unittest

APP_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_spec = importlib.util.spec_from_file_location("block_slot", os.path.join(APP_DIR, "utils", "block_slot.py"))
block_slot_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(block_slot_mod)
block_slot = block_slot_mod.block_slot
FAC = open(os.path.join(APP_DIR, "fac.py")).read()
PLANNER = open(os.path.join(APP_DIR, "api", "planner.py")).read()
CONTROLLER = open(os.path.join(APP_DIR, "omnitrack", "doctype", "planned_work_block", "planned_work_block.py")).read()


def body_of(src, name):
	"""The source of one top-level def (or method), up to the next def at its own indent."""
	m = re.search(r"^(\t*)def " + name + r"\(", src, re.M)
	rest = src[m.end():]
	end = re.search(r"^" + m.group(1) + r"(?:def |@)", rest, re.M)
	return rest[:end.start()] if end else rest


class TestBlockSlot(unittest.TestCase):
	def test_a_dated_start_sets_the_day(self):
		self.assertEqual(block_slot("2026-10-08 10:45:00", "2026-10-08 11:45:00"), ("2026-10-08", "10:45:00", "11:45:00"))
		self.assertEqual(block_slot("2026-10-08T10:45:00.000", "11:45"), ("2026-10-08", "10:45:00", "11:45:00"))

	def test_a_date_that_disagrees_with_work_date_is_refused(self):
		with self.assertRaisesRegex(ValueError, "start_time is on 2026-10-08 but work_date is 2026-10-07"):
			block_slot("2026-10-08 10:45:00", "2026-10-08 11:45:00", "2026-10-07")
		self.assertEqual(block_slot("2026-10-08 10:45", "11:45", "2026-10-08")[0], "2026-10-08")

	def test_times_alone_keep_work_date(self):
		self.assertEqual(block_slot("9:00", "11:30", "2026-10-09"), ("2026-10-09", "09:00:00", "11:30:00"))
		self.assertEqual(block_slot("9:00", "11:30"), (None, "09:00:00", "11:30:00"))

	def test_a_block_sits_on_one_day(self):
		self.assertEqual(block_slot("2026-10-08 23:00", "2026-10-09 01:00")[1:], ("23:00:00", "01:00:00"))
		for end in ("2026-10-09 11:00", "2026-10-10 01:00"):
			with self.assertRaisesRegex(ValueError, "a block sits on one day"):
				block_slot("2026-10-08 10:00", end)

	def test_no_length_and_no_time_are_refused(self):
		with self.assertRaisesRegex(ValueError, "ends when it starts"):
			block_slot("10:00", "2026-10-08 10:00:00")
		for bad in ("25:00", "10:75", "", "tomorrow 10am", "2026-10-08"):
			with self.assertRaisesRegex(ValueError, "is not a time"):
				block_slot(bad, "11:00")

	def test_times_from_the_database_are_read_too(self):
		import datetime
		self.assertEqual(block_slot_mod.split_stamp(datetime.timedelta(hours=9, minutes=5)), (None, "09:05:00"))
		# MariaDB keeps an end of midnight as 24:00:00, read back as a day
		self.assertEqual(block_slot_mod.split_stamp(datetime.timedelta(hours=24)), (None, "00:00:00"))
		self.assertEqual(block_slot_mod.split_stamp(datetime.datetime(2026, 10, 8, 10, 45)), ("2026-10-08", "10:45:00"))
		with self.assertRaisesRegex(ValueError, "is not a time"):
			block_slot_mod.split_stamp(datetime.date(2026, 10, 8))

	def test_book_work_block_resolves_the_slot_before_anything_else(self):
		body = body_of(PLANNER, "book_work_block")
		self.assertIn("work_date, start_time, end_time = _slot(start_time, end_time, work_date)", body)
		# the day is known before the past check, and a bad slot creates no task
		self.assertLess(body.index("_slot("), body.index("getdate(work_date) < getdate(nowdate())"))
		self.assertLess(body.index("_slot("), body.index("_create_assigned_work("))
		self.assertRegex(body_of(PLANNER, "_slot"), r"except ValueError as e:\s*frappe\.throw\(str\(e\), frappe\.ValidationError\)")

	def test_moving_a_block_resolves_the_slot_before_the_past_lock(self):
		for name, call in (("update_work_block", "_slot(start_time or doc.start_time, end_time or doc.end_time, work_date)"),
				("reschedule_work_block", "_slot(new_start_time or doc.start_time, new_end_time or doc.end_time, new_date)")):
			body = body_of(PLANNER, name)
			self.assertIn(call, body, name)
			self.assertLess(body.index("_slot("), body.index("check_planned_block_past_lock("), name)
		self.assertRegex(body_of(PLANNER, "reschedule_work_block"), r"_slot\([^\n]*\)\n\t\tnew_date = day")
		self.assertRegex(body_of(PLANNER, "update_work_block"), r"_slot\([^\n]*\)\n\t\twork_date = day")

	def test_the_block_refuses_a_time_it_cannot_read(self):
		body = body_of(CONTROLLER, "calculate_duration")
		# it once swallowed the error and wrote 0.0
		self.assertNotRegex(body, r"except Exception:\s*self\.duration_hours = 0")
		self.assertRegex(body, r"except ValueError as e:\s*frappe\.throw\(str\(e\), frappe\.ValidationError\)")
		self.assertIn("start_day, start = split_stamp(self.start_time)", body)
		self.assertRegex(body, r"\tif day and \(\(start_day and getdate\(start_day\) != day\) or \(end_day and getdate\(end_day\) not in \(day, getdate\(add_days\(day, 1\)\)\)\)\):\s*frappe\.throw")
		# a plain stored time is left alone, so a roll-up re-save changes nothing
		self.assertRegex(body, r"if start_day:\s*self\.start_time = start")
		self.assertNotIn("self.start_time, self.end_time = start, end", body)

	def test_plan_work_blocks_books_the_resolved_slot(self):
		body = FAC[FAC.index("def plan_work_blocks"):FAC.index("def log_work_session")]
		self.assertRegex(body, r"slots\.append\(block_slot\(item\.get\(\"start_time\"\), item\.get\(\"end_time\"\), work_date\)\)")
		self.assertIn('target_date = work_date or (days.pop() if days else nowdate())', body)
		self.assertRegex(body, r"if len\(days\) > 1:\s*frappe\.throw")
		self.assertRegex(body, r"for item, \(_day, s_time, e_time\) in zip\(blocks, slots\):")
		# the slots are all checked before the first block is booked
		self.assertLess(body.index("block_slot("), body.index("book_work_block("))
		self.assertNotRegex(body, r"s_time = item\.get\(\"start_time\"\)")

	def test_quick_create_task_checks_the_block_before_the_task(self):
		body = FAC[FAC.index("def quick_create_task"):]
		body = body[:body.index("\n@frappe.whitelist()")]
		self.assertLess(body.index("split_stamp(block_start"), body.index('frappe.new_doc("Task")'))
		self.assertIn("target_date = work_date or start_day or nowdate()", body)
		self.assertRegex(body, r"block_slot\(f\"\{target_date\} \{block_start\}\", block_end, target_date\)")


if __name__ == "__main__":
	unittest.main()
