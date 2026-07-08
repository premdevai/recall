#!/usr/bin/env node
// recall share — opt-in publishing with a mandatory human review step. Two
// invocations, one publish path:
//
//   node share.js --html journey.html --to <url>    # step 1: write share-preview.html,
//                                                   #   list every email/URL in it, publish NOTHING
//   node share.js --confirm --to <url>              # step 2: POST the preview bytes — exactly
//                                                   #   what was reviewed, even if journey.html
//                                                   #   changed since
//
// The endpoint is always user-chosen (their own server or a paste service —
// prefer one with expiry). Recall hosts nothing; this is the product's only
// write-side network call and it never happens without --confirm.
"use strict";

const fs = require("fs");
const path = require("path");

const argv = process.argv.slice(2);
function opt(name, dflt) {
  const i = argv.indexOf("--" + name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
}
function die(msg) { console.error("recall share: " + msg); process.exit(2); }

const TO = opt("to", null);
if (!TO) die("pass --to <url> — the endpoint is always yours to choose (prefer one with expiry)");
const PREVIEW = opt("preview", "share-preview.html");

if (!argv.includes("--confirm")) {
  const HTML = opt("html", "journey.html");
  let body;
  try { body = fs.readFileSync(HTML); }
  catch (e) { die("cannot read " + HTML + " — run render.js first (" + e.message + ")"); }
  fs.writeFileSync(PREVIEW, body);
  const text = body.toString("utf8");
  // review aid, not a gate — the human reviewing the preview is the allowlist
  const emails = [...new Set(text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/g) || [])];
  const urls = [...new Set((text.match(/https?:\/\/[^\s"'<>)]+/g) || [])
    .map((u) => { try { return new URL(u).hostname; } catch { return u; } }))];
  let report = `Preview written: ${PREVIEW} (${Math.round(body.length / 1024)} KB) — NOTHING has been published.\n\n`;
  report += `Review it in a browser. Found inside the page:\n`;
  report += `  emails: ${emails.length ? emails.join(", ") : "none"}\n`;
  report += `  link hosts: ${urls.length ? urls.join(", ") : "none"}\n\n`;
  report += `If every one of those belongs in public, publish the reviewed bytes with:\n`;
  report += `  node ${path.basename(process.argv[1])} --confirm --to ${TO}\n`;
  process.stdout.write(report);
  process.exit(0);
}

// ---------- the one publish path ----------
let body;
try { body = fs.readFileSync(PREVIEW); }
catch { die("no preview at " + PREVIEW + " — run without --confirm first and review it; publishing unreviewed content is not a thing"); }

const u = new URL(TO);
const mod = u.protocol === "https:" ? require("https") : require("http");
// connection: close — otherwise the kept-alive socket pins the event loop and
// a finished publish looks like a hang
const req = mod.request(u, { method: "POST", agent: false,
  headers: { "content-type": "text/html", "content-length": body.length, connection: "close" } }, (res) => {
  const chunks = [];
  res.on("data", (c) => chunks.push(c));
  res.on("end", () => {
    const reply = Buffer.concat(chunks).toString("utf8").trim();
    if (res.statusCode >= 300) die(`publish failed — ${u.hostname} answered ${res.statusCode}: ${reply.slice(0, 200)}`);
    console.log(`recall share: published ${PREVIEW} (${Math.round(body.length / 1024)} KB) to ${u.hostname}` + (reply ? `\n${reply}` : ""));
  });
});
req.on("error", (e) => die("publish failed — " + e.message));
req.setTimeout(30000, () => { req.destroy(); die("publish failed — timeout after 30s"); });
req.end(body);
