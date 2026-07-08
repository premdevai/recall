"use strict";
const { test } = require("node:test");
const assert = require("node:assert");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const CONFORM = path.join(__dirname, "..", "skill", "conform.js");
const TMP = path.join(__dirname, "tmp", "conform");
fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });

const write = (name, data) => {
  const p = path.join(TMP, name);
  fs.writeFileSync(p, typeof data === "string" ? data : JSON.stringify(data));
  return p;
};
function run(file) {
  return execFileSync("node", [CONFORM, file], { encoding: "utf8", stdio: "pipe" });
}
function fails(file, re) {
  assert.throws(() => run(file), (e) => {
    assert.strictEqual(e.status, 2, "exit code");
    assert.match(e.stderr.toString(), re, "actionable message expected");
    assert.ok(!e.stderr.toString().includes("at Object."), "stack trace leaked");
    return true;
  });
}

const good = () => ({
  id: "gl-1", category: "Code review", title: "Reviewed the payments service",
  confidence: 70,
  evidence: [{ type: "review", ref: "!482", url: "https://gitlab.example.com/x/-/merge_requests/482" }],
});

test("E3: a valid adapter fragment passes and reports counts", () => {
  const out = run(write("ok.json", { accomplishments: [good()] }));
  assert.match(out, /1 record.*conforms/s);
});

test("full evidence.json shape is accepted too", () => {
  run(write("full.json", {
    schema_version: 2,
    subject: { engineer: "Maya R", repo: "cobalt-web" },
    accomplishments: [good()],
  }));
});

test("E3: record with no evidence fails naming the record and rule", () => {
  const a = good(); a.evidence = [];
  fails(write("noev.json", { accomplishments: [a] }), /gl-1.*evidence/s);
});

test("E3: unknown evidence type fails listing the legal enum from the schema", () => {
  const a = good(); a.evidence[0].type = "merge-request";
  fails(write("badtype.json", { accomplishments: [a] }), /merge-request.*commit.*ticket/s);
});

test("E3: invented field fails — adapters must not extend the contract silently", () => {
  const a = good(); a.sentiment = "very positive";
  fails(write("extra.json", { accomplishments: [a] }), /sentiment.*not in the contract/s);
});

test("E3: missing required field fails naming it", () => {
  const a = good(); delete a.category;
  fails(write("nocat.json", { accomplishments: [a] }), /category/);
});

test("confidence bounds enforced, zero allowed (falsy-zero)", () => {
  const a = good(); a.confidence = 0;
  run(write("zero.json", { accomplishments: [a] })); // 0 is legal
  a.confidence = 101;
  fails(write("over.json", { accomplishments: [a] }), /confidence.*0.*100/s);
  delete a.confidence;
  fails(write("nocon.json", { accomplishments: [a] }), /confidence/);
});

test("honesty: source must be a legal enum; self evidence with source verified fails", () => {
  const a = good(); a.source = "totally-legit";
  fails(write("badsrc.json", { accomplishments: [a] }), /source.*verified.*self-reported/s);
  const b = good(); b.source = "verified"; b.evidence = [{ type: "self", ref: "told to recall" }];
  fails(write("selfver.json", { accomplishments: [b] }), /self.*verified/is);
});

test("bad inputs never stack-trace: garbage JSON, empty list, wrong shape", () => {
  fails(write("garbage.json", "{nope"), /JSON|cannot read/);
  fails(write("empty.json", { accomplishments: [] }), /no records/);
  fails(write("shape.json", { rows: [1] }), /accomplishments/);
});

test("multiple broken records → every failure listed, not just the first", () => {
  const a = good(); delete a.title;
  const b = good(); b.id = "gl-2"; b.evidence = [];
  try {
    run(write("multi.json", { accomplishments: [a, b] }));
    assert.fail("should have exited 2");
  } catch (e) {
    const err = e.stderr.toString();
    assert.match(err, /title/, "first record's failure listed");
    assert.match(err, /gl-2/, "second record's failure listed");
  }
});
