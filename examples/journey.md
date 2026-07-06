# Maya Ellison — Three Years in `cobalt-web`

> Everything demonstrably shipped in **cobalt-web**, read straight from the history — not from
> memory. One page to walk into the next interview with clarity, the confidence of receipts,
> and proof behind every line.

| | |
|---|---|
| **Engineer** | Maya Ellison |
| **Repository** | cobalt / cobalt-web |
| **Tenure** | Aug 2023 → Jul 2026 |
| **Reconstructed from** | 2,347 commits · 418 PRs · 1,204 review threads |

---

## The paper trail, counted

| Metric | Value | |
|---|--:|---|
| Commits authored | **2,347** | ≈ 2.1 / working day, sustained 3 yrs |
| Pull requests merged | **418** | |
| Issues closed | **273** | |
| Review comments left | **1,204** | mentoring signal |
| Lines added / removed | **214k / 138k** | |
| Releases shipped | **39** | |

---

## Depth you can defend in the room

No self-rated bars. Each competency is backed by the merged PRs and commits behind it, plus a
three-year activity trace (`▁`–`█`, one block per quarter, Q3 ’23 → Q2 ’26). When they ask
"how deep?", the answer is a number, not a feeling.

| Competency | Merged PRs | Commits | Activity | Last touched |
|---|--:|--:|---|---|
| **React** — components · hooks · context | 141 | 812 | `▂▃▄▅▆▆▇▇██▇█` | 3 days ago |
| **TypeScript** — generics · utility types · inference | 118 | 640 | `▁▂▃▄▅▆▆▇▇██▇` | 3 days ago |
| **Performance** — virtualization · bundle budgets | 34 | 190 | `▁▁▁▃▆█▆▄▃▂▃▂` | Apr ’26 |
| **Testing** — Playwright · Jest · MSW | 47 | 210 | `▁▁▂▃▅▇█▆▄▃▄▃` | May ’26 |
| **Node / API** — REST · pagination · caching | 52 | 240 | `▄▄▄▅▅▆▅▆▅▆▅▆` | Jun ’26 |
| **Architecture** — module boundaries · design tokens | 22 | 130 | `▁▁▁▂▂▃▄▅▆██▇` | 2 wk ago |
| **Accessibility** — ARIA · focus management | 29 | 96 | `▂▂▂▃▃▄▄▃▄▃▄▃` | Mar ’26 |
| **CI / CD** — pipelines · preview envs | 18 | 88 | `▁▂▃▄▃▅▆▄▃▄▃▂` | Feb ’26 |
| **GraphQL** — schema design · normalized cache | 16 | 72 | `▃▅▆▇▅▄▃▂▂▁▁▁` | Nov ’25 |

---

## The arc your history already tells

Three phases the log makes obvious — with the full commit-by-commit record at the end.

### Act I · Aug 2023 – Jun 2024 — Learning the terrain
First 300 commits are small and cautious — bug fixes, copy tweaks, a nervous first PR. By spring
the pattern flips: whole features land, reviewers stop leaving change requests.

- **React** — *Reusable component library*: extracted 40+ shared primitives from copy-pasted UI.
- **Auth** — *Login & token-refresh flow*: first end-to-end feature owned solo; protected routes, silent refresh.

### Act II · Jul 2024 – Aug 2025 — Taking ownership
Commits get bigger and more surgical. Maya stops fixing symptoms and starts fixing systems.

- **Performance** — *Dashboard virtualization*: cut a 5,000-row table from 5.2s to 2.1s first paint.
- **Architecture** — *Design system "Loom"*: tokenized components adopted across 6 product modules.
- **Testing** — *Playwright migration*: replaced flaky Cypress; CI failures 18% → 3%.
- **API** — *Optimistic mutations*: cursor pagination + optimistic updates across the data layer.

### Act III · Sep 2025 – Jul 2026 — Multiplying through others
The review-comment count overtakes the commit count. Fingerprints move from files to decisions.

- **Architecture** — *Feature-flag platform*: progressive delivery decoupling release from deploy.
- **Migration** — *React 18 → 19 rollout*: led a 90-PR incremental upgrade with zero incidents.
- **Reliability** — *Incident command*: owned two Sev-2 responses; wrote the postmortems and the fixes.
- **Mentoring** — *1,204 review threads*: reviewed more code than most engineers wrote.

