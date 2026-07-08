#!/usr/bin/env bash
# PII / account-leak gate. Fails the build if personal identifiers or
# account-bound URLs appear in tracked files. The only allowed identity is
# the public handle (premdevai) and the synthetic persona (maya / cobalt-web).
set -euo pipefail
cd "$(cd "$(dirname "$0")/.." && pwd)"

PATTERNS='claude\.ai/(code|chat|artifact)|fca84c58|onequince|prem\.kumar|author=prem([^d]|$)|--author "prem'
hits="$(git grep -nIiE "$PATTERNS" -- . ':(exclude)test/leak-check.sh' || true)"

if [ -n "$hits" ]; then
  echo "LEAK GATE FAILED — personal identifiers in tracked files:"
  echo "$hits"
  exit 1
fi
echo "leak gate: clean"
