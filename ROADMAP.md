# Recall — Roadmap

**The product in one line:** every career artifact an engineer needs — brag doc, résumé,
role fit, application, interview prep — generated from evidence they already have, never
from what they remember.

**The bet:** the painful part of a job switch isn't writing — it's *recalling and proving*.
Whoever owns the evidence model owns every artifact downstream of it.

## Principles (these don't change)

1. **Evidence or it didn't happen.** Every claim cites a commit, PR, ticket, or metric.
2. **Local-first.** Reads only what's on the user's machine or in tools they connected.
   No servers, no telemetry, no account.
3. **One evidence model.** `evidence.json` is the contract; sources write it, renderers
   read it. Every feature is an adapter or a renderer — never a third thing.
4. **Honest by default.** Low confidence is more useful than a padded résumé. Gaps are
   reported, never papered over.

---

## v0.4 — shipped

Jira/MCP discovery fix (ticket-key join, JQL sweep, auth-failure reporting) · `doctor` ·
source manifest · `.recall/evidence.json` persistence + incremental runs · gap report ·
job-switch modes (`roles`, `apply`, `bullets`, `star`) · presets · multi-repo.

## v0.5 — Trust the output *(shipped)*

Make what exists reliable before adding surface. Also landed the core token-economy
architecture early: `gather.js` (git → compact digest, no raw-log parsing) and `render.js`
(evidence.json → both formats mechanically, model never retypes the template).

- [x] Example outputs for `roles` and `apply` in `examples/` — people buy what they can see
- [x] `evidence.json` schema versioning + validate persisted files before reuse
- [x] Identity aliases — `.mailmap` honored and name-clusters merged automatically
- [x] `npm publish` via GitHub Action on tag — releases stop depending on a laptop
- [x] Self-check suite: 15 tests over a deterministic fixture repo + leak gate, in CI

## v0.6 — The full career, not one repo

The unit of a job search is a career.

- [ ] Career store: `~/.recall/` merges evidence across repos and employers, survives clones
- [ ] Non-git evidence: talks, mentoring, docs, on-call — added conversationally, marked
      `self-reported` (never silently mixed with verified evidence)
- [ ] Career timeline render — the narrative across companies, not just one repo's charts
- [ ] More adapters: GitLab reviews, Sentry, PagerDuty, GitHub Actions/CircleCI
- [ ] Team-scale honesty: separate "authored" from "reviewed/enabled" so senior IC impact
      (unblocking others) is visible, not lost

## v0.7 — The application pipeline, end to end

From "I should switch" to "offer" without leaving the terminal.

- [ ] `/recall apply` fetches posting URLs + light company research (stack, scale, domain)
      to sharpen the tailoring
- [ ] Application tracker: `.recall/applications.json` — company, role, status, artifacts;
      `/recall status` shows the funnel
- [ ] `/recall interview <company>` — mock-interview rehearsal loop: asks the likely
      questions, critiques answers against the evidence, tightens the STAR stories
- [ ] `/recall negotiate` — scope-and-impact brief for comp conversations, built from the
      strongest measured evidence
- [ ] Renderers: PDF, [JSON Resume](https://jsonresume.org), LinkedIn-section export

## v0.8 — Always current

A brag doc is only useful if it exists *before* you need it.

- [ ] Scheduled refresh — weekly incremental run keeps evidence current (Claude Code
      scheduled agents / cron)
- [ ] Review-season mode: `/recall since-last` — diff against the previous packet;
      "what have I shipped since my last review"
- [ ] Milestone nudges in the gap report: "this quarter has no measured result yet"

## v1.0 — Ecosystem

- [ ] Claude Code plugin-marketplace listing
- [ ] Adapter authoring guide — a community source adapter should be a one-file PR
- [ ] Docs site with output gallery (the Vercel site grows up)
- [ ] Opt-in shareable report links — explicit publish step, never a default

## Explicitly not doing

- **Accounts, hosting, telemetry** — breaks principle 2, and the moat is the evidence
  model, not a SaaS wrapper.
- **Auto-applying to jobs** — generating the materials is leverage; spraying applications
  is spam.
- **Manager surveillance mode** — evidence serves the person who produced it.

---

*Ordering rationale: v0.5 earns trust (visible examples, reliability), v0.6 completes the
data (career > repo), v0.7 spends that data on the actual goal (an offer), v0.8 removes
the last manual step (staleness), v1.0 lets others extend it. Issues and PRs against any
milestone are welcome — see [Contributing](README.md#contributing).*
