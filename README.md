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
| Section pages (blank for now) | `about/`, `simulations/`, `elementary-mathematics/`, `blogs/` → each has an `index.html` |
| Comments page | `comments/index.html` |
| Colours, fonts, sizes, where each section's text sits | `css/site.css` (tokens at the top) |
| The scroll / dust / calm-zone / spiral-collapse engine | `js/engine/engine.js` (settings in `CFG`) |
| The six scenes | `js/scenes/home.js`, `simulations.js`, `elementary.js`, `lab.js`, `blog.js`, `feedback.js` |
| Animals (hare, wolf, deer, tiger, leopard, owl, ibex, snow leopard, eye) | `js/lib/creatures.js` |
| The explorer (stick figure with glasses and backpack) | `js/lib/explorer.js` |
| Chalk equations, chalk lines, blackboard texture | `js/lib/chalk.js` + `js/data/equations.js` (generated) |
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
- **Timing of a scene:** the timeline constants (`T = {...}`) are at the top of
  each scene file.
- **Speed and quality:** `CFG` in `js/engine/engine.js` sets the pixel budget
  and the number of particles. The engine also lowers quality by itself on slow
  devices.

## Behaviour notes

- **Home intro:** it plays once per browser session. Scrolling skips it.
- **Reduced motion:** visitors with "reduce motion" switched on see one still
  drawing per section. Nothing animates for them.
- **Phones:** they get the same scenes with fewer particles, a smaller flock,
  and layouts arranged for portrait.
- **Calm zones:** any element with `data-calm` keeps the drawings behind it
  faint. Use `data-calm="0.6"` for a lighter effect.
- **Spiral collapse:** any link with `data-collapse` pulls the drawings into a
  spiral toward the link before the page opens.
