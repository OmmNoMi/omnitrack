// A block's name, the same everywhere. The title it was given is work_item_label (the plan and
// edit dialogs write it; the server serves it, or the main task's subject, as task_subject).
// Without one, the first line of its notes. Never a task picked over the title the person typed.
export function blockTitle(b, fallback = 'Work block') {
  if (!b) return fallback;
  const given = String(b.task_subject || b.work_item_label || '').trim();
  if (given) return given;
  const firstLine = String(b.deliverable_notes || '').split('\n').map((s) => s.trim()).find(Boolean);
  return firstLine || fallback;
}
