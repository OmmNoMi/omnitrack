import hashlib
import frappe
from frappe.model.document import Document
from frappe.utils import flt


class PlannedWorkBlock(Document):
	def validate(self):
		self.calculate_duration()
		self.roll_up_sessions()
		self.generate_cryptographic_hash()

	def calculate_duration(self):
		if self.start_time and self.end_time:
			# Calculate duration in hours
			t1 = str(self.start_time)
			t2 = str(self.end_time)
			try:
				from datetime import datetime
				fmt = "%H:%M:%S"
				d1 = datetime.strptime(t1 if len(t1) == 8 else t1 + ":00", fmt)
				d2 = datetime.strptime(t2 if len(t2) == 8 else t2 + ":00", fmt)
				diff = (d2 - d1).total_seconds() / 3600.0
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

		# Keep status in step with reality unless explicitly cancelled
		if self.status != "Cancelled":
			if actual <= 0:
				if self.status in (None, "", "Draft"):
					self.status = "Planned"
			elif actual + 0.01 < flt(self.duration_hours):
				self.status = "In Progress"
			else:
				self.status = "Completed"

	def generate_cryptographic_hash(self):
		if not self.cryptographic_hash and self.employee and self.work_date:
			raw = f"{self.employee}:{self.work_date}:{self.start_time}:{self.end_time}:{frappe.utils.now()}"
			short_hash = hashlib.sha256(raw.encode()).hexdigest()[:8]
			self.cryptographic_hash = f"chk-{short_hash}"
