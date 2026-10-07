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
	from omnitrack.utils.validators import get_min_log_line_chars, get_min_session_words
	ctx.min_log_line_chars = get_min_log_line_chars()
	ctx.min_session_words = get_min_session_words()
	# Bundle URLs carried a hard-coded version, so a rebuilt HUD bundle never
	# reached the browser. Key the query on the built file's mtime instead:
	# changes bust the cache, unchanged builds keep it.
	try:
		import os
		_dist = frappe.get_app_path("omnitrack", "public", "dist", "omnitrack.bundle.js")
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

	# The page renders only the session it boots with. Blocks, tasks and settings come
	# from the SPA's own permission-checked calls, so nothing else is fetched here.
	try:
		from omnitrack.api import get_active_session
		ctx.active_session = get_active_session()
	except Exception:
		ctx.active_session = None

	# Projects show only where the site has them (ERPNext's Projects module)
	ctx.has_projects = 1 if frappe.db.exists("DocType", "Project") else 0

	# The realtime socket joins the namespace named after the site (Frappe's socket server
	# rejects any other), and in development it listens on its own port.
	ctx.site_name = frappe.local.site
	ctx.socketio_port = frappe.conf.get("socketio_port") or 9000
	ctx.app_logo_url = "/assets/omnitrack/icons/desktop_icons/solid/omnitrack.svg?v=shiva_eye_v1"
	ctx.manifest_url = "/assets/omnitrack/manifest.json"

	if isinstance(context, dict):
		context.update(ctx)
		return context
	return ctx

