#!/usr/bin/env python3
"""build_preview.py — turn the repo into the folder that is published as the private claude.ai preview.

  python3 tools/dev/build_preview.py OUT_DIR

The preview host wraps the home page in its own <html>/<head>/<body>, so the home page is written without
them (its own head script is kept, plus the body class); fonts are inlined into the CSS; and because the
preview serves no folder pages, every link to a folder ("../", "../../#pd-1", "simulations/") names its
index.html. Every folder with an index.html is included automatically.
"""
import base64, os, re, shutil, sys
sys.path.insert(0, os.path.dirname(__file__))
from common import REPO, pages

OUT = sys.argv[1] if len(sys.argv) > 1 else sys.exit("usage: build_preview.py OUT_DIR")
shutil.rmtree(OUT, ignore_errors=True); os.makedirs(OUT)

def folder_links(html):
    def fix(m):
        href = m.group(1)
        if re.match(r"^(?:[a-z]+:|#|/)", href) or href.endswith((".css", ".woff", ".js", ".png", ".jpg", ".svg", ".pdf")): return m.group(0)
        path, _, hash_ = href.partition("#")
        if path == "" or path.endswith("/"): path += "index.html"
        return 'href="' + path + ("#" + hash_ if hash_ else "") + '"'
    return re.sub(r'href="([^"]*)"', fix, html)

# ---- home page: its head script + scripts + body content only
src = open(os.path.join(REPO, "index.html"), encoding="utf-8").read()
scripts = "\n".join(re.findall(r'^\s*<script defer src="[^"]+"></script>', src, re.M))
inline = re.search(r"\n(\s*<script>\n.*?</script>)", src, re.S).group(1)
assert 'e.classList.add("js");' in inline, "the home page's head script changed: update build_preview.py"
inline = inline.replace('e.classList.add("js");', 'e.classList.add("js"); document.body.classList.add("home");', 1)
body = src[src.index("<!-- the blackboard"):src.index("</body>")].rstrip() + "\n"
head = '<title>WildQuant</title>\n<link rel="stylesheet" href="css/site.css">\n' + inline + "\n"
open(os.path.join(OUT, "index.html"), "w", encoding="utf-8").write(head + scripts + "\n" + folder_links(body))

# ---- CSS with the fonts inlined
css = open(os.path.join(REPO, "css/site.css"), encoding="utf-8").read()
def inline_font(m):
    path = os.path.normpath(os.path.join(REPO, "css", m.group(1)))
    return 'url("data:font/woff;base64,' + base64.b64encode(open(path, "rb").read()).decode() + '")'
css = re.sub(r'url\("(\.\./fonts/[^"]+\.woff)"\)', inline_font, css)
os.makedirs(os.path.join(OUT, "css")); open(os.path.join(OUT, "css/site.css"), "w", encoding="utf-8").write(css)

# ---- scripts
for root, _, files in os.walk(os.path.join(REPO, "js")):
    for f in files:
        if f.endswith(".js"):
            rel = os.path.relpath(os.path.join(root, f), REPO)
            os.makedirs(os.path.dirname(os.path.join(OUT, rel)), exist_ok=True)
            shutil.copy(os.path.join(REPO, rel), os.path.join(OUT, rel))

# ---- every other page (no font preload: the fonts live inside the CSS)
for path in pages(REPO):
    if path == "index.html": continue
    s = open(os.path.join(REPO, path), encoding="utf-8").read()
    s = re.sub(r'\n\s*<link rel="preload" href="(?:\.\./)+fonts/[^"]+"[^>]*>', "", s)
    os.makedirs(os.path.dirname(os.path.join(OUT, path)) or OUT, exist_ok=True)
    open(os.path.join(OUT, path), "w", encoding="utf-8").write(folder_links(s))

files = sorted(os.path.relpath(os.path.join(r, f), OUT) for r, _, fs in os.walk(OUT) for f in fs)
print(OUT); print("\n".join(f for f in files if not f.startswith("js/")))
