# Plan: Simulations page + Discrete-time logistic model

Written for the model that implements this (same session, same container).
Read this file top to bottom before writing any code. Everything the user
asked for is here; where the user's words were ambiguous, the chosen
reading is marked **(decided)**.

---------------------------------------------------------------------------

## 0. Ground rules

- Repo: `/home/claude/ashutosh-shinde.github.io`, branch **`rebuild`**.
  Commit and push to `rebuild` only. **Never touch `master`** (the live site)
  unless the user says so in a new message.
- End every commit message with exactly these two lines:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01Ms82A1ZwyKgedEzLG7cXA9
  ```
- **Change only what this plan lists.** The home page, the other pages,
  the scenes, the engine and the page-change animation stay as they are.
- No new external libraries, CDNs or build steps. Plain HTML/CSS/JS, like
  the rest of the site. Everything must work on GitHub Pages and on phones.
- Every file starts with a header comment saying what it does, plus a
  `HOW TO EDIT:` note (house style; see any file in `js/`).
- Reference material: the user's R code in the repo
  `ashutosh-shinde/Population-Dynamics` (public; default branch `master`).
  A copy may be at `/tmp/pd`; if not:
  `git clone --depth 1 https://github.com/ashutosh-shinde/Population-Dynamics.git /tmp/pd`.
  Relevant files: `Discrete_time_logistic_model/Logistic_growth_model.R`,
  `Predictability_of_model.R`, `README.md`. Use them for the model, the
  error values, the time spans (100 steps; 1000 steps with the last 200 for
  the bifurcation diagram) and the wording of the theory. Do not copy their
  mistakes (see 5.5).

---------------------------------------------------------------------------

## 1. What to build

1. **`simulations/index.html`** (rewrite): title, short intro, a small index
   of collections, then the collection "Deterministic population
   dynamics" with six numbered square cards (1 active, 2-6 "coming soon").
2. **`simulations/population-dynamics/discrete-logistic/index.html`** (new):
   the interactive discrete-time logistic model page.
3. **`js/lib/plot.js`** (new): a small reusable canvas plotting helper in the
   site's chalk style (`WQ.Plot`). Later simulations will reuse it.
4. **`js/sims/logistic.js`** (new): the model maths and the page's wiring.
5. **`css/site.css`**: one new section for the simulation pages.
6. **`README.md`**: rows in "Where things are" and a short "Add a
   simulation" note.
7. **`/home/claude/wq-tools/build_preview.py`** (not in the repo): add the
   new page to `PAGES` so the preview includes it.

---------------------------------------------------------------------------

## 2. Site conventions you must follow

Copy the structure of `elementary-mathematics/index.html` (one folder deep)
or `elementary-mathematics/what-is-infinity/index.html` (two deep). The new
model page is **three folders deep**, so its relative paths start with
`../../../`.

Every page has:

1. `<head>`: meta tags, favicon (copy), `<link rel="stylesheet" href="…/css/site.css">`,
   then **the inline `<script>` marked "arriving from another page of the
   site", copied unchanged** (it starts the flash and opens the page in the
   right place). Then the deferred scripts in this order:
   `…/js/lib/core.js`, `…/js/lib/chalk.js`, `…/js/engine/engine.js`, any
   page scripts (here `…/js/lib/plot.js`, `…/js/sims/logistic.js`), and
   **last** `…/js/site.js`.
2. At the top of `<body>`: the two canvases
   `<canvas id="board-tex" aria-hidden="true"></canvas>` and
   `<canvas id="board-fx" aria-hidden="true"></canvas>`.
3. A back link `<a class="back" href="…" data-collapse data-back="#section">`.
   `data-back` returns the visitor to where they left the page they came
   from; the `#section` is only the fallback.
4. `data-collapse` on **every link to another page of the site**. Not on
   external links (those get `target="_blank" rel="noopener"`), not on `#`
   links within a page.
5. `data-calm` on text blocks.
6. **Background: plain blackboard** (decided by the user). So `<body>` gets
   **no `data-scene`** attribute. The engine then draws only the board and
   still runs the page-change animation.

