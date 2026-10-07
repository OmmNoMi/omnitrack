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
	if bool(set(roles) & manager_roles):
		return True
	# If user is a plus-addressed service account (e.g. nomeshwer+antigravity@ommnomi.in), inherit base user's roles
	if user and "+" in user and "@" in user:
		base_user = f"{user.split('@')[0].split('+')[0]}@{user.split('@')[1]}"
		base_roles = frappe.get_roles(base_user)
		if bool(set(base_roles) & manager_roles):
			return True
	return False


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


def get_timesheet_modification_horizon_hours():
	"""Returns the configured horizon in hours for standard timesheet modifications (default: 48 hours)."""
	horizon_hours = 48
	try:
		if frappe.db.exists("DocType", "OmniTrack Settings"):
			meta = frappe.get_meta("OmniTrack Settings")
			if meta.has_field("timesheet_modification_horizon_hours"):
				val = frappe.db.get_single_value("OmniTrack Settings", "timesheet_modification_horizon_hours")
				if val is not None and val != "":
					val_int = int(val)
					if val_int > 0:
						horizon_hours = val_int
	except Exception:
		pass
	return horizon_hours


def get_past_block_lock_grace_hours():
	"""Returns the configured grace period in hours before past planned work blocks lock (default: 24 hours)."""
	grace_hours = 24
	try:
		if frappe.db.exists("DocType", "OmniTrack Settings"):
			meta = frappe.get_meta("OmniTrack Settings")
			if meta.has_field("past_block_lock_grace_hours"):
				val = frappe.db.get_single_value("OmniTrack Settings", "past_block_lock_grace_hours")
				if val is not None and val != "":
					val_int = int(val)
					if val_int > 0:
						grace_hours = val_int
	except Exception:
		pass
	return grace_hours


def is_submitted_timesheet_amendment_allowed():
	"""Returns True if auto-amendment of submitted timesheets is enabled (default: True)."""
	try:
		if frappe.db.exists("DocType", "OmniTrack Settings"):
			meta = frappe.get_meta("OmniTrack Settings")
			if meta.has_field("allow_submitted_timesheet_amendment"):
				val = frappe.db.get_single_value("OmniTrack Settings", "allow_submitted_timesheet_amendment")
				if val is not None and str(val).strip() != "":
					return int(val) == 1
	except Exception:
		pass
	return True


def is_session_deletion_allowed(user=None):
	"""Returns True if session deletion is permitted for the given user.
	Controlled by OmniTrack Settings > allow_session_deletion.
	Managers and Administrators are ALWAYS permitted to delete erroneous sessions.
	Standard users are blocked unless allow_session_deletion is explicitly checked.
	"""
	if not user:
		user = frappe.session.user
	if is_omnitrack_manager(user):
		return True
	try:
		if frappe.db.exists("DocType", "OmniTrack Settings"):
			meta = frappe.get_meta("OmniTrack Settings")
			if meta.has_field("allow_session_deletion"):
				val = frappe.db.get_single_value("OmniTrack Settings", "allow_session_deletion")
				if val is not None and str(val).strip() != "":
					return int(val) == 1
	except Exception:
		pass
	return False


def check_session_deletion_permission(user=None):
	"""Enforces that the user has permission to delete timesheet sessions.
	Because hours and billing data represent financial records, deletion is restricted
	to managers unless specifically enabled in OmniTrack Settings.
	"""
	if not user:
		user = frappe.session.user
	if not is_session_deletion_allowed(user):
		frappe.throw(
			_("Work session deletion is disabled for standard users to protect billing and payroll audit integrity. "
			  "Only an OmniTrack Manager or Administrator can delete logged work sessions, or enable deletion in OmniTrack Settings."),
			frappe.PermissionError
		)
	return True


def check_timesheet_date_permission(session_date, user=None):
	"""
	Rule: An OmniTrack User can only log or modify timesheets within the configured
	horizon in hours (OmniTrack Settings > timesheet_modification_horizon_hours).
	Default is 48 hours (2 days: today and yesterday). Configurable to 72h (3 days), 168h (1 week), etc.
	Dates before the horizon require an OmniTrack Manager or Administrator.
	"""
	if not user:
		user = frappe.session.user
	if is_omnitrack_manager(user):
		return True

	horizon_hours = get_timesheet_modification_horizon_hours()
	days_allowed = max(int(round(horizon_hours / 24.0)), 1)
	cutoff_date = getdate(add_days(nowdate(), -(days_allowed - 1)))
	target_date = getdate(session_date)
	if target_date < cutoff_date:
		horizon_desc = f"{horizon_hours} hours"
		if horizon_hours % 24 == 0:
			days = horizon_hours // 24
			horizon_desc += f" ({days} day{'s' if days > 1 else ''})"
		frappe.throw(
			_("OmniTrack Users can only log or modify timesheets within the active {0} horizon. Contact an OmniTrack Manager for historical changes.").format(horizon_desc),
			frappe.PermissionError
		)
	return True


