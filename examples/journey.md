# Maya Ellison — Engineering Record (cobalt/cobalt-web)

> 2.9 years, 2,734 commits of evidence · sources: git, github, jira, datadog, ci · confidence ≥ 40

## The paper trail, counted

| Signal | Count |
|---|---|
| Commits authored | **2,734** |
| Pull requests merged | **418** |
| Issues closed | **273** |
| Review comments | **1,204** |
| Releases shipped | **39** |
| Lines added / removed | **252,348 / 160,486** |

Commits per month: `▄▄▅▄▄▅▆▅▅▇▆▇▇▇▇▇▅▆▇▅█▇▆█▇█▇▇▆███▇▇█▁` (36 months)

## Measured impact

- **Dashboard LCP · p75** (Datadog): 5.2s → 2.1s — after the virtualization rework
- **Frontend build time** (CI): 14m 20s → 4m 05s — remote cache + dependency pruning
- **Tickets delivered** (Jira): 214 — across 11 epics · 3 years

## Enabled — impact through others

611 PRs reviewed · 1204 review comments · 388 approvals — counted separately from authored work.
- Primary reviewer for the payments surface (214 reviews)
- Unblocked the mobile team's design-system adoption — 9 pairing sessions, 3 migration PRs reviewed end-to-end

## Skills, counted

| Competency | PRs | Commits | Activity | Last touched |
|---|---|---|---|---|
| **React** <br><sub>components · hooks · suspense</sub> | 141 | 701 | `▃▅▅▆▇▇█▇███▅▂` | 2026-06-28 |
| **API design** <br><sub>REST · pagination · versioning</sub> | 86 | 538 | `▂▄▅▆▆▇▇▇███▅▂` | 2026-06-30 |
| **State & data flow** <br><sub>query cache · optimistic UI</sub> | 54 | 373 | `▂▄▅▆▇▇▇▇███▅▂` | 2026-05-19 |
| **Performance** <br><sub>virtualization · bundle budgets</sub> | 34 | 368 | `▁▂▃▆██▇▄▃▃▂▂▁` | 2026-04-15 |
| **Design system** <br><sub>tokens · a11y · theming</sub> | 41 | 346 | `▁▂▂▂▃▃▄▇███▅▂` | 2026-06-12 |
| **Testing** <br><sub>vitest · playwright · contract tests</sub> | 38 | 233 | `▂▄▅▆▆▇▇▇██▇▆▂` | 2026-06-25 |
| **Infra & CI** <br><sub>pipelines · caching · previews</sub> | 16 | 98 | `▂▃▄▅▆▇█▇▆▇▆▃▂` | 2026-03-02 |
| **Docs & enablement** <br><sub>runbooks · ADRs · onboarding</sub> | 8 | 77 | `▃▄▅▆▆▇▇▆▇█▇▄▂` | 2026-05-30 |

## The journey

### Learning the terrain · Aug 2023 → Jun 2024

Small, safe, everywhere — hundreds of commits across every corner of the app while the mental map forms.

