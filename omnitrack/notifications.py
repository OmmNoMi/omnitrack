import json
from datetime import datetime
import frappe
from frappe import _
from frappe.utils import flt, get_time, now_datetime, nowdate


def on_task_update(doc, method=None):
	settings = frappe.get_single("OmniTrack Settings")
	if not getattr(settings, "enable_push_notifications", True):
		return

	if doc.has_value_changed("status") or doc.has_value_changed("_assign") or doc.has_value_changed("allocated_to"):
		recipients = []
		if doc.get("_assign"):
			try:
				recipients.extend(json.loads(doc._assign))
			except Exception:
				pass
		if doc.get("allocated_to"):
			recipients.append(doc.allocated_to)

		title_subject = doc.get("subject") or doc.get("description") or doc.name
		for user in set(recipients):
			dispatch_push_notification(
				user=user,
				title=_("Task Updated: {0}").format(title_subject[:40]),
				message=_("Status changed to {0}").format(doc.status),
				action_url=f"/desk/{doc.doctype.lower().replace(' ', '-')}/{doc.name}"
			)


def dispatch_push_notification(user, title, message, action_url="/omnitrack", is_urgent=False):
	"""
	Dispatches a notification to the target user across:
	1. Frappe Cloud Push Relay (APNs for iOS, FCM for Android)
	2. Desk Notification Log (persistent notification bell)
	3. Realtime WebSockets push (immediate in-app toast/modal)
	"""
	settings = frappe.get_single("OmniTrack Settings")

	# Leave-Aware Silencing
	if getattr(settings, "silence_push_on_leave", False) and not is_urgent:
		if frappe.db.exists("DocType", "Leave Application"):
			employee = frappe.db.get_value("Employee", {"user_id": user}, "name")
			if employee:
				today = nowdate()
				on_leave = frappe.db.exists("Leave Application", {
					"employee": employee,
					"docstatus": 1,
					"status": "Approved",
					"from_date": ["<=", today],
					"to_date": [">=", today]
				})
				if on_leave:
					return {"status": "silenced_leave"}

	pushed_via_relay = False
	# 1. Native Frappe Cloud Push Relay (APNs for iOS, FCM for Android)
	# Try project "omnitrack" first; fall back to "raven" if already configured on this site
	for proj in ("omnitrack", "raven"):
		try:
			from frappe.push_notification import PushNotification
			relay = PushNotification(proj)
			if relay.is_enabled():
				success = relay.send_notification_to_user(
					user_id=user,
					title=title,
					body=message,
					link=action_url,
					icon="/assets/omnitrack/icons/desktop_icons/solid/omnitrack.svg"
				)
				if success:
					pushed_via_relay = True
					break
		except Exception:
			pass

	# 2. Native Frappe Notification Log
	try:
		notification = frappe.new_doc("Notification Log")
		notification.for_user = user
		notification.subject = title
		notification.email_content = message
		notification.document_type = "Planned Work Block"
		notification.flags.ignore_permissions = True
		notification.insert()
	except Exception:
		pass

	# 3. Realtime socket event
	try:
		frappe.publish_realtime("omnitrack:timesheet_reminder", {
			"user": user,
			"title": title,
			"message": message,
			"action_url": action_url
		}, user=user)
	except Exception:
		pass

	return {"status": "dispatched", "user": user, "pushed_via_relay": pushed_via_relay}


