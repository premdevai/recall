#!/usr/bin/env node
// recall gather — one pass over git history into a compact digest the model
// can read cheaply (.recall/digest.json). No file contents ever leave git;
// paths, counts, and messages only. Zero dependencies.
"use strict";

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// ---------- args ----------
const argv = process.argv.slice(2);
function opt(name, dflt) {
  const i = argv.indexOf("--" + name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
}
const REPO = path.resolve(opt("repo", "."));
const OUT = opt("out", path.join(REPO, ".recall", "digest.json"));
const AUTHOR = opt("author", null); // substring of name or email; default = git config identity
const SINCE = opt("since", null);
const MAX_CANDIDATES = parseInt(opt("candidates", "80"), 10);

function git(args) {
  return execFileSync("git", args, {
    cwd: REPO,
    encoding: "utf8",
    maxBuffer: 1 << 28, // ponytail: 256MB numstat buffer; stream if a monorepo ever bursts it
  });
}

// --repo must BE the repo — git happily walks up to a parent repo, and a cron
// job with a wrong path would silently digest the wrong project
let toplevel = "";
try { toplevel = git(["rev-parse", "--show-toplevel"]).trim(); }
catch { console.error("recall gather: not a git repository: " + REPO); process.exit(2); }
if (fs.realpathSync(toplevel) !== fs.realpathSync(REPO)) {
  console.error(`recall gather: ${REPO} is not a repo root (found ${toplevel}) — pass the repository root as --repo`);
  process.exit(2);
}

// ---------- identity & aliases ----------
// %aN/%aE apply .mailmap automatically. Cluster additional aliases by
// normalized name so "Maya R <maya@work>" and "maya <maya@gmail>" merge.
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
let cfgName = "", cfgEmail = "";
try { cfgName = git(["config", "user.name"]).trim(); } catch {}
try { cfgEmail = git(["config", "user.email"]).trim(); } catch {}

const idents = new Map(); // email -> name
for (const line of git(["log", "--format=%aN|%aE"]).split("\n")) {
  const [name, email] = line.split("|");
  if (email) idents.set(email.toLowerCase(), name);
}
const want = AUTHOR ? AUTHOR.toLowerCase() : null;
const emails = new Set();
let displayName = cfgName || AUTHOR || "";
for (const [email, name] of idents) {
  const hit = want
    ? email.includes(want) || name.toLowerCase().includes(want)
    : email === cfgEmail.toLowerCase() ||
      (cfgName && norm(name) === norm(cfgName));
  if (hit) {
    emails.add(email);
    if (!displayName) displayName = name;
  }
}
if (emails.size === 0) {
  console.error(
    "recall gather: no commits match " +
      (AUTHOR ? `--author "${AUTHOR}"` : `git config identity (${cfgEmail})`) +
      ". Authors in this repo:\n  " +
      [...idents].slice(0, 15).map(([e, n]) => `${n} <${e}>`).join("\n  ")
  );
  process.exit(2);
}

// ---------- optional excludes ----------
let excludeGlobs = [];
try {
  const cfg = JSON.parse(fs.readFileSync(path.join(REPO, ".recall", "config.json"), "utf8"));
  excludeGlobs = cfg.exclude_paths || [];
} catch {}
const globRe = (g) =>
  new RegExp("^" + g.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*/g, "\x01").replace(/\*/g, "[^/]*").replace(/\x01/g, ".*") + "$");
const excludeRes = excludeGlobs.map(globRe);
// generated noise never counts toward candidate scoring
const NOISE = /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|Cargo\.lock|go\.sum|.*\.min\.(js|css)|dist\/|build\/|vendor\/|node_modules\/)/;

