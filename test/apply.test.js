"use strict";
const { test } = require("node:test");
const assert = require("node:assert");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const APPLY = path.join(__dirname, "..", "skill", "apply.js");
const TMP = path.join(__dirname, "tmp", "apply");
fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });

function run(args) {
  return execFileSync("node", [APPLY, ...args], { encoding: "utf8", stdio: "pipe", cwd: TMP });
}
function fails(args, re) {
  assert.throws(() => run(args), (e) => {
    assert.strictEqual(e.status, 2, "exit code");
    assert.match(e.stderr.toString(), re);
    assert.ok(!e.stderr.toString().includes("at Object."), "stack trace leaked to the user");
    return true;
  });
}
const write = (name, data) => {
  const p = path.join(TMP, name);
  fs.writeFileSync(p, typeof data === "string" ? data : JSON.stringify(data));
  return p;
};

// evidence fixture — a11 exists so citing "a1" must never substring-match it;
// zero-confidence a0 is a real record (falsy-zero); talk1 is self-reported
// via type:self evidence WITHOUT a source field (normalization must catch it)
const EV = write("evidence.json", {
  schema_version: 2,
  subject: { engineer: "Maya R", repo: "cobalt-web", tenure: { from: "2022-01-01", to: "2023-12-01" } },
  accomplishments: [
    { id: "a1", category: "Performance", title: "Rebuilt the image pipeline", confidence: 90,
      resumeBullet: "Cut LCP p75 from 5.2s to 2.1s.",
      star: { situation: "Slow pages", task: "Fix LCP", action: "Rebuilt pipeline", result: "p75 5.2s → 2.1s" },
      evidence: [{ type: "commit", ref: "sha900aa" }, { type: "metric", ref: "Datadog", detail: "p75 5.2s → 2.1s" }] },
    { id: "a11", category: "API design", title: "Versioned the public API", confidence: 80,
      resumeBullet: "Shipped /v2 with zero breaking changes.",
      evidence: [{ type: "commit", ref: "sha901bb" }] },
    { id: "a0", category: "Docs", title: "Fixed a typo", confidence: 0,
      evidence: [{ type: "commit", ref: "sha902cc" }] },
    { id: "talk1", category: "Communication", title: "Spoke at LocalConf on web perf", confidence: 55,
      resumeBullet: "Gave a conference talk on LCP.",
      evidence: [{ type: "self", ref: "told to recall 2023-11-01" }] },
  ],
});

// ---------- --jd: content-hash cache (J3) ----------

test("J3: same posting, hostile whitespace/case/CRLF → same hash; second sight is a hit", () => {
  const a = write("jd-a.txt", "Senior  Backend Engineer\r\n\r\nPython required\r\n");
  const b = write("jd-b.txt", "senior backend engineer\npython required");
  const [hashA, cacheA, stateA] = run(["--jd", a]).trim().split(" ");
  const [hashB, , stateB] = run(["--jd", b]).trim().split(" ");
  assert.strictEqual(hashA, hashB, "normalization must make these identical");
  assert.strictEqual(stateA, "miss");
  assert.strictEqual(stateB, "miss", "cache file not written yet — still a miss");
  fs.writeFileSync(path.join(TMP, cacheA), JSON.stringify({ requirements: [] }));
  assert.strictEqual(run(["--jd", b]).trim().split(" ")[2], "hit");
});

test("J3: different posting → different hash", () => {
  const c = write("jd-c.txt", "Staff SRE\nKubernetes required");
  assert.notStrictEqual(run(["--jd", c]).trim().split(" ")[0],
    run(["--jd", path.join(TMP, "jd-a.txt")]).trim().split(" ")[0]);
});

test("--jd on empty/missing file dies actionably", () => {
  fails(["--jd", write("jd-empty.txt", "  \n\n ")], /empty/);
  fails(["--jd", path.join(TMP, "nope.txt")], /cannot read/);
});

// ---------- --kit: the honesty chokepoint (J1, J2) ----------

const match = (over = {}) => ({
  company: "Acme", role: "Senior Backend",
  requirements: [
    { req: "Web performance at scale", match: "strong", evidence_ids: ["a1"] },
    { req: "API versioning", match: "partial", evidence_ids: ["a11"], note: "adjacent, not led" },
    { req: "Go in production", match: "gap", note: "none on the record — frame Python depth instead" },
  ],
  bullets: [{ text: "Cut LCP p75 by 60% rebuilding the image pipeline.", evidence_id: "a1" }],
  coverLetter: ["Para one.", "Para two.", "Para three."],
  questions: [{ q: "Walk me through a performance win.", evidence_id: "a1" }],
  ...over,
});

