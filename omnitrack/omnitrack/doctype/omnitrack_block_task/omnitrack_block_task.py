# Copyright (c) 2026, OmmNoMi Automation LLP and contributors
# For license information, please see license.txt

from frappe.model.document import Document


class OmniTrackBlockTask(Document):
	"""One task a Planned Work Block is for. The block's first row mirrors its work_item."""
