import csv
import os
import hashlib
from datetime import datetime
import frappe
from frappe.utils import flt, getdate

CUTOFF_DATE = getdate("2024-09-02")
COMPANY_AFTER = "OmmNoMi Automation LLP"


def get_company_before():
	"""Get historical company name, supporting both 'Nomeshwer Sharma' and 'Nomeshwar Sharma'."""
	for name in ["Nomeshwer Sharma", "Nomeshwar Sharma"]:
		if frappe.db.exists("Company", name):
			return name
	matches = frappe.get_all("Company", filters={"company_name": ["like", "Nomesh%"]}, pluck="name")
	if matches:
		return matches[0]
	return "Nomeshwer Sharma"


@frappe.whitelist()
def verify_migration_prerequisites():
	"""Verify all DocTypes, custom fields, and companies required for historical migration."""
	results = {"status": "success", "checks": [], "errors": []}

	# Check DocTypes
	required_doctypes = ["Planned Work Block", "Project", "Task", "Company", "User"]
	for dt in required_doctypes:
		if frappe.db.exists("DocType", dt):
			results["checks"].append(f"DocType '{dt}' exists.")
		else:
			results["errors"].append(f"DocType '{dt}' missing!")

	# Check Custom Fields
	required_fields = {
		"Project": ["custom_appsheet_id", "custom_legacy_code"],
		"Task": ["custom_appsheet_id", "custom_activity_code", "custom_expected_hours", "custom_actual_hours", "custom_variance_hours"]
	}
	for dt, fields in required_fields.items():
		for f in fields:
			exists = frappe.db.exists("Custom Field", {"dt": dt, "fieldname": f})
			if exists:
				results["checks"].append(f"Custom Field '{f}' on '{dt}' exists.")
			else:
				results["errors"].append(f"Custom Field '{f}' on '{dt}' missing!")

	# Ensure Companies exist
	comp_before = get_company_before()
	for comp_name in [comp_before, COMPANY_AFTER]:
		if not frappe.db.exists("Company", comp_name):
			try:
				comp = frappe.new_doc("Company")
				comp.company_name = comp_name
				comp.abbr = "".join([w[0] for w in comp_name.split() if w])[:5].upper()
				comp.default_currency = "INR"
				comp.country = "India"
				comp.insert(ignore_permissions=True)
				results["checks"].append(f"Company '{comp_name}' created.")
			except Exception as e:
				results["errors"].append(f"Failed to create Company '{comp_name}': {str(e)}")
		else:
			results["checks"].append(f"Company '{comp_name}' already exists.")

	if results["errors"]:
		results["status"] = "failed"

	return results


def parse_appsheet_datetime(dt_str):
	"""Parse various AppSheet date/time string formats."""
	if not dt_str or not dt_str.strip():
		return None, None

	dt_str = dt_str.strip()
	formats = [
		"%m/%d/%Y %H:%M:%S",
		"%m/%d/%Y %I:%M:%S %p",
		"%m/%d/%Y %H:%M",
		"%m/%d/%Y %I:%M %p",
		"%Y-%m-%d %H:%M:%S",
		"%Y-%m-%d %H:%M",
		"%d/%m/%Y %H:%M:%S",
		"%d-%m-%Y %H:%M:%S"
	]

	for fmt in formats:
		try:
			dt = datetime.strptime(dt_str, fmt)
			return dt.date(), dt.time().strftime("%H:%M:%S")
		except ValueError:
			continue

	# Fallback if only date
	date_formats = ["%m/%d/%Y", "%Y-%m-%d", "%d/%m/%Y"]
	for dfmt in date_formats:
		try:
			dt = datetime.strptime(dt_str, dfmt)
			return dt.date(), "09:00:00"
		except ValueError:
			continue

	return None, None


def generate_migration_hash(employee, work_date, start_time, end_time, appsheet_id):
	"""Generate deterministic SHA-256 audit hash for historical work block."""
	raw = f"{employee}:{work_date}:{start_time}:{end_time}:{appsheet_id}"
	short_hash = hashlib.sha256(raw.encode()).hexdigest()[:8]
	return f"chk-{short_hash}"


