/* =============================================================================
   plot.js — small canvas plots in the site's chalk style (WQ.Plot)
   -----------------------------------------------------------------------------
   Used by the simulation pages (js/sims/). Axes and their labels are drawn in
   chalk; the data lines are crisp, in chalk colours (WQ.Plot.COLORS).

     const p = WQ.Plot.create(canvas, { x: [0, 60], y: [0, 1], xLabel: "t", yLabel: "X_t" });
     p.onResize(draw);              // redraw when the canvas changes size
     function draw() {
       p.clear();                   // axes, ticks, labels (the background stays clear)
       p.line(null, values, WQ.Plot.COLORS.white, { dots: true });   // xs = 0, 1, 2, … when null
       p.hline(0.6875, WQ.Plot.COLORS.yellow, { dash: [6, 5], label: "x*" });
     }

   Labels: "X_t" is written as X with a subscript t (also "|E_t|", "R_m").
   Log axis: { log: true, y: [1e-16, 1] } (decades are labelled 10^k).
   hline/vline labels: { label: "x*" } (hline: labelAt: "left" puts it on the left).
   Phase planes: p.field(fn), p.marker(x, y, "stable" | "unstable" | "saddle" | "center"),
   p.line(..., { arrowAt: 0.3 }), p.fill(xs, ys, color), p.band(xs, lo, hi, color), p.onTap(cb).
   HOW TO EDIT: COLORS (data colours), FONT_* (tick and axis label fonts),
   the default padding in create().
   ============================================================================= */
