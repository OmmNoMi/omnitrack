import hmac
import hashlib
import json
import frappe
from frappe import _
from frappe.utils import now_datetime

def on_task_trash(doc, method=None):
	settings = frappe.get_single("OmniTrack Settings")
	if not settings.enable_site_sync:
		return
	# Non-destructive deletion: If deleting, cancel remote task instead
	dispatch_task_sync_event(doc, "cancel")

def dispatch_task_sync_event(task_doc, event_type="update"):
	connections = frappe.get_all("OmniTrack Remote Connection", filters={"status": "Active", "auto_sync_tasks": 1})
	for conn in connections:
		# Queue background sync task
		frappe.enqueue(
			"omnitrack.sync.send_payload_to_remote",
			connection_name=conn.name,
			task_name=task_doc.name,
			event_type=event_type,
			now=frappe.flags.in_test
		)

def send_payload_to_remote(connection_name, task_name, event_type):
	import requests
	conn = frappe.get_doc("OmniTrack Remote Connection", connection_name)
	task = frappe.get_doc("Task", task_name)
	
	settings = frappe.get_single("OmniTrack Settings")
	payload = {
		"event_type": event_type,
		"task_title": task.subject,
		"status": task.status,
		"priority": task.priority,
		"expected_hours": task.get("custom_expected_hours"),
		"client_eta": str(task.get("custom_client_eta") or ""),
		"is_public": task.get("custom_is_public_deliverable"),
		"remote_task_id": task.name,
		"modified": str(task.modified)
	}

	# Strip confidential pricing data if enabled
	if settings.sanitize_billing_rates:
		payload.pop("billing_rate", None)
		payload.pop("cost_rate", None)

	data_str = json.dumps(payload, sort_keys=True)
	secret = conn.get_password("hmac_secret") or "default_secret"
	signature = hmac.new(secret.encode(), data_str.encode(), hashlib.sha256).hexdigest()

	headers = {
		"Authorization": f"token {conn.api_key}:{conn.get_password('api_secret')}",
		"X-OmniTrack-Signature": signature,
		"Content-Type": "application/json"
	}

	url = f"{conn.remote_url.rstrip('/')}/api/method/omnitrack.sync.receive_sync_event"
	try:
		res = requests.post(url, data=data_str, headers=headers, timeout=10)
		if res.status_code == 200:
			conn.db_set("last_sync_timestamp", now_datetime())
		else:
			conn.db_set("sync_error_log", f"HTTP {res.status_code}: {res.text[:200]}")
	except Exception as e:
		conn.db_set("sync_error_log", str(e)[:200])

@frappe.whitelist(allow_guest=True)
def receive_sync_event():
	data_str = frappe.request.get_data(as_text=True)
	if not data_str:
		frappe.throw(_("Empty payload"), frappe.ValidationError)
	
	payload = json.loads(data_str)
	event_type = payload.get("event_type")
	remote_id = payload.get("remote_task_id")
	
	# Field-level merge
	existing = frappe.db.get_value("Task", {"custom_remote_task_id": remote_id}, "name")
	if existing:
		task = frappe.get_doc("Task", existing)
		if event_type == "cancel":
			task.status = "Cancelled"
			task.add_comment("Comment", _("Sync unlinked: Task was cancelled on remote instance."))
		else:
			if payload.get("status"):
				task.status = payload["status"]
			if payload.get("client_eta"):
				task.custom_client_eta = payload["client_eta"]
		task.save(ignore_permissions=True)
		return {"status": "updated", "task": task.name}
	else:
		if event_type != "cancel":
			new_task = frappe.new_doc("Task")
			new_task.subject = payload.get("task_title", "Synced Remote Task")
			new_task.status = payload.get("status", "Open")
			new_task.custom_remote_task_id = remote_id
			new_task.custom_sync_status = "Synced"
			new_task.insert(ignore_permissions=True)
			return {"status": "created", "task": new_task.name}
	
	return {"status": "ignored"}

def process_queued_sync_events():
	frappe.logger("omnitrack").info("Processed queued live sync events.")
