"""A document's activity, read and added to inside OmniTrack: its Frappe comments and the history
Frappe keeps on it (field changes, workflow moves, assignments, attachments), so nobody has to
open Desk to follow a Work Block, a To-Do or a Task.

Nothing here keeps a copy. Comments are Frappe Comment rows on the document itself, so Desk's
timeline shows the same thread. A Work Session is a row of its Planned Work Block, not a
document, so its activity is its block's.
"""

import json

import frappe
from frappe import _
from frappe.utils import cstr, formatdate, get_datetime, get_fullname, strip_html
from frappe.utils.html_utils import sanitize_html

# The documents OmniTrack shows activity for. Raven is for Projects and their ERPNext Tasks;
# everything else talks through Frappe comments.
DOCTYPES = ("Planned Work Block", "ToDo", "Task")
# What the panel lists, beside the document's Versions
EVENT_TYPES = ("Comment", "Info", "Edit", "Workflow", "Assigned", "Assignment Completed", "Attachment", "Attachment Removed")
MAX_ITEMS = 200
MAX_COMMENT = 10000

# Fields whose changes are bookkeeping, not news: recomputed totals, hashes, legacy imports
QUIET = {
	"Planned Work Block": {
		"actual_hours", "variance_hours", "duration_hours", "cryptographic_hash", "costing_amount",
		"billing_amount", "approval_date", "approved_by", "appsheet_id", "legacy_activity_id",
		"legacy_project_id", "associate_name", "work_item", "timesheet",
	},
	"ToDo": {"reference_type", "reference_name", "role", "sender", "assignment_rule"},
	"Task": {"actual_time", "total_costing_amount", "total_billing_amount", "progress", "depends_on_tasks", "lft", "rgt", "old_parent"},
}
# Plain names for fields whose DocType labels were written for Desk
LABELS = {
	"Planned Work Block": {
		"employee": "Person", "pairing_partner": "Pair", "work_date": "Date", "start_time": "Start",
		"end_time": "End", "task_nature": "Activity", "approval_status": "Approval",
		"approval_notes": "Review note", "deliverable_notes": "Notes", "unplanned_reason": "Reason",
		"work_item_label": "Title", "cancel_reason": "Cancel reason",
	},
	"ToDo": {"allocated_to": "Assigned to", "date": "Due", "description": "Description"},
	"Task": {"exp_end_date": "Due", "exp_start_date": "Start"},
}
# Rows added to or taken from a table, said as what they are
# (added, removed, changed) and (one, several): "added 2 tasks", never "added a task (2)"
ROWS = {
	("Planned Work Block", "sessions"): (("logged {0}", "removed {0}", "changed {0}"), ("a work session", "{0} work sessions")),
	("Planned Work Block", "tasks"): (("added {0}", "took off {0}", "updated {0}"), ("a task", "{0} tasks")),
}
# The same thing said by the same person within this many seconds is one line ("updated a task, twice")
FOLD_SECONDS = 600


def _doc(doctype, name):
	"""The document, for someone Frappe lets read it (the rule Desk's own comment box uses)."""
	if doctype not in DOCTYPES or not frappe.db.exists("DocType", doctype) or not frappe.db.exists(doctype, name):
		frappe.throw(_("{0} {1} not found").format(_(doctype), name))
	doc = frappe.get_doc(doctype, name)
	doc.check_permission("read")
	return doc


class _People:
	"""Full names and photos, looked up once a request."""

	def __init__(self):
		self.seen = {}

	def __call__(self, user):
		if user not in self.seen:
			image = frappe.db.get_value("User", user, "user_image") if user else None
			self.seen[user] = {"user": user, "by": get_fullname(user) or user, "image": image or None}
		return self.seen[user]


def _who(people, user):
	p = dict(people(user))
	if user == frappe.session.user:
		p["by"] = _("You")
	return p


def _short(text, limit=80):
	text = " ".join(strip_html(cstr(text)).split())
	return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"


def _value(meta, df, value, titles):
	"""A changed value as a person reads it: names for links, dates and times written out."""
	if value in (None, ""):
		return ""
	if df.fieldtype == "Check":
		return _("on") if int(value or 0) else _("off")
	if df.fieldtype == "Date":
		return formatdate(value, "d MMM yyyy")
	if df.fieldtype == "Time":
		try:
			h, m = (int(x) for x in cstr(value).split(":")[:2])
			return f"{(h % 12) or 12}:{m:02d} {'pm' if h >= 12 else 'am'}"
		except ValueError:
			return cstr(value)
	if df.fieldtype == "Link" and df.options:
		key = (df.options, value)
		if key not in titles:
			title = None
			if df.options == "User":
				title = get_fullname(value)
			else:
				field = frappe.get_meta(df.options).title_field
				if field and field != "name":
					title = frappe.db.get_value(df.options, value, field)
			titles[key] = title or value
		return _short(titles[key])
	return _short(value)


