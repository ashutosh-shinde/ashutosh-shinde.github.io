// test-consumer-resource.mjs — checks the maths of card 5 (js/sims/consumer-resource.js) against known values
// and edge cases (plan: tools/plans/pd-05-consumer-resource.md, section 8). Run: node tools/test-consumer-resource.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const load = (rel, ctx) => vm.runInContext(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8"), ctx);
const ctx = vm.createContext({ Math, Float64Array, Number, Array, Object, String, ArrayBuffer, Date, console, URLSearchParams, JSON, Set });
ctx.globalThis = ctx;
load("../js/lib/ode.js", ctx); load("../js/lib/simkit.js", ctx); load("../js/sims/consumer-resource.js", ctx);
const CR = ctx.WQ.CR;

let fails = 0;
const ok = (cond, what) => { console.log((cond ? "  ok   " : "  FAIL ") + what); if (!cond) fails++; };
const near = (a, b, tol) => a != null && Number.isFinite(a) && Math.abs(a - b) <= tol;
const rel = (a, b, r) => Number.isFinite(a) && Math.abs(a - b) <= r * Math.abs(b);
const base = { I: 12, b1: 4, b2: 3, R01: 5, R02: 5, g1: 1.4, g2: 1 };
const P = (o) => Object.assign({}, base, o);
const last = (R) => [R.C1[R.n - 1], R.C2[R.n - 1], R.R[R.n - 1]];
const f4 = (v) => v.map((x) => x.toPrecision(6)).join(", ");

// R1* < R2*
let p = P({ d1: 0.5, d2: 0.8 }), e = CR.single(p, 1);
ok(near(CR.Rstar(p, 1), 0.490196, 1e-6) && near(CR.Rstar(p, 2), 1.818182, 1e-6) && CR.winner(p) === "1" && near(e.C, 33.6, 1e-9)
  && near(e.eig.re1, -21.78254, 1e-5) && near(e.eig.re2, -0.51175, 1e-5) && !e.eig.complex && near(e.inv, -0.53214, 1e-5) && e.stable,
  `R1* < R2*: R* ${CR.Rstar(p, 1).toFixed(6)}, ${CR.Rstar(p, 2).toFixed(6)}; C1* ${e.C}; block ${e.eig.re1.toFixed(5)}, ${e.eig.re2.toFixed(5)}; invasion ${e.inv.toFixed(5)}`);
let R = CR.run(p, [5, 5, 10], 50), x = CR.exclusion(R, 2), end = last(R);
ok(rel(end[0], 33.6, 1e-3) && end[1] < 1e-3 * 33.6 && rel(end[2], 0.490196, 1e-3) && near(x.peak, 7.1475, 5e-3) /* (the stiff solver interpolates linearly between steps: the peak is ~0.04 % low) */ && near(x.tPeak, 0.48, 0.1) && near(x.t, 9.89, 0.1),
  `run from (5, 5, 10), t 50: (${f4(end)}); species 2 peak ${x.peak.toFixed(4)} at ${x.tPeak.toFixed(2)}, below 1% at ${x.t?.toFixed(3)}`);
// R1* > R2*
p = P({ d1: 1.9, d2: 0.8 }); e = CR.single(p, 2); R = CR.run(p, [5, 5, 10], 50); end = last(R); x = CR.exclusion(R, 1);
ok(near(CR.Rstar(p, 1), 2.567568, 1e-6) && CR.winner(p) === "2" && near(e.C, 15, 1e-9) && near(e.eig.re1, -3.82869, 1e-5) && near(e.eig.re2, -1.01131, 1e-5) && near(e.inv, -0.40667, 1e-5)
  && end[0] < 1e-3 * 15 && rel(end[1], 15, 1e-3) && rel(end[2], 1.8182, 1e-3) && near(x.t, 14.85, 0.1),
  `R1* > R2*: winner ${CR.winner(p)}; block ${e.eig.re1.toFixed(5)}, ${e.eig.re2.toFixed(5)}; invasion ${e.inv.toFixed(5)}; end (${f4(end)}); species 1 below 1% at ${x.t?.toFixed(3)}`);
