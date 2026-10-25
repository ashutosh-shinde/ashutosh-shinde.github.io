// test-lv-competition.mjs — checks the maths of card 4 (js/sims/lv-competition.js) against known values and
// edge cases (plan: tools/plans/pd-04-lv-competition.md, section 7). Run: node tools/test-lv-competition.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const load = (rel, ctx) => vm.runInContext(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8"), ctx);
const ctx = vm.createContext({ Math, Float64Array, Number, Array, Object, String, ArrayBuffer, Date, console, URLSearchParams, JSON, Set });
ctx.globalThis = ctx;
load("../js/lib/ode.js", ctx); load("../js/lib/simkit.js", ctx); load("../js/sims/lv-competition.js", ctx);
const L = ctx.WQ.LVC;

let fails = 0;
const ok = (cond, what) => { console.log((cond ? "  ok   " : "  FAIL ") + what); if (!cond) fails++; };
const near = (a, b, tol) => a != null && Number.isFinite(a) && Math.abs(a - b) <= tol;
const P = (r1, r2, K1, K2, a12, a21) => ({ r1, r2, K1, K2, a12, a21 });
const eq = (p, n) => L.equilibria(p).find((e) => e.name === n);
const eigIs = (e, l1, l2, tol = 1e-4) => e && !e.eig.complex && near(e.eig.re1, Math.min(l1, l2), tol) && near(e.eig.re2, Math.max(l1, l2), tol);
const show = (e) => (e ? `${e.name} (${e.N1.toFixed(4)}, ${e.N2.toFixed(4)}) ${e.type} [${e.eig.re1.toFixed(4)}, ${e.eig.re2.toFixed(4)}]` : "none");
const endsAt = (p, s, tmax, x, y, tol = 1e-3) => { const R = L.run(p, s, tmax); return near(R.end[0], x, tol) && near(R.end[1], y, tol); };

// stable coexistence
let p = P(1, 0.8, 10, 8, 0.4, 0.6), e3 = eq(p, "e3");
ok(near(1 - p.a12 * p.a21, 0.76, 1e-12) && near(e3.N1, 6.8421, 1e-4) && near(e3.N2, 5.2632, 1e-4) && e3.type === "stable node" && eigIs(e3, -0.9097, -0.3009)
  && eigIs(eq(p, "e1"), -1, 0.4) && eq(p, "e1").type === "saddle" && eigIs(eq(p, "e2"), -0.8, 0.52) && eq(p, "e2").type === "saddle"
  && eigIs(eq(p, "e0"), 0.8, 1) && eq(p, "e0").type === "unstable node" && L.outcome(p) === "coexistence",
  `coexistence: ${L.equilibria(p).map(show).join("; ")}`);

// SP1 wins
p = P(1, 1, 10, 8, 1.5, 0.2); let v = L.invasion(p);
ok(near(v.s1, 8.4, 1e-12) && near(v.s2, -7, 1e-12) && eigIs(eq(p, "e1"), -1, -0.875) && eq(p, "e1").type === "stable node" && eigIs(eq(p, "e2"), -1, 0.84) && eq(p, "e2").type === "saddle"
  && !eq(p, "e3") && L.outcome(p) === "sp1" && [[1, 1], [8, 2], [2, 8], [12, 12]].every((s) => endsAt(p, s, 400, 10, 0)), `SP1 wins: ${L.equilibria(p).map(show).join("; ")}`);
// SP2 wins
p = P(1, 1, 10, 8, 0.2, 1.5); v = L.invasion(p);
ok(near(v.s1, -2, 1e-12) && near(v.s2, 6, 1e-12) && eigIs(eq(p, "e2"), -1, -0.2) && eq(p, "e2").type === "stable node" && eigIs(eq(p, "e1"), -1, 0.75) && eq(p, "e1").type === "saddle"
  && L.outcome(p) === "sp2" && [[1, 1], [8, 2], [2, 8], [12, 12]].every((s) => endsAt(p, s, 400, 0, 8)), `SP2 wins: ${L.equilibria(p).map(show).join("; ")}`);
