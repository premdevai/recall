"use strict";
const { test } = require("node:test");
const assert = require("node:assert");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const MERGE = path.join(ROOT, "skill", "merge.js");
const RENDER = path.join(ROOT, "skill", "render.js");
const TMP = path.join(__dirname, "tmp", "career");
const HOME = path.join(TMP, "home"); // RECALL_HOME override — never touch the real ~/.recall
fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(HOME, { recursive: true });

function evidence(repo, employer, shas, opts = {}) {
  return {
    schema_version: 2,
    subject: { engineer: "Maya R", repo, employer, tenure: opts.tenure || { from: "2023-01-01", to: "2023-12-01" } },
    stats: { commits: opts.commits || 100 },
    skills: [{ name: "API design", prs: 5, commits: 40, lastTouched: opts.tenure ? opts.tenure.to : "2023-12-01" }],
    enabled: opts.enabled,
    accomplishments: shas.map((sha, i) => ({
      id: "a" + i, category: "API design", title: `Shipped feature ${i} in ${repo}`,
      resumeBullet: `Did the thing ${i}.`, confidence: 80,
      evidence: [{ type: "commit", ref: sha }],
    })),
  };
}

function addRepo(name, ev, repoId) {
  const dir = path.join(TMP, name, ".recall");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "evidence.json"), JSON.stringify(ev));
  run(["--add", "--repo", path.join(TMP, name), "--repo-id", repoId]);
}

function run(args, home = HOME) {
  return execFileSync("node", [MERGE, ...args], {
    encoding: "utf8", stdio: "pipe", env: { ...process.env, RECALL_HOME: home },
  });
}
const career = () => JSON.parse(fs.readFileSync(path.join(HOME, "career.json"), "utf8"));

// three employers; the fork repo mixes inherited shas with unique new work,
// bolt carries enabled counts
addRepo("acme-web", evidence("acme-web", "Acme", ["sha1000aa", "sha1001bb", "sha1002cc"],
  { tenure: { from: "2021-01-01", to: "2022-06-01" }, commits: 300 }), "repoAAA");
addRepo("bolt-api", evidence("bolt-api", "Bolt", ["sha2000aa", "sha2001bb"],
  { tenure: { from: "2022-07-01", to: "2023-12-01" }, commits: 200,
    enabled: { prsReviewed: 40, reviews: 120, approvals: 33 } }), "repoBBB");
const fork = evidence("acme-fork", "Acme", ["sha1000aa"],
  { tenure: { from: "2022-01-01", to: "2022-06-01" }, commits: 50 });
fork.accomplishments.push({
  id: "mix1", category: "API design", title: "Post-fork hardening in acme-fork",
  resumeBullet: "Hardened the fork.", confidence: 75,
  evidence: [{ type: "commit", ref: "sha1001bb" }, { type: "commit", ref: "sha3000zz" }],
});
addRepo("acme-fork", fork, "repoCCC");

test("C1: merge — totals sum, ids unique, segments ordered by tenure", () => {
  const c = career();
  assert.strictEqual(c.totals.repos, 3);
  assert.strictEqual(c.totals.commits, 550);
  const ids = c.accomplishments.map((a) => a.id);
  assert.strictEqual(new Set(ids).size, ids.length, "duplicate accomplishment ids");
  assert.deepStrictEqual(c.segments.map((s) => s.employer), ["Acme", "Acme", "Bolt"]);
});

test("C2: same repo added twice → one store entry", () => {
  addRepo("acme-web", evidence("acme-web", "Acme", ["sha1000aa", "sha1001bb", "sha1002cc"],
    { tenure: { from: "2021-01-01", to: "2022-06-01" }, commits: 300 }), "repoAAA");
  assert.strictEqual(fs.readdirSync(path.join(HOME, "store")).length, 3);
  assert.strictEqual(career().totals.repos, 3);
});

test("C3: fork dedupe — fully-inherited work dropped, mixed work kept", () => {
  const c = career();
  // fork a0 cites only the inherited sha1000aa → deduped; mix1 bundles an
  // inherited sha with unique sha3000zz → kept (unique work never vanishes)
  assert.strictEqual(c.totals.deduped, 1);
  assert.strictEqual(c.totals.accomplishments, 6);
  assert.ok(c.accomplishments.some((a) => a.id === "repoCC:mix1"), "mixed accomplishment must survive");
});

