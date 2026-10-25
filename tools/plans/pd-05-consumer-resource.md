# Card 5 — Consumer–resource model (two consumers, one resource)

Read `pd-00-foundation.md` first. Steps 0, 2, 3 and 4 must be done.
Reference: `/tmp/pd/Two_species_population_models/` (`README.md` section 2, `CR_competition.R`).

## 1. Files

| File | Change |
|---|---|
| `simulations/population-dynamics/consumer-resource/index.html` | new page |
| `js/sims/consumer-resource.js` | new: maths (`WQ.CR`) + page wiring |
| `tools/test-consumer-resource.mjs` | new: node tests (section 8) |
| `simulations/index.html` | card `pd-5` becomes a link |
| `README.md` | one row |
| `css/site.css` | only if something is missing |

Scripts: core, chalk, engine, plot, ode, simkit, `consumer-resource.js`, site.

## 2. Header

Kicker `Deterministic population dynamics · 5`, title `Consumer–resource model`. Formula (three lines):
`dR/dt = I − β₁ R/(R₀₁ + R) C₁ − β₂ R/(R₀₂ + R) C₂`,
`dC₁/dt = γ₁β₁ R/(R₀₁ + R) C₁ − δ₁C₁`, `dC₂/dt = γ₂β₂ R/(R₀₂ + R) C₂ − δ₂C₂`.
Notation rows: `R` — the resource (food), renewed at a constant rate `I`; `C₁, C₂` — two consumers that only
compete by eating the same food; `β_i` — the most one consumer can eat per unit time (Holling type II uptake);
`R₀_i` — the food level at which it eats half of that; `γ_i` — how much food turns into new consumers;
`δ_i` — death rate per head.

## 3. Controls (`class="sim-controls sim-controls--grid"`; three `<fieldset class="sim-group">` groups)

| Group | id | Label | Range | Step | Default |
|---|---|---|---|---|---|
| Resource | `I` | `I` | 0 – 30 | 0.1 | 12 |
| Species 1 | `b1` | `β_1` | 0.1 – 10 | 0.01 | 4 |
| | `R01` | `R_01` | 0.1 – 20 | 0.01 | 5 |
| | `g1` | `γ_1` | 0.05 – 2 | 0.01 | 1.4 |
| | `d1` | `δ_1` | 0.01 – 3 | 0.001 | 0.5 |
| Species 2 | `b2` | `β_2` | 0.1 – 10 | 0.01 | 3 |
| | `R02` | `R_02` | 0.1 – 20 | 0.01 | 5 |
| | `g2` | `γ_2` | 0.05 – 2 | 0.01 | 1 |
| | `d2` | `δ_2` | 0.01 – 3 | 0.001 | 0.8 |
| Start and time | `C1s` | `C_1(0)` | 0 – 30 | 0.1 | 5 |
| | `C2s` | `C_2(0)` | 0 – 30 | 0.1 | 5 |
| | `Rs` | `R(0)` | 0 – 30 | 0.1 | 10 |
| | `tmax` | `t_max` | 10 – 500 | 10 | 50 |