def check_approved_block_lock(doc, user=None):
	"""
	Rule: Once a Planned Work Block has been approved (approval_status == 'Approved'),
	standard users cannot modify its sessions, deliverable notes, or delete it.
	Only an OmniTrack Manager or Administrator can alter an approved block.
	"""
	if not user:
		user = frappe.session.user
	if is_omnitrack_manager(user):
		return True

	if doc and getattr(doc, "approval_status", None) == "Approved":
		frappe.throw(
			_("Approved work blocks are permanently locked against modifications. Contact an OmniTrack Manager for review."),
			frappe.PermissionError
		)
	return True


def check_planned_block_past_lock(doc, new_work_date=None):
	"""
	Rule: Work blocks older than the configured Past Lock Grace Period (Hours)
	cannot be modified, rescheduled, or moved. Historical planning commitments are immutable.
	Default grace period is 24 hours. Accommodates late-night shifts and midnight crossing.
	"""
	grace_hours = get_past_block_lock_grace_hours()
	from frappe.utils import now_datetime, get_datetime, time_diff_in_hours
	now_dt = now_datetime()

	if doc and doc.get("work_date"):
		end_t = doc.get("end_time") or "23:59:59"
		try:
			block_dt = get_datetime(f"{doc.get('work_date')} {end_t}")
		except Exception:
			block_dt = get_datetime(f"{doc.get('work_date')} 23:59:59")
		diff = time_diff_in_hours(now_dt, block_dt)
		if diff > grace_hours:
			grace_desc = f"{grace_hours} hours"
			if grace_hours % 24 == 0:
				days = grace_hours // 24
				grace_desc += f" ({days} day{'s' if days > 1 else ''})"
			frappe.throw(
				_("Planned work blocks older than the {0} grace period cannot be modified or rescheduled.").format(grace_desc),
				frappe.ValidationError
			)

	if new_work_date:
		new_dt = get_datetime(f"{new_work_date} 23:59:59")
		diff = time_diff_in_hours(now_dt, new_dt)
		if diff > grace_hours:
			frappe.throw(
				_("Cannot reschedule or move a planned work block older than the grace period into the past."),
				frappe.ValidationError
			)
	return True


def validate_timesheet_permission(doc, method=None):
	"""DocEvent validation for standard Timesheet: users can only save logs within the configured horizon."""
	user = frappe.session.user
	if is_omnitrack_manager(user):
		return
	if getattr(doc.flags, "ignore_permissions", False):
		return

	horizon_hours = get_timesheet_modification_horizon_hours()
	days_allowed = max(int(round(horizon_hours / 24.0)), 1)
	cutoff_date = getdate(add_days(nowdate(), -(days_allowed - 1)))
	horizon_desc = f"{horizon_hours} hours"
	if horizon_hours % 24 == 0:
		days = horizon_hours // 24
		horizon_desc += f" ({days} day{'s' if days > 1 else ''})"

	# Check child time_logs if present
	if hasattr(doc, "time_logs") and doc.time_logs:
		for row in doc.time_logs:
			t_date = getdate(row.from_time or row.to_time or doc.get("start_date") or nowdate())
			if t_date < cutoff_date:
				frappe.throw(
					_("OmniTrack Users can only log or modify timesheets within the active {0} horizon. Contact an OmniTrack Manager for historical changes.").format(horizon_desc),
					frappe.PermissionError
				)
	elif doc.get("start_date") and getdate(doc.get("start_date")) < cutoff_date:
		frappe.throw(
			_("OmniTrack Users can only log or modify timesheets within the active {0} horizon. Contact an OmniTrack Manager for historical changes.").format(horizon_desc),
			frappe.PermissionError
		)


