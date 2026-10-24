/* =============================================================================
   snowfall.js — falling chalk snow in three depths                → WQ.Snowfall
   -----------------------------------------------------------------------------
   Shared by the Feedback scene (and Comments page) and the article pages.
     const sn = WQ.Snowfall.make(env, { density: 1 })   make again on resize
     sn.step(dt, t)              advance: wind gusts, sway, flakes that land
                                 start again at the top
     sn.draw(ctx, alpha, 0 | 1)  far specks / middle streaks — draw these in a
                                 scene's "base" pass, so text calms them
     sn.drawNear(ctx, alpha, clear)
                                 the nearest, soft flakes — draw in the "top"
                                 pass; clear(x, y) → 0…1 thins them out near
                                 text (pass null to draw them everywhere)
     WQ.Snowfall.clearOf(() => box, isPage)
                                 a ready clear(x, y): 0 on a text box, rising to
                                 1 just outside it (pages: follows the scroll)
   HOW TO EDIT: LAYERS (counts, sizes, speeds, brightness, wind), WIND.
   ============================================================================= */
(function (G) {
  "use strict";
  const { lerp, smooth, mulberry32, makeNoise } = G.WQ.L;
  const INK = "246,244,236";
  // count (desktop, phone), size px, fall speed px/s, brightness, how much the wind moves it
  const LAYERS = [
    { n: 620, nm: 260, s: [1.0, 1.7], v: [18, 32], a: 0.42, wind: 0.5 },  // far: fine specks
    { n: 270, nm: 120, s: [1.7, 2.7], v: [40, 66], a: 0.62, wind: 0.85 }, // middle: short streaks
    { n: 72, nm: 32, s: [3.0, 5.0], v: [90, 135], a: 0.8, wind: 1.25 },   // near: soft flakes
  ];
  const WIND = 24; // px/s: average push of the wind (it gusts around this)

  let dot = null; // a soft snowflake sprite (near layer)
  function sprite() {
    if (dot) return dot;
    dot = document.createElement("canvas"); dot.width = dot.height = 32;
    const g = dot.getContext("2d"), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, "rgba(255,255,252,1)"); gr.addColorStop(0.45, "rgba(255,255,252,0.55)"); gr.addColorStop(1, "rgba(255,255,252,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
    return dot;
  }

  G.WQ.Snowfall = {
    LAYERS,
    clearOf(getBox, page, soft = 44) {
      return (x, y) => {
        const b = getBox(); if (!b) return 1;
        const sy = page ? G.scrollY : 0, dx = Math.max(b.x - x, 0, x - b.x - b.w), dy = Math.max(b.y - sy - y, 0, y - (b.y - sy + b.h));
        return smooth(4, soft, Math.hypot(dx, dy));
      };
    },
    make(env, o = {}) {
      const W = env.W, H = env.H, S = Math.min(W / 960, H / 540), dens = o.density ?? 1;
      const r = mulberry32(o.seed || 5), nz = makeNoise(12), k = Math.max(0.8, S), ks = Math.max(0.85, S * 0.8);
      // per flake: x, y, fall speed, size, phase
      const flakes = LAYERS.map((Ly) => {
        const n = Math.round((env.mobile ? Ly.nm : Ly.n) * dens), f = new Float32Array(n * 5);
        for (let i = 0; i < n; i++) { f[5 * i] = r() * W; f[5 * i + 1] = r() * H; f[5 * i + 2] = lerp(Ly.v[0], Ly.v[1], r()) * k; f[5 * i + 3] = lerp(Ly.s[0], Ly.s[1], r()) * ks; f[5 * i + 4] = r() * 6.2832; }
        return f;
      });
      let gust = 0, t = 0;
      return {
        step(dt, tt) {
          t = tt;
          gust = WIND * k * (0.5 + 0.3 * Math.sin(t * 0.21) + 0.5 * nz.n2(t * 0.35, 1.7));
          LAYERS.forEach((Ly, li) => {
            const f = flakes[li], n = f.length / 5;
            for (let i = 0; i < n; i++) {
              f[5 * i + 1] += f[5 * i + 2] * dt;
              f[5 * i] += (gust * Ly.wind + 9 * (1 + li * 0.6) * Math.sin(t * (0.8 + 0.3 * li) + f[5 * i + 4])) * dt;
              if (f[5 * i + 1] > H + 8) { f[5 * i + 1] = -8; f[5 * i] = r() * W; }
              if (f[5 * i] > W + 8) f[5 * i] -= W + 16; else if (f[5 * i] < -8) f[5 * i] += W + 16;
            }
          });
        },
        draw(ctx, a, li) {
          const f = flakes[li], n = f.length / 5;
          if (!n || a <= 0.003) return;
          if (li === 0) { // far: fine specks
            const p = new Path2D();
            for (let i = 0; i < n; i++) { const s = f[5 * i + 3]; p.rect(f[5 * i] - s / 2, f[5 * i + 1] - s / 2, s, s); }
            ctx.fillStyle = `rgba(${INK},${LAYERS[0].a * a})`; ctx.fill(p); return;
          }
          // middle: short soft streaks along the fall (the blur of a fast flake)
          const thin = new Path2D(), thick = new Path2D(), dtb = 0.03, wx = gust * LAYERS[li].wind;
          for (let i = 0; i < n; i++) { const x = f[5 * i], y = f[5 * i + 1], q = f[5 * i + 3] < 2.2 ? thin : thick; q.moveTo(x - wx * dtb, y - f[5 * i + 2] * dtb); q.lineTo(x, y); }
          ctx.save(); ctx.lineCap = "round"; ctx.strokeStyle = `rgba(${INK},${LAYERS[li].a * a})`;
          ctx.lineWidth = 1.8 * ks; ctx.stroke(thin); ctx.lineWidth = 2.6 * ks; ctx.stroke(thick);
          ctx.restore();
        },
        drawNear(ctx, a, clear) {
          const f = flakes[2], n = f.length / 5, spr = sprite();
          if (!n || a <= 0.003) return;
          ctx.save();
          for (let i = 0; i < n; i++) {
            const x = f[5 * i], y = f[5 * i + 1], s = f[5 * i + 3], c = clear ? clear(x, y) : 1;
            if (c < 0.02) continue;
            ctx.globalAlpha = LAYERS[2].a * a * c; ctx.drawImage(spr, x - s, y - s, 2 * s, 2 * s);
          }
          ctx.restore();
        },
      };
    },
  };
})(window);
