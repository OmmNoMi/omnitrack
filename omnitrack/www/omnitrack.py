import frappe
from frappe.utils import nowdate, nowtime

def get_context(context):
	if frappe.session.user == "Guest":
		frappe.local.flags.redirect_location = "/login?redirect-to=/omnitrack"
		raise frappe.Redirect

	context.title = "OmniTrack Workstation"
	context.user = frappe.session.user
	context.user_fullname = frappe.utils.get_fullname(frappe.session.user)
	context.today_date = nowdate()
	context.current_time = nowtime()

	# Fetch today's Planned Work Blocks for the active user
	blocks = frappe.get_all(
		"Planned Work Block",
		filters={"team_member": frappe.session.user, "work_date": nowdate()},
		fields=["name", "start_time", "end_time", "duration_hours", "status", "checkin_hash", "task_nature", "project"],
		order_by="start_time asc"
	)
	context.today_blocks = blocks

	# Calculate today's planned total hours
	total_planned = sum([b.duration_hours or 0.0 for b in blocks])
	context.total_planned_hours = round(total_planned, 2)

	# Fetch Settings
	settings = frappe.get_cached_doc("OmniTrack Settings")
	context.settings = settings
	context.app_logo_url = "/assets/omnitrack/icons/desktop_icons/solid/omnitrack.svg?v=shiva_eye_v1"
	context.manifest_url = "/assets/omnitrack/manifest.json"

	return context
