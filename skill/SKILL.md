---
name: recall
version: 0.4.0
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

## 1. Scope the run

Infer what you can; ask only what you can't:

- **Repo** — default to the current directory. Multiple paths given → aggregate them into one
  evidence model (tag each accomplishment with its repo).
- **Author identity** — default to `git config user.email` / `user.name`; confirm it matches them.
- **Timeframe** — default to full history.
- **Format** — `html`, `md`, or both. If unspecified, ask once; otherwise default to `html`.

**Print a source manifest before gathering** so the user can fix connections *before* the run,
not after a disappointing report:

```
Sources for this run:
  git     ✓  412 commits by you@example.com
  Jira    ✓  found via ToolSearch — will fetch tickets
  GitHub  ✗  no tools found — PRs and reviews will be missing
```

If a source they'd expect is missing, pause once and ask whether to proceed git-only or fix it.

## 2. Gather evidence

**Always — git (local, no dependencies):**

```
git log --author=<id> -p --stat --date=short
```

Read the commit message *and the diff*. Infer real intent from the diff — a message of
"fix bug" tells you nothing; the diff tells you everything (e.g. a diff that adds a windowing
library and a row-height cache is "introduced list virtualization", not "fix bug").

**Opportunistically — whatever MCP servers are already connected.** MCP tools are usually
*deferred*: they will NOT appear in your loaded tool list, so "I don't see a Jira tool" is not
evidence that Jira isn't connected. Do this, in order:

1. **Extract ticket keys from git first** — they are the join between commits and tickets:
   ```
   git log --author=<id> --pretty='%s%n%b' | grep -oE '\b[A-Z][A-Z0-9]{1,9}-[0-9]+\b' | sort -u
   git branch -a --format='%(refname:short)' | grep -oE '\b[A-Z][A-Z0-9]{1,9}-[0-9]+\b' | sort -u
   ```
2. **Discover tools with ToolSearch** — run queries like `jira issue`, `linear issue`,
   `pull request`, `datadog metric`, `sentry` and load whatever matches.
3. **Query each source found:**
   - *Jira*: fetch every extracted key directly (`getJiraIssue`), then sweep with JQL —
     `assignee = "<user email>" AND resolutiondate >= "<start>" ORDER BY resolved DESC`.
     Pull summary, status, resolution, story points, and acceptance criteria into the
     matching accomplishment.
   - *Linear*: issues assigned to the user in the timeframe.
   - *GitHub / GitLab / Bitbucket*: merged PRs authored by the user; reviews and approvals given.
4. **Report source status honestly.** If a tool call fails with an auth error, tell the user
   once ("Jira is connected but needs authentication — reconnect it to include tickets") and
   move on. Skip silently only when discovery finds no tools for a source at all. Never
   require a source, never fabricate one.

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

**Persist the model.** Write the dataset to `.recall/evidence.json` in the repo (shape:
`evidence.schema.json`; add `generated_at` and `head_sha`). It is the input to every other
mode and to the next run. Suggest adding `.recall/` to `.gitignore` once.

**Incremental runs.** If `.recall/evidence.json` already exists, don't rescan history — gather
only commits after its `head_sha` (`git log <head_sha>..HEAD --author=<id>`), merge the new
accomplishments in, and re-run the MCP sweep only for new ticket keys. Tell the user what was
reused vs freshly scanned. `--full` forces a rescan.

## 4. Render — use the locked template, do not invent a design

**HTML output MUST be built from `template.html`, which sits next to this file.**
Read it and follow its header instructions. This is not a style suggestion — it is the design.

- **Copy the entire `<style>` and `<script>` blocks from `template.html` VERBATIM.** Do not
  write your own CSS. Do not change the palette, fonts, radii, or spacing.
- **The look is amber (`#d29a4a`) on warm near-black/paper, with a monospace "terminal" voice.**
  Purple, blue, indigo, violet, emerald, and teal accents are **FORBIDDEN** — if you find
  yourself writing a hex like `#7b4dff`, `#6366f1`, or `#0ea5a4`, you have gone wrong; stop and
  copy the template's tokens instead. Generic `system-ui`-only pages are also wrong.
- Fill the placeholders (`{{...}}`) with real evidence. Duplicate a block (`.stat`, `.prow`,
  `.story`, `.logrow`, `.signal`) once per data item; delete blocks you have no data for.
- Keep it a single self-contained file: inline everything, no external requests, theme-aware,
  responsive. Keep the reveal / count-up / sparkline script intact.
- Filter low-confidence trivia (default threshold 40; keep everything if asked); sort by
  confidence within each category.

### Charts — always render these (git alone provides them)

Do not ship a numbers-and-text page. `template.html` includes chart components that make the
report data-heavy even with no MCP connected. Compute the arrays from git and fill them:

- **Commits per month** (`data-timebars` = counts oldest→newest, `data-labels` = short month
  labels) and the **contribution heatmap** (`data-heat` = one integer per day oldest→newest,
  `data-start` = ISO date of the first cell, snapped back to a Monday):
  ```
  git log --author=<id> --date=format:'%Y-%m' --pretty=%ad | sort | uniq -c   # monthly
  git log --author=<id> --date=short --pretty=%ad | sort | uniq -c            # per-day
  ```
  Expand the per-day counts into a *dense* CSV — every day in range, zeros included — so the grid
  is continuous. For long tenures, the heatmap may cover the most recent ~12 months; say so in the
  card note.
- **Where the commits went** (`data-hbars` = `"Area:count,Area:count,…"`): commits per skill area.
- Skill-row sparklines: use evenly-bucketed counts (commits per quarter), never a single raw
  total — one giant bucket collapses the rest into a flatline.

The template's JS turns these attributes into SVG with hover tooltips; you only supply the numbers,
and they must reconcile with the headline stats. Never fabricate counts.

### Dynamic MCP components

`template.html` ends with an **MCP COMPONENT LIBRARY** — pre-styled blocks for Datadog / CoreDash
metric deltas, Sentry error rates, incidents (PagerDuty), CI/CD reliability, and Jira/Linear
delivery. For each connected source with data, copy the matching component into the **Signals**
section, one per metric/incident. Choose the `good`/`warn`/`crit` status class honestly by whether
the change is an improvement. **Remove the Signals section entirely if no metric source is
connected** — never fabricate a measurement or a source badge.

### Markdown output

Portable and paste-ready, identical in detail to the HTML. Render sparklines as unicode blocks
(`▁▂▃▄▅▆▇█`). Match the structure of `examples/journey.md` in this repo.

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
