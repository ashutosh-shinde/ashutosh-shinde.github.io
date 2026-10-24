#!/usr/bin/env python3
"""sweep.py — move every control of a simulation page through its whole range (ends included) and check
that nothing breaks. The page is opened with ?check=1, so its own runtime checks ([check] FAIL …) count too.

  python3 tools/dev/sweep.py PAGE [--phone] [--values 7] [--random 24] [--seed 1] [--settle 230]

For every mode (the buttons in a .sim-seg group; one pass if there are none):
  • each range slider alone: min, max and evenly spaced values between (the others at their defaults)
  • each number box: empty, small, large, negative and non-numeric input
  • each checkbox: off, then on again
  • each preset (buttons in .sim-presets)
  • --random combinations of all sliders at once (seeded, so a failure can be repeated)
After every change it checks:
  • no page errors and no console errors; no "[check] FAIL" lines from the page
  • no NaN / Infinity / undefined / null in any terminal box, readout or note
  • every terminal box has text; every plot canvas has something drawn on it
  • no sideways overflow
Exit code 1 if anything failed; the failing control and value are printed.
"""
import argparse, os, random, sys, time
sys.path.insert(0, os.path.dirname(__file__))
from common import new_context, ready, serve, watch
from playwright.sync_api import sync_playwright

ap = argparse.ArgumentParser()
ap.add_argument("page"); ap.add_argument("--phone", action="store_true")
ap.add_argument("--values", type=int, default=7); ap.add_argument("--random", type=int, default=24)
ap.add_argument("--seed", type=int, default=1); ap.add_argument("--settle", type=int, default=230)
a = ap.parse_args()

SET = """([sel, v]) => { const e = document.querySelector(sel); if (!e) return false;
  if (e.type === 'checkbox') e.checked = v; else e.value = String(v);
  e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); return true; }"""
INSPECT = r"""() => {
  const bad = /NaN|Infinity|undefined|\bnull\b|\[object/;
  const vis = (e) => !!(e.offsetWidth || e.offsetHeight || e.getClientRects().length) && getComputedStyle(e).visibility !== 'hidden';
  const out = { text: [], empty: [], blank: [], over: document.documentElement.scrollWidth - innerWidth };
  document.querySelectorAll('.term, output, .sim-note, .sim-hint, [aria-live]').forEach((e) => {
    if (!vis(e)) return; const t = e.textContent || '';
    if (bad.test(t)) out.text.push((e.id || e.className) + ': ' + t.replace(/\s+/g, ' ').slice(0, 160));
    if (e.classList.contains('term') && !t.trim()) out.empty.push(e.id || 'term');
  });
  document.querySelectorAll('.sim-plot canvas').forEach((c) => {
    if (!vis(c) || !c.width || !c.height) return;
    const g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height).data; let n = 0;
    for (let i = 3; i < d.length; i += 4 * 7) if (d[i] > 0) n++;
    if (n < 30) out.blank.push(c.id || 'canvas');
  });
  return out; }"""
CONTROLS = r"""() => {
  const q = (s) => [...document.querySelectorAll(s)];
  const sel = (e) => e.id ? '#' + CSS.escape(e.id) : null;
  return {
    ranges: q('main input[type=range]').filter(sel).map((e) => ({ sel: sel(e), min: +e.min, max: +e.max, step: e.step === 'any' ? 0 : +(e.step || 1), value: e.value })),
    numbers: q('main input[type=number]').filter(sel).map((e) => ({ sel: sel(e), value: e.value })),
    checks: q('main input[type=checkbox]').filter(sel).map((e) => ({ sel: sel(e), value: e.checked })),
    modes: q('main .sim-seg button').map((e, i) => i),
    presets: q('main .sim-presets button').map((e, i) => i),
  }; }"""

def snap(v, r):
    if r["step"]:
        v = r["min"] + round((v - r["min"]) / r["step"]) * r["step"]
    return round(min(r["max"], max(r["min"], v)), 10)

