// The notes a session is saved with when it is switched for the next one: its title, then its log
// lines as bullets. The switch dialog never asks for these again; it takes one optional last line,
// which joins the log as its final bullet.
export function composeWrapNote(title, logLines, lastLine) {
  const lines = [...(logLines || []), lastLine].map((p) => String(p || '').trim()).filter(Boolean);
  const head = String(title || '').trim();
  const bullets = lines.map((p) => `• ${p}`).join('\n');
  return head && bullets ? `${head}\n\n${bullets}` : (head || bullets);
}
