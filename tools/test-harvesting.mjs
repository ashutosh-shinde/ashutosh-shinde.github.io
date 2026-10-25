// test-harvesting.mjs — checks the maths of card 3 (js/sims/harvesting.js) against known values and
// edge cases (plan: tools/plans/pd-03-harvesting.md, section 8 and the revision at its top). Run: node tools/test-harvesting.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const load = (rel, ctx) => vm.runInContext(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8"), ctx);
const ctx = vm.createContext({ Math, Float64Array, Number, Array, Object, String, ArrayBuffer, Date, console, URLSearchParams, JSON });
ctx.globalThis = ctx;
load("../js/lib/ode.js", ctx); load("../js/lib/simkit.js", ctx); load("../js/sims/harvesting.js", ctx);
const H = ctx.WQ.Harvest;

let fails = 0;
const ok = (cond, what) => { console.log((cond ? "  ok   " : "  FAIL ") + what); if (!cond) fails++; };
const near = (a, b, tol) => a != null && Number.isFinite(a) && Math.abs(a - b) <= tol;
const T1 = (r, h0) => H.model("linear", { r, h0 }), TH = (k, theta, h) => H.model("theta", { k, theta, h });
const pos = (m) => H.equilibria(m).filter((e) => e.u > 0);
const show = (es) => es.map((e) => `${e.u.toFixed(6)} ${e.stab}${e.fp != null && Number.isFinite(e.fp) ? ` (${e.fp.toFixed(6)})` : ""}`).join(", ");
const foldStr = (F) => F.map((f) => `(${f.u.toFixed(4)}, ${f.p.toFixed(4)}) ${f.kind}`).join(", ");

// the θ model covers Types 0, II, III; Type I is separate
ok(H.typeName(0) === "Type 0, constant" && H.typeName(1) === "Type II" && H.typeName(2) === "Type III" && H.typeName(0.5) === "between Types 0 and II", "type names of θ = 0, 1, 2, 0.5");

// Type 0 = θ = 0 in rescaled units: the README's r_m 1.5, c 0.3 is k 10, h = 2k·c/r_m = 4 (y = k·x, t′ = r_m t, f′_y = f′_x/r_m)
let m = TH(10, 0, 4), E = pos(m);
ok(E.length === 2 && near(E[0].u / 10, 0.276393, 1e-6) && E[0].stab === "unstable" && near(E[1].u / 10, 0.723607, 1e-6) && E[1].stab === "stable"
  && near(1.5 * E[0].fp, 0.67082, 1e-5) && near(1.5 * E[1].fp, -0.67082, 1e-5) && H.equilibria(m).some((e) => e.u === 0 && e.stab === "absorbing"),
  `θ 0, k 10, h 4 (README Type 0: r_m 1.5, c 0.3): ${show(H.equilibria(m))}`);
let F = H.folds(m);
ok(F.length === 1 && near(F[0].u, 5, 1e-6) && near(F[0].p, 5, 1e-6) && near((1.5 * F[0].p) / (2 * 10), 0.375, 1e-6), `θ 0 fold (k/2, k/2), i.e. c_c = r_m/4: ${foldStr(F)}`);
let r = H.run(TH(10, 0, 6), 5, 100);
ok(near(r.extinctAt, 1.5 * 3.429419, 0.005) && r.end === 0, `θ 0, h 6 (c 0.45) from y 5: extinct at t′ = ${r.extinctAt} (= 1.5 × 3.4294)`);
r = H.run(TH(10, 0, 4), 2, 100);
ok(near(r.extinctAt, 1.5 * 1.434696, 0.005), `θ 0, h 4 (c 0.3) from y 2: extinct at t′ = ${r.extinctAt} (= 1.5 × 1.4347)`);
r = H.run(TH(10, 0, 0), 2, 100);
ok(r.extinctAt == null && near(r.end, 10, 1e-5) && !TH(10, 0, 0).absorbing, `θ 0, h 0: logistic, ends ${r.end}`);

