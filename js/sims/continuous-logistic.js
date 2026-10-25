/* =============================================================================
   continuous-logistic.js — the continuous-time logistic model: maths and page
   -----------------------------------------------------------------------------
   Page: simulations/population-dynamics/continuous-logistic/
     dx/dt = r_m x (1 − x)        (x = N/K)
   1. the maths (WQ.CLogistic; node-tested by tools/test-continuous-logistic.mjs):
      the exact solution, half-way and 1 % times, the owner's Euler steps
      x_{n+1} = x_n + r_m Δt x_n (1 − x_n) and their long run (card 1's map
      with R = 1 + r_m Δt)
   2. the page: four sliders → three panels (trajectory, phase line, growth
      rate over time), each with a green terminal box (WQ.Plot, WQ.Sim)
   Reference: github.com/ashutosh-shinde/Population-Dynamics,
   Continuous_time_logistic_model/.
   HOW TO EDIT: DEFAULTS (the values the page opens with), EULER_MAX (step cap),
   THRESH (the Euler thresholds, R − 1 of card 1's doubling points).
   ============================================================================= */
(function (G) {
  "use strict";

  /* ================================================================ 1. maths */
  const EULER_MAX = 300000;
  const THRESH = { double2: 2, double4: Math.sqrt(6), double8: 2.544090360, chaos: 2.569945672, window3: Math.sqrt(8), escape: 3 };

  const f = (r, x) => r * x * (1 - x);
  const df = (r, x) => r * (1 - 2 * x);
  function exact(x0, r, t) {
    if (x0 === 0 || r === 0) return x0;
    return 1 / (1 + (1 / x0 - 1) * Math.exp(-r * t));
  }
  function tHalf(x0, r) {
    if (!(r > 0)) return null;
    if (x0 === 0.5) return 0;
    if (x0 > 0 && x0 < 0.5) return Math.log((1 - x0) / x0) / r;
    return null;
  }
  function t99(x0, r) {
    if (!(r > 0) || x0 === 0) return null;
    if (x0 >= 0.99 && x0 <= 1.01) return 0;
    if (x0 > 0 && x0 < 0.99) return Math.log((1 / x0 - 1) / (1 / 0.99 - 1)) / r;
    return Math.log((1 - 1 / x0) / (1 - 1 / 1.01)) / r;
  }
  // the owner's Euler steps (no clamping: the artifacts are the point)
  function euler(x0, r, dt, tmax) {
    const n = Math.min(Math.ceil(tmax / dt - 1e-9), EULER_MAX);
    const xs = new Float64Array(n + 1); xs[0] = x0;
    let status = "ok", wentNegative = null, crossedK = false, landedZero = null, maxGap = 0, m = n;
    for (let i = 1; i <= n; i++) {
      const p = xs[i - 1], x = p + r * dt * p * (1 - p);
      if (!Number.isFinite(x) || Math.abs(x) > 1e6) { status = "blowup"; m = i - 1; break; }
      xs[i] = x;
      if (x < 0 && wentNegative === null) wentNegative = i;
      if (x === 0 && p > 0 && landedZero === null) landedZero = i;
      if ((p - 1) * (x - 1) < 0) crossedK = true;
      const gap = Math.abs(x - exact(x0, r, i * dt)); if (gap > maxGap) maxGap = gap;
    }
    return { x: xs.subarray(0, m + 1), n: m, dt, status, wentNegative, crossedK, landedZero, maxGap };
  }
  // where the Euler map y ← y + a·y·(1 − y) goes in the long run
  function eulerLongRun(a, x0) {
    const step = (y) => y + a * y * (1 - y);
    let y = x0;
    const warm = Math.min(2e6, Math.max(3000, Math.ceil(40 / a))); // small steps settle slowly: about 40/a steps
    for (let i = 0; i < warm; i++) { y = step(y); if (!Number.isFinite(y) || Math.abs(y) > 1e6) return { kind: "escapes", period: 0, values: [], lambda: null }; }
    const v = new Float64Array(400);
    for (let i = 0; i < 400; i++) { v[i] = y; y = step(y); if (!Number.isFinite(y) || Math.abs(y) > 1e6) return { kind: "escapes", period: 0, values: [], lambda: null }; }
    for (let p = 1; p <= 64; p++) {
      let ok = true;
      for (let k = 0; k < 256; k++) if (!(Math.abs(v[k + p] - v[k]) < 1e-7)) { ok = false; break; }
      if (ok) { const values = Array.from(v.slice(0, p)).sort((s, t) => s - t); return { kind: p === 1 ? "fixed" : "cycle", period: p, values, lambda: null }; }
    }
    let s = 0;
    for (let i = 0; i < 4000; i++) { s += Math.log(Math.max(Math.abs(1 + a - 2 * a * y), 1e-300)); y = step(y); if (!Number.isFinite(y)) return { kind: "escapes", period: 0, values: [], lambda: null }; }
    const lambda = s / 4000;
    return { kind: lambda > 0.001 ? "chaos" : "slow", period: 0, values: [], lambda };
  }

  const M = { f, df, exact, tHalf, t99, euler, eulerLongRun, THRESH, EULER_MAX };
  (G.WQ = G.WQ || {}).CLogistic = M;
  if (typeof document === "undefined") return; // (in node: the maths only)

  /* ================================================================ 2. page */
  const DEFAULTS = { r: 0.11, x0: 0.23, tmax: 100, dt: 0.01 };
  const Sim = G.WQ.Sim, C = G.WQ.Plot.COLORS, $ = (id) => document.getElementById(id);
  const { fmt, fmtSig, signed, hi, dim, warn, why } = Sim;
  const S = Object.assign({}, DEFAULTS);
  let pT, pP, pR, D = null; // plots; D = everything computed for the current values

  function compute() {
    const { r, x0, tmax, dt } = S, N = 600, ts = new Float64Array(N + 1), xs = new Float64Array(N + 1);
    for (let i = 0; i <= N; i++) { ts[i] = (tmax * i) / N; xs[i] = exact(x0, r, ts[i]); }
    const a = r * dt;
    D = { ts, xs, a, eu: euler(x0, r, dt, tmax), lr: x0 > 0 && x0 !== 1 && a > 0 ? eulerLongRun(a, x0) : null, th: tHalf(x0, r), t99: t99(x0, r) };
  }

  /* ---------------------------------------------------- A. trajectory */
  function drawTraj() {
    const { ts, xs, eu } = D, ex = Array.from(eu.x);
    let lo = 0, hiY = Math.max(1.2, 1.1 * S.x0);
    for (const v of ex) { if (v < lo) lo = v; if (1.1 * v > hiY) hiY = 1.1 * v; }
    lo = Math.min(0, Math.max(-0.5, 1.1 * lo)); hiY = Math.min(3, hiY);
    pT.set({ x: [0, S.tmax], y: [lo, hiY] }).clear();
    pT.hline(1, C.white, { dash: [6, 5], alpha: 0.6, label: "K", labelAt: "left" });
    pT.hline(0.5, C.white, { dash: [1.5, 4], alpha: 0.3, label: "½K", labelAt: "left" });
    // Euler: at most 1500 points
    const n = eu.n, stride = Math.max(1, Math.ceil((n + 1) / 1500)), et = [], ey = [];
    for (let i = 0; i <= n; i += stride) { et.push(i * eu.dt); ey.push(ex[i]); }
    if (n % stride) { et.push(n * eu.dt); ey.push(ex[n]); }
    pT.line(et, ey, C.yellow, { width: n <= 120 ? 1 : 1.4, dots: n <= 120, alpha: 0.95 });
    pT.line(Array.from(ts), Array.from(xs), C.white, { width: 1.8 });
    pT.legend([{ label: "exact", color: C.white }, { label: `Euler, Δt = ${fmtSig(S.dt, 3)}`, color: C.yellow }]);
    $("cv-traj").setAttribute("aria-label", `Trajectory for r_m ${fmt(S.r)}, x_0 ${fmt(S.x0)}: ${stateText()}`);
  }
  function stateText() {
    const { r, x0 } = S;
    if (r === 0) return "nothing changes (r_m = 0)";
    if (x0 === 0) return "stays at 0: no population";
    if (x0 === 1) return "stays at K";
    if (x0 < 0.5) return "grows to K along an S-curve";
    if (x0 < 1) return "grows to K, slowing all the way";
    return "declines to K";
  }
  function timeText(t) { return t > S.tmax ? dim(`t = ${fmt(t, 2)} (beyond t_max)`) : `t = ${fmt(t, 2)}`; }
  function trajBox() {
    const { r, x0, dt } = S, { a, eu, lr, th } = D, L = [];
    L.push(`> r_m = ${fmt(r)}   x_0 = ${fmt(x0)}   Δt = ${fmtSig(dt, 3)}`);
    L.push("> equilibria, f'(x) = r_m(1 − 2x)");
    if (r === 0) L.push("  every x is an equilibrium (f = 0 everywhere)");
    else {
      L.push(["  x* = 0   f' = " + signed(df(r, 0)) + "   ", "unstable"]);
      L.push(["  x* = 1   f' = " + signed(df(r, 1)) + "   ", hi("stable")]);
      L.push(why("at 0 a few individuals multiply (f' > 0)"));
      L.push(why("at K a small push dies out (f' < 0)"));
    }
    L.push(["> state: ", hi(stateText())]);
    if (r === 0) L.push(why("births balance deaths at every density: every x is an equilibrium"));
    else if (x0 === 0) L.push(why("with nobody there, nobody is born"));
    else if (x0 === 1) L.push(why("at K births and deaths balance exactly"));
    else if (x0 < 0.5) L.push(why("it speeds up until x = ½, then slows down as crowding grows"));
    else if (x0 < 1) L.push(why("it starts past the fastest point x = ½"));
    else { L.push(why("above K deaths outnumber births (the growth rate per head r_m(1 − x) < 0)")); L.push(why("it never undershoots: a continuous curve cannot jump past K")); }
    if (r > 0 && x0 > 0 && x0 !== 1) {
      const parts = [];
      if (th !== null) parts.push(["  · half of K at ", timeText(th)]);
      if (D.t99 !== null) parts.push(D.t99 === 0 ? ["  · already within 1% of K"] : ["  · within 1% of K at ", timeText(D.t99)]);
      parts.forEach((p) => L.push(p.map((s) => (typeof s === "string" ? { t: s, c: "why" } : s))));
      L.push(why(`relaxation time 1/r_m = ${fmt(1 / r, 2)}: near K the gap shrinks ×e every ${fmt(1 / r, 2)}`));
    }
    // Euler
    const head = `> Euler: r_mΔt = ${fmtSig(a, 3)} → `, R = 1 + a, bound = a > 0 ? (1 + a) / a : Infinity;
    if (a === 0) L.push(head + "no change (r_m = 0)");
    else if (x0 === 0 || x0 === 1) L.push(head + "stays put: x_0 is an equilibrium of the steps too");
    else if (eu.status === "blowup" || eu.wentNegative !== null) {
      L.push([head, warn(`went below 0 at step ${eu.wentNegative ?? eu.n + 1}: impossible for a population`)]);
      L.push(why(x0 > bound ? `x_0 > (1 + r_mΔt)/(r_mΔt) = ${fmtSig(bound, 4)}: the first step overshoots past 0` : "the step is too large: Euler overshoots past 0"));
    } else if (eu.landedZero !== null) {
      L.push([head, warn("one step wiped the population out")]);
      L.push(why(`x_0 = (1 + r_mΔt)/(r_mΔt) = ${fmtSig(bound, 4)}: the step lands exactly on 0`));
    } else if (a <= 0.01) L.push(head + "follows the exact curve");
    else if (!eu.crossedK && (!lr || lr.kind === "fixed")) L.push(head + "monotone like the exact curve, slightly off");
    else if (lr && lr.kind === "fixed") { L.push(head + "crosses K, then damped wiggles"); L.push(why("the wiggles are the method's: the true curve never crosses K")); }
    else if (lr && lr.kind === "cycle") {
      const p = lr.period, pow2 = (p & (p - 1)) === 0;
      if (p === 2) L.push([head, hi("settles on a 2-cycle around K: a pure artifact")]);
      else if (pow2) L.push([head, hi(`settles on a ${p}-cycle: artifact`)]);
      else L.push([head, hi(`a period-${p} window (as in card 1's chaos)`)]);
      L.push(why(`Euler's step is card 1's map with R = 1 + r_mΔt = ${fmt(R)} (in z = r_mΔt·x/R); R > 3 doubles`));
    } else if (lr && lr.kind === "chaos") { L.push([head, hi(`chaos: an artifact of the step (λ = ${fmt(lr.lambda)})`)]); L.push(why(`R = 1 + r_mΔt = ${fmt(R)} > 3.5699`)); }
    else if (lr && lr.kind === "escapes") L.push([head, warn("runs off to −∞: R = 1 + r_mΔt > 4")]);
    else if (lr && lr.kind === "slow") L.push(head + "settles very slowly (r_mΔt is close to a threshold)");
    if (eu.status !== "blowup") L.push(why(`largest gap to the exact curve: ${fmtSig(eu.maxGap, 3)}`));
    return L;
  }

  /* ---------------------------------------------------- B. phase line */
  function drawPhase() {
    const { r, x0 } = S, xr = Math.max(1.5, 1.15 * x0), N = 300, xs = [], ys = [];
    for (let i = 0; i <= N; i++) { const x = (xr * i) / N; xs.push(x); ys.push(f(r, x)); }
    let lo = Math.min(...ys), hiY = Math.max(...ys); const span = Math.max(hiY - lo, 0.02);
    lo = Math.min(lo, 0) - 0.12 * span; hiY = Math.max(hiY, 0) + 0.12 * span;
    pP.set({ x: [0, xr], y: [lo, hiY] }).clear();
    pP.hline(0, C.white, { dash: [1, 0], alpha: 0.45, width: 1 });
    pP.line(xs, ys, C.white, { width: 1.8 });
    if (r > 0) {
      const ctx = pP.ctx, [, py0] = pP.toPx(0, 0);
      ctx.save(); ctx.fillStyle = C.yellow;
      for (let i = 0; i < 8; i++) {
        const x = (xr * (i + 0.5)) / 8; if (Math.abs(x - 1) < 0.04 * xr || x < 0.02 * xr) continue;
        const dir = f(r, x) > 0 ? 1 : -1, [px] = pP.toPx(x, 0);
        ctx.beginPath(); ctx.moveTo(px + 6 * dir, py0); ctx.lineTo(px - 4 * dir, py0 - 5); ctx.lineTo(px - 4 * dir, py0 + 5); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
      pP.marker(0, 0, "unstable", { label: "0" }); pP.marker(1, 0, "stable", { label: "K" });
    }
    const [px, py] = pP.toPx(x0, f(r, x0)), [, pyb] = pP.toPx(x0, 0), ctx = pP.ctx;
    ctx.save(); ctx.strokeStyle = C.blue; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(px, pyb); ctx.lineTo(px, py); ctx.stroke();
    ctx.setLineDash([]); ctx.fillStyle = C.blue; ctx.beginPath(); ctx.arc(px, py, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  function phaseBox() {
    const { r, x0 } = S, L = [];
    if (r === 0) { L.push(["> ", hi("dx/dt = 0 everywhere (r_m = 0): nothing moves")]); L.push(why("births balance deaths at every density")); }
    else {
      L.push("> dx/dt = r_m x(1 − x): a parabola, zero at 0 and at K");
      L.push(why("above the axis x grows (→), below it x falls (←)"));
      L.push(why("every start x_0 > 0 flows to K: K attracts, 0 repels"));
      L.push(`> fastest growth r_m/4 = ${fmtSig(r / 4, 3)} at x = ½`);
    }
    const g = f(r, x0), start = `> your start x_0 = ${fmt(x0)}: `;
    if (r === 0) L.push(start + "dx/dt = 0: stays where it is");
    else if (x0 === 0) L.push(start + "dx/dt = 0: stays at 0");
    else if (x0 === 1) L.push(start + "dx/dt = 0: stays at K");
    else if (x0 > 1) L.push([start + `dx/dt = ${fmtSig(g, 3)} `, hi("← moving left, down to K")]);
    else L.push([start + `dx/dt = +${fmtSig(g, 3)} `, hi("→ moving right")]);
    return L;
  }

  /* ---------------------------------------------------- C. growth rate over time */
  function drawRate() {
    const { r, x0 } = S, ts = Array.from(D.ts), gs = Array.from(D.xs, (x) => f(r, x));
    let lo, hiY;
    if (r === 0) { lo = -0.01; hiY = 0.01; }
    else { lo = Math.min(0, 1.1 * Math.min(...gs)); hiY = Math.max(r / 4, Math.max(...gs)) * 1.15; if (hiY <= lo) hiY = lo + 0.01; }
    pR.set({ x: [0, S.tmax], y: [lo, hiY] }).clear();
    if (r > 0) pR.hline(r / 4, C.yellow, { dash: [6, 5], label: "r_m/4 (max)" });
    pR.hline(0, C.white, { dash: [1, 0], alpha: 0.35, width: 1 });
    pR.line(ts, gs, C.white, { width: 1.8 });
    if (D.th !== null && x0 > 0 && x0 < 0.5 && D.th <= S.tmax) pR.marker(D.th, r / 4, "stable", { color: C.yellow });
  }
  function rateBox() {
    const { r, x0 } = S, th = D.th, L = ["> growth rate dx/dt over time"];
    if (r === 0 || x0 === 0) L.push(["> ", hi("dx/dt = 0 at all times")]);
    else if (x0 > 1) { L.push(["> ", hi("dx/dt < 0: the population shrinks toward K, fastest at the start")]); L.push(why("above K the growth rate per head is negative; it fades as x nears K")); }
    else if (x0 >= 0.5) { L.push(["> ", hi("the peak was before t = 0 (x_0 ≥ ½): growth only slows")]); L.push(why("numbers (x) times room left (1 − x) is largest at x = ½")); }
    else {
      if (th > S.tmax) L.push(["> ", hi(`the peak comes at t = ${fmt(th, 2)}, after t_max`)]);
      else L.push(["> ", hi(`peak r_m/4 = ${fmtSig(r / 4, 3)} at t = ${fmt(th, 2)}, when x = ½`)]);
      L.push(why("numbers (x) times room left (1 − x) is largest at x = ½"));
      L.push(why("that moment is the S-curve's inflection: growth speeds up before it and slows after"));
    }
    if (r > 0) L.push(why(`r_m/4 = ${fmtSig(r / 4, 3)} is also the largest constant catch this population can survive (card 3, θ = 0)`));
    return L;
  }

  /* ---------------------------------------------------- runtime checks (?check=1) */
  function runChecks(boxes) {
    const { r, x0 } = S, { xs, a, eu, lr, th } = D, ck = Sim.check;
    ck("exact(x0, r, 0) = x0", Math.abs(exact(x0, r, 0) - x0) < 1e-12, exact(x0, r, 0));
    let mono = true; for (let i = 1; i < xs.length; i++) if (Math.abs(xs[i] - 1) > Math.abs(xs[i - 1] - 1) + 1e-12) { mono = false; break; }
    ck("|x(t) − 1| never increases", mono, "");
    if (th !== null) {
      ck("x(tHalf) = ½", Math.abs(exact(x0, r, th) - 0.5) < 1e-9, exact(x0, r, th));
      ck("peak growth r/4 at tHalf", Math.abs(f(r, exact(x0, r, th)) - r / 4) < 1e-9 * Math.max(r, 1), f(r, exact(x0, r, th)));
    }
    if (a > 0 && a <= 0.01 && eu.status === "ok") ck("Euler close when r_mΔt ≤ 0.01", eu.maxGap < 0.01, eu.maxGap);
    if (lr && a >= 0.01 && x0 > 0 && x0 < (1 + a) / a) {
      const T = THRESH, near = (v) => Math.abs(a - v) < 0.002;
      if (![T.double2, T.double4, T.double8, T.escape].some(near)) {
        let want = null;
        if (a < T.double2) want = (k) => k.kind === "fixed";
        else if (a < T.double4) want = (k) => k.kind === "cycle" && k.period === 2;
        else if (a < T.double8) want = (k) => k.kind === "cycle" && k.period === 4;
        else if (a > T.escape) want = (k) => k.kind === "escapes";
        if (want) ck("Euler long run matches the thresholds", want(lr), `a = ${a}: ${lr.kind} ${lr.period}`);
      }
    }
    const text = boxes.map((b) => b.textContent).join(" ");
    ck("boxes are finite", !/NaN|Infinity|undefined/.test(text), text.slice(0, 120));
  }

  /* ---------------------------------------------------- wiring */
  let loop, boxesDue = false;
  const writeBoxes = Sim.throttle(() => {
    Sim.term($("term-traj"), trajBox()); Sim.term($("term-phase"), phaseBox()); Sim.term($("term-rate"), rateBox());
    if (Sim.checking) runChecks([$("term-traj"), $("term-phase"), $("term-rate")]);
  }, 150);
  function render(dirty) {
    if (dirty.has("data") || !D) compute();
    drawTraj(); drawPhase(); drawRate();
    writeBoxes();
  }
  function start() {
    if (!$("cv-traj") || !$("term-rate")) return;
    pT = G.WQ.Plot.create($("cv-traj"), { xLabel: "t", yLabel: "x" });
    pP = G.WQ.Plot.create($("cv-phase"), { xLabel: "x", yLabel: "dx/dt", pad: { l: 58 } });
    pR = G.WQ.Plot.create($("cv-rate"), { xLabel: "t", yLabel: "dx/dt", pad: { l: 58 } });
    loop = Sim.loop(render);
    [pT, pP, pR].forEach((p) => p.onResize(() => loop.want("draw")));
    const on = (key) => (v) => { S[key] = v; loop.want("data"); };
    Sim.slider("rm", { fmt: (v) => fmt(v), onInput: on("r") });
    Sim.slider("x0", { fmt: (v) => fmt(v), onInput: on("x0") });
    Sim.slider("tmax", { fmt: (v) => String(Math.round(v)), onInput: on("tmax") });
    const dt = Sim.slider("dt", { log: true, fmt: (v) => fmtSig(v, 3), onInput: on("dt") });
    S.r = Number($("rm").value); S.x0 = Number($("x0").value); S.tmax = Number($("tmax").value); S.dt = dt.get();
    loop.want("data");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})(typeof window !== "undefined" ? window : globalThis);
