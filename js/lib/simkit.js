/* =============================================================================
   simkit.js — shared helpers for the simulation pages (WQ.Sim)
   -----------------------------------------------------------------------------
   Pure helpers (they also load in node for the tests):
     fmt, fmtSig, signed, pad, finite      numbers for the boxes (never "NaN")
     esc, subs                             HTML-safe text, X_t → X<sub>t</sub>
     check(name, ok, detail)               runtime checks, only with ?check=1
   Page helpers (they touch the page only when called):
     term(el, lines) + hi / dim / warn / why   the green "terminal" boxes
     slider(id, { fmt, log, onInput })     a range slider with its <output> readout
     seg(groupEl, onChange)                a segmented switch (.sim-seg)
     presets(el, list, apply)              preset buttons (.sim-presets)
     loop(render), throttle, debounce      one redraw per animation frame
     reduced                               the visitor prefers reduced motion
   HOW TO EDIT: CHECK_QUIET (ms between repeated "[check] ok" lines for one name).
   ============================================================================= */
(function (G) {
  "use strict";
  const CHECK_QUIET = 1000;
  const hasDoc = typeof document !== "undefined";
  const qs = typeof location !== "undefined" && location.search ? new URLSearchParams(location.search) : null;

  /* ------------------------------------------------ runtime checks */
  const checking = !!(qs && qs.get("check") === "1");
  const lastOk = Object.create(null);
  const checks = { ok: 0, fail: 0 };
  function check(name, ok, detail) {
    if (!checking) return;
    if (ok) {
      checks.ok++;
      const now = Date.now();
      if (!(lastOk[name] > now - CHECK_QUIET)) { lastOk[name] = now; console.log("[check] ok " + name); }
    } else {
      checks.fail++;
      console.error("[check] FAIL " + name + ": " + (detail == null ? "" : detail));
    }
  }

  /* ------------------------------------------------ numbers */
  const MINUS = "−";
  function special(v) {
    if (typeof v !== "number" || Number.isNaN(v)) return "—";
    if (v === Infinity) return "∞";
    if (v === -Infinity) return MINUS + "∞";
    return null;
  }
  function fmt(v, d = 3) {
    const s = special(v); if (s) return s;
    const t = Math.abs(v).toFixed(d);
    return (v < 0 && Number(t) !== 0 ? MINUS : "") + t;
  }
  function fmtSig(v, n = 4) {
    const s = special(v); if (s) return s;
    if (v === 0) return "0";
    const a = Math.abs(v), sign = v < 0 ? MINUS : "";
    if (a < 1e-3 || a >= 1e6) {
      const [m, e] = a.toExponential(Math.max(0, n - 2)).split("e");
      return sign + m + "e" + (e[0] === "-" ? MINUS + e.slice(1) : e.replace("+", ""));
    }
    return sign + String(Number(a.toPrecision(n)));
  }
  function signed(v, d = 3) {
    const s = special(v); if (s) return s === "∞" ? "+∞" : s;
    const t = Math.abs(v).toFixed(d);
    return (v < 0 && Number(t) !== 0 ? MINUS : "+") + t;
  }
  const pad = (s, n) => { s = String(s); return s.length >= n ? s : s + " ".repeat(n - s.length); };
  const finite = (...xs) => xs.every((x) => typeof x === "number" && Number.isFinite(x));

  /* ------------------------------------------------ text */
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const subs = (s) => String(s).replace(/([A-Za-zα-ωΑ-Ω])_([A-Za-z0-9]+)/g, "$1<sub>$2</sub>");
  const seg = (t, c) => ({ t, c });
  const hi = (t) => seg(t, "hi"), dim = (t) => seg(t, "dim"), warn = (t) => seg(t, "warn"), why = (t) => seg("  · " + t, "why");
  const CURSOR = '<span class="term__cursor" aria-hidden="true"></span>';
  function piece(p) {
    if (p == null) return "";
    if (typeof p === "string") return subs(esc(p));
    const html = subs(esc(p.t));
    return p.c ? `<span class="term__${p.c}">${html}</span>` : html;
  }
  function termHTML(lines) {
    return lines.filter((l) => l != null).map((l) => (Array.isArray(l) ? l.map(piece).join("") : piece(l))).join("\n") + CURSOR;
  }
  function term(el, lines) { if (el) el.innerHTML = termHTML(lines); }

  /* ------------------------------------------------ controls */
  function slider(id, { fmt: f = (v) => String(v), log = false, onInput } = {}) {
    const el = document.getElementById(id), out = document.getElementById(id + "-out");
    const lo = () => Number(el.min), hiV = () => Number(el.max);
    const get = () => (log ? Math.pow(10, Number(el.value)) : Number(el.value));
    const show = () => { const v = get(), t = f(v); if (out) out.textContent = t; el.setAttribute("aria-valuetext", t); };
    const api = {
      el, get,
      set(v, { silent = false } = {}) {
        let x = log ? Math.log10(v) : v;
        if (!Number.isFinite(x)) x = lo();
        el.value = String(Math.min(hiV(), Math.max(lo(), x)));
        show();
        if (!silent && onInput) onInput(get());
      },
      refresh: show,
    };
    el.addEventListener("input", () => { show(); if (onInput) onInput(get()); });
    show();
    return api;
  }
  function segCtl(groupEl, onChange) {
    const buttons = [...groupEl.querySelectorAll("button")];
    const first = buttons.find((b) => b.getAttribute("aria-pressed") === "true") || buttons[0];
    let value = first ? first.dataset.value : undefined;
    const mark = () => buttons.forEach((b) => b.setAttribute("aria-pressed", b.dataset.value === value ? "true" : "false"));
    buttons.forEach((b) => b.addEventListener("click", () => { if (b.dataset.value === value) return; value = b.dataset.value; mark(); if (onChange) onChange(value); }));
    mark();
    return { get: () => value, set(v, { silent = false } = {}) { value = String(v); mark(); if (!silent && onChange) onChange(value); } };
  }
  function presets(el, list, apply) {
    el.innerHTML = "";
    el.setAttribute("role", "group");
    if (!el.getAttribute("aria-label")) el.setAttribute("aria-label", "Presets");
    const lab = document.createElement("span"); lab.className = "sim-presets__label"; lab.textContent = "Presets"; el.appendChild(lab);
    list.forEach((p) => {
      const b = document.createElement("button"); b.type = "button"; b.textContent = p.label;
      b.addEventListener("click", () => apply(p.values, p));
      el.appendChild(b);
    });
  }

  /* ------------------------------------------------ scheduling */
  function loop(render) {
    const dirty = new Set(); let raf = 0;
    const run = () => { raf = 0; const d = new Set(dirty); dirty.clear(); render(d); };
    const schedule = () => { if (!raf) raf = G.requestAnimationFrame ? G.requestAnimationFrame(run) : setTimeout(run, 16); };
    return { want(...names) { names.forEach((n) => dirty.add(n)); schedule(); }, schedule };
  }
  function throttle(fn, ms = 150) {
    let last = 0, timer = 0, args = null;
    return function (...a) {
      args = a; const now = Date.now(), wait = ms - (now - last);
      if (wait <= 0) { last = now; fn(...args); }
      else if (!timer) timer = setTimeout(() => { timer = 0; last = Date.now(); fn(...args); }, wait);
    };
  }
  function debounce(fn, ms = 200) {
    let timer = 0;
    return function (...a) { clearTimeout(timer); timer = setTimeout(() => fn(...a), ms); };
  }
  const reduced = !!(hasDoc && G.matchMedia && G.matchMedia("(prefers-reduced-motion: reduce)").matches);

  (G.WQ = G.WQ || {}).Sim = {
    checking, check, checks,
    fmt, fmtSig, signed, pad, finite, esc, subs,
    term, termHTML, hi, dim, warn, why,
    slider, seg: segCtl, presets, loop, throttle, debounce, reduced,
  };
})(typeof window !== "undefined" ? window : globalThis);
