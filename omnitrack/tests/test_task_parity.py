# Copyright (c) 2026, OmmNoMi Automation LLP and contributors
# For license information, please see license.txt

"""The person a planned block is for is on every open task it covers.

omnitrack_plan_work_blocks booked a block for Neha on a task assigned to Nomeshwer: it sat on
her calendar, never showed in her assigned work, and she could not finish the task.

No site, no DB: task_parity.py is pure, and the controller wiring is checked in its source.
Both are loaded by path, so the mutation tests' copy is the one tested.
"""

import importlib.util
import os
import unittest

APP_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_spec = importlib.util.spec_from_file_location("task_parity", os.path.join(APP_DIR, "utils", "task_parity.py"))
task_parity = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(task_parity)
CONTROLLER = open(os.path.join(APP_DIR, "omnitrack", "doctype", "planned_work_block", "planned_work_block.py")).read()
PLANNER = open(os.path.join(APP_DIR, "api", "planner.py")).read()
FAC = open(os.path.join(APP_DIR, "fac.py")).read()

NEHA, NOMESH = "neha@example.com", "nomesh@example.com"


def body_of(src, name):
	start = src.index(f"\tdef {name}(")
	end = src.find("\n\tdef ", start + 1)
	return src[start:end if end != -1 else len(src)]


class TestTaskParity(unittest.TestCase):
	def gaps(self, rows, task_assignees=None, todo_owners=None, is_copy=False):
		return task_parity.parity_gaps(NEHA, rows, task_assignees or {}, todo_owners or {}, is_copy)

	def test_someone_elses_task_gets_the_blocks_person_added(self):
		assign, refuse = self.gaps([("Task", "TASK-1", "Open")], {"TASK-1": {NOMESH}})
		self.assertEqual((assign, refuse), (["TASK-1"], []))

	def test_an_unassigned_task_gets_the_blocks_person_too(self):
		self.assertEqual(self.gaps([("Task", "TASK-1", "Open")], {"TASK-1": set()}), (["TASK-1"], []))

	def test_a_task_already_hers_is_left_alone(self):
		self.assertEqual(self.gaps([("Task", "TASK-1", "Open")], {"TASK-1": {NOMESH, NEHA}}), ([], []))

	def test_finished_missing_and_repeated_tasks(self):
		rows = [("Task", "TASK-1", "Completed"), ("Task", "GONE", "Open"), ("Task", "TASK-2", "Open"), ("Task", "TASK-2", "Open"), ("Task", None, "Open")]
		self.assertEqual(self.gaps(rows, {"TASK-1": {NOMESH}, "TASK-2": {NOMESH}}), (["TASK-2"], []))

	def test_someone_elses_todo_is_refused(self):
		self.assertEqual(self.gaps([("ToDo", "TD-1", "Open")], todo_owners={"TD-1": NOMESH}), ([], [("TD-1", NOMESH)]))

	def test_her_own_todo_and_a_copys_todo_pass(self):
		self.assertEqual(self.gaps([("ToDo", "TD-1", "Open")], todo_owners={"TD-1": NEHA}), ([], []))
		# A paired or team copy shows its owner's to-do; the to-do stays the owner's
		self.assertEqual(self.gaps([("ToDo", "TD-1", "Open")], todo_owners={"TD-1": NOMESH}, is_copy=True), ([], []))

	def test_a_copy_still_puts_its_person_on_tasks(self):
		self.assertEqual(self.gaps([("Task", "TASK-1", "Open")], {"TASK-1": {NOMESH}}, is_copy=True), (["TASK-1"], []))

	def test_every_saved_block_is_checked(self):
		"""In the controller, so the UI, FAC, attach and edit paths all pass through it."""
		self.assertIn("\t\tself.sync_primary_task()\n\t\tself.put_person_on_tasks()\n", CONTROLLER)
		body = body_of(CONTROLLER, "put_person_on_tasks")
		# Frappe's own Assign To: it checks the caller may read the task and keeps other assignees
		self.assertIn('add_assignment({"doctype": "Task", "name": name, "assign_to": [self.employee]})', body)
		self.assertIn("frappe.throw(", body)
		self.assertIn("frappe.ValidationError", body)
		self.assertIn("is_copy=bool(self.paired_block)", body)
		# Assignees come from both the _assign list and open ToDos
		self.assertIn('set(json.loads(t._assign or "[]"))', body)
		self.assertIn("task_assignees[td.reference_name].add(td.allocated_to)", body)

	def test_only_new_rows_are_checked(self):
		"""An unrelated save must not put back someone a task was later taken off."""
		body = body_of(CONTROLLER, "put_person_on_tasks")
		self.assertIn("known = set() if before is None or before.employee != self.employee else {r.work_item for r in before.get(\"tasks\") or []}", body)
		self.assertIn("if r.work_item not in known", body)

	def test_the_result_says_who_was_added(self):
		self.assertIn('"added_to_tasks": doc.flags.added_to_tasks or [],', PLANNER)
		self.assertIn('"added_to_tasks": res.get("added_to_tasks") or [],', FAC)


if __name__ == "__main__":
	unittest.main()
