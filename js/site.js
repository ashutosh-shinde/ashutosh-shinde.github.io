/* =============================================================================
   site.js — starts everything on a page
   -----------------------------------------------------------------------------
   • gives the WildQuant title its chalk texture and writes it in step with
     the intro (the Home scene says when, through "wq:" events)
   • small page details: footer year, "scrolled" flag for the scroll hint
   • starts the board engine right after the first paint: <body class="home">
     → all section scenes; other pages → <body data-scene="name"> (or none)
   ============================================================================= */
(function (G) {
  "use strict";
  const WQ = G.WQ, root = document.documentElement, body = document.body;

  /* chalk texture for HTML text: grainy white, painted once into a data URL */
  function chalkTexture() {
    try {
      let url = null; // made once per visit, then kept for the other pages
      try { url = G.sessionStorage.getItem("wq-chalk"); } catch (e) { /* storage blocked */ }
      if (!url) url = makeChalk();
      root.style.setProperty("--chalk", `url(${url})`);
      root.classList.add("has-chalk");
    } catch (e) { /* plain text is fine */ }
  }
  function makeChalk() {
    const n = 240, c = document.createElement("canvas"); c.width = c.height = n;
    const g = c.getContext("2d"), d = g.createImageData(n, n), r = WQ.L.mulberry32(77);
    for (let i = 0; i < n * n; i++) {
      const v = r(), a = v < 0.07 ? 70 : v < 0.2 ? 165 : 215 + 40 * r();
      d.data[4 * i] = 248; d.data[4 * i + 1] = 246; d.data[4 * i + 2] = 238; d.data[4 * i + 3] = a;
    }
    g.putImageData(d, 0, 0);
    // a few dry streaks
    g.globalCompositeOperation = "destination-out"; g.strokeStyle = "rgba(0,0,0,0.5)";
    for (let k = 0; k < 26; k++) { g.lineWidth = 0.6 + r() * 1.4; g.beginPath(); const x = r() * n, y = r() * n; g.moveTo(x, y); g.lineTo(x + 8 + r() * 26, y + (r() - 0.5) * 8); g.stroke(); }
    const url = c.toDataURL("image/png");
    try { G.sessionStorage.setItem("wq-chalk", url); } catch (e) { /* storage full or blocked */ }
    return url;
  }

  /* the title is written by the Home scene's clock (deterministic, synced with the leap) */
  function heroEvents() {
    const hero = document.querySelector(".hero__title"), block = document.querySelector(".hero");
    if (!hero) return;
    let shown = -1;
    // while the intro plays the hero is still empty, so it must not calm the drawings yet
    const calm = (v) => { if (block) block.dataset.calm = (WQ.E.CFG.calm * v).toFixed(3); };
    document.addEventListener("wq:reveal", (e) => {
      const v = Math.max(0, Math.min(1, e.detail));
      if (Math.abs(v - shown) < 0.002 && !(v >= 1 && shown < 1)) return;
      shown = v;
      root.style.setProperty("--reveal", v.toFixed(4));
      calm(v);
      body.classList.toggle("writing", v > 0 && v < 1);
      if (v >= 1) body.classList.add("title-done");
    });
    document.addEventListener("wq:about", () => body.classList.add("title-done", "about-on"));
    document.addEventListener("wq:still", () => { root.style.setProperty("--reveal", "1"); calm(1); body.classList.add("title-done", "about-on"); });
  }

  function details() {
    for (const el of document.querySelectorAll("[data-year]")) el.textContent = new Date().getFullYear();
    const onScroll = () => body.classList.toggle("scrolled", G.scrollY > 40);
    G.addEventListener("scroll", onScroll, { passive: true }); onScroll();
  }

  function start() {
    chalkTexture();
    details();
    const home = body.classList.contains("home");
    heroEvents();
    // the board starts once the page's first frame is on screen, so a page (and the flash of a page
    // change) shows at once; its drawings fade in a moment later (css: .wq-ready #board-fx)
    let started = false;
    const board = () => {
      if (started) return;
      started = true;
      try {
        WQ.E.start(home ? { mode: "home" } : { mode: "page", scene: body.dataset.scene || null, sceneOpts: { final: true } });
      } catch (e) { // never leave the page without its title
        console.error(e);
        root.classList.remove("intro"); root.style.setProperty("--reveal", "1"); body.classList.add("title-done", "about-on");
      }
    };
    G.requestAnimationFrame(() => G.requestAnimationFrame(() => setTimeout(board, 0))); // after the first frame
    setTimeout(board, 500); // a tab in the background paints nothing: start anyway
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})(window);
