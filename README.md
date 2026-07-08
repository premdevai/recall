<p align="center">
  <img src="https://raw.githubusercontent.com/premdevai/recall/main/assets/recall-banner.png" alt="Recall — turn your git history into interview-ready proof of impact" width="100%">
</p>

<p align="center">
  <b><a href="https://recall-flax.vercel.app">Live site</a></b>
  &nbsp;·&nbsp; <a href="https://www.npmjs.com/package/@premdevai/recall">npm</a>
  &nbsp;·&nbsp; <a href="https://recall-flax.vercel.app/examples/journey">Sample output</a>
</p>

# Recall

**Reconstruct everything you've demonstrably built — from your own git history and the tools
you already use — into an interview-ready, evidence-backed record. Export it as a polished
HTML page or a Markdown file.**

[![License: MIT](https://img.shields.io/badge/License-MIT-1a1a1a.svg)](LICENSE)
&nbsp;Works as a Claude Code skill · or a standalone CLI

---

Engineers ship hundreds of things over years and remember the last three in the interview. The
evidence is already there — in your commit history, your merged PRs, your closed tickets, your
dashboards. Recall reads it and turns it into proof: categorized by skill, written up as STAR
stories, and scored so the typo fixes stay off your résumé.

**[View a live sample →](https://recall-flax.vercel.app/examples/journey)**
&nbsp;·&nbsp; or see [`examples/journey.html`](examples/journey.html) and [`examples/journey.md`](examples/journey.md)

## What it does

- **Reads intent from diffs, not messages.** "fix bug" tells you nothing; the diff tells you it
  was list virtualization. That inference is where the value is.
- **Uses the sources you already have.** Git always. And any MCP server you've already
  connected — GitHub/GitLab/Bitbucket, Jira/Linear, Datadog, CI — for richer, *measured* evidence.
- **Classifies, scores, and writes it up.** Skills table with real PR and commit counts, STAR
  stories, résumé bullets, and a confidence score per contribution.
- **One dataset, two renders.** HTML and Markdown are identical in detail — never two pipelines.

## How it works

```
  gather.js (script, tokenless)      Claude (judgment only)         render.js (script, tokenless)
  git history ──► digest.json ──►  reads digest + candidate   ──►  evidence.json ──► journey.html
                  (~10–30 KB)      diffs + MCP tickets/PRs,                      └──► journey.md
                                   writes evidence.json ONLY
```

The scripts do the mechanics; the model does the judgment. `gather.js` turns full git history
into a compact digest (identity aliases merged via `.mailmap`, charts precomputed, candidate
commits ranked, ticket keys extracted) so the model never parses raw logs — a **>100× input
cut** on large repos. The model writes one file, `evidence.json`; `render.js` turns it into
both output formats mechanically, so the design is guaranteed and output tokens stay tiny.

Every MCP source is just an adapter that maps its records onto the evidence model — add one
without touching the renderers.

The model is a documented contract: [`evidence.schema.json`](evidence.schema.json) (JSON Schema),
with a filled-in [`examples/evidence.json`](examples/evidence.json). A new **source adapter**
writes this shape; a new **renderer** reads it. That's the whole extension surface.

## Install

### Option A — Claude Code skill via npx (recommended, zero config)

Recall is a single skill file. It reuses your existing git and MCP connections, so there are no
API keys to manage and nothing to build. One command installs it:

```bash
npx @premdevai/recall            # installs to ~/.claude/skills/recall
npx @premdevai/recall --here     # or scope it to the current project
```

Then, in any repository, ask Claude Code:

```
/recall
```

Recall scopes the run, reads your history, pulls from whichever MCP sources you have connected,
and renders the page or Markdown.

### Job hunting? The whole pipeline runs on the same evidence

| Command | Gives you |
|---|---|
| `/recall roles` | The 3–5 roles your record actually supports — with proof, gaps, and job-board search strings |
| `/recall apply <job posting>` | Résumé bullets reordered for that posting, cover-letter paragraphs, likely interview questions each paired with your STAR story, and an honest fit summary |
| `/recall bullets` | Just the résumé bullets, paste-ready |
| `/recall star <topic>` | One STAR story in rehearsal format |
| `/recall career` | The timeline across every repo and employer — each report files itself into a local career store (`~/.recall/`, plain JSON, chmod 600), merged with cross-repo dedupe. `--exclude-employer` / `--anonymize` for sensitive reports |
| `/recall add <what you did>` | Non-git work — talks, mentoring, on-call — recorded as marked `self-reported` evidence, never counted as verified |

Every claim in every mode cites a commit, PR, or ticket — tailored, never inflated.
Reviews and approvals you *gave* roll up separately as "enabled" impact, so senior-IC
leverage is visible without inflating authored counts.

### Health check

```bash
npx @premdevai/recall doctor
```

Shows where the skill is installed (and which copy wins), whether it's outdated, and which MCP
evidence sources are configured — the 5-second answer to "why was my report git-only?".

**Updating.** A skill file is a static copy, not a live link, so updates are pull-based. Re-run
with the `@latest` tag — the tag is what forces npx past its cache to fetch the newest published
version; without it you may just re-run a cached copy:

```bash
npx @premdevai/recall@latest
```

This overwrites `SKILL.md` and `template.html` in place — no uninstall needed.

### Option B — copy the skill by hand

No Node? Drop [`skill/SKILL.md`](skill/SKILL.md) into `~/.claude/skills/recall/` yourself:

```bash
mkdir -p ~/.claude/skills/recall
curl -fsSL https://raw.githubusercontent.com/premdevai/recall/main/skill/SKILL.md \
  -o ~/.claude/skills/recall/SKILL.md
```

### Option C — Standalone CLI (git-only, any environment)

For CI or use outside Claude Code. Requires an [Anthropic API key](https://console.anthropic.com).

```bash
git clone https://github.com/premdevai/recall
cd recall
pip install anthropic
export ANTHROPIC_API_KEY=sk-...

python recall.py /path/to/repo --author "you@example.com" > me.md
```

The CLI produces Markdown from git alone. For the designed HTML page and MCP-enriched evidence,
use the Claude Code skill.

## Usage

| Flag | Default | Description |
|---|---|---|
| `repo` | — | Path to the repository (positional) |
| `--author` | all authors | Name or email substring to filter by |
| `--limit` | 200 | Maximum commits to scan |
| `--min-confidence` | 40 | Drop contributions below this résumé-worthiness score |

```bash
# your last year of work, only the résumé-worthy parts
python recall.py . --author "you@example.com" --limit 500 --min-confidence 60 > me.md
```

## Data sources

Git is the only requirement. Everything else is optional and auto-detected — Recall uses a source
if it's connected and silently skips it if not.

| Source | Adds |
|---|---|
| **Git** *(required)* | Commits, diffs, branches, tags, authorship |
| **GitHub / GitLab / Bitbucket** | Merged PRs, review comments, approvals, closed issues |
| **Jira / Linear** | Completed tickets, story context, acceptance criteria |
| **Datadog / observability** | Real before/after metrics, incidents owned, deploys |
| **CI / CD** | Releases shipped, deployment frequency |

MCP sources are what turn an inferred result ("felt faster") into a measured one
("p75 5.2s → 2.1s") — and raise a claim's confidence through independent corroboration.

## Confidence scoring

Not every commit belongs on a résumé. Recall scores each contribution 0–100 on how worth
showcasing it is — a formatting change lands near 2, a shipped feature with measured impact near
95 — then filters and ranks by it. You decide the threshold.

## Privacy

Recall runs entirely locally. It reads only what is already on your machine or in the tools you
have connected, and it sends nothing anywhere except the model call you initiate with your own
provider and key. No servers, no telemetry, no account. Your history stays yours.

## Roadmap

See [ROADMAP.md](ROADMAP.md) — next up: example outputs for the job modes, identity
aliases, schema validation, and CI-published releases; then the full career store and the
end-to-end application pipeline.

## Contributing

Issues and pull requests are welcome. A good first contribution is a new source adapter or
renderer — both plug into the evidence model without touching the rest. Keep it minimal and
dependency-light.

## License

[MIT](LICENSE)
