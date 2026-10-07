"""OmniTrack runs with or without ERPNext and Frappe HR.

A Planned Work Block may name a Project, Task or Timesheet; a client workspace may name a
Customer. On a site without those DocTypes, Frappe's link check would fail the save with
"Options must be a valid DocType". Such a value is kept as plain text and not checked; every
other link (User, Planned Work Block, ...) is checked as usual.
"""

import frappe


class OptionalLinks:
	"""Mix in before Document: `class PlannedWorkBlock(OptionalLinks, Document)`."""

	def _validate_links(self):
		held = {}
		for df in self.meta.get_link_fields():
			value = self.get(df.fieldname)
			if value and df.options and not frappe.db.exists("DocType", df.options):
				held[df.fieldname] = value
				self.set(df.fieldname, None)
		try:
			super()._validate_links()
		finally:
			for fieldname, value in held.items():
				self.set(fieldname, value)
