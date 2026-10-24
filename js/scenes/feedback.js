/* =============================================================================
   Feedback — "the snow leopard"                     (section 6 + Comments page)
   -----------------------------------------------------------------------------
   Starts when you arrive at the section:
     0.0  heavy snow; an ibex grazes on a rocky slope (left); birds pass
     3.0  a snow leopard walks in from the right
     4.6  the ibex lifts its head and sees it…
     5.6  …startles, turns round in the air and bounds away up the slope;
          the moment it touches the edge of the screen it is gone
     9.0  the snow leopard reaches the comment box, sits down like a cat,
    10.8  turns its face to you and keeps looking, with slow cat blinks
          (a slow blink is how cats say they trust you), tail tip flicking
   The Comments page uses the same scene, already in its final, sitting state.
   The animals are drawn above the text's calm zone and placed around the text.
   HOW TO EDIT: timeline T, layout in layout(), IBEX, BIRDS; the snow itself
   (how heavy) is LAYERS in js/lib/snowfall.js.
   ============================================================================= */
(function (G) {
  "use strict";
  const { L, C, CH, PTS } = G.WQ;
  const { lerp, clamp, smooth, Ease, Rig, drawOutline, blendPose, mulberry32, rigBBox } = L;
  const INK = "246,244,236", BG = CH.BOARD;
  const T = { leoIn: 3.0, alert: 4.6, startle: 5.6, flip: 5.78, flee: 6.0, arrive: 9.0, sit: 10.3, turn: 10.8, final: 13 };
  const BIRDS = { first: 1.5, every: 11, n: 7 };
  const IBEX = { speed: 240, stride: 140, accel: 0.3, fade: 0.12 }; // flee speed and stride (px at S = 1), s to reach speed, s to vanish

  (G.WQ.scenes = G.WQ.scenes || {}).feedback = function (env0, opts = {}) {
    let env = env0, W = 0, H = 0, S = 1, portrait = false, mobile = false, box = null, built = false;
    let t = 0, off = opts.final ? T.final : 0, GY, SC, slope = [], slopeLeft = true, xSit, stage = null;
    let snow = null, birdLo = 0, birdHi = 0, birdsNow = [], gradOverall = 0, xHome = 0, dirRun = -1;
    const rLeo = new Rig(), rHead = new Rig(), rIbex = new Rig();
    let leo = null, ibex = null, turnK = 0, faceAt = null, ibexGone = -1, ibexA = 1, enterLeft = false;

    /* ---------------------------------------------------------- layout & static stage */
    function footerTop() { // top of the footer's text (home page): the ground stays above it
      const sec = opts.section, f = !opts.page && sec && sec.querySelector ? sec.querySelector(".site-footer") : null;
      if (!f) return Infinity;
      const r = f.getBoundingClientRect(), sr = sec.getBoundingClientRect();
      return r.top - sr.top + (parseFloat(G.getComputedStyle(f).paddingTop) || 0);
    }
    function layout() {
      S = Math.min(W / 960, H / 540);
      SC = portrait ? W * 0.0033 : Math.min(W / 900, H / 520) * 0.95;
      GY = Math.min(portrait ? H * 0.92 : H * 0.85, footerTop() - 14 - 20 * SC); // paws stay clear of the footer
      const formLeft = box ? box.x : W * 0.6, onRight = !box || box.x + box.w / 2 > W * 0.5;
      // the walk-in passes below the form: on short screens the leopard is a little smaller so it fits there;
      // with no room at all (a phone on its side) it comes in from the other side instead
      enterLeft = false;
      if (box && !portrait && onRight) { const room = GY - (box.y + box.h + 10); if (room < 75 * SC * 0.6) enterLeft = true; else if (room < 75 * SC) SC = room / 75; }
      if (portrait) {
        slope = rocky([[0, H * 0.7], [W * 0.5, GY]]); slopeLeft = true;
        xSit = W * 0.72;
      } else if (onRight) { // home page: the form is on the right
        slope = rocky([[0, H * 0.5], [W * 0.44, GY]]); slopeLeft = true;
        xSit = Math.min(W * 0.55, formLeft - 70 * SC);
      } else { // comments page: the text is on the left, so the cat sits on the right
        slope = rocky([[W, H * 0.55], [W * 0.66, GY]]); slopeLeft = false;
        xSit = clamp(box ? box.x + box.w + 110 * SC : W * 0.55, W * 0.55, W * 0.64);
      }
      const a = slope[0], b = slope[slope.length - 1];
      gradOverall = (b[1] - a[1]) / (b[0] - a[0] || 1);
      dirRun = Math.sign(a[0] - b[0]) || -1;              // the ibex flees up the slope
      xHome = lerp(a[0], b[0], portrait ? 0.7 : 0.58);       // where the ibex grazes
      // birds fly above the text block (or, on phones, between the text and the slope)
      const half = 40 * S + 6;
      if (portrait) { const top = box ? box.y + box.h + half + 16 : H * 0.45; birdLo = top; birdHi = Math.max(top, H * 0.66 - half); }
      else { birdLo = half + 8; birdHi = Math.max(birdLo, (box && box.x < W * 0.97 ? box.y - 14 : H * 0.3) - half); }
    }
    // a slope with rocky steps between two end points
    function rocky([a, b]) {
      const r = mulberry32(17), pts = [a], n = 9;
      for (let i = 1; i < n; i++) { const u = i / n; pts.push([lerp(a[0], b[0], u) + (r() - 0.5) * 18 * S, lerp(a[1], b[1], u) + (r() - 0.5) * 12 * S - (i % 2 ? 6 * S : 0)]); }
      pts.push(b);
      return pts;
    }
    function slopeAt(u) { // point along the slope polyline (u: 0 = top end, 1 = bottom end)
      const n = slope.length - 1, f = clamp(u, 0, 0.9999) * n, i = Math.floor(f), k = f - i, a = slope[i], b = slope[i + 1];
      const a0 = slope[0], a1 = slope[n], ang = Math.atan2(a1[1] - a0[1], a1[0] - a0[0]);
      return { x: lerp(a[0], b[0], k), y: lerp(a[1], b[1], k), ang };
    }
    // the ground along the slope as a smooth line y(x), carried straight on past both ends
    function polyY(x) {
      const n = slope.length - 1, a = slope[0], b = slope[n], lo = a[0] < b[0] ? a : b, hi = a[0] < b[0] ? b : a;
      if (x <= lo[0]) return lo[1] + gradOverall * (x - lo[0]);
      if (x >= hi[0]) return hi[1] + gradOverall * (x - hi[0]);
      for (let i = 0; i < n; i++) {
        const p = slope[i], q = slope[i + 1];
        if (x >= Math.min(p[0], q[0]) && x <= Math.max(p[0], q[0])) return lerp(p[1], q[1], (x - p[0]) / (q[0] - p[0] || 1));
      }
      return a[1];
    }
    const ridgeY = (x) => { const d = 28 * S; return (polyY(x - d) + 2 * polyY(x) + polyY(x + d)) / 4; };
    const ridgeAng = (x) => { const d = 30 * S; return Math.atan(0.5 * (ridgeY(x + d) - ridgeY(x - d)) / (2 * d) + 0.5 * gradOverall); };
    function buildStage() {
      const q = Math.min(2, env.dpr), cv = document.createElement("canvas"); cv.width = Math.round(W * q); cv.height = Math.round(H * q);
      const c = cv.getContext("2d"); c.scale(q, q);
      const r = mulberry32(23), line = (pts, a, w = 1.3, d) => CH.line(c, pts, a, w * Math.max(0.8, S * 0.8), d);
      // distant peaks, very faint
      const peaks = []; for (let x = -20; x <= W + 20; x += 24 * S) peaks.push([x, H * (portrait ? 0.6 : 0.42) - H * 0.12 * Math.abs(Math.sin(x * 0.0042 / S + 1.2)) * (0.6 + 0.4 * Math.sin(x * 0.011 / S)) + (r() - 0.5) * 6 * S]);
      line(peaks, 0.18, 1, false);
      // ground (from the foot of the slope to the far side)
      const foot = slope[slope.length - 1];
      line(slopeLeft ? [[foot[0], GY], [W + 10, GY]] : [[-10, GY], [foot[0], GY]], 0.55, 1.2);
      // the slope: dark mountain body under a chalk outline, rock cracks, snow hatching
      const body = slopeLeft ? [...slope, [W + 10, GY], [W + 10, H + 10], [-10, H + 10]] : [...slope, [-10, GY], [-10, H + 10], [W + 10, H + 10]];
      c.beginPath(); body.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fillStyle = "rgba(9,11,11,0.75)"; c.fill();
      line(slope, 0.85, 1.5);
      for (let i = 0; i < 22; i++) { const u = r(), p = slopeAt(u), d = 20 + r() * 90 * S; line([[p.x + Math.sin(p.ang) * d * 0.3, p.y + d * 0.6], [p.x + Math.sin(p.ang) * d * 0.3 + (r() - 0.5) * 26 * S, p.y + d * 0.6 + 10 * S * r()]], 0.16, 1); }
      for (let i = 0; i < 16; i++) { const u = r() * 0.95, p = slopeAt(u), len = (8 + r() * 14) * S; line([[p.x - len * Math.cos(p.ang) * 0.5, p.y + 4 * S - len * Math.sin(p.ang) * 0.5], [p.x + len * Math.cos(p.ang) * 0.5, p.y + 4 * S + len * Math.sin(p.ang) * 0.5]], 0.32, 1, false); }
      // snow lying on the ground and on the rocky steps
      for (let i = 0; i < 26; i++) { const x = slopeLeft ? lerp(foot[0] + 20, W, r()) : lerp(0, foot[0] - 20, r()), h = (3 + r() * 6) * S; line([[x, GY], [x - 2, GY - h]], 0.3, 1, false); line([[x + 3, GY], [x + 4, GY - h * 0.7]], 0.26, 1, false); }
      for (let i = 0; i < 14; i++) { const x = slopeLeft ? lerp(foot[0], W, r()) : lerp(0, foot[0], r()), w = (10 + r() * 26) * S; line([[x - w / 2, GY + 2 + r() * 3], [x + w / 2, GY + 2 + r() * 3]], 0.22, 1, false); }
      return cv;
    }

    /* ---------------------------------------------------------- snow (js/lib/snowfall.js) */
    // the nearest flakes fall in front of the animals but thin out around the text
    const clearOfText = G.WQ.Snowfall.clearOf(() => box, opts.page);

    /* ---------------------------------------------------------- the animals */
    function leopardState(tl) {
      if (tl < T.leoIn) return null;
      // it comes in from the side away from the slope (or from the left, when the form leaves no room)
      const dir = enterLeft ? 1 : slopeLeft ? -1 : 1, x0 = dir < 0 ? W + 150 * SC : -150 * SC;
      const walkT = T.arrive - T.leoIn;
      if (tl < T.arrive) {
        const u = (tl - T.leoIn) / walkT, x = lerp(x0, xSit, u * (2 - u) * 0.15 + u * 0.85), ph = (tl - T.leoIn) / 1.15;
        const P = C.snow.pose("walk", ph), Q = C.snow.pose("walk", ph + 0.5);
        return { x, dir, P, Q, turn: 0 };
      }
      const k = smooth(T.arrive, T.arrive + 0.45, tl), ks = Ease.inOut(smooth(T.arrive + 0.35, T.sit, tl));
      const st = C.snow.pose("stand"), sit = C.snow.pose("sit"), w = C.snow.pose("walk", walkT / 1.15);
      let P = blendPose(blendPose(w, st, k), sit, ks);
      const tailOf = (p) => Array.from({ length: 7 }, (_, i) => p.tl + (p.tc * i * i) / 6);
      const ta = tailOf(blendPose(w, st, k));
      P.tails = ta.map((v, i) => lerp(v, C.snow.SIT_TAIL[i], ks));
      if (ks >= 1) { P.h += 0.6 * Math.sin(tl * 1.9); P.tails = P.tails.map((v, i) => v + (i >= 5 ? 12 * Math.sin(tl * 2.3 + i) * (0.5 + 0.5 * Math.sin(tl * 0.37)) : 0)); P.ear += 6 * Math.max(0, Math.sin(tl * 0.8) - 0.92) * 12; }
      const Q = { ...P, fu: P.fu + 8, th: P.th + 6, tails: P.tails };
      return { x: xSit, dir, P, Q, turn: Ease.inOut(smooth(T.turn, T.turn + 0.6, tl)) };
    }
    function blinkAt(tl) { // slow cat blinks, then quick ordinary ones in between
      if (tl < T.turn + 1.2) return 1;
      const c = (tl - T.turn - 1.2) % 3.7;
      if (c < 0.24) return 1 - smooth(0, 0.24, c);
      if (c < 0.46) return 0;
      if (c < 0.8) return smooth(0.46, 0.8, c);
      return 1;
    }
    function ibexState(tl) {
      if ((ibexGone >= 0 && tl > ibexGone + IBEX.fade) || tl > T.flee + 9) return null;
      if (tl < T.startle) { // grazing, then the head comes up
        const gz = C.ibex.pose("graze"), al = C.ibex.pose("alert");
        gz.nk += 5 * Math.sin(tl * 1.3); gz.hd += 6 * Math.sin(tl * 1.3 + 0.5);
        const k = Ease.inOut(smooth(T.alert, T.alert + 0.5, tl)), P = blendPose(gz, al, k);
        return { x: xHome, dir: -dirRun, sx: 1, lift: 0, P, Q: { ...P, fu: P.fu + 6, th: P.th + 6 } };
      }
      const al = C.ibex.pose("alert");
      if (tl < T.flee) { // startle: a jump on the spot, turning round in the air
        const u = (tl - T.startle) / (T.flee - T.startle), turn = smooth(T.flip - 0.12, T.flip + 0.12, tl);
        return { x: xHome, dir: turn < 0.5 ? -dirRun : dirRun, sx: Math.max(0.06, Math.abs(Math.cos(Math.PI * turn))), lift: Math.sin(Math.PI * u) * 22, P: al, Q: { ...al, fu: al.fu + 6 } };
      }
      // the flight: speeds up smoothly, then bounds up the slope at a steady pace, legs in step with the ground
      const k = Math.max(0.6, S), te = tl - T.flee, v = IBEX.speed * k, ta = IBEX.accel;
      const s = v * (te - ta * (1 - Math.exp(-te / ta))), ph = s / (IBEX.stride * k), b = smooth(0, 0.18, te);
      const P = blendPose(al, C.ibex.pose("gallop", ph), b), Q = blendPose({ ...al, fu: al.fu + 6 }, C.ibex.pose("gallop", ph + 0.07), b);
      return { x: xHome + dirRun * s, dir: dirRun, sx: 1, lift: Math.abs(Math.sin(Math.PI * ph)) * 7 * b, P, Q, flee: true };
    }

    /* ---------------------------------------------------------- birds */
    function birdsAt(tl) { // a small V of birds crossing the sky now and then: [[x, y, size, flap], ...]
      birdsNow = [];
      const c = Math.floor((tl - BIRDS.first) / BIRDS.every), u = ((tl - BIRDS.first) % BIRDS.every) / (BIRDS.every * 0.62);
      if (tl < BIRDS.first || u > 1) return birdsNow;
      const r = mulberry32(c * 7 + 3), y0 = lerp(birdLo, birdHi, r()), bs = Math.max(0.85, S) * 3.6;
      for (let i = 0; i < BIRDS.n; i++) {
        const row = Math.ceil(i / 2), side = i % 2 ? 1 : -1;
        birdsNow.push([lerp(W + 80, -160, u) + row * 26 * S, y0 + side * row * 11 * S + 4 * S * Math.sin(tl * 1.3 + i), bs * (1 - 0.06 * row), tl * 9 + i * 0.9]);
      }
      return birdsNow;
    }

    return {
      still: T.final + 1.4,
      resize(e, b) {
        env = e; W = e.W; H = e.H; portrait = e.portrait; mobile = e.mobile; box = b || box;
        layout(); stage = buildStage(); snow = G.WQ.Snowfall.make(env); built = true;
      },
      update(dt, tt) {
        if (!built) return;
        t = tt + off;
        snow.step(dt, t);
        birdsAt(t);
        leo = leopardState(t); ibex = ibexState(t);
        if (leo) {
          const M = C.root(leo.x, GY, SC, leo.dir);
          turnK = leo.turn;
          rLeo.begin(M); C.snow.draw(rLeo, leo.P, leo.Q, t, { noHead: turnK > 0.01 });
          if (turnK > 0.01) { rHead.begin(M); C.snow.draw(rHead, leo.P, leo.Q, t, { headOnly: true }); }
          const hd = (turnK > 0.01 ? rHead : rLeo).parts.find((p) => p.shape === C.snow.shapes.head);
          faceAt = hd ? { c: hd.m.apply(4, -1), s: hd.m.sx * 1.08 } : null;
        }
        if (ibex) {
          const ang = ridgeAng(ibex.x), lift = ibex.lift * SC, y = ridgeY(ibex.x);
          rIbex.begin(new L.M2().translate(ibex.x + Math.sin(ang) * lift, y - Math.cos(ang) * lift).rotate(ang).scale(SC * 0.82 * ibex.dir * ibex.sx, SC * 0.82));
          C.ibex.draw(rIbex, ibex.P, ibex.Q);
          if (ibex.flee && ibexGone < 0) { const bb = rigBBox(rIbex, 0); if (bb[0] <= 0 || bb[2] >= W || bb[1] <= 0) ibexGone = t; } // touched the edge
          ibexA = ibexGone < 0 ? 1 : 1 - smooth(ibexGone, ibexGone + IBEX.fade, t);
        }
      },
      draw(ctx, a, pass) {
        if (!built) return;
        if (pass === "base") { // scenery and the far snow (calmed behind the text)
          ctx.save(); ctx.globalAlpha = a; ctx.drawImage(stage, 0, 0, W, H); ctx.restore();
          snow.draw(ctx, a, 0); snow.draw(ctx, a, 1);
          return;
        }
        // top pass: the animals are never faded by the text (they are placed clear of it)
        if (birdsNow.length) {
          ctx.strokeStyle = `rgba(${INK},${0.75 * a})`; ctx.lineWidth = 1.1; ctx.beginPath();
          for (const [x, y, s, f] of birdsNow) C.bird(ctx, x, y, s, f, 0.1);
          ctx.stroke();
        }
        const o = { width: Math.max(1.1, 1.35 * S * 0.8), color: `rgb(${INK})`, bg: BG, occlude: 0.95, far: 0.45, grain: CH.grain(), grainA: 0.5 };
        if (ibex && ibexA > 0.003) drawOutline(ctx, rIbex, { ...o, alpha: a * ibexA });
        if (leo) {
          drawOutline(ctx, rLeo, { ...o, alpha: a });
          if (turnK > 0.01) {
            if (turnK < 0.99) drawOutline(ctx, rHead, { ...o, alpha: a * (1 - turnK) });
            if (faceAt) C.snow.face(ctx, faceAt.c[0], faceAt.c[1], faceAt.s, { open: blinkAt(t), turn: turnK, alpha: a * turnK, bg: BG });
          }
        }
        snow.drawNear(ctx, a, clearOfText);
      },
      // where the animals are (for layout checks): [[x0, y0, x1, y1], ...]
      actors() {
        const out = [];
        if (leo) { out.push(rigBBox(rLeo, 0)); if (turnK > 0.01) out.push(rigBBox(rHead, 0)); }
        if (ibex && ibexA > 0.05) out.push(rigBBox(rIbex, 0));
        for (const [x, y, s] of birdsNow) out.push([x - s, y - s, x + s, y + s]);
        return out;
      },
      points(out, n) {
        const p = PTS.begin(out, n);
        if (leo) p.rig("fb-leo", rLeo, 0.38);
        if (ibex && ibexA > 0.3) p.rig("fb-ibex", rIbex, 0.22);
        p.poly("fb-slope", slope, ibex ? 0.25 : 0.4);
        p.poly("fb-ground", [[slope[slope.length - 1][0], GY], [slopeLeft ? W : 0, GY]], 0.12).end();
      },
    };
  };
})(window);