// ---------- ticket keys ----------
const KEY_RE = /\b([A-Z][A-Z0-9]{1,9})-(\d+)\b/g;
const KEY_DENY = new Set(["SHA", "UTF", "ISO", "RFC", "CVE", "MD", "ID", "UUID", "AES", "RSA", "TLS"]);
function ticketKeys(text) {
  const out = [];
  let m;
  while ((m = KEY_RE.exec(text))) if (!KEY_DENY.has(m[1])) out.push(m[1] + "-" + m[2]);
  return out;
}

// ---------- main pass: numstat over the whole history, filter in JS ----------
const SEP = "\x1e", F = "\x1f";
const logArgs = ["log", "--no-merges", "--date=short",
  `--pretty=format:${SEP}%H${F}%aE${F}%ad${F}%s`, "--numstat"];
if (SINCE) logArgs.push("--since=" + SINCE);
const raw = git(logArgs);

const commits = [];
for (const chunk of raw.split(SEP)) {
  if (!chunk.trim()) continue;
  const nl = chunk.indexOf("\n");
  const head = (nl === -1 ? chunk : chunk.slice(0, nl)).split(F);
  const [sha, email, date, subject] = head;
  if (!emails.has((email || "").toLowerCase())) continue;
  let ins = 0, del = 0, files = 0, score = 0;
  const areas = new Set();
  if (nl !== -1) {
    for (const line of chunk.slice(nl + 1).split("\n")) {
      const m = line.match(/^(\d+|-)\t(\d+|-)\t(.+)$/);
      if (!m) continue;
      const p = m[3];
      if (excludeRes.some((re) => re.test(p))) continue;
      files++;
      areas.add(p.includes("/") ? p.split("/")[0] : "root");
      const i = m[1] === "-" ? 0 : +m[1], d = m[2] === "-" ? 0 : +m[2];
      ins += i; del += d;
      if (!NOISE.test(p)) score += Math.min(i + d, 400); // cap per-file so lockfile-ish churn can't dominate
    }
  }
  commits.push({ sha: sha.slice(0, 10), date, subject, files, ins, del, score,
    areas: [...areas], tickets: ticketKeys(subject) });
}
commits.reverse(); // oldest first

if (commits.length === 0) {
  console.error("recall gather: identity matched but no commits in range.");
  process.exit(2);
}

// ---------- aggregates ----------
const monthly = new Map(), daily = new Map(), areaTotals = new Map(),
  areaQuarterly = new Map(), tickets = new Map();
let totIns = 0, totDel = 0;
const qLabel = (d) => "Q" + (Math.floor(+d.slice(5, 7) / 3.01) + 1) + " '" + d.slice(2, 4);
for (const c of commits) {
  monthly.set(c.date.slice(0, 7), (monthly.get(c.date.slice(0, 7)) || 0) + 1);
  daily.set(c.date, (daily.get(c.date) || 0) + 1);
  totIns += c.ins; totDel += c.del;
  for (const a of c.areas) {
    areaTotals.set(a, (areaTotals.get(a) || 0) + 1);
    if (!areaQuarterly.has(a)) areaQuarterly.set(a, new Map());
    const q = qLabel(c.date);
    areaQuarterly.get(a).set(q, (areaQuarterly.get(a).get(q) || 0) + 1);
  }
  for (const t of c.tickets) {
    if (!tickets.has(t)) tickets.set(t, []);
    if (tickets.get(t).length < 3) tickets.get(t).push(c.sha);
  }
}

// dense month range, oldest→newest
const first = commits[0].date, last = commits[commits.length - 1].date;
const months = [], monthCounts = [];
for (let y = +first.slice(0, 4), m = +first.slice(5, 7); y < +last.slice(0, 4) || (y === +last.slice(0, 4) && m <= +last.slice(5, 7)); m === 12 ? (m = 1, y++) : m++) {
  const key = y + "-" + String(m).padStart(2, "0");
  months.push(key);
  monthCounts.push(monthly.get(key) || 0);
}
const monthLabels = months.map((k, i) =>
  (i === 0 || k.endsWith("-01")) ? "JFMAMJJASOND"[+k.slice(5, 7) - 1] + "'" + k.slice(2, 4)
    : "JFMAMJJASOND"[+k.slice(5, 7) - 1]);

