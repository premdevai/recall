# Writing a source adapter

An adapter turns one tool's data (an MCP source: issue tracker, CI, observability, code
host) into evidence records. It is **one section in SKILL.md plus one passing conformance
run** — no code in this repo changes, because every adapter writes the same contract and
every renderer reads it.

## The contract

Adapters follow the four-step contract every existing adapter uses:

1. **Discover via ToolSearch** — never assume the tool is loaded; search for it
   (`"sentry issues"`, `"pagerduty incidents"`).
2. **Query by identity + timeframe, batched** — one query per ~50 keys, never per-item
   fetches.
3. **Map results to evidence records** — the shape in
   [`skill/evidence.schema.json`](skill/evidence.schema.json). Measured numbers go in
   `evidence[].detail` (`type: "metric"`) or top-level `signals[]`; never invent a figure.
4. **Cite source ids** — every record's `evidence[]` carries the ticket key, PR number,
   incident id, or dashboard ref a human could look up.

## Prove it conforms

Produce a sample of your adapter's output (a full `evidence.json` or just
`{ "accomplishments": [...] }`) from real or mocked payloads, then:

```
node skill/conform.js my-adapter-sample.json
```

The kit validates against the schema-derived rules — required fields, enum types, no
fields outside the contract, confidence bounds — and the honesty rules (a record backed
only by `type: "self"` evidence can never claim `source: "verified"`). Every problem is
listed with the record id; fix until it prints `conforms`.

## Ship it

PR containing: the SKILL.md section (follow the format of the Jira/GitHub sections in §2),
your conformance sample under `examples/adapters/<source>.json` (synthetic persona only —
the CI leak gate will reject real names/emails/URLs), and one line in the README source
table. That's the whole thing.
