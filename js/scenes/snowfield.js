/* =============================================================================
   Snowfield — snow falling on grass                        (article pages)
   -----------------------------------------------------------------------------
   Chalk snow (js/lib/snowfall.js — the Feedback scene's snow, a little lighter
   here so that long text stays easy to read) falls over a strip of grass along
   the bottom of the board. The grass sways a little and carries a dusting of
   snow. The article text calms the drawings behind it, and the nearest flakes
   thin out around it.
   Other scenes can use it underneath their own drawings (the blog posts'
   mountains, js/scenes/summit.js): WQ.scenes.snowfield(env, { snowDensity,
   snowAlpha }) — a share of DENSITY, and how bright the snow is (0–1).
   HOW TO EDIT: DENSITY (how much snow), GRASS (how tall, how many blades).
   ============================================================================= */
(function (G) {
  "use strict";
  const { L, PTS } = G.WQ;
  const { lerp, mulberry32 } = L;
  const INK = "246,244,236";
  const DENSITY = 0.75;                    // share of the Feedback scene's snow
  const GRASS = { h: 0.085, blades: 300 }; // tallest blade (share of the screen height), blades on a 1440 px wide screen

  (G.WQ.scenes = G.WQ.scenes || {}).snowfield = function (env0, opts = {}) {
    const dens = opts.snowDensity ?? DENSITY, sa = opts.snowAlpha ?? 1;
    let env = env0, W = 0, H = 0, S = 1, GY = 0, box = null, snow = null, blades = [], tips = [], t = 0, built = false;
    const clear = G.WQ.Snowfall.clearOf(() => box, true);

    function build() {
      S = Math.min(W / 960, H / 540); GY = H - Math.max(10, 18 * S);
      const r = mulberry32(3), n = Math.round(GRASS.blades * (W / 1440) * (env.mobile ? 0.8 : 1)), hmax = H * GRASS.h;
      blades = []; tips = [];
      for (let i = 0; i < n; i++) {
        const x = r() * (W + 40) - 20, clump = 0.5 + 0.5 * Math.sin(x * 0.013) * Math.sin(x * 0.0071 + 1.3); // grass grows in clumps
        const h = hmax * (0.25 + 0.75 * r()) * (0.35 + 0.65 * clump);
        blades.push({ x, h, lean: (r() - 0.45) * h * 0.5, ph: r() * 6.283, g: (r() * 3) | 0 }); // g: brightness group
        if (r() < 0.32) tips.push(blades.length - 1); // a little snow caught on this blade
      }
      snow = G.WQ.Snowfall.make(env, { density: dens, seed: 9 });
      built = true;
    }
    const sway = (b) => b.lean + 3 * S * Math.sin(t * 1.1 + b.ph) + 1.5 * S * Math.sin(t * 2.7 + b.ph * 2);

    return {
      still: 6,
      resize(e, b) { env = e; W = e.W; H = e.H; box = b || box; build(); },
      update(dt, tt) { if (!built) return; t = tt; snow.step(dt, t); },
      draw(ctx, a, pass) {
        if (!built) return;
        if (pass === "top") { snow.drawNear(ctx, a * sa, clear); return; } // the nearest flakes, clear of the text
        snow.draw(ctx, a * sa, 0);
        // the grass: chalk blades in a few brightness groups
        ctx.save(); ctx.lineCap = "round"; ctx.lineWidth = Math.max(1, 1.2 * S);
        for (const [g, al] of [[0, 0.3], [1, 0.45], [2, 0.6]]) {
          ctx.beginPath();
          for (const b of blades) {
            if (b.g !== g) continue;
            const s = sway(b); ctx.moveTo(b.x, GY + 2); ctx.quadraticCurveTo(b.x + s * 0.35, GY - b.h * 0.55, b.x + s, GY - b.h);
          }
          ctx.strokeStyle = `rgba(${INK},${a * al})`; ctx.stroke();
        }
        // snow on the ground and caught on the grass
        ctx.strokeStyle = `rgba(${INK},${0.22 * a})`; ctx.lineWidth = 3 * S; ctx.beginPath(); ctx.moveTo(0, GY + 3); ctx.lineTo(W, GY + 3); ctx.stroke();
        ctx.fillStyle = `rgba(${INK},${0.6 * a})`;
        for (const i of tips) { const b = blades[i], s = sway(b); ctx.beginPath(); ctx.arc(b.x + s, GY - b.h, 1.3 * Math.max(0.8, S), 0, 6.283); ctx.fill(); }
        ctx.restore();
        snow.draw(ctx, a * sa, 1);
      },
      points(out, n) { // for the page change: the grass line and the board above it
        const p = PTS.begin(out, n), line = [];
        for (let i = 0; i <= 40; i++) line.push([lerp(0, W, i / 40), GY - 6 * Math.sin(i)]);
        p.poly("snowfield-grass", line, 0.35, 8).scatter("snowfield-air", 0.65, 0, 0, W, GY).end();
      },
    };
  };
})(window);
