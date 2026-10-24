# Card 2 — Continuous-time logistic model

Read `pd-00-foundation.md` first (rules, set-up, shared code, box style, checks, testing). Step 0 must be done.
Reference: `/tmp/pd/Continuous_time_logistic_model/` (`README.md`, `Continuous_time_logistic_model.R`).

## 1. Files

| File | Change |
|---|---|
| `simulations/population-dynamics/continuous-logistic/index.html` | new page |
| `js/sims/continuous-logistic.js` | new: maths (`WQ.CLogistic`, testable in node) + page wiring |
| `tools/test-continuous-logistic.mjs` | new: node tests (section 7) |
| `simulations/index.html` | card `pd-2` becomes a link (pd-00 §3.2) |
| `README.md` | one row in "Where things are" |
| `css/site.css` | only if something is missing (prefer the shared classes) |

Scripts on the page: core, chalk, engine, plot, simkit, `continuous-logistic.js`, site (no `ode.js`:
this page uses the exact solution and its own Euler loop).

## 2. Header (compact)

- Kicker: `Deterministic population dynamics · 2`. Title: `Continuous-time logistic model`.
- Formula: `dx/dt = r_m x (1 − x)`, written `<i>dx</i>/<i>dt</i> = <i>r</i><sub>m</sub> <i>x</i> (1 − <i>x</i>)`.
- Notation rows:
  - `x` — population as a share of the carrying capacity `K` (`x = N/K`); it can start above 1
  - `r_m` — the largest growth rate per head (births − deaths, per unit time) when the population is tiny
  - `(1 − x)` — crowding: the growth rate per head falls linearly and reaches 0 at `K`
  - `t` — continuous time: births and deaths happen all the time, generations overlap
  - `Δt` — the step of the Euler method used in the owner's code: `x_{n+1} = x_n + r_m Δt x_n(1 − x_n)`

## 3. Controls (one row above panel A; they drive all three panels)

| id | Label | Range | Step | Default | Notes |
|---|---|---|---|---|---|
| `rm` | `r_m` | 0 – 3 | 0.001 | 0.11 | README example; readout 3 decimals |
| `x0` | `x_0` | 0 – 2 | 0.001 | 0.23 | README example |
| `tmax` | `t_max` | 10 – 300 | 1 | 100 | |
| `dt` | `Δt` | log slider: element `min="-3" max="0.30103" step="0.001" value="-2"` | | 0.01 | `WQ.Sim.slider(…, { log: true })`; model Δt = 10^value (0.001 … 2); readout 3 significant digits |

## 4. Maths (`WQ.CLogistic`, top of `js/sims/continuous-logistic.js`)

- `f(r, x) = r·x·(1 − x)`; `df(r, x) = r·(1 − 2x)`.
- Exact solution: `exact(x0, r, t)` = `x0` if `x0 === 0` or `r === 0`; otherwise `1 / (1 + (1/x0 − 1)·e^(−r t))`.
  (Valid for `x0 > 1` too: the denominator stays positive.)
- `tHalf(x0, r)`: time when `x = ½` — `ln((1 − x0)/x0)/r` for `0 < x0 < ½` and `r > 0`; `0` for `x0 = ½`;
  `null` otherwise (`x0 > ½` has passed it or never reaches it; `r = 0` never moves).
- `t99(x0, r)`: first time within 1 % of `K` — for `0 < x0 < 0.99`: `ln((1/x0 − 1)/(1/0.99 − 1))/r`;
  for `x0 > 1.01`: `ln((1 − 1/x0)/(1 − 1/1.01))/r`; `0` for `0.99 ≤ x0 ≤ 1.01`; `null` if `x0 = 0` or `r = 0`.
- Relaxation time `τ = 1/r_m` (`null` for `r = 0`).
- Euler run: `euler(x0, r, dt, tmax)` — `n = min(ceil(tmax/dt), 300000)` steps of
  `x ← x + r·dt·x·(1 − x)` (**no clamping**: the artifacts are the point). Stop early and set `status` if
  `x` is not finite or `|x| > 1e6` (`"blowup"`); record `wentNegative` (first index with `x < 0`),
  `crossedK` (any step from one side of 1 to the other). Return `{ t, x, n, status, wentNegative, crossedK, maxGap }`
  with `maxGap = max |x_n − exact(x0, r, n·dt)|` over the computed steps.
