# Copyright (c) 2026, OmmNoMi Automation LLP and contributors
# For license information, please see license.txt

"""A refused Stop never loses a session, and an older copy of its log never replaces a newer one.

A session from 23:45 to 00:35 was lost: Stop cleared it on the server first, then the save was
refused for having 6 words, because the lines written during it had been overwritten by an older
copy of the log. The page now counts words the way the server does and asks before stopping,
the server copy stays until a save succeeds, and the server keeps the newer log.

No site, no DB: the helpers are pure and loaded by path, so the mutation tests' copy is tested.
"""

import importlib.util
import json
import os
import unittest

APP_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load(name, *parts):
	spec = importlib.util.spec_from_file_location(name, os.path.join(APP_DIR, *parts))
	mod = importlib.util.module_from_spec(spec)
	spec.loader.exec_module(mod)
	return mod


session_lines = load("session_lines", "utils", "session_lines.py")
validators = load("validators", "utils", "validators.py")
STOPWATCH = open(os.path.join(APP_DIR, "api", "stopwatch.py")).read()
TIMESHEET = open(os.path.join(APP_DIR, "api", "timesheet.py")).read()
VALIDATORS = open(os.path.join(APP_DIR, "utils", "validators.py")).read()
CASES = json.load(open(os.path.join(APP_DIR, "tests", "fixtures", "session_words.json")))


def copy(rev, lines, start=1000):
	return {"startTime": start, "trackerNotes": "Title", "sessionNotesList": lines, "sessionTasks": [], "linesRev": rev, "lastActivityTime": 5}


class TestSessionWords(unittest.TestCase):
	def test_counted_as_the_page_counts_them(self):
		"""src/utils/sessionWords.js is checked against the same cases (scripts/check_session_lines.mjs)."""
		for text, expected in CASES:
			self.assertEqual(validators.count_session_words(text), expected, text)

	def test_the_refusal_is_one_short_sentence(self):
		self.assertIn('_("Describe what you did in at least {0} words (you wrote {1}).")', VALIDATORS)
		self.assertNotIn("across all industries.\"", VALIDATORS)


class TestKeepNewerLines(unittest.TestCase):
	def test_an_older_copy_keeps_the_stored_log(self):
		stored, incoming = copy(200, ["one", "two", "three"]), copy(100, ["one"])
		incoming["lastActivityTime"] = 9
		kept = session_lines.keep_newer_lines(stored, incoming)
		self.assertEqual(kept["sessionNotesList"], ["one", "two", "three"])
		self.assertEqual(kept["linesRev"], 200)
		# Everything else still comes from the write
		self.assertEqual(kept["lastActivityTime"], 9)

	def test_a_newer_or_equal_copy_is_stored(self):
		for rev in (200, 300):
			incoming = copy(rev, ["one"])
			self.assertIs(session_lines.keep_newer_lines(copy(200, ["one", "two"]), incoming), incoming)

	def test_a_different_session_or_none_stored_is_stored(self):
		incoming = copy(1, ["new"], start=2000)
		self.assertIs(session_lines.keep_newer_lines(copy(900, ["old"]), incoming), incoming)
		self.assertIs(session_lines.keep_newer_lines(None, incoming), incoming)

	def test_every_sync_goes_through_it(self):
		self.assertIn('"linesRev": int(flt(session_data.get("linesRev") or 0)),', STOPWATCH)
		merge = STOPWATCH.index("clean_data = keep_newer_lines(get_active_session(user=target_user), clean_data)")
		self.assertLess(merge, STOPWATCH.index('frappe.cache.hset("omnitrack:active_session", target_user, clean_data)'))

	def test_both_saves_clear_the_session_themselves(self):
		"""The page no longer clears it before saving; a save that succeeds does."""
		body = STOPWATCH[STOPWATCH.index("def quick_timer_punch("):STOPWATCH.index("def sync_active_session(")]
		self.assertIn("sync_active_session(None)", body)
		body = TIMESHEET[TIMESHEET.index("def log_work_session("):]
		self.assertIn("sync_active_session(None)", body[:body.find("\ndef ", 1)])


if __name__ == "__main__":
	unittest.main()
