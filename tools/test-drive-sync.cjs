/* =============================================================================
   test-drive-sync.cjs — tests tools/drive-sync/drive-to-github.gs (the Drive → GitHub
   sync) without Google or GitHub: the script runs here against small stand-ins for
   Apps Script (Drive folders, UrlFetchApp, properties, triggers, email) and for
   GitHub's git API. Run: node tools/test-drive-sync.cjs
   ============================================================================= */
"use strict";
const fs = require("fs"), vm = require("vm"), crypto = require("crypto"), path = require("path");
const SRC = path.join(__dirname, "drive-sync", "drive-to-github.gs");
const DOCX_A = Buffer.concat([Buffer.from("PK"), crypto.randomBytes(40000)]);   // stands for a Google Doc's .docx
const PHOTO = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), crypto.randomBytes(90000)]);  // stands for a photo
let fails = 0;
const ok = (c, msg) => { if (!c) { fails++; console.log("  FAIL:", msg); } else console.log("  ok:", msg); };

// ---------------------------------------------------------------- bytes helpers (Apps Script byte[] = signed ints)
const toSigned = (buf) => Array.from(buf, (b) => (b > 127 ? b - 256 : b));
const toBuf = (arr) => Buffer.from(arr.map((b) => b & 0xff));

// ---------------------------------------------------------------- mock GitHub (git data API)
function makeGitHub(repo) {
  const G = { blobs: {}, trees: {}, commits: {}, ref: null, calls: [], failNextPatch: false, tokenOk: true };
  const sha = (s) => crypto.createHash("sha1").update(s).digest("hex");
  const putBlob = (buf) => { const h = sha(Buffer.concat([Buffer.from("blob " + buf.length + "\0"), buf])); G.blobs[h] = buf; return h; };
  const putTree = (entries) => { const h = sha(JSON.stringify(Object.entries(entries).sort())); G.trees[h] = entries; return h; };
  const putCommit = (c) => { const h = sha(JSON.stringify(c) + Math.random()); G.commits[h] = c; return h; };
  const t0 = putTree({ "index.html": putBlob(Buffer.from("<html>")) });
  G.ref = putCommit({ tree: t0, parents: [], message: "init" });
  G.files = () => { const out = {}; for (const [p, b] of Object.entries(G.trees[G.commits[G.ref].tree])) out[p] = G.blobs[b]; return out; };
  G.handle = (method, url, body) => {
    G.calls.push(method + " " + url.split("?")[0]);
    if (!G.tokenOk) return [401, { message: "Bad credentials" }];
    const base = "/repos/" + repo;
    if (method === "GET" && url === base) return [200, { full_name: repo, permissions: { push: true } }];
    if (method === "GET" && url === base + "/git/ref/heads/master") return [200, { object: { sha: G.ref } }];
    let m;
    if (method === "GET" && (m = url.match(/\/git\/commits\/(\w+)$/))) return [200, { sha: m[1], tree: { sha: G.commits[m[1]].tree } }];
    if (method === "GET" && (m = url.match(/\/git\/trees\/(\w+)\?recursive=1$/))) return [200, { tree: Object.keys(G.trees[m[1]]).map((p) => ({ path: p, type: "blob" })) }];
    if (method === "POST" && url === base + "/git/blobs") { if (body.encoding !== "base64") return [422, { message: "enc" }]; return [201, { sha: putBlob(Buffer.from(body.content, "base64")) }]; }
    if (method === "POST" && url === base + "/git/trees") {
      const t = Object.assign({}, G.trees[body.base_tree]);
      for (const e of body.tree) {
        if (e.sha === null) { if (!(e.path in t)) return [422, { message: "delete of missing " + e.path }]; delete t[e.path]; }
        else if (e.content != null) t[e.path] = putBlob(Buffer.from(e.content, "utf8"));
        else { if (!G.blobs[e.sha]) return [422, { message: "no blob" }]; t[e.path] = e.sha; }
      }
      return [201, { sha: putTree(t) }];
    }
    if (method === "POST" && url === base + "/git/commits") return [201, { sha: putCommit({ tree: body.tree, parents: body.parents, message: body.message }) }];
    if (method === "PATCH" && url === base + "/git/refs/heads/master") {
      if (G.failNextPatch) { G.failNextPatch = false; G.ref = putCommit({ tree: G.commits[G.ref].tree, parents: [G.ref], message: "someone else" }); }
      const c = G.commits[body.sha];
      if (!body.force && c.parents[0] !== G.ref) return [422, { message: "Update is not a fast forward" }];
      G.ref = body.sha; return [200, { object: { sha: body.sha } }];
    }
    if (method === "GET" && (m = url.match(/\/contents\/([^?]+)\?ref=master$/))) {
      const b = G.files()[decodeURIComponent(m[1])];
      if (!b) return [404, { message: "Not Found" }];
      return [200, { content: b.toString("base64").replace(/(.{60})/g, "$1\n"), sha: "x" }];
    }
    return [404, { message: "no route " + method + " " + url }];
  };
  return G;
}

