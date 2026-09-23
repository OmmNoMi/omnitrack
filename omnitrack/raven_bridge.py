# Copyright (c) 2026, OmmNoMi Automation LLP and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.utils import cint, flt, get_datetime, now_datetime, strip_html


def is_raven_available() -> bool:
	"""
	Check if Raven messaging is installed and available on this Frappe site.
	Gracefully returns False on sites without Raven (e.g. standalone/ommnomi.local).
	"""
	try:
		return bool(
			frappe.db.exists("DocType", "Raven Channel")
			and frappe.db.exists("DocType", "Raven Message")
		)
	except Exception:
		return False


def _resolve_task_doctype_and_id(task_id: str) -> tuple[str, str]:
	if not task_id:
		doctype = "Task" if frappe.db.exists("DocType", "Task") else "ToDo"
		return doctype, ""
	clean_id = task_id.replace("todo:", "").replace("task:", "")
	if frappe.db.exists("DocType", "Task") and frappe.db.exists("Task", clean_id):
		return "Task", clean_id
	if frappe.db.exists("DocType", "ToDo") and frappe.db.exists("ToDo", clean_id):
		return "ToDo", clean_id
	doctype = "Task" if frappe.db.exists("DocType", "Task") else "ToDo"
	return doctype, clean_id


def get_or_create_task_channel(task_id: str, project_id: str | None = None) -> str | None:
	"""
	Resolve or provision a Raven Channel anchored to a Task / Deliverable.
	Sets linked_doctype="Task" (or "ToDo") and linked_document=task_id.
	Returns channel.name or None if Raven is absent.
	"""
	if not is_raven_available() or not task_id:
		return None

	doctype, clean_id = _resolve_task_doctype_and_id(task_id)

	# 1. Look for an existing channel linked directly to this Task / ToDo
	channel_name = frappe.db.get_value(
		"Raven Channel",
		{"linked_doctype": doctype, "linked_document": clean_id, "is_archived": 0},
		"name",
	)
	if channel_name:
		_ensure_channel_membership(channel_name, frappe.session.user)
		return channel_name

	# 2. Look by deterministic slug name: task-[clean_id]
	sanitized_id = clean_id.lower().replace(" ", "-")
	slug_name = f"task-{sanitized_id}"
	channel_name = frappe.db.get_value("Raven Channel", {"channel_name": slug_name}, "name")
	if channel_name:
		_ensure_channel_membership(channel_name, frappe.session.user)
		return channel_name

	# 3. Provision a new channel for this task
	task_subject = None
	if doctype == "Task" and frappe.db.exists("DocType", "Task"):
		task_subject = frappe.db.get_value("Task", clean_id, "subject")
	elif frappe.db.exists("DocType", "ToDo"):
		task_subject = frappe.db.get_value("ToDo", clean_id, "description")
	task_subject = strip_html(task_subject or clean_id)[:140]

	default_workspace = (
		frappe.db.get_value("Raven Workspace", {}, "name")
		if frappe.db.exists("DocType", "Raven Workspace")
		else None
	) or "Raven"

	try:
		channel = frappe.get_doc(
			{
				"doctype": "Raven Channel",
				"channel_name": slug_name,
				"channel_description": f"Collaboration, discussions & specs for Task: {task_subject}",
				"type": "Public",
				"workspace": default_workspace,
				"linked_doctype": doctype,
				"linked_document": clean_id,
			}
		)
		channel.flags.ignore_permissions = True
		channel.insert(ignore_permissions=True)

		_ensure_channel_membership(channel.name, frappe.session.user)
		return channel.name
	except Exception as e:
		frappe.log_error(f"Failed to create Raven channel for task {task_id}: {e}", "OmniTrack Raven Bridge")
		return None


def _ensure_channel_membership(channel_id: str, user: str):
	"""Ensure user is a member of the Raven channel."""
	if not user or user == "Guest" or not frappe.db.exists("DocType", "Raven Channel Member"):
		return
	try:
		exists = frappe.db.exists(
			"Raven Channel Member",
			{"parent": channel_id, "user": user},
		)
		if not exists:
			member_doc = frappe.get_doc(
				{
					"doctype": "Raven Channel Member",
					"parent": channel_id,
					"parenttype": "Raven Channel",
					"parentfield": "members",
					"user": user,
					"role": "Member",
				}
			)
			member_doc.flags.ignore_permissions = True
			member_doc.insert(ignore_permissions=True)
	except Exception:
		pass


