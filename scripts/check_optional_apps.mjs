#!/usr/bin/env node
// OmniTrack works on a plain Frappe site; ERPNext and Frappe HR add to it when present.
// Saving a block never fails for a missing Project/Task/Timesheet DocType, desk content never
// names a DocType the site lacks, and the two endpoints that write other people's data stay shut:
// the sync receiver needs a connection's signature, and rebuilding attendance needs a manager.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const problems = [];
const need = (ok, what) => { if (!ok) problems.push(what); };

const mixin = read("omnitrack/utils/optional_links.py");
need(/def _validate_links\(self\):/.test(mixin), "optional_links.py: overrides _validate_links (it runs before validate, so a controller cannot do this later)");
need(/not frappe\.db\.exists\("DocType", df\.options\)/.test(mixin), "optional_links.py: only links to an absent DocType are skipped");
need(/finally:\s*\n\s*for fieldname, value in held\.items\(\):\s*\n\s*self\.set\(fieldname, value\)/.test(mixin), "optional_links.py: the skipped values are put back, so nothing typed is lost");

for (const [file, cls] of [
  ["omnitrack/omnitrack/doctype/planned_work_block/planned_work_block.py", "PlannedWorkBlock"],
  ["omnitrack/omnitrack/doctype/omnitrack_workspace/omnitrack_workspace.py", "OmniTrackWorkspace"],
  ["omnitrack/omnitrack/doctype/omnitrack_remote_connection/omnitrack_remote_connection.py", "OmniTrackRemoteConnection"],
]) {
  need(new RegExp(`class ${cls}\\(OptionalLinks, Document\\):`).test(read(file)), `${cls}: mixes in OptionalLinks before Document`);
}

const hooks = read("omnitrack/hooks.py");
need(!/^\s*required_apps\s*=.*(erpnext|hrms)/m.test(hooks), "hooks.py: ERPNext and Frappe HR are never required apps");

const sync = read("omnitrack/sync.py");
need(!/default_secret/.test(sync), "sync.py: no built-in fallback secret; an unset secret means no sync");
need(/if not secret:\s*\n\s*conn\.db_set\("sync_error_log"[^\n]*\n\s*return/.test(sync), "sync.py: sending stops when the connection has no HMAC secret");
need(/hmac\.compare_digest\(/.test(sync), "sync.py: signatures are compared in constant time");
const recv = sync.slice(sync.indexOf("def receive_sync_event("));
const gate = recv.indexOf("if not _signed_by_a_connection(data_str, frappe.get_request_header(\"X-OmniTrack-Signature\")):");
need(gate > 0 && /frappe\.AuthenticationError/.test(recv.slice(gate, gate + 250)), "sync.py receive_sync_event: refuses a payload no connection signed");
need(gate > 0 && gate < recv.indexOf("json.loads(data_str)"), "sync.py receive_sync_event: checks the signature before reading the payload");
need(/if not frappe\.db\.exists\("DocType", "Task"\):\s*\n\s*return \{"status": "ignored"/.test(recv), "sync.py receive_sync_event: a site without Tasks ignores the event");

const syn = read("omnitrack/synthesizer.py");
const wrap = syn.slice(syn.indexOf("def synthesize_employee_attendance("), syn.indexOf("def _synthesize("));
need(/if not is_omnitrack_manager\(\):\s*\n\s*frappe\.throw\([^\n]*frappe\.PermissionError\)/.test(wrap), "synthesizer.py: only an OmniTrack Manager may rebuild attendance");
need(!/[^_]synthesize_employee_attendance\(/.test(syn.replace(/def synthesize_employee_attendance\(/, "")), "synthesizer.py: internal callers use _synthesize, not the whitelisted wrapper");

const install = read("omnitrack/install.py");
need(/present = \[sc for sc in ws\["shortcuts"\] if sc\["type"\] != "DocType" or frappe\.db\.exists\("DocType", sc\.get\("link_to"\)\)\]\s*\n\s*for i, sc in enumerate\(present\):/.test(install), "install.py: workspace content only shows shortcuts to DocTypes the site has");
const fields = install.slice(install.indexOf("def _ensure_custom_fields("), install.indexOf("def _ensure_default_settings("));
need(/if frappe\.db\.exists\("DocType", doctype\):/.test(fields), "install.py: custom fields go only on DocTypes the site has");

const tasks = read("omnitrack/api/tasks.py");
need(/if not frappe\.db\.exists\("DocType", doctype\):\s*\n\s*frappe\.throw\(_\("This site has no \{0\}\."\)/.test(tasks), "api/tasks.py: a workflow action on an absent DocType says so instead of crashing");

if (problems.length) {
  console.error("FAIL: OmniTrack runs without ERPNext and Frappe HR, and stays shut to strangers\n  " + problems.join("\n  "));
  process.exit(1);
}
