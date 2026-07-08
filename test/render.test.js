"use strict";
const { test } = require("node:test");
const assert = require("node:assert");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const FIX = path.join(__dirname, "tmp", "fixture-render"); // own dir: test files run in parallel
const RENDER = path.join(ROOT, "skill", "render.js");
const TEMPLATE = path.join(ROOT, "skill", "template.html");
const TMP = path.join(__dirname, "tmp");

execFileSync("bash", [path.join(__dirname, "fixture-repo.sh"), FIX], { stdio: "pipe" });
execFileSync("node", [path.join(ROOT, "skill", "gather.js"), "--repo", FIX], { stdio: "pipe" });

const evidence = {
  schema_version: 2,
  subject: { engineer: "Maya R", repo: "fixture", tenure: { from: "2024-01-02", to: "2024-05-01" }, sources: ["git", "jira"] },
  stats: { commits: 108, prsMerged: 14 },
  skills: [{ name: "API design", subtitle: "rest · pagination", prs: 9, commits: 40, lastTouched: "2024-05-01", activity: { unit: "quarter", values: [4, 12, 24] } }],
  phases: [{ key: "act-1", title: "Learning the terrain", from: "2024-01-02", to: "2024-03-01", narrative: "Ramp-up and first features." }],
  signals: [{ source: "Jira", name: "Tickets delivered", to: 9, rows: [{ label: "Epics", value: 1 }] }],
  accomplishments: [
    {
      id: "a1", category: "API design", title: "Shipped paginated listing API", phase: "act-1", date: "2024-02-10",
      star: { situation: "Endpoints returned unbounded lists <at scale>.", task: "Bound the payloads.", action: "Added cursor pagination.", result: "p95 payload cut 30x." },
      resumeBullet: "Cut list-endpoint p95 payload 30x via cursor pagination.",
      confidence: 85, evidence: [{ type: "pr", ref: "14" }, { type: "commit", ref: "abc123def4" }, { type: "ticket", ref: "PROJ-13" }],
    },
    { id: "a2", category: "Docs", title: "Fixed a typo", confidence: 5, evidence: [{ type: "commit", ref: "beef00" }] },
  ],
  ledger: [{ group: "API design", items: ["cursor pagination", "rate limiting"] }],
};

const evPath = path.join(TMP, "evidence.json");
const outHtml = path.join(TMP, "j.html");
const outMd = path.join(TMP, "j.md");
fs.writeFileSync(evPath, JSON.stringify(evidence));

function render(extra = []) {
  return execFileSync("node", [RENDER, "--evidence", evPath, "--digest", path.join(FIX, ".recall", "digest.json"),
    "--out", outHtml, "--md", outMd, ...extra], { encoding: "utf8", stdio: "pipe" });
}
render();
const html = fs.readFileSync(outHtml, "utf8");
const md = fs.readFileSync(outMd, "utf8");

test("R1: no unfilled placeholders; content present; low-confidence filtered", () => {
  assert.ok(!/\{\{/.test(html), "unfilled placeholder in HTML");
  assert.ok(html.includes("Shipped paginated listing API"));
  assert.ok(html.includes("PROJ-13"));
  assert.ok(!html.includes("Fixed a typo"), "confidence 5 item should be filtered at default 40");
  assert.ok(html.includes("&lt;at scale&gt;"), "user strings must be HTML-escaped");
});

test("R2: locked design — style and script blocks land verbatim", () => {
  const tpl = fs.readFileSync(TEMPLATE, "utf8");
  const style = tpl.match(/<style>\n[\s\S]*?<\/style>/)[0]; // the real block, not the header-comment mention
  assert.ok(html.includes(style), "style block was altered");
  const script = tpl.match(/<script>\n[\s\S]*?<\/script>/)[0];
  assert.ok(html.includes(script), "script block was altered");
});

test("R3: signals render from evidence; section removed when absent", () => {
  assert.ok(html.includes("Tickets delivered"));
  const noSig = { ...evidence, signals: [] };
  fs.writeFileSync(evPath, JSON.stringify(noSig));
  render();
  const h2 = fs.readFileSync(outHtml, "utf8");
  assert.ok(!h2.includes('id="signals"'), "empty signals section must be removed");
  fs.writeFileSync(evPath, JSON.stringify(evidence)); render();
});

test("R4: markdown mirror carries the same evidence", () => {
  assert.ok(md.includes("Cut list-endpoint p95 payload 30x"));
  assert.ok(md.includes("PROJ-13"));
  assert.ok(/[▁▂▃▄▅▆▇█]{3}/.test(md), "unicode sparkline expected");
});

test("R5: schema_version newer than renderer is refused; v1 still accepted", () => {
  fs.writeFileSync(evPath, JSON.stringify({ ...evidence, schema_version: 3 }));
  assert.throws(() => render(), (e) => e.status === 2 && /schema_version 3/.test(e.stderr));
  fs.writeFileSync(evPath, JSON.stringify({ ...evidence, schema_version: 1 }));
  render(); // v1 files predate self-reported and must keep rendering
  fs.writeFileSync(evPath, JSON.stringify(evidence));
});

test("R6: a claim without evidence is refused", () => {
  const bad = JSON.parse(JSON.stringify(evidence));
  bad.accomplishments[0].evidence = [];
  fs.writeFileSync(evPath, JSON.stringify(bad));
  assert.throws(() => render(), (e) => e.status === 2 && /no evidence/.test(e.stderr));
  fs.writeFileSync(evPath, JSON.stringify(evidence));
});

test("R8: self-reported is marked everywhere, even when source is omitted", () => {
  const withSelf = JSON.parse(JSON.stringify(evidence));
  withSelf.accomplishments.push({
    // no source field — only type:self evidence; normalization must mark it
    id: "sr1", category: "Communication", title: "Mentored two juniors", phase: "act-1",
    date: "2024-03-01", resumeBullet: "Mentored two juniors to promotion.",
    confidence: 60, evidence: [{ type: "self", ref: "told to recall 2024-03-01" }],
  });
  fs.writeFileSync(evPath, JSON.stringify(withSelf));
  render();
  const h = fs.readFileSync(outHtml, "utf8");
  const m = fs.readFileSync(outMd, "utf8");
  assert.ok(h.includes("Mentored two juniors (self-reported)"), "HTML log/milestones must mark self-reported");
  assert.match(m, /Mentored two juniors to promotion\. _\(self-reported\)_/, "résumé bullets must mark self-reported");
  assert.ok(h.includes("Self-reported items are marked"), "footer provenance note expected");
  fs.writeFileSync(evPath, JSON.stringify(evidence)); render();
});

test("R7: renders without a digest (git-only extras removed, still valid)", () => {
  const out2 = path.join(TMP, "j2.html");
  execFileSync("node", [RENDER, "--evidence", evPath, "--digest", "/nonexistent",
    "--out", out2, "--md", path.join(TMP, "j2.md")], { stdio: "pipe" });
  const h = fs.readFileSync(out2, "utf8");
  assert.ok(!h.includes('id="activity"'), "activity section requires the digest");
  assert.ok(!/\{\{/.test(h));
});