// ---------------------------------------------------------------- mock Drive
let nextId = 1;
class MFile {
  constructor(name, type, bytes, parent) { this.id = "f" + nextId++; this.name = name; this.type = type; this.bytes = bytes; this.parent = parent; this.updated = new Date(Date.now() - 3600e3); this.trashed = false; }
  getId() { return this.id; } getName() { return this.name; } getMimeType() { return this.type; }
  getLastUpdated() { return this.updated; } getSize() { return this.type === "application/vnd.google-apps.document" ? 0 : this.bytes.length; }
  getBlob() { const b = this.bytes; return { getBytes: () => toSigned(b) }; } isTrashed() { return this.trashed; }
}
class MFolder {
  constructor(name, parent) { this.id = "d" + nextId++; this.name = name; this.parent = parent; this.folders = []; this.files = []; this.trashed = false; }
  getId() { return this.id; } getName() { return this.name; } getUrl() { return "https://drive.google.com/drive/folders/" + this.id; } isTrashed() { return this.trashed; }
  getFiles() { return iter(this.files.filter((f) => !f.trashed)); } getFolders() { return iter(this.folders.filter((f) => !f.trashed)); }
  getFoldersByName(n) { return iter(this.folders.filter((f) => f.name === n && !f.trashed)); }
  createFolder(n) { const f = new MFolder(n, this); this.folders.push(f); return f; }
  add(name, type, bytes) { const f = new MFile(name, type, bytes, this); this.files.push(f); return f; }
}
const iter = (arr) => { let i = 0; return { hasNext: () => i < arr.length, next: () => arr[i++] }; };
function allFolders(f, out = []) { out.push(f); for (const c of f.folders) allFolders(c, out); return out; }

// ---------------------------------------------------------------- the Apps Script world
function world() {
  const W = { root: new MFolder("My Drive", null), props: {}, mails: [], logs: [], triggers: [], exports: 0 };
  W.gh = makeGitHub("ashutosh-shinde/ashutosh-shinde.github.io");
  const resp = (code, obj, bytes) => ({ getResponseCode: () => code, getContentText: () => (typeof obj === "string" ? obj : JSON.stringify(obj)), getBlob: () => ({ getBytes: () => toSigned(bytes || Buffer.alloc(0)) }) });
  const ctx = {
    console: { log: (s) => W.logs.push(String(s)), error: (s) => W.logs.push("ERR " + s) },
    Utilities: {
      base64Encode: (a) => toBuf(a).toString("base64"),
      base64Decode: (s) => toSigned(Buffer.from(s, "base64")),
      newBlob: (d) => { const buf = typeof d === "string" ? Buffer.from(d, "utf8") : toBuf(d); return { getBytes: () => toSigned(buf), getDataAsString: () => buf.toString("utf8") }; },
      computeDigest: (alg, a) => toSigned(crypto.createHash("sha1").update(toBuf(a)).digest()),
      DigestAlgorithm: { SHA_1: "SHA_1" }, sleep: () => {},
    },
    DriveApp: {
      getRootFolder: () => W.root,
      getFolderById: (id) => { const f = allFolders(W.root).find((x) => x.id === id); if (!f) throw new Error("no folder"); return f; },
      getFoldersByName: (n) => iter(allFolders(W.root).filter((f) => f.name === n && f !== W.root)),
    },
    UrlFetchApp: {
      fetch: (url, opt = {}) => {
        if (url.startsWith("https://api.github.com")) {
          if (!/^Bearer /.test(opt.headers.Authorization)) return resp(401, { message: "no auth" });
          const [code, obj] = W.gh.handle(opt.method || "GET", url.slice("https://api.github.com".length), opt.payload ? JSON.parse(opt.payload) : null);
          return resp(code, obj);
        }
        let m = url.match(/docs\.google\.com\/document\/d\/(\w+)\/export\?format=docx/);
        if (m) { W.exports++; const f = allFolders(W.root).flatMap((d) => d.files).find((x) => x.id === m[1]); return f ? resp(200, "", f.bytes) : resp(404, "nope"); }
        return resp(404, "unknown url " + url);
      },
    },
    ScriptApp: {
      getOAuthToken: () => "oauth", getProjectTriggers: () => W.triggers, deleteTrigger: (t) => { W.triggers = W.triggers.filter((x) => x !== t); },
      newTrigger: (fn) => ({ timeBased: () => ({ everyMinutes: (n) => ({ create: () => { const t = { getHandlerFunction: () => fn, n }; W.triggers.push(t); return t; } }) }) }),
    },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k in W.props ? W.props[k] : null), setProperty: (k, v) => { W.props[k] = String(v); } }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    MailApp: { sendEmail: (to, s, b) => W.mails.push({ to, s, b }) },
    Session: { getEffectiveUser: () => ({ getEmail: () => "me@example.com" }) },
    HtmlService: { createHtmlOutput: (h) => ({ html: h, setTitle() { return this; } }) },
    Date, JSON, Math, Object, Array, String, Number, RegExp, Error, encodeURIComponent,
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(SRC, "utf8") + "\n;this.__api = { setup, sync, doGet };", ctx, { filename: "drive-to-github.gs" });
  W.api = ctx.__api;
  return W;
}

