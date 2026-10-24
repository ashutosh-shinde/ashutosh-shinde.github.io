/* =============================================================================
   lv-competition.js — Lotka–Volterra competition: maths and page
   -----------------------------------------------------------------------------
   Page: simulations/population-dynamics/lv-competition/
     dN₁/dt = r₁N₁(1 − (N₁ + α₂₁N₂)/K₁)      dN₂/dt = r₂N₂(1 − (N₂ + α₁₂N₁)/K₂)
   (the owner's convention: α₂₁ is the effect of SP2 on SP1, α₁₂ of SP1 on SP2)
   1. the maths (WQ.LVC; node-tested by tools/test-lv-competition.mjs): the field,
      the exact Jacobian, the four equilibria and their types, the invasion
      tests and the outcome, runs, settling times, the separatrix
   2. the page: sliders and presets → three panels (phase plane with taps,
      time series, the outcome map in the (α₁₂, α₂₁) plane), each with a green
      terminal box
   Reference: github.com/ashutosh-shinde/Population-Dynamics,
   Two_species_population_models/ (section 1).
   HOW TO EDIT: DEFAULTS, PRESETS, MAX_TAPS.
   ============================================================================= */
(function (G) {
  "use strict";
  const ODE = G.WQ && G.WQ.ODE;

  /* ================================================================ 1. maths */
  const NAMES = ["e0", "e1", "e2", "e3"];
  const scaleOf = (p) => Math.max(p.K1, p.K2);

  function field(p) {
    return (t, y, d) => {
      const a = y[0], b = y[1];
      d[0] = p.r1 * a * (1 - (a + p.a21 * b) / p.K1);
      d[1] = p.r2 * b * (1 - (b + p.a12 * a) / p.K2);
    };
  }
  function f(p, N1, N2) { const d = [0, 0]; field(p)(0, [N1, N2], d); return d; }
  function jac(p, N1, N2) {
    return [
      p.r1 * (1 - (2 * N1 + p.a21 * N2) / p.K1), (-p.r1 * p.a21 * N1) / p.K1,
      (-p.r2 * p.a12 * N2) / p.K2, p.r2 * (1 - (2 * N2 + p.a12 * N1) / p.K2),
    ];
  }
  function invasion(p) {
    const eps = 1e-9 * scaleOf(p), s1 = p.K1 - p.a21 * p.K2, s2 = p.K2 - p.a12 * p.K1;
    const sign = (s) => (Math.abs(s) <= eps ? 0 : s > 0 ? 1 : -1);
    return { s1, s2, g1: sign(s1), g2: sign(s2) };
  }
  function classifyAt(p, N1, N2) {
    const J = jac(p, N1, N2), e = ODE.eig2(J[0], J[1], J[2], J[3]), c = ODE.classify2(e);
    return { J, eig: e, type: c.label, stable: c.stable };
  }
  function equilibria(p) {
    const S = scaleOf(p), D = 1 - p.a12 * p.a21, out = [];
    const add = (name, N1, N2) => out.push(Object.assign({ name, N1, N2 }, classifyAt(p, N1, N2)));
    add("e0", 0, 0); add("e1", p.K1, 0); add("e2", 0, p.K2);
    if (Math.abs(D) > 1e-12) {
      const N1 = (p.K1 - p.a21 * p.K2) / D, N2 = (p.K2 - p.a12 * p.K1) / D;
      if (N1 > 1e-9 * S && N2 > 1e-9 * S) add("e3", N1, N2);
    }
    return out;
  }
  // "coexistence" | "sp1" | "sp2" | "bistable" | "neutral" | "borderline"
  function outcome(p) {
    const v = invasion(p);
    if (v.g1 === 0 && v.g2 === 0) return "neutral";
    if (v.g1 === 0 || v.g2 === 0) return "borderline";
    if (v.g1 > 0 && v.g2 > 0) return "coexistence";
    if (v.g1 > 0) return "sp1";
    if (v.g2 > 0) return "sp2";
    return "bistable";
  }
  // the outcome read from the stability of e1, e2, e3 (for the runtime check)
  function outcomeFromStability(E) {
    const st = (n) => { const e = E.find((x) => x.name === n); return e ? e.type : null; };
    if (st("e3") === "stable node" || st("e3") === "stable spiral") return "coexistence";
    const s1 = st("e1") === "stable node", s2 = st("e2") === "stable node";
    if (s1 && s2) return "bistable";
    if (s1) return "sp1";
    if (s2) return "sp2";
    return "none";
  }
  function box(p, E = equilibria(p)) {
    const cap = (v) => Math.min(v, 1.5 * scaleOf(p)), e3 = E.find((e) => e.name === "e3");
    const xs = [p.K1], ys = [p.K2];
    if (p.a12 > 0) xs.push(cap(p.K2 / p.a12));
    if (p.a21 > 0) ys.push(cap(p.K1 / p.a21));
    if (e3) { xs.push(e3.N1); ys.push(e3.N2); }
    return { X: 1.15 * Math.max(...xs), Y: 1.15 * Math.max(...ys) };
  }
  function starts(p, B = box(p)) {
    const out = [], seen = new Set();
    for (const q of [0.1, 0.4, 0.7, 1.0]) for (const s of [[q * B.X, B.Y], [B.X, q * B.Y], [q * B.X, 0.02 * B.Y], [0.02 * B.X, q * B.Y]]) {
      const key = s[0].toPrecision(10) + "," + s[1].toPrecision(10);
      if (!seen.has(key)) { seen.add(key); out.push(s); }
    }
    return out;
  }
  function run(p, s, tmax, samples = 300) {
    const S = scaleOf(p);
    const r = ODE.solve(field(p), [s[0], s[1]], 0, tmax, { rtol: 1e-8, atol: 1e-10 * S, samples, nonneg: true, hmax: tmax / 50, maxSteps: 400000 });
    const n = r.n, N1 = r.y[0].subarray(0, n), N2 = r.y[1].subarray(0, n);
    return { t: r.t.subarray(0, n), N1, N2, start: s, end: [N1[n - 1], N2[n - 1]], status: r.status };
  }
  // where a run ended: the nearest stable equilibrium within 1 % of max K (or null: still moving)
  function endOf(p, R, E = equilibria(p)) {
    const S = scaleOf(p); let best = null, bd = Infinity;
    for (const e of E) {
      if (!e.stable) continue;
      const d = Math.hypot(R.end[0] - e.N1, R.end[1] - e.N2);
      if (d <= 0.01 * S && d < bd) { bd = d; best = e; }
    }
    return best;
  }
  function slowest(e) { // slowest decay at an equilibrium: τ = 1/|λ_slow|
    const l = e.eig.complex ? Math.abs(e.eig.re1) : Math.min(Math.abs(e.eig.re1), Math.abs(e.eig.re2));
    const lam = e.eig.complex ? e.eig.re1 : Math.abs(e.eig.re1) < Math.abs(e.eig.re2) ? e.eig.re1 : e.eig.re2;
    return { lambda: lam, tau: l > 0 ? 1 / l : Infinity };
  }
  // the first t after which the run stays within 1 % of max K of the point `to`
  function settling(p, R, to) {
    const S = scaleOf(p), n = R.t.length;
    if (Math.hypot(R.end[0] - to[0], R.end[1] - to[1]) > 0.01 * S) return null;
    let i = n - 1;
    while (i > 0 && Math.hypot(R.N1[i - 1] - to[0], R.N2[i - 1] - to[1]) <= 0.01 * S) i--;
    if (i === 0) return 0;
    // refine between samples i − 1 and i
    const g = (t) => { const u = (t - R.t[i - 1]) / (R.t[i] - R.t[i - 1]); return Math.hypot(R.N1[i - 1] + u * (R.N1[i] - R.N1[i - 1]) - to[0], R.N2[i - 1] + u * (R.N2[i] - R.N2[i - 1]) - to[1]) - 0.01 * S; };
    return ODE.bisect(g, R.t[i - 1], R.t[i], 1e-10);
  }
  // a finer settling time: re-run on a dense grid up to just past the coarse estimate
  function settleTime(p, s, tmax, to) {
    const R = run(p, s, tmax, 600), coarse = settling(p, R, to);
    if (coarse == null) return { t: null, R };
    const tEnd = Math.min(tmax, coarse * 1.05 + 1e-6), R2 = run(p, s, Math.max(tEnd, 1e-6), 4000);
    let fine = settling(p, R2, to); if (fine == null) fine = coarse;
    return { t: fine, R };
  }
  function stableVector(e3) { // eigenvector for the negative eigenvalue of J(e3)
    const [a, b, c, d] = e3.J, lam = Math.min(e3.eig.re1, e3.eig.re2);
    const v1 = [b, lam - a], v2 = [lam - d, c];
    const v = Math.hypot(...v1) >= Math.hypot(...v2) ? v1 : v2, L = Math.hypot(...v) || 1;
    let x = v[0] / L, y = v[1] / L; if (x < 0 || (x === 0 && y < 0)) { x = -x; y = -y; }
    return [x, y];
  }
  // the stable line of the saddle e3 (bistable only): two halves, each integrated backwards in time
  function separatrix(p, E = equilibria(p), B = box(p)) {
    const e3 = E.find((e) => e.name === "e3"); if (!e3 || e3.type !== "saddle") return null;
    const v = stableVector(e3), F = field(p), S = scaleOf(p);
    const rev = (t, y, d) => { F(t, y, d); d[0] = -d[0]; d[1] = -d[1]; };
    const out = (t, y) => y[0] < -0.01 * B.X || y[0] > 1.01 * B.X || y[1] < -0.01 * B.Y || y[1] > 1.01 * B.Y;
    const half = (sgn) => {
      const y0 = [e3.N1 + sgn * 1e-4 * S * v[0], e3.N2 + sgn * 1e-4 * S * v[1]];
      // t ∈ [0, 80], longer when the growth rates are slow, so the outer half reaches the box's edge
      const T = 80 * Math.max(1, 1 / Math.min(p.r1, p.r2));
      const o = { rtol: 1e-8, atol: 1e-10 * S, samples: 1200, nonneg: false, hmax: T / 160, maxSteps: 400000 };
      const r = ODE.solve(rev, y0, 0, T, Object.assign({ stop: out }, o));
      const xs = [e3.N1], ys = [e3.N2];
      for (let i = 0; i < r.n; i++) { xs.push(r.y[0][i]); ys.push(r.y[1][i]); }
      if (r.status === "stopped" && r.n > 0 && r.tEnd > r.t[r.n - 1]) { // the point where it left the box (between two samples)
        const q = ODE.solve(rev, [r.y[0][r.n - 1], r.y[1][r.n - 1]], r.t[r.n - 1], r.tEnd, Object.assign({}, o, { samples: 2 }));
        if (q.n === 2) { xs.push(q.y[0][1]); ys.push(q.y[1][1]); }
      }
      return { xs, ys };
    };
    const a = half(1), b = half(-1);
    const xs = a.xs.slice().reverse().concat(b.xs.slice(1)), ys = a.ys.slice().reverse().concat(b.ys.slice(1));
    return { xs, ys, v, e3, boxY: B.Y };
  }
  // which side of the separatrix a point is: +1 below/right (towards e1, SP1), −1 above/left (SP2), 0 on it
  function side(sep, pt, tol) {
    const pts = sep.xs.map((x, i) => [x, sep.ys[i]]).sort((u, w) => u[0] - w[0]);
    let dmin = Infinity; for (const q of pts) dmin = Math.min(dmin, Math.hypot(q[0] - pt[0], q[1] - pt[1]));
    if (dmin < tol) return 0;
    const last = pts[pts.length - 1], xMax = last[0];
    if (pt[0] > xMax) { // beyond the drawn line: it left through the top, or (if it ends inside) extend its last stretch
      if (last[1] >= 1.0 * sep.boxY) return 1;
      const q = pts[pts.length - 2] || last, sl = (last[1] - q[1]) / Math.max(last[0] - q[0], 1e-12);
      return pt[1] < last[1] + sl * (pt[0] - last[0]) ? 1 : -1;
    }
    if (pt[0] < pts[0][0]) return -1;
    for (let i = 1; i < pts.length; i++) if (pts[i][0] >= pt[0]) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], u = x1 > x0 ? (pt[0] - x0) / (x1 - x0) : 0, yc = y0 + u * (y1 - y0);
      return pt[1] < yc ? 1 : -1;
    }
    return 1;
  }
  const borders = (p) => ({ b12: p.K2 / p.K1, b21: p.K1 / p.K2 });
  function region(p, a12, a21) { // the region of the outcome map that (a12, a21) is in
    return outcome(Object.assign({}, p, { a12, a21 }));
  }

  const M = { field, f, jac, invasion, equilibria, outcome, outcomeFromStability, box, starts, run, endOf, slowest, settling, settleTime, stableVector, separatrix, side, borders, region, scaleOf, NAMES };
  (G.WQ = G.WQ || {}).LVC = M;
  if (typeof document === "undefined") return; // (in node: the maths only)

  /* ================================================================ 2. page */
  const Sim = G.WQ.Sim, C = G.WQ.Plot.COLORS, $ = (id) => document.getElementById(id);
  const { fmt, fmtSig, signed, hi, dim, warn, why } = Sim;
  const DEFAULTS = { r1: 1, r2: 0.8, K1: 10, K2: 8, a12: 0.4, a21: 0.6, tmax: 50 };
  const PRESETS = [
    { label: "Stable coexistence (README)", values: { r1: 1, r2: 0.8, K1: 10, K2: 8, a12: 0.4, a21: 0.6 } },
    { label: "SP1 wins", values: { r1: 1, r2: 1, K1: 10, K2: 8, a12: 1.5, a21: 0.2 } },
    { label: "SP2 wins", values: { r1: 1, r2: 1, K1: 10, K2: 8, a12: 0.2, a21: 1.5 } },
    { label: "Bistability", values: { r1: 1, r2: 1, K1: 10, K2: 8, a12: 1.2, a21: 1.4 } },
    { label: "Weak competition", values: { r1: 1, r2: 0.7, K1: 10, K2: 8, a12: 0.05, a21: 0.05 } },
    { label: "Symmetric (neutral)", values: { r1: 1, r2: 1, K1: 10, K2: 10, a12: 1, a21: 1 } },
    { label: "Near-degenerate", values: { r1: 1, r2: 1, K1: 10, K2: 10, a12: 0.999, a21: 0.999 } },
    { label: "Fast–slow", values: { r1: 5, r2: 0.1, K1: 10, K2: 8, a12: 0.4, a21: 0.6 } },
  ];
  const IDS = ["r1", "r2", "K1", "K2", "a12", "a21", "tmax"];
  const MAX_TAPS = 12;
  const OUT_TEXT = { coexistence: "stable coexistence", sp1: "SP1 wins", sp2: "SP2 wins", bistable: "bistable", neutral: "neutral (a line of equilibria)", borderline: "on a borderline" };

  const S = Object.assign({}, DEFAULTS);
  let P, E, OUT, B, runs = [], taps = [], tapRuns = [], sep = null, bRun = null, bStart = null, bSettle = null, sliders = {}, plots = {}, loop;
  const par = () => ({ r1: S.r1, r2: S.r2, K1: S.K1, K2: S.K2, a12: S.a12, a21: S.a21, tmax: S.tmax }); // a snapshot: boxes and checks read it, never the live S
  const p4 = (v) => { // 4 significant digits from 1 up (10.00, 6.842), 3 decimals below 1 (0.800), tiny values in e-notation
    if (v === 0) return "0";
    const a = Math.abs(v), sg = v < 0 ? "−" : "";
    return a < 1e-3 || a >= 1e6 ? fmtSig(v, 4) : sg + (a >= 1 ? a.toPrecision(4) : a.toFixed(3));
  };
  // α readouts: two decimals, or three when the value needs them (the Near-degenerate preset's 0.999)
  const fa = (v) => (Math.abs(Math.round(v * 100) - v * 100) > 1e-6 ? fmt(v, 3) : fmt(v, 2));
  const pt = (x, y) => `(${p4(x)}, ${p4(y)})`;
  const eqColour = (e) => (!e ? "rgba(246,244,236,0.45)" : e.name === "e1" ? C.yellow : e.name === "e2" ? C.blue : C.white);

  function compute() {
    P = par(); E = equilibria(P); OUT = outcome(P); B = box(P, E);
    runs = starts(P, B).map((s) => { const R = run(P, s, P.tmax); return { R, end: endOf(P, R, E) }; });
    tapRuns = taps.map((s) => { const R = run(P, s, P.tmax); return { R, end: endOf(P, R, E) }; });
    sep = OUT === "bistable" ? separatrix(P, E, B) : null;
    bStart = taps.length ? taps[taps.length - 1] : [0.1 * P.K1, 0.1 * P.K2];
    bRun = run(P, bStart, P.tmax, 600);
    const end = endOf(P, bRun, E);
    let to = end ? [end.N1, end.N2] : null;
    if (!to && OUT === "neutral") { // it stops somewhere on the line of equilibria
      const n = bRun.t.length, last = [bRun.N1[n - 1], bRun.N2[n - 1]], prev = [bRun.N1[Math.floor(0.9 * (n - 1))], bRun.N2[Math.floor(0.9 * (n - 1))]];
      if (Math.hypot(last[0] - prev[0], last[1] - prev[1]) < 1e-3 * scaleOf(P)) to = last;
    }
    bSettle = { end, to, t: to ? settleTime(P, bStart, P.tmax, to).t : null };
  }

  /* ---------------------------------------------------- A. phase plane */
  function drawPhase() {
    const p = plots.phase;
    p.set({ x: [0, B.X], y: [0, B.Y], xLabel: "N_1", yLabel: "N_2" }).clear();
    p.field((x, y) => f(P, x, y), { color: "rgba(246,244,236,0.22)" });
    // nullclines
    const nc = { dash: [6, 5], width: 1.6 };
    p.line([0, 0], [0, B.Y], C.yellow, nc);
    if (P.a21 > 0) p.line([P.K1, 0], [0, P.K1 / P.a21], C.yellow, nc); else p.line([P.K1, P.K1], [0, B.Y], C.yellow, nc);
    p.line([0, B.X], [0, 0], C.blue, nc);
    if (P.a12 > 0) p.line([0, P.K2 / P.a12], [P.K2, 0], C.blue, nc); else p.line([0, B.X], [P.K2, P.K2], C.blue, nc);
    for (const r of runs) p.line(Array.from(r.R.N1), Array.from(r.R.N2), eqColour(r.end), { width: 1.1, alpha: 0.85, arrowAt: 0.3 });
    for (const r of tapRuns) p.line(Array.from(r.R.N1), Array.from(r.R.N2), C.white, { width: 2.4, arrowAt: 0.3 });
    for (const s of taps) p.marker(s[0], s[1], "unstable", { r: 3.5 });
    if (sep) { p.line(sep.xs, sep.ys, C.white, { width: 2, dash: [7, 5] }); labelLine(p, sep.xs, sep.ys, "separatrix"); }
    if (OUT === "neutral") {
      const xs = [P.K1, 0], ys = [0, P.K1 / Math.max(P.a21, 1e-12)];
      p.line(xs, ys, C.white, { width: 3.2, dash: [8, 6] }); labelLine(p, xs, ys, "line of equilibria");
    }
    for (const e of E) p.marker(e.N1, e.N2, e.type === "stable node" || e.type === "stable spiral" ? "stable" : e.type === "saddle" ? "saddle" : e.type === "non-hyperbolic" ? "neutral" : "unstable", { label: e.name });
    p.legend([{ label: "SP1 nullcline", color: C.yellow }, { label: "SP2 nullcline", color: C.blue }]);
  }
  function labelLine(p, xs, ys, text) { // put a label at the visible point of a line nearest the box's middle
    let best = null, bd = Infinity;
    for (let i = 1; i < xs.length; i++) for (let k = 0; k < 20; k++) { // (along each segment, so a 2-point line works too)
      const u = k / 20, x = xs[i - 1] + u * (xs[i] - xs[i - 1]), y = ys[i - 1] + u * (ys[i] - ys[i - 1]);
      if (!(x >= 0.05 * B.X && x <= 0.8 * B.X && y >= 0.08 * B.Y && y <= 0.92 * B.Y)) continue;
      const d = Math.hypot(x / B.X - 0.6, y / B.Y - 0.6); if (d < bd) { bd = d; best = [x, y]; }
    }
    if (best) p.text(text, best[0], best[1], { dx: 8, dy: -8, color: C.white });
  }
  function eigText(e) {
    if (e.eig.complex) return `${signed(e.eig.re1)} ± ${fmt(Math.abs(e.eig.im1))}i`;
    return `${signed(e.eig.re1)} ${signed(e.eig.re2)}`;
  }
  function phaseBox() {
    const L = [`> r_1 = ${fmt(P.r1, 2)}, r_2 = ${fmt(P.r2, 2)} · K_1 = ${fmt(P.K1, 1)}, K_2 = ${fmt(P.K2, 1)} · α_12 = ${fa(P.a12)}, α_21 = ${fa(P.a21)}`];
    L.push("> equilibria · eigenvalues · type");
    for (const e of E) {
      const stab = e.type === "stable node" || e.type === "stable spiral";
      L.push([`  ${Sim.pad(`${e.name} ${pt(e.N1, e.N2)}`, 18)}${Sim.pad(eigText(e), 15)}`, stab ? hi(e.type) : e.type]);
    }
    if (OUT === "neutral") L.push("  and every point of N_1 + α_21 N_2 = K_1 (a line of equilibria)");
    const v = invasion(P), mark = (g) => (g > 0 ? "✓" : g < 0 ? "✗" : "=");
    const rel = (g) => (g > 0 ? ">" : g < 0 ? "<" : "=");
    L.push("> invasion tests");
    L.push(`  K_1 = ${fmt(P.K1, 1)} ${rel(v.g1)} α_21 K_2 = ${fmt(P.a21 * P.K2, 2)} ${mark(v.g1)} SP1 ${v.g1 > 0 ? "can grow" : v.g1 < 0 ? "cannot grow" : "is on the border"} when rare`);
    L.push(`  K_2 = ${fmt(P.K2, 1)} ${rel(v.g2)} α_12 K_1 = ${fmt(P.a12 * P.K1, 2)} ${mark(v.g2)} SP2 ${v.g2 > 0 ? "can grow" : v.g2 < 0 ? "cannot grow" : "is on the border"} when rare`);
    if (OUT === "coexistence") {
      L.push(["> outcome: ", hi("stable coexistence at e3")]);
      L.push(why("each can grow when rare, so neither can be pushed out"));
      L.push(why("each species limits itself more than it limits the other"));
      L.push(why("competition never spirals: the eigenvalues at e3 are real"));
      L.push(why("r_1 and r_2 change how fast, not who wins"));
    } else if (OUT === "sp1") {
      L.push(["> outcome: ", hi("SP1 wins (e1)")]);
      L.push(why("SP1 can grow when rare in SP2's world (K_1 > α_21 K_2)"));
      L.push(why("SP2 cannot grow when rare in SP1's world (K_2 < α_12 K_1)"));
      L.push(why("from any start with both present, SP2 dies out"));
    } else if (OUT === "sp2") {
      L.push(["> outcome: ", hi("SP2 wins (e2)")]);
      L.push(why("SP2 can grow when rare in SP1's world (K_2 > α_12 K_1)"));
      L.push(why("SP1 cannot grow when rare in SP2's world (K_1 < α_21 K_2)"));
      L.push(why("from any start with both present, SP1 dies out"));
    } else if (OUT === "bistable") {
      L.push(["> outcome: ", hi("bistable — whoever is ahead wins")]);
      L.push(why("neither can grow when rare in the other's world"));
      L.push(why("e3 is a saddle; its stable line (dashed) divides the starts"));
      L.push(why("a founder effect: arriving first or in larger numbers wins"));
    } else if (OUT === "neutral") {
      L.push(["> outcome: ", hi("neutral — a whole line of equilibria")]);
      L.push(why("the nullclines coincide: N_1 + α_21 N_2 = K_1"));
      L.push(why("each start stops somewhere on the line: nothing pushes along it"));
    } else {
      L.push(["> ", hi("on a borderline: one eigenvalue is 0")]);
      L.push(why("slower nonlinear terms decide; a tiny change tips it"));
    }
    if (P.a21 === 0) L.push(why("α_21 = 0: SP2 does not affect SP1 at all"));
    if (P.a12 === 0) L.push(why("α_12 = 0: SP1 does not affect SP2 at all"));
    return L;
  }

  /* ---------------------------------------------------- B. time series */
  function drawTime() {
    const p = plots.time, R = bRun;
    let top = 0; for (let i = 0; i < R.t.length; i++) top = Math.max(top, R.N1[i], R.N2[i]);
    top = Math.max(top, 1e-9) * 1.1;
    p.set({ x: [0, P.tmax], y: [0, top], xLabel: "t", yLabel: "N" }).clear();
    if (bSettle.to) { p.hline(bSettle.to[0], C.yellow, { alpha: 0.45 }); p.hline(bSettle.to[1], C.blue, { alpha: 0.45 }); }
    p.line(Array.from(R.t), Array.from(R.N1), C.yellow, { width: 2 });
    p.line(Array.from(R.t), Array.from(R.N2), C.blue, { width: 2 });
    p.legend([{ label: "N₁ (SP1)", color: C.yellow }, { label: "N₂ (SP2)", color: C.blue }]);
  }
  function timeBox() {
    const R = bRun, n = R.t.length, L = [`> start ${pt(bStart[0], bStart[1])} → at t = ${fmt(P.tmax, 0)}: ${pt(R.N1[n - 1], R.N2[n - 1])}`];
    const end = bSettle.end, to = bSettle.to;
    if (bSettle.t != null) {
      L.push(`> settled within 1% by t = ${fmt(bSettle.t, 2)}`);
      if (end) {
        const sl = slowest(end);
        L.push(why(`slowest eigenvalue at ${end.name}: ${signed(sl.lambda)}, so τ = ${fmt(sl.tau, 2)}`));
        if (sl.tau > 5 * Math.max(bSettle.t, 1e-9)) L.push(why("this start barely uses the slow direction; others take ~τ"));
        else L.push(why("near the end the gap shrinks ×e every τ"));
      }
    } else {
      L.push(warn(`> not settled by t_max = ${fmt(P.tmax, 0)}`));
      const target = E.filter((e) => e.stable).map((e) => slowest(e).tau);
      if (target.length) L.push(why(`the slow direction has τ = ${fmt(Math.max(...target), 2)}`));
    }
    if (OUT === "neutral" && to && !end) L.push(why(`it stopped on the line of equilibria at ${pt(to[0], to[1])}`));
    if (OUT === "bistable" && sep) {
      const sd = side(sep, bStart, 1e-3 * scaleOf(P));
      L.push(why(sd > 0 ? "the start was below the separatrix (SP1's side): SP1 wins" : sd < 0 ? "the start was above the separatrix (SP2's side): SP2 wins" : "the start was on the separatrix: it heads for the saddle e3"));
    }
    return L;
  }

  /* ---------------------------------------------------- C. outcome map */
  const AMAX = 5;
  function drawMap() {
    const p = plots.map, bd = borders(P), b12 = Math.min(bd.b12, AMAX), b21 = Math.min(bd.b21, AMAX);
    p.set({ x: [0, AMAX], y: [0, AMAX], xLabel: "α_12", yLabel: "α_21" }).clear();
    const rect = (x0, x1, y0, y1, colour, text) => {
      if (x1 <= x0 || y1 <= y0) return;
      p.fill([x0, x1, x1, x0], [y0, y0, y1, y1], colour);
      const [ax, ay] = p.toPx(x0, y0), [bx, by] = p.toPx(x1, y1);
      if (Math.abs(bx - ax) >= 60 && Math.abs(ay - by) >= 22) p.text(text, (x0 + x1) / 2, (y0 + y1) / 2, { align: "center", baseline: "middle", color: "rgba(246,244,236,0.8)" });
    };
    rect(0, b12, 0, b21, "rgba(246,244,236,0.07)", "coexistence");
    rect(b12, AMAX, 0, b21, "rgba(242,214,117,0.12)", "SP1 wins");
    rect(0, b12, b21, AMAX, "rgba(156,201,240,0.12)", "SP2 wins");
    rect(b12, AMAX, b21, AMAX, "rgba(242,167,195,0.12)", "bistable");
    if (bd.b12 <= AMAX) p.vline(bd.b12, C.white, { dash: [5, 4], alpha: 0.7 });
    if (bd.b21 <= AMAX) p.hline(bd.b21, C.white, { dash: [5, 4], alpha: 0.7 });
    const xs = [], ys = []; for (let i = 0; i <= 200; i++) { const x = 0.2 + (AMAX - 0.2) * (i / 200); xs.push(x); ys.push(1 / x); }
    p.line(xs, ys, C.white, { dash: [1.5, 4], width: 1.4, alpha: 0.8 });
    const [dx, dy] = p.toPx(P.a12, P.a21), ctx = p.ctx;
    ctx.save(); ctx.fillStyle = C.white; ctx.strokeStyle = "#0d0f0f"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(dx, dy, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
  }
  function mapBox() {
    const bd = borders(P), L = [`> borders: α_12 = K_2/K_1 = ${fmt(bd.b12)} · α_21 = K_1/K_2 = ${fmt(bd.b21)}`];
    L.push(["> now ", `(${fa(P.a12)}, ${fa(P.a21)}): `, hi(OUT_TEXT[OUT])]);
    L.push(why("right of α_12 = K_2/K_1: SP1 presses SP2 harder than SP2 presses itself"));
    L.push(why("above α_21 = K_1/K_2: SP2 presses SP1 harder than SP1 presses itself"));
    L.push(why("the dotted curve α_12 α_21 = 1 is where e3 changes between stable and saddle"));
    if (bd.b12 > AMAX) L.push(`> the α_12 border (${fmt(bd.b12, 2)}) is off the map: SP1 cannot exclude SP2 for α_12 ≤ 5`);
    if (bd.b21 > AMAX) L.push(`> the α_21 border (${fmt(bd.b21, 2)}) is off the map: SP2 cannot exclude SP1 for α_21 ≤ 5`);
    if (bd.b12 < 0.05) L.push(why("the α_12 border is almost on the axis: K's are very unequal"));
    if (bd.b21 < 0.05) L.push(why("the α_21 border is almost on the axis: K's are very unequal"));
    return L;
  }

  /* ---------------------------------------------------- runtime checks (?check=1) */
  function runChecks(boxes) {
    const ck = Sim.check, Sc = scaleOf(P), F = field(P);
    for (const e of E) {
      const d = f(P, e.N1, e.N2);
      ck("equilibrium f = 0", Math.hypot(d[0], d[1]) < 1e-9 * Sc, `${e.name} ${d}`);
      const Jn = ODE.jacFD(F, [e.N1, e.N2]), en = ODE.eig2(Jn[0], Jn[1], Jn[2], Jn[3]);
      const tol = 1e-5 * Math.max(1, Math.abs(e.eig.re1), Math.abs(e.eig.re2));
      ck("analytic J eigenvalues = finite-difference J", Math.abs(en.re1 - e.eig.re1) < tol && Math.abs(en.re2 - e.eig.re2) < tol && Math.abs(Math.abs(en.im1) - Math.abs(e.eig.im1)) < tol, `${e.name} ${e.eig.re1},${e.eig.re2} vs ${en.re1},${en.re2}`);
    }
    if (OUT !== "neutral" && OUT !== "borderline") {
      // the stability labels need a margin: skip when an eigenvalue is within classify2's tolerance of 0
      const near0 = E.some((e) => Math.min(Math.abs(e.eig.re1), Math.abs(e.eig.re2)) < 1e-7);
      if (!near0) ck("outcome (invasion tests) = outcome (stability)", outcomeFromStability(E) === OUT, `${OUT} vs ${outcomeFromStability(E)}`);
      const stab = E.filter((e) => e.stable), tau = stab.length ? Math.max(...stab.map((e) => slowest(e).tau)) : Infinity;
      const e3 = E.find((e) => e.name === "e3");
      for (const r of runs) {
        if (!r.end) {
          // still moving: allowed when t_max < 10·τ, or when the run lingers by the saddle e3 (a start close to the separatrix)
          const n = r.R.t.length, nearSaddle = e3 && e3.type === "saddle" && Math.hypot(r.R.N1[n - 1] - e3.N1, r.R.N2[n - 1] - e3.N2) < 0.5 * Sc;
          ck("runs end at a stable state (or move slowly)", P.tmax < 10 * tau || nearSaddle, `start ${r.R.start} end ${r.R.end}`);
          continue;
        }
        const want = OUT === "coexistence" ? "e3" : OUT === "sp1" ? "e1" : OUT === "sp2" ? "e2" : null;
        if (want) ck("run ends at the outcome's equilibrium", r.end.name === want, `start ${r.R.start} → ${r.end.name}`);
        else if (sep) {
          const sd = side(sep, r.R.start, 1e-3 * Sc);
          if (sd !== 0) ck("bistable run ends on its side of the separatrix", (sd > 0 ? "e1" : "e2") === r.end.name, `start ${r.R.start} side ${sd} → ${r.end.name}`);
        }
      }
      // geometry: which side of each border the dot is drawn on
      const bd = borders(P), right = P.a12 > bd.b12, up = P.a21 > bd.b21;
      const named = right ? (up ? "bistable" : "sp1") : up ? "sp2" : "coexistence";
      ck("map dot is in the region named in box C", named === OUT, `${named} vs ${OUT}`);
    }
    const text = boxes.map((b) => b.textContent).join(" ");
    ck("boxes are finite", !/NaN|Infinity|undefined|\bnull\b/.test(text), text.slice(0, 120));
  }

  /* ---------------------------------------------------- wiring */
  const boxes = () => ["term-phase", "term-time", "term-map"].map($);
  const writeBoxes = Sim.throttle(() => {
    Sim.term($("term-phase"), phaseBox()); Sim.term($("term-time"), timeBox()); Sim.term($("term-map"), mapBox());
    if (Sim.checking) runChecks(boxes());
  }, 150);
  function render(dirty) {
    if (dirty.has("data")) compute();
    drawPhase(); drawTime(); drawMap();
    writeBoxes();
  }
  function setAlphas(a12, a21) {
    const r = (v) => Math.min(AMAX, Math.max(0, Math.round(v * 100) / 100));
    sliders.a12.set(r(a12), { silent: true }); sliders.a21.set(r(a21), { silent: true });
    S.a12 = sliders.a12.get(); S.a21 = sliders.a21.get(); loop.want("data");
  }
  function start() {
    if (!$("cv-phase") || !$("term-map")) return;
    plots.phase = G.WQ.Plot.create($("cv-phase"), {});
    plots.time = G.WQ.Plot.create($("cv-time"), {});
    plots.map = G.WQ.Plot.create($("cv-map"), {});
    loop = Sim.loop(render);
    Object.values(plots).forEach((p) => p.onResize(() => loop.want("draw")));
    const f2 = (v) => fmt(v, 2), f1 = (v) => fmt(v, 1);
    const fm = { r1: f2, r2: f2, K1: f1, K2: f1, a12: fa, a21: fa, tmax: (v) => String(Math.round(v)) };
    for (const id of IDS) sliders[id] = Sim.slider(id, { fmt: fm[id], onInput: (v) => { S[id] = v; loop.want("data"); } });
    Sim.presets($("presets"), PRESETS, (vals) => { for (const [k, v] of Object.entries(vals)) { sliders[k].set(v, { silent: true }); S[k] = sliders[k].get(); } loop.want("data"); });
    plots.phase.onTap((x, y) => { taps.push([Math.max(0, x), Math.max(0, y)]); if (taps.length > MAX_TAPS) taps.shift(); loop.want("data"); });
    $("clear-taps").addEventListener("click", () => { taps = []; loop.want("data"); });
    // the map: tap or click sets both α; with a mouse the dot can be dragged
    const cv = $("cv-map"), mp = plots.map;
    mp.onTap((x, y) => setAlphas(x, y));
    let drag = null;
    cv.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "touch") return;
      const r = cv.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
      if (!mp.inside(px, py)) return;
      drag = e.pointerId; try { cv.setPointerCapture(e.pointerId); } catch (x) {}
      const [a, b] = mp.fromPx(px, py); setAlphas(a, b);
    });
    cv.addEventListener("pointermove", (e) => {
      if (drag !== e.pointerId) return;
      const r = cv.getBoundingClientRect(), [a, b] = mp.fromPx(e.clientX - r.left, e.clientY - r.top); setAlphas(a, b);
    });
    const end = (e) => { if (drag === e.pointerId) { drag = null; try { cv.releasePointerCapture(e.pointerId); } catch (x) {} } };
    cv.addEventListener("pointerup", end); cv.addEventListener("pointercancel", end);
    loop.want("data");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})(typeof window !== "undefined" ? window : globalThis);