Presets (the README's three; all with I 12, β 4 / 3, R₀ 5 / 5, γ 1.4 / 1):
`R₁* < R₂*: species 1 wins` (δ 0.5 / 0.8) · `R₁* > R₂*: species 2 wins` (δ 1.9 / 0.8) ·
`R₁* = R₂*: a tie` (δ 0.5 / 0.267857). Default = the first.

Panel A has a scale switch `<div class="sim-seg" id="scale" role="group" aria-label="Scale">` with
`linear` / `log` (default linear): with very different sizes (thousands of consumers, a trace of food) the log
scale shows all three.

## 4. Maths (`WQ.CR`)

- State order `(C1, C2, R)` (as in the owner's code). `u_i(R) = β_i R/(R0_i + R)`, `u_i′(R) = β_i R0_i/(R0_i + R)²`.
- `f`: `dC1 = C1(γ1u1 − δ1)`, `dC2 = C2(γ2u2 − δ2)`, `dR = I − u1C1 − u2C2`.
- Jacobian (exact): row C1 `[γ1u1 − δ1, 0, C1γ1u1′]`, row C2 `[0, γ2u2 − δ2, C2γ2u2′]`, row R
  `[−u1, −u2, −u1′C1 − u2′C2]`.
- `R_i* = δ_i R0_i/(γ_iβ_i − δ_i)` if `γ_iβ_i > δ_i`, else `∞` (the species cannot persist at any food level:
  even unlimited food gives growth `γβ − δ ≤ 0`).
- Equilibria: species `i` alone: `R = R_i*`, `C_i = Iγ_i/δ_i`, the other 0 (when `R_i*` is finite and `I > 0`).
  No consumers: none (with `I > 0`, `R` grows without limit). Both: only when `R1* = R2*` (a tie: a whole
  line of equilibria on `u1C1 + u2C2 = I` at `R = R*`).
- Stability of species `i` alone: its `(R, C_i)` block `[[−u_i′C_i, −u_i], [γ_iu_i′C_i, 0]]` (at the equilibrium)
  has negative trace and positive determinant → always stable (node or spiral: `eig2`, `classify2`). The third
  eigenvalue is the **invasion rate** of the other species `j`: `λ_j = γ_jβ_j R_i*/(R0_j + R_i*) − δ_j`; it is
  negative exactly when `R_i* < R_j*`. So **the species with the lower R\* wins** (the README's rule).
- Tie: `|R1* − R2*| ≤ 1e-6·max(R1*, R2*)` → "tie".
- Integration: **`WQ.ODE.solveStiff`** with the Jacobian above (the food can change thousands of times faster
  than the consumers: at extreme slider values `R*` is tiny and `C*` huge), `rtol 1e-5`, `atol 1e-8`,
  `samples 600`, `nonneg`, `maxSteps 100000`. If `maxSteps` is hit, the box says
  `warn("stopped at t = …: the model is too stiff here")`.
- Exclusion time: after the loser's maximum along the run, the first time it is below 1 % of that maximum.

## 5. Panels

### A. Time series (`cv-time`, `term-time`)

`R` white, `C1` yellow, `C2` blue against `t ∈ [0, t_max]`; dashed lines at `R1*` (yellow) and `R2*` (blue)
when finite and inside the plot; linear or log `y` (log range: from `max(1e-6, min positive value)` to
`1.2·max`). Caption: "Food and both consumers over time."

Box A (defaults; real numbers):
```
> I = 12.0 · species 1: β 4.00, R_0 5.00, γ 1.40, δ 0.500 · species 2: β 3.00, R_0 5.00, γ 1.00, δ 0.800
> R_1* = 0.4902 · R_2* = 1.818
> winner: species 1 (lower R*)
  equilibrium R = 0.4902, C_1 = I γ_1/δ_1 = 33.60, C_2 = 0
  eigenvalues of (R, C_1): −21.783, −0.512 (stable node)
  invasion rate of species 2 there: −0.532 (< 0: it cannot return)
> species 2 dropped below 1% of its peak at t = 9.89
  · species 1 can live on less food (R_1* < R_2*)
  · it eats the food down to R_1*, where species 2 starves
  · the winner is not who eats most when food is plenty, but who survives when it is scarce
```
Cases: species 2 wins (mirror); tie → `> a tie: R_1* = R_2*` and `· both sit at zero growth: any amount of each on a
line of equilibria`, `· fragile: the smallest change of a parameter decides`; one species cannot persist →
`> species j cannot persist (γ_jβ_j ≤ δ_j)`; neither → `> neither can persist: both die out and the food piles up
(dR/dt → I)`; `I = 0` → `> no food input: the food runs out and both consumers starve`; `C_i(0) = 0` → `· species i
is absent and cannot appear (no immigration)`; both absent → `> no consumers: food piles up at rate I`.
The winner's equilibrium is "spiral" when the block's eigenvalues are complex: say `stable spiral: C_i and R
oscillate as they settle`. If the run has not reached the winner's equilibrium (within 1 %) by `t_max`:
`warn("not settled by t_max")`.

### B. The R* rule (`cv-rule`, `term-rule`)

Per-capita growth `g_i(R) = γ_iβ_i R/(R0_i + R) − δ_i` for `R ∈ [0, R_axis]`, `R_axis = max(3·max finite R*, 1.2·R(0), 1)`
(capped at 100): species 1 yellow, species 2 blue, the zero line, markers at `(R_i*, 0)` labelled `R_1*`,
`R_2*`, and a white dotted vertical line at the food level at `t_max` labelled `R at t_max`.
Caption: "Each consumer's growth rate against the food level: it is zero at its R*."

Box B:
```
> growth per head g_i(R) = γ_i β_i R/(R_0i + R) − δ_i
  R_1* = 0.4902 (g_1 = 0) · R_2* = 1.818 (g_2 = 0)
> at R = R_1* = 0.4902: g_2 = −0.532 < 0
  · species 1 holds the food at R_1*, where species 2 shrinks
  · whichever needs less food (the lower R*) wins
> food at t_max: R = 0.4902
```
Cases: a species with `R* = ∞` → `· species j: g_j < 0 for every R (its curve never reaches 0)`.

### C. Phase portrait C1–C2 (`cv-phase`, `term-phase`; `sim-plot--phase`)

Following the owner's code: the line `L_i` = the set of `(C1, C2)` where the food balances (`dR/dt = 0`) at
`R = R_i*`: `u1(R_i*)·C1 + u2(R_i*)·C2 = I` (`L_1` yellow, `L_2` blue; only for finite `R_i*`); orbits from 9
starts `C1, C2 ∈ {0.15, 0.5, 0.85} × axis max` with `R(0)` from the slider (thin white, `arrowAt: 0.3`) and the
slider start (thicker); markers at the single-species equilibria `(Iγ1/δ1, 0)` and `(0, Iγ2/δ2)` (stable or
saddle, from the invasion rate). Axes: `1.15 × max` of the lines' intercepts (`I/u_1(R_i*)` on the C1 axis,
`I/u_2(R_i*)` on the C2 axis) and of the starts. Caption: "Both consumers; each line is where the food
balances at one species' R*." Debounce (200 ms).

Box C:
```
> line 1: food balances at R = R_1*; it meets the C_1 axis at C_1* = 33.60
> line 2: food balances at R = R_2*; it meets the C_2 axis at C_2* = 15.00
> every orbit ends at (33.60, 0): species 1 wins
  · orbits head for the line of the lower R*, then slide along it to its axis
```
Tie → `> the two lines coincide: every point on it is an equilibrium (a tie)`.

## 6. Theory bullets

1. **Food and eaters.** The food is renewed at rate `I` and eaten; consumers grow in proportion to what they
   eat (`γ`) and die at rate `δ`.
2. **Holling type II uptake** `βR/(R₀ + R)`: little food → eating is limited by finding it; plenty → by handling
   it, up to `β`.
3. **R\*.** The food level where a consumer just replaces itself: `R* = δR₀/(γβ − δ)` (needs `γβ > δ`).
4. **Alone,** species `i` settles at `R = R_i*` with `C_i* = Iγ_i/δ_i`.
5. **Together,** the species with the lower `R*` wins: it pulls the food down to its own `R*`, where the other's
   growth rate is negative (its invasion rate `γβR*/(R₀ + R*) − δ < 0`).
6. **Competitive exclusion.** Two consumers fully dependent on one resource cannot coexist unless
   `R₁* = R₂*` exactly (a fragile tie).
7. **Not the biggest eater.** The winner is the one that survives when food is scarcest, not the one that eats
   most when it is plenty.
8. **Fixed points** (correcting a sign in the README draft): at equilibrium
   `R*(β₁C₁/(R₀₁ + R*) + β₂C₂/(R₀₂ + R*)) = I`.

GitHub button → `…/Two_species_population_models/README.md#2-consumer---resource-model` (check the anchor
against the README's current heading, as in pd-04).

## 7. Edge cases

`I = 0`; `C1(0) = 0`; `C2(0) = 0`; both 0; `R(0) = 0`; `δ` at 0.01 with `β = 10`, `R₀ = 0.1` (stiff corner);
`γβ ≤ δ` for one or both; the tie preset; `t_max = 500`. Never NaN; always a drawn plot.

## 8. Node tests (`tools/test-consumer-resource.mjs`; load `ode.js`, `simkit.js`, the sims file)

| Case | Expect |
|---|---|
| R₁* < R₂* preset | R1* 0.490196, R2* 1.818182; winner 1; C1* 33.6; (R, C1) block eigenvalues −21.78254, −0.51175; invasion rate of 2: −0.53214 |
| … run from (5, 5, 10), t 50 | (33.6, 0, 0.4902) within 0.1 %; species 2 below 1 % of its peak (7.1475 at t ≈ 0.48) at t ≈ 9.89 (±0.1) |
| R₁* > R₂* preset | R1* 2.567568, winner 2, C2* 15; block eigenvalues at e2 −3.82869, −1.01131; invasion rate of 1: −0.40667; run → (0, 15, 1.8182); species 1 below 1 % at t ≈ 14.85 (±0.1) |
| R₁* = R₂* preset | tie (both 0.490196); run from (5, 5, 10) at t 50 ≈ (24.7637, 11.7818, 0.4902) |
| δ2 = 3 (γ2β2 = 3 ≤ 3) | R2* = ∞ ("cannot persist"); species 1 wins; invasion rate of 2: −2.73214 |
| γ1 = γ2 = 0.1 | neither persists; R at t 50 ≈ 518.44 (grows ~ I·t) |
| I = 0 | everything decays: at t 50 ≈ (0, 0, 0) |
| stiff corner: I 30, β 10 / 3, R₀ 0.1 / 5, γ 2 / 1, δ 0.01 / 0.8, from (5, 5, 10) | t = 5: (314.963, 0.106442, 9.61657e−4); t = 50: (2375.061, ≈0, 1.264723e−4), each within 0.1 %; finishes in < 100 000 steps |
| Lines of the C1–C2 portrait, R₁* < R₂* preset | L1 meets the axes at C1 = 33.6, C2 = 44.8; L2 at C1 = 11.25, C2 = 15 |

## 9. Runtime checks (`?check=1`)

- `γ_iβ_i R_i*/(R0_i + R_i*) − δ_i = 0` (±1e-10) for finite `R_i*`.
- At the winner's equilibrium `dR/dt = 0` (±1e-9·I) and `dC_i/dt = 0`.
- The winner from the R\* rule equals the one whose invasion test passes (`λ_j < 0`).
- The block eigenvalues equal `eig2` of the `(R, C_i)` sub-matrix of `jacFD` (±1e-5).
- The run's final state is within 1 % of the winner's equilibrium when `t_max ≥ 10/|λ_slowest|`.

(Found while building, now in the code: that last check is skipped when the winner was pushed below 1e-9 of
its `C*` on the way, because climbing back takes about `ln(1e9)/λ`, longer than `10/λ`. The tie preset's
`δ₂ = 0.267857` is kept exact in the model (the slider, step 0.001, shows 0.268). The species-2 peak in §8
comes out 7.1448 rather than 7.1475 (the stiff solver interpolates linearly between its steps); the exclusion
time 9.89 is unaffected. In panel C an intercept is capped at 3× the larger of that axis's equilibrium and
start: in the stiff corner one intercept is ~10⁶ and would flatten the plot. With `I = 0` there are no
balance lines. In the review, a present consumer is integrated as `c = ln C` (`dc/dt = γu(R) − δ`; ROS2 with
`atol = [1e-7, 1e-7, 1e-8]`, now allowed per component in ode.js): a big rival can eat the food down and push
the eventual winner to 1e−12 and far below, and in plain `C` its comeback was 10 % late against scipy's Radau;
in logs every case agrees to 1e−4. An absent consumer stays exactly 0.)

## 10. Screenshots to look at

Each preset (linear and log); the stiff corner (log scale: all three visible); `I = 0`; `C2(0) = 0`; a
species that cannot persist; phone layout with the three slider groups.