def get_task_messages(task_id: str, limit: int = 50) -> list[dict]:
	"""
	Fetch the conversation stream for a task.
	Returns list of message dictionaries with sender info and formatted timestamps.
	"""
	if not is_raven_available() or not task_id:
		return []

	channel_id = get_or_create_task_channel(task_id)
	if not channel_id:
		return []

	fields = [
		"name",
		"owner",
		"creation",
		"modified",
		"text",
		"content",
		"message_type",
		"file",
		"file_size",
		"is_reply",
		"linked_message",
		"message_reactions",
		"is_bot_message",
		"bot",
		"link_doctype",
		"link_document",
	]

	try:
		messages = frappe.get_all(
			"Raven Message",
			filters={"channel_id": channel_id},
			fields=fields,
			order_by="creation asc",
			limit_page_length=limit,
		)
	except Exception as e:
		frappe.log_error(f"Error fetching Raven messages for {task_id}: {e}", "OmniTrack Raven Bridge")
		return []

	# Enhance messages with sender details for high-fidelity UI rendering
	for m in messages:
		sender_user = m.get("owner")
		m["sender_name"] = (
			frappe.db.get_value("User", sender_user, "full_name") or sender_user
		)
		m["sender_image"] = frappe.db.get_value("User", sender_user, "user_image")
		m["is_self"] = bool(sender_user == frappe.session.user)

	return messages


def send_task_message(
	task_id: str,
	content: str,
	files: list[dict] | None = None,
	is_reply: bool = False,
	linked_message: str | None = None,
	client_id: str | None = None,
) -> dict:
	"""
	Send a message into the task's Raven channel/thread.
	Uses Raven's native API if available; otherwise standard Frappe document insertion.
	"""
	if not is_raven_available():
		return {"success": False, "error": "Raven is not installed on this site"}

	if not content and not files:
		return {"success": False, "error": "Message content or files required"}

	channel_id = get_or_create_task_channel(task_id)
	if not channel_id:
		return {"success": False, "error": f"Could not find or create channel for task {task_id}"}

	doctype, clean_id = _resolve_task_doctype_and_id(task_id)

	try:
		# Attempt to use Raven's composer send API
		try:
			from raven.api.raven_message import send_message_with_attachments

			res = send_message_with_attachments(
				channel_id=channel_id,
				content=content,
				files=files or [],
				client_id=client_id,
				is_reply=is_reply,
				linked_message=linked_message,
				link_doctype=doctype,
				link_document=clean_id,
			)
			return {"success": True, "channel_id": channel_id, "messages": res}
		except (ImportError, AttributeError):
			# Fallback: create Raven Message directly
			doc = frappe.get_doc(
				{
					"doctype": "Raven Message",
					"channel_id": channel_id,
					"text": content,
					"content": strip_html(content),
					"message_type": "Text",
					"is_reply": is_reply,
					"linked_message": linked_message,
					"link_doctype": doctype,
					"link_document": clean_id,
				}
			)
			doc.insert()
			return {"success": True, "channel_id": channel_id, "message_id": doc.name}

	except Exception as e:
		frappe.log_error(f"Error sending Raven message for task {task_id}: {e}", "OmniTrack Raven Bridge")
		return {"success": False, "error": str(e)}


def broadcast_session_start(task_id: str, duration_hours: float | None = None, employee: str | None = None):
	"""
	Post a lightweight presence notification to the task channel when a user starts a work session.
	Zero interruption, informs teammates the task is actively being worked on.
	"""
	if not is_raven_available() or not task_id:
		return

	doctype, clean_id = _resolve_task_doctype_and_id(task_id)

	user_name = frappe.db.get_value("User", frappe.session.user, "full_name") or frappe.session.user
	dur_str = f" for ~{duration_hours:.1f}h" if duration_hours else ""
	message_text = f"⚡ **{user_name}** started a focus session{dur_str}."

	channel_id = get_or_create_task_channel(task_id)
	if not channel_id:
		return

	try:
		msg = frappe.get_doc(
			{
				"doctype": "Raven Message",
				"channel_id": channel_id,
				"text": message_text,
				"content": message_text,
				"message_type": "System",
				"link_doctype": doctype,
				"link_document": clean_id,
			}
		)
		msg.flags.send_silently = True
		msg.insert(ignore_permissions=True)
	except Exception as e:
		frappe.log_error(f"Error broadcasting session start: {e}", "OmniTrack Raven Bridge")