def check_active_timesheet_reminders():
	"""
	Scheduled cron task running every minute on Frappe Cloud.
	Scans all running active timesheets across users and sends server push alerts for:
	1. 30-Minute Inactivity (user has active clock running but logged no notes for 30m)
	2. Planned Block Overrun (active session has passed the planned block's scheduled end time)
	Throttles alerts to repeat at most every 30 minutes.
	"""
	active_records = frappe.db.sql(
		"""SELECT parent as user, defvalue FROM `tabDefaultValue`
		   WHERE defkey = 'omnitrack_active_session' AND parent IS NOT NULL""",
		as_dict=True
	)
	if not active_records:
		return {"checked": 0, "alerts_sent": 0}

	now_dt = now_datetime()
	now_ms = now_dt.timestamp() * 1000
	today_str = nowdate()
	cur_time = now_dt.time()
	cur_mins = cur_time.hour * 60 + cur_time.minute
	alerts_sent = 0

	for r in active_records:
		user = r.get("user")
		raw = r.get("defvalue")
		if not user or not raw or user == "Guest":
			continue

		try:
			data = json.loads(raw) if isinstance(raw, str) else raw
		except Exception:
			continue

		if not isinstance(data, dict) or data.get("status") != "active":
			continue

		start_time = flt(data.get("startTime", 0))
		if start_time <= 0:
			continue

		# If session is older than 24 hours, let standard expiration handle it
		diff_seconds = (now_ms - start_time) / 1000.0
		if diff_seconds > 86400 or diff_seconds < -300:
			continue

		session_updated = False
		last_act = flt(data.get("lastActivityTime") or data.get("lastUpdated") or start_time)
		idle_mins = int(max(0, (now_ms - last_act) / 60000))
		last_inact_alert = flt(data.get("lastInactivityAlertTime", 0))
		mins_since_inact_alert = int(max(0, (now_ms - last_inact_alert) / 60000)) if last_inact_alert else 999

		# 1. 30-Minute Inactivity Alert
		if idle_mins >= 30 and mins_since_inact_alert >= 30:
			notes = (data.get("trackerNotes") or "Active Work").strip()[:50]
			title = _("OmniTrack: Are you still working?")
			msg = _("No notes logged for {0}m on '{1}'. Wrap up or continue your timesheet?").format(idle_mins, notes)
			dispatch_push_notification(user, title, msg, action_url="/omnitrack")
			data["lastInactivityAlertTime"] = int(now_ms)
			session_updated = True
			alerts_sent += 1

		# 2. Planned Block End / Overrun Alert
		bound_block_name = data.get("trackerBlockName")
		if bound_block_name:
			last_overrun_alert = flt(data.get("lastOverrunAlertTime", 0))
			mins_since_overrun_alert = int(max(0, (now_ms - last_overrun_alert) / 60000)) if last_overrun_alert else 999

			if mins_since_overrun_alert >= 30:
				block_data = frappe.db.get_value(
					"Planned Work Block",
					bound_block_name,
					["name", "work_date", "end_time", "work_item_label", "task_subject", "status"],
					as_dict=True
				)
				if block_data and block_data.status not in ("Completed", "Logged (Full)", "Logged (Over)", "Cancelled", "Missed"):
					if block_data.end_time and str(block_data.work_date or "") == today_str:
						end_t = get_time(block_data.end_time)
						if cur_time >= end_t:
							end_mins = end_t.hour * 60 + end_t.minute
							overdue_mins = max(0, cur_mins - end_mins)
							block_title = (block_data.work_item_label or block_data.task_subject or block_data.name)[:50]
							end_hhmm = end_t.strftime("%H:%M")
							title = _("OmniTrack: Planned Block Ended")
							if overdue_mins > 5:
								msg = _("Planned block '{0}' ended at {1} ({2}m overdue). Close timesheet or extend?").format(
									block_title, end_hhmm, overdue_mins
								)
							else:
								msg = _("Planned block '{0}' ended at {1}. Close timesheet or extend?").format(
									block_title, end_hhmm
								)

							dispatch_push_notification(user, title, msg, action_url="/omnitrack")
							data["lastOverrunAlertTime"] = int(now_ms)
							session_updated = True
							alerts_sent += 1

		# Persist alert timestamps back so we throttle cleanly
		if session_updated:
			try:
				frappe.cache.hset("omnitrack:active_session", user, data)
				frappe.db.set_default("omnitrack_active_session", json.dumps(data), parent=user)
				frappe.db.commit()
			except Exception:
				pass

	return {"checked": len(active_records), "alerts_sent": alerts_sent}


@frappe.whitelist()
def register_push_subscription(endpoint, p256dh=None, auth=None, fcm_token=None, device_type="Web Browser"):
	user = frappe.session.user
	token = fcm_token or endpoint
	existing = frappe.db.get_value("OmniTrack Push Subscription", {"user": user, "endpoint": endpoint}, "name")
	if existing:
		sub = frappe.get_doc("OmniTrack Push Subscription", existing)
		sub.is_active = 1
		sub.p256dh_key = p256dh or sub.p256dh_key
		sub.auth_key = auth or sub.auth_key
		sub.save(ignore_permissions=True)
	else:
		sub = frappe.new_doc("OmniTrack Push Subscription")
		sub.user = user
		sub.endpoint = endpoint
		sub.p256dh_key = p256dh
		sub.auth_key = auth
		sub.device_type = device_type
		sub.is_active = 1
		sub.insert(ignore_permissions=True)

	# Register with native Frappe Cloud push relay
	for proj in ("omnitrack", "raven"):
		try:
			from frappe.push_notification import subscribe
			subscribe(token, proj)
		except Exception:
			pass

	return {"status": "subscribed", "name": sub.name}
