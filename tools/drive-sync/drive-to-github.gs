/* =============================================================================
   WildQuant publish — Google Apps Script that copies your Drive folders into
   the website's repo, so that whatever you put there appears on the site.

     Drive: WildQuant website/Blog                    → content/blog/
            WildQuant website/Elementary Mathematics  → content/maths/
            WildQuant website/Drafts                  (never copied)

   Every 10 minutes it looks for new, changed, moved and deleted files and
   sends them to GitHub in one commit; GitHub then makes the pages (about two
   minutes). A Google Doc is sent as a Word file (.docx), which keeps its
   headings, photos, links and equations. Other files (.md, .Rmd, .tex,
   knitted .html, photos, …) are sent as they are. A file you are still
   editing waits until you have left it alone for a few minutes.

   ONE-TIME SETUP (about 10 minutes) — the steps are also in content/README.md
   1. Make a GitHub token: github.com → your picture → Settings → Developer
      settings → Personal access tokens → Fine-grained tokens → Generate new
      token. Repository access: Only select repositories →
      ashutosh-shinde.github.io. Permissions → Repository permissions →
      Contents: Read and write. Generate, and copy it.
   2. Open https://script.google.com → New project. Rename it (top left) to
      "WildQuant publish". Delete what is in Code.gs, paste this whole file,
      and click Save (the disk icon).
   3. Project Settings (the gear on the left) → Script Properties → Add script
      property:  Property GITHUB_TOKEN   Value: the token. Save.
   4. Back in the Editor, pick "setup" in the function list at the top and
      click Run. Allow the permissions it asks for (Google shows "Google hasn't
      verified this app": click Advanced → Go to WildQuant publish (unsafe);
      it is your own script, running as you). setup checks the token, finds
      (or makes) the folders in your Drive, turns on the 10-minute timer and
      does a first sync. The log at the bottom shows what it did.
   5. Optional, a "Publish now" link: Deploy → New deployment → Select type:
      Web app. Execute as: Me. Who has access: Only myself. Deploy, and
      bookmark the Web app URL. Opening it publishes straight away and shows
      what is on the site.

   ONLY YOU: the folders stay private, the script runs as you, and the token
   can write to this one repository and nothing else. If something fails you
   get an email (at most one a day for the same problem).
   HOW TO EDIT: the settings just below.
   ============================================================================= */

const REPO = "ashutosh-shinde/ashutosh-shinde.github.io";
const BRANCH = "master";
const ROOT_NAME = "WildQuant website";            // the folder in your Drive
const SECTIONS = [
  { folder: "Blog", dest: "content/blog" },
  { folder: "Elementary Mathematics", dest: "content/maths" },
];
const DRAFTS = "Drafts";                           // made by setup, never copied
const MANIFEST = "content/.drive-sync.json";       // what came from Drive (kept in the repo)
const EVERY_MINUTES = 10;                          // the timer: 1, 5, 10, 15 or 30
const SETTLE_MINUTES = 3;                          // a file changed more recently than this waits for the next run
const MAX_MB = 25;                                 // bigger files are skipped (with an email)
const TIME_BUDGET_MS = 4.5 * 60 * 1000;            // Apps Script stops a run at 6 minutes: send what is ready by then
const SKIP_TYPES = {                               // Google files that can't become a page
  "application/vnd.google-apps.spreadsheet": "a Google Sheet", "application/vnd.google-apps.presentation": "Google Slides",
  "application/vnd.google-apps.form": "a Google Form", "application/vnd.google-apps.drawing": "a Google Drawing",
  "application/vnd.google-apps.shortcut": "a shortcut (put the file itself in the folder)",
};
const DOC = "application/vnd.google-apps.document";
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/* ------------------------------------------------------------------ entry points */

/** Run once by hand (see the setup steps above). */
function setup() {
  const me = github_("GET", "/repos/" + REPO);
  if (!me.permissions || !me.permissions.push) throw new Error("The token can read " + REPO + " but not write to it: give it Contents: Read and write.");
  const root = rootFolder_(true);
  for (const name of SECTIONS.map((s) => s.folder).concat([DRAFTS])) child_(root, name, true);
  for (const tr of ScriptApp.getProjectTriggers()) if (tr.getHandlerFunction() === "sync") ScriptApp.deleteTrigger(tr);
  ScriptApp.newTrigger("sync").timeBased().everyMinutes(EVERY_MINUTES).create();
  log_("Your folders: " + root.getUrl());
  log_("Timer on: every " + EVERY_MINUTES + " minutes. First sync:");
  const r = sync();
  log_(r.text);
}

