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

import ast
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


HOOKS_PY = os.path.join(APP_DIR, "hooks.py")
SIDEBAR_FIXTURES = [
	os.path.join(APP_DIR, "workspace_sidebar", "omnitrack.json"),
	os.path.join(APP_DIR, "omnitrack", "workspace_sidebar", "omnitrack.json"),
]
WORKSPACE_FIXTURES = [
	os.path.join(WORKSPACE_DIR, "omnitrack", "omnitrack.json"),
]


class TestWorkspaceFixtures(unittest.TestCase):
	def test_hooks_declares_apps_screen_and_home(self):
		"""Frappe v16 Desk needs add_to_apps_screen and app_home to resolve app branding and routes."""
		# Read the literal assignments without running hooks.py
		with open(HOOKS_PY, encoding="utf-8") as f:
			tree = ast.parse(f.read(), HOOKS_PY)
		hooks = {
			t.id: ast.literal_eval(node.value)
			for node in tree.body
			if isinstance(node, ast.Assign)
			for t in node.targets
			if isinstance(t, ast.Name) and t.id in ("app_home", "add_to_apps_screen")
		}
		self.assertEqual(hooks.get("app_home"), "/desk/omnitrack")
		tiles = hooks.get("add_to_apps_screen") or []
		self.assertEqual([t.get("name") for t in tiles], ["omnitrack"])
		tile = tiles[0]
		self.assertEqual(tile.get("route"), hooks["app_home"], "the apps-screen tile must open app_home")
		self.assertTrue(tile.get("logo", "").startswith("/assets/omnitrack/"), "the apps-screen tile needs the brand logo")
		self.assertTrue(tile.get("title"))

	def test_sidebar_fixtures_branding_and_links(self):
		"""Sidebar header carries an icon name, Employee Timesheets, and zero low-level developer payload doctypes."""
		banned_doctypes = {
			"OmniTrack Task Sync",
			"OmniTrack Remote Connection",
			"OmniTrack Workspace",
			"OmniTrack Push Subscription",
		}
		for path in SIDEBAR_FIXTURES:
			if not os.path.isfile(path):
				continue
			with open(path, encoding="utf-8") as f:
				doc = json.load(f)
			# header_icon is an Icon field: an asset URL renders as a broken icon
			icon = doc.get("header_icon") or ""
			self.assertTrue(icon and not icon.startswith("/") and "://" not in icon, f"{path} header_icon {icon!r} is not an icon name")
			items = doc.get("items", [])
			linked_doctypes = {it.get("link_to") for it in items if it.get("link_type") == "DocType"}
			self.assertIn("Timesheet", linked_doctypes, f"{path} missing link to Timesheet")
			overlap = linked_doctypes & banned_doctypes
			self.assertEqual(overlap, set(), f"{path} contains developer payload doctypes: {overlap}")
			for it in items:
				if it.get("link_to") == "OmniTrack Attendance Synthesizer Log":
					self.assertLessEqual(len(it.get("label", "")), 20, f"Label {it.get('label')!r} too long in {path}")

	def test_workspace_icon_is_an_icon_name(self):
		"""Workspace.icon is an Icon field, in the fixture and in install.py."""
		for path in WORKSPACE_FIXTURES:
			with open(path, encoding="utf-8") as f:
				icon = json.load(f).get("icon") or ""
			self.assertTrue(icon and not icon.startswith("/"), f"{path} icon {icon!r} is not an icon name")
		with open(INSTALL_PY, encoding="utf-8") as f:
			source = f.read()
		m = re.search(r'^SIDEBAR_ICON\s*=\s*"([^"]*)"', source, re.M)
		self.assertTrue(m and m.group(1) and not m.group(1).startswith("/"), "install.py SIDEBAR_ICON must be an icon name")
		ws_body = source.split("def _ensure_workspaces()", 1)[1].split("\ndef ", 1)[0]
		self.assertNotRegex(ws_body, r'"icon":\s*"/', "_ensure_workspaces() sets an asset URL as the Workspace icon")

	def test_sidebar_links_only_to_installed_doctypes(self):
		"""Timesheet comes with ERPNext and Checkin/Attendance with HR: the sidebar guards each one."""
		with open(INSTALL_PY, encoding="utf-8") as f:
			source = f.read()
		body = source.split("def _ensure_workspace_sidebar()", 1)[1].split("\ndef ", 1)[0]
		unguarded = body.split("if frappe.db.exists(", 1)[0]
		for doctype in ("Timesheet", "Employee Checkin", "Attendance"):
			self.assertIn(f'frappe.db.exists("DocType", "{doctype}")', body, f"sidebar never checks {doctype} exists")
			self.assertNotIn(f'"link_to": "{doctype}"', unguarded, f"sidebar links {doctype} before checking it exists")

	def test_workspace_cards_keep_projects_and_tasks(self):
		"""The desk workspace keeps its Projects & Tasks card (Project, Task)."""
		for path in WORKSPACE_FIXTURES:
			with open(path, encoding="utf-8") as f:
				doc = json.load(f)
			cards = {c["data"]["card_name"]: {l["link_to"] for l in c["data"]["links"]} for c in json.loads(doc["content"]) if c["type"] == "card"}
			self.assertEqual(cards.get("Projects & Tasks"), {"Project", "Task"}, f"{path} lost the Projects & Tasks card")
		with open(INSTALL_PY, encoding="utf-8") as f:
			body = f.read().split("def _ensure_workspaces()", 1)[1].split("\ndef ", 1)[0]
		self.assertRegex(body, r'"label": "Projects & Tasks",\s*"links": \[\s*\{"label": "Projects", "link_to": "Project"\},\s*\{"label": "Tasks", "link_to": "Task"\}')

	def test_workspace_fixtures_has_timesheet_and_clean_cards(self):
		"""Desk Workspace must include Employee Timesheets in shortcuts and Workforce & Shifts card."""
		banned_doctypes = {
			"OmniTrack Task Sync",
			"OmniTrack Remote Connection",
			"OmniTrack Workspace",
			"OmniTrack Push Subscription",
		}
		for path in WORKSPACE_FIXTURES:
			with open(path, encoding="utf-8") as f:
				doc = json.load(f)
			shortcuts = doc.get("shortcuts", [])
			shortcut_targets = {sc.get("link_to") for sc in shortcuts}
			self.assertIn("Timesheet", shortcut_targets, f"{path} missing Timesheet shortcut")

			links = doc.get("links", [])
			linked = {l.get("link_to") for l in links}
			self.assertIn("Timesheet", linked, f"{path} missing Timesheet link")
			overlap = linked & banned_doctypes
			self.assertEqual(overlap, set(), f"{path} links contain developer payload doctypes: {overlap}")

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