// bistability
p = P(1, 1, 10, 8, 1.2, 1.4); e3 = eq(p, "e3"); const sv = L.stableVector(e3);
ok(near(1 - 1.2 * 1.4, -0.68, 1e-12) && near(e3.N1, 1.7647, 1e-4) && near(e3.N2, 5.8824, 1e-4) && e3.type === "saddle" && eigIs(e3, -1, 0.0882)
  && eigIs(eq(p, "e1"), -1, -0.5) && eigIs(eq(p, "e2"), -1, -0.12) && eq(p, "e1").stable && eq(p, "e2").stable
  && near(sv[0], 0.2873, 1e-4) && near(sv[1], 0.9578, 1e-4) && L.outcome(p) === "bistable"
  && endsAt(p, [1, 1], 400, 10, 0) && endsAt(p, [2, 8], 400, 0, 8) && endsAt(p, [8, 2], 400, 10, 0) && endsAt(p, [12, 12], 400, 10, 0),
  `bistable: ${show(e3)}; stable vector (${sv[0].toFixed(4)}, ${sv[1].toFixed(4)})`);
const sep = L.separatrix(p);
ok(sep && sep.xs.length > 20 && L.side(sep, [1, 1], 1e-3) === 1 && L.side(sep, [2, 8], 1e-3) === -1 && L.side(sep, [12, 12], 1e-3) === 1, `separatrix: ${sep?.xs.length} points; sides of (1,1), (2,8), (12,12)`);
// weak competition
p = P(1, 0.7, 10, 8, 0.05, 0.05); e3 = eq(p, "e3");
ok(near(e3.N1, 9.6241, 1e-4) && near(e3.N2, 7.5188, 1e-4) && e3.type === "stable node" && eigIs(e3, -0.9675, -0.6528), `weak: ${show(e3)}`);
// symmetric (neutral)
p = P(1, 1, 10, 10, 1, 1); v = L.invasion(p);
ok(L.outcome(p) === "neutral" && v.s1 === 0 && v.s2 === 0 && !eq(p, "e3") && eq(p, "e1").type === "non-hyperbolic" && eq(p, "e2").type === "non-hyperbolic"
  && endsAt(p, [1, 1], 400, 5, 5) && endsAt(p, [8, 2], 400, 8, 2) && endsAt(p, [2, 8], 400, 2, 8), "symmetric: neutral; runs stop on N1 + N2 = 10");
// near-degenerate
p = P(1, 1, 10, 10, 0.999, 0.999); e3 = eq(p, "e3"); let R = L.run(p, [8, 2], 400);
ok(near(e3.N1, 5.0025, 1e-4) && near(e3.N2, 5.0025, 1e-4) && e3.type === "stable node" && eigIs(e3, -1, -0.0005, 1e-5) && near(R.end[0], 7.619, 2e-3) && near(R.end[1], 2.385, 2e-3),
  `near-degenerate: ${show(e3)}; (8, 2) at t = 400 → (${R.end[0].toFixed(4)}, ${R.end[1].toFixed(4)})`);
let st = L.settleTime(p, [1, 1], 400, [e3.N1, e3.N2]);
ok(near(st.t, 5.64, 0.05) && near(L.slowest(e3).tau, 1999, 2), `near-degenerate from (1, 1): settled by ${st.t?.toFixed(3)}, τ ${L.slowest(e3).tau.toFixed(1)}`);
// fast–slow
p = P(5, 0.1, 10, 8, 0.4, 0.6); e3 = eq(p, "e3"); R = L.run(p, [1, 0.8], 50);
st = L.settleTime(p, [1, 0.8], 500, [e3.N1, e3.N2]);
ok(near(e3.N1, 6.8421, 1e-4) && e3.type === "stable node" && eigIs(e3, -3.4371, -0.0498) && near(R.end[0], 7.8271, 1e-3) && near(R.end[1], 3.6359, 1e-3) && near(st.t, 116.3, 0.3) && near(L.slowest(e3).tau, 20.09, 0.01),
  `fast–slow: ${show(e3)}; t = 50 → (${R.end[0].toFixed(4)}, ${R.end[1].toFixed(4)}); settled ${st.t?.toFixed(2)}; τ ${L.slowest(e3).tau.toFixed(2)}`);
