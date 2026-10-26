/* =============================================================================
   Summit — high mountains over a sea of clouds               (blog post pages)
   -----------------------------------------------------------------------------
   A still chalk drawing, like the view from a summit: far ranges fading into
   a sea of clouds, sharp peaks on the left, and a big snowy peak on the right
   with the explorer standing on top. Now and then an eagle glides slowly
   across the sky (it circles for a while on some passes). Faint snow falls,
   and the article pages' grass sways along the bottom (js/scenes/snowfield.js,
   used underneath). The board stays put while the page scrolls, so all of it
   is there all the way down the page; the article's calm zone (data-calm)
   keeps it very faint behind the text. The big peak stands in the margin
   beside the text when there is room.
   HOW TO EDIT: SNOW (how much, how bright), EAGLE (size, speed, how often it
   comes), MTN (how bright each layer is), the shapes in buildStage().
   ============================================================================= */
(function (G) {
  "use strict";
  const { L, CH, PTS } = G.WQ;
  const { lerp, clamp, mulberry32, makeNoise, TAU, M2 } = L;
  const INK = "246,244,236";
  const SNOW = { density: 0.3, alpha: 0.45 };          // share of the article pages' snow, and how bright it is
  const EAGLE = { span: 104, speed: 30, gap: [12, 28], loop: 0.65, alpha: 0.82 }; // wingspan px (1440×900), px/s,
                                                        // seconds between passes, chance it circles on a pass, brightness
  const MTN = { far: 0.22, far2: 0.3, cloud: 1, mid: 0.4, fg: 0.62, man: 0.75 }; // brightness of each layer

  (G.WQ.scenes = G.WQ.scenes || {}).summit = function (env0, opts = {}) {
    const field = G.WQ.scenes.snowfield(env0, { ...opts, snowDensity: SNOW.density, snowAlpha: SNOW.alpha }); // grass + snow
    let env = env0, W = 0, H = 0, S = 1, SE = 1, box = null, t = 0, stage = null, lines = { fg: [], mid: [], far: [] }, top = null;
    const passes = [];

    /* ---------------------------------------------------------------- the mountains (drawn once per size) */
    // a mountain line: the lowest of the base line and each peak's two flanks (sharp tops), plus broken rock
    function silhouette(x0, x1, base, peaks, rough, seed) {
      const nz = makeNoise(seed), pts = [], hiY = Math.min(...peaks.map((q) => q.y)), step = Math.max(3, 4 * S);
      for (let x = x0; x <= x1 + 0.1; x += step) {
        let y = base;
        for (const q of peaks) { const d = x - q.x; y = Math.min(y, q.y + (d < 0 ? q.l : q.r) * Math.abs(d)); }
        const hgt = clamp((base - y) / Math.max(1, base - hiY), 0, 1);
        y += rough * S * (0.6 * nz.n2(x * 0.011 / S, 1.3) + 0.3 * nz.n2(x * 0.043 / S, 4.1) + 0.14 * nz.n2(x * 0.13 / S, 7.7)) * (0.35 + 0.65 * hgt);
        pts.push([x, y]);
      }
      return pts;
    }
    const yAt = (pts, x) => { // the line's height at x
      for (let i = 1; i < pts.length; i++) if (pts[i][0] >= x) { const a = pts[i - 1], b = pts[i]; return lerp(a[1], b[1], (x - a[0]) / (b[0] - a[0] || 1)); }
      return pts[pts.length - 1][1];
    };
    // patchy chalk: a soft noise pattern (low resolution, scaled up) used to rub out part of a wash
    function mottle(w, h, seed) {
      const cw = Math.max(8, Math.round(w / 9)), ch = Math.max(8, Math.round(h / 9)), cv = document.createElement("canvas"); cv.width = cw; cv.height = ch;
      const c = cv.getContext("2d"), d = c.createImageData(cw, ch), nz = makeNoise(seed);
      for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) { const v = 0.5 + 0.5 * nz.fbm2(x * 0.09, y * 0.16, 3); d.data[4 * (y * cw + x) + 3] = Math.round(255 * clamp((v - 0.3) * 1.6, 0, 1)); }
      c.putImageData(d, 0, 0);
      return cv;
    }
    // a range of mountains on the stage: what is behind it is rubbed out (the board shows through it), then
    // each peak gets an arete down from its top: snow on the face to its left, where the light comes from,
    // and a darker, hatched face to its right; the crest is drawn last
    function range(c, wash, o) {
      const { pts, base, a } = o, r = mulberry32(o.seed), n = pts.length, X = (i) => pts[i][0], Y = (i) => pts[i][1];
      c.save(); c.globalCompositeOperation = "destination-out"; c.beginPath(); c.moveTo(X(0), o.bottom);
      for (const [x, y] of pts) c.lineTo(x, y);
      c.lineTo(X(n - 1), o.bottom); c.closePath(); c.fillStyle = "#000"; c.fill(); c.restore();
      // the tops (highest point near each peak) and the valleys between them
      const tops = o.peaks.map((q) => { let best = -1; for (let i = 0; i < n; i++) if (Math.abs(X(i) - q.x) < 26 * S && (best < 0 || Y(i) < Y(best))) best = i; return { i: best, q }; })
        .filter((t) => t.i > 0 && t.i < n - 1).sort((p1, p2) => p1.i - p2.i);
      const valley = (i0, i1) => { let v = i0; for (let i = i0; i <= i1; i++) if (Y(i) > Y(v)) v = i; return v; };
      tops.forEach((tp, k) => {
        const iL = k ? valley(tops[k - 1].i, tp.i) : 0, iR = k < tops.length - 1 ? valley(tp.i, tops[k + 1].i) : n - 1;
        const tx = X(tp.i), ty = Y(tp.i), lean = tp.q.ax ?? 0.12, ar = [];
        for (let h = 0; ty + h <= base + 0.1; h += 9 * S) ar.push([tx + lean * h + 3 * S * Math.sin(h * 0.06 / S + o.seed) * Math.min(1, h / (30 * S)), ty + h]);
        if (ar.length < 2) return;
        const foot = ar[ar.length - 1];
        // the lit face: between the left flank and the arete, brightest near the top
        const lit = new Path2D(); lit.moveTo(X(iL), base);
        for (let i = iL; i <= tp.i; i++) lit.lineTo(X(i), Y(i));
        for (const q of ar) lit.lineTo(q[0], q[1]);
        lit.closePath();
        const g = wash.createLinearGradient(0, ty, 0, base);
        g.addColorStop(0, `rgba(${INK},${0.26 * a})`); g.addColorStop(0.45, `rgba(${INK},${0.13 * a})`); g.addColorStop(1, `rgba(${INK},${0.03 * a})`);
        wash.fillStyle = g; wash.fill(lit);
        // the shadowed face: a faint wash, hatching along the fall line, a few snow streaks
        const sh = new Path2D(); sh.moveTo(foot[0], foot[1]);
        for (let q = ar.length - 1; q >= 0; q--) sh.lineTo(ar[q][0], ar[q][1]);
        for (let i = tp.i; i <= iR; i++) sh.lineTo(X(i), Y(i));
        sh.lineTo(X(iR), base); sh.closePath();
        wash.fillStyle = `rgba(${INK},${0.012 * a})`; wash.fill(sh);
        c.save(); c.clip(sh);
        const span = X(iR) - tx, hh = base - ty;
        for (let s2 = 0.04; s2 < 0.96; s2 += 1 / Math.max(5, Math.round(span / (10 * S)))) { // short strokes down the fall line, under the crest
          const x0 = tx + s2 * span + (r() - 0.5) * 3 * S, y0 = yAt(pts, x0) + 3 * S, len = Math.min(hh * (0.06 + 0.14 * r()), 60 * S) * (1 - 0.5 * s2);
          CH.line(c, [[x0, y0], [x0 + len * 0.45, y0 + len]], a * 0.3, 0.8 * S, false);
        }
        for (let m = 0; m < 2; m++) { const x0 = tx + (0.25 + 0.5 * r()) * span, y0 = yAt(pts, x0) + 8 * S, len = Math.min(hh * (0.06 + 0.1 * r()), 40 * S); CH.line(c, [[x0, y0], [x0 + 2 * S, y0 + len * 0.5], [x0 + 3 * S, y0 + len]], a * 0.4, 1 * S, false); }
        c.restore();
        // a few gullies and rock bands on the lit face
        c.save(); c.clip(lit);
        for (let m = 0; m < 2 + Math.round(hh / (110 * S)); m++) { const x0 = lerp(X(iL), tx, 0.35 + 0.6 * r()), y0 = yAt(pts, x0) + 4 * S, len = Math.min((base - y0) * (0.08 + 0.16 * r()), 70 * S); CH.line(c, [[x0, y0], [x0 - 2 * S, y0 + len * 0.5], [x0 - 4 * S, y0 + len]], a * 0.2, 0.8 * S, false); }
        for (let m = 0; m < 1 + Math.round(hh / (120 * S)); m++) { const y0 = lerp(ty, base, 0.3 + 0.4 * r()), x0 = lerp(X(iL), tx, 0.2 + 0.6 * r()), w = (10 + 20 * r()) * S; CH.line(c, [[x0, y0], [x0 + w * 0.5, y0 + (r() - 0.5) * 3 * S], [x0 + w, y0 + 2 * S]], a * 0.18, 0.8 * S, false); }
        c.restore();
        CH.line(c, ar.slice(0, Math.max(2, Math.round(ar.length * (o.arete ?? 0.7)))), a * 0.45, 1 * S, false); // the arete
      });
      CH.line(c, pts, a, (o.w ?? 1.25) * S, true); // the crest
    }
    // a sea of clouds: the mountains behind fade into it, then soft puffs of every size heap up along its top
    function clouds(c, y0, y1, a, seed, x0 = -40, x1 = W + 40) {
      const r = mulberry32(seed);
      c.save(); c.globalCompositeOperation = "destination-out"; // what is behind sinks into the cloud
      const g = c.createLinearGradient(0, y0 - 24 * S, 0, y0 + 40 * S); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, `rgba(0,0,0,${0.75 * a})`);
      c.fillStyle = g; c.fillRect(x0, y0 - 24 * S, x1 - x0, y1 - y0 + 24 * S); c.restore();
      const puff = (x, y, rr, al) => { const gr = c.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, `rgba(${INK},${al})`); gr.addColorStop(0.6, `rgba(${INK},${al * 0.45})`); gr.addColorStop(1, `rgba(${INK},0)`); c.fillStyle = gr; c.fillRect(x - rr, y - rr, 2 * rr, 2 * rr); };
      for (let x = x0; x <= x1; x += (16 + 22 * r()) * S) { // the body of the cloud sea
        const rr = (40 + 60 * r()) * S; puff(x, y0 + rr * 0.55 + (r() - 0.3) * 10 * S, rr, 0.07 * a);
      }
      const tops = [];
      for (let x = x0; x <= x1; x += (26 + 40 * r()) * S) { // the heads along its top
        const rr = (14 + 26 * r()) * S, y = y0 + (r() - 0.5) * 12 * S; puff(x, y + rr * 0.3, rr, 0.1 * a); tops.push([x, y, rr]);
      }
      for (const [x, y, rr] of tops) { // a faint chalk line along some of the heads
        if (r() < 0.6) continue;
        const arc = []; for (let k = 0; k <= 8; k++) { const th = Math.PI * (1.18 + 0.64 * k / 8); arc.push([x + rr * Math.cos(th), y + rr * 0.3 + rr * 0.75 * Math.sin(th)]); }
        CH.line(c, arc, a * 0.1, 0.8 * S, false);
      }
      const fade = c.createLinearGradient(0, y0, 0, y1); // and it thins out downward
      fade.addColorStop(0, `rgba(${INK},0)`); fade.addColorStop(0.3, `rgba(${INK},${0.035 * a})`); fade.addColorStop(1, `rgba(${INK},0)`);
      c.fillStyle = fade; c.fillRect(x0, y0, x1 - x0, y1 - y0);
    }

    function buildStage() {
      const q = Math.min(2, env.dpr || 1), mk = () => { const cv = document.createElement("canvas"); cv.width = Math.round(W * q); cv.height = Math.round(H * q); const c = cv.getContext("2d"); c.scale(q, q); c.lineCap = c.lineJoin = "round"; return [cv, c]; };
      const [cv, c] = mk();
      const portrait = env.portrait, r = mulberry32(11);
      // where the big peak stands: in the margin beside the text when it is wide enough, otherwise right of centre
      const room = box ? W - (box.x + box.w) : 0;
      const sx = room > 220 ? box.x + box.w + room * 0.5 : W * (portrait ? 0.7 : 0.8), sy = H * (portrait ? 0.56 : 0.47);
      const horizon = H * (portrait ? 0.66 : 0.6);
      const layer = (o) => { // a range: its washes are drawn apart, rubbed patchy, then laid under its lines
        const [wc, w] = mk(); range(c, w, o);
        w.setTransform(1, 0, 0, 1, 0, 0); w.globalCompositeOperation = "destination-out"; w.globalAlpha = 0.55; w.imageSmoothingEnabled = true;
        w.drawImage(mottle(W, H, o.seed + 50), 0, 0, wc.width, wc.height);
        c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = "destination-over"; c.drawImage(wc, 0, 0); c.restore();
      };
      // far ranges, faint, half lost in haze
      const farPk = Array.from({ length: 9 }, (_, i) => ({ x: (i + r() * 0.8) * W / 8 - W * 0.05, y: horizon - (28 + 60 * r()) * S, l: 0.5 + 0.5 * r(), r: 0.55 + 0.6 * r(), ax: 0.25 * r() }));
      const far = silhouette(-20, W + 20, horizon + 30 * S, farPk, 9, 21);
      layer({ pts: far, base: horizon + 30 * S, bottom: horizon + 80 * S, peaks: farPk, a: MTN.far, seed: 31, w: 1, arete: 0.5 });
      const far2Pk = Array.from({ length: 7 }, (_, i) => ({ x: (i + 0.2 + r() * 0.6) * W / 6 - W * 0.04, y: horizon - (2 + 52 * r()) * S, l: 0.6 + 0.6 * r(), r: 0.7 + 0.7 * r(), ax: 0.3 * r() }));
      const far2 = silhouette(-20, W + 20, horizon + 60 * S, far2Pk, 10, 22);
      layer({ pts: far2, base: horizon + 60 * S, bottom: horizon + 110 * S, peaks: far2Pk, a: MTN.far2, seed: 32, w: 1.1, arete: 0.55 });
      clouds(c, horizon + 22 * S, horizon + 170 * S, MTN.cloud, 41);
      // sharp peaks on the left, rising out of the clouds
      const midBase = horizon + 70 * S;
      const midPk = [{ x: W * 0.05, y: H * (portrait ? 0.5 : 0.42), l: 0.7, r: 1.05, ax: 0.18 }, { x: W * (portrait ? 0.2 : 0.17), y: H * (portrait ? 0.45 : 0.34), l: 0.95, r: 1.25, ax: 0.1 },
        { x: W * (portrait ? 0.36 : 0.3), y: H * (portrait ? 0.53 : 0.44), l: 0.9, r: 0.8, ax: 0.2 }, { x: W * (portrait ? 0.5 : 0.42), y: H * (portrait ? 0.6 : 0.52), l: 0.85, r: 0.75, ax: 0.15 }];
      const mid = silhouette(-20, W * (portrait ? 0.62 : 0.52), midBase, midPk, 12, 23);
      layer({ pts: mid, base: midBase, bottom: midBase + 40 * S, peaks: midPk, a: MTN.mid, seed: 33 });
      clouds(c, midBase - 6 * S, midBase + 130 * S, MTN.cloud * 0.9, 42, -40, W * 0.62);
      // the big peak: a long ridge from the left, a shoulder, the summit, a steep face down to the right
      const fgPk = [{ x: sx, y: sy, l: 0.62, r: 1.35, ax: 0.16 }, { x: sx - W * (portrait ? 0.22 : 0.15), y: sy + H * 0.13, l: 0.42, r: 0.5, ax: 0.2 }, { x: sx + W * 0.16, y: sy + H * 0.2, l: 1.2, r: 0.9, ax: 0.1 }];
      const fg = silhouette(sx - W * (portrait ? 0.75 : 0.55), W + 30, H + 20, fgPk, 7, 24);
      layer({ pts: fg, base: H + 20, bottom: H + 20, peaks: fgPk, a: MTN.fg, seed: 34, w: 1.4, arete: 0.8 });
      clouds(c, H * (portrait ? 0.82 : 0.8), H * 1.06, MTN.cloud * 0.8, 43); // and more cloud, low down, round the foot of the peaks
      // the explorer on the summit, looking out over the clouds (the strip's man, small and still)
      const SMx = G.WQ.SM, topY = yAt(fg, sx);
      if (SMx) {
        const s = clamp((H * 0.034) / 81, 0.2, 0.42), p = SMx.clone(SMx.POSES.stand); p.nk = -4;
        SMx.draw(c, p, new M2().translate(sx, topY + 0.5).scale(-s, s), { width: Math.max(1, 1.05 * S), alpha: MTN.man, far: 0.5 });
      }
      top = [sx, topY];
      // chalk: punch the grain into everything
      const grain = CH.grain();
      c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = "destination-out"; c.globalAlpha = 0.38;
      c.fillStyle = c.createPattern(grain, "repeat"); c.fillRect(0, 0, cv.width, cv.height);
      lines = { fg, mid, far: far2 };
      return cv;
    }

    /* ---------------------------------------------------------------- the eagle */
    // passes: each one enters from a side (the first is already on screen, gliding out of the left margin),
    // glides across slowly, sometimes circles once, and leaves; then the sky is empty for a while
    function pass(k) {
      while (passes.length <= k) {
        const i = passes.length, r = mulberry32(i * 7919 + 17), prev = passes[i - 1];
        const dir = i === 0 ? 1 : r() < 0.5 ? 1 : -1, u = EAGLE.span * 0.5 * SE, v = EAGLE.speed * SE * (0.85 + 0.3 * r());
        const xIn = i === 0 ? W * 0.12 : dir > 0 ? -2 * u : W + 2 * u, xOut = dir > 0 ? W + 2 * u : -2 * u;
        const y0 = H * (env.portrait ? lerp(0.08, 0.3, r()) : lerp(0.1, 0.3, r()));
        let xc = null; // where it circles: over a margin if there is one
        if (r() < EAGLE.loop || i === 0) {
          const left = box ? box.x : 0, right = box ? W - box.x - box.w : 0;
          xc = right > 200 && (dir > 0 || left < 200) ? W - right * 0.5 : left > 200 ? left * 0.5 : W * lerp(0.3, 0.7, r());
          if (i === 0 && xc < xIn) xc = null;
        }
        const tLoop = xc == null ? 0 : 10 + 4 * r(), d1 = xc == null ? Math.abs(xOut - xIn) : Math.abs(xc - xIn), d2 = xc == null ? 0 : Math.abs(xOut - xc);
        const t0 = i === 0 ? 0 : prev.t1 + lerp(EAGLE.gap[0], EAGLE.gap[1], r());
        passes.push({ t0, t1: t0 + d1 / v + tLoop + d2 / v, dir, u, v, xIn, xc, y0, tLoop, d1, rLoop: (60 + 30 * r()) * SE, flap: 4 + 5 * r(), seed: r() });
      }
      return passes[k];
    }
    function eagleAt(tt) { // → { x, y, u, bank, wing, look } or null when the sky is empty
      let k = 0; while (pass(k).t1 < tt) k++;
      const p = pass(k); if (tt < p.t0) return null;
      const tau = tt - p.t0, tA = p.d1 / p.v;
      let x, y = p.y0 + 9 * SE * Math.sin(tau * 0.35 + p.seed * 6), bank = 0.05 * Math.sin(tau * 0.5 + p.seed * 3), size = 1;
      if (p.xc == null || tau < tA) x = p.xIn + p.dir * p.v * tau;
      else if (tau < tA + p.tLoop) { // one slow circle: an ellipse seen from the side, nearer at the bottom of it
        const ph = TAU * (tau - tA) / p.tLoop;
        x = p.xc + p.dir * p.rLoop * Math.sin(ph); y += 0.32 * p.rLoop * (1 - Math.cos(ph)) - 0.1 * p.rLoop * Math.sin(ph);
        bank += 0.22 * p.dir * Math.sin(ph); size = 1 + 0.1 * (1 - Math.cos(ph)) / 2;
      } else x = p.xc + p.dir * p.v * (tau - tA - p.tLoop);
      // the wings: mostly gliding (raised in a shallow V), now and then a few slow, deep beats
      const c = (tau + p.seed * 9) % (p.flap + 3.2), beat = c > p.flap ? Math.sin(Math.PI * (c - p.flap) / 3.2) : 0;
      const wing = 0.16 + 0.025 * Math.sin(tau * 1.4) + 0.42 * Math.sin(TAU * 0.78 * (c - p.flap)) * beat;
      // in and out at the screen's edges it fades (it is far away)
      const fade = clamp(Math.min(x + 2 * p.u, W + 2 * p.u - x) / (3 * p.u), 0, 1);
      return { x, y, u: p.u * size, bank, wing, look: p.dir, a: fade };
    }
    // a soaring eagle seen from in front and a little below: broad wings held in a shallow V, the long fingers
    // of the wing tips spread, a short fanned tail, the head turned the way it flies
    function drawEagle(c, e, a) {
      const { x, y, u, bank, wing, look } = e, lw = Math.max(1, 1.15 * S);
      c.save(); c.translate(x, y); c.rotate(bank); c.lineJoin = c.lineCap = "round";
      const ink = (al) => `rgba(${INK},${al * a})`, bg = `rgba(13,15,15,${0.9 * a})`;
      const stroke = (path, w = lw, al = 0.85) => { c.strokeStyle = ink(0.2 * al); c.lineWidth = w * 2.3; c.stroke(path); c.strokeStyle = ink(al); c.lineWidth = w; c.stroke(path); };
      for (const s of [-1, 1]) { // the wings
        const ph = wing, ph2 = wing * 1.45 + 0.07, d1 = [s * Math.cos(ph), -Math.sin(ph)], d2 = [s * Math.cos(ph2), -Math.sin(ph2)];
        const n1 = [s * Math.sin(ph), Math.cos(ph)], n2 = [s * Math.sin(ph2), Math.cos(ph2)];
        const sh = [s * 0.05 * u, -0.06 * u], wr = [sh[0] + d1[0] * 0.46 * u, sh[1] + d1[1] * 0.46 * u], he = [wr[0] + d2[0] * 0.24 * u, wr[1] + d2[1] * 0.24 * u];
        const nb = [(n1[0] + n2[0]) / 2, (n1[1] + n2[1]) / 2];
        const pts = [sh, wr, he, [he[0] + n2[0] * 0.1 * u, he[1] + n2[1] * 0.1 * u], [wr[0] + nb[0] * 0.13 * u, wr[1] + nb[1] * 0.13 * u], [sh[0] + n1[0] * 0.15 * u, sh[1] + n1[1] * 0.15 * u]];
        const w = new Path2D(); w.moveTo(pts[0][0], pts[0][1]); for (const q of pts.slice(1)) w.lineTo(q[0], q[1]); w.closePath();
        c.fillStyle = bg; c.fill(w); stroke(w);
        const cov = new Path2D(); cov.moveTo(sh[0] + n1[0] * 0.07 * u, sh[1] + n1[1] * 0.07 * u); cov.lineTo(wr[0] + nb[0] * 0.06 * u, wr[1] + nb[1] * 0.06 * u); cov.lineTo(he[0] + n2[0] * 0.05 * u, he[1] + n2[1] * 0.05 * u);
        stroke(cov, lw * 0.7, 0.35);
        const fingers = new Path2D(); // the primaries: five long fingers, spread and turned up a little
        for (let j = 0; j < 5; j++) { // from the leading edge (turned up) to the trailing edge (turned down)
          const b = [he[0] + n2[0] * (0.1 * u) * (j + 0.5) / 5, he[1] + n2[1] * (0.1 * u) * (j + 0.5) / 5];
          const an = s * (-0.26 + 0.1 * j), dj = [d2[0] * Math.cos(an) - d2[1] * Math.sin(an), d2[0] * Math.sin(an) + d2[1] * Math.cos(an)];
          const len = (0.25 - 0.025 * Math.abs(j - 1.5)) * u;
          fingers.moveTo(b[0], b[1]); fingers.lineTo(b[0] + dj[0] * len, b[1] + dj[1] * len);
        }
        stroke(fingers, lw * 0.95, 0.8);
      }
      const tail = new Path2D(); // the tail, fanned a little
      tail.moveTo(-0.055 * u, 0.1 * u); tail.lineTo(-0.11 * u, 0.32 * u); tail.quadraticCurveTo(0, 0.37 * u, 0.11 * u, 0.32 * u); tail.lineTo(0.055 * u, 0.1 * u); tail.closePath();
      c.fillStyle = bg; c.fill(tail); stroke(tail, lw * 0.9);
      const bodyP = new Path2D(); bodyP.ellipse(0, 0.02 * u, 0.075 * u, 0.15 * u, 0, 0, TAU);
      c.fillStyle = bg; c.fill(bodyP); stroke(bodyP);
      const hx = 0.025 * u * look, hy = -0.17 * u, head = new Path2D(); head.arc(hx, hy, 0.062 * u, 0, TAU);
      c.fillStyle = bg; c.fill(head); stroke(head, lw * 0.9);
      const beak = new Path2D(); beak.moveTo(hx + 0.045 * u * look, hy - 0.015 * u); beak.quadraticCurveTo(hx + 0.12 * u * look, hy - 0.005 * u, hx + 0.1 * u * look, hy + 0.04 * u);
      stroke(beak, lw * 0.85, 0.8);
      c.restore();
    }

    function build() {
      S = Math.max(0.6, Math.min(W / 960, H / 540)); SE = clamp(Math.min(W / 1440, H / 900), 0.65, 1.1);
      passes.length = 0;
      stage = buildStage();
    }

    return {
      still: 2.5,
      resize(e, b) { env = e; W = e.W; H = e.H; box = b || box; field.resize(e, b); build(); },
      update(dt, tt) { t = tt; field.update(dt, tt); },
      draw(ctx, a, pass) {
        if (pass === "base" && stage) {
          ctx.save(); ctx.globalAlpha = a; ctx.drawImage(stage, 0, 0, W, H); ctx.restore();
          const e = eagleAt(t); if (e && e.a > 0.01) drawEagle(ctx, e, a * EAGLE.alpha * e.a);
        }
        field.draw(ctx, a, pass);
      },
      // where the eagle is (for checks): [[x0, y0, x1, y1]] or []
      actors() { const e = eagleAt(t); return e ? [[e.x - e.u, e.y - 0.3 * e.u, e.x + e.u, e.y + 0.4 * e.u]] : []; },
      eagle: () => eagleAt(t), summit: () => top,
      points(out, n) { // for the page change: the peaks' crests, the grass, the air
        const p = PTS.begin(out, n);
        p.poly("summit-fg", lines.fg, 0.32, 2).poly("summit-mid", lines.mid, 0.22, 2).poly("summit-far", lines.far, 0.12, 2);
        const grass = []; for (let i = 0; i <= 30; i++) grass.push([lerp(0, W, i / 30), H - 14 * S]);
        p.poly("summit-grass", grass, 0.1, 6).scatter("summit-air", 0.24, 0, 0, W, H * 0.6).end();
      },
    };
  };
})(window);
