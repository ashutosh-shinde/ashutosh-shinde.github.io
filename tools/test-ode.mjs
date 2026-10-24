// test-ode.mjs — checks the shared solvers and helpers (js/lib/ode.js, js/lib/simkit.js) against known
// values. Run: node tools/test-ode.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const load = (rel, ctx) => vm.runInContext(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8"), ctx);
const ctx = vm.createContext({ Math, Float64Array, Number, Array, Object, String, ArrayBuffer, Date, console, URLSearchParams });
ctx.globalThis = ctx;
load("../js/lib/ode.js", ctx); load("../js/lib/simkit.js", ctx);
const { ODE, Sim } = ctx.WQ;

let fails = 0;
const ok = (cond, what) => { console.log((cond ? "  ok   " : "  FAIL ") + what); if (!cond) fails++; };
const near = (a, b, tol) => Number.isFinite(a) && Math.abs(a - b) <= tol;
const last = (r, i = 0) => r.y[i][r.n - 1];
const tight = { rtol: 1e-10, atol: 1e-12 };

let r = ODE.solve((t, y, d) => { d[0] = -y[0]; }, [1], 0, 5, tight);
ok(r.status === "ok" && near(last(r), Math.exp(-5), 1e-8), `y' = -y: y(5) = ${last(r)} (e^-5 = 0.006737947)`);

r = ODE.solve((t, y, d) => { d[0] = y[0] * (1 - y[0]); }, [0.1], 0, 5, tight);
ok(near(last(r), 1 / (1 + 9 * Math.exp(-5)), 1e-7), `logistic: y(5) = ${last(r).toFixed(7)} (0.942826)`);

r = ODE.solve((t, y, d) => { d[0] = y[1]; d[1] = -y[0]; }, [1, 0], 0, 100, { ...tight, nonneg: false });
const x = last(r, 0), v = last(r, 1);
ok(near(x * x + v * v, 1, 1e-6) && near(x, Math.cos(100), 1e-5), `harmonic: x(100) = ${x.toFixed(6)} (cos 100 = 0.862319), x²+v² = ${(x * x + v * v).toFixed(9)}`);

const V = (N, P) => N - Math.log(N) + P - Math.log(P);
r = ODE.solve((t, y, d) => { d[0] = y[0] - y[0] * y[1]; d[1] = y[0] * y[1] - y[1]; }, [0.5, 0.5], 0, 50, tight);
let drift = 0; for (let k = 0; k < r.n; k++) drift = Math.max(drift, Math.abs(V(r.y[0][k], r.y[1][k]) - V(0.5, 0.5)));
ok(near(V(0.5, 0.5), 2.386294, 1e-6) && drift < 1e-6, `Lotka–Volterra: V = ${V(0.5, 0.5).toFixed(6)}, largest drift ${drift.toExponential(2)}`);

r = ODE.solve((t, y, d) => { d[0] = -y[0]; }, [1], 0, 5, { stop: (t, y) => y[0] < 0.5 });
ok(r.status === "stopped" && near(r.tEnd, Math.LN2, 1e-3), `stop when y < 0.5: status ${r.status}, tEnd ${r.tEnd.toFixed(4)} (ln 2 = 0.6931)`);

let threw = false;
try { r = ODE.solve((t, y, d) => { d[0] = y[0] * y[0]; }, [1], 0, 2); } catch (e) { threw = true; }
ok(!threw && r.status === "blowup" && r.tEnd < 1.0001, `y' = y² from 1: status ${r.status}, tEnd ${r.tEnd}`);

r = ODE.solve((t, y, d) => { d[0] = Math.cos(t * 50); }, [0], 0, 1000, { maxSteps: 10 });
ok(r.status === "maxsteps", `maxSteps 10: status ${r.status}`);

r = ODE.solve((t, y, d) => { d[0] = -10; }, [1], 0, 1);
let minv = Infinity; for (let k = 0; k < r.n; k++) minv = Math.min(minv, r.y[0][k]);
ok(minv >= 0, `nonneg on y' = -10: smallest sample ${minv}`);

r = ODE.solve((t, y, d) => { d[0] = -y[0]; }, [1], 0, 5, { floor: 0.25 });
minv = Infinity; for (let k = 0; k < r.n; k++) minv = Math.min(minv, r.y[0][k]);
ok(minv >= 0.25 && last(r) === 0.25, `floor 0.25: smallest ${minv}, last ${last(r)}`);

r = ODE.solveStiff((t, y, d) => { d[0] = -2 * y[0] + 1; }, (t, y, J) => { J[0] = -2; }, [0], 0, 1);
ok(near(last(r), (1 - Math.exp(-2)) / 2, 1e-4), `ROS2 y' = -2y + 1: y(1) = ${last(r).toFixed(6)} (0.432332)`);

