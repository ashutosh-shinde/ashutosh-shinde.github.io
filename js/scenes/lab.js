/* =============================================================================
   Strategic Intelligence Lab — "games of chance and strategy"     (section 4)
   -----------------------------------------------------------------------------
   Drawn in GREY chalk on purpose: this section is still under development.
   • Cards: a deck riffles, deals a hand face down, flips it (a royal flush),
     shows how unlikely that is, then gathers the cards back.
   • Dice: two dice tumble and settle; a histogram of their sums slowly takes
     the shape of the triangular distribution (2 … 12).
   • The Prisoner's Dilemma payoff matrix writes itself and its Nash
     equilibrium is circled.
   • Monty Hall: pick door 1, door 3 opens on a goat — switch (2/3) and win.
   • A spinning coin draws its random walk.
   • Game-theory and probability equations write themselves faintly.
   HOW TO EDIT: GREY (overall brightness), the CYCLE_* durations, layout().
   ============================================================================= */
(function (G) {
  "use strict";
  const { L, CH, PTS } = G.WQ;
  const { lerp, clamp, smooth, Ease, TAU, mulberry32, fract } = L;
  const INK = "246,244,236", BG = CH.BOARD, GREY = 0.7;
  const CYCLE_CARDS = 13, CYCLE_DICE = 4.2, CYCLE_GAME = 14, CYCLE_DOORS = 12.5, FLIP = 0.42;
  const EQS = ["kelly", "bayes", "expect", "nash", "minimax", "gambler", "binomial", "variance", "lanchester", "replicator"];
  const HAND = [["r_10", "s_sp"], ["r_J", "s_sp"], ["r_Q", "s_sp"], ["r_K", "s_sp"], ["r_A", "s_sp"]];
  const PIPS = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };

  (G.WQ.scenes = G.WQ.scenes || {}).lab = function (env0) {
    let env = env0, W = 0, H = 0, S = 1, k1 = 1, portrait = false, mobile = false, box = null, built = false, t = 0;
    let Lc, Ld, Lg, Lm, Lw, slots = [], hist = new Array(13).fill(0), histCycle = -1, walk = [], walkStep = -1;
    const outlines = []; // polylines drawn this frame (for the dust transitions)

    /* ---------------------------------------------------------- chalk primitives */
    const A = (a) => a * GREY;
    function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
    function chalkStroke(ctx, a, w = 1.3) {
      ctx.lineJoin = "round"; ctx.lineCap = "round";
      ctx.strokeStyle = `rgba(240,238,230,${0.2 * a})`; ctx.lineWidth = w * 2.2; ctx.stroke();
      ctx.strokeStyle = `rgba(248,246,238,${0.85 * a})`; ctx.lineWidth = w; ctx.stroke();
    }
    function note(pts) { outlines.push(pts); }
    function rectPts(cx, cy, w, h, rot) { const c = Math.cos(rot), s = Math.sin(rot), P = (x, y) => [cx + x * c - y * s, cy + x * s + y * c]; return [P(-w / 2, -h / 2), P(w / 2, -h / 2), P(w / 2, h / 2), P(-w / 2, h / 2), P(-w / 2, -h / 2)]; }

    /* ---------------------------------------------------------- cards */
    function card(ctx, x, y, rot, flip, face, a) { // flip 0 = back, 1 = face (the flip squashes x)
      const cw = 44 * k1, ch = 62 * k1, sx = Math.max(0.03, Math.abs(Math.cos(Math.PI * (1 - flip)))), up = flip > 0.5;
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(sx, 1);
      rrect(ctx, -cw / 2, -ch / 2, cw, ch, 5 * k1); ctx.fillStyle = BG; ctx.globalAlpha = Math.min(1, a * 1.6); ctx.fill(); ctx.globalAlpha = 1;
      chalkStroke(ctx, A(a), 1.2);
      if (!up) { // back: a diamond lattice
        ctx.save(); rrect(ctx, -cw / 2 + 5 * k1, -ch / 2 + 5 * k1, cw - 10 * k1, ch - 10 * k1, 3 * k1); ctx.clip();
        ctx.beginPath(); for (let i = -8; i <= 8; i++) { ctx.moveTo(i * 7 * k1 - ch, -ch); ctx.lineTo(i * 7 * k1 + ch, ch); ctx.moveTo(i * 7 * k1 + ch, -ch); ctx.lineTo(i * 7 * k1 - ch, ch); }
        ctx.strokeStyle = `rgba(${INK},${0.35 * A(a)})`; ctx.lineWidth = 0.8; ctx.stroke(); ctx.restore();
      } else if (face) {
        CH.draw(ctx, face[0], 12 * k1, -cw / 2 + 5 * k1, -ch / 2 + 10 * k1, { alpha: A(a) * 1.3 });
        CH.draw(ctx, face[1], 9 * k1, -cw / 2 + 5 * k1, -ch / 2 + 22 * k1, { alpha: A(a) * 1.3 });
        CH.draw(ctx, face[1], 26 * k1, 0, 2 * k1, { alpha: A(a) * 1.3, align: "center" });
      }
      ctx.restore();
      note(rectPts(x, y, cw * sx, ch, rot));
    }
    function drawCards(ctx, a) {
      const u = (t % CYCLE_CARDS), deck = Lc.deck, n = HAND.length, cw = 44 * k1;
      // riffle: two half-piles interleave (0–1.6 s)
      const rif = smooth(0.1, 1.6, u), split = Math.sin(Math.PI * rif) * 36 * k1;
      for (let i = 0; i < 6; i++) { const side = i % 2 ? 1 : -1, lift = (i / 6) * 1.5 * k1; card(ctx, deck[0] + side * split * (1 - i / 9), deck[1] - lift - Math.sin(Math.PI * clamp(rif * 6 - i, 0, 1)) * 10 * k1, side * 0.06 * Math.sin(Math.PI * rif), 0, null, a); }
      // the hand: dealt (1.8–3.6 s), flipped one by one (4.0–6.2 s), gathered back (10.2–11.8 s)
      for (let i = 0; i < n; i++) {
        const d = Ease.inOut(smooth(1.8 + i * 0.32, 2.5 + i * 0.32, u)) * (1 - Ease.inOut(smooth(10.2 + i * 0.12, 11.2 + i * 0.12, u)));
        if (d <= 0.001) continue;
        const tx = lerp(Lc.hand[0], Lc.hand[2], n > 1 ? i / (n - 1) : 0.5), ty = Lc.hand[1] - Math.sin(Math.PI * (i / (n - 1))) * 10 * k1, tr = (i - (n - 1) / 2) * 0.09;
        const x = lerp(deck[0], tx, d), y = lerp(deck[1] - 10 * k1, ty, d) - Math.sin(Math.PI * d) * 26 * k1;
        const fl = smooth(4.0 + i * 0.36, 4.0 + i * 0.36 + FLIP, u) * (1 - smooth(9.4, 9.4 + FLIP, u));
        card(ctx, x, y, tr * d, fl, HAND[i], a);
      }
      const pr = smooth(6.3, 7.6, u) * (1 - smooth(9.0, 9.6, u));
      if (pr > 0) CH.write(ctx, "p_royal", 13 * k1, (Lc.hand[0] + Lc.hand[2]) / 2, Lc.hand[1] + 62 * k1, pr, { alpha: A(a) * 1.2, align: "center", tip: pr < 1 });
      void cw;
    }

    /* ---------------------------------------------------------- dice */
    function die(ctx, x, y, s, rot, face, a) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
      rrect(ctx, -s / 2, -s / 2, s, s, s * 0.18); ctx.fillStyle = BG; ctx.fill(); chalkStroke(ctx, A(a), 1.3);
      ctx.fillStyle = `rgba(${INK},${0.9 * A(a)})`;
      for (const [px, py] of PIPS[face]) { ctx.beginPath(); ctx.arc(px * s * 0.26, py * s * 0.26, s * 0.075, 0, TAU); ctx.fill(); }
      ctx.restore();
      note(rectPts(x, y, s, s, rot));
    }
    function drawDice(ctx, a) {
      const c = Math.floor(t / CYCLE_DICE), u = (t % CYCLE_DICE) / CYCLE_DICE, r = mulberry32(c * 31 + 7);
      const f1 = 1 + ((r() * 6) | 0), f2 = 1 + ((r() * 6) | 0);
      if (c !== histCycle) { // record this roll (+ a few unseen ones so the shape appears)
        histCycle = c;
        if (hist.reduce((p, q) => p + q, 0) > 260) hist.fill(0);
        hist[f1 + f2]++; for (let i = 0; i < 9; i++) hist[2 + ((r() * 6) | 0) + ((r() * 6) | 0)]++;
      }
      const s = 26 * k1, roll = Ease.out(clamp(u / 0.55, 0, 1)), bounce = Math.abs(Math.sin(roll * Math.PI * 3)) * (1 - roll) * 30 * k1;
      const fade = 1 - smooth(0.9, 1, u);
      for (const [i, f] of [[0, f1], [1, f2]]) {
        const x = lerp(Ld.x0, Ld.x0 + (Ld.x1 - Ld.x0) * 0.45 + i * s * 1.5, roll), y = Ld.y1 - s / 2 - bounce * (i ? 0.8 : 1);
        const face = roll < 0.97 ? 1 + (((t * 14 + i * 3) | 0) % 6) : f;
        die(ctx, x, y, s, (1 - roll) * (6 + i * 2.5) + (i ? 0.1 : -0.06), face, a * fade + a * 0.25 * (1 - fade));
      }
      CH.line(ctx, [[Ld.x0 - 6, Ld.y1], [Ld.x1, Ld.y1]], A(a) * 0.8, 1, false);
      // histogram of sums
      const hx0 = Ld.hx0, hx1 = Ld.hx1, hy = Ld.hy, hh = Ld.hh, mx = Math.max(4, ...hist), bw = (hx1 - hx0) / 11;
      CH.line(ctx, [[hx0 - 4, hy], [hx1 + 4, hy]], A(a) * 0.7, 1, false);
      for (let v = 2; v <= 12; v++) { const x = hx0 + (v - 2 + 0.5) * bw, hgt = (hist[v] / mx) * hh; if (hgt > 0.5) CH.line(ctx, [[x, hy], [x, hy - hgt]], A(a) * (v === f1 + f2 && u > 0.55 ? 1.4 : 0.9), Math.max(2, bw * 0.45), false); }
      CH.draw(ctx, "n_2", 9 * k1, hx0 + 0.5 * bw, hy + 9 * k1, { alpha: A(a), align: "center" });
      CH.draw(ctx, "n_7", 9 * k1, hx0 + 5.5 * bw, hy + 9 * k1, { alpha: A(a), align: "center" });
      CH.draw(ctx, "n_12", 9 * k1, hx0 + 10.5 * bw, hy + 9 * k1, { alpha: A(a), align: "center" });
      CH.draw(ctx, "l_dice", 11 * k1, (hx0 + hx1) / 2, hy - hh - 12 * k1, { alpha: A(a), align: "center" });
    }

    /* ---------------------------------------------------------- payoff matrix + Nash */
    function drawGame(ctx, a) {
      const u = t % CYCLE_GAME, fade = 1 - smooth(13.0, 13.8, u), px = 15 * k1, [w, h] = CH.size("payoff", px);
      CH.write(ctx, "l_payoff", 11 * k1, Lg.x, Lg.y - h / 2 - 16 * k1, smooth(0.2, 0.9, u), { alpha: A(a) * fade, tip: u < 0.9 });
      CH.write(ctx, "payoff", px, Lg.x, Lg.y, smooth(0.6, 2.8, u), { alpha: A(a) * 1.35 * fade, tip: u < 2.8 });
      const ci = smooth(3.2, 4.3, u);
      if (ci > 0) { // circle the (D, D) cell = the Nash equilibrium
        const cx = Lg.x + w * 0.83, cy = Lg.y + h * 0.27, rx = w * 0.15, ry = h * 0.2, pts = [];
        for (let i = 0; i <= 60 * ci; i++) { const th = -0.5 + (i / 60) * TAU * 1.08; pts.push([cx + rx * Math.cos(th), cy + ry * Math.sin(th)]); }
        CH.line(ctx, pts, A(a) * 1.4 * fade, 1.5, false);
        CH.write(ctx, "l_nash", 11 * k1, cx + rx + 10 * k1, cy + ry + 14 * k1, smooth(4.3, 5.1, u), { alpha: A(a) * 1.2 * fade, tip: u < 5.1 });
      }
      note([[Lg.x, Lg.y - h / 2], [Lg.x + w, Lg.y - h / 2], [Lg.x + w, Lg.y + h / 2], [Lg.x, Lg.y + h / 2], [Lg.x, Lg.y - h / 2]]);
    }

    /* ---------------------------------------------------------- Monty Hall */
    function door(ctx, x, y, w, h, open, num, inside, a) {
      ctx.beginPath(); ctx.rect(x, y, w, h); ctx.fillStyle = `rgba(6,7,7,${Math.min(0.9, 1.5 * a)})`; ctx.fill(); chalkStroke(ctx, A(a), 1.2);
      if (open > 0.02 && inside) CH.draw(ctx, inside, 11 * k1, x + w / 2, y + h * 0.55, { alpha: A(a) * 1.4 * open, align: "center" });
      // the door panel swings open on its left hinge (drawn as a narrowing quad)
      const pw = w * (1 - 0.82 * Ease.inOut(open)), skew = h * 0.06 * Ease.inOut(open);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + pw, y + skew); ctx.lineTo(x + pw, y + h - skew); ctx.lineTo(x, y + h); ctx.closePath();
      ctx.save(); ctx.globalAlpha = Math.min(1, 1.5 * a); ctx.fillStyle = BG; ctx.fill(); ctx.restore(); chalkStroke(ctx, A(a), 1.2);
      if (open < 0.6) { CH.draw(ctx, num, 13 * k1, x + pw / 2, y + h * 0.35, { alpha: A(a) * 1.3 * (1 - open), align: "center" }); ctx.beginPath(); ctx.arc(x + pw * 0.8, y + h * 0.55, 2 * k1, 0, TAU); ctx.fillStyle = `rgba(${INK},${A(a)})`; ctx.fill(); }
      note([[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]]);
    }
    function drawDoors(ctx, a) {
      const u = t % CYCLE_DOORS, fade = 1 - smooth(11.6, 12.3, u), w = Lm.w, h = Lm.h, gapX = w * 0.45;
      const xs = [0, 1, 2].map((i) => Lm.x + i * (w + gapX));
      door(ctx, xs[0], Lm.y, w, h, 0, "d_1", "l_goat", a * fade);
      door(ctx, xs[1], Lm.y, w, h, smooth(6.6, 7.6, u), "d_2", "l_car", a * fade);
      door(ctx, xs[2], Lm.y, w, h, smooth(2.2, 3.2, u), "d_3", "l_goat", a * fade);
      const pick = smooth(0.6, 1.4, u);
      if (pick > 0) { const cx = xs[0] + w / 2, pts = []; for (let i = 0; i <= 40 * pick; i++) { const th = (i / 40) * TAU; pts.push([cx + w * 0.62 * Math.cos(th), Lm.y + h + 14 * k1 + 5 * k1 * Math.sin(th)]); } CH.line(ctx, pts, A(a) * fade, 1.2, false); }
      const sw = smooth(3.8, 5.0, u);
      if (sw > 0) { // the switch arrow, door 1 → door 2
        const x0 = xs[0] + w / 2, x1 = xs[1] + w / 2, y0 = Lm.y - 8 * k1, pts = [];
        for (let i = 0; i <= 30 * sw; i++) { const v = i / 30; pts.push([lerp(x0, x1, v), y0 - Math.sin(Math.PI * v) * 22 * k1]); }
        CH.line(ctx, pts, A(a) * 1.3 * fade, 1.3, false);
        if (sw > 0.97) CH.line(ctx, [[x1 - 6 * k1, y0 - 7 * k1], [x1, y0], [x1 + 2 * k1, y0 - 9 * k1]], A(a) * 1.3 * fade, 1.3, false);
        CH.write(ctx, "l_switch", 11 * k1, (x0 + x1) / 2, y0 - 34 * k1, smooth(4.6, 5.4, u), { alpha: A(a) * 1.3 * fade, align: "center", tip: u < 5.4 });
        CH.write(ctx, "l_stay", 10 * k1, x0, Lm.y + h + 30 * k1, smooth(5.0, 5.8, u), { alpha: A(a) * fade, align: "center", tip: u < 5.8 });
      }
      CH.draw(ctx, "l_monty", 11 * k1, xs[0], Lm.y - 66 * k1, { alpha: A(a) * 0.9 * fade });
    }

    /* ---------------------------------------------------------- coin + random walk */
    function drawCoin(ctx, a) {
      const step = Math.floor(t / 0.45), r = mulberry32(step * 13 + 5);
      if (step !== walkStep) { walkStep = step; const last = walk.length ? walk[walk.length - 1] : 0; walk.push(last + (r() < 0.5 ? 1 : -1)); if (walk.length > 48) walk.shift(); }
      const cx = Lw.x0 + 16 * k1, cy = Lw.ym, R = 13 * k1, sq = Math.abs(Math.cos(t * 9));
      ctx.save(); ctx.translate(cx, cy); ctx.scale(1, Math.max(0.08, sq));
      ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fillStyle = BG; ctx.fill(); chalkStroke(ctx, A(a), 1.2);
      if (sq > 0.5) CH.draw(ctx, walk[walk.length - 1] >= (walk[walk.length - 2] ?? 0) ? "c_H" : "c_T", 12 * k1, 0, 0, { alpha: A(a) * 1.3, align: "center" });
      ctx.restore();
      const x0 = cx + R + 14 * k1, x1 = Lw.x1, pts = walk.map((v, i) => [lerp(x0, x1, i / 47), cy - v * 3.2 * k1]);
      CH.line(ctx, [[x0, cy], [x1, cy]], A(a) * 0.5, 1, false);
      CH.line(ctx, pts, A(a) * 1.2, 1.3, false);
      note(pts);
      CH.draw(ctx, "l_coin", 10.5 * k1, x0, cy + 30 * k1, { alpha: A(a) * 0.9 });
    }

    let drawnAt = -1, dummyCtx = null;
    const dummy = () => dummyCtx || (dummyCtx = Object.assign(document.createElement("canvas"), { width: 1, height: 1 }).getContext("2d"));
    function render(ctx, a) {
      outlines.length = 0; drawnAt = t;
      for (const s of slots) {
        const lt = t + s.ph, c = Math.floor(lt / s.per), u = (lt - c * s.per) / s.per, sp = slotSpot(s, c);
        CH.write(ctx, sp.id, sp.px, sp.x, sp.y, smooth(0.02, 0.22, u), { alpha: a * (1 - smooth(0.82, 0.97, u)) * 0.3, tip: u < 0.22 });
      }
      drawGame(ctx, a); drawDoors(ctx, a); drawCoin(ctx, a); drawDice(ctx, a); drawCards(ctx, a);
    }

    /* ---------------------------------------------------------- layout */
    function layout() {
      S = Math.min(W / 960, H / 540); k1 = Math.max(0.78, Math.min(1.7, S)) * (portrait ? 1.05 : 1);
      const tb = box || { x: W * 0.06, y: H * 0.16, w: W * 0.36, h: H * 0.26 };
      if (portrait) {
        const y0 = tb.y + tb.h + H * 0.05;
        Lc = { deck: [W * 0.14, y0 + 40 * k1], hand: [W * 0.32, y0 + 44 * k1, W * 0.86] };
        Lg = { x: W * 0.06, y: y0 + 190 * k1 };
        Lm = { x: W * 0.58, y: y0 + 150 * k1, w: 28 * k1, h: 46 * k1 };
        Ld = { x0: W * 0.06, x1: W * 0.44, y1: H * 0.93, hx0: W * 0.56, hx1: W * 0.94, hy: H * 0.93, hh: H * 0.07 };
        Lw = { x0: W * 0.06, x1: W * 0.94, ym: H * 0.8 };
      } else {
        const right = Math.max(tb.x + tb.w + W * 0.05, W * 0.5);
        Lc = { deck: [right + 30 * k1, H * 0.26], hand: [right + 110 * k1, H * 0.24, Math.min(W * 0.93, right + 110 * k1 + 4 * 62 * k1)] };
        Lg = { x: right, y: H * 0.6 };
        Lm = { x: W * 0.07, y: Math.max(tb.y + tb.h + H * 0.15, H * 0.62), w: 38 * k1, h: 62 * k1 };
        Ld = { x0: Math.min(W * 0.8, right + 330 * k1), x1: W * 0.95, y1: H * 0.88, hx0: Math.min(W * 0.8, right + 330 * k1), hx1: W * 0.95, hy: H * 0.64, hh: H * 0.13 };
        Lw = { x0: W * 0.36, x1: Math.min(W * 0.64, Ld.x0 - 40 * k1), ym: H * 0.86 };
      }
    }
    function slotSpot(s, c) {
      const r = mulberry32(s.seed + c * 911), id = EQS[(s.seed + c * 3) % EQS.length], px = (11 + 5 * r()) * Math.max(0.8, S), [w, h] = CH.size(id, px);
      for (let k = 0; k < 14; k++) {
        const x = lerp(W * 0.03, W * 0.97 - w, r()), y = lerp(H * 0.05, H * 0.95, r());
        if (box && x < box.x + box.w + 30 && x + w > box.x - 30 && y + h / 2 > box.y - 30 && y - h / 2 < box.y + box.h + 30) continue;
        return { id, px, x, y };
      }
      return { id, px, x: W * 0.5, y: H * 0.08 };
    }

    return {
      still: 6.4,
      resize(e, b) {
        env = e; W = e.W; H = e.H; portrait = e.portrait; mobile = e.mobile; box = b || box; layout();
        if (!built) { const r = mulberry32(5); slots = []; for (let i = 0; i < (mobile ? 3 : 6); i++) slots.push({ per: 10 + 5 * r(), ph: r() * 10, seed: (r() * 1e6) | 0 }); built = true; }
      },
      update(dt, tt) { t = tt; },
      draw(ctx, a, pass) {
        if (!built || pass !== "base") return;
        render(ctx, a);
      },
      points(out, n) {
        if (drawnAt !== t) render(dummy(), 0.001); // not drawn this frame (still invisible): compute the shapes anyway
        const pts = [];
        for (const o of outlines) for (let i = 1; i < o.length; i++) { const [x0, y0] = o[i - 1], [x1, y1] = o[i], m = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / 6)); for (let j = 0; j < m; j++) pts.push(lerp(x0, x1, j / m), lerp(y0, y1, j / m)); }
        const src = Float32Array.from(pts);
        PTS.begin(out, n).arr("lab-outlines", src, src.length / 2, 0.8).eq("lab-pay", "payoff", 15 * k1, Lg.x, Lg.y, 0.2).end();
      },
    };
  };
})(window);
