"use strict";
const { test, after } = require("node:test");
const assert = require("node:assert");
const { execFileSync, execFile } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const SHARE = path.join(__dirname, "..", "skill", "share.js");
const TMP = path.join(__dirname, "tmp", "share");
fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });

// mock endpoint: counts every request, records the last body
const hits = [];
const server = http.createServer((req, res) => {
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    hits.push({ method: req.method, body: Buffer.concat(chunks) });
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("https://paste.example/abc123\n");
  });
});
let PORT;
test.before(() => new Promise((ok) => server.listen(0, "127.0.0.1", () => { PORT = server.address().port; ok(); })));
after(() => server.close());

const url = () => `http://127.0.0.1:${PORT}/upload`;
const PREVIEW = path.join(TMP, "share-preview.html");
function run(args) {
  return execFileSync("node", [SHARE, ...args], { encoding: "utf8", stdio: "pipe", cwd: TMP });
}
function fails(args, re) {
  assert.throws(() => run(args), (e) => {
    assert.strictEqual(e.status, 2);
    assert.match(e.stderr.toString(), re);
    return true;
  });
}

const HTML = `<html><body>Maya R shipped things. Contact real.person@bigcorp.example or see https://internal.bigcorp.example/dash</body></html>`;
fs.writeFileSync(path.join(TMP, "journey.html"), HTML);

test("E1: preview step publishes NOTHING and surfaces emails/URLs for human review", () => {
  const before = hits.length;
  let out = "";
  try { run(["--html", "journey.html", "--to", url()]); }
  catch (e) { out = e.stderr.toString(); throw e; }
  out = fs.existsSync(PREVIEW) ? "" : out;
  assert.strictEqual(hits.length, before, "preview must not touch the network");
  assert.ok(fs.existsSync(PREVIEW), "preview file expected");
  assert.strictEqual(fs.readFileSync(PREVIEW, "utf8"), HTML, "preview is the exact bytes that would publish");
});

test("preview report names what a human should check before confirming", () => {
  const report = execFileSync("node", [SHARE, "--html", "journey.html", "--to", url()],
    { encoding: "utf8", stdio: "pipe", cwd: TMP });
  assert.match(report, /real\.person@bigcorp\.example/, "emails in the page must be surfaced");
  assert.match(report, /internal\.bigcorp\.example/, "URLs in the page must be surfaced");
  assert.match(report, /--confirm/, "must say how to actually publish");
});

test("E2: --confirm publishes the preview bytes exactly once, byte-identical", async () => {
  const before = hits.length;
  // hostile: journey.html changes AFTER preview — what publishes is what was REVIEWED
  fs.writeFileSync(path.join(TMP, "journey.html"), "<html>changed after review</html>");
  // async: the mock server lives in THIS process; a sync exec would deadlock it
  const out = await new Promise((ok, no) => execFile("node", [SHARE, "--confirm", "--to", url()],
    { cwd: TMP, timeout: 10000 }, (err, stdout, stderr) => err ? no(new Error(stderr)) : ok(stdout)));
  assert.strictEqual(hits.length, before + 1, "exactly one publish call");
  assert.strictEqual(hits[hits.length - 1].method, "POST");
  assert.strictEqual(hits[hits.length - 1].body.toString(), HTML, "published bytes must equal the reviewed preview");
  assert.match(out, /paste\.example\/abc123/, "endpoint response (the link) must be shown");
});

test("E1: --confirm without a preview refuses — no blind publish path exists", () => {
  fs.rmSync(PREVIEW);
  const before = hits.length;
  fails(["--confirm", "--to", url()], /preview/);
  assert.strictEqual(hits.length, before, "refusal must not publish");
});

test("guards: missing html, missing --to, unreachable endpoint dies actionably", () => {
  fails(["--html", "nope.html", "--to", url()], /nope\.html/);
  fails(["--html", "journey.html"], /--to/);
  run(["--html", "journey.html", "--to", "http://127.0.0.1:1/dead"]); // preview is offline — fine
  fails(["--confirm", "--to", "http://127.0.0.1:1/dead"], /publish failed/i);
});