def import_projects(project_csv_path, dry_run=False):
	"""Import historical projects from AppSheet Project CSV."""
	if not os.path.exists(project_csv_path):
		raise FileNotFoundError(f"Project CSV not found at: {project_csv_path}")

	mapping = {}
	count = 0
	with open(project_csv_path, mode="r", encoding="utf-8-sig") as f:
		reader = csv.DictReader(f)
		for row in reader:
			app_id = row.get("ID", "").strip()
			code = row.get("Code", "").strip()
			title = row.get("Title", "").strip()
			desc = row.get("Description", "").strip() or row.get("SubTitle", "").strip()

			if not app_id or not title:
				continue

			# Determine project name / existence
			existing = frappe.db.get_value("Project", {"custom_appsheet_id": app_id}, "name")
			if not existing:
				existing = frappe.db.get_value("Project", {"project_name": title}, "name")

			if not existing and not dry_run:
				proj = frappe.new_doc("Project")
				proj.project_name = title
				proj.custom_appsheet_id = app_id
				proj.custom_legacy_code = code
				proj.company = COMPANY_AFTER
				proj.notes = desc
				proj.insert(ignore_permissions=True)
				mapping[app_id] = proj.name
			elif existing:
				mapping[app_id] = existing
				if not dry_run:
					frappe.db.set_value("Project", existing, {
						"custom_appsheet_id": app_id,
						"custom_legacy_code": code
					}, update_modified=False)
			else:
				mapping[app_id] = f"PROJ-MOCK-{app_id[:6]}"

			count += 1

	if not dry_run:
		frappe.db.commit()

	return mapping, count


def import_tasks(phase_csv_path, activity_csv_path, project_map, dry_run=False):
	"""Import historical tasks from AppSheet Phase & Activity CSVs."""
	mapping = {}
	phase_map = {}
	count = 0

	# Process Phases first (as high-level tasks or milestone containers)
	if os.path.exists(phase_csv_path):
		with open(phase_csv_path, mode="r", encoding="utf-8-sig") as f:
			reader = csv.DictReader(f)
			for row in reader:
				phase_id = row.get("ID", "").strip()
				proj_app_id = row.get("Project", "").strip()
				code = row.get("Code", "").strip()
				title = row.get("Title", "").strip()
				desc = row.get("Decription", "").strip() or row.get("Description", "").strip()

				if not phase_id or not title:
					continue

				mapped_project = project_map.get(proj_app_id)
				existing = frappe.db.get_value("Task", {"custom_appsheet_id": phase_id}, "name")

				if not existing and not dry_run:
					task = frappe.new_doc("Task")
					task.subject = title
					task.project = mapped_project
					task.custom_appsheet_id = phase_id
					task.custom_activity_code = code
					task.description = desc
					task.is_group = 1
					task.insert(ignore_permissions=True)
					phase_map[phase_id] = task.name
					mapping[phase_id] = task.name
				elif existing:
					if not dry_run:
						frappe.db.set_value("Task", existing, "is_group", 1, update_modified=False)
					phase_map[phase_id] = existing
					mapping[phase_id] = existing
				else:
					phase_map[phase_id] = f"TASK-MOCK-{phase_id[:6]}"
					mapping[phase_id] = phase_map[phase_id]

				count += 1

	# Process Activities (as granular tasks)
	if os.path.exists(activity_csv_path):
		with open(activity_csv_path, mode="r", encoding="utf-8-sig") as f:
			reader = csv.DictReader(f)
			for row in reader:
				act_id = row.get("ID", "").strip()
				phase_id = row.get("Phase", "").strip()
				code = row.get("Code", "").strip()
				title = row.get("Title", "").strip() or row.get("Description", "").strip()
				desc = row.get("Description", "").strip() or row.get("Note", "").strip()

				if not act_id:
					continue

				if not title:
					title = f"Activity {code or act_id}"

				parent_task = phase_map.get(phase_id)
				parent_project = None
				if parent_task:
					parent_project = frappe.db.get_value("Task", parent_task, "project")
					if not dry_run:
						frappe.db.set_value("Task", parent_task, "is_group", 1, update_modified=False)

				existing = frappe.db.get_value("Task", {"custom_appsheet_id": act_id}, "name")

				if not existing and not dry_run:
					task = frappe.new_doc("Task")
					task.subject = title[:140]
					task.project = parent_project
					if parent_task:
						task.parent_task = parent_task
					task.custom_appsheet_id = act_id
					task.custom_activity_code = code
					task.description = desc
					task.is_group = 0
					task.insert(ignore_permissions=True)
					mapping[act_id] = task.name
				elif existing:
					mapping[act_id] = existing
				else:
					mapping[act_id] = f"TASK-MOCK-{act_id[:6]}"

				count += 1

	if not dry_run:
		frappe.db.commit()

	return mapping, count


