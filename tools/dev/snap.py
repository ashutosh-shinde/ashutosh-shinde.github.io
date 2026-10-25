#!/usr/bin/env python3
"""snap.py — a screenshot of one page (full page by default), plus console errors and sideways overflow.

  python3 tools/dev/snap.py PAGE NAME [--phone] [--reduced] [--w 1440 --h 900] [--js "JS"] [--clip CSS] [--query "?check=1"]
  → $WQ_SHOTS/NAME.png (default /tmp/wq-shots), and NAME_0.png, NAME_1.png … (1200 px tall parts, easy to view)
"""
import argparse, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from common import SHOTS, new_context, ready, serve, watch
from playwright.sync_api import sync_playwright

ap = argparse.ArgumentParser()
ap.add_argument("page"); ap.add_argument("name")
ap.add_argument("--phone", action="store_true"); ap.add_argument("--reduced", action="store_true")
ap.add_argument("--w", type=int); ap.add_argument("--h", type=int)
ap.add_argument("--js", default=""); ap.add_argument("--clip", default=""); ap.add_argument("--query", default="")
a = ap.parse_args()
os.makedirs(SHOTS, exist_ok=True)
base = serve(); errors = []
with sync_playwright() as p:
    b = p.chromium.launch(args=["--no-sandbox"])
    ctx = new_context(b, a.phone, a.reduced, a.w, a.h); pg = ctx.new_page(); watch(pg, errors)
    pg.goto(base + a.page + a.query); ready(pg); pg.wait_for_timeout(500)
    if a.js:
        r = pg.evaluate(a.js); pg.wait_for_timeout(400)
        if r is not None: print("js:", r)
    over = pg.evaluate("document.documentElement.scrollWidth - innerWidth")
    path = os.path.join(SHOTS, a.name + ".png")
    if a.clip: pg.locator(a.clip).screenshot(path=path)
    else: pg.screenshot(path=path, full_page=True)
    b.close()
try:  # cut a tall screenshot into parts that are easy to look at (phones: shown at half size)
    from PIL import Image
    im = Image.open(path)
    if a.phone: im = im.resize((im.width // 2, im.height // 2))
    n = (im.height + 1199) // 1200
    for i in range(n): im.crop((0, i * 1200, im.width, min(im.height, (i + 1) * 1200))).save(os.path.join(SHOTS, f"{a.name}_{i}.png"))
    print(f"{path} ({im.width}x{im.height}) → {n} part(s): {a.name}_0.png …")
except Exception as e:
    print(path, "(no parts:", e, ")")
print("sideways overflow:", over, "px" if over else "(none)")
print("errors:", errors or "none")
sys.exit(1 if errors or over > 0 else 0)