// dense daily heat, capped to the most recent ~366 days, start snapped back to a Monday
const dayMs = 86400000;
const endD = new Date(last + "T00:00:00Z");
let startD = new Date(Math.max(new Date(first + "T00:00:00Z"), endD - 365 * dayMs));
while (startD.getUTCDay() !== 1) startD = new Date(startD - dayMs);
const heat = [];
for (let d = startD; d <= endD; d = new Date(+d + dayMs))
  heat.push(daily.get(d.toISOString().slice(0, 10)) || 0);

// dense quarter labels for sparklines
const quarters = [];
for (const k of months) { const q = qLabel(k + "-01"); if (quarters[quarters.length - 1] !== q) quarters.push(q); }
const areaSparks = {};
for (const [a, qm] of areaQuarterly)
  areaSparks[a] = quarters.map((q) => qm.get(q) || 0);

// candidates: what the model should actually read diffs for
const withKeys = commits.filter((c) => c.tickets.length);
const byScore = [...commits].sort((a, b) => b.score - a.score).slice(0, MAX_CANDIDATES);
const candSet = new Map();
for (const c of [...withKeys, ...byScore]) candSet.set(c.sha, c);
const candidates = [...candSet.values()].sort((a, b) => (a.date < b.date ? -1 : 1)).slice(0, MAX_CANDIDATES + withKeys.length)
  .map(({ score, ...c }) => c);

const digest = {
  schema_version: 1,
  identity: { name: displayName, emails: [...emails] },
  repo: path.basename(REPO),
  // roots sorted so multi-root repos stay stable as histories merge
  repo_id: git(["rev-list", "--max-parents=0", "HEAD"]).trim().split("\n").sort()[0].slice(0, 12),
  head_sha: git(["rev-parse", "HEAD"]).trim(),
  range: { from: first, to: last },
  totals: { commits: commits.length, insertions: totIns, deletions: totDel,
    files_touched_avg: Math.round(commits.reduce((s, c) => s + c.files, 0) / commits.length * 10) / 10 },
  charts: {
    monthly: { labels: monthLabels, values: monthCounts },
    heatmap: { start: startD.toISOString().slice(0, 10), values: heat },
    areas: Object.fromEntries([...areaTotals].sort((a, b) => b[1] - a[1])),
    area_quarterly: { labels: quarters, series: areaSparks },
  },
  tickets: Object.fromEntries(tickets),
  candidates,
  excluded_globs: excludeGlobs,
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(digest));

// keep .recall/ out of the user's history without asking
const gi = path.join(REPO, ".gitignore");
try {
  const cur = fs.existsSync(gi) ? fs.readFileSync(gi, "utf8") : "";
  if (!/^\.recall\/?$/m.test(cur)) {
    fs.writeFileSync(gi, cur + (cur.endsWith("\n") || !cur ? "" : "\n") + ".recall/\n");
    console.error("note: added .recall/ to .gitignore");
  }
} catch {}

// a shallow clone's "root" is the graft boundary, not the true first commit —
// the career store would file this repo under a different id than a full clone
if (fs.existsSync(path.join(REPO, ".git", "shallow")))
  console.error("warning: shallow clone — career-store identity will not match a full clone of this repo");

const kb = Math.round(fs.statSync(OUT).size / 102.4) / 10;
console.error(
  `recall gather: ${commits.length} commits by ${displayName} <${[...emails].join(", ")}> ` +
  `(${first} → ${last})\n` +
  `  areas: ${[...areaTotals].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([a, n]) => a + ":" + n).join("  ")}\n` +
  `  tickets: ${tickets.size} keys · candidates for diff review: ${candidates.length}\n` +
  `  digest: ${OUT} (${kb} KB)`
);
