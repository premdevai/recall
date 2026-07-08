---
name: recall
version: 0.7.0
description: Reconstruct an engineer's demonstrable work from git history — and any connected MCP sources (GitHub/GitLab/Bitbucket PRs, Jira/Linear tickets, Datadog/CI metrics) — into a categorized, evidence-backed, interview-ready record, rendered as a self-contained HTML page or a Markdown file. Also powers the job-switch pipeline end to end — role-fit analysis (/recall roles), tailoring evidence to a job posting (/recall apply), the application funnel (/recall status), mock-interview rehearsal (/recall interview), comp-conversation briefs (/recall negotiate), résumé bullets (/recall bullets), STAR rehearsal (/recall star), and PDF / JSON Resume / LinkedIn exports. Use when the user asks to "summarize what I've built", "generate my brag doc / résumé bullets / interview prep", "what roles suit me", "tailor my resume to this job", "track my applications", "recall my work in this repo", "my career timeline", prepares for a review or promotion packet, or invokes /recall. /recall career merges evidence across repos and employers from the local store; /recall add records non-git work (talks, mentoring, on-call) as marked self-reported evidence.
---

# Recall

Turn engineering history into proof. Reconstruct what the user has demonstrably built —
organized by skill, with STAR stories and linked evidence — never from what they remember,
always from the record. The output is something they can walk into an interview with:
clarity, the confidence of receipts, and proof behind every line.

## 0. Pick the mode

The argument selects the mode. Every mode runs on the same evidence model (§2–3) — build or
load it first, then branch:

| Invocation | Output |
|---|---|
| `/recall` | Full report (HTML/MD) — §4 |
| `/recall roles` | Role-fit analysis for a job switch — §5 |
| `/recall apply <job posting text or URL>` | Evidence tailored to one specific job — §5 |
| `/recall bullets` | Just the résumé bullets, paste-ready Markdown |
| `/recall star <topic>` | One STAR story in rehearsal format |
| `/recall last-year` / `for-promo` / `for-jobs` | Presets: timeframe 12mo / emphasis on impact+scope / runs `roles` after the report |
| `/recall career` | Cross-repo career timeline from the store — §6 |
| `/recall add <what they did>` | Record non-git evidence (talks, mentoring, on-call) as `self-reported` — §6 |
| `/recall status` | Application funnel from the tracker — §7 |
| `/recall interview <company>` | Mock-interview rehearsal against the stored kit — §7 |
| `/recall negotiate` | Scope-and-impact brief for comp conversations — §7 |

## 1. Scope the run — never ask what you can infer

**Zero questions is the goal.** Default everything, state the assumptions in one line, keep
moving; the user corrects by replying, not by being interrogated:

- **Repo** — the current directory. Multiple paths given → aggregate (tag each accomplishment
  with its repo).
- **Author identity** — `gather.js` resolves it from `git config` and merges `.mailmap`
  aliases automatically. Only stop if it exits 2 (no match) — then show its author list.
- **Timeframe** — full history. Presets override.
- **Format** — always produce BOTH `journey.html` and `journey.md`; the renderer makes the
  second format free.

**Print a source manifest, then proceed** — never wait for permission:

```
Sources: git ✓ 412 commits (you@example.com + 1 alias) · Jira ✓ · GitHub ✗ not connected
```

Missing sources are handled by the gap report at the end, not by blocking the run.

## 2. Gather evidence — scripts do the mechanics, you do the judgment

**Step 1 — run the gather script** (it sits next to this SKILL.md; zero dependencies):

```
node <skill-dir>/gather.js --repo <path>          # add --author <id> only if config identity is wrong
```

It writes `.recall/digest.json` (~10–30 KB): identity + merged aliases, totals, all chart
arrays precomputed, every ticket key with sample shas, and a ranked **candidates** list —
the commits whose churn marks them as probable accomplishments. **Never run
`git log -p` over full history yourself** — the digest exists so you don't burn tokens
parsing raw logs.

**Step 2 — read diffs for candidates only.** For each digest candidate (batch them):

```
git show --stat -p --max-count=1 <sha>   # cap: skip diffs beyond ~400 lines; the stat tells you enough
```

Infer real intent from the diff — a message of "fix bug" tells you nothing; a diff adding a
windowing library and a row-height cache is "introduced list virtualization".

**Step 3 — MCP sources.** MCP tools are usually *deferred*: they will NOT appear in your
loaded tool list, so "I don't see a Jira tool" is not evidence that Jira isn't connected:

