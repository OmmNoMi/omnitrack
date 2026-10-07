// How many words a session's notes hold, counted exactly as the server counts them
// (omnitrack/utils/validators.py require_session_notes): bullets and punctuation are spaces.
// Stop checks this before the clock is torn down. A session refused by the server for being
// short was once already cleared, and an hour of work was lost.
export function countSessionWords(text) {
  return String(text || '').replace(/[•\-*\n\r\t,;:.]/g, ' ').split(/\s+/).filter(Boolean).length;
}

// OmniTrack Settings > Minimum Words per Session, rendered into the page at boot (15 by default,
// as on the server).
export function minSessionWords(session) {
  const n = Number(session && session.min_session_words);
  return n > 0 ? n : 15;
}
