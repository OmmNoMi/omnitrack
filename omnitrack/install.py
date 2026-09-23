import json
import secrets
import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

MODULE_NAME = "OmniTrack"
SIDEBAR_ICON = "/assets/omnitrack/icons/desktop_icons/solid/omnitrack.svg?v=shiva_eye_v1"

ROLES = [
	{"role_name": "OmniTrack Admin", "desk_access": 1},
	{"role_name": "OmniTrack Manager", "desk_access": 1},
	{"role_name": "OmniTrack User", "desk_access": 1},
	{"role_name": "OmniTrack Client", "desk_access": 1},
	{"role_name": "OmniTrack Auditor", "desk_access": 1},
	{"role_name": "OmniTrack Sync Agent", "desk_access": 0}
]

CUSTOM_FIELDS = {
	"Project": [
		{
			"fieldname": "custom_appsheet_id",
			"label": "Legacy AppSheet ID",
			"fieldtype": "Data",
			"insert_after": "project_name",
			"read_only": 0
		},
		{
			"fieldname": "custom_legacy_code",
			"label": "Legacy Project Code",
			"fieldtype": "Data",
			"insert_after": "custom_appsheet_id"
		}
	],
	"Task": [
		{
			"fieldname": "custom_omnitrack_section",
			"label": "OmniTrack Workforce Details",
			"fieldtype": "Section Break",
			"insert_after": "description"
		},
		{
			"fieldname": "custom_appsheet_id",
			"label": "Legacy AppSheet ID",
			"fieldtype": "Data",
			"insert_after": "custom_omnitrack_section"
		},
		{
			"fieldname": "custom_activity_code",
			"label": "Legacy Activity Code",
			"fieldtype": "Data",
			"insert_after": "custom_appsheet_id"
		},
		{
			"fieldname": "custom_expected_hours",
			"label": "Expected Hours",
			"fieldtype": "Float",
			"default": 0.0,
			"insert_after": "custom_activity_code"
		},
		{
			"fieldname": "custom_actual_hours",
			"label": "Actual Tracked Hours",
			"fieldtype": "Float",
			"default": 0.0,
			"read_only": 1,
			"insert_after": "custom_expected_hours"
		},
		{
			"fieldname": "custom_variance_hours",
			"label": "Variance Hours (Δ)",
			"fieldtype": "Float",
			"default": 0.0,
			"read_only": 1,
			"insert_after": "custom_actual_hours"
		},
		{
			"fieldname": "custom_col_break_omni",
			"fieldtype": "Column Break",
			"insert_after": "custom_variance_hours"
		},
		{
			"fieldname": "custom_remote_task_id",
			"label": "Remote Site Task ID",
			"fieldtype": "Data",
			"read_only": 1,
			"insert_after": "custom_col_break_omni"
		},
		{
			"fieldname": "custom_sync_status",
			"label": "Sync Status",
			"fieldtype": "Select",
			"options": "Not Synced\nSynced\nPending\nConflict",
			"default": "Not Synced",
			"read_only": 1,
			"insert_after": "custom_remote_task_id"
		}
	],
	"ToDo": [
		{
			"fieldname": "custom_omnitrack_section",
			"label": "OmniTrack Workforce & Sync Details",
			"fieldtype": "Section Break",
			"insert_after": "description"
		},
		{
			"fieldname": "custom_expected_hours",
			"label": "Expected Hours",
			"fieldtype": "Float",
			"default": 0.0,
			"insert_after": "custom_omnitrack_section"
		},
		{
			"fieldname": "custom_actual_hours",
			"label": "Actual Tracked Hours",
			"fieldtype": "Float",
			"default": 0.0,
			"read_only": 1,
			"insert_after": "custom_expected_hours"
		},
		{
			"fieldname": "custom_variance_hours",
			"label": "Variance Hours (Δ)",
			"fieldtype": "Float",
			"default": 0.0,
			"read_only": 1,
			"insert_after": "custom_actual_hours"
		}
	]
}

def after_install():
	_ensure_roles()
	_ensure_custom_fields()
	_ensure_default_settings()
	_ensure_number_cards_and_charts()
	_ensure_workspaces()
	_ensure_workspace_sidebar()
	_ensure_desktop_icon()

