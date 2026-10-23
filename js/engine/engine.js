/* =============================================================================
   engine.js — the living chalkboard behind the page                    → WQ.E
   -----------------------------------------------------------------------------
   Two fixed canvases sit behind the page text:
     #board-tex   the blackboard texture (painted once per resize)
     #board-fx    the drawings (redrawn every frame)

   HOME PAGE — every <section data-scene="name"> owns a scene (js/scenes/*.js).
   The scroll position decides what is drawn:
     • inside a section .......... that section's scene, alive and looping
     • while the next section rises  the scene breaks into chalk dust that flows
                                     into the next scene. The scroll position IS
                                     the timeline: stop half-way and you see the
                                     half-way state; scroll back and it rewinds.
   CALM ZONES — any element with data-calm (titles, text, the form) erases the
     drawings behind it to a faint trace, so text always stays readable.
     data-calm="0.6" sets the strength (default CFG.calm). Scenes lay out
     around their section's calm elements, except ones marked data-calm-only.
   COLLAPSE — a link with data-collapse pulls everything into a spiral toward
     the link, then opens it; the next page unfolds from the same point.
   REDUCED MOTION — with "reduce motion" switched on in the visitor's system,
     each section shows one still drawing; nothing animates.

   A scene is a factory registered as WQ.scenes[name] = (env) => ({ ... }):
     resize(env)            layout for the current size (also called once at start)
     update(dt, t)          advance; t = the scene's own clock in seconds
     draw(ctx, alpha, pass) pass "base" (calmed behind text) or "top" (on top, not calmed)
     points(out, n)         n live points (CSS px) on its drawings, for the dust
     still                  clock time shown to reduced-motion visitors
     enter()                optional: first time the scene becomes visible
   HOW TO EDIT: the numbers in CFG.
   ============================================================================= */
