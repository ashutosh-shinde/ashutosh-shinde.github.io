// test-prey-predator.mjs — checks the maths of card 6 (js/sims/prey-predator.js) against known values and
// edge cases (plan: tools/plans/pd-06-prey-predator.md, section 8). Run: node tools/test-prey-predator.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const load = (rel, ctx) => vm.runInContext(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8"), ctx);
const ctx = vm.createContext({ Math, Float64Array, Number, Array, Object, String, ArrayBuffer, Date, console, URLSearchParams, JSON, Set });
ctx.globalThis = ctx;
load("../js/lib/ode.js", ctx); load("../js/lib/simkit.js", ctx); load("../js/sims/prey-predator.js", ctx);
const PP = ctx.WQ.PP;

let fails = 0;
const ok = (cond, what) => { console.log((cond ? "  ok   " : "  FAIL ") + what); if (!cond) fails++; };
const near = (a, b, tol) => a != null && Number.isFinite(a) && Math.abs(a - b) <= tol;
const eq = (p, n) => PP.equilibria(p).find((e) => e.name === n);
const show = (e) => (e ? `${e.name} (${e.N.toFixed(4)}, ${e.P.toFixed(4)}) ${e.type} [${e.eig.re1.toFixed(5)}${e.eig.complex ? ` ± ${Math.abs(e.eig.im1).toFixed(5)}i` : `, ${e.eig.re2.toFixed(5)}`}]` : "none");
const LV = (r, b, g, d) => ({ model: "LV", r, b, g, d });
const Vt = (K, o = {}) => Object.assign({ model: "Vt", r: 1, b: 0.5, g: 0.5, d: 1, K }, o);
const RM = (K) => ({ model: "RM", r: 1, b: 2, N0: 10, g: 0.8, d: 0.5, K });

// LV
let p = LV(1, 1, 1, 1), e1 = eq(p, "e1"), e0 = eq(p, "e0");
ok(near(e1.N, 1, 1e-12) && near(e1.P, 1, 1e-12) && e1.eig.complex && near(Math.abs(e1.eig.im1), 1, 1e-12) && e1.type === "center" && e0.type === "saddle" && near(e0.eig.re1, -1, 1e-12) && near(e0.eig.re2, 1, 1e-12)
  && near((2 * Math.PI) / Math.sqrt(p.r * p.d), 6.2832, 1e-4), `LV 1,1,1,1: ${show(e1)}; ${show(e0)}`);
let R = PP.run(p, [0.5, 0.5], 50), m = PP.measures(R), V0 = PP.V(p, 0.5, 0.5), V1 = PP.V(p, R.N[R.n - 1], R.P[R.n - 1]);
const pk = m.peaksN.map((x) => x.t), pkP = m.peaksP.map((x) => x.t);
ok(near(V0, 2.386294, 1e-6) && near(V1, 2.386294, 1e-6) && [2.79, 9.49, 16.18, 22.88].every((v, i) => near(pk[i], v, 0.02)) && near(m.period, 6.69, 0.02)
  && near(pkP[0], 3.90, 0.02) && near(pkP[1], 10.59, 0.02) && near(m.min, 0.3574, 1e-3) && near(m.max, 2.1533, 1e-3),
  `LV from (0.5, 0.5): V ${V0.toFixed(6)} → ${V1.toFixed(6)}; prey peaks ${pk.slice(0, 4).map((v) => v.toFixed(3))}; period ${m.period?.toFixed(3)}; predator peaks ${pkP.slice(0, 2).map((v) => v.toFixed(3))}; range ${m.min?.toFixed(4)} – ${m.max?.toFixed(4)}; lag ${m.lag?.toFixed(3)}`);
