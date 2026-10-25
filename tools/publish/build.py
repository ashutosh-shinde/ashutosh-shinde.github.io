#!/usr/bin/env python3
"""
build.py — turns the files in content/ into pages of the site.

  python3 tools/publish/build.py           build everything (from any folder)
  python3 tools/publish/build.py --check   only report what would happen (writes nothing)

  content/blog/<file>    →  blogs/<name>/index.html                  + its box on blogs/index.html
  content/maths/<file>   →  elementary-mathematics/<name>/index.html + its box on elementary-mathematics/index.html

A file can be Markdown (.md), R Markdown (.Rmd / .qmd: the R code is not run), Word (.docx, which is how
the Drive sync sends a Google Doc), LibreOffice (.odt), LaTeX (.tex) or a knitted .html. It starts with a
few header lines (see content/README.md):

  title: Three days on Kedarkantha
  date: 2026-10-20
  category: Trekking
  abstract: Knee-deep snow, a 3 a.m. summit push, and why I now carry two pairs of gloves.

<name> is the file name, made web-safe ("Three days.docx" → three-days), or the folder's name for a file
called index.* inside its own folder (a post and its photos can share a folder). Photos are resized for the
web (at most 1600 px wide) and lose their EXIF data (camera, GPS position). Maths ($…$, $$…$$, \\(…\\),
\\[…\\], align, …) is typeset here with MathJax 3 into SVG, so pages need no maths script and draw it in chalk.

The build is safe to run again and again: a page is rewritten only when it changes, pages whose file was
removed are deleted (only pages this script made: they carry <meta name="generator" content="wq-publish">),
and a file that fails to convert keeps its last good page. Problems are printed as warnings (and, in GitHub
Actions, listed on the run's summary page).

Needs pandoc (3.9 in GitHub Actions), node with MathJax 3.2.2 in tools/publish/node_modules/mathjax
(npm install --prefix tools/publish mathjax@3.2.2), Pillow; optional: pillow-heif (iPhone HEIC photos),
pdftocairo (PDF figures in LaTeX files).
HOW TO EDIT: SECTIONS (folders, pages, texts), MAX_PHOTO (photo size), the templates in templates/.
"""
import argparse, base64, copy, datetime as dt, hashlib, html, io, json, os, re, shutil, subprocess, sys, tempfile, unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
SITE_URL = "https://ashutosh-shinde.github.io"
GENERATOR = '<meta name="generator" content="wq-publish">'
MAX_PHOTO = 1600          # px: widest photo on the site
JPEG_QUALITY = 82
PANDOC = os.environ.get("PANDOC", "pandoc")
NODE = os.environ.get("NODE", "node")
MATHJAX_DIR = os.environ.get("MATHJAX_DIR", os.path.join(HERE, "node_modules"))

SECTIONS = [
    dict(key="blog", src="content/blog", out="blogs", template="post.html", numbered=False, newest_first=True,
         list_label="Read", back="Blogs", section_title="Blogs with an Irrational Logic", empty="No stories yet."),
    dict(key="maths", src="content/maths", out="elementary-mathematics", template="chapter.html", numbered=True,
         newest_first=False, list_label="Read the chapter", back="Elementary Mathematics",
         section_title="Elementary Mathematics", empty="No chapters yet."),
]
FORMATS = {".md": "markdown", ".markdown": "markdown", ".txt": "markdown", ".rmd": "rmd", ".qmd": "rmd",
           ".docx": "docx", ".odt": "odt", ".tex": "latex", ".html": "html", ".htm": "html"}
IMAGE_EXT = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".heic", ".heif", ".tif", ".tiff", ".bmp", ".pdf"}
KEYS = {"title": "title", "date": "date", "category": "category", "categories": "category", "tag": "category",
        "tags": "category", "abstract": "abstract", "summary": "abstract", "description": "abstract",
        "excerpt": "abstract", "slug": "slug", "draft": "draft", "chapter": "chapter", "cover": "cover", "image": "cover"}
HEADER_LINE = re.compile(r"^\s*(" + "|".join(KEYS) + r")\s*[:：]", re.I)
MATH_ENVS = r"(?:equation|align|alignat|gather|multline|flalign|eqnarray|displaymath|math|split|gathered|aligned|cases)\*?"
THEOREMS = ("theorem", "lemma", "proposition", "corollary", "definition", "example", "remark", "note", "exercise", "proof", "conjecture", "claim")

warnings, problems = [], []
def warn(where, msg, serious=False):
    """serious: something is missing from the site (a page, a photo, a formula). In GitHub Actions the run then
    ends red after publishing everything else, and GitHub emails you; the other warnings are notes."""
    (problems if serious else warnings).append(f"{where}: {msg}")
    print(f"  {'!!' if serious else '!'} {where}: {msg}", flush=True)


