# Recall — Engineering Plan to v1.0

Companion to [ROADMAP.md](ROADMAP.md). The roadmap says *what*; this says *how*, with test
cases, token budgets, and the enterprise-hardening work per version.

## The core economic argument

Recall replaces a manual process — trawling git history, ticket queues, and dashboards to
reconstruct 2–5 years of work — that takes an engineer **2–4 working days** per job switch or
review cycle, and produces a worse result (memory-limited, unproven claims). A full Recall run
should cost **minutes and a few hundred thousand tokens at most**. That is the 100×: not
faster typing, but eliminating the gathering.

For that to hold, the tool itself must be token-frugal. Where tokens go today:

| Stage | Today | Problem |
|---|---|---|
| Gather | model reads `git log -p --stat` raw | a 2,000-commit repo with diffs is **millions** of input tokens |
| MCP | one call per ticket | N round-trips, N tool-result payloads |
| Render | model retypes all of `template.html` (~40 KB) around the data | most output tokens are boilerplate the model must not change anyway |

**The fix that drives every version below: the model does judgment; code does mechanics.**
Deterministic work (counting, bucketing, key extraction, template substitution) moves into
bundled scripts. The model reads a compact digest and writes only `evidence.json`.

---

## v0.5 — Trust the output

### Deliverables

1. **`gather` script** (`bin/gather.js`, zero deps, invoked by the skill via Bash):
   - one pass over `git log --numstat` → per-commit records: sha, date, subject, files,
     churn, extracted ticket keys; plus precomputed aggregates (monthly buckets, per-day
     heatmap counts, per-area totals)
   - emits `.recall/digest.json` (~10–30 KB for a 2,000-commit repo — a **>100× input cut**
     vs raw `-p` logs)
   - the model then requests full diffs (`git show <sha>`) **only** for the ~30–80 commits
     whose churn/files mark them as candidate accomplishments, with a per-diff byte cap
