import json
import frappe
from frappe import _
from frappe.utils import nowdate

def on_task_update(doc, method=None):
	settings = frappe.get_single("OmniTrack Settings")
	if not settings.enable_push_notifications:
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
				action_url=f"/app/{doc.doctype.lower().replace(' ', '-')}/{doc.name}"
			)

def dispatch_push_notification(user, title, message, action_url="/", is_urgent=False):
	settings = frappe.get_single("OmniTrack Settings")
	
	# Leave-Aware Silencing
	if settings.silence_push_on_leave and not is_urgent:
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

	# Create native Frappe Notification Log
	notification = frappe.new_doc("Notification Log")
	notification.for_user = user
	notification.subject = title
	notification.email_content = message
	notification.document_type = "Planned Work Block"
	notification.flags.ignore_permissions = True
	notification.insert()

	return {"status": "dispatched", "user": user}

@frappe.whitelist()
def register_push_subscription(endpoint, p256dh=None, auth=None, device_type="Web Browser"):
	user = frappe.session.user
	existing = frappe.db.get_value("OmniTrack Push Subscription", {"user": user, "endpoint": endpoint}, "name")
	if existing:
		sub = frappe.get_doc("OmniTrack Push Subscription", existing)
		sub.is_active = 1
		sub.save(ignore_permissions=True)
		return {"status": "updated", "name": sub.name}
	
	sub = frappe.new_doc("OmniTrack Push Subscription")
	sub.user = user
	sub.endpoint = endpoint
	sub.p256dh_key = p256dh
	sub.auth_key = auth
	sub.device_type = device_type
	sub.is_active = 1
	sub.insert(ignore_permissions=True)
	return {"status": "created", "name": sub.name}
