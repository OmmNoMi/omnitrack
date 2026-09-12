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
	
	roles = frappe.get_roles(user)
	conditions = [f"(`tabPlanned Work Block`.`employee` = '{user}' OR `tabPlanned Work Block`.owner = '{user}')"]

	# 1. Project Team Members & Project Managers
	if frappe.db.exists("DocType", "Project"):
		if frappe.db.exists("DocType", "Project User"):
			conditions.append(f"""`tabPlanned Work Block`.`project` IN (
				SELECT parent FROM `tabProject User` WHERE `user` = '{user}'
				UNION
				SELECT name FROM `tabProject` WHERE `owner` = '{user}'
			)""")
		else:
			conditions.append(f"`tabPlanned Work Block`.`project` IN (SELECT name FROM `tabProject` WHERE `owner` = '{user}')")

	# 2. Client Visibility (Project Customer)
	if ("OmniTrack Client" in roles or "Customer" in roles) and frappe.db.exists("DocType", "Project"):
		cust_conditions = []
		if frappe.db.exists("DocType", "Contact") and frappe.db.exists("DocType", "Dynamic Link"):
			cust_conditions.append(f"""`tabPlanned Work Block`.`project` IN (
				SELECT p.name FROM `tabProject` p
				JOIN `tabDynamic Link` dl ON dl.link_name = p.customer AND dl.link_doctype = 'Customer'
				JOIN `tabContact` c ON c.name = dl.parent
				WHERE c.user = '{user}'
			)""")
		cust_conditions.append(f"`tabPlanned Work Block`.`project` IN (SELECT name FROM `tabProject` WHERE `customer` = '{user}')")
		conditions.extend(cust_conditions)

	return " OR ".join(conditions)


def has_work_block_permission(doc, ptype="read", user=None):
	if not user:
		user = frappe.session.user
	if user == "Administrator" or "System Manager" in frappe.get_roles(user) or "OmniTrack Admin" in frappe.get_roles(user) or "OmniTrack Manager" in frappe.get_roles(user) or "OmniTrack Auditor" in frappe.get_roles(user):
		return True
	
	if doc.employee == user or doc.owner == user:
		return True

	roles = frappe.get_roles(user)

	# Project Team Member or Project Manager
	if doc.project and frappe.db.exists("DocType", "Project"):
		proj_owner = frappe.db.get_value("Project", doc.project, "owner")
		if proj_owner == user:
			return True
		if frappe.db.exists("DocType", "Project User"):
			if frappe.db.exists("Project User", {"parent": doc.project, "user": user}):
				return True

	# Client Visibility
	if doc.project and ("OmniTrack Client" in roles or "Customer" in roles):
		if frappe.db.exists("DocType", "Project"):
			proj_cust = frappe.db.get_value("Project", doc.project, "customer")
			if proj_cust == user:
				return True
			if frappe.db.exists("DocType", "Contact") and frappe.db.exists("DocType", "Dynamic Link"):
				is_contact = frappe.db.sql("""
					SELECT c.name FROM `tabContact` c
					JOIN `tabDynamic Link` dl ON dl.parent = c.name
					WHERE dl.link_doctype = 'Customer' AND dl.link_name = %s AND c.user = %s
				""", (proj_cust, user))
				if is_contact:
					return True

	return False
