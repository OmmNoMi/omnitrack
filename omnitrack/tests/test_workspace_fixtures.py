# Copyright (c) 2026, OmmNoMi Automation LLP and contributors
# For license information, please see license.txt

"""Invariants on the Workspace fixtures OmniTrack ships.

Background: OmniTrack once shipped four public Workspaces. Three of them
("My Workstation", "Operations & Delivery Hub", "OmniTrack Command Center")
were never asked for, and the fourth fixture still carried the pre-rename
identity "OmniTrack Operations & Workforce Cockpit" while install.py created
"OmniTrack" -- so every migrate produced TWO tiles on the desktop for one
workspace. Each public Workspace also grows a Desktop Icon and a Workspace
Sidebar, so the clutter multiplied by three.

These tests are filesystem-only (no site, no DB) so they run in milliseconds
and cannot be skipped by a missing bench.
"""

import json
import os
import re
import unittest

APP_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORKSPACE_DIR = os.path.join(APP_DIR, "omnitrack", "workspace")
INSTALL_PY = os.path.join(APP_DIR, "install.py")

# The one public Workspace OmniTrack is allowed to put on a user's desktop.
# Adding a name here is a deliberate product decision, not a drive-by.
ALLOWED_PUBLIC_WORKSPACES = {"OmniTrack"}


def _scrub(label):
	"""frappe.scrub -- folder name for a fixture."""
	return re.sub(r"[^a-z0-9_]", "", label.lower().replace(" ", "_").replace("-", "_"))


def _fixtures():
	out = {}
	if not os.path.isdir(WORKSPACE_DIR):
		return out
	for folder in sorted(os.listdir(WORKSPACE_DIR)):
		path = os.path.join(WORKSPACE_DIR, folder, folder + ".json")
		if os.path.isfile(path):
			with open(path) as f:
				out[folder] = json.load(f)
	return out


class TestWorkspaceFixtures(unittest.TestCase):
	def test_only_the_sanctioned_public_workspaces_ship(self):
		"""No workspace reaches a user's desktop without being on the list."""
		shipped = {d["name"] for d in _fixtures().values() if d.get("public")}
		self.assertEqual(
			shipped,
			ALLOWED_PUBLIC_WORKSPACES,
			"OmniTrack ships public Workspaces that are not sanctioned: "
			f"{sorted(shipped - ALLOWED_PUBLIC_WORKSPACES)}; missing: "
			f"{sorted(ALLOWED_PUBLIC_WORKSPACES - shipped)}",
		)

	def test_a_fixture_identity_matches_its_own_folder(self):
		"""A renamed workspace must be re-exported, never left stale.

		A fixture whose `name` no longer scrubs to its folder is exactly how
		the duplicate tile happened: install.py ensured one name, the stale
		export re-created the other.
		"""
		for folder, doc in _fixtures().items():
			self.assertEqual(
				_scrub(doc["name"]),
				folder,
				f"workspace/{folder}/{folder}.json declares name {doc['name']!r}, "
				f"which scrubs to {_scrub(doc['name'])!r}",
			)
			self.assertEqual(
				doc["label"],
				doc["name"],
				f"workspace/{folder}: label {doc['label']!r} != name {doc['name']!r}",
			)

	def test_install_py_ensures_exactly_the_shipped_names(self):
		"""Code and fixtures must agree, or migrate creates a second tile."""
		with open(INSTALL_PY) as f:
			source = f.read()
		block = source.split("def _ensure_workspaces()", 1)
		self.assertEqual(len(block), 2, "install.py no longer defines _ensure_workspaces()")
		body = block[1].split("\ndef ", 1)[0]
		ensured = set(re.findall(r'"name":\s*"([^"]+)"', body))
		# _ensure_workspaces only names Workspaces at the "name" key; nested
		# rows use number_card_name / chart_name / link_to instead.
		self.assertEqual(
			ensured,
			ALLOWED_PUBLIC_WORKSPACES,
			f"_ensure_workspaces() creates {sorted(ensured)}, "
			f"expected {sorted(ALLOWED_PUBLIC_WORKSPACES)}",
		)

	def test_the_pre_rename_identity_is_gone_from_the_app(self):
		"""The stale label must not come back through any code path."""
		stale = "OmniTrack Operations & Workforce Cockpit"
		hits = []
		for root, dirs, files in os.walk(APP_DIR):
			dirs[:] = [d for d in dirs if d not in {"node_modules", "__pycache__", "dist", ".git"}]
			for fn in files:
				if not fn.endswith((".py", ".json", ".js", ".vue")):
					continue
				path = os.path.join(root, fn)
				if os.path.abspath(path) == os.path.abspath(__file__):
					continue
				try:
					with open(path, encoding="utf-8") as f:
						if stale in f.read():
							hits.append(os.path.relpath(path, APP_DIR))
				except (UnicodeDecodeError, OSError):
					continue
		self.assertEqual(hits, [], f"stale workspace identity {stale!r} still in: {hits}")


if __name__ == "__main__":
	unittest.main()
