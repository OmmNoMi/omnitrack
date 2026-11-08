import secrets
import frappe
from frappe.model.document import Document

class OmniTrackSettings(Document):
	def validate(self):
		if not self.vapid_public_key:
			self.generate_vapid_keys()

	@frappe.whitelist()
	def generate_vapid_keys(self):
		frappe.only_for("System Manager")
		self.vapid_public_key = f"VAPID_PUB_{secrets.token_hex(16)}"
		self.vapid_private_key = secrets.token_hex(32)
		if not self.is_new():
			self.save()
		return {"public_key": self.vapid_public_key}
