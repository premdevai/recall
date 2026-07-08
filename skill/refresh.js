#!/usr/bin/env node
// recall refresh — the cron-safe steady-state step. Runs gather (pure script,
// zero model tokens), compares the new digest head to the previous one, and
// appends one line to .recall/refresh.log. Prints exactly one status line to
// stdout so cron wrappers and the model can branch without parsing JSON:
//
//   first-run <commits>   no previous digest — everything is new
//   unchanged             head is identical; nothing for the model to judge
//   changed <delta>       new commits since last refresh — judge only those
//
//   node refresh.js [--repo <path>] [--author <id>]
//
// Zero dependencies. A weekly crontab line:
//   0 9 * * 1  cd /path/to/repo && node ~/.claude/skills/recall/refresh.js
"use strict";

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const argv = process.argv.slice(2);
function opt(name, dflt) {
  const i = argv.indexOf("--" + name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
}
function die(msg) { console.error("recall refresh: " + msg); process.exit(2); }

const REPO = path.resolve(opt("repo", "."));
const DIGEST = path.join(REPO, ".recall", "digest.json");
const LOG = path.join(REPO, ".recall", "refresh.log");

let prev = null;
try { prev = JSON.parse(fs.readFileSync(DIGEST, "utf8")); } catch {} // corrupt/missing → first run

const t0 = Date.now();
const gatherArgs = [path.join(__dirname, "gather.js"), "--repo", REPO];
const author = opt("author", null);
if (author) gatherArgs.push("--author", author);
try {
  execFileSync(process.execPath, gatherArgs, { stdio: ["ignore", "ignore", "pipe"] });
} catch (e) {
  const msg = (e.stderr ? e.stderr.toString().trim() : e.message).split("\n")[0];
  try {
    fs.mkdirSync(path.dirname(LOG), { recursive: true });
    fs.appendFileSync(LOG, `${new Date().toISOString()} error ${msg}\n`);
  } catch {}
  die("gather failed — " + msg);
}

let cur;
try { cur = JSON.parse(fs.readFileSync(DIGEST, "utf8")); }
catch (e) { die("gather ran but produced no readable digest — " + e.message); }

const status = !prev || !prev.head_sha ? "first-run"
  : prev.head_sha === cur.head_sha ? "unchanged" : "changed";
// ponytail: delta = authored-commit-count difference; a rebase that rewrites
// history can make this 0 or negative even though head moved — the model
// re-judges from digest candidates either way, so "changed" is what matters
const delta = status === "changed" ? Math.max(0, cur.totals.commits - prev.totals.commits) : 0;

const line = status === "first-run" ? `first-run ${cur.totals.commits} commits`
  : status === "changed" ? `changed +${delta} (head ${String(prev.head_sha).slice(0, 10)} → ${cur.head_sha.slice(0, 10)})`
  : "unchanged";
fs.appendFileSync(LOG, `${new Date().toISOString()} ${line} ${Date.now() - t0}ms\n`);

console.log(status === "first-run" ? `first-run ${cur.totals.commits}`
  : status === "changed" ? `changed ${delta}` : "unchanged");