def import_timelogs(timelog_csv_path, project_map, task_map, dry_run=False, batch_size=1000):
	"""Import historical AppSheet TimeLogs into Planned Work Blocks with company splitting."""
	if not os.path.exists(timelog_csv_path):
		raise FileNotFoundError(f"TimeLog CSV not found at: {timelog_csv_path}")

	admin_user = frappe.session.user if getattr(frappe, "session", None) and frappe.session.user != "Guest" else "Administrator"

	# Cache user mappings
	user_map = {}
	for u in frappe.get_all("User", fields=["name", "full_name", "first_name"]):
		user_map[u.name.lower()] = u.name
		if u.full_name:
			user_map[u.full_name.lower().replace(" ", "_")] = u.name
			user_map[u.full_name.lower()] = u.name

	stats = {
		"total_processed": 0,
		"inserted": 0,
		"skipped": 0,
		"nomeshwar_sharma_count": 0,
		"ommnomi_automation_count": 0,
		"errors": []
	}

	# Existing appsheet IDs to prevent duplicate insertion
	existing_ids = set(frappe.get_all("Planned Work Block", pluck="appsheet_id"))

	bulk_rows = []
	year = str(datetime.now().year)
	current_count = frappe.db.count("Planned Work Block")
	idx_counter = current_count + 1
	now_str = str(datetime.now().strftime("%Y-%m-%d %H:%M:%S"))

	fields = [
		"name", "creation", "modified", "modified_by", "owner", "docstatus", "idx",
		"employee", "work_date", "start_time", "end_time", "duration_hours",
		"location", "task_nature", "project", "task", "status",
		"cryptographic_hash", "deliverable_notes", "appsheet_id",
		"legacy_activity_id", "legacy_project_id", "associate_name",
		"billing_status", "costing_amount", "billing_amount"
	]

	with open(timelog_csv_path, mode="r", encoding="utf-8-sig") as f:
		reader = csv.DictReader(f)
		for row in reader:
			stats["total_processed"] += 1
			app_id = row.get("ID", "").strip()
			if not app_id:
				continue

			if app_id in existing_ids:
				stats["skipped"] += 1
				continue

			start_str = row.get("Start_Time", "").strip()
			end_str = row.get("End_Time", "").strip()
			w_date, s_time = parse_appsheet_datetime(start_str)
			_, e_time = parse_appsheet_datetime(end_str)

			if not w_date:
				stats["skipped"] += 1
				continue

			if not s_time:
				s_time = "09:00:00"
			if not e_time:
				e_time = "10:00:00"

			# Cutoff Company logic
			if w_date < CUTOFF_DATE:
				stats["nomeshwar_sharma_count"] += 1
			else:
				stats["ommnomi_automation_count"] += 1

			# Associate / User
			assoc = row.get("Associate", "").strip()
			emp_user = admin_user
			if assoc and assoc.lower() in user_map:
				emp_user = user_map[assoc.lower()]

			# Duration
			duration = flt(row.get("Hours", 0.0))
			if duration <= 0:
				duration = flt(row.get("Duration", 0.0))
			if duration <= 0:
				duration = 1.0

			# Costing / Billing
			cost_amt = flt(row.get("Net Cost", 0.0)) or flt(row.get("Costing", 0.0))
			bill_amt = flt(row.get("Net Bill", 0.0)) or flt(row.get("Billing", 0.0))
			b_status = row.get("Billing", "").strip()
			if b_status not in ["Unbilled", "Partially Billed", "Fully Billed", "Non-Billable", "Internal"]:
				b_status = "Fully Billed" if bill_amt > 0 else "Unbilled"

			# Linked Project and Task
			dd_proj = row.get("DD_Project", "").strip()
			act_id = row.get("Activity", "").strip()

			proj_link = project_map.get(dd_proj)
			task_link = task_map.get(act_id) or task_map.get(dd_proj)

			desc = row.get("Description", "").strip() or row.get("Notes", "").strip() or row.get("Remark", "").strip()
			c_hash = generate_migration_hash(emp_user, w_date, s_time, e_time, app_id)

			if dry_run:
				stats["inserted"] += 1
			else:
				row_name = f"PWB-{year}-{idx_counter:05d}"
				idx_counter += 1
				bulk_rows.append((
					row_name, now_str, now_str, admin_user, admin_user, 0, 0,
					emp_user, str(w_date), str(s_time), str(e_time), duration,
					"Office", "🎯 Planned", proj_link, task_link, "Completed",
					c_hash, desc, app_id,
					act_id, dd_proj, assoc,
					b_status, cost_amt, bill_amt
				))
				stats["inserted"] += 1

	if not dry_run and bulk_rows:
		frappe.db.bulk_insert("Planned Work Block", fields, bulk_rows, ignore_duplicates=True)
		frappe.db.commit()

	return stats


