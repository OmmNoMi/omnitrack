import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

def setup_custom_fields():
	"""Creates standard custom fields on Frappe/ERPNext Project and Task for legacy data compatibility."""
	custom_fields = {
		"Project": [
			{
				"fieldname": "custom_appsheet_id",
				"fieldtype": "Data",
				"label": "Legacy AppSheet ID",
				"insert_after": "project_name",
				"read_only": 0
			},
			{
				"fieldname": "custom_legacy_code",
				"fieldtype": "Data",
				"label": "Legacy Project Code",
				"insert_after": "custom_appsheet_id"
			},
			{
				"fieldname": "custom_subtitle",
				"fieldtype": "Data",
				"label": "SubTitle",
				"insert_after": "custom_legacy_code"
			}
		],
		"Task": [
			{
				"fieldname": "custom_appsheet_id",
				"fieldtype": "Data",
				"label": "Legacy AppSheet ID",
				"insert_after": "subject",
				"read_only": 0
			},
			{
				"fieldname": "custom_activity_code",
				"fieldtype": "Data",
				"label": "Legacy Activity Code",
				"insert_after": "custom_appsheet_id"
			},
			{
				"fieldname": "custom_phase",
				"fieldtype": "Link",
				"options": "OmniTrack Phase",
				"label": "OmniTrack Phase",
				"insert_after": "project"
			},
			{
				"fieldname": "custom_remarks",
				"fieldtype": "Small Text",
				"label": "Legacy Remarks",
				"insert_after": "description"
			},
			{
				"fieldname": "custom_note",
				"fieldtype": "Small Text",
				"label": "Legacy Note",
				"insert_after": "custom_remarks"
			}
		]
	}

	create_custom_fields(custom_fields, ignore_validate=True)
