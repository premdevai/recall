#!/usr/bin/env node
// Installs the Recall skill into a Claude Code skills directory.
// Zero dependencies — the skill itself does the work inside Claude Code.
"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const pkg = require("../package.json");

const HOME_SKILL = path.join(os.homedir(), ".claude", "skills", "recall");
const PROJ_SKILL = path.join(process.cwd(), ".claude", "skills", "recall");

function skillVersion(dir) {
  try {
    const m = fs.readFileSync(path.join(dir, "SKILL.md"), "utf8").match(/^version:\s*(\S+)/m);
    return m ? m[1] : "unknown";
  } catch {
    return null; // not installed
  }
}

// Read MCP servers the user has configured, so they know what evidence
// Recall will find before they run it.
function mcpServers() {
  const found = [];
  const configs = [
    path.join(os.homedir(), ".claude.json"),
    path.join(process.cwd(), ".mcp.json"),
  ];
  for (const file of configs) {
    try {
      const cfg = JSON.parse(fs.readFileSync(file, "utf8"));
      const servers = cfg.mcpServers || {};
      for (const name of Object.keys(servers)) if (!found.includes(name)) found.push(name);
      // ~/.claude.json also nests per-project mcpServers
      for (const proj of Object.values(cfg.projects || {})) {
        for (const name of Object.keys(proj.mcpServers || {})) if (!found.includes(name)) found.push(name);
      }
    } catch {
      /* missing or unparsable config — skip */
    }
  }
  return found;
}

function printSources() {
  const servers = mcpServers();
  console.log("");
  console.log("Evidence sources Recall will use:");
  console.log("  git         yes (always)");
  if (servers.length) {
    console.log("  MCP         " + servers.join(", "));
  } else {
    console.log("  MCP         none configured locally — Connect Jira/GitHub/etc. in Claude Code (/mcp).");
  }
  console.log("              (claude.ai connectors don't show here but still work — check /mcp)");
}

function doctor() {
  console.log("recall doctor — v" + pkg.version);
  console.log("");
  const home = skillVersion(HOME_SKILL);
  const proj = skillVersion(PROJ_SKILL);
  console.log("Skill installs:");
  console.log("  user     " + (home ? HOME_SKILL + "  (v" + home + ")" : "not installed"));
  console.log("  project  " + (proj ? PROJ_SKILL + "  (v" + proj + ")" : "not installed"));
  if (home && proj) console.log("  note: the project copy shadows the user copy in this repo.");
  const installed = proj || home;
  if (!installed) {
    console.log("  fix: run  npx @premdevai/recall");
  } else if (installed !== pkg.version) {
    console.log("  update available: installed v" + installed + " < v" + pkg.version +
      " — run  npx @premdevai/recall@latest");
  }
  printSources();
  console.log("");
  console.log("If a source is configured but reports stay git-only, it likely needs");
  console.log("authentication — run /mcp inside Claude Code to check and reconnect.");
}

const args = process.argv.slice(2);
if (args.includes("-h") || args.includes("--help")) {
  console.log(`recall — install the Recall skill for Claude Code

Usage:
  npx @premdevai/recall            Install for your user (~/.claude/skills/recall)
  npx @premdevai/recall --here     Install into this project (./.claude/skills/recall)
  npx @premdevai/recall doctor     Check installs, versions, and evidence sources

Then, in any repository, ask Claude Code to run /recall.
Modes: /recall · /recall roles · /recall apply <job posting> · /recall bullets · /recall star <topic>`);
  process.exit(0);
}

if (args.includes("doctor")) {
  doctor();
  process.exit(0);
}

const srcDir = path.join(__dirname, "..", "skill");
if (!fs.existsSync(path.join(srcDir, "SKILL.md"))) {
  console.error("error: bundled skill files are missing (" + srcDir + ")");
  process.exit(1);
}

const here = args.includes("--here");
const base = here ? PROJ_SKILL : HOME_SKILL;

// Warn when this install will be shadowed by (or shadow) the other location.
const otherDir = here ? HOME_SKILL : PROJ_SKILL;
const otherVer = skillVersion(otherDir);
if (otherVer) {
  console.log(here
    ? "note: a user-level install exists (v" + otherVer + "); this project copy will shadow it here."
    : "note: this project has its own copy (v" + otherVer + ") which shadows the user install in this repo.");
}

fs.mkdirSync(base, { recursive: true });
// Copy every file in skill/ (SKILL.md + template.html) so the locked design
// travels with the instructions. Stamp the package version into SKILL.md
// frontmatter so `doctor` can detect drift.
const copied = fs.readdirSync(srcDir).filter(function (f) {
  return fs.statSync(path.join(srcDir, f)).isFile();
});
copied.forEach(function (f) {
  if (f === "SKILL.md") {
    let text = fs.readFileSync(path.join(srcDir, f), "utf8");
    text = text.replace(/^version:.*$/m, "version: " + pkg.version);
    fs.writeFileSync(path.join(base, f), text);
  } else {
    fs.copyFileSync(path.join(srcDir, f), path.join(base, f));
  }
});

console.log("Recall v" + pkg.version + " installed:");
console.log("  " + base + "  (" + copied.join(", ") + ")");
printSources();
console.log("");
console.log("Next: open Claude Code in any repo and run  /recall");
console.log("Job hunting? Try  /recall roles  or  /recall apply <paste a job posting>");
console.log("Health check:  npx @premdevai/recall doctor    Update:  npx @premdevai/recall@latest");
