# Copyright (c) 2026, OmmNoMi Automation LLP and contributors
# For license information, please see license.txt

"""Which copy of a running session's log the server keeps. Needs no site.

Every edit to a session's title, log lines or tasks stamps the copy with linesRev (when it was
made, in the editing browser). A tab holding an older copy once overwrote the stored log, and the
lines were gone when the session was saved. An older copy of the same session never wins.
"""

LINE_FIELDS = ("trackerNotes", "sessionNotesList", "sessionTasks", "linesRev")


def keep_newer_lines(stored, incoming):
	"""``incoming`` (the cleaned copy about to be stored), with the stored title, log and tasks
	put back when the stored copy is the same session and its log is newer."""
	if not isinstance(stored, dict) or int(stored.get("startTime") or 0) != int(incoming.get("startTime") or 0):
		return incoming
	if int(stored.get("linesRev") or 0) <= int(incoming.get("linesRev") or 0):
		return incoming
	kept = dict(incoming)
	for field in LINE_FIELDS:
		if field in stored:
			kept[field] = stored[field]
	return kept
