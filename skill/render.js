#!/usr/bin/env node
// recall render — merges .recall/evidence.json (+ .recall/digest.json) into
// template.html and a Markdown mirror. The model writes evidence.json ONLY;
// this script owns all markup, so the locked design is guaranteed and the
// model never retypes the template. Zero dependencies.
"use strict";

const fs = require("fs");
const path = require("path");

const argv = process.argv.slice(2);
function opt(name, dflt) {
  const i = argv.indexOf("--" + name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
}
const EVIDENCE = opt("evidence", ".recall/evidence.json");
const DIGEST = opt("digest", ".recall/digest.json");
const TEMPLATE = opt("template", path.join(__dirname, "template.html"));
const OUT_HTML = opt("out", "journey.html");
const OUT_MD = opt("md", "journey.md");
const MIN_CONF = parseInt(opt("min-confidence", "40"), 10);

function die(msg) { console.error("recall render: " + msg); process.exit(2); }

// ---------- load & validate ----------
let ev;
try { ev = JSON.parse(fs.readFileSync(EVIDENCE, "utf8")); }
catch (e) { die("cannot read " + EVIDENCE + " — " + e.message); }
if (ev.schema_version && ev.schema_version > 1)
  die(`evidence schema_version ${ev.schema_version} is newer than this renderer (1). Update recall: npx @premdevai/recall@latest`);
if (!ev.subject || !ev.subject.engineer || !ev.subject.repo) die("evidence.subject.engineer and .repo are required");
if (!Array.isArray(ev.accomplishments) || !ev.accomplishments.length) die("evidence.accomplishments must be a non-empty array");
for (const a of ev.accomplishments) {
  if (!a.id || !a.title || !a.category) die(`accomplishment missing id/title/category: ${JSON.stringify(a).slice(0, 80)}`);
  if (!Array.isArray(a.evidence) || !a.evidence.length) die(`"${a.title}" has no evidence — a claim without evidence does not belong here`);
  if (typeof a.confidence !== "number") die(`"${a.title}" has no confidence score`);
}
let dg = null;
try { dg = JSON.parse(fs.readFileSync(DIGEST, "utf8")); } catch {}

const acc = ev.accomplishments.filter((a) => a.confidence >= MIN_CONF)
  .sort((a, b) => b.confidence - a.confidence);
if (!acc.length) die(`no accomplishments at confidence >= ${MIN_CONF}; lower --min-confidence`);
const dropped = ev.accomplishments.length - acc.length;

const esc = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fmt = (n) => (+n).toLocaleString("en-US");
const monthName = (iso) => ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][+iso.slice(5, 7) - 1];
const mLabel = (iso) => monthName(iso) + " " + iso.slice(0, 4);

// ---------- derived facts ----------
const stats = ev.stats || {};
const from = (ev.subject.tenure && ev.subject.tenure.from) || (dg && dg.range.from);
const to = (ev.subject.tenure && ev.subject.tenure.to) || (dg && dg.range.to);
const commitCount = stats.commits || (dg && dg.totals.commits) || 0;
const years = from && to ? (new Date(to) - new Date(from)) / 31557600000 : 0;
const tenure = years >= 1 ? (Math.round(years * 10) / 10) + " years" : Math.max(1, Math.round(years * 12)) + " months";
const skills = ev.skills || [];
const sources = (ev.subject.sources || ["git"]).join(", ");

// ---------- HTML blocks ----------
const termlines = [];
if (stats.prsMerged || stats.reviewComments || stats.issuesClosed)
  termlines.push(`<div><span class="p">→</span> <span class="g">${stats.prsMerged || 0} PRs · ${stats.reviewComments || 0} reviews · ${stats.issuesClosed || 0} issues</span></div>`);
termlines.push(`<div><span class="p">→</span> <span class="g">classified into </span><span class="a">${skills.length || new Set(acc.map((a) => a.category)).size} skill areas</span></div>`);
termlines.push(`<div><span class="p">→</span> <span class="g">${acc.length} accomplishments · </span><span class="a">confidence ≥ ${MIN_CONF}</span></div>`);