Design tokens are at the top of `css/site.css` (`--ink`, `--ink-1/2/3`,
`--line`, `--board`, `--serif`, `--caps`, `--sans`, `--gutter`, `--radius`).
Reuse existing classes: `.page`, `.page__main`, `.page__block`,
`.page__title` with `<span class="chalk-text">`, `.page__lead`, `.btn`,
`.back`, `.toc*` (the index list on the Elementary page), and the maths
classes `.m` (inline maths in Latin Modern) and `.math` (display line).
Subscripts: `X<sub>t+1</sub>`, variables in `<i>`.

Chalk colours for data (crisp lines, not textured), as constants in
`js/lib/plot.js`:

| name   | value     | use |
|--------|-----------|-----|
| white  | `#f6f4ec` | main trajectory, reference (error 0) |
| yellow | `#f2d675` | error 0.1, equilibrium line, R<sub>m</sub> marker |
| blue   | `#9cc9f0` | error 0.01 |
| pink   | `#f2a7c3` | error 0.00001 |
| orange | `#f0b27a` | custom error |
| green  | `#7dff8a` | terminal boxes only |

---------------------------------------------------------------------------

## 3. `simulations/index.html`

Keep the existing `<head>` and back link
(`<a class="back" href="../" data-collapse data-back="#simulations">`).
Body class: `page page--sims`. Content, in order:

1. Title **Mathematical Simulations** (`.page__title`, `chalk-text`, as now).
2. Lead (refined from the user's wording):
   > Here you'll find my simulations in a form you can play with: move a
   > slider and watch the model answer. Each one comes with a short note on
   > the theory and a link to the full write-up of the project. Choose a
   > collection below to open it.
3. **Index of collections** (like `.toc` on the Elementary page, but as
   cards): heading "Collections", then one card per theme. For now only
   one **(decided)**:
   - "Deterministic population dynamics": "How populations grow, compete
     and collapse, from one-species growth to predators and prey." + small
     "6 models". Links to `#deterministic-population-dynamics` (in-page,
     smooth scroll, no `data-collapse`).
4. **Section** `id="deterministic-population-dynamics"`: heading, a one-line
   intro ("Models from my Population Dynamics project, from one species to
   two.") and a grid of six **square** numbered cards: **two per row on
   desktop, one per row on phones** (`aspect-ratio: 1`). Each card: big
   number, title, one-liner, and "Open →" or a "Coming soon" badge.

   | # | Title | One-liner | State |
   |---|-------|-----------|-------|
   | 1 | Discrete-time logistic model | One equation, X<sub>t+1</sub> = R<sub>m</sub>X<sub>t</sub>(1 − X<sub>t</sub>): from a steady population to chaos. | link `population-dynamics/discrete-logistic/index.html` with `data-collapse` |
   | 2 | Continuous-time logistic model | Growth in continuous time, and what too large a time step does to it. | coming soon |
   | 3 | Harvesting with Holling responses | Hunting or fishing a population: tipping points, collapse and recovery. | coming soon |
   | 4 | Lotka–Volterra competition | Two species sharing resources: who wins, and when can both survive? | coming soon |
   | 5 | Consumer–resource model | Species competing for one resource: the lowest R\* wins. | coming soon |
   | 6 | Prey–predator models | Predators and prey in cycles, from Lotka–Volterra to Holling responses. | coming soon |

   Card 1 is an `<a class="project-card" id="pd-1" …>` (the whole card is
   the link). Cards 2-6 are `<div class="project-card project-card--soon"
   aria-disabled="true">`: dimmed (about 50% opacity), no hover lift.
   Give every card an id (`pd-1` … `pd-6`).
5. Leave an HTML comment **"HOW TO ADD A SIMULATION"** above the grid
   (steps as in section 10 below).

---------------------------------------------------------------------------

## 4. `simulations/population-dynamics/discrete-logistic/index.html`

`<body class="page page--sim">`, no `data-scene`. Back link:
`<a class="back" href="../../" data-collapse data-back="#pd-1"><span aria-hidden="true">←</span> Simulations</a>`.

Page width: wider than an article, `width: min(72rem, 100%)`, centred.
Default values: **R<sub>m</sub> = 3.2, X<sub>0</sub> = 0.2** (decided: the
page opens on a 2-cycle, more interesting than a flat line).

Each plot is a **panel**: the plot on the left (about 64%) and its
**explainer box** on the right (about 36%) on desktop; on screens narrower
than 900 px the box goes **under** the plot. Explainer boxes are the
"neon green chalk terminal" boxes: see 7.3.

### A. Header (compact)

- Kicker: "Deterministic population dynamics · 1".
- Title: "Discrete-time logistic model".
- The equation as a display line: X<sub>t+1</sub> = R<sub>m</sub> X<sub>t</sub> (1 − X<sub>t</sub>)
- Notation as a compact two-column list (one short line each):
  - **X<sub>t</sub>** — population in generation t, as a share of the carrying
    capacity K (X<sub>t</sub> = N<sub>t</sub>/K, between 0 and 1)
  - **R<sub>m</sub>** — the largest growth factor per generation (when the
    population is tiny), between 0 and 4
  - **(1 − X<sub>t</sub>)** — crowding: growth falls linearly as the habitat fills
  - **t** — generations, which do not overlap (parents breed, then die)

### B. Trajectory (first panel)

Controls (above the plot, in one row on desktop, stacked on phones), each a
labelled range slider with a live readout:
- **R<sub>m</sub>**: 0 to 4, step 0.001, readout with 3 decimals.
- **X<sub>0</sub>**: 0 to 1, step 0.001, readout with 3 decimals.
- **Steps**: 10 to 500, step 1, default 60 (decided: the user asked for a
  slider; 60 shows a few oscillations clearly).

Plot: X<sub>t</sub> against t, t = 0…steps, y from 0 to 1. Dots at each t joined
by thin straight lines (white). A dashed yellow line at x\* = 1 − 1/R<sub>m</sub>
when R<sub>m</sub> > 1, labelled "x\*". When the 2-cycle exists (R<sub>m</sub> > 3),
two dotted blue lines at its points.

Explainer box (updates live):
```
> R_m = 3.200   X_0 = 0.200
> equilibria
  x* = 0        f'(x*) =  3.200   unstable
  x* = 0.6875   f'(x*) = -1.200   unstable
> 2-cycle (R_m > 3)
  0.5130 ↔ 0.7995   multiplier 0.160   stable
> state: period-2 oscillation
> Lyapunov exponent λ = -0.916
```
Rules for this box:
- Always list both fixed points when they exist (x\* = 1 − 1/R<sub>m</sub> only for
  R<sub>m</sub> > 1), each with f′(x\*) and "stable", "unstable" or "neutral (test
  inconclusive)" when |f′| = 1 within 1e-9.
- List the 2-cycle with its multiplier and stability whenever R<sub>m</sub> > 3.
- The **state** line (see 5.3), and the Lyapunov exponent (3 decimals).
- **For R<sub>m</sub> > 3.5** (decided, from the user's request "how many cycles,
  up to 8, until chaos"): add the period-doubling ladder with the current
  position highlighted, for example:
  ```
  > ladder  1 → 2 → 4 → [8] → 16+ → chaos
    chaos begins at R_m ≈ 3.5699 (0.0129 away)
  ```
  Periods are named up to 8; anything beyond is "16+". Once in chaos:
  `> state: chaos (λ = 0.355 > 0)` and the ladder ends on `[chaos]`.
  In a periodic window: `> state: periodic window, period 3` (still show λ).
- Edge cases: X<sub>0</sub> = 0 → "stays at 0 (no population)"; X<sub>0</sub> = 1 →
  "X<sub>1</sub> = 0: extinct after one step"; R<sub>m</sub> = 0 → "extinct after one step".
- Use `aria-live="polite"` on the box, and update it at most every 150 ms
  while a slider is dragged.

### C. Predictability (two panels, sharing these controls)

Uses R<sub>m</sub> and X<sub>0</sub> from B (show them read-only at the top of the
section: "for R<sub>m</sub> = 3.200, X<sub>0</sub> = 0.200").
Own controls:
- **Steps**: 20 to 500, default 100 (the R code's `t1 = 1:100`).
- Errors (δ) are fixed: **0 (reference), 0.1, 0.01, 0.00001**, plus **one
  custom box** (`<input type="number">`, empty by default, accepts values
  in (0, 0.5]; anything else is ignored with a short hint). Each fixed error
  gets a checkbox to show or hide it (all on by default).
- Starting point for an error δ (decided by the user): start = X<sub>0</sub> + δ;
  **if that is > 1, use X<sub>0</sub> − δ; if that is < 0, use X<sub>0</sub> + δ.**
  Show a small note under the plot whenever this happens, e.g.
  "X<sub>0</sub> + 0.1 would leave [0, 1], so this run starts at X<sub>0</sub> − 0.1".
  Mark such runs in the legend with "−δ".

Panel C1, **error trajectories**: X<sub>t</sub> of every run on one plot (colours
from section 2; legend: "δ = 0 (reference)", "δ = 0.1", …).
Explainer box C1: each run's start value and where it ends up (the last
value, or "settles on the same cycle, out of step" / "wanders: chaos").

Panel C2, **divergence**: E<sub>t</sub> = X<sub>t</sub>(δ) − X<sub>t</sub>(0) for each δ ≠ 0.
- Default **log axis** of |E<sub>t</sub>| from 1e-16 to 1 (decades labelled
  10<sup>−16</sup>, 10<sup>−12</sup>, … 10<sup>0</sup>). Values below 1e-16 sit on the floor.
- Toggle **"log | linear"** (two small buttons). Linear shows the signed
  E<sub>t</sub> on −1 to 1, as in the R code.
- A dashed line at the tolerance **ε<sub>tol</sub> = 0.01** (constant
  `EPS_TOL` at the top of `logistic.js`), on both axes.

Explainer box C2 (the numbers here are only illustrative):
```
> predictability horizon (first t with |E_t| > 0.01)
  δ = 0.1       t = 6
  δ = 0.01      t = 11
  δ = 0.00001   t = 27
> λ = 0.355: errors grow about ×1.43 per step
  horizon ≈ ln(ε_tol/δ)/λ
> verdict: unpredictable after about 27 steps (chaos)
```
Verdicts: λ < 0 and errors shrink → "predictable: every run settles to the
same state"; on a cycle with a lasting phase offset → "predictable up to a
phase shift"; λ > 0 → "unpredictable after about N steps (chaos)". If no
run crosses ε<sub>tol</sub> within the steps shown, say "stays within 0.01 for all
t ≤ steps".

### D. Bifurcation diagram (one panel)

Controls:
- **X<sub>0</sub> for the diagram**: a slider with the values **0.1, 0.2, …,
  0.9** only (step 0.1; default 0.1 like the README). **(decided: the
  user wrote "0.1, 0.2, …, 4"; X<sub>0</sub> must stay in [0, 1], and 0 and 1 are
  trivial, so 0.1 to 0.9.)**
- "Reset zoom" button (hidden until zoomed).

Plot:
- Full view: **R<sub>m</sub> = 0, 0.01, …, 4** (401 values, exactly as the R code's
  `seq(0, 4, 0.01)`). For each, iterate 1000 steps from X<sub>0</sub> and plot
  the **last 200 values** (t = 801…1000) as tiny dots (1 device px, white,
  alpha about 0.55). Axes: R<sub>m</sub> (x), "attractor points X<sub>t</sub>" (y, 0 to 1).
- A **vertical yellow marker at the current R<sub>m</sub>** from section B, labelled
  "R<sub>m</sub> = 3.200". Moving the B slider only moves the marker (no
  recompute): draw the dots once into an offscreen canvas and composite.
- **Drag to zoom** (mouse/pen): drag a rectangle; on release zoom to it.
  When zoomed, recompute with finer R<sub>m</sub> steps (columns = plot width in
  CSS px, at most 800, evenly spaced) so detail appears. Double-click or
  "Reset zoom" returns to the full view. Minimum zoom width 0.002 in R<sub>m</sub>.
- **Touch**: page scrolling must keep working. The canvas has
  `touch-action: pan-y`; a small **"Zoom"** toggle button switches the
  canvas to drag-to-zoom (`touch-action: none`) until the next zoom ends.

Explainer box D: the landmarks, with the current one highlighted:
```
> landmarks
  R_m < 1            extinction
  1 < R_m < 3        one stable equilibrium
  R_m = 3            first doubling: period 2
  R_m ≈ 3.4495       period 4
  R_m ≈ 3.5441       period 8
  R_m ≈ 3.5699       chaos begins
  R_m ≈ 3.8284       period-3 window
> now: R_m = 3.200 → period-2 oscillation
> view: R_m 0 → 4,  X_t 0 → 1
```

### E. Theory (short bullets)

One `<section>` with 8-10 short bullets, plain words, maths in `.m`.
Draw on the README (sections Assumptions, Equilibrium, Stability,
Bifurcation, Predictability), corrected:
1. Assumptions: discrete, non-overlapping generations; closed population;
   growth falls linearly with crowding; mean field (large, well-mixed).
2. Equilibria: x\* = 0 always; x\* = 1 − 1/R<sub>m</sub> when R<sub>m</sub> > 1.
3. Linear stability: x\* is stable if |f′(x\*)| < 1, with f′(x) = R<sub>m</sub>(1 − 2x).
   So f′(0) = R<sub>m</sub> and f′(1 − 1/R<sub>m</sub>) = 2 − R<sub>m</sub>: extinction is stable for
   R<sub>m</sub> < 1, and the positive equilibrium for 1 < R<sub>m</sub> < 3.
4. **0 is unstable for every R<sub>m</sub> > 1** (the README says "(1, 2]"; that is
   a slip).
5. Period doubling: at R<sub>m</sub> = 3 a stable 2-cycle appears; doublings follow
   at 3.4495, 3.5441, … and pile up at R<sub>∞</sub> ≈ 3.5699 (the gaps shrink by
   the Feigenbaum ratio ≈ 4.669).
6. Chaos beyond R<sub>∞</sub> (not "beyond 3", another README slip): the population
   never settles, yet stays in [0, 1]; periodic windows appear inside it,
   e.g. period 3 from 1 + √8 ≈ 3.8284.
7. Lyapunov exponent λ = lim (1/n) Σ ln|f′(X<sub>t</sub>)|: λ < 0 on stable states and
   cycles, λ > 0 in chaos, λ = 0 exactly at the bifurcation points. (The
   README writes λ = 0 for the whole 2-cycle range; it is negative there.)
8. Predictability: an initial error grows like δ e<sup>λt</sup>, so the horizon is
   about ln(ε<sub>tol</sub>/δ)/λ. Measuring 1000 times more precisely buys only
   ln(1000)/λ more steps.
9. X<sub>0</sub> does not matter in the long run except X<sub>0</sub> = 0 or 1 (both die out).

### F. More

A `.btn` "Read the full write-up on GitHub →" linking to
`https://github.com/ashutosh-shinde/Population-Dynamics/blob/master/Discrete_time_logistic_model/README.md`
with `target="_blank" rel="noopener"` (external: **no** `data-collapse`).
Under it a second `.btn`: "← Back to the simulations", `href="../../"`,
`data-collapse data-back="#pd-1"`.

---------------------------------------------------------------------------

## 5. The maths (`js/sims/logistic.js`)

Put the pure maths in a small object at the top of the file (exported as
`WQ.Logistic`) so it can be tested in node without a page:

```js
const f = (R, x) => R * x * (1 - x);
const df = (R, x) => R * (1 - 2 * x);
function trajectory(R, x0, steps) { /* Float64Array of steps+1 values */ }
```

### 5.1 Fixed points and the 2-cycle

- x\*<sub>0</sub> = 0, f′ = R. x\*<sub>1</sub> = 1 − 1/R (R > 1), f′ = 2 − R.
- 2-cycle (R > 3): p<sub>±</sub> = ((R + 1) ± √((R + 1)(R − 3))) / (2R),
  multiplier μ = f′(p<sub>+</sub>) f′(p<sub>−</sub>) = −R² + 2R + 4; stable when |μ| < 1,
  i.e. 3 < R < 1 + √6 ≈ 3.44949.
- Stability label: |m| < 1 − 1e-9 stable; |m| > 1 + 1e-9 unstable; else
  "neutral (test inconclusive)".

### 5.2 Lyapunov exponent

From X<sub>0</sub>, skip 1000 steps, then average ln(max(|R(1 − 2x)|, 1e-300)) over
the next 4000 steps. Special cases: X<sub>0</sub> ∈ {0, 1} or R = 0 → report "—".

### 5.3 State classification

```
if R == 0 or X0 == 0 or X0 == 1   → special texts (4B edge cases)
if R < 1                          → "extinction"
if R == 1 (|R-1| < 1e-9)          → "extinction (slow: R_m = 1 is a bifurcation point)"
x = X0; iterate 3000 steps (transient)
for p in 1..64:  if |x_{n+p} - x_n| < 1e-7 for all n in the next 256 values → period p
  p == 1                → "stable equilibrium (x* = …)"
  p == 2, 4, 8          → "period-p oscillation"
  p is a power of 2 ≥16 → "period 16+ oscillation (on the edge of chaos)"
  otherwise             → "periodic window, period p"
no p found:
  λ >  0.001            → "chaos"
  λ < -0.001            → "slowly settling (near a bifurcation point)"
  else                  → "at a bifurcation point"
```

### 5.4 Known values: test these in node before building the page

(The algorithm in 5.3 was checked against this table: it gives these
results with X<sub>0</sub> = 0.2.)

Write `tools/test-logistic.mjs` (or run inline with node) and check:

| R<sub>m</sub> | expect |
|---|---|
| 0.5 | extinction, λ = ln 0.5 ≈ −0.693 |
| 2.8 | stable equilibrium, x\* = 0.642857 |
| 3.2 | period 2, points 0.513045 and 0.799455, μ = 0.16 |
| 3.5 | period 4 |
| 3.55 | period 8 |
| 3.566 | period 16+ |
| 3.7 | chaos, λ ≈ 0.355 |
| 3.83 | periodic window, period 3 |
| 4.0 | chaos, λ ≈ ln 2 ≈ 0.693 |

Also check the error start rule: X<sub>0</sub> = 0.95, δ = 0.1 → 0.85;
X<sub>0</sub> = 0.2, δ = 0.1 → 0.3.

### 5.5 Do not copy from the README

The three slips above (0 unstable only on "(1, 2]"; chaos "for R<sub>m</sub> > 3";
λ = 0 on the 2-cycle range). Mention them to the user in your final report
so they can fix the README; do not edit their repo.

---------------------------------------------------------------------------

## 6. `js/lib/plot.js` (`WQ.Plot`)

A small, reusable helper; keep it under about 250 lines.

```js
const p = WQ.Plot.create(canvas, {
  x: [0, 60], y: [0, 1], xLabel: "t", yLabel: "X_t",
  log: false,              // log10 y axis (for |E_t|)
  pad: { l: 46, r: 14, t: 12, b: 34 },
});
p.clear();                 // board-coloured background + axes, ticks, labels
p.line(xs, ys, color, { width: 1.6, dots: true, dash: null });
p.hline(y, color, { dash: [6, 5], label: "x*" });
p.vline(x, color, { label: "R_m = 3.200" });
p.dots(image);             // draw a prepared offscreen canvas into the plot area
p.legend([{ label, color }]);
p.toPx(x, y) / p.fromPx(px, py);
p.onResize(callback);      // ResizeObserver on the parent; re-render on resize
```

- Size: CSS width = parent width; height from CSS (see 7.2). Device pixel
  ratio = min(window.devicePixelRatio, 2).
- **Chalk-style axes and labels**: draw the two axis lines with `WQ.CH.line`
  (from `js/lib/chalk.js`, alpha about 0.6, width 1.4, not dashed); tick marks
  as short crisp lines; tick labels in `500 11px "WQ Sans"` at the
  `--ink-3` alpha; axis labels in italic `"WQ Serif"` 14px. Write
  subscripts by drawing the base letter and a smaller, lower subscript (a tiny
  helper `label(ctx, "X", "t", x, y)`).
- **Data lines are crisp** (`ctx.stroke` with round joins), chalk colours.
- Nice ticks: 4-7 ticks with 1-2-5 steps; log axis: decades.
- No animation loop: redraw only when inputs change, at most once per
  `requestAnimationFrame`.

---------------------------------------------------------------------------

## 7. Styles (`css/site.css`)

Add one section **`/* ---- 6b. simulations */` after section 6 (pages)
and before section 7 (states)**. Section 7 must stay last.

### 7.1 Simulations index
- `.collections` (index cards, like `.toc` but as bordered cards with
  `var(--line)` borders, `var(--radius)` corners, hover lift like `.btn`).
- `.project-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: clamp(14px, 2vw, 24px); max-width: 46rem; }`,
  one column under 700 px.
- `.project-card { aspect-ratio: 1; … }`: big number (serif, 3em, `--ink-3`),
  title (serif, 1.35em, `--ink-1`), one-liner (`--ink-2`), "Open →" at the
  bottom; `.project-card--soon` at opacity 0.5 with a small "Coming soon" badge.

### 7.2 Simulation page
- `.sim` container `width: min(72rem, 100%); margin: 0 auto`.
- `.sim-panel { display: grid; grid-template-columns: minmax(0, 1.8fr) minmax(0, 1fr); gap: 18px; }`;
  under 900 px a single column (box under the plot).
- Plot canvases: `width: 100%; height: clamp(220px, 34vw, 400px)`; the
  bifurcation plot a little taller, `clamp(260px, 40vw, 460px)`.
- `.sim-controls`: label, slider and readout in a row; wrap on phones.
- Range sliders in chalk style: thin track `rgb(var(--ink) / 0.35)`, round
  thumb in `--ink-1`; focus ring visible; `accent-color` as a fallback.
- `.sim-eq`: the compact header equation and notation list.

### 7.3 Terminal boxes (`.term`)
"Neon green chalk terminal":
- dark panel `rgb(4 10 5 / 0.82)`, border `1px solid rgb(125 255 138 / 0.28)`,
  radius `var(--radius)`, padding 14px 16px;
- text `#7dff8a`, `font: 13px/1.55 ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace`,
  `text-shadow: 0 0 6px rgb(125 255 138 / 0.35)`, `white-space: pre-wrap`;
- highlighted parts (the current state, the current ladder step) brighter
  with a stronger glow; dim parts at 60% opacity;
- a blinking block cursor `▌` after the last line (CSS animation; off for
  `prefers-reduced-motion`).

---------------------------------------------------------------------------

## 8. Behaviour, speed and accessibility

- All computing is synchronous and small: a trajectory of 500 steps,
  bifurcation 401 × 1000 (zoomed ≤ 800 × 1000) iterations; fine in a frame.
  Draw the bifurcation dots into an `ImageData` buffer (not 80 000
  `fillRect` calls), cache it, and only redraw the marker on R<sub>m</sub> changes.
- Slider `input` events → schedule one redraw per animation frame.
- Every slider has a `<label>`, `aria-valuetext` with the readout; every
  canvas has `role="img"` and an `aria-label` that updates with the state
  ("Trajectory for R_m 3.2: period-2 oscillation").
- Reduced motion: nothing animates anyway; turn off the cursor blink.
- No horizontal scrolling at 360 px wide. Check it.
- Remember slider values in the URL hash? **No** (the site's page-opening
  script uses `#` for sections). Keep state in memory only.

---------------------------------------------------------------------------

## 9. Testing (do all of it before committing)

Tools in this container:
- `/home/claude/wq-tools/shoot.py` (screenshots, `--root`, `--mobile`),
  `sheet.py`, `navsheet.py`.
- In the scratchpad
  `/tmp/claude-0/-home-claude/3fab7571-9acb-5342-a32f-9ffc0138bc80/scratchpad/`:
  `tools/errpass.py` (console errors on every page; **add the two pages to
  its `PAGES` list**), `tools/scrollsheet.py` (whole-page screenshots on a
  phone), `nav/where.py` (where pages open after forward and back links).
  The Comments page reports a failed request to script.google.com in this
  sandbox; that is expected (no internet to Google here), not a bug.

Checklist:
1. Node test of the maths (5.4) passes.
2. No console errors on both new pages, desktop (1440×900) and phone
   (390×844), with and without reduced motion.
3. Screenshots of both pages on desktop and phone: look at them. Cards
   square, two per row on desktop, one on phone; panels side by side on
   desktop, stacked on phone; terminal boxes readable; no overflow.
4. Move the sliders programmatically (set `value`, dispatch `input`) to
   R<sub>m</sub> = 2.8, 3.2, 3.5, 3.55, 3.7, 3.83, 4 and check the box texts match 5.4.
5. Predictability: X<sub>0</sub> = 0.95 shows the "−δ" note; the log/linear toggle works.
6. Bifurcation: full view matches the README figure's shape; drag-zoom on
   [3.5, 4] shows detail; reset works; the marker follows R<sub>m</sub>.
7. Page changes: home → Simulations (opens at top) → card 1 (opens at top)
   → "← Simulations" returns to the card (where it was left) → "←
   WildQuant" returns to the home page's Simulations section.
8. `git diff` touches only the files listed in section 1.

---------------------------------------------------------------------------

## 10. README and preview

README (`README.md`):
- "Where things are": add rows for `simulations/index.html` (the list of
  simulations), `simulations/population-dynamics/discrete-logistic/`
  (the logistic model page), `js/lib/plot.js` (plots in chalk style) and
  `js/sims/` (one file per simulation).
- "Common edits": **Add a simulation**:
  1. copy the folder `simulations/population-dynamics/discrete-logistic/`
     to a new folder and write the page;
  2. put its maths and wiring in `js/sims/<name>.js`, using `WQ.Plot`;
  3. in `simulations/index.html`, turn its "coming soon" card into a link
     (`<a class="project-card" … data-collapse>`).

Preview (the user looks at it on claude.ai):
1. In `/home/claude/wq-tools/build_preview.py` add
   `"simulations/population-dynamics/discrete-logistic"` to `PAGES`.
2. Run `python3 /home/claude/wq-tools/build_preview.py`.
3. Publish with the Artifact tool to the existing preview
   `url = https://claude.ai/artifact/5c61VgnZhfKyqGMjF6kFBo`,
   `file_path = <scratchpad>/wq-preview/index.html`,
   `root = <scratchpad>/wq-preview`, and `files` listing at least:
   `simulations/index.html`,
   `simulations/population-dynamics/discrete-logistic/index.html`,
   `css/site.css`, `js/lib/plot.js`, `js/sims/logistic.js`.
   (Files left out stay as they were.)

---------------------------------------------------------------------------

## 11. Commit, push, report

- One commit on `rebuild`, e.g. "Add the simulations page and the
  discrete-time logistic model", with the two attribution lines. Push
  `rebuild`. **Do not merge into `master`.**
- Report to the user in a few lines: what was built, the preview is
  updated, the README slips found (5.5), and ask whether to put it live
  (merge into `master`).