def validate_timesheet_trash_event(doc, method=None):
	"""DocEvent validation on deleting a Timesheet."""
	user = frappe.session.user
	if is_omnitrack_manager(user):
		return
	if getattr(doc.flags, "ignore_permissions", False):
		return

	horizon_hours = get_timesheet_modification_horizon_hours()
	days_allowed = max(int(round(horizon_hours / 24.0)), 1)
	cutoff_date = getdate(add_days(nowdate(), -(days_allowed - 1)))
	horizon_desc = f"{horizon_hours} hours"
	if horizon_hours % 24 == 0:
		days = horizon_hours // 24
		horizon_desc += f" ({days} day{'s' if days > 1 else ''})"

	if hasattr(doc, "time_logs") and doc.time_logs:
		for row in doc.time_logs:
			t_date = getdate(row.from_time or row.to_time or doc.get("start_date") or nowdate())
			if t_date < cutoff_date:
				frappe.throw(
					_("OmniTrack Users can only delete timesheets within the active {0} horizon. Contact an OmniTrack Manager for historical deletions.").format(horizon_desc),
					frappe.PermissionError
				)
	elif doc.get("start_date") and getdate(doc.get("start_date")) < cutoff_date:
		frappe.throw(
			_("OmniTrack Users can only delete timesheets within the active {0} horizon. Contact an OmniTrack Manager for historical deletions.").format(horizon_desc),
			frappe.PermissionError
		)


CLIENT_ROLES = {"OmniTrack Client", "Customer"}


def is_project_client(user=None):
	"""A client user: sees the projects shared with them, never the team's internals."""
	user = user or frappe.session.user
	return bool(CLIENT_ROLES & set(frappe.get_roles(user))) and not is_omnitrack_manager(user)


def _assigned_like(user):
	"""LIKE pattern for a user id inside a JSON `_assign` list, with `%` and `_` escaped."""
	quoted = '"' + user.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + '"'
	return "%" + quoted + "%"


def projects_for(user=None, include_assigned=True):
	"""Which Projects this person may see. None means every project (managers).

	The one answer used by the Projects page, the block permission query and the
	workstation feed:
	- the project's owner, and anyone in its Project User table (team and client users alike);
	- with include_assigned, anyone assigned a Task in it;
	- a client, through a Contact on the project's Customer.
	No ERPNext Project means no project to see, never every block that names one.
	"""
	user = user or frappe.session.user
	if not user or user == "Guest":
		return []
	if is_omnitrack_manager(user):
		return None
	if not frappe.db.exists("DocType", "Project"):
		return []
	names = set(frappe.db.sql_list("SELECT name FROM `tabProject` WHERE owner = %s", user))
	names.update(frappe.db.sql_list(
		"SELECT parent FROM `tabProject User` WHERE user = %s AND parenttype = 'Project'", user))
	if include_assigned and frappe.db.exists("DocType", "Task"):
		names.update(frappe.db.sql_list(
			"SELECT DISTINCT project FROM `tabTask` WHERE IFNULL(project, '') != '' AND _assign LIKE %s",
			_assigned_like(user)))
	if is_project_client(user) and frappe.db.exists("DocType", "Contact"):
		names.update(frappe.db.sql_list("""
			SELECT p.name FROM `tabProject` p
			JOIN `tabDynamic Link` dl ON dl.link_name = p.customer AND dl.link_doctype = 'Customer' AND dl.parenttype = 'Contact'
			JOIN `tabContact` c ON c.name = dl.parent
			WHERE c.user = %s""", user))
	return sorted(names)


def _client_deliverables(doctype):
	"""Clients see only rows marked as a public deliverable; deny when the field does not exist."""
	if frappe.db.has_column(doctype, "custom_is_public_deliverable"):
		return f"(`tab{doctype}`.`custom_is_public_deliverable` = 1)"
	return "1=0"


def client_visible_people():
	"""Whose work a client may see: the people an OmniTrack User Entitlement row marks
	visible_to_clients, by user or by role, with their Employee ids where HR is installed.

	Nobody until the owner says so, and nobody before the field is migrated in.
	"""
	if not frappe.db.has_column("OmniTrack User Entitlement", "visible_to_clients"):
		return set()
	rows = frappe.db.sql(
		"SELECT user, role FROM `tabOmniTrack User Entitlement` WHERE visible_to_clients = 1", as_dict=True)
	people = {r.user for r in rows if r.user}
	roles = tuple({r.role for r in rows if r.role})
	if roles:
		people.update(frappe.db.sql_list(
			"SELECT DISTINCT parent FROM `tabHas Role` WHERE parenttype = 'User' AND role IN %s", (roles,)))
	if people and frappe.db.exists("DocType", "Employee"):
		people.update(frappe.db.sql_list(
			"SELECT name FROM `tabEmployee` WHERE user_id IN %s", (tuple(people),)))
	return people