const statTiles = [];
if (commitCount) statTiles.push(`<div class="stat big" data-reveal><div class="n" data-count="${commitCount}"><em>0</em></div><div class="l">Commits authored</div><div class="sub">${esc(from && to ? `${mLabel(from)} → ${mLabel(to)}` : "")}</div></div>`);
if (stats.prsMerged) statTiles.push(`<div class="stat med" data-reveal><div class="n" data-count="${stats.prsMerged}">0</div><div class="l">Pull requests merged</div></div>`);
if (stats.issuesClosed) statTiles.push(`<div class="stat sm" data-reveal><div class="n" data-count="${stats.issuesClosed}">0</div><div class="l">Issues closed</div></div>`);
if (stats.reviewComments) statTiles.push(`<div class="stat sm" data-reveal><div class="n" data-count="${stats.reviewComments}">0</div><div class="l">Review comments</div></div>`);
if (stats.linesAdded || stats.linesRemoved) {
  const k = (n) => Math.round((n || 0) / 100) / 10;
  statTiles.push(`<div class="stat med" data-reveal><div class="n"><span data-count="${k(stats.linesAdded)}">0</span>k <span style="color:var(--faint)">/</span> <span style="color:var(--muted)" data-count="${k(stats.linesRemoved)}">0</span>k</div><div class="l">Lines added / removed</div></div>`);
} else if (dg) {
  const k = (n) => Math.round(n / 100) / 10;
  statTiles.push(`<div class="stat med" data-reveal><div class="n"><span data-count="${k(dg.totals.insertions)}">0</span>k <span style="color:var(--faint)">/</span> <span style="color:var(--muted)" data-count="${k(dg.totals.deletions)}">0</span>k</div><div class="l">Lines added / removed</div></div>`);
}
if (stats.releases) statTiles.push(`<div class="stat sm" data-reveal><div class="n" data-count="${stats.releases}">0</div><div class="l">Releases shipped</div></div>`);

const signals = (ev.signals || []).map((s) => {
  const delta = s.from != null
    ? `<div class="delta"><span class="from">${esc(s.from)}</span><span class="arrow">→</span><span class="to">${esc(s.to)}</span></div>`
    : `<div class="delta"><span class="to">${esc(s.to)}</span></div>`;
  const rows = (s.rows || []).map((r) => `<div class="row"><span>${esc(r.label)}</span><b>${esc(r.value)}</b></div>`).join("");
  const cap = s.caption ? `<div class="pct ${s.status || "good"}">${esc(s.caption)}</div>` : "";
  return `<div class="signal" data-reveal><span class="src">${esc(s.source)}</span><div class="mname">${esc(s.name)}</div>${delta}${cap}${rows}</div>`;
});

const rel = (iso) => { // "3 mo ago" — presentation only
  if (!/^\d{4}-\d{2}/.test(iso)) return null;
  const d = Math.round((Date.now() - new Date(iso)) / 86400000);
  return d < 45 ? d + " days ago" : d < 550 ? Math.round(d / 30.4) + " mo ago" : Math.round(d / 365.25 * 10) / 10 + " yrs ago";
};
// no model-provided skills → fall back to git areas from the digest, so the
// table is never empty and never fabricated
const skillSrc = skills.length ? skills : (dg ? Object.entries(dg.charts.areas).slice(0, 8).map(([a, n]) => ({
  name: a, commits: n, activity: { values: dg.charts.area_quarterly.series[a] || [] },
})) : []);
const skillRows = skillSrc.map((s) => {
  const spark = (s.activity && s.activity.values || []).join(",");
  const ago = s.lastTouched && rel(s.lastTouched);
  const last = ago ? mLabel(s.lastTouched) : esc(s.lastTouched || "");
  return `<div class="prow" data-reveal><div class="sk">${esc(s.name)}<small>${esc(s.subtitle || "")}</small></div><div class="metric pralign-r">${s.prs != null ? s.prs : "—"}</div><div class="metric pralign-r">${s.commits != null ? s.commits : "—"}</div><div class="spark" data-spark="${spark}"></div><div class="last">${last}<i>${ago || ""}</i></div></div>`;
});

const accent = (t) => { const w = t.trim().split(" "); const lastTwo = w.splice(-Math.min(2, w.length)).join(" "); return (w.length ? esc(w.join(" ")) + " " : "") + "<b>" + esc(lastTwo) + "</b>"; };
const acts = (ev.phases || []).map((p) => {
  const ms = acc.filter((a) => a.phase === p.key).slice(0, 3).map((a) =>
    `<div class="ms"><div class="cat">${esc(a.category)}</div><div class="t">${esc(a.title)}</div><div class="d">${esc(a.resumeBullet || (a.star && a.star.result) || "")}</div></div>`).join("");
  const range = p.from && p.to ? `${monthName(p.from)} '${p.from.slice(2, 4)} → ${monthName(p.to)} '${p.to.slice(2, 4)}` : "";
  return `<div class="act" data-reveal><div class="when num">${range}</div><h3>${accent(p.title)}</h3><p class="arc">${esc(p.narrative || "")}</p><div class="milestones">${ms}</div></div>`;
});

