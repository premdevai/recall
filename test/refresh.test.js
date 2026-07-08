"use strict";
const { test } = require("node:test");
const assert = require("node:assert");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const REFRESH = path.join(ROOT, "skill", "refresh.js");
const RENDER = path.join(ROOT, "skill", "render.js");
const TMP = path.join(__dirname, "tmp", "refresh");
const REPO = path.join(TMP, "repo");
fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });
execFileSync("bash", [path.join(__dirname, "fixture-repo.sh"), REPO], { stdio: "pipe" });

const g = (args) => execFileSync("git", args, { cwd: REPO, encoding: "utf8", stdio: "pipe",
  env: { ...process.env, GIT_AUTHOR_DATE: "2025-07-01T10:00:00", GIT_COMMITTER_DATE: "2025-07-01T10:00:00" } });
function run(args) {
  return execFileSync("node", [REFRESH, ...args], { encoding: "utf8", stdio: "pipe" });
}
const LOG = path.join(REPO, ".recall", "refresh.log");
const logLines = () => fs.readFileSync(LOG, "utf8").trim().split("\n");
const digest = () => JSON.parse(fs.readFileSync(path.join(REPO, ".recall", "digest.json"), "utf8"));

test("first run: gathers, logs, says first-run", () => {
  const out = run(["--repo", REPO]);
  assert.match(out, /^first-run \d+$/m);
  assert.strictEqual(logLines().length, 1);
  assert.match(logLines()[0], /first-run/);
  assert.ok(digest().head_sha, "digest written");
});

test("W1: no new commits → unchanged, log appended not rewritten", () => {
  const out = run(["--repo", REPO]);
  assert.match(out, /^unchanged$/m);
  assert.strictEqual(logLines().length, 2, "log must append");
  assert.match(logLines()[1], /unchanged/);
});

test("W2: 5 new commits → changed 5, digest head advances", () => {
  const oldHead = digest().head_sha;
  for (let i = 1; i <= 5; i++) {
    fs.appendFileSync(path.join(REPO, "api", "routes.js"), `\n// change ${i}\n`);
    g(["add", "."]); g(["commit", "-q", "-m", `update api module (fresh ${i})`]);
  }
  const out = run(["--repo", REPO]);
  assert.match(out, /^changed 5$/m, "delta must be exactly 5: " + out);
  assert.notStrictEqual(digest().head_sha, oldHead);
  assert.strictEqual(logLines().length, 3);
  assert.match(logLines()[2], /changed \+5/);
});

test("corrupt previous digest → treated as first run, never a crash", () => {
  fs.writeFileSync(path.join(REPO, ".recall", "digest.json"), "{broken");
  const out = run(["--repo", REPO]);
  assert.match(out, /^first-run/m);
  assert.ok(digest().head_sha, "digest recovered");
});

test("not a git repo → exit 2, actionable, still no stack trace", () => {
  const empty = path.join(TMP, "not-a-repo");
  fs.mkdirSync(empty, { recursive: true });
  assert.throws(() => run(["--repo", empty]), (e) => {
    assert.strictEqual(e.status, 2);
    assert.ok(!e.stderr.toString().includes("at Object."), "stack trace leaked");
    return true;
  });
});

// ---------- since-last (W3, W5) ----------

const evidence = (ids) => ({
  schema_version: 2,
  subject: { engineer: "Maya R", repo: "cobalt-web", tenure: { from: "2025-01-01", to: "2025-07-01" } },
  stats: { commits: 120 },
  accomplishments: ids.map((id) => ({
    id, category: "API design", title: "Shipped " + id, confidence: id === "zero" ? 0 : 80,
    resumeBullet: "Did " + id + ".",
    evidence: id === "talk" ? [{ type: "self", ref: "told to recall 2025-06-01" }]
      : id === "measured" ? [{ type: "commit", ref: "sha" + id }, { type: "metric", ref: "Datadog", detail: "p75 -40%" }]
      : [{ type: "commit", ref: "sha" + id }],
  })),
});
const EVP = path.join(REPO, ".recall", "evidence.json");
const SNAP = path.join(REPO, ".recall", "snapshot.json");
const render = (args) => execFileSync("node", [RENDER, ...args], { encoding: "utf8", stdio: "pipe", cwd: REPO });
const sinceMd = () => fs.readFileSync(path.join(REPO, "since-last.md"), "utf8");

test("since-last without a snapshot dies with a pointer to a full report", () => {
  fs.writeFileSync(EVP, JSON.stringify(evidence(["a", "b"])));
  fs.rmSync(SNAP, { force: true });
  assert.throws(() => render(["--since-last", "--evidence", EVP]),
    (e) => e.status === 2 && /full report/.test(e.stderr.toString()));
});

test("full render stamps a snapshot with ALL ids — even ones the confidence filter dropped", () => {
  fs.writeFileSync(EVP, JSON.stringify(evidence(["a", "b", "zero"])));
  render(["--evidence", EVP, "--digest", path.join(REPO, ".recall", "digest.json"),
    "--out", path.join(REPO, "journey.html"), "--md", path.join(REPO, "journey.md")]);
  const s = JSON.parse(fs.readFileSync(SNAP, "utf8"));
  assert.deepStrictEqual(s.ids.sort(), ["a", "b", "zero"], "zero-confidence id must be in the snapshot");
  assert.strictEqual(s.totals.accomplishments, 3);
});

test("W3: delta lists exactly the new items, totals reconcile, markers survive", () => {
  fs.writeFileSync(EVP, JSON.stringify(evidence(["a", "b", "zero", "c", "talk"])));
  render(["--since-last", "--evidence", EVP]);
  const md = sinceMd();
  assert.match(md, /2 new accomplishments/, "exactly c + talk are new");
  assert.match(md, /Shipped c/);
  assert.match(md, /Shipped talk.*self-reported/, "new self-reported item must be marked");
  assert.doesNotMatch(md, /Shipped a\b/, "old items must not reappear");
  assert.match(md, /3 → 5/, "totals must reconcile old → new");
});

test("nudge: delta with no measured result carries the nudge; measured delta does not", () => {
  assert.match(sinceMd(), /no measured result/i, "nudge expected");
  fs.writeFileSync(EVP, JSON.stringify(evidence(["a", "b", "zero", "measured"])));
  render(["--since-last", "--evidence", EVP]);
  assert.doesNotMatch(sinceMd(), /no measured result/i, "measured delta must not nudge");
});

test("W5: since-last never advances the snapshot — empty delta twice in a row", () => {
  fs.writeFileSync(EVP, JSON.stringify(evidence(["a", "b", "zero"])));
  for (let i = 0; i < 2; i++) {
    render(["--since-last", "--evidence", EVP]);
    assert.match(sinceMd(), /Nothing new/, "run " + i);
  }
  const s = JSON.parse(fs.readFileSync(SNAP, "utf8"));
  assert.deepStrictEqual(s.ids.sort(), ["a", "b", "zero"], "snapshot must be untouched by since-last");
});

test("newer snapshot schema is refused with a migration hint", () => {
  const s = JSON.parse(fs.readFileSync(SNAP, "utf8"));
  s.schema_version = 9;
  fs.writeFileSync(SNAP, JSON.stringify(s));
  assert.throws(() => render(["--since-last", "--evidence", EVP]),
    (e) => e.status === 2 && /newer/.test(e.stderr.toString()));
});
