import frappe
from frappe.model.document import Document
from frappe.utils import time_diff_in_hours


class OmniTrackWorkSession(Document):
	def validate(self):
		if self.from_time and self.to_time:
			try:
				diff = time_diff_in_hours(self.to_time, self.from_time)
				if diff < 0:
					diff += 24.0
				# Only auto-fill when hours not explicitly provided
				if not self.hours or self.hours == 0:
					self.hours = round(diff, 2)
			except Exception:
				pass
		if self.hours:
			self.hours = round(float(self.hours), 2)
