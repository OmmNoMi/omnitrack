// The notes a session is saved with when it is switched for the next one: its title, then its log
// lines as bullets. The switch dialog never asks for these again; it takes one optional last line,
// which joins the log as its final bullet.
export function composeWrapNote(title, logLines, lastLine) {
  const lines = [...(logLines || []), lastLine].map((p) => String(p || '').trim()).filter(Boolean);
  const head = String(title || '').trim();
  const bullets = lines.map((p) => `• ${p}`).join('\n');
  return head && bullets ? `${head}\n\n${bullets}` : (head || bullets);
}

// Those notes read back as lines, for a place that already shows the title: one per entry, bullets
// dropped. A ticked-off task ("Completed: X") is { text: X, done: true }. A line that only repeats
// the title is left out, and when the title's own task was ticked off it reads "Completed", first.
export function noteLines(notes, title) {
  const head = String(title || '').trim().toLowerCase();
  const out = [];
  let ownDone = false;
  for (const raw of String(notes || '').split('\n')) {
    const line = raw.replace(/^\s*[•*-]\s*/, '').trim();
    const m = line.match(/^Completed:\s*(.+)$/);
    const text = m ? m[1].trim() : line;
    if (!text) continue;
    if (text.toLowerCase() === head) { ownDone = ownDone || !!m; continue; }
    out.push({ text, done: !!m });
  }
  return ownDone ? [{ text: 'Completed', done: true }, ...out] : out;
}

// What a running session is called before it has a block: the first line of its notes that is
// not a logged step ("Completed: X" or a bullet).
export function noteHeading(notes) {
  return String(notes || '').split('\n').map((l) => l.trim()).find((l) => l && !/^\W*Completed:/.test(l) && !/^[•*-]\s/.test(l)) || '';
}

// Saved notes back as the log lines they were written as, for editing a session in the box it
// was recorded in: bullets dropped, one line each, and the heading (the block's name) left out,
// since composeWrapNote puts it back on save.
export function logLines(notes, title) {
  const head = String(title || '').trim().toLowerCase();
  return String(notes || '').split('\n')
    .map((l) => l.replace(/^\s*[•*-]\s*/, '').trim())
    .filter((l) => l && l.toLowerCase() !== head);
}
