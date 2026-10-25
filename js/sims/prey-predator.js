/* =============================================================================
   prey-predator.js — three prey–predator models: maths and page
   -----------------------------------------------------------------------------
   Page: simulations/population-dynamics/prey-predator/
     dN/dt = f(N) − h(N, P),   dP/dt = γ·h(N, P) − δP
     LV  Lotka–Volterra:          f = rN,          h = βNP
     Vt  Volterra (logistic prey): f = rN(1 − N/K), h = βNP
     RM  Rosenzweig–MacArthur:     f = rN(1 − N/K), h = βNP/(N₀ + N)
   1. the maths (WQ.PP; node-tested by tools/test-prey-predator.mjs): the fields
      and Jacobians (as in the owner's code), the equilibria and their types, the
      Hopf point K_H, runs, LV's conserved V, the RM limit cycle, and the peaks,
      period and lag of a run
   2. the page: a model switch, sliders and presets (each model keeps its own
      values) → three panels (phase plane with taps, time series, the effect of
      enrichment K), each with a green terminal box
   Reference: github.com/ashutosh-shinde/Population-Dynamics,
   Two_species_population_models/ (section 3).
   HOW TO EDIT: DEFAULTS (per model), PRESETS, STARTS (panel A's default starts), CYCLE (the limit
   cycle's search limits), LV_LOOP (points on a drawn LV orbit).
   ============================================================================= */
