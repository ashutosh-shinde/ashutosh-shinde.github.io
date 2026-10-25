/* =============================================================================
   harvesting.js — logistic growth with Holling harvesting: maths and page
   -----------------------------------------------------------------------------
   Page: simulations/population-dynamics/harvesting/
     the θ model  dy/dt′ = y(1 − y/k) − h·y^θ/(1 + y^θ)     (y = N/N₀, k = K/N₀)
                  θ = 0: a constant catch h/2 (Type 0), θ = 1: Type II, θ > 1: Type III
     Type I       dx/dt  = r_m x(1 − x) − h₀x                (x = N/K)
   (Type I is not in the θ family: y^θ/(1 + y^θ) never exceeds 1, while h₀x grows
   without limit; Type I is only the low-density limit of Type II.)
   1. the maths (WQ.Harvest; node-tested by tools/test-harvesting.mjs). Both models
      are f(u) = g(u) − p·φ(u). A positive u is an equilibrium exactly when
      p = P(u) = g(u)/φ(u), and it is stable exactly when P′(u) < 0, so the
      bifurcation diagram is drawn from P with no root finding (no missed
      tangential roots). Folds are the zeros of P′.
   2. the page: a model switch, sliders and presets → four panels (growth vs
      harvest, runs from many starts, the bifurcation diagram, a slow ramp of the
      harvest past the tipping point), each with a green terminal box.
   Reference: github.com/ashutosh-shinde/Population-Dynamics,
   Holling_functional_harvesting_model/.
   HOW TO EDIT: DEFAULTS (per model), PRESETS, FAN (the starts of panel B),
   RAMP_PLAY_S (the ramp's playback time).
   ============================================================================= */
