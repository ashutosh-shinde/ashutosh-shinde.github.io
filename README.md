# WildQuant — ashutosh-shinde.github.io

*Some curious explorations in mathematics and wildlife*, by Ashutosh Shinde.

The whole background is drawn live in code on a blackboard: chalk equations,
animals and a stick-figure explorer. There are no videos or background images.
Each section of the home page has its own scene. Scrolling to the next section
dissolves one scene into chalk dust that re-forms as the next, and the scroll
position is the timeline: stop half-way and you see the half-way state.

## Preview on your computer

```
cd ashutosh-shinde.github.io
python3 -m http.server 8000
```

Then open <http://localhost:8000>. Use a local server: opening `index.html` by
double-click blocks the fonts.

## Where things are

| What | File |
|---|---|
| Home page text, links, section texts, the comment box | `index.html` |
| Section pages (blank for now) | `about/`, `blogs/` → each has an `index.html` |
| Simulations: the list of collections and their numbered cards | `simulations/index.html` |
| A simulation page (one folder each), e.g. the discrete-time logistic model | `simulations/population-dynamics/discrete-logistic/index.html` |
| Card 2: the continuous-time logistic model | `simulations/population-dynamics/continuous-logistic/` + `js/sims/continuous-logistic.js` (tested by `node tools/test-continuous-logistic.mjs`) |
| Card 3: harvesting with Holling responses | `simulations/population-dynamics/harvesting/` + `js/sims/harvesting.js` (tested by `node tools/test-harvesting.mjs`) |
| Plots in chalk style (axes, lines, legends, log axes) | `js/lib/plot.js` |
| ODE solvers: Dormand–Prince, ROS2 for stiff models, 2×2 eigenvalues | `js/lib/ode.js` (tested by `node tools/test-ode.mjs`) |
| Shared page helpers for the simulations: sliders, boxes, runtime checks | `js/lib/simkit.js` |
| Checking tools: screenshots, slider sweeps, error pass, page changes, preview | `tools/dev/` (see its README) |
| A simulation's maths and controls (one file per simulation) | `js/sims/`, e.g. `js/sims/logistic.js` (tested by `node tools/test-logistic.mjs`) |
| Elementary Mathematics: title, index and the list of chapters | `elementary-mathematics/index.html` |
| A chapter (one folder each) | `elementary-mathematics/what-is-infinity/index.html` |
| Comments page | `comments/index.html` |
| Colours, fonts, sizes, where each section's text sits | `css/site.css` (tokens at the top) |
| The scroll / dust / calm-zone / page-change engine | `js/engine/engine.js` (settings in `CFG`) |
| The six home-page scenes | `js/scenes/home.js`, `simulations.js`, `elementary.js`, `lab.js`, `blog.js`, `feedback.js` |
| Page backgrounds: drifting pure maths (Elementary Mathematics), snow on grass (chapters) | `js/scenes/pure.js`, `js/scenes/snowfield.js` |
| Falling chalk snow (Feedback, Comments, chapters) | `js/lib/snowfall.js` |
| Animals (hare, wolf, deer, tiger, leopard, owl, ibex, snow leopard, eye) | `js/lib/creatures.js` |
| The explorer (stick figure with glasses and backpack) | `js/lib/explorer.js` |
| Chalk equations, chalk lines, blackboard texture | `js/lib/chalk.js` + `js/data/equations.js` and `js/data/pure.js` (both generated) |
| Fonts (small subsets) and their licences | `fonts/` + `fonts/LICENSES.txt` |
| Comment storage (Google Sheet) | `js/comments.js` + `tools/comments-google-apps-script.gs` |
| Old site | `trash/` (not linked anywhere) |

Every file starts with a comment that explains what it does and has a
**HOW TO EDIT** note listing the settings worth changing.

## Common edits

- **Text and links:** edit `index.html`. Every section is marked with a comment
  banner, for example `<!-- ===== 2 · SIMULATIONS -->`.
- **Fill a section page:** open its `index.html` and write below the title.
- **Turn on comments:** follow the steps at the top of
  `tools/comments-google-apps-script.gs`. It takes about 10 minutes. Then paste
  the web-app URL into `SHEET_URL` in `js/comments.js`. To remove a comment,
  delete its row in the sheet.
- **Add or change an equation:**
  1. Edit `ITEMS` in `tools/make_equations.py`.
  2. Run `python3 tools/make_equations.py`. This needs LaTeX
     (`pdflatex` and `pdftocairo`).
  3. Use the new id in a scene.
- **Add or change a drifting note on the Elementary Mathematics page:** edit
  `PURE` in `tools/make_equations.py` and run
  `python3 tools/make_equations.py pure`. Every entry appears on the page by
  itself. Ids starting with `n_` are theorem names, the rest are formulas.
- **Add a chapter to Elementary Mathematics:**
  1. Copy the folder `elementary-mathematics/what-is-infinity/` to a new
     folder, for example `elementary-mathematics/my-new-idea/`.
  2. Write the chapter in the new folder's `index.html`: title, date, text.
     In its two back links, change `data-back="#what-is-infinity"` to the new
     chapter's id, so that a visitor who came straight to the chapter goes back
     to its intro.
  3. In `elementary-mathematics/index.html`, add a line to the index and copy
     a `<section class="chapter">` for it (a comment there shows how).
