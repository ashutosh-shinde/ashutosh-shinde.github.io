# Population dynamics simulations — shared plan (step 0 and rules for every page)

Read this whole file before every step. Each page has its own plan (`pd-02` … `pd-06`); this file holds
what they share: the rules, the workspace set-up, the shared code built in **step 0**, the style of the
terminal boxes, the runtime checks and the testing routine.

Order (one prompt per step, in this order; do not start a step before the previous one is pushed):

| Step | Plan | Builds |
|---|---|---|
| 0 | this file, section 4 | shared code: `js/lib/ode.js`, `js/lib/simkit.js`, additions to `js/lib/plot.js` and `css/site.css`, `tools/test-ode.mjs` |
| 2 | `pd-02-continuous-logistic.md` | card 2: continuous-time logistic model |
| 3 | `pd-03-harvesting.md` | card 3: harvesting with Holling responses |
| 4 | `pd-04-lv-competition.md` | card 4: Lotka–Volterra competition |
| 5 | `pd-05-consumer-resource.md` | card 5: consumer–resource model |
| 6 | `pd-06-prey-predator.md` | card 6: prey–predator models |

The finished example to copy from is card 1: `simulations/population-dynamics/discrete-logistic/index.html`
and `js/sims/logistic.js` (built from `tools/plans/simulations-plan.md`). **Do not change card 1's files.**

---------------------------------------------------------------------------

## 1. Rules

- Repo `/home/claude/ashutosh-shinde.github.io`, branch **`rebuild`**. Commit and push to `rebuild` only.
  **Never push to or merge into `master`** (the live site); the owner says when.
- Every commit message ends with exactly the two attribution lines the session gives you (the
  "Co-Authored-By: …" and "Claude-Session: …" lines from the system reminder). If none is given, use
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Change only the files the step's plan lists. Card 1, the home page, the engine, the scenes and the
  page-change animation stay as they are.
- No external libraries, CDNs or build steps. Plain HTML, CSS and JavaScript (ES2019 is fine).
- Every new file starts with a header comment saying what it does, with a `HOW TO EDIT:` note (house style).
- **No guessing.** Every formula, threshold and expected number in the plans was checked by computation.
  If something you compute disagrees with a plan, check your code first; if the plan is wrong, say so in
  your report with the numbers, and follow the mathematics. Never invent a number for a box or a test.
- Deterministic: no `Math.random()` anywhere in the simulations (screenshots and tests must repeat).
- Text the visitor reads (boxes, notes, theory) is plain English, short sentences.

## 2. Workspace set-up (the container may be fresh: check every time)

1. `git -C /home/claude/ashutosh-shinde.github.io rev-parse HEAD`. If that fails, the repo is not here:
   call `mcp__claude-code-remote__add_repo` with owner `ashutosh-shinde`, repo `ashutosh-shinde.github.io`,
   access `push`, then
   `git clone --depth 50 --no-single-branch https://github.com/ashutosh-shinde/ashutosh-shinde.github.io /home/claude/ashutosh-shinde.github.io`
   (long timeout), and `register_repo_root`.
2. `cd /home/claude/ashutosh-shinde.github.io && git checkout rebuild && git pull --ff-only origin rebuild`.
3. The owner's model code (reference only, never edit it):
   `git clone --depth 1 https://github.com/ashutosh-shinde/Population-Dynamics.git /tmp/pd`
   (or `git -C /tmp/pd pull` if it exists). Each plan names the folder to read.
4. Tools: Python 3 with Playwright and Chromium are pre-installed (`python3 -c "import playwright"`); do
   not install Playwright. Node is available (`node -v`). Pillow (`PIL`) is available for screenshots.
5. The checking tools are in the repo: `tools/dev/` (see `tools/dev/README.md`).

## 3. Site conventions (read the card 1 page to see them in place)

### 3.1 A model page

Folder `simulations/population-dynamics/<name>/index.html` (three folders deep: paths start with `../../../`).
Copy card 1's page and change it. It has, in order:

