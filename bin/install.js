#!/usr/bin/env node
// Installs the Recall skill into a Claude Code skills directory.
// Zero dependencies — the skill itself does the work inside Claude Code.
"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");

const args = process.argv.slice(2);
if (args.includes("-h") || args.includes("--help")) {
  console.log(`recall — install the Recall skill for Claude Code

Usage:
  npx @premdevai/recall            Install for your user (~/.claude/skills/recall)
  npx @premdevai/recall --here     Install into this project (./.claude/skills/recall)

Then, in any repository, ask Claude Code to run /recall.`);
  process.exit(0);
}

const srcDir = path.join(__dirname, "..", "skill");
if (!fs.existsSync(path.join(srcDir, "SKILL.md"))) {
  console.error("error: bundled skill files are missing (" + srcDir + ")");
  process.exit(1);
}

const base = args.includes("--here")
  ? path.join(process.cwd(), ".claude", "skills", "recall")
  : path.join(os.homedir(), ".claude", "skills", "recall");

fs.mkdirSync(base, { recursive: true });
// Copy every file in skill/ (SKILL.md + template.html) so the locked design
// travels with the instructions.
const copied = fs.readdirSync(srcDir).filter(function (f) {
  return fs.statSync(path.join(srcDir, f)).isFile();
});
copied.forEach(function (f) {
  fs.copyFileSync(path.join(srcDir, f), path.join(base, f));
});

console.log("Recall skill installed:");
console.log("  " + base + "  (" + copied.join(", ") + ")");
console.log("");
console.log("Next: open Claude Code in any repo and run  /recall");
console.log("It reuses your existing git and MCP connections — no keys, no config.");