p = LV(1.5, 0.5, 0.8, 1.2); e1 = eq(p, "e1");
ok(near(e1.N, 3, 1e-12) && near(e1.P, 3, 1e-12) && near((2 * Math.PI) / Math.sqrt(p.r * p.d), 4.6832, 1e-4), `LV README 2: ${show(e1)}`);
// huge LV cycle: V conserved
p = LV(1, 1, 1, 1); R = PP.run(p, [100, 100], 50); V0 = PP.V(p, 100, 100);
let worst = 0; for (let i = 0; i < R.n; i++) worst = Math.max(worst, Math.abs(PP.Vat(p, R, i) - V0));
ok(worst / PP.Vscale(p, 100, 100) < 1e-6 && R.status === "ok", `LV from (100, 100): relative V drift ${(worst / V0).toExponential(2)}, status ${R.status}`);

// Volterra
p = Vt(10); let e2 = eq(p, "e2"); e1 = eq(p, "e1");
ok(near(e2.N, 4, 1e-12) && near(e2.P, 1.2, 1e-12) && near(e2.eig.tr, -0.4, 1e-12) && near(e2.eig.det, 0.6, 1e-12) && near(e2.eig.re1, -0.2, 1e-9) && near(Math.abs(e2.eig.im1), 0.74833, 1e-5) && e2.type === "stable spiral"
  && e1.type === "saddle" && near(e1.eig.re1, -1, 1e-12) && near(e1.eig.re2, 1.5, 1e-12), `Vt README 1: ${show(e2)}; ${show(e1)}`);
p = Vt(1.5); e1 = eq(p, "e1");
ok(!eq(p, "e2") && e1.type === "stable node" && near(e1.eig.re1, -1, 1e-12) && near(e1.eig.re2, -0.625, 1e-12), `Vt K 1.5: ${show(e1)}`);
const a = eq(Vt(4.2), "e2"), b5 = eq(Vt(5), "e2"), c6 = eq(Vt(6), "e2");
ok(a.type === "stable node" && near(a.eig.re1, -0.89944, 1e-5) && near(a.eig.re2, -0.05294, 1e-5) && b5.type === "stable spiral" && near(b5.eig.re1, -0.4, 1e-9) && near(Math.abs(b5.eig.im1), 0.2, 1e-9)
  && c6.type === "stable spiral" && near(c6.eig.re1, -0.33333, 1e-5) && near(Math.abs(c6.eig.im1), 0.4714, 1e-4), `Vt K 4.2 / 5 / 6: ${show(a)}; ${show(b5)}; ${show(c6)}`);

// Rosenzweig–MacArthur
p = RM(60);
ok(near(PP.Nstar(p), 4.545455, 1e-6) && near(PP.KH(p), 19.090909, 1e-6), `RM base: N* ${PP.Nstar(p).toFixed(6)}, K_H ${PP.KH(p).toFixed(6)}`);
p = RM(2); e1 = eq(p, "e1");
ok(e1.type === "stable node" && near(e1.eig.re1, -1, 1e-12) && near(e1.eig.re2, -0.23333, 1e-5) && !eq(p, "e2"), `RM K 2: ${show(e1)}`);
const st = [15, 18, 19].map((K) => eq(RM(K), "e2"));
ok(st.every((e) => e.type === "stable spiral") && near(st[0].eig.re1, -0.04261, 1e-5) && near(st[1].eig.re1, -0.00947, 1e-5) && near(st[2].eig.re1, -0.00075, 1e-5), `RM K 15 / 18 / 19: ${st.map(show).join("; ")}`);
const un = [19.5, 30, 60].map((K) => eq(RM(K), "e2"));
ok(un.every((e) => e.type === "unstable spiral") && near(un[0].eig.re1, 0.00328, 1e-5) && near(un[1].eig.re1, 0.05682, 1e-5) && near(un[2].eig.re1, 0.10653, 1e-5), `RM K 19.5 / 30 / 60: ${un.map(show).join("; ")}`);
const rr = (x, y) => Math.abs(x - y) <= 0.02 * Math.abs(y);
const cyc = [19.5, 30, 60].map((K) => PP.limitCycle(RM(K)));
ok(rr(cyc[0].Nmin, 2.879) && rr(cyc[0].Nmax, 6.757) && rr(cyc[1].Nmin, 0.145) && rr(cyc[1].Nmax, 22.97) && cyc[2].Nmin < 0.0002 && rr(cyc[2].Nmax, 57.98),
  `RM cycles: ${cyc.map((c) => `${c.Nmin.toPrecision(4)} – ${c.Nmax.toPrecision(4)}`).join(" / ")}`);
