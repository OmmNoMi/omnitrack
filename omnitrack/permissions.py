import frappe

def get_task_permission_query_conditions(user=None):
	if not user:
		user = frappe.session.user
	if user == "Administrator" or "System Manager" in frappe.get_roles(user) or "OmniTrack Admin" in frappe.get_roles(user):
		return ""
	
	roles = frappe.get_roles(user)
	if "OmniTrack Client" in roles:
		return "(`tabTask`.`custom_is_public_deliverable` = 1)"
	
	if "OmniTrack User" in roles and "OmniTrack Manager" not in roles:
		return f"(`tabTask`._assign LIKE '%{user}%' OR `tabTask`.owner = '{user}')"
	
	return ""

def get_todo_permission_query_conditions(user=None):
	if not user:
		user = frappe.session.user
	if user == "Administrator" or "System Manager" in frappe.get_roles(user) or "OmniTrack Admin" in frappe.get_roles(user):
		return ""
	
	roles = frappe.get_roles(user)
	if "OmniTrack Client" in roles:
		return "(`tabToDo`.`custom_is_public_deliverable` = 1)"
	
	if "OmniTrack User" in roles and "OmniTrack Manager" not in roles:
		return f"(`tabToDo`.allocated_to = '{user}' OR `tabToDo`.owner = '{user}')"
	
	return ""

def get_work_block_permission_query_conditions(user=None):
	if not user:
		user = frappe.session.user
	if user == "Administrator" or "System Manager" in frappe.get_roles(user) or "OmniTrack Admin" in frappe.get_roles(user) or "OmniTrack Manager" in frappe.get_roles(user) or "OmniTrack Auditor" in frappe.get_roles(user):
		return ""
	
	return f"(`tabPlanned Work Block`.`employee` = '{user}' OR `tabPlanned Work Block`.owner = '{user}')"