@frappe.whitelist()
def run_full_migration(data_directory, dry_run=False):
	"""Execute end-to-end historical migration from AppSheet CSV exports directory."""
	start_time = datetime.now()

	proj_csv = os.path.join(data_directory, "Empire_NoMi - Project.csv")
	phase_csv = os.path.join(data_directory, "Empire_NoMi - Phase.csv")
	act_csv = os.path.join(data_directory, "Empire_NoMi - Activity.csv")
	time_csv = os.path.join(data_directory, "Empire_NoMi - TimeLog.csv")

	print(f"🚀 Starting Historical AppSheet Migration (Dry Run: {dry_run})")
	print(f"📁 Data Source: {data_directory}")

	# Step 0: Prerequisites Check
	prereqs = verify_migration_prerequisites()
	if prereqs["status"] != "success":
		print("❌ Migration Pre-requisites verification failed:")
		for err in prereqs["errors"]:
			print(f"   - {err}")
		return prereqs

	print("✅ Pre-requisites verified successfully.")

	# Step 1: Import Projects
	print("📦 Importing Projects...")
	proj_map, proj_count = import_projects(proj_csv, dry_run=dry_run)
	print(f"✅ Processed {proj_count} Projects (Mapped: {len(proj_map)})")

	# Step 2: Import Tasks
	print("📋 Importing Phases & Activities as Tasks...")
	task_map, task_count = import_tasks(phase_csv, act_csv, proj_map, dry_run=dry_run)
	print(f"✅ Processed {task_count} Tasks (Mapped: {len(task_map)})")

	# Step 3: Import TimeLogs
	print("⏱️ Importing TimeLogs into Planned Work Blocks...")
	time_stats = import_timelogs(time_csv, proj_map, task_map, dry_run=dry_run)
	print(f"✅ TimeLog Migration Complete:")
	print(f"   - Total Rows Processed: {time_stats['total_processed']}")
	print(f"   - Successfully Inserted: {time_stats['inserted']}")
	print(f"   - Skipped / Already Exists: {time_stats['skipped']}")
	print(f"   - Nomeshwar Sharma (< 2024-09-02): {time_stats['nomeshwar_sharma_count']}")
	print(f"   - OmmNoMi Automation LLP (>= 2024-09-02): {time_stats['ommnomi_automation_count']}")
	if time_stats['errors']:
		print(f"   - Errors encountered: {len(time_stats['errors'])}")

	elapsed = (datetime.now() - start_time).total_seconds()
	print(f"🏁 Historical Migration Finished in {elapsed:.2f} seconds.")

	return {
		"status": "success",
		"dry_run": dry_run,
		"projects_count": proj_count,
		"tasks_count": task_count,
		"timelog_stats": time_stats,
		"elapsed_seconds": elapsed
	}


def find_uploaded_migration_files():
	"""Find the 4 AppSheet CSV files uploaded to Frappe Desk File Manager (/app/file)."""
	targets = {
		"project": ["Empire_NoMi - Project.csv", "Empire_NoMi-Project.csv", "Project.csv"],
		"phase": ["Empire_NoMi - Phase.csv", "Empire_NoMi-Phase.csv", "Phase.csv"],
		"activity": ["Empire_NoMi - Activity.csv", "Empire_NoMi-Activity.csv", "Activity.csv"],
		"timelog": ["Empire_NoMi - TimeLog.csv", "Empire_NoMi-TimeLog.csv", "TimeLog.csv"]
	}
	found_paths = {}

	# 1. Search File DocType records
	try:
		files = frappe.get_all("File", fields=["file_name", "file_url", "is_private"])
		for f in files:
			fname = f.file_name or ""
			fpath = None
			if f.is_private and f.file_url:
				rel = f.file_url.replace("/private/files/", "")
				fpath = frappe.get_site_path("private", "files", rel)
			elif f.file_url:
				rel = f.file_url.replace("/files/", "")
				fpath = frappe.get_site_path("public", "files", rel)

			if not fpath or not os.path.exists(fpath):
				continue

			for key, aliases in targets.items():
				if key not in found_paths:
					for a in aliases:
						if a.lower() in fname.lower():
							found_paths[key] = fpath
							break
	except Exception:
		pass

	# 2. Search private and public directories directly
	search_dirs = [
		frappe.get_site_path("private", "files"),
		frappe.get_site_path("public", "files")
	]
	for sdir in search_dirs:
		if not os.path.exists(sdir):
			continue
		for fname in os.listdir(sdir):
			fpath = os.path.join(sdir, fname)
			if not os.path.isfile(fpath):
				continue
			for key, aliases in targets.items():
				if key not in found_paths:
					for a in aliases:
						if a.lower() in fname.lower():
							found_paths[key] = fpath
							break

	return found_paths


