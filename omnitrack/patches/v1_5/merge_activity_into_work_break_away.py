# Copyright (c) 2026, OmmNoMi Automation LLP and contributors
# For license information, please see license.txt

from omnitrack.patches.v1_5.split_activity_from_planned import execute as split_activity


def execute():
	"""
	[post_model_sync] Idempotent patch:
	The activity is now only Work, Break or Away. Meeting and Review were work by another name,
	and Leave and Absent were both time away, so stored values fold into the three kinds the same
	way `to_kind` reads them. The split patch already rewrites every value that is not a kind.
	"""
	split_activity()
