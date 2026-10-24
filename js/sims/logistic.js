/* =============================================================================
   logistic.js — the discrete-time logistic model: maths and page
   -----------------------------------------------------------------------------
   Page: simulations/population-dynamics/discrete-logistic/
     X_{t+1} = R_m X_t (1 − X_t)
   1. the maths (WQ.Logistic, no page needed: tools/test-logistic.mjs tests it)
      fixed points and their stability, the 2-cycle, the Lyapunov exponent,
      the state of the system (extinction … chaos), runs with a small error
      in X_0, the bifurcation diagram
   2. the page: sliders → three panels of plots, each with a green
      "terminal" box that explains what the plot shows (WQ.Plot draws)
   Reference: the R code in github.com/ashutosh-shinde/Population-Dynamics
   (Discrete_time_logistic_model): same error values, 100 steps for the
   error runs, 1000 steps keeping the last 200 for the bifurcation diagram.

   HOW TO EDIT: EPS_TOL (the predictability tolerance), ERRORS (the fixed
   errors and their colours), DEFAULTS (the values the page opens with),
   BIF (the bifurcation diagram's steps), LANDMARKS (the list in its box).
   ============================================================================= */
(function (G) {
  "use strict";

  /* ================================================================ 1. maths */
  const EPS_TOL = 0.01;                                        // an error is "visible" above this
  const R_INF = 3.569945672;                                   // onset of chaos (Feigenbaum point)
  const DOUBLINGS = [3, 1 + Math.sqrt(6), 3.544090360, 3.564407266, 3.568759420]; // periods 2, 4, 8, 16, 32 begin
  const EPS = 1e-9;

  const f = (R, x) => R * x * (1 - x);
  const df = (R, x) => R * (1 - 2 * x);

  function trajectory(R, x0, steps) {
    const a = new Float64Array(steps + 1); a[0] = x0;
    for (let i = 1; i <= steps; i++) a[i] = f(R, a[i - 1]);
    return a;
  }
  function stability(m) {
    const a = Math.abs(m);
    return a < 1 - EPS ? "stable" : a > 1 + EPS ? "unstable" : "neutral (test inconclusive)";
  }
  /* the fixed points x* = 0 and x* = 1 − 1/R_m (when R_m > 1), with f'(x*) */
  function fixedPoints(R) {
    const out = [{ x: 0, slope: R, stab: stability(R) }];
    if (R > 1 + EPS) { const x = 1 - 1 / R, s = 2 - R; out.push({ x, slope: s, stab: stability(s) }); }
    return out;
  }
  /* the 2-cycle (R_m > 3): its two points and multiplier f'(p+)·f'(p−) = −R² + 2R + 4 */
  function twoCycle(R) {
    if (!(R > 3 + EPS)) return null;
    const d = Math.sqrt((R + 1) * (R - 3)), lo = (R + 1 - d) / (2 * R), hi = (R + 1 + d) / (2 * R), mu = -R * R + 2 * R + 4;
    return { lo, hi, mu, stab: stability(mu) };
  }
  /* Lyapunov exponent: mean of ln|f'(X_t)| along the orbit (after a transient) */
  function lyapunov(R, x0) {
    if (R <= 0 || x0 <= 0 || x0 >= 1) return null;
    let x = x0;
    for (let i = 0; i < 1000; i++) x = f(R, x);
    let s = 0;
    for (let i = 0; i < 4000; i++) { s += Math.log(Math.max(Math.abs(df(R, x)), 1e-300)); x = f(R, x); }
    return s / 4000;
  }
  /* the period of the long-run orbit (1…64), or 0 when none is found */
  function period(R, x0) {
    let x = x0;
    for (let i = 0; i < 3000; i++) x = f(R, x);
    const v = new Float64Array(400);
    for (let i = 0; i < 400; i++) { v[i] = x; x = f(R, x); }
    for (let p = 1; p <= 64; p++) {
      let ok = true;
      for (let n = 0; n < 256; n++) if (!(Math.abs(v[n + p] - v[n]) < 1e-7)) { ok = false; break; }
      if (ok) return p;
    }
    return 0;
  }
  const pow2 = (p) => p > 0 && (p & (p - 1)) === 0;
  /* the state of the system: { kind, text, period, lambda, ladder } */
  function classify(R, x0) {
    const lambda = lyapunov(R, x0);
    if (R <= EPS) return { kind: "extinct", text: "extinct after one step (R_m = 0)", period: 1, lambda };
    if (x0 <= 0) return { kind: "extinct", text: "stays at 0 (no population)", period: 1, lambda };
    if (x0 >= 1) return { kind: "extinct", text: "X_1 = 0: extinct after one step", period: 1, lambda };
    if (R < 1 - EPS) return { kind: "extinction", text: "extinction", period: 1, lambda };
    if (Math.abs(R - 1) <= EPS) return { kind: "extinction", text: "extinction (slow: R_m = 1 is a bifurcation point)", period: 1, lambda };
    const p = period(R, x0);
    const L = lambda ?? 0;
    let kind, text;
    if (p === 1) { kind = "equilibrium"; text = `stable equilibrium (x* = ${(1 - 1 / R).toFixed(4)})`; }
    else if (p === 2 || p === 4 || p === 8) { kind = "cycle"; text = `period-${p} oscillation`; }
    else if (p >= 16 && pow2(p)) { kind = "cycle16"; text = "period 16+ oscillation (on the edge of chaos)"; }
    else if (p) { kind = "window"; text = `periodic window, period ${p}`; }
    else if (L > 0.001) { kind = "chaos"; text = "chaos"; }
    else if (L < -0.001) { kind = "settling"; text = "slowly settling (near a bifurcation point)"; }
    else { kind = "bifurcation"; text = "at a bifurcation point"; }
    return { kind, text, period: p, lambda };
  }
  /* where a run with error δ starts: X_0 + δ, or X_0 − δ if that leaves [0, 1]
     (and back to X_0 + δ if X_0 − δ would be below 0) */
  function errStart(x0, d) {
    let x = x0 + d, minus = false;
    if (x > 1) { x = x0 - d; minus = true; if (x < 0) { x = x0 + d; minus = false; } }
    return { x, minus };
  }
  /* first t with |E_t| > tol, or null */
  function horizon(ref, run, tol = EPS_TOL) {
    const lim = tol * (1 + 1e-9); // (so that δ = 0.01 is not "above" 0.01 by a rounding error)
    for (let t = 0; t < ref.length; t++) if (Math.abs(run[t] - ref[t]) > lim) return t;
    return null;
  }
  /* first t from which |E_s| ≤ tol for every later s shown, or null */
  function settles(ref, run, tol = EPS_TOL) {
    const lim = tol * (1 + 1e-9);
    for (let t = ref.length - 1; t >= 0; t--) if (Math.abs(run[t] - ref[t]) > lim) return t + 1 < ref.length ? t + 1 : null;
    return 0;
  }
  /* bifurcation diagram: for each R in Rs, X_t for t = keep0+1 … total (the last values) */
  function bifurcation(Rs, x0, total = 1000, keep = 200, each) {
    for (let i = 0; i < Rs.length; i++) {
      const R = Rs[i]; let x = x0;
      for (let t = 1; t <= total - keep; t++) x = f(R, x);
      for (let k = 0; k < keep; k++) { x = f(R, x); each(i, R, x); }
    }
  }

  const M = { f, df, trajectory, stability, fixedPoints, twoCycle, lyapunov, period, classify, errStart, horizon, settles, bifurcation, EPS_TOL, R_INF, DOUBLINGS };
  (G.WQ = G.WQ || {}).Logistic = M;
  if (typeof document === "undefined") return; // (in node: the maths only)

  /* ================================================================ 2. page */
  const DEFAULTS = { R: 3.2, x0: 0.2, steps: 60, pSteps: 100, bx0: 0.1 };
  const C = G.WQ.Plot.COLORS;
  const ERRORS = [
    { d: 0.1, color: C.yellow, label: "0.1" },
    { d: 0.01, color: C.blue, label: "0.01" },
    { d: 0.00001, color: C.pink, label: "0.00001" },
  ];
  const BIF = { full: [0, 4], step: 0.01, total: 1000, keep: 200, maxCols: 800, minW: 0.002 };
  const LANDMARKS = [ // the list in the bifurcation diagram's box (the current range is highlighted)
    { lo: -1, hi: 1, text: "R_m < 1       extinction" },
    { lo: 1, hi: 3, text: "1 < R_m < 3   one stable equilibrium" },
    { lo: 3, hi: DOUBLINGS[1], text: "R_m = 3       period 2 begins" },
    { lo: DOUBLINGS[1], hi: DOUBLINGS[2], text: "R_m ≈ 3.4495  period 4" },
    { lo: DOUBLINGS[2], hi: R_INF, text: "R_m ≈ 3.5441  period 8, 16, 32, …" },
    { lo: R_INF, hi: 1 + Math.sqrt(8), text: "R_m ≈ 3.5699  chaos begins" },
    { lo: 1 + Math.sqrt(8), hi: 3.8415, text: "R_m ≈ 3.8284  period-3 window" },
  ];
  const $ = (id) => document.getElementById(id);
  const S = Object.assign({}, DEFAULTS, { log: true, show: [true, true, true], custom: null, view: null, zoomMode: false });

  /* ---------------------------------------------------- text helpers */
  const num = (v, d = 3) => (v < 0 ? "−" : " ") + Math.abs(v).toFixed(d);
  const pad = (s, n) => (s + " ".repeat(n)).slice(0, Math.max(n, s.length));
  const hi = (s) => `<span class="term__hi">${s}</span>`;
  const dim = (s) => `<span class="term__dim">${s}</span>`;
  const cursor = '<span class="term__cursor" aria-hidden="true"></span>';
  const subs = (s) => s.replace(/R_m/g, "R<sub>m</sub>").replace(/X_0/g, "X<sub>0</sub>").replace(/X_1/g, "X<sub>1</sub>").replace(/X_t/g, "X<sub>t</sub>").replace(/E_t/g, "E<sub>t</sub>").replace(/ε_tol/g, "ε<sub>tol</sub>");
  const plainState = (st) => st.text;

  /* ---------------------------------------------------- the trajectory panel */
  function trajBox(st) {
    const R = S.R, x0 = S.x0, L = [];
    L.push(`> R_m = ${R.toFixed(3)}   X_0 = ${x0.toFixed(3)}`);
    L.push("> equilibria " + dim("(f' = slope at x*)"));
    for (const p of fixedPoints(R)) L.push(`  x* = ${p.x.toFixed(4)}  f' = ${num(p.slope)}  ${p.stab === "stable" ? hi(p.stab) : p.stab}`);
    const c2 = twoCycle(R);
    if (c2) {
      L.push("> 2-cycle " + dim("(μ = f'(p₁)·f'(p₂))"));
      L.push(`  ${c2.lo.toFixed(4)} ↔ ${c2.hi.toFixed(4)}  μ = ${num(c2.mu)}  ${c2.stab === "stable" ? hi(c2.stab) : c2.stab}`);
    }
    L.push(`> state: ${hi(st.text)}`);
    L.push(`> Lyapunov λ = ${st.lambda == null ? " —" : num(st.lambda)}${st.lambda != null && st.lambda > 0.001 ? dim("  > 0: chaos") : st.lambda != null && st.lambda < -0.001 ? dim("  < 0: settles") : ""}`);
    if (R > 3.5 && x0 > 0 && x0 < 1) {
      const steps = ["1", "2", "4", "8", "16+", "chaos"];
      const at = st.kind === "chaos" || st.kind === "window" ? 5 : st.kind === "cycle16" ? 4 : st.period === 8 ? 3 : st.period === 4 ? 2 : st.period === 2 ? 1 : st.period === 1 ? 0 : (R >= R_INF ? 5 : 4);
      L.push("> ladder  " + steps.map((s, i) => (i === at ? hi(`[${s}]`) : i < at ? dim(s) : s)).join(" → "));
      if (R < R_INF) {
        const next = DOUBLINGS.find((d) => d > R + 1e-12);
        const named = { [DOUBLINGS[2]]: "period 8", [DOUBLINGS[3]]: "period 16", [DOUBLINGS[4]]: "period 32" }[next];
        if (named) L.push(`  next: ${named} at R_m ≈ ${next.toFixed(4)}`);
        L.push(`  chaos begins at R_m ≈ ${R_INF.toFixed(4)} (${(R_INF - R).toFixed(4)} away)`);
      } else if (st.kind === "window") L.push(dim(`  inside the chaotic range: a window of order (period ${st.period})`));
      else L.push(dim(`  past the onset of chaos at R_m ≈ ${R_INF.toFixed(4)}`));
    }
    return subs(L.join("\n")) + cursor;
  }
  let pT;
  function drawTraj(st) {
    const xs = trajectory(S.R, S.x0, S.steps);
    pT.set({ x: [0, S.steps], y: [0, 1] }).clear();
    if (S.R > 1) pT.hline(1 - 1 / S.R, C.yellow, { dash: [6, 5], label: "x*" });
    const c2 = twoCycle(S.R);
    if (c2) { pT.hline(c2.lo, C.blue, { dash: [2, 4], alpha: 0.7 }); pT.hline(c2.hi, C.blue, { dash: [2, 4], alpha: 0.7 }); }
    pT.line(null, Array.from(xs), C.white, { width: 1.3, dots: true });
    $("cv-traj").setAttribute("aria-label", `Trajectory for R_m ${S.R.toFixed(3)}, X_0 ${S.x0.toFixed(3)}: ${plainState(st)}`);
  }

  /* ---------------------------------------------------- the predictability panels */
  function runs() {
    const ref = trajectory(S.R, S.x0, S.pSteps), out = [];
    ERRORS.forEach((e, i) => { if (S.show[i]) { const s = errStart(S.x0, e.d); out.push({ d: e.d, label: e.label, color: e.color, start: s.x, minus: s.minus, xs: trajectory(S.R, s.x, S.pSteps) }); } });
    if (S.custom) { const s = errStart(S.x0, S.custom); out.push({ d: S.custom, label: String(S.custom), color: C.orange, start: s.x, minus: s.minus, xs: trajectory(S.R, s.x, S.pSteps), custom: true }); }
    return { ref, out };
  }
  const sgn = (r) => (r.minus ? "−" : "+");
  function endText(r, ref, st) {
    const n = ref.length - 1, e = Math.abs(r.xs[n] - ref[n]);
    if (st.kind === "extinction" || st.kind === "extinct") return "dies out";
    if (st.kind === "chaos") return "wanders: chaos";
    if (st.kind === "equilibrium") return `ends at ${r.xs[n].toFixed(4)}`;
    if (st.kind === "cycle" || st.kind === "cycle16" || st.kind === "window") return e < 1e-4 ? "same cycle, in step" : "same cycle, out of step";
    return `ends at ${r.xs[n].toFixed(4)}`;
  }
  function predBoxes(st, R) {
    const { ref, out } = R;
    // C1: where each run starts and where it ends up
    const A = [`> R_m = ${S.R.toFixed(3)}   X_0 = ${S.x0.toFixed(3)}`, `> runs, ${S.pSteps} steps ` + dim("(δ: start → end)")];
    A.push(`  0         ${ref[0].toFixed(5)} → ${endText({ xs: ref }, ref, st)}`);
    for (const r of out) A.push(`  ${pad(r.label, 9)} ${r.start.toFixed(5)}${r.minus ? " (−δ)" : ""} → ${endText(r, ref, st)}`);
    if (!out.length) A.push(dim("  (no error runs selected)"));
    $("term-runs").innerHTML = subs(A.join("\n")) + cursor;

    // C2: the predictability horizon
    const B = [`> horizon: first t with |E_t| > ε_tol = ${EPS_TOL}`];
    let worst = null;
    for (const r of out) {
      const h = horizon(ref, r.xs);
      let txt;
      if (h == null) txt = dim(`within ε_tol for all t ≤ ${S.pSteps}`);
      else if (h === 0) { const k = settles(ref, r.xs); txt = k == null ? "above ε_tol from t = 0" : `above ε_tol until t = ${k}`; }
      else { const k = settles(ref, r.xs); txt = "t = " + h + (k != null && k > h && !(st.lambda > 0.001) ? dim(`, back within at t = ${k}`) : ""); }
      B.push(`  δ = ${pad(r.label, 8)} ${txt}`);
      if (r.d <= (worst ? worst.d : Infinity)) worst = { d: r.d, h };
    }
    const L = st.lambda;
    if (L != null && L > 0.001) {
      B.push(`> λ = ${L.toFixed(3)}: errors grow ×${Math.exp(L).toFixed(2)} per step`);
      B.push("  horizon ≈ ln(ε_tol/δ)/λ");
    } else if (L != null) B.push(`> λ = ${num(L).trim()}: errors ${L < -0.001 ? `shrink ×${Math.exp(L).toFixed(2)} per step` : "neither grow nor shrink much"}`);
    let verdict;
    const n = ref.length - 1, ends = out.map((r) => Math.abs(r.xs[n] - ref[n]));
    if (st.kind === "extinct" || st.kind === "extinction") verdict = "predictable: every run dies out";
    else if (L != null && L > 0.001) verdict = worst && worst.h != null ? `unpredictable after about ${worst.h} steps (chaos)` : `unpredictable in the long run (chaos), though these runs stay within ${EPS_TOL} for t ≤ ${S.pSteps}`;
    else if (!out.length) verdict = "choose an error to compare";
    else if (ends.every((e) => e < 1e-6)) verdict = "predictable: every run settles to the same state";
    else if (st.kind === "cycle" || st.kind === "cycle16" || st.kind === "window") verdict = "predictable up to a phase shift";
    else verdict = "predictable, but errors fade slowly (near a bifurcation point)";
    B.push(`> verdict: ${hi(verdict)}`);
    $("term-div").innerHTML = subs(B.join("\n")) + cursor;
  }
  let pR, pE;
  function drawPred(st, R) {
    const { ref, out } = R;
    pR.set({ x: [0, S.pSteps], y: [0, 1] }).clear();
    for (const r of out) pR.line(null, Array.from(r.xs), r.color, { width: 1.3 });
    pR.line(null, Array.from(ref), C.white, { width: 1.6 });
    pR.legend([{ label: "δ = 0 (reference)", color: C.white }, ...out.map((r) => ({ label: `δ = ${r.label}${r.minus ? " (−δ)" : ""}`, color: r.color }))]);
    // the note when a run had to start below X_0
    const flipped = out.filter((r) => r.minus);
    const note = $("note-runs");
    note.hidden = !flipped.length;
    if (flipped.length) note.innerHTML = flipped.map((r) => `<span class="m"><i>X</i><sub>0</sub> + ${r.label}</span> would leave [0, 1], so this run starts at <span class="m"><i>X</i><sub>0</sub> − ${r.label}</span>.`).join(" ");

    if (S.log) pE.set({ x: [0, S.pSteps], y: [1e-16, 1], log: true, yLabel: "|E_t|" });
    else pE.set({ x: [0, S.pSteps], y: [-1, 1], log: false, yLabel: "E_t" });
    pE.clear();
    if (S.log) pE.hline(EPS_TOL, C.white, { dash: [3, 4], alpha: 0.5, label: "ε_tol", labelAt: "left" });
    else { pE.hline(EPS_TOL, C.white, { dash: [3, 4], alpha: 0.45 }); pE.hline(-EPS_TOL, C.white, { dash: [3, 4], alpha: 0.45 }); pE.hline(0, C.white, { dash: [1, 0], alpha: 0.25, width: 1 }); }
    for (const r of out) {
      const e = new Array(ref.length);
      for (let t = 0; t < ref.length; t++) { const d = r.xs[t] - ref[t]; e[t] = S.log ? Math.max(Math.abs(d), 1e-16) : d; }
      pE.line(null, e, r.color, { width: 1.3 });
    }
    if (out.length) pE.legend(out.map((r) => ({ label: `δ = ${r.label}`, color: r.color })));
    $("cv-runs").setAttribute("aria-label", `Error trajectories for R_m ${S.R.toFixed(3)}, X_0 ${S.x0.toFixed(3)}`);
    $("cv-div").setAttribute("aria-label", `Divergence of the errors (${S.log ? "log" : "linear"} axis)`);
  }

  /* ---------------------------------------------------- the bifurcation panel */
  let pB, dotsCv = null, dotsKey = "", drag = null;
  const view = () => S.view || { x: BIF.full, y: [0, 1] };
  function dots() {
    const v = view(), key = [v.x, v.y, S.bx0, pB.W, pB.H, pB.dpr].join("|");
    if (dotsCv && key === dotsKey) return dotsCv;
    dotsKey = key;
    const W = pB.canvas.width, H = pB.canvas.height, q = pB.dpr, a = pB.area;
    dotsCv = dotsCv || document.createElement("canvas"); dotsCv.width = W; dotsCv.height = H;
    const g = dotsCv.getContext("2d"), img = g.createImageData(W, H), px = img.data;
    let Rs;
    if (!S.view) { Rs = []; for (let i = 0; i <= Math.round((BIF.full[1] - BIF.full[0]) / BIF.step); i++) Rs.push(+(BIF.full[0] + i * BIF.step).toFixed(2)); }
    else { const n = Math.max(2, Math.min(BIF.maxCols, Math.round(a.w))); Rs = []; for (let i = 0; i < n; i++) Rs.push(v.x[0] + (v.x[1] - v.x[0]) * i / (n - 1)); }
    const x0 = a.l * q, y0 = a.t * q, w = a.w * q, h = a.h * q, dx = v.x[1] - v.x[0], dy = v.y[1] - v.y[0];
    bifurcation(Rs, S.bx0, BIF.total, BIF.keep, (i, R, x) => {
      const X = Math.round(x0 + (R - v.x[0]) / dx * w), Y = Math.round(y0 + (1 - (x - v.y[0]) / dy) * h);
      if (X < x0 || X > x0 + w || Y < y0 || Y > y0 + h) return;
      const k = 4 * (Y * W + X); px[k] = 246; px[k + 1] = 244; px[k + 2] = 236; px[k + 3] = Math.min(255, px[k + 3] + 140);
    });
    g.putImageData(img, 0, 0);
    return dotsCv;
  }
  function bifBox(st) {
    const R = S.R, v = view(), L = ["> landmarks"];
    for (const m of LANDMARKS) L.push("  " + (R >= m.lo && R < m.hi ? hi(m.text) : m.text));
    L.push(`> now: R_m = ${R.toFixed(3)} → ${hi(st.text)}`);
    L.push(`> view: R_m ${v.x[0].toFixed(3)}–${v.x[1].toFixed(3)}, X_t ${v.y[0].toFixed(3)}–${v.y[1].toFixed(3)}`);
    L.push(dim(`  X_0 = ${S.bx0.toFixed(1)}; X_t for t = ${BIF.total - BIF.keep + 1} … ${BIF.total}`));
    $("term-bif").innerHTML = subs(L.join("\n")) + cursor;
  }
  function drawBif() {
    const v = view();
    pB.set({ x: v.x, y: v.y }).clear().image(dots());
    pB.vline(S.R, C.yellow, { label: `R_m = ${S.R.toFixed(3)}` });
    if (drag && drag.moved) pB.rect(drag.a[0], drag.a[1], drag.b[0], drag.b[1]);
    $("bif-reset").hidden = !S.view;
    $("cv-bif").setAttribute("aria-label", `Bifurcation diagram, R_m from ${v.x[0].toFixed(3)} to ${v.x[1].toFixed(3)}, marker at ${S.R.toFixed(3)}`);
  }
  function setupZoom() {
    const cv = $("cv-bif"), btn = $("bif-zoom");
    const at = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const clampV = (p) => { const v = view(); return [Math.min(v.x[1], Math.max(v.x[0], p[0])), Math.min(v.y[1], Math.max(v.y[0], p[1]))]; };
    const zoomMode = (on) => { S.zoomMode = on; cv.classList.toggle("is-zooming", on); btn.setAttribute("aria-pressed", on ? "true" : "false"); };
    cv.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "touch" && !S.zoomMode) return; // touch scrolls the page unless "Zoom" is on
      if (e.button > 0) return;
      const p = at(e); if (!pB.inside(p[0], p[1])) return;
      drag = { id: e.pointerId, a: clampV(pB.fromPx(p[0], p[1])), b: null, p0: p, moved: false };
      drag.b = drag.a; cv.setPointerCapture(e.pointerId); e.preventDefault();
    });
    cv.addEventListener("pointermove", (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const p = at(e); drag.b = clampV(pB.fromPx(p[0], p[1]));
      drag.moved = drag.moved || Math.hypot(p[0] - drag.p0[0], p[1] - drag.p0[1]) > 6;
      want.bif = true; schedule();
    });
    const end = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const d = drag; drag = null;
      if (d.moved) {
        let x0 = Math.min(d.a[0], d.b[0]), x1 = Math.max(d.a[0], d.b[0]), y0 = Math.min(d.a[1], d.b[1]), y1 = Math.max(d.a[1], d.b[1]);
        if (x1 - x0 < BIF.minW) { const c = (x0 + x1) / 2; x0 = c - BIF.minW / 2; x1 = c + BIF.minW / 2; }
        if (y1 - y0 < BIF.minW) { const c = (y0 + y1) / 2; y0 = c - BIF.minW / 2; y1 = c + BIF.minW / 2; }
        S.view = { x: [x0, x1], y: [y0, y1] }; want.bifBox = true;
      }
      zoomMode(false); want.bif = true; schedule();
    };
    cv.addEventListener("pointerup", end); cv.addEventListener("pointercancel", end);
    cv.addEventListener("dblclick", () => { S.view = null; want.bif = want.bifBox = true; schedule(); });
    $("bif-reset").addEventListener("click", () => { S.view = null; want.bif = want.bifBox = true; schedule(); });
    btn.addEventListener("click", () => zoomMode(!S.zoomMode));
  }

  /* ---------------------------------------------------- one redraw per frame */
  const want = { traj: true, pred: true, bif: true, boxes: true, bifBox: true };
  let raf = 0, lastBox = 0, boxTimer = 0, st = null;
  function schedule() { if (!raf) raf = G.requestAnimationFrame(render); }
  function render() {
    raf = 0;
    if (want.traj || want.pred || want.boxes) st = classify(S.R, S.x0);
    const R = want.pred || want.boxes ? runs() : null;
    if (want.traj) drawTraj(st);
    if (want.pred) drawPred(st, R);
    if (want.bif) drawBif();
    if (want.boxes || want.bifBox) { // the terminal boxes: at most every 150 ms while a slider moves
      const now = performance.now();
      if (now - lastBox >= 150) {
        lastBox = now;
        if (want.boxes) { $("term-traj").innerHTML = trajBox(st); predBoxes(st, R || runs()); }
        bifBox(st || classify(S.R, S.x0));
        want.boxes = want.bifBox = false;
      } else if (!boxTimer) boxTimer = setTimeout(() => { boxTimer = 0; schedule(); }, 150 - (now - lastBox));
    }
    want.traj = want.pred = want.bif = false;
  }

  /* ---------------------------------------------------- controls */
  function slider(id, key, fmt, on) {
    const el = $(id), out = $(id + "-out");
    const sync = () => { const v = +el.value; S[key] = v; out.textContent = fmt(v); el.setAttribute("aria-valuetext", fmt(v)); };
    el.value = S[key]; sync();
    el.addEventListener("input", () => { sync(); on(); schedule(); });
  }
  function start() {
    if (!$("cv-traj")) return;
    pT = G.WQ.Plot.create($("cv-traj"), { xLabel: "t", yLabel: "X_t" });
    pR = G.WQ.Plot.create($("cv-runs"), { xLabel: "t", yLabel: "X_t" });
    pE = G.WQ.Plot.create($("cv-div"), { xLabel: "t", yLabel: "|E_t|", log: true, pad: { l: 58 } });
    pB = G.WQ.Plot.create($("cv-bif"), { xLabel: "R_m", yLabel: "X_t" });
    pT.onResize(() => { want.traj = true; schedule(); });
    pR.onResize(() => { want.pred = true; schedule(); });
    pE.onResize(() => { want.pred = true; schedule(); });
    pB.onResize(() => { want.bif = true; schedule(); });

    const ab = () => { $("pred-now").innerHTML = `for <span class="m"><i>R</i><sub>m</sub></span> = ${S.R.toFixed(3)}, <span class="m"><i>X</i><sub>0</sub></span> = ${S.x0.toFixed(3)}`; };
    slider("rm", "R", (v) => v.toFixed(3), () => { want.traj = want.pred = want.bif = want.boxes = true; ab(); });
    slider("x0", "x0", (v) => v.toFixed(3), () => { want.traj = want.pred = want.boxes = true; ab(); });
    slider("steps", "steps", (v) => String(v), () => { want.traj = true; });
    slider("psteps", "pSteps", (v) => String(v), () => { want.pred = want.boxes = true; });
    slider("bx0", "bx0", (v) => v.toFixed(1), () => { want.bif = want.bifBox = true; });
    ab();
    ERRORS.forEach((e, i) => {
      const cb = $("err-" + i); cb.checked = S.show[i];
      cb.addEventListener("change", () => { S.show[i] = cb.checked; want.pred = want.boxes = true; schedule(); });
    });
    const cu = $("err-custom"), hint = $("err-hint");
    cu.addEventListener("input", () => {
      const raw = cu.value.trim(), v = Number(raw);
      const ok = raw !== "" && isFinite(v) && v > 0 && v <= 0.5;
      S.custom = ok ? v : null;
      hint.hidden = raw === "" || ok;
      want.pred = want.boxes = true; schedule();
    });
    const axis = (log) => {
      S.log = log;
      $("ax-log").setAttribute("aria-pressed", log ? "true" : "false");
      $("ax-lin").setAttribute("aria-pressed", log ? "false" : "true");
      want.pred = true; schedule();
    };
    $("ax-log").addEventListener("click", () => axis(true));
    $("ax-lin").addEventListener("click", () => axis(false));
    setupZoom();
    schedule();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})(typeof window !== "undefined" ? window : globalThis);
