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
	_ensure_workspaces()
	_ensure_workspace_sidebar()
	_ensure_desktop_icon()

def after_migrate():
	_ensure_roles()
	_ensure_custom_fields()
	_ensure_default_settings()
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

def _ensure_workspaces():
	workspaces_data = [
		{
			"name": "OmniTrack",
			"label": "OmniTrack",
			"title": "OmniTrack",
			"icon": "shield-check",
			"indicator_color": "blue",
			"shortcuts": [
				{"label": "OmniTrack Settings", "type": "DocType", "link_to": "OmniTrack Settings", "color": "Blue"},
				{"label": "Planned Work Blocks", "type": "DocType", "link_to": "Planned Work Block", "color": "Green"},
				{"label": "Shift Templates", "type": "DocType", "link_to": "OmniTrack Shift Template", "color": "Purple"},
				{"label": "Shift Split Assignments", "type": "DocType", "link_to": "OmniTrack Shift Split Assignment", "color": "Yellow"},
				{"label": "Synthesizer Logs", "type": "DocType", "link_to": "OmniTrack Attendance Synthesizer Log", "color": "Orange"}
			],
			"cards": [
				{
					"label": "Workforce & Shifts",
					"links": [
						{"label": "Planned Work Blocks", "link_to": "Planned Work Block"},
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
					"label": "Live Sync & Integrations",
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
			{"type": "header", "data": {"text": ws["title"], "level": 4}}
		]
		for sc in ws["shortcuts"]:
			content.append({
				"type": "shortcut",
				"data": {
					"shortcut_name": sc["label"],
					"label": sc["label"],
					"type": sc["type"],
					"link_to": sc["link_to"],
					"color": sc.get("color", "Blue")
				}
			})
		for c in ws["cards"]:
			content.append({
				"type": "card",
				"data": {
					"card_name": c["label"],
					"label": c["label"],
					"links": [{"type": "Link", "link_to": l["link_to"], "label": l["label"]} for l in c["links"]]
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
		doc.set("shortcuts", [])
		for sc in ws["shortcuts"]:
			doc.append("shortcuts", {
				"label": sc["label"],
				"link_to": sc["link_to"],
				"type": sc["type"],
				"color": sc.get("color", "Blue")
			})
		doc.set("links", [])
		for c in ws["cards"]:
			doc.append("links", {
				"label": c["label"],
				"type": "Card Break"
			})
			for l in c["links"]:
				if frappe.db.exists("DocType", l["link_to"]):
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
		doc.set("items", [])
		
		items = [
			{"type": "Section Break", "label": "Workforce & Shifts", "link_type": "DocType", "icon": "calendar", "indent": 1, "collapsible": 1},
			{"type": "Link", "label": "Planned Work Blocks", "link_type": "DocType", "link_to": "Planned Work Block", "icon": "calendar", "child": 1},
			{"type": "Link", "label": "Shift Templates", "link_type": "DocType", "link_to": "OmniTrack Shift Template", "icon": "clock", "child": 1},
			{"type": "Link", "label": "Shift Split Assignments", "link_type": "DocType", "link_to": "OmniTrack Shift Split Assignment", "icon": "users", "child": 1},
			{"type": "Link", "label": "Attendance Synthesizer Logs", "link_type": "DocType", "link_to": "OmniTrack Attendance Synthesizer Log", "icon": "check-circle", "child": 1},
			{"type": "Section Break", "label": "Administration & Settings", "link_type": "DocType", "icon": "settings", "indent": 1, "collapsible": 1},
			{"type": "Link", "label": "OmniTrack Settings", "link_type": "DocType", "link_to": "OmniTrack Settings", "icon": "settings", "child": 1},
			{"type": "Section Break", "label": "Sync & Integrations", "link_type": "DocType", "icon": "repeat", "indent": 1, "collapsible": 1},
			{"type": "Link", "label": "Task Sync Payloads", "link_type": "DocType", "link_to": "OmniTrack Task Sync", "icon": "repeat", "child": 1},
			{"type": "Link", "label": "Remote Connections", "link_type": "DocType", "link_to": "OmniTrack Remote Connection", "icon": "link", "child": 1},
			{"type": "Link", "label": "Client Workspaces", "link_type": "DocType", "link_to": "OmniTrack Workspace", "icon": "globe", "child": 1}
		]
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