#!/usr/bin/env python3
"""errpass.py — open every page of the site (desktop and phone, motion and reduced motion) and report
console errors and sideways overflow. Exit code 1 if anything is wrong.

  python3 tools/dev/errpass.py [--root DIR]
"""
import argparse, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from common import REPO, new_context, pages, ready, serve, watch
from playwright.sync_api import sync_playwright

ap = argparse.ArgumentParser(); ap.add_argument("--root", default=REPO); a = ap.parse_args()
base = serve(a.root); bad = 0; n = 0
with sync_playwright() as p:
    b = p.chromium.launch(args=["--no-sandbox"])
    for phone in (False, True):
        for reduced in (False, True):
            ctx = new_context(b, phone, reduced)
            for path in pages(a.root):
                pg = ctx.new_page(); errors = []; watch(pg, errors); n += 1
                pg.goto(base + path)
                try: ready(pg, 15000)
                except Exception: errors.append("the board never became ready")
                pg.wait_for_timeout(700)
                over = pg.evaluate("document.documentElement.scrollWidth - innerWidth")
                if errors or over > 0:
                    bad += 1
                    print(f"{'phone' if phone else 'desk':5s} {'reduced' if reduced else 'motion ':7s} {path:66s} {errors[:2]} overflow={over}")
                pg.close()
            ctx.close()
    b.close()
print(f"pages checked: {n}, with problems: {bad}")
sys.exit(1 if bad else 0)
