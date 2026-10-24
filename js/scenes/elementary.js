/* =============================================================================
   Elementary Mathematics — "ideas rising"                         (section 3)
   -----------------------------------------------------------------------------
   • Equations and words from all over mathematics (topology, linear algebra,
     complex analysis, Fourier analysis, Hilbert spaces, number theory…) rise
     slowly up the board in three depths, like chalk notes drifting upward.
   • Left: the Lorenz attractor traces itself; its whole butterfly shows faintly.
   • Right: the logistic map's bifurcation diagram is computed column by
     column (period doubling into chaos), a scan line showing the live iterates.
   The Feynman quote is page text; drawings behind it are calmed.
   HOW TO EDIT: RISING (the list of items), LAYERS (size/speed/brightness).
   ============================================================================= */
(function (G) {
  "use strict";
  const { L, CH, PTS } = G.WQ;
  const { lerp, clamp, smooth, Ease, TAU, mulberry32, fract } = L;
  const INK = "246,244,236";
  const RISING = ["euler", "cauchy", "stokes", "gauss_bonnet", "euler_char", "spectral", "eigen_eq", "rank_nullity", "hilbert", "cauchy_schwarz",
    "parseval", "basel", "gauss_int", "cauchy_riemann", "residue", "ftc", "zeta", "pi1", "golden", "taylor", "fourier", "fourier_series",
    "w_hilbert", "w_banach", "w_topology", "w_homeo", "w_linalg", "w_eigen", "w_complex", "w_holo", "w_fourier", "w_manifold", "w_group",
    "w_measure", "w_chaos", "w_attractor", "w_bifurcation", "w_fractal", "w_infinity", "w_primes", "w_symmetry", "w_number", "w_probability"];
  // depth layers: font size (px at 1x), rising speed (px/s at 1x), brightness, share of items
  const LAYERS = [{ px: 12, v: 11, a: 0.21, n: 0.42 }, { px: 16.5, v: 19, a: 0.33, n: 0.36 }, { px: 23, v: 30, a: 0.48, n: 0.22 }];

  (G.WQ.scenes = G.WQ.scenes || {}).elementary = function (env0) {
    let env = env0, W = 0, H = 0, S = 1, portrait = false, mobile = false, box = null, built = false, t = 0;
    let items = [], lor = [], lorPath = null, lp = {}, bif = {}, bifCv = null;

    /* ---------------------------------------------------------- Lorenz attractor */
    function buildLorenz() {
      const s = 10, rho = 28, b = 8 / 3, h = 0.005;
      let x = 1, y = 1, z = 1;
      const fz = (x, y, z) => [s * (y - x), x * (rho - z) - y, x * y - b * z];
      const step = () => { const k1 = fz(x, y, z), k2 = fz(x + h * k1[0] / 2, y + h * k1[1] / 2, z + h * k1[2] / 2), k3 = fz(x + h * k2[0] / 2, y + h * k2[1] / 2, z + h * k2[2] / 2), k4 = fz(x + h * k3[0], y + h * k3[1], z + h * k3[2]);
        x += h / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]); y += h / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]); z += h / 6 * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]); };
      for (let i = 0; i < 2000; i++) step();
      lor = []; for (let i = 0; i < 26000; i++) { step(); if (i % 2 === 0) lor.push([x, z]); }
    }
    const lorXY = (q) => [lerp(lp.x0, lp.x1, (q[0] + 22) / 44), lerp(lp.y1, lp.y0, (q[1] - 2) / 50)];
    /* ---------------------------------------------------------- bifurcation diagram (pre-rendered) */
    const R0 = 2.8, R1 = 4.0;
    function buildBif() {
      const q = Math.min(2, env.dpr), w = Math.max(10, Math.round((bif.x1 - bif.x0) * q)), h = Math.max(10, Math.round((bif.y1 - bif.y0) * q));
      bifCv = document.createElement("canvas"); bifCv.width = w; bifCv.height = h;
      const c = bifCv.getContext("2d"); c.fillStyle = `rgba(${INK},0.5)`;
      const cols = Math.min(w, 420);
      for (let i = 0; i < cols; i++) {
        const r = lerp(R0, R1, i / (cols - 1)); let x = 0.5;
        for (let k = 0; k < 300; k++) x = r * x * (1 - x);
        for (let k = 0; k < 90; k++) { x = r * x * (1 - x); c.fillRect((i / (cols - 1)) * (w - 1), (1 - x) * (h - 1), q * 0.9, q * 0.9); }
      }
    }
    /* ---------------------------------------------------------- rising items */
    function spawn(it, first) {
      const r = env.rand, Lr = LAYERS[it.layer], k = Math.max(0.8, Math.min(S, 1.6)) * (mobile ? 0.95 : 1);
      it.id = RISING[(r() * RISING.length) | 0];
      it.px = Lr.px * k * (it.id.startsWith("w_") ? 1.12 : 1) * (0.9 + 0.2 * r());
      const w = CH.size(it.id, it.px)[0];
      it.x = lerp(-w * 0.2, W - w * 0.8, r());
      it.y = first ? lerp(-0.05 * H, H * 1.05, r()) : H + 30 + r() * 80;
      it.v = Lr.v * k * (0.85 + 0.3 * r()); it.a = Lr.a; it.ph = r() * TAU;
    }
    function layout() {
      S = Math.min(W / 960, H / 540);
      if (portrait) {
        const y0 = Math.max(H * 0.62, box ? box.y + box.h + H * 0.04 : H * 0.62);
        lp = { x0: W * 0.05, x1: W * 0.47, y0, y1: H * 0.95 };
        bif = { x0: W * 0.56, x1: W * 0.95, y0: y0 + H * 0.04, y1: H * 0.93 };
      } else {
        const bx0 = box ? box.x : W * 0.3, bx1 = box ? box.x + box.w : W * 0.7;
        lp = { x0: W * 0.025, x1: Math.max(W * 0.18, bx0 - W * 0.025), y0: H * 0.24, y1: H * 0.9 };
        bif = { x0: Math.min(W * 0.8, bx1 + W * 0.035), x1: W * 0.965, y0: H * 0.3, y1: H * 0.78 };
      }
      // keep the Lorenz panel's aspect sensible
      const lw = lp.x1 - lp.x0, lh = lp.y1 - lp.y0;
      if (lh > lw * 1.35) { const c = (lp.y0 + lp.y1) / 2; lp.y0 = c - lw * 0.675; lp.y1 = c + lw * 0.675; }
    }

    return {
      still: 12,
      resize(e, b) {
        env = e; W = e.W; H = e.H; portrait = e.portrait; mobile = e.mobile; box = b || box;
        layout();
        if (!lor.length) buildLorenz();
        lorPath = new Path2D(); lor.forEach((q, i) => { if (i % 3) return; const p = lorXY(q); i ? lorPath.lineTo(p[0], p[1]) : lorPath.moveTo(p[0], p[1]); });
        buildBif();
        const n = mobile ? 16 : 30;
        if (items.length !== n) { items = []; for (let i = 0; i < n; i++) { const it = { layer: i < n * LAYERS[0].n ? 0 : i < n * (LAYERS[0].n + LAYERS[1].n) ? 1 : 2 }; spawn(it, true); items.push(it); } }
        else items.forEach((it) => spawn(it, true));
        built = true;
      },
      update(dt, tt) {
        if (!built) return;
        t = tt;
        for (const it of items) { it.y -= it.v * dt; if (it.y < -60) spawn(it, false); }
      },
      draw(ctx, a, pass) {
        if (!built || pass !== "base") return;
        // rising notes (far layers first)
        for (let l = 0; l < LAYERS.length; l++) for (const it of items) {
          if (it.layer !== l) continue;
          const fade = smooth(-40, H * 0.12, it.y) * (1 - smooth(H * 0.92, H + 40, it.y));
          if (fade > 0.01) CH.draw(ctx, it.id, it.px, it.x + 6 * Math.sin(t * 0.25 + it.ph), it.y, { alpha: a * it.a * fade });
        }
        // Lorenz: the whole butterfly faintly, a bright comet tracing it
        ctx.save(); ctx.strokeStyle = `rgba(${INK},${0.09 * a})`; ctx.lineWidth = 1; ctx.stroke(lorPath); ctx.restore();
        const n = lor.length, head = Math.floor(fract(t / 46) * n), tail = 260;
        ctx.save(); ctx.lineCap = "round";
        for (let k = tail; k > 0; k -= 4) {
          const i0 = (head - k + n) % n, i1 = (head - k + 4 + n) % n, p0 = lorXY(lor[i0]), p1 = lorXY(lor[i1]);
          ctx.strokeStyle = `rgba(${INK},${0.75 * a * (1 - k / tail)})`; ctx.lineWidth = 0.6 + 1.6 * (1 - k / tail);
          ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.stroke();
        }
        const ph = lorXY(lor[head]); ctx.fillStyle = `rgba(255,253,244,${0.9 * a})`; ctx.beginPath(); ctx.arc(ph[0], ph[1], 2.6 * Math.max(0.8, S), 0, TAU); ctx.fill();
        ctx.restore();
        const lab = 12 * Math.max(0.85, Math.min(S, 1.4));
        CH.draw(ctx, "w_lorenz", lab, (lp.x0 + lp.x1) / 2, lp.y1 + 14 * S, { alpha: a * 0.58, align: "center" });
        CH.draw(ctx, "lorenz", lab * 0.9, (lp.x0 + lp.x1) / 2, lp.y0 - 4 * S, { alpha: a * 0.48, align: "center" });
        // bifurcation diagram: computed left → right, then rests and starts over
        const cyc = 20, u = fract(t / cyc), rev = Ease.inOut(clamp(u / 0.55, 0, 1)), fade = 1 - smooth(0.9, 1, u);
        const bw = bif.x1 - bif.x0, bh = bif.y1 - bif.y0;
        CH.line(ctx, [[bif.x0, bif.y0], [bif.x0, bif.y1], [bif.x1, bif.y1]], a * 0.35, 1, false);
        if (rev > 0.002) {
          ctx.save(); ctx.globalAlpha = a * 0.85 * fade;
          ctx.drawImage(bifCv, 0, 0, Math.max(1, bifCv.width * rev), bifCv.height, bif.x0, bif.y0, Math.max(1, bw * rev), bh);
          ctx.restore();
        }
        if (u < 0.56) { // the scan line and its live iterates
          const r = lerp(R0, R1, rev), x = bif.x0 + bw * rev;
          CH.line(ctx, [[x, bif.y0 - 6], [x, bif.y1]], a * 0.55, 1, false);
          let v = 0.5; for (let k = 0; k < 200; k++) v = r * v * (1 - v);
          ctx.fillStyle = `rgba(255,253,244,${0.9 * a})`;
          for (let k = 0; k < 24; k++) { v = r * v * (1 - v); ctx.beginPath(); ctx.arc(x, bif.y0 + (1 - v) * bh, 1.6 * Math.max(0.8, S), 0, TAU); ctx.fill(); }
        }
        CH.draw(ctx, "w_logmap", lab, (bif.x0 + bif.x1) / 2, bif.y1 + 14 * S, { alpha: a * 0.58, align: "center" });
        CH.draw(ctx, "logistic_map", lab * 0.9, (bif.x0 + bif.x1) / 2, bif.y0 - 12 * S, { alpha: a * 0.48, align: "center" });
      },
      points(out, n) {
        const p = PTS.begin(out, n);
        const pts = []; for (let i = 0; i < lor.length; i += 40) pts.push(lorXY(lor[i]));
        p.poly("elem-lorenz", pts, 0.3);
        // bifurcation: points on the period-doubling branches already drawn
        const src = new Float32Array(2 * 400); let m = 0;
        const rev = Ease.inOut(clamp(fract(t / 20) / 0.55, 0, 1)) || 0.5;
        for (let i = 0; i < 100; i++) { const r = lerp(R0, lerp(R0, R1, rev), i / 99); let v = 0.5; for (let k = 0; k < 120; k++) v = r * v * (1 - v); for (let k = 0; k < 4; k++) { v = r * v * (1 - v); src[2 * m] = bif.x0 + (bif.x1 - bif.x0) * ((r - R0) / (R1 - R0)); src[2 * m + 1] = bif.y0 + (1 - v) * (bif.y1 - bif.y0); m++; } }
        p.arr("elem-bif", src, m, 0.25);
        // the brightest rising notes
        const near = items.filter((it) => it.layer > 0 && it.y > 0 && it.y < H).slice(0, 6), share = 0.45 / Math.max(1, near.length);
        near.forEach((it, i) => p.eq("elem-r" + i, it.id, it.px, it.x, it.y, share));
        p.end();
      },
    };
  };
})(window);
