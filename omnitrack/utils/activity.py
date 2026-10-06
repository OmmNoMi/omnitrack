"""What kind of time a work block or session is: its activity (`task_nature`).

Whether the time was planned is not an activity. A block that was planned is planned; time
logged with no block planned for it lands on a new block that OmniTrack marks `unplanned`.
Older values mixed the two ("🎯 Planned", "⚠️ Unplanned", "Planned Work", "Unplanned Ops"),
so every stored or incoming value goes through `to_kind`. `src/utils/activity.js` mirrors this
file; `scripts/check_activity_kinds.cjs` keeps the two and the DocType options in step.
"""

KINDS = ("Work", "Break", "Away")
DEFAULT = "Work"
# Not working and not paid: kept out of plan-vs-actual and paid-hours maths
AWAY = ("Break", "Away")

# First match wins. Anything else is Work: meetings and reviews are work, and so are the old
# Planned / Unplanned values. Leave, absence and out-of-office are all Away.
_MARKERS = (
	("Break", ("break",)),
	("Away", ("away", "leave", "absent", "out-of-office", "out of office", "ooo")),
)


def to_kind(value):
	"""Any activity value, current or legacy, as one of KINDS."""
	text = str(value or "").strip().lower()
	for kind, markers in _MARKERS:
		if any(m in text for m in markers):
			return kind
	return DEFAULT


def is_away(value):
	return to_kind(value) in AWAY


def said_unplanned(value):
	"""A legacy value that carried "Unplanned": only the migration patch reads it."""
	return "unplanned" in str(value or "").lower()