/** The timer calls this. You can also run it by hand from the editor. */
function sync(opts) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return { changed: 0, text: "Another sync is running: nothing done." };
  try {
    const r = syncOnce_(opts && opts.now === true);
    PropertiesService.getScriptProperties().setProperty("LAST_SYNC", JSON.stringify({ at: new Date().toISOString(), text: r.text }));
    return r;
  } catch (e) {
    report_(e);
    throw e;
  } finally {
    lock.releaseLock();
  }
}

/** The "Publish now" web app (deployed for "Only myself"). */
function doGet() {
  let text;
  try { text = sync({ now: true }).text; } catch (e) { text = "Problem: " + (e && e.message || e); }
  const files = Object.keys(readManifest_().manifest.files).sort();
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const html = '<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:16px/1.5 system-ui,sans-serif;margin:24px;max-width:46rem;color:#222}code{font-size:.9em}</style>' +
    "<h2>WildQuant publish</h2><p>" + esc(text).replace(/\n/g, "<br>") + "</p>" +
    "<p>The site updates about two minutes after a change is sent: <a href='https://" + REPO.split("/")[1] + "/' target='_blank'>open the site</a>, " +
    "<a href='https://github.com/" + REPO + "/actions' target='_blank'>see the builds</a>.</p>" +
    "<h3>From Drive (" + files.length + ")</h3><ul>" + files.map((f) => "<li><code>" + esc(f) + "</code></li>").join("") + "</ul>";
  return HtmlService.createHtmlOutput(html).setTitle("WildQuant publish");
}

/* ------------------------------------------------------------------ the sync */

// now: publish files even if they changed a moment ago (the Publish-now link)
function syncOnce_(now) {
  const t0 = Date.now(), root = rootFolder_(false), notes = [], props = PropertiesService.getScriptProperties();
  const old = readManifest_().manifest.files;   // repo path → { id, hash } of what came from Drive

  // 1. what is in Drive now: repo path → file
  const found = {};
  for (const s of SECTIONS) {
    const folder = child_(root, s.folder, false);
    if (folder) walkFolder_(folder, s.dest, found, notes);
  }

  // 2. what may have changed since the last look: new paths, and files edited since (their last-edited
  //    time is remembered in the script's properties, so an untouched file is not downloaded again)
  const t = Date.now(), check = [], removed = [], seen = {};
  for (const path of Object.keys(found)) {
    const f = found[path], prev = old[path], mod = f.getLastUpdated().getTime();
    seen[path] = mod;
    if (prev && prev.id === f.getId() && props.getProperty("m:" + f.getId()) === String(mod)) continue;
    if (!now && t - mod < SETTLE_MINUTES * 60000) { notes.push("waiting (edited a moment ago): " + path); continue; }
    check.push(path);
  }
  for (const path of Object.keys(old)) if (!found[path]) removed.push(path);
  if (!check.length && !removed.length) return { changed: 0, text: "Nothing new." + (notes.length ? "\n" + notes.join("\n") : "") };

  // 3. their contents (Google Docs as .docx): only what really changed is sent; stop in time, send what is ready
  const files = Object.assign({}, old), blobs = [], sent = [], looked = [];
  for (const path of removed) delete files[path];
  for (const path of check) {
    if (Date.now() - t0 > TIME_BUDGET_MS) { notes.push("the rest comes in the next run (" + (check.length - looked.length) + " file(s))"); break; }
    const f = found[path], bytes = fileBytes_(f), hash = hash_(bytes);
    looked.push(path);
    if (old[path] && old[path].id === f.getId() && old[path].hash === hash) continue;   // touched, not changed
    blobs.push({ path, bytes });
    files[path] = { id: f.getId(), hash: hash };
    sent.push(path);
  }
  const remember = () => { for (const p of looked) props.setProperty("m:" + found[p].getId(), String(seen[p])); };
  if (!sent.length && !removed.length) { remember(); return { changed: 0, text: "Nothing new." }; }

  // 4. one commit with everything (tried twice, in case master moved meanwhile)
  const manifestText = JSON.stringify({ note: "Kept by the Drive sync (tools/drive-sync/drive-to-github.gs): the files below came from Google Drive. Don't edit.", files: files }, null, 1) + "\n";
  const message = commitMessage_(sent.filter((p) => !old[p]), sent.filter((p) => old[p]), removed);
  for (let attempt = 1; ; attempt++) {
    try { commit_(blobs, removed, manifestText, message); break; }
    catch (e) { if (attempt >= 2 || !/422|409|not a fast forward|Update is not a fast forward/i.test(String(e))) throw e; Utilities.sleep(3000); }
  }
  remember();
  const lines = [];
  for (const p of sent) lines.push((old[p] ? "updated: " : "added: ") + p);
  for (const p of removed) lines.push("removed: " + p);
  return { changed: sent.length + removed.length, text: "Sent to GitHub (the site follows in about two minutes):\n" + lines.join("\n") + (notes.length ? "\n" + notes.join("\n") : "") };
}