const DOC = "application/vnd.google-apps.document";
const files = (W) => Object.keys(W.gh.files()).sort();
const manifest = (W) => JSON.parse(W.gh.files()["content/.drive-sync.json"].toString("utf8"));

console.log("1. setup without a token");
let W = world();
try { W.api.setup(); ok(false, "should throw"); } catch (e) { ok(/No GITHUB_TOKEN/.test(e.message), "clear error when the token is missing: " + e.message.slice(0, 60)); }

console.log("2. setup with a token: folders, timer, first sync");
W.props.GITHUB_TOKEN = "github_pat_x";
W.api.setup();
const root = W.root.folders.find((f) => f.name === "WildQuant website");
ok(!!root, "root folder made");
ok(root && ["Blog", "Elementary Mathematics", "Drafts"].every((n) => root.folders.some((f) => f.name === n)), "Blog, Elementary Mathematics and Drafts made");
ok(W.triggers.length === 1 && W.triggers[0].n === 10, "one 10-minute timer");
ok(W.logs.some((l) => /Nothing new/.test(l)), "first sync: nothing new");
W.api.setup();
ok(W.triggers.length === 1, "running setup again keeps one timer");
ok(W.root.folders.filter((f) => f.name === "WildQuant website").length === 1, "and one root folder");

console.log("3. a Google Doc in Blog, a Markdown post with a photo in a subfolder of Maths, a Sheet, a draft");
const blog = root.folders.find((f) => f.name === "Blog"), maths = root.folders.find((f) => f.name === "Elementary Mathematics"), drafts = root.folders.find((f) => f.name === "Drafts");
const doc = blog.add("Winter on Kalsubai", DOC, DOCX_A);
const sub = maths.createFolder("root-two");
sub.add("index.md", "text/markdown", Buffer.from("title: Root two\ndate: 2026-10-25\n\n$\\sqrt2$\n"));
sub.add("photo.jpg", "image/jpeg", PHOTO);
blog.add("Budget", "application/vnd.google-apps.spreadsheet", Buffer.alloc(0));
drafts.add("Not yet", DOC, DOCX_A);
let r = W.api.sync();
ok(r.changed === 3, "3 files sent (" + r.changed + ")");
ok(files(W).includes("content/blog/Winter on Kalsubai.docx"), "the doc → content/blog/Winter on Kalsubai.docx");
ok(files(W).includes("content/maths/root-two/index.md") && files(W).includes("content/maths/root-two/photo.jpg"), "the subfolder keeps the post and its photo together");
ok(!files(W).some((p) => /Not yet|Budget/.test(p)), "drafts and the Sheet are not sent");
ok(/skipped Budget/.test(r.text), "the Sheet is reported as skipped");
ok(W.gh.files()["content/blog/Winter on Kalsubai.docx"].equals(DOCX_A), "the docx arrives byte for byte");
ok(W.gh.files()["content/maths/root-two/photo.jpg"].equals(PHOTO), "the photo arrives byte for byte");
ok(Object.keys(manifest(W).files).length === 3, "the manifest lists the 3 files");
const commits1 = Object.keys(W.gh.commits).length;
ok(/^Drive: add /.test(W.gh.commits[W.gh.ref].message), "commit message: " + W.gh.commits[W.gh.ref].message);

console.log("4. nothing changed: no export, no commit");
W.exports = 0; r = W.api.sync();
ok(r.changed === 0 && W.exports === 0 && Object.keys(W.gh.commits).length === commits1, "untouched files are not downloaded again");

console.log("5. the doc is opened and touched but not changed");
doc.updated = new Date(Date.now() - 3600e3 + 60e3); W.exports = 0; r = W.api.sync();
ok(r.changed === 0 && W.exports === 1 && Object.keys(W.gh.commits).length === commits1, "exported once to compare, no commit");
W.exports = 0; W.api.sync(); ok(W.exports === 0, "…and not exported again after that");

