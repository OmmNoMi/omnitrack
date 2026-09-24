# Copyright (c) 2026, OmmNoMi Automation LLP and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import flt


class OmniTrackOutputMetric(Document):
	def validate(self):
		if not self.quantity:
			self.quantity = 1.0
		else:
			self.quantity = flt(self.quantity)
		if self.unit:
			self.unit = self.unit.strip()
		if self.reference_id:
			self.reference_id = self.reference_id.strip()
