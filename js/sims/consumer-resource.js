/* =============================================================================
   consumer-resource.js — two consumers on one resource: maths and page
   -----------------------------------------------------------------------------
   Page: simulations/population-dynamics/consumer-resource/
     dR/dt  = I − u₁(R)C₁ − u₂(R)C₂,   u_i(R) = β_i R/(R₀_i + R)   (Holling type II uptake)
     dC_i/dt = C_i(γ_i u_i(R) − δ_i)
   1. the maths (WQ.CR; node-tested by tools/test-consumer-resource.mjs): R*, the
      single-species equilibria, their (R, C_i) eigenvalues, the invasion rates,
      the winner (the lower R*), runs with the stiff solver (WQ.ODE.solveStiff:
      the food can change thousands of times faster than the consumers)
   2. the page: four slider groups and presets → three panels (time series with
      a linear/log switch, the R* rule, the C₁–C₂ phase portrait), each with a
      green terminal box
   Reference: github.com/ashutosh-shinde/Population-Dynamics,
   Two_species_population_models/ (section 2).
   HOW TO EDIT: DEFAULTS, PRESETS.
   ============================================================================= */
(function (G) {
  "use strict";
  const ODE = G.WQ && G.WQ.ODE;

  /* ================================================================ 1. maths */
  const u = (p, i, R) => (p["b" + i] * R) / (p["R0" + i] + R);
  const du = (p, i, R) => (p["b" + i] * p["R0" + i]) / ((p["R0" + i] + R) * (p["R0" + i] + R));
  const growth = (p, i, R) => p["g" + i] * u(p, i, R) - p["d" + i]; // per head, at food level R

  function field(p) { // state (C1, C2, R)
    return (t, y, d) => {
      const C1 = y[0], C2 = y[1], R = y[2], u1 = u(p, 1, R), u2 = u(p, 2, R);
      d[0] = C1 * (p.g1 * u1 - p.d1); d[1] = C2 * (p.g2 * u2 - p.d2); d[2] = p.I - u1 * C1 - u2 * C2;
    };
  }
  function jacobian(p) {
    return (t, y, J) => {
      const C1 = y[0], C2 = y[1], R = y[2], u1 = u(p, 1, R), u2 = u(p, 2, R), d1 = du(p, 1, R), d2 = du(p, 2, R);
      J[0] = p.g1 * u1 - p.d1; J[1] = 0; J[2] = C1 * p.g1 * d1;
      J[3] = 0; J[4] = p.g2 * u2 - p.d2; J[5] = C2 * p.g2 * d2;
      J[6] = -u1; J[7] = -u2; J[8] = -d1 * C1 - d2 * C2;
    };
  }
  function Rstar(p, i) { const gb = p["g" + i] * p["b" + i], d = p["d" + i]; return gb > d ? (d * p["R0" + i]) / (gb - d) : Infinity; }
  // species i alone: R = R_i*, C_i = Iγ_i/δ_i; its (R, C_i) block and the other's invasion rate
  function single(p, i) {
    const Rs = Rstar(p, i); if (!Number.isFinite(Rs) || !(p.I > 0)) return null;
    const j = 3 - i, C = (p.I * p["g" + i]) / p["d" + i], ui = u(p, i, Rs), dui = du(p, i, Rs);
    const block = [-dui * C, -ui, p["g" + i] * dui * C, 0]; // rows (R, C_i)
    const eig = ODE.eig2(block[0], block[1], block[2], block[3]), cls = ODE.classify2(eig);
    const inv = growth(p, j, Rs);
    const state = i === 1 ? [C, 0, Rs] : [0, C, Rs];
    return { i, j, R: Rs, C, state, block, eig, type: cls.label, inv, stable: inv < 0 };
  }
  // who wins: "1" | "2" | "tie" | "none" (neither can persist); counts only the species present at the start
  function winner(p, present = [true, true]) {
    const R1 = present[0] ? Rstar(p, 1) : Infinity, R2 = present[1] ? Rstar(p, 2) : Infinity;
    if (!Number.isFinite(R1) && !Number.isFinite(R2)) return "none";
    if (Number.isFinite(R1) && Number.isFinite(R2) && Math.abs(R1 - R2) <= 1e-6 * Math.max(R1, R2)) return "tie";
    return R1 < R2 ? "1" : "2";
  }
  // a run from s = (C1(0), C2(0), R(0)). A consumer that is present is integrated as c = ln C, so that
  // dc/dt = γu(R) − δ: when a big rival eats the food down, the eventual winner can be pushed to 1e−12 and far
  // below, far below any absolute tolerance in C, and must still come back on time. An absent consumer stays 0.
  function run(p, s, tmax, samples = 600) {
    const on = [s[0] > 0, s[1] > 0];
    const F = (t, y, d) => {
      const R = y[2], u1 = u(p, 1, R), u2 = u(p, 2, R), C1 = on[0] ? Math.exp(y[0]) : 0, C2 = on[1] ? Math.exp(y[1]) : 0;
      d[0] = on[0] ? p.g1 * u1 - p.d1 : 0; d[1] = on[1] ? p.g2 * u2 - p.d2 : 0; d[2] = p.I - u1 * C1 - u2 * C2;
    };
    const J = (t, y, M) => {
      const R = y[2], u1 = u(p, 1, R), u2 = u(p, 2, R), d1 = du(p, 1, R), d2 = du(p, 2, R), C1 = on[0] ? Math.exp(y[0]) : 0, C2 = on[1] ? Math.exp(y[1]) : 0;
      M[0] = 0; M[1] = 0; M[2] = on[0] ? p.g1 * d1 : 0;
      M[3] = 0; M[4] = 0; M[5] = on[1] ? p.g2 * d2 : 0;
      M[6] = -u1 * C1; M[7] = -u2 * C2; M[8] = -d1 * C1 - d2 * C2;
    };
    const y0 = [on[0] ? Math.log(s[0]) : 0, on[1] ? Math.log(s[1]) : 0, s[2]];
    const r = ODE.solveStiff(F, J, y0, 0, tmax, { rtol: 1e-5, atol: [1e-7, 1e-7, 1e-8], samples, nonneg: false, floor: [-Infinity, -Infinity, 0], maxSteps: 100000 });
    const n = r.n, C1 = new Float64Array(n), C2 = new Float64Array(n);
    for (let i = 0; i < n; i++) { C1[i] = on[0] ? Math.exp(r.y[0][i]) : 0; C2[i] = on[1] ? Math.exp(r.y[1][i]) : 0; }
    return { t: r.t.subarray(0, n), C1, C2, R: r.y[2].subarray(0, n), status: r.status, tEnd: r.tEnd, steps: r.steps, n };
  }
  // the loser's exclusion: after its peak, the first time it is below 1 % of that peak (linear between samples)
  function exclusion(R, which) {
    const C = which === 1 ? R.C1 : R.C2; let k = 0;
    for (let i = 1; i < C.length; i++) if (C[i] > C[k]) k = i;
    let peak = C[k], tPeak = R.t[k];
    if (k > 0 && k < C.length - 1) { // a parabola through the three samples around the largest one: the peak between samples
      const a = C[k - 1], b = C[k], c = C[k + 1], den = a - 2 * b + c;
      if (den < 0) { const off = (0.5 * (a - c)) / den; peak = b - 0.25 * (a - c) * off; tPeak = R.t[k] + off * (R.t[k + 1] - R.t[k]); }
    }
    const lim = 0.01 * peak; if (!(peak > 0)) return null;
    for (let i = k + 1; i < C.length; i++) if (C[i] < lim) {
      const a = C[i - 1], b = C[i], w = a === b ? 1 : (a - lim) / (a - b);
      return { peak, tPeak, t: R.t[i - 1] + w * (R.t[i] - R.t[i - 1]) };
    }
    return { peak, tPeak, t: null };
  }
  // the line L_i of the C1–C2 portrait: u1(R_i*)C1 + u2(R_i*)C2 = I; its axis intercepts
  function line(p, i) {
    const Rs = Rstar(p, i); if (!Number.isFinite(Rs) || !(p.I > 0)) return null; // (no food input: no balance line)
    const a = u(p, 1, Rs), b = u(p, 2, Rs);
    return { R: Rs, a, b, x: a > 0 ? p.I / a : Infinity, y: b > 0 ? p.I / b : Infinity };
  }
  // within 1 % of an equilibrium: the consumers relative to the winner's C*, the food relative to R*
  function near(state, eq, tol = 0.01) {
    const C = Math.max(eq.C, 1e-12);
    return Math.abs(state[0] - eq.state[0]) <= tol * C && Math.abs(state[1] - eq.state[1]) <= tol * C && Math.abs(state[2] - eq.R) <= tol * Math.max(eq.R, 1e-12);
  }

  const M = { u, du, growth, field, jacobian, Rstar, single, winner, run, exclusion, line, near };
  (G.WQ = G.WQ || {}).CR = M;
  if (typeof document === "undefined") return; // (in node: the maths only)

  /* ================================================================ 2. page */
  const Sim = G.WQ.Sim, C = G.WQ.Plot.COLORS, $ = (id) => document.getElementById(id);
  const { fmt, fmtSig, signed, hi, dim, warn, why } = Sim;
  const DEFAULTS = { I: 12, b1: 4, R01: 5, g1: 1.4, d1: 0.5, b2: 3, R02: 5, g2: 1, d2: 0.8, C1s: 5, C2s: 5, Rs: 10, tmax: 50 };
  const BASE = { I: 12, b1: 4, b2: 3, R01: 5, R02: 5, g1: 1.4, g2: 1 };
  const PRESETS = [
    { label: "R₁* < R₂*: species 1 wins", values: Object.assign({}, BASE, { d1: 0.5, d2: 0.8 }) },
    { label: "R₁* > R₂*: species 2 wins", values: Object.assign({}, BASE, { d1: 1.9, d2: 0.8 }) },
    { label: "R₁* = R₂*: a tie", values: Object.assign({}, BASE, { d1: 0.5, d2: 0.267857 }) },
  ];
  const IDS = ["I", "b1", "R01", "g1", "d1", "b2", "R02", "g2", "d2", "C1s", "C2s", "Rs", "tmax"];
  const S = Object.assign({}, DEFAULTS);
  let P, R1s, R2s, W, EQ, main, excl, fan = null, sliders = {}, plots = {}, loop, logScale = false;
  const snap = () => Object.assign({}, S);
  const sig = (v) => fmtSig(v, 4);

  function compute() {
    P = snap(); R1s = Rstar(P, 1); R2s = Rstar(P, 2);
    const present = [P.C1s > 0, P.C2s > 0];
    W = P.I > 0 && (present[0] || present[1]) ? winner(P, present) : null;
    EQ = { 1: single(P, 1), 2: single(P, 2) };
    main = run(P, [P.C1s, P.C2s, P.Rs], P.tmax);
    excl = null;
    if (W === "1" && present[1]) excl = { who: 2, e: exclusion(main, 2) };
    if (W === "2" && present[0]) excl = { who: 1, e: exclusion(main, 1) };
  }
  const heavy = Sim.debounce(() => { fan = fanRuns(); loop.want("heavy"); }, 200);
  function portraitAxes() {
    const L1 = line(P, 1), L2 = line(P, 2), xs = [P.C1s], ys = [P.C2s];
    // an intercept far beyond that axis's equilibrium and start is capped (a tiny R* gives a huge intercept)
    const refX = Math.max(1, P.C1s, EQ[1] ? EQ[1].C : 0), refY = Math.max(1, P.C2s, EQ[2] ? EQ[2].C : 0);
    const cap = (v, ref) => (Number.isFinite(v) ? Math.min(v, 3 * ref) : 0);
    for (const L of [L1, L2]) if (L) { xs.push(cap(L.x, refX)); ys.push(cap(L.y, refY)); }
    if (EQ[1]) xs.push(EQ[1].C); if (EQ[2]) ys.push(EQ[2].C);
    return { X: 1.15 * Math.max(...xs, 1e-6), Y: 1.15 * Math.max(...ys, 1e-6), L1, L2 };
  }
  function fanRuns() {
    const A = portraitAxes(), out = [];
    for (const a of [0.15, 0.5, 0.85]) for (const b of [0.15, 0.5, 0.85]) out.push({ s: [a * A.X, b * A.Y], r: run(P, [a * A.X, b * A.Y, P.Rs], P.tmax, 300) });
    return out;
  }

  /* ---------------------------------------------------- A. time series */
  function drawTime() {
    const p = plots.time, R = main;
    let top = 0, minPos = Infinity;
    for (let i = 0; i < R.n; i++) for (const v of [R.C1[i], R.C2[i], R.R[i]]) { if (v > top) top = v; if (v > 0 && v < minPos) minPos = v; }
    top = Math.max(top, 1e-6);
    if (logScale) {
      const lo = Math.max(1e-6, Number.isFinite(minPos) ? minPos : 1e-6), hiV = Math.max(1.2 * top, lo * 10);
      p.set({ x: [0, P.tmax], y: [lo, hiV], log: true, xLabel: "t", yLabel: "density" }).clear();
    } else p.set({ x: [0, P.tmax], y: [0, 1.1 * top], log: false, xLabel: "t", yLabel: "density" }).clear();
    if (Number.isFinite(R1s)) p.hline(R1s, C.yellow, { alpha: 0.5, label: "R_1*", labelAt: "left" });
    if (Number.isFinite(R2s)) p.hline(R2s, C.blue, { alpha: 0.5, label: "R_2*" });
    const t = Array.from(R.t);
    p.line(t, Array.from(R.R), C.white, { width: 1.8 });
    p.line(t, Array.from(R.C1), C.yellow, { width: 2 });
    p.line(t, Array.from(R.C2), C.blue, { width: 2 });
    p.legend([{ label: "R (food)", color: C.white }, { label: "C₁", color: C.yellow }, { label: "C₂", color: C.blue }]);
  }
  function paramLine() {
    return `> I = ${fmt(P.I, 1)} · species 1: β ${fmt(P.b1, 2)}, R_0 ${fmt(P.R01, 2)}, γ ${fmt(P.g1, 2)}, δ ${fmt(P.d1, 3)} · species 2: β ${fmt(P.b2, 2)}, R_0 ${fmt(P.R02, 2)}, γ ${fmt(P.g2, 2)}, δ ${fmt(P.d2, 3)}`;
  }
  function eqLines(e) {
    const L = [`  equilibrium R = ${sig(e.R)}, C_${e.i} = I γ_${e.i}/δ_${e.i} = ${fmt(e.C, 2)}, C_${e.j} = 0`];
    const ev = e.eig.complex ? `${fmt(e.eig.re1)} ± ${fmt(Math.abs(e.eig.im1))}i` : `${fmt(e.eig.re1)}, ${fmt(e.eig.re2)}`;
    L.push(`  eigenvalues of (R, C_${e.i}): ${ev} (${e.type})`);
    if (e.eig.complex) L.push(why(`stable spiral: C_${e.i} and R oscillate as they settle`));
    L.push(`  invasion rate of species ${e.j} there: ${fmt(e.inv)} (${e.inv < 0 ? "< 0: it cannot return" : "> 0: it could invade"})`);
    return L;
  }
  function timeBox() {
    const L = [paramLine(), `> R_1* = ${sig(R1s)} · R_2* = ${sig(R2s)}`];
    if (main.status === "maxsteps") L.push(warn(`> stopped at t = ${fmt(main.tEnd, 2)}: the model is too stiff here`));
    if (P.I === 0) { L.push(["> ", hi("no food input: the food runs out and both consumers starve")]); return L; }
    if (P.C1s === 0 && P.C2s === 0) { L.push(["> ", hi("no consumers: food piles up at rate I")]); return L; }
    for (const i of [1, 2]) if (!Number.isFinite(Rstar(P, i)) && (i === 1 ? P.C1s : P.C2s) > 0 && W !== "none") L.push(`> species ${i} cannot persist (γ_${i}β_${i} ≤ δ_${i})`);
    if (W === "none") {
      // nobody present can persist: either neither species can, or the one that could is absent
      const can = [1, 2].filter((i) => Number.isFinite(Rstar(P, i)));
      if (!can.length) L.push(["> ", hi("neither can persist: both die out and the food piles up (dR/dt → I)")]);
      else L.push(["> ", hi(`species ${3 - can[0]} cannot persist (γ_${3 - can[0]}β_${3 - can[0]} ≤ δ_${3 - can[0]}) and species ${can[0]} is absent: the food piles up (dR/dt → I)`)]);
      absent(L); return L;
    }
    if (W === "tie") {
      L.push(["> ", hi("a tie: R_1* = R_2*")]);
      L.push(why("both sit at zero growth: any amount of each on a line of equilibria"));
      L.push(why("fragile: the smallest change of a parameter decides"));
      absent(L); return L;
    }
    const w = Number(W), e = EQ[w], l = 3 - w;
    L.push(["> winner: ", hi(`species ${w}${(w === 1 ? P.C2s : P.C1s) > 0 && Number.isFinite(Rstar(P, l)) ? " (lower R*)" : ""}`)]);
    L.push(...eqLines(e));
    if (excl && excl.e) L.push(excl.e.t != null ? `> species ${l} dropped below 1% of its peak at t = ${fmt(excl.e.t, 2)}` : `> species ${l} is still above 1% of its peak at t_max`);
    if ((l === 1 ? P.C1s : P.C2s) > 0 && Number.isFinite(Rstar(P, l))) {
      L.push(why(`species ${w} can live on less food (R_${w}* < R_${l}*)`));
      L.push(why(`it eats the food down to R_${w}*, where species ${l} starves`));
      L.push(why("the winner is not who eats most when food is plenty, but who survives when it is scarce"));
    }
    absent(L);
    const end = [main.C1[main.n - 1], main.C2[main.n - 1], main.R[main.n - 1]];
    if (!near(end, e)) L.push(warn("> not settled by t_max"));
    return L;
  }
  function absent(L) {
    if (P.C1s === 0 && P.C2s > 0) L.push(why("species 1 is absent and cannot appear (no immigration)"));
    if (P.C2s === 0 && P.C1s > 0) L.push(why("species 2 is absent and cannot appear (no immigration)"));
  }

  /* ---------------------------------------------------- B. the R* rule */
  function rAxis() {
    const fin = [R1s, R2s].filter(Number.isFinite);
    return Math.min(100, Math.max(fin.length ? 3 * Math.max(...fin) : 0, 1.2 * P.Rs, 1));
  }
  function drawRule() {
    const p = plots.rule, X = rAxis(), n = 300, xs = [], g1 = [], g2 = [];
    for (let k = 0; k <= n; k++) { const R = (X * k) / n; xs.push(R); g1.push(growth(P, 1, R)); g2.push(growth(P, 2, R)); }
    const all = g1.concat(g2), lo = Math.min(...all), top = Math.max(...all, 0.05), pad = 0.08 * (top - lo || 1);
    p.set({ x: [0, X], y: [lo - pad, top + pad], xLabel: "R", yLabel: "growth per head" }).clear();
    p.hline(0, C.white, { dash: [1, 0], alpha: 0.35, width: 1 });
    p.line(xs, g1, C.yellow, { width: 2 }); p.line(xs, g2, C.blue, { width: 2 });
    if (Number.isFinite(R1s) && R1s <= X) p.marker(R1s, 0, "stable", { color: C.yellow, label: "R₁*" });
    if (Number.isFinite(R2s) && R2s <= X) p.marker(R2s, 0, "stable", { color: C.blue, label: "R₂*" });
    const Rend = main.R[main.n - 1];
    if (Rend <= X) p.vline(Rend, C.white, { dash: [2, 4], label: "R at t_max" });
    p.legend([{ label: "species 1", color: C.yellow }, { label: "species 2", color: C.blue }]);
  }
  function ruleBox() {
    const L = ["> growth per head g_i(R) = γ_i β_i R/(R_0i + R) − δ_i", `  R_1* = ${sig(R1s)} (g_1 = 0) · R_2* = ${sig(R2s)} (g_2 = 0)`];
    const fin1 = Number.isFinite(R1s), fin2 = Number.isFinite(R2s);
    if (fin1 && fin2 && W !== "tie") {
      const w = R1s < R2s ? 1 : 2, l = 3 - w, Rw = w === 1 ? R1s : R2s, gl = growth(P, l, Rw);
      L.push(`> at R = R_${w}* = ${sig(Rw)}: g_${l} = ${fmt(gl)} < 0`);
      L.push(why(`species ${w} holds the food at R_${w}*, where species ${l} shrinks`));
      L.push(why("whichever needs less food (the lower R*) wins"));
    } else if (W === "tie") L.push(why("the two curves cross zero at the same food level: neither can push the other out"));
    for (const j of [1, 2]) if (!Number.isFinite(Rstar(P, j))) L.push(why(`species ${j}: g_${j} < 0 for every R (its curve never reaches 0)`));
    const Rend = main.R[main.n - 1];
    L.push(`> food at t_max: R = ${sig(Rend)}`);
    if (Rend > rAxis()) L.push(why("(beyond the right edge of the plot)"));
    return L;
  }

  /* ---------------------------------------------------- C. phase portrait C1–C2 */
  function drawPhase() {
    const p = plots.phase, A = portraitAxes();
    p.set({ x: [0, A.X], y: [0, A.Y], xLabel: "C_1", yLabel: "C_2" }).clear();
    const drawL = (L, colour) => { if (!L) return; const xs = [], ys = []; // u1·C1 + u2·C2 = I, clipped by the plot
      if (L.b > 0) { for (let k = 0; k <= 100; k++) { const x = (A.X * k) / 100, y = (P.I - L.a * x) / L.b; if (y >= 0) { xs.push(x); ys.push(y); } } }
      else if (L.a > 0) { xs.push(L.x, L.x); ys.push(0, A.Y); }
      if (xs.length > 1) p.line(xs, ys, colour, { dash: [6, 5], width: 1.6 }); };
    drawL(A.L1, C.yellow); drawL(A.L2, C.blue);
    if (fan) for (const f of fan) p.line(Array.from(f.r.C1), Array.from(f.r.C2), "rgba(246,244,236,0.7)", { width: 1.1, arrowAt: 0.3 });
    p.line(Array.from(main.C1), Array.from(main.C2), C.white, { width: 2.4, arrowAt: 0.3 });
    for (const i of [1, 2]) { const e = EQ[i]; if (!e) continue; p.marker(i === 1 ? e.C : 0, i === 1 ? 0 : e.C, e.stable ? "stable" : "saddle", { label: `species ${i} alone` }); }
    p.legend([{ label: "line 1 (R = R₁*)", color: C.yellow }, { label: "line 2 (R = R₂*)", color: C.blue }]);
  }
  function phaseBox() {
    if (!fan) return [dim("> computing…")];
    const L = [], L1 = line(P, 1), L2 = line(P, 2);
    if (L1) L.push(`> line 1: food balances at R = R_1*; it meets the C_1 axis at C_1* = ${fmt(L1.x, 2)}`);
    else L.push(P.I > 0 ? "> line 1: none (species 1 cannot persist)" : "> line 1: none (no food input)");
    if (L2) L.push(`> line 2: food balances at R = R_2*; it meets the C_2 axis at C_2* = ${fmt(L2.y, 2)}`);
    else L.push(P.I > 0 ? "> line 2: none (species 2 cannot persist)" : "> line 2: none (no food input)");
    if (P.I === 0) { L.push("> no food input: every orbit runs down to (0, 0)"); return L; }
    if (W === "tie" || (Number.isFinite(R1s) && Number.isFinite(R2s) && Math.abs(R1s - R2s) <= 1e-6 * Math.max(R1s, R2s))) {
      L.push(["> ", hi("the two lines coincide: every point on it is an equilibrium (a tie)")]); return L;
    }
    const all = winner(P), e = all === "1" || all === "2" ? EQ[Number(all)] : null;
    if (!e) { L.push(["> ", hi("neither can persist: every orbit runs down to (0, 0)")]); return L; }
    const target = all === "1" ? `(${fmt(e.C, 2)}, 0)` : `(0, ${fmt(e.C, 2)})`;
    const there = fan.filter((f) => near([f.r.C1[f.r.n - 1], f.r.C2[f.r.n - 1], f.r.R[f.r.n - 1]], e)).length;
    if (there === fan.length) L.push(["> every orbit ends at ", target, ": ", hi(`species ${all} wins`)]);
    else L.push(["> orbits head for ", target, ": ", hi(`species ${all} wins`), `; ${there} of ${fan.length} are there by t_max`]);
    L.push(why("orbits head for the line of the lower R*, then slide along it to its axis"));
    return L;
  }

  /* ---------------------------------------------------- runtime checks (?check=1) */
  function runChecks(boxes) {
    const ck = Sim.check, F = field(P);
    for (const i of [1, 2]) {
      const Rs = Rstar(P, i); if (Number.isFinite(Rs)) ck("g_i(R_i*) = 0", Math.abs(growth(P, i, Rs)) < 1e-10, `species ${i} ${growth(P, i, Rs)}`);
      const e = EQ[i]; if (!e) continue;
      const d = [0, 0, 0]; F(0, e.state, d);
      ck("dR/dt = 0 and dC_i/dt = 0 at the equilibrium", Math.abs(d[2]) <= 1e-9 * Math.max(P.I, 1) && Math.abs(d[i - 1]) <= 1e-9 * Math.max(e.C, 1), `species ${i} ${d}`);
      ck("winner by R* = invasion test", (e.inv < 0) === (Rs < Rstar(P, 3 - i)) || Math.abs(e.inv) < 1e-9, `species ${i} inv ${e.inv}`);
      const J = ODE.jacFD(F, e.state), r = 2, c = i - 1; // the (R, C_i) sub-matrix of the full Jacobian
      const en = ODE.eig2(J[r * 3 + r], J[r * 3 + c], J[c * 3 + r], J[c * 3 + c]);
      const tol = 1e-5 * Math.max(1, Math.abs(e.eig.re1), Math.abs(e.eig.re2));
      ck("block eigenvalues = finite-difference Jacobian", Math.abs(en.re1 - e.eig.re1) < tol && Math.abs(en.re2 - e.eig.re2) < tol && Math.abs(Math.abs(en.im1) - Math.abs(e.eig.im1)) < tol, `${e.eig.re1},${e.eig.re2} vs ${en.re1},${en.re2}`);
    }
    if ((W === "1" || W === "2") && main.status === "ok") {
      const e = EQ[Number(W)], lam = Math.min(Math.abs(e.eig.re1), Math.abs(e.eig.re2), Math.abs(e.inv));
      const end = [main.C1[main.n - 1], main.C2[main.n - 1], main.R[main.n - 1]];
      // skipped when the winner was pushed deep down on the way (below 1e-9 of C*): climbing back takes ~ln(1e9)/λ, more than 10/λ
      const Cw = W === "1" ? main.C1 : main.C2; let low = Infinity; for (let k = 1; k < main.n; k++) low = Math.min(low, Cw[k]);
      if (lam > 0 && P.tmax >= 10 / lam && low >= 1e-9 * e.C) ck("final state within 1% of the winner's equilibrium", near(end, e), `end ${end} eq ${e.state} λ ${lam}`);
    }
    const text = boxes.map((b) => b.textContent).join(" ");
    ck("boxes are finite", !/NaN|Infinity|undefined|\bnull\b/.test(text), text.slice(0, 120));
  }

  /* ---------------------------------------------------- wiring */
  const boxes = () => ["term-time", "term-rule", "term-phase"].map($);
  const writeBoxes = Sim.throttle(() => {
    Sim.term($("term-time"), timeBox()); Sim.term($("term-rule"), ruleBox()); Sim.term($("term-phase"), phaseBox());
    if (Sim.checking) runChecks(boxes());
  }, 150);
  function render(dirty) {
    if (dirty.has("data")) { compute(); fan = null; heavy(); }
    drawTime(); drawRule(); drawPhase();
    writeBoxes();
  }
  function start() {
    if (!$("cv-time") || !$("term-phase")) return;
    plots.time = G.WQ.Plot.create($("cv-time"), {});
    plots.rule = G.WQ.Plot.create($("cv-rule"), { pad: { l: 58 } });
    plots.phase = G.WQ.Plot.create($("cv-phase"), {});
    loop = Sim.loop(render);
    Object.values(plots).forEach((p) => p.onResize(() => loop.want("draw")));
    const f1 = (v) => fmt(v, 1), f2 = (v) => fmt(v, 2), f3 = (v) => fmt(v, 3);
    const fm = { I: f1, b1: f2, R01: f2, g1: f2, d1: f3, b2: f2, R02: f2, g2: f2, d2: f3, C1s: f1, C2s: f1, Rs: f1, tmax: (v) => String(Math.round(v)) };
    for (const id of IDS) sliders[id] = Sim.slider(id, { fmt: fm[id], onInput: (v) => { S[id] = v; loop.want("data"); } });
    // (the tie preset's δ₂ = 0.267857 needs the exact value: the slider's step would round it)
    Sim.presets($("presets"), PRESETS, (vals) => { for (const [k, v] of Object.entries(vals)) { sliders[k].set(v, { silent: true }); S[k] = v; } loop.want("data"); });
    Sim.seg($("scale"), (v) => { logScale = v === "log"; loop.want("draw"); });
    loop.want("data");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})(typeof window !== "undefined" ? window : globalThis);