test("J1: valid kit — fit line derived from the data, proof pulled from the record", () => {
  run(["--kit", write("m-ok.json", match()), "--evidence", EV]);
  const kit = fs.readFileSync(path.join(TMP, ".recall", "apply-acme.md"), "utf8");
  assert.match(kit, /1 strong · 1 partial · 1 gap of 3 requirements/);
  assert.match(kit, /Rebuilt the image pipeline/, "proof cell must carry the record's title");
  assert.match(kit, /Cut LCP p75 from 5\.2s to 2\.1s\./, "STAR/bullet text must come from evidence.json, not the match file");
  assert.match(kit, /p75 5\.2s → 2\.1s/, "interview prep must quote the record's STAR result");
  assert.match(kit, /Go in production/, "gaps are reported, never dropped");
});

test("J2: strong citing an unknown id dies naming it — and a1 must not substring-match a11", () => {
  const m = match();
  m.requirements[0].evidence_ids = ["a"]; // substring of both a1 and a11
  fails(["--kit", write("m-sub.json", m), "--evidence", EV], /unknown evidence id "a"/);
});

test("J2: strong with no citations dies — a claim without evidence is a gap, not a match", () => {
  const m = match();
  m.requirements[0].evidence_ids = [];
  fails(["--kit", write("m-empty.json", m), "--evidence", EV], /cites no evidence/);
});

test("J2: strong backed only by self-reported evidence is downgraded to partial and marked", () => {
  const m = match();
  m.requirements[0] = { req: "Public speaking", match: "strong", evidence_ids: ["talk1"] };
  const out = execFileSync("node", [APPLY, "--kit", write("m-self.json", m), "--evidence", EV],
    { encoding: "utf8", stdio: "pipe", cwd: TMP });
  const kit = fs.readFileSync(path.join(TMP, ".recall", "apply-acme.md"), "utf8");
  assert.match(kit, /0 strong · 2 partial · 1 gap/, "fit must be recomputed after the downgrade");
  assert.match(kit, /self-reported/, "the marker must reach the kit");
  assert.doesNotMatch(kit, /\*\*strong\*\*.*talk1|\*\*strong\*\*.*Public speaking/, "no strong row for self-reported proof");
});

test("zero-confidence accomplishment is still a real citation (falsy-zero)", () => {
  const m = match();
  m.requirements[1].evidence_ids = ["a0"];
  run(["--kit", write("m-zero.json", m), "--evidence", EV]);
  assert.match(fs.readFileSync(path.join(TMP, ".recall", "apply-acme.md"), "utf8"), /Fixed a typo/);
});

test("hostile company name → safe kit filename, content intact", () => {
  const m = match({ company: 'Acme "West" & Söhne/Co' });
  run(["--kit", write("m-hostile.json", m), "--evidence", EV]);
  const files = fs.readdirSync(path.join(TMP, ".recall")).filter((f) => f.startsWith("apply-"));
  assert.ok(files.includes("apply-acme-west-s-hne-co.md"), "slug must strip quotes/slashes: " + files.join(","));
});

test("career.json input: prefixed ids resolve, employer names appear in proof", () => {
  const career = write("career.json", {
    schema_version: 1, kind: "career", engineer: "Maya R",
    range: { from: "2021-01-01", to: "2023-12-01" },
    segments: [], skills: [],
    totals: { repos: 2, commits: 500, accomplishments: 1, verified: 1, selfReported: 0 },
    accomplishments: [{ id: "abc123:a1", repo: "cobalt-web", employer: "Cobalt", category: "Performance",
      title: "Rebuilt the image pipeline", confidence: 90, resumeBullet: "Cut LCP p75 by 60%.",
      evidence: [{ type: "commit", ref: "sha900aa" }] }],
  });
  const m = match();
  m.requirements = [{ req: "Web performance", match: "strong", evidence_ids: ["abc123:a1"] }];
  m.bullets = []; m.questions = [];
  run(["--kit", write("m-career.json", m), "--evidence", career]);
  assert.match(fs.readFileSync(path.join(TMP, ".recall", "apply-acme.md"), "utf8"), /Rebuilt the image pipeline/);
});

test("guards: malformed match file, bad match value, missing company, newer schema", () => {
  fails(["--kit", write("m-bad.json", "{nope"), "--evidence", EV], /cannot read|JSON/);
  const m = match(); m.requirements[0].match = "excellent";
  fails(["--kit", write("m-val.json", m), "--evidence", EV], /strong, partial, gap/);
  fails(["--kit", write("m-noco.json", match({ company: "" })), "--evidence", EV], /company/);
  const newer = JSON.parse(fs.readFileSync(EV, "utf8")); newer.schema_version = 3;
  fails(["--kit", write("m-ok2.json", match()), "--evidence", write("ev-new.json", newer)], /newer/);
});
