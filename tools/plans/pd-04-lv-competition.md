# Card 4 — Lotka–Volterra competition

Read `pd-00-foundation.md` first. Steps 0, 2 and 3 must be done.
Reference: `/tmp/pd/Two_species_population_models/` (`README.md` section 1, `LV_competition.R`).

## 1. Files

| File | Change |
|---|---|
| `simulations/population-dynamics/lv-competition/index.html` | new page |
| `js/sims/lv-competition.js` | new: maths (`WQ.LVC`) + page wiring |
| `tools/test-lv-competition.mjs` | new: node tests (section 7) |
| `simulations/index.html` | card `pd-4` becomes a link |
| `README.md` | one row |
| `css/site.css` | only if something is missing |

Scripts: core, chalk, engine, plot, ode, simkit, `lv-competition.js`, site.

## 2. Header

Kicker `Deterministic population dynamics · 4`, title `Lotka–Volterra competition`. Formula (two lines, use
`class="math--lines"` style or two `<span class="m">` blocks):
`dN₁/dt = r₁N₁(1 − (N₁ + α₂₁N₂)/K₁)` and `dN₂/dt = r₂N₂(1 − (N₂ + α₁₂N₁)/K₂)`.
Notation rows:
- `N₁, N₂` — the two species (SP1, SP2)
- `r₁, r₂` — growth rate per head when rare and alone
- `K₁, K₂` — carrying capacity of each species alone
- `α₂₁` — the effect of one SP2 individual on SP1, counted in SP1 individuals; `α₁₂` — the effect of SP1 on SP2
  (this is the owner's convention; many textbooks swap the indices)

## 3. Controls

| id | Label | Range | Step | Default |
|---|---|---|---|---|
| `r1` | `r_1` | 0.05 – 5 | 0.01 | 1 |
| `r2` | `r_2` | 0.05 – 5 | 0.01 | 0.8 |
| `K1` | `K_1` | 1 – 100 | 0.5 | 10 |
| `K2` | `K_2` | 1 – 100 | 0.5 | 8 |
| `a12` | `α_12` | 0 – 5 | 0.01 | 0.4 |
| `a21` | `α_21` | 0 – 5 | 0.01 | 0.6 |
| `tmax` | `t_max` | 10 – 500 | 10 | 50 |

Use `class="sim-controls sim-controls--grid"`. Presets (`.sim-presets`), named by the real outcome
(the README's names `SP1_exclude_SP2` and `SP2_exclude_SP1` were swapped; the owner is fixing them):

| Label | r1 | r2 | K1 | K2 | α12 | α21 |
|---|---|---|---|---|---|---|
| Stable coexistence (README) | 1 | 0.8 | 10 | 8 | 0.4 | 0.6 |
| SP1 wins | 1 | 1 | 10 | 8 | 1.5 | 0.2 |
| SP2 wins | 1 | 1 | 10 | 8 | 0.2 | 1.5 |
| Bistability | 1 | 1 | 10 | 8 | 1.2 | 1.4 |
| Weak competition | 1 | 0.7 | 10 | 8 | 0.05 | 0.05 |
| Symmetric (neutral) | 1 | 1 | 10 | 10 | 1 | 1 |
| Near-degenerate | 1 | 1 | 10 | 10 | 0.999 | 0.999 |
| Fast–slow | 5 | 0.1 | 10 | 8 | 0.4 | 0.6 |

A `Clear` button `<button class="sim-btn" id="clear-taps">Clear my starts</button>` under panel A.

## 4. Maths (`WQ.LVC`)

- `f(N1, N2)`: `[r1·N1·(1 − (N1 + a21·N2)/K1), r2·N2·(1 − (N2 + a12·N1)/K2)]`.
- Jacobian (exact, from the README): `J11 = r1(1 − (2N1 + a21N2)/K1)`, `J12 = −r1·a21·N1/K1`,
  `J21 = −r2·a12·N2/K2`, `J22 = r2(1 − (2N2 + a12N1)/K2)`.
- Equilibria: `e0 = (0, 0)`, `e1 = (K1, 0)`, `e2 = (0, K2)`, and with `D = 1 − a12·a21`, when `|D| > 1e-12`:
  `e3 = ((K1 − a21K2)/D, (K2 − a12K1)/D)`, shown only if both components are `> 1e-9·max(K1, K2)`.
- Each equilibrium: `WQ.ODE.eig2` of `J` there → `classify2` (stable node, saddle, …).
- Invasion tests: `s1 = K1 − a21·K2` (SP1 can grow when rare in SP2's world, at `e2`, iff `s1 > 0`: its
  growth rate there is `r1·s1/K1`); `s2 = K2 − a12·K1`. Borderline when `|s| ≤ 1e-9·max(K1, K2)`.
- Outcome (`r1, r2 > 0`): `s1 > 0, s2 > 0` coexistence (`e3` stable node); `s1 > 0, s2 < 0` SP1 wins (`e1`);
  `s1 < 0, s2 > 0` SP2 wins (`e2`); `s1 < 0, s2 < 0` bistable (`e1` and `e2` stable, `e3` a saddle);
  `s1 = s2 = 0` (then `D = 0`) neutral: the two nullclines coincide, every point of `N1 + a21·N2 = K1` is an
  equilibrium; one of them `= 0` otherwise: borderline.
- Fact for the box: at `e3` the eigenvalues are always real (the off-diagonal entries of `J` have the same sign),
  so competition never spirals; `e3` is stable exactly when `D > 0`.
- Plot box: `X = 1.15·max(K1, cap(K2/a12), N1(e3))`, `Y = 1.15·max(K2, cap(K1/a21), N2(e3))` with
  `cap(v) = min(v, 1.5·max(K1, K2))`, and terms with `a = 0` left out.
- Trajectories: `WQ.ODE.solve`, `rtol 1e-8`, `atol 1e-10·max(K1, K2)`, `samples 300` (600 for panel B),
  `t ∈ [0, t_max]`. Default starts (16, deduplicated): for `q ∈ {0.1, 0.4, 0.7, 1.0}`:
  `(qX, Y)`, `(X, qY)`, `(qX, 0.02Y)`, `(0.02X, qY)`.
- End of a run: the nearest stable equilibrium within `0.01·max(K1, K2)` → coloured by it; otherwise "still moving".
- Settling time: the first `t` after which the distance to the final equilibrium stays below `0.01·max(K1, K2)`.
  Slowest eigenvalue at that equilibrium → `τ = 1/|λ_slow|`.
- Separatrix (bistable only): `v` = eigenvector of `J(e3)` for its negative eigenvalue (for
  `J = [[a, b], [c, d]]` and eigenvalue `λ`: `v = (b, λ − a)` or `(λ − d, c)`, whichever is longer; normalise).
  Integrate the reversed field `−f` from `e3 ± 1e-4·scale·v` for `t ∈ [0, 80]`, stopping when the point leaves
  `[−0.01X, 1.01X] × [−0.01Y, 1.01Y]`; draw both halves as one dashed white line labelled "separatrix".
- Neutral case: draw the line of equilibria `N1 + a21·N2 = K1` as a thick dashed white line.

## 5. Panels

### A. Phase plane (`cv-phase`, `term-phase`; `class="sim-plot sim-plot--phase"`)

Direction field (`field`), nullclines — SP1's: `N1 = 0` and `N1 + a21N2 = K1` (yellow dashed; for `a21 = 0`
the vertical line `N1 = K1`), SP2's: `N2 = 0` and `N2 + a12N1 = K2` (blue dashed; for `a12 = 0` the line
`N2 = K2`) — then trajectories (thin; yellow if they end at `e1`, blue at `e2`, white at `e3`, dim white
otherwise; `arrowAt: 0.3`), taps (thicker white; `onTap` adds a start and makes it panel B's start), the
separatrix or the neutral line, and the equilibrium markers with labels `e0 … e3`. Legend: "SP1 nullcline",
"SP2 nullcline". Caption: "Each line is one possible history. Tap or click to start your own."

Box A (defaults; real numbers):
```
> r_1 = 1.00, r_2 = 0.80 · K_1 = 10.0, K_2 = 8.0 · α_12 = 0.40, α_21 = 0.60
> equilibria · eigenvalues · type
  e0 (0, 0)           +0.800 +1.000   unstable node
  e1 (10.00, 0)       −1.000 +0.400   saddle
  e2 (0, 8.000)       −0.800 +0.520   saddle
  e3 (6.842, 5.263)   −0.910 −0.301   stable node
> invasion tests
  K_1 = 10.0 > α_21 K_2 = 4.80   ✓ SP1 can grow when rare
  K_2 = 8.0 > α_12 K_1 = 4.00    ✓ SP2 can grow when rare
> outcome: stable coexistence at e3
  · each can grow when rare, so neither can be pushed out
  · each species limits itself more than it limits the other
  · competition never spirals: the eigenvalues at e3 are real
  · r_1 and r_2 change how fast, not who wins
```
Outcome lines and why bullets:
- SP1 wins → `> outcome: SP1 wins (e1)`; `· SP1 can grow when rare in SP2's world (K_1 > α_21 K_2)`,
  `· SP2 cannot grow when rare in SP1's world (K_2 < α_12 K_1)`, `· from any start with both present, SP2 dies out`.
- SP2 wins → the mirror.
- Bistable → `> outcome: bistable — whoever is ahead wins`; `· neither can grow when rare in the other's world`,
  `· e3 is a saddle; its stable line (dashed) divides the starts`, `· a founder effect: arriving first or in larger numbers wins`.
- Neutral → `> outcome: neutral — a whole line of equilibria`; `· the nullclines coincide: N_1 + α_21 N_2 = K_1`,
  `· each start stops somewhere on the line: nothing pushes along it`.
- Borderline → `> on a borderline: one eigenvalue is 0`; `· slower nonlinear terms decide; a tiny change tips it`.
- `a21 = 0` adds `· α_21 = 0: SP2 does not affect SP1 at all`; `a12 = 0` the mirror.
Marks: `✓` when the test passes, `✗` when it fails, `=` on the border.

### B. Time series (`cv-time`, `term-time`)

`N1(t)` yellow and `N2(t)` blue for `t ∈ [0, t_max]` from the last tap, or from `(0.1K1, 0.1K2)`; dashed
lines at the final equilibrium's values. Caption: "Both populations over time, from your last start."

Box B (defaults):
```
> start (1.000, 0.800) → at t = 50: (6.842, 5.263)
> settled within 1% by t = 12.32
  · slowest eigenvalue at e3: −0.301, so τ = 3.32
  · near the end the gap shrinks ×e every τ
```
Cases: not settled by `t_max` → `warn("not settled by t_max = …")` and the why
`· the slow direction has τ = …` (Fast–slow preset: at `t = 50` it is at (7.827, 3.636); it settles by
t ≈ 116, τ = 20.09); `τ > 5 × settling time` → `· this start barely uses the slow direction; others take ~τ`
(Near-degenerate: settles by 5.64 from the diagonal start, but τ = 1999); neutral → `· it stopped on the line of
equilibria at (…)`; bistable → say which side of the separatrix the start was.

### C. Outcome map (`cv-map`, `term-map`)

Axes `α_12` (x, 0–5) and `α_21` (y, 0–5). Borders: vertical `α_12 = K2/K1`, horizontal `α_21 = K1/K2`.
Fill the four regions faintly (`fill`): lower-left coexistence (white, alpha 0.07), lower-right SP1 wins
(yellow, 0.12), upper-left SP2 wins (blue, 0.12), upper-right bistable (pink, 0.12); a label in each region
that is at least 60×22 px on screen; the dotted curve `α_12·α_21 = 1` (where `D = 0`); a white dot (r 6) at the
current `(α_12, α_21)`. **Tap or click** sets both sliders to the tapped point (rounded to 0.01) via the slider
objects (so readouts and every panel update); with a mouse the dot can also be dragged (pointer events,
`pointerType !== "touch"`, with pointer capture). Caption: "Who wins, for every pair of α. Tap to move the dot."

Box C:
```
> borders: α_12 = K_2/K_1 = 0.800 · α_21 = K_1/K_2 = 1.250
> now (0.40, 0.60): stable coexistence
  · right of α_12 = K_2/K_1: SP1 presses SP2 harder than SP2 presses itself
  · above α_21 = K_1/K_2: SP2 presses SP1 harder than SP1 presses itself
  · the dotted curve α_12 α_21 = 1 is where e3 changes between stable and saddle
```
If `K2/K1 > 5`: `> the α_12 border (…) is off the map: SP1 cannot exclude SP2 for α_12 ≤ 5`; if `K1/K2 > 5`:
the mirror. If a border is below 0.05: `· the … border is almost on the axis: K's are very unequal`.

## 6. Theory bullets

1. **Two logistic species.** Each grows logistically alone (`r_i`, `K_i`); the other species adds a linear drag.
2. **Competition coefficients.** `α_21` converts SP2 into SP1-equivalents (`α_21 = 2`: one SP2 individual
   weighs on SP1 like two of its own); `(N_1 + α_21 N_2)` is the crowding SP1 feels.
3. **Equilibria.** `e0 = (0, 0)`, `e1 = (K_1, 0)`, `e2 = (0, K_2)`, and
   `e3 = ((K_1 − α_21K_2)/(1 − α_12α_21), (K_2 − α_12K_1)/(1 − α_12α_21))` when it is positive.
4. **Stability** comes from the Jacobian's eigenvalues at each equilibrium (the README's table: node, saddle,
   spiral, centre).