- Euler long run, `eulerLongRun(a, x0)` with `a = r·Δt` (independent of `t_max`): iterate the Euler map
  `y ← y + a·y·(1 − y)` `max(3000, 40/a)` times, at most 2·10⁶ (small steps settle slowly; stop with `"escapes"` if not finite or `|y| > 1e6`), then look for a
  period `p` in 1…64 (`|y_{n+p} − y_n| < 1e-7` for 256 values, as on card 1). If none: Lyapunov exponent
  `λ = mean of ln|1 + a − 2a·y|` over 4000 further steps; `λ > 0.001` → `"chaos"`, else `"slow"`.
  Returns `{ kind: "fixed" | "cycle" | "chaos" | "escapes" | "slow", period, values (the cycle, sorted), lambda }`.
- Why Euler behaves like card 1: with `X = a·y/(1 + a)` the Euler map becomes `X_{n+1} = R X_n (1 − X_n)`
  with **`R = 1 + a`**. So its long run follows card 1's thresholds shifted by one:
  `a = 2` (R = 3) first doubling, `a = √6 = 2.449490` (R = 3.449490) period 4, `a = 2.544090` period 8,
  `a = 2.569946` chaos begins, `a = √8 = 2.828427` period-3 window, `a > 3` (R > 4) escapes.
  It stays bounded only if `0 ≤ x0 ≤ (1 + a)/a`; above that the first step is negative and it runs off to −∞.
- Crossing `K` in one step (from `y` to `y_new`): `y_new − 1 = (1 − y)(a·y − 1)`. From below it crosses once
  `y > 1/a` (possible only when `a > 1`); from above (`x0 > 1`) it crosses when `a·x0 > 1`.

## 5. Panels

### A. Trajectory (`cv-traj`, `term-traj`)

Plot: `x` against `t ∈ [0, t_max]`. Exact solution: white line (`exact` at 600 points). Euler: yellow — dots
joined by a thin line when `n ≤ 120`, otherwise a line (at most 1500 points: take every k-th). Dashed white
line at `x = 1` labelled `K`; faint dotted line at `x = ½` labelled `½K`. y-axis from
`min(0, max(−0.5, 1.1·min Euler))` to `min(3, max(1.2, 1.1·max(x0, max Euler)))`. Legend: "exact", "Euler, Δt = …".
Caption: "The exact curve and the owner's Euler steps."

Box (example for the defaults; numbers from the maths, wording from the rules below):
```
> r_m = 0.110   x_0 = 0.230   Δt = 0.0100
> equilibria (dx/dt = 0), f'(x) = r_m(1 − 2x)
  x* = 0   f' = +0.110   unstable
  x* = 1   f' = −0.110   stable
  · at 0 a few individuals multiply (f' > 0)
  · at K a small push dies out (f' < 0)
> state: grows to K along an S-curve
  · half of K at t = 10.98, within 1% of K at t = 52.76
  · relaxation time 1/r_m = 9.09: near K the gap shrinks ×e every 9.09
> Euler: r_mΔt = 0.0011 → follows the exact curve
  · largest gap to the exact curve: 4.74e−5
```
State rules (first match):
- `r_m = 0` → `nothing changes (r_m = 0)`; why: `· births balance deaths at every density: every x is an equilibrium`.
- `x0 = 0` → `stays at 0: no population`; why: `· with nobody there, nobody is born`.
- `x0 = 1` → `stays at K`; why: `· at K births and deaths balance exactly`.
- `0 < x0 < ½` → `grows to K along an S-curve`; why: `· it speeds up until x = ½, then slows down as crowding grows`.
- `½ ≤ x0 < 1` → `grows to K, slowing all the way`; why: `· it starts past the fastest point x = ½`.
- `x0 > 1` → `declines to K`; why: `· above K deaths outnumber births (the growth rate per head r_m(1 − x) < 0)`
  and `· it never undershoots: a continuous curve cannot jump past K`.
Times: show `half of K at t = …` only when `tHalf` is not null; `within 1% of K at t = …` when `t99` is not null
(write `already within 1%` for 0); write `beyond t_max` (dim) when the time is larger than `t_max`.
Euler line `> Euler: r_mΔt = a → …` (first match), each with one why bullet:
- `a = 0` → `no change (r_m = 0)`.
- `x0 = 0` or `x0 = 1` → `stays put: x_0 is an equilibrium of the steps too`.
- status `"blowup"` or `wentNegative` → `warn("went below 0 at step n: impossible for a population")`, why
  `· x0 > (1 + r_mΔt)/(r_mΔt) = …: the first step overshoots past 0` (when that holds) or
  `· the step is too large: Euler overshoots past 0`.
- landed exactly on 0 (`x = 0` after a step from `x0 > 0`) → `warn("one step wiped the population out")`, why
  `· x0 = (1 + r_mΔt)/(r_mΔt): the step lands exactly on 0`.
