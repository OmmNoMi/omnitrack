// Which copy of a running session's log is kept. Every edit to the title, the log lines or the
// session's tasks stamps the copy with linesRev (when it was made). A poll that left before a new
// line reached the server, or a tab holding an older copy, once replaced the newer log with the
// older one, and the lines were gone when the session was saved. An older copy never wins now.
export function remoteLinesWin(remoteRev, localRev) {
  return (Number(remoteRev) || 0) >= (Number(localRev) || 0);
}
