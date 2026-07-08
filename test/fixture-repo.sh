#!/usr/bin/env bash
# Builds a deterministic git fixture repo for recall tests.
# Usage: fixture-repo.sh [dir]   (env: COMMITS=120)
set -euo pipefail
DIR="${1:-$(cd "$(dirname "$0")" && pwd)/tmp/fixture}"
N="${COMMITS:-120}"
rm -rf "$DIR"; mkdir -p "$DIR"; cd "$DIR"

git init -q -b main
git config user.name "Maya R"
git config user.email "maya@work.test"
git config commit.gpgsign false

# alias: maya also commits as <maya@home.test>; .mailmap canonicalizes it
printf 'Maya R <maya@work.test> maya <maya@home.test>\n' > .mailmap
printf 'fixture\n' > README.md
echo "CANARY_9E1_SECRET_CONTENT" > canary.txt   # file CONTENT must never reach the digest
git add -A
GIT_AUTHOR_DATE="2024-01-01T10:00:00Z" GIT_COMMITTER_DATE="2024-01-01T10:00:00Z" \
  git commit -qm "init fixture" --author="Maya R <maya@work.test>"

AREAS=(api web infra docs)
MAYA=1 BOB=0 KEYS=0
for i in $(seq 1 "$N"); do
  AREA="${AREAS[$((i % 4))]}"
  mkdir -p "$AREA"
  # a few big commits so candidate scoring has real spread
  if [ $((i % 20)) -eq 0 ]; then seq 1 120 >> "$AREA/big_$i.txt"; else echo "line $i" >> "$AREA/f.txt"; fi
  SUBJ="update $AREA module ($i)"
  if [ $((i % 13)) -eq 0 ]; then SUBJ="PROJ-$i: ship $AREA feature"; KEYS=$((KEYS+1)); fi
  if [ "$i" -eq 7 ]; then SUBJ="Fix SHA-256 digest and UTF-8 handling"; fi
  if [ $((i % 15)) -eq 0 ]; then WHO="Bob T <bob@other.test>"; BOB=$((BOB+1));
  elif [ $((i % 10)) -eq 0 ]; then WHO="maya <maya@home.test>"; MAYA=$((MAYA+1));
  else WHO="Maya R <maya@work.test>"; MAYA=$((MAYA+1)); fi
  D="$(date -u -j -f %s $(( 1704103200 + i * 86400 )) +%Y-%m-%dT%H:%M:%SZ 2>/dev/null \
     || date -u -d "@$(( 1704103200 + i * 86400 ))" +%Y-%m-%dT%H:%M:%SZ)"
  git add -A
  GIT_AUTHOR_DATE="$D" GIT_COMMITTER_DATE="$D" git commit -qm "$SUBJ" --author="$WHO"
done

# meta for assertions (kept out of the worktree)
printf '{"maya": %d, "bob": %d, "keys": %d}\n' "$((MAYA))" "$BOB" "$KEYS" > .git/fixture-meta.json
echo "$DIR"