def _shared_tasks_sql():
	"""Tasks a client may see, as a subquery. No Task DocType or no shared flag: none."""
	if frappe.db.exists("DocType", "Task") and frappe.db.has_column("Task", "custom_is_public_deliverable"):
		return "SELECT name FROM `tabTask` WHERE custom_is_public_deliverable = 1"
	return None


def client_block_condition(user):
	"""What a client sees of a project's plan, as SQL on `tabPlanned Work Block`.

	A block on a project shared with them, by a person visible to clients, and, when the
	block names a task, only a task shared as a deliverable. Anything else stays hidden.
	"""
	projects = projects_for(user, include_assigned=False) or []
	people = client_visible_people()
	if not projects or not people:
		return "1=0"
	t = "`tabPlanned Work Block`"
	listed = ", ".join(frappe.db.escape(p) for p in projects)
	persons = ", ".join(frappe.db.escape(p) for p in sorted(people))
	shared = _shared_tasks_sql()
	task_ok = f"IFNULL({t}.`task`, '') = ''" + (f" OR {t}.`task` IN ({shared})" if shared else "")
	return f"({t}.`project` IN ({listed}) AND {t}.`employee` IN ({persons}) AND ({task_ok}))"  # nosec B608


def client_may_see_block(doc, user):
	"""The same rule as client_block_condition, for one block."""
	if not doc.get("project") or doc.get("project") not in (projects_for(user, include_assigned=False) or []):
		return False
	if doc.get("employee") not in client_visible_people():
		return False
	if not doc.get("task"):
		return True
	return bool(_shared_tasks_sql()) and bool(frappe.db.get_value("Task", doc.get("task"), "custom_is_public_deliverable"))


def get_task_permission_query_conditions(user=None):
	if not user:
		user = frappe.session.user
	if is_omnitrack_manager(user):
		return ""

	roles = frappe.get_roles(user)
	if "OmniTrack Client" in roles:
		return _client_deliverables("Task")

	if "OmniTrack User" in roles:
		esc_user = frappe.db.escape(user)
		return f"(`tabTask`._assign LIKE {frappe.db.escape(_assigned_like(user))} OR `tabTask`.owner = {esc_user})"

	return ""


def get_todo_permission_query_conditions(user=None):
	if not user:
		user = frappe.session.user
	if is_omnitrack_manager(user):
		return ""

	roles = frappe.get_roles(user)
	if "OmniTrack Client" in roles:
		return _client_deliverables("ToDo")

	if "OmniTrack User" in roles:
		esc_user = frappe.db.escape(user)
		return f"(`tabToDo`.allocated_to = {esc_user} OR `tabToDo`.owner = {esc_user})"

	return ""


def get_work_block_permission_query_conditions(user=None):
	if not user:
		user = frappe.session.user
	if is_omnitrack_manager(user) or "OmniTrack Auditor" in frappe.get_roles(user):
		return ""
	
	esc_user = frappe.db.escape(user)
	conditions = [f"(`tabPlanned Work Block`.`employee` = {esc_user} OR `tabPlanned Work Block`.owner = {esc_user})"]

	# A client sees only the people and tasks shared with clients
	if is_project_client(user):
		conditions.append(client_block_condition(user))
		return " OR ".join(conditions)

	# Project members see the project's plan. Being assigned one task is not
	# membership here: it does not open everyone's blocks on that project.
	projects = projects_for(user, include_assigned=False)
	if projects:
		listed = ", ".join(frappe.db.escape(p) for p in projects)
		conditions.append(f"`tabPlanned Work Block`.`project` IN ({listed})")  # nosec B608

	return " OR ".join(conditions)


def has_work_block_permission(doc, ptype="read", user=None):
	if not user:
		user = frappe.session.user
	if is_omnitrack_manager(user) or "OmniTrack Auditor" in frappe.get_roles(user):
		return True
	
	if doc.employee == user or doc.owner == user:
		return True

	# Same rule as the list query
	if is_project_client(user):
		return client_may_see_block(doc, user)
	return bool(doc.project) and doc.project in (projects_for(user, include_assigned=False) or [])