def after_migrate():
	_ensure_roles()
	_ensure_custom_fields()
	_ensure_default_settings()
	_ensure_number_cards_and_charts()
	_ensure_workspaces()
	_ensure_workspace_sidebar()
	_ensure_desktop_icon()

def _ensure_roles():
	for r in ROLES:
		if not frappe.db.exists("Role", r["role_name"]):
			doc = frappe.new_doc("Role")
			doc.role_name = r["role_name"]
			doc.desk_access = r["desk_access"]
			doc.insert(ignore_permissions=True)

def _ensure_custom_fields():
	for doctype, fields in CUSTOM_FIELDS.items():
		if frappe.db.exists("DocType", doctype):
			create_custom_fields({doctype: fields}, ignore_validate=True)

def _ensure_default_settings():
	try:
		if frappe.db.exists("DocType", "OmniTrack Settings"):
			settings = frappe.get_single("OmniTrack Settings")
			if not getattr(settings, "vapid_public_key", None):
				settings.vapid_public_key = f"VAPID_PUB_{secrets.token_hex(16)}"
				settings.vapid_private_key = secrets.token_hex(32)
				settings.save(ignore_permissions=True)
	except Exception:
		pass

def _ensure_number_cards_and_charts():
	"""Ensures standard Number Cards and Dashboard Charts exist for OmniTrack."""
	number_cards = [
		{
			"name": "OmniTrack Total Blocks",
			"label": "Total Work Blocks",
			"function": "Count",
			"document_type": "Planned Work Block",
			"is_public": 1,
			"show_percentage_stats": 1,
			"stats_time_interval": "Daily",
			"color": "#4285F4",
			"filters_json": "[]"
		},
		{
			"name": "OmniTrack Total Hours",
			"label": "Total Tracked Hours",
			"function": "Sum",
			"aggregate_function_based_on": "duration_hours",
			"document_type": "Planned Work Block",
			"is_public": 1,
			"show_percentage_stats": 1,
			"stats_time_interval": "Daily",
			"color": "#34A853",
			"filters_json": "[]"
		},
		{
			"name": "OmniTrack Active Shifts",
			"label": "Active Shift Assignments",
			"function": "Count",
			"document_type": "OmniTrack Shift Split Assignment",
			"is_public": 1,
			"color": "#FBBC05",
			"filters_json": "[[\"OmniTrack Shift Split Assignment\",\"status\",\"=\",\"Active\"]]"
		},
		{
			"name": "OmniTrack Synthesizer Logs",
			"label": "Attendance Syntheses",
			"function": "Count",
			"document_type": "OmniTrack Attendance Synthesizer Log",
			"is_public": 1,
			"color": "#EA4335",
			"filters_json": "[]"
		}
	]

	for nc in number_cards:
		if not frappe.db.exists("DocType", nc["document_type"]):
			continue
		existing = frappe.db.exists("Number Card", nc["name"])
		doc = frappe.get_doc("Number Card", nc["name"]) if existing else frappe.new_doc("Number Card")
		doc.name = nc["name"]
		doc.label = nc["label"]
		doc.type = "Document Type"
		doc.function = nc["function"]
		doc.document_type = nc["document_type"]
		if "aggregate_function_based_on" in nc:
			doc.aggregate_function_based_on = nc["aggregate_function_based_on"]
		doc.module = MODULE_NAME
		doc.is_standard = 1
		doc.is_public = nc.get("is_public", 1)
		doc.show_percentage_stats = nc.get("show_percentage_stats", 0)
		doc.stats_time_interval = nc.get("stats_time_interval", "Daily")
		doc.color = nc.get("color")
		doc.filters_json = nc.get("filters_json", "[]")

		dev_mode = frappe.conf.get("developer_mode")
		try:
			frappe.conf.developer_mode = 0
			if existing:
				doc.save(ignore_permissions=True)
			else:
				doc.insert(ignore_permissions=True)
		finally:
			frappe.conf.developer_mode = dev_mode

	# Dashboard Charts
	charts = [
		{
			"name": "OmniTrack Work Blocks Trend",
			"chart_name": "OmniTrack Work Blocks Trend",
			"chart_type": "Count",
			"document_type": "Planned Work Block",
			"based_on": "work_date",
			"timeseries": 1,
			"timespan": "Last Month",
			"time_interval": "Daily",
			"type": "Bar",
			"color": "#4285F4",
			"is_public": 1,
			"filters_json": "[]"
		},
		{
			"name": "OmniTrack Work Nature Distribution",
			"chart_name": "OmniTrack Work Nature Distribution",
			"chart_type": "Group By",
			"document_type": "Planned Work Block",
			"group_by_based_on": "task_nature",
			"group_by_type": "Count",
			"type": "Donut",
			"color": "#34A853",
			"is_public": 1,
			"filters_json": "[]"
		}
	]

	for ch in charts:
		if not frappe.db.exists("DocType", ch["document_type"]):
			continue
		existing = frappe.db.exists("Dashboard Chart", ch["name"])
		doc = frappe.get_doc("Dashboard Chart", ch["name"]) if existing else frappe.new_doc("Dashboard Chart")
		doc.name = ch["name"]
		doc.chart_name = ch["chart_name"]
		doc.chart_type = ch["chart_type"]
		doc.document_type = ch["document_type"]
		doc.module = MODULE_NAME
		doc.is_standard = 1
		doc.is_public = ch.get("is_public", 1)
		doc.type = ch.get("type", "Line")
		doc.color = ch.get("color")
		doc.filters_json = ch.get("filters_json", "[]")
		if ch["chart_type"] == "Group By":
			doc.group_by_based_on = ch["group_by_based_on"]
			doc.group_by_type = ch["group_by_type"]
		else:
			doc.based_on = ch["based_on"]
			doc.timeseries = ch["timeseries"]
			doc.timespan = ch["timespan"]
			doc.time_interval = ch["time_interval"]

		dev_mode = frappe.conf.get("developer_mode")
		flags_migrate = getattr(frappe.flags, "in_migrate", False)
		try:
			frappe.conf.developer_mode = 1
			frappe.flags.in_migrate = True
			if existing:
				doc.save(ignore_permissions=True)
			else:
				doc.insert(ignore_permissions=True)
		finally:
			frappe.conf.developer_mode = dev_mode
			frappe.flags.in_migrate = flags_migrate

	frappe.db.commit()