const byDate = [...acc].sort((a, b) => (b.date || "") < (a.date || "") ? -1 : 1);
const logrows = byDate.map((a) => {
  const ref = a.evidence[0];
  return `<div class="logrow"><span class="date">${esc(a.date || "")}</span><span class="lchip">${esc(a.category)}</span><span class="lt">${esc(a.title)}</span><span class="lpr">${esc(ref.type === "pr" ? "#" + ref.ref.replace(/^#/, "") : ref.ref)}</span></div>`;
});

const stories = acc.filter((a) => a.star && a.star.situation).slice(0, 6).map((a) => {
  const chips = [];
  const pr = a.evidence.find((e) => e.type === "pr");
  if (pr) chips.push(`<span class="chip pr">PR #${esc(pr.ref).replace(/^#/, "")}</span>`);
  const nCommits = a.evidence.filter((e) => e.type === "commit").length;
  if (nCommits) chips.push(`<span class="chip">${nCommits} commit${nCommits > 1 ? "s" : ""}</span>`);
  for (const t of a.evidence.filter((e) => e.type === "ticket").slice(0, 2)) chips.push(`<span class="chip">${esc(t.ref)}</span>`);
  const met = a.evidence.find((e) => e.type === "metric");
  if (met && met.detail) chips.push(`<span class="chip">${esc(met.detail)}</span>`);
  return `<article class="story" data-reveal><div class="side"><div><div class="cat">${esc(a.category)}</div><h3>${esc(a.title)}</h3></div><div><div class="conf"><div class="lab"><span>Confidence</span><b class="num">${a.confidence}</b></div><div class="track"><i style="--w:${a.confidence}%"></i></div></div><div class="evidence" style="margin-top:18px">${chips.join("")}</div></div></div><div class="body"><div class="star"><div class="lab">Situation</div><p>${esc(a.star.situation)}</p></div><div class="star"><div class="lab">Task</div><p>${esc(a.star.task)}</p></div><div class="star"><div class="lab">Action</div><p>${esc(a.star.action)}</p></div><div class="star res"><div class="lab">Result</div><p>${esc(a.star.result)}</p></div></div></article>`;
});

// ---------- vars ----------
const hb = dg ? Object.entries(dg.charts.areas).slice(0, 8) : [];
const vars = {
  ENGINEER: esc(ev.subject.engineer),
  REPO: esc(ev.subject.repo),
  AUTHOR: esc(ev.subject.engineer),
  FROM: from ? mLabel(from) : "", TO: to ? mLabel(to) : "",
  TENURE_YEARS: tenure,
  COMMITS: fmt(commitCount),
  TOTAL: fmt(commitCount),
  MONTHS: dg ? dg.charts.monthly.values.length : "",
  CSV_MONTHLY_COUNTS: dg ? dg.charts.monthly.values.join(",") : "",
  CSV_MONTH_LABELS: dg ? dg.charts.monthly.labels.join(",") : "",
  CSV_DAILY_COUNTS: dg ? dg.charts.heatmap.values.join(",") : "",
  FIRST_MONDAY_ISO: dg ? dg.charts.heatmap.start : "",
  HBARS: hb.map(([a, n]) => a + ":" + n).join(","),
  LOG_COUNT: logrows.length,
  FOOTER_PROVENANCE: esc(`Generated ${new Date().toISOString().slice(0, 10)} from ${sources}.` + (dropped ? ` ${dropped} low-confidence items filtered (< ${MIN_CONF}).` : "")),
};

// ---------- merge ----------
let html = fs.readFileSync(TEMPLATE, "utf8");
const slots = { termlines, stats: statTiles, signals, skillrows: skillRows, acts, logrows, stories };
for (const [name, items] of Object.entries(slots))
  html = html.replace(new RegExp(`[ \\t]*<!-- SLOT:${name}[\\s\\S]*?-->`), items.join("\n"));
if (!signals.length) html = html.replace(/<section id="signals">[\s\S]*?<\/section>/, "");
if (!dg) html = html.replace(/<section id="activity">[\s\S]*?<\/section>/, "");
if (!skillRows.length) html = html.replace(/<section id="skills">[\s\S]*?<\/section>/, "");
html = html.replace(/<!--[\s\S]*?-->/g, ""); // strip comments (header docs, MCP library) BEFORE var check
html = html.replace(/\{\{([A-Z_0-9]+)\}\}/g, (_, k) => {
  if (k in vars) return vars[k];
  die("template var {{" + k + "}} has no value");
});
const left = html.match(/\{\{[^}]*\}\}/);
if (left) die("unfilled placeholder survived: " + left[0]);
fs.writeFileSync(OUT_HTML, html);