- **[Testing] Deleted flakiness from the merge queue** — Stabilized the merge queue: quarantined and fixed 41 flaky tests, retry rate 18% → 1.2%. _(#1013, 6d0f5b2, ci.retry.rate)_
- **[Docs & enablement] Wrote the onboarding path new hires actually finish** — Authored the frontend onboarding runbook — new-hire first-PR time dropped from 3 weeks to 4 days. _(#901, 23c81aa)_

### Taking ownership · Jul 2024 → Aug 2025

Commits get bigger and more surgical — Maya stops fixing symptoms and starts fixing systems.

- **[Performance] Made a 5,000-row dashboard feel instant** — Cut dashboard first-paint 60% (5.2s → 2.1s) by introducing row virtualization and render memoization. _(#1284, a3f9e1c, COB-4471)_
- **[API design] Versioned the public API and killed the N+1 pagination** — Shipped API /v2 (cursor pagination, zero breaking changes) — p99 list latency 8.4s → 410ms. _(#1412, 7cd20b4, COB-4106)_
- **[State & data flow] Rebuilt data flow around an optimistic query cache** — Made every interaction feel instant (<50ms feedback) with an optimistic query cache; −78% refetch traffic. _(#1688, b52ee19, COB-3988)_

### Systems and scale · Sep 2025 → Jul 2026

The work turns multiplicative: platform pieces, review leverage, and the paths other engineers build on.

- **[Infra & CI] Took the frontend build from 14 minutes to 4** — Cut CI build time 71% (14m → 4m) with remote caching and change-scoped test splitting; −62% CI spend. _(#1955, e11d9a0, ci.build.p50)_
- **[Design system] Built the token pipeline that ended per-page theming** — Designed the 212-token theming pipeline that turned a 6-week brand refresh into a 4-day data change. _(#2103, 90ab77e, COB-5210)_
- **[Design system] Closed the accessibility audit — 94 findings to zero** — Closed a 94-finding accessibility audit to zero and gated CI so it stays there (23 regressions blocked since). _(#2299, 4f60c2d, COB-5391)_
- **[Docs & enablement] Spoke at a regional React meetup on the virtualization rework** _(self-reported)_ — Presented the dashboard-virtualization case study to ~200 engineers at a regional React meetup. _(told to recall 2026-07-06)_

## Interview-ready STAR stories

### Made a 5,000-row dashboard feel instant · confidence 97

- **Situation** — The ledger dashboard locked up rendering 5,000+ rows; support tickets called it "frozen".
- **Task** — Restore responsiveness without changing behavior or breaking the export path.
- **Action** — Introduced row virtualization, memoized the expensive cells, code-split the charts, and lazy-loaded the export module.
- **Result** — First paint p75 5.2s → 2.1s, 40% fewer renders, Lighthouse 61 → 94.
- **Evidence** — pr #1284 · commit a3f9e1c · ticket COB-4471 · metric dashboard.lcp.p75 (5.2s → 2.1s (Datadog RUM)) · deploy v4.2.0

### Versioned the public API and killed the N+1 pagination · confidence 94

- **Situation** — Offset pagination collapsed above 100k records and blocked two enterprise deals.
- **Task** — Ship /v2 with cursor pagination — zero breaking changes for 240 existing integrations.
- **Action** — Designed the cursor contract, dual-served /v1 and /v2 behind a compatibility layer, added contract tests for every documented consumer path.
- **Result** — p99 list latency 8.4s → 410ms on 100k-row accounts; zero breaking-change tickets filed post-launch.
- **Evidence** — pr #1412 · commit 7cd20b4 · ticket COB-4106 · metric api.list.p99 (8.4s → 410ms (Datadog APM))

### Took the frontend build from 14 minutes to 4 · confidence 92

- **Situation** — Every PR waited 14+ minutes for CI; engineers batched changes to avoid the queue, making reviews bigger and riskier.
- **Task** — Get the feedback loop under 5 minutes without buying more runners.
- **Action** — Introduced remote build caching, pruned 31 phantom dependencies, split the test matrix by change surface, and added preview deploys off the cache.
- **Result** — Build p50 14m20s → 4m05s, 89% cache hit rate, CI spend down 62%.
- **Evidence** — pr #1955 · commit e11d9a0 · metric ci.build.p50 (14m20s → 4m05s (CI analytics))

### Built the token pipeline that ended per-page theming · confidence 90

- **Situation** — Four products themed themselves with copy-pasted CSS; a brand refresh was quoted at six weeks of manual edits.
- **Task** — Make theming a data change, not a code change.
- **Action** — Extracted 212 design tokens, generated platform outputs (CSS variables, TS constants) from one source, migrated 61 components, and wired a11y contrast checks into CI.
- **Result** — The brand refresh shipped in 4 days; contrast violations in CI dropped to zero.
- **Evidence** — pr #2103 · commit 90ab77e · ticket COB-5210

### Closed the accessibility audit — 94 findings to zero · confidence 89

- **Situation** — An enterprise prospect's accessibility audit returned 94 findings and a hard deadline in the contract.
- **Task** — Reach zero open findings before the renewal date, and stay there.
- **Action** — Fixed focus order and ARIA semantics across 40+ components, added keyboard paths to every interactive element, and made axe checks a merge gate.
- **Result** — Zero open findings at renewal; the axe gate has blocked 23 regressions since.
- **Evidence** — pr #2299 · commit 4f60c2d · ticket COB-5391

### Rebuilt data flow around an optimistic query cache · confidence 88

- **Situation** — Every mutation refetched whole collections; the app felt like a page reload on every click.
- **Task** — Make interactions instant while keeping the server as the source of truth.
- **Action** — Introduced a normalized query cache with optimistic updates and rollback, plus a mutation queue for flaky connections.
- **Result** — Interaction-to-feedback under 50ms across the app; refetch traffic down 78%.
- **Evidence** — pr #1688 · commit b52ee19 · ticket COB-3988

## Résumé bullets

- Cut dashboard first-paint 60% (5.2s → 2.1s) by introducing row virtualization and render memoization.
- Shipped API /v2 (cursor pagination, zero breaking changes) — p99 list latency 8.4s → 410ms.
- Cut CI build time 71% (14m → 4m) with remote caching and change-scoped test splitting; −62% CI spend.
- Designed the 212-token theming pipeline that turned a 6-week brand refresh into a 4-day data change.
- Closed a 94-finding accessibility audit to zero and gated CI so it stays there (23 regressions blocked since).
- Made every interaction feel instant (<50ms feedback) with an optimistic query cache; −78% refetch traffic.
- Stabilized the merge queue: quarantined and fixed 41 flaky tests, retry rate 18% → 1.2%.
- Authored the frontend onboarding runbook — new-hire first-PR time dropped from 3 weeks to 4 days.
- Presented the dashboard-virtualization case study to ~200 engineers at a regional React meetup. _(self-reported)_

## The long tail

**Performance** — List virtualization · Route-level code splitting · Image & font optimization · Memoized render paths · Bundle budgets in CI

**API & data** — Cursor pagination · API versioning · Normalized query cache · Optimistic updates with rollback · Contract tests

**Platform** — Design tokens pipeline · Remote build caching · Preview deploys · axe merge gate · Merge-queue stabilization

**Collaboration** — 1,204 review comments · Onboarding runbook · ADR practice · Incident write-ups


---
<sub>Generated by Recall — every claim links to a commit, PR, ticket, or metric. Generated 2026-07-08 from git, github, jira, datadog, ci. Self-reported items are marked.</sub>