1. `<head>`: meta tags (title `<Model> — WildQuant`, a description), the favicon line (copy), the font
   preload and `../../../css/site.css`, then **the inline script marked "arriving from another page of the
   site", copied unchanged**, then deferred scripts in this order:
   `js/lib/core.js`, `js/lib/chalk.js`, `js/engine/engine.js`, `js/lib/plot.js`, `js/lib/ode.js` (if the page
   integrates an ODE), `js/lib/simkit.js`, `js/sims/<name>.js`, and **last** `js/site.js` (all `../../../`).
   Never load `js/sims/logistic.js` on another page: it wires card 1's page.
2. `<body class="page page--sim">` with **no `data-scene`** (plain blackboard), the two canvases
   `<canvas id="board-tex" aria-hidden="true"></canvas><canvas id="board-fx" aria-hidden="true"></canvas>`,
   and the back link `<a class="back" href="../../" data-collapse data-back="#pd-N"><span aria-hidden="true">←</span> Simulations</a>`.
3. `<main class="page__main sim">` containing:
   - `<header class="sim-head" data-calm>`: kicker `<p class="article__kicker">Deterministic population dynamics · N</p>`,
     `<h1 class="page__title sim__title"><span class="chalk-text">…</span></h1>`, and `<div class="sim-eq">`
     with `<p class="sim-eq__formula">` (the equation in `<span class="m">…</span>`) and a
     `<dl class="sim-notation">` of `<div><dt>…</dt><dd>…</dd></div>` rows (one short line each).
   - one `<section class="sim-sec" id="…" aria-labelledby="…">` per part, each with an `<h2 class="sim-sec__title">`,
     a short `<p class="sim-sec__lead">` where useful, controls, and one or more
     `<div class="sim-panel">` = `<figure class="sim-plot"><canvas id="cv-…" role="img" aria-label="…"></canvas>
     <figcaption class="sim-cap">…</figcaption></figure>` + `<div class="term" id="term-…" aria-live="polite" aria-label="…"></div>`.
   - `<section class="sim-sec sim-theory" data-calm>` with `<ul>` theory bullets.
   - `<section class="sim-more" data-calm>`: the GitHub button (`target="_blank" rel="noopener"`, **no**
     `data-collapse`) and `<a class="btn" href="../../" data-collapse data-back="#pd-N"><span aria-hidden="true">←</span> Back to the simulations</a>`.
4. Maths in HTML: `<span class="m"><i>x</i><sub>0</sub></span>`; letters in `<i>`, `<sub>`/`<sup>`;
   minus sign `−` (U+2212). Greek: `α β γ δ θ λ μ` (they fall back to the text font: fine).
5. `data-calm` on text blocks and control rows (not on the plots).
6. Slider markup (exactly as on card 1; every control needs an `id`, the sweep tool finds controls by id):
   `<label class="sim-ctl"><span class="sim-ctl__name"><span class="m"><i>r</i><sub>m</sub></span></span><input type="range" id="rm" min="0" max="3" step="0.001" value="0.11"><output id="rm-out" for="rm">0.110</output></label>`
   inside `<div class="sim-controls" data-calm>`. Mode switches go in `.sim-seg`, presets in `.sim-presets`
   (the sweep tool clicks those); other buttons are `.sim-btn`.

### 3.2 The Simulations page and the README

- `simulations/index.html`: card N is a `<div class="project-card project-card--soon" id="pd-N" aria-disabled="true">`.
  Turn it into `<a class="project-card" id="pd-N" href="population-dynamics/<name>/index.html" data-collapse>`
  (closing `</a>`), keep its number, title and one-liner, and replace the badge
  `<span class="project-card__badge">Coming soon</span>` with
  `<span class="project-card__go">Open <span aria-hidden="true">→</span></span>` (exactly like card 1).