5. **Invasion tests.** SP1 can grow when rare in SP2's world iff `K_1 > α_21K_2`; SP2 iff `K_2 > α_12K_1`.
   Both → coexistence; one → that species wins; neither → bistability (founder control).
6. **Coexistence needs** each species to limit itself more than it limits the other.
7. **No spirals.** In competition the Jacobian at `e3` has real eigenvalues, so populations approach without
   oscillating.
8. **Growth rates** set the speed and the shape of the paths, not the outcome.
9. **Degenerate cases.** `α_12α_21 = 1` with matching `K`'s gives a line of equilibria (neutral); near it the
   approach is extremely slow.

GitHub button → `https://github.com/ashutosh-shinde/Population-Dynamics/blob/master/Two_species_population_models/README.md#1-lotka-volterra-competition-model`
(check the anchor against the README's current heading: GitHub lowercases the heading text, removes punctuation
other than `-` and spaces, and turns spaces into `-`; if the heading changed, use the new anchor).

## 7. Node tests (`tools/test-lv-competition.mjs`; load `ode.js`, `simkit.js`, the sims file)

| Preset | Expect |
|---|---|
| Stable coexistence | D 0.76; e3 (6.8421, 5.2632) stable node, eigenvalues −0.9097, −0.3009; e1 saddle (−1, 0.4); e2 saddle (−0.8, 0.52); e0 unstable node (0.8, 1); outcome coexistence |
| SP1 wins (α12 1.5, α21 0.2) | s1 8.4, s2 −7; e1 stable node (−1, −0.875); e2 saddle (−1, 0.84); no e3; runs from (1,1), (8,2), (2,8), (12,12) end at (10, 0) by t = 400 |
| SP2 wins (α12 0.2, α21 1.5) | s1 −2, s2 6; e2 stable node (−1, −0.2); e1 saddle (−1, 0.75); runs end at (0, 8) |
| Bistability | D −0.68; e3 (1.7647, 5.8824) saddle (−1, 0.0882); e1 (−1, −0.5) and e2 (−1, −0.12) stable; stable eigenvector at e3 ∝ (0.2873, 0.9578); from (1,1) → (10,0), (2,8) → (0,8), (8,2) → (10,0), (12,12) → (10,0) |
| Weak competition | e3 (9.6241, 7.5188) stable node (−0.9675, −0.6528) |
| Symmetric | D 0, s1 = s2 = 0: neutral; e1, e2 non-hyperbolic; (1,1) → (5,5), (8,2) → (8,2), (2,8) → (2,8) (they stop on N1 + N2 = 10) |
| Near-degenerate | e3 (5.0025, 5.0025) stable node (−1, −0.0005); from (8,2) at t = 400 still at about (7.619, 2.385) |
| Fast–slow | e3 (6.8421, 5.2632) stable node (−3.4371, −0.0498); from (1, 0.8): at t = 50 (7.8271, 3.6359), settled (1 % of max K) by t ≈ 116.3 |
| α12 = α21 = 0 | e3 = (10, 8) stable node (−1, −1) (repeated eigenvalue) |
| α21 = 0, α12 = 1.5 | SP1 wins; e1 stable node (−1, −0.875); e2 saddle (−1, 1) |
| Settling, defaults from (1, 0.8) | settled by t = 12.32 (±0.05); τ 3.32 |
| Settling, Bistability from (1, 0.8) | → (10, 0) by t = 16.26; τ 2.00 |
| Outcome map borders, defaults | 0.8 and 1.25; K1 100, K2 1 → 0.01 and 100 (off the map) |

