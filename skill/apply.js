#!/usr/bin/env node
// recall apply — mechanics of the application kit; judgment stays with the model.
//
//   node apply.js --jd <posting.txt> [--dir .recall]
//     Normalize + content-hash the posting, print "<hash> <cachePath> <hit|miss>".
//     The model parses the JD into the cache file ONLY on a miss.
//
//   node apply.js --kit <match.json> [--evidence <file>] [--out <file>]
//     The honesty chokepoint: every strong/partial requirement must cite
//     accomplishment ids that exist in the record; claims backed only by
//     self-reported items are downgraded to partial and marked. Proof text
//     (titles, bullets, STAR) is pulled from the record by id — the model
//     never retypes it. Fit numbers are derived from the data.
//
// Accepts .recall/evidence.json or a career.json / filtered view from merge.js
// (--exclude-employer / --anonymize compose here for free). Zero dependencies.
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const argv = process.argv.slice(2);
function opt(name, dflt) {
  const i = argv.indexOf("--" + name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
}
function die(msg) { console.error("recall apply: " + msg); process.exit(2); }

// any source value other than "verified" (or evidence that is all type=self)
// means self-reported — a typo must never promote a claim
const isSelf = (a) => a.source ? a.source !== "verified" : (a.evidence || []).every((e) => e.type === "self");

// ---------- --jd: content-hash cache ----------
const JD = opt("jd", null);
if (JD) {
  let raw;
  try { raw = fs.readFileSync(JD, "utf8"); }
  catch (e) { die("cannot read " + JD + " — " + e.message); }
  // trim/collapse whitespace and lowercase so re-pastes of the same posting hash identically
  const norm = raw.toLowerCase().replace(/\s+/g, " ").trim();
  if (!norm) die(JD + " is empty — save the posting text first");
  const hash = crypto.createHash("sha256").update(norm).digest("hex").slice(0, 12);
  const dir = opt("dir", ".recall");
  fs.mkdirSync(dir, { recursive: true });
  const cache = path.join(dir, "jd-" + hash + ".json");
  console.log(hash + " " + cache + " " + (fs.existsSync(cache) ? "hit" : "miss"));
  process.exit(0);
}

// ---------- --kit: validate match, render the kit ----------
const KIT = opt("kit", null);
if (!KIT) die("pass --jd <posting.txt> or --kit <match.json>");
const EVIDENCE = opt("evidence", path.join(".recall", "evidence.json"));

let m;
try { m = JSON.parse(fs.readFileSync(KIT, "utf8")); }
catch (e) { die("cannot read " + KIT + " — " + e.message); }
if (!m.company || typeof m.company !== "string") die("match file needs a non-empty company");
if (!m.role) die("match file needs a role");
if (!Array.isArray(m.requirements) || !m.requirements.length) die("match file needs a non-empty requirements array");

let ev;
try { ev = JSON.parse(fs.readFileSync(EVIDENCE, "utf8")); }
catch (e) { die("cannot read " + EVIDENCE + " — run a recall report first (" + e.message + ")"); }
const isCareer = ev.kind === "career";
const maxVer = isCareer ? 1 : 2;
if (ev.schema_version && ev.schema_version > maxVer)
  die(`${EVIDENCE} schema_version ${ev.schema_version} is newer than this tool (${maxVer}). Update recall: npx @premdevai/recall@latest`);
if (!Array.isArray(ev.accomplishments) || !ev.accomplishments.length)
  die(EVIDENCE + " has no accomplishments — run a recall report first");

const byId = new Map();
for (const a of ev.accomplishments) {
  a.source = isSelf(a) ? "self-reported" : "verified";
  byId.set(String(a.id), a);
}
function resolve(where, ids) {
  if (!Array.isArray(ids) || !ids.length) die(where + " cites no evidence — an unproven claim is a gap, not a match");
  return ids.map((id) => {
    const a = byId.get(String(id));
    if (!a) die(`${where} cites unknown evidence id "${id}" — cite real accomplishment ids from ${EVIDENCE}`);
    return a;
  });
}

const reqs = m.requirements.map((r) => {
  if (!r.req) die("every requirement needs a req text");
  if (!["strong", "partial", "gap"].includes(r.match))
    die(`requirement "${r.req}": match must be one of strong, partial, gap (got "${r.match}")`);
  if (r.match === "gap") return { ...r, proof: [] };
  const proof = resolve(`requirement "${r.req}"`, r.evidence_ids);
  let match = r.match;
  if (match === "strong" && proof.every((a) => a.source === "self-reported")) {
    match = "partial"; // self-reported alone never carries a strong claim
    console.error(`recall apply: "${r.req}" downgraded strong → partial (only self-reported evidence cited)`);
  }
  return { ...r, match, proof };
});
const bullets = (m.bullets || []).map((b) => ({ ...b, acc: resolve(`bullet "${(b.text || "").slice(0, 40)}"`, [b.evidence_id])[0] }));
const questions = (m.questions || []).map((q) => ({ ...q, acc: resolve(`question "${(q.q || "").slice(0, 40)}"`, [q.evidence_id])[0] }));

// fit is derived from the validated array — never a model-supplied counter
const n = { strong: 0, partial: 0, gap: 0 };
for (const r of reqs) n[r.match]++;
const total = reqs.length;

const slug = m.company.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "company";
const OUT = opt("out", path.join(".recall", `apply-${slug}.md`));

const cell = (s) => String(s == null ? "" : s).replace(/\|/g, "\\|").replace(/\s+/g, " ");
const mark = (a) => a.source === "self-reported" ? " (self-reported)" : "";
const firstRef = (a) => { const e = (a.evidence || [])[0]; return e ? `${e.type} ${e.ref}` : ""; };
const proofLine = (proof) => proof.map((a) =>
  `${a.title}${mark(a)}${a.resumeBullet ? ": " + a.resumeBullet : ""} — ${firstRef(a)}`).join("; ");

let md = `# Application kit — ${m.role} @ ${m.company}\n\n`;
md += `> Fit: ${n.strong} strong · ${n.partial} partial · ${n.gap} gap of ${total} requirements (${Math.round((n.strong / total) * 100)}% strong)`;
md += ` · built from ${EVIDENCE}${m.jd_hash ? ` · posting ${m.jd_hash}` : ""}\n\n`;

md += `## Requirement match\n\n| Requirement | Match | Proof from the record |\n|---|---|---|\n`;
for (const r of reqs)
  md += `| ${cell(r.req)} | **${r.match}** | ${cell(r.match === "gap" ? (r.note || "no adjacent evidence") : proofLine(r.proof) + (r.note ? ` — ${r.note}` : ""))} |\n`;

if (bullets.length) {
  md += `\n## Tailored résumé bullets\n\n`;
  for (const b of bullets) md += `- ${b.text}${mark(b.acc)} _(${b.acc.title}: ${firstRef(b.acc)})_\n`;
}

if (Array.isArray(m.coverLetter) && m.coverLetter.length) {
  md += `\n## Cover letter draft\n\n${m.coverLetter.join("\n\n")}\n`;
}

if (questions.length) {
  md += `\n## Interview prep\n`;
  for (const q of questions) {
    const a = q.acc;
    md += `\n### ${q.q}\n\nAnswer with **${a.title}**${mark(a)} (confidence ${a.confidence}):\n\n`;
    if (a.star && a.star.situation) {
      md += `- **Situation** — ${a.star.situation}\n- **Task** — ${a.star.task}\n- **Action** — ${a.star.action}\n- **Result** — ${a.star.result}\n`;
    } else {
      md += `- ${a.resumeBullet || a.title}\n`;
    }
    md += `- **Evidence** — ${(a.evidence || []).map((e) => e.type + " " + e.ref + (e.detail ? ` (${e.detail})` : "")).join(" · ")}\n`;
  }
}

const gaps = reqs.filter((r) => r.match === "gap");
if (gaps.length) {
  md += `\n## Gaps to prepare a line for\n\n`;
  for (const g of gaps) md += `- **${g.req}** — ${g.note || "nothing adjacent on the record; say so plainly"}\n`;
}

md += `\n---\n<sub>Generated by Recall. Every match cites the record; gaps are stated, never bluffed. Self-reported items are marked.</sub>\n`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, md);
console.error(`recall apply: ${OUT} — ${n.strong} strong · ${n.partial} partial · ${n.gap} gap of ${total}`);
