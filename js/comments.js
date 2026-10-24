/* =============================================================================
   comments.js — the feedback box and the Comments page               → WQ.comments
   -----------------------------------------------------------------------------
   GitHub Pages can't store anything itself, so comments live in a Google Sheet
   that you own. A tiny Google Apps Script (tools/comments-google-apps-script.gs)
   turns the sheet into a web address that this page can send comments to and
   read them from. Only you can delete a comment: delete its row in the sheet.

   SETUP (about 10 minutes, once): follow the steps at the top of
   tools/comments-google-apps-script.gs, then paste the web-app URL below.
   ============================================================================= */
(function (G) {
  "use strict";

  // ↓↓↓ paste the comment store's web-app URL here ↓↓↓
  // (from the Apps Script deployment; it looks like https://script.google.com/macros/s/…/exec.
  //  Not the Google Sheet's own link: the site can't use that one.)
  const SHEET_URL = "";
  // ↑↑↑

  const MAX = 2000;           // longest comment accepted (characters)
  const MIN_SECONDS = 3;      // spam guard: forms sent faster than this after page load are ignored
  const loadedAt = Date.now();

  const API = {
    configured: () => !!SHEET_URL,
    /* send one comment; resolves to {ok, msg} */
    async send(text, trap) {
      text = (text || "").trim().replace(/\s+\n/g, "\n");
      if (!text) return { ok: false, msg: "Write something first." };
      if (text.length > MAX) return { ok: false, msg: `Please keep it under ${MAX} characters.` };
      if (trap || (Date.now() - loadedAt) / 1000 < MIN_SECONDS) return { ok: true, msg: "Thank you!" }; // bots: pretend it worked
      if (!SHEET_URL) return { ok: false, msg: "Comments aren't connected yet. Please check back soon." };
      try {
        // text/plain avoids a CORS preflight; the script reads the JSON body
        const r = await fetch(SHEET_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ comment: text }) });
        const j = await r.json().catch(() => ({ ok: r.ok }));
        return j.ok ? { ok: true, msg: "Thank you! Your comment is on the Comments page." } : { ok: false, msg: j.error || "Couldn't send it. Please try again." };
      } catch (e) {
        return { ok: false, msg: "Couldn't reach the comment store. Please try again later." };
      }
    },
    /* newest first: [{time: ISO string, comment: text}] */
    async list() {
      if (!SHEET_URL) return { ok: false, items: [], msg: "Comments aren't connected yet." };
      try {
        const r = await fetch(SHEET_URL + (SHEET_URL.includes("?") ? "&" : "?") + "list=1", { cache: "no-store" });
        const j = await r.json();
        return { ok: true, items: Array.isArray(j.comments) ? j.comments : [] };
      } catch (e) {
        return { ok: false, items: [], msg: "Couldn't load the comments right now." };
      }
    },
    /* render a list into an <ol> (text is inserted as text, never as HTML) */
    render(ol, items) {
      ol.textContent = "";
      const fmt = (iso) => { const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }); };
      for (const it of items) {
        const li = document.createElement("li"), p = document.createElement("p"), m = document.createElement("p");
        p.className = "comment__text"; p.textContent = String(it.comment || "");
        m.className = "comment__meta"; m.textContent = fmt(it.time);
        li.append(p, m); ol.append(li);
      }
    },
  };

  /* wire up the feedback form on the home page */
  function initForm() {
    const form = document.getElementById("comment-form");
    if (!form) return;
    const box = form.querySelector("textarea"), status = form.querySelector(".comment-form__status"), btn = form.querySelector("button[type=submit]");
    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      btn.disabled = true; status.textContent = "Sending…";
      const res = await API.send(box.value, form.website && form.website.value);
      status.textContent = res.msg;
      if (res.ok) box.value = "";
      btn.disabled = false;
    });
  }
  /* fill the Comments page */
  async function initList() {
    const ol = document.getElementById("comments");
    if (!ol) return;
    const note = document.getElementById("comments-note");
    const res = await API.list();
    API.render(ol, res.items);
    if (note) note.textContent = res.items.length ? "" : (res.msg || "No comments yet. Be the first to write one.");
  }

  G.WQ = G.WQ || {};
  G.WQ.comments = API;
  document.addEventListener("DOMContentLoaded", () => { initForm(); initList(); });
})(window);
