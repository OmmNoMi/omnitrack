import frappe
from frappe import _
from frappe.utils import add_days, getdate, nowdate


def is_omnitrack_manager(user=None):
	"""Returns True if the user has elevated manager / admin privileges in OmniTrack."""
	if not user:
		user = frappe.session.user
	if user == "Administrator":
		return True
	roles = frappe.get_roles(user)
	manager_roles = {"System Manager", "HR Manager", "OmniTrack Manager", "OmniTrack Admin"}
	return bool(set(roles) & manager_roles)


def can_access_user_data(target_user, session_user=None):
	"""Generic permission check: Can session_user view/manage target_user's OmniTrack data?

	Rules:
	1. A user can ALWAYS access their own data.
	2. Administrator or users with manager roles (OmniTrack Manager/Admin, System Manager, HR Manager)
	   have access to all users they manage.
	3. Standard users can access any Employee they have Frappe read permissions for (e.g. User Permissions).
	4. A manager can access employees who report to them in the Employee hierarchy.
	5. Otherwise, access is denied.
	"""
	if not session_user:
		session_user = frappe.session.user
	if not session_user or session_user == "Guest":
		return False
	if session_user == "Administrator":
		return True

	# Self access
	if target_user == session_user:
		return True

	# Manager roles grant elevated cross-user access
	if is_omnitrack_manager(session_user):
		return True

	# Check Frappe Employee permissions
	if frappe.db.exists("DocType", "Employee"):
		target_emp = frappe.db.get_value("Employee", {"user_id": target_user}, "name")
		if not target_emp and frappe.db.exists("Employee", target_user):
			target_emp = target_user

		if target_emp:
			# Check native Frappe read permission on Employee (respects User Permissions)
			if frappe.has_permission("Employee", "read", target_emp, user=session_user):
				return True

			# Check organizational hierarchy (Reports To)
			session_emp = frappe.db.get_value("Employee", {"user_id": session_user}, "name")
			if session_emp and frappe.db.get_value("Employee", target_emp, "reports_to") == session_emp:
				return True

	# Check native Frappe read permission on User
	if frappe.db.exists("User", target_user) and frappe.has_permission("User", "read", target_user, user=session_user):
		return True

	return False


def check_timesheet_date_permission(session_date, user=None):
	"""
	Rule: An OmniTrack User can only log or modify timesheets for TODAY and YESTERDAY.
	Dates before yesterday require an OmniTrack Manager.
	"""
	if not user:
		user = frappe.session.user
	if is_omnitrack_manager(user):
		return True

	cutoff_date = getdate(add_days(nowdate(), -1))
	target_date = getdate(session_date)
	if target_date < cutoff_date:
		frappe.throw(
			_("OmniTrack Users can only log or modify timesheets for today and yesterday. Contact an OmniTrack Manager for historical changes."),
			frappe.PermissionError
		)
	return True


def check_planned_block_past_lock(doc, new_work_date=None):
	"""
	Rule: In the past (work_date < today), NO ONE (neither user nor manager) can
	modify, reschedule, or move planned work blocks. Historical planning commitments are immutable.
	"""
	today = getdate(nowdate())
	if doc and doc.get("work_date") and getdate(doc.get("work_date")) < today:
		frappe.throw(
			_("Planned work blocks in the past cannot be modified or rescheduled."),
			frappe.ValidationError
		)
	if new_work_date and getdate(new_work_date) < today:
		frappe.throw(
			_("Cannot reschedule or move a planned work block into the past."),
			frappe.ValidationError
		)
	return True


def validate_timesheet_permission(doc, method=None):
	"""DocEvent validation for standard Timesheet: users can only save logs for today & yesterday."""
	user = frappe.session.user
	if is_omnitrack_manager(user):
		return
	if getattr(doc.flags, "ignore_permissions", False):
		return

	cutoff_date = getdate(add_days(nowdate(), -1))
	# Check child time_logs if present
	if hasattr(doc, "time_logs") and doc.time_logs:
		for row in doc.time_logs:
			t_date = getdate(row.from_time or row.to_time or doc.get("start_date") or nowdate())
			if t_date < cutoff_date:
				frappe.throw(
					_("OmniTrack Users can only log or modify timesheets for today and yesterday. Contact an OmniTrack Manager for historical changes."),
					frappe.PermissionError
				)
	elif doc.get("start_date") and getdate(doc.get("start_date")) < cutoff_date:
		frappe.throw(
			_("OmniTrack Users can only log or modify timesheets for today and yesterday. Contact an OmniTrack Manager for historical changes."),
			frappe.PermissionError
		)


def validate_timesheet_trash_event(doc, method=None):
	"""DocEvent validation on deleting a Timesheet."""
	user = frappe.session.user
	if is_omnitrack_manager(user):
		return
	if getattr(doc.flags, "ignore_permissions", False):
		return

	cutoff_date = getdate(add_days(nowdate(), -1))
	if hasattr(doc, "time_logs") and doc.time_logs:
		for row in doc.time_logs:
			t_date = getdate(row.from_time or row.to_time or doc.get("start_date") or nowdate())
			if t_date < cutoff_date:
				frappe.throw(
					_("OmniTrack Users can only delete timesheets for today and yesterday. Contact an OmniTrack Manager for historical deletions."),
					frappe.PermissionError
				)


def get_task_permission_query_conditions(user=None):
	if not user:
		user = frappe.session.user
	if is_omnitrack_manager(user):
		return ""
	
	roles = frappe.get_roles(user)
	if "OmniTrack Client" in roles:
		return "(`tabTask`.`custom_is_public_deliverable` = 1)"
	
	if "OmniTrack User" in roles and not is_omnitrack_manager(user):
		return f"(`tabTask`._assign LIKE '%{user}%' OR `tabTask`.owner = '{user}')"
	
	return ""


def get_todo_permission_query_conditions(user=None):
	if not user:
		user = frappe.session.user
	if is_omnitrack_manager(user):
		return ""
	
	roles = frappe.get_roles(user)
	if "OmniTrack Client" in roles:
		return "(`tabToDo`.`custom_is_public_deliverable` = 1)"
	
	if "OmniTrack User" in roles and not is_omnitrack_manager(user):
		return f"(`tabToDo`.allocated_to = '{user}' OR `tabToDo`.owner = '{user}')"
	
	return ""


def get_work_block_permission_query_conditions(user=None):
	if not user:
		user = frappe.session.user
	if is_omnitrack_manager(user) or "OmniTrack Auditor" in frappe.get_roles(user):
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
	if ("OmniTrack Client" in roles or "Customer" in roles):
		if frappe.db.exists("DocType", "Project"):
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
		else:
			conditions.append("(`tabPlanned Work Block`.`project` IS NOT NULL AND `tabPlanned Work Block`.`project` != '')")

	return " OR ".join(conditions)


def has_work_block_permission(doc, ptype="read", user=None):
	if not user:
		user = frappe.session.user
	if is_omnitrack_manager(user) or "OmniTrack Auditor" in frappe.get_roles(user):
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
		else:
			return True

	return False