console.log("6. the doc is being edited right now");
doc.bytes = Buffer.concat([DOCX_A, Buffer.from("x")]); doc.updated = new Date(Date.now() - 30e3);
r = W.api.sync();
ok(r.changed === 0 && /waiting/.test(r.text), "it waits until the doc is left alone");
console.log("   …the Publish-now link does not wait");
const page = W.api.doGet();
ok(/updated: content\/blog\/Winter on Kalsubai.docx/.test(page.html), "doGet publishes at once and says so");
ok(W.gh.files()["content/blog/Winter on Kalsubai.docx"].length === DOCX_A.length + 1, "the new version is in the repo");
ok(/^Drive: update /.test(W.gh.commits[W.gh.ref].message), "commit message: " + W.gh.commits[W.gh.ref].message);

console.log("7. renamed, and a file moved to Drafts");
doc.name = "A winter night on Kalsubai"; doc.updated = new Date(Date.now() - 600e3);
const photo = sub.files.find((f) => f.name === "photo.jpg"); sub.files = sub.files.filter((f) => f !== photo); drafts.files.push(photo);
r = W.api.sync();
ok(files(W).includes("content/blog/A winter night on Kalsubai.docx") && !files(W).includes("content/blog/Winter on Kalsubai.docx"), "rename: new path in, old path out");
ok(!files(W).includes("content/maths/root-two/photo.jpg"), "moved to Drafts: removed from the repo");
ok(!("content/maths/root-two/photo.jpg" in manifest(W).files), "…and from the manifest");

console.log("8. files put in the repo by other means are never touched");
W.gh.handle("POST", "/x", {}); // (no-op)
const t = Object.assign({}, W.gh.trees[W.gh.commits[W.gh.ref].tree]);
const blobSha = crypto.createHash("sha1").update(Buffer.concat([Buffer.from("blob 5\0"), Buffer.from("hello")])).digest("hex"); W.gh.blobs[blobSha] = Buffer.from("hello");
t["content/blog/uploaded-on-github.md"] = blobSha;
const tsha = crypto.createHash("sha1").update(JSON.stringify(Object.entries(t).sort())).digest("hex"); W.gh.trees[tsha] = t;
const csha = crypto.createHash("sha1").update("c" + Math.random()).digest("hex"); W.gh.commits[csha] = { tree: tsha, parents: [W.gh.ref], message: "web upload" }; W.gh.ref = csha;
sub.add("extra.png", "image/png", PHOTO); r = W.api.sync();
ok(files(W).includes("content/blog/uploaded-on-github.md"), "a file uploaded on github.com stays");

console.log("9. master moved while syncing: tries again");
W.gh.failNextPatch = true; sub.add("late.md", "text/markdown", Buffer.from("title: Late\n")); r = W.api.sync();
ok(files(W).includes("content/maths/root-two/late.md"), "the second try lands");
ok(W.gh.commits[W.gh.ref].parents.length === 1 && W.gh.commits[W.gh.commits[W.gh.ref].parents[0]].message === "someone else", "on top of the other commit");

console.log("10. a bad token: one email, not one every 10 minutes");
W.gh.tokenOk = false; sub.add("more.md", "text/markdown", Buffer.from("x"));
for (let i = 0; i < 3; i++) { try { W.api.sync(); } catch (e) { /* expected */ } }
ok(W.mails.length === 1 && /expired|token/.test(W.mails[0].b), "one email explaining the token problem");
W.gh.tokenOk = true; r = W.api.sync(); ok(files(W).includes("content/maths/root-two/more.md"), "fixed token: the next run sends the waiting file");

console.log("11. a file deleted on github.com, then removed in Drive");
{ const tt = Object.assign({}, W.gh.trees[W.gh.commits[W.gh.ref].tree]); delete tt["content/maths/root-two/late.md"];
  const th = crypto.createHash("sha1").update(JSON.stringify(Object.entries(tt).sort())).digest("hex"); W.gh.trees[th] = tt;
  const ch = crypto.createHash("sha1").update("d" + Math.random()).digest("hex"); W.gh.commits[ch] = { tree: th, parents: [W.gh.ref], message: "deleted on web" }; W.gh.ref = ch; }
sub.files = sub.files.filter((f) => f.name !== "late.md"); sub.add("one-more.md", "text/markdown", Buffer.from("y"));
try { r = W.api.sync(); ok(files(W).includes("content/maths/root-two/one-more.md") && !("content/maths/root-two/late.md" in manifest(W).files), "no error; the manifest forgets it"); }
catch (e) { ok(false, "threw: " + e.message); }

console.log("\n" + (fails ? fails + " FAILED" : "all passed"));
process.exit(fails ? 1 : 0);