// tie
p = P({ d1: 0.5, d2: 0.267857 }); R = CR.run(p, [5, 5, 10], 50); end = last(R);
ok(CR.winner(p) === "tie" && rel(end[0], 24.7637, 1e-3) && rel(end[1], 11.7818, 1e-3) && rel(end[2], 0.4902, 1e-3), `tie: ${CR.winner(p)}; t 50 → (${f4(end)})`);
// δ2 = 3: species 2 cannot persist
p = P({ d1: 0.5, d2: 3 }); e = CR.single(p, 1);
ok(CR.Rstar(p, 2) === Infinity && CR.winner(p) === "1" && near(e.inv, -2.73214, 1e-5) && CR.single(p, 2) === null, `δ2 = 3: R2* ∞, winner 1, invasion ${e.inv.toFixed(5)}`);
// neither persists
p = P({ d1: 0.5, d2: 0.8, g1: 0.1, g2: 0.1 }); R = CR.run(p, [5, 5, 10], 50); end = last(R);
ok(CR.winner(p) === "none" && rel(end[2], 518.44, 2e-3) && end[0] < 1e-2 && end[1] < 1e-2, `γ = 0.1: ${CR.winner(p)}; R at t 50 = ${end[2].toFixed(3)}`);
// I = 0
p = P({ d1: 0.5, d2: 0.8, I: 0 }); R = CR.run(p, [5, 5, 10], 50); end = last(R);
ok(end.every((v) => v < 0.05) && CR.single(p, 1) === null, `I = 0: t 50 → (${f4(end)})`);
// stiff corner
p = { I: 30, b1: 10, b2: 3, R01: 0.1, R02: 5, g1: 2, g2: 1, d1: 0.01, d2: 0.8 };
let r5 = CR.run(p, [5, 5, 10], 5), r50 = CR.run(p, [5, 5, 10], 50), e5 = last(r5), e50 = last(r50);
ok(r5.status === "ok" && rel(e5[0], 314.963, 1e-3) && rel(e5[1], 0.106442, 1e-3) && rel(e5[2], 9.61657e-4, 1e-3)
  && r50.status === "ok" && rel(e50[0], 2375.061, 1e-3) && e50[1] < 1e-6 && rel(e50[2], 1.264723e-4, 1e-3) && r50.steps < 100000,
  `stiff corner: t 5 (${f4(e5)}); t 50 (${f4(e50)}), ${r50.steps} steps`);
// the portrait's lines
p = P({ d1: 0.5, d2: 0.8 }); const L1 = CR.line(p, 1), L2 = CR.line(p, 2);
ok(near(L1.x, 33.6, 1e-6) && near(L1.y, 44.8, 1e-6) && near(L2.x, 11.25, 1e-6) && near(L2.y, 15, 1e-6), `lines: L1 (${L1.x.toFixed(4)}, ${L1.y.toFixed(4)}), L2 (${L2.x.toFixed(4)}, ${L2.y.toFixed(4)})`);
// absent species: species 2 alone wins although species 1 has the lower R*
ok(CR.winner(P({ d1: 0.5, d2: 0.8 }), [false, true]) === "2" && CR.winner(P({ d1: 0.5, d2: 0.8 }), [true, false]) === "1", "an absent species does not count");

// a coarse sweep: everything finite
let bad = 0;
for (const I of [0, 0.5, 12, 30]) for (const d1 of [0.01, 0.5, 3]) for (const b2 of [0.1, 3, 10]) for (const R02 of [0.1, 5, 20]) {
  const q = P({ I, d1, d2: 0.8, b2, R02 }), rr = CR.run(q, [5, 5, 10], 50, 100);
  if (!last(rr).every(Number.isFinite) || rr.status === "blowup") bad++;
  for (const i of [1, 2]) { const s = CR.single(q, i); if (s && !(Number.isFinite(s.eig.re1) && Number.isFinite(s.inv))) bad++; }
}
ok(bad === 0, `coarse sweep: ${bad} bad`);

console.log(fails ? `${fails} failed` : "all passed");
process.exit(fails ? 1 : 0);