def post_session_accomplishment_recap(
	work_block_name: str,
	session_notes: list[str] | str,
	duration_hours: float = 0.0,
	timesheet_name: str | None = None,
):
	"""
	Automatically format and post a structured sprint accomplishment card to the task channel.
	Invoked when a user completes a focus session in SessionBox.vue or Workstation.
	"""
	if not is_raven_available() or not work_block_name:
		return

	if isinstance(session_notes, str):
		import json

		try:
			session_notes = json.loads(session_notes)
		except Exception:
			session_notes = [n.strip() for n in session_notes.split("\n") if n.strip()]

	if not session_notes:
		return

	# Retrieve block details
	task_id = None
	project_id = None
	if frappe.db.exists("Planned Work Block", work_block_name):
		task_id, project_id, timesheet = frappe.db.get_value(
			"Planned Work Block",
			work_block_name,
			["task", "project", "timesheet"],
		)
		if not timesheet_name and timesheet:
			timesheet_name = timesheet

	if not task_id:
		return

	doctype, clean_id = _resolve_task_doctype_and_id(task_id)
	channel_id = get_or_create_task_channel(task_id, project_id)
	if not channel_id:
		return

	user_name = frappe.db.get_value("User", frappe.session.user, "full_name") or frappe.session.user
	dur_display = f"{flt(duration_hours, 2):.2f}h" if duration_hours else "Active Sitting"

	# Build rich markdown card
	lines_md = "\n".join([f"{i+1}. {note}" for i, note in enumerate(session_notes)])
	ts_ref = f" · Timesheet `{timesheet_name}`" if timesheet_name else ""
	recap_md = (
		f"⏱️ **Work Session Completed** ({dur_display}) by **{user_name}**\n\n"
		f"**Accomplished Micro-Notes:**\n{lines_md}\n\n"
		f"<small style=\"color: #6c757d;\">Block: `{work_block_name}`{ts_ref}</small>"
	)

	try:
		msg = frappe.get_doc(
			{
				"doctype": "Raven Message",
				"channel_id": channel_id,
				"text": recap_md,
				"content": recap_md,
				"message_type": "Text",
				"link_doctype": doctype,
				"link_document": clean_id,
			}
		)
		msg.insert(ignore_permissions=True)
	except Exception as e:
		frappe.log_error(f"Error posting session recap: {e}", "OmniTrack Raven Bridge")


def pin_message_as_task_spec(message_id: str, task_id: str) -> dict:
	"""
	Elevate a key chat message or technical decision into authoritative Task documentation.
	Appends to Task.description with an immutable timestamp header.
	"""
	if not is_raven_available():
		return {"success": False, "error": "Raven not installed"}

	if not frappe.db.exists("Raven Message", message_id):
		return {"success": False, "error": f"Message {message_id} not found"}

	msg_doc = frappe.get_doc("Raven Message", message_id)
	author_name = frappe.db.get_value("User", msg_doc.owner, "full_name") or msg_doc.owner
	msg_content = msg_doc.content or msg_doc.text or ""

	if not frappe.db.exists("DocType", "Task") or not frappe.db.exists("Task", task_id):
		return {"success": False, "error": f"Task {task_id} not found"}

	task_doc = frappe.get_doc("Task", task_id)
	current_desc = task_doc.description or ""

	spec_snippet = (
		f"\n\n<!-- raven-pinned-spec:{message_id} -->\n"
		f"### 📌 Pinned Spec / Decision ({msg_doc.creation[:16]} by {author_name})\n"
		f"{msg_content}\n"
		f"<!-- end-raven-pinned-spec -->"
	)

	task_doc.description = current_desc + spec_snippet
	task_doc.flags.ignore_permissions = True
	task_doc.save(ignore_permissions=True)

	return {"success": True, "task": task_id, "message_id": message_id}


def get_task_raven_timeline_content(doctype: str, docname: str) -> list[dict]:
	"""
	Zero-write extension hook for Frappe Desk form timelines (`additional_timeline_content`).
	Returns recent Raven conversation items to render live in the Activity feed of Task / Block.
	"""
	if not is_raven_available():
		return []

	try:
		messages = frappe.get_all(
			"Raven Message",
			filters={"link_doctype": doctype, "link_document": docname},
			fields=["name", "owner", "creation", "text", "content", "file", "message_type"],
			order_by="creation desc",
			limit_page_length=15,
		)

		timeline_items = []
		for m in messages:
			author = frappe.db.get_value("User", m.owner, "full_name") or m.owner
			content_html = f"""
			<div class="raven-timeline-card" style="font-size: 12px; line-height: 1.5; padding: 4px 0;">
				<div style="font-weight: 600; color: #1B64DA; margin-bottom: 2px;">
					💬 Raven Chat · {author}
				</div>
				<div style="color: #374151;">
					{m.content or m.text or 'File attachment'}
				</div>
			</div>
			"""
			timeline_items.append(
				{
					"icon": "message",
					"timeline_badge": None,
					"icon_size": "sm",
					"is_card": True,
					"creation": m.creation,
					"content": content_html,
				}
			)

		return timeline_items
	except Exception:
		return []


def get_block_raven_timeline_content(doctype: str, docname: str) -> list[dict]:
	"""Timeline hook for Planned Work Block - delegates to parent task if available."""
	if not frappe.db.exists("Planned Work Block", docname):
		return []

	task_id = frappe.db.get_value("Planned Work Block", docname, "task")
	if task_id:
		return get_task_raven_timeline_content("Task", task_id)
	return []
