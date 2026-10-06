// What tells two assigned tasks apart before picking one: project, how due it is,
// priority, status and hours. Used by the plan dialog's task list and its picked tasks.

export const hrs = (v) => (Number(v) || 0).toFixed(1).replace(/\.0$/, "") + "h";

export function shortDate(iso) {
  const d = new Date(String(iso).slice(0, 10) + "T00:00:00");
  if (isNaN(d)) return iso;
  const opts = { weekday: "short", day: "numeric", month: "short" };
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = "numeric";
  return d.toLocaleDateString(undefined, opts);
}

// [{ text, tone }] where tone is "red", "amber" or "" (plain)
export function taskMeta(t) {
  const out = [];
  if (t.project) out.push({ text: t.project });
  if (t.is_overdue) out.push({ text: t.days_overdue ? `Overdue ${t.days_overdue} day${t.days_overdue === 1 ? "" : "s"}` : "Overdue", tone: "red" });
  else if (t.is_due_today) out.push({ text: "Due today", tone: "amber" });
  else if (t.due_date) out.push({ text: "Due " + shortDate(t.due_date) });
  if (["High", "Urgent"].includes(t.priority)) out.push({ text: t.priority + " priority", tone: t.priority === "Urgent" ? "red" : "" });
  if (t.status && !["Open", "Pending"].includes(t.status)) out.push({ text: t.status });
  if (Number(t.estimate_hours)) out.push({ text: `${hrs(t.logged_hours)} of ${hrs(t.estimate_hours)} logged` });
  else if (Number(t.booked_hours)) out.push({ text: `${hrs(t.booked_hours)} planned` });
  return out;
}

export function toneClass(tone, dark) {
  if (tone === "red") return dark ? "text-red-300 font-medium" : "text-red-700 font-medium";
  if (tone === "amber") return dark ? "text-amber-300 font-medium" : "text-amber-800 font-medium";
  return "";
}
