---
name: recall
description: Reconstruct an engineer's demonstrable work from git history — and any connected MCP sources (GitHub/GitLab/Bitbucket PRs, Jira/Linear tickets, Datadog/CI metrics) — into a categorized, evidence-backed, interview-ready record, rendered as a self-contained HTML page or a Markdown file. Use when the user asks to "summarize what I've built", "generate my brag doc / résumé bullets / interview prep", "recall my work in this repo", prepares for a review or promotion packet, or invokes /recall.
---

# Recall

Turn engineering history into proof. Reconstruct what the user has demonstrably built —
organized by skill, with STAR stories and linked evidence — never from what they remember,
always from the record. The output is something they can walk into an interview with:
clarity, the confidence of receipts, and proof behind every line.

## 1. Scope the run

Infer what you can; ask only what you can't:

- **Repo** — default to the current directory.
- **Author identity** — default to `git config user.email` / `user.name`; confirm it matches them.
- **Timeframe** — default to full history.
- **Format** — `html`, `md`, or both. If unspecified, ask once; otherwise default to `html`.

## 2. Gather evidence

**Always — git (local, no dependencies):**

```
git log --author=<id> -p --stat --date=short
```

Read the commit message *and the diff*. Infer real intent from the diff — a message of
"fix bug" tells you nothing; the diff tells you everything (e.g. a diff that adds a windowing
library and a row-height cache is "introduced list virtualization", not "fix bug").

**Opportunistically — whatever MCP servers are already connected.** Check your available
tools and use what's there; never require a source, never fabricate one, skip missing ones
silently:

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

## Rules

- **Evidence or it didn't happen.** Every claim links to a commit, PR, ticket, or metric.
- **Never inflate.** Low confidence is honest and more useful than a padded résumé.
- **Stay local.** You only read what is already on the user's machine or in the tools they
  have connected. Nothing is uploaded anywhere the user hasn't chosen.
