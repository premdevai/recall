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

const src = path.join(__dirname, "..", "skill", "SKILL.md");
if (!fs.existsSync(src)) {
  console.error("error: bundled skill file is missing (" + src + ")");
  process.exit(1);
}

const base = args.includes("--here")
  ? path.join(process.cwd(), ".claude", "skills", "recall")
  : path.join(os.homedir(), ".claude", "skills", "recall");

const dest = path.join(base, "SKILL.md");
fs.mkdirSync(base, { recursive: true });
fs.copyFileSync(src, dest);

console.log("Recall skill installed:");
console.log("  " + dest);
console.log("");
console.log("Next: open Claude Code in any repo and run  /recall");
console.log("It reuses your existing git and MCP connections — no keys, no config.");
