import hashlib
import frappe
from frappe.model.document import Document
from frappe.utils import flt


class PlannedWorkBlock(Document):
	def validate(self):
		self.validate_past_plan_immutability()
		self.validate_timesheet_session_horizons()
		self.resolve_project_from_task()
		self.calculate_duration()
		self.roll_up_sessions()
		self.generate_cryptographic_hash()

	def validate_past_plan_immutability(self):
		"""Rule: In the past (work_date < today), NO ONE can change or reschedule planned work blocks."""
		if getattr(self.flags, "ignore_past_block_lock", False):
			return

		today = frappe.utils.getdate(frappe.utils.nowdate())

		if not self.is_new():
			db_date = frappe.utils.getdate(self.get_db_value("work_date") or self.work_date)
			if db_date < today:
				plan_fields = ("work_date", "start_time", "end_time", "task", "project", "task_nature", "deliverable_notes")
				for f in plan_fields:
					if self.has_value_changed(f):
						frappe.throw(
							frappe._("Planned work blocks in the past cannot be modified or rescheduled."),
							frappe.ValidationError
						)
			elif self.has_value_changed("work_date") and self.work_date and frappe.utils.getdate(self.work_date) < today:
				frappe.throw(
					frappe._("Cannot reschedule or move a planned work block into the past."),
					frappe.ValidationError
				)

	def validate_timesheet_session_horizons(self):
		"""Rule: OmniTrack Users can only log or modify timesheet sessions for today and yesterday."""
		if getattr(self.flags, "ignore_permissions", False):
			return
		from omnitrack.permissions import check_timesheet_date_permission
		for sess in (self.sessions or []):
			if sess.get("session_date"):
				check_timesheet_date_permission(sess.session_date)

	def on_trash(self):
		if not getattr(self.flags, "ignore_past_block_lock", False):
			if self.work_date and frappe.utils.getdate(self.work_date) < frappe.utils.getdate(frappe.utils.nowdate()):
				frappe.throw(
					frappe._("Past planned work blocks cannot be deleted."),
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

	def calculate_duration(self):
		if self.start_time and self.end_time:
			def _to_secs(t):
				if hasattr(t, "total_seconds"):
					return t.total_seconds()
				parts = str(t).split(":")
				h = int(parts[0]) if len(parts) > 0 else 0
				m = int(parts[1]) if len(parts) > 1 else 0
				s = int(float(parts[2])) if len(parts) > 2 else 0
				return h * 3600 + m * 60 + s

			try:
				s1 = _to_secs(self.start_time)
				s2 = _to_secs(self.end_time)
				diff = (s2 - s1) / 3600.0
				if diff < 0:
					diff += 24.0  # Split over midnight
				self.duration_hours = round(diff, 2)
			except Exception:
				self.duration_hours = 0.0

	def roll_up_sessions(self):
		"""Actual hours = sum of logged work sessions; variance = actual - planned.

		A single Task can be booked across many Planned Work Blocks (multi-day / multi-session);
		each block accumulates its own real sessions here.
		"""
		actual = sum(flt(s.hours) for s in (self.sessions or []))
		self.actual_hours = round(actual, 2)
		self.variance_hours = round(actual - flt(self.duration_hours), 2)

		# Keep status in step with reality unless explicitly cancelled, rescheduled, or missed
		if self.status not in ("Cancelled", "Rescheduled", "Missed"):
			today = frappe.utils.getdate(frappe.utils.nowdate())
			block_date = frappe.utils.getdate(self.work_date) if self.work_date else today

			if actual <= 0:
				if block_date < today:
					self.status = "Missed"
				elif self.status in (None, "", "Draft"):
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