def _changes(doc, data, titles):
	"""What one Version says changed, as short phrases ("changed Status from Open to Working")."""
	meta = frappe.get_meta(doc.doctype)
	quiet = QUIET.get(doc.doctype, set())
	labels = LABELS.get(doc.doctype, {})
	out = []
	for field, old, new in data.get("changed") or []:
		df = meta.get_field(field)
		if not df or df.hidden or field in quiet:
			continue
		label = labels.get(field) or _(df.label or field)
		before, after = _value(meta, df, old, titles), _value(meta, df, new, titles)
		if before == after:
			continue
		if not before:
			out.append(_("set {0} to {1}").format(label, after))
		elif not after:
			out.append(_("cleared {0}").format(label))
		else:
			out.append(_("changed {0} from {1} to {2}").format(label, before, after))
	for key, which in (("added", 0), ("removed", 1), ("row_changed", 2)):
		counts = {}
		for row in data.get(key) or []:
			counts[row[0]] = counts.get(row[0], 0) + 1
		for table, n in counts.items():
			df = meta.get_field(table)
			if not df or table in quiet:
				continue
			said = ROWS.get((doc.doctype, table))
			if said:
				verbs, nouns = said
				out.append(_(verbs[which]).format(_(nouns[0]) if n == 1 else _(nouns[1]).format(n)))
			else:
				verb = (_("added {0} to {1}"), _("removed {0} from {1}"), _("updated {0} in {1}"))[which]
				out.append(verb.format(_("a row") if n == 1 else _("{0} rows").format(n), _(df.label or table)))
	return out


def _event_text(row):
	content = _short(row.content, 160)
	t = row.comment_type
	if t == "Workflow":
		return _("moved it to {0}").format(content)
	if t == "Attachment":
		return _("attached {0}").format(content)
	if t == "Attachment Removed":
		return _("removed the attachment {0}").format(content)
	return content


def _activity(doc):
	people = _People()
	titles = {}
	items = [{"kind": "event", "at": str(doc.creation), "text": _("created this"), **_who(people, doc.owner)}]

	rows = frappe.get_all(
		"Comment",
		filters={"reference_doctype": doc.doctype, "reference_name": doc.name, "comment_type": ["in", EVENT_TYPES]},
		fields=["name", "comment_type", "content", "owner", "comment_email", "creation"],
		order_by="creation desc",
		limit=MAX_ITEMS,
	)
	for row in rows:
		who = _who(people, row.comment_email or row.owner)
		if row.comment_type == "Comment":
			# Comment.validate sanitized it on the way in; again here, in case it was written another way
			items.append({"kind": "comment", "id": row.name, "at": str(row.creation), "html": sanitize_html(row.content or "", always_sanitize=True), "mine": row.owner == frappe.session.user, **who})
			continue
		text = _event_text(row)
		if text:
			# Frappe writes an assignment as a whole sentence that already names who did it
			full = row.comment_type in ("Assigned", "Assignment Completed")
			items.append({"kind": "event", "id": row.name, "at": str(row.creation), "text": text, "sentence": full, **who})

	if frappe.get_meta(doc.doctype).track_changes:
		versions = frappe.get_all(
			"Version",
			filters={"ref_doctype": doc.doctype, "docname": doc.name},
			fields=["name", "owner", "creation", "data"],
			order_by="creation desc",
			limit=MAX_ITEMS,
		)
		for v in versions:
			try:
				data = json.loads(v.data or "{}")
			except ValueError:
				continue
			said = _changes(doc, data, titles)
			if said:
				items.append({"kind": "event", "id": v.name, "at": str(v.creation), "text": "; ".join(said), **_who(people, v.owner)})

	items.sort(key=lambda i: i["at"])
	return _fold(items)[-MAX_ITEMS:]


def _fold(items):
	"""Back-to-back events that say the same thing, by the same person, minutes apart, as one line
	at the latest time: saving a block twice is one "updated a task, twice", not two equal lines."""
	out = []
	for it in items:
		last = out[-1] if out else None
		if (
			last
			and it["kind"] == "event" == last["kind"]
			and it["text"] == last["said"]
			and it.get("by") == last.get("by")
			and (get_datetime(it["at"]) - get_datetime(last["at"])).total_seconds() <= FOLD_SECONDS
		):
			last["times"] += 1
			last["at"], last["id"] = it["at"], it.get("id")
			continue
		out.append({**it, "said": it.get("text"), "times": 1})
	for it in out:
		if it["times"] == 2:
			it["text"] = _("{0}, twice").format(it["said"])
		elif it["times"] > 2:
			it["text"] = _("{0}, {1} times").format(it["said"], it["times"])
		del it["said"], it["times"]
	return out


@frappe.whitelist()
def get_activity(doctype: str, name: str):
	"""Everything said and done on one document, oldest first, for its panel."""
	doc = _doc(doctype, name)
	items = _activity(doc)
	return {"doctype": doc.doctype, "name": doc.name, "items": items, "comments": sum(1 for i in items if i["kind"] == "comment")}


def _as_html(text):
	"""Typed text as the HTML a Frappe comment holds: escaped, its paragraphs and lines kept."""
	paras = [p for p in cstr(text).replace("\r\n", "\n").split("\n\n") if p.strip()]
	return "".join("<p>" + frappe.utils.escape_html(p.strip()).replace("\n", "<br>") + "</p>" for p in paras)


@frappe.whitelist(methods=["POST"])
def add_comment(doctype: str, name: str, content: str):
	"""A comment on the document, as Desk's comment box adds one: anyone who may read it may say
	something on it. It lands in Desk's timeline too."""
	doc = _doc(doctype, name)
	text = cstr(content).strip()
	if not text:
		frappe.throw(_("Write something first."))
	if len(text) > MAX_COMMENT:
		frappe.throw(_("A comment can be at most {0} characters.").format(MAX_COMMENT))
	user = frappe.session.user
	doc.add_comment("Comment", text=_as_html(text), comment_email=user, comment_by=get_fullname(user))
	return get_activity(doc.doctype, doc.name)
