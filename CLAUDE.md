# Recall — build conventions

Product principles, milestones, and per-version test plans live in ROADMAP.md and
PLAN.md. This file is HOW to build a version so it survives review.

## Build order for any version (v0.7+)

1. **Promises before code.** List every user-facing promise the version makes
   (PLAN.md deliverables + SKILL.md guarantees). Each promise gets ONE enforcing
   mechanism — a single chokepoint (normalize on load, validate at write), never
   per-call-site edits. A guarantee enforced in N places is broken in place N+1.
2. **Adversarial tests first.** For each promise, write the test that attacks it
   before implementing: hostile names (quotes, case variants, substrings of JSON
   keys), missing optional fields, real zeros (falsy-zero bugs), stale files,
   shallow clones, multi-root repos, fork/mirror duplicates. A test built on the
   same fixture assumptions as the implementation proves nothing.
3. **Old consumers on new files.** Any schema or file-format change: state what an
   already-installed older version does when it reads the new files. If it
   silently misbehaves (e.g. drops a load-bearing marker), bump the version gate
   so it refuses with the migration hint instead.
4. **Security-adjacent ≠ lazy.** Privacy, redaction, and honesty-counting paths get
   allowlist-over-denylist, field-level operations on structured data (never string
   surgery on serialized JSON), and hostile-input tests. Everything else stays
   minimal.
5. **Review before "done".** After building: run /code-review high --fix, then
   `node --test test/*.test.js`, `bash test/leak-check.sh`, and an end-to-end smoke
   of the real flow (gather → evidence → merge → render on a fixture repo — unit
   tests alone missed real bugs in v0.6). Report what the review found.

## Hard rules (checked by CI)

- **Zero runtime dependencies** — `package.json` dependencies stay empty.
- **Leak gate** — no real names/emails/account-bound URLs outside the synthetic
  persona allowlist (maya / example.com / cobalt-web).
- **Evidence or it didn't happen** — no unsourced numbers, no invented vocabulary;
  self-reported is never counted or rendered as verified. Honesty math (verified +
  selfReported = accomplishments) is derived from the data, not kept in parallel
  counters.
- Version stamps move together: package.json, skill/SKILL.md frontmatter, and the
  evidence `schema_version` story (see step 3).

## Architecture invariants

- **Model does judgment; code does mechanics.** Deterministic work (counting,
  merging, templating, redaction) lives in `skill/*.js`; the model only writes
  `evidence.json`. Never have the model retype a template or parse raw `git log -p`.
- **One evidence model.** `evidence.json` (evidence.schema.json) is the contract;
  sources write it, renderers read it. Every feature is an adapter or a renderer —
  never a third thing.
- Skill scripts are standalone (installed by copying `skill/` as-is). Small helper
  duplication across them (opt/die) is accepted; identity rules and honesty rules
  are NOT duplicable — they live in one place or read from one source (e.g.
  repo_id comes from the digest).
- Scripts run headless: `die()` with exit 2 and an actionable message, never a raw
  stack trace; one bad store entry must never poison every later run.
