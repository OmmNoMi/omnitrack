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


def compose_wrap_note(title, log_lines, last_line=None):
	"""The notes a running session is saved with: its title, then its log lines and an optional
	last line as bullets. The same as composeWrapNote (src/utils/wrapNote.js), so a session
	stopped or switched from an assistant is saved as the page saves it, its log lines kept."""
	lines = [str(p or "").strip() for p in [*(log_lines or []), last_line]]
	bullets = "\n".join(f"• {p}" for p in lines if p)
	head = str(title or "").strip()
	return f"{head}\n\n{bullets}" if head and bullets else (head or bullets)