// α = 0
p = P(1, 1, 10, 8, 0, 0); e3 = eq(p, "e3");
ok(near(e3.N1, 10, 1e-12) && near(e3.N2, 8, 1e-12) && e3.type === "stable node" && eigIs(e3, -1, -1, 1e-9), `α = 0: ${show(e3)}`);
p = P(1, 1, 10, 8, 1.5, 0);
ok(L.outcome(p) === "sp1" && eigIs(eq(p, "e1"), -1, -0.875) && eq(p, "e1").type === "stable node" && eigIs(eq(p, "e2"), -1, 1) && eq(p, "e2").type === "saddle", `α21 = 0, α12 = 1.5: ${L.equilibria(p).map(show).join("; ")}`);
// settling
p = P(1, 0.8, 10, 8, 0.4, 0.6); e3 = eq(p, "e3"); st = L.settleTime(p, [1, 0.8], 50, [e3.N1, e3.N2]);
ok(near(st.t, 12.32, 0.05) && near(L.slowest(e3).tau, 3.32, 0.005), `settling, defaults: ${st.t?.toFixed(3)}, τ ${L.slowest(e3).tau.toFixed(3)}`);
p = P(1, 1, 10, 8, 1.2, 1.4); st = L.settleTime(p, [1, 0.8], 50, [10, 0]);
ok(near(st.t, 16.26, 0.05) && near(L.slowest(eq(p, "e1")).tau, 2, 1e-9), `settling, bistable from (1, 0.8) → (10, 0): ${st.t?.toFixed(3)}`);
// map borders
let b = L.borders(P(1, 1, 10, 8, 0, 0)), b2 = L.borders(P(1, 1, 100, 1, 0, 0));
ok(near(b.b12, 0.8, 1e-12) && near(b.b21, 1.25, 1e-12) && near(b2.b12, 0.01, 1e-12) && near(b2.b21, 100, 1e-12), "outcome map borders: 0.8, 1.25; 0.01, 100");
ok(L.region(P(1, 0.8, 10, 8, 0, 0), 0.4, 0.6) === "coexistence" && L.region(P(1, 0.8, 10, 8, 0, 0), 2, 0.6) === "sp1" && L.region(P(1, 0.8, 10, 8, 0, 0), 0.4, 2) === "sp2" && L.region(P(1, 0.8, 10, 8, 0, 0), 2, 2) === "bistable", "map regions");

// default starts: 16 minus the duplicate corner
ok(L.starts(P(1, 0.8, 10, 8, 0.4, 0.6)).length === 15, `default starts: ${L.starts(P(1, 0.8, 10, 8, 0.4, 0.6)).length}`);

// a coarse sweep: everything finite, the outcomes agree with the stability
let bad = 0;
for (const K1 of [1, 10, 100]) for (const K2 of [1, 8, 100]) for (const a12 of [0, 0.3, 1, 2.5, 5]) for (const a21 of [0, 0.3, 1, 2.5, 5]) {
  const q = P(1, 0.8, K1, K2, a12, a21), E = L.equilibria(q), o = L.outcome(q);
  if (!E.every((e) => Number.isFinite(e.N1) && Number.isFinite(e.eig.re1) && Number.isFinite(e.eig.re2))) bad++;
  if (o !== "neutral" && o !== "borderline" && L.outcomeFromStability(E) !== o) { bad++; console.log("    mismatch", K1, K2, a12, a21, o, L.outcomeFromStability(E)); }
  const B = L.box(q, E); if (!(B.X > 0 && B.Y > 0 && Number.isFinite(B.X + B.Y))) bad++;
}
ok(bad === 0, `coarse sweep (K1 × K2 × α12 × α21): ${bad} bad`);

console.log(fails ? `${fails} failed` : "all passed");
process.exit(fails ? 1 : 0);