# ------------------------------------------------------------------ small helpers
def slugify(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()
    return s or "post"

def esc(s):
    return html.escape(s or "", quote=True)

def write_if_changed(path, data, check):
    data_b = data.encode("utf-8") if isinstance(data, str) else data
    if os.path.exists(path):
        with open(path, "rb") as f:
            if f.read() == data_b:
                return False
    if not check:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as f:
            f.write(data_b)
    return True

def run(cmd, data=None, cwd=None):
    r = subprocess.run(cmd, input=data, capture_output=True, cwd=cwd)
    if r.returncode != 0:
        raise RuntimeError((r.stderr or b"").decode("utf-8", "replace").strip() or f"{cmd[0]} failed")
    return r.stdout


# ------------------------------------------------------------------ dates
MONTHS = "January February March April May June July August September October November December".split()
def parse_date(text):
    t = (text or "").strip()
    if not t or "`r" in t:
        return None
    m = re.match(r"^(\d{4})-(\d{1,2})-(\d{1,2})", t)
    if m:
        try: return dt.date(int(m[1]), int(m[2]), int(m[3]))
        except ValueError: return None
    m = re.match(r"^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$", t)      # 20/10/2026 (day first, as in India)
    if m:
        try: return dt.date(int(m[3]), int(m[2]), int(m[1]))
        except ValueError: return None
    try:
        from dateutil import parser as dparser
        return dparser.parse(t, dayfirst=True, fuzzy=True, default=dt.datetime(2000, 1, 1)).date()
    except Exception:
        return None

def show_date(d):
    return f"{MONTHS[d.month - 1]} {d.day}, {d.year}"


# ------------------------------------------------------------------ pandoc AST helpers
def S(text): return {"t": "Str", "c": text}
SPACE = {"t": "Space"}

def stringify(x):
    if isinstance(x, list):
        return "".join(stringify(i) for i in x)
    if not isinstance(x, dict):
        return ""
    t, c = x.get("t"), x.get("c")
    if t == "Str": return c
    if t in ("Space", "SoftBreak", "LineBreak"): return " "
    if t == "Code": return c[1]
    if t == "Math": return c[1]
    if t == "Quoted": return ("“" if c[0]["t"] == "DoubleQuote" else "‘") + stringify(c[1]) + ("”" if c[0]["t"] == "DoubleQuote" else "’")
    if t in ("Emph", "Strong", "Underline", "Strikeout", "Superscript", "Subscript", "SmallCaps", "Plain", "Para"): return stringify(c)
    if t in ("Span", "Link", "Image", "Cite"): return stringify(c[1] if t != "Cite" else c[1])
    if t in ("RawInline", "Note"): return ""
    return ""

def split_lines(inlines):
    lines, cur = [], []
    for el in inlines:
        if el.get("t") in ("SoftBreak", "LineBreak"):
            lines.append(cur); cur = []
        else:
            cur.append(el)
    lines.append(cur)
    return lines

def strip_key(inlines):
    """the inlines after the first colon (drops 'title:' and a bold 'Title:' alike)"""
    out = copy.deepcopy(inlines)
    for i, el in enumerate(out):
        txt = stringify(el)
        k = min([p for p in (txt.find(":"), txt.find("：")) if p >= 0], default=-1)
        if k < 0:
            continue
        rest = out[i + 1:]
        if el.get("t") == "Str" and k + 1 < len(el["c"]):
            rest = [S(el["c"][k + 1:])] + rest
        while rest and rest[0].get("t") in ("Space", "SoftBreak"):
            rest = rest[1:]
        return rest
    return out

def take_header_lines(blocks, where):
    """leading 'key: value' lines (one per paragraph or line); returns (meta, rest of blocks)"""
    meta, i = {}, 0
    while i < len(blocks):
        b = blocks[i]
        if b["t"] == "HorizontalRule":
            if meta: i += 1
            break
        if b["t"] not in ("Para", "Plain"):
            break
        parsed, stop = [], False
        for ln in split_lines(b["c"]):
            txt = stringify(ln).strip()
            if not txt:
                continue
            if re.fullmatch(r"[-—–_*=]{3,}", txt):
                stop = True; continue
            m = HEADER_LINE.match(txt)
            if not m:
                parsed = None; break
            parsed.append((KEYS[m.group(1).lower()], strip_key(ln)))
        if not parsed:
            break
        for k, v in parsed:
            meta.setdefault(k, v)
        i += 1
        if stop:
            break
    return meta, (blocks[i:] if meta else blocks)

def walk(x, fn):
    """apply fn to every element (children first); fn returns None (keep), an element, or a list (splice)"""
    if isinstance(x, list):
        out = []
        for el in x:
            r = walk(el, fn)
            if isinstance(r, list) and isinstance(el, dict):
                out.extend(r)
            else:
                out.append(r)
        return out
    if isinstance(x, dict):
        if "c" in x:
            x["c"] = walk(x["c"], fn)
        if "t" in x:
            r = fn(x)
            return x if r is None else r
        return x
    return x


# ------------------------------------------------------------------ reading a source file
def lenient_front_matter(text):
    """--- YAML-ish header --- at the top: read the keys we know, forgivingly (colons, backslashes and quotes
    in values are fine). Returns (header dict of raw strings, text without it)."""
    m = re.match(r"\A\ufeff?---[ \t]*\r?\n(.*?)\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|\Z)", text, re.S)
    if not m:
        return {}, text
    out, lines, i = {}, m.group(1).splitlines(), 0
    while i < len(lines):
        km = re.match(r"^([A-Za-z_][\w-]*)\s*:\s?(.*)$", lines[i])
        i += 1
        if not km:
            continue
        key, val, cont = km.group(1).lower(), km.group(2).strip(), []
        while i < len(lines) and (lines[i][:1] in (" ", "\t") or not lines[i].strip()):
            cont.append(lines[i]); i += 1
        if val in ("|", ">", "|-", ">-", "|+", ">+"):
            val = " ".join(l.strip() for l in cont if l.strip())
        elif not val and cont and all(l.strip().startswith("- ") for l in cont if l.strip()):
            val = " · ".join(l.strip()[2:].strip().strip("'\"") for l in cont if l.strip())
        else:
            val = " ".join([val] + [l.strip() for l in cont if l.strip()]).strip()
            if len(val) >= 2 and val[0] == val[-1] == "'":
                val = val[1:-1].replace("''", "'")
            elif len(val) >= 2 and val[0] == val[-1] == '"':
                val = val[1:-1].replace('\\"', '"').replace("\\\\", "\\")
            elif val.startswith("[") and val.endswith("]"):
                val = " · ".join(x.strip().strip("'\"") for x in val[1:-1].split(",") if x.strip())
        if key in KEYS and KEYS[key] not in out:
            out[KEYS[key]] = val
    return out, text[m.end():]

def strip_chunks(text, where):
    """R Markdown: drop the code chunks (```{r …} … ```) and inline `r …` (nothing is run here)"""
    out, skip, fence, dropped = [], False, "", 0
    for ln in text.splitlines(keepends=True):
        s = ln.strip()
        if not skip:
            m = re.match(r"^(`{3,}|~{3,})\s*\{\s*[A-Za-z][\w.]*([ ,][^}]*)?\}\s*$", s)
            if m:
                skip, fence, dropped = True, m.group(1), dropped + 1
                continue
            out.append(ln)
        elif s.startswith(fence) and s.strip(fence[0]) == "":
            skip = False
    text = "".join(out)
    if re.search(r"`r [^`]+`", text):
        warn(where, "inline R code (`r …`) can't run here: it is left out")
        text = re.sub(r"`r [^`]+`", "", text)
    if dropped:
        print(f"    ({dropped} R code chunk(s) left out: knit the file and upload the .html to show R output)")
    return text

def knitted_html(raw, where):
    """a knitted R Markdown / Quarto page: its header (title, date, abstract) and main content, without
    RStudio's styling and scripts. Returns HTML for pandoc."""
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(raw, "html.parser")
    for t in soup(["script", "style", "noscript", "link", "iframe", "button", "form", "template"]):
        t.decompose()
    head = {}
    kw = soup.find("meta", attrs={"name": re.compile("^(keywords|category)$", re.I)})
    if kw and kw.get("content"):
        head["category"] = kw["content"]
    title = soup.select_one("h1.title") or soup.find("title")
    if title:
        head["title"] = title.decode_contents().strip()
    date = soup.select_one(".date") or soup.find("meta", attrs={"name": "date"})
    if date:
        head["date"] = date.get("content") if date.name == "meta" else date.get_text(" ", strip=True)
    ab = soup.select_one("div.abstract")
    if ab:
        for lab in ab.select("p.abstract, .abstract-title"):
            lab.decompose()
        head["abstract"] = " ".join(p.decode_contents().strip() for p in (ab.find_all("p") or [ab]))
    for sel in ["#header", "header#title-block-header", "#TOC", "nav#TOC", "#quarto-margin-sidebar", ".tocify", "#quarto-header", "footer"]:
        for t in soup.select(sel):
            t.decompose()
    root = soup.select_one("main#quarto-document-content") or soup.select_one("main") or soup.select_one(".main-container") or soup.body or soup
    lines = "".join(f"<p>{k}: {v}</p>\n" for k, v in head.items() if v)
    return lines + root.decode_contents()

def read_source(path, fmt, where, tmp):
    """→ (pandoc JSON document, folder that relative image paths start from, extra header from the source)"""
    extra, base = {}, os.path.dirname(path)
    args = [PANDOC, "-t", "json", "--wrap=none"]
    if fmt in ("markdown", "rmd"):
        text = open(path, encoding="utf-8-sig", errors="replace").read()
        head, text = lenient_front_matter(text)
        if fmt == "rmd":
            text = strip_chunks(text, where)
        # the header goes back in as plain 'key: value' paragraphs, so pandoc parses the maths in them
        lines = "".join(f"{k}: {v.replace(chr(10), ' ')}\n\n" for k, v in head.items() if v)
        data = (lines + "\n" + text).encode("utf-8")
        return json.loads(run(args + ["-f", "markdown+tex_math_single_backslash", "-"], data)), base, extra
    if fmt in ("docx", "odt"):
        # a Google Doc (or Word file): its maths may be LaTeX typed as plain text ($…$, $$…$$, \(…\)) or
        # equations made with the Docs equation tool; both come out as maths by going through HTML once.
        # The document's own metadata (Title / Subtitle styles) comes from a direct read.
        media = os.path.join(tmp, "media")
        meta = json.loads(run(args + ["-f", fmt, path])).get("meta", {})
        mid = run([PANDOC, "-f", fmt, "-t", "html5", "--wrap=none", "--mathjax", "--extract-media", media, path])
        doc = json.loads(run(args + ["-f", "html+tex_math_dollars+tex_math_single_backslash", "-"], mid))
        doc["meta"] = meta
        return doc, tmp, extra
    if fmt == "latex":
        src = open(path, encoding="utf-8", errors="replace").read()
        for k, v in re.findall(r"^\s*%+\s*(" + "|".join(KEYS) + r")\s*:\s*(.+?)\s*$", src, re.M | re.I):
            extra.setdefault(KEYS[k.lower()], v)
        return json.loads(run(args + ["-f", "latex", "--resource-path", base, path])), base, extra
    if fmt == "html":
        raw = open(path, encoding="utf-8", errors="replace").read()
        data = knitted_html(raw, where).encode("utf-8")
        return json.loads(run(args + ["-f", "html+tex_math_single_backslash", "-"], data)), base, extra
    raise RuntimeError("unknown format " + fmt)

def meta_inlines(meta, key):
    v = meta.get(key)
    if not v: return None
    t, c = v.get("t"), v.get("c")
    if t == "MetaInlines": return c
    if t == "MetaString": return [S(c)]
    if t == "MetaBlocks":
        out = []
        for b in c:
            if b["t"] in ("Para", "Plain"):
                if out: out.append(SPACE)
                out.extend(b["c"])
        return out
    if t == "MetaList" and c:
        return meta_inlines({"x": c[0]}, "x")
    if t == "MetaBool": return [S("true" if c else "false")]
    return None


# ------------------------------------------------------------------ images
def image_bytes(src, base, where):
    if src.startswith("data:"):
        m = re.match(r"data:image/([\w.+-]+);base64,(.*)", src, re.S)
        if not m:
            return None, None
        ext = "." + {"jpeg": "jpg", "svg+xml": "svg"}.get(m.group(1).lower(), m.group(1).lower())
        return base64.b64decode(m.group(2)), ext
    p = src.split("?")[0].split("#")[0]
    from urllib.parse import unquote
    p = unquote(p)
    cand = os.path.normpath(os.path.join(base, p))
    tries = [cand] if os.path.splitext(cand)[1] else [cand + e for e in (".png", ".jpg", ".jpeg", ".svg", ".pdf", ".gif")]
    for c in tries:
        if os.path.isfile(c):
            return open(c, "rb").read(), os.path.splitext(c)[1].lower()
    warn(where, f"photo not found: {src} (upload it next to the file)", True)
    return None, None

_svg_n = [0]
def inline_svg(data, alt):
    """an .svg figure goes into the page itself, so the site's styles and fonts reach it: black lines and
    text turn into chalk (currentColor), white fills into the board, and its ids get a unique prefix"""
    s = data.decode("utf-8", "replace")
    s = re.sub(r"<\?xml.*?\?>|<!DOCTYPE.*?>|<!--.*?-->|<metadata\b.*?</metadata>", "", s, flags=re.S | re.I)
    k = s.find("<svg")
    if k < 0:
        return None
    s = s[k:s.rfind("</svg>") + 6]
    end = s.index(">")
    root, rest = s[:end], s[end:]
    if "viewBox" not in root:
        w = re.search(r'\swidth="([\d.]+)', root); h = re.search(r'\sheight="([\d.]+)', root)
        if w and h: root += f' viewBox="0 0 {w.group(1)} {h.group(1)}"'
    root = re.sub(r'\s(width|height)="[^"]*"', "", root)
    if re.search(r'\sclass="', root):
        if "fig__svg" not in root: root = re.sub(r'\sclass="', ' class="fig__svg ', root, count=1)
    else:
        root += ' class="fig__svg"'
    root = re.sub(r'\s(role|aria-label|aria-labelledby)="[^"]*"', "", root) + f' role="img" aria-label="{esc(alt)}"'
    rest = re.sub(r'((?:stroke|fill)\s*[:=]\s*"?)(?:#000000|#000|black)\b', r"\1currentColor", rest, flags=re.I)
    rest = re.sub(r'(fill\s*[:=]\s*"?)(?:#ffffff|#fff|white)\b', r"\1#0d0f0f", rest, flags=re.I)
    _svg_n[0] += 1
    pre = f"f{_svg_n[0]}-"
    for i in set(re.findall(r'\sid="([^"]+)"', rest)):
        rest = rest.replace(f'id="{i}"', f'id="{pre}{i}"').replace(f"#{i})", f"#{pre}{i})").replace(f'href="#{i}"', f'href="#{pre}{i}"')
    return root + rest

def save_image(data, ext, stem, out_dir, used, check, where):
    """resize + clean one picture into out_dir; returns (file name, width, height). Names carry a short hash
    of the source, so an unchanged photo is not processed again and a changed one gets a fresh URL."""
    h = hashlib.sha1(data).hexdigest()[:10]
    stem = slugify(stem)[:40] or "photo"
    if ext == ".svg":
        name = f"{stem}-{h}.svg"
        used.add(name)
        if not check: os.makedirs(out_dir, exist_ok=True); write_if_changed(os.path.join(out_dir, name), data, check)
        return name, None, None
    from PIL import Image, ImageOps
    if ext in (".heic", ".heif"):
        try:
            import pillow_heif; pillow_heif.register_heif_opener()
        except ImportError:
            warn(where, "an iPhone HEIC photo needs pillow-heif to convert: export it as JPEG instead", True)
            return None, None, None
    if ext == ".pdf":
        with tempfile.TemporaryDirectory() as td:
            pdf = os.path.join(td, "f.pdf"); open(pdf, "wb").write(data)
            try:
                run(["pdftocairo", "-png", "-singlefile", "-r", "200", pdf, os.path.join(td, "f")])
                data, ext = open(os.path.join(td, "f.png"), "rb").read(), ".png"
            except Exception:
                warn(where, "a PDF figure could not be converted (pdftocairo missing?): use PNG or JPG", True)
                return None, None, None
    try:
        im = Image.open(io.BytesIO(data))
        animated = getattr(im, "is_animated", False)
    except Exception:
        warn(where, f"a picture could not be read ({stem}{ext})", True)
        return None, None, None
    if animated:                                  # animated GIF: keep as it is
        name = f"{stem}-{h}.gif"; used.add(name)
        write_if_changed(os.path.join(out_dir, name), data, check)
        return name, im.width, im.height
    if ext in (".jpg", ".jpeg") and im.width <= MAX_PHOTO and not im.getexif() and len(data) < 900_000:
        name = f"{stem}-{h}.jpg"; used.add(name)      # already web-sized, no camera data: kept as it is (no second compression)
        write_if_changed(os.path.join(out_dir, name), data, check)
        return name, im.width, im.height
    im = ImageOps.exif_transpose(im)              # phone photos: turn upright before EXIF is dropped
    alpha = im.mode in ("RGBA", "LA", "P") and ext in (".png", ".gif", ".webp")
    out_ext = ".png" if alpha else ".jpg"
    name = f"{stem}-{h}{out_ext}"
    used.add(name)
    w, hgt = im.size
    if w > MAX_PHOTO:
        hgt = round(hgt * MAX_PHOTO / w); w = MAX_PHOTO
    path = os.path.join(out_dir, name)
    if os.path.exists(path) or check:             # same source → same file: nothing to do
        return name, w, hgt
    if (w, hgt) != im.size:
        im = im.resize((w, hgt), Image.LANCZOS)
    buf = io.BytesIO()
    if alpha:
        im.save(buf, "PNG", optimize=True)
    else:
        im.convert("RGB").save(buf, "JPEG", quality=JPEG_QUALITY, optimize=True, progressive=True)
    os.makedirs(out_dir, exist_ok=True)
    open(path, "wb").write(buf.getvalue())
    return name, w, hgt


# ------------------------------------------------------------------ one document → parts
class Doc:
    pass

def captions(blocks):
    """a photo alone in its paragraph, with a line in italics right under it (how a caption is written in a
    Google Doc), becomes a figure with that caption (also inside quotes and theorem boxes)"""
    def lone_image(b):
        if b.get("t") not in ("Para", "Plain"):
            return None
        ins = [i for i in b["c"] if i.get("t") not in ("Space", "SoftBreak", "LineBreak")]
        return ins[0] if len(ins) == 1 and ins[0].get("t") == "Image" else None
    def italic_line(b):
        if b.get("t") != "Para":
            return None
        ins = [i for i in b["c"] if not (i.get("t") in ("Space", "SoftBreak") or (i.get("t") == "Str" and not i["c"].strip()))]
        if len(ins) == 1 and ins[0].get("t") == "Emph" and len(stringify(ins[0]).strip()) <= 300:
            return ins[0]["c"]
        return None
    out, i = [], 0
    while i < len(blocks):
        b = blocks[i]
        if isinstance(b, dict) and b.get("t") in ("BlockQuote", "Div"):
            if b["t"] == "BlockQuote": b["c"] = captions(b["c"])
            else: b["c"][1] = captions(b["c"][1])
        img = lone_image(b) if isinstance(b, dict) else None
        cap = italic_line(blocks[i + 1]) if img and i + 1 < len(blocks) else None
        if img and cap:
            if not stringify(img["c"][1]).strip():
                img["c"][1] = copy.deepcopy(cap)          # a photo without alt text: its caption describes it
            out.append({"t": "Figure", "c": [["", [], []], [None, [{"t": "Plain", "c": cap}]], [{"t": "Plain", "c": [img]}]]})
            i += 2
            continue
        out.append(b)
        i += 1
    return out

def convert(path, sec, check):
    rel = os.path.relpath(path, REPO)
    fmt = FORMATS[os.path.splitext(path)[1].lower()]
    d = Doc(); d.src = rel; d.sec = sec; d.fmt = fmt
    with tempfile.TemporaryDirectory() as tmp:
        doc, base, extra = read_source(path, fmt, rel, tmp)
        blocks = doc.get("blocks", [])
        head, blocks = take_header_lines(blocks, rel)
        pmeta = doc.get("meta", {})
        def val(key):            # header lines > source comments > the format's own metadata
            if key in head and head[key]: return head[key]
            if key in extra: return [S(extra[key])]
            return meta_inlines(pmeta, key)
        title = val("title")
        if not title:                                         # a leading heading is the title
            if blocks and blocks[0]["t"] == "Header":
                title = blocks[0]["c"][2]; blocks = blocks[1:]
            else:
                title = [S(os.path.splitext(os.path.basename(path))[0].replace("-", " ").replace("_", " ").strip().capitalize())]
                warn(rel, "no 'title:' line: using the file name")
        if blocks and blocks[0]["t"] == "Header" and stringify(blocks[0]["c"][2]).strip().lower() == stringify(title).strip().lower():
            blocks = blocks[1:]                               # the title repeated as the first heading
        d.date = parse_date(stringify(val("date") or []))
        if not d.date:
            m = re.match(r"(\d{4}-\d{2}-\d{2})", os.path.basename(path))
            d.date = parse_date(m.group(1)) if m else None
        if not d.date:
            d.date = git_date(path) or dt.date.today()
            warn(rel, f"no 'date:' line I can read: using {d.date.isoformat()}")
        d.category = re.sub(r"\s+", " ", stringify(val("category") or [])).strip()
        abstract = val("abstract")
        if not abstract:
            first = next((b for b in blocks if b["t"] == "Para"), None)
            text = stringify(first["c"]).strip() if first else ""
            abstract = [S(text[:220].rsplit(" ", 1)[0] + " …" if len(text) > 220 else text)]
            warn(rel, "no 'abstract:' line: using the start of the text")
        d.draft = stringify(val("draft") or []).strip().lower() in ("true", "yes", "y", "1", "draft")
        ch = re.sub(r"\D", "", stringify(val("chapter") or []))
        d.chapter_fixed = int(ch) if ch else None
        stem = os.path.splitext(os.path.basename(path))[0]
        if stem.lower() == "index" and os.path.dirname(path) != os.path.join(REPO, sec["src"]):
            stem = os.path.basename(os.path.dirname(path))
        stem = re.sub(r"^\d{4}-\d{2}-\d{2}[-_ ]+", "", stem)
        d.slug = slugify(stringify(val("slug") or []) or stem)
        d.cover_name = stringify(val("cover") or []).strip()
        d.title_text = re.sub(r"\s+", " ", stringify(title)).strip()
        d.abstract_text = re.sub(r"\s+", " ", stringify(abstract)).strip()
        d.words = len(stringify(blocks).split())

        # ---- clean the body
        blocks = captions(blocks)
        mins = [b["c"][0] for b in blocks if b["t"] == "Header"]
        shift = 2 - min(mins) if mins else 0
        out_dir = os.path.join(REPO, sec["out"], d.slug, "img")
        used, images = set(), []
        d.math = []
        # LaTeX cross-references (\eqref, \ref): labels of equations, and the titles of labelled sections
        eq_labels, named = set(), {}
        def scan(el):
            if el["t"] == "Math" or (el["t"] in ("RawBlock", "RawInline") and el["c"][0] in ("tex", "latex")):
                eq_labels.update(re.findall(r"\\label\{([^}]*)\}", el["c"][1]))
            if el["t"] == "Header" and el["c"][1][0]:
                named[el["c"][1][0]] = el["c"][2]
            return None
        walk(copy.deepcopy(blocks), scan)

        def fix(el):
            t = el["t"]
            if t == "Link":                                     # \eqref{eq:x} → (1); \ref{sec:x} → the section's title
                kv = dict(el["c"][0][2]); rt, ref = kv.get("reference-type"), kv.get("reference")
                if rt and ref:
                    if rt == "eqref" or ref in eq_labels:
                        return {"t": "Math", "c": [{"t": "InlineMath"}, ("\\eqref{%s}" if rt == "eqref" else "\\ref{%s}") % ref]}
                    el["c"][1] = copy.deepcopy(named.get(ref) or [S(ref)])
                return None
            if t == "Header":
                el["c"][0] = max(2, min(6, el["c"][0] + shift))
                ins = [i for i in el["c"][2] if i.get("t") != "Space"]
                if len(ins) == 1 and ins[0].get("t") == "Strong":   # a heading made bold by hand (common in Docs)
                    el["c"][2] = ins[0]["c"]
                return None
            if t in ("RawBlock", "RawInline") and el["c"][0] in ("tex", "latex"):
                tex = el["c"][1].strip()
                if re.match(r"\\begin\{" + MATH_ENVS + r"\}", tex):
                    m = {"t": "Math", "c": [{"t": "DisplayMath"}, tex]}
                    return {"t": "Para", "c": [m]} if t == "RawBlock" else m
                if re.match(r"\\(eq)?ref\{[^}]*\}$", tex):
                    return {"t": "Math", "c": [{"t": "InlineMath"}, tex]}
                return [] if t == "RawInline" else {"t": "Null"}
            if t == "RawBlock" and el["c"][0] == "html" and re.search(r"<(script|style|iframe)", el["c"][1], re.I):
                return {"t": "Null"}
            if t == "Div":
                classes = el["c"][0][1]
                if "proof" in classes:                          # proofs end with ∎, like the site's chapters
                    for b in reversed(el["c"][1]):
                        if b["t"] in ("Para", "Plain"):
                            ins = b["c"]
                            if ins and ins[-1].get("t") == "Str" and ins[-1]["c"].strip().endswith(("◻", "□", "∎")):
                                ins[-1]["c"] = re.sub(r"[\s\u00a0]*[◻□∎]$", "", ins[-1]["c"])
                            b["c"] = ins + [{"t": "RawInline", "c": ["html", ' <span class="qed" aria-hidden="true">∎</span>']}]
                            break
                if any(c in THEOREMS for c in classes) and "theorem" not in classes and "proof" not in classes:
                    el["c"][0][1] = classes + ["theorem"]
                return None
            if t == "Image":
                attr, alt, (src, ttl) = el["c"]
                if re.match(r"^(https?:)?//", src):
                    return None
                data, ext = image_bytes(src, base, rel)
                if data is None:
                    return {"t": "Str", "c": ""}
                if ext == ".svg":
                    svg = inline_svg(data, stringify(alt))
                    if svg:
                        return {"t": "RawInline", "c": ["html", svg]}
                stem_i = os.path.splitext(os.path.basename(src.split("?")[0]))[0] if not src.startswith("data:") else "figure"
                if src.startswith("data:") or os.path.abspath(os.path.join(base, src)).startswith(tmp):  # pictures inside a Word file or a knitted page
                    stem_i = f"photo-{len(images) + 1}"
                name, w, h = save_image(data, ext, stem_i, out_dir, used, check, rel)
                if not name:
                    return {"t": "Str", "c": ""}
                images.append((stem_i, name, w, h))
                kv = [[k, v] for k, v in attr[2] if k not in ("width", "height", "style")]
                if w and h:
                    kv += [["width", str(w)], ["height", str(h)]]
                kv += [["loading", "lazy"], ["decoding", "async"]]
                el["c"] = [[attr[0], attr[1], kv], alt, ["img/" + name, ttl]]
                return None
            return None

        def mathify(el):              # maths → placeholders, typeset later in one MathJax run
            if el["t"] == "Math":
                # undo what a word processor's autocorrect does to LaTeX typed as text: curly quotes (f’(x)), no-break spaces
                tex = el["c"][1].strip().translate({0x2019: "'", 0x2018: "`", 0x201C: '"', 0x201D: '"', 0x00A0: " ", 0x2212: "-"})
                d.math.append((tex, el["c"][0]["t"] == "DisplayMath"))
                return {"t": "RawInline", "c": ["html", f'<wqm i="{len(d.math) - 1}"></wqm>']}
            return None

        blocks = walk(blocks, fix)
        blocks = [b for b in blocks if b.get("t") != "Null"]
        split = {"t": "RawBlock", "c": ["html", "<!--wq-split-->"]}
        full = [{"t": "Plain", "c": title}, split, {"t": "Para", "c": abstract}, split] + blocks
        full = walk(full, mathify)
        out = run([PANDOC, "-f", "json", "-t", "html5", "--wrap=none", "--syntax-highlighting=none"],
                  json.dumps({"pandoc-api-version": doc["pandoc-api-version"], "meta": {}, "blocks": full}).encode("utf-8")).decode("utf-8")
        d.title_html, d.abstract_html, d.body_html = (p.strip() for p in out.split("<!--wq-split-->", 2))
        d.abstract_html = re.sub(r"^<p>(.*)</p>$", r"\1", d.abstract_html, flags=re.S)
        d.images, d.used = images, used
        d.cover = None
        if images:
            pick = next((i for i in images if d.cover_name and slugify(d.cover_name.rsplit(".", 1)[0]) in slugify(i[0])), images[0])
            d.cover = pick[1]
    return d

def git_date(path):
    try:
        out = subprocess.run(["git", "log", "-1", "--format=%cs", "--", path], capture_output=True, text=True, cwd=REPO).stdout.strip()
        return parse_date(out)
    except Exception:
        return None


# ------------------------------------------------------------------ maths: one MathJax run for everything
def typeset(docs):
    jobs = [{"items": d.math} for d in docs]
    if not any(j["items"] for j in jobs):
        return
    mj = os.path.join(MATHJAX_DIR, "mathjax")
    try:
        if not os.path.isdir(mj):
            raise RuntimeError(f"MathJax not found in {MATHJAX_DIR} (npm install --prefix tools/publish mathjax@3.2.2)")
        res = json.loads(run([NODE, os.path.join(HERE, "mathjax.cjs"), MATHJAX_DIR], json.dumps({"docs": jobs}).encode("utf-8")))
    except Exception as e:
        warn("maths", f"{e} — maths is shown as LaTeX source", True)
        res = {"docs": [{"html": [f'<code class="tex">{esc(t)}</code>' for t, _ in j["items"]], "errors": []} for j in jobs]}
    for d, r in zip(docs, res["docs"]):
        for e in r.get("errors", []):
            warn(d.src, "maths: " + e, True)
        svg = [f'<span class="math-display">{s}</span>' if disp else s for s, (_, disp) in zip(r["html"], d.math)]
        rep = lambda m: svg[int(m.group(1))]
        d.title_svg = re.sub(r'<wqm i="(\d+)"></wqm>', rep, d.title_html)
        d.abstract_html = re.sub(r'<wqm i="(\d+)"></wqm>', rep, d.abstract_html)
        d.body_html = re.sub(r'<wqm i="(\d+)"></wqm>', rep, d.body_html)
        d.title_html = d.title_svg


# ------------------------------------------------------------------ pages
def head_script(index_html):
    """the small 'arriving from another page' script, taken from the section's own index page, so the
    made pages always carry the same one as the rest of the site"""
    m = re.search(r"\n(\s*<!-- arriving from another page.*?</script>)", index_html, re.S)
    if not m:
        raise RuntimeError("the arriving script was not found in the section's index.html")
    return m.group(1).strip()

def fill(tpl, values):
    return re.sub(r"\{\{(\w+)\}\}", lambda m: values.get(m.group(1), m.group(0)), tpl)

def card(d, sec):
    meta = []
    if sec["numbered"] and d.number:
        meta.append(f"Chapter {d.number}")
    if d.category:
        meta.append(f'<span class="post-card__cat">{esc(d.category)}</span>')
    meta.append(f'<time datetime="{d.date.isoformat()}">{show_date(d.date)}</time>')
    return (f'      <li>\n        <a class="post-card" id="{d.slug}" href="{d.slug}/" data-collapse>\n'
            f'          <span class="post-card__meta">{" · ".join(meta)}</span>\n'
            f'          <span class="post-card__title">{d.title_html}</span>\n'
            f'          <span class="post-card__abstract">{d.abstract_html}</span>\n'
            f'          <span class="post-card__go">{sec["list_label"]} <span aria-hidden="true">→</span></span>\n'
            f'        </a>\n      </li>')

def nav_links(prev_d, next_d, sec):
    parts = []
    for d, cls, arrow in ((prev_d, "prev", "←"), (next_d, "next", "→")):
        if d:
            label = "Previous" if cls == "prev" else "Next"
            if sec["numbered"]: label += " chapter"
            inner = f'<span class="post-nav__label">{arrow if cls == "prev" else ""} {label} {arrow if cls == "next" else ""}</span><span class="post-nav__title">{d.title_html}</span>'
            parts.append(f'<a class="post-nav__{cls}" href="../{d.slug}/" data-collapse>{inner.replace("  ", " ")}</a>')
        else:
            parts.append(f'<span class="post-nav__{cls}"></span>')
    return '<nav class="post-nav" aria-label="More">' + "".join(parts) + "</nav>"

def build_section(sec, check):
    src_dir, out_root = os.path.join(REPO, sec["src"]), os.path.join(REPO, sec["out"])
    index_path = os.path.join(out_root, "index.html")
    index_html = open(index_path, encoding="utf-8").read()
    manifest_path = os.path.join(out_root, "posts.json")
    old = json.load(open(manifest_path, encoding="utf-8")) if os.path.exists(manifest_path) else {"posts": []}
    old_by_src = {p["src"]: p for p in old.get("posts", [])}
    tpl = open(os.path.join(HERE, "templates", sec["template"]), encoding="utf-8").read()
    print(f"\n{sec['src']}/ → {sec['out']}/")

    files = []
    for root, dirs, fs in os.walk(src_dir):
        dirs[:] = sorted(x for x in dirs if not x.startswith((".", "_")))
        for f in sorted(fs):
            if f.startswith((".", "_", "~$")) or f.lower().startswith("readme"):
                continue
            if os.path.splitext(f)[1].lower() in FORMATS:
                files.append(os.path.join(root, f))
    docs, kept = [], []
    for path in files:
        rel = os.path.relpath(path, REPO)
        print(f"  {rel}")
        try:
            docs.append(convert(path, sec, check))
        except Exception as e:
            prev = old_by_src.get(rel)
            warn(rel, f"could not be converted ({str(e).splitlines()[0][:300]})" + (": its last good page stays up" if prev else ""), True)
            if prev:
                kept.append(prev)
    # unique names
    seen = {p["slug"] for p in kept}
    for d in docs:
        base, n = d.slug, 2
        while d.slug in seen:
            d.slug = f"{base}-{n}"; n += 1
        if d.slug != base:
            warn(d.src, f"another file already uses the web address '{base}': this one is '{d.slug}'")
        seen.add(d.slug)
    return dict(sec=sec, docs=docs, kept=kept, old=old, index_html=index_html, index_path=index_path,
                manifest_path=manifest_path, tpl=tpl, out_root=out_root)

def finish_section(st, check):
    sec, docs, kept = st["sec"], st["docs"], st["kept"]
    listed = sorted([d for d in docs if not d.draft], key=lambda d: (d.date, d.title_text))
    if sec["numbered"]:
        n = 0
        for d in listed:
            n = d.chapter_fixed or n + 1
            d.number = n
    for d in docs:
        if not hasattr(d, "number"): d.number = None
    order = list(reversed(listed)) if sec["newest_first"] else listed
    changed = 0
    head = head_script(st["index_html"])
    for d in docs:
        i = order.index(d) if d in order else -1
        prev_d = order[i - 1] if i > 0 else None
        next_d = order[i + 1] if 0 <= i < len(order) - 1 else None
        kicker = [sec["section_title"]] if sec["numbered"] else []
        if sec["numbered"] and d.number: kicker.append(f"Chapter {d.number}")
        if d.category: kicker.append(esc(d.category))
        url = f"{SITE_URL}/{sec['out']}/{d.slug}/"
        og = f'\n  <meta property="og:image" content="{url}img/{d.cover}">' if d.cover else ""
        page = fill(st["tpl"], {
            "TITLE_TEXT": esc(d.title_text), "TITLE_HTML": d.title_html, "DESCRIPTION": esc(d.abstract_text[:300]),
            "ABSTRACT_HTML": d.abstract_html, "BODY_HTML": d.body_html, "SLUG": d.slug, "URL": url, "OG_IMAGE": og,
            "KICKER": " · ".join(kicker) or esc(sec["back"]), "DATE_ISO": d.date.isoformat(), "DATE_TEXT": show_date(d.date),
            "HEAD_SCRIPT": head, "NAV": nav_links(prev_d, next_d, sec), "BACK": esc(sec["back"]), "GENERATOR": GENERATOR,
            "ROBOTS": '\n  <meta name="robots" content="noindex">' if d.draft else "",
            "SOURCE": esc(d.src),
        })
        folder = os.path.join(st["out_root"], d.slug)
        changed += write_if_changed(os.path.join(folder, "index.html"), page, check)
        img = os.path.join(folder, "img")                     # photos no longer used
        if os.path.isdir(img) and not check:
            for f in os.listdir(img):
                if f not in d.used:
                    os.remove(os.path.join(img, f)); changed += 1
            if not os.listdir(img): os.rmdir(img)
    # the list on the index page
    items = [card(d, sec) for d in order]
    for p in kept:                                             # failed this time: keep its old box
        if p.get("card") and not p.get("draft"):
            items.append(p["card"])
    lst = ("    <ol class=\"post-list\">\n" + "\n".join(items) + "\n    </ol>") if items else f'    <p class="post-list__empty">{esc(sec["empty"])}</p>'
    new_index, n = re.subn(r"(<!-- LIST:START[^>]*-->\n).*?(\n\s*<!-- LIST:END -->)", lambda m: m.group(1) + lst + m.group(2), st["index_html"], flags=re.S)
    if n != 1:
        warn(sec["out"] + "/index.html", "the <!-- LIST:START --> … <!-- LIST:END --> markers are missing: the list was not updated", True)
    else:
        changed += write_if_changed(st["index_path"], new_index, check)
    # manifest + pages whose file is gone
    entries = [dict(src=d.src, slug=d.slug, title=d.title_text, date=d.date.isoformat(), category=d.category,
                    abstract=d.abstract_text, url=f"{sec['out']}/{d.slug}/", image=(f"{sec['out']}/{d.slug}/img/{d.cover}" if d.cover else None),
                    chapter=d.number, draft=d.draft, card=card(d, sec)) for d in sorted(docs, key=lambda d: d.date, reverse=True)] + kept
    live = {e["slug"] for e in entries}
    for p in st["old"].get("posts", []):
        if p["slug"] not in live:
            folder = os.path.join(st["out_root"], p["slug"])
            ip = os.path.join(folder, "index.html")
            if os.path.exists(ip) and GENERATOR in open(ip, encoding="utf-8").read():
                print(f"  − removed {sec['out']}/{p['slug']}/ (its file is gone)")
                if not check: shutil.rmtree(folder)
                changed += 1
    man = json.dumps({"note": "made by tools/publish/build.py: do not edit", "posts": entries}, ensure_ascii=False, indent=1) + "\n"
    changed += write_if_changed(st["manifest_path"], man, check)
    print(f"  = {len(listed)} listed, {sum(d.draft for d in docs)} draft(s), {len(kept)} kept from before; {changed} file(s) changed")
    return changed

def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--check", action="store_true", help="report only, write nothing")
    a = ap.parse_args()
    try:
        run([PANDOC, "--version"])
    except Exception:
        sys.exit("pandoc is needed: https://pandoc.org/installing.html")
    states = [build_section(sec, a.check) for sec in SECTIONS]
    typeset([d for st in states for d in st["docs"]])
    total = sum(finish_section(st, a.check) for st in states)
    print(f"\n{total} file(s) {'would change' if a.check else 'changed'}; {len(problems)} problem(s), {len(warnings)} note(s)")
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as f:
            f.write("## Publish\n\n")
            for st in states:
                for d in st["docs"]:
                    f.write(f"- {'(draft) ' if d.draft else ''}**{d.title_text}** — {st['sec']['out']}/{d.slug}/ — {d.date.isoformat()}\n")
            if problems:
                f.write("\n### Problems (fix these: the rest is published)\n\n" + "".join(f"- {w}\n" for w in problems))
            if warnings:
                f.write("\n### Notes\n\n" + "".join(f"- {w}\n" for w in warnings))
    out = os.environ.get("GITHUB_OUTPUT")
    if out:
        with open(out, "a", encoding="utf-8") as f:
            f.write(f"problems={len(problems)}\n")

if __name__ == "__main__":
    main()
