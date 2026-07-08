#!/usr/bin/env node
// recall track — the application tracker. Single writer for
// .recall/applications.json: each application is an append-only event log with
// timestamps; the current status is always the LAST event and the funnel is
// always derived by reducing the log — no parallel counters anywhere.
//
//   node track.js --add --company <c> --role <r> [--jd-hash <h>] [--artifact <path>]...
//   node track.js --app <id-or-company> --set <status>
//   node track.js --status
//
// Zero dependencies. File is plain JSON, chmod 600, local only.
"use strict";

const fs = require("fs");
const path = require("path");

const argv = process.argv.slice(2);
const flag = (n) => argv.includes("--" + n);
function opt(name, dflt) {
  const i = argv.indexOf("--" + name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
}
function optAll(name) {
  const out = [];
  for (let i = 0; i < argv.length; i++)
    if (argv[i] === "--" + name && argv[i + 1]) out.push(argv[i + 1]);
  return out;
}
function die(msg) { console.error("recall track: " + msg); process.exit(2); }

const FILE = opt("file", path.join(".recall", "applications.json"));
// the legal funnel; closed is reachable from anywhere (rejection/withdrawal)
const NEXT = {
  drafted: ["applied", "closed"],
  applied: ["screen", "closed"],
  screen: ["interview", "closed"],
  interview: ["offer", "closed"],
  offer: ["closed"],
  closed: [],
};
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "x";
const cur = (app) => app.events[app.events.length - 1].status;

function load() {
  if (!fs.existsSync(FILE)) return null;
  let d;
  try { d = JSON.parse(fs.readFileSync(FILE, "utf8")); }
  catch (e) { die(FILE + " is corrupt — " + e.message); }
  if (d.schema_version && d.schema_version > 1)
    die(`applications schema_version ${d.schema_version} is newer than this tool (1). Update recall: npx @premdevai/recall@latest`);
  if (!Array.isArray(d.applications)) die(FILE + " is malformed (no applications array)");
  for (const a of d.applications)
    if (!a.id || !Array.isArray(a.events) || !a.events.length)
      die(FILE + ` has a malformed application entry (${a.id || "no id"}) — fix the file by hand`);
  return d;
}
function save(d) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(d, null, 2), { mode: 0o600 });
  try { fs.chmodSync(FILE, 0o600); } catch {} // mode is ignored if the file pre-existed
}

if (flag("add")) {
  const company = opt("company", null), role = opt("role", null);
  if (!company || !role) die("--add needs --company and --role");
  const d = load() || { schema_version: 1, applications: [] };
  const id = slug(company) + "--" + slug(role);
  if (d.applications.some((a) => a.id === id))
    die(`${id} is already tracked — move it with --app ${id} --set <status>`);
  d.applications.push({
    id, company, role,
    jd_hash: opt("jd-hash", null),
    artifacts: optAll("artifact"),
    events: [{ status: "drafted", at: new Date().toISOString() }],
  });
  save(d);
  console.error(`recall track: added ${id} (drafted)`);
  process.exit(0);
}

const target = opt("app", null);
const to = opt("set", null);
if (target && to) {
  const d = load();
  if (!d || !d.applications.length) die("no applications tracked yet — start one with --add --company <c> --role <r>");
  if (!(to in NEXT)) die(`unknown status "${to}" — one of: ${Object.keys(NEXT).join(", ")}`);
  let hits = d.applications.filter((a) => a.id === target);
  if (!hits.length) hits = d.applications.filter((a) => a.company.toLowerCase() === target.toLowerCase());
  if (!hits.length) die(`no application matches "${target}" — tracked: ${d.applications.map((a) => a.id).join(", ")}`);
  if (hits.length > 1) die(`"${target}" is ambiguous — use an id: ${hits.map((a) => a.id).join(", ")}`);
  const app = hits[0], from = cur(app);
  if (!(from in NEXT)) die(`${app.id} has unknown status "${from}" in ${FILE} — fix the file by hand`);
  if (!NEXT[from].includes(to))
    die(`${app.id} is "${from}" — ${NEXT[from].length ? `next can be ${NEXT[from].join(" or ")}` : "that's terminal"}, not "${to}"`);
  app.events.push({ status: to, at: new Date().toISOString() }); // append-only: history is never rewritten
  save(d);
  console.error(`recall track: ${app.id} ${from} → ${to}`);
  process.exit(0);
}

if (flag("status")) {
  const d = load();
  if (!d || !d.applications.length) die("no applications tracked yet — start one with --add --company <c> --role <r>");
  const counts = {};
  for (const a of d.applications) counts[cur(a)] = (counts[cur(a)] || 0) + 1;
  console.log(Object.keys(NEXT).map((s) => `${s} ${counts[s] || 0}`).join(" → "));
  for (const a of d.applications) {
    const last = a.events[a.events.length - 1];
    console.log(`  ${a.id} · ${a.company} — ${a.role} · ${last.status} since ${String(last.at).slice(0, 10)}${a.artifacts.length ? " · " + a.artifacts.join(", ") : ""}`);
  }
  process.exit(0);
}

die("pass --add, --app <id> --set <status>, or --status");