// every file in a folder and its subfolders, at its repo path (a subfolder keeps a post and its photos together)
function walkFolder_(folder, dest, found, notes) {
  const files = folder.getFiles();
  while (files.hasNext()) {
    const f = files.next(), type = f.getMimeType(), name = f.getName();
    if (/^[.~]/.test(name)) continue;
    if (SKIP_TYPES[type]) { notes.push("skipped " + name + ": " + SKIP_TYPES[type] + " can't become a page"); continue; }
    if (type !== DOC && f.getSize() > MAX_MB * 1048576) { notes.push("skipped " + name + ": bigger than " + MAX_MB + " MB"); continue; }
    let file = safeName_(name);
    if (type === DOC) file = file.replace(/\.docx$/i, "") + ".docx";
    const path = dest + "/" + file;
    if (found[path]) { notes.push("skipped " + name + ": another file has the same name in " + dest); continue; }
    found[path] = f;
  }
  const subs = folder.getFolders();
  while (subs.hasNext()) {
    const sub = subs.next();
    if (/^[.~]/.test(sub.getName())) continue;
    walkFolder_(sub, dest + "/" + safeName_(sub.getName()), found, notes);
  }
}

function safeName_(name) {
  return String(name).replace(/[\\/:*?"<>|#%\u0000-\u001f]+/g, "-").replace(/\s+/g, " ").trim() || "file";
}

function fileBytes_(f) {
  if (f.getMimeType() !== DOC) return f.getBlob().getBytes();
  const auth = { headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() }, muteHttpExceptions: true };
  // the same download as File → Download → Word in Docs; the Drive API export is the fallback
  let r = UrlFetchApp.fetch("https://docs.google.com/document/d/" + f.getId() + "/export?format=docx", auth);
  if (r.getResponseCode() !== 200) r = UrlFetchApp.fetch("https://www.googleapis.com/drive/v3/files/" + f.getId() + "/export?mimeType=" + encodeURIComponent(DOCX), auth);
  if (r.getResponseCode() !== 200) throw new Error("Could not export the Google Doc '" + f.getName() + "' (HTTP " + r.getResponseCode() + ")");
  return r.getBlob().getBytes();
}

/* ------------------------------------------------------------------ GitHub */

function commit_(blobs, removed, manifestText, message) {
  const ref = github_("GET", "/repos/" + REPO + "/git/ref/heads/" + BRANCH);
  const head = github_("GET", "/repos/" + REPO + "/git/commits/" + ref.object.sha);
  const tree = [];
  for (const b of blobs) {
    const made = github_("POST", "/repos/" + REPO + "/git/blobs", { content: Utilities.base64Encode(b.bytes), encoding: "base64" });
    tree.push({ path: b.path, mode: "100644", type: "blob", sha: made.sha });
  }
  if (removed.length) { // only paths still in the repo (one may have been deleted on github.com meanwhile)
    const have = {};
    for (const e of github_("GET", "/repos/" + REPO + "/git/trees/" + head.tree.sha + "?recursive=1").tree) have[e.path] = true;
    for (const p of removed) if (have[p]) tree.push({ path: p, mode: "100644", type: "blob", sha: null });
  }
  tree.push({ path: MANIFEST, mode: "100644", type: "blob", content: manifestText });
  const newTree = github_("POST", "/repos/" + REPO + "/git/trees", { base_tree: head.tree.sha, tree: tree });
  const c = github_("POST", "/repos/" + REPO + "/git/commits", { message: message, tree: newTree.sha, parents: [ref.object.sha] });
  github_("PATCH", "/repos/" + REPO + "/git/refs/heads/" + BRANCH, { sha: c.sha, force: false });
  return c.sha;
}

function readManifest_() {
  const r = github_("GET", "/repos/" + REPO + "/contents/" + MANIFEST + "?ref=" + BRANCH, null, true);
  if (!r) return { manifest: { files: {} }, sha: null };
  const text = Utilities.newBlob(Utilities.base64Decode(String(r.content).replace(/\s/g, ""))).getDataAsString("UTF-8");
  const m = JSON.parse(text);
  if (!m.files) m.files = {};
  return { manifest: m, sha: r.sha };
}

function github_(method, path, body, allow404) {
  const token = PropertiesService.getScriptProperties().getProperty("GITHUB_TOKEN");
  if (!token) throw new Error("No GITHUB_TOKEN: add it in Project Settings → Script Properties (see setup step 3).");
  const opt = {
    method: method, muteHttpExceptions: true, contentType: "application/json",
    headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
  };
  if (body) opt.payload = JSON.stringify(body);
  const r = UrlFetchApp.fetch("https://api.github.com" + path, opt), code = r.getResponseCode();
  if (code === 404 && allow404) return null;
  if (code < 200 || code >= 300) {
    let msg = r.getContentText();
    try { msg = JSON.parse(msg).message || msg; } catch (e) { /* not JSON */ }
    if (code === 401) msg += " (the GitHub token is wrong or has expired: make a new one, see setup step 1)";
    if (code === 403 || code === 404) msg += " (check that the token has Contents: Read and write for " + REPO + ")";
    throw new Error("GitHub " + method + " " + path.split("?")[0] + " → " + code + ": " + msg);
  }
  return code === 204 ? {} : JSON.parse(r.getContentText() || "{}");
}

// a fingerprint of a file's contents (to notice a real change)
function hash_(bytes) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_1, bytes).map((b) => ("0" + (b & 0xff).toString(16)).slice(-2)).join("");
}