- `README.md` "Where things are": add a row for the new page folder and its `js/sims/<name>.js`
  (with "tested by `node tools/test-<name>.mjs`").

### 3.3 Colours (from `WQ.Plot.COLORS`)

`white #f6f4ec` (main curve, the state in 1-D models), `yellow #f2d675` (species 1, prey, harvest curve,
the current-parameter marker), `blue #9cc9f0` (species 2, second curve), `pink #f2a7c3` (predator,
"collapse" lines), `orange #f0b27a` (warnings, the ramp's path), `green #7dff8a` (terminal boxes only).
Each page plan says which is which; keep the same meaning within a page.

### 3.4 Speed

- One redraw per animation frame (`WQ.Sim.loop`). Terminal boxes update at most every 150 ms.
- Heavy work (a fan of trajectories, a parameter scan, the ramp) is **debounced** (200 ms after the last
  input) and may draw progressively; a slider drag must never freeze the page.
- Integrations always have a step limit (`maxSteps`); when it is hit the box says so in words.

---------------------------------------------------------------------------

## 4. Step 0 — the shared code

Build these, test them (section 4.6), commit and push. No model page in this step.

### 4.1 `js/lib/ode.js` → `WQ.ODE`

Pure maths, no DOM (it must load in node: end with `(typeof window !== "undefined" ? window : globalThis)`).

**`solve(f, y0, t0, t1, opts)`** — adaptive Dormand–Prince 5(4) (non-stiff).
- `f(t, y, dy)` writes the derivative of `y` (a `Float64Array`) into `dy` (a `Float64Array`); no allocation inside.
- `opts`: `rtol = 1e-7`, `atol = 1e-9`, `h0` (first step; default `(t1 − t0) * 1e-4`), `hmax = (t1 − t0) / 20`,
  `maxSteps = 200000` (attempted steps), `samples = 600` (output points, evenly spaced from `t0` to `t1`
  inclusive), `nonneg = true` (after every accepted step, set negative components to 0), `floor` (optional
  number or array: after every accepted step `y_i = max(y_i, floor_i)`; used by card 3's ramp to keep a tiny
  remnant population),
  `stop(t, y)` (optional: return true to end the run early, e.g. extinction), `big = 1e9` (if any `|y_i| > big`
  or not finite: end with status `"blowup"`).
- Returns `{ t: Float64Array, y: [Float64Array per component], n, status, tEnd, steps }` where `n` = how many
  output samples are filled (all of them when `status === "ok"`), `status` ∈ `"ok" | "stopped" | "maxsteps" | "blowup"`.
- Tableau (exact values; `c` nodes, `a` rows, `b` 5th-order weights = row 7, `e = b − b*` error weights):
  ```
  c = [0, 1/5, 3/10, 4/5, 8/9, 1, 1]
  a2 = [1/5]
  a3 = [3/40, 9/40]
  a4 = [44/45, −56/15, 32/9]
  a5 = [19372/6561, −25360/2187, 64448/6561, −212/729]
  a6 = [9017/3168, −355/33, 46732/5247, 49/176, −5103/18656]
  a7 = [35/384, 0, 500/1113, 125/192, −2187/6784, 11/84]          (= b; FSAL: k7 of a step is k1 of the next)
  b* = [5179/57600, 0, 7571/16695, 393/640, −92097/339200, 187/2100, 1/40]
  e  = b − b* = [71/57600, 0, −71/16695, 71/1920, −17253/339200, 22/525, −1/40]
  ```
  `y_new = y + h·Σ b_j k_j`; error vector `err = h·Σ e_j k_j`.
- Step control: `sc_i = atol + rtol·max(|y_i|, |y_new_i|)`, `E = sqrt(mean((err_i/sc_i)²))`.
  Accept if `E ≤ 1`. New step `h ← h · min(5, max(0.2, 0.9·E^(−1/5)))` (if `E = 0` use factor 5); never
  exceed `hmax`, and shorten the last step so it ends exactly at `t1`. Steps may pass output times freely:
  the samples come from the interpolation below.
- Output: dense output by **cubic Hermite** between accepted steps (`θ = (t − t_n)/h`):
  `y(θ) = (2θ³ − 3θ² + 1)·y_n + (θ³ − 2θ² + θ)·h·f_n + (−2θ³ + 3θ²)·y_{n+1} + (θ³ − θ²)·h·f_{n+1}`
  with `f_n = k1`, `f_{n+1} = k7`. Clamp interpolated values to ≥ 0 when `nonneg`, and to ≥ `floor` when given.
- `stop` and `blowup` are tested after each accepted step; the samples after the stop time stay unfilled
  (`n` counts the filled ones) and `tEnd` is the stop time.

**`solveStiff(f, jac, y0, t0, t1, opts)`** — adaptive ROS2 (Rosenbrock, L-stable, order 2; for the
consumer–resource page, whose resource can change thousands of times faster than the consumers).
- `jac(t, y, J)` fills the n×n Jacobian `J` (array of rows, or a flat `Float64Array` n·n row-major: pick one
  and document it). Same `opts` and return value as `solve`, with defaults `rtol = 1e-5`, `atol = 1e-8`,
  `maxSteps = 100000`.
- One step from `y` with step `h` (`γ = 1 + 1/√2`, `M = I − γ·h·J(y)`):
  ```
  M k1 = f(y)
  M k2 = f(y + h·k1) − 2·k1
  y_new = y + (3/2)·h·k1 + (1/2)·h·k2
  err   = y_new − (y + h·k1)            (the embedded first-order solution)
  ```
  Solve `M k = r` by Gaussian elimination with partial pivoting (write a small `solveLinear(n, M, r)`).
  Accept if `E ≤ 1` (same `E` as above); `h ← h · min(4, max(0.2, 0.9·E^(−1/2)))`.
  This is for **autonomous** systems only (`f` must not depend on `t`); say so in the header comment.
- Output by linear interpolation between accepted steps (enough for plots).

**`eig2(a, b, c, d)`** — eigenvalues of `[[a, b], [c, d]]`:
`tr = a + d`, `det = a·d − b·c`, `disc = tr² − 4·det`. If `disc < −1e-14·(tr² + |det| + 1)`: complex pair
`re = tr/2`, `im = ±sqrt(−disc)/2`; else real `λ = tr/2 ± sqrt(max(disc, 0))/2`, returned with `λ1 ≤ λ2`.
Returns `{ tr, det, disc, complex, re1, im1, re2, im2 }`.

**`classify2(e, tol = 1e-8)`** (the README's table; the owner's R code uses the same tolerance):
- complex: `re < −tol` → `"stable spiral"`; `re > tol` → `"unstable spiral"`; else `"center"`.
- real: both `< −tol` → `"stable node"`; both `> tol` → `"unstable node"`; one `> tol` and one `< −tol` →
  `"saddle"`; otherwise (an eigenvalue within `tol` of 0) → `"non-hyperbolic"`.
- Returns `{ label, stable: label starts with "stable", repeated: !complex && |λ2 − λ1| ≤ tol }`.

**`bisect(g, a, b, tol = 1e-13, maxIt = 200)`** — a root of `g` in `[a, b]` when `g(a)·g(b) ≤ 0`
(return `a` or `b` if either is exactly 0). **`jacFD(f, y, h = 1e-6)`** — numerical Jacobian by central
differences (for the runtime checks).

### 4.2 `js/lib/simkit.js` → `WQ.Sim`

Shared page helpers. Pure helpers must work in node; DOM helpers touch `document` only when called.

- `checking` — true when the URL has `check=1` (false in node, where there is no `location`). `check(name, ok, detail)` — when `checking`: `ok` →
  `console.log("[check] ok " + name)` (at most once per name per second, to keep the console small);
  not ok → `console.error("[check] FAIL " + name + ": " + detail)`. Counts in `WQ.Sim.checks = { ok, fail }`.
  When not checking, it does nothing (and costs nothing: pages call it only inside `if (WQ.Sim.checking)`).
- Numbers: `fmt(v, d = 3)` → fixed decimals with U+2212 minus (`"−0.123"`); `fmtSig(v, n = 4)` → n
  significant digits, scientific form `1.23e−5` when `|v| < 1e-3` or `|v| ≥ 1e6` (but `0` → `"0"`);
  `signed(v, d)` → always a sign (`"+0.200"`, `"−1.000"`); `pad(s, n)` (right-pad with spaces).
  **None of these may ever return "NaN", "Infinity" or "undefined"**: for a non-finite input they return `"—"`
  (and `∞` / `−∞` for ±Infinity). `finite(...xs)` → true if all are finite numbers.
- Text for boxes: `esc(s)` (HTML-escape `& < >`); `subs(s)` → turns `X_t`, `N_1`, `R_0`, `α_21`, `ε_tol`,
  `t_max` … into `X<sub>t</sub>` etc.: regex `/([A-Za-zα-ωΑ-Ω])_([A-Za-z0-9]+)/g` → `"$1<sub>$2</sub>"`,
  applied to already-escaped plain text, before any span is added.
- `term(el, lines)` — renders a terminal box. `lines` is an array; each item is either a string (a plain
  line), or `{ t: "text", c: "hi" | "dim" | "warn" | "why" }`, or an array of such segments (one line made
  of several pieces). Each text goes through `subs(esc(...))`; classes map to `term__hi`, `term__dim`,
  `term__warn`, `term__why`. Joins lines with `\n`, appends the cursor
  `<span class="term__cursor" aria-hidden="true"></span>`, sets `el.innerHTML`.
  Shorthands: `hi(t)`, `dim(t)`, `warn(t)`, `why(t)` return segment objects; `why` lines start with `"  · "`.
- `slider(id, { fmt, log = false, onInput })` — binds `<input type="range" id>` and its `<output id="{id}-out">`:
  reads `min/max/step` from the element; for `log: true` the element's value is `log10` of the model value
  (so `get()` returns `10 ** el.value`); updates the readout and `aria-valuetext` with `fmt(value)`; returns
  `{ el, get(), set(v, { silent }) }` (`set` takes the model value, clamps to the range, updates the readout,
  and calls `onInput` unless `silent`). Inputs fire `onInput` on every `input` event.
- `seg(groupEl, onChange)` — a segmented control: `<div class="sim-seg" role="group" aria-label="…">` with
  `<button type="button" data-value="…">`; marks the chosen one with `aria-pressed="true"`;
  returns `{ get(), set(v) }`.
- `presets(el, list, apply)` — fills `<div class="sim-presets" role="group" aria-label="Presets">` with one
  `<button type="button">` per `{ label, values }` (label text from the plan), calling `apply(values)`.
- `loop(render)` — `{ want(...names), schedule() }`: marks parts dirty and calls `render(dirtySet)` once in the
  next animation frame. `throttle(fn, ms = 150)` and `debounce(fn, ms = 200)`.
- `reduced` — true when the visitor prefers reduced motion.

### 4.3 Additions to `js/lib/plot.js` (backward compatible: card 1 must look exactly the same)

Add to the plot object created by `WQ.Plot.create` (keep every existing method and default):
- `field(fn, { n = 15, color = "rgba(246,244,236,0.3)", len = 0.4 })` — direction field: on an n×n grid of
  cell centres (data coordinates) call `fn(x, y)` → `[dx, dy]` (data units/time), convert to pixel direction
  (account for the axes' scales, y up), skip cells where the speed is 0 or not finite, draw a line of length
  `len × cell size` centred on the cell, with a small arrowhead (2 short strokes). On phones (`W < 500`) use
  `n = 11`.
- `marker(x, y, kind, { label, color = white, r = 5 })` — equilibrium marker: `"stable"` filled circle;
  `"unstable"` open circle (dark fill `#0d0f0f`, 1.6 px ring); `"saddle"` circle half filled (left half);
  `"center"` and `"neutral"` open dashed ring. Optional small label (11 px) above-right, kept inside the plot.
- `line(xs, ys, color, { …existing, arrowAt })` — new option: draw a small arrowhead pointing along the path
  at the point where the fraction `arrowAt` (0–1) of the path's pixel length is reached.
- `fill(xs, ys, color)` — fill the polygon (data coordinates), clipped to the plot area.
- `band(xs, lo, hi, color)` — fill between two curves.
- `onTap(cb)` — calls `cb(x, y)` (data coordinates) for a tap or click **inside the plot area**: pointerdown →
  pointerup within 8 px and 500 ms; it never calls `preventDefault`, so a drag still scrolls the page on phones.
- `segments(pts, color, opts)` is not needed; draw dashed curves with `line(..., { dash: [5, 4] })`.

### 4.4 Additions to `css/site.css` (in section 6b, after the existing simulation rules)

- `.sim-seg` — a row of buttons like `.sim-toggle` (pill border `var(--line)`, pressed = filled ink, dark
  text), wrapping on phones; buttons `font: 500 13px var(--sans)`, padding `7px 12px`.
- `.sim-presets` — a wrapping row of small `.sim-btn`-like buttons (12.5 px), with a quiet label before it
  ("Presets") in `--ink-3`.
- `.sim-group` — a `<fieldset>` for a group of sliders with a `<legend>` (e.g. "Species 1"), no border,
  `min-width: 0`; `.sim-controls--grid` — `display: grid; grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr)); gap: 10px 28px`
  for pages with many sliders.
- `.sim-plot--phase canvas { height: clamp(300px, 46vw, 560px); cursor: crosshair; }`
- `.term__warn { color: #f0b27a; text-shadow: 0 0 6px rgb(240 178 122 / 0.35); }`
  `.term__why { color: #b4f7bb; opacity: 0.92; }`
- `.sim-btn--play` (a play/pause button: same as `.sim-btn`, min-width 5.5em).
- `.sim [hidden] { display: none !important; }` — needed because `.sim-ctl`, `.sim-panel` and others set
  `display`, which would override the `hidden` attribute (pages hide the sliders of other types/models).
- Nothing in section 7 changes; card 1 must look the same (check its screenshot before and after).

### 4.5 README and tools

- `README.md` "Where things are": rows for `js/lib/ode.js` ("ODE solvers: Dormand–Prince, ROS2 for stiff
  models, 2×2 eigenvalues"), `js/lib/simkit.js` ("shared page helpers for the simulations: sliders, boxes,
  runtime checks") and `tools/dev/` ("checking tools: screenshots, slider sweeps, error pass, page changes").
- `tools/dev/` already exists (snap, sweep, errpass, nav, build_preview). Do not rewrite it.

### 4.6 Step 0 tests: `tools/test-ode.mjs` (node; load `js/lib/ode.js` and `js/lib/simkit.js` with `vm` like `tools/test-logistic.mjs`)

| Case | Expect |
|---|---|
| `solve`: y′ = −y, y(0) = 1, t ∈ [0, 5] | y(5) = e^(−5) = 0.006737947 within 1e-8 (rtol 1e-10, atol 1e-12) |
| `solve`: logistic y′ = y(1 − y), y(0) = 0.1, t = 5 (rtol 1e-10, atol 1e-12) | 1/(1 + 9e^(−5)) = 0.942826 within 1e-7 |
| `solve`: harmonic x″ = −x (x, v) = (1, 0), t = 100 (rtol 1e-10, atol 1e-12, `nonneg: false`) | x² + v² = 1 within 1e-6; x(100) = cos 100 = 0.862319 within 1e-5 |
| `solve`: Lotka–Volterra r = β = γ = δ = 1 from (0.5, 0.5), t = 50 | V = N − ln N + P − ln P stays 2.386294 within 1e-6 (rtol 1e-10) |
| `solve`: `stop` when y < 0.5 on y′ = −y from 1 | status "stopped", tEnd = ln 2 = 0.693147 within 1e-3 |
| `solve`: y′ = y² from 1 on [0, 2] | status "blowup" (it explodes at t = 1); no exception; tEnd < 1.0001 |
| `solve`: maxSteps 10 on a long run | status "maxsteps", no exception |
| `solve`: `nonneg` on y′ = −10 (constant) from 1 | no sample below 0 |
| `solve`: `floor: 0.25` on y′ = −y from 1, t = 5 | every sample ≥ 0.25, the last one 0.25 |
| `solveStiff`: y′ = −2y + 1, y(0) = 0, t = 1 | (1 − e^(−2))/2 = 0.432332 within 1e-4 |
| `solveStiff`: the stiff consumer–resource corner of `pd-05` (section 8 there) | matches the reference values there within 0.1 % |
| `eig2(0, −1, 1, 0)` | complex, re 0, im ±1 → `classify2` "center" |
| `eig2(−1, 0, 0, −0.4)` | real −1, −0.4 → "stable node" |
| `eig2(−1, −0.6, 0, 0.4)` | real −1, 0.4 → "saddle" |
| `eig2(−0.4, −2, 0.3, 0)` (tr −0.4, det 0.6) | complex −0.2 ± 0.748331i → "stable spiral" |
| `eig2(1, 0, 0, 1e-12)` | "non-hyperbolic" |
| `fmt(NaN)`, `fmtSig(Infinity)`, `fmt(-0.5, 2)` | `"—"`, `"∞"`, `"−0.50"` |
| `subs(esc("R_m < 1, α_21 K_2"))` | `R<sub>m</sub> &lt; 1, α<sub>21</sub> K<sub>2</sub>` |

Then check card 1 has not changed: `python3 tools/dev/snap.py simulations/population-dynamics/discrete-logistic/index.html card1`
before your edits and after (look at both), `python3 tools/dev/sweep.py simulations/population-dynamics/discrete-logistic/index.html`
(must pass), and `python3 tools/dev/errpass.py` (must pass).

---------------------------------------------------------------------------

## 5. Terminal boxes ("explainer windows")

Every plot has a box beside it (below it on phones). The box explains **what the plot shows and why**.

- Lines start with `> ` for a heading line (a quantity, a state, a verdict); detail lines are indented two
  spaces; **why** bullets are `  · ` lines (`why()`), each one short (≤ ~60 characters, at most 2 wrapped lines).
- Order in every box: (1) the parameters in one line; (2) the numbers (equilibria, eigenvalues, times …);
  (3) the state or verdict, highlighted with `hi()`; (4) 2–4 **why** bullets that explain the cause in plain
  words (the plan gives the wording for each case); (5) a `warn()` line only when something is off (a run left
  the plot, a step limit was hit, a value is a numerical artifact).
- Numbers: equilibria 4 significant digits, rates and eigenvalues 3 decimals with a sign (`signed`), times
  2 decimals. Subscripts with `_` (rendered by `subs`). Unicode minus. `∞` for infinite, `—` for "none".
- **Never** print `NaN`, `Infinity`, `undefined`, `null` (the sweep fails on them): handle every edge case in
  words (the plans list them).
- `aria-live="polite"` on each box; update at most every 150 ms.
- A box is never empty: while a debounced part is still computing, its box shows `> computing…` (dim) and its
  plot keeps the previous drawing (or just the axes).

## 6. Runtime checks (`?check=1`)

Each model page implements `runChecks()` that runs after every recomputation **only when `WQ.Sim.checking`**.
It re-derives facts independently and calls `WQ.Sim.check(name, ok, detail)`. Each plan lists its checks; in
every page at least:
- every equilibrium shown satisfies `|f(u*)| ≤ 1e-9 · scale` (scale = the typical size of the state);
- every stability label agrees with the sign of the numerically differentiated `f` (`jacFD` + `eig2`)
  unless it is within 1e-6 of zero (then skip);
- every number written in a box is finite;
- trajectories stay ≥ 0 and finite (or the box shows the warning for that case).

## 7. Testing routine (every page step; all must pass before committing)

1. `node tools/test-<name>.mjs` — the plan's table of known values and edge cases. All pass.
2. `python3 tools/dev/snap.py simulations/population-dynamics/<name>/index.html <name>_desk` and
   `… <name>_phone --phone`. **Open and look at every part** (`<name>_desk_0.png` …): plots readable, boxes
   readable and beside their plot on desktop / below it on phones, no overlap, no overflow, nothing cut off.
   Also take a screenshot in an interesting state (`--js` to set sliders) for each special case in the plan.
3. `python3 tools/dev/sweep.py simulations/population-dynamics/<name>/index.html` and the same with `--phone`
   (pages with debounced panels — cards 3 to 6 — add `--settle 450` so the debounced work finishes before each
   check). 0 failures. If the "slowest updates" line shows more than 400 ms, make that part lighter.
4. `python3 tools/dev/errpass.py` — 0 problems (every page of the site).
5. `python3 tools/dev/nav.py --card pd-N` and with `--phone` — all ok.
6. `node tools/test-logistic.mjs` and `node tools/test-ode.mjs` still pass (shared code not broken).
7. `git diff --stat` touches only the files the plan lists.

## 8. The preview and the report

- Build into the session's **scratchpad directory** (the Artifact tool only accepts files under the working
  directory or the scratchpad, not `/tmp`): `python3 tools/dev/build_preview.py <scratchpad>/wq-preview`.
- Publish with the Artifact tool to the existing preview
  `url = https://claude.ai/artifact/5c61VgnZhfKyqGMjF6kFBo`, `file_path = <scratchpad>/wq-preview/index.html`,
  `root = <scratchpad>/wq-preview`, and `files` listing every file this step added or changed (for example
  `css/site.css`, `simulations/index.html`, `simulations/population-dynamics/<name>/index.html`,
  `js/lib/plot.js`, `js/lib/ode.js`, `js/lib/simkit.js`, `js/sims/<name>.js`). Files left out stay as published.
- If the publish is refused because you have not seen the live version or some files: read exactly what it
  lists (`action: "read"` with `path`/`paths`), check that your files contain everything in them (they come
  from the same repo), and publish again. Never use `force`.
- Commit (one commit per step, message: what the visitor gets, plus the attribution lines), `git push origin rebuild`.
- Report in a few lines: what was built, that the preview is updated, anything in the owner's README that
  disagrees with the mathematics (with numbers), and ask whether to put it live (merge into `master`).

---------------------------------------------------------------------------

## 9. The prompts (one per step; send each after the previous step is pushed)

Step 0:
```
Read tools/plans/pd-00-foundation.md in the repo (branch rebuild) and do step 0 exactly (section 4):
the shared code, its tests, and the checks that card 1 is unchanged. Do not build any model page yet.
Commit and push to rebuild (not master), update the preview, and report briefly.
```

Steps 2 to 6 (replace the file name each time: pd-02-continuous-logistic.md, pd-03-harvesting.md,
pd-04-lv-competition.md, pd-05-consumer-resource.md, pd-06-prey-predator.md):
```
Read tools/plans/pd-00-foundation.md (shared rules) and tools/plans/pd-02-continuous-logistic.md, then
build that page exactly as planned. Run every check in both plans: the node tests, the ?check=1 sweep on
desktop and phone, the error pass, the navigation check, and look at the screenshots (every part, desktop
and phone, and each special case the plan lists). Fix whatever fails and run the checks again. Then update
the preview, commit and push to rebuild (not master), and report briefly.
```