@frappe.whitelist()
def run_migration_from_site_files(dry_run=False):
	"""Execute migration using CSV files uploaded via Frappe Desk File Manager (/app/file)."""
	start_time = datetime.now()
	found = find_uploaded_migration_files()

	missing = []
	for req in ["project", "phase", "activity", "timelog"]:
		if req not in found:
			missing.append(req)

	if missing:
		msg = f"Missing required migration CSV files in Desk File Manager: {', '.join(missing)}"
		print(f"❌ {msg}")
		return {"status": "failed", "error": msg, "found": found}

	print(f"🚀 Starting Historical AppSheet Migration from Desk Uploads (Dry Run: {dry_run})")
	print(f"📁 Project CSV: {found['project']}")
	print(f"📁 Phase CSV: {found['phase']}")
	print(f"📁 Activity CSV: {found['activity']}")
	print(f"📁 TimeLog CSV: {found['timelog']}")

	prereqs = verify_migration_prerequisites()
	if prereqs["status"] != "success":
		return prereqs

	proj_map, proj_count = import_projects(found['project'], dry_run=dry_run)
	task_map, task_count = import_tasks(found['phase'], found['activity'], proj_map, dry_run=dry_run)
	time_stats = import_timelogs(found['timelog'], proj_map, task_map, dry_run=dry_run)

	elapsed = (datetime.now() - start_time).total_seconds()
	print(f"🏁 Historical Migration Finished in {elapsed:.2f} seconds.")

	return {
		"status": "success",
		"dry_run": dry_run,
		"projects_count": proj_count,
		"tasks_count": task_count,
		"timelog_stats": time_stats,
		"elapsed_seconds": elapsed
	}


@frappe.whitelist()
def remap_work_block_users(custom_map=None):
	"""Remap employee and owner on Planned Work Blocks based on confirmed user accounts."""
	if custom_map and isinstance(custom_map, str):
		import json
		custom_map = json.loads(custom_map)

	exact_user_map = {
		"hardiksharma80912@gmail.com": [
			"Hardik_Hardi", "Hardik_Gagi", "Hardik_NoMi", "Hardik_Shobhi", "Hardik_Deepi", "Hardi", "Hardik"
		],
		"nomeshwer@ommnomi.in": [
			"Devoted_NoMi", "EaGeR_NoMi", "Dev_NoMi", "Keen_NoMi", "Consult_NoMi", "NoMi"
		],
		"meenaxi22aug@gmail.com": [
			"Meenaxi_Maxi", "Meenaxi_NoMi", "Meenaxi", "Maxi"
		],
		"shobhanamnag@gmail.com": [
			"Shobhi_Shobhi", "Shobhi"
		],
		"nehathakur08990@gmail.com": [
			"Neha_Neha", "Neha_NoMi", "Neha_Maxi", "Neha"
		],
		"deepikagautam3mn@gmail.com": [
			"Deepi_Deepi", "Deepi"
		],
		"gayatri62515@gmail.com": [
			"Gagi_Gagi", "Gagi_Maxi", "Gagi_Nomi", "Gagi_Shobhi", "Gagi"
		]
	}

	results = {}
	total_updated = 0

	for email, aliases in exact_user_map.items():
		placeholders = ", ".join(["%s"] * len(aliases))
		query = f"""
			UPDATE `tabPlanned Work Block`
			SET employee = %s, owner = %s
			WHERE associate_name IN ({placeholders})
		"""
		frappe.db.sql(query, [email, email] + aliases)
		
		# Also match by prefix if any remaining
		first_prefix = aliases[0].split('_')[0]
		frappe.db.sql("""
			UPDATE `tabPlanned Work Block`
			SET employee = %s, owner = %s
			WHERE associate_name LIKE %s AND employee = 'Administrator'
		""", (email, email, f"{first_prefix}%"))

		count = frappe.db.sql(
			"SELECT COUNT(*) FROM `tabPlanned Work Block` WHERE employee = %s",
			(email,)
		)[0][0]
		results[email] = count
		total_updated += count

	frappe.db.commit()
	return {
		"status": "success",
		"total_updated": total_updated,
		"breakdown": results
	}