// Type I
m = T1(1.5, 1); E = H.equilibria(m);
ok(E.length === 2 && E[0].u === 0 && E[0].stab === "unstable" && near(E[0].fp, 0.5, 1e-12) && near(E[1].u, 1 / 3, 1e-9) && E[1].stab === "stable" && near(E[1].fp, -0.5, 1e-9)
  && H.thresholds(m).pc === 1.5, `Type I r 1.5 h0 1: ${show(E)}`);
E = H.equilibria(T1(1.5, 1.5));
ok(E.length === 1 && E[0].u === 0 && E[0].stab === "stable" && E[0].slow, `Type I h0 = r: only 0, stable slowly: ${show(E)}`);

// Type II = θ 1
const T2 = (k, h) => TH(k, 1, h);
m = T2(1.8, 0.8); E = H.equilibria(m);
ok(E.length === 2 && E[0].u === 0 && E[0].stab === "unstable" && near(E[1].u, 1.12111, 1e-6) && E[1].stab === "stable" && near(E[1].fp, -0.423491, 1e-6), `Type II k 1.8 h 0.8: ${show(E)}`);
m = T2(1.8, 1.05); E = H.equilibria(m);
ok(E.length === 3 && E[0].u === 0 && E[0].stab === "stable" && near(E[1].u, 0.135425, 1e-6) && E[1].stab === "unstable" && near(E[1].fp, 0.035063, 1e-6)
  && near(E[2].u, 0.664575, 1e-6) && E[2].stab === "stable" && near(E[2].fp, -0.117367, 1e-6), `Type II k 1.8 h 1.05: ${show(E)}`);
F = H.folds(T2(1.8, 1));
ok(F.length === 1 && F[0].kind === "max" && near(F[0].u, 0.4, 1e-9) && near(F[0].p, 1.088889, 1e-6), `Type II k 1.8 fold: ${foldStr(F)}`);
E = pos(T2(0.5, 0.8));
ok(E.length === 1 && near(E[0].u, 0.153113, 1e-6) && pos(T2(0.5, 1.05)).length === 0 && H.folds(T2(0.5, 1)).length === 0 && H.thresholds(T2(0.5, 1)).pc === 1,
  `Type II k 0.5: h 0.8 → ${show(E)}; h 1.05 → none; no fold; p_c 1`);
E = pos(T2(1, 0.9));
ok(E.length === 1 && near(E[0].u, 0.316228, 1e-6) && E[0].stab === "stable", `Type II k 1 h 0.9: ${show(E)}`);

// Type III and the rest of the θ family
const T3 = TH;
F = H.folds(T3(10, 2, 1));
ok(F.length === 2 && F[0].kind === "min" && near(F[0].u, 1.1378, 1e-3) && near(F[0].p, 1.7872, 1e-3) && F[1].kind === "max" && near(F[1].u, 4.7813, 1e-3) && near(F[1].p, 2.6044, 1e-3),
  `Type III k 10 θ 2 folds: ${foldStr(F)}`);
m = T3(10, 2, 2.2); E = pos(m);
ok(E.length === 3 && near(E[0].u, 0.566335, 1e-5) && E[0].stab === "stable" && near(E[1].u, 2.574141, 1e-5) && E[1].stab === "unstable" && near(E[2].u, 6.859523, 1e-5) && E[2].stab === "stable"
  && E.every((e) => Math.abs(m.f(e.u)) < 1e-12), `Type III k 10 θ 2 h 2.2: ${show(E)}`);
