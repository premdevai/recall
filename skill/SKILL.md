---
name: recall
version: 0.5.0
description: Reconstruct an engineer's demonstrable work from git history — and any connected MCP sources (GitHub/GitLab/Bitbucket PRs, Jira/Linear tickets, Datadog/CI metrics) — into a categorized, evidence-backed, interview-ready record, rendered as a self-contained HTML page or a Markdown file. Also powers the job-switch pipeline — role-fit analysis (/recall roles), tailoring evidence to a job posting (/recall apply), résumé bullets (/recall bullets), and STAR rehearsal (/recall star). Use when the user asks to "summarize what I've built", "generate my brag doc / résumé bullets / interview prep", "what roles suit me", "tailor my resume to this job", "recall my work in this repo", prepares for a review or promotion packet, or invokes /recall.
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
| Datadog / observability | Real before/after metrics, incidents owned, deploy counts |
| CI/CD | Releases shipped, deployment frequency |

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
`"schema_version": 1`). This is your single deliverable — the renderer derives both output
formats from it mechanically. Include `signals[]` for any measured MCP metrics. gather.js
already added `.recall/` to `.gitignore`.

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

### End every run with a gap report

Three lines max, each an action that would make the next report stronger. Only real gaps:

```
Make this stronger:
  · 14 accomplishments have no measured result — connect Datadog/observability MCP
  · 9 commits reference PROJ-* tickets I couldn't fetch — authenticate Jira (/mcp)
  · No PR/review data — connect GitHub MCP to add collaboration evidence
```

## 5. Job-switch modes

Both modes read `.recall/evidence.json` (build it first if missing). Output is Markdown —
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

Accept pasted text or a URL (fetch it). Then:

1. **Parse the posting**: required skills, nice-to-haves, seniority, domain.
2. **Match against evidence**: for each requirement — `strong` (direct accomplishment),
   `partial` (adjacent evidence), or `gap` (say so; suggest the honest framing, never a bluff).
3. **Produce the application kit** in one Markdown file (`.recall/apply-<company>.md`):
   - Tailored résumé bullets, reordered so the posting's top requirements lead
   - 3 cover-letter paragraphs built from the strongest matched accomplishments
   - Interview prep: the 5 most likely technical questions given the posting, each paired
     with the STAR story from the evidence that answers it
   - Fit summary: match percentage by requirement count, and the gaps to prepare a line for

## Rules

- **Evidence or it didn't happen.** Every claim links to a commit, PR, ticket, or metric.
- **Never inflate.** Low confidence is honest and more useful than a padded résumé.
- **Stay local.** You only read what is already on the user's machine or in the tools they
  have connected. Nothing is uploaded anywhere the user hasn't chosen.