def _ensure_workspaces():
	workspaces_data = [
		{
			"name": "OmniTrack",
			"label": "OmniTrack",
			"title": "OmniTrack",
			"icon": "shield-check",
			"indicator_color": "blue",
			"number_cards": [
				{"number_card_name": "Total Work Blocks", "label": "Total Work Blocks"},
				{"number_card_name": "Total Tracked Hours", "label": "Total Tracked Hours"},
				{"number_card_name": "Active Shift Assignments", "label": "Active Shift Assignments"},
				{"number_card_name": "Attendance Syntheses", "label": "Attendance Syntheses"}
			],
			"charts": [
				{"chart_name": "OmniTrack Work Blocks Trend", "label": "Planned Work Blocks Trend"},
				{"chart_name": "OmniTrack Work Nature Distribution", "label": "Work Nature Distribution"}
			],
			"shortcuts": [
				{"label": "PWA Workstation", "type": "URL", "url": "/omnitrack", "color": "Cyan"},
				{"label": "Planned Work Blocks", "type": "DocType", "link_to": "Planned Work Block", "color": "Green"},
				{"label": "Employee Checkins", "type": "DocType", "link_to": "Employee Checkin", "color": "Blue"},
				{"label": "Attendance Records", "type": "DocType", "link_to": "Attendance", "color": "Purple"},
				{"label": "Shift Templates", "type": "DocType", "link_to": "OmniTrack Shift Template", "color": "Yellow"},
				{"label": "Shift Split Assignments", "type": "DocType", "link_to": "OmniTrack Shift Split Assignment", "color": "Orange"},
				{"label": "Attendance Synthesizer Logs", "type": "DocType", "link_to": "OmniTrack Attendance Synthesizer Log", "color": "Red"},
				{"label": "OmniTrack Settings", "type": "DocType", "link_to": "OmniTrack Settings", "color": "Grey"}
			],
			"quick_lists": [
				{
					"label": "Recent Planned Work Blocks",
					"document_type": "Planned Work Block",
					"quick_list_filter": "[]"
				}
			],
			"cards": [
				{
					"label": "Workforce & Shifts",
					"links": [
						{"label": "Planned Work Blocks", "link_to": "Planned Work Block"},
						{"label": "Employee Checkins", "link_to": "Employee Checkin"},
						{"label": "Attendance Records", "link_to": "Attendance"},
						{"label": "Shift Templates", "link_to": "OmniTrack Shift Template"},
						{"label": "Shift Split Assignments", "link_to": "OmniTrack Shift Split Assignment"},
						{"label": "Attendance Synthesizer Logs", "link_to": "OmniTrack Attendance Synthesizer Log"}
					]
				},
				{
					"label": "Projects & Tasks",
					"links": [
						{"label": "Projects", "link_to": "Project"},
						{"label": "Tasks", "link_to": "Task"}
					]
				},
				{
					"label": "Sync & Integrations",
					"links": [
						{"label": "Task Sync Payloads", "link_to": "OmniTrack Task Sync"},
						{"label": "Remote Connections", "link_to": "OmniTrack Remote Connection"},
						{"label": "Client Workspaces", "link_to": "OmniTrack Workspace"},
						{"label": "Push Subscriptions", "link_to": "OmniTrack Push Subscription"}
					]
				}
			]
		}
	]

	for ws in workspaces_data:
		content = [
			{"id": "hdr_kpi", "type": "header", "data": {"text": "<span class=\"h4\">Operational KPIs & Metrics</span>", "col": 12}}
		]
		for i, nc in enumerate(ws.get("number_cards", [])):
			content.append({
				"id": f"nc_{i+1}",
				"type": "number_card",
				"data": {"number_card_name": nc["number_card_name"], "col": 3}
			})

		content.append({"id": "sp_1", "type": "spacer", "data": {"col": 12}})
		content.append({"id": "hdr_charts", "type": "header", "data": {"text": "<span class=\"h4\">Workforce Trends & Analytics</span>", "col": 12}})
		for i, ch in enumerate(ws.get("charts", [])):
			content.append({
				"id": f"ch_{i+1}",
				"type": "chart",
				"data": {"chart_name": ch["label"], "col": 6}
			})

		content.append({"id": "sp_2", "type": "spacer", "data": {"col": 12}})
		content.append({"id": "hdr_actions", "type": "header", "data": {"text": "<span class=\"h4\">Quick Launch & Workstations</span>", "col": 12}})
		for i, sc in enumerate(ws["shortcuts"]):
			sc_data = {
				"shortcut_name": sc["label"],
				"label": sc["label"],
				"type": sc["type"],
				"color": sc.get("color", "Blue"),
				"col": 3
			}
			if sc["type"] == "URL":
				sc_data["url"] = sc.get("url")
			else:
				sc_data["link_to"] = sc.get("link_to")
			content.append({
				"id": f"sc_{i+1}",
				"type": "shortcut",
				"data": sc_data
			})

		if ws.get("quick_lists"):
			content.append({"id": "sp_3", "type": "spacer", "data": {"col": 12}})
			content.append({"id": "hdr_ql", "type": "header", "data": {"text": "<span class=\"h4\">Today's Work Blocks</span>", "col": 12}})
			for i, ql in enumerate(ws["quick_lists"]):
				content.append({
					"id": f"ql_{i+1}",
					"type": "quick_list",
					"data": {
						"quick_list_name": ql["label"],
						"document_type": ql["document_type"],
						"col": 12
					}
				})

		content.append({"id": "sp_4", "type": "spacer", "data": {"col": 12}})
		content.append({"id": "hdr_nav", "type": "header", "data": {"text": "<span class=\"h4\">Module Navigation</span>", "col": 12}})
		for i, c in enumerate(ws["cards"]):
			valid_links = [l for l in c["links"] if frappe.db.exists("DocType", l["link_to"])]
			if valid_links:
				content.append({
					"id": f"card_{i+1}",
					"type": "card",
					"data": {
						"card_name": c["label"],
						"label": c["label"],
						"col": 4,
						"links": [{"type": "Link", "link_to": l["link_to"], "label": l["label"]} for l in valid_links]
					}
				})

		existing = frappe.db.exists("Workspace", ws["name"])
		doc = frappe.get_doc("Workspace", ws["name"]) if existing else frappe.new_doc("Workspace")
		doc.name = ws["name"]
		doc.label = ws["label"]
		doc.title = ws["title"]
		doc.icon = ws["icon"]
		doc.indicator_color = ws["indicator_color"]
		doc.module = MODULE_NAME
		doc.public = 1
		doc.is_hidden = 0
		doc.content = json.dumps(content)

		# Sync child tables
		doc.set("number_cards", [])
		for nc in ws.get("number_cards", []):
			if frappe.db.exists("Number Card", nc["number_card_name"]):
				doc.append("number_cards", {
					"number_card_name": nc["number_card_name"],
					"label": nc["label"]
				})

		doc.set("charts", [])
		for ch in ws.get("charts", []):
			if frappe.db.exists("Dashboard Chart", ch["chart_name"]):
				doc.append("charts", {
					"chart_name": ch["chart_name"],
					"label": ch["label"]
				})

		doc.set("shortcuts", [])
		for sc in ws["shortcuts"]:
			sc_doc = {
				"label": sc["label"],
				"type": sc["type"],
				"color": sc.get("color", "Blue")
			}
			if sc["type"] == "URL":
				sc_doc["url"] = sc.get("url")
			else:
				if frappe.db.exists("DocType", sc.get("link_to")):
					sc_doc["link_to"] = sc.get("link_to")
				else:
					continue
			doc.append("shortcuts", sc_doc)

		doc.set("quick_lists", [])
		for ql in ws.get("quick_lists", []):
			if frappe.db.exists("DocType", ql["document_type"]):
				doc.append("quick_lists", {
					"label": ql["label"],
					"document_type": ql["document_type"],
					"quick_list_filter": ql.get("quick_list_filter", "[]")
				})

		doc.set("links", [])
		for c in ws["cards"]:
			valid_links = [l for l in c["links"] if frappe.db.exists("DocType", l["link_to"])]
			if not valid_links:
				continue
			doc.append("links", {
				"label": c["label"],
				"type": "Card Break"
			})
			for l in valid_links:
				doc.append("links", {
					"label": l["label"],
					"type": "Link",
					"link_type": "DocType",
					"link_to": l["link_to"]
				})

		dev_mode = frappe.conf.get("developer_mode")
		try:
			frappe.conf.developer_mode = 0
			if existing:
				doc.save(ignore_permissions=True)
			else:
				doc.insert(ignore_permissions=True)
		finally:
			frappe.conf.developer_mode = dev_mode

	frappe.db.commit()

