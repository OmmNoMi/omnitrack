import frappe
from frappe import _
from frappe.model.document import Document

class OmniTrackShiftTemplate(Document):
	def validate(self):
		if not self.sessions:
			frappe.throw(_("At least one shift session is required."))
