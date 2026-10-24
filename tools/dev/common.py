"""common.py — shared helpers for the checking tools in tools/dev/ (not part of the site).

  serve(root)              a quiet local web server for the site folder; returns its base URL
  open_page(p, url, ...)   a Playwright page at desktop or phone size, with console errors collected
  ready(page)              wait until the board engine and the fonts are ready
  pages(root)              every page of the site (folders with an index.html), as paths
"""
import functools, http.server, os, socketserver, threading

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SHOTS = os.environ.get("WQ_SHOTS", "/tmp/wq-shots")
DESKTOP = {"width": 1440, "height": 900}
PHONE = {"width": 390, "height": 844}


class _Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):  # no request log in the output
        pass


def serve(root=REPO):
    handler = functools.partial(_Quiet, directory=root)
    srv = socketserver.ThreadingTCPServer(("127.0.0.1", 0), handler)
    srv.daemon_threads = True
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return f"http://127.0.0.1:{srv.server_address[1]}/"


def new_context(browser, phone=False, reduced=False, w=None, h=None):
    vp = PHONE if phone else {"width": w or DESKTOP["width"], "height": h or DESKTOP["height"]}
    return browser.new_context(viewport=vp, device_scale_factor=2 if phone else 1, is_mobile=phone, has_touch=phone,
                               reduced_motion="reduce" if reduced else "no-preference")


def watch(page, errors, checks=None):
    """collect page errors and console errors (the comments web app is unreachable in a sandbox: ignored)"""
    def on_console(m):
        t = m.text
        if checks is not None and t.startswith("[check]"):
            checks.append(t)
        if m.type == "error" and "script.google.com" not in t and "ERR_TUNNEL" not in t and "Failed to load resource" not in t:
            errors.append(f"console: {t}")
    page.on("console", on_console)
    page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))


def ready(page, timeout=20000):
    page.wait_for_function("window.WQ && WQ.E && WQ.E.ready", timeout=timeout)
    page.evaluate("document.fonts.ready")
    page.wait_for_timeout(300)


def pages(root=REPO):
    out = ["index.html"]
    for d, dirs, files in os.walk(root):
        dirs[:] = sorted(x for x in dirs if not x.startswith(".") and x not in ("trash", "tools", "fonts", "js", "css"))
        rel = os.path.relpath(d, root)
        if rel != "." and "index.html" in files:
            out.append(os.path.join(rel, "index.html"))
    if os.path.exists(os.path.join(root, "404.html")):
        out.append("404.html")
    return out
