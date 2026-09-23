import hashlib
import frappe
from frappe.model.document import Document
from frappe.utils import time_diff_in_hours

class PlannedWorkBlock(Document):
	def validate(self):
		self.calculate_duration()
		self.generate_cryptographic_hash()

	def calculate_duration(self):
		if self.start_time and self.end_time:
			def _to_secs(t):
				if hasattr(t, 'total_seconds'):
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
					diff += 24.0 # Split over midnight
				self.duration_hours = round(diff, 2)
			except Exception:
				self.duration_hours = 0.0

	def generate_cryptographic_hash(self):
		if not self.cryptographic_hash and self.employee and self.work_date:
			raw = f"{self.employee}:{self.work_date}:{self.start_time}:{self.end_time}:{frappe.utils.now()}"
			short_hash = hashlib.sha256(raw.encode()).hexdigest()[:8]
			self.cryptographic_hash = f"chk-{short_hash}"
