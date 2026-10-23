/* =============================================================================
   Mathematical Simulations — "pursuit & flocking"                (section 2)
   -----------------------------------------------------------------------------
   • Bottom strip: a hare runs flat out; a pack of wolves gallops behind it,
     the gaps opening and closing (smooth noise). The ground scrolls past.
   • Sky (right): a live boids flock (separation, alignment, cohesion) that
     scatters when a falcon dives through.
   • Faint, all over: three living graphs — a Lotka–Volterra phase portrait
     with the population state circling its orbit, the two population cycles
     scrolling in time, and stochastic (Ornstein–Uhlenbeck) paths spreading
     out — plus equations that write themselves, rest, fade and reappear
     somewhere else.
   HOW TO EDIT: PACK (wolves), BIRDS, GRAPH_A (graph faintness), EQS.
   ============================================================================= */
(function (G) {
  "use strict";
  const { L, C, CH, PTS } = G.WQ;
  const { lerp, clamp, smooth, Ease, TAU, Rig, drawOutline, mulberry32, fract, makeNoise, gauss } = L;
  const INK = "246,244,236", BG = CH.BOARD;
  const PACK = [{ x: 0.5, d: 0, ph: 0.0 }, { x: 0.3, d: 1, ph: 0.37 }, { x: 0.12, d: 0.45, ph: 0.71 }]; // base x (fraction), depth, gait phase
  const PACK_PHONE = [{ x: 0.47, d: 0, ph: 0.0 }, { x: 0.15, d: 0.6, ph: 0.45 }];                       // phones: two wolves
  const BIRDS = { desktop: 130, phone: 46 };
  const GRAPH_A = 0.26;     // how bright the background graphs are
  const EQS = ["lv_inline", "logistic", "vicsek", "pursuit", "replicator", "ou", "fokker_planck", "comp_lv", "random_walk", "diffusion", "lanchester", "ito"];
  const LV = { a: 1, b: 0.5, g: 0.75, d: 0.25, XM: 9.5, YM: 6.4 };

  (G.WQ.scenes = G.WQ.scenes || {}).simulations = function (env0) {
    let env = env0, W = 0, H = 0, S = 1, portrait = false, mobile = false, box = null;
    let GY, SC, V, camX = 0, built = false, t = 0;
    const rW = PACK.map(() => new Rig()), rH = new Rig(), nz = makeNoise(13);
    let pack = PACK;
    let birds = [], falcon = { x: -999, y: -999, on: false }, flockBox, tufts = [], dust = [], slots = [], panels = {}, orbit = [], nest = [], period = 0, paths = [];
    const nn = [0, 0];

    /* ---------------------------------------------------------- Lotka–Volterra data */
    const f = (x, y) => [LV.a * x - LV.b * x * y, LV.d * x * y - LV.g * y];
    function rk4(x, y, h) {
      const k1 = f(x, y), k2 = f(x + h * k1[0] / 2, y + h * k1[1] / 2), k3 = f(x + h * k2[0] / 2, y + h * k2[1] / 2), k4 = f(x + h * k3[0], y + h * k3[1]);
      return [x + h / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]), y + h / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1])];
    }
    function buildLV() {
      const h = 0.01; let x = 5.6, y = 0.9, tt = 0; orbit = [[x, y]];
      for (let i = 0; i < 40000; i++) { const py = y; [x, y] = rk4(x, y, h); tt += h; orbit.push([x, y]); if (i > 50 && py < 0.9 && y >= 0.9 && x > 3) break; }
      period = tt;
      nest = [3.6, 4.6, 6.8, 8.2].map((x0) => { let a = x0, b = LV.a / LV.b; const pts = [[a, b]]; for (let i = 0; i < 8000; i++) { [a, b] = rk4(a, b, 0.02); pts.push([a, b]); if (i > 60 && Math.hypot(a - x0, b - LV.a / LV.b) < 0.05) break; } return pts; });
    }
    const lvAt = (mt) => orbit[Math.min(orbit.length - 1, Math.floor((((mt % period) + period) % period) / 0.01))];
    function buildPaths() { // Ornstein–Uhlenbeck sample paths (Euler–Maruyama)
      const r = mulberry32(100), n = mobile ? 22 : 40, steps = 240, dt = 4 / steps; paths = [];
      for (let p = 0; p < n; p++) { const a = new Float32Array(steps + 1); a[0] = 2.4; for (let k = 0; k < steps; k++) a[k + 1] = a[k] + 1.1 * (0 - a[k]) * dt + 0.85 * Math.sqrt(dt) * gauss(r); paths.push(a); }
    }

    /* ---------------------------------------------------------- layout */
    function layout() {
      S = Math.min(W / 960, H / 540);
      GY = portrait ? H * 0.9 : H * 0.87;
      SC = portrait ? W * 0.0026 : Math.min(W / 900, H / 520) * 0.95;
      pack = portrait ? PACK_PHONE : PACK;
      V = W * (portrait ? 0.95 : 0.7);
      const tb = box || { x: W * 0.06, y: H * 0.14, w: W * 0.4, h: H * 0.3 }; // the text block
      const top = portrait ? tb.y + tb.h + H * 0.03 : H * 0.07;
      // sky for the flock: right of the text on desktop, under it on phones
      flockBox = portrait ? { x0: W * 0.08, x1: W * 0.92, y0: top, y1: top + H * 0.16 } : { x0: Math.max(tb.x + tb.w + W * 0.04, W * 0.5), x1: W * 0.96, y0: H * 0.06, y1: H * 0.42 };
      // graph panels in the middle band (faint)
      const gy0 = portrait ? flockBox.y1 + H * 0.02 : Math.max(tb.y + tb.h + H * 0.045, H * 0.45), gy1 = GY - (portrait ? H * 0.15 : H * 0.155);
      const gh = Math.max(40, gy1 - gy0);
      if (portrait) {
        panels.phase = { x0: W * 0.08, x1: W * 0.46, y0: gy0, y1: gy0 + gh };
        panels.ts = { x0: W * 0.54, x1: W * 0.94, y0: gy0, y1: gy0 + gh * 0.45 };
        panels.sde = { x0: W * 0.54, x1: W * 0.94, y0: gy0 + gh * 0.55, y1: gy0 + gh };
      } else {
        panels.phase = { x0: W * 0.06, x1: W * 0.27, y0: gy0, y1: gy0 + gh };
        panels.ts = { x0: W * 0.36, x1: W * 0.62, y0: gy0 + gh * 0.1, y1: gy0 + gh * 0.9 };
        panels.sde = { x0: W * 0.7, x1: W * 0.95, y0: gy0, y1: gy0 + gh };
      }
    }
    function build() {
      const r = mulberry32(31);
      const nb = mobile ? BIRDS.phone : BIRDS.desktop;
      birds = [];
      for (let i = 0; i < nb; i++) { const a = r() * TAU; birds.push({ x: lerp(flockBox.x0, flockBox.x1, 0.3 + 0.4 * r()), y: lerp(flockBox.y0, flockBox.y1, 0.3 + 0.4 * r()), vx: 60 * Math.cos(a), vy: 30 * Math.sin(a), f: r() * 6, r: r() }); }
      for (let i = 0; i < 120; i++) stepBirds(1 / 30, i / 30 - 4); // let the flock settle before it is first seen
      tufts = [];
      for (let i = 0; i < (mobile ? 50 : 90); i++) tufts.push({ wx: r() * W * 1.6, h: (3 + r() * 7) * S, n: 2 + ((r() * 3) | 0), y: r() * 22 * S, a: 0.15 + r() * 0.25 });
      // equation slots: each writes an equation, rests, fades, then reappears elsewhere
      slots = [];
      const ns = mobile ? 4 : 7;
      for (let i = 0; i < ns; i++) slots.push({ per: 9 + 5 * r(), ph: r() * 9, seed: (r() * 1e6) | 0 });
      built = true;
    }
    // where a slot's equation sits during cycle c (avoids the text and the chase strip)
    function slotSpot(s, c) {
      const r = mulberry32(s.seed + c * 977), id = EQS[(s.seed + c * 5) % EQS.length], px = (12 + 6 * r()) * Math.max(0.8, S);
      const [w, h] = CH.size(id, px);
      for (let k = 0; k < 12; k++) {
        const x = lerp(W * 0.03, W * 0.97 - w, r()), y = lerp(H * 0.05, GY - H * 0.24, r());
        if (box && x < box.x + box.w + 30 && x + w > box.x - 30 && y + h / 2 > box.y - 30 && y - h / 2 < box.y + box.h + 30) continue;
        return { id, px, x, y };
      }
      return { id, px, x: W * 0.6, y: H * 0.5 };
    }

    /* ---------------------------------------------------------- the chase */
    const hareX = (tt) => W * ((portrait ? 0.8 : 0.72) + 0.035 * Math.sin(tt * 0.9) + 0.02 * nz.n2(tt * 0.3, 5));
    const wolfX = (w, tt) => W * (w.x + 0.03 * nz.n2(tt * 0.35, w.ph * 9) + 0.035 * Math.max(0, Math.sin(tt * 0.7 + w.ph * 4)) * (w.d === 0 ? 1.1 : 0.7));
    const wolfY = (w) => GY - 12 * S * w.d;
    const wolfS = (w) => SC * (1 - 0.12 * w.d);

    /* ---------------------------------------------------------- boids */
    function stepBirds(dt, tt) {
      const fb = flockBox, cx = lerp(fb.x0, fb.x1, 0.5 + 0.28 * Math.sin(tt * 0.17)), cy = lerp(fb.y0, fb.y1, 0.5 + 0.2 * Math.sin(tt * 0.29 + 1));
      const Rn = 60 * Math.max(0.7, S), Rs = 9 * Math.max(0.7, S), maxV = 150 * Math.max(0.7, S), minV = 55 * Math.max(0.7, S), n = birds.length;
      for (let i = 0; i < n; i++) {
        const b = birds[i];
        let ax = 0, ay = 0, cxs = 0, cys = 0, vxs = 0, vys = 0, sx = 0, sy = 0, k = 0;
        for (let j = 0; j < n; j++) {
          if (i === j) continue;
          const o = birds[j], dx = o.x - b.x, dy = o.y - b.y, d2 = dx * dx + dy * dy;
          if (d2 < Rn * Rn) { k++; cxs += o.x; cys += o.y; vxs += o.vx; vys += o.vy; if (d2 < Rs * Rs) { const d = Math.sqrt(d2) + 0.01; sx -= dx / d; sy -= dy / d; } }
        }
        if (k) { ax += (cxs / k - b.x) * 1.8 + (vxs / k - b.vx) * 2.2; ay += (cys / k - b.y) * 1.8 + (vys / k - b.vy) * 2.2; }
        ax += sx * 90; ay += sy * 90;
        ax += (cx - b.x) * 0.22; ay += (cy - b.y) * 0.3;
        nz.curl(b.x * 0.003, b.y * 0.003, tt * 0.15, nn); ax += nn[0] * 60; ay += nn[1] * 60;
        const wk = portrait ? 18 : 8;
        if (b.y < fb.y0) ay += (fb.y0 - b.y) * 12; if (b.y > fb.y1) ay -= (b.y - fb.y1) * 12; if (b.x < fb.x0) ax += (fb.x0 - b.x) * wk; if (b.x > fb.x1) ax -= (b.x - fb.x1) * wk;
        const fx = b.x - falcon.x, fy = b.y - falcon.y, fd = Math.hypot(fx, fy);
        if (fd < 90) { ax += (fx / fd) * 900 * (1 - fd / 90); ay += (fy / fd) * 900 * (1 - fd / 90); }
        b.vx += ax * dt; b.vy += ay * dt;
        const sp = Math.hypot(b.vx, b.vy); if (sp > maxV) { b.vx *= maxV / sp; b.vy *= maxV / sp; }
        if (sp < minV) { b.vx *= minV / (sp + 0.01); b.vy *= minV / (sp + 0.01); }
        b.x += b.vx * dt; b.y += b.vy * dt; b.f += dt * (9 + b.r * 4);
      }
      const fp = fract(tt / 7);
      falcon.on = fp > 0.5 && fp < 0.85;
      const u = clamp((fp - 0.5) / 0.35, 0, 1);
      falcon.x = falcon.on ? lerp(fb.x1 + 60, fb.x0 - 60, u) : -999;
      falcon.y = falcon.on ? lerp(fb.y0, fb.y1, Math.sin(Math.PI * u) * 0.8) : -999;
    }

    /* ---------------------------------------------------------- graphs */
    const GA = (a) => a * GRAPH_A;
    function axes(ctx, p, a) { CH.line(ctx, [[p.x0, p.y0], [p.x0, p.y1], [p.x1, p.y1]], GA(a) * 1.6, 1.1, false); }
    function drawPhase(ctx, a, tt) {
      const p = panels.phase, X = (x) => lerp(p.x0, p.x1, x / LV.XM), Y = (y) => lerp(p.y1, p.y0, y / LV.YM);
      axes(ctx, p, a);
      for (const o of nest) CH.line(ctx, o.map(([x, y]) => [X(x), Y(y)]), GA(a) * 0.8, 1, false);
      CH.line(ctx, orbit.filter((_, i) => i % 4 === 0).map(([x, y]) => [X(x), Y(y)]), GA(a) * 1.4, 1.2, false);
      ctx.save(); ctx.setLineDash([4, 5]); ctx.strokeStyle = `rgba(${INK},${GA(a) * 0.9})`; ctx.lineWidth = 1; ctx.beginPath();
      ctx.moveTo(X(LV.g / LV.d), p.y0); ctx.lineTo(X(LV.g / LV.d), p.y1); ctx.moveTo(p.x0, Y(LV.a / LV.b)); ctx.lineTo(p.x1, Y(LV.a / LV.b)); ctx.stroke(); ctx.restore();
      const mt = tt * period / 9;
      for (let k = 24; k >= 1; k--) { const q0 = lvAt(mt - k * 0.07), q1 = lvAt(mt - (k - 1) * 0.07); ctx.strokeStyle = `rgba(${INK},${GA(a) * 2.6 * (1 - k / 24)})`; ctx.lineWidth = 2.4 * (1 - k / 24) + 0.5; ctx.beginPath(); ctx.moveTo(X(q0[0]), Y(q0[1])); ctx.lineTo(X(q1[0]), Y(q1[1])); ctx.stroke(); }
      const q = lvAt(mt); ctx.fillStyle = `rgba(255,253,244,${GA(a) * 3.2})`; ctx.beginPath(); ctx.arc(X(q[0]), Y(q[1]), 3.2 * Math.max(0.8, S), 0, TAU); ctx.fill();
      CH.draw(ctx, "ax_prey", 10 * Math.max(0.85, S), p.x1, p.y1 + 13 * S, { alpha: GA(a) * 2, align: "right" });
    }
    function drawSeries(ctx, a, tt) {
      const p = panels.ts, head = tt * period / 9, win = 2 * period;
      axes(ctx, p, a);
      for (const [k, dash] of [[0, false], [1, true]]) {
        const pts = []; for (let i = 0; i <= 120; i++) { const u = i / 120, v = lvAt(head - (1 - u) * win); pts.push([lerp(p.x0, p.x1, u), lerp(p.y1, p.y0, (k ? v[1] * 1.3 : v[0]) / 9.5)]); }
        if (dash) { ctx.save(); ctx.setLineDash([6, 5]); CH.line(ctx, pts, GA(a) * 1.4, 1.2, false); ctx.restore(); } else CH.line(ctx, pts, GA(a) * 1.7, 1.3, false);
      }
      CH.draw(ctx, "ax_xt", 10 * Math.max(0.85, S), p.x0 + 6, p.y0 - 8 * S, { alpha: GA(a) * 2 });
    }
    function drawPaths(ctx, a, tt) {
      const p = panels.sde, cyc = 8, u = fract(tt / cyc), k = Math.floor(240 * Ease.sine(clamp(u / 0.75, 0, 1))), fade = 1 - smooth(0.88, 1, u);
      axes(ctx, p, a);
      const Y = (v) => lerp(p.y1, p.y0, (v + 3) / 6), X = (i) => lerp(p.x0, p.x1, i / 240);
      ctx.strokeStyle = `rgba(${INK},${GA(a) * 0.55 * fade})`; ctx.lineWidth = 1; ctx.beginPath();
      for (const pa of paths) { ctx.moveTo(X(0), Y(pa[0])); for (let i = 3; i <= k; i += 3) ctx.lineTo(X(i), Y(pa[i])); }
      ctx.stroke();
      ctx.save(); ctx.setLineDash([5, 5]); ctx.strokeStyle = `rgba(${INK},${GA(a) * 1.3 * fade})`; ctx.beginPath();
      for (const z of [0, 2, -2]) for (let i = 0; i <= k; i += 6) { const tm = (i / 240) * 4, m = 2.4 * Math.exp(-1.1 * tm), sd = 0.85 * Math.sqrt((1 - Math.exp(-2.2 * tm)) / 2.2), y = Y(m + z * sd); i ? ctx.lineTo(X(i), y) : ctx.moveTo(X(i), y); }
      ctx.stroke(); ctx.restore();
      CH.draw(ctx, "ax_Xt", 10 * Math.max(0.85, S), p.x0 + 6, p.y0 - 8 * S, { alpha: GA(a) * 2 });
    }

    return {
      still: 14,
      resize(e, b) { env = e; W = e.W; H = e.H; portrait = e.portrait; mobile = e.mobile; box = b || box; layout(); if (!built || birds.length !== (mobile ? BIRDS.phone : BIRDS.desktop)) { buildLV(); buildPaths(); build(); } },
      update(dt, tt) {
        if (!built) return;
        t = tt; camX += V * dt;
        stepBirds(Math.min(dt, 1 / 30), tt);
        const r = env.rand, hx = hareX(tt);
        const hp = (tt / 0.42) % 1;
        if (hp > 0.45 && hp < 0.85 && r() < 0.6) dust.push({ wx: camX + hx - 6 * SC, y: GY - 2, vx: (r() - 0.2) * 20, vy: -10 - r() * 18, life: 0.9, r: (1 + r() * 2.5) * S });
        for (const w of pack) { const p = fract(tt / 0.52 + w.ph); if (p > 0.15 && p < 0.35 && r() < 0.5) dust.push({ wx: camX + wolfX(w, tt) - 30 * wolfS(w), y: wolfY(w) - 2, vx: (r() - 0.2) * 25, vy: -8 - r() * 20, life: 1.0, r: (1 + r() * 3) * S }); }
        for (const d of dust) { d.wx += d.vx * dt; d.y += d.vy * dt; d.vy += 6 * dt; d.life -= dt; }
        if (dust.length) dust = dust.filter((d) => d.life > 0);
        pack.forEach((w, i) => C.wolf.record(rW[i], C.root(wolfX(w, tt), wolfY(w), wolfS(w)), "gallop", tt / 0.52 + w.ph));
        C.hare.record(rH, C.root(hx, GY, SC * 1.15), "hop", tt / 0.42);
      },
      draw(ctx, a, pass) {
        if (!built || pass !== "base") return;
        const tt = t;
        // equations that write themselves, rest and fade
        for (const s of slots) {
          const lt = tt + s.ph, c = Math.floor(lt / s.per), u = (lt - c * s.per) / s.per, sp = slotSpot(s, c);
          const al = (1 - smooth(0.82, 0.97, u)) * 0.17;
          CH.write(ctx, sp.id, sp.px, sp.x, sp.y, smooth(0.02, 0.22, u), { alpha: a * al, tip: u < 0.22 });
        }
        // the three living graphs
        drawPhase(ctx, a, tt); drawSeries(ctx, a, tt); drawPaths(ctx, a, tt);
        // ground + tufts + dust
        ctx.strokeStyle = `rgba(${INK},${0.35 * a})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, GY + 1); ctx.lineTo(W, GY + 1); ctx.stroke();
        const span = W * 1.6;
        ctx.beginPath();
        for (const g of tufts) {
          const x = ((g.wx - camX) % span + span) % span - W * 0.1, y = GY + 2 + g.y;
          for (let k = 0; k < g.n; k++) { const dx = (k - g.n / 2) * 2.5; ctx.moveTo(x + dx, y); ctx.lineTo(x + dx * 1.8 + 1, y - g.h * (0.6 + 0.4 * ((k + 1) % 2))); }
        }
        ctx.strokeStyle = `rgba(${INK},${0.25 * a})`; ctx.stroke();
        for (const d of dust) { ctx.fillStyle = `rgba(${INK},${0.22 * d.life * a})`; ctx.beginPath(); ctx.arc(d.wx - camX, d.y, d.r * (1.6 - d.life), 0, TAU); ctx.fill(); }
        // wolves (back to front) and the hare
        const order = pack.map((w, i) => i).sort((i, j) => pack[j].d - pack[i].d);
        for (const i of order) drawOutline(ctx, rW[i], { width: 1.35 * Math.max(1, S * 0.8), color: `rgb(${INK})`, alpha: a * (1 - 0.28 * pack[i].d), occlude: 0.95, bg: BG, far: 0.45, grain: CH.grain(), grainA: 0.5 });
        drawOutline(ctx, rH, { width: 1.3 * Math.max(1, S * 0.8), color: `rgb(${INK})`, alpha: a, occlude: 0.92, bg: BG, far: 0.45, grain: CH.grain(), grainA: 0.5 });
        // flock + falcon
        ctx.strokeStyle = `rgba(${INK},${0.72 * a})`; ctx.lineWidth = 1; ctx.beginPath();
        const bs = Math.max(0.8, S);
        for (const b of birds) C.bird(ctx, b.x, b.y, (3.2 + b.r * 1.6) * bs, b.f, Math.atan2(b.vy, b.vx) * 0.3);
        ctx.stroke();
        if (falcon.on) { ctx.strokeStyle = `rgba(${INK},${0.95 * a})`; ctx.lineWidth = 1.5; ctx.beginPath(); C.bird(ctx, falcon.x, falcon.y, 9 * bs, tt * 6, -0.4); ctx.stroke(); }
      },
      points(out, n) {
        const p = PTS.begin(out, n);
        p.rig("sim-w0", rW[0], 0.2).rig("sim-w1", rW[1], 0.16); if (pack.length > 2) p.rig("sim-w2", rW[2], 0.12); p.rig("sim-hare", rH, 0.16);
        const fl = new Float32Array(2 * birds.length); birds.forEach((b, i) => { fl[2 * i] = b.x; fl[2 * i + 1] = b.y; });
        p.arr("sim-birds", fl, birds.length, 0.18);
        const ph = panels.phase, X = (x) => lerp(ph.x0, ph.x1, x / LV.XM), Y = (y) => lerp(ph.y1, ph.y0, y / LV.YM);
        p.poly("sim-orbit", orbit.filter((_, i) => i % 6 === 0).map(([x, y]) => [X(x), Y(y)]), 0.12);
        p.poly("sim-ground", [[0, GY + 1], [W, GY + 1]], 0.1).end();
      },
    };
  };
})(window);