- `a ≤ 0.01` → `follows the exact curve`.
- not `crossedK` → `monotone like the exact curve, slightly off`.
- long run `"fixed"` and `crossedK` → `crosses K, then damped wiggles`; why: `· the wiggles are the method's: the true curve never crosses K`.
- long run `"cycle"`, period 2 → `settles on a 2-cycle around K: a pure artifact`; why:
  `· Euler's step is card 1's map with R = 1 + r_mΔt = …; R > 3 doubles`.
- `"cycle"` 4 / 8 / ≥ 16 power of 2 → `settles on a p-cycle: artifact`; same why with the R value.
- `"cycle"`, other period → `a period-p window (as in card 1's chaos)`.
- `"chaos"` → `chaos: an artifact of the step (λ = …)`; why `· R = 1 + r_mΔt = … > 3.5699`.
- `"escapes"` → `warn("runs off to −∞: R = 1 + r_mΔt > 4")`.
- `"slow"` → `settles very slowly (r_mΔt is close to a threshold)`.
Always add `  · largest gap to the exact curve: …` (`fmtSig`) when the run did not blow up.

### B. Phase line (`cv-phase`, `term-phase`)

Plot: `dx/dt` against `x` for `x ∈ [0, max(1.5, 1.15·x0)]`: the parabola `f(r, x)` (white); the `x` axis;
arrows on the axis (yellow small triangles at 8 evenly spaced `x` values, not on the equilibria) pointing
right where `f > 0` and left where `f < 0`; equilibrium markers (`marker`): `x = 0` unstable, `x = 1` stable
(`r > 0`); a blue dot at `(x0, f(x0))` with a dotted vertical line. For `r = 0`: the curve is the axis itself;
draw no arrows and mark nothing; the box explains.
Caption: "Growth rate against density: arrows show which way x moves."

Box:
```
> dx/dt = r_m x(1 − x): a parabola, zero at 0 and at K
  · above the axis x grows (→), below it x falls (←)
  · every start x0 > 0 flows to K: K attracts, 0 repels
> fastest growth r_m/4 = 0.0275 at x = ½
> your start x_0 = 0.230: dx/dt = +0.0195 → moving right
```
Cases: `r = 0` → `> dx/dt = 0 everywhere (r_m = 0): nothing moves`; `x0 = 0` → `… dx/dt = 0: stays at 0`;
`x0 = 1` → `… stays at K`; `x0 > 1` → `dx/dt = −… ← moving left, down to K`.

### C. Growth rate over time (`cv-rate`, `term-rate`)

Plot: `dx/dt` along the exact solution, `g(t) = r·x(t)·(1 − x(t))`, for `t ∈ [0, t_max]` (white line).
Dashed yellow line at `r_m/4` labelled `r_m/4 (max)`; a filled yellow marker at `(tHalf, r_m/4)` when
`0 < x0 < ½` and `tHalf ≤ t_max`. y-axis from `min(0, 1.1·min g)` to `max(r/4, max g)·1.15`
(for `r = 0`: from −0.01 to 0.01).
Caption: "How fast the population grows, over time."

Box:
```
> growth rate dx/dt over time
> peak r_m/4 = 0.0275 at t = 10.98, when x = ½
  · numbers (x) times room left (1 − x) is largest at x = ½
  · that moment is the S-curve's inflection: growth speeds up before it and slows after
  · r_m/4 is also the largest constant harvest this population can survive (card 3, Type 0)
```
Cases: `½ ≤ x0 ≤ 1` → `> the peak was before t = 0 (x_0 ≥ ½): growth only slows`;
`x0 > 1` → `> dx/dt < 0: the population shrinks toward K, fastest at the start`;
`x0 = 0` or `r = 0` → `> dx/dt = 0 at all times`; `tHalf > t_max` → `> the peak comes at t = …, after t_max`.

## 6. Theory bullets (in this order; maths in `.m`)

1. **Assumptions.** Time is continuous; the population is large and well mixed (a mean field); no age or sex
   structure; births and deaths are spread evenly over time; only births and deaths change it (closed); the
   growth rate per head falls linearly with crowding, `r = r_m(1 − N/K)`.
2. **The model.** Over a short time `Δt`, `Δx ≈ r_m x (1 − x) Δt`; letting `Δt → 0` gives
   `dx/dt = r_m x(1 − x)`.
3. **Equilibria.** `x* = 0` and `x* = 1` (`N* = K`). With `f′(x) = r_m(1 − 2x)`: `f′(0) = r_m > 0`, so 0 is
   unstable; `f′(1) = −r_m < 0`, so `K` is stable.
4. **Exact solution.** `x(t) = 1 / (1 + (1/x_0 − 1) e^(−r_m t))`: an S-curve from below, a smooth decline from
   above. It never crosses `K`.