const a = pos(T3(10, 2, 1.5)), b = pos(T3(10, 2, 3));
ok(a.length === 1 && near(a[0].u, 8.19687, 1e-5) && a[0].stab === "stable" && b.length === 1 && near(b[0].u, 0.363699, 1e-5) && b[0].stab === "stable", `Type III k 10 θ 2 h 1.5 / 3: ${show(a)} / ${show(b)}`);
E = pos(T3(5, 2, 1.5));
ok(H.folds(T3(5, 2, 1)).length === 0 && E.length === 1 && near(E[0].u, 2, 1e-6), `Type III k 5 θ 2: no folds; h 1.5 → ${show(E)}`);
F = H.folds(T3(5.3, 2, 1));
ok(F.length === 2 && near(F[0].u, 1.5573, 1e-3) && near(F[0].p, 1.5532, 1e-3) && near(F[1].u, 1.9606, 1e-3) && near(F[1].p, 1.5567, 1e-3), `Type III k 5.3 θ 2 folds: ${foldStr(F)}`);
ok(H.folds(T3(3 * Math.sqrt(3), 2, 1)).length === 0, `Type III k 3√3 θ 2: no folds (${foldStr(H.folds(T3(3 * Math.sqrt(3), 2, 1)))})`);
m = T3(10, 0.5, 1); E = H.equilibria(m); F = H.folds(m);
ok(E.length === 3 && E[0].u === 0 && E[0].stab === "stable" && near(E[1].u, 0.405485, 1e-5) && E[1].stab === "unstable" && near(E[2].u, 9.181073, 1e-5) && E[2].stab === "stable"
  && F.length === 1 && near(F[0].u, 4.567, 1e-3) && near(F[0].p, 3.6423, 1e-3), `Type III k 10 θ 0.5 h 1: ${show(E)}; fold ${foldStr(F)}`);
F = H.folds(T3(10, 0, 4)); E = pos(T3(10, 0, 4));
ok(F.length === 1 && near(F[0].u, 5, 1e-6) && near(F[0].p, 5, 1e-6) && E.length === 2 && near(E[0].u, 2.763932, 1e-6) && E[0].stab === "unstable" && near(E[1].u, 7.236068, 1e-6) && E[1].stab === "stable"
  && pos(T3(10, 0, 6)).length === 0, `Type III k 10 θ 0: fold ${foldStr(F)}; h 4 → ${show(E)}; h 6 → none`);
F = H.folds(T3(10, 10, 1));
ok(F.length === 2 && near(F[0].u, 1.2674, 1e-3) && near(F[0].p, 1.2103, 1e-3) && near(F[1].u, 5, 1e-3) && near(F[1].p, 2.5, 1e-3), `Type III k 10 θ 10 folds: ${foldStr(F)}`);
const F2 = H.folds(T3(20, 2, 1)), F10 = H.folds(T3(20, 10, 1));
ok(F2.length === 2 && near(F2[0].u, 1.0575, 1e-3) && near(F2[0].p, 1.8972, 1e-3) && near(F2[1].u, 9.8979, 1e-3) && near(F2[1].p, 5.0505, 1e-3)
  && F10.length === 2 && near(F10[0].u, 1.2553, 1e-3) && near(F10[0].p, 1.2976, 1e-3) && near(F10[1].u, 10, 1e-3) && near(F10[1].p, 5, 1e-3),
  `Type III k 20 folds: θ 2 ${foldStr(F2)}; θ 10 ${foldStr(F10)}`);
E = pos(T3(10, 2, 10));
ok(E.length === 1 && near(E[0].u, 0.09999, 1e-4) && E[0].stab === "stable", `Type III k 10 θ 2 h 10: refuge ${show(E)}`);

// f near 0 (signs)
const f0 = [0, 0.5, 1, 2].map((th) => T3(10, th, 1).f(1e-6));
ok(near(f0[0], -0.5, 1e-5) && near(f0[1], -9.98e-4, 2e-6) && f0[2] > 0 && near(f0[2], 9e-13, 2e-13) && near(f0[3], 1e-6, 1e-8), `f(1e-6) for θ 0, 0.5, 1, 2: ${f0.map((v) => v.toExponential(3)).join(", ")}`);

// no harvest: plain logistic for every type, nothing absorbing
for (const mm of [T1(1.5, 0), T2(1.8, 0), T3(10, 0, 0), T3(10, 0.5, 0), T3(10, 2, 0)]) {
  const e = H.equilibria(mm);
  ok(e.length === 2 && e[0].u === 0 && e[0].stab === "unstable" && e[1].u === mm.U && e[1].stab === "stable" && !mm.absorbing, `${mm.lin ? "Type I" : `θ ${mm.th}`}, no harvest: 0 unstable, U stable`);
}

