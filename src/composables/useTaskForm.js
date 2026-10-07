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

// The Task or ToDo a task stands for, wherever it was listed; null for a block's plain
// checklist item, which is only a name.
export function taskDocRef(task) {
  const t = task || {};
  const ref = String(t.ref || '');
  const doctype = t.doctype && t.doctype !== 'Item' ? t.doctype : (ref.startsWith('todo:') ? 'ToDo' : (t.doctype === 'Item' ? '' : 'Task'));
  const name = t.docname || (ref.startsWith('todo:') ? ref.slice(5) : (t.id || t.name || ref));
  return doctype && name ? { doctype, name } : null;
}

/*
 * The task details panel (TaskDetailDrawer): what the task is, who it is for, where it stands
 * and its description, read before anything is changed. Clicking a task opens this; its Edit
 * opens the one task form with the same options, so a block row is still edited as that row.
 */
export const taskDetail = reactive({ open: false, task: null, opts: {} });

export function openTaskDetail(task, opts = {}) {
  if (!task) return;
  if (!taskDocRef(task)) return openTaskForm(task, opts);
  Object.assign(taskDetail, { task, opts: opts || {}, open: true });
}

export function closeTaskDetail() {
  taskDetail.open = false;
}
