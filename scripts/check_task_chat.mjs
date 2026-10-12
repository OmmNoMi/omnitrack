#!/usr/bin/env node
// Task chat is a Raven channel on an ERPNext Task, shared by everyone on the task. It is not a
// block's or a session's chat: a to-do, a block and a session are talked about in their own
// Activity, under Details. Each rule below was broken once:
//   - a to-do block sent its own name as the task, the server could not make a channel for it,
//     and Send did nothing: no message, no error, the typed text still there;
//   - the reply's { success: false } was never read, so a refusal looked like a click that missed;
//   - Send was out of the tab order, and the tab never said whose chat it was.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const problems = [];
const need = (where, body, re, what) => { if (!re.test(body)) problems.push(`${where}: ${what}`); };
const forbid = (where, body, re, what) => { if (re.test(body)) problems.push(`${where}: ${what}`); };

const CHAT = "src/session/useSessionChat.js";
const chat = read(CHAT);
const between = (src, from, to) => {
  const i = src.indexOf(from);
  if (i < 0) return "";
  const j = src.indexOf(to, i + from.length);
  return src.slice(i, j < 0 ? undefined : j);
};

// 1. Only an ERPNext Task has a chat
const conn = between(chat, "const connectedTaskId = computed(", "\n  });");
need(CHAT, conn, /if \(blk\) return blk\.task \|\| null;/, "a block's chat is its ERPNext Task's, or none");
forbid(CHAT, conn, /\.name\b/, "a block's own name is never sent as a task");
need(CHAT, conn, /t\.kind === 'Task'/, "a to-do picked by title is never sent as a task");
need(CHAT, chat, /isRavenAvailable\.value && connectedTaskId\.value \? \['chat'\] : \[\]/, "the Task chat tab is offered only with a Task to chat about");

// 2. A message not sent says so, under the box, and keeps what was typed
const send = between(chat, "async function sendChatMessage(", "\n  }\n");
need(CHAT, send, /chatError\.value = '';/, "a new try clears the last refusal");
need(CHAT, send, /\} else \{\n\s*chatError\.value = 'Not sent\. '/, "a refused message says Not sent and why");
need(CHAT, send, /catch \(e\) \{\n\s*chatError\.value = 'Not sent\. '/, "a failed request says Not sent and why");
forbid(CHAT, send, /console\.(error|warn)/, "a refusal is shown, not only logged");
forbid(CHAT, between(send, "if (res && res.message && res.message.success)", "} else"), /chatError\.value = '[^']/, "a sent message shows no error");
const pin = between(chat, "async function pinSpec(", "\n  }\n");
need(CHAT, pin, /\} else \{\n\s*chatError\.value = 'Not pinned\. '/, "a refused pin says Not pinned and why");

// 3. The tab says whose chat it is, and Send can be reached and heard
const PANE = "src/session/SessionLogPane.vue";
const pane = read(PANE);
need(PANE, pane, /v-if="isRavenAvailable && connectedTaskId && !isEntry"/, "the Task chat tab shows only with a Task to chat about");
need(PANE, pane, /With everyone on the task <span[^>]*>\{\{ chatTaskSubject \}\}<\/span>/, "the chat names the task it belongs to");
need(PANE, pane, /<p v-if="chatError" role="alert"[^>]*>\{\{ chatError \}\}<\/p>/, "a refusal is announced under the box");
const sendBtn = between(pane, '@click="sendChatMessage"', "</Button>");
forbid(PANE, sendBtn, /tabindex="-1"/, "Send is in the tab order");
need(PANE, sendBtn, /enabled:!bg-blue-700/, "Send is AA blue when it can send");

// 4. The server makes a channel only for a real Task
const RB = "omnitrack/raven_bridge.py";
const rb = read(RB);
need(RB, rb, /if doctype != "Task" or not frappe\.db\.exists\("Task", clean_id\):\n\t\treturn None/, "no channel is made for anything but a real Task");
need(RB, rb, /if not channel_id:\n\t\treturn \{"success": False, "error": _\("Only an ERPNext Task has a chat/, "a message with no channel says why");

if (problems.length) {
  console.error("FAIL: Task chat:\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log("OK: Task chat is the ERPNext Task's, says so, and a message not sent says why");
