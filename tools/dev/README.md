# tools/dev — checking tools (not part of the site)

Python + Playwright scripts for checking pages in a headless browser. Run them from the repo root.
Screenshots go to `$WQ_SHOTS` (default `/tmp/wq-shots`), outside the repo.

| Script | What it does |
|---|---|
| `snap.py PAGE NAME [--phone]` | full-page screenshot, cut into 1200 px parts (`NAME_0.png` …) that are easy to look at; reports console errors and sideways overflow |
| `sweep.py PAGE [--phone]` | moves every slider of a simulation page through its whole range (ends included), every number box, checkbox, mode button (`.sim-seg`) and preset (`.sim-presets`), plus seeded random combinations; fails on errors, `[check] FAIL` lines, NaN/Infinity/undefined/null in a box, an empty box, a blank plot, or sideways overflow |
| `errpass.py` | opens every page (desktop and phone, motion and reduced motion) and reports console errors and overflow |
| `nav.py --card pd-N [--phone]` | clicks through home → Simulations → card N → back links, and checks where each page opens |
| `build_preview.py OUT_DIR` | builds the folder that is published as the private claude.ai preview (every page is included automatically) |
| `common.py` | shared helpers: the local server, browser contexts, page list |

The maths of each simulation is tested without a browser: `node tools/test-<name>.mjs`.
A page opened with `?check=1` also runs its own runtime checks and logs `[check] ok …` or `[check] FAIL …`
to the console (`sweep.py` opens pages this way).
