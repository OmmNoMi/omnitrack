import frappe
from frappe.utils import nowdate, nowtime

no_cache = 1

def get_context(context):
	# Allow both dictionary and frappe._dict
	if isinstance(context, dict):
		ctx = frappe._dict(context)
	else:
		ctx = context

	if frappe.session.user == "Guest":
		frappe.local.flags.redirect_location = "/login?redirect-to=/omnitrack"
		raise frappe.Redirect

	user = frappe.session.user
	ctx.title = "OmniTrack Workstation"
	ctx.user = user
	ctx.user_fullname = frappe.utils.get_fullname(user) or user
	from omnitrack.permissions import is_omnitrack_manager
	ctx.is_manager = 1 if is_omnitrack_manager(user) else 0
	user_roles = frappe.get_roles(user)
	ctx.is_client = 1 if ("OmniTrack Client" in user_roles and not ctx.is_manager) else 0
	# Bundle URLs carried a hard-coded version, so a rebuilt HUD bundle never
	# reached the browser. Key the query on the built file's mtime instead:
	# changes bust the cache, unchanged builds keep it.
	try:
		import os
		_dist = frappe.get_app_path("omnitrack", "public", "dist", "timesheet_session_box.bundle.js")
		ctx.asset_bust = str(int(os.path.getmtime(_dist)))
	except Exception:
		ctx.asset_bust = "1030"
	ctx.today_date = nowdate()
	ctx.current_time = nowtime()
	ctx.no_cache = 1
	# Administrator / freshly-created sessions have no csrf_token yet; get_csrf_token()
	# generates and persists one so client POSTs validate instead of racing a 417.
	try:
		from frappe.sessions import get_csrf_token
		ctx.csrf_token = get_csrf_token()
	except Exception:
		try:
			ctx.csrf_token = frappe.local.session.data.csrf_token or ""
		except Exception:
			ctx.csrf_token = ""

	# Fetch today's Planned Work Blocks for the active user safely
	try:
		if ctx.is_client:
			blocks = frappe.get_all(
				"Planned Work Block",
				filters={"work_date": nowdate()},
				fields=["name", "start_time", "end_time", "duration_hours", "actual_hours", "variance_hours", "status", "cryptographic_hash", "task_nature", "project", "cancel_reason", "rescheduled_to", "rescheduled_from", "deliverable_notes"],
				order_by="start_time asc",
				limit=50
			)
		else:
			blocks = frappe.get_all(
				"Planned Work Block",
				filters={"employee": user, "work_date": nowdate()},
				fields=["name", "start_time", "end_time", "duration_hours", "actual_hours", "variance_hours", "status", "cryptographic_hash", "task_nature", "project", "cancel_reason", "rescheduled_to", "rescheduled_from", "deliverable_notes"],
				order_by="start_time asc"
			)
			if not blocks:
				blocks = frappe.get_all(
					"Planned Work Block",
					filters={"work_date": nowdate()},
					fields=["name", "start_time", "end_time", "duration_hours", "actual_hours", "variance_hours", "status", "cryptographic_hash", "task_nature", "project", "cancel_reason", "rescheduled_to", "rescheduled_from", "deliverable_notes"],
					order_by="start_time asc",
					limit=20
				)
	except Exception:
		blocks = []

	ctx.today_blocks = blocks

	# Fetch initial live data and active session
	try:
		from omnitrack.api import get_workstation_data, get_active_session
		ctx.initial_data = get_workstation_data()
		ctx.active_session = get_active_session()
	except Exception:
		ctx.initial_data = {}
		ctx.active_session = None

	# Fetch Settings safely as dict
	try:
		settings = frappe.get_doc("OmniTrack Settings").as_dict()
	except Exception:
		settings = {}

	ctx.settings = settings
	ctx.app_logo_url = "/assets/omnitrack/icons/desktop_icons/solid/omnitrack.svg?v=shiva_eye_v1"
	ctx.manifest_url = "/assets/omnitrack/manifest.json"

	if isinstance(context, dict):
		context.update(ctx)
		return context
	return ctx

