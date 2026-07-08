"use strict";
const { test } = require("node:test");
const assert = require("node:assert");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const FIX = path.join(__dirname, "tmp", "fixture");
const GATHER = path.join(ROOT, "skill", "gather.js");

execFileSync("bash", [path.join(__dirname, "fixture-repo.sh"), FIX], { stdio: "pipe" });
const meta = JSON.parse(fs.readFileSync(path.join(FIX, ".git", "fixture-meta.json"), "utf8"));

function run(args) {
  return execFileSync("node", [GATHER, "--repo", FIX, ...args], { encoding: "utf8", stdio: "pipe" });
}
run([]);
const digest = JSON.parse(fs.readFileSync(path.join(FIX, ".recall", "digest.json"), "utf8"));

test("G1: commit count and chart sums reconcile", () => {
  assert.strictEqual(digest.totals.commits, meta.maya);
  const monthly = digest.charts.monthly.values.reduce((a, b) => a + b, 0);
  assert.strictEqual(monthly, meta.maya);
  const heat = digest.charts.heatmap.values.reduce((a, b) => a + b, 0);
  assert.strictEqual(heat, meta.maya); // fixture span < 366 days, so all days included
});

test("G2: mailmap aliases merge into one identity", () => {
  // maya@home.test commits are canonicalized by .mailmap and counted
  assert.ok(digest.identity.emails.includes("maya@work.test"));
  assert.strictEqual(digest.identity.name, "Maya R");
});

test("G3: ticket keys — exactly the planted ones, no SHA-256/UTF-8 false positives", () => {
  const keys = Object.keys(digest.tickets);
  assert.strictEqual(keys.length, meta.keys);
  assert.ok(keys.every((k) => k.startsWith("PROJ-")));
});

test("G4: exclude_paths removes areas from the digest", () => {
  fs.mkdirSync(path.join(FIX, ".recall"), { recursive: true });
  fs.writeFileSync(path.join(FIX, ".recall", "config.json"), JSON.stringify({ exclude_paths: ["docs/**"] }));
  run(["--out", path.join(FIX, ".recall", "digest2.json")]);
  const d2 = JSON.parse(fs.readFileSync(path.join(FIX, ".recall", "digest2.json"), "utf8"));
  assert.ok(!("docs" in d2.charts.areas), "docs area should be excluded");
  fs.unlinkSync(path.join(FIX, ".recall", "config.json"));
});

test("G5: no file contents leak into the digest; size bounded", () => {
  const raw = fs.readFileSync(path.join(FIX, ".recall", "digest.json"), "utf8");
  assert.ok(!raw.includes("CANARY_9E1_SECRET_CONTENT"), "file content leaked into digest");
  assert.ok(raw.length < 50 * 1024, `digest is ${raw.length} bytes, budget is 50KB`);
});

test("G6: candidates carry planted ticket commits", () => {
  const withKeys = digest.candidates.filter((c) => c.tickets.length);
  assert.strictEqual(withKeys.length, meta.keys);
});

test("G7: unknown author exits 2 with author list", () => {
  assert.throws(() => run(["--author", "nobody@nowhere"]), (e) => e.status === 2 && /Authors in this repo/.test(e.stderr));
});

test("G8: .recall/ auto-added to fixture .gitignore", () => {
  assert.match(fs.readFileSync(path.join(FIX, ".gitignore"), "utf8"), /^\.recall\/$/m);
});
