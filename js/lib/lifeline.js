/* =============================================================================
   lifeline.js — "My time series" on the About page                    (about/)
   -----------------------------------------------------------------------------
   A life as chalk lines on a small blackboard of its own: the main line
   (school, university, work) bold in the middle, side lines for everything
   else above and below it, and short branches that rise from the years and
   merge in. The years roll past at a fixed speed: school is quick, the
   crowded ResQ year is drawn wide so every name has room.
   • Each line's box rides at the pen while the line runs, then waits where
     the line ended and drifts away with the years. Lines never cross: each
     keeps its row, and short branches take a free one.
   • A side line presses harder (brighter) while it was the priority.
   • Hold to stop; drag to move; let go and it rolls on from there.
     Tap a name: its card opens and the roll waits; tap anywhere else and it
     goes on. Arrow keys move it too.
   • At today every line still going curves into the main line, a dashed
     arrow points on (→ ?), the board is wiped and it starts again.
   • Reduced motion: the whole map up to today, still; slide it by hand.
   Data: about/life.js (window.WQ_LIFE). The page provides the elements (#ll…).
   HOW TO EDIT: the story in about/life.js; sizes and speed in layout().
   ============================================================================= */
(function (G) {
  "use strict";
  const DATA = G.WQ_LIFE, $ = (id) => document.getElementById(id);
  const sec = $("lifeline"), frame = $("llFrame"), cvB = $("llBoard"), cv = $("llInk");
  if (!DATA || !frame || !cv) return;

  /* ---------------------------------------------------------------- helpers */
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, u) => a + (b - a) * u;
  const smooth = (u) => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
  const smoother = (u) => { u = clamp(u, 0, 1); return u * u * u * (u * (u * 6 - 15) + 10); };
  const ink = (a) => "rgba(246,244,236," + (a <= 0 ? 0 : a >= 1 ? 1 : a.toFixed(3)) + ")";
  const BOARD = "#0d0f0f", INK = "rgb(246,244,236)";
  const SANS = '"WQ Sans", Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  const SERIF = '"WQ Serif", "Latin Modern Roman", Georgia, serif';
  const DASH = [7, 1.4, 3, 1.1, 12, 1.8], DASH_LEN = 26.3;
  function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const parts = (d) => { const [y, m, day] = String(d).split("-").map(Number); return { y, m, day }; };
  // a date as a fractional year. A month without a day gets one of its four weeks, a bare year one
  // of its months and weeks; the key fixes which, so it is the same on every visit
  function yearOf(d, key) {
    const { y, m, day } = parts(d), r = hash(key + "|" + d);
    if (!m) return y + ((r % 12) + ((r >>> 5) % 4) * 0.25 + 0.12) / 12;
    return y + (m - 1) / 12 + ((day || (r % 4) * 7 + 4) - 0.5) / 365.25;
  }
  const photoYear = (d) => { const { y, m } = parts(d); return m ? y + (m - 0.5) / 12 : y + 0.5; };
  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  // how strongly a line was the priority at time t (0…1)
  function prio(spec, id) {
    if (spec === "flicker") { const r = rng(hash(id)), a = r() * 6.3, b = r() * 6.3; return (t) => 0.55 + 0.25 * (0.6 * Math.sin(t * 2.4 + a) + 0.4 * Math.sin(t * 5.7 + b)); }
    if (!spec || !spec.length) return () => 0.6;
    const k = spec.map(([d, p]) => [yearOf(String(d).length === 7 ? d + "-15" : d, id), p]);
    return (t) => {
      if (t <= k[0][0]) return k[0][1];
      for (let i = 1; i < k.length; i++) if (t < k[i][0]) return lerp(k[i - 1][1], k[i][1], smooth((t - k[i - 1][0]) / (k[i][0] - k[i - 1][0])));
      return k[k.length - 1][1];
    };
  }

  /* ---------------------------------------------------------------- the story, ready to draw */
  const today = new Date();
  const T_NOW = DATA.now ? yearOf(DATA.now, "now") : today.getFullYear() + (today - new Date(today.getFullYear(), 0, 1)) / 864e5 / 365.25;
  const NOW_LABEL = DATA.nowLabel || "Now";
  const MAINS = DATA.main.map((m) => ({ ...m, kind: "main", row: 0, title: m.title || m.box, t0: yearOf(m.from, m.id), t1: m.to ? yearOf(m.to, m.id + "/end") : null }))
    .filter((m) => m.t0 <= T_NOW);
  const SIDES = (DATA.lines || []).map((l) => ({
    ...l, kind: "line", title: l.title || l.box, start: l.start || "scale", end: l.to ? l.end || "burst" : "now",
    t0: yearOf(l.from, l.id), t1: l.to ? yearOf(l.to, l.id + "/end") : null, p: prio(l.priority, l.id),
  })).filter((l) => l.t0 <= T_NOW);
  const MARKS = [];
  for (const l of SIDES) for (const m of l.marks || []) { const t0 = yearOf(m.from, m.id); if (t0 <= T_NOW) MARKS.push({ ...m, kind: "mark", line: l, title: m.title || m.box, t0, t1: yearOf(m.to || m.from, m.id + "/end") }); }
  for (const l of SIDES) l.markList = MARKS.filter((m) => m.line === l);
  const BRS = [];
  for (const g of DATA.branches || []) for (const b of g.items || []) {
    const id = slug(b.box), t0 = yearOf(b.from, id);
    if (t0 <= T_NOW) BRS.push({ what: g.what, rows: g.rows || [-1, -2, 1, 2], into: g.into || null, ...b, id, kind: "branch", title: b.title || b.box, t0, runY: (b.run || 0.9) / 12 });
  }
  const ITEMS = [...MAINS, ...SIDES, ...BRS];
  const BY = Object.fromEntries([...ITEMS, ...MARKS].map((i) => [i.id, i]));
  const LAST = MAINS[MAINS.length - 1];
  const T0 = MAINS[0].t0;                                      // the first school day: where the years begin
  const DRAW_ORDER = [...BRS, ...SIDES];

  /* ---------------------------------------------------------------- time ↔ position
     s = pixels along the whole line. A year is BASE × pace pixels wide, so quick years are narrow. */
  const ERAS = (DATA.pace || [[DATA.main[0].from, 1]]).map(([d, p]) => ({ t: yearOf(String(d).length === 4 ? d + "-01-01" : d + "-01", "pace"), p }));
  const TW = 0.22;                                             // a change of pace eases in over about 11 weeks
  function pace(t) { let p = ERAS[0].p; for (let i = 1; i < ERAS.length; i++) p += (ERAS[i].p - ERAS[i - 1].p) * smooth((t - ERAS[i].t + TW / 2) / TW); return p; }
  let S = null, DT = 0, T1 = 0, BASE = 200;
  function buildTable() {
    T1 = T_NOW + 0.8;
    const n = Math.ceil((T1 - T0) * 365) + 1;
    DT = (T1 - T0) / (n - 1); S = new Float64Array(n);
    let prev = pace(T0);
    for (let i = 1; i < n; i++) { const p = pace(T0 + i * DT); S[i] = S[i - 1] + BASE * DT * (prev + p) / 2; prev = p; }
  }
  function sAt(t) {
    const u = (t - T0) / DT;
    if (u <= 0) return u * DT * BASE * pace(T0);
    const i = Math.min(S.length - 2, Math.floor(u));
    return S[i] + (S[i + 1] - S[i]) * (u - i);
  }
  function tAt(s) {
    if (s <= 0) return T0 + s / (BASE * pace(T0));
    let lo = 0, hi = S.length - 1;
    if (s >= S[hi]) return T1 + (s - S[hi]) / (BASE * pace(T1));
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (S[m] <= s) lo = m; else hi = m; }
    return T0 + (lo + (s - S[lo]) / (S[hi] - S[lo])) * DT;
  }

  /* ---------------------------------------------------------------- layout */
  const ctx = cv.getContext("2d"), bctx = cvB.getContext("2d");
  let W = 0, H = 0, DPR = 1, PHONE = false, LS = 26, BOXH = 18, BOXH_MAIN = 22, MARKH = 14, PADX = 6, PADX_MAIN = 8, ROW4Y = 31, MARKY = 11, YB = 260;
  let PENX = 600, SPEED = 80, ENDLEN = 120, RISE = 46, CLK = 1, W_MAIN = 3.8, W_SIDE = 1.7, W_BR = 1.4;
  let F = {}, NOW_LABEL_W = 100, sNow = 0, sEnd = 0;
  const rowY = (k) => ROW4Y + (4 - k) * LS;
  const CL = (d) => Math.round((24 + 10 * Math.abs(d)) * CLK);     // length of a curve that crosses d rows
  let view = 0, pen = 0, vs0 = 0, vs1 = 0, boxes = [];
  const X = (s) => PENX + (s - view);
  const sOfX = (x) => view + (x - PENX);

  function layout() {
    const keepT = S ? tAt(view) : null, wasEnd = S && view >= sEnd - 0.5;
    W = Math.max(260, Math.round(frame.clientWidth)); PHONE = W < 600;
    LS = PHONE ? 22 : 26; BOXH = PHONE ? 16 : 18; BOXH_MAIN = PHONE ? 19 : 22; MARKH = PHONE ? 13 : 14;
    PADX = PHONE ? 5 : 6; PADX_MAIN = PHONE ? 6 : 8;
    ROW4Y = PHONE ? 27 : 31;
    MARKY = ROW4Y - BOXH / 2 - 4 - MARKH / 2;
    YB = rowY(-4) + BOXH / 2 + (PHONE ? 13 : 15);
    H = YB + (PHONE ? 27 : 31);
    PENX = Math.round(W * 0.78);
    BASE = PHONE ? 150 : 200;
    SPEED = BASE / 2.4;                                            // a normal year takes 2.4 s
    ENDLEN = clamp(Math.round(W * 0.16), 56, 140);
    CLK = PHONE ? 0.85 : 1; RISE = Math.round(46 * CLK);
    W_MAIN = PHONE ? 3.2 : 3.8; W_SIDE = PHONE ? 1.5 : 1.7; W_BR = PHONE ? 1.25 : 1.4;
    F = {
      box: `500 ${PHONE ? 11 : 12}px ${SANS}`, main: `600 ${PHONE ? 12.5 : 14}px ${SANS}`, mark: `500 ${PHONE ? 10 : 10.5}px ${SANS}`,
      year: `400 ${PHONE ? 11.5 : 12.5}px ${SERIF}`, yearB: `700 ${PHONE ? 12 : 13}px ${SERIF}`,
      now: `italic 400 ${PHONE ? 11.5 : 12.5}px ${SERIF}`, q: `400 ${PHONE ? 17 : 19}px ${SERIF}`,
    };
    frame.style.height = H + "px";
    DPR = Math.min(2, G.devicePixelRatio || 1);
    for (const c of [cv, cvB]) { c.width = Math.round(W * DPR); c.height = Math.round(H * DPR); }
    buildTable();
    sNow = sAt(T_NOW); sEnd = sNow + ENDLEN;
    geometry(); allocate(); paintBoard();
    if (keepT != null) view = wasEnd ? sEnd : sAt(keepT);
    view = clamp(view, 0, maxView()); pen = RM ? sNow : view;
  }

  function geometry() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (const it of [...ITEMS, ...MARKS]) {
      const main = it.kind === "main";
      ctx.font = main ? F.main : it.kind === "mark" ? F.mark : F.box;
      it.w = Math.ceil(ctx.measureText(it.box).width) + 2 * (main ? PADX_MAIN : PADX);
    }
    ctx.font = F.main; NOW_LABEL_W = Math.ceil(ctx.measureText(NOW_LABEL).width) + 2 * PADX_MAIN;
    for (const m of MAINS) { m.sA = sAt(m.t0); m.sZ = m.t1 == null ? null : sAt(m.t1); m.cIn = m === MAINS[0] ? RISE : 0; }
    for (const l of SIDES) {
      l.sA = sAt(l.t0); l.sZ = l.t1 == null ? null : sAt(l.t1);
      l.cIn = l.start === "main" ? CL(l.row) : 0; l.tRow = 0;
      if (l.end === "merge") { l.cOut = CL(l.row); l.stop = l.sZ - l.cOut; }
      else if (l.end === "burst") { l.cOut = 0; l.stop = l.sZ; }
      else { l.cOut = 0; l.stop = sNow; }
    }
    for (const m of MARKS) { m.sA = sAt(m.t0); m.sZ = sAt(m.t1); }
  }

  // each short branch gets the nearest free row and never crosses a line on its way in. First choice:
  // a row that is quite empty; second: a row where only older boxes still rest (they fade as the new one
  // arrives). If neither exists, the branch waits a week, then another (at most five).
  function allocate() {
    const GAP = 10, occ = new Map();                         // per row: [from, to, "line" | "box"]
    const add = (row, a, b, kind) => { if (!occ.has(row)) occ.set(row, []); occ.get(row).push([a, b, kind]); };
    const free = (row, a, b, linesOnly) => !(occ.get(row) || []).some(([x, y, k]) => x < b && a < y && (!linesOnly || k === "line"));
    for (const l of SIDES) {
      const lineEnd = l.end === "now" ? Infinity : l.end === "merge" ? l.stop + l.cOut / 2 : l.sZ;
      add(l.row, l.sA, lineEnd + GAP, "line");
      add(l.row, l.sA - l.w - GAP, l.end === "now" ? Infinity : l.stop + GAP, "box");
    }
    for (const b of [...BRS].sort((p, q) => p.t0 - q.t0)) {
      const target = b.into ? BY[b.into] : null, tRow = target ? target.row : 0;
      const fits = (t0, row, relaxed) => {
        const cOut = CL(row - tRow), sA = sAt(t0), stop = sAt(t0 + b.runY), sZ = stop + cOut;
        if (!free(row, relaxed ? sA - 4 : sA - b.w - GAP, stop + cOut / 2 + GAP, relaxed)) return null;
        for (let r = Math.min(row, tRow) + 1; r < Math.max(row, tRow); r++) if (!free(r, stop - 2, sZ + 2, relaxed)) return null;
        if (target && !(sZ > target.sA + 8 && sZ < target.stop - 4)) return null;   // it must land while that line runs
        return { row, tRow, sA, stop, sZ, cOut, cIn: 0 };
      };
      let got = null;
      for (let k = 0; k <= 5 && !got; k++) for (const relaxed of [false, true]) {
        for (const row of b.rows) if ((got = fits(b.t0 + (k * 7) / 365.25, row, relaxed))) break;
        if (got) break;
      }
      if (!got) {
        const row = b.rows[0], cOut = CL(row - tRow), sA = sAt(b.t0), stop = sAt(b.t0 + b.runY);
        got = { row, tRow, sA, stop, sZ: stop + cOut, cOut, cIn: 0 };
        console.warn("My time series: no free row for", b.box);
      }
      Object.assign(b, got);
      add(b.row, b.sA, b.stop + b.cOut / 2 + GAP, "line");
      add(b.row, b.sA - b.w - GAP, b.stop + GAP, "box");
    }
  }

  /* ---------------------------------------------------------------- the board and the chalk */
  // behind the ink: board colour, faint smudges and eraser sweeps, chalk dust, a soft vignette
  function paintBoard() {
    const c = bctx, r = rng(21);
    c.setTransform(DPR, 0, 0, DPR, 0, 0);
    c.fillStyle = BOARD; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 16; i++) {
      const x = r() * W, y = r() * H, rr = 40 + r() * 200, a = 0.008 + r() * 0.014, g = c.createRadialGradient(x, y, 0, x, y, rr);
      g.addColorStop(0, ink(a)); g.addColorStop(1, ink(0)); c.fillStyle = g; c.fillRect(x - rr, y - rr, 2 * rr, 2 * rr);
    }
    for (let i = 0; i < 4; i++) {
      const y = r() * H, h = 26 + r() * 50, g = c.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, ink(0)); g.addColorStop(0.5, ink(0.008 + r() * 0.01)); g.addColorStop(1, ink(0)); c.fillStyle = g; c.fillRect(0, y, W, h);
    }
    const specks = Math.round(W * H * 0.01);
    for (let k = 0; k < 5; k++) { c.fillStyle = ink(0.02 + 0.012 * k); c.beginPath(); for (let i = 0; i < specks / 5; i++) c.rect(r() * W, r() * H, 1, 1); c.fill(); }
    const v = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.hypot(W, H) * 0.62);
    v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,0.38)"); c.fillStyle = v; c.fillRect(0, 0, W, H);
  }
  // chalk grain, punched out of the strokes and fixed to the timeline so it travels with them
  const grainCv = document.createElement("canvas");
  (() => { grainCv.width = grainCv.height = 96; const g = grainCv.getContext("2d"), r = rng(42), d = g.createImageData(96, 96);
    for (let i = 0; i < 96 * 96; i++) { const v = r(); d.data[4 * i + 3] = v < 0.18 ? 210 : v < 0.4 ? 90 : 0; } g.putImageData(d, 0, 0); })();
  let grainPat = null;
  function grain() {
    if (!grainPat) grainPat = ctx.createPattern(grainCv, "repeat");
    if (grainPat.setTransform && G.DOMMatrix) grainPat.setTransform(new DOMMatrix([1, 0, 0, 1, -(((view % 96) + 96) % 96), 0]));
    ctx.save(); ctx.globalCompositeOperation = "destination-out"; ctx.globalAlpha = 0.5;
    ctx.fillStyle = grainPat; ctx.fillRect(0, 0, W, H); ctx.restore();
  }
  // rough textures for the mountain lines and the swimming wave (fixed to the timeline)
  const KN = {};
  function knotsFor(name) { if (KN[name]) return KN[name]; const r = rng(hash(name)), A = new Float32Array(4096); for (let i = 0; i < A.length; i++) A[i] = (i % 2 ? 1 : -1) * (0.3 + 0.7 * r()); return (KN[name] = A); }
  function tex(style, s) {
    if (style === "wave") return 1.7 * Math.sin(s / 8);
    const climb = style === "climb", P = climb ? 9 : 15, A = climb ? 3.4 : 2.2, K = knotsFor(style);
    const u = s / P, i = Math.floor(u), f = u - i, n = K.length, a = K[((i % n) + n) % n], b = K[(((i + 1) % n) + n) % n];
    return A * lerp(a, b, climb ? f : (1 - Math.cos(f * Math.PI)) / 2);
  }
  // height of a side line or branch at position s
  function yOf(it, s) {
    const yr = rowY(it.row); let y = yr, k = 1;
    if (it.cIn && s < it.sA + it.cIn) { const u = smoother((s - it.sA) / it.cIn); y = lerp(rowY(0), yr, u); k = u; }
    if (it.cOut && s > it.stop) { const u = smoother((s - it.stop) / it.cOut); y = lerp(y, rowY(it.tRow), u); k = Math.min(k, 1 - u); }
    else if (it.end === "now" && s > sNow) { const u = smoother((s - sNow) / ENDLEN); y = lerp(y, rowY(0), u); k = Math.min(k, 1 - u); }
    if (it.style) y += k * tex(it.style, s);
    return y;
  }
  const yMain = (s) => (s < RISE ? lerp(YB - 1, rowY(0), smoother(s / RISE)) : rowY(0));
  const endOf = (it) => (it.kind === "branch" || it.end === "burst" || it.end === "merge" ? it.sZ : RM ? sNow : sEnd);
  function pathOf(pts) { const p = new Path2D(); p.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]); return p; }

  // a chalk stroke whose pressure (priority) can change along its length
  function strokeChalk(pts, w, pAt, phase, allowTop) {
    if (pts.length < 2) return;
    const path = pathOf(pts), x0 = pts[0][0], x1 = Math.max(pts[pts.length - 1][0], x0 + 1);
    const paint = (f) => {
      if (typeof pAt === "number") return ink(f(pAt));
      const g = ctx.createLinearGradient(x0, 0, x1, 0), n = clamp(Math.ceil((x1 - x0) / 22), 1, 48);
      for (let i = 0; i <= n; i++) g.addColorStop(i / n, ink(f(pAt(x0 + ((x1 - x0) * i) / n))));
      return g;
    };
    ctx.lineJoin = ctx.lineCap = "round";
    ctx.strokeStyle = paint((p) => 0.2 * (0.3 + 0.7 * p)); ctx.lineWidth = w * 2.3; ctx.stroke(path);
    if (allowTop) { ctx.strokeStyle = paint((p) => 0.5 * clamp((p - 0.8) / 0.15, 0, 1)); ctx.lineWidth = w + 0.8; ctx.stroke(path); }
    ctx.setLineDash(DASH); ctx.lineDashOffset = ((phase % DASH_LEN) + DASH_LEN) % DASH_LEN;
    ctx.strokeStyle = paint((p) => 0.9 * (0.3 + 0.7 * p)); ctx.lineWidth = w; ctx.stroke(path);
    ctx.setLineDash([]);
  }

  function drawLine(it) {
    if (pen < it.sA) return;
    const a = Math.max(it.sA, vs0), b = Math.min(endOf(it), pen, vs1);
    if (b - a < 0.5) return;
    const pts = [];
    for (let s = a; s < b; s += 3) pts.push([X(s), yOf(it, s)]);
    pts.push([X(b), yOf(it, b)]);
    const branch = it.kind === "branch";
    strokeChalk(pts, branch ? W_BR : W_SIDE, branch ? 0.62 : (x) => it.p(tAt(sOfX(x))), a, !branch);
    // benchmarks: the stretch of a course is pressed harder, with a short pole up to its label
    for (const m of it.markList || []) {
      if (pen < m.sA) continue;
      const s0 = Math.max(m.sA, a), s1 = Math.min(m.sZ, b);
      if (s1 > s0) {
        const q = []; for (let s = s0; s < s1; s += 3) q.push([X(s), yOf(it, s)]); q.push([X(s1), yOf(it, s1)]);
        ctx.strokeStyle = ink(0.92); ctx.lineWidth = W_SIDE + 1.2; ctx.lineCap = "round"; ctx.stroke(pathOf(q));
      }
      const x = X(m.sA);
      if (x > -4 && x < W + 4) { ctx.strokeStyle = ink(0.6); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, yOf(it, m.sA) - 3); ctx.lineTo(x, MARKY + MARKH / 2 + 1); ctx.stroke(); }
    }
  }

  function drawMain() {
    const a = Math.max(0, vs0), b = Math.min(pen, vs1);
    if (b - a < 0.5) return;
    const seg = (s0, s1) => { const p = []; for (let s = s0; s < s1; s += 4) p.push([X(s), yMain(s)]); p.push([X(s1), yMain(s1)]); return p; };
    const stroke = (pts, w, al) => { const path = pathOf(pts); ctx.lineJoin = ctx.lineCap = "round"; ctx.strokeStyle = ink(0.15 * al); ctx.lineWidth = w * 3; ctx.stroke(path); ctx.strokeStyle = ink(al); ctx.lineWidth = w; ctx.stroke(path); };
    stroke(seg(a, b), W_MAIN * 0.5, 0.5);                       // the line itself, between stops too
    for (const m of MAINS) { const s0 = Math.max(a, m.sA), s1 = Math.min(b, m.sZ == null ? Infinity : m.sZ); if (s1 - s0 > 0.5) stroke(seg(s0, s1), W_MAIN, 0.96); }
  }
  // a slow glint runs along the main line now and then
  function drawShine(now) {
    if (RM) return;
    const g = (now % 6500) / 1600; if (g > 1) return;
    const xL = Math.max(0, X(RISE)), xR = Math.min(W, X(Math.min(pen, vs1)));
    if (xR - xL < 30) return;
    const gx = lerp(xL - 30, xR + 30, smooth(g)), y = rowY(0), x0 = Math.max(xL, gx - 34), x1 = Math.min(xR, gx + 34);
    if (x1 <= x0) return;
    const gr = ctx.createLinearGradient(gx - 34, 0, gx + 34, 0);
    gr.addColorStop(0, ink(0)); gr.addColorStop(0.5, ink(0.75)); gr.addColorStop(1, ink(0));
    ctx.strokeStyle = gr; ctx.lineWidth = W_MAIN + 1.6; ctx.lineCap = "butt";
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
  }

  // the years: long marks for months, short ones for weeks (only where there is room), a number per year
  function drawScale(labels) {
    const sL = Math.max(0, vs0), sR = Math.min(sNow, vs1);
    if (sR <= sL) return;
    const tL = tAt(sL), tR = tAt(sR), curY = Math.floor(Math.min(T_NOW, tAt(RM ? view : pen)));
    const dim = (x) => (!RM && x > PENX + 1 ? 0.5 : 1);
    if (!labels) {
      ctx.lineWidth = 1; ctx.strokeStyle = ink(0.26);
      ctx.beginPath(); ctx.moveTo(X(sL), YB + 0.5); ctx.lineTo(X(sR), YB + 0.5); ctx.stroke();
      const buckets = new Map();
      const tick = (x, h, a) => { const k = a.toFixed(2); if (!buckets.has(k)) buckets.set(k, new Path2D()); const p = buckets.get(k); p.moveTo(x, YB + 0.5); p.lineTo(x, YB + 0.5 + h); };
      for (let y = Math.floor(tL); y <= tR; y++) for (let m = 0; m < 12; m++) {
        const t = y + m / 12; if (t > tR) break; if (t < tL - 1 / 12) continue;
        const cur = y === curY ? 1.7 : 1, perYear = BASE * pace(t);
        if (t >= T0 - 1e-6 && (m === 0 || perYear / 12 >= 4)) { const x = X(sAt(t)); if (x > -4 && x < W + 4) tick(x, m === 0 ? 9 : 5, Math.min(0.85, (m === 0 ? 0.5 : 0.3) * cur * dim(x))); }
        if (perYear / 52.18 >= 2.6) for (let k = 1; k <= 4; k++) {
          const tw = t + (k * 7) / 365.25; if (tw >= t + 1 / 12 - 0.006 || tw < T0 || tw > tR) continue;
          const x = X(sAt(tw)); if (x > -4 && x < W + 4) tick(x, 2.5, Math.min(0.6, 0.17 * cur * dim(x)));
        }
      }
      ctx.lineWidth = 1; for (const [a, p] of buckets) { ctx.strokeStyle = ink(+a); ctx.stroke(p); }
      const xn = X(sNow);                                       // today stands a little taller
      if (xn > -4 && xn < W + 4) { ctx.strokeStyle = ink(0.6); ctx.beginPath(); ctx.moveTo(xn, YB - 6); ctx.lineTo(xn, YB + 10); ctx.stroke(); }
      return;
    }
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const ly = YB + 21;
    const label = (x, y) => { const cur = y === curY; ctx.font = cur ? F.yearB : F.year; ctx.fillStyle = ink((cur ? 0.88 : 0.4) * dim(x)); ctx.fillText(String(y), x, ly); };
    if (T0 > Math.floor(T0) && tL <= T0 + 0.02) { const x = X(0); if (x > -30 && x < W + 30) label(x, Math.floor(T0)); }
    for (let y = Math.ceil(tL); y <= tR; y++) { if (y < T0) continue; const x = X(sAt(y)); if (x > -30 && x < W + 30) label(x, y); }
    // when a year began off to the left, its number waits at the left edge
    const tEdge = tAt(sOfX(0));
    if (tEdge >= T0) { const y = Math.floor(tEdge); if (X(sAt(Math.max(T0, y))) < 6 && X(sAt(y + 1)) > 66 && sAt(y) < sNow) label(PHONE ? 22 : 26, y); }
    const xn = X(sNow);
    if (xn > -30 && xn < W + 30) { ctx.font = F.now; ctx.fillStyle = ink(0.62); ctx.textAlign = "left"; ctx.fillText("now", xn + 5, YB - 9); }
  }

  // a line that starts from the years leaves a notch there; a dotted thread flashes up to its row
  function drawThreads() {
    ctx.lineWidth = 1;
    for (const it of ITEMS) {
      if (it.kind === "main" || it.start === "main" || pen < it.sA) continue;
      const x = X(it.sA); if (x < -2 || x > W + 2) continue;
      ctx.strokeStyle = ink(0.42); ctx.beginPath(); ctx.moveTo(x, YB - 5); ctx.lineTo(x, YB); ctx.stroke();
      if (RM) continue;
      const u = 1 - clamp((pen - it.sA) / 90, 0, 1); if (u <= 0) continue;
      ctx.setLineDash([1.5, 3.5]); ctx.strokeStyle = ink(0.5 * u);
      ctx.beginPath(); ctx.moveTo(x, YB - 5); ctx.lineTo(x, rowY(it.row)); ctx.stroke(); ctx.setLineDash([]);
    }
  }
  // a chapter that closed: a puff of chalk dust drifts up or down from its end
  function drawDust() {
    if (RM) return;
    for (const it of SIDES) {
      if (it.end !== "burst" || pen < it.sZ) continue;
      const u = (pen - it.sZ) / 85; if (u >= 1) continue;
      const x = X(it.sZ), y = rowY(it.row); if (x < -40 || x > W + 40) continue;
      const r = rng(hash(it.id + "/dust")), dir = r() < 0.5 ? -1 : 1, e = 1 - (1 - u) * (1 - u), fade = Math.pow(1 - u, 1.4);
      for (let i = 0; i < 20; i++) {
        const vx = (r() - 0.2) * 34, vy = dir * (6 + r() * 24), j = (r() - 0.5) * 5, sz = 0.8 + r() * 1.5, a0 = 0.35 + r() * 0.5;
        ctx.fillStyle = ink(a0 * fade); ctx.fillRect(x + vx * e - sz / 2, y + j + vy * e - sz / 2, sz, sz);
      }
    }
  }
  // where a branch joins, the line it joins flashes once
  function drawJoins() {
    if (RM) return;
    for (const it of ITEMS) {
      if (!(it.kind === "branch" || it.end === "merge")) continue;
      const d = pen - it.sZ; if (d < -2 || d > 70) continue;
      const x = X(it.sZ); if (x < -10 || x > W + 10) continue;
      const y = rowY(it.tRow), u = clamp(d / 70, 0, 1), r = 7, g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, ink(0.7 * (1 - u))); g.addColorStop(1, ink(0)); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
  }

  // boxes: a line's box rides at the pen while it runs, then waits where the line ended and drifts away
  function collectBoxes() {
    const out = [];
    const push = (it, anchor, birthA, row, y, h, label, w, font, kind) => {
      const right = X(anchor), left = right - w, a = birthA * smooth((right - 4) / (w * 0.9));
      if (right < -2 || left > W + 2 || a <= 0.01) return;
      out.push({ it, id: it.id, left, right, y, h, a, birthA, label, w, font, kind, row, born: it.sA });
    };
    for (const it of ITEMS) {
      if (pen < it.sA) continue;
      const waits = it.kind === "main" ? it.sZ : it.stop;
      const anchor = waits != null && pen >= waits ? waits : pen;
      const birthA = RM ? 1 : it.cIn ? smooth((pen - it.sA - it.cIn * 0.4) / (it.cIn * 0.6)) : smooth((pen - it.sA) / 10 + 0.1);
      const main = it.kind === "main", isNow = it === LAST && pen >= sNow - 0.5;
      push(it, anchor, birthA, it.row, rowY(it.row), main ? BOXH_MAIN : BOXH, isNow ? NOW_LABEL : it.box, isNow ? NOW_LABEL_W : it.w, main ? F.main : F.box, it.kind);
    }
    for (const m of MARKS) { if (pen >= m.sA) push(m, m.sA, RM ? 1 : smooth((pen - m.sA) / 16 + 0.2), "mark", MARKY, MARKH, m.box, m.w, F.mark, "mark"); }
    // a newer box in the same row takes the place of an older one: the older fades out
    const rows = new Map();
    for (const b of out) { if (!rows.has(b.row)) rows.set(b.row, []); rows.get(b.row).push(b); }
    for (const L of rows.values()) {
      L.sort((p, q) => p.born - q.born);
      for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) { const o = L[i], n = L[j]; if (o.right > n.left - 3 && o.left < n.right + 3) o.a *= 1 - Math.min(1, n.birthA * 2.5); }
    }
    return out.filter((b) => b.a > 0.01);
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function drawBox(b) {
    const sel = selected === b.id, main = b.kind === "main", mark = b.kind === "mark";
    ctx.save(); ctx.globalAlpha = b.a;
    roundRect(b.left + 0.5, b.y - b.h / 2 + 0.5, b.w - 1, b.h - 1, mark ? 3 : main ? 5 : 4);
    ctx.fillStyle = sel ? INK : BOARD; ctx.fill();
    if (mark) ctx.setLineDash([2.5, 2]);
    ctx.strokeStyle = ink(sel ? 1 : main ? 0.8 : 0.52); ctx.lineWidth = main ? 1.4 : 1; ctx.stroke(); ctx.setLineDash([]);
    ctx.font = b.font; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillStyle = sel ? BOARD : ink(main ? 0.98 : mark ? 0.82 : 0.9);
    ctx.fillText(b.label, b.left + (main ? PADX_MAIN : PADX), b.y + 0.5);
    ctx.restore();
  }
  // at the end: a dashed arrow from today onward, and a question mark
  function drawAhead() {
    const from = RM ? sNow : sNow + ENDLEN * 0.55;
    if (!RM && pen < from) return;
    const a = RM ? 1 : smooth((pen - from) / (ENDLEN * 0.45));
    const y = rowY(0), x0 = X(RM ? sNow : pen) + 6, x1 = W - (PHONE ? 22 : 30);
    if (x1 - x0 < 18 || x0 > W) return;
    ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = ink(0.7); ctx.lineWidth = 1.4; ctx.lineCap = "round";
    ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1 - 2, y); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(x1 - 7, y - 4.5); ctx.lineTo(x1, y); ctx.lineTo(x1 - 7, y + 4.5); ctx.stroke();
    ctx.font = F.q; ctx.fillStyle = ink(0.9); ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText("?", x1 + 6, y + 1);
    ctx.restore();
  }
  // the duster wipes the board from left to right before it all starts again
  function drawWipe(u) {
    const e = smooth(u), wx = -70 + (W + 140) * e;
    ctx.save(); ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, Math.max(0, wx - 56), H);
    const g = ctx.createLinearGradient(wx - 56, 0, wx, 0); g.addColorStop(0, "rgba(0,0,0,1)"); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.fillRect(wx - 56, 0, 56, H); ctx.restore();
    const s = ctx.createLinearGradient(wx - 110, 0, wx, 0); s.addColorStop(0, ink(0)); s.addColorStop(0.75, ink(0.05)); s.addColorStop(1, ink(0));
    ctx.fillStyle = s; ctx.fillRect(wx - 110, 4, 110, H - 8);
  }

  function render(now) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (state === "blank") { boxes = []; return; }
    vs0 = view - PENX - 40; vs1 = view + (W - PENX) + 40;
    drawScale(false); drawThreads();
    for (const it of DRAW_ORDER) drawLine(it);
    drawMain(); drawShine(now); drawJoins(); drawDust();
    grain();
    drawScale(true);
    boxes = collectBoxes();
    for (const b of boxes) if (b.id !== selected) drawBox(b);
    for (const b of boxes) if (b.id === selected) drawBox(b);
    drawAhead();
    if (state === "wipe") drawWipe((now - stateT) / WIPE_MS);
  }

  /* ---------------------------------------------------------------- motion and touch
     The roll runs at a fixed speed. It waits while a finger or the mouse is held down, and while a
     card or a photo is open; it goes on at once when they are let go or closed. */
  const RMQ = G.matchMedia("(prefers-reduced-motion: reduce)");
  let RM = RMQ.matches;
  const HOLD_MS = 2200, WIPE_MS = 1100, BLANK_MS = 500;
  let state = "roll", stateT = 0, held = false, pauseUntil = 0, last = 0, raf = 0, running = false, visible = false, ptr = null;
  const maxView = () => (RM ? sNow : sEnd);

  function update(dt, now) {
    if (RM) { view = clamp(view, 0, sNow); pen = sNow; return; }
    const go = !held && !cardOpen && !viewerOpen && now >= pauseUntil;
    if (state === "roll") {
      if (go) view += SPEED * dt;
      if (view >= sEnd) { view = sEnd; if (go) { state = "hold"; stateT = now; } }
    } else if (state === "hold") { if (now - stateT > HOLD_MS) { state = "wipe"; stateT = now; } }
    else if (state === "wipe") { if (now - stateT > WIPE_MS) { state = "blank"; stateT = now; } }
    else if (state === "blank") { if (now - stateT > BLANK_MS) { state = "roll"; view = 0; } }
    view = clamp(view, 0, sEnd); pen = view;
  }
  function step(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
    update(dt, now); render(now);
    if (cardOpen) syncCard();
    raf = running ? G.requestAnimationFrame(step) : 0;
  }
  function run() {
    const want = visible && !document.hidden && !!S;
    if (want && !running) { running = true; last = performance.now(); raf = G.requestAnimationFrame(step); }
    else if (!want && running) { running = false; G.cancelAnimationFrame(raf); }
  }
  // a touch brings back a board that was being wiped
  function interrupt() { if (state !== "roll") { state = "roll"; view = sEnd; } }

  cv.addEventListener("pointerdown", (e) => {
    if (e.button > 0) return;
    interrupt(); held = true;
    ptr = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, t0: performance.now(), drag: false };
    try { cv.setPointerCapture(e.pointerId); } catch (x) { /* fine without */ }
  });
  cv.addEventListener("pointermove", (e) => {
    if (!ptr || e.pointerId !== ptr.id) return;
    const dx = e.clientX - ptr.x;
    if (!ptr.drag && Math.abs(e.clientX - ptr.x0) > 6 && Math.abs(e.clientX - ptr.x0) > Math.abs(e.clientY - ptr.y0)) { ptr.drag = true; cv.classList.add("is-dragging"); }
    if (ptr.drag) { view = clamp(view - dx, 0, maxView()); if (!RM) pen = view; }
    ptr.x = e.clientX;
  });
  const letGo = (e, tapped) => {
    if (!ptr || (e && e.pointerId !== ptr.id)) return;
    if (tapped && !ptr.drag && performance.now() - ptr.t0 < 450) tap(e);
    ptr = null; held = false; cv.classList.remove("is-dragging");
  };
  cv.addEventListener("pointerup", (e) => letGo(e, true));
  cv.addEventListener("pointercancel", (e) => letGo(e, false));
  cv.addEventListener("contextmenu", (e) => e.preventDefault());       // a long press holds the roll, nothing else
  cv.addEventListener("wheel", (e) => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;              // up and down scroll the page as usual
    e.preventDefault(); interrupt();
    view = clamp(view + e.deltaX, 0, maxView()); pauseUntil = performance.now() + 450;
  }, { passive: false });
  cv.addEventListener("keydown", (e) => {
    const month = () => Math.max(4, sAt(tAt(view) + 1 / 12) - view);
    let v = null;
    if (e.key === "ArrowRight") v = view + month();
    else if (e.key === "ArrowLeft") v = view - month();
    else if (e.key === "Home") v = 0;
    else if (e.key === "End") v = maxView();
    else if (e.key === "Escape") { closeCard(); return; }
    if (v == null) return;
    e.preventDefault(); interrupt(); view = clamp(v, 0, maxView()); pauseUntil = performance.now() + 1500;
  });

  function hitTest(x, y) {
    let best = null, bd = Infinity;
    for (const b of boxes) {
      if (b.a < 0.25) continue;
      if (x >= b.left - 4 && x <= b.right + 4 && y >= b.y - b.h / 2 - 4 && y <= b.y + b.h / 2 + 4) {
        const d = Math.abs(y - b.y) * 3 + Math.abs(x - (b.left + b.right) / 2) * 0.1;
        if (d < bd) { bd = d; best = b; }
      }
    }
    return best;
  }
  function tap(e) {
    const r = cv.getBoundingClientRect(), b = hitTest(e.clientX - r.left, e.clientY - r.top);
    if (b && b.id !== selected) openCard(b.it); else closeCard();      // the same name again closes its card
  }

  /* ---------------------------------------------------------------- cards and photos */
  const card = $("llCard"), cardPhoto = $("llCardPhoto"), cardImg = $("llCardImg"), cardTip = $("llCardTip");
  const cardWhen = $("llCardWhen"), cardTitle = $("llCardTitle"), cardNote = $("llCardNote");
  let cardOpen = false, selected = null, cardItem = null, shown = null, cardSide = "above";

  // a card shows the line's name; a tag (what), a note and photos only when about/life.js gives them
  const tagOf = (it) => it.what || "";
  function pickPhoto(it, fresh) {
    const ph = it.photos || [];
    if (!ph.length) return null;
    const dated = ph.filter((p) => p.date);
    if (!dated.length) return fresh || !shown || !ph.includes(shown) ? ph[Math.floor(Math.random() * ph.length)] : shown;
    const t = clamp(tAt(pen), it.t0, it.t1 == null ? T_NOW : it.t1);
    let best = dated[0], bd = Infinity;
    for (const p of dated) { const d = Math.abs(photoYear(p.date) - t); if (d < bd) { bd = d; best = p; } }
    return best;
  }
  function showPhoto(p) {
    shown = p; cardPhoto.hidden = !p;
    if (p) { cardImg.src = p.src; cardImg.alt = p.alt || ""; }
  }
  function openCard(it, fromList) {
    if (!card) return;
    selected = it.id; cardItem = it; cardOpen = true;
    const tag = tagOf(it);
    cardWhen.textContent = tag; cardWhen.hidden = !tag;
    cardTitle.textContent = it.title;
    cardNote.textContent = it.note || ""; cardNote.hidden = !it.note;
    showPhoto(pickPhoto(it, true));
    card.hidden = false;
    const r = frame.getBoundingClientRect();
    cardSide = r.top >= card.offsetHeight + 20 ? "above" : "below";
    card.classList.toggle("is-above", cardSide === "above"); card.classList.toggle("is-below", cardSide === "below");
    syncCard();
    if (cardSide === "below") { const c = card.getBoundingClientRect(); if (c.bottom > G.innerHeight) card.scrollIntoView({ block: "nearest", behavior: RM ? "auto" : "smooth" }); }
    if (fromList) $("llCardClose").focus({ preventScroll: true });
  }
  function closeCard() {
    if (!cardOpen) return;
    cardOpen = false; selected = null; cardItem = null; card.hidden = true;
  }
  // the card follows its box while the line is dragged; a dated photo follows the year under the pen
  function syncCard() {
    const b = boxes.find((x) => x.id === selected);
    if (!b) { if (state === "roll") closeCard(); return; }
    const cw = card.offsetWidth, ch = card.offsetHeight, fx = frame.offsetLeft;
    const cx = fx + (b.left + b.right) / 2, left = clamp(cx - cw / 2, fx + 4, fx + W - cw - 4);
    card.style.left = left + "px";
    card.style.top = (cardSide === "above" ? frame.offsetTop - ch - 12 : frame.offsetTop + H + 12) + "px";
    cardTip.style.left = clamp(cx - left - 6, 12, cw - 24) + "px";
    if (cardItem && (cardItem.photos || []).some((p) => p.date)) { const p = pickPhoto(cardItem, false); if (p !== shown) showPhoto(p); }
  }
  if (card) {
    $("llCardClose").addEventListener("click", () => { closeCard(); cv.focus({ preventScroll: true }); });
    cardPhoto.addEventListener("click", () => { if (shown) openViewer(shown, cardItem); });
    document.addEventListener("pointerdown", (e) => {                 // a tap anywhere else closes the card
      if (!cardOpen || viewerOpen || card.contains(e.target) || frame.contains(e.target)) return;
      closeCard();
    });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !viewerOpen) closeCard(); });
  }

  // a photo full screen: pinch, wheel or double-tap to zoom, drag to look around
  const viewer = $("llViewer"), stage = $("llStage"), vimg = $("llImg");
  let viewerOpen = false, Z = { k: 1, x: 0, y: 0 }, touches = new Map(), pinch = null, lastTap = { t: 0, x: 0, y: 0 }, moved = false, downOnPhoto = false;
  function applyZ() { vimg.style.transform = `translate(${Z.x}px, ${Z.y}px) scale(${Z.k})`; vimg.style.cursor = Z.k > 1.01 ? "grab" : "zoom-in"; }
  function clampZ() {
    const r = stage.getBoundingClientRect(), iw = vimg.offsetWidth * Z.k, ih = vimg.offsetHeight * Z.k;
    const mx = Math.max(0, (iw - r.width) / 2), my = Math.max(0, (ih - r.height) / 2);
    Z.x = clamp(Z.x, -mx, mx); Z.y = clamp(Z.y, -my, my);
  }
  function zoomAt(k, px, py) {
    const r = stage.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    k = clamp(k, 1, 5); const f = k / Z.k;
    Z.x = px - cx - f * (px - cx - Z.x); Z.y = py - cy - f * (py - cy - Z.y); Z.k = k;
    if (k <= 1.001) { Z.x = 0; Z.y = 0; }
    clampZ(); applyZ();
  }
  function openViewer(p, it) {
    if (!viewer) return;
    viewerOpen = true; Z = { k: 1, x: 0, y: 0 }; applyZ();
    vimg.src = p.src; vimg.alt = p.alt || "";
    $("llCap").textContent = [it ? it.title : "", p.date ? parts(p.date).y : ""].filter(Boolean).join(" · ");
    viewer.hidden = false; document.documentElement.style.overflow = "hidden";
    $("llClose").focus({ preventScroll: true });
  }
  function closeViewer() {
    viewerOpen = false; viewer.hidden = true; document.documentElement.style.overflow = "";
    touches.clear(); pinch = null;
    if (cardOpen) cardPhoto.focus({ preventScroll: true });
  }
  if (viewer) {
    $("llClose").addEventListener("click", closeViewer);
    viewer.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); closeViewer(); } });
    stage.addEventListener("pointerdown", (e) => {
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved = false; downOnPhoto = e.target === vimg;
      try { stage.setPointerCapture(e.pointerId); } catch (x) { /* fine without */ }
      if (touches.size === 2) { const [a, b] = [...touches.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, k: Z.k, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; }
    });
    stage.addEventListener("pointermove", (e) => {
      const prev = touches.get(e.pointerId); if (!prev) return;
      const cur = { x: e.clientX, y: e.clientY }; touches.set(e.pointerId, cur);
      if (Math.hypot(cur.x - prev.x, cur.y - prev.y) > 0.5) moved = true;
      if (touches.size === 2 && pinch) {
        const [a, b] = [...touches.values()], d = Math.hypot(a.x - b.x, a.y - b.y) || 1, mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        Z.x += mx - pinch.mx; Z.y += my - pinch.my; pinch.mx = mx; pinch.my = my;
        zoomAt(pinch.k * (d / pinch.d), mx, my);
      } else if (touches.size === 1 && Z.k > 1.01) { Z.x += cur.x - prev.x; Z.y += cur.y - prev.y; clampZ(); applyZ(); }
    });
    const lift = (e) => {
      const wasOne = touches.size === 1; touches.delete(e.pointerId);
      if (touches.size < 2) pinch = null;
      if (!wasOne || moved || e.type === "pointercancel") return;
      const now = performance.now();
      if (now - lastTap.t < 320 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30) { zoomAt(Z.k > 1.2 ? 1 : 2.5, e.clientX, e.clientY); lastTap.t = 0; return; }
      lastTap = { t: now, x: e.clientX, y: e.clientY };
      if (!downOnPhoto && Z.k <= 1.01) closeViewer();                 // a tap beside the photo closes it
    };
    stage.addEventListener("pointerup", lift); stage.addEventListener("pointercancel", lift);
    stage.addEventListener("wheel", (e) => { e.preventDefault(); zoomAt(Z.k * Math.exp(-e.deltaY * 0.0016), e.clientX, e.clientY); }, { passive: false });
  }

  // every stop as a plain list, for keyboards and screen readers
  function buildList() {
    const ol = $("llList"); if (!ol) return;
    ol.textContent = "";
    for (const it of [...ITEMS, ...MARKS].sort((a, b) => a.t0 - b.t0)) {
      const li = document.createElement("li"), bt = document.createElement("button");
      bt.type = "button"; bt.textContent = it.title;
      bt.addEventListener("click", () => {
        interrupt();
        const waits = it.kind === "main" ? (it.sZ == null ? sNow : it.sZ) : it.kind === "mark" ? it.sA + 30 : it.stop;
        view = clamp(waits, 0, maxView()); pen = RM ? sNow : view;
        render(performance.now()); openCard(it, true);
      });
      li.appendChild(bt); ol.appendChild(li);
    }
  }

  /* ---------------------------------------------------------------- start */
  function start() {
    layout(); buildList();
    view = RM ? sNow : sAt(T0 + 2);                   // the first look opens two school years in, the start still in sight
    pen = RM ? sNow : view;
    new ResizeObserver(() => { if (Math.round(frame.clientWidth) !== W) { layout(); if (!running) render(performance.now()); } }).observe(frame);
    new IntersectionObserver((es) => { visible = es[es.length - 1].isIntersecting; run(); }, { rootMargin: "80px 0px" }).observe(frame);
    document.addEventListener("visibilitychange", run);
    if (RMQ.addEventListener) RMQ.addEventListener("change", (e) => { RM = e.matches; state = "roll"; if (RM) view = sNow; pen = RM ? sNow : view; });
    render(performance.now()); run();
  }
  const fonts = ['500 12px "WQ Sans"', '600 14px "WQ Sans"', '400 12px "WQ Serif"', '700 12px "WQ Serif"', 'italic 400 12px "WQ Serif"'];
  Promise.race([Promise.all(fonts.map((f) => document.fonts.load(f))), new Promise((r) => setTimeout(r, 2000))]).catch(() => {}).then(start);

  // a handle for checking by hand (in the console)
  G.WQ_lifeline = {
    seek(d) { interrupt(); held = true; view = clamp(sAt(typeof d === "number" ? d : yearOf(d, "seek")), 0, maxView()); pen = RM ? sNow : view; render(performance.now()); },
    play() { held = false; pauseUntil = 0; },
    boxes: () => boxes.map((b) => ({ id: b.id, label: b.label, x: Math.round((b.left + b.right) / 2), y: Math.round(b.y), a: +b.a.toFixed(2), row: b.row })),
    rows: () => BRS.map((b) => ({ box: b.box, row: b.row, t: +tAt(b.sA).toFixed(3) })),
    state: () => ({ state, view: Math.round(view), sEnd: Math.round(sEnd), t: +tAt(view).toFixed(3), W, H, held, cardOpen }),
  };
})(window);