(function (G) {
  "use strict";
  const WQ = (G.WQ = G.WQ || {});

  const COLORS = {
    white: "#f6f4ec",   // main trajectory, the reference run
    yellow: "#f2d675",  // error 0.1, equilibrium line, R_m marker
    blue: "#9cc9f0",    // error 0.01, 2-cycle lines
    pink: "#f2a7c3",    // error 0.00001
    orange: "#f0b27a",  // the custom error
    green: "#7dff8a",   // terminal boxes
  };
  const FONT_TICK = '500 11px "WQ Sans", Inter, system-ui, sans-serif';
  const FONT_AXIS = 'italic 14px "WQ Serif", "Latin Modern Roman", Georgia, serif';
  const FONT_SUB = 'italic 10px "WQ Serif", "Latin Modern Roman", Georgia, serif';
  const INK = "246,244,236";

  /* tick positions: 1-2-5 steps, about n ticks */
  function niceTicks(a, b, n = 6) {
    const span = b - a; if (!(span > 0)) return [a];
    const raw = span / n, mag = Math.pow(10, Math.floor(Math.log10(raw))), r = raw / mag;
    const step = (r < 1.5 ? 1 : r < 3.5 ? 2 : r < 7.5 ? 5 : 10) * mag;
    const out = [];
    for (let v = Math.ceil(a / step - 1e-9) * step; v <= b + step * 1e-9; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
    return out;
  }
  const decimals = (step) => Math.max(0, Math.min(6, -Math.floor(Math.log10(step) + 1e-9)));
  const fmtTick = (v, d) => (v < 0 ? "−" : "") + Math.abs(v).toFixed(d);

  /* text with an optional subscript: "X_t" → X, small t; "|E_t|" → |E, t, | */
  function label(ctx, text, x, y, align = "left", color = `rgba(${INK},0.8)`, measure = false) {
    const m = /^(.*?)_(\w+)(.*)$/.exec(text);
    const base = m ? m[1] : text, sub = m ? m[2] : "", tail = m ? m[3] : "";
    ctx.save(); ctx.fillStyle = color; ctx.textBaseline = "alphabetic";
    ctx.font = FONT_AXIS; const wb = ctx.measureText(base).width, wt = ctx.measureText(tail).width;
    ctx.font = FONT_SUB; const ws = sub ? ctx.measureText(sub).width + 1 : 0;
    const w = wb + ws + wt; let x0 = align === "center" ? x - w / 2 : align === "right" ? x - w : x;
    if (measure) { ctx.restore(); return w; }
    ctx.font = FONT_AXIS; ctx.textAlign = "left"; ctx.fillText(base, x0, y);
    if (sub) { ctx.font = FONT_SUB; ctx.fillText(sub, x0 + wb + 0.5, y + 4); }
    if (tail) { ctx.font = FONT_AXIS; ctx.fillText(tail, x0 + wb + ws, y); }
    ctx.restore();
    return w;
  }

  function create(canvas, o = {}) {
    const ctx = canvas.getContext("2d");
    const P = {
      canvas, ctx, W: 0, H: 0, dpr: 1,
      x: o.x || [0, 1], y: o.y || [0, 1], log: !!o.log,
      xLabel: o.xLabel || "", yLabel: o.yLabel || "",
      pad: Object.assign({ l: 50, r: 14, t: 14, b: 38 }, o.pad || {}),
      area: { l: 0, t: 0, r: 0, b: 0, w: 0, h: 0 },
    };

    P.set = function (opts) { Object.assign(P, opts); layout(); return P; };
    function layout() {
      const a = P.area; a.l = P.pad.l; a.t = P.pad.t; a.r = P.W - P.pad.r; a.b = P.H - P.pad.b;
      a.w = Math.max(10, a.r - a.l); a.h = Math.max(10, a.b - a.t);
    }
    /* match the canvas to its CSS size; true when it changed */
    P.resize = function () {
      const W = Math.round(canvas.clientWidth), H = Math.round(canvas.clientHeight), dpr = Math.min(G.devicePixelRatio || 1, 2);
      if (W === P.W && H === P.H && dpr === P.dpr) return false;
      P.W = W; P.H = H; P.dpr = dpr;
      canvas.width = Math.max(1, Math.round(W * dpr)); canvas.height = Math.max(1, Math.round(H * dpr));
      layout();
      return true;
    };
    P.onResize = function (cb) {
      let raf = 0;
      const go = () => { raf = 0; if (P.resize()) cb(); };
      if (G.ResizeObserver) new ResizeObserver(() => { if (!raf) raf = G.requestAnimationFrame(go); }).observe(canvas);
      else G.addEventListener("resize", () => { if (!raf) raf = G.requestAnimationFrame(go); });
      P.resize();
      return P;
    };

    const ly = (v) => Math.log10(Math.max(v, P.y[0]));
    P.toPx = function (x, y) {
      const a = P.area;
      const u = (x - P.x[0]) / (P.x[1] - P.x[0]);
      const v = P.log ? (ly(y) - Math.log10(P.y[0])) / (Math.log10(P.y[1]) - Math.log10(P.y[0])) : (y - P.y[0]) / (P.y[1] - P.y[0]);
      return [a.l + u * a.w, a.b - v * a.h];
    };
    P.fromPx = function (px, py) {
      const a = P.area, u = (px - a.l) / a.w, v = (a.b - py) / a.h;
      const x = P.x[0] + u * (P.x[1] - P.x[0]);
      const y = P.log ? Math.pow(10, Math.log10(P.y[0]) + v * (Math.log10(P.y[1]) - Math.log10(P.y[0]))) : P.y[0] + v * (P.y[1] - P.y[0]);
      return [x, y];
    };
    P.inside = (px, py) => px >= P.area.l && px <= P.area.r && py >= P.area.t && py <= P.area.b;

    /* background (clear), faint grid, chalk axes, ticks and labels */
    P.clear = function () {
      const a = P.area;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(P.dpr, 0, 0, P.dpr, 0, 0);
      ctx.save(); ctx.font = FONT_TICK; ctx.fillStyle = `rgba(${INK},0.52)`;
      // x ticks
      const xt = niceTicks(P.x[0], P.x[1], Math.max(3, Math.min(8, Math.round(a.w / 80)))), xd = decimals(xt.length > 1 ? xt[1] - xt[0] : 1);
      ctx.textAlign = "center"; ctx.textBaseline = "top";
      for (const v of xt) {
        const [px] = P.toPx(v, P.y[0]);
        ctx.strokeStyle = `rgba(${INK},0.07)`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(px, a.t); ctx.lineTo(px, a.b); ctx.stroke();
        ctx.strokeStyle = `rgba(${INK},0.55)`; ctx.beginPath(); ctx.moveTo(px, a.b); ctx.lineTo(px, a.b + 5); ctx.stroke();
        ctx.fillText(fmtTick(v, xd), px, a.b + 8);
      }
      // y ticks
      ctx.textAlign = "right"; ctx.textBaseline = "middle";
      if (P.log) {
        const e0 = Math.ceil(Math.log10(P.y[0]) - 1e-9), e1 = Math.floor(Math.log10(P.y[1]) + 1e-9);
        const every = Math.max(1, Math.ceil((e1 - e0) / Math.max(2, Math.floor(a.h / 34))));
        for (let e = e1; e >= e0; e -= every) {
          const [, py] = P.toPx(P.x[0], Math.pow(10, e));
          ctx.strokeStyle = `rgba(${INK},0.07)`; ctx.beginPath(); ctx.moveTo(a.l, py); ctx.lineTo(a.r, py); ctx.stroke();
          ctx.strokeStyle = `rgba(${INK},0.55)`; ctx.beginPath(); ctx.moveTo(a.l - 5, py); ctx.lineTo(a.l, py); ctx.stroke();
          const ex = e === 0 ? "0" : (e < 0 ? "−" : "") + Math.abs(e);
          ctx.font = '500 9px "WQ Sans", Inter, system-ui, sans-serif'; const we = ctx.measureText(ex).width;
          ctx.fillText(ex, a.l - 8, py - 5);
          ctx.font = FONT_TICK; ctx.fillText("10", a.l - 9 - we, py + 1);
        }
      } else {
        const yt = niceTicks(P.y[0], P.y[1], Math.max(3, Math.min(7, Math.round(a.h / 50)))), yd = decimals(yt.length > 1 ? yt[1] - yt[0] : 1);
        for (const v of yt) {
          const [, py] = P.toPx(P.x[0], v);
          ctx.strokeStyle = `rgba(${INK},0.07)`; ctx.beginPath(); ctx.moveTo(a.l, py); ctx.lineTo(a.r, py); ctx.stroke();
          ctx.strokeStyle = `rgba(${INK},0.55)`; ctx.beginPath(); ctx.moveTo(a.l - 5, py); ctx.lineTo(a.l, py); ctx.stroke();
          ctx.fillText(fmtTick(v, yd), a.l - 8, py);
        }
      }
      ctx.restore();
      // the two axes, in chalk
      const line = WQ.CH && WQ.CH.line;
      if (line) line(ctx, [[a.l, a.t - 4], [a.l, a.b], [a.r + 4, a.b]], 0.6, 1.4, false);
      else { ctx.strokeStyle = `rgba(${INK},0.6)`; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(a.l, a.t); ctx.lineTo(a.l, a.b); ctx.lineTo(a.r, a.b); ctx.stroke(); }
      // axis labels
      if (P.xLabel) label(ctx, P.xLabel, a.l + a.w / 2, P.H - 4, "center");
      if (P.yLabel) { ctx.save(); ctx.translate(13, a.t + a.h / 2); ctx.rotate(-Math.PI / 2); label(ctx, P.yLabel, 0, 0, "center"); ctx.restore(); }
      return P;
    };

    const clip = () => { ctx.save(); ctx.beginPath(); ctx.rect(P.area.l, P.area.t - 1, P.area.w + 1, P.area.h + 2); ctx.clip(); };
    /* a data line; xs = null means 0, 1, 2, … */
    P.line = function (xs, ys, color, o = {}) {
      const n = ys.length; if (!n) return P;
      clip(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.globalAlpha = o.alpha ?? 1;
      ctx.lineWidth = o.width || 1.6; ctx.lineJoin = ctx.lineCap = "round"; if (o.dash) ctx.setLineDash(o.dash);
      ctx.beginPath();
      for (let i = 0; i < n; i++) { const [px, py] = P.toPx(xs ? xs[i] : i, ys[i]); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      ctx.stroke(); ctx.setLineDash([]);
      if (o.arrowAt != null && n > 1) { // a small arrowhead along the path, at that share of its length
        const pts = []; let total = 0;
        for (let i = 0; i < n; i++) { const q = P.toPx(xs ? xs[i] : i, ys[i]); if (i) total += Math.hypot(q[0] - pts[i - 1][0], q[1] - pts[i - 1][1]); pts.push(q); }
        let goal = total * Math.min(1, Math.max(0, o.arrowAt)), acc = 0;
        for (let i = 1; i < n && total > 0; i++) {
          const dl = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
          if (acc + dl >= goal && dl > 0) { const u = (goal - acc) / dl; arrowHead(pts[i - 1][0] + u * (pts[i][0] - pts[i - 1][0]), pts[i - 1][1] + u * (pts[i][1] - pts[i - 1][1]), pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], 7); break; }
          acc += dl;
        }
      }
      if (o.dots) {
        const r = o.dotR || (n > 150 ? 1.4 : n > 70 ? 2 : 2.6);
        for (let i = 0; i < n; i++) { const [px, py] = P.toPx(xs ? xs[i] : i, ys[i]); ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill(); }
      }
      ctx.restore();
      return P;
    };
    P.hline = function (y, color, o = {}) {
      if (y < Math.min(P.y[0], P.y[1]) || y > Math.max(P.y[0], P.y[1])) return P;
      const [, py] = P.toPx(P.x[0], y);
      ctx.save(); ctx.strokeStyle = color; ctx.globalAlpha = o.alpha ?? 0.85; ctx.lineWidth = o.width || 1.2; ctx.setLineDash(o.dash || [6, 5]);
      ctx.beginPath(); ctx.moveTo(P.area.l, py); ctx.lineTo(P.area.r, py); ctx.stroke(); ctx.restore();
      if (o.label) o.labelAt === "left" ? label(ctx, o.label, P.area.l + 6, py - 5, "left", color) : label(ctx, o.label, P.area.r - 4, py - 5, "right", color);
      return P;
    };
    P.vline = function (x, color, o = {}) {
      if (x < P.x[0] || x > P.x[1]) return P;
      const [px] = P.toPx(x, P.y[0]);
      ctx.save(); ctx.strokeStyle = color; ctx.globalAlpha = o.alpha ?? 0.9; ctx.lineWidth = o.width || 1.4; if (o.dash) ctx.setLineDash(o.dash);
      ctx.beginPath(); ctx.moveTo(px, P.area.t); ctx.lineTo(px, P.area.b); ctx.stroke(); ctx.restore();
      if (o.label) { // (with subscripts, like the axis labels)
        const w = label(ctx, o.label, 0, 0, "left", color, true), right = px + 8 + w < P.area.r;
        ctx.save(); ctx.fillStyle = "rgba(13,15,15,0.8)"; ctx.fillRect(right ? px + 3 : px - w - 11, P.area.t + 1, w + 8, 21); ctx.restore();
        label(ctx, o.label, right ? px + 7 : px - 7, P.area.t + 16, right ? "left" : "right", color);
      }
      return P;
    };
    /* a prepared canvas of the same pixel size as this one (e.g. dots) */
    P.image = function (cv) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(cv, 0, 0); ctx.restore(); return P; };
    /* a dashed selection rectangle (data coordinates) */
    P.rect = function (x0, y0, x1, y1, color = `rgba(${INK},0.9)`) {
      const [ax, ay] = P.toPx(x0, y0), [bx, by] = P.toPx(x1, y1);
      ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.setLineDash([4, 3]); ctx.fillStyle = `rgba(${INK},0.06)`;
      ctx.fillRect(Math.min(ax, bx), Math.min(ay, by), Math.abs(bx - ax), Math.abs(by - ay));
      ctx.strokeRect(Math.min(ax, bx) + 0.5, Math.min(ay, by) + 0.5, Math.abs(bx - ax), Math.abs(by - ay)); ctx.restore();
      return P;
    };
    /* legend in the top-right corner: [{ label, color }] */
    P.legend = function (items) {
      if (!items.length) return P;
      ctx.save(); ctx.font = FONT_TICK;
      const w = Math.max(...items.map((it) => ctx.measureText(it.label).width)) + 30, h = items.length * 16 + 8;
      const x = P.area.r - w - 6, y = P.area.t + 6;
      ctx.fillStyle = "rgba(13,15,15,0.82)"; ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = `rgba(${INK},0.18)`; ctx.strokeRect(x + 0.5, y + 0.5, w, h);
      ctx.textBaseline = "middle";
      items.forEach((it, i) => {
        const yy = y + 12 + i * 16;
        ctx.strokeStyle = it.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 7, yy); ctx.lineTo(x + 21, yy); ctx.stroke();
        ctx.fillStyle = `rgba(${INK},0.85)`; ctx.fillText(it.label, x + 26, yy);
      });
      ctx.restore();
      return P;
    };
    P.text = function (s, x, y, o = {}) { // free text at data coordinates
      const [px, py] = P.toPx(x, y);
      ctx.save(); ctx.font = o.font || FONT_TICK; ctx.fillStyle = o.color || `rgba(${INK},0.7)`; ctx.textAlign = o.align || "left"; ctx.textBaseline = o.baseline || "alphabetic";
      ctx.fillText(s, px + (o.dx || 0), py + (o.dy || 0)); ctx.restore();
      return P;
    };

    /* an arrowhead at (px, py) pointing along (dx, dy), in pixels (uses the current stroke style) */
    function arrowHead(px, py, dx, dy, size) {
      const L = Math.hypot(dx, dy); if (!(L > 0)) return;
      const ux = dx / L, uy = dy / L, s = size, w = s * 0.55;
      ctx.beginPath();
      ctx.moveTo(px - ux * s - uy * w, py - uy * s + ux * w); ctx.lineTo(px, py); ctx.lineTo(px - ux * s + uy * w, py - uy * s - ux * w);
      ctx.stroke();
    }
    /* direction field: fn(x, y) → [dx, dy] in data units per unit time, on an n×n grid of cell centres */
    P.field = function (fn, o = {}) {
      const n = o.n || (P.W < 500 ? 11 : 15), a = P.area, cw = a.w / n, chh = a.h / n, L = (o.len || 0.4) * Math.min(cw, chh);
      const sx = a.w / (P.x[1] - P.x[0]), sy = a.h / (P.y[1] - P.y[0]);
      clip(); ctx.strokeStyle = o.color || `rgba(${INK},0.3)`; ctx.lineWidth = 1; ctx.lineCap = "round";
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        const px = a.l + (i + 0.5) * cw, py = a.t + (j + 0.5) * chh, [x, y] = P.fromPx(px, py);
        const v = fn(x, y); if (!v) continue;
        const ddx = v[0] * sx, ddy = -v[1] * sy, sp = Math.hypot(ddx, ddy);
        if (!(sp > 0) || !Number.isFinite(sp)) continue;
        const ux = ddx / sp, uy = ddy / sp;
        ctx.beginPath(); ctx.moveTo(px - ux * L / 2, py - uy * L / 2); ctx.lineTo(px + ux * L / 2, py + uy * L / 2); ctx.stroke();
        arrowHead(px + ux * L / 2, py + uy * L / 2, ux, uy, Math.min(4, L * 0.35));
      }
      ctx.restore();
      return P;
    };
    /* equilibrium marker: "stable" filled, "unstable" open, "saddle" half filled, "center"/"neutral" dashed ring */
    P.marker = function (x, y, kind, o = {}) {
      const [px, py] = P.toPx(x, y), r = o.r || 5, color = o.color || COLORS.white;
      if (!Number.isFinite(px) || !Number.isFinite(py)) return P;
      ctx.save(); ctx.lineWidth = 1.6; ctx.strokeStyle = color;
      ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2);
      if (kind === "stable") { ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = "#0d0f0f"; ctx.lineWidth = 1; ctx.stroke(); }
      else if (kind === "saddle") {
        ctx.fillStyle = "#0d0f0f"; ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(px, py, r, Math.PI / 2, (3 * Math.PI) / 2); ctx.closePath(); ctx.fillStyle = color; ctx.fill();
      } else {
        if (kind === "center" || kind === "neutral") ctx.setLineDash([2.5, 2]);
        ctx.fillStyle = "#0d0f0f"; ctx.fill(); ctx.stroke();
      }
      ctx.restore();
      if (o.label) {
        ctx.save(); ctx.font = FONT_TICK; const w = ctx.measureText(o.label).width;
        let lx = px + r + 3, ly = py - r - 2;
        if (lx + w > P.area.r) lx = px - r - 3 - w;
        if (ly - 10 < P.area.t) ly = py + r + 12;
        ctx.fillStyle = `rgba(${INK},0.85)`; ctx.fillText(o.label, lx, ly); ctx.restore();
      }
      return P;
    };
    /* a filled polygon (data coordinates), clipped to the plot area */
    P.fill = function (xs, ys, color) {
      if (!xs.length) return P;
      clip(); ctx.fillStyle = color; ctx.beginPath();
      for (let i = 0; i < xs.length; i++) { const [px, py] = P.toPx(xs[i], ys[i]); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      ctx.closePath(); ctx.fill(); ctx.restore();
      return P;
    };
    /* the area between two curves lo(x) and hi(x) */
    P.band = function (xs, lo, hi, color) {
      const X = [], Y = [];
      for (let i = 0; i < xs.length; i++) { X.push(xs[i]); Y.push(hi[i]); }
      for (let i = xs.length - 1; i >= 0; i--) { X.push(xs[i]); Y.push(lo[i]); }
      return P.fill(X, Y, color);
    };
    /* tap or click inside the plot area → cb(x, y) in data coordinates (a drag still scrolls the page) */
    P.onTap = function (cb) {
      let down = null;
      canvas.addEventListener("pointerdown", (e) => { down = { x: e.clientX, y: e.clientY, t: Date.now(), id: e.pointerId }; });
      canvas.addEventListener("pointercancel", () => { down = null; });
      canvas.addEventListener("pointerup", (e) => {
        const d = down; down = null;
        if (!d || d.id !== e.pointerId || Date.now() - d.t > 500 || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8) return;
        const r = canvas.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
        if (!P.inside(px, py)) return;
        const [x, y] = P.fromPx(px, py); cb(x, y);
      });
      return P;
    };

    layout();
    return P;
  }

  WQ.Plot = { create, COLORS, niceTicks, label };
})(window);
