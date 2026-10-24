// test-continuous-logistic.mjs — checks the maths of card 2 (js/sims/continuous-logistic.js) against
// known values and edge cases. Run: node tools/test-continuous-logistic.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const load = (rel, ctx) => vm.runInContext(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8"), ctx);
const ctx = vm.createContext({ Math, Float64Array, Number, Array, Object, String, ArrayBuffer, Date, console, URLSearchParams });
ctx.globalThis = ctx;
load("../js/lib/simkit.js", ctx); load("../js/sims/continuous-logistic.js", ctx);
const M = ctx.WQ.CLogistic;

let fails = 0;
const ok = (cond, what) => { console.log((cond ? "  ok   " : "  FAIL ") + what); if (!cond) fails++; };
const near = (a, b, tol) => a != null && Number.isFinite(a) && Math.abs(a - b) <= tol;

ok(near(M.exact(0.23, 0.11, 100), 0.999944, 1e-6), `exact(0.23, 0.11, 100) = ${M.exact(0.23, 0.11, 100).toFixed(6)}`);
const th = M.tHalf(0.23, 0.11);
ok(near(th, 10.9846, 1e-4) && near(M.exact(0.23, 0.11, th), 0.5, 1e-9), `tHalf(0.23, 0.11) = ${th}`);
ok(near(M.tHalf(0.1, 1), Math.log(9), 1e-6), `tHalf(0.1, 1) = ln 9`);
ok(M.tHalf(0.5, 1) === 0 && M.tHalf(0.7, 1) === null && M.tHalf(2, 1) === null && M.tHalf(0.3, 0) === null, "tHalf edge cases: 0, null, null, null");
ok(near(M.exact(2, 0.5, 5), 1.042799, 1e-6), `exact(2, 0.5, 5) = ${M.exact(2, 0.5, 5).toFixed(6)}`);
ok(near(M.t99(0.23, 0.11), 52.7585, 1e-4) && near(M.t99(0.1, 1), 6.7923, 1e-4) && near(M.t99(2, 1), 3.9220, 1e-4),
  `t99: ${M.t99(0.23, 0.11).toFixed(4)}, ${M.t99(0.1, 1).toFixed(4)}, ${M.t99(2, 1).toFixed(4)}`);
ok(M.t99(0, 1) === null && M.t99(1, 1) === 0 && M.t99(0.5, 0) === null, "t99 edge cases: null, 0, null");
ok(M.exact(0.7, 0, 50) === 0.7 && M.exact(0, 1.3, 50) === 0, "exact with r = 0 or x0 = 0");

let e = M.euler(0.23, 0.11, 0.01, 100);
ok(Math.abs(e.maxGap - 4.741e-5) / 4.741e-5 < 0.02, `Euler maxGap, defaults: ${e.maxGap.toExponential(3)}`);
const gaps = [0.1, 0.5, 1].map((dt) => M.euler(0.1, 1, dt, 20).maxGap);
ok(near(gaps[0], 0.0128, 5e-4) && near(gaps[1], 0.0642, 5e-4) && near(gaps[2], 0.1210, 5e-4), `Euler gaps r = 1, x0 = 0.1: ${gaps.map((g) => g.toFixed(4)).join(", ")}`);

const lr = (a) => M.eulerLongRun(a, 0.23);
ok(lr(0.5).kind === "fixed" && near(lr(0.5).values[0], 1, 1e-9) && lr(1.5).kind === "fixed", "long run a = 0.5, 1.5: fixed at 1");
const c2 = lr(2.2);
ok(c2.kind === "cycle" && c2.period === 2 && near(c2.values[0], 0.7462, 1e-4) && near(c2.values[1], 1.1628, 1e-4), `a = 2.2: ${c2.kind} ${c2.period} ${c2.values.map((v) => v.toFixed(4))}`);
ok(lr(2.5).period === 4 && lr(2.55).period === 8 && lr(2.83).period === 3, `a = 2.5, 2.55, 2.83: periods ${lr(2.5).period}, ${lr(2.55).period}, ${lr(2.83).period}`);
ok(lr(2.6).kind === "chaos" && lr(2.6).lambda > 0 && lr(3.0).kind === "chaos" && lr(3.0).lambda > 0, `a = 2.6, 3.0: chaos (λ ${lr(2.6).lambda?.toFixed(3)}, ${lr(3.0).lambda?.toFixed(3)})`);
ok(lr(3.05).kind === "escapes", "a = 3.05: escapes");

e = M.euler(2, 1, 1, 10);
ok(e.x[1] === 0 && e.x[10] === 0 && e.landedZero === 1 && e.wentNegative === null, "x0 = 2, a = 1: first step lands on 0 and stays");
e = M.euler(2, 0.6, 1, 10);
ok(near(e.x[1], 0.8, 1e-12) && e.crossedK, "x0 = 2, a = 0.6: first step 0.8, crossed K from above");
e = M.euler(1.6, 2, 1, 10);
ok(near(e.x[1], -0.32, 1e-12) && e.wentNegative === 1 && e.status === "blowup", `x0 = 1.6, a = 2: first step ${e.x[1]}, wentNegative ${e.wentNegative}, ${e.status}`);
e = M.euler(0.23, 0.11, 0.001, 300);
ok(e.n === 300000 && e.status === "ok", `largest run: ${e.n} steps`);

console.log(fails ? `${fails} failed` : "all passed");
process.exit(fails ? 1 : 0);
