#!/usr/bin/env node
// recall conform — the adapter conformance kit. Validates that adapter output
// (a full evidence.json or an {accomplishments:[...]} fragment) honors the
// evidence contract. The rules are READ FROM evidence.schema.json — the schema
// stays the single statement of the contract; this script only interprets it.
//
//   node conform.js <adapter-output.json>
//
// Every failure is listed (not just the first) with the record id and the rule,
// so an adapter author gets one actionable run. Zero dependencies.
"use strict";

const fs = require("fs");
const path = require("path");

function die(msg) { console.error("recall conform: " + msg); process.exit(2); }

const file = process.argv[2];
if (!file) die("usage: node conform.js <adapter-output.json>");

const schema = JSON.parse(fs.readFileSync(path.join(__dirname, "evidence.schema.json"), "utf8"));
const accSchema = schema.properties.accomplishments.items;
const evSchema = accSchema.properties.evidence.items;
const REQUIRED = accSchema.required;
const ALLOWED = new Set(Object.keys(accSchema.properties));
const EV_REQUIRED = evSchema.required;
const EV_ALLOWED = new Set(Object.keys(evSchema.properties));
const EV_TYPES = evSchema.properties.type.enum;
const SOURCES = accSchema.properties.source.enum;
const CONF = accSchema.properties.confidence;

let data;
try { data = JSON.parse(fs.readFileSync(file, "utf8")); }
catch (e) { die("cannot read " + file + " — " + e.message); }
const records = data.accomplishments;
if (!Array.isArray(records)) die(file + " has no accomplishments array — adapters emit { accomplishments: [...] }");
if (!records.length) die(file + " has no records — an adapter that found nothing emits nothing, not an empty run");

const errors = [];
records.forEach((a, i) => {
  if (typeof a !== "object" || a === null) return errors.push(`record #${i}: not an object`);
  const who = a.id || `record #${i}`;
  const bad = (msg) => errors.push(`${who}: ${msg}`);
  for (const k of REQUIRED) if (!(k in a)) bad(`missing required field "${k}"`);
  for (const k of Object.keys(a)) if (!ALLOWED.has(k)) bad(`field "${k}" is not in the contract — extend evidence.schema.json first, never silently`);
  if ("confidence" in a && (typeof a.confidence !== "number" || a.confidence < CONF.minimum || a.confidence > CONF.maximum))
    bad(`confidence must be a number ${CONF.minimum}–${CONF.maximum} (got ${JSON.stringify(a.confidence)})`);
  if ("source" in a && !SOURCES.includes(a.source))
    bad(`source "${a.source}" is not in the contract — one of: ${SOURCES.join(", ")}`);
  if (!Array.isArray(a.evidence) || !a.evidence.length) {
    bad("evidence must be a non-empty array — a claim without evidence does not belong here");
  } else {
    a.evidence.forEach((e, j) => {
      for (const k of EV_REQUIRED) if (!(k in e)) bad(`evidence[${j}] missing "${k}"`);
      for (const k of Object.keys(e)) if (!EV_ALLOWED.has(k)) bad(`evidence[${j}] field "${k}" is not in the contract`);
      if (e.type && !EV_TYPES.includes(e.type)) bad(`evidence[${j}] type "${e.type}" is not in the contract — one of: ${EV_TYPES.join(", ")}`);
    });
    // honesty rule: purely self-told claims can never be labeled verified
    if (a.source === "verified" && a.evidence.every((e) => e.type === "self"))
      bad(`only type "self" evidence but source "verified" — self-reported claims must say so`);
  }
});

if (errors.length) {
  console.error(`recall conform: ${file} FAILS the evidence contract (${errors.length} problem${errors.length > 1 ? "s" : ""}):`);
  for (const e of errors) console.error("  · " + e);
  process.exit(2);
}
console.log(`recall conform: ${records.length} record${records.length > 1 ? "s" : ""} — conforms to the evidence contract.`);