- **Add a simulation:**
  1. Copy the folder `simulations/population-dynamics/discrete-logistic/` to a
     new folder and write the page.
  2. Put its maths and wiring in `js/sims/<name>.js`, drawing with `WQ.Plot`
     (`js/lib/plot.js`), and load both scripts in the page before `site.js`.
  3. In `simulations/index.html`, turn its "coming soon" card into a link
     (`<a class="project-card" … data-collapse>`; a comment there shows how).
- **Write maths in a chapter** (it is set in Latin Modern, like LaTeX):
  - inline: `<span class="m"><i>f</i> : ℕ → ℝ</span>`, with letters in
    `<i>` and `<sub>` / `<sup>` for indices and powers
  - root: `<span class="m">√<span class="rt">2</span></span>`
  - fraction: `<span class="frac"><span>1</span><span>2</span></span>`
  - on its own centred line: `<p class="math"><span class="m">…</span></p>`
  - theorem and proof: `<div class="theorem">…</div>`,
    `<div class="proof">…<span class="qed">∎</span></div>`
  - the maths font has `ℕ ℚ ℝ ℤ ∅ ∈ ∉ ∋ ∌ ⊂ ⊃ ⊆ ⊇ ∪ ∩ → ↦ ⇒ ⇔ ∀ ∃ ≤ ≥ ≠ ≡ ∞ √ ℵ
    − × · … ⋯ ∖ ∣ ∎ 𝒫 𝜋 𝜑 𝜀 𝛿`; other symbols use the text font.
- **Timing of a scene:** the timeline constants (`T = {...}`) are at the top of
  each scene file.
- **Speed and quality:** `CFG` in `js/engine/engine.js` sets the pixel budget
  and the number of particles. The engine also lowers quality by itself on slow
  devices.

## Adding a page

Every page of the site opens and closes with the same animation: a click on a
link pulls the drawings into the link, and the next page opens under a quick
flash from the same spot. A new page gets this, and the blackboard, by being
built like the others. The easiest way is to copy a page and change it: copy
`about/index.html` for a plain page, or a chapter for a long read. If you
build one from scratch, it needs all of these:

1. **In `<head>`:** `../css/site.css` and the small inline `<script>` marked
   "arriving from another page of the site" (copy it unchanged from any page).
   Then the scripts `../js/lib/core.js`, `../js/lib/chalk.js`,
   `../js/engine/engine.js` and, last, `../js/site.js`, each with `defer`.
2. **At the top of `<body>`:** the two canvases
   `<canvas id="board-tex" aria-hidden="true"></canvas>` and
   `<canvas id="board-fx" aria-hidden="true"></canvas>`, and a back link
   `<a class="back" href="../" data-collapse data-back="#home"><span aria-hidden="true">←</span> WildQuant</a>`.
   `data-back` makes it a back link: it returns to where the visitor left the
   home page, or to the section it names (here `#home`, the top) if they never
   were there. Use the section that links to your page.
3. **`data-collapse` on every link to another page of the site**, for example
   `<a href="../about/index.html" data-collapse>`. Links to other websites, and
   `#` links within a page, do without.
4. **`data-calm` on the text blocks**, so the drawings fade behind them.
5. **A background (optional):** add `data-scene="…"` to `<body>` and load the
   scene's script after `engine.js` and before `site.js`. `pure` (faint drifting maths, also needs
   `../js/data/pure.js` first) and `snowfield` (snow on grass, also needs
   `../js/lib/snowfall.js` first) are made for pages. Without a scene the page
   shows the plain blackboard.

Paths are relative to the page's folder: `../` from a page one folder deep
(like `about/`), `../../` from two folders deep (like a chapter).

## Behaviour notes

- **Home intro:** it plays once per browser session. Scrolling skips it, and
  so does opening the page further down (a link like `/#feedback`, or a back
  link to where the visitor left).
- **Reduced motion:** visitors with "reduce motion" switched on see one still
  drawing per section. Nothing animates for them.
- **Phones:** they get the same scenes with fewer particles, a smaller flock,
  and layouts arranged for portrait.
- **Calm zones:** any element with `data-calm` keeps the drawings behind it
  faint. Use `data-calm="0.6"` for a lighter effect. Animals are never faded:
  scenes draw them after the calm zones (the "top" pass) and size and place
  them so they stay clear of the text on any screen shape.
- **Page changes:** any link with `data-collapse` pulls the drawings into the
  link in a third of a second (the next page is fetched at the click and
  opened as the swirl closes), and the next page shows at once under a quick
  flash from the same spot; its drawings fade in as soon as the board has
  started. Every page works this way (see "Adding a page"). A page opens at
  its top, or at the `#section` the link names; a back link (`data-back`)
  opens it where the visitor left it instead. The small script at the top of
  every page does this. Timing: `collapse` and `navAt` in `CFG`
  (`js/engine/engine.js`); the flash is `.wq-arrive` and the fade-in
  `.wq-ready #board-fx` in `css/site.css`.
- **Starting quickly:** a page shows its text first and starts the board right
  after. Only the scenes on screen are made at once; the others are made a
  moment later while the page is idle (on the home page with its intro, all at
  once, so that nothing interrupts the intro).
