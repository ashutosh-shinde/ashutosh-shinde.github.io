// test-logistic.mjs — checks the maths of the discrete-time logistic model page
// (js/sims/logistic.js) against known values. Run: node tools/test-logistic.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const src = readFileSync(fileURLToPath(new URL("../js/sims/logistic.js", import.meta.url)), "utf8");
const ctx = { Math, Float64Array, Number, Array, Object, String, isFinite };
ctx.globalThis = ctx;
vm.runInNewContext(src, ctx);
const M = ctx.WQ.Logistic;

let fails = 0;
const ok = (cond, what) => { console.log((cond ? "  ok   " : "  FAIL ") + what); if (!cond) fails++; };
const near = (a, b, tol) => a != null && Math.abs(a - b) <= tol;

const X0 = 0.2;
const cases = [
  [0.5, "extinction", null, -0.693],
  [2.8, "equilibrium", 1, null],
  [3.2, "cycle", 2, null],
  [3.5, "cycle", 4, null],
  [3.55, "cycle", 8, null],
  [3.566, "cycle16", 16, null],
  [3.7, "chaos", 0, 0.355],
  [3.83, "window", 3, null],
  [4.0, "chaos", 0, 0.693],
];
for (const [R, kind, p, lam] of cases) {
  const s = M.classify(R, X0);
  ok(s.kind === kind && (p == null || s.period === p) && (lam == null || near(s.lambda, lam, 0.01)),
    `R_m = ${R}: ${s.text}, period ${s.period}, λ = ${s.lambda == null ? "—" : s.lambda.toFixed(3)}`);
}
const fp = M.fixedPoints(2.8);
ok(fp.length === 2 && near(fp[1].x, 0.642857, 1e-6) && fp[1].stab === "stable" && fp[0].stab === "unstable", "R_m = 2.8: x* = 0 unstable, x* = 0.642857 stable");
const c = M.twoCycle(3.2);
ok(c && near(c.lo, 0.513045, 1e-6) && near(c.hi, 0.799455, 1e-6) && near(c.mu, 0.16, 1e-9) && c.stab === "stable", "R_m = 3.2: 2-cycle 0.513045 ↔ 0.799455, multiplier 0.16, stable");
ok(M.twoCycle(3.5).stab === "unstable", "R_m = 3.5: the 2-cycle is unstable");
ok(M.fixedPoints(3).at(-1).stab.startsWith("neutral"), "R_m = 3: x* is neutral (test inconclusive)");
ok(M.fixedPoints(0.5).length === 1, "R_m = 0.5: only x* = 0");
ok(M.classify(3.2, 0).text.startsWith("stays at 0") && M.classify(3.2, 1).text.startsWith("X_1 = 0") && M.classify(0, 0.4).text.startsWith("extinct"), "edge cases X_0 = 0, X_0 = 1, R_m = 0");
const a = M.errStart(0.95, 0.1), b = M.errStart(0.2, 0.1);
ok(near(a.x, 0.85, 1e-12) && a.minus && near(b.x, 0.3, 1e-12) && !b.minus, "error starts: 0.95 + 0.1 → 0.85 (minus), 0.2 + 0.1 → 0.3");
ok(near(M.errStart(0.5, 0.5).x, 1, 1e-12), "error start 0.5 + 0.5 = 1 stays");
let n = 0, top = 0;
M.bifurcation([3.2], 0.1, 1000, 200, (i, R, x) => { n++; top = Math.max(top, x); });
ok(n === 200 && near(top, 0.799455, 1e-6), "bifurcation: 200 values per R_m, the 2-cycle's top at R_m = 3.2");
console.log(fails ? `${fails} failed` : "all passed");
process.exit(fails ? 1 : 0);