2. **`render` script** (`bin/render.js`): merges `evidence.json` into `template.html`
   placeholders. The model never retypes the template — output tokens drop to the evidence
   itself (~5–10 KB). Also guarantees the locked design *exactly* (no more "the model
   drifted the CSS" class of bug).
3. **Schema versioning**: `schema_version` field in `evidence.json`; `render` and
   incremental runs validate against `evidence.schema.json` and refuse mismatches with a
   migration hint.
4. **Identity aliases**: honor `.mailmap`; else detect candidate aliases
   (`git log --format='%an %ae' | sort -u`, cluster by name), confirm once, store in
   `.recall/config.json`.
5. **Example outputs** for `roles` and `apply` in `examples/` — synthetic persona only.
6. **Release automation**: GitHub Action publishes to npm on `v*` tag (provenance enabled).

### Enterprise hardening

- **PII/leak gate in CI** (this repo already shipped a personal artifact link once):
  gitleaks + a custom check asserting no real names/emails/account-bound URLs outside the
  synthetic persona allowlist (`maya`, `example.com`, `cobalt-web`).
- **Redaction rules**: `gather` never copies file *contents* into the digest — paths and
  stats only. Diff excerpts the model quotes in reports are capped and come only from
  commits the user authored. `.recall/config.json` accepts `exclude_paths` globs
  (e.g. `**/secrets/**`) excluded from all evidence.
- Reports carry a footer: sources read, timeframe, generation date — an audit trail of
  exactly what was accessed.

### Test cases

Runner: `node --test` for JS, existing `test_recall.py` pattern for Python. Fixture:
`test/fixture-repo.sh` builds a deterministic git repo (3 authors, 2 aliases for one of
them, 120 commits across 4 areas, 8 commits with `PROJ-123`-style keys, 1 merge).

| ID | Case | Assert |
|---|---|---|
| G1 | gather on fixture repo | digest.json validates; commit count = 120; monthly buckets sum = 120 |
| G2 | gather `--author` with .mailmap aliases | both emails merge into one identity; count matches |
| G3 | ticket-key extraction | exactly the 8 planted keys, deduped, no false positives from e.g. `SHA-256`, `UTF-8` |
| G4 | `exclude_paths` glob | excluded paths absent from digest; totals adjusted |
| G5 | digest size guard | fixture digest < 50 KB; no file contents present (scan for planted canary string) |
| R1 | render with full evidence.json | output contains every accomplishment; zero `{{` placeholders remain; `<style>` block byte-identical to template |
| R2 | render with sparse evidence (no MCP data) | Signals section removed entirely; page still valid HTML |
| R3 | schema mismatch | render exits non-zero with migration message |
| I1 | incremental run | second gather after 5 new commits scans only 5 (assert via `head_sha` delta); merged totals correct |
| D1–D4 | doctor: no install / user-only / both (shadow warning) / stale version | correct status lines each |
| P1 | CI leak gate | seeding a real-looking email or `claude.ai/` URL into examples fails the build |
| S1 | installer stamp | installed SKILL.md frontmatter version == package.json version |

### Token budget (acceptance, not aspiration)

Full first run on a 2,000-commit repo: **< 300 K input / < 20 K output** tokens.
Incremental weekly run: **< 30 K input**. Measured in CI against the fixture repo scaled
up (`fixture-repo.sh --commits 2000`); fails the build if exceeded by >25 %.

---

## v0.6 — The full career

### Deliverables

1. **Career store** `~/.recall/store/<repo-id>/evidence.json` + `career.json` roll-up;
   `recall gather` writes per-repo, a `merge` step builds the career view. Repo identity =
   first-commit sha (survives renames/reclones).
2. **Non-git evidence**: `/recall add` conversational entry → `source: "self-reported"`,
   rendered with a distinct marker. Never mixed silently with verified evidence.
3. **Career timeline renderer** (per-employer segments derived from repo activity ranges).
4. **Adapters**: GitLab reviews, Sentry, PagerDuty, GitHub Actions — each a section in
   SKILL.md following one contract: *discover via ToolSearch → query by identity+timeframe
   → map to evidence.json records → cite source ids*.
5. **Authored vs enabled**: reviews/approvals counted as `enabled` impact, separate rollup.

### Enterprise hardening

- **Multi-employer separation**: `career.json` tags every record with repo/employer;
  `/recall apply` can exclude an employer (`--exclude-employer`) so a report for one job
  never leaks another company's project names. Redaction mode: `--anonymize-employers`
  replaces repo/project names with "a fintech platform"-style descriptions.
- Store is plain JSON on disk, user-owned, `chmod 600`, documented location — trivially
  auditable and deletable. No sync, ever (principle 2).

### Token-efficiency work

- Career merge is pure code (script), zero model tokens.
- MCP sweeps batch by default: one JQL query per 50 keys (`key in (A-1,B-2,…)`), one PR
  list call per repo — not per-item fetches. Only items that *match* an accomplishment get
  a detail fetch.
- Cross-repo dedupe (same commit in fork/mirror) in the merge script, so the model never
  re-judges duplicates.

### Test cases

| ID | Case | Assert |
|---|---|---|
| C1 | merge 3 fixture repos | career.json totals = sum; no duplicate accomplishment ids |
| C2 | same repo cloned twice (different paths) | one store entry (first-commit-sha identity) |
| C3 | fork with 90 % shared history | shared commits counted once |
| C4 | self-reported entry | carries `self-reported` marker in both renders; excluded from "verified" counts |
| C5 | `--exclude-employer` | zero strings from excluded repo (names, paths, ticket prefixes) in output |
| C6 | `--anonymize-employers` | no repo/project literals; accomplishment content intact |
| C7 | enabled-vs-authored | fixture reviews land in `enabled`, not commit counts |
| A1 | adapter contract kit | a new adapter passes the shared conformance test (maps sample payload → valid evidence records with citations) |
| B1 | batched JQL | 120 keys → ≤ 3 search calls (mock MCP layer counts calls) |

---

## v0.7 — The application pipeline

### Deliverables

1. `/recall apply` accepts URL (WebFetch) or pasted text; JD parser output is itself a
   small JSON (requirements[], seniority, domain) cached at `.recall/jd-<hash>.json`.
2. **Application tracker** `.recall/applications.json`: company, role, JD hash, status
   (`drafted → applied → screen → interview → offer/closed`), artifact paths;
   `/recall status` renders the funnel.
3. `/recall interview <company>`: rehearsal loop driven by the stored JD match — asks the
   likely questions, critiques the user's answer against the evidence, tightens STAR wording.
4. `/recall negotiate`: scope/impact brief from highest-confidence measured evidence.
5. **Renderers**: PDF (via headless print CSS already in template), JSON Resume, LinkedIn
   sections. All read `evidence.json`; none re-invoke the model.

### Enterprise hardening

- JD fetches are the product's **only** outbound network call; they happen through the
  agent's WebFetch with the URL the user explicitly gave. Documented as such.
- Application kit files never embed employer-proprietary detail beyond what the user's own
  evidence records contain; `--anonymize-employers` composes with `apply`.
- Tracker is append-only with timestamps — usable as a personal audit log.

### Token-efficiency work

- JD parsed once, cached by content hash; re-tailoring reuses the parse.
- `apply` reads the *career roll-up*, not every per-repo file; requirement matching runs
  against accomplishment titles/bullets first and only expands full STAR records for the
  top matches.
- Renderers are pure code: PDF/JSON Resume/LinkedIn exports cost **zero** model tokens.

### Test cases

| ID | Case | Assert |
|---|---|---|
| J1 | JD fixture (12 requirements) | every requirement classified strong/partial/gap; each strong/partial cites ≥1 evidence id |
| J2 | honesty guard | a requirement with zero adjacent evidence is `gap`, never `partial`; kit contains no invented technology names (checked against evidence vocabulary) |
| J3 | JD cache | same JD twice → parser runs once (hash hit) |
| T1 | tracker transitions | invalid jump (drafted→offer) rejected; log append-only |
| T2 | `/recall status` | funnel counts match applications.json |
| X1 | JSON Resume export | validates against jsonresume schema |
| X2 | PDF render | non-empty, contains headline stats text layer |
| X3 | exports offline | run with network disabled — all renderers succeed |
| N1 | negotiate brief | every number traces to a measured evidence record (no unsourced figures) |

---

## v0.8 — Always current

### Deliverables

1. **Scheduled refresh**: documented setup for Claude Code scheduled agents + plain cron
   (`recall gather --quiet` is script-only, so cron needs no model at all; the model-side
   re-judgment runs only when digest deltas exist).
2. `/recall since-last`: snapshot tag on each packet; diff mode renders only the delta
   ("since your last review: 3 accomplishments, 1 new skill area, p75 improvement on X").
3. **Milestone nudges** in gap report ("this quarter has no measured result yet").

### Enterprise hardening

- Scheduled mode is *pull-only* and local; a hung source times out and is reported, never
  retried unboundedly. Refresh log at `.recall/refresh.log` (when, what, how long).

### Token-efficiency work

This is the version where steady-state cost approaches zero: cron runs the script
(no tokens); the model wakes only when `digest.json` changed, and judges only the delta.
Weekly steady-state target: **< 30 K tokens, zero when nothing shipped**.

### Test cases

| ID | Case | Assert |
|---|---|---|
| W1 | refresh with no new commits | exits early, no model invocation needed, log line written |
| W2 | refresh with 5 new commits | digest delta = 5; merged evidence valid; prior accomplishments untouched (byte-diff) |
| W3 | since-last | delta report lists exactly the 5; totals reconcile with full report |
| W4 | source timeout | hung mock MCP → run completes, gap report names the source |
| W5 | snapshot integrity | two consecutive `since-last` runs with no changes → empty delta |

---

## v1.0 — Ecosystem

### Deliverables

1. Claude Code plugin-marketplace packaging (manifest, versioned releases).
2. **Adapter authoring guide** + conformance kit (the A1 harness from v0.6, documented):
   a community adapter = one SKILL.md section + one passing conformance run.
3. Docs site (grow the Vercel page): output gallery (synthetic personas only), adapter
   registry, security page (what is read, what leaves the machine: nothing).
4. **Opt-in share**: `recall share` produces a redaction-*previewed* static HTML and only
   then, on explicit confirm, publishes. Default expiry. Never a default behavior.

### Enterprise hardening

- Signed releases + npm provenance; SBOM (trivial — zero runtime deps is the SBOM).
- SECURITY.md with threat model: local-first, no telemetry, single opt-in egress point.
- Version-support policy (latest two minors).

### Test cases

| ID | Case | Assert |
|---|---|---|
| M1 | plugin install via marketplace manifest | `/recall` resolves; version matches release tag |
| E1 | share without confirm | nothing published (mock endpoint receives zero calls) |
| E2 | share preview | preview contains post-redaction content only; confirm publishes byte-identical page |
| E3 | conformance kit on a deliberately broken adapter | fails with actionable message |
| Q1 | end-to-end on fixture career (3 repos + mock Jira + JD) | full pipeline gather→roles→apply→export under token budget, zero PII from outside the synthetic persona set |

---

## Cross-version guardrails (CI on every PR, starting v0.5)

1. **Leak gate** (P1) — gitleaks + persona allowlist. *Added because a real account-bound
   artifact link and a real author name shipped in v0.2.*
2. **Token budget check** — scaled fixture run must stay under the version's budget.
3. **Schema check** — every example/fixture `evidence.json` validates.
4. **Honesty checks** (J2, N1, C4 style) — no unsourced numbers, no invented vocabulary,
   self-reported never counted as verified. These are the product; they get tests.
5. **Zero-dependency rule** — `package.json` dependencies stay empty; CI fails otherwise.