test("C4: self-reported — marked and counted even when source is missing or typo'd", () => {
  const ev = evidence("bolt-api", "Bolt", ["sha2000aa", "sha2001bb"],
    { tenure: { from: "2022-07-01", to: "2023-12-01" }, commits: 200,
      enabled: { prsReviewed: 40, reviews: 120, approvals: 33 } });
  ev.accomplishments.push({
    // no source field at all — only type:self evidence; normalization must
    // classify it self-reported, never verified
    id: "talk1", category: "Communication", title: "Spoke at LocalConf on API design",
    resumeBullet: "Gave a conference talk.", confidence: 55,
    evidence: [{ type: "self", ref: "told to recall 2023-11-01" }],
  });
  ev.accomplishments.push({
    id: "x1", category: "API design", title: "Replaced the legacy ACME SDK used by acme-web",
    resumeBullet: "Killed the ACME dependency.", confidence: 50, // below the talk so the talk lands in top-3

    evidence: [{ type: "commit", ref: "sha2002cc" }],
  });
  addRepo("bolt-api", ev, "repoBBB");
  const c = career();
  assert.strictEqual(c.totals.selfReported, 1);
  assert.strictEqual(c.totals.verified, c.totals.accomplishments - 1);
  // the talk lands in bolt's top-3 → the timeline itself must carry the marker
  const bolt = c.segments.find((s) => s.employer === "Bolt");
  assert.ok(bolt.top.some((t) => t.includes("LocalConf") && t.includes("(self-reported)")), "top list must mark self-reported");
  const md = path.join(TMP, "career.md");
  execFileSync("node", [RENDER, "--career", path.join(HOME, "career.json"), "--md", md], { stdio: "pipe" });
  assert.match(fs.readFileSync(md, "utf8"), /Self-reported \(not independently verified\)[\s\S]*LocalConf/);
});

test("C5: --exclude-employer — excluded names scrubbed even from kept entries", () => {
  const out = run(["--exclude-employer", "Acme"]);
  // bolt's x1 title cross-references ACME and acme-web — must be scrubbed, not just the entries dropped
  assert.ok(!out.toLowerCase().includes("acme"), "excluded employer leaked (any case)");
  assert.ok(out.includes("[redacted] SDK"), "cross-mention should be redacted, not deleted");
  const v = JSON.parse(out);
  assert.strictEqual(v.totals.repos, 1);
  assert.strictEqual(v.segments[0].employer, "Bolt");
});

test("C6: --anonymize — names (any case), free-text mentions, and store ids all masked", () => {
  const out = run(["--anonymize"]);
  assert.ok(!out.toLowerCase().includes("acme") && !out.toLowerCase().includes("bolt"), "name leaked through --anonymize");
  assert.ok(!out.includes("repoAA") && !out.includes("repoBB") && !out.includes("repoCC"), "store id (root-commit sha) leaked");
  assert.ok(out.includes("Employer A"), "aliases expected");
  assert.ok(out.includes("Shipped feature 0"), "accomplishment content must survive");
  assert.ok(JSON.parse(out).segments.length === 3, "anonymized view must stay valid JSON");
});

test("C7: enabled rolls up separately from authored counts", () => {
  const c = career();
  assert.deepStrictEqual(c.enabled, { prsReviewed: 40, reviews: 120, approvals: 33 });
  assert.strictEqual(c.totals.commits, 550, "enabled must not inflate commit totals");
});

test("C8: store files are private (0600)", () => {
  const f = path.join(HOME, "store", "repoAAA", "evidence.json");
  assert.strictEqual(fs.statSync(f).mode & 0o777, 0o600);
});

test("C9: empty store fails with a pointer, not a stack trace", () => {
  assert.throws(() => run([], path.join(TMP, "empty")),
    (e) => e.status === 2 && /--add/.test(e.stderr.toString()));
});

test("C10: --add refuses malformed evidence instead of poisoning the store", () => {
  const dir = path.join(TMP, "bad-repo", ".recall");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "evidence.json"), JSON.stringify({ schema_version: 2, accomplishments: [] }));
  assert.throws(() => run(["--add", "--repo", path.join(TMP, "bad-repo"), "--repo-id", "badbadbad"]),
    (e) => e.status === 2 && /subject/.test(e.stderr.toString()));
  assert.ok(!fs.existsSync(path.join(HOME, "store", "badbadbad")), "no store entry for rejected evidence");
});

test("C11: view guard rails — no --add combo, no clobbering canonical career.json", () => {
  assert.throws(() => run(["--add", "--anonymize"]), (e) => e.status === 2 && /cannot combine/.test(e.stderr.toString()));
  assert.throws(() => run(["--anonymize", "--out", path.join(HOME, "career.json")]),
    (e) => e.status === 2 && /refusing to overwrite/.test(e.stderr.toString()));
});
