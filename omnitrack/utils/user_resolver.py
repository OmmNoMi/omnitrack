# Copyright (c) 2026, OmmNoMi Automation LLP and contributors
# For license information, please see license.txt

import frappe
from frappe import _


def resolve_planner_user(employee=None):
	"""Resolves the target user and strictly enforces permission boundaries.

	Rules:
	1. If employee is not specified, defaults to the session user. If the session user
	   has no Employee record (e.g. an API/service account), falls back to the user's owner.
	2. If employee is specified:
	   - Resolves target via User ID, Employee ID, employee_name, or full_name.
	   - If target == session_user: Allowed.
	   - If target != session_user: Checks can_access_user_data(target, session_user).
	     If the session user can see/access the target, it is ALLOWED.
	     If the session user cannot access the target, raises frappe.PermissionError!
	"""
	from omnitrack.permissions import can_access_user_data

	session_user = frappe.session.user
	if not session_user or session_user == "Guest":
		frappe.throw(_("Authentication required."), frappe.PermissionError)

	# Default target if unspecified
	if not employee or employee in ("All", "me", session_user):
		target_user = session_user
		if frappe.db.exists("DocType", "Employee"):
			if not frappe.db.exists("Employee", {"user_id": target_user}):
				owner = frappe.db.get_value("User", target_user, "owner")
				if owner and owner not in ("Administrator", target_user) and frappe.db.exists("User", owner):
					if frappe.db.exists("Employee", {"user_id": owner}):
						target_user = owner
				# If user is a plus-addressed service account (e.g. user+tag@domain), resolve to base user
				elif "+" in target_user and "@" in target_user:
					local, domain = target_user.split("@", 1)
					base_local = local.split("+", 1)[0]
					base_user = f"{base_local}@{domain}"
					if frappe.db.exists("User", base_user) and frappe.db.exists("Employee", {"user_id": base_user}):
						target_user = base_user
		return target_user

	# If employee matches session user's full name, resolve directly to session_user
	session_fullname = (frappe.utils.get_fullname(session_user) or "").strip().lower()
	if session_fullname and str(employee).strip().lower() == session_fullname:
		return session_user

	# Resolve employee argument
	target_user = None
	if frappe.db.exists("User", employee):
		target_user = employee
	elif frappe.db.exists("DocType", "Employee"):
		target_user = (
			frappe.db.get_value("Employee", employee, "user_id")
			or frappe.db.get_value("Employee", {"employee_name": employee}, "user_id")
			or frappe.db.get_value("Employee", {"prefered_contact_email": employee}, "user_id")
		)
		if not target_user and frappe.db.exists("Employee", employee):
			target_user = employee

	if not target_user:
		target_user = frappe.db.get_value("User", {"full_name": employee}, "name")

	if not target_user:
		frappe.throw(_("Could not resolve employee or user '{0}'.").format(employee), frappe.DoesNotExistError)

	# Generic permission enforcement: Can session_user access target_user?
	if not can_access_user_data(target_user, session_user):
		frappe.throw(
			_("You do not have permission to view or manage timesheet data for {0}.").format(employee),
			frappe.PermissionError
		)

	return target_user
