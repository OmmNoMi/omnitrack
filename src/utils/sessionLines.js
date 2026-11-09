// Which copy of a running session's log is kept. Every edit to the title, the log lines or the
// session's tasks stamps the copy with linesRev (when it was made). A poll that left before a new
// line reached the server, or a tab holding an older copy, once replaced the newer log with the
// older one, and the lines were gone when the session was saved. An older copy never wins now.
export function remoteLinesWin(remoteRev, localRev) {
  return (Number(remoteRev) || 0) >= (Number(localRev) || 0);
}

// The starts and blocks the session running here has had. Keep running moves the start and
// binding a block changes the block; until that save lands, a poll still brings the copy as it
// was. That copy is this session's own, out of date, and goes back up: taken for another
// session, it replaced the start and the log, and lines just added were gone.
export function ownSessionCopies() {
  let starts = [];
  let blocks = new Set();
  const near = (a, b) => Math.abs(a - b) <= 60000;
  return {
    note(start, block) {
      if (start && !starts.some(t => near(t, start))) starts.push(start);
      blocks.add(block || null);
    },
    forget() { starts = []; blocks = new Set(); },
    // A copy with a start or block this session has had, but not the ones it has now
    isOlder(copy, curStart, curBlock) {
      if (!copy || !copy.startTime) return false;
      const start = Number(copy.startTime), block = copy.trackerBlockName || null;
      const differs = !near(start, Number(curStart) || 0) || block !== (curBlock || null);
      return differs && starts.some(t => near(t, start)) && blocks.has(block);
    },
  };
}
