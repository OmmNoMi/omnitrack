import hashlib
import frappe
from frappe.model.document import Document
from frappe.utils import flt

from omnitrack.utils.optional_links import OptionalLinks


class PlannedWorkBlock(OptionalLinks, Document):
	def validate(self):
		self.normalize_activity()
		self.validate_past_plan_immutability()
		self.validate_timesheet_session_horizons()
		self.validate_no_future_sessions()
		self.resolve_project_from_task()
		self.sync_primary_task()
		self.put_person_on_tasks()
		self.calculate_duration()
		self.roll_up_sessions()
		self.generate_cryptographic_hash()

	def normalize_activity(self):
		"""Every activity, from any caller and in any older spelling, is stored as one plain kind.
		First, so the past-plan lock compares like with like."""
		from omnitrack.utils.activity import to_kind

		self.task_nature = to_kind(self.task_nature)
		for row in self.get("sessions") or []:
			row.task_nature = to_kind(row.task_nature or self.task_nature)

	def validate_past_plan_immutability(self):
		"""Rule: Work blocks older than the configured Past Lock Grace Period (Hours)
		cannot have their core plan modified or rescheduled."""
		if getattr(self.flags, "ignore_past_block_lock", False):
			return

		from omnitrack.permissions import get_past_block_lock_grace_hours
		from frappe.utils import now_datetime, get_datetime, time_diff_in_hours

		grace_hours = get_past_block_lock_grace_hours()
		now_dt = now_datetime()

		if not self.is_new():
			db_date = self.get_db_value("work_date") or self.work_date
			db_end_time = self.get_db_value("end_time") or self.end_time or "23:59:59"
			try:
				block_dt = get_datetime(f"{db_date} {db_end_time}")
			except Exception:
				block_dt = get_datetime(f"{db_date} 23:59:59")

			if time_diff_in_hours(now_dt, block_dt) > grace_hours:
				plan_fields = ("work_date", "start_time", "end_time", "task", "project", "task_nature", "deliverable_notes")
				for f in plan_fields:
					if self.has_value_changed(f):
						grace_desc = f"{grace_hours} hours"
						if grace_hours % 24 == 0:
							days = grace_hours // 24
							grace_desc += f" ({days} day{'s' if days > 1 else ''})"
						frappe.throw(
							frappe._("Planned work blocks older than the {0} grace period cannot be modified or rescheduled.").format(grace_desc),
							frappe.ValidationError
						)
			elif self.has_value_changed("work_date") and self.work_date:
				new_end = self.end_time or "23:59:59"
				try:
					new_dt = get_datetime(f"{self.work_date} {new_end}")
				except Exception:
					new_dt = get_datetime(f"{self.work_date} 23:59:59")
				if time_diff_in_hours(now_dt, new_dt) > grace_hours:
					frappe.throw(
						frappe._("Cannot reschedule or move a planned work block older than the grace period into the past."),
						frappe.ValidationError
					)

	def validate_timesheet_session_horizons(self):
		"""Rule: OmniTrack Users can only log or modify timesheet sessions within the configured horizon."""
		if getattr(self.flags, "ignore_permissions", False):
			return
		from omnitrack.permissions import check_timesheet_date_permission
		for sess in (self.sessions or []):
			if sess.get("session_date"):
				check_timesheet_date_permission(sess.session_date)

	def validate_no_future_sessions(self):
		"""Rule: a session records work done, so it cannot end after now. Only new or changed
		rows are checked, so a block that already holds such a row can still be saved."""
		from frappe.utils import now_datetime
		from omnitrack.utils.session_time import ends_in_future

		before = self.get_doc_before_save()
		old = {r.name: (str(r.session_date), str(r.from_time), str(r.to_time)) for r in (before.sessions if before else [])}
		now = now_datetime()
		for sess in self.sessions or []:
			if old.get(sess.name) == (str(sess.session_date), str(sess.from_time), str(sess.to_time)):
				continue
			if ends_in_future(sess, now):
				frappe.throw(frappe._("That time hasn't happened yet. Log a session once it is over."), frappe.ValidationError)

	def on_trash(self):
		if not getattr(self.flags, "ignore_past_block_lock", False):
			from omnitrack.permissions import get_past_block_lock_grace_hours
			from frappe.utils import now_datetime, get_datetime, time_diff_in_hours
			grace_hours = get_past_block_lock_grace_hours()
			now_dt = now_datetime()
			if self.work_date:
				end_t = self.end_time or "23:59:59"
				try:
					block_dt = get_datetime(f"{self.work_date} {end_t}")
				except Exception:
					block_dt = get_datetime(f"{self.work_date} 23:59:59")
				if time_diff_in_hours(now_dt, block_dt) > grace_hours:
					frappe.throw(
						frappe._("Past planned work blocks older than the grace period cannot be deleted."),
						frappe.ValidationError
					)


	def resolve_project_from_task(self):
		"""
		Every Timesheet and Planned Work Block is connected to a Project.
		If a task is linked (or specified via work_item), its Project is automatically inherited.
		"""
		if not self.task and self.work_item:
			w_item = str(self.work_item).strip()
			if w_item.startswith("task:"):
				self.task = w_item.split(":", 1)[1]
			elif frappe.db.exists("DocType", "Task") and frappe.db.exists("Task", w_item):
				self.task = w_item

		if self.task and frappe.db.exists("DocType", "Task"):
			task_project = frappe.db.get_value("Task", self.task, "project")
			if task_project:
				self.project = task_project

	def sync_primary_task(self):
		"""A block can be for several tasks (the `tasks` child table). Its main task,
		`work_item`, is always the first row, so either side can be the one that was set."""
		from omnitrack.utils.block_tasks import resolve_ref

		rows = [r for r in (self.get("tasks") or []) if r.work_item]
		ref = str(self.work_item or self.task or "").strip()
		primary = None
		if ref:
			primary = next((r for r in rows if r.work_item == ref), None)
			if not primary:
				data = resolve_ref(ref) or {"work_item": ref, "subject": self.work_item_label or ref}
				primary = self.append("tasks", data)
				rows.append(primary)
			if not self.work_item:
				self.work_item = ref
		elif rows:
			primary = next((r for r in rows if r.reference_doctype), None)
			if primary:
				self.work_item = primary.work_item
		if primary:
			self.work_item_label = self.work_item_label or primary.subject
			rows = [primary] + [r for r in rows if r is not primary]
		for i, r in enumerate(rows, 1):
			r.idx = i
		self.set("tasks", rows)

	def put_person_on_tasks(self):
		"""The block's person is on every open task it covers. A block booked for Neha on
		Nomeshwer's task sat on her calendar, never in her assigned work, and she could not
		finish it. She is now added to the task, as Frappe's Assign To adds her (whoever books
		must be able to read it, and Nomeshwer stays on it); a block on someone else's to-do is
		refused. Only rows new to the block are checked, or all when its person changed, so an
		unrelated save never undoes a later reassignment."""
		import json

		from frappe import _

		from omnitrack.utils.task_parity import parity_gaps

		if not self.employee or not frappe.db.exists("User", self.employee):
			return
		before = None if self.is_new() else self.get_doc_before_save()
		known = set() if before is None or before.employee != self.employee else {r.work_item for r in before.get("tasks") or []}
		new_rows = [r for r in self.get("tasks") or [] if r.work_item not in known and r.reference_doctype in ("Task", "ToDo")]
		if not new_rows:
			return
		rows = [(r.reference_doctype, r.reference_name, r.status) for r in new_rows]
		tasks = [n for d, n, _s in rows if d == "Task"]
		todos = [n for d, n, _s in rows if d == "ToDo"]
		task_assignees = {}
		if tasks and frappe.db.exists("DocType", "Task"):
			for t in frappe.get_all("Task", filters={"name": ["in", tasks]}, fields=["name", "_assign"]):
				task_assignees[t.name] = set(json.loads(t._assign or "[]"))
			for td in frappe.get_all("ToDo", filters={"reference_type": "Task", "reference_name": ["in", list(task_assignees)], "status": "Open"}, fields=["reference_name", "allocated_to"]):
				task_assignees[td.reference_name].add(td.allocated_to)
		todo_owners = dict(frappe.get_all("ToDo", filters={"name": ["in", todos]}, fields=["name", "allocated_to"], as_list=True)) if todos else {}

		assign, refuse = parity_gaps(self.employee, rows, task_assignees, todo_owners, is_copy=bool(self.paired_block))
		if refuse:
			name, owner = refuse[0]
			subject = next((r.subject for r in new_rows if r.reference_name == name), None) or name
			frappe.throw(
				_("{0} is on {1}'s to-do list, so it can't be planned for {2}. Plan it for {1}, or make it a task and assign {2} to it.").format(
					subject, frappe.utils.get_fullname(owner), frappe.utils.get_fullname(self.employee)
				),
				frappe.ValidationError,
			)
		if assign:
			from frappe.desk.form.assign_to import add as add_assignment

			for name in assign:
				add_assignment({"doctype": "Task", "name": name, "assign_to": [self.employee]})
			self.flags.added_to_tasks = assign

	def calculate_duration(self):
		"""The block's length from its times (past midnight wraps to the next day). A date and
		time in a Time field kept only its time, and the length came back 0.0 with no error: a
		time that cannot be read, or a date that is not the block's own day, is refused."""
		if not (self.start_time and self.end_time):
			return
		from frappe.utils import add_days, getdate
		from omnitrack.utils.block_slot import split_stamp
		from omnitrack.utils.time_math import duration_hours

		try:
			start_day, start = split_stamp(self.start_time)
			end_day, end = split_stamp(self.end_time)
		except ValueError as e:
			frappe.throw(str(e), frappe.ValidationError)
		if not self.work_date and start_day:
			self.work_date = start_day
		day = getdate(self.work_date) if self.work_date else None
		if day and ((start_day and getdate(start_day) != day) or (end_day and getdate(end_day) not in (day, getdate(add_days(day, 1))))):
			frappe.throw(frappe._("The block is on {0} but its times are dated {1} to {2}.").format(day, start_day or day, end_day or day), frappe.ValidationError)
		# Only a dated time is rewritten; a plain one is left as stored, so a re-save changes nothing
		if start_day:
			self.start_time = start
		if end_day:
			self.end_time = end
		self.duration_hours = round(duration_hours(start, end), 2)

	def roll_up_sessions(self):
		"""Actual hours = sum of logged work sessions; variance = actual - planned.

		A single Task can be booked across many Planned Work Blocks (multi-day / multi-session);
		each block accumulates its own real sessions here.
		"""
		from frappe.utils import now_datetime
		from omnitrack.utils.session_time import counted_hours

		# Only time after the block starts and already past counts; a session logged ahead of
		# the block stays on record but cannot make it Logged or Done.
		actual = counted_hours(self.work_date, self.start_time, self.sessions, now_datetime())
		self.actual_hours = round(actual, 2)
		self.variance_hours = round(actual - flt(self.duration_hours), 2)

		# Keep status in step with reality unless explicitly cancelled, rescheduled, or missed
		if self.status not in ("Cancelled", "Rescheduled", "Missed"):
			today = frappe.utils.getdate(frappe.utils.nowdate())
			block_date = frappe.utils.getdate(self.work_date) if self.work_date else today

			if actual <= 0:
				if block_date < today:
					self.status = "Missed"
				elif self.status in (None, "", "Draft", "In Progress", "Completed", "Logged (Full)", "Logged (Partial)", "Logged (Over)"):
					self.status = "Planned"
			elif self.status in ("Completed", "Logged (Full)", "Logged (Partial)", "Logged (Over)"):
				# Categorize completion accuracy
				if actual + 0.05 < flt(self.duration_hours):
					self.status = "Logged (Partial)"
				elif actual > flt(self.duration_hours) + 0.05:
					self.status = "Logged (Over)"
				else:
					self.status = "Logged (Full)"
			elif actual + 0.05 < flt(self.duration_hours):
				self.status = "In Progress"
			else:
				self.status = "Completed"

	def generate_cryptographic_hash(self):
		if not self.cryptographic_hash and self.employee and self.work_date:
			raw = f"{self.employee}:{self.work_date}:{self.start_time}:{self.end_time}:{frappe.utils.now()}"
			short_hash = hashlib.sha256(raw.encode()).hexdigest()[:8]
			self.cryptographic_hash = f"chk-{short_hash}"
