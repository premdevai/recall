"use strict";
const { test } = require("node:test");
const assert = require("node:assert");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const EXPORT = path.join(__dirname, "..", "skill", "export.js");
const RENDER = path.join(__dirname, "..", "skill", "render.js");
const TMP = path.join(__dirname, "tmp", "export");
fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });

function run(args) {
  return execFileSync("node", [EXPORT, ...args], { encoding: "utf8", stdio: "pipe", cwd: TMP });
}
function fails(args, re) {
  assert.throws(() => run(args), (e) => {
    assert.strictEqual(e.status, 2, "exit code");
    assert.match(e.stderr.toString(), re);
    return true;
  });
}
const write = (name, data) => {
  const p = path.join(TMP, name);
  fs.writeFileSync(p, JSON.stringify(data));
  return p;
};

const EV = write("evidence.json", {
  schema_version: 2,
  subject: { engineer: "Maya R", repo: "cobalt-web", employer: "Cobalt",
    tenure: { from: "2022-01-01", to: "2023-12-01" }, sources: ["git", "jira"] },
  stats: { commits: 412, prsMerged: 61 },
  skills: [{ name: "Performance", subtitle: "LCP · caching · CDNs", commits: 120 }, { name: "API design", commits: 80 }],
  accomplishments: [
    { id: "a1", category: "Performance", title: "Rebuilt the image pipeline", confidence: 90,
      resumeBullet: "Cut LCP p75 from 5.2s to 2.1s.", evidence: [{ type: "commit", ref: "sha900aa" }] },
    { id: "talk1", category: "Communication", title: "Spoke at LocalConf", confidence: 55,
      resumeBullet: "Gave a talk on web perf.",
      evidence: [{ type: "self", ref: "told to recall 2023-11-01" }] }, // no source field — must still be marked
  ],
});

const CAREER = write("career.json", {
  schema_version: 1, kind: "career", engineer: "Maya R",
  range: { from: "2021-01-01", to: "2023-12-01" },
  segments: [
    { repo_id: "r1", repo: "acme-web", employer: "Acme", from: "2021-01-01", to: "2022-06-01", commits: 300, accomplishments: 1, top: [] },
    { repo_id: "r2", repo: "cobalt-web", employer: "Cobalt", from: "2022-07-01", to: "2023-12-01", commits: 412, accomplishments: 1, top: [] },
  ],
  skills: [{ name: "Performance", commits: 200 }],
  totals: { repos: 2, commits: 712, accomplishments: 2, verified: 2, selfReported: 0 },
  accomplishments: [
    { id: "r1:a1", repo: "acme-web", employer: "Acme", category: "API design", title: "Shipped /v2", confidence: 85,
      resumeBullet: "Shipped /v2 with zero breaking changes.", evidence: [{ type: "commit", ref: "shaAAA" }] },
    { id: "r2:a1", repo: "cobalt-web", employer: "Cobalt", category: "Performance", title: "Rebuilt the image pipeline", confidence: 90,
      resumeBullet: "Cut LCP p75 by 60%.", evidence: [{ type: "commit", ref: "shaBBB" }] },
  ],
});

// ---------- X1: JSON Resume ----------

test("X1: single-repo evidence → structurally valid JSON Resume, self-reported marked", () => {
  run(["--json-resume", "--evidence", EV, "--out", "resume.json"]);
  const r = JSON.parse(fs.readFileSync(path.join(TMP, "resume.json"), "utf8"));
  assert.strictEqual(r.basics.name, "Maya R");
  assert.strictEqual(r.work.length, 1);
  assert.strictEqual(r.work[0].name, "Cobalt");
  assert.strictEqual(r.work[0].startDate, "2022-01-01");
  assert.ok(r.work[0].highlights.includes("Cut LCP p75 from 5.2s to 2.1s."));
  const talk = r.work[0].highlights.find((h) => h.includes("talk"));
  assert.ok(talk && talk.includes("(self-reported)"), "self-reported bullet must carry its marker");
  assert.ok(r.skills.some((s) => s.name === "Performance" && s.keywords.includes("LCP")));
  assert.ok(!JSON.stringify(r).includes("undefined"), "no undefined leaked into output");
});