## 8. Runtime checks (`?check=1`)

- `|f(e_i)| < 1e-9·max(K1, K2)` for every equilibrium shown.
- `eig2` of the analytic `J` agrees with `eig2` of `WQ.ODE.jacFD` (±1e-5).
- The outcome from the invasion tests equals the outcome read from the stability of `e1`, `e2`, `e3`
  (skip borderline and neutral).
- Each default run ends at the outcome's stable equilibrium (or on the separatrix's correct side when
  bistable), or is marked "still moving" (allowed only when `t_max < 10·τ`).
- The current dot on the map lies in the region named in box C.

(Found while building, now in the code: the α sliders use step 0.001, because the Near-degenerate preset's
0.999 cannot be set with 0.01 (it snapped to 1, the neutral case); the readouts show three decimals only when
needed. The separatrix is integrated up to `t = 80·max(1, 1/min(r1, r2))`, and the point where it leaves the
box is added, so it reaches the edge; the side test extends its last stretch if a start lies beyond it.
Boxes and checks read one snapshot of the parameters taken when the runs are computed, never the live slider
state (the boxes are throttled, so they could otherwise mix two states). The panels use
`.sim-panel--wideterm` (a wider box column) so the equilibrium rows fit on one line on desktop.)

## 9. Screenshots to look at

Every preset; `α_21 = 0`; `α_12 = 5, α_21 = 5` (strongly bistable); `K1 = 100, K2 = 1`; a tapped start in
the bistable preset on each side of the separatrix; phone layout (map and phase plane below each other).
