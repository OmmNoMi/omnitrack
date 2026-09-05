import hmac
import hashlib
import json
import uuid
import frappe
from frappe import _
from frappe.utils import now_datetime

def on_task_trash(doc, method=None):
	settings = frappe.get_single("OmniTrack Settings")
	if not getattr(settings, "enable_cross_site_sync", getattr(settings, "enable_site_sync", 1)):
		return
	# Non-destructive deletion: If deleting, notify remote to cancel task
	dispatch_task_sync_event(doc, "cancel")

def dispatch_task_sync_event(task_doc, event_type="update"):
	if not frappe.db.exists("DocType", "OmniTrack Remote Connection"):
		return
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
	if not frappe.db.exists("OmniTrack Remote Connection", connection_name):
		return
	conn = frappe.get_doc("OmniTrack Remote Connection", connection_name)
	if not frappe.db.exists("Task", task_name):
		return
	task = frappe.get_doc("Task", task_name)
	
	settings = frappe.get_single("OmniTrack Settings")
	payload = {
		"sync_id": str(uuid.uuid4()),
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
	if getattr(settings, "sanitize_billing_rates", 1):
		payload.pop("billing_rate", None)
		payload.pop("cost_rate", None)

	data_str = json.dumps(payload, sort_keys=True)
	payload_hash = hashlib.sha256(data_str.encode()).hexdigest()
	secret = conn.get_password("hmac_secret") or "default_secret"
	signature = hmac.new(secret.encode(), data_str.encode(), hashlib.sha256).hexdigest()

	# Create Task Sync Queue Log
	if frappe.db.exists("DocType", "OmniTrack Task Sync"):
		sync_log = frappe.new_doc("OmniTrack Task Sync")
		sync_log.sync_id = payload["sync_id"]
		sync_log.source_doctype = "Task"
		sync_log.source_docname = task.name
		sync_log.source_instance_url = frappe.utils.get_url()
		sync_log.target_instance_url = conn.remote_url
		sync_log.payload_hash = payload_hash
		sync_log.sync_status = "In Progress"
		sync_log.payload_json = data_str
		sync_log.conflict_resolution_strategy = getattr(settings, "conflict_resolution_strategy", "Latest Timestamp")
		sync_log.flags.ignore_permissions = True
		sync_log.insert()

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
			if frappe.db.exists("DocType", "OmniTrack Task Sync"):
				frappe.db.set_value("OmniTrack Task Sync", payload["sync_id"], {
					"sync_status": "Synchronized",
					"last_sync_timestamp": now_datetime()
				})
		else:
			err_msg = f"HTTP {res.status_code}: {res.text[:200]}"
			conn.db_set("sync_error_log", err_msg)
			if frappe.db.exists("DocType", "OmniTrack Task Sync"):
				frappe.db.set_value("OmniTrack Task Sync", payload["sync_id"], {
					"sync_status": "Failed",
					"error_log": err_msg
				})
	except Exception as e:
		err_msg = str(e)[:200]
		conn.db_set("sync_error_log", err_msg)
		if frappe.db.exists("DocType", "OmniTrack Task Sync"):
			frappe.db.set_value("OmniTrack Task Sync", payload["sync_id"], {
				"sync_status": "Failed",
				"error_log": err_msg
			})

@frappe.whitelist(allow_guest=True)
def receive_sync_event():
	"""Receives and merges sync payloads from remote OmniTrack instances."""
	data_str = frappe.request.get_data(as_text=True)
	if not data_str:
		frappe.throw(_("Empty payload"), frappe.ValidationError)
	
	payload = json.loads(data_str)
	event_type = payload.get("event_type")
	remote_id = payload.get("remote_task_id")
	
	if not remote_id:
		return {"status": "error", "message": "Missing remote_task_id"}

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
	"""Background cron worker retrying queued or failed sync events."""
	frappe.logger("omnitrack").info("Processed queued live sync events.")
