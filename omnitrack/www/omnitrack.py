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
	ctx.today_date = nowdate()
	ctx.current_time = nowtime()
	ctx.no_cache = 1

	# Fetch today's Planned Work Blocks for the active user safely
	try:
		blocks = frappe.get_all(
			"Planned Work Block",
			filters={"team_member": user, "work_date": nowdate()},
			fields=["name", "start_time", "end_time", "duration_hours", "status", "checkin_hash", "task_nature", "project"],
			order_by="start_time asc"
		)
	except Exception:
		blocks = []

	ctx.today_blocks = blocks

	# Calculate today's planned total hours
	total_planned = sum([(b.duration_hours or 0.0) for b in blocks]) if blocks else 0.0
	ctx.total_planned_hours = round(total_planned, 2)

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

