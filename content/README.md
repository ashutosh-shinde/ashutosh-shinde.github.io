# Writing for the site — Blogs and Elementary Mathematics

You write a post anywhere you like and drop the file in a folder. It gets its own
chalkboard page, and its box on the list (title, date, category, abstract), by itself.

```
Google Drive   WildQuant website/Blog · …/Elementary Mathematics   (private, only you)
   │  the Drive sync (tools/drive-sync/drive-to-github.gs): every 10 minutes,
   │  or at once with your "Publish now" link
   ▼
this folder    content/blog/ · content/maths/        (or upload here on github.com)
   │  GitHub Actions: .github/workflows/publish.yml runs tools/publish/build.py
   ▼
the site       blogs/<name>/ and its box on Blogs · elementary-mathematics/<name>/ and its box
```

From Drive a post is on the site within about 15 minutes (2–3 with the Publish now
link); uploaded on GitHub, within about 2.

## 1. Start every post with four lines

```
title: Three days on Kedarkantha
date: 2026-10-20
category: Trekking
abstract: Knee-deep snow, a 3 a.m. summit push, and why I now carry two pairs of gloves.
```

- **title** — the heading of the page and of its box.
- **date** — `2026-10-20` is safest; `20/10/2026` (day first) and `20 October 2026` work too.
  Blogs are listed newest first; maths chapters are numbered by date, oldest first.
- **category** — any words you like (Trekking, Climbing, Field notes, Set theory …). It is
  shown on the box and above the title. There is no fixed list.
- **abstract** — one paragraph, shown in the box and at the top of the post. It can have
  maths (`$\sqrt 2$`).

In a Google Doc they are simply the first four lines. In Markdown or R Markdown you can
also write them as the usual YAML header between `---` lines (RStudio's header works as
it is: `title`, `date`, `abstract` are read, add `category`). In a LaTeX file the build
reads `\title{…}`, `\date{…}` and the `abstract` environment, and a comment line
`% category: Analysis`.

Optional lines:

| Line | What it does |
|---|---|
| `draft: yes` | the page is made but not listed (and asks search engines to skip it) |
| `slug: kedarkantha` | fixes the web address (otherwise it comes from the file name, see 6) |
| `chapter: 3` | maths only: fixes this chapter's number (the next ones count on from it) |

## 2. Photos (blogs)

- **Google Doc:** insert the photos where they go. Write the caption **in italics** on the
  line just below a photo: it becomes the caption under the picture.
- **Markdown:** `![Sunrise from the summit](sunrise.jpg)` and put `sunrise.jpg` next to the
  file. Keep a post and its photos together in their own subfolder
  (`Blog/Kedarkantha/index.md` + photos; the folder's name is then the post's name).
- Photos are resized for the web (at most 1600 px wide) and their camera and **GPS
  location data are removed**. JPEG, PNG, GIF, WebP and iPhone HEIC all work. Very large
  photos make a Google Doc slow: phone photos at their normal size are fine.

## 3. Maths (elementary mathematics, or anywhere)

Write LaTeX, in any of the formats below, including a Google Doc (type it as plain text):

- inline: `$f : \mathbb{N} \to \mathbb{R}$`
- on its own line: `$$\sum_{n=1}^{\infty} \frac{1}{n^2} = \frac{\pi^2}{6}$$`
- numbered: `\begin{equation} … \label{eq:basel} \end{equation}`, then `see \eqref{eq:basel}`;
  `align`, `cases`, `\tag{*}`, `\newcommand` all work.
- theorem and proof boxes, in Markdown:

  ```
  ::: theorem
  **Cantor's theorem.** *For any set $X$, $|X| < |\mathcal{P}(X)|$.*
  :::

  ::: proof
  *Proof.* … 
  :::
  ```

  (in LaTeX: the usual `theorem` and `proof` environments). A proof ends with ∎ by itself.

The maths is typeset when the site is built (MathJax), in the chalk colour and the
Computer Modern look of LaTeX, so pages open with their formulas already drawn.
In a Google Doc, typing `$20` for money is fine: it only becomes maths when it looks
like maths. Equations made with the Docs equation tool (Insert → Equation) work too.

## 4. Which format?

| You write | Put in the folder | Good to know |
|---|---|---|
| **Google Doc** | the Doc itself | headings, bold/italic, lists, quotes, links, tables, photos, LaTeX typed as text |
| **Markdown** `.md`, **R Markdown** `.Rmd`, **Quarto** `.qmd` | the file (+ its photos) | the R code is **not** run: to show R output, knit it and upload the `.html` |
| **knitted HTML** (RStudio *Knit*, Quarto *Render*) | the `.html` | title, date and abstract come from its header; plots come along; RStudio's styling is replaced by the chalkboard; interactive widgets (plotly, leaflet) don't carry over |
| **LaTeX** `.tex` | the file (+ figures as PNG/JPG/PDF in the same folder) | standard LaTeX converts: sections, maths, theorems, macros, figures. TikZ and unusual packages don't: export those as images |
| **Word** `.docx`, **LibreOffice** `.odt` | the file | like a Google Doc |

Google Sheets and Slides can't become pages (the sync skips them and says so).

## 5. Where things go

| | Google Drive | GitHub (this folder) |
|---|---|---|
| a blog post | `WildQuant website/Blog` | `content/blog/` |
| a maths chapter | `WildQuant website/Elementary Mathematics` | `content/maths/` |
| not ready yet | `WildQuant website/Drafts` (never published) | — (this repository is public: keep drafts in Drive) |

Subfolders are fine (a post with its photos). A file you are still editing in Drive
waits until you have left it alone for 3 minutes, so a half-written sentence isn't
published (the Publish now link doesn't wait).

## 6. Changing, renaming, removing

- **Change** a post: edit the Doc or the file. The page follows.
- **Remove** it: move it to `Drafts` or delete it (in Drive), or delete the file on
  GitHub. Its page and its box go too.
- **The web address** comes from the file name: *A winter night on Kalsubai* →
  `/blogs/a-winter-night-on-kalsubai/`. Renaming the file changes the address; add a
  `slug:` line to keep it fixed.
- Files that came from Drive are listed in `content/.drive-sync.json` and are kept in
  step with Drive: change those in Drive, not on GitHub. Files you upload on GitHub are
  never touched by the Drive sync.

## 7. If something goes wrong

- **A post that can't be converted** (or a missing photo, or a formula MathJax can't
  read) never stops the others: everything else is published, then the GitHub run
  turns red and GitHub emails you. Open the repository's **Actions** tab → the latest
  *Publish the site* → *build*: the summary says what to fix. A post that had a page
  keeps its last good page until it is fixed.
- **The Drive sync** emails you if it fails (at most once a day for the same problem),
  for example when the GitHub token has expired: make a new token and put it in the
  script's Script Properties (steps at the top of `tools/drive-sync/drive-to-github.gs`).

## 8. One-time setup

1. **GitHub Pages:** repository → Settings → Pages → Build and deployment → Source:
   **GitHub Actions**.
2. **Drive sync:** the steps at the top of `tools/drive-sync/drive-to-github.gs`
   (a GitHub token, paste the script at script.google.com, run `setup` once; about
   10 minutes). `setup` makes the folders in your Drive if they aren't there.