def _ensure_workspace_sidebar():
	try:
		if not frappe.db.exists("DocType", "Workspace Sidebar"):
			return
		sidebar_name = "OmniTrack"
		existing = frappe.db.exists("Workspace Sidebar", {"name": sidebar_name, "for_user": None})
		doc = frappe.get_doc("Workspace Sidebar", sidebar_name) if existing else frappe.new_doc("Workspace Sidebar")
		doc.name = sidebar_name
		doc.title = sidebar_name
		doc.module = MODULE_NAME
		doc.header_icon = SIDEBAR_ICON
		doc.app = "omnitrack"
		doc.standard = 1
		doc.set("items", [])
		
		items = [
			{"type": "Section Break", "label": "Overview", "icon": "home", "indent": 1, "collapsible": 1},
			{"type": "Link", "label": "Dashboard", "link_type": "Workspace", "link_to": "OmniTrack", "icon": "layout-dashboard", "child": 1},
			{"type": "Link", "label": "PWA Workstation", "link_type": "URL", "url": "/omnitrack", "icon": "smartphone", "child": 1},
			{"type": "Section Break", "label": "Workforce & Shifts", "link_type": "DocType", "icon": "calendar", "indent": 1, "collapsible": 1},
			{"type": "Link", "label": "Planned Work Blocks", "link_type": "DocType", "link_to": "Planned Work Block", "icon": "calendar", "child": 1}
		]

		if frappe.db.exists("DocType", "Employee Checkin"):
			items.append({"type": "Link", "label": "Employee Checkins", "link_type": "DocType", "link_to": "Employee Checkin", "icon": "log-in", "child": 1})
		if frappe.db.exists("DocType", "Attendance"):
			items.append({"type": "Link", "label": "Attendance Records", "link_type": "DocType", "link_to": "Attendance", "icon": "calendar-check", "child": 1})

		items.extend([
			{"type": "Link", "label": "Shift Templates", "link_type": "DocType", "link_to": "OmniTrack Shift Template", "icon": "clock", "child": 1},
			{"type": "Link", "label": "Shift Split Assignments", "link_type": "DocType", "link_to": "OmniTrack Shift Split Assignment", "icon": "users", "child": 1},
			{"type": "Link", "label": "Attendance Synthesizer Logs", "link_type": "DocType", "link_to": "OmniTrack Attendance Synthesizer Log", "icon": "check-circle", "child": 1},
			{"type": "Section Break", "label": "Administration & Settings", "link_type": "DocType", "icon": "settings", "indent": 1, "collapsible": 1},
			{"type": "Link", "label": "OmniTrack Settings", "link_type": "DocType", "link_to": "OmniTrack Settings", "icon": "settings", "child": 1},
			{"type": "Link", "label": "Project Policies", "link_type": "DocType", "link_to": "OmniTrack Project Policy", "icon": "shield", "child": 1},
			{"type": "Section Break", "label": "Sync & Integrations", "link_type": "DocType", "icon": "repeat", "indent": 1, "collapsible": 1},
			{"type": "Link", "label": "Task Sync Payloads", "link_type": "DocType", "link_to": "OmniTrack Task Sync", "icon": "repeat", "child": 1},
			{"type": "Link", "label": "Remote Connections", "link_type": "DocType", "link_to": "OmniTrack Remote Connection", "icon": "link", "child": 1},
			{"type": "Link", "label": "Client Workspaces", "link_type": "DocType", "link_to": "OmniTrack Workspace", "icon": "globe", "child": 1},
			{"type": "Link", "label": "Push Subscriptions", "link_type": "DocType", "link_to": "OmniTrack Push Subscription", "icon": "bell", "child": 1}
		])

		for it in items:
			doc.append("items", it)

		dev_mode = frappe.conf.get("developer_mode")
		try:
			frappe.conf.developer_mode = 0
			if existing:
				doc.save(ignore_permissions=True)
			else:
				doc.insert(ignore_permissions=True)
		finally:
			frappe.conf.developer_mode = dev_mode
		frappe.db.commit()
	except Exception:
		frappe.log_error(title="OmniTrack: could not set up workspace sidebar")

