# Copyright (c) 2026, OmmNoMi Automation LLP and contributors
# For license information, please see license.txt

import hashlib
import json
from datetime import datetime, timedelta
import frappe
from frappe import _
from frappe.utils import (
	flt,
	getdate,
	nowdate,
	now_datetime,
	time_diff_in_hours,
	nowtime,
	add_days,
	get_datetime,
)
from omnitrack.services import (
	TemporalGovernor,
	PairingEngine,
	MidnightSplitter,
	TimesheetBridge,
)
from omnitrack.utils import (
	duration_hours as _duration_hours,
	pad_time as _time_str,
	mins_of,
	require_session_notes as _require_session_notes,
	resolve_planner_user as _resolve_planner_user,
)


@frappe.whitelist()
def is_raven_enabled():
	"""Check whether Raven collaboration is available on the current site."""
	from omnitrack.raven_bridge import is_raven_available
	return {"available": is_raven_available()}


@frappe.whitelist()
def get_task_chat(task_id: str, limit: int = 50):
	"""Fetch the live Raven message stream for a task."""
	from omnitrack.raven_bridge import get_task_messages
	return {"messages": get_task_messages(task_id, cint(limit) or 50)}


@frappe.whitelist(methods=["POST"])
def post_task_chat_message(
	task_id: str,
	content: str,
	files=None,
	is_reply: bool = False,
	linked_message: str | None = None,
	client_id: str | None = None,
):
	"""Send a chat message into the task's Raven channel."""
	from omnitrack.raven_bridge import send_task_message
	if isinstance(files, str):
		try:
			files = frappe.parse_json(files)
		except Exception:
			files = []
	return send_task_message(
		task_id=task_id,
		content=content,
		files=files,
		is_reply=bool(cint(is_reply)),
		linked_message=linked_message,
		client_id=client_id,
	)


@frappe.whitelist(methods=["POST"])
def pin_task_spec(message_id: str, task_id: str):
	"""Elevate a key chat message or technical decision into authoritative Task documentation."""
	from omnitrack.raven_bridge import pin_message_as_task_spec
	return pin_message_as_task_spec(message_id, task_id)


@frappe.whitelist(methods=["POST"])
def broadcast_task_focus_start(task_id: str, duration_hours: float = None):
	"""Broadcast session start presence event into Raven task thread."""
	from omnitrack.raven_bridge import broadcast_session_start
	broadcast_session_start(task_id, flt(duration_hours) if duration_hours else None)


