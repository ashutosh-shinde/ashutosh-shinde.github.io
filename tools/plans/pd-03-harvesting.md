# Card 3 — Harvesting with Holling responses

> **Revision (after step 6, at the owner's request): two models instead of four types.**
> In the θ model `dy/dt′ = y(1 − y/k) − h·y^θ/(1 + y^θ)`, `θ = 1` is Type II exactly and `θ = 0` gives
> `y⁰ = 1`, a constant catch `h/2` for every `y > 0`: Type 0 in rescaled units (`c = r_m h/(2k)`, so the
> README's `r_m 1.5, c 0.3` is `k 10, h 4`, and `c_c = r_m/4` is `h_c = k/2`). Type I is **not** in the family
> (`y^θ/(1 + y^θ) ≤ 1`, while `h₀x` grows without limit; Type I is only Type II far below `N₀`), so it stays a
> mode of its own. The page therefore has a two-way switch `#type`: `theta` ("θ model · Types 0, II, III",
> default, opening at `θ = 1, k 1.8, h 0.8`: the Type II README case) and `linear` ("Type I · linear").
> Sliders: θ model `k` (0.1–20), `h` (0–20), `θ` (0–10, default 1); Type I `rm`, `h0`; both `s0`, `tmax`. The
> `c` slider is gone. θ-model presets: `θ = 1 · Type II (README)` (k 1.8, h 0.8), `θ = 1 · bistable` (h 1.05),
> `θ = 1 · no fold (k 0.5)`, `θ = 0 · Type 0 (constant)` (k 10, h 4), `θ = 2 · Type III (README)` (k 5, h 1.5),
> `θ = 2 · bistable` (k 10, h 2.2), `θ = 5 · steep` (k 20, h 3), `θ = 0.5 · extinction possible` (k 10, h 1);
> Type I presets as in §3. In `WQ.Harvest`, `model("theta", { k, h, theta })` and `model("linear", { r, h0 })`
> replace the type numbers 0–3; the Type 0 tests of §8 are run as `θ = 0` (equilibria `k·x*`, times `r_m·t`;
> the ramp crash is then `h ≈ 5.36`, in 5 – 5.6). Where the rest of this plan says Type 0, read `θ = 0`.

Read `pd-00-foundation.md` first. Steps 0 and 2 must be done.
Reference: `/tmp/pd/Holling_functional_harvesting_model/` (`README.md`, `Harvester_trajectory.R`,
`Equilibria_and_stability.R`).

## 1. Files

| File | Change |
|---|---|
| `simulations/population-dynamics/harvesting/index.html` | new page |
| `js/sims/harvesting.js` | new: maths (`WQ.Harvest`) + page wiring |
| `tools/test-harvesting.mjs` | new: node tests (section 8) |
| `simulations/index.html` | card `pd-3` becomes a link |
| `README.md` | one row |
| `css/site.css` | only if something is missing |

Scripts: core, chalk, engine, plot, **ode**, simkit, `harvesting.js`, site.

## 2. The model, and the four types

The owner's model: `dN/dt = r_m N(1 − N/K) − H(N)`. Two forms are used, exactly as in the README:

| Type | Form used on the page | Parameter | State `u` | Time |
|---|---|---|---|---|
| 0 constant | `dx/dt = r_m x(1 − x) − c` | `c` (harvest per unit time, in units of K) | `x = N/K` | `t` |
| I linear | `dx/dt = r_m x(1 − x) − h₀ x` | `h₀` (harvest per head) | `x = N/K` | `t` |
| II saturating | `dy/dt′ = y(1 − y/k) − h·y/(1 + y)` | `h = h₀/(r_m N₀)` | `y = N/N₀` | `t′ = r_m t` |
| III sigmoidal | `dy/dt′ = y(1 − y/k) − h·y^θ/(1 + y^θ)` | `h`, `θ` | `y = N/N₀` | `t′ = r_m t` |

`k = K/N₀` (carrying capacity in units of the half-saturation density `N₀`). Type II is Type III with `θ = 1`.

Header: kicker `Deterministic population dynamics · 3`, title `Harvesting with Holling responses`, formula
`dN/dt = r_m N(1 − N/K) − H(N)`; notation rows: `H(N)` — the harvest rate (by hunters, fishers or grazers);
`Type 0` — a fixed amount `c` per unit time; `Type I` — a fixed share `h₀` of the population; `Types II, III` —
harvest that saturates at `h₀`, half of it at `N = N₀` (Type III starts slowly: shape `θ`); `y = N/N₀`,
`k = K/N₀`, `h = h₀/(r_m N₀)`, `t′ = r_m t` — the rescaled form the README uses for II and III.

## 3. Controls

A type switch `<div class="sim-seg" id="type" role="group" aria-label="Harvest type">` with buttons
`data-value="0" | "1" | "2" | "3"` and labels `Type 0 · constant`, `Type I · linear`, `Type II · saturating`,
`Type III · sigmoidal`. Default: Type II. Only the sliders of the chosen type are visible (`hidden` on the
others' `<label>`s); **each type keeps its own slider values** when you switch away and back.

| id | Label | Types | Range | Step | Default |
|---|---|---|---|---|---|
| `rm` | `r_m` | 0, I | 0.1 – 3 | 0.01 | 1.5 |
| `c` | `c` | 0 | 0 – 1 | 0.001 | 0.3 |
| `h0` | `h_0` | I | 0 – 4 | 0.01 | 1.0 |
| `k` | `k` | II, III | 0.1 – 20 | 0.01 | II: 1.8, III: 10 |
| `h` | `h` | II, III | II: 0 – 10, III: 0 – 20 | 0.001 | II: 0.8, III: 2.2 |
| `theta` | `θ` | III | 0 – 10 | 0.05 | 2 |
| `s0` | `start N(0)/K` | all | 0 – 1.5 | 0.01 | 0.9 |
| `tmax` | `t_max` (Types II/III: `t′_max`) | all | 10 – 300 | 1 | 100 |

(One `k`, `h` element each: when the type changes, set the element's `max` and value from that type's
stored state. `s0` is the start as a share of `K`: `x0 = s0` for Types 0/I, `y0 = s0·k` for II/III.)

Presets (`<div class="sim-presets" id="presets">`, rebuilt for the chosen type):
- Type 0: `README: r_m 1.5, c 0.3` (r 1.5, c 0.3) · `near the fold: c 0.37` · `collapse: c 0.45`
- Type I: `maximum yield: h₀ = r_m/2` (r 1.5, h₀ 0.75) · `h₀ = r_m (threshold)` (1.5, 1.5) · `collapse: h₀ 2` (1.5, 2)
- Type II: `README: k 1.8, h 0.8` · `bistable: h 1.05` (k 1.8, h 1.05) · `no fold: k 0.5` (k 0.5, h 0.8) · `k 10, h 2`
- Type III: `README: k 5, θ 2 (no fold)` (k 5, θ 2, h 1.5) · `bistable: k 10, θ 2, h 2.2` · `k 20, θ 5, h 3` ·
  `θ 0.5: extinction possible` (k 10, θ 0.5, h 1) · `θ 0: constant harvest` (k 10, θ 0, h 4)

Ramp controls (section D): `<button class="sim-btn sim-btn--play" id="ramp-play">Play</button>` (toggles
Play/Pause), `<button class="sim-btn" id="ramp-reset">Reset</button>`, slider `ramp-T` (`T`, 100 – 2000,
step 10, default 800). The sweep tool skips plain buttons, so the ramp must also compute and draw its full
result **without** pressing Play (Play only animates a playhead over the computed run).

## 4. Maths (`WQ.Harvest`) — one method for all types

Write every type as `f(u) = g(u) − p·φ(u)`:

| Type | `g(u)` | `φ(u)` | `p` | `U` (where `g` = 0) |
|---|---|---|---|---|
| 0 | `r u(1 − u)` | `1` (for `u > 0`) | `c` | 1 |
| I | `r u(1 − u)` | `u` | `h₀` | 1 |
| II/III | `u(1 − u/k)` | `u^θ/(1 + u^θ)` for `u > 0`; `φ(0) = 0` if `θ > 0`; for `θ = 0`, `φ = ½` for `u > 0` | `h` | `k` |

**Absorbing extinction** (`u = 0` is a boundary the population cannot leave, and it is reached in finite
time): Type 0 (`c > 0`), and Types II/III with `θ < 1` (including `θ = 0`). In `f`, return 0 when `u ≤ 0`
for these types.

**Branch function.** A positive `u` is an equilibrium exactly when `p = P(u) := g(u)/φ(u)`:
- Type 0: `P = r u(1 − u)`, `P′ = r(1 − 2u)`, `P(0⁺) = 0`
- Type I: `P = r(1 − u)`, `P′ = −r`, `P(0⁺) = r`
- II/III: `P = (1 − u/k)(u^(1−θ) + u)`, `P′ = −(u^(1−θ) + u)/k + (1 − u/k)((1 − θ)u^(−θ) + 1)`;
  `P(0⁺) = +∞` for `θ > 1`, `1` for `θ = 1`, `0` for `θ < 1`; `P(U) = 0`.

**Stability of a positive equilibrium: stable ⇔ `P′(u*) < 0`.** (On the branch `f_u = g′ − Pφ′ = φ·P′` and
`φ > 0`.) The plot of `u` against `p` is therefore exactly the bifurcation diagram, with no root finding:
this also removes the "tangential roots" problem the README lists as work in progress.

`f′(u*)` for the boxes: Type 0 `r(1 − 2u)`; Type I `r(1 − 2u) − h₀`; II/III `1 − 2u/k − h·φ′(u)` with
`φ′(u) = θ u^(θ−1)/(1 + u^θ)²`.

**Folds** (`P′ = 0`): Type 0 one at `u = ½`, `p = r/4`; Type I none; II/III numeric — evaluate `P′` on a
grid of 3000 points (1000 log-spaced on `[1e-6·min(1, k), min(1, k)]`, 2000 linear on `[min(1, k), k(1 − 1e-9)]`),
bisect every sign change of `P′`, and label each fold `"max"` (P′ goes + → −) or `"min"` (− → +).
Closed forms to check against: `θ = 1, k > 1`: one max at `u = (k − 1)/2`, `p = (k + 1)²/(4k)`;
`θ = 0`: one max at `u = k/2`, `p = k/2`.

**Equilibria at `p`:** split `(0, U]` at the folds into monotone pieces; on each piece `[a, b]` solve
`P(u) = p` by bisection when `p` lies between the piece's end values. For the first piece use
`a = 1e-12·U` as its left end (`P` is finite there even for `θ = 10`; its value stands in for the `P(0⁺)`
limit), and `P(U) = 0` at the right end. Each piece has at most one root, so nothing is missed. Remove
duplicates closer than `1e-9·U`. Add `u = 0` when it is an equilibrium (Types I, II and III with `θ > 0`).
With `p = 0` every type is the plain logistic: equilibria `0` (unstable) and `U` (stable), and nothing is
absorbing (Type 0 with `c = 0` and `θ = 0` with `h = 0` included).

**`u = 0`:** Type I: `f′(0) = r − h₀` (stable if `h₀ > r`; at `h₀ = r` "stable, but only slowly (x ~ 1/(r t))").
II/III: `θ > 1` unstable (`f′(0) = 1`, always); `θ = 1` `f′(0) = 1 − h`; `0 < θ < 1` stable (`f′(0) = −∞`).
Type 0 and `θ = 0`: not an equilibrium; "absorbing".

**Thresholds** (for the boxes, the diagram's vertical lines, and the ramp):
| Case | Collapse `p_c` | Recovery `p_r` | Kind |
|---|---|---|---|
| Type 0 | `r/4` (fold) | none (absorbing) | tipping point, permanent |
| Type I | `r` | `r` | smooth (transcritical): no jump |
| `θ = 1`, `k > 1` | `(k + 1)²/(4k)` (fold) | `1` (where `y = 0` turns unstable) | tipping point with hysteresis |
| `θ = 1`, `k ≤ 1` | `1` | `1` | smooth (transcritical) — note `(k+1)²/(4k)` is **not** the threshold here |
| `θ > 1` with two folds | `P` at the max fold (larger `u`) | `P` at the min fold | tipping point down to a low refuge, hysteresis |
| `θ > 1`, no folds | none | none | smooth: the refuge always exists |
| `0 ≤ θ < 1` | `P` at its max fold | none (absorbing) | tipping point, permanent |

`u_fold` = the `u` of the collapse fold (Type 0: ½; `θ = 1, k > 1`: `(k − 1)/2`).

**Trajectories:** `WQ.ODE.solve` on `f` with `rtol 1e-8`, `atol 1e-10·U`, `samples 400`, `nonneg`; for
absorbing types `stop: u < 1e-9·U` (then the run is "extinct at t = …" and the rest of the samples are 0).

**Ramp (tipping point):** `p(t) = p_hi·2t/T` for `t ≤ T/2`, then `p_hi·2(T − t)/T`.
`p_hi`: Type 0 `1.3·r/4`; Type I `1.3·r`; `θ = 1` `1.3·max(1, p_c)`; `θ > 1` with folds `1.3·p_c`; `θ > 1` without
folds `min(20, P(0.05·k))`; `θ < 1` `1.3·p_c` (cap at the slider's max). Start `u(0) = 0.999·U`.
Integrate the time-dependent `f` with `WQ.ODE.solve` (`hmax = T/2000`, `samples 1200`); for the
non-absorbing types pass `floor: 1e-6·U` (a tiny remnant, so a recovery is possible and the box says so);
absorbing types: no floor, stop at extinction and keep 0.
Events: **crash** = first time after `p(t) > p_c` that `u < 0.5·u_fold`; **recovery** = after a crash, during
the second half, first time `u > u_fold`. No events in the "smooth" cases.
Expected with the defaults of each case and `T = 800` (checked by simulation; integrator differences are small):
Type 0 (r 1.5): crash at `c ≈ 0.395` (in 0.375 – 0.42), no recovery, ends extinct. Type II (k 1.8): crash
`h ≈ 1.185` (1.0889 – 1.25), recovery `h ≈ 0.706` (0.5 – 1.0). Type III (k 10, θ 2): crash `h ≈ 2.79`
(2.6044 – 2.95), recovery `h ≈ 1.61` (1.3 – 1.7872). Type III (k 10, θ 0.5): crash `h ≈ 3.90` (3.6423 – 4.2),
no recovery.

## 5. Panels

Use `u`/`p` names in code; in the page write `x, c, h₀` for Types 0/I and `y, h` for II/III, and `t` or `t′`.

### A. Growth against harvest (`cv-curves`, `term-curves`)

Plot over `u ∈ [0, 1.05·U]`: growth `g(u)` (white) and harvest `p·φ(u)` (yellow); a vertical dotted line at the
start `u0`; equilibrium markers on the `u` axis at each equilibrium (stable filled, unstable open, absorbing 0 as
a small pink square labelled "extinct"); arrows along the axis (8 small triangles, as on card 2) pointing right
where `g > pφ` and left where `g < pφ`. Legend: "growth", "harvest". Caption: "Where growth is above harvest the
population rises; it settles where they cross."

Box A (Type II defaults; numbers are real):
```
> Type II · k = 1.800 · h = 0.800
> equilibria (growth = harvest)
  y* = 0        f' = +0.200   unstable
  y* = 1.121    f' = −0.423   stable
> state: sustainable — settles at y* = 1.121 (62% of K)
  · above the yellow curve the white one wins: the population rises
  · it settles where harvest overtakes growth (they cross)
  · yield there h·φ(y*) = 0.4228; relaxation time 1/|f'| = 2.36
> critical harvest h_c = 1.0889 (fold): above it, collapse
```
State rules (decide from the equilibria and where the slider start goes):
- one stable positive equilibrium, 0 unstable → `sustainable — settles at u* = … (…% of K)`; the three bullets above.
- two stable states → `bistable: the start decides`; bullets: `· starts above the threshold u* = … (open dot) go to …`,
  `· starts below it go to …` (0 / extinct / the low refuge), `· your start goes to …`.
- no positive stable equilibrium, absorbing → `collapse: extinct at t = …`; bullet `· harvest is above growth at every density`.
- no positive stable equilibrium, not absorbing (Type I `h₀ ≥ r`, `θ = 1` `h > p_c`) → `collapse: declines to 0`;
  Type I `h₀ = r` adds `· exactly at the threshold: the decline is very slow (x ~ 1/(r_m t))`.
- `θ > 1` and only the refuge is stable → `pushed down to the low refuge y* = …`; bullet
  `· y = 0 is never stable for θ > 1: at low density the harvest (∝ y^θ) is weaker than growth (∝ y)`.
- `p` within `1e-4·p_c` of a fold → `at the tipping point (fold)`.
Type-specific bullets (add the one that applies):
- Type 0: `· a fixed catch c does not shrink when the population does: below x* = … it is fatal`
  and `· the largest catch it survives is r_m/4 = … (card 2's peak growth rate)`.
- Type I: `· yield h₀x* = h₀(1 − h₀/r_m) is largest at h₀ = r_m/2: r_m/4 = …`.
- `θ = 1, k ≤ 1`: `· k ≤ 1: no fold; the population fades out smoothly at h = 1`.
- `0 < θ < 1`: `· θ < 1: the harvest per head grows without limit as y → 0, so a small population is always harvested out`.
- `θ = 0`: `· θ = 0 makes the harvest constant (h/2): Type 0 in rescaled units`.
- large `θ` (≥ 6): `· large θ: the harvest is almost a switch at y = 1 (N = N_0)`.
Last line: the collapse threshold, or `> no tipping point: …` for the smooth cases.

### B. Trajectories from several starts (`cv-runs`, `term-runs`)

Starts at `s ∈ {0.05, 0.15, 0.3, 0.5, 0.7, 0.9, 1.1, 1.4}` (share of K) plus the slider start (thicker
white); time `[0, t_max]`. Colour each thin run by where it ends: upper stable state yellow, lower stable
state / refuge blue, extinct or → 0 pink. Horizontal lines at the equilibria (stable dashed white, unstable
dotted). Caption: "Eight starts and yours: where each one ends up." Debounce this panel (200 ms).

Box B (Type II, `h = 1.05` example, from a check run):
```
> 8 starts (share of K) → end
  0.05 → 0 (collapse)      0.15 → 0.6646
  0.30 → 0.6646            0.50 → 0.6646  …
> threshold y* = 0.1354: below it the harvest wins
> your start 0.90 → 0.6646, within 1% by t′ = …
  · close to y* the gap shrinks ×e every 1/|f'| = 8.52
```
Rules: absorbing runs print `extinct at t = …`; runs still moving at `t_max` print `→ … (still moving)` (dim);
when every run ends at the same state: `> every start ends at …` and a why bullet `· only one stable state`.

### C. Bifurcation diagram (`cv-bif`, `term-bif`)

Plot `u` against `p` for `p ∈ [0, p_axis]`, `p_axis = min(slider max, max(1.4·max fold p, 1.2·p_current, 1.5))`
(Type I: `max(1.4·r, 1.2·h₀)`): the branch drawn **parametrically** from 1200 points `u_i` on the same kind
of grid as the folds (point `(P(u_i), u_i)`), solid where `P′ < 0` (stable), dashed where `P′ > 0`; the line
`u = 0`: solid where stable, dashed where unstable, pink dotted labelled "extinct (absorbing)" for absorbing
types; vertical pink line at `p_c` labelled "collapse", blue line at `p_r` labelled "recovery" (when they
exist); yellow vertical marker at the current `p`; dots at the current equilibria.
Caption: "Equilibria against the harvest: solid stable, dashed unstable."

Box C (Type II, `k = 1.8`):
```
> collapse at h_c = (k+1)²/(4k) = 1.0889 (fold)
> recovery only below h = 1 (y = 0 stops being stable)
> hysteresis: for 1 < h < 1.0889 two stable states
> now h = 0.800 → one stable state y* = 1.121
  · solid = stable (the branch falls as y grows), dashed = unstable
  · at the fold the stable and unstable branches meet and vanish
    (a saddle-node bifurcation): the population has nowhere to settle
```
Per case: Type 0 `> collapse at c_c = r_m/4 = …; extinction is permanent (absorbing)`; Type I
`> no fold: x* = 1 − h₀/r_m reaches 0 at h₀ = r_m = … (transcritical)`; `θ = 1, k ≤ 1` the same idea at `h = 1`;
`θ > 1` with folds: `> collapse to the refuge at h = …, recovery below h = …`; `θ > 1` without folds:
`> no fold for this k and θ: the population shrinks smoothly` plus, for `θ = 2`, `· a fold needs k > 3√3 ≈ 5.196`;
`θ < 1`: `> collapse at h = …; extinction is permanent`.

### D. Tipping point: a slow ramp (`cv-ramp-path`, `cv-ramp-time`, `term-ramp`)

Two plots in one panel: (1) the bifurcation diagram of C again (same drawing) with the ramp's path
`(p(t), u(t))` in orange and a head dot at the playhead; (2) `u(t)` (white) and `p(t)` scaled to the plot
(yellow, dashed) against `t ∈ [0, T]`, with a vertical playhead. The full run is computed (debounced) whenever
a parameter or `T` changes and drawn completely; Play animates the playhead from 0 to `T` in 12 seconds
(rAF), Pause stops it, Reset puts it back to 0. With reduced motion, Play shows the end at once.
Caption: "The harvest rises slowly past the threshold, then falls back."

Box D (Type II, `k = 1.8`, `T = 800`):
```
> ramp: h rises 0 → 1.416 over t′ = 400, then back to 0
> crash at h ≈ 1.185 (fold h_c = 1.0889)
  · it crashes a little after h_c: the population lags the moving
    equilibrium, and near the fold it responds slowly (critical slowing down)
> recovery at h ≈ 0.706 (y = 0 turns unstable at h = 1)
  · well below 1: from a tiny remnant (10⁻⁶ K) regrowth is slow, rate 1 − h
> hysteresis: it collapses and recovers at different h
```
Per case: Type 0 `> crash at c ≈ …; extinct: no recovery even at c = 0` (why: `· extinction is permanent: nobody is left to regrow`);
Type I `> no tipping point: x* slides to 0 at h₀ = r_m and comes back as h₀ falls` (why: `· near h₀ = r_m it follows
slowly: critical slowing down`); `θ > 1` with folds `> crash to the refuge at h ≈ … (fold …), recovery at h ≈ … (fold …)`;
`θ > 1` without folds `> no tipping point: it shrinks and recovers smoothly`; `θ < 1` like Type 0.
If no crash was detected although `p_hi > p_c`: `warn("no crash within the ramp: try a longer T")`.

## 6. Theory bullets

1. **Harvest on top of growth.** Without harvest the population grows logistically; the harvest `H(N)` is
   subtracted: `dN/dt = r_m N(1 − N/K) − H(N)`.
2. **Holling types.** Type 0: a fixed catch `c`. Type I: a fixed share `h₀N`. Type II: `h₀N/(N₀ + N)`, which
   saturates at `h₀` (harvesters can only take so much). Type III: `h₀N^θ/(N₀^θ + N^θ)`, slow at low density
   (harvesters switch to other prey), with shape `θ`.
3. **Rescaling.** For II and III, `y = N/N₀`, `k = K/N₀`, `h = h₀/(r_m N₀)`, `t′ = r_m t` give
   `dy/dt′ = y(1 − y/k) − h y^θ/(1 + y^θ)`: only `k`, `h`, `θ` matter.
4. **Equilibria** are where growth equals harvest; one is stable when harvest overtakes growth there
   (`f′(u*) < 0`, linear stability test).
5. **Fold (saddle-node) bifurcations.** When the harvest rises past a critical value, a stable and an unstable
   equilibrium meet and vanish: the population collapses. Type 0: `c_c = r_m/4`. Type II: `h_c = (k+1)²/(4k)`
   **for `k > 1`**; for `k ≤ 1` there is no fold, the population fades out at `h = 1`.
6. **Hysteresis.** After a collapse, lowering the harvest back to `h_c` is not enough: Type II needs `h < 1`,
   Type III needs the lower fold. Type 0 never recovers (extinction is absorbing).
7. **The shape θ.** `θ > 1`: extinction is impossible (`f′(0) = 1`), but the population can be pushed down to a
   low refuge. `θ < 1`: the per-head harvest grows without limit as `N → 0`, so small populations are always
   harvested out. `θ = 0`: a constant harvest again.
8. **Critical slowing down.** Near a fold, `f′(u*) → 0`, so the relaxation time `τ = 1/|f′(u*)|` grows without
   limit: the population recovers from small pushes ever more slowly, an early warning of collapse.
9. **Maximum sustainable yield** for Types 0 and I is `r_m/4`, at `x = ½` (half of K).

GitHub button → `https://github.com/ashutosh-shinde/Population-Dynamics/blob/master/Holling_functional_harvesting_model/README.md`.

## 7. Edge cases the page must handle (and the sweep will hit)

`c = 0`, `h₀ = 0`, `h = 0` (no harvest: plain logistic, settles at `U`); `s0 = 0` (stays 0); `s0 = 1.5`
(above K); `θ = 0` (constant harvest, `0^0` must not be used: use the rule in §4); `θ` just below and above 1;
`θ = 10` (very steep); `k = 0.1` (tiny K: everything scaled down); `k = 20, h = 20`; exactly at a fold;
`r_m = 0.1` with `c = 1` (immediate collapse). No box may show NaN; plots must always draw.

## 8. Node tests (`tools/test-harvesting.mjs`; load `ode.js`, `simkit.js`, then the sims file)

| Case | Expect |
|---|---|
| Type 0, r 1.5, c 0.3: equilibria | 0.276393 (unstable), 0.723607 (stable); `f′` = ±0.670820 |
| Type 0, r 1.5: fold | u ½, p 0.375 |
| Type 0, r 1.5, c 0.45 from 0.5 | extinct at t = 3.4294 (±0.01) |
| Type 0, r 1.5, c 0.3 from 0.2 (below the threshold) | extinct at t = 1.4347 (±0.01) |
| Type I, r 1.5, h₀ 1 | x* = 1/3 stable (`f′` −0.5), 0 unstable (`f′` +0.5); `p_c = 1.5` |
| Type II k 1.8 h 0.8 | y* = 1.121110 stable (`f′` −0.423491), 0 unstable |
| Type II k 1.8 h 1.05 | 0.135425 unstable (`f′` +0.035063), 0.664575 stable (`f′` −0.117367), 0 stable |
| Type II k 1.8 | one max fold at y 0.4, h 1.088889 = (k+1)²/(4k) |
| Type II k 0.5, h 0.8 / 1.05 | one positive equilibrium 0.153113 / none; no fold; `p_c = 1` (not 1.125) |
| Type II k 1, h 0.9 | 0.316228 stable |
| Type III k 10 θ 2: folds | (1.1378, 1.7872) min and (4.7813, 2.6044) max (±1e-3) |
| Type III k 10 θ 2 h 2.2 | 0.566335 stable, 2.574141 unstable, 6.859523 stable (±1e-5); `|f(y*)|` < 1e-12 |
| Type III k 10 θ 2 h 1.5 / 3.0 | 8.196870 / 0.363699 (one each, stable) |
| Type III k 5 θ 2 | no folds; h 1.5 → y* = 2.0 |
| Type III k 5.3 θ 2 | folds (1.5573, 1.5532) and (1.9606, 1.5567): bistable only for 1.5532 < h < 1.5567 |
| Type III k 3√3 = 5.196152 θ 2 | no folds (the cusp) |
| Type III k 10 θ 0.5 h 1 | 0.405485 unstable, 9.181073 stable, 0 stable; fold (4.567, 3.6423) |
| Type III k 10 θ 0 | fold (5, 5) = (k/2, k/2); h 4 → 2.763932 unstable, 7.236068 stable; h 6 → none |
| Type III k 10 θ 10 | folds (1.2674, 1.2103) and (5.0, 2.5) |
| Type III k 20 θ 2 / θ 10 | folds (1.0575, 1.8972), (9.8979, 5.0505) / (1.2553, 1.2976), (10.0, 5.0) |
| Type III k 10 θ 2 h 10 | refuge y* = 0.09999 (≈ 1/h) |
| Ramp, defaults, T 800 | the four expected results in §4 (ranges) |
| `f(0)` for θ = 0, 0.5, 1, 2 (k 10, h 1) at u = 1e-6 | −0.5, −9.98e−4, +9.0e−13, +1.0e−6 (signs matter) |

## 9. Runtime checks (`?check=1`)

- Every equilibrium: `|f(u*)| < 1e-9·max(1, U)`; its label agrees with the sign of a central-difference `f′`
  (skip if `|f′| < 1e-6`) and with the sign of `P′`.
- Type II folds: the numeric fold equals the closed form (±1e-6). `θ = 0`: fold at `(k/2, k/2)` (±1e-6).
- The number of positive equilibria equals the number of sign changes of `f` on a 20 000-point grid over
  `(0, U]` (skip when `p` is within 1e-3 of a fold).
- Each run in B ends within `1e-3·U` of a stable equilibrium, or extinct, or is marked "still moving"
  (allowed only if `t_max < 20·τ`).
- The ramp's crash `p` (if any) is ≥ `p_c`; the recovery `p` (if any) is ≤ `p_r`.

(Found while building, now in the code: the sign-change grid also needs 2000 log-spaced points from
`1e-12·U`, because `θ` just above 1 puts the refuge very close to 0; and a run that is far from its
destination at `t_max` may be crossing the slow "ghost" of a vanished fold, so "still moving" is also
accepted when the run moves monotonically towards its destination without passing it. A run's
destination is the next equilibrium in the direction `f(u_end)` points. For `θ > 1` a refuge below
`1e-12·k` is not searched: the box then says "a refuge below 10⁻¹² k: effectively extinct".)

(Second review, before the merge to master: that check caught a real gap. The equilibria kept only roots
above `1e-9·k`, so with `θ` just above 1 and a large `h` a refuge between `1e-12·k` and `1e-9·k` went
missing (for example `θ 1.1, k 9.27, h 11.6`: `y* = 2.27e−11`, stable), and the page then had no stable
state above 0. Every root above the search's `1e-12·k` is now kept, found by bisection in logs near 0
(full precision however small); a sweep of 40 000 states finds no mismatch left. For `θ > 1` the runs keep
their error relative (`atol 1e-30·k`), so they settle on such a refuge, and box A adds "a refuge this low
is extinction in practice" below `1e-6·k`.)

## 10. Screenshots to look at

Each type at its default; every preset; Type II `h = 1.05` (bistable, fan split); Type III `k 10 θ 2` with the
ramp computed (path loop visible); `θ = 0.5`; `θ = 0`; `θ = 10`; `k = 0.1`; phone layout with the type switch
wrapping.