def _ensure_desktop_icon():
	try:
		if not frappe.db.exists("DocType", "Desktop Icon"):
			return
		logo = "/assets/omnitrack/icons/desktop_icons/solid/omnitrack.svg?v=shiva_eye_v1"
		icon_name = "OmniTrack"
		existing = frappe.db.exists("Desktop Icon", icon_name)
		doc = frappe.get_doc("Desktop Icon", icon_name) if existing else frappe.new_doc("Desktop Icon")
		doc.name = icon_name
		doc.label = "OmniTrack"
		doc.icon_type = "Link"
		doc.link_type = "Workspace Sidebar"
		doc.link_to = "OmniTrack"
		doc.app = "omnitrack"
		doc.icon = "shield-check"
		doc.logo_url = logo
		doc.bg_color = "blue"
		doc.standard = 1
		doc.hidden = 0
		doc.restrict_removal = 0

		dev_mode = frappe.conf.get("developer_mode")
		try:
			frappe.conf.developer_mode = 0
			if existing:
				doc.save(ignore_permissions=True)
			else:
				doc.insert(ignore_permissions=True)
		finally:
			frappe.conf.developer_mode = dev_mode
		frappe.db.commit()
	except Exception:
		frappe.log_error(title="OmniTrack: could not set up desktop icon")