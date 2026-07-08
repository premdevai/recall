"use strict";
const { test } = require("node:test");
const assert = require("node:assert");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const TRACK = path.join(__dirname, "..", "skill", "track.js");
const TMP = path.join(__dirname, "tmp", "track");
fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });
const FILE = path.join(TMP, ".recall", "applications.json");

function run(args) {
  return execFileSync("node", [TRACK, ...args], { encoding: "utf8", stdio: "pipe", cwd: TMP });
}
function fails(args, re) {
  assert.throws(() => run(args), (e) => {
    assert.strictEqual(e.status, 2, "exit code");
    assert.match(e.stderr.toString(), re);
    assert.ok(!e.stderr.toString().includes("at Object."), "stack trace leaked to the user");
    return true;
  });
}
const db = () => JSON.parse(fs.readFileSync(FILE, "utf8"));

test("T2 first: --status before anything exists dies with a pointer", () => {
  fails(["--status"], /--add/);
});

test("T1: add starts at drafted with a timestamp; the full legal path walks through", () => {
  run(["--add", "--company", "Acme", "--role", "Senior Backend", "--jd-hash", "abc123def456",
    "--artifact", ".recall/apply-acme.md"]);
  let a = db().applications[0];
  assert.strictEqual(a.id, "acme--senior-backend");
  assert.strictEqual(a.events[0].status, "drafted");
  assert.match(a.events[0].at, /^\d{4}-\d{2}-\d{2}T/);
  for (const s of ["applied", "screen", "interview", "offer", "closed"])
    run(["--app", "acme--senior-backend", "--set", s]);
  a = db().applications[0];
  assert.deepStrictEqual(a.events.map((e) => e.status),
    ["drafted", "applied", "screen", "interview", "offer", "closed"]);
});

test("T1: illegal jump drafted→offer rejected; closed is terminal; unknown status lists the legal ones", () => {
  run(["--add", "--company", "Bolt", "--role", "Staff SRE"]);
  fails(["--app", "bolt--staff-sre", "--set", "offer"], /"drafted".*applied/s);
  fails(["--app", "acme--senior-backend", "--set", "applied"], /terminal/);
  fails(["--app", "bolt--staff-sre", "--set", "hired"], /unknown status.*applied/s);
});

test("append-only: a transition never rewrites prior events", () => {
  const before = db().applications.find((a) => a.id === "bolt--staff-sre").events.map((e) => ({ ...e }));
  run(["--app", "bolt--staff-sre", "--set", "applied"]);
  const after = db().applications.find((a) => a.id === "bolt--staff-sre").events;
  assert.deepStrictEqual(after.slice(0, before.length), before, "history was rewritten");
  assert.strictEqual(after.length, before.length + 1);
});

test("same company twice → distinct ids; bare company match is ambiguous and says so", () => {
  run(["--add", "--company", "Bolt", "--role", "Platform Lead"]);
  fails(["--app", "bolt", "--set", "applied"], /ambiguous.*bolt--staff-sre.*bolt--platform-lead/s);
  run(["--app", "bolt--platform-lead", "--set", "applied"]); // full id still works
  fails(["--app", "Vandelay", "--set", "applied"], /no application matches/);
});

test("duplicate --add refused; company with quotes survives as data, not string surgery", () => {
  fails(["--add", "--company", "Acme", "--role", "Senior Backend"], /already tracked/);
  run(["--add", "--company", 'Acme "West"', "--role", "Backend"]);
  assert.strictEqual(db().applications.find((a) => a.id === "acme-west--backend").company, 'Acme "West"');
});

test("T2: funnel is derived from the event log — counts always match the file", () => {
  const out = run(["--status"]);
  const counts = {};
  for (const a of db().applications) {
    const cur = a.events[a.events.length - 1].status;
    counts[cur] = (counts[cur] || 0) + 1;
  }
  for (const [s, n] of Object.entries(counts))
    assert.ok(out.includes(`${s} ${n}`), `funnel line must show "${s} ${n}": ${out.split("\n")[0]}`);
  assert.ok(out.includes("acme--senior-backend"), "per-application rows expected");
});

test("hand-edited garbage never becomes a stack trace", () => {
  const good = fs.readFileSync(FILE, "utf8");
  fs.writeFileSync(FILE, "{corrupt");
  fails(["--status"], /corrupt/);
  const poisoned = JSON.parse(good);
  poisoned.applications[0].events.push({ status: "ghosted", at: "2026-01-01T00:00:00Z" });
  fs.writeFileSync(FILE, JSON.stringify(poisoned));
  fails(["--app", poisoned.applications[0].id, "--set", "closed"], /unknown status "ghosted"/);
  const newer = JSON.parse(good); newer.schema_version = 2;
  fs.writeFileSync(FILE, JSON.stringify(newer));
  fails(["--status"], /newer/);
  const noEvents = JSON.parse(good);
  noEvents.applications[0].events = []; // hand-emptied log must die, not stack-trace
  fs.writeFileSync(FILE, JSON.stringify(noEvents));
  fails(["--status"], /malformed application/);
  fs.writeFileSync(FILE, good);
});

test("tracker file is private (0600)", () => {
  run(["--app", "acme-west--backend", "--set", "applied"]);
  assert.strictEqual(fs.statSync(FILE).mode & 0o777, 0o600);
});