(function (G) {
  "use strict";
  const ODE = G.WQ && G.WQ.ODE;

  /* ================================================================ 1. maths */
  // which of the README's types a θ is
  const typeName = (th) => (th === 0 ? "Type 0, constant" : th === 1 ? "Type II" : th > 1 ? "Type III" : "between Types 0 and II");

  // a model: kind "theta" with { k, h, theta } or "linear" (Type I) with { r, h0 }
  function model(kind, q) {
    const lin = kind === "linear";
    const r = q.r, k = q.k, th = lin ? 1 : q.theta, p = lin ? q.h0 : q.h, U = lin ? 1 : k;
    const absorbing = !lin && p > 0 && th < 1; // extinction is reached in finite time
    const g = lin ? (u) => r * u * (1 - u) : (u) => u * (1 - u / k);
    const dg = lin ? (u) => r * (1 - 2 * u) : (u) => 1 - (2 * u) / k;
    const phi = lin ? (u) => u
      : th === 0 ? (u) => (u > 0 ? 0.5 : 0) // (never 0^0: φ = ½ for every u > 0)
      : (u) => { if (u <= 0) return 0; const a = Math.pow(u, th); return a / (1 + a); };
    const dphi = lin ? () => 1
      : th === 0 ? () => 0
      : (u) => { if (u <= 0) return th === 1 ? 1 : 0; const a = Math.pow(u, th); return (th * Math.pow(u, th - 1)) / ((1 + a) * (1 + a)); };
    const f = (u, pp = p) => (u <= 0 ? 0 : g(u) - pp * phi(u));
    const df = (u, pp = p) => dg(u) - pp * dphi(u);
    // branch function P = g/φ and its slope
    const P = lin ? (u) => r * (1 - u) : (u) => (1 - u / k) * (Math.pow(u, 1 - th) + u);
    const dP = lin ? () => -r : (u) => -(Math.pow(u, 1 - th) + u) / k + (1 - u / k) * ((1 - th) * Math.pow(u, -th) + 1);
    return { kind: lin ? "linear" : "theta", lin, r, k, th, p, U, absorbing, g, dg, phi, dphi, f, df, P, dP };
  }

  // u grid on (0, U): log-spaced near 0, linear after (used for the folds and the drawn branch)
  function grid(m, nLog, nLin) {
    const a = Math.min(1, m.U), out = [];
    for (let i = 0; i < nLog; i++) out.push(1e-6 * a * Math.pow(1e6, i / (nLog - 1)));
    for (let i = 1; i <= nLin; i++) out.push(a + (m.U * (1 - 1e-9) - a) * (i / nLin));
    return out;
  }
  function folds(m) {
    if (m.lin) return [];
    const us = grid(m, 1000, 2000), out = [];
    let prev = m.dP(us[0]);
    for (let i = 1; i < us.length; i++) {
      const cur = m.dP(us[i]);
      if (Number.isFinite(prev) && Number.isFinite(cur) && prev !== 0 && prev * cur < 0) {
        const u = ODE.bisect(m.dP, us[i - 1], us[i], 1e-14);
        out.push({ u, p: m.P(u), kind: prev > 0 ? "max" : "min" });
      }
      if (cur !== 0) prev = cur;
    }
    return out;
  }
  // equilibria at the model's p: [{ u, stab: "stable" | "unstable" | "fold" | "absorbing", fp }]
  function equilibria(m, F = folds(m)) {
    const out = [], U = m.U, p = m.p;
    if (p === 0) return [{ u: 0, stab: "unstable", fp: m.dg(0) }, { u: U, stab: "stable", fp: m.dg(U) }];
    const cuts = [1e-12 * U, ...F.map((x) => x.u), U];
    for (let i = 0; i < cuts.length - 1; i++) {
      const a = cuts[i], b = cuts[i + 1], Pa = m.P(a), Pb = i === cuts.length - 2 ? 0 : m.P(b);
      if (!Number.isFinite(Pa) && !Number.isFinite(Pb)) continue;
      if ((p - Pa) * (p - Pb) <= 0) {
        const u = (p === Pb) ? b : (p === Pa) ? a : ODE.bisect((x) => m.P(x) - p, a, b, 1e-15);
        // (a root at the grid's left end is u = 0 itself, handled below)
        if (u > 1e-9 * U && !out.some((e) => Math.abs(e.u - u) < 1e-9 * U)) out.push({ u });
      }
    }
    for (const e of out) {
      const s = m.dP(e.u);
      e.stab = Math.abs(s) < 1e-9 ? "fold" : s < 0 ? "stable" : "unstable";
      e.fp = m.df(e.u);
    }
    // u = 0
    if (m.lin) { const fp = m.r - p; out.push({ u: 0, stab: fp > 0 ? "unstable" : "stable", fp, slow: fp === 0 }); }
    else if (m.th > 0) {
      if (m.th > 1) out.push({ u: 0, stab: "unstable", fp: 1 });
      else if (m.th === 1) { const fp = 1 - p; out.push({ u: 0, stab: fp > 0 ? "unstable" : "stable", fp, slow: fp === 0 }); }
      else out.push({ u: 0, stab: "stable", fp: -Infinity });
    }
    if (m.absorbing && !out.some((e) => e.u === 0)) out.push({ u: 0, stab: "absorbing", fp: null }); // θ = 0
    return out.sort((x, y) => x.u - y.u);
  }
  // collapse / recovery thresholds
  function thresholds(m, F = folds(m)) {
    if (m.lin) return { pc: m.r, pr: m.r, kind: "smooth", ufold: null };
    if (m.th === 1) {
      if (m.k > 1) return { pc: ((m.k + 1) * (m.k + 1)) / (4 * m.k), pr: 1, kind: "tip-hyst", ufold: (m.k - 1) / 2 };
      return { pc: 1, pr: 1, kind: "smooth", ufold: null };
    }
    const maxes = F.filter((x) => x.kind === "max");
    if (m.th > 1) {
      if (!maxes.length) return { pc: null, pr: null, kind: "smooth-refuge", ufold: null };
      const top = maxes[maxes.length - 1], mins = F.filter((x) => x.kind === "min" && x.u < top.u);
      return { pc: top.p, pr: mins.length ? mins[mins.length - 1].p : null, kind: "tip-refuge", ufold: top.u };
    }
    if (!maxes.length) return { pc: null, pr: null, kind: "smooth", ufold: null };
    const top = maxes[maxes.length - 1];
    return { pc: top.p, pr: null, kind: "tip-permanent", ufold: top.u };
  }
  // a run from u0 for tmax (non-autonomous with pOf(t) for the ramp)
  function run(m, u0, tmax, opts = {}) {
    const U = m.U, pOf = opts.pOf;
    const absorbing = pOf ? !m.lin && m.th < 1 : m.absorbing;
    const rhs = (t, y, d) => { d[0] = m.f(y[0], pOf ? pOf(t) : m.p); };
    const o = { rtol: 1e-8, atol: 1e-10 * U, samples: opts.samples || 400, nonneg: true, hmax: opts.hmax || tmax / 50, maxSteps: 400000 };
    if (absorbing) o.stop = (t, y) => y[0] < 1e-9 * U;
    else if (opts.floor) o.floor = opts.floor;
    const res = ODE.solve(rhs, [u0], 0, tmax, o);
    const us = res.y[0];
    let extinctAt = null;
    if (res.status === "stopped") { extinctAt = res.tEnd; for (let i = res.n; i < us.length; i++) us[i] = 0; if (res.n > 0) us[res.n - 1] = Math.min(us[res.n - 1], 1e-9 * U); res.n = us.length; }
    return { t: res.t, u: us, extinctAt, status: res.status === "stopped" ? "ok" : res.status, end: us[us.length - 1] };
  }
  // the slow ramp of the harvest: up to pHi over T/2, back down to 0
  function rampHigh(m, th, pMax) {
    let v;
    if (m.lin) v = 1.3 * m.r;
    else if (m.th === 1) v = 1.3 * Math.max(1, th.pc);
    else if (m.th > 1) v = th.pc != null ? 1.3 * th.pc : Math.min(20, m.P(0.05 * m.k));
    else v = 1.3 * (th.pc != null ? th.pc : 1);
    return Math.min(v, pMax);
  }
  function ramp(m, T, pMax, floorShare = 1e-6) {
    const th = thresholds(m), pHi = rampHigh(m, th, pMax), U = m.U;
    const pOf = (t) => (t <= T / 2 ? (pHi * 2 * t) / T : (pHi * 2 * (T - t)) / T);
    const r = run(m, 0.999 * U, T, { pOf, samples: 1200, hmax: T / 2000, floor: floorShare * U });
    let crash = null, recovery = null;
    if (th.ufold != null && th.kind !== "smooth" && th.kind !== "smooth-refuge") {
      for (let i = 0; i < r.t.length; i++) {
        const t = r.t[i], u = r.u[i], pp = pOf(t);
        if (!crash && th.pc != null && t <= T / 2 + 1e-9 && pp >= th.pc && u < 0.5 * th.ufold) crash = { t, p: pp };
        else if (!crash && th.pc != null && t > T / 2 && u < 0.5 * th.ufold && pOf(T / 2) >= th.pc) crash = { t, p: pp };
        if (crash && !recovery && t > T / 2 && u > th.ufold) recovery = { t, p: pp };
      }
    }
    return { t: r.t, u: r.u, p: Array.from(r.t, pOf), pHi, crash, recovery, th, T, extinctAt: r.extinctAt };
  }

  const M = { model, folds, equilibria, thresholds, run, ramp, rampHigh, grid, typeName };
  (G.WQ = G.WQ || {}).Harvest = M;
  if (typeof document === "undefined") return; // (in node: the maths only)

  /* ================================================================ 2. page */
  const Sim = G.WQ.Sim, C = G.WQ.Plot.COLORS, $ = (id) => document.getElementById(id);
  const { fmt, fmtSig, signed, hi, dim, warn, why } = Sim;
  const DEFAULTS = {
    theta: { k: 1.8, h: 0.8, theta: 1, s0: 0.9, tmax: 100 },
    linear: { r: 1.5, h0: 1.0, s0: 0.9, tmax: 100 },
  };
  const PRESETS = {
    theta: [
      { label: "θ = 1 · Type II (README)", values: { k: 1.8, h: 0.8, theta: 1 } },
      { label: "θ = 1 · bistable", values: { k: 1.8, h: 1.05, theta: 1 } },
      { label: "θ = 1 · no fold (k 0.5)", values: { k: 0.5, h: 0.8, theta: 1 } },
      { label: "θ = 0 · Type 0 (constant)", values: { k: 10, h: 4, theta: 0 } },
      { label: "θ = 2 · Type III (README)", values: { k: 5, h: 1.5, theta: 2 } },
      { label: "θ = 2 · bistable", values: { k: 10, h: 2.2, theta: 2 } },
      { label: "θ = 5 · steep", values: { k: 20, h: 3, theta: 5 } },
      { label: "θ = 0.5 · extinction possible", values: { k: 10, h: 1, theta: 0.5 } },
    ],
    linear: [{ label: "maximum yield: h₀ = r_m/2", values: { r: 1.5, h0: 0.75 } }, { label: "h₀ = r_m (threshold)", values: { r: 1.5, h0: 1.5 } }, { label: "collapse: h₀ 2", values: { r: 1.5, h0: 2 } }],
  };
  const SLIDERS = { r: ["linear"], h0: ["linear"], k: ["theta"], h: ["theta"], theta: ["theta"], s0: ["theta", "linear"], tmax: ["theta", "linear"] };
  const IDS = { r: "rm", h0: "h0", k: "k", h: "h", theta: "theta", s0: "s0", tmax: "tmax" };
  const PMAX = { theta: 20, linear: 4 }; // the harvest sliders' maxima
  const FAN = [0.05, 0.15, 0.3, 0.5, 0.7, 0.9, 1.1, 1.4];
  const RAMP_PLAY_S = 12;
  const FORMS = {
    theta: '<span class="m"><i>dy</i>/<i>dt</i>′ = <i>y</i>(1 − <i>y</i>/<i>k</i>) − <i>h y</i><sup><i>θ</i></sup>/(1 + <i>y</i><sup><i>θ</i></sup>)</span>, with <span class="m"><i>y</i> = <i>N</i>/<i>N</i><sub>0</sub></span>, <span class="m"><i>k</i> = <i>K</i>/<i>N</i><sub>0</sub></span>: <span class="m"><i>θ</i> = 0</span> is a constant catch <span class="m"><i>h</i>/2</span> (Type 0), <span class="m"><i>θ</i> = 1</span> Holling type II, <span class="m"><i>θ</i> &gt; 1</span> type III.',
    linear: '<span class="m"><i>dx</i>/<i>dt</i> = <i>r</i><sub>m</sub><i>x</i>(1 − <i>x</i>) − <i>h</i><sub>0</sub><i>x</i></span>, with <span class="m"><i>x</i> = <i>N</i>/<i>K</i></span> and <span class="m"><i>h</i><sub>0</sub></span> the share taken per unit time.',
  };

  const state = { mode: "theta", v: JSON.parse(JSON.stringify(DEFAULTS)), T: 800 };
  const V = () => state.v[state.mode];
  let m, F, TH, EQ, mainRun = null, fan = null, rampRes = null, sliders = {}, plots = {}, loop, playhead = 1, playing = false;

  const uName = () => (m.lin ? "x" : "y"), pName = () => (m.lin ? "h_0" : "h"), tName = () => (m.lin ? "t" : "t′");
  const params = () => { const v = V(); return { r: v.r, h0: v.h0, k: v.k, h: v.h, theta: v.theta }; };

  function recompute() {
    m = model(state.mode, params()); F = folds(m); TH = thresholds(m, F); EQ = equilibria(m, F);
    mainRun = run(m, V().s0 * m.U, V().tmax);
  }
  const heavy = Sim.debounce(() => {
    const U = m.U, v = V();
    fan = FAN.map((s) => ({ s, r: run(m, s * U, v.tmax, { samples: 300 }) }));
    rampRes = ramp(m, state.T, PMAX[state.mode]);
    loop.want("heavy");
  }, 200);

  /* ---------------------------------------------------- helpers */
  const stableStates = () => EQ.filter((e) => e.stab === "stable" || e.stab === "absorbing");
  const pct = (u) => `${Math.round((100 * u) / m.U)}% of K`;
  // where a run ends: in one dimension a run moves monotonically to the next equilibrium in the
  // direction f(u) points, so the destination follows from the last value and the sign of f there
  function destination(end) {
    const fv = m.f(end), all = EQ.filter((e) => e.stab !== "absorbing" || e.u === 0);
    if (Math.abs(fv) < 1e-12 * Math.max(1, m.U)) { let b = null; for (const e of all) if (!b || Math.abs(e.u - end) < Math.abs(b.u - end)) b = e; return b; }
    if (fv > 0) { const up = all.filter((e) => e.u > end); return up.length ? up[0] : null; }
    const down = all.filter((e) => e.u < end); return down.length ? down[down.length - 1] : { u: 0, stab: "absorbing" };
  }
  function endLabel(r) {
    if (r.u[0] === 0) return { text: "stays at 0 (no population)", eq: 0, colour: C.pink };
    if (r.extinctAt != null) return { text: `extinct at ${tName()} = ${fmt(r.extinctAt, 2)}`, eq: 0, colour: C.pink };
    const end = r.end, d = destination(end);
    if (!d) return { text: `→ ${fmtSig(end, 4)} (still moving)`, eq: null, colour: "rgba(246,244,236,0.5)", moving: true, slow: true };
    const gap = Math.abs(d.u - end), slow = gap > 1e-3 * m.U, far = gap > 0.02 * m.U;
    if (far) return { text: `→ ${fmtSig(end, 4)} (still moving)`, eq: d.u, colour: "rgba(246,244,236,0.5)", moving: true, slow, dest: d };
    if (d.u === 0) return { text: "→ 0 (collapse)", eq: 0, colour: C.pink, slow, dest: d };
    const pos = stableStates().filter((e) => e.u > 0), top = pos[pos.length - 1];
    return { text: `→ ${fmtSig(d.u, 4)}`, eq: d.u, colour: d === top ? C.yellow : C.blue, slow, dest: d };
  }
  function pRange() {
    if (m.lin) return Math.max(1.4 * m.r, 1.2 * m.p, 0.5);
    const fp = F.length ? Math.max(...F.map((x) => x.p)) : 0;
    const v = Math.max(1.4 * fp, 1.2 * m.p, 1.5, TH.pc ? 1.2 * TH.pc : 0);
    return Math.min(PMAX[state.mode], v);
  }

  /* ---------------------------------------------------- A. growth vs harvest */
  function drawCurves() {
    const p = plots.curves, U = m.U, n = 400, us = [], gs = [], hs = [];
    for (let i = 0; i <= n; i++) { const u = (1.05 * U * i) / n; us.push(u); gs.push(m.g(u)); hs.push(u === 0 ? (!m.lin && m.th === 0 && m.p > 0 ? m.p / 2 : 0) : m.p * m.phi(u)); }
    const all = gs.concat(hs), lo = Math.min(0, ...all), top = Math.max(...all, 1e-6);
    p.set({ x: [0, 1.05 * U], y: [lo - 0.05 * (top - lo), top + 0.12 * (top - lo)], xLabel: uName(), yLabel: "rate" }).clear();
    p.hline(0, C.white, { dash: [1, 0], alpha: 0.35, width: 1 });
    p.line(us, gs, C.white, { width: 1.8 });
    p.line(us, hs, C.yellow, { width: 1.8 });
    // arrows on the axis
    const ctx = p.ctx, [, py0] = p.toPx(0, 0);
    ctx.save(); ctx.fillStyle = C.yellow;
    for (let i = 0; i < 8; i++) {
      const u = (1.05 * U * (i + 0.5)) / 8; if (EQ.some((e) => Math.abs(e.u - u) < 0.03 * U)) continue;
      const fv = m.f(u); if (fv === 0) continue;
      const dir = fv > 0 ? 1 : -1, [px] = p.toPx(u, 0);
      ctx.beginPath(); ctx.moveTo(px + 6 * dir, py0); ctx.lineTo(px - 4 * dir, py0 - 5); ctx.lineTo(px - 4 * dir, py0 + 5); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    const u0 = V().s0 * U, [sx] = p.toPx(u0, 0);
    ctx.save(); ctx.strokeStyle = C.blue; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(sx, p.area.t); ctx.lineTo(sx, p.area.b); ctx.stroke(); ctx.restore();
    for (const e of EQ) {
      if (e.stab === "absorbing") { const [ex, ey] = p.toPx(0, 0); ctx.save(); ctx.fillStyle = C.pink; ctx.fillRect(ex - 4, ey - 4, 8, 8); ctx.restore(); p.text("extinct", 0, 0, { dx: 8, dy: -8, color: C.pink }); continue; }
      p.marker(e.u, 0, e.stab === "stable" ? "stable" : e.stab === "fold" ? "saddle" : "unstable");
    }
    p.legend([{ label: "growth", color: C.white }, { label: "harvest", color: C.yellow }]);
  }
  function paramLine() {
    const v = V();
    if (m.lin) return `> Type I · r_m = ${fmt(v.r, 2)} · h_0 = ${fmt(v.h0, 2)}`;
    return `> θ model · θ = ${fmt(v.theta, 2)} (${typeName(m.th)}) · k = ${fmt(v.k)} · h = ${fmt(v.h)}`;
  }
  function eqLines() {
    const L = ["> equilibria (growth = harvest)"], u = uName();
    for (const e of EQ) {
      if (e.stab === "absorbing") { L.push([`  ${u}* = 0        `, warn("extinct: absorbing (not an equilibrium of the ODE)")]); continue; }
      const fp = e.fp === -Infinity ? "−∞" : signed(e.fp);
      L.push([`  ${Sim.pad(`${u}* = ${e.u === 0 ? "0" : fmtSig(e.u, 4)}`, 14)}f' = ${Sim.pad(fp, 8)} `, e.stab === "stable" ? hi(e.slow ? "stable (slowly)" : "stable") : e.stab]);
    }
    return L;
  }
  function curvesBox() {
    const L = [paramLine(), ...eqLines()], u = uName(), st = stableStates(), pos = st.filter((e) => e.u > 0), uns = EQ.filter((e) => e.stab === "unstable" && e.u > 0);
    const end = endLabel(mainRun), nearFold = F.some((x) => Math.abs(x.p - m.p) < 1e-4 * Math.max(1e-9, TH.pc || x.p));
    const refugeTh = !m.lin && m.th > 1;
    if (nearFold && m.p > 0) L.push(["> state: ", hi("at the tipping point (fold)")]);
    else if (st.length >= 2) {
      L.push(["> state: ", hi("bistable: the start decides")]);
      const thr = uns[uns.length - 1], top = pos[pos.length - 1], low = st[0];
      if (thr) L.push(why(`starts above the threshold ${u}* = ${fmtSig(thr.u, 4)} (open dot) go to ${fmtSig(top.u, 4)}`));
      L.push(why(`starts below it go to ${low.u === 0 ? (low.stab === "absorbing" ? "extinction" : "0") : `the low refuge ${fmtSig(low.u, 4)}`}`));
      L.push(why(`your start goes ${end.text}`));
    } else if (!pos.length) {
      if (m.absorbing || mainRun.extinctAt != null) L.push(["> state: ", hi(mainRun.extinctAt != null ? `collapse: extinct at ${tName()} = ${fmt(mainRun.extinctAt, 2)}` : "collapse: extinction")]);
      else if (refugeTh) {
        // θ > 1 always has a refuge, but here it lies below 10⁻¹²·k, where the equilibria are not searched
        L.push(["> state: ", hi("pushed down to a refuge below 10⁻¹² k: effectively extinct")]);
        L.push(why("y = 0 is never stable for θ > 1, but with θ this close to 1 and a large h the refuge is tiny"));
      } else L.push(["> state: ", hi("collapse: declines to 0")]);
      if (!refugeTh) L.push(why("harvest is above growth at every density"));
      if (m.lin && m.p === m.r) L.push(why("exactly at the threshold: the decline is very slow (x ~ 1/(r_m t))"));
    } else {
      const s = pos[pos.length - 1], lowFold = F.find((x) => x.kind === "min");
      if (V().s0 === 0) L.push(["> state: ", hi("stays at 0: no population")]);
      else if (refugeTh && s.u < (lowFold ? lowFold.u : 0.15 * m.U)) {
        L.push(["> state: ", hi(`pushed down to the low refuge ${u}* = ${fmtSig(s.u, 4)}`)]);
        L.push(why(`${u} = 0 is never stable for θ > 1: at low density the harvest (∝ y^θ) is weaker than growth (∝ y)`));
      } else {
        L.push(["> state: ", hi(`sustainable — settles at ${u}* = ${fmtSig(s.u, 4)} (${pct(s.u)})`)]);
        L.push(why("above the yellow curve the white one wins: the population rises"));
        L.push(why("it settles where harvest overtakes growth (they cross)"));
        L.push(why(`yield there ${pName()}·φ(${u}*) = ${fmtSig(m.p * m.phi(s.u), 4)}; relaxation time 1/|f'| = ${fmt(1 / Math.abs(s.fp), 2)}`));
      }
    }
    // bullets for the special cases
    if (m.lin) L.push(why(`yield h_0 x* = h_0(1 − h_0/r_m) is largest at h_0 = r_m/2: r_m/4 = ${fmtSig(m.r / 4, 4)}`));
    else if (m.th === 0) {
      const lowEq = EQ.find((e) => e.stab === "unstable" && e.u > 0);
      if (lowEq) L.push(why(`a fixed catch h/2 does not shrink when the population does: below y* = ${fmtSig(lowEq.u, 4)} it is fatal`));
      L.push(why(`the largest catch it survives is the peak growth rate k/4: h_c = k/2 = ${fmtSig(m.k / 2, 4)}`));
      L.push(why("θ = 0 is the README's Type 0 in rescaled units: c = r_m h/(2k)"));
    } else if (m.th === 1 && m.k <= 1) L.push(why("k ≤ 1: no fold; the population fades out smoothly at h = 1"));
    else if (m.th > 0 && m.th < 1) L.push(why("θ < 1: the harvest per head grows without limit as y → 0, so a small population is always harvested out"));
    if (!m.lin && m.th >= 6) L.push(why("large θ: the harvest is almost a switch at y = 1 (N = N_0)"));
    // threshold line
    const pn = pName();
    if (TH.kind === "smooth" && m.lin) L.push(`> no tipping point: x* = 1 − h_0/r_m reaches 0 at h_0 = r_m = ${fmt(m.r, 2)}`);
    else if (TH.kind === "smooth") L.push("> no tipping point: the population fades out smoothly at h = 1");
    else if (TH.kind === "smooth-refuge") L.push("> no tipping point: the population shrinks smoothly as h grows");
    else if (TH.kind === "tip-refuge") L.push(`> critical harvest ${pn}_c = ${fmtSig(TH.pc, 5)} (fold): above it, the population drops to the low refuge`);
    else L.push(`> critical harvest ${pn}_c = ${fmtSig(TH.pc, 5)} (fold): above it, collapse`);
    return L;
  }

  /* ---------------------------------------------------- B. runs from several starts */
  function drawRuns() {
    const p = plots.runs, U = m.U, v = V();
    const top = Math.max(1.05 * U * 1.4, 1.05 * v.s0 * U);
    p.set({ x: [0, v.tmax], y: [0, top], xLabel: tName(), yLabel: uName() }).clear();
    for (const e of EQ) if (e.u > 0) p.hline(e.u, C.white, { dash: e.stab === "stable" ? [6, 5] : [1.5, 4], alpha: 0.4 });
    if (fan) for (const f of fan) { const lab = endLabel(f.r); p.line(Array.from(f.r.t), Array.from(f.r.u), lab.colour, { width: 1.2, alpha: 0.9 }); }
    p.line(Array.from(mainRun.t), Array.from(mainRun.u), C.white, { width: 2.4 });
  }
  function runsBox() {
    if (!fan) return [dim("> computing…")];
    const L = ["> 8 starts (share of K) → end"], labs = fan.map((f) => ({ s: f.s, l: endLabel(f.r) }));
    // one start per line (two columns would wrap in the narrow box)
    for (const a of labs) L.push(a.l.moving ? [`  ${fmt(a.s, 2)} `, dim(a.l.text)] : `  ${fmt(a.s, 2)} ${a.l.text}`);
    const ends = new Set(labs.map((x) => (x.l.eq == null || x.l.moving ? "m" : x.l.eq.toFixed(6))));
    const uns = EQ.filter((e) => e.stab === "unstable" && e.u > 0);
    if (labs.every((x) => x.l.eq === 0 && !x.l.moving)) { L.push(`> every start ${labs.some((x) => x.l.text.startsWith("extinct")) ? "goes extinct" : "declines to 0"}`); L.push(why(!m.lin && m.th > 1 ? "they sink to a refuge below 10⁻¹² k (θ > 1 never lets y reach 0)" : "no stable state above 0 at this harvest")); }
    else if (ends.size === 1 && !ends.has("m")) {
      L.push(`> every start ends ${labs[0].l.text}`);
      if (stableStates().length <= 1 || !uns.length) L.push(why("only one stable state"));
      else L.push(why(`all eight start on the same side of the threshold ${uName()}* = ${fmtSig(uns[uns.length - 1].u, 4)}`));
    }
    else if (uns.length) L.push(`> threshold ${uName()}* = ${fmtSig(uns[uns.length - 1].u, 4)}: below it the harvest wins`);
    const me = endLabel(mainRun), s = stableStates().find((e) => e.u === me.eq);
    let line = `> your start ${fmt(V().s0, 2)} ${me.text}`;
    if (s && s.u > 0) {
      const tgt = s.u, us = mainRun.u, ts = mainRun.t; let tset = null;
      for (let i = us.length - 1; i >= 0; i--) if (Math.abs(us[i] - tgt) > 0.01 * Math.max(tgt, 1e-12)) { tset = i + 1 < us.length ? ts[i + 1] : null; break; } else if (i === 0) tset = 0;
      if (tset != null) line += `, within 1% by ${tName()} = ${fmt(tset, 2)}`;
      L.push(line);
      if (Number.isFinite(s.fp) && s.fp !== 0) L.push(why(`close to ${uName()}* the gap shrinks ×e every 1/|f'| = ${fmt(1 / Math.abs(s.fp), 2)}`));
    } else L.push(line);
    return L;
  }

  /* ---------------------------------------------------- C. bifurcation diagram */
  function drawBif(p, path) {
    const U = m.U, pa = pRange();
    p.set({ x: [0, pa], y: [0, 1.05 * U], xLabel: pName(), yLabel: uName() }).clear();
    // the branch (u, P(u)), split by stability, only where P is inside the plot
    const us = m.lin ? Array.from({ length: 1200 }, (_, i) => (U * (i + 1)) / 1200) : grid(m, 300, 900);
    let seg = { xs: [], ys: [], st: null };
    const flush = () => { if (seg.xs.length > 1) p.line(seg.xs, seg.ys, C.white, { width: 1.8, dash: seg.st ? null : [5, 4] }); };
    for (const u of us) {
      const P = m.P(u), st = m.dP(u) < 0;
      if (!(P <= 1.5 * pa) || !Number.isFinite(P)) { flush(); seg = { xs: [], ys: [], st: null }; continue; }
      if (seg.st !== null && st !== seg.st) { const lx = seg.xs[seg.xs.length - 1], ly = seg.ys[seg.ys.length - 1]; flush(); seg = { xs: [lx], ys: [ly], st }; }
      seg.st = st; seg.xs.push(P); seg.ys.push(u);
    }
    flush();
    // the u = 0 line
    const zero = (x0, x1, kind) => { if (x1 <= x0) return; if (kind === "absorbing") p.line([x0, x1], [0, 0], C.pink, { width: 2, dash: [1.5, 4] }); else p.line([x0, x1], [0, 0], C.white, { width: 2.2, dash: kind === "stable" ? null : [5, 4] }); };
    if (m.lin) { zero(0, Math.min(pa, m.r), "unstable"); zero(m.r, pa, "stable"); }
    else if (m.th > 1) zero(0, pa, "unstable");
    else if (m.th === 1) { zero(0, Math.min(pa, 1), "unstable"); zero(1, pa, "stable"); }
    else zero(0, pa, "absorbing"); // 0 ≤ θ < 1: extinction is reached in finite time
    // the threshold lines; their labels on two rows so they never overlap
    const yTop = 1.05 * U, tag = (x, text, colour, dy) => { if (x > pa) return; const right = x < 0.75 * pa; p.text(text, x, yTop, { dx: right ? 5 : -5, dy, align: right ? "left" : "right", color: colour }); };
    if (TH.pc != null && TH.kind !== "smooth") { p.vline(TH.pc, C.pink, { dash: [4, 3], alpha: 0.8 }); tag(TH.pc, "collapse", C.pink, 30); }
    if (TH.pr != null && TH.kind !== "smooth") { p.vline(TH.pr, C.blue, { dash: [4, 3], alpha: 0.8 }); tag(TH.pr, "recovery", C.blue, 46); }
    if (path) {
      const pts = Math.max(2, Math.round(path.t.length * playhead));
      p.line(path.p.slice(0, pts), Array.from(path.u.slice(0, pts)), C.orange, { width: 2 });
      p.marker(path.p[pts - 1], path.u[pts - 1], "stable", { color: C.orange, r: 4 });
    } else {
      p.vline(m.p, C.yellow, { label: `${pName()} = ${fmtSig(m.p, 4)}` });
      for (const e of EQ) if (e.stab !== "absorbing") p.marker(m.p, e.u, e.stab === "stable" ? "stable" : "unstable", { r: 4 });
    }
    if (!m.lin && m.th < 1) p.text("extinct (absorbing)", pa * 0.98, 0, { align: "right", dy: -6, color: C.pink });
  }
  function bifBox() {
    const L = [], pn = pName(), u = uName();
    if (m.lin) L.push(`> no fold: x* = 1 − h_0/r_m reaches 0 at h_0 = r_m = ${fmt(m.r, 2)} (transcritical)`);
    else if (m.th === 1 && m.k > 1) {
      L.push(`> collapse at h_c = (k+1)²/(4k) = ${fmtSig(TH.pc, 5)} (fold)`);
      L.push("> recovery only below h = 1 (y = 0 stops being stable)");
      L.push(`> hysteresis: for 1 < h < ${fmtSig(TH.pc, 5)} two stable states`);
    } else if (m.th === 1) L.push("> no fold (k ≤ 1): y* reaches 0 at h = 1 (transcritical)");
    else if (m.th > 1 && TH.pc != null) L.push(`> collapse to the refuge at h = ${fmtSig(TH.pc, 5)}, recovery below h = ${fmtSig(TH.pr, 5)}`);
    else if (m.th > 1) { L.push("> no fold for this k and θ: the population shrinks smoothly"); if (m.th === 2) L.push(why("a fold needs k > 3√3 ≈ 5.196")); }
    else if (m.th === 0) L.push(`> collapse at h_c = k/2 = ${fmtSig(TH.pc, 5)} (the README's c_c = r_m/4); extinction is permanent (absorbing)`);
    else L.push(`> collapse at h = ${fmtSig(TH.pc, 5)}; extinction is permanent`);
    const stPos = EQ.filter((e) => e.stab === "stable");
    L.push(`> now ${pn} = ${fmtSig(m.p, 4)} → ${stPos.length === 0 ? "no stable state above 0" : stPos.length === 1 ? `one stable state ${u}* = ${fmtSig(stPos[0].u, 4)}` : `${stPos.length} stable states: ${stPos.map((e) => fmtSig(e.u, 4)).join(", ")}`}`);
    L.push(why(`solid = stable (the branch falls as ${u} grows), dashed = unstable`));
    if (TH.kind.startsWith("tip")) L.push(why("at the fold the stable and unstable branches meet and vanish (a saddle-node bifurcation): the population has nowhere to settle"));
    return L;
  }

  /* ---------------------------------------------------- D. the ramp */
  function drawRamp() {
    if (!rampRes) { plots.rpath.clear(); plots.rtime.clear(); return; }
    drawBif(plots.rpath, rampRes);
    const p = plots.rtime, R = rampRes, U = m.U, n = Math.max(2, Math.round(R.t.length * playhead));
    p.set({ x: [0, R.T], y: [0, 1.08 * U], xLabel: tName(), yLabel: uName() }).clear();
    const scale = R.pHi > 0 ? U / R.pHi : 0;
    p.line(Array.from(R.t), R.p.map((x) => x * scale), C.yellow, { width: 1.2, dash: [5, 4], alpha: 0.8 });
    p.line(Array.from(R.t.slice(0, n)), Array.from(R.u.slice(0, n)), C.white, { width: 1.8 });
    if (playhead < 1) p.vline(R.t[n - 1], C.orange, { width: 1.2 });
    p.legend([{ label: uName(), color: C.white }, { label: `${pName().replace("_0", "₀")} (scaled)`, color: C.yellow }]);
  }
  function rampBox() {
    if (!rampRes) return [dim("> computing…")];
    const R = rampRes, pn = pName(), L = [`> ramp: ${pn} rises 0 → ${fmtSig(R.pHi, 4)} over ${tName()} = ${fmt(R.T / 2, 0)}, then back to 0`];
    const k = TH.kind;
    if (k === "smooth" && m.lin) { L.push("> no tipping point: x* slides to 0 at h_0 = r_m and comes back as h_0 falls"); L.push(why("near h_0 = r_m it follows slowly: critical slowing down")); return L; }
    if (k === "smooth") { L.push("> no tipping point: it fades out at h = 1 and comes back as h falls"); L.push(why("near h = 1 it follows slowly: critical slowing down")); return L; }
    if (k === "smooth-refuge") { L.push("> no tipping point: it shrinks and recovers smoothly"); return L; }
    if (!R.crash) { L.push(warn("> no crash within the ramp: try a longer T")); return L; }
    if (k === "tip-permanent") {
      L.push(`> crash at ${pn} ≈ ${fmtSig(R.crash.p, 4)} (fold ${pn}_c = ${fmtSig(TH.pc, 5)})`);
      L.push(why(`it crashes a little after ${pn}_c: the population lags the moving equilibrium, and near the fold it responds slowly (critical slowing down)`));
      L.push(["> ", hi(`extinct: no recovery even at ${pn} = 0`)]);
      L.push(why("extinction is permanent: nobody is left to regrow"));
      return L;
    }
    L.push(`> ${k === "tip-refuge" ? "crash to the refuge" : "crash"} at ${pn} ≈ ${fmtSig(R.crash.p, 4)} (fold ${pn}_c = ${fmtSig(TH.pc, 5)})`);
    L.push(why(`it crashes a little after ${pn}_c: the population lags the moving equilibrium, and near the fold it responds slowly (critical slowing down)`));
    if (R.recovery) {
      L.push(`> recovery at ${pn} ≈ ${fmtSig(R.recovery.p, 4)} (${k === "tip-refuge" ? `lower fold ${fmtSig(TH.pr, 5)}` : "y = 0 turns unstable at h = 1"})`);
      L.push(why(k === "tip-refuge" ? "below the lower fold the refuge vanishes and the population jumps back up, after a lag" : "well below 1: from a tiny remnant (10⁻⁶ K) regrowth is slow, rate 1 − h"));
      L.push(["> ", hi("hysteresis: it collapses and recovers at different " + pn)]);
    } else L.push(warn("> no recovery before the ramp ended: try a longer T"));
    return L;
  }

  /* ---------------------------------------------------- runtime checks (?check=1) */
  function runChecks(boxes) {
    const ck = Sim.check, U = m.U, scale = Math.max(1, U);
    for (const e of EQ) {
      if (e.stab === "absorbing") continue;
      ck("equilibrium f(u*) = 0", Math.abs(m.f(e.u)) < 1e-9 * scale, `u ${e.u} f ${m.f(e.u)}`);
      if (e.u > 0 && e.stab !== "fold") {
        const h = 1e-7 * Math.max(e.u, 1e-6), fd = (m.f(e.u + h) - m.f(Math.max(e.u - h, 1e-300))) / (2 * h);
        if (Math.abs(fd) > 1e-6) ck("stability label = sign of f'", (fd < 0) === (e.stab === "stable"), `u ${e.u} f' ${fd} ${e.stab}`);
      }
    }
    if (!m.lin && m.th === 1 && m.k > 1 && F.length) ck("Type II fold = (k+1)²/(4k)", Math.abs(F[0].p - ((m.k + 1) ** 2) / (4 * m.k)) < 1e-6 && Math.abs(F[0].u - (m.k - 1) / 2) < 1e-6, JSON.stringify(F[0]));
    if (!m.lin && m.th === 0 && F.length) ck("θ = 0 fold = (k/2, k/2)", Math.abs(F[0].u - m.k / 2) < 1e-6 && Math.abs(F[0].p - m.k / 2) < 1e-6, JSON.stringify(F[0]));
    if (m.p > 0 && !F.some((x) => Math.abs(x.p - m.p) < 1e-3)) {
      // 20 000 linear points over (0, U], plus 2000 log-spaced from 1e-12·U (θ just above 1 puts the refuge very close to 0)
      const pts = []; for (let i = 0; i < 2000; i++) pts.push(U * 1e-12 * Math.pow(1e10, i / 1999)); for (let i = 1; i <= 20000; i++) { const u = (U * i) / 20000; if (u > pts[pts.length - 1]) pts.push(u); }
      let sc = 0, prev = m.f(pts[0]);
      for (let i = 1; i < pts.length; i++) { const cur = m.f(pts[i]); if (prev !== 0 && cur !== 0 && prev * cur < 0) sc++; if (cur !== 0) prev = cur; }
      const pos = EQ.filter((e) => e.u > 0).length;
      ck("number of positive equilibria = sign changes of f", sc === pos, `${sc} vs ${pos}`);
    }
    if (fan) for (const f of fan) {
      // ends within 1e-3·U of a stable state, or extinct, or slow: allowed only if t_max < 20·τ of where it goes
      const lab = endLabel(f.r), d = lab.dest, tau = d && Number.isFinite(d.fp) && d.fp !== 0 ? 1 / Math.abs(d.fp) : Infinity;
      // a run far from where it goes may still be crossing a slow stretch (the "ghost" of a vanished fold):
      // then it must at least move monotonically towards its destination without passing it
      let mono = !!d;
      if (d) { const us = f.r.u, dir = Math.sign(d.u - us[0]), tol = 1e-9 * U; for (let i = 1; i < us.length && mono; i++) if (dir * (us[i] - us[i - 1]) < -tol || dir * (us[i] - d.u) > tol) mono = false; }
      if (lab.slow) ck("runs end at a stable state (or move slowly)", V().tmax < 20 * tau || EQ.some((e) => e.stab === "fold") || (d && d.slow) || mono, `start ${f.s} end ${f.r.end} τ ${tau}`);
      const tinyRefuge = !m.lin && m.th > 1 && lab.dest && lab.dest.u === 0; // the refuge is below 1e-12·k
      if (lab.dest && !lab.slow) ck("runs end at a stable state", lab.dest.stab === "stable" || lab.dest.stab === "absorbing" || lab.dest.stab === "fold" || tinyRefuge, `start ${f.s} → ${lab.dest.u} ${lab.dest.stab}`);
    }
    if (rampRes) {
      if (rampRes.crash && TH.pc != null) ck("ramp crash after the critical value", rampRes.crash.p >= TH.pc - 1e-9 || rampRes.crash.t > rampRes.T / 2, JSON.stringify(rampRes.crash));
      if (rampRes.recovery && TH.pr != null) ck("ramp recovery below the recovery value", rampRes.recovery.p <= TH.pr + 1e-9, JSON.stringify(rampRes.recovery));
    }
    const text = boxes.map((b) => b.textContent).join(" ");
    ck("boxes are finite", !/NaN|Infinity|undefined|\bnull\b/.test(text), text.slice(0, 120));
  }

  /* ---------------------------------------------------- wiring */
  const boxes = () => ["term-curves", "term-runs", "term-bif", "term-ramp"].map($);
  const writeBoxes = Sim.throttle(() => {
    Sim.term($("term-curves"), curvesBox()); Sim.term($("term-runs"), runsBox()); Sim.term($("term-bif"), bifBox()); Sim.term($("term-ramp"), rampBox());
    if (Sim.checking) runChecks(boxes());
  }, 150);
  function render(dirty) {
    if (dirty.has("data")) { recompute(); fan = null; rampRes = null; playhead = 1; playing = false; $("ramp-play").textContent = "Play"; heavy(); }
    drawCurves(); drawRuns(); drawBif(plots.bif, null); drawRamp();
    writeBoxes();
  }
  function showMode() {
    const mode = state.mode, v = V();
    for (const [key, modes] of Object.entries(SLIDERS)) $(IDS[key]).closest("label").hidden = !modes.includes(mode);
    for (const key of Object.keys(SLIDERS)) if (SLIDERS[key].includes(mode) && v[key] != null) sliders[key].set(v[key], { silent: true });
    $("type-form").innerHTML = FORMS[mode];
    $("tmax-name").innerHTML = mode === "linear" ? '<span class="m"><i>t</i><sub>max</sub></span>' : '<span class="m"><i>t</i>′<sub>max</sub></span>';
    Sim.presets($("presets"), PRESETS[mode], (vals) => { for (const [key, x] of Object.entries(vals)) { sliders[key].set(x, { silent: true }); V()[key] = sliders[key].get(); } loop.want("data"); });
    loop.want("data");
  }
  function tick(t0, ph0) {
    return (now) => {
      if (!playing) return;
      const dur = Sim.reduced ? 0 : RAMP_PLAY_S * 1000;
      playhead = dur ? Math.min(1, ph0 + (now - t0) / dur) : 1;
      drawRamp();
      if (playhead >= 1) { playing = false; $("ramp-play").textContent = "Play"; return; }
      G.requestAnimationFrame(tick(t0, ph0));
    };
  }
  function start() {
    if (!$("cv-curves") || !$("term-ramp")) return;
    plots.curves = G.WQ.Plot.create($("cv-curves"), { pad: { l: 58 } });
    plots.runs = G.WQ.Plot.create($("cv-runs"), {});
    plots.bif = G.WQ.Plot.create($("cv-bif"), {});
    plots.rpath = G.WQ.Plot.create($("cv-ramp-path"), {});
    plots.rtime = G.WQ.Plot.create($("cv-ramp-time"), {});
    loop = Sim.loop(render);
    Object.values(plots).forEach((p) => p.onResize(() => loop.want("draw")));
    const f2 = (v) => fmt(v, 2), f3 = (v) => fmt(v, 3);
    const fm = { r: f2, h0: f2, k: f2, h: f3, theta: f2, s0: f2, tmax: (v) => String(Math.round(v)) };
    for (const key of Object.keys(SLIDERS)) sliders[key] = Sim.slider(IDS[key], { fmt: fm[key], onInput: (v) => { V()[key] = v; loop.want("data"); } });
    sliders.T = Sim.slider("ramp-T", { fmt: (v) => String(Math.round(v)), onInput: (v) => { state.T = v; loop.want("data"); } });
    Sim.seg($("type"), (v) => { state.mode = v; showMode(); });
    $("ramp-play").addEventListener("click", () => {
      if (!rampRes) return;
      if (playing) { playing = false; $("ramp-play").textContent = "Play"; return; }
      if (playhead >= 1) playhead = 0;
      playing = true; $("ramp-play").textContent = "Pause";
      const ph0 = playhead; G.requestAnimationFrame((now) => tick(now, ph0)(now));
    });
    $("ramp-reset").addEventListener("click", () => { playing = false; playhead = 0; $("ramp-play").textContent = "Play"; drawRamp(); });
    showMode();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})(typeof window !== "undefined" ? window : globalThis);
