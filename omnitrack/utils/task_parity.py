# Copyright (c) 2026, OmmNoMi Automation LLP and contributors
# For license information, please see license.txt

"""Who a planned block's tasks must be assigned to. Needs no site.

A block was once booked for Neha on a task assigned to Nomeshwer: it sat on her calendar, the
task never showed in her assigned work, and she could not finish it. The person a block is for
must be on every open task it covers.
"""


def parity_gaps(person, rows, task_assignees, todo_owners, is_copy=False):
	"""What keeps ``person`` off the tasks of their block.

	rows: (doctype, name, status) of the block's task rows that need checking.
	task_assignees: {Task name: set of users assigned to it}, for every Task that still exists.
	todo_owners: {ToDo name: the user it is allocated to}.
	is_copy: the block is a paired or team copy of a colleague's block.

	Returns (Tasks to assign ``person`` to, [(ToDo name, its owner)] that refuse the block).
	A Task can have many assignees, so a missing person is added and nobody is taken off.
	A to-do is one person's list item; a copy's block may point at its owner's to-do,
	any other block on someone else's to-do is refused.
	"""
	assign, refuse = [], []
	for doctype, name, status in rows:
		if not name or status == "Completed":
			continue
		if doctype == "Task" and name in task_assignees and person not in task_assignees[name]:
			if name not in assign:
				assign.append(name)
		elif doctype == "ToDo" and not is_copy:
			owner = todo_owners.get(name)
			if owner and owner != person:
				refuse.append((name, owner))
	return assign, refuse
