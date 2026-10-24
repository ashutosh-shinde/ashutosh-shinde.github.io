#!/usr/bin/env python3
"""nav.py — click through the page changes for one simulation and check where each page opens:
home → Simulations (top) → the card (the model page opens at its top) → "← Simulations" (back where you
left, the card in view) → "← WildQuant" (home, at its Simulations section); and the model page's bottom
"Back to the simulations" button (the card in view).

  python3 tools/dev/nav.py --card pd-2 [--phone]
"""
import argparse, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from common import new_context, ready, serve, watch
from playwright.sync_api import sync_playwright

ap = argparse.ArgumentParser(); ap.add_argument("--card", required=True); ap.add_argument("--phone", action="store_true"); a = ap.parse_args()
base = serve(); errors = []; ok = True
def settle(pg): pg.wait_for_load_state("load"); ready(pg); pg.wait_for_timeout(1800)
def where(pg):
    return pg.evaluate(f"""() => ({{ path: location.pathname, y: Math.round(scrollY), vh: innerHeight,
      sims: (() => {{ const s = document.getElementById('simulations'); return s ? Math.round(s.getBoundingClientRect().top) : null; }})(),
      card: (() => {{ const c = document.getElementById('{a.card}'); return c ? Math.round(c.getBoundingClientRect().top) : null; }})() }})""")
def expect(cond, what, r):
    global ok
    print(("  ok   " if cond else "  FAIL ") + what, r); ok = ok and cond
with sync_playwright() as p:
    b = p.chromium.launch(args=["--no-sandbox"]); ctx = new_context(b, a.phone); pg = ctx.new_page(); watch(pg, errors)
    pg.goto(base + "index.html?intro=0"); settle(pg)
    pg.evaluate("document.getElementById('simulations').scrollIntoView()"); pg.wait_for_timeout(1000)
    pg.click("#simulations a.btn"); settle(pg); r = where(pg); expect(r["y"] == 0, "Simulations page opens at the top", r)
    card = pg.locator(f"#{a.card}")
    if card.evaluate("e => e.tagName") != "A": expect(False, f"#{a.card} is a link (turn its 'coming soon' card into a link)", {}); sys.exit(1)
    pg.evaluate(f"document.getElementById('{a.card}').scrollIntoView({{block: 'center'}})"); pg.wait_for_timeout(700)
    before = where(pg)
    card.click(); settle(pg); r = where(pg); expect(r["y"] == 0 and "population-dynamics" in r["path"], "the model page opens at its top", r)
    pg.evaluate("window.scrollTo(0, 1800)"); pg.wait_for_timeout(500)
    pg.click("a.back"); settle(pg); r = where(pg); expect(r["card"] is not None and abs(r["card"] - before["card"]) < 4, "← Simulations returns to the card", r)
    pg.click("a.back"); settle(pg); r = where(pg); expect(r["sims"] is not None and abs(r["sims"]) < 6, "← WildQuant returns to the home page's Simulations section", r)
    model = before and pg  # (same context: the bottom button is checked from a fresh visit to the model page)
    pg.goto(base + "simulations/index.html"); settle(pg)
    href = pg.locator(f"#{a.card}").get_attribute("href")
    pg.goto(base + "simulations/" + href); settle(pg)
    pg.evaluate("window.scrollTo(0, document.body.scrollHeight)"); pg.wait_for_timeout(500)
    pg.click(".sim-more a[data-collapse]"); settle(pg); r = where(pg)
    expect(r["card"] is not None and 0 <= r["card"] < r["vh"], "the bottom 'Back to the simulations' button shows the card", r)
    b.close()
print("errors:", errors or "none")
sys.exit(0 if ok and not errors else 1)