// slow RM cycles (checked against long scipy runs): a period of 783 with the prey down to e^−425; and a corner
// (r 0.1, δ 0.05) where orbits from near e2 need far over 10⁴ time units to reach the cycle
const slow = PP.limitCycle({ model: "RM", r: 0.6, b: 2.79, g: 1.34, d: 0.18, K: 73, N0: 3.5 });
ok(slow && slow.settled && near(slow.period, 783.349, 0.005) && near(slow.lnNmin, -425.409, 0.005) && near(slow.Nmax, 73, 1e-3) && near(slow.Pmax, 99.875, 0.01) && near(Math.log(slow.Pmin), -128.0805, 1e-3),
  `RM, period 783: prey e^${slow?.lnNmin.toFixed(3)} – ${slow?.Nmax.toFixed(4)}, predators e^${Math.log(slow?.Pmin).toFixed(4)} – ${slow?.Pmax.toFixed(3)}, period ${slow?.period.toFixed(3)}, ${slow?.turns} turns`);
const corner = PP.limitCycle({ model: "RM", r: 0.1, b: 3, g: 1.5, d: 0.05, N0: 30, K: 40 });
ok(corner && corner.settled && near(corner.period, 493.113, 0.005) && near(Math.log(corner.Pmin), -18.7558, 1e-3),
  `RM slow corner: period ${corner?.period.toFixed(3)}, predators down to e^${Math.log(corner?.Pmin).toFixed(4)}, ${corner?.turns} turns`);
// LV runs repeat one period exactly: the run's period, and its prey peaks (refined from samples) as far apart
R = PP.run(LV(1, 1, 1, 1), [0.5, 0.5], 50); m = PP.measures(R);
const gaps = m.peaksN.slice(1).map((x, k) => x.t - m.peaksN[k].t);
ok(near(R.period, 6.69393, 1e-4) && gaps.every((g) => near(g, R.period, 2e-4)), `LV from (0.5, 0.5): period ${R.period?.toFixed(6)}; prey peak gaps ${gaps.map((g) => g.toFixed(5)).join(", ")}`);
// RM γβ ≤ δ: the predator can never grow
p = { model: "RM", r: 1, b: 0.05, N0: 10, g: 0.05, d: 0.5, K: 60 };
ok(PP.Nstar(p) === Infinity && PP.KH(p) === null && !eq(p, "e2"), "RM γβ ≤ δ: N* = ∞, no K_H, no e2");
// edge runs
let bad = 0;
for (const q of [LV(1, 1, 1, 1), Vt(10), RM(60), Vt(1), { model: "RM", r: 0.1, b: 1, N0: 10, g: 0.5, d: 3, K: 50 }, { model: "LV", r: 0.1, b: 1, g: 1, d: 3 }])
  for (const s of [[0, 0], [0, 3], [3, 0], [100, 100], [0.5, 0.5]]) { const R2 = PP.run(q, s, 500, 300); for (let i = 0; i < R2.n; i++) if (!(R2.N[i] >= 0 && R2.P[i] >= 0 && Number.isFinite(R2.N[i] + R2.P[i]))) { bad++; break; } }
ok(bad === 0, `edge runs (starts 0, (0, 3), (3, 0), (100, 100); t 500): ${bad} bad`);

console.log(fails ? `${fails} failed` : "all passed");
process.exit(fails ? 1 : 0);
