app_logo_url = "/assets/omnitrack/icons/desktop_icons/solid/omnitrack.svg?v=shiva_eye_v1"
app_name = "omnitrack"
app_title = "OmniTrack"
app_publisher = "OmmNoMi Automation LLP"
app_description = "Universal Workforce, Task Sync & Split-Shift Engine"
app_email = "omnitrack@ommnomi.com"
app_license = "GNU General Public License v3.0"

# Includes in <head>
# ------------------
app_include_js = "/assets/omnitrack/js/omnitrack.bundle.js"
app_include_css = "/assets/omnitrack/css/omnitrack.bundle.css"

# Installation Hooks
# ------------------
after_install = "omnitrack.install.after_install"
after_migrate = "omnitrack.install.after_migrate"

# Document Events
# ---------------
doc_events = {
	"Task": {
		"validate": "omnitrack.api.validate_task_variance",
		"on_update": "omnitrack.notifications.on_task_update",
		"on_trash": "omnitrack.sync.on_task_trash"
	},
	"ToDo": {
		"validate": "omnitrack.api.validate_task_variance",
		"on_update": "omnitrack.notifications.on_task_update",
		"on_trash": "omnitrack.sync.on_task_trash"
	},
	"Employee Checkin": {
		"after_insert": "omnitrack.synthesizer.on_checkin_event",
		"on_update": "omnitrack.synthesizer.on_checkin_event"
	}
}

# Permission Query Conditions
# ---------------------------
permission_query_conditions = {
	"Task": "omnitrack.permissions.get_task_permission_query_conditions",
	"ToDo": "omnitrack.permissions.get_todo_permission_query_conditions",
	"Planned Work Block": "omnitrack.permissions.get_work_block_permission_query_conditions"
}

# Scheduled Tasks
# ---------------
scheduler_events = {
	"daily": [
		"omnitrack.synthesizer.synthesize_all_active_employees",
		"omnitrack.api.process_scheduled_timesheet_sync"
	],
	"hourly": [
		"omnitrack.sync.process_queued_sync_events"
	]
}

commands = ["omnitrack.commands.commands"]
