import { reactive } from 'vue';

/*
 * The one task form (TaskFormDialog), opened from anywhere a task is shown: the block drawer,
 * the session popup, the dashboard lists. Given a block, it edits the task as that block's row;
 * without one, the Task or ToDo itself. A list that keeps its own copy of the task (a running
 * session's tasks) passes onChange to hear about saves and moves, and onRemove to take it off.
 * A list that offers a task's workflow moves itself passes ask (the move's action): the form
 * opens at that move's confirm step, so every move still goes through this one form.
 */
export const taskForm = reactive({ open: false, task: null, block: null, canRemove: false, onRemove: null, onChange: null, ask: null });

export function openTaskForm(task, { block = null, canRemove = false, onRemove = null, onChange = null, ask = null } = {}) {
  if (!task) return;
  Object.assign(taskForm, {
    task,
    block,
    canRemove: !!((block && canRemove) || onRemove),
    onRemove,
    onChange,
    ask,
    open: true,
  });
}

export function closeTaskForm() {
  taskForm.open = false;
  taskForm.ask = null;
}