// thresholds
const th3 = H.thresholds(T3(10, 2, 1)), th5 = H.thresholds(T3(5, 2, 1)), thh = H.thresholds(T3(10, 0.5, 1));
ok(th3.kind === "tip-refuge" && near(th3.pc, 2.6044, 1e-3) && near(th3.pr, 1.7872, 1e-3) && th5.kind === "smooth-refuge" && thh.kind === "tip-permanent" && near(thh.pc, 3.6423, 1e-3) && thh.pr == null,
  `thresholds: k 10 θ 2 ${th3.kind} ${th3.pc?.toFixed(4)}/${th3.pr?.toFixed(4)}; k 5 ${th5.kind}; θ 0.5 ${thh.kind} ${thh.pc?.toFixed(4)}`);

// the ramp, T = 800
let R = H.ramp(T3(10, 0, 4), 800, 20);
ok(near(R.pHi, 6.5, 1e-9) && R.crash && R.crash.p > 5 && R.crash.p < 5.6 && !R.recovery && R.u[R.u.length - 1] === 0, `ramp θ 0 (k 10): p_hi ${R.pHi}, crash h ${R.crash?.p.toFixed(4)}, recovery ${R.recovery}, end ${R.u[R.u.length - 1]}`);
R = H.ramp(T2(1.8, 0.8), 800, 20);
ok(near(R.pHi, 1.4156, 1e-3) && R.crash && R.crash.p > 1.0889 && R.crash.p < 1.25 && R.recovery && R.recovery.p > 0.5 && R.recovery.p < 1, `ramp Type II: p_hi ${R.pHi.toFixed(4)}, crash h ${R.crash?.p.toFixed(4)}, recovery h ${R.recovery?.p.toFixed(4)}`);
R = H.ramp(T3(10, 2, 2.2), 800, 20);
ok(R.crash && R.crash.p > 2.6044 && R.crash.p < 2.95 && R.recovery && R.recovery.p > 1.3 && R.recovery.p < 1.7872, `ramp Type III θ 2: crash h ${R.crash?.p.toFixed(4)}, recovery h ${R.recovery?.p.toFixed(4)}`);
R = H.ramp(T3(10, 0.5, 1), 800, 20);
ok(R.crash && R.crash.p > 3.6423 && R.crash.p < 4.2 && !R.recovery, `ramp Type III θ 0.5: crash h ${R.crash?.p.toFixed(4)}, recovery ${R.recovery}`);
R = H.ramp(T1(1.5, 1), 800, 4);
ok(!R.crash && !R.recovery && R.u.every(Number.isFinite), "ramp Type I: smooth, no events");

// every output finite over a coarse sweep of the sliders
let bad = 0;
for (const k of [0.1, 1, 1.8, 5.196152, 10, 20]) for (const th of [0, 0.5, 0.95, 1, 1.05, 2, 5, 10]) for (const h of [0, 0.5, 1, 2.2, 5, 10, 20]) {
  const mm = T3(k, th, h), e = H.equilibria(mm);
  if (!e.every((x) => Number.isFinite(x.u) && (x.fp == null || !Number.isNaN(x.fp)))) bad++;
  if (e.filter((x) => x.u > 0).some((x) => Math.abs(mm.f(x.u)) > 1e-9 * Math.max(1, k))) bad++;
}
ok(bad === 0, `slider sweep (k × θ × h): ${bad} bad cases`);
r = H.run(T3(1, 0, 20), 0.9, 100);
ok(r.extinctAt != null && r.extinctAt < 0.2, `θ 0, k 1, h 20 (immediate collapse): extinct at t′ = ${r.extinctAt}`);

console.log(fails ? `${fails} failed` : "all passed");
process.exit(fails ? 1 : 0);
