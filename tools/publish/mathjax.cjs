/* =============================================================================
   mathjax.cjs — typesets the maths for tools/publish/build.py (not part of the site)
   -----------------------------------------------------------------------------
     node tools/publish/mathjax.cjs NODE_MODULES_DIR  < {"docs":[{"items":[[tex, display], ...]}, ...]}
     → {"docs":[{"html":[svg, ...], "errors":["...", ...]}, ...]}
   Each formula becomes an SVG drawn in currentColor (so it takes the page's
   chalk colour), with hidden MathML for screen readers. Equation numbers
   (\tag, align, equation, \label / \eqref) start again on every page.
   Needs MathJax 3.2.2: npm install --prefix tools/publish mathjax@3.2.2
   ============================================================================= */
"use strict";
const path = require("path");
const dir = process.argv[2] || path.join(__dirname, "node_modules");
const MJ = require(path.join(dir, "mathjax"));

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (c) => (input += c));
process.stdin.on("end", () => {
  const job = JSON.parse(input);
  MJ.init({
    loader: { load: ["input/tex-full", "output/svg", "a11y/assistive-mml"] },
    tex: { tags: "ams", tagSide: "right", useLabelIds: true },
    svg: { fontCache: "local" },
    options: { enableAssistiveMml: true },
  }).then((MathJax) => {
    const A = MathJax.startup.adaptor, out = { docs: [] };
    for (const doc of job.docs) {
      MathJax.texReset();
      const html = [], errors = [];
      for (const [tex, display] of doc.items) {
        try {
          const node = MathJax.tex2svg(tex, { display });
          let s = A.outerHTML(node);
          const err = s.match(/data-mjx-error="([^"]*)"/);
          if (err) errors.push(`${err[1]} in: ${tex.slice(0, 80)}`);
          else if (/fill="red"|stroke="red"/.test(s)) errors.push(`unknown command in: ${tex.slice(0, 80)}`);
          html.push(s);
        } catch (e) {
          errors.push(`${e.message} in: ${tex.slice(0, 80)}`);
          html.push(`<code class="tex">${tex.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</code>`);
        }
      }
      out.docs.push({ html, errors });
    }
    process.stdout.write(JSON.stringify(out));
  }).catch((e) => { console.error(e && e.stack || e); process.exit(1); });
});
