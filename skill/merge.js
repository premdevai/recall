#!/usr/bin/env node
// recall merge — the career store. Copies a repo's evidence into
// ~/.recall/store/<repo-id>/ (repo-id = root-commit sha, survives clones and
// renames) and rebuilds ~/.recall/career.json: per-employer segments, merged
// skills, authored-vs-enabled rollups, cross-repo dedupe. Pure code, zero
// model tokens, zero dependencies. Store is plain JSON, chmod 600, no sync.
//
//   node merge.js --add [--repo <path>] [--employer <name>] [--repo-id <id>]
//   node merge.js                              # rebuild career.json from store
//   node merge.js --exclude-employer <name> --out view.json
//   node merge.js --anonymize --out view.json
"use strict";

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const argv = process.argv.slice(2);
const flag = (n) => argv.includes("--" + n);
function opt(name, dflt) {
  const i = argv.indexOf("--" + name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
}
function optAll(name) {
  const out = [];
  for (let i = 0; i < argv.length; i++)
    if (argv[i] === "--" + name && argv[i + 1]) out.push(argv[i + 1]);
  return out;
}

const HOME = process.env.RECALL_HOME || path.join(os.homedir(), ".recall");
const STORE = path.join(HOME, "store");
const CANONICAL = path.join(HOME, "career.json");
const EXCLUDE = optAll("exclude-employer").map((s) => s.toLowerCase());
const ANON = flag("anonymize");
const FILTERED = EXCLUDE.length > 0 || ANON;
const OUT = opt("out", FILTERED ? null : CANONICAL);

function die(msg) { console.error("recall merge: " + msg); process.exit(2); }
if (flag("add") && FILTERED) die("--add cannot combine with --exclude-employer/--anonymize; file the repo first, then build the view");
if (FILTERED && OUT && path.resolve(OUT) === CANONICAL)
  die("refusing to overwrite the canonical career.json with a filtered view — pass a different --out");

function writePrivate(file, data) {
  fs.writeFileSync(file, data, { mode: 0o600 });
  try { fs.chmodSync(file, 0o600); } catch {} // mode is ignored if the file pre-existed
}

// a claim is self-reported when it says so, or when nothing external backs it.
// Any source value other than "verified" is treated as self-reported — a typo
// must never promote a claim.
const isSelf = (a) => a.source ? a.source !== "verified" : (a.evidence || []).every((e) => e.type === "self");

// ---------- --add: copy this repo's evidence into the store ----------
if (flag("add")) {
  const repo = path.resolve(opt("repo", "."));
  const evPath = path.join(repo, ".recall", "evidence.json");
  let evRaw, ev;
  try { evRaw = fs.readFileSync(evPath, "utf8"); ev = JSON.parse(evRaw); }
  catch (e) { die("cannot read " + evPath + " — run a recall report first (" + e.message + ")"); }
  if (!ev.subject || !ev.subject.engineer || !ev.subject.repo)
    die("evidence.subject.engineer and .repo are required — regenerate the report");

  let dgRaw = null;
  try { dgRaw = fs.readFileSync(path.join(repo, ".recall", "digest.json"), "utf8"); } catch {}
  let repoId = opt("repo-id", null);
  if (!repoId && dgRaw) { try { repoId = JSON.parse(dgRaw).repo_id; } catch {} }
  if (!repoId) {
    try {
      // gather.js derives the same id into the digest; this is the fallback.
      // Roots sorted so multi-root repos stay stable as histories merge.
      repoId = execFileSync("git", ["rev-list", "--max-parents=0", "HEAD"],
        { cwd: repo, encoding: "utf8" }).trim().split("\n").sort()[0].slice(0, 12);
    } catch { die("not a git repo and no --repo-id given: " + repo); }
  }

  const dir = path.join(STORE, repoId);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  writePrivate(path.join(dir, "evidence.json"), evRaw);
  if (dgRaw) writePrivate(path.join(dir, "digest.json"), dgRaw);
  const meta = {
    repo_id: repoId,
    repo: ev.subject.repo,
    employer: opt("employer", ev.subject.employer || ev.subject.repo),
    path: repo,
    added: new Date().toISOString(),
  };
  writePrivate(path.join(dir, "meta.json"), JSON.stringify(meta));
  console.error(`recall merge: stored ${ev.subject.repo} as ${repoId} (employer: ${meta.employer})`);
}

// ---------- rebuild career.json from everything in the store ----------
let entries = [];
try {
  for (const id of fs.readdirSync(STORE)) {
    const dir = path.join(STORE, id);
    try {
      const meta = JSON.parse(fs.readFileSync(path.join(dir, "meta.json"), "utf8"));
      meta.repo = meta.repo || id; // hand-made entries must not poison every rebuild
      meta.employer = meta.employer || meta.repo;
      const ev = JSON.parse(fs.readFileSync(path.join(dir, "evidence.json"), "utf8"));
      let dg = null;
      try { dg = JSON.parse(fs.readFileSync(path.join(dir, "digest.json"), "utf8")); } catch {}
      entries.push({ meta, ev, dg });
    } catch {}
  }
} catch {}
if (!entries.length) die("store is empty (" + STORE + ") — run with --add from a repo that has .recall/evidence.json");

const excludedNames = entries
  .filter((e) => EXCLUDE.includes(e.meta.employer.toLowerCase()) || EXCLUDE.includes(e.meta.repo.toLowerCase()))
  .flatMap((e) => [e.meta.employer, e.meta.repo]);
entries = entries.filter((e) =>
  !EXCLUDE.includes(e.meta.employer.toLowerCase()) && !EXCLUDE.includes(e.meta.repo.toLowerCase()));
if (!entries.length) die("every store entry was excluded");
entries.sort((a, b) => {
  const fa = (a.ev.subject.tenure && a.ev.subject.tenure.from) || (a.dg && a.dg.range.from) || "";
  const fb = (b.ev.subject.tenure && b.ev.subject.tenure.from) || (b.dg && b.dg.range.from) || "";
  return fa < fb ? -1 : 1;
});

const seenShas = new Set();
const segments = [], accomplishments = [], skillMap = new Map();
const enabled = {};
let commits = 0, insertions = 0, deletions = 0, deduped = 0;
let rangeFrom = null, rangeTo = null;

for (const { meta, ev, dg } of entries) {
  const from = (ev.subject.tenure && ev.subject.tenure.from) || (dg && dg.range.from) || null;
  const to = (ev.subject.tenure && ev.subject.tenure.to) || (dg && dg.range.to) || null;
  if (from && (!rangeFrom || from < rangeFrom)) rangeFrom = from;
  if (to && (!rangeTo || to > rangeTo)) rangeTo = to;
  const segCommits = (dg && dg.totals.commits) || (ev.stats && ev.stats.commits) || 0;
  commits += segCommits;
  if (dg) { insertions += dg.totals.insertions; deletions += dg.totals.deletions; }

  const kept = [];
  for (const a of ev.accomplishments || []) {
    a.source = isSelf(a) ? "self-reported" : "verified";
    const shas = a.evidence.filter((e) => e.type === "commit").map((e) => e.ref);
    // fork/mirror dedupe: drop only when EVERY cited sha was already counted
    // under another store entry — an accomplishment mixing inherited and new
    // work keeps its unique commits on the record.
    // ponytail: keys on commit shas only (globally unique); PR/ticket refs
    // aren't — fork pairs sharing only PR evidence stay duplicated.
    if (shas.length && shas.every((s) => seenShas.has(s))) { deduped++; continue; }
    shas.forEach((s) => seenShas.add(s));
    const tagged = { ...a, id: meta.repo_id.slice(0, 6) + ":" + a.id, repo: meta.repo, employer: meta.employer };
    kept.push(tagged);
    accomplishments.push(tagged);
  }

  for (const s of ev.skills || []) {
    const cur = skillMap.get(s.name) || { name: s.name, prs: 0, commits: 0, lastTouched: "" };
    cur.prs += s.prs || 0;
    cur.commits += s.commits || 0;
    if ((s.lastTouched || "") > cur.lastTouched) cur.lastTouched = s.lastTouched;
    skillMap.set(s.name, cur);
  }
  for (const [k, v] of Object.entries(ev.enabled || {}))
    if (typeof v === "number") enabled[k] = (enabled[k] || 0) + v;
    else if (Array.isArray(v)) enabled[k] = (enabled[k] || []).concat(v);

  segments.push({
    repo_id: meta.repo_id, repo: meta.repo, employer: meta.employer,
    from, to, commits: segCommits, accomplishments: kept.length,
    top: kept.slice().sort((a, b) => b.confidence - a.confidence).slice(0, 3)
      .map((a) => a.title + (a.source === "self-reported" ? " (self-reported)" : "")),
  });
}

const selfReported = accomplishments.filter((a) => a.source === "self-reported").length;
const career = {
  schema_version: 1,
  kind: "career",
  generatedAt: new Date().toISOString(),
  engineer: entries[0].ev.subject.engineer,
  range: { from: rangeFrom, to: rangeTo },
  segments,
  skills: [...skillMap.values()].sort((a, b) => b.commits - a.commits),
  enabled: Object.keys(enabled).length ? enabled : undefined,
  totals: { repos: segments.length, commits, insertions, deletions,
    accomplishments: accomplishments.length,
    verified: accomplishments.length - selfReported, selfReported, deduped },
  accomplishments,
};

// ---------- privacy views: rewrite string VALUES, never string surgery on JSON ----------
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function scrubStrings(names, repl) {
  const uniq = [...new Set(names.filter(Boolean))].sort((a, b) => b.length - a.length);
  if (!uniq.length) return;
  // ponytail: \b-bounded, case-insensitive — catches Acme/ACME/acme-web in
  // free text; a name that starts/ends with a non-word char won't match \b
  // (the structured employer/repo/id fields are overwritten exactly below,
  // so only free-text mentions of such names could slip)
  const re = new RegExp("\\b(?:" + uniq.map(escRe).join("|") + ")\\b", "gi");
  (function walk(o) {
    for (const k of Object.keys(o)) {
      const v = o[k];
      if (typeof v === "string") o[k] = v.replace(re, repl);
      else if (v && typeof v === "object") walk(v);
    }
  })(career);
}

if (ANON) {
  const empAlias = new Map(); // one alias per employer, assigned in tenure order
  for (const s of segments) if (!empAlias.has(s.employer.toLowerCase()))
    empAlias.set(s.employer.toLowerCase(),
      "Employer " + (empAlias.size < 26 ? String.fromCharCode(65 + empAlias.size) : "#" + (empAlias.size + 1)));
  const repoOwner = new Map(); // repo name → its employer's alias
  for (const s of segments) repoOwner.set(s.repo.toLowerCase(), empAlias.get(s.employer.toLowerCase()));
  scrubStrings(segments.flatMap((s) => [s.employer, s.repo]),
    (m) => empAlias.get(m.toLowerCase()) || repoOwner.get(m.toLowerCase()) || "[redacted]");
  // root-commit shas are searchable on public forges — mask ids too
  const idAlias = new Map(segments.map((s, i) => [s.repo_id.slice(0, 6), "r" + (i + 1)]));
  for (const s of career.segments) s.repo_id = idAlias.get(s.repo_id.slice(0, 6));
  for (const a of career.accomplishments) {
    const [pfx, ...rest] = a.id.split(":");
    a.id = (idAlias.get(pfx) || pfx) + ":" + rest.join(":");
  }
}
if (excludedNames.length) scrubStrings(excludedNames, "[redacted]");

const json = JSON.stringify(career);
if (OUT) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true, mode: 0o700 });
  writePrivate(OUT, json);
  console.error(`recall merge: ${segments.length} repos → ${OUT} (${accomplishments.length} accomplishments, ${deduped} deduped, ${selfReported} self-reported)`);
} else {
  process.stdout.write(json + "\n");
}
