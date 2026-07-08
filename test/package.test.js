"use strict";
// M1 + the version-stamps-move-together rule, checked as one test so a release
// can't ship with drifted stamps or a broken plugin manifest.
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const json = (f) => JSON.parse(read(f));

test("M1: version stamps move together — package.json, SKILL.md, plugin.json, marketplace.json", () => {
  const v = json("package.json").version;
  assert.match(read("skill/SKILL.md"), new RegExp(`^version: ${v.replace(/\./g, "\\.")}$`, "m"), "SKILL.md frontmatter");
  assert.strictEqual(json(".claude-plugin/plugin.json").version, v, "plugin.json");
  const mk = json(".claude-plugin/marketplace.json");
  assert.strictEqual(mk.plugins[0].version, v, "marketplace.json");
});

test("M1: plugin manifest points at real files", () => {
  const p = json(".claude-plugin/plugin.json");
  assert.strictEqual(p.name, "recall");
  const skillsDir = path.join(ROOT, p.skills);
  assert.ok(fs.existsSync(path.join(skillsDir, "SKILL.md")), p.skills + " must contain SKILL.md");
  assert.ok(fs.existsSync(path.join(skillsDir, "evidence.schema.json")), "schema must ship inside the skill dir");
});

test("zero runtime dependencies, forever", () => {
  const p = json("package.json");
  assert.ok(!p.dependencies || !Object.keys(p.dependencies).length, "dependencies must stay empty");
});

test("the schema the conformance kit reads is the one contract (no root copy left)", () => {
  assert.ok(!fs.existsSync(path.join(ROOT, "evidence.schema.json")), "root schema copy must not exist");
});