// ---------- markdown mirror ----------
const SP = "▁▂▃▄▅▆▇█";
const uspark = (vals) => { const mx = Math.max(...vals, 1); return vals.map((v) => SP[Math.min(7, Math.round((v / mx) * 7))]).join(""); };
let md = `# ${ev.subject.engineer} — Engineering Record (${ev.subject.repo})\n\n`;
md += `> ${tenure}, ${fmt(commitCount)} commits of evidence · sources: ${sources} · confidence ≥ ${MIN_CONF}\n\n`;
md += `## The paper trail, counted\n\n| Signal | Count |\n|---|---|\n`;
if (commitCount) md += `| Commits authored | **${fmt(commitCount)}** |\n`;
for (const [k, label] of [["prsMerged", "Pull requests merged"], ["issuesClosed", "Issues closed"], ["reviewComments", "Review comments"], ["releases", "Releases shipped"]])
  if (stats[k]) md += `| ${label} | **${fmt(stats[k])}** |\n`;
if (dg) md += `| Lines added / removed | **${fmt(dg.totals.insertions)} / ${fmt(dg.totals.deletions)}** |\n`;
if (dg) md += `\nCommits per month: \`${uspark(dg.charts.monthly.values)}\` (${dg.charts.monthly.values.length} months)\n`;
if (ev.signals && ev.signals.length) {
  md += `\n## Measured impact\n\n`;
  for (const s of ev.signals) md += `- **${s.name}** (${s.source}): ${s.from != null ? s.from + " → " : ""}${s.to}${s.caption ? " — " + s.caption : ""}\n`;
}
if (skills.length) {
  md += `\n## Skills, counted\n\n| Competency | PRs | Commits | Activity | Last touched |\n|---|---|---|---|---|\n`;
  for (const s of skills)
    md += `| **${s.name}**${s.subtitle ? ` <br><sub>${s.subtitle}</sub>` : ""} | ${s.prs != null ? s.prs : "—"} | ${s.commits != null ? s.commits : "—"} | \`${uspark((s.activity && s.activity.values) || [0])}\` | ${s.lastTouched || "—"} |\n`;
}
if (ev.phases && ev.phases.length) {
  md += `\n## The journey\n`;
  for (const p of ev.phases) {
    md += `\n### ${p.title}${p.from && p.to ? ` · ${mLabel(p.from)} → ${mLabel(p.to)}` : ""}\n\n${p.narrative || ""}\n\n`;
    for (const a of acc.filter((x) => x.phase === p.key))
      md += `- **[${a.category}] ${a.title}** — ${a.resumeBullet || ""} _(${a.evidence.map((e) => e.ref).slice(0, 3).join(", ")})_\n`;
  }
}
md += `\n## Interview-ready STAR stories\n`;
for (const a of acc.filter((x) => x.star && x.star.situation).slice(0, 6)) {
  md += `\n### ${a.title} · confidence ${a.confidence}\n\n`;
  md += `- **Situation** — ${a.star.situation}\n- **Task** — ${a.star.task}\n- **Action** — ${a.star.action}\n- **Result** — ${a.star.result}\n`;
  md += `- **Evidence** — ${a.evidence.map((e) => e.type + " " + e.ref + (e.detail ? ` (${e.detail})` : "")).join(" · ")}\n`;
}
md += `\n## Résumé bullets\n\n`;
for (const a of acc.filter((x) => x.resumeBullet)) md += `- ${a.resumeBullet}\n`;
if (ev.ledger && ev.ledger.length) {
  md += `\n## The long tail\n\n`;
  for (const g of ev.ledger) md += `**${g.group}** — ${g.items.join(" · ")}\n\n`;
}
md += `\n---\n<sub>Generated by Recall — every claim links to a commit, PR, ticket, or metric. ${vars.FOOTER_PROVENANCE}</sub>\n`;
fs.writeFileSync(OUT_MD, md);

console.error(`recall render: ${OUT_HTML} (${Math.round(fs.statSync(OUT_HTML).size / 1024)} KB) + ${OUT_MD} — ${acc.length} accomplishments, ${stories.length} stories${dropped ? `, ${dropped} filtered below ${MIN_CONF}` : ""}`);