test("X1: career input → one work entry per segment, newest first", () => {
  run(["--json-resume", "--evidence", CAREER, "--out", "resume-career.json"]);
  const r = JSON.parse(fs.readFileSync(path.join(TMP, "resume-career.json"), "utf8"));
  assert.deepStrictEqual(r.work.map((w) => w.name), ["Cobalt", "Acme"]);
  assert.ok(r.work[1].highlights.includes("Shipped /v2 with zero breaking changes."),
    "each segment gets its own accomplishments");
});

test("missing optional fields: no stats, no tenure, no skills — still exports", () => {
  const bare = write("ev-bare.json", {
    schema_version: 2, subject: { engineer: "Maya R", repo: "solo" },
    accomplishments: [{ id: "a1", category: "Docs", title: "Wrote the runbook", confidence: 70,
      evidence: [{ type: "commit", ref: "shaCCC" }] }],
  });
  run(["--json-resume", "--evidence", bare, "--out", "resume-bare.json"]);
  const r = JSON.parse(fs.readFileSync(path.join(TMP, "resume-bare.json"), "utf8"));
  assert.strictEqual(r.work[0].name, "solo");
  assert.ok(r.work[0].highlights.length, "title stands in when resumeBullet is absent");
  assert.ok(!JSON.stringify(r).includes("undefined"));
});

// ---------- LinkedIn ----------

test("LinkedIn export: sections present, numbers from the record, self-reported marked", () => {
  run(["--linkedin", "--evidence", EV, "--out", "linkedin.md"]);
  const md = fs.readFileSync(path.join(TMP, "linkedin.md"), "utf8");
  assert.match(md, /## About/);
  assert.match(md, /## Experience/);
  assert.match(md, /## Skills/);
  assert.match(md, /412/, "commit count must come from the record");
  assert.match(md, /\(self-reported\)/);
  assert.match(md, /Performance/);
});

// ---------- version gates ----------

test("newer schema versions are refused with a migration hint", () => {
  const e3 = JSON.parse(fs.readFileSync(EV, "utf8")); e3.schema_version = 3;
  fails(["--json-resume", "--evidence", write("ev3.json", e3)], /newer/);
  const c2 = JSON.parse(fs.readFileSync(CAREER, "utf8")); c2.schema_version = 2;
  fails(["--linkedin", "--evidence", write("c2.json", c2)], /newer/);
  fails(["--json-resume", "--evidence", path.join(TMP, "missing.json")], /cannot read/);
});

// ---------- X2/X3: PDF (offline, local Chrome only) ----------

test("X2: PDF via local Chrome — real PDF bytes from the rendered page", (t) => {
  const chrome = (() => {
    for (const c of ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Chromium.app/Contents/MacOS/Chromium"])
      if (fs.existsSync(c)) return c;
    for (const c of ["google-chrome", "chromium-browser", "chromium"]) {
      try { execFileSync("which", [c], { stdio: "pipe" }); return c; } catch {}
    }
    return null;
  })();
  if (!chrome) return t.skip("no Chrome/Chromium on this machine");
  execFileSync("node", [RENDER, "--evidence", EV, "--out", path.join(TMP, "journey.html"),
    "--md", path.join(TMP, "journey.md")], { stdio: "pipe", cwd: TMP });
  run(["--pdf", "--html", "journey.html", "--out", "journey.pdf"]);
  const buf = fs.readFileSync(path.join(TMP, "journey.pdf"));
  assert.strictEqual(buf.subarray(0, 4).toString(), "%PDF");
  assert.ok(buf.length > 5000, "PDF suspiciously small: " + buf.length);
});

test("PDF without the html file dies actionably", () => {
  fails(["--pdf", "--html", "nope.html", "--out", "x.pdf"], /nope\.html/);
});
