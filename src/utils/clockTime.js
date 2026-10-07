// "HH:MM" times as minutes since midnight, for the plan dialog's time fields.

export const toMin = (t) => { const [h, m] = String(t || "").split(":").map(Number); return (h || 0) * 60 + (m || 0); };
export const toHHMM = (mins) => String(Math.floor(mins / 60)).padStart(2, "0") + ":" + String(mins % 60).padStart(2, "0");
// Minutes from start to end. An end before the start is the next morning (23:00-04:00 is 5h),
// as the server reads it (MidnightSplitter, log_span). The same time twice is no time.
export const spanMins = (start, end) => {
  if (!start || !end) return 0;
  const d = toMin(end) - toMin(start);
  return d < 0 ? d + 24 * 60 : d;
};
// Same look as TimePicker's own display ("1:45 pm") so the list matches the field
export const clock = (mins) => { const h = Math.floor(mins / 60), m = mins % 60; return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`; };
export const lengthWords = (mins) => mins < 60 ? `${mins} min` : `${(mins / 60).toFixed(2).replace(/\.?0+$/, "")} hr${mins === 60 ? "" : "s"}`;
export const localISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// "1.5h", "2h", "45m"
export const durationLabel = (mins) => {
  if (mins < 60) return mins + "m";
  return mins % 60 ? (mins / 60).toFixed(1).replace(/\.0$/, "") + "h" : mins / 60 + "h";
};

// As in Google Calendar: every 15 minutes after the start, each with its length, on past
// midnight into the next morning, so a night's work can end at 4:00 am
export function endTimeOptions(startHHMM) {
  if (!startHHMM) return [];
  const start = toMin(startHHMM);
  const out = [];
  for (let m = start + 15; m < start + 24 * 60; m += 15) {
    const at = m % (24 * 60);
    out.push({ value: toHHMM(at), label: `${clock(at)}${m >= 24 * 60 ? " next day" : ""} (${lengthWords(m - start)})` });
  }
  return out;
}

// "Wed, 7 Oct · 3:00 pm – 4:00 pm · 1h": how a block or session's time reads everywhere
export function whenLine(date, start, end) {
  const d = date ? new Date(String(date).slice(0, 10) + "T00:00:00") : null;
  const opts = { weekday: "short", day: "numeric", month: "short" };
  if (d && d.getFullYear() !== new Date().getFullYear()) opts.year = "numeric";
  const day = d && !isNaN(d) ? d.toLocaleDateString(undefined, opts) : "";
  const s = start ? toMin(start) : null, e = end ? toMin(end) : null;
  const time = s != null && e != null ? `${clock(s)} – ${clock(e)}` : (s != null ? clock(s) : "");
  const mins = s != null && e != null ? spanMins(start, end) : 0;
  return [day, time, mins > 0 ? durationLabel(mins) : ""].filter(Boolean).join(" · ");
}
