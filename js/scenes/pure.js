/* =============================================================================
   Pure mathematics — "drifting notes"            (Elementary Mathematics page)
   -----------------------------------------------------------------------------
   Faint definitions, theorems and theorem names from pure mathematics drift
   slowly up the board. They all move together and are laid out with plenty of
   free board around each one, so they never overlap. An item that leaves the
   top comes back at the bottom as another item that fits the same space. The
   page text's calm zones fade them wherever they pass near the text.
   The items are every entry of PURE in tools/make_equations.py
   (js/data/pure.js): add one there and it appears here.
   HOW TO EDIT: SPEED (how fast), GAP (room around each item), DENSITY (how
   many), ALPHA (how faint), SIZE (font size).
   ============================================================================= */
(function (G) {
  "use strict";
  const { L, CH, PTS } = G.WQ;
  const { lerp, clamp, smooth, mulberry32 } = L;
  const SPEED = 6;                    // px/s upward (at the reference size)
  const GAP = { x: 120, y: 74 };      // px of free board kept around every item (reference size)
  const DENSITY = 1 / 82000;          // at most one item per this many px² of board
  const ALPHA = [0.13, 0.22];         // faint
  const SIZE = { eq: 15, word: 15 };  // px font size of formulas and of theorem names (reference size)
  const EDGE = 70;                    // px: items fade in and out over this band at the top and bottom

  (G.WQ.scenes = G.WQ.scenes || {}).pure = function (env0) {
    let env = env0, W = 0, H = 0, k = 1, P = 1, slots = [], t = 0, built = false;

    /* Lay the items out on a loop of height P (taller than the screen) so that
       every pair keeps GAP apart, also across the loop's seam. */
    function layout() {
      const S = Math.min(W / 960, H / 540), data = G.WQ.EQDATA;
      if (!data) return;
      k = clamp(S, env.mobile ? 0.78 : 0.88, 1.35);
      const r = mulberry32(11), maxW = W - 32;
      const pool = Object.keys(data.E).map((id) => {
        const px = (id.startsWith("n_") ? SIZE.word : SIZE.eq) * k, [w, h] = CH.size(id, px);
        return { id, px, w, h };
      }).filter((it) => it.w <= maxW);
      for (let i = pool.length - 1; i > 0; i--) { const j = (r() * (i + 1)) | 0; [pool[i], pool[j]] = [pool[j], pool[i]]; }
      P = H + 2 * EDGE + 160;
      const gx = GAP.x * k, gy = GAP.y * k, max = Math.max(4, Math.round(W * P * DENSITY));
      const clash = (x, y, w, h) => slots.some((s) => {
        if (x - gx >= s.x + s.w || s.x - gx >= x + w) return false; // far enough apart sideways
        for (const o of [0, P, -P]) { const sy = s.y + o; if (!(y - gy >= sy + s.h || sy - gy >= y + h)) return true; }
        return false;
      });
      slots = [];
      for (const it of pool) {
        if (slots.length >= max) break;
        for (let tries = 0; tries < 50; tries++) {
          const x = lerp(16, Math.max(16, W - 16 - it.w), r()), y = r() * P;
          if (!clash(x, y, it.w, it.h)) { slots.push({ x, y, w: it.w, h: it.h, it, a: lerp(ALPHA[0], ALPHA[1], r()), ph: r() * 6.283 }); break; }
        }
      }
      // what may take a slot's place when it comes round again: anything no bigger
      slots.forEach((s, i) => { s.fits = pool.filter((it) => it.w <= s.w && it.h <= s.h); s.i = i; });
      built = true;
    }
    // where slot s is on screen now, and which item it shows this time round
    function place(s) {
      const u = s.y - t * SPEED * k, c = Math.floor(u / P), y = u - c * P - EDGE - 80;
      const it = c === 0 || !s.fits.length ? s.it : s.fits[((-c) * 7 + s.i * 3) % s.fits.length];
      return { x: s.x + 3 * k * Math.sin(t * 0.11 + s.ph), y, it };
    }

    return {
      still: 0,
      resize(e) { env = e; W = e.W; H = e.H; layout(); },
      update(dt, tt) { t = tt; },
      draw(ctx, a, pass) {
        if (!built || pass !== "base") return; // calmed near the text
        for (const s of slots) {
          const p = place(s), h = p.it.h;
          if (p.y < -h || p.y > H) continue;
          const fade = smooth(-h, EDGE, p.y) * (1 - smooth(H - EDGE, H + h, p.y));
          if (fade > 0.01) CH.draw(ctx, p.it.id, p.it.px, p.x, p.y + h / 2, { alpha: a * s.a * fade });
        }
      },
      // where the items are now (for layout checks): [[x0, y0, x1, y1], ...]
      boxes() { return slots.map(place).map((p) => [p.x, p.y, p.x + p.it.w, p.y + p.it.h]); },
      points(out, n) { // for the page change: points on the items now on screen
        const pts = PTS.begin(out, n), vis = slots.map(place).filter((p) => p.y > 0 && p.y < H).slice(0, 8);
        vis.forEach((p, i) => pts.eq("pure" + i, p.it.id, p.it.px, p.x, p.y + p.it.h / 2, 0.9 / Math.max(1, vis.length)));
        pts.scatter("pure-air", 0.1, 0, 0, W, H).end();
      },
    };
  };
})(window);