(function (G) {
  "use strict";
  const WQ = G.WQ, { L, CH } = WQ, { clamp, lerp, smooth, Ease, TAU, mulberry32, makeNoise } = L;

  const CFG = {
    budget: 2.4e6,          // max canvas pixels on desktop (CSS px² × dpr²)
    budgetMobile: 1.35e6,   // … on phones
    maxDpr: 2,
    particles: 1500,        // chalk-dust particles in a transition (desktop)
    particlesMobile: 650,
    calm: 0.86,             // 0–1: how much of a drawing is erased behind text
    feather: 70,            // px: softness of a calm zone's edge (phones: × 0.6)
    calmPad: 14,            // px: calm zone grows this much around the text
    trans: [0.06, 0.86],    // share of the "next section rising" scroll used by a transition
    collapse: 1.05,         // s: spiral collapse before a page opens
    unfold: 1.25,           // s: spiral unfold when a page arrives
  };

  const E = { CFG, scenes: [], reduced: false, capture: false, lite: false, ready: false };
  let tex, fx, ctx, tctx, W = 0, H = 0, dpr = 1, env = null, mode = "home";
  let sections = [], calmEls = [], feather = null, running = false, lastT = 0, frameNo = 0;
  let st = { a: 0, b: -1, p: 0, q: 0 };
  const R = mulberry32(5), NZ = makeNoise(5);
  const tmp2 = [0, 0];

  /* ------------------------------------------------------------------ sizing */
  function pickDpr() {
    const mobile = W < 700, budget = mobile ? CFG.budgetMobile : CFG.budget;
    let d = Math.min(G.devicePixelRatio || 1, CFG.maxDpr, Math.sqrt(budget / Math.max(1, W * H)));
    if (E.lite) d *= 0.8;
    return Math.max(0.75, Math.round(d * 100) / 100);
  }
  function resize(force) {
    const w = fx.clientWidth, h = fx.clientHeight;
    if (!force && w === W && Math.abs(h - H) < 140) { measure(); return; } // ignore mobile URL-bar jitter
    W = w; H = h; dpr = pickDpr();
    for (const c of [fx, tex]) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    CH.q = dpr;
    tctx.setTransform(dpr, 0, 0, dpr, 0, 0); CH.paintBoard(tctx, W, H);
    feather = makeFeather(Math.round(CFG.feather * (W < 700 ? 0.6 : 1)));
    const prev = env;
    env = makeEnv();
    if (prev) env.rand = prev.rand;
    measure(false);
    for (const s of E.scenes) { s.env = env; s.obj.resize && s.obj.resize(env, sections[s.i].box); }
    MO.n = 0; // particle buffers re-allocated for the new size
  }
  function makeEnv() {
    return {
      W, H, dpr, mobile: W < 700, portrait: H > W * 1.08, lite: E.lite, capture: E.capture,
      rand: mulberry32(7), noise: makeNoise(7), scroll: 0,
      emit: (name, detail) => document.dispatchEvent(new CustomEvent("wq:" + name, { detail })),
    };
  }
  // where every section and every calm element sits (document coordinates)
  function measure(notify = true) {
    const y0 = G.scrollY;
    for (const s of sections) { const r = s.el.getBoundingClientRect(); s.top = r.top + y0; s.h = r.height; }
    calmEls = [...document.querySelectorAll("[data-calm]")].map((el) => {
      const r = el.getBoundingClientRect(), v = parseFloat(el.dataset.calm);
      return { el, x: r.left, y: r.top + y0, w: r.width, h: r.height, k: isNaN(v) ? CFG.calm : v };
    }).filter((c) => c.w > 0 && c.h > 0);
    // each scene learns where its own text sits (relative to its section's top) to lay out around it
    for (const s of sections) {
      let x0 = 1e9, y0b = 1e9, x1 = -1e9, y1 = -1e9;
      for (const c of calmEls) if (s.el.contains(c.el) && !c.el.hasAttribute("data-calm-only")) { x0 = Math.min(x0, c.x); y0b = Math.min(y0b, c.y - s.top); x1 = Math.max(x1, c.x + c.w); y1 = Math.max(y1, c.y - s.top + c.h); }
      const box = x1 > x0 ? { x: x0, y: y0b, w: x1 - x0, h: y1 - y0b } : null;
      const changed = JSON.stringify(box) !== JSON.stringify(s.box);
      s.box = box;
      if (notify && changed && s.obj && s.obj.resize && env) s.obj.resize(env, box);
    }
  }

  /* --------------------------------------------------------- calm-zone mask
     A soft-edged rectangle, drawn as 9 slices of a pre-blurred disc so the
     edge softness stays the same at any size. Drawn with destination-out.  */
  function makeFeather(f) {
    const c = document.createElement("canvas"); c.width = c.height = 2 * f;
    const g = c.getContext("2d"), grd = g.createRadialGradient(f, f, 0, f, f, f);
    grd.addColorStop(0, "rgba(0,0,0,1)"); grd.addColorStop(0.35, "rgba(0,0,0,0.82)"); grd.addColorStop(0.7, "rgba(0,0,0,0.3)"); grd.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grd; g.fillRect(0, 0, 2 * f, 2 * f);
    c.f = f; return c;
  }
  function featherRect(c, x, y, w, h, img) {
    const f = img.f;
    c.fillStyle = "#000"; c.fillRect(x, y, w, h);
    c.drawImage(img, f, 0, 1, f, x, y - f, w, f);      // top
    c.drawImage(img, f, f, 1, f, x, y + h, w, f);      // bottom
    c.drawImage(img, 0, f, f, 1, x - f, y, f, h);      // left
    c.drawImage(img, f, f, f, 1, x + w, y, f, h);      // right
    c.drawImage(img, 0, 0, f, f, x - f, y - f, f, f);  // corners
    c.drawImage(img, f, 0, f, f, x + w, y - f, f, f);
    c.drawImage(img, 0, f, f, f, x - f, y + h, f, f);
    c.drawImage(img, f, f, f, f, x + w, y + h, f, f);
  }
  function calmMask(scale = 1) {
    if (scale <= 0.01) return;
    const y0 = G.scrollY, f = feather.f, pad = CFG.calmPad;
    ctx.save(); ctx.globalCompositeOperation = "destination-out";
    for (const c of calmEls) {
      const y = c.y - y0;
      if (y > H + f || y + c.h < -f) continue;
      const v = parseFloat(c.el.dataset.calm), k = isNaN(v) ? CFG.calm : v; // read live: a page may change it
      if (k <= 0.005) continue;
      ctx.globalAlpha = clamp(k * scale, 0, 1);
      featherRect(ctx, c.x - pad, y - pad, c.w + 2 * pad, c.h + 2 * pad, feather);
    }
    ctx.restore();
  }

  /* ------------------------------------------------------- scroll → scenes
     a = scene in front, b = next scene (or -1), p = how far the next section
     has risen (0 = its top at the viewport bottom, 1 = at the top), q = eased. */
  function scrollState() {
    const y = G.scrollY, vh = G.innerHeight, n = sections.length;
    if (env) env.scroll = y / Math.max(1, vh);
    for (let i = 0; i < n - 1; i++) {
      const r = (sections[i + 1].top - y) / vh;
      if (r > 0 && r < 1) { const p = 1 - r; return { a: i, b: i + 1, p, q: smooth(CFG.trans[0], CFG.trans[1], p) }; }
    }
    let i = 0; while (i < n - 1 && sections[i + 1].top <= y + 1) i++;
    return { a: i, b: -1, p: 0, q: 0 };
  }

  /* ----------------------------------------------------------------- dust
     Particle morph between two living scenes. Both scenes report live points
     every frame; particle k travels from A's k-th point to B's k-th point
     (both sorted left→right so the dust flows like ink, not like an explosion). */
  const MO = { n: 0, pair: "" };
  function morphAlloc() {
    const n = env.mobile ? CFG.particlesMobile : CFG.particles;
    if (MO.n === n) return;
    Object.assign(MO, { n, PA: new Float32Array(2 * n), PB: new Float32Array(2 * n), P: new Float32Array(2 * n), PR: new Float32Array(2 * n),
      sA: new Uint32Array(n), sB: new Uint32Array(n), d: new Float32Array(n), j: new Float32Array(n), pair: "" });
    for (let i = 0; i < n; i++) MO.j[i] = R() * TAU;
  }
  function order(P, n, out) {
    const idx = Array.from({ length: n }, (_, i) => i), key = new Float32Array(n);
    for (let i = 0; i < n; i++) key[i] = P[2 * i] + 0.35 * P[2 * i + 1];
    idx.sort((a, b) => key[a] - key[b]);
    for (let i = 0; i < n; i++) out[i] = idx[i];
  }
  function points(s, out, n) {
    if (s.obj.points) s.obj.points(out, n); else WQ.PTS.begin(out, n).scatter("fallback", 1, 0, 0, W, H).end();
  }
  function morphDraw(A, B, q, t, alpha = 1) {
    morphAlloc();
    const n = MO.n, pair = A.name + ">" + B.name;
    points(A, MO.PA, n); points(B, MO.PB, n);
    if (MO.pair !== pair) { // a new transition: fix who-goes-where
      MO.pair = pair; order(MO.PA, n, MO.sA); order(MO.PB, n, MO.sB);
      for (let k = 0; k < n; k++) MO.d[k] = 0.3 * (0.65 * clamp(MO.PB[2 * MO.sB[k]] / W, 0, 1) + 0.35 * R());
      MO.fresh = true;
    }
    const sw = 0.075 * Math.min(W, H * 1.6), P = MO.P, PA = MO.PA, PB = MO.PB;
    for (let k = 0; k < n; k++) {
      const i = MO.sA[k], j = MO.sB[k];
      const e = Ease.inOut(clamp((q - MO.d[k]) / 0.66, 0, 1)), b = Math.sin(Math.PI * e);
      let ox = 0, oy = 0;
      if (b > 0.01) { NZ.curl(PA[2 * i] * 0.0038, PA[2 * i + 1] * 0.0038, t * 0.22, tmp2); ox = tmp2[0] * sw * b; oy = tmp2[1] * sw * b; }
      P[2 * k] = lerp(PA[2 * i], PB[2 * j], e) + ox + 0.6 * Math.sin(t * 3 + MO.j[k]);
      P[2 * k + 1] = lerp(PA[2 * i + 1], PB[2 * j + 1], e) + oy + 0.6 * Math.cos(t * 2.6 + MO.j[k]);
    }
    const a = alpha * 0.82 * smooth(0, 0.05, q) * (1 - smooth(0.95, 1, q));
    drawDust(P, n, a, !MO.fresh);
    MO.fresh = false;
  }
  function drawDust(P, n, a, streaks, size) {
    if (a <= 0.003) return;
    const s = size || (env.mobile ? 1.4 : 1.55);
    if (streaks) {
      ctx.strokeStyle = `rgba(246,244,236,${0.12 * a})`; ctx.lineWidth = 1; ctx.beginPath();
      for (let k = 0; k < n; k++) { const x = P[2 * k], y = P[2 * k + 1], px = MO.PR[2 * k], py = MO.PR[2 * k + 1]; if (Math.abs(px - x) + Math.abs(py - y) < 60) { ctx.moveTo(px + 0.45 * (x - px), py + 0.45 * (y - py)); ctx.lineTo(x, y); } }
      ctx.stroke();
    }
    ctx.fillStyle = `rgba(246,244,236,${a})`;
    for (let k = 0; k < n; k++) { const y = P[2 * k + 1]; if (y > -4 && y < H + 4) ctx.fillRect(P[2 * k] - s / 2, y - s / 2, s, s); }
    MO.PR.set(P.subarray(0, 2 * n));
  }

  /* --------------------------------------------------- collapse & unfold */
  let CO = null, UN = null;
  function collapseStart(href, cx, cy) {
    if (CO) return;
    if (E.reduced || !running || !env) { G.location.href = href; return; }
    morphAlloc();
    const n = MO.n, P0 = new Float32Array(2 * n), s = E.scenes[st.a];
    if (s) points(s, P0, n);
    const r0 = new Float32Array(n), th0 = new Float32Array(n), d = new Float32Array(n);
    for (let k = 0; k < n; k++) {
      if (k % 4 === 0 || !s) { P0[2 * k] = R() * W; P0[2 * k + 1] = R() * H; } // a little of the whole board too
      const dx = P0[2 * k] - cx, dy = P0[2 * k + 1] - cy;
      r0[k] = Math.hypot(dx, dy); th0[k] = Math.atan2(dy, dx); d[k] = R() * 0.25;
    }
    CO = { t: 0, href, cx, cy, r0, th0, d, n, nav: false };
    document.documentElement.classList.add("wq-collapsing");
  }
  function collapseDraw(dt) {
    CO.t += dt;
    const s = CO.t / CFG.collapse, P = MO.P, n = CO.n;
    for (let k = 0; k < n; k++) {
      const e = Ease.in(clamp((s - CO.d[k]) / (1 - 0.25), 0, 1)), rr = CO.r0[k] * Math.pow(1 - e, 1.15);
      const th = CO.th0[k] + TAU * 1.6 * e * (0.8 + 0.4 * ((k * 0.618) % 1));
      P[2 * k] = CO.cx + rr * Math.cos(th); P[2 * k + 1] = CO.cy + rr * Math.sin(th);
    }
    drawDust(P, n, 0.9 * smooth(0, 0.12, s), CO.t > 0.03);
    const g = smooth(0.55, 0.95, s), rad = (4 + 18 * g) * (1 - 0.5 * smooth(0.95, 1.05, s));
    if (g > 0) {
      const grd = ctx.createRadialGradient(CO.cx, CO.cy, 0, CO.cx, CO.cy, rad * 3);
      grd.addColorStop(0, `rgba(255,255,250,${0.9 * g})`); grd.addColorStop(1, "rgba(255,255,250,0)");
      ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(CO.cx, CO.cy, rad * 3, 0, TAU); ctx.fill();
    }
    if (s >= 1.05 && !CO.nav) {
      CO.nav = true;
      try { G.sessionStorage.setItem("wq-unfold", JSON.stringify({ x: CO.cx / W, y: CO.cy / H, t: Date.now() })); } catch (e) { /* private mode */ }
      G.location.href = CO.href;
    }
    return 1 - smooth(0, 0.4, s); // how much of the scene is still visible
  }
  function unfoldStart() {
    let u = null;
    try { u = JSON.parse(G.sessionStorage.getItem("wq-unfold") || "null"); G.sessionStorage.removeItem("wq-unfold"); } catch (e) { u = null; }
    if (!u || Date.now() - (u.t || 0) > 15000 || E.reduced) return;
    morphAlloc();
    const n = MO.n, tx = new Float32Array(2 * n), r = new Float32Array(n), th = new Float32Array(n);
    for (let k = 0; k < n; k++) { tx[2 * k] = R() * W; tx[2 * k + 1] = R() * H; }
    const cx = u.x * W, cy = u.y * H;
    for (let k = 0; k < n; k++) { const dx = tx[2 * k] - cx, dy = tx[2 * k + 1] - cy; r[k] = Math.hypot(dx, dy); th[k] = Math.atan2(dy, dx); }
    UN = { t: 0, cx, cy, r, th, n };
    document.documentElement.classList.add("wq-unfolding");
  }
  function unfoldDraw(dt) {
    UN.t += dt;
    const s = UN.t / CFG.unfold, P = MO.P, n = UN.n;
    for (let k = 0; k < n; k++) {
      const e = Ease.out(clamp(s * 1.1 - (k % 7) * 0.01, 0, 1)), rr = UN.r[k] * e, th2 = UN.th[k] - TAU * 1.4 * (1 - e);
      P[2 * k] = UN.cx + rr * Math.cos(th2); P[2 * k + 1] = UN.cy + rr * Math.sin(th2);
    }
    drawDust(P, n, 0.85 * (1 - smooth(0.45, 1, s)), s > 0.02);
    if (s >= 1) { UN = null; document.documentElement.classList.remove("wq-unfolding"); }
  }

  /* ----------------------------------------------------------------- frame */
  function visible(i) { return i >= 0 && i < E.scenes.length ? E.scenes[i] : null; }
  function tick(s, dt) {
    if (!s.seen) { s.seen = true; s.obj.enter && s.obj.enter(); }
    s.t += dt; s.obj.update && s.obj.update(dt, s.t);
  }
  function render(dt) {
    st = scrollState();
    const A = visible(st.a), B = visible(st.b), q = st.q;
    let aA = B ? 1 - smooth(0, 0.42, q) : 1, aB = B ? smooth(0.58, 1, q) : 0;
    if (A) tick(A, dt);
    if (B && q > 0) tick(B, dt);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, fx.width, fx.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    let fade = 1;
    if (CO) fade = 1 - smooth(0, 0.4, (CO.t + dt) / CFG.collapse);
    aA *= fade; aB *= fade;
    if (A && aA > 0.003) A.obj.draw(ctx, aA, "base");
    if (B && aB > 0.003) B.obj.draw(ctx, aB, "base");
    if (A && B && q > 0 && q < 1 && !CO) morphDraw(A, B, q, A.t, fade);
    calmMask(fade);
    if (A && aA > 0.003) A.obj.draw(ctx, aA, "top");
    if (B && aB > 0.003) B.obj.draw(ctx, aB, "top");
    if (CO) collapseDraw(dt);
    if (UN) unfoldDraw(dt);
  }
  function loop(now) {
    if (!running) return;
    G.requestAnimationFrame(loop);
    const dt = (now - lastT) / 1000;
    if (dt < 1 / 64) return; // ~60 fps cap on high-refresh screens
    lastT = now;
    const t0 = performance.now();
    render(Math.min(dt, 0.05));
    const ms = performance.now() - t0;
    E.ms = E.ms ? E.ms * 0.95 + ms * 0.05 : ms; // smoothed render time (ms), handy for checks
    adapt(ms);
  }
  // adaptive quality: if frames are slow, drop resolution / detail (at most twice)
  let acc = 0, cnt = 0, downs = 0;
  function adapt(ms) {
    if (++frameNo < 150 || E.capture) return;
    acc += ms; cnt++;
    if (cnt < 90) return;
    const avg = acc / cnt; acc = cnt = 0;
    if (avg > 13 && downs < 2) { downs++; E.lite = true; resize(true); }
  }

  /* ------------------------------------------------------- reduced motion */
  function renderStill() {
    if (!env) return;
    st = scrollState();
    // the section filling most of the screen
    let i = st.a; if (st.b >= 0 && st.p > 0.5) i = st.b;
    const s = visible(i);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, fx.width, fx.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!s) return;
    if (s.stillDone !== W + "x" + H) { // simulate up to the still moment once
      const t1 = s.obj.still ?? 6, dtS = 1 / 30;
      s.t = Math.max(0, t1 - 3); s.obj.enter && !s.seen && s.obj.enter(); s.seen = true;
      for (let k = 0; k < 90; k++) { s.t += dtS; s.obj.update && s.obj.update(dtS, s.t); }
      s.stillDone = W + "x" + H;
    }
    s.obj.draw(ctx, 1, "base"); calmMask(1); s.obj.draw(ctx, 1, "top");
  }
  let stillQueued = false;
  const queueStill = () => { if (stillQueued) return; stillQueued = true; G.requestAnimationFrame(() => { stillQueued = false; renderStill(); }); };

  /* ----------------------------------------------------------------- start
     opts: { mode: "home" | "page", scene: name for a single-scene page }    */
  E.start = function (opts = {}) {
    mode = opts.mode || "home";
    tex = document.getElementById("board-tex"); fx = document.getElementById("board-fx");
    if (!tex || !fx) return;
    tctx = tex.getContext("2d"); ctx = fx.getContext("2d");
    const qs = new URLSearchParams(G.location.search);
    E.capture = qs.get("capture") === "1";
    const mq = G.matchMedia ? G.matchMedia("(prefers-reduced-motion: reduce)") : null;
    E.reduced = (!!mq && mq.matches) || qs.get("still") === "1";
    // sections → scenes
    const els = mode === "home" ? [...document.querySelectorAll("[data-scene]")] : [document.body];
    sections = els.map((el) => ({ el, top: 0, h: 0, box: null }));
    W = 0; resize(true);
    E.scenes = sections.map((s, i) => {
      const name = mode === "home" ? s.el.dataset.scene : opts.scene;
      const make = name && WQ.scenes[name];
      const obj = make ? make(env, { page: mode !== "home", section: s.el, ...(opts.sceneOpts || {}) }) : { draw() {}, points: null };
      const sc = { name: name || "none", obj, t: 0, seen: false, env, i };
      s.obj = obj;
      obj.resize && obj.resize(env, s.box);
      return sc;
    });
    // re-measure when layout settles (fonts, images) and on resize
    const remeasure = () => { measure(); if (E.reduced) queueStill(); };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(remeasure);
    G.addEventListener("load", remeasure);
    G.addEventListener("resize", () => { resize(false); if (E.reduced) queueStill(); });
    if ("ResizeObserver" in G) new ResizeObserver(() => measure()).observe(document.body);
    // collapse links
    document.addEventListener("click", (ev) => {
      const a = ev.target.closest && ev.target.closest("a[data-collapse]");
      if (!a || ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey || a.target === "_blank") return;
      ev.preventDefault();
      const r = a.getBoundingClientRect();
      collapseStart(a.href, r.left + r.width / 2, r.top + r.height / 2);
    });
    // back/forward cache: undo a finished collapse
    G.addEventListener("pageshow", (ev) => { if (ev.persisted) { CO = null; document.documentElement.classList.remove("wq-collapsing"); lastT = performance.now(); } });
    if (mq && mq.addEventListener) mq.addEventListener("change", () => G.location.reload());
    E.ready = true;
    document.documentElement.classList.add("wq-ready");
    if (E.reduced) {
      document.documentElement.classList.add("wq-still");
      G.addEventListener("scroll", queueStill, { passive: true });
      renderStill();
      env.emit("still");
      return;
    }
    unfoldStart();
    if (E.capture) return; // tests drive frames with E.step()
    running = true; lastT = performance.now();
    G.requestAnimationFrame(loop);
    document.addEventListener("visibilitychange", () => { lastT = performance.now(); });
  };
  // test hooks: advance n frames of dt seconds without the RAF loop
  E.step = function (dt = 1 / 30, n = 1) { for (let i = 0; i < n; i++) render(dt); };
  E.state = () => ({ ...st, W, H, dpr, scenes: E.scenes.map((s) => [s.name, +s.t.toFixed(2)]) });
  E.env = () => env;
  E.collapse = collapseStart;

  /* ----------------------------------------------------------------- PTS
     Helper for scene.points(): fills a point buffer from several sources,
     each taking a fixed share of the n points, so the same particle keeps
     the same job frame after frame.
       PTS.begin(out, n).rig("tiger", rig, 0.4).eq("e1", "euler", 20, x, y, 0.2)
          .poly("orbit", pts, 0.2).scatter("air", 0.2, x0, y0, x1, y1).end()   */
  const PTS = {
    cache: new Map(), out: null, n: 0, k: 0,
    keep(k, v) { if (this.cache.size > 400) this.cache.delete(this.cache.keys().next().value); this.cache.set(k, v); return v; },
    begin(out, n) { this.out = out; this.n = n; this.k = 0; return this; },
    take(share) { const m = Math.max(0, Math.min(this.n - this.k, Math.round(share * this.n))); const k0 = this.k; this.k += m; return [k0, m]; },
    rig(key, rig, share, edge = 0.55) {
      const [k0, m] = this.take(share), o = this.out;
      if (m <= 0) return this;
      if (!rig || !rig.parts.length) { this.k = k0; return this; }
      let c = this.cache.get("rig|" + key);
      if (!c || c.m !== m || c.np !== rig.parts.length) {
        c = { m, np: rig.parts.length, s: L.sampleRig(rig, m, mulberry32(m * 13 + key.length), edge) };
        this.keep("rig|" + key, c);
      }
      for (let i = 0; i < m; i++) { const s = c.s[i], M = rig.parts[s.pi].m; o[2 * (k0 + i)] = M.a * s.x + M.c * s.y + M.e; o[2 * (k0 + i) + 1] = M.b * s.x + M.d * s.y + M.f; }
      return this;
    },
    eq(key, id, px, x, y, share, align = "left") {
      const [k0, m] = this.take(share), o = this.out;
      if (m <= 0) return this;
      const ck = "eq|" + key + "|" + id + "|" + px.toFixed(1) + "|" + m + align;
      let p = this.cache.get(ck);
      if (!p) p = this.keep(ck, CH.points(id, px, m, mulberry32(m + id.length), align));
      for (let i = 0; i < m; i++) { o[2 * (k0 + i)] = x + p[2 * i]; o[2 * (k0 + i) + 1] = y + p[2 * i + 1]; }
      return this;
    },
    // along a polyline [[x,y],...] at fixed random arc-length positions
    poly(key, pts, share, jitter = 0) {
      const [k0, m] = this.take(share), o = this.out;
      if (m <= 0 || !pts || pts.length < 2) { if (m > 0) this.k = k0; return this; }
      let u = this.cache.get("u|" + key + "|" + m);
      if (!u) { const r = mulberry32(m + 3); u = new Float32Array(m); for (let i = 0; i < m; i++) u[i] = r(); u.sort(); this.keep("u|" + key + "|" + m, u); }
      let tot = 0; const Ls = [0];
      for (let i = 1; i < pts.length; i++) { tot += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); Ls.push(tot); }
      let j = 1;
      for (let i = 0; i < m; i++) {
        const s = u[i] * tot; while (j < pts.length - 1 && Ls[j] < s) j++;
        const a = pts[j - 1], b = pts[j], f = (s - Ls[j - 1]) / (Ls[j] - Ls[j - 1] || 1);
        o[2 * (k0 + i)] = lerp(a[0], b[0], f) + jitter * Math.sin(i * 12.9898); o[2 * (k0 + i) + 1] = lerp(a[1], b[1], f) + jitter * Math.cos(i * 78.233);
      }
      return this;
    },
    // from a flat [x0,y0,x1,y1,...] array of `count` points
    arr(key, src, count, share) {
      const [k0, m] = this.take(share), o = this.out;
      if (m <= 0 || !count) { if (m > 0) this.k = k0; return this; }
      for (let i = 0; i < m; i++) { const j = Math.floor(((i * 0.61803398875) % 1) * count); o[2 * (k0 + i)] = src[2 * j]; o[2 * (k0 + i) + 1] = src[2 * j + 1]; }
      return this;
    },
    scatter(key, share, x0, y0, x1, y1) {
      const [k0, m] = this.take(share), o = this.out;
      if (m <= 0) return this;
      let u = this.cache.get("sc|" + key + "|" + m);
      if (!u) { const r = mulberry32(m * 7 + 11); u = new Float32Array(2 * m); for (let i = 0; i < 2 * m; i++) u[i] = r(); this.keep("sc|" + key + "|" + m, u); }
      for (let i = 0; i < m; i++) { o[2 * (k0 + i)] = lerp(x0, x1, u[2 * i]); o[2 * (k0 + i) + 1] = lerp(y0, y1, u[2 * i + 1]); }
      return this;
    },
    // any slots left over repeat earlier points (or scatter if nothing was filled)
    end() {
      const o = this.out;
      if (this.k === 0) { for (let i = 0; i < this.n; i++) { o[2 * i] = R() * W; o[2 * i + 1] = R() * H; } return; }
      for (let i = this.k; i < this.n; i++) { const j = i % this.k; o[2 * i] = o[2 * j]; o[2 * i + 1] = o[2 * j + 1]; }
    },
  };

  WQ.E = E; WQ.PTS = PTS; WQ.scenes = WQ.scenes || {};
})(window);
