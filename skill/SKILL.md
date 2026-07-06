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

## 4. Render

Match the structure and visual language of the reference outputs in this repo:
`examples/journey.html` and `examples/journey.md` (or the live sample linked in the README).
The two must be identical in detail — the same facts, one as a designed page, one as text.

- Filter low-confidence trivia (default threshold 40; keep everything if the user asks).
- Sort by confidence within each category.
- **HTML** — a single self-contained file: inline CSS and JS, no external requests, works
  offline, theme-aware, responsive.
- **Markdown** — portable and paste-ready; render sparklines as unicode blocks (`▁▂▃▄▅▆▇█`).

## Rules

- **Evidence or it didn't happen.** Every claim links to a commit, PR, ticket, or metric.
- **Never inflate.** Low confidence is honest and more useful than a padded résumé.
- **Stay local.** You only read what is already on the user's machine or in the tools they
  have connected. Nothing is uploaded anywhere the user hasn't chosen.