function commitMessage_(added, updated, removed) {
  const name = (p) => p.replace(/^content\//, "");
  const parts = [];
  if (added.length) parts.push("add " + added.map(name).join(", "));
  if (updated.length) parts.push("update " + updated.map(name).join(", "));
  if (removed.length) parts.push("remove " + removed.map(name).join(", "));
  let msg = "Drive: " + parts.join("; ");
  if (msg.length > 200) msg = "Drive: " + (added.length + updated.length) + " file(s) sent, " + removed.length + " removed";
  return msg;
}

/* ------------------------------------------------------------------ Drive folders */

function rootFolder_(create) {
  const props = PropertiesService.getScriptProperties(), id = props.getProperty("ROOT_ID");
  if (id) {
    try { const f = DriveApp.getFolderById(id); if (!f.isTrashed()) return f; } catch (e) { /* deleted: look again */ }
  }
  const it = DriveApp.getRootFolder().getFoldersByName(ROOT_NAME);
  let root = it.hasNext() ? it.next() : null;
  if (!root) {
    const any = DriveApp.getFoldersByName(ROOT_NAME);   // anywhere in your Drive
    root = any.hasNext() ? any.next() : null;
  }
  if (!root) {
    if (!create) throw new Error("The folder '" + ROOT_NAME + "' is not in your Drive: run setup again.");
    root = DriveApp.getRootFolder().createFolder(ROOT_NAME);
  }
  props.setProperty("ROOT_ID", root.getId());
  return root;
}

function child_(parent, name, create) {
  const it = parent.getFoldersByName(name);
  if (it.hasNext()) return it.next();
  return create ? parent.createFolder(name) : null;
}

/* ------------------------------------------------------------------ reporting */

function log_(s) { console.log(s); }

// an email when a sync fails: once a day for the same problem
function report_(e) {
  const props = PropertiesService.getScriptProperties(), msg = String(e && e.message || e);
  const last = JSON.parse(props.getProperty("LAST_ERROR") || "{}"), now = Date.now();
  if (last.msg === msg && now - (last.at || 0) < 24 * 3600 * 1000) return;
  props.setProperty("LAST_ERROR", JSON.stringify({ msg: msg, at: now }));
  try {
    MailApp.sendEmail(Session.getEffectiveUser().getEmail(), "WildQuant publish: the Drive sync failed",
      "The sync from your Drive folder '" + ROOT_NAME + "' to GitHub failed:\n\n" + msg +
      "\n\nNothing was lost: it tries again every " + EVERY_MINUTES + " minutes. To look into it, open the project at https://script.google.com (Executions shows each run).");
  } catch (x) { console.error("could not send the email: " + x); }
}
