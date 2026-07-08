# Security

## Threat model

Recall is **local-first by construction**. What it reads, where data lives, and what ever
leaves the machine:

| Surface | Behavior |
|---|---|
| Reads | Local git history (paths, stats, messages — never file contents into the digest) and MCP tools the user has already connected. |
| Writes | `.recall/` inside the repo (gitignored automatically) and `~/.recall/` (plain JSON, chmod 600). No sync, no cloud copy. |
| Network — read side | One case: a job-posting URL the user explicitly gives to `/recall apply` (fetched by the agent, not by these scripts). |
| Network — write side | One case: `share.js --confirm` POSTs a human-reviewed preview to a user-chosen endpoint. Without `--confirm`, nothing is ever published; there is no other outbound write path in the codebase. |
| Telemetry / accounts | None. Nothing phones home. |

## Supply chain

- **Zero runtime dependencies** — enforced by CI on every push; the SBOM is this package.
- npm releases are published by GitHub Actions with **provenance** on version tags only,
  and the tag must match `package.json`.
- A PII **leak gate** runs in CI: no real names, emails, or account-bound URLs may appear
  in tracked files outside the synthetic test persona.

## Data honesty (part of the security posture)

Self-reported claims are structurally marked and never counted as verified; privacy views
(`--exclude-employer`, `--anonymize`) rewrite structured fields and free-text mentions at
merge time — downstream renderers can't reintroduce what was removed.

## Supported versions

The latest two minor versions receive fixes. Older versions: upgrade with
`npx @premdevai/recall@latest`.

## Reporting

Open a GitHub security advisory on the repository, or an issue if the report is not
sensitive.