1. **Discover tools with ToolSearch** — `jira issue`, `linear issue`, `pull request`,
   `datadog metric`, `sentry`; load what matches.
2. **Query in batches** using `digest.tickets` as the join:
   - *Jira*: one JQL per ~50 keys — `key in (PROJ-1, PROJ-2, …)` — then one sweep:
     `assignee = "<user email>" AND resolutiondate >= "<start>" ORDER BY resolved DESC`.
     Never fetch tickets one call at a time.
   - *Linear*: issues assigned to the user in the timeframe.
   - *GitHub / GitLab / Bitbucket*: merged PRs authored by the user; reviews given.
3. **Report source status honestly.** Auth error → tell the user once ("Jira is connected
   but needs authentication — reconnect to include tickets") and continue. Skip silently
   only when discovery finds no tools for a source. Never require, never fabricate.

What each source adds:

| Source | What it adds |
|---|---|
| GitHub / GitLab / Bitbucket | Merged PRs, review comments left, approvals given, issues closed |
| Jira / Linear | Tickets completed, story context, acceptance criteria, labels |
| Datadog / Sentry / observability | Real before/after metrics, error-rate drops, incidents owned |
| PagerDuty | Incidents responded to and resolved — on-call ownership as evidence |
| GitHub Actions / CircleCI / CI | Releases shipped, deployment frequency, pipeline work |

Every adapter follows one contract: *discover via ToolSearch → query by identity +
timeframe (batched) → map results to evidence.json records → cite source ids in
`evidence[]`*. Adding a source never touches the renderers.

**Authored vs enabled.** Reviews and approvals the user *gave* are leverage, not
authorship — put them in top-level `enabled` (`prsReviewed`, `reviews`, `approvals`,
`highlights[]`), never into `stats` commit/PR counts. This is how senior-IC impact
(unblocking others) stays visible without inflating authored numbers.

MCP evidence is what turns an *inferred* result ("felt faster") into a *measured* one
("p75 5.2s → 2.1s"), and raises the confidence of a claim by independent corroboration.

## 3. Build the evidence model

Merge related commits, PRs, and tickets into single accomplishments. One dataset drives every
render — never assemble the HTML and Markdown separately. For each accomplishment:

- `category` (skill area) and `title`
- `situation`, `task`, `action`, `result` — use **real measured numbers** when a source
  provides them; otherwise describe the change without inventing figures
- `resume_bullet` — one crisp line
- `confidence` 0–100 — résumé-worthiness: a typo or formatting change ~2, a shipped feature
  with measured impact ~90+
- `evidence` — commit shas, PR numbers, ticket keys, dashboard links

Also derive a **skills table**: per competency, the real merged-PR and commit counts, an
activity trace over the timeframe, and when it was last touched. Counts come from the data —
never a self-assessed 0–100 score.

**Write ONE file: `.recall/evidence.json`** (shape: `evidence.schema.json`, with
`"schema_version": 2` — v1 predates self-reported marking, so older renderers must
refuse rather than silently drop the markers). This is your single deliverable — the renderer derives both output
formats from it mechanically. Include `signals[]` for any measured MCP metrics. gather.js
already added `.recall/` to `.gitignore`.

**Then file it in the career store** (fast, tokenless — always do this after writing
evidence.json):

```
node <skill-dir>/merge.js --add --repo <path>      # add --employer "Acme" if the repo name isn't the employer
```

This copies the evidence into `~/.recall/store/<repo-id>/` (repo-id = root-commit sha, so
clones and renames land in the same entry) and rebuilds `~/.recall/career.json` — the
cross-repo roll-up that powers `/recall career`, `roles`, and `apply` across a whole
career. Plain JSON on disk, chmod 600, never synced anywhere.

**Incremental runs.** If `.recall/evidence.json` already exists, re-run gather.js (fast,
tokenless), then judge only candidates newer than the previous evidence — merge new
accomplishments in, keep prior ones untouched, and re-query MCP only for new ticket keys.
Tell the user what was reused. `--full` in the request forces a full re-judgment.

## 4. Render — one command, never by hand

```
node <skill-dir>/render.js --evidence .recall/evidence.json --digest .recall/digest.json
```

This produces **both** `journey.html` (the locked amber design, charts filled from the
digest, low-confidence items filtered at 40 — pass `--min-confidence` to change) and
`journey.md` (paste-ready mirror with unicode sparklines). **Do not write the HTML or the
Markdown yourself** — the renderer guarantees the design, escapes content, reconciles every
chart with the digest, and removes sections with no data (Signals, etc.). If it exits
non-zero, fix `evidence.json` (its error says what's wrong) and re-run.

**Manual fallback — only if `node` is genuinely unavailable:** build from `template.html`
per its header instructions: copy `<style>`/`<script>` verbatim (the look is amber `#d29a4a`
on warm near-black — purple/blue/emerald accents are FORBIDDEN), fill placeholders and
SLOTs with real evidence following `examples/journey.html`, dense chart CSVs that reconcile
with the stats, one MCP-library component per measured metric, never fabricate.

### Exports — pure code, zero tokens, offline

When the user wants a PDF, a [JSON Resume](https://jsonresume.org), or LinkedIn sections,
run the exporter — never retype the content yourself:

```
node <skill-dir>/export.js --pdf                    # journey.html → journey.pdf (needs local Chrome)
node <skill-dir>/export.js --json-resume            # evidence/career → resume.json
node <skill-dir>/export.js --linkedin               # evidence/career → linkedin.md
```

All three read `.recall/evidence.json` (or pass `--evidence ~/.recall/career.json` for the
whole career, including a filtered `--exclude-employer` view). Self-reported items stay
marked in every format. If `--pdf` dies, tell the user its message (open the HTML and
print, or set `CHROME=<path>`).

### End every run with a gap report

Three lines max, each an action that would make the next report stronger. Only real gaps:

```
Make this stronger:
  · 14 accomplishments have no measured result — connect Datadog/observability MCP
  · 9 commits reference PROJ-* tickets I couldn't fetch — authenticate Jira (/mcp)
  · No PR/review data — connect GitHub MCP to add collaboration evidence
```

## 5. Job-switch modes

Both modes read `~/.recall/career.json` when it exists AND includes the current repo's
latest evidence (run the report + `merge.js --add` first if unsure — a stale career file
from another employer is worse than one repo's fresh evidence); else `.recall/evidence.json`
(build it first if missing). When tailoring for a specific employer, build the input with
`--exclude-employer` so another company's project names can't leak into the kit. Output is
Markdown —
paste-ready beats pretty here. Same honesty rules: every claim cites evidence; never inflate
seniority or invent experience with a technology the record doesn't show.

### `/recall roles` — what roles fit the record

1. **Profile the evidence**: dominant skill areas by weight (commits × confidence), breadth vs
   depth, seniority signals (scope of changes, migrations led, incidents owned, reviews given),
   and *trajectory* — what they've been doing more of lately.
2. **Rank 3–5 role archetypes** they could realistically get *today* — e.g. Senior Backend,
   Platform/Infra, Full-Stack, SRE, Staff-track generalist. For each:
   - **Why** — 2–3 evidence-backed reasons citing specific accomplishments
   - **Strongest proof** — the accomplishments to lead with for this role
   - **Gap** — the one honest thing missing, and whether the record shows a path to it
3. **Search kit**: job-board search strings and title keywords for the top roles, plus the
   skill keywords their evidence actually supports (for résumé ATS matching).

### `/recall apply <job posting>` — tailor the record to one job

Accept pasted text or a URL. A URL is the product's only outbound network call — fetch it
with WebFetch (plus, optionally, one fetch of the company's engineering/about page to sharpen
domain fit); never fetch anything the user didn't point at. Save the posting text to
`.recall/jd.txt`, then:

1. **Hash it** — `node <skill-dir>/apply.js --jd .recall/jd.txt` prints
   `<hash> <cachePath> <hit|miss>`. On **hit**, read the cached parse and skip step 2.
2. **Parse the posting** (miss only) into the cache file as JSON:
   `{ "company", "role", "seniority", "domain", "requirements": [{ "req", "kind": "required"|"nice" }] }`.
3. **Match against evidence** — write `.recall/apply-<company>.match.json`:
   `{ "company", "role", "jd_hash", "requirements": [{ "req", "match": "strong"|"partial"|"gap", "evidence_ids": [...], "note" }], "bullets": [{ "text", "evidence_id" }], "coverLetter": ["p1","p2","p3"], "questions": [{ "q", "evidence_id" }] }`.
   Rules: `strong` = direct accomplishment, `partial` = adjacent evidence, `gap` = say so with
   an honest-framing note, never a bluff. Every id must be a real accomplishment id. Reorder
   bullets so the posting's top requirements lead; pick the 5 most likely technical questions.
4. **Render the kit** — `node <skill-dir>/apply.js --kit .recall/apply-<company>.match.json
   --evidence <evidence.json or career view>`. The script validates every citation (it exits 2
   on an id it can't find — fix the match file, don't bypass it), downgrades strong claims
   backed only by self-reported items, computes the fit numbers, and writes
   `.recall/apply-<company>.md` with proof text pulled from the record.
5. **Start tracking** — `node <skill-dir>/track.js --add --company "<c>" --role "<r>"
   --jd-hash <hash> --artifact .recall/apply-<company>.md`. Say one line:
   the kit path and that `/recall status` shows the funnel.

## 6. Career modes

### `/recall career` — the timeline across repos and employers

```
node <skill-dir>/render.js --career ~/.recall/career.json --md career.md
```

career.json is already current if a report just ran (`merge.js --add` rebuilds it);
run plain `node <skill-dir>/merge.js` first only when the store changed outside a
report. The renderer is mechanical: per-employer segments with tenure and top
accomplishments,
merged skills table, enabled rollup, self-reported items in their own marked section.
If the store is empty, run a normal report first (it files itself). Two flags for
sensitive reports, applied at merge time:

- `--exclude-employer "Acme"` — drops that employer's repos AND scrubs its names from
  the remaining content, so a report for one job never leaks another company's project
  names (pass `--out <file>` to write the filtered view)
- `--anonymize` — repo/employer names become "Employer A/B…" in every field and free-text
  mention, and store ids (root-commit shas, searchable on public forges) are masked

Views never overwrite `~/.recall/career.json` (the script refuses) and can't combine
with `--add` — file first, then build the view.

### `/recall add <what they did>` — non-git evidence

Talks, mentoring, docs, on-call, incident command — real work git never saw. Collect
conversationally in ONE exchange (what, when, scope, any link or witness), then append
an accomplishment to `.recall/evidence.json` with:

- `"source": "self-reported"` and evidence `[{ "type": "self", "ref": "told to recall <date>" }]`
  (plus any real link the user gave as a second evidence item)
- honest confidence — self-reported caps at ~60 unless a link corroborates it

Then re-run render and `merge.js --add`. Self-reported items are ALWAYS rendered with a
marker and never counted in verified totals — mixing them silently would poison the
whole record's credibility.

## 7. The application pipeline

All three modes run on artifacts `/recall apply` already produced — the kit, the match
file, and the tracker. If none exist, run `apply` first.

### `/recall status` — the funnel

```
node <skill-dir>/track.js --status
```

Print its output as-is. When the user reports movement ("Acme moved me to onsite",
"Bolt rejected me"), record it: `node <skill-dir>/track.js --app <id> --set <status>`
(statuses: drafted → applied → screen → interview → offer, closed from anywhere). The
script rejects illegal jumps — if it exits 2, relay its message; never edit
`.recall/applications.json` by hand.

### `/recall interview <company>` — rehearsal loop

Load `.recall/apply-<company>.match.json` and the evidence it cites. Then rehearse, one
question at a time:

1. Ask the most likely question for that posting (from the kit's questions, plus gaps —
   interviewers find those).
2. The user answers in their own words.
3. Critique against the record: point to the stronger accomplishment they forgot, the
   measured number they rounded away, the STAR beat they skipped. Tighten their wording
   and re-ask until it lands.

Judgment calls (what to ask next, what a good answer sounds like) are yours; the *facts*
in every model answer come from the evidence — same honesty rules, numbers only from the
record.

### `/recall negotiate` — the comp brief

Build a one-page Markdown brief from the **highest-confidence, measured** evidence only:
signals[] and accomplishments with metric-type evidence, ordered by business impact.
Format: scope (what they own), impact (each line = one measured result **with its evidence
ref inline** — a number without a ref does not go in the brief), and leverage
(enabled rollup: reviews, unblocking). No scripts to run — but the no-unsourced-numbers
rule is absolute here; this document gets read by the person deciding their pay.

## Rules

- **Evidence or it didn't happen.** Every claim links to a commit, PR, ticket, or metric.
- **Never inflate.** Low confidence is honest and more useful than a padded résumé.
- **Stay local.** You only read what is already on the user's machine or in the tools they
  have connected. Nothing is uploaded anywhere the user hasn't chosen.