// the stiff consumer–resource corner of pd-05 §8
const p = { I: 30, b1: 10, b2: 3, R01: 0.1, R02: 5, g1: 2, g2: 1, d1: 0.01, d2: 0.8 };
const crf = (t, s, d) => {
  const [C1, C2, R] = s, u1 = p.b1 * R / (p.R01 + R), u2 = p.b2 * R / (p.R02 + R);
  d[0] = C1 * (p.g1 * u1 - p.d1); d[1] = C2 * (p.g2 * u2 - p.d2); d[2] = p.I - u1 * C1 - u2 * C2;
};
const crj = (t, s, J) => {
  const [C1, C2, R] = s, u1 = p.b1 * R / (p.R01 + R), u2 = p.b2 * R / (p.R02 + R), du1 = p.b1 * p.R01 / (p.R01 + R) ** 2, du2 = p.b2 * p.R02 / (p.R02 + R) ** 2;
  J[0] = p.g1 * u1 - p.d1; J[1] = 0; J[2] = C1 * p.g1 * du1;
  J[3] = 0; J[4] = p.g2 * u2 - p.d2; J[5] = C2 * p.g2 * du2;
  J[6] = -u1; J[7] = -u2; J[8] = -du1 * C1 - du2 * C2;
};
const rel = (a, b) => Math.abs(a - b) / Math.abs(b);
let s5 = ODE.solveStiff(crf, crj, [5, 5, 10], 0, 5);
ok(s5.status === "ok" && rel(last(s5, 0), 314.962767) < 1e-3 && rel(last(s5, 1), 0.106442181) < 1e-3 && rel(last(s5, 2), 9.61656906e-4) < 1e-3,
  `ROS2 stiff C–R corner, t = 5: (${last(s5, 0).toFixed(3)}, ${last(s5, 1).toFixed(6)}, ${last(s5, 2).toExponential(5)}), ${s5.steps} steps`);
s5 = ODE.solveStiff(crf, crj, [5, 5, 10], 0, 50);
ok(s5.status === "ok" && rel(last(s5, 0), 2375.06129) < 1e-3 && last(s5, 1) < 1e-6 && rel(last(s5, 2), 1.26472288e-4) < 1e-3 && s5.steps < 100000,
  `ROS2 stiff C–R corner, t = 50: (${last(s5, 0).toFixed(3)}, ${last(s5, 1).toExponential(2)}, ${last(s5, 2).toExponential(6)}), ${s5.steps} steps`);

const lab = (a, b, c, d) => ODE.classify2(ODE.eig2(a, b, c, d)).label;
let e = ODE.eig2(0, -1, 1, 0);
ok(e.complex && near(e.re1, 0, 1e-12) && near(Math.abs(e.im1), 1, 1e-12) && lab(0, -1, 1, 0) === "center", `eig2 [[0,-1],[1,0]]: ±i → ${lab(0, -1, 1, 0)}`);
e = ODE.eig2(-1, 0, 0, -0.4);
ok(!e.complex && near(e.re1, -1, 1e-12) && near(e.re2, -0.4, 1e-12) && lab(-1, 0, 0, -0.4) === "stable node", `eig2 diag(-1, -0.4) → ${lab(-1, 0, 0, -0.4)}`);
ok(lab(-1, -0.6, 0, 0.4) === "saddle", `eig2 [[-1,-0.6],[0,0.4]] → ${lab(-1, -0.6, 0, 0.4)}`);
e = ODE.eig2(-0.4, -2, 0.3, 0);
ok(e.complex && near(e.re1, -0.2, 1e-12) && near(Math.abs(e.im1), 0.748331, 1e-6) && lab(-0.4, -2, 0.3, 0) === "stable spiral", `eig2 tr -0.4 det 0.6: -0.2 ± ${Math.abs(e.im1).toFixed(6)}i → ${lab(-0.4, -2, 0.3, 0)}`);
ok(lab(1, 0, 0, 1e-12) === "non-hyperbolic", `eig2 diag(1, 1e-12) → ${lab(1, 0, 0, 1e-12)}`);
ok(ODE.classify2(ODE.eig2(-1, 0, 0, -1)).repeated, "repeated eigenvalue flagged");
ok(near(ODE.bisect((u) => u * u - 2, 0, 2), Math.SQRT2, 1e-12), "bisect √2");
const J = ODE.jacFD((t, y, d) => { d[0] = y[0] * y[1]; d[1] = y[0] - y[1] * y[1]; }, Float64Array.from([2, 3]));
ok(near(J[0], 3, 1e-6) && near(J[1], 2, 1e-6) && near(J[2], 1, 1e-6) && near(J[3], -6, 1e-6), "jacFD");

ok(Sim.fmt(NaN) === "—" && Sim.fmtSig(Infinity) === "∞" && Sim.fmt(-0.5, 2) === "−0.50", `fmt: ${Sim.fmt(NaN)}, ${Sim.fmtSig(Infinity)}, ${Sim.fmt(-0.5, 2)}`);
ok(Sim.fmtSig(4.741e-5) === "4.74e−5" && Sim.fmtSig(0) === "0" && Sim.fmtSig(1.12111) === "1.121" && Sim.signed(0.2) === "+0.200" && Sim.fmt(undefined) === "—",
  `fmtSig: ${Sim.fmtSig(4.741e-5)}, ${Sim.fmtSig(0)}, ${Sim.fmtSig(1.12111)}, signed ${Sim.signed(0.2)}`);
ok(Sim.subs(Sim.esc("R_m < 1, α_21 K_2")) === "R<sub>m</sub> &lt; 1, α<sub>21</sub> K<sub>2</sub>", `subs: ${Sim.subs(Sim.esc("R_m < 1, α_21 K_2"))}`);
const html = Sim.termHTML(["> a", [Sim.hi("b"), " c"], Sim.why("d"), Sim.warn("x_0 < 0")]);
ok(html.includes('<span class="term__hi">b</span> c') && html.includes('<span class="term__why">  · d</span>') && html.includes("x<sub>0</sub> &lt; 0") && html.endsWith('aria-hidden="true"></span>'), "termHTML");
ok(Sim.checking === false, "checking is off in node");

console.log(fails ? `${fails} failed` : "all passed");
process.exit(fails ? 1 : 0);