<details>
<summary><b>Open the full commit-by-commit timeline</b> — 61 milestones · 2,347 commits</summary>

| Date | Area | Milestone | PR |
|---|---|---|---|
| 2023 · Aug | Onboarding | First merged PR — fixed pagination off-by-one on the accounts table | #0037 |
| 2023 · Oct | React | Extracted the first shared primitives from copy-pasted UI | #0192 |
| 2024 · Jan | Auth | Owned login + silent token-refresh flow end to end | #0388 |
| 2024 · Apr | Accessibility | Keyboard navigation and focus traps across all modals | #0541 |
| 2024 · Jul | Performance | Dashboard virtualization — 5.2s to 2.1s first paint | #1284 |
| 2024 · Sep | Testing | Migrated the suite off flaky Cypress to Playwright | #1502 |
| 2024 · Dec | Architecture | Shipped the "Loom" design system + migration codemod | #0892 |
| 2025 · Mar | API | Cursor pagination + optimistic mutations in the data layer | #1740 |
| 2025 · Jun | CI / CD | Per-PR preview environments and a bundle-budget gate | #1888 |
| 2025 · Sep | Architecture | Feature-flag platform decoupling release from deploy | #1961 |
| 2025 · Nov | Migration | Kicked off the incremental React 18 → 19 rollout | #2033 |
| 2026 · Feb | Reliability | Incident command on Sev-2; wrote the postmortem and the fix | #2210 |
| 2026 · Apr | Performance | Hydration pass — cut time-to-interactive another 22% | #2298 |
| 2026 · Jun | Mentoring | Crossed 1,200 review threads; authored the review playbook | #2341 |

</details>

---

## Interview-ready, evidence-backed

### Made a 5,000-row dashboard feel instant — *Performance* · confidence 97
> Evidence: **PR #1284** · 14 commits · `a3f9e1…` · deploy v4.2

- **Situation** — The ledger dashboard locked up rendering 5,000+ rows; support tickets called it "frozen."
- **Task** — Restore responsiveness without changing behavior or breaking the export path.
- **Action** — Row virtualization, memoized cells, code-split charts, lazy-loaded the export module.
- **Result** — First paint **5.2s → 2.1s**, **40%** fewer renders, Lighthouse **61 → 94**.

### Built the design system six teams now build on — *Architecture · React* · confidence 94
> Evidence: **PR #892** · 63 commits · RFC-014 · 6 modules

- **Situation** — Every squad reinvented buttons and modals; the UI drifted and a11y regressed weekly.
- **Task** — Create one source of truth without stalling product delivery mid-flight.
- **Action** — Shipped "Loom": tokenized primitives, headless hooks, docs, and a migration codemod.
- **Result** — Adopted by **6** modules, **−31%** UI code, a11y violations **down 78%**.

### Led the React 19 upgrade with zero incidents — *Migration · Reliability* · confidence 91
> Evidence: **PR #2033** · 90 PRs · feature-flagged

- **Situation** — The app was two majors behind; concurrent-mode bugs blocked new hires' features.
- **Task** — Upgrade a live, high-traffic app without a maintenance window.
- **Action** — Sequenced a 90-PR incremental rollout behind flags, wrote codemods, gated on real-user metrics.
- **Result** — **0** customer incidents, **−22%** hydration time, unblocked **7** stalled features.

---

## Nothing forgotten, all of it filed

The full inventory recovered from three years of work — phrased so each line drops straight into a
résumé bullet or the answer to "tell me about a time you…".

- **Performance** — list virtualization · route-level code splitting · image & font optimization · memoized render paths
- **React** — headless component hooks · context-driven theming · Suspense data boundaries · form state primitives
- **TypeScript** — generic API client · discriminated unions · type-safe routing · utility-type helpers
- **Testing** — Playwright e2e suite · visual regression gates · MSW request mocking · flake quarantine
- **API & Data** — cursor pagination · optimistic mutations · retry & backoff layer · normalized cache
- **Architecture** — module boundaries · feature-flag platform · monorepo tooling · design tokens
- **Accessibility** — keyboard navigation · ARIA live regions · focus management · reduced-motion paths
- **Delivery** — preview environments · release automation · bundle-budget CI · incident runbooks

---

<sub>Generated by **Recall** — `recall ./cobalt-web --author "maya" --format md`. Every claim links back to a diff.</sub>
