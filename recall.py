#!/usr/bin/env python3
"""Recall — turn your git history into evidence-backed accomplishments.

Reads your commits (message + diff) from a repo, asks Claude to classify each
into categorized STAR-style accomplishments with a confidence score, and writes
Markdown. That's the whole idea; everything else is a different render of the
JSON this produces.

Usage:
    export ANTHROPIC_API_KEY=sk-...
    python recall.py /path/to/repo --author "you@example.com" > me.md

    # HTML when you need it (no code required):  pandoc me.md -o me.html
"""
import argparse, json, subprocess, sys

MODEL = "claude-opus-4-8"  # latest/most capable; drop to claude-sonnet-5 to cut cost

PROMPT = """You are analyzing one engineer's git commits to build an interview-ready record.
Below are commits (message + diff) authored by them. Infer the ACTUAL engineering
intent from the diff, not just the message ("fix bug" tells you nothing — the diff does).

Return ONLY JSON: a list of accomplishments. Merge related commits into one accomplishment.
Each item:
{
  "category": "e.g. Performance | Testing | API | Architecture | ...",
  "title": "short accomplishment title",
  "situation": "...", "task": "...", "action": "...", "result": "...",
  "resume_bullet": "one crisp resume line",
  "confidence": 0-100,   // how resume-worthy: typo fix ~2, real feature ~90+
  "evidence": ["commit sha", ...]
}
Skip trivia (typos, formatting) by giving low confidence, don't invent results you can't see.

COMMITS:
"""


def commits(repo, author, limit):
    # ponytail: one git call gets sha+subject+body+full diff. --author matches name or email substring.
    fmt = "%x00%H%x00%an <%ae>%x00%ad%x00%s%x00%b%x01"
    args = ["git", "-C", repo, "log", f"--pretty=format:{fmt}", "-p", f"-n{limit}"]
    if author:
        args.append(f"--author={author}")
    out = subprocess.run(args, capture_output=True, text=True, check=True).stdout
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("repo")
    ap.add_argument("--author", help="name or email substring; omit for all authors")
    ap.add_argument("--limit", type=int, default=200, help="max commits to scan")
    ap.add_argument("--min-confidence", type=int, default=40)
    a = ap.parse_args()

    raw = commits(a.repo, a.author, a.limit)
    if not raw.strip():
        sys.exit("No commits found. Check --author or the repo path.")

    from anthropic import Anthropic  # pip install anthropic
    client = Anthropic()  # reads ANTHROPIC_API_KEY
    msg = client.messages.create(
        model=MODEL, max_tokens=8000,
        messages=[{"role": "user", "content": PROMPT + raw[:400_000]}],
    )
    text = msg.content[0].text
    items = json.loads(text[text.index("["): text.rindex("]") + 1])

    items = [i for i in items if i.get("confidence", 0) >= a.min_confidence]
    items.sort(key=lambda i: -i.get("confidence", 0))
    print(render(items))


def render(items):
    by_cat = {}
    for i in items:
        by_cat.setdefault(i["category"], []).append(i)
    out = ["# Accomplishments\n"]
    for cat, group in by_cat.items():
        out.append(f"\n## {cat}\n")
        for i in group:
            out.append(f"\n### {i['title']}  _(confidence {i.get('confidence','?')})_\n")
            out.append(f"- **Situation:** {i.get('situation','')}")
            out.append(f"- **Task:** {i.get('task','')}")
            out.append(f"- **Action:** {i.get('action','')}")
            out.append(f"- **Result:** {i.get('result','')}")
            out.append(f"- **Resume:** {i.get('resume_bullet','')}")
            out.append(f"- **Evidence:** {', '.join(i.get('evidence', []))}")
    return "\n".join(out)


if __name__ == "__main__":
    main()
