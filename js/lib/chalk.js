/* =============================================================================
   chalk.js — chalk on a blackboard: equations, lines, grain, board texture
   -----------------------------------------------------------------------------
   Equations/labels come from js/data/equations.js (LaTeX → vector glyphs).
     CH.draw(ctx, id, px, x, y, {alpha, align, rot, chalk})   draw an item
     CH.write(ctx, id, px, x, y, progress, {...})             left→right chalk reveal
     CH.points(id, px, n, rand, align)                        particle points
     CH.size(id, px)                                          [width, height] in px
     CH.line(ctx, pts, alpha, width, dashed)                  chalk stroke
     CH.grain()                                               grain pattern canvas
     CH.paintBoard(ctx, W, H, opts)                           blackboard texture
   px = font size in CSS pixels (the LaTeX source is 10pt → scale px/10).
   y is the vertical CENTRE of the item; align = "left" | "center" | "right".
   Exported as WQ.CH.
   ============================================================================= */
(function (G) {
  "use strict";
  const { mulberry32, TAU, clamp } = G.WQ.L;
  const DATA = () => G.WQ.EQDATA;
  const INK = "rgb(246,244,236)"; // chalk colour
  const P2 = [];                   // Path2D cache per glyph
  const glyph = (i) => P2[i] || (P2[i] = new Path2D(DATA().G[i]));
  const item = (id) => { const e = DATA().E[id]; if (!e) throw new Error("equation not found: " + id); return e; };
  const cache = new Map(), chalkCache = new Map();
  const remember = (map, key, v, max = 260) => { if (map.size > max) map.delete(map.keys().next().value); map.set(key, v); return v; };

  // paint one item at scale k into c (origin = item's top-left)
  function paint(c, e, k, color) {
    c.save(); c.scale(k, k); c.fillStyle = color; c.strokeStyle = color;
    for (const [g, x, y] of e.u) { c.save(); c.translate(x, y); c.fill(glyph(g)); c.restore(); }
    for (const f of e.f) { c.save(); c.transform(f[1], f[2], f[3], f[4], f[5], f[6]); c.fill(new Path2D(f[0])); c.restore(); }
    for (const s of e.s) { c.save(); c.transform(s[2], s[3], s[4], s[5], s[6], s[7]); c.lineWidth = Math.max(s[1], 0.45); c.stroke(new Path2D(s[0])); c.restore(); }
    c.restore();
  }

  const CH = {
    INK,
    has: (id) => !!DATA().E[id],
    size(id, px) { const e = item(id), k = px / 10; return [e.w * k, e.h * k]; },
    // clean raster (cached), sharp at device-pixel ratio q
    raster(id, px, q = 1, color = "#fff") {
      const key = id + "|" + px.toFixed(1) + "|" + q.toFixed(2) + "|" + color;
      if (cache.has(key)) return cache.get(key);
      const e = item(id), k = (px / 10) * q, pad = 2, cv = document.createElement("canvas");
      cv.width = Math.ceil(e.w * k) + 2 * pad; cv.height = Math.ceil(e.h * k) + 2 * pad;
      const c = cv.getContext("2d"); c.translate(pad, pad); paint(c, e, k, color);
      cv._q = q;
      return remember(cache, key, cv);
    },
    // chalk-textured raster: grain + a few dry gaps (cached)
    chalk(id, px, q = 1, seed = 1) {
      const key = id + "|" + px.toFixed(1) + "|" + q.toFixed(2);
      if (chalkCache.has(key)) return chalkCache.get(key);
      const src = CH.raster(id, px, q, INK), cv = document.createElement("canvas");
      cv.width = src.width; cv.height = src.height;
      const c = cv.getContext("2d", { willReadFrequently: true }); c.drawImage(src, 0, 0);
      const d = c.getImageData(0, 0, cv.width, cv.height), r = mulberry32(seed + id.length * 31);
      for (let i = 3; i < d.data.length; i += 4) if (d.data[i]) d.data[i] *= 0.5 + 0.5 * r() * (r() < 0.1 ? 0.25 : 1);
      c.putImageData(d, 0, 0); cv._q = q;
      return remember(chalkCache, key, cv);
    },
    // draw an item; o: {alpha, align, rot, q (device ratio), chalk:false for clean}
    draw(ctx, id, px, x, y, o = {}) {
      const q = o.q || CH.q, cv = o.chalk === false ? CH.raster(id, px, q) : CH.chalk(id, px, q);
      const w = cv.width / q, h = cv.height / q, ax = o.align === "center" ? w / 2 : o.align === "right" ? w : 0;
      ctx.save(); ctx.globalAlpha *= o.alpha ?? 1; ctx.translate(x, y);
      if (o.rot) ctx.rotate(o.rot);
      ctx.drawImage(cv, -ax, -h / 2, w, h); ctx.restore();
    },
    // chalk "writing": reveal left→right with a bright chalk tip
    write(ctx, id, px, x, y, prog, o = {}) {
      if (prog <= 0) return;
      const q = o.q || CH.q, cv = CH.chalk(id, px, q), w = cv.width / q, h = cv.height / q;
      const ax = o.align === "center" ? w / 2 : o.align === "right" ? w : 0, p = clamp(prog, 0, 1);
      ctx.save(); ctx.globalAlpha *= o.alpha ?? 1; ctx.translate(x - ax, y - h / 2);
      if (o.rot) { ctx.translate(ax, h / 2); ctx.rotate(o.rot); ctx.translate(-ax, -h / 2); }
      if (p > 0.001) ctx.drawImage(cv, 0, 0, Math.max(1, cv.width * p), cv.height, 0, 0, Math.max(1 / q, w * p), h);
      if (p < 1 && o.tip !== false) { ctx.fillStyle = "rgba(255,255,250,0.9)"; ctx.beginPath(); ctx.arc(w * p, h * (0.5 + 0.28 * Math.sin(p * 61)), Math.max(1.4, px * 0.07), 0, TAU); ctx.fill(); }
      ctx.restore();
    },
    // n points sampled from the glyph pixels, centred vertically on 0; align sets x origin
    points(id, px, n, rand, align = "center") {
      const key = "pts|" + id + "|" + px.toFixed(1);
      let on = cache.get(key);
      const cv = CH.raster(id, px, 1), w = cv.width, h = cv.height;
      if (!on) {
        const c = cv.getContext("2d", { willReadFrequently: true }), d = c.getImageData(0, 0, w, h).data;
        on = [];
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 110) on.push(x, y);
        remember(cache, key, on);
      }
      const out = new Float32Array(2 * n), m = Math.max(1, on.length / 2), ox = align === "left" ? 0 : align === "right" ? w : w / 2;
      for (let i = 0; i < n; i++) { const j = (rand() * m) | 0; out[2 * i] = (on[2 * j] || 0) - ox + rand() - 0.5; out[2 * i + 1] = (on[2 * j + 1] || 0) - h / 2 + rand() - 0.5; }
      return out;
    },
    q: 1, // default device-pixel ratio for rasters (the engine sets it)
  };

  /* chalk line: soft halo + slightly broken core stroke (pts in CSS px) */
  CH.line = function (ctx, pts, a = 1, w = 1.6, dash = true) {
    if (!pts || pts.length < 2 || a <= 0.003) return;
    const path = new Path2D(); path.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) path.lineTo(pts[i][0], pts[i][1]);
    ctx.save(); ctx.lineJoin = ctx.lineCap = "round";
    ctx.strokeStyle = `rgba(240,238,230,${0.22 * a})`; ctx.lineWidth = w * 2.1; ctx.stroke(path);
    if (dash) ctx.setLineDash([7, 1.4, 3, 1.1, 12, 1.8]);
    ctx.strokeStyle = `rgba(248,246,238,${0.86 * a})`; ctx.lineWidth = w; ctx.stroke(path);
    ctx.restore();
  };

  /* grain pattern: punch chalky holes into strokes (use with destination-out) */
  let grainCv = null;
  CH.grain = function () {
    if (grainCv) return grainCv;
    grainCv = document.createElement("canvas"); grainCv.width = grainCv.height = 96;
    const c = grainCv.getContext("2d"), r = mulberry32(42), d = c.createImageData(96, 96);
    for (let i = 0; i < 96 * 96; i++) { const v = r(); d.data[4 * i + 3] = v < 0.18 ? 210 : v < 0.4 ? 90 : 0; }
    c.putImageData(d, 0, 0);
    return grainCv;
  };

  /* the blackboard itself: base colour, soft smudges, old eraser sweeps and
     chalk-dust specks. Drawn once per resize into the static background canvas.
     The smudges and sweeps are faint, wide gradients, so they are painted at
     half size and scaled up: the same board for a quarter of the work. The
     specks are filled in a few brightness steps, not one by one. */
  CH.BOARD = "#0d0f0f";
  CH.paintBoard = function (ctx, W, H, o = {}) {
    const r = mulberry32(o.seed || 21), S = Math.max(0.5, Math.min(W / 960, H / 540));
    ctx.fillStyle = CH.BOARD; ctx.fillRect(0, 0, W, H);
    const Q = 2, lw = Math.ceil(W / Q) + 2, lh = Math.ceil(H / Q) + 2; // the small layer, with a margin of one cell
    const layer = (paint) => {
      const c = document.createElement("canvas"); c.width = lw; c.height = lh;
      const g = c.getContext("2d"); g.translate(1, 1); g.scale(1 / Q, 1 / Q); paint(g);
      // scaled up cell by cell: smoothing here would darken it a little, and the gradients are smooth anyway
      ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(c, -Q, -Q, lw * Q, lh * Q); ctx.restore();
    };
    layer((s) => {
      s.fillStyle = CH.BOARD; s.fillRect(-Q, -Q, W + 2 * Q, H + 2 * Q); // on the board colour: the faint layers add up as before
      const nSm = Math.round(90 * (W * H) / (960 * 1080)) + 12;
      for (let i = 0; i < nSm; i++) {
        const x = r() * W, y = r() * H, rr = (40 + r() * 230) * S, a = 0.007 + r() * 0.013;
        const g = s.createRadialGradient(x, y, 0, x, y, rr);
        g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(1, "rgba(255,255,255,0)");
        s.fillStyle = g; s.fillRect(x - rr, y - rr, 2 * rr, 2 * rr);
      }
      for (let i = 0; i < 7; i++) { // old eraser sweeps
        const y = r() * H, h = (30 + r() * 60) * S, g = s.createLinearGradient(0, y, 0, y + h);
        g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.5, `rgba(255,255,255,${0.008 + r() * 0.01})`); g.addColorStop(1, "rgba(255,255,255,0)");
        s.fillStyle = g; s.fillRect(-Q, y, W + 2 * Q, h);
      }
    });
    const specks = Math.round(W * H * 0.011), steps = 6, dust = Array.from({ length: steps }, () => new Path2D());
    for (let i = 0; i < specks; i++) { const a = r(); dust[Math.min(steps - 1, (a * steps) | 0)].rect(r() * W, r() * H, 1, 1); }
    dust.forEach((p, k) => { ctx.fillStyle = `rgba(255,255,255,${0.02 + 0.05 * (k + 0.5) / steps})`; ctx.fill(p); });
    // soft vignette so the edges of the board feel deeper (one fill, at full size)
    const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.6);
    v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,0.42)");
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  };

  G.WQ.CH = CH;
})(window);
