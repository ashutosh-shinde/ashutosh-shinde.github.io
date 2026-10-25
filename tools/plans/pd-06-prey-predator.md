# Card 6 — Prey–predator models

Read `pd-00-foundation.md` first. Steps 0, 2, 3, 4 and 5 must be done.
Reference: `/tmp/pd/Two_species_population_models/` (`README.md` section 3, `Prey_predator_dynamics.R`).

## 1. Files

| File | Change |
|---|---|
| `simulations/population-dynamics/prey-predator/index.html` | new page |
| `js/sims/prey-predator.js` | new: maths (`WQ.PP`) + page wiring |
| `tools/test-prey-predator.mjs` | new: node tests (section 8) |
| `simulations/index.html` | card `pd-6` becomes a link |
| `README.md` | one row |
| `css/site.css` | only if something is missing |

Scripts: core, chalk, engine, plot, ode, simkit, `prey-predator.js`, site.

## 2. Header and the three models

Kicker `Deterministic population dynamics · 6`, title `Prey–predator models`. General form (the README's):
`dN/dt = f(N) − h(N, P)`, `dP/dt = γ·h(N, P) − δP`. Notation rows: `N` prey, `P` predators; `f(N)` prey growth
without predators; `h(N, P)` the rate predators kill prey (functional response); `γ` how many new predators one
eaten prey makes; `δ` predator death rate.

Model switch `<div class="sim-seg" id="model" role="group" aria-label="Model">` (default `LV`):

| Button | Model | Equations |
|---|---|---|
| `Lotka–Volterra` | `LV` | `dN/dt = rN − βNP`, `dP/dt = γβNP − δP` |
| `Volterra (logistic prey)` | `Vt` | `dN/dt = rN(1 − N/K) − βNP`, `dP/dt = γβNP − δP` |
| `Rosenzweig–MacArthur` | `RM` | `dN/dt = rN(1 − N/K) − βNP/(N₀ + N)`, `dP/dt = γβNP/(N₀ + N) − δP` |

Show the chosen model's equations in the header formula (update it when the model changes).

## 3. Controls (each model keeps its own values)

| id | Label | Models | Range | Step | LV | Vt | RM |
|---|---|---|---|---|---|---|---|
| `r` | `r` | all | 0.1 – 3 | 0.01 | 1 | 1 | 1 |
| `b` | `β` | all | 0.05 – 3 | 0.01 | 1 | 0.5 | 2 |
| `g` | `γ` | all | 0.05 – 1.5 | 0.01 | 1 | 0.5 | 0.8 |
| `d` | `δ` | all | 0.05 – 3 | 0.01 | 1 | 1 | 0.5 |
| `K` | `K` | Vt, RM | 1 – 100 | 0.5 | — | 10 | 60 |
| `N0` | `N_0` | RM | 1 – 30 | 0.1 | — | — | 10 |
| `Ns` | `N(0)` | all | 0 – 100 | 0.1 | 0.5 | 3 | 3 |
| `Ps` | `P(0)` | all | 0 – 100 | 0.1 | 0.5 | 3 | 3 |
| `tmax` | `t_max` | all | 10 – 500 | 10 | 50 | 50 | 300 |

Presets (rebuilt per model; from the README):
- LV: `README 1: r = β = γ = δ = 1` · `README 2: r 1.5, β 0.5, γ 0.8, δ 1.2`
- Vt: `README 1: K 10` (r 1, β 0.5, γ 0.5, δ 1) · `README 2: K 1.5 (predator dies)`
- RM (r 1, β 2, N₀ 10, γ 0.8, δ 0.5): `K 2` · `K 15` · `K 18` · `K 19` · `K 19.5` · `K 60`
Default starts for panel A (as in the README): LV `(0.5, 0.5), (1.5, 1.5), (2, 0.5), (0.3, 2)`; Vt and RM
`(0.5, 0.5), (3, 3), (8, 1), (1, 0.2)`. `Clear my starts` button (`clear-taps`) under panel A.

## 4. Maths (`WQ.PP`)

- Right-hand sides and Jacobians exactly as in the owner's code (`jacobian_LV`, `jacobian_Vt`, `jacobian_RM`).
- LV: `e0 = (0, 0)` saddle (eigenvalues `r`, `−δ`); `e1 = (δ/(γβ), r/β)` a centre, eigenvalues `±i√(rδ)`;
  small cycles have period `2π/√(rδ)`. Conserved quantity `V(N, P) = γβN − δ ln N + βP − r ln P`.
- Vt: `e0` saddle; `e1 = (K, 0)` with eigenvalues `−r` and `γβK − δ` (stable iff `K < δ/(γβ)`: predators starve);
  `e2 = (N*, P*)`, `N* = δ/(γβ)`, `P* = (r/β)(1 − N*/K)`, exists iff `N* < K`; there `tr = −rN*/K < 0`,
  `det = γβ²N*P* > 0` → always stable; a spiral when `tr² < 4·det`, a node otherwise (`K` just above `N*`, or a very large `r`).
- RM: `N* = δN₀/(γβ − δ)` if `γβ > δ` (else the predator can never grow); `P* = (r/β)(1 − N*/K)(N₀ + N*)`;
  `e1 = (K, 0)` eigenvalues `−r` and `γβK/(N₀ + K) − δ`; `e2` exists iff `0 < N* < K`; **stable iff
  `K < K_H = N₀ + 2N*`** (Hopf point); for `K > K_H` the orbits approach a stable limit cycle.
- Integration: `WQ.ODE.solve`, `rtol 1e-9`, `atol 1e-11·scale`, `samples 800`, `nonneg`.
- Limit cycle (RM, `K > K_H`): integrate from `(1.05·N*, P*)` for `t ∈ [0, 1500]` (`samples 3000`), keep the
  last 500 time units: their min/max of `N` and `P`, and one loop (from one prey peak to the next) to draw.
  (Replaced in the review: the period can be far longer than that window, see the note at the end.)
- Measures from a run (panel B): prey peaks = local maxima of `N` (samples where `N[i−1] < N[i] ≥ N[i+1]`,
  ignoring peaks smaller than 1 % of the run's range); period = mean gap between successive peaks; lag = mean time
  from a prey peak to the next predator peak, as a fraction of the period; amplitude = max − min of `N` over the
  last full period. Need at least two peaks, else "no oscillation".

## 5. Panels

### A. Phase plane (`cv-phase`, `term-phase`; `sim-plot--phase`)

Direction field; prey nullclines (yellow dashed): `N = 0` and LV `P = r/β`, Vt `P = (r/β)(1 − N/K)`, RM
`P = (r/β)(1 − N/K)(N₀ + N)` (a hump with its top at `N = (K − N₀)/2`); predator nullclines (pink dashed):
`P = 0` and `N = N*`. Orbits: the default starts (thin white, `arrowAt: 0.3`), the slider start (thicker), taps
(thicker; the last one also sets `N(0), P(0)`); for RM with `K > K_H` the limit cycle in orange (2 px).
Equilibrium markers with labels. Axes from the data: `N` to `1.08 × max(N over the orbits, N*, K for Vt/RM)`,
`P` to `1.08 × max(P over the orbits, P*)`. Caption: "Prey (across) and predators (up). Tap to add a start."

Box A (LV defaults; real numbers):
```
> Lotka–Volterra · r 1.00, β 1.00, γ 1.00, δ 1.00
> equilibria · eigenvalues · type
  e0 (0, 0)        −1.000, +1.000      saddle
  e1 (1.000, 1.000)  ±1.000i           centre
> regime: neutral cycles around e1
  · prey are held back only by predators, predators only by lack of prey: nothing damps the swings
  · each orbit keeps V = γβN − δ ln N + βP − r ln P constant, so it closes on itself
  · bigger starts → bigger cycles; small ones last 2π/√(rδ) = 6.28
```
Regimes and their why bullets:
- Vt, `K ≤ N*` → `> regime: the predator dies out, prey settle at K`; `· even at K the prey cannot feed predators:
  γβK − δ = … < 0`.
- Vt spiral → `> regime: damped oscillations into e2 (stable spiral)`; `· prey crowding (logistic growth) takes
  energy out of each swing`; `· e2 = (…, …), eigenvalues −0.200 ± 0.748i` (defaults).
- Vt node → `> regime: e2 is a stable node: no oscillation`; `· prey crowding damps faster than the swing can turn: tr² = … ≥ 4·det = …`, `· this happens when K is just above δ/(γβ) (little prey to drive a swing) or when the prey grows very fast`.
- RM `γβ ≤ δ` → `> the predator can never grow: γβ ≤ δ even with endless prey`.
- RM `K ≤ N*` → like Vt.
- RM `N* < K < K_H` → `> regime: damped oscillations into e2`; `· K < K_H = N_0 + 2N* = …`; if
  `K > 0.98·K_H`: `· near the Hopf point: the swings die out very slowly`.
- RM `K > K_H` → `> regime: a limit cycle (sustained oscillations)`; `· e2 is an unstable spiral: orbits spiral out
  to the orange cycle`; `· the paradox of enrichment: more food for the prey destabilises the system`; if the
  cycle's prey minimum is below 0.01·K: `warn("the prey falls to … each cycle: in a real population that risks extinction")`.

### B. Time series (`cv-time`, `term-time`)

`N(t)` yellow, `P(t)` pink for `t ∈ [0, t_max]` from `(N(0), P(0))`; dashed lines at `N*`, `P*` when they exist.
Caption: "Prey and predators over time: the predator peaks follow the prey peaks."

Box B (LV defaults from (0.5, 0.5); real numbers):
```
> period ≈ 6.69 (prey peaks at t = 2.79, 9.49, 16.18, …)
> predator peaks lag the prey by ≈ 1.10 (0.16 of a period)
  · predators multiply while prey are plenty, then overeat them
> prey swing between 0.357 and 2.153
> V stays 2.386294 → 2.386294 (drift < 1e−6)
```
Cases: Vt/RM damped → add `> the swings shrink ×… per cycle near e2` with factor `e^(2π·Re λ/|Im λ|)` (Vt
defaults: ×0.187); RM cycle → `> it settles on the cycle: prey between … and …`; predator extinct →
`> the predator declines ×e every 1/|γβK − δ| = …` (Vt `K 1.5`: rate −0.625, so 1.60); `N(0) = 0` → `> no prey:
the predators starve (P halves every ln 2/δ)`; `P(0) = 0` → `> no predators: the prey grow (LV without limit, Vt/RM to K)`;
fewer than two peaks → `> no oscillation within t_max`. LV only: if the drift of `V` is above 1e-6 (relative),
`warn("the solver drifted")`.

### C. Effect of enrichment K (`cv-k`, `term-k`; Vt and RM only — for LV hide this panel and show one line in
box A: `· LV has no K: alone, the prey grow without limit`)

Scan `K` from 1 to 100 (step 0.5): `K ≤ N*` → the prey equilibrium is `K` (white solid line), predator absent;
`N* < K` → `N*` (white solid where stable; dashed for RM `K > K_H`); RM `K > K_H` → the cycle's min and max of `N`
(orange band, `band`). Vertical lines: `K = N*` (blue, "predator can live") and RM `K = K_H` (pink, "Hopf"); yellow
marker at the current `K`. The RM scan is heavy (≈ 100 integrations): compute it debounced and progressively, and
cache it until `r, β, γ, δ, N₀` change (moving `K` only moves the marker). Caption: "The prey level against K:
above the Hopf point it swings within the orange band."

Box C (RM defaults; real numbers):
```
> predators can live once K > N* = 4.545
> Hopf point K_H = N_0 + 2N* = 19.09
> now K = 60: a limit cycle, prey between 0.0001 and 57.98
  · a richer prey peak feeds a predator boom, which crashes the prey: the swings grow
  · Type II predation saturates, so predators cannot hold a rich prey population steady
```
Vt: `> predators can live once K > N* = …`, `> no Hopf point: e2 stays stable for every K > N*`,
`· with Type I predation, enrichment never destabilises`. Near `K_H`: `· near K_H the swings grow or die very
slowly: a run takes long to reach the band` (the band itself is exact there: see the note at the end).

## 6. Theory bullets

1. **General form.** Prey: growth without predators minus predation; predators: converted predation minus deaths.
2. **Lotka–Volterra** (exponential prey, Holling I predation): `e1 = (δ/(γβ), r/β)` is a centre; orbits are
   closed curves of `V`; cycles never decay or grow (neutral, Lyapunov stable but not asymptotically stable).
3. **Volterra** (logistic prey): predators can live only if `K > δ/(γβ)`; then `e2` is stable: a spiral for most
   values, a node when `K` is just above `δ/(γβ)` or the prey grows very fast.
4. **Rosenzweig–MacArthur** (logistic prey, Holling II predation): `N* = δN₀/(γβ − δ)`; `e2` is stable for
   `K < K_H = N₀ + 2N*`, where the top of the prey nullcline lies left of `N*`; beyond `K_H` (a Hopf bifurcation)
   a stable limit cycle appears.
5. **The paradox of enrichment.** Raising `K` (more food for the prey) destabilises the RM system: the opposite of
   the Volterra model.
6. **Predators lag prey.** Predator peaks follow prey peaks (a quarter of a period for small LV cycles).
7. **Classification** of equilibria from the Jacobian's eigenvalues, as in the README's table (spiral, node,
   saddle, centre; non-hyperbolic cases need the nonlinear terms).

GitHub button → `…/Two_species_population_models/README.md#3-prey-predator-models` (check the anchor).

## 7. Edge cases

`N(0) = 0`; `P(0) = 0`; both 0; `K = 1` with `N* > K`; RM `γβ ≤ δ` (`γ 0.05`, `β 0.05`); `δ = 3, r = 0.1`; RM
`K = K_H` exactly; huge LV cycles from `(100, 100)` (axes from data; `V` must stay constant); `t_max = 500` with RM.
Never NaN; plots always drawn.

## 8. Node tests (`tools/test-prey-predator.mjs`; load `ode.js`, `simkit.js`, the sims file)

| Case | Expect |
|---|---|
| LV 1,1,1,1 | e1 (1, 1), eigenvalues ±1i → centre; e0 saddle (−1, 1); small-cycle period 6.2832 |
| LV from (0.5, 0.5), t 50 | V 2.386294 at start and end (±1e-6); prey peaks ≈ 2.79, 9.49, 16.18, 22.88 (±0.02); period ≈ 6.69 (±0.02); predator peaks ≈ 3.90, 10.59; prey range 0.3574 – 2.1533 (±1e-3) |
| LV README 2 (r 1.5, β 0.5, γ 0.8, δ 1.2) | e1 (3, 3); small-cycle period 4.6832 |
| Vt README 1 | e2 (4, 1.2); tr −0.4, det 0.6; eigenvalues −0.2 ± 0.74833i → stable spiral; e1 (10, 0) saddle (−1, 1.5) |
| Vt README 2 (K 1.5) | no e2; e1 (1.5, 0) stable node (−1, −0.625) |
| Vt K 4.2 / 5 / 6 | e2 stable node (−0.89944, −0.05294) / spiral −0.4 ± 0.2i / spiral −0.33333 ± 0.4714i |
| RM base (r 1, β 2, N₀ 10, γ 0.8, δ 0.5) | N* 4.545455; K_H 19.090909 |
| RM K 2 | e1 (2, 0) stable node (−1, −0.23333); no e2 |
| RM K 15 / 18 / 19 | e2 stable spiral, real parts −0.04261 / −0.00947 / −0.00075 |
| RM K 19.5 / 30 / 60 | e2 unstable spiral, real parts +0.00328 / +0.05682 / +0.10653; cycle prey range ≈ 2.879 – 6.757 / 0.145 – 22.97 / 0.0001 – 57.98 (±2 %) |

## 9. Runtime checks (`?check=1`)

- Each equilibrium: `|f| < 1e-9·scale`; analytic and `jacFD` eigenvalues agree (±1e-5).
- LV: relative drift of `V` along every orbit below 1e-6.
- RM: `e2`'s real part is negative iff `K < K_H` (skip within 1e-6 of `K_H`).
- RM cycle (when `K > K_H`): its prey min is below `N*` and its max above `N*`.
- Orbits stay ≥ 0 and finite.

(Found while building and in the review, now in the code: every run with both populations above 0 is
integrated in log coordinates (`x = ln N`, `y = ln P`; `rtol = atol = 1e-12` for LV, `1e-10` for Vt and RM,
`1e-8` for the RM scan): the prey can fall to 1e−30 and far below (a big LV cycle, a predator boom, a rich RM
cycle), far below any absolute tolerance in `N`, and a plain integration then let it recover tens of time
units too early (checked against scipy's DOP853), and LV's V drifted by 70 % from (100, 100). A start on an
axis uses the exact solution (`P(0)e^(−δt)`; the prey's exponential, stopped at 10⁹ as the solvers do, or its
logistic). V's drift is measured against the size of its terms (`γβN + δ|ln N| + βP + r|ln P|`), since V itself
can be near 0, and V is computed from the logs. The limit cycle runs 1000 time units to settle, then samples
the last 500 every 0.1, and its extremes are refined by a parabola through the logs (they match scipy to
4 digits). A run that grows without limit only stretches the phase plane's axes to 3× the rest. The K panel's
threshold labels sit on two rows; the Volterra scan's y range follows `N*`. On a phone the long RM formula
wraps. Period and lag come from the last (up to) four cycles, so a transient does not skew them, and box B
also gives the linear period `2π/|Im λ|` near a stable spiral. Tick labels from 10⁵ up are written `m×10ⁿ`
(plot.js), so a prey stopped at 10⁹ still has readable axes.)

(Second review, before the merge to master:
- **The RM limit cycle is found on a section.** Its period can be a few time units or ~91 000 (r 0.1, δ 0.05,
  N₀ 1, K 100: the prey fall to e^−8978), and the fixed window above was then wrong: for r 0.6, β 2.79,
  γ 1.34, δ 0.18, K 73, N₀ 3.5 (period 783) it reported prey between 1e−141 and 2e−11 instead of 1.8e−185 and
  73. Now: the section is `N = N*` below e2 (every orbit around e2 crosses it once per turn, moving right); a
  turn is two solves (until `N < N*`, then `N ≥ N*`); the first starts near `e1 = (K, 0)` (`0.999K`,
  `10⁻⁶P*`), at the cycle's rim, where orbits close in within a few turns (from near e2 they can spiral out for
  tens of thousands of time units); turns repeat until two agree, with an Aitken step on the section's ln P
  when they close in slowly (near the Hopf point); one more turn is sampled for `N`'s extremes and the loop,
  while `P`'s extremes are the two crossings themselves (dP/dt = 0 on `N = N*`). Checked against long scipy
  runs on 70 cases (worst 5e−5) and from scipy started on the fixed point. A prey minimum below 1e−300 is
  printed from its log. The page's cycle comes from the K scan's cache (the same computation as the band),
  the scan starts 200 ms after the last change of `r, β, γ, δ, N₀` with the current `K` first, and the boxes say
  "computing the cycle…" meanwhile; box B says when the run is still on its way to the cycle by `t_max`.
- **LV runs are one period, repeated.** In logs every orbit circles e1 anticlockwise and crosses the four
  half-axes through e1 in turn, at its extremes; five solves give the period and the extremes exactly, and a
  second pass gives the samples at `t mod T`. V cannot drift, a long `t_max` costs one period, the time series
  contains every extreme (a big cycle's sharp spike is drawn at its true height: 95.74 from (50, 50), where
  even samples gave 78–93), and the phase plane draws each orbit as its one closed loop (a fast cycle sampled
  every unit of time had become a starburst). Period, lag and the prey's swing in box B are exact for them.
- **Speed.** The faint orbits and taps are kept until a parameter or `t_max` changes (Vt, RM at `rtol 1e−8`);
  a drag now redraws within a frame or two (LV corner r 3, δ 3, t_max 500: 190 → ~100 ms; RM default drag r:
  110 → 33 ms).
- **ode.js:** a stopped run now ends exactly where the bisection found the stop condition true (from
  `(tStop − t)/h` the rounding could put it a hair on the other side: 32 of 60 runs from t = 10⁴), returns
  `yEnd`, and takes output `times`.)

## 10. Screenshots to look at

Each model at its default; every preset; RM `K 19` and `K 19.5` (decaying vs small cycle); a tapped start;
`N(0) = 0`; `P(0) = 0`; phone layout.