5. **Fastest growth** is `r_m/4`, at `x = ½`, reached at `t = ln((1 − x_0)/x_0)/r_m` (for `x_0 < ½`).
6. **No oscillations.** Unlike card 1 (non-overlapping generations), the continuous model cannot overshoot:
   its only change of behaviour is at `r_m = 0`, where 0 and `K` swap stability.
7. **The Euler method** `x_{n+1} = x_n + r_m Δt x_n(1 − x_n)` is card 1's map with `R = 1 + r_m Δt`. A large
   step therefore shows overshoot, cycles and chaos that belong to the method, not to the model; keep
   `r_m Δt` well below 1.
8. **Negative `r_m`.** The README allows `r_m < 0` (then `K < 0` in its notation); the sliders keep `r_m ≥ 0`,
   where `K` is a real carrying capacity. If births never exceed deaths the population simply declines to 0.

GitHub button: `Read the full write-up on GitHub` →
`https://github.com/ashutosh-shinde/Population-Dynamics/blob/master/Continuous_time_logistic_model/README.md`.

## 7. Node tests (`tools/test-continuous-logistic.mjs`; load `js/lib/simkit.js` then the sims file with `vm`)

| Case | Expect |
|---|---|
| `exact(0.23, 0.11, 100)` | 0.999944 (±1e-6) |
| `tHalf(0.23, 0.11)` | 10.9846 (±1e-4), and `exact(0.23, 0.11, tHalf)` = 0.5 (±1e-9) |
| `tHalf(0.1, 1)` | ln 9 = 2.197225 (±1e-6) |
| `tHalf(0.5, 1)`, `tHalf(0.7, 1)`, `tHalf(2, 1)`, `tHalf(0.3, 0)` | 0, null, null, null |
| `exact(2, 0.5, 5)` | 1.042799 (±1e-6) |
| `t99(0.23, 0.11)`, `t99(0.1, 1)`, `t99(2, 1)` | 52.7585, 6.7923, 3.9220 (±1e-4) |
| `t99(0, 1)`, `t99(1, 1)`, `t99(0.5, 0)` | null, 0, null |
| `exact(x0, 0, t)`, `exact(0, r, t)` | x0, 0 |
| `euler(0.23, 0.11, 0.01, 100).maxGap` | 4.741e-5 (±2 %) |
| `euler(0.1, 1, 0.1, 20).maxGap`, `Δt 0.5`, `Δt 1` | 0.0128, 0.0642, 0.1210 (±0.0005) |
| `eulerLongRun(0.5, 0.23)`, `(1.5, 0.23)` | fixed at 1 |
| `eulerLongRun(2.2, 0.23)` | cycle, period 2, values 0.7462 and 1.1628 (±1e-4) |
| `eulerLongRun(2.5, 0.23)`, `(2.55, 0.23)`, `(2.83, 0.23)` | periods 4, 8, 3 |
| `eulerLongRun(2.6, 0.23)`, `(3.0, 0.23)` | chaos, λ > 0 |
| `eulerLongRun(3.05, 0.23)` | escapes |
| `euler(2, 1, 1, 10)` | first step lands on 0 exactly, then stays 0 ("wiped out" case) |
| `euler(2, 0.6, 1, 10)` (a = 0.6, x0 = 2) | first step 0.8: crossed K from above although a < 1 |
| `euler(1.6, 2, 1, 10)` (a = 2, x0 = 1.6 > 1.5) | first step −0.32: wentNegative = 1, then blowup |

Note: do not test the Euler long run from `x0 = 0.2` with `a = 2.5`: that start lands exactly on the unstable
2-cycle {0.6, 1.2} and stays there in floating point (a true but misleading coincidence).

## 8. Runtime checks (`?check=1`)

- `exact(x0, r, 0) = x0` (±1e-12); along the 600 points, `|x(t) − 1|` never increases.
- When `tHalf` is shown: `|exact(tHalf) − ½| < 1e-9`; the peak of `g` in panel C equals `r/4` (±1e-9·max(r, 1)).
- When `a ≤ 0.01`: Euler `maxGap < 0.01`.
- The Euler long-run label agrees with the threshold table in §4 (for `x0 ∈ (0, (1+a)/a)` and `a` not within
  0.002 of a threshold).
- Every number written in the boxes is finite.

## 9. Things to look at in the screenshots

Defaults; `r_m = 1, Δt = 1.5` (damped wiggles); `r_m = 1.1, Δt = 2` (2-cycle); `r_m = 1.3, Δt = 2` (chaos,
a = 2.6); `x0 = 2, r_m = 1, Δt = 1` (wiped out); `x0 = 1.8` (decline); `r_m = 0`; `x0 = 0`. In each the boxes
must read correctly and the plots must show what the box says.