base = serve(); errors = []; checks = []; failures = []; states = 0; slow = []
with sync_playwright() as p:
    b = p.chromium.launch(args=["--no-sandbox"])
    ctx = new_context(b, a.phone); pg = ctx.new_page(); watch(pg, errors, checks)
    url = base + a.page + ("&" if "?" in a.page else "?") + "check=1"
    pg.goto(url); ready(pg); pg.wait_for_timeout(600)
    C = pg.evaluate(CONTROLS)
    print(f"{a.page}: {len(C['ranges'])} sliders, {len(C['numbers'])} number boxes, {len(C['checks'])} checkboxes, "
          f"{len(C['modes'])} mode buttons, {len(C['presets'])} presets")

    def check(what):
        global states
        states += 1; t0 = time.time()
        pg.wait_for_timeout(a.settle)
        r = pg.evaluate(INSPECT); dt = (time.time() - t0) * 1000 - a.settle
        if dt > 250: slow.append((round(dt), what))
        prob = []
        if errors: prob.append("errors: " + "; ".join(errors[:3])); errors.clear()
        fails = [c for c in checks if "FAIL" in c]
        if fails: prob.append("checks: " + "; ".join(fails[:3]))
        checks.clear()
        if r["text"]: prob.append("bad text: " + " | ".join(r["text"][:2]))
        if r["empty"]: prob.append("empty box: " + ", ".join(r["empty"]))
        if r["blank"]: prob.append("blank plot: " + ", ".join(r["blank"]))
        if r["over"] > 0: prob.append(f"sideways overflow {r['over']} px")
        if prob: failures.append((what, prob))

    def defaults():
        for r in C["ranges"]: pg.evaluate(SET, [r["sel"], r["value"]])
        for n in C["numbers"]: pg.evaluate(SET, [n["sel"], n["value"]])
        for c in C["checks"]: pg.evaluate(SET, [c["sel"], c["value"]])

    rnd = random.Random(a.seed)
    for m in (C["modes"] or [None]):
        tag = ""
        if m is not None:
            btn = pg.locator("main .sim-seg button").nth(m); tag = f"[mode {btn.inner_text().strip()}] "
            btn.click(); check(tag + "mode button")
            C2 = pg.evaluate(CONTROLS)  # a mode may show other sliders, presets or ranges
        else:
            C2 = C
        ranges, presets = C2["ranges"], C2["presets"]
        vis = pg.evaluate("(sels) => sels.filter((s) => { const e = document.querySelector(s); return e && (e.offsetWidth || e.offsetHeight); })", [r["sel"] for r in ranges])
        ranges = [r for r in ranges if r["sel"] in vis]
        for r in ranges:
            vals = [snap(r["min"] + (r["max"] - r["min"]) * i / (a.values - 1), r) for i in range(a.values)]
            for v in vals:
                pg.evaluate(SET, [r["sel"], v]); check(f"{tag}{r['sel']} = {v}")
            pg.evaluate(SET, [r["sel"], r["value"]])
        for n in C["numbers"]:
            for v in ["", "0", "0.001", "0.5", "1", "-1", "1e-300", "1e300", "abc"]:
                pg.evaluate(SET, [n["sel"], v]); check(f"{tag}{n['sel']} = {v!r}")
            pg.evaluate(SET, [n["sel"], n["value"]])
        for c in C["checks"]:
            pg.evaluate(SET, [c["sel"], False]); check(f"{tag}{c['sel']} off")
            pg.evaluate(SET, [c["sel"], True]); check(f"{tag}{c['sel']} on")
        for i in presets:
            btn = pg.locator("main .sim-presets button").nth(i)
            if btn.is_visible():
                name = btn.inner_text().strip(); btn.click(); check(f"{tag}preset {name}")
        for k in range(a.random):
            combo = {r["sel"]: snap(rnd.uniform(r["min"], r["max"]), r) for r in ranges}
            for s, v in combo.items(): pg.evaluate(SET, [s, v])
            check(f"{tag}random #{k + 1}: " + ", ".join(f"{s}={v}" for s, v in combo.items()))
        defaults()
    b.close()

print(f"states checked: {states}; failures: {len(failures)}")
for what, prob in failures[:25]:
    print(" ✗", what); [print("     ", x) for x in prob]
if slow:
    slow.sort(reverse=True); print("slowest updates (ms over the settle time):", slow[:5])
sys.exit(1 if failures else 0)