(function (G) {
  "use strict";
  const ODE = G.WQ && G.WQ.ODE;

  /* ================================================================ 1. maths */
  const MODELS = { LV: "Lotka–Volterra", Vt: "Volterra (logistic prey)", RM: "Rosenzweig–MacArthur" };

  function field(p) {
    if (p.model === "LV") return (t, y, d) => { const N = y[0], P = y[1]; d[0] = p.r * N - p.b * N * P; d[1] = p.g * p.b * N * P - p.d * P; };
    if (p.model === "Vt") return (t, y, d) => { const N = y[0], P = y[1]; d[0] = p.r * N * (1 - N / p.K) - p.b * N * P; d[1] = p.g * p.b * N * P - p.d * P; };
    return (t, y, d) => { const N = y[0], P = y[1], h = (p.b * N * P) / (p.N0 + N); d[0] = p.r * N * (1 - N / p.K) - h; d[1] = p.g * h - p.d * P; };
  }
  const f = (p, N, P) => { const d = [0, 0]; field(p)(0, [N, P], d); return d; };
  function jac(p, N, P) { // jacobian_LV / _Vt / _RM of the owner's code
    if (p.model === "LV") return [p.r - p.b * P, -p.b * N, p.g * p.b * P, p.g * p.b * N - p.d];
    if (p.model === "Vt") return [p.r * (1 - (2 * N) / p.K) - p.b * P, -p.b * N, p.g * p.b * P, p.g * p.b * N - p.d];
    const q = p.N0 + N;
    return [p.r * (1 - (2 * N) / p.K) - (p.b * P * p.N0) / (q * q), (-p.b * N) / q, (p.g * p.b * P * p.N0) / (q * q), (p.g * p.b * N) / q - p.d];
  }
  function Nstar(p) {
    if (p.model !== "RM") return p.d / (p.g * p.b);
    return p.g * p.b > p.d ? (p.d * p.N0) / (p.g * p.b - p.d) : Infinity;
  }
  function Pstar(p, Ns = Nstar(p)) {
    if (p.model === "LV") return p.r / p.b;
    if (p.model === "Vt") return (p.r / p.b) * (1 - Ns / p.K);
    return (p.r / p.b) * (1 - Ns / p.K) * (p.N0 + Ns);
  }
  const KH = (p) => (p.model === "RM" && Number.isFinite(Nstar(p)) ? p.N0 + 2 * Nstar(p) : null);
  // the predator's growth rate per head when it is rare and the prey sit at K (the eigenvalue of e1 = (K, 0))
  const invasion = (p) => (p.model === "Vt" ? p.g * p.b * p.K - p.d : p.model === "RM" ? (p.g * p.b * p.K) / (p.N0 + p.K) - p.d : null);
  function classifyAt(p, N, P) {
    const J = jac(p, N, P), e = ODE.eig2(J[0], J[1], J[2], J[3]), c = ODE.classify2(e);
    return { J, eig: e, type: c.label, stable: c.stable };
  }
  function equilibria(p) {
    const out = [], add = (name, N, P) => out.push(Object.assign({ name, N, P }, classifyAt(p, N, P)));
    add("e0", 0, 0);
    const Ns = Nstar(p);
    if (p.model === "LV") { add("e1", Ns, Pstar(p, Ns)); return out; }
    add("e1", p.K, 0);
    if (Number.isFinite(Ns) && Ns > 0 && Ns < p.K) add("e2", Ns, Pstar(p, Ns));
    return out;
  }
  const scaleOf = (p, s) => Math.max(1, s ? Math.max(s[0], s[1]) : 0, Number.isFinite(Nstar(p)) ? Nstar(p) : 0, p.model === "LV" ? p.r / p.b : p.K);
  // a run from s = (N(0), P(0)). With both above 0 it is integrated in log coordinates x = ln N, y = ln P:
  // the prey can fall to 1e−30 and far below (a big LV cycle, a predator boom, a rich RM cycle), far below
  // any absolute tolerance in N, and a plain integration then lets it recover too early; in logs the
  // relative accuracy holds all the way. LV orbits are closed, so one period is integrated and repeated
  // (runLV). With a 0 start that one stays 0.
  function run(p, s, tmax, samples = 800, opts = {}) {
    if (s[0] > 0 && s[1] > 0) return p.model === "LV" ? runLV(p, s, tmax, samples, opts) : runLog(p, s, tmax, samples, opts);
    return runAxis(p, s, tmax, samples);
  }
  // LV: in logs (x = ln N, y = ln P) every orbit circles e1 = (ln N*, ln P*) anticlockwise (V is convex in x and
  // y, so each ray from e1 meets an orbit once) and crosses the four half-axes through e1 in turn: those are its
  // extremes (N is largest on y = ln P* right of e1, where dN/dt = 0; P is largest on x = ln N* above it; …).
  // Five solves, each to the next crossing and the last back to the starting ray, give the period T and the
  // extremes exactly; a second pass integrates [0, T] with output at each t mod T. The run is then periodic by
  // construction (V cannot drift), costs one period however long t_max is, carries its exact extremes
  // (run.cycle; the time series includes them, so even a sharp spike is drawn at its true height) and one
  // finely sampled loop to draw. A start very close to e1, or a period longer than t_max: straight through.
  const LV_LOOP = 1000;
  function runLV(p, s, tmax, samples, opts) {
    const x0 = Math.log(s[0]), y0 = Math.log(s[1]), xs = Math.log(p.d / (p.g * p.b)), ys = Math.log(p.r / p.b), ax0 = x0 - xs, ay0 = y0 - ys;
    if (Math.hypot(ax0, ay0) < 1e-6) return runLog(p, s, tmax, samples, opts);
    const tol = opts.rtol || 1e-12, F = logField(p), base = { rtol: tol, atol: tol, nonneg: false, maxSteps: 600000, big: 1e6, samples: 2, hmax: tmax / 100 };
    // the quadrants around e1, anticlockwise, and the crossing that ends each: I → II is P's maximum, II → III
    // N's minimum, III → IV P's minimum, IV → I N's maximum
    const quad = (sx, sy) => (sx > 0 && sy >= 0 ? 0 : sx <= 0 && sy > 0 ? 1 : sx < 0 && sy <= 0 ? 2 : 3);
    const ends = [(t, z) => z[0] <= xs, (t, z) => z[1] <= ys, (t, z) => z[0] >= xs, (t, z) => z[1] >= ys], names = ["Pmax", "Nmin", "Pmin", "Nmax"];
    const back = (t, z) => ax0 * (z[1] - ys) - ay0 * (z[0] - xs) >= 0 && ax0 * (z[0] - xs) + ay0 * (z[1] - ys) > 0; // (the starting ray)
    const q0 = quad(ax0, ay0), ev = {};
    let z = [x0, y0], t = 0;
    for (let k = 0; k <= 4; k++) {
      if (!(tmax - t > 0)) return runLog(p, s, tmax, samples, opts);
      const q = (q0 + k) % 4, r = ODE.solve(F, z, 0, tmax - t, Object.assign({ stop: k < 4 ? ends[q] : back }, base));
      if (r.status !== "stopped") return runLog(p, s, tmax, samples, opts); // (no full turn by t_max)
      t += r.tEnd; z = r.yEnd;
      if (k < 4) ev[names[q]] = { t, x: z[0], y: z[1] };
    }
    const T = t, phase = (u) => Math.max(0, Math.min(T, u - T * Math.floor(u / T)));
    for (const k of names) ev[k].ph = phase(ev[k].t);
    // the time series: even samples (opts.perPeriod: at least that many per period, up to 20 000) and every
    // crossing in [0, t_max]; the loop: one period at LV_LOOP even phases and the four crossings
    const S = Math.max(2, samples | 0, Math.min(20000, Math.ceil(((opts.perPeriod || 0) * tmax) / T) + 1)), times = [];
    for (let k = 0; k < S; k++) times.push((tmax * k) / (S - 1));
    for (const k of names) for (let u = ev[k].ph; u <= tmax; u += T) times.push(u);
    const tt = Float64Array.from(times).sort(), M = tt.length, L = LV_LOOP + 1, when = new Float64Array(M + L + 4);
    for (let k = 0; k < M; k++) when[k] = phase(tt[k]);
    for (let j = 0; j < L; j++) when[M + j] = (T * j) / (L - 1);
    names.forEach((k, j) => { when[M + L + j] = ev[k].ph; });
    const order = Array.from({ length: when.length }, (_, k) => k).sort((a, b) => when[a] - when[b]);
    const B = ODE.solve(F, [x0, y0], 0, T, Object.assign({}, base, { times: order.map((k) => when[k]), hmax: T / 100 }));
    if (B.n < when.length) return runLog(p, s, tmax, samples, opts);
    const N = new Float64Array(M), P = new Float64Array(M), lx = new Float64Array(M), ly = new Float64Array(M), loop = { N: [], P: [] };
    order.forEach((k, j) => { if (k < M) { lx[k] = B.y[0][j]; ly[k] = B.y[1][j]; } else { loop.N.push(Math.exp(B.y[0][j])); loop.P.push(Math.exp(B.y[1][j])); } });
    for (let k = 0; k < M; k++) { N[k] = Math.exp(lx[k]); P[k] = Math.exp(ly[k]); }
    const cycle = { T, Nmax: Math.exp(ev.Nmax.x), Nmin: Math.exp(ev.Nmin.x), lnNmin: ev.Nmin.x, Pmax: Math.exp(ev.Pmax.y), Pmin: Math.exp(ev.Pmin.y), tNmax: ev.Nmax.ph, tPmax: ev.Pmax.ph };
    return { t: tt, N, P, lx, ly, n: M, status: "ok", start: s, period: T, loop, cycle };
  }
  // a start on an axis has an exact solution: no prey → P = P(0)e^(−δt); no predators → the prey grow
  // exponentially (LV, stopped at 10⁹ as the solver would) or logistically to K (Vt, RM)
  function runAxis(p, s, tmax, samples) {
    const S = Math.max(2, samples | 0), t = new Float64Array(S), N = new Float64Array(S), P = new Float64Array(S);
    let n = S, status = "ok";
    for (let k = 0; k < S; k++) {
      const tk = (tmax * k) / (S - 1); t[k] = tk;
      if (s[0] === 0) { N[k] = 0; P[k] = s[1] * Math.exp(-p.d * tk); continue; }
      P[k] = 0;
      if (p.model === "LV") {
        const v = s[0] * Math.exp(p.r * tk);
        if (!(v <= 1e9)) { n = k; status = "blowup"; break; } // (the solvers' limit for a runaway state)
        N[k] = v;
      } else N[k] = p.K / (1 + (p.K / s[0] - 1) * Math.exp(-p.r * tk));
    }
    if (n < 1) { n = 1; N[0] = s[0]; } // (a start already above 10⁹)
    return { t: t.subarray(0, n), N: N.subarray(0, n), P: P.subarray(0, n), n, status, start: s };
  }
  function logField(p) { // d(ln N)/dt and d(ln P)/dt: the per-head growth rates
    if (p.model === "LV") return (t, y, d) => { d[0] = p.r - p.b * Math.exp(y[1]); d[1] = p.g * p.b * Math.exp(y[0]) - p.d; };
    if (p.model === "Vt") return (t, y, d) => { const N = Math.exp(y[0]); d[0] = p.r * (1 - N / p.K) - p.b * Math.exp(y[1]); d[1] = p.g * p.b * N - p.d; };
    return (t, y, d) => { const N = Math.exp(y[0]); d[0] = p.r * (1 - N / p.K) - (p.b * Math.exp(y[1])) / (p.N0 + N); d[1] = (p.g * p.b * N) / (p.N0 + N) - p.d; };
  }
  function runLog(p, s, tmax, samples, opts) { return runXY(p, [Math.log(s[0]), Math.log(s[1])], tmax, samples, opts, s); }
  function runXY(p, xy, tmax, samples, opts, s) { // from (ln N, ln P)
    const tol = opts.rtol || (p.model === "LV" ? 1e-12 : 1e-10); // (LV: tight, so V's drift stays far below 1e−6)
    return pack(ODE.solve(logField(p), [xy[0], xy[1]], 0, tmax, { rtol: tol, atol: tol, samples, nonneg: false, hmax: tmax / 100, maxSteps: 600000, big: 1e6 }), s);
  }
  function pack(r, s) { // a solver result in (ln N, ln P, …) → a run
    const n = r.n, N = new Float64Array(n), P = new Float64Array(n);
    for (let i = 0; i < n; i++) { N[i] = Math.exp(r.y[0][i]); P[i] = Math.exp(r.y[1][i]); }
    // (the logs are kept: deep in a big cycle e^x underflows to 0, but V is still finite in x and y)
    return { t: r.t.subarray(0, n), N, P, lx: r.y[0].subarray(0, n), ly: r.y[1].subarray(0, n), n, status: r.status, start: s || [N[0], P[0]] };
  }
  // the value at an extremum near sample i, from a parabola through samples i − 1, i, i + 1 (in logs when the
  // run has them: a tiny minimum such as 1e−30 is then refined without ever going below 0)
  function extremeAt(R, which, i) {
    if (i <= 0 || i >= R.n - 1) return which === "N" ? R.N[i] : R.P[i];
    const L = which === "N" ? R.lx : R.ly;
    if (L) return Math.exp(refine(R.t, L, i).v);
    return Math.max(0, refine(R.t, which === "N" ? R.N : R.P, i).v);
  }
  // V along a run at sample i (from the logs when the run has them)
  const Vat = (p, R, i) => (R.lx ? p.g * p.b * Math.exp(R.lx[i]) - p.d * R.lx[i] + p.b * Math.exp(R.ly[i]) - p.r * R.ly[i] : V(p, R.N[i], R.P[i]));
  // LV's conserved quantity, and the size of its terms (V itself can be near 0, so drift is measured against this)
  const V = (p, N, P) => p.g * p.b * N - p.d * Math.log(N) + p.b * P - p.r * Math.log(P);
  const Vscale = (p, N, P) => p.g * p.b * N + p.d * Math.abs(Math.log(N)) + p.b * P + p.r * Math.abs(Math.log(P));

  // local maxima of xs (prominence ≥ 1 % of the run's range), refined by a parabola through three samples
  function peaks(t, xs) {
    const n = xs.length; let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < n; i++) { if (xs[i] < lo) lo = xs[i]; if (xs[i] > hi) hi = xs[i]; }
    const range = hi - lo; if (!(range > 0)) return [];
    const cand = [];
    for (let i = 1; i < n - 1; i++) if (xs[i - 1] < xs[i] && xs[i] >= xs[i + 1]) cand.push(i);
    const out = [];
    for (let k = 0; k < cand.length; k++) {
      const i = cand[k], a = k ? cand[k - 1] : 0, b = k < cand.length - 1 ? cand[k + 1] : n - 1;
      let mL = Infinity, mR = Infinity;
      for (let j = a; j < i; j++) mL = Math.min(mL, xs[j]);
      for (let j = i + 1; j <= b; j++) mR = Math.min(mR, xs[j]);
      if (xs[i] - Math.max(mL, mR) < 0.01 * range) continue;
      out.push(refine(t, xs, i));
    }
    return out;
  }
  function refine(t, xs, i) { // the extremum of the parabola through samples i − 1, i, i + 1
    const a = xs[i - 1], b = xs[i], c = xs[i + 1], den = a - 2 * b + c;
    if (den === 0) return { t: t[i], v: b };
    const off = (0.5 * (a - c)) / den;
    return { t: t[i] + off * (t[i + 1] - t[i]), v: b - 0.25 * (a - c) * off };
  }
  function measures(R) {
    if (R.cycle) { // (a periodic LV run: exact)
      const c = R.cycle, end = R.t[R.n - 1] + 1e-9, pN = [], pP = [];
      for (let t = c.tNmax; t <= end; t += c.T) pN.push({ t, v: c.Nmax });
      for (let t = c.tPmax; t <= end; t += c.T) pP.push({ t, v: c.Pmax });
      return { peaksN: pN, peaksP: pP, period: c.T, lag: (((c.tPmax - c.tNmax) % c.T) + c.T) % c.T, min: c.Nmin, lnMin: c.lnNmin, max: c.Nmax };
    }
    const pN = peaks(R.t, R.N), pP = peaks(R.t, R.P);
    if (pN.length < 2) return { peaksN: pN, peaksP: pP, period: null };
    // period and lag from the last (up to) four cycles: the first swings can still be a transient (a predator
    // boom, a run settling onto a cycle), while the last ones show where the run has settled
    const k0 = Math.max(0, pN.length - 5);
    let gap = 0; for (let k = k0 + 1; k < pN.length; k++) gap += pN[k].t - pN[k - 1].t;
    const period = gap / (pN.length - 1 - k0);
    const lags = [];
    for (const q of pN.slice(k0)) { const nx = pP.find((x) => x.t > q.t); if (nx && nx.t - q.t < period) lags.push(nx.t - q.t); }
    const lag = lags.length ? lags.reduce((s, v) => s + v, 0) / lags.length : null;
    // the prey's swing over the last full period (between the last two prey peaks)
    const t0 = pN[pN.length - 2].t, t1 = pN[pN.length - 1].t, L = R.lx; // (compared in logs when the run has them: a deep trough is 0 in N)
    let iMin = -1, mx = -Infinity;
    for (let i = 1; i < R.n - 1; i++) if (R.t[i] >= t0 && R.t[i] <= t1) { if (iMin < 0 || (L ? L[i] < L[iMin] : R.N[i] < R.N[iMin])) iMin = i; if (R.N[i] > mx) mx = R.N[i]; }
    const min = iMin > 0 ? extremeAt(R, "N", iMin) : null, lnMin = iMin > 0 && L ? refine(R.t, L, iMin).v : null;
    return { peaksN: pN, peaksP: pP, period, lag, min, lnMin, max: Math.max(mx, pN[pN.length - 2].v, pN[pN.length - 1].v) };
  }
  // RM, K > K_H: the limit cycle (there is only one). Its period can be a few time units or thousands (with a
  // rich prey the cycle can crash it to 1e−180, and it takes that long to come back), so the cycle is found
  // on a section, not in a fixed time window: the line N = N* below e2, which every orbit around e2 crosses
  // once per turn, moving right (dN/dt > 0 there; above e2 it is < 0). A turn is two solves: until N < N* (the
  // crossing above e2), then until N ≥ N* (back on the section). The first turn starts near e1 = (K, 0), as
  // the predators invade: at the cycle's rim, where orbits close in on it within a few turns (from near e2
  // they can spiral out for tens of thousands of time units). The turns are repeated until they agree; when
  // they close in slowly (near the Hopf point) an Aitken step on the section's ln P jumps ahead (a planar
  // flow's return map is increasing, so the steps shrink by a factor μ between 0 and 1). One more turn is
  // then sampled finely: the extremes (P's are the two crossings, where dP/dt = 0), the loop and the period.
  // settled: false if the turns had not agreed within the limits; null if no turn could be followed.
  const CYCLE = { turns: 120, time: 1e6, loop: 1500 }; // (time: the slowest cycle in the slider ranges takes ~91 000 a turn)
  function limitCycle(p, opts = {}) {
    const tol = opts.rtol || 1e-10, F = logField(p), Ns = Nstar(p), xs = Math.log(Ns), yTop = Math.log(Pstar(p, Ns));
    const o = { rtol: tol, atol: tol, nonneg: false, maxSteps: 200000, big: 1e6, samples: 2, hmax: 20, h0: 1e-3 };
    const left = (t, z) => z[0] < xs, right = (t, z) => z[0] >= xs;
    let budget = CYCLE.time;
    const until = (z, stop) => { const r = ODE.solve(F, z, 0, budget, Object.assign({ stop }, o)); budget -= r.tEnd; return r.status === "stopped" ? r : null; };
    // one turn from (x*, y) on the section: the next crossing, the crossing above e2 (hi) and the time it took
    const turn = (y) => { const a = until([xs, y], left), b = a && until(a.yEnd, right); return b ? { y: b.yEnd[1], hi: a.yEnd[1], T: a.tEnd + b.tEnd } : null; };
    const a0 = until([Math.log(0.999 * p.K), yTop + Math.log(1e-6)], left), b0 = a0 && until(a0.yEnd, right);
    if (!b0) return null;
    let y = b0.yEnd[1], T = null, hi = null, turns = 0, settled = false;
    const close = 20 * tol;
    while (turns < CYCLE.turns) {
      const u = turn(y), v = u && turn(u.y);
      if (!v) { if (T == null) return null; break; }
      turns += 2; T = v.T; hi = v.hi;
      const d1 = u.y - y, d2 = v.y - u.y, mu = d2 / d1;
      // (y_k − y* ≈ μ^k: the limit is y + d2²/(d1 − d2), and that is how far the cycle still is)
      const jump = mu > 0 && mu < 1 && Number.isFinite(d2 * d2 / (d1 - d2)) ? (d2 * d2) / (d1 - d2) : 0;
      y = v.y;
      if (Math.abs(jump || d2) <= close * Math.max(1, Math.abs(y))) { y += jump; settled = true; break; }
      if (jump && y + jump < yTop - 0.5 * (yTop - y)) y += jump;
    }
    const S = Math.min(20001, Math.max(2001, Math.ceil(T / 0.02)));
    const R = pack(ODE.solve(F, [xs, y], 0, T, Object.assign({}, o, { samples: S, hmax: Math.min(o.hmax, T / 100) })));
    if (R.n < 3) return null;
    let iNmin = 0, iNmax = 0;
    for (let i = 1; i < R.n; i++) { if (R.lx[i] < R.lx[iNmin]) iNmin = i; if (R.lx[i] > R.lx[iNmax]) iNmax = i; }
    const every = Math.ceil(R.n / CYCLE.loop), N = [], P = []; // (each chunk: its first sample and its predator peak, which is sharp)
    for (let i = 0; i < R.n; i += every) {
      let j = i; for (let k = i + 1; k < Math.min(R.n, i + every); k++) if (R.ly[k] > R.ly[j]) j = k;
      N.push(R.N[i]); P.push(R.P[i]); if (j !== i) { N.push(R.N[j]); P.push(R.P[j]); }
    }
    N.push(R.N[R.n - 1]); P.push(R.P[R.n - 1]);
    const lnNmin = iNmin > 0 && iNmin < R.n - 1 ? refine(R.t, R.lx, iNmin).v : R.lx[iNmin]; // (kept: e^x is 0 below 1e−308)
    // P's extremes are the two crossings themselves (dP/dt = 0 on N = N*): exact, however sharp the peak
    return { Nmin: Math.exp(lnNmin), lnNmin, Nmax: extremeAt(R, "N", iNmax), Pmin: Math.exp(y), Pmax: Math.exp(hi),
      loop: { N, P }, period: T, settled, turns };
  }

  const M = { MODELS, field, logField, f, jac, Nstar, Pstar, KH, invasion, equilibria, run, V, Vat, Vscale, peaks, measures, limitCycle, scaleOf };
  (G.WQ = G.WQ || {}).PP = M;
  if (typeof document === "undefined") return; // (in node: the maths only)

  /* ================================================================ 2. page */
  const Sim = G.WQ.Sim, C = G.WQ.Plot.COLORS, $ = (id) => document.getElementById(id);
  const { fmt, fmtSig, signed, hi, dim, warn, why } = Sim;
  const DEFAULTS = {
    LV: { r: 1, b: 1, g: 1, d: 1, Ns: 0.5, Ps: 0.5, tmax: 50 },
    Vt: { r: 1, b: 0.5, g: 0.5, d: 1, K: 10, Ns: 3, Ps: 3, tmax: 50 },
    RM: { r: 1, b: 2, g: 0.8, d: 0.5, K: 60, N0: 10, Ns: 3, Ps: 3, tmax: 300 },
  };
  const RMB = { r: 1, b: 2, N0: 10, g: 0.8, d: 0.5 };
  const PRESETS = {
    LV: [{ label: "README 1: r = β = γ = δ = 1", values: { r: 1, b: 1, g: 1, d: 1 } }, { label: "README 2: r 1.5, β 0.5, γ 0.8, δ 1.2", values: { r: 1.5, b: 0.5, g: 0.8, d: 1.2 } }],
    Vt: [{ label: "README 1: K 10", values: { r: 1, b: 0.5, g: 0.5, d: 1, K: 10 } }, { label: "README 2: K 1.5 (predator dies)", values: { r: 1, b: 0.5, g: 0.5, d: 1, K: 1.5 } }],
    RM: [2, 15, 18, 19, 19.5, 60].map((K) => ({ label: `K ${K}`, values: Object.assign({}, RMB, { K }) })),
  };
  const STARTS = { LV: [[0.5, 0.5], [1.5, 1.5], [2, 0.5], [0.3, 2]], Vt: [[0.5, 0.5], [3, 3], [8, 1], [1, 0.2]], RM: [[0.5, 0.5], [3, 3], [8, 1], [1, 0.2]] };
  const SL = { r: ["LV", "Vt", "RM"], b: ["LV", "Vt", "RM"], g: ["LV", "Vt", "RM"], d: ["LV", "Vt", "RM"], K: ["Vt", "RM"], N0: ["RM"], Ns: ["LV", "Vt", "RM"], Ps: ["LV", "Vt", "RM"], tmax: ["LV", "Vt", "RM"] };
  const FORMULA = {
    LV: ['<i>dN</i>/<i>dt</i> = <i>rN</i> − <i>βNP</i>', '<i>dP</i>/<i>dt</i> = <i>γβNP</i> − <i>δP</i>'],
    Vt: ['<i>dN</i>/<i>dt</i> = <i>rN</i>(1 − <i>N</i>/<i>K</i>) − <i>βNP</i>', '<i>dP</i>/<i>dt</i> = <i>γβNP</i> − <i>δP</i>'],
    RM: ['<i>dN</i>/<i>dt</i> = <i>rN</i>(1 − <i>N</i>/<i>K</i>) − <i>βNP</i>/(<i>N</i><sub>0</sub> + <i>N</i>)', '<i>dP</i>/<i>dt</i> = <i>γβNP</i>/(<i>N</i><sub>0</sub> + <i>N</i>) − <i>δP</i>'],
  };
  const st = { model: "LV", v: JSON.parse(JSON.stringify(DEFAULTS)) };
  let P, E, Ns, Ps, Kh, orbits = [], taps = [], tapRuns = [], main = null, meas = null, cyc = null, cycWait = false, box = null, sliders = {}, plots = {}, loop;
  let scan = { key: null, pts: [], done: false, timer: 0, cycles: new Map() }, runs = { key: null, map: new Map() };
  const snap = () => Object.assign({ model: st.model }, st.v[st.model]);
  const p4 = (v) => { if (v === 0) return "0"; const a = Math.abs(v), sg = v < 0 ? "−" : ""; return a < 1e-3 || a >= 1e6 ? fmtSig(v, 4) : sg + (a >= 1 ? a.toPrecision(4) : a.toFixed(3)); };
  // a prey minimum, from its log when it is below what a number can hold here (a cycle can reach 1e−400)
  const tiny = (lnv) => { const e = lnv / Math.LN10; let k = Math.floor(e), m = Math.pow(10, e - k); if (m >= 9.9995) { m = 1; k++; } return `${m.toFixed(3)}e${k < 0 ? "−" + -k : k}`; };
  const low = (v, lnv) => (v > 1e-300 || !Number.isFinite(lnv) ? p4(v) : tiny(lnv));
  const pt = (N, Pp) => `(${p4(N)}, ${p4(Pp)})`;
  const typeName = (t) => (t === "center" ? "centre" : t);
  const nearHopf = () => Kh != null && Math.abs(P.K - Kh) <= 1e-6 * Kh;
  const wantsCycle = () => P.model === "RM" && Kh != null && P.K > Kh && !nearHopf();

  // the faint orbits and your taps, kept until a parameter or t_max changes (dragging N(0), P(0) or tapping
  // then costs one run); Vt and RM at 1e−8, plenty for lines (the main run, whose numbers are shown: 1e−10)
  function fanRuns(starts) {
    const key = [P.model, P.r, P.b, P.g, P.d, P.K, P.N0, P.tmax].join(",");
    if (runs.key !== key) runs = { key, map: new Map() };
    const keep = new Map(), out = starts.map((s) => {
      const k = s.join(","); let R = runs.map.get(k) || keep.get(k);
      if (!R) R = run(P, s, P.tmax, 500, P.model === "LV" ? {} : { rtol: 1e-8 });
      keep.set(k, R); return R;
    });
    runs.map = keep; return out;
  }
  function compute() {
    P = snap(); E = equilibria(P); Ns = Nstar(P); Ps = Number.isFinite(Ns) ? Pstar(P, Ns) : null; Kh = KH(P);
    const fan = fanRuns(STARTS[P.model].concat(taps)), n = STARTS[P.model].length;
    orbits = fan.slice(0, n); tapRuns = fan.slice(n);
    main = run(P, [P.Ns, P.Ps], P.tmax, 800, { perPeriod: 12 });
    meas = P.Ns > 0 && P.Ps > 0 ? measures(main) : null;
    if (P.model === "RM") startScan();
    pickCycle();
  }
  // the cycle at the current K comes from the K scan's cache (the same computation as the band), so moving K
  // along a finished scan costs nothing; until the scan has it, the boxes say it is being computed
  function pickCycle() {
    cyc = null; cycWait = false;
    if (wantsCycle()) { const c = scan.key === scanKey(P) ? scan.cycles.get(P.K) : undefined; if (c === undefined) cycWait = true; else cyc = c; }
    axes();
  }
  function axes() {
    // the axes: from the default orbits, the cycle, N*, P* (and K), then your runs; a run that grows without
    // limit (LV prey with no predators, stopped at 10⁹) only stretches them to 3× the rest
    const ext = (R) => { const c = R.loop || R; let a = 0, b = 0; for (let i = 0; i < c.N.length; i++) { if (c.N[i] > a) a = c.N[i]; if (c.P[i] > b) b = c.P[i]; } return [a, b]; };
    let Nm = 0, Pm = 0;
    for (const R of orbits) { const [a, b] = ext(R); Nm = Math.max(Nm, a); Pm = Math.max(Pm, b); }
    if (cyc) { Nm = Math.max(Nm, cyc.Nmax); Pm = Math.max(Pm, cyc.Pmax); }
    if (Number.isFinite(Ns)) Nm = Math.max(Nm, Ns);
    if (P.model !== "LV") Nm = Math.max(Nm, P.K);
    if (Ps != null && Ps > 0) Pm = Math.max(Pm, Ps);
    for (const R of tapRuns.concat([main])) {
      let [a, b] = ext(R);
      if (R.status === "blowup") { a = Math.min(a, Math.max(3 * Nm, 1.5 * R.start[0])); b = Math.min(b, Math.max(3 * Pm, 1.5 * R.start[1])); }
      Nm = Math.max(Nm, a); Pm = Math.max(Pm, b);
    }
    box = { X: 1.08 * Math.max(Nm, 1e-6), Y: 1.08 * Math.max(Pm, 1e-6) };
  }

  /* ---------------------------------------------------- C. the K scan (RM: debounced, progressive, cached) */
  // K from 1 to 100 in steps of 0.5 (the K slider's own steps), for one (r, β, γ, δ, N₀): it starts 200 ms after
  // the last change of those, computes the current K first, then the rest in slices of 25 ms; each cycle is
  // kept (scan.cycles), so moving K only looks it up. Paused while another model is shown.
  const KS = []; for (let K = 1; K <= 100 + 1e-9; K += 0.5) KS.push(K);
  const scanKey = (q) => [q.r, q.b, q.g, q.d, q.N0].join(",");
  const CYC = { rtol: 1e-8 }; // (the cycle's tolerance: checked against scipy, 5e−5 or better)
  function cycleAt(K) { // (null if the cycle could not be followed)
    if (!scan.cycles.has(K)) scan.cycles.set(K, limitCycle(Object.assign({}, scan.q, { K }), CYC));
    return scan.cycles.get(K);
  }
  function startScan() {
    const key = scanKey(P);
    if (scan.key !== key) {
      clearTimeout(scan.timer);
      const q = { model: "RM", r: P.r, b: P.b, g: P.g, d: P.d, N0: P.N0 };
      scan = { key, q, Nq: Nstar(q), Kq: KH(q), pts: [], i: 0, done: false, timer: setTimeout(scanStep, 200), cycles: new Map() };
    } else if (!scan.timer && (!scan.done || (wantsCycle() && !scan.cycles.has(P.K)))) scan.timer = setTimeout(scanStep, 0); // (resumed, or a K off the grid)
  }
  function scanStep() {
    const s = scan; s.timer = 0;
    if (P.model !== "RM" || s.key !== scanKey(P)) return; // (paused: startScan resumes it)
    const t0 = Date.now();
    if (wantsCycle() && !s.cycles.has(P.K)) cycleAt(P.K);
    while (s.i < KS.length && Date.now() - t0 < 25) {
      const K = KS[s.i++];
      if (!Number.isFinite(s.Nq) || K <= s.Nq) s.pts.push({ K, kind: "noP", N: K });
      else if (s.Kq == null || K <= s.Kq) s.pts.push({ K, kind: "stable", N: s.Nq });
      else { const c = cycleAt(K); if (c) s.pts.push({ K, kind: "cycle", N: s.Nq, lo: c.Nmin, hi: c.Nmax }); }
    }
    s.done = s.i >= KS.length;
    if (!s.done) s.timer = setTimeout(scanStep, 0);
    loop.want("scan");
  }

  /* ---------------------------------------------------- A. phase plane */
  function drawPhase() {
    const p = plots.phase, X = box.X, Y = box.Y;
    p.set({ x: [0, X], y: [0, Y], xLabel: "N", yLabel: "P" }).clear();
    p.field((x, y) => f(P, x, y), { color: "rgba(246,244,236,0.22)" });
    const nc = { dash: [6, 5], width: 1.6 };
    p.line([0, 0], [0, Y], C.yellow, nc);
    const xs = [], ys = [];
    for (let k = 0; k <= 200; k++) { const N = (X * k) / 200; xs.push(N); ys.push(P.model === "LV" ? P.r / P.b : P.model === "Vt" ? (P.r / P.b) * (1 - N / P.K) : (P.r / P.b) * (1 - N / P.K) * (P.N0 + N)); }
    p.line(xs, ys, C.yellow, nc);
    p.line([0, X], [0, 0], C.pink, nc);
    if (Number.isFinite(Ns)) p.line([Ns, Ns], [0, Y], C.pink, nc);
    const curve = (R, colour, width) => { const c = R.loop || R; p.line(Array.from(c.N), Array.from(c.P), colour, { width, arrowAt: 0.3 }); }; // (LV: its closed loop)
    for (const R of orbits) curve(R, "rgba(246,244,236,0.75)", 1.1);
    for (const R of tapRuns) curve(R, C.white, 2.2);
    curve(main, C.white, 2.4);
    if (cyc) p.line(cyc.loop.N, cyc.loop.P, C.orange, { width: 2 });
    for (const s of taps) p.marker(s[0], s[1], "unstable", { r: 3.5 });
    for (const e of E) p.marker(e.N, e.P, e.stable ? "stable" : e.type === "saddle" ? "saddle" : e.type === "center" ? "center" : "unstable", { label: e.name });
    p.legend([{ label: "prey nullcline", color: C.yellow }, { label: "predator nullcline", color: C.pink }].concat(cyc ? [{ label: "limit cycle", color: C.orange }] : []));
  }
  function eigText(e) {
    if (e.eig.complex) return Math.abs(e.eig.re1) < 1e-9 ? `±${fmt(Math.abs(e.eig.im1))}i` : `${fmt(e.eig.re1)} ± ${fmt(Math.abs(e.eig.im1))}i`;
    return `${signed(e.eig.re1)}, ${signed(e.eig.re2)}`;
  }
  function paramLine() {
    const ex = P.model === "LV" ? "" : `, K ${fmt(P.K, 1)}${P.model === "RM" ? `, N_0 ${fmt(P.N0, 1)}` : ""}`;
    return `> ${MODELS[P.model]} · r ${fmt(P.r, 2)}, β ${fmt(P.b, 2)}, γ ${fmt(P.g, 2)}, δ ${fmt(P.d, 2)}${ex}`;
  }
  function phaseBox() {
    const L = [paramLine(), "> equilibria · eigenvalues · type"];
    for (const e of E) L.push([`  ${Sim.pad(`${e.name} ${pt(e.N, e.P)}`, 19)}${Sim.pad(eigText(e), 18)}`, e.stable ? hi(typeName(e.type)) : typeName(e.type)]);
    const e2 = E.find((x) => x.name === "e2");
    if (P.model === "LV") {
      L.push(["> regime: ", hi("neutral cycles around e1")]);
      L.push(why("prey are held back only by predators, predators only by lack of prey: nothing damps the swings"));
      L.push(why("each orbit keeps V = γβN − δ ln N + βP − r ln P constant, so it closes on itself"));
      L.push(why(`bigger starts → bigger cycles; small ones last 2π/√(rδ) = ${fmt((2 * Math.PI) / Math.sqrt(P.r * P.d), 2)}`));
      L.push(why("LV has no K: alone, the prey grow without limit"));
      return L;
    }
    if (P.model === "RM" && !Number.isFinite(Ns)) { L.push(["> ", hi("the predator can never grow: γβ ≤ δ even with endless prey")]); return L; }
    if (!e2) {
      L.push(["> regime: ", hi("the predator dies out, prey settle at K")]);
      L.push(why(`even at K the prey cannot feed predators: ${P.model === "Vt" ? "γβK − δ" : "γβK/(N_0 + K) − δ"} = ${fmt(invasion(P))} < 0`));
      return L;
    }
    const ev = `${fmt(e2.eig.re1)} ± ${fmt(Math.abs(e2.eig.im1))}i`;
    if (P.model === "Vt") {
      if (e2.eig.complex) {
        L.push(["> regime: ", hi("damped oscillations into e2 (stable spiral)")]);
        L.push(why("prey crowding (logistic growth) takes energy out of each swing"));
        L.push(why(`e2 = ${pt(e2.N, e2.P)}, eigenvalues ${ev}`));
      } else {
        L.push(["> regime: ", hi("e2 is a stable node: no oscillation")]);
        L.push(why(`prey crowding damps faster than the swing can turn: tr² = ${fmtSig(e2.eig.tr * e2.eig.tr, 3)} ≥ 4·det = ${fmtSig(4 * e2.eig.det, 3)}`));
        L.push(why("this happens when K is just above δ/(γβ) (little prey to drive a swing) or when the prey grows very fast"));
      }
      return L;
    }
    if (nearHopf()) { L.push(["> regime: ", hi("exactly at the Hopf point K = K_H")]); L.push(why("one step either way decides between damped swings and a limit cycle")); return L; }
    if (P.K < Kh) {
      L.push(["> regime: ", hi(e2.eig.complex ? "damped oscillations into e2" : "e2 is a stable node: no oscillation")]);
      L.push(why(`K < K_H = N_0 + 2N* = ${fmt(Kh, 2)}`));
      if (P.K > 0.98 * Kh) L.push(why("near the Hopf point: the swings die out very slowly"));
      return L;
    }
    L.push(["> regime: ", hi("a limit cycle (sustained oscillations)")]);
    L.push(why("e2 is an unstable spiral: orbits spiral out to the orange cycle"));
    L.push(why("the paradox of enrichment: more food for the prey destabilises the system"));
    if (cycWait) L.push(dim("  computing the cycle…"));
    if (cyc && cyc.Nmin < 0.01 * P.K) L.push(warn(`> the prey falls to ${low(cyc.Nmin, cyc.lnNmin)} each cycle: in a real population that risks extinction`));
    return L;
  }

  /* ---------------------------------------------------- B. time series */
  function drawTime() {
    const p = plots.time, R = main;
    let top = 0; for (let i = 0; i < R.n; i++) top = Math.max(top, R.N[i], R.P[i]);
    p.set({ x: [0, P.tmax], y: [0, 1.1 * Math.max(top, 1e-6)], xLabel: "t", yLabel: "N, P" }).clear();
    const e2 = E.find((x) => x.name === (P.model === "LV" ? "e1" : "e2"));
    if (e2) { p.hline(e2.N, C.yellow, { alpha: 0.45, label: "N*", labelAt: "left" }); p.hline(e2.P, C.pink, { alpha: 0.45, label: "P*" }); }
    p.line(Array.from(R.t), Array.from(R.N), C.yellow, { width: 2 });
    p.line(Array.from(R.t), Array.from(R.P), C.pink, { width: 2 });
    p.legend([{ label: "N (prey)", color: C.yellow }, { label: "P (predators)", color: C.pink }]);
  }
  function timeBox() {
    const L = [];
    if (P.Ns === 0 && P.Ps === 0) return ["> no prey and no predators: nothing happens"];
    if (P.Ns === 0) return [`> no prey: the predators starve (P halves every ln 2/δ = ${fmt(Math.LN2 / P.d, 2)})`];
    if (P.Ps === 0) {
      if (P.model !== "LV") return [`> no predators: the prey grow to K = ${fmt(P.K, 1)}`];
      return [main.status === "blowup" ? `> no predators: the prey grow without limit (past 10⁹ by t = ${fmt(main.t[main.n - 1], 2)})` : "> no predators: the prey grow without limit"];
    }
    const e2 = E.find((x) => x.name === "e2");
    if (P.model !== "LV" && !e2) {
      const rate = invasion(P);
      L.push(`> the predator declines ×e every 1/|${P.model === "Vt" ? "γβK − δ" : "γβK/(N_0 + K) − δ"}| = ${fmt(1 / Math.abs(rate), 2)} (rate ${fmt(rate)})`);
      L.push(why(`the prey then settle at K = ${fmt(P.K, 1)}`));
      return L;
    }
    if (meas && meas.period != null) {
      const list = meas.peaksN.slice(0, 3).map((x) => fmt(x.t, 2)).join(", ") + (meas.peaksN.length > 3 ? ", …" : "");
      L.push(`> period ≈ ${fmt(meas.period, 2)} (prey peaks at t = ${list})`);
      if (meas.lag != null) { L.push(`> predator peaks lag the prey by ≈ ${fmt(meas.lag, 2)} (${fmt(meas.lag / meas.period, 2)} of a period)`); L.push(why("predators multiply while prey are plenty, then overeat them")); }
      if (meas.min != null) L.push(`> prey swing between ${low(meas.min, meas.lnMin)} and ${p4(meas.max)}`);
    } else L.push("> no oscillation within t_max");
    if (e2 && e2.stable && e2.eig.complex) {
      L.push(`> the swings shrink ×${p4(Math.exp((2 * Math.PI * e2.eig.re1) / Math.abs(e2.eig.im1)))} per cycle near e2`);
      L.push(why(`near e2 they repeat every 2π/|Im λ| = ${fmt((2 * Math.PI) / Math.abs(e2.eig.im1), 2)}`));
    }
    if (cyc) {
      L.push(`> it settles on the cycle: prey between ${low(cyc.Nmin, cyc.lnNmin)} and ${p4(cyc.Nmax)}`);
      if (!meas || meas.period == null || Math.abs(meas.period - cyc.period) > 0.02 * cyc.period) L.push(why(`by t_max it is still on its way there: one turn of the cycle takes ${fmt(cyc.period, cyc.period < 100 ? 2 : 0)}`));
    }
    else if (cycWait) L.push(dim("> computing the cycle…"));
    if (P.model === "LV") {
      const V0 = Vat(P, main, 0), V1 = Vat(P, main, main.n - 1), drift = Math.abs(V1 - V0) / Vscale(P, main.N[0], main.P[0]);
      L.push(`> V stays ${V0.toFixed(6)} → ${V1.toFixed(6)} (drift ${drift < 1e-6 ? "< 1e−6" : fmtSig(drift, 2)})`);
      if (drift > 1e-6) L.push(warn("> the solver drifted"));
    }
    return L;
  }

  /* ---------------------------------------------------- C. effect of enrichment */
  function drawK() {
    const p = plots.k;
    let top = 1; if (P.model === "RM") for (const q of scan.pts) top = Math.max(top, q.hi != null ? q.hi : q.N);
    if (P.model === "Vt") top = Math.max(1.6 * Math.min(Ns, 100), 2);
    p.set({ x: [0, 100], y: [0, 1.08 * top], xLabel: "K", yLabel: "prey N" }).clear();
    if (P.model === "Vt") {
      const Nq = Ns, a = Math.min(100, Nq);
      p.line([1, Math.max(1, a)], [1, Math.max(1, a)], C.white, { width: 2 });
      if (Nq < 100) p.line([Nq, 100], [Nq, Nq], C.white, { width: 2 });
    } else {
      const seg = (kind) => scan.pts.filter((q) => q.kind === kind);
      const a = seg("noP"), s = seg("stable"), c = seg("cycle");
      if (a.length) p.line(a.map((q) => q.K), a.map((q) => q.N), C.white, { width: 2 });
      if (s.length) p.line(s.map((q) => q.K), s.map((q) => q.N), C.white, { width: 2 });
      if (c.length) {
        p.band(c.map((q) => q.K), c.map((q) => q.lo), c.map((q) => q.hi), "rgba(240,178,122,0.35)");
        p.line(c.map((q) => q.K), c.map((q) => q.hi), C.orange, { width: 1.4 }); p.line(c.map((q) => q.K), c.map((q) => q.lo), C.orange, { width: 1.4 });
        p.line(c.map((q) => q.K), c.map((q) => q.N), C.white, { width: 1.6, dash: [5, 4] });
      }
    }
    // the two threshold lines; their labels on two rows so they never overlap
    const yTop = 1.08 * top, tag = (x, text, colour, dy) => { const right = x < 70; p.text(text, x, yTop, { dx: right ? 5 : -5, dy, align: right ? "left" : "right", color: colour }); };
    if (Number.isFinite(Ns) && Ns <= 100) { p.vline(Ns, C.blue, { dash: [4, 3] }); tag(Ns, "predator can live", C.blue, 16); }
    if (Kh != null && Kh <= 100) { p.vline(Kh, C.pink, { dash: [4, 3] }); tag(Kh, "Hopf", C.pink, 32); }
    const level = !Number.isFinite(Ns) || P.K <= Ns ? P.K : Ns;
    p.vline(P.K, C.yellow, { alpha: 0.6, width: 1 });
    p.marker(P.K, level, "stable", { color: C.yellow });
    if (cyc) { p.marker(P.K, cyc.Nmin, "stable", { color: C.yellow, r: 3 }); p.marker(P.K, cyc.Nmax, "stable", { color: C.yellow, r: 3 }); }
    if (P.model === "RM" && !scan.done) p.text(`computing the cycles… ${scan.pts.length}/199`, 98, 0.98 * 1.08 * top, { align: "right", baseline: "top", color: "rgba(246,244,236,0.6)" });
  }
  function kBox() {
    if (P.model === "LV") return [];
    const L = [];
    if (!Number.isFinite(Ns)) { L.push("> the predator can never grow (γβ ≤ δ): the prey settle at K for every K"); return L; }
    L.push(`> predators can live once K > N* = ${p4(Ns)}`);
    if (P.model === "Vt") {
      L.push("> no Hopf point: e2 stays stable for every K > N*");
      L.push(why("with Type I predation, enrichment never destabilises"));
      return L;
    }
    L.push(`> Hopf point K_H = N_0 + 2N* = ${fmt(Kh, 2)}`);
    const now = `> now K = ${fmt(P.K, 1)}: `;
    if (P.K <= Ns) L.push([now, hi("no predators, prey at K")]);
    else if (wantsCycle()) {
      L.push([now, hi(cyc ? `a limit cycle, prey between ${low(cyc.Nmin, cyc.lnNmin)} and ${p4(cyc.Nmax)}` : "a limit cycle")]);
      if (cycWait) L.push(dim("  computing the cycle…"));
      else if (cyc) L.push(why(`one turn of the cycle takes ${fmt(cyc.period, cyc.period < 100 ? 2 : 0)} time units${cyc.settled ? "" : " (still settling: the numbers are approximate)"}`));
      L.push(why("a richer prey peak feeds a predator boom, which crashes the prey: the swings grow"));
      L.push(why("Type II predation saturates, so predators cannot hold a rich prey population steady"));
    } else L.push([now, hi(nearHopf() ? "at the Hopf point" : `a stable equilibrium at N* = ${p4(Ns)}`)]);
    if (Kh <= 100 && Math.abs(P.K - Kh) < 0.1 * Kh) L.push(why("near K_H the swings grow or die very slowly: a run takes long to reach the band"));
    if (!scan.done) L.push(dim(`  computing the band… ${scan.pts.length}/199`));
    return L;
  }

  /* ---------------------------------------------------- runtime checks (?check=1) */
  function runChecks(boxes) {
    const ck = Sim.check, F = field(P), S = scaleOf(P);
    for (const e of E) {
      const d = f(P, e.N, e.P);
      ck("equilibrium f = 0", Math.hypot(d[0], d[1]) < 1e-9 * S, `${e.name} ${d}`);
      const J = ODE.jacFD(F, [e.N, e.P]), en = ODE.eig2(J[0], J[1], J[2], J[3]), tol = 1e-5 * Math.max(1, Math.abs(e.eig.re1), Math.abs(e.eig.re2), Math.abs(e.eig.im1));
      ck("analytic J eigenvalues = finite-difference J", Math.abs(en.re1 - e.eig.re1) < tol && Math.abs(en.re2 - e.eig.re2) < tol && Math.abs(Math.abs(en.im1) - Math.abs(e.eig.im1)) < tol, `${e.name} ${e.eig.re1},${e.eig.re2},${e.eig.im1} vs ${en.re1},${en.re2},${en.im1}`);
    }
    const all = orbits.concat(tapRuns, [main]);
    if (P.model === "LV") for (const R of all) {
      if (!(R.N[0] > 0 && R.P[0] > 0)) continue;
      const V0 = Vat(P, R, 0); let worst = 0;
      for (let i = 0; i < R.n; i++) worst = Math.max(worst, Math.abs(Vat(P, R, i) - V0));
      ck("LV: V is conserved (relative drift < 1e-6)", worst / Vscale(P, R.N[0], R.P[0]) < 1e-6, `start ${R.start} drift ${worst}`);
    }
    const e2 = E.find((x) => x.name === "e2");
    if (P.model === "RM" && e2 && !nearHopf()) ck("RM: Re λ(e2) < 0 iff K < K_H", (e2.eig.re1 < 0) === (P.K < Kh), `K ${P.K} K_H ${Kh} re ${e2.eig.re1}`);
    if (cyc) ck("RM cycle: prey min < N* < max", cyc.Nmin < Ns && cyc.Nmax > Ns, `${cyc.Nmin} ${Ns} ${cyc.Nmax}`);
    for (const R of all) { let okR = true; for (let i = 0; i < R.n; i++) if (!(R.N[i] >= 0 && R.P[i] >= 0 && Number.isFinite(R.N[i] + R.P[i]))) { okR = false; break; } ck("orbits stay ≥ 0 and finite", okR, `start ${R.start}`); }
    const text = boxes.map((b) => b.textContent).join(" ");
    ck("boxes are finite", !/NaN|Infinity|undefined|\bnull\b/.test(text), text.slice(0, 120));
  }

  /* ---------------------------------------------------- wiring */
  const boxes = () => ["term-phase", "term-time", "term-k"].map($);
  const writeBoxes = Sim.throttle(() => {
    Sim.term($("term-phase"), phaseBox()); Sim.term($("term-time"), timeBox()); Sim.term($("term-k"), kBox());
    if (Sim.checking) runChecks(P.model === "LV" ? boxes().slice(0, 2) : boxes());
  }, 150);
  function render(dirty) {
    // (a slice of the K scan only redraws panel C, unless it brought the current K's cycle)
    let all = !(dirty.size === 1 && dirty.has("scan"));
    if (dirty.has("data")) compute();
    else if (cycWait) { pickCycle(); if (!cycWait) all = true; }
    if (all) { drawPhase(); drawTime(); }
    if (P.model !== "LV") drawK();
    writeBoxes();
  }
  function showModel() {
    const m = st.model, v = st.v[m];
    for (const [key, ms] of Object.entries(SL)) $(key).closest("label").hidden = !ms.includes(m);
    for (const key of Object.keys(SL)) if (v[key] != null) sliders[key].set(v[key], { silent: true });
    $("formula").innerHTML = FORMULA[m].map((x) => `<span class="m">${x}</span>`).join("");
    $("enrichment").hidden = m === "LV";
    Sim.presets($("presets"), PRESETS[m], (vals) => { for (const [k, x] of Object.entries(vals)) { sliders[k].set(x, { silent: true }); st.v[st.model][k] = sliders[k].get(); } loop.want("data"); });
    taps = [];
    loop.want("data");
  }
  function start() {
    if (!$("cv-phase") || !$("term-k")) return;
    plots.phase = G.WQ.Plot.create($("cv-phase"), {});
    plots.time = G.WQ.Plot.create($("cv-time"), {});
    plots.k = G.WQ.Plot.create($("cv-k"), {});
    loop = Sim.loop(render);
    Object.values(plots).forEach((p) => p.onResize(() => loop.want("draw")));
    const f1 = (v) => fmt(v, 1), f2 = (v) => fmt(v, 2);
    const fm = { r: f2, b: f2, g: f2, d: f2, K: f1, N0: f1, Ns: f1, Ps: f1, tmax: (v) => String(Math.round(v)) };
    for (const key of Object.keys(SL)) sliders[key] = Sim.slider(key, { fmt: fm[key], onInput: (v) => { st.v[st.model][key] = v; loop.want("data"); } });
    Sim.seg($("model"), (v) => { st.model = v; showModel(); });
    plots.phase.onTap((x, y) => {
      const s = [Math.max(0, Math.round(x * 10) / 10), Math.max(0, Math.round(y * 10) / 10)];
      taps.push(s); if (taps.length > 12) taps.shift();
      sliders.Ns.set(s[0], { silent: true }); sliders.Ps.set(s[1], { silent: true });
      st.v[st.model].Ns = sliders.Ns.get(); st.v[st.model].Ps = sliders.Ps.get(); loop.want("data");
    });
    $("clear-taps").addEventListener("click", () => { taps = []; loop.want("data"); });
    showModel();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})(typeof window !== "undefined" ? window : globalThis);
