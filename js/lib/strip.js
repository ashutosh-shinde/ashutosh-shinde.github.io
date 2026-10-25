/* =============================================================================
   strip.js — the explorer strip at the bottom of the Blogs list
   -----------------------------------------------------------------------------
   A band fixed to the bottom of the screen (#strip in blogs/index.html; styles
   in css/writing.css). The explorer (js/lib/explorer.js) runs along the chalk
   ground and stops for his activities; the ground scrolls by, so it works on
   any screen width. One loop, about 75 s:
     pull-ups on a bar → skipping rope → reading on a rock under a pine →
     the leopard: darted, GPS-collared, wakes and bounds away → an ice boulder
     climbed with two axes → the dance on top → a dive into the lake →
     swimming across → out on the far bank, shake off → and on again
   Reduced motion: one still drawing (reading). The pause button stops it.
   Test hook: ?capture=1 stops the clock; WQ.strip.at(t) draws the loop at t s.
   HOW TO EDIT: ACTS (order, run distances, durations), MS (his size),
   V (running speed), the scenery sizes at the top of each act.
   ============================================================================= */
(function (G) {
  "use strict";
  const WQ = G.WQ;
  if (!WQ || !WQ.SM || !WQ.L) return;
  const { L, SM, C } = WQ, { lerp, clamp, smooth, Ease, TAU, M2, Rig, drawOutline, mulberry32, fract } = L;
  const INK = "246,244,236", BG = "#0d0f0f";
  const HD = 120, GY = 106;          // design units: strip height, ground line
  const MS = 0.74, LS = 0.32;        // explorer and leopard scale (design units per figure unit)
  const V = 150, STRIDE = 56;        // running speed (units/s), ground covered per run cycle
  const U = SM.U, P = SM.POSES;
  const sm = (a, b, u) => smooth(a, b, u), seg = (u, a, b) => clamp((u - a) / (b - a), 0, 1);

  // extra poses for the strip (angles from straight down, + toward where he faces)
  const POSE = {
    hang: { h: 38, lean: 0, nk: -4, look: 0, arm: [[176, 178], [172, 176]], leg: [[26, -40, 50], [16, -52, 40]] },
    crouch: { h: 27, lean: 20, nk: 4, look: 0, arm: [[-36, 10], [-26, 20]], leg: [[64, -36, 90], [56, -44, 90]] },
    land: { h: 30, lean: 12, nk: 4, look: 0, arm: [[46, 80], [36, 70]], leg: [[52, -26, 90], [44, -34, 90]] },
    skip: { h: 37.5, lean: 2, nk: 2, look: 0, arm: [[16, 74], [8, 66]], leg: [[4, -4, 88], [-2, -6, 88]] },
    sit: { h: 19.5, lean: 8, nk: 22, look: 0, arm: [[40, 100], [30, 96]], leg: [[88, 2, 92], [82, -4, 90]] },
    swim: { h: 38, lean: 90, nk: -24, look: 0, arm: [[90, 90], [-90, -90]], leg: [[-92, -92, -100], [-86, -86, -96]] },
    wave: { h: 38, lean: 0, nk: 0, look: 1, arm: [[150, 170], [-20, -12]], leg: [[9, 4, 70], [-9, -4, -70]] },
  };
  const runPose = (x) => SM.cyc(SM.RUN, x / STRIDE);

  /* ------------------------------------------------------------------ the acts
     Each act: run (units run before it), dur (s), dxEnd (where he ends, from the
     act's anchor A), man(u, A) → {p, rx, ry, dir, alpha?, props}, scenery(A, u)
     drawn whenever on screen, extra(A, u, man) drawn while the act runs.     */
  const ACTS = [];
  let D; // drawing helpers, set per frame

  /* --- 1. pull-ups --------------------------------------------------------- */
  const BY = 20; // the bar
  function hang(A, f, sw) {
    const p = SM.clone(POSE.hang);
    p.leg[0][0] += 7 * Math.sin(sw); p.leg[1][0] += 7 * Math.sin(sw + 0.5);
    const L0 = SM.local(p), reach = (U.ua + U.fa) * MS * 0.97;
    const shX = A - 3, shY = BY + 1.5 + reach * (1 - 0.95 * f);
    const rx = shX - L0.sh[0] * MS, ry = shY - L0.sh[1] * MS;
    SM.reach(p, "arm", 0, D.toFig([A + 1.5, BY + 1], rx, ry, 1), -1);
    SM.reach(p, "arm", 1, D.toFig([A - 1.5, BY + 1], rx, ry, 1), -1);
    return { p, rx, ry, dir: 1 };
  }
  ACTS.push({
    name: "pull-ups", run: 300, dur: 7.6, dxEnd: 0,
    scenery(A) {
      D.ln([[A - 18, GY], [A - 18, BY]], 1.6, 0.8); D.ln([[A + 18, GY], [A + 18, BY]], 1.6, 0.8);
      D.ln([[A - 25, BY], [A + 25, BY]], 1.9, 0.92);
      D.ln([[A - 23, GY], [A - 13, GY - 0.5]], 1.3, 0.6); D.ln([[A + 13, GY - 0.5], [A + 23, GY]], 1.3, 0.6);
    },
    man(u, A) {
      if (u < 0.6) { const p = SM.mix(runPose(A), P.stand, sm(0, 0.25, u)); p.nk = lerp(0, -30, sm(0.2, 0.6, u)); return { p, rx: A - 3, ry: GY, dir: 1 }; }
      if (u < 0.78) { const p = SM.mix(P.stand, POSE.crouch, Ease.inOut(seg(u, 0.6, 0.78))); p.nk = -30; return { p, rx: A - 3, ry: GY, dir: 1 }; }
      if (u < 1.05) { // the jump
        const e = Ease.out(seg(u, 0.78, 1.05)), H = hang(A, 0, 0), p = SM.mix(POSE.crouch, H.p, e);
        return { p, rx: lerp(A - 3, H.rx, e), ry: lerp(GY, H.ry, e) - 6 * Math.sin(Math.PI * e), dir: 1 };
      }
      if (u < 6.25) { // three pull-ups
        const v = (u - 1.05) / 5.2 * 3, ph = fract(v), rep = Math.floor(v);
        const f = rep >= 3 ? 0 : ph < 0.36 ? Ease.inOut(ph / 0.36) : ph < 0.46 ? 1 : ph < 0.86 ? 1 - Ease.inOut((ph - 0.46) / 0.4) : 0;
        return hang(A, f, (u - 1.05) * 3.2);
      }
      if (u < 6.7) { // let go, land
        const H = hang(A, 0, 0), e = seg(u, 6.25, 6.7), fall = e * e;
        return { p: SM.mix(H.p, POSE.land, sm(0.1, 1, e)), rx: lerp(H.rx, A - 3, e), ry: lerp(H.ry, GY, fall), dir: 1 };
      }
      const e = sm(6.7, 7.15, u), p = SM.mix(POSE.land, P.stand, e);
      if (u > 7.0) { p.arm[0][0] += 18 * Math.sin((u - 7) * 30) * (1 - seg(u, 7.0, 7.6)); p.arm[1][0] -= 14 * Math.sin((u - 7) * 30 + 1) * (1 - seg(u, 7.0, 7.6)); }
      return { p, rx: A - 3, ry: GY, dir: 1 };
    },
  });

  /* --- 2. skipping rope (seen from the front: the rope is an arc from hand to hand
     that swings over his head, down in front, under his feet, and up behind) */
  const SKIP = { t0: 0.8, t1: 6.0, hz: 1.45 };
  const ropeAngle = (u) => TAU * SKIP.hz * (u - SKIP.t0) - 0.5 * Math.PI; // 0 = over his head, π = under his feet
  const SKIPF = { h: 37.5, lean: 0, nk: 0, look: 1, arm: [[34, 84], [-34, -84]], leg: [[6, 2, 70], [-6, -2, -70]] };
  function rope(m, J, front) {
    if (!m.props || m.props.rope == null) return;
    const th = m.props.th, inFront = Math.sin(th) > 0;
    if (inFront !== front) return;
    const hR = D.inv(J.arms[0][2]), hL = D.inv(J.arms[1][2]), mid = [(hR[0] + hL[0]) / 2, (hR[1] + hL[1]) / 2];
    const head = D.inv(J.head), top = head[1] - 15, bot = m.ry + 1.5, c = Math.cos(th);
    const apex = c > 0 ? lerp(mid[1], top, c) : lerp(mid[1], bot, -c), cp = [mid[0], 2 * apex - mid[1]];
    const pts = [];
    for (let i = 0; i <= 16; i++) { const s = i / 16; pts.push([(1 - s) * (1 - s) * hL[0] + 2 * (1 - s) * s * cp[0] + s * s * hR[0], (1 - s) * (1 - s) * hL[1] + 2 * (1 - s) * s * cp[1] + s * s * hR[1]]); }
    D.ln(pts, 1.0, (front ? 0.92 : 0.45) * m.props.rope);
    if (front) for (const h of [hL, hR]) D.ln([[h[0], h[1] - 1.8], [h[0], h[1] + 1.8]], 2.2, 0.9); // the handles
  }
  ACTS.push({
    name: "skipping", run: 320, dur: 6.6, dxEnd: 0,
    scenery() {},
    man(u, A) {
      if (u < 0.35) return { p: SM.mix(runPose(A), P.stand, sm(0, 0.35, u)), rx: A, ry: GY, dir: 1 };
      if (u < SKIP.t0) { // turn to face us, rope out of the bag
        const k = seg(u, 0.35, SKIP.t0), p = k < 0.5 ? SM.mix(P.stand, P.reachBag, sm(0, 0.5, k)) : SM.mix(P.reachBag, SKIPF, sm(0.5, 1, k));
        return { p, rx: A, ry: GY, dir: 1, props: { rope: sm(0.6, 1, k), th: ropeAngle(SKIP.t0) } };
      }
      if (u < SKIP.t1) {
        const th = ropeAngle(u), d = Math.atan2(Math.sin(th - Math.PI), Math.cos(th - Math.PI)), hop = 6.5 * Math.exp(-((d / 0.7) ** 2));
        const p = SM.clone(SKIPF), w = Math.sin(th);
        p.arm[0][1] += 14 * w; p.arm[1][1] -= 14 * w; p.arm[0][0] += 4 * w; p.arm[1][0] -= 4 * w; // the wrists turn the rope
        const land = 1 - hop / 6.5; p.h -= 2.4 * land * land; p.leg[0][1] -= 12 * land * land; p.leg[1][1] += 12 * land * land;
        return { p, rx: A, ry: GY - hop, dir: 1, props: { rope: 1, th } };
      }
      const k = seg(u, SKIP.t1, 6.6), p = k < 0.5 ? SM.mix(SKIPF, P.reachBag, sm(0, 0.5, k)) : SM.mix(P.reachBag, P.stand, sm(0.5, 1, k));
      return { p, rx: A, ry: GY, dir: 1, props: { rope: 1 - sm(0, 0.5, k), th: ropeAngle(SKIP.t1) } };
    },
    back(A, u, m, J) { rope(m, J, false); },
    extra(A, u, m, J) { rope(m, J, true); },
  });

  /* --- 3. reading on a rock under a pine ---------------------------------- */
  const BOOK = { open: 1.45, close: 6.5, turns: [2.9, 4.7] };
  ACTS.push({
    name: "reading", run: 320, dur: 7.6, dxEnd: 15,
    scenery(A) {
      const r = A + 12; // the rock, just ahead of where he stops
      D.poly([[r - 9, GY], [r - 9, GY - 6], [r - 5, GY - 11.5], [r + 3, GY - 15], [r + 12, GY - 14], [r + 19, GY - 8], [r + 21, GY]], 1.5, 0.85, true);
      D.ln([[r - 2, GY - 8], [r + 6, GY - 10]], 0.9, 0.3); D.ln([[r + 9, GY - 5], [r + 15, GY - 6]], 0.9, 0.25);
      const tx = A + 58, a = 0.6; // the pine
      D.ln([[tx, GY], [tx, GY - 40]], 1.5, a);
      for (const [y, w] of [[GY - 78, 10], [GY - 62, 15], [GY - 46, 20]]) D.ln([[tx - w, y + 18], [tx, y], [tx + w, y + 18], [tx - w, y + 18]], 1.3, a);
    },
    man(u, A) {
      if (u < 0.35) return { p: SM.mix(runPose(A), P.stand, sm(0, 0.35, u)), rx: A, ry: GY, dir: 1 };
      if (u < 1.0) { const e = sm(0.35, 1.0, u); return { p: SM.mix(P.stand, POSE.sit, e), rx: lerp(A, A + 15, e), ry: GY, dir: 1 }; } // a step up onto the rock
      const p = SM.clone(POSE.sit), rx = A + 15, ry = GY;
      if (u < BOOK.open) { // reach back into the bag for the book
        const k = Math.sin(Math.PI * seg(u, 1.0, BOOK.open)); p.arm[0] = [lerp(40, -50, k), lerp(100, 10, k)]; return { p, rx, ry, dir: 1 };
      }
      if (u < BOOK.close + 0.5) {
        p.nk = 24 + 3 * Math.sin(u * 1.3);
        const L0 = SM.local(p), hold = [L0.sh[0] + 13, L0.sh[1] + 10];
        SM.reach(p, "arm", 0, [hold[0] + 1.5, hold[1]], -1); SM.reach(p, "arm", 1, [hold[0] - 0.5, hold[1] + 1], -1);
        return { p, rx, ry, dir: 1, props: { book: u < BOOK.close ? 1 : 1 - seg(u, BOOK.close, BOOK.close + 0.3) } };
      }
      if (u < 7.0) { const k = Math.sin(Math.PI * seg(u, BOOK.close + 0.5, 7.0)); p.arm[0] = [lerp(40, -50, k), lerp(100, 10, k)]; return { p, rx, ry, dir: 1 }; }
      const e = sm(7.0, 7.6, u); return { p: SM.mix(POSE.sit, P.stand, e), rx, ry, dir: 1 };
    },
    extra(A, u, m, J) {
      const o = m.props && m.props.book; if (!o) return;
      const a = D.inv(J.arms[0][2]), b = D.inv(J.arms[1][2]), s = [(a[0] + b[0]) / 2 + 1, (a[1] + b[1]) / 2 - 1.5]; // spine of the book
      const w = 7 * o, h = 5;
      D.ln([[s[0] - w, s[1] - h * 0.6], [s[0] - w * 0.15, s[1] - 0.6], [s[0], s[1]]], 1.1, 0.95);       // left page
      D.ln([[s[0] + w, s[1] - h * 0.6], [s[0] + w * 0.15, s[1] - 0.6], [s[0], s[1]]], 1.1, 0.95);       // right page
      D.ln([[s[0] - w, s[1] - h * 0.6], [s[0] - w, s[1] + 1.6], [s[0], s[1] + 2.4], [s[0] + w, s[1] + 1.6], [s[0] + w, s[1] - h * 0.6]], 1.0, 0.7);
      for (const t0 of BOOK.turns) { // a page turning over, right to left
        const k = seg(u, t0, t0 + 0.5); if (k <= 0 || k >= 1) continue;
        const ang = Math.PI * Ease.inOut(k), ex = s[0] + w * Math.cos(ang), ey = s[1] - h * 0.6 - 4 * Math.sin(ang);
        D.ln([[s[0], s[1]], [lerp(s[0], ex, 0.5), lerp(s[1], ey, 0.5) - 1.5 * Math.sin(ang)], [ex, ey]], 1.0, 0.85);
      }
    },
  });

  /* --- 4. the leopard: darted, collared, released ------------------------- */
  const LEO = { x0: 300, xs: 125, walkEnd: 3.0, hit: 3.6, lie: 5.2, wake: 9.6, run: 10.7 };
  const rig = new Rig();
  function leopardState(u, A) {
    const Lp = C.leopard;
    if (u < LEO.walkEnd) { const d = (LEO.x0 - LEO.xs) * seg(u, 0, LEO.walkEnd), ph = d / 46; return { x: A + LEO.x0 - d, dir: -1, P: Lp.pose("walk", ph), Q: Lp.pose("walk", ph + 0.5) }; }
    if (u < LEO.wake) {
      const st = Lp.pose("stand"), cr = Lp.pose("crouch"), li = Lp.pose("lie"), w = Lp.pose("walk", (LEO.x0 - LEO.xs) / 46);
      let P0 = u < LEO.hit ? SM.mix(w, st, sm(LEO.walkEnd, LEO.walkEnd + 0.3, u)) : u < LEO.hit + 0.5 ? SM.mix(st, cr, sm(LEO.hit + 0.15, LEO.hit + 0.5, u)) : SM.mix(cr, li, sm(LEO.hit + 0.5, LEO.lie, u));
      if (u > LEO.hit && u < LEO.hit + 0.4) P0.hd -= 18 * Math.sin((u - LEO.hit) / 0.4 * Math.PI);
      if (u > LEO.lie) { P0.h += 0.5 * Math.sin(u * 2.2); P0.tc += 4 * Math.sin(u * 0.9); }
      return { x: A + LEO.xs, dir: -1, P: P0, Q: { ...P0, fu: P0.fu + 8, th: P0.th + 6 }, sleep: u > LEO.lie && u < LEO.wake - 0.2 };
    }
    if (u < LEO.run) {
      const li = Lp.pose("lie"), cr = Lp.pose("crouch"), st = Lp.pose("stand");
      const P0 = u < LEO.wake + 0.6 ? SM.mix(li, cr, sm(LEO.wake, LEO.wake + 0.6, u)) : SM.mix(cr, st, sm(LEO.wake + 0.6, LEO.wake + 0.9, u));
      if (u > LEO.wake + 0.8) P0.hd += 14 * Math.sin((u - LEO.wake - 0.8) * 9) * (1 - sm(LEO.run - 0.4, LEO.run, u));
      return { x: A + LEO.xs, dir: -1, P: P0, Q: { ...P0, fu: P0.fu + 8, th: P0.th + 6 } };
    }
    const d = 430 * (u - LEO.run), ph = (u - LEO.run) / 0.42; // bounds away, back past him into the trees
    return { x: A + LEO.xs - d, dir: -1, P: Lp.pose("gallop", ph), Q: Lp.pose("gallop", ph + 0.08) };
  }
  ACTS.push({
    name: "leopard", run: 300, dur: 12.6, dxEnd: 45,
    scenery() {},
    man(u, A) {
      const st = P.stand;
      if (u < 0.4) return { p: SM.mix(runPose(A), st, sm(0, 0.4, u)), rx: A, ry: GY, dir: 1 };
      if (u < 1.1) { const p = SM.clone(st); p.nk = -6; return { p, rx: A, ry: GY, dir: 1 }; }
      if (u < 1.5) return { p: SM.clone(P.reachBag), rx: A, ry: GY, dir: 1 };
      if (u < 4.2) { // kneel, aim, fire
        const k = sm(1.5, 1.9, u) * (1 - sm(3.9, 4.2, u)), p = SM.mix(st, P.dart, k), L0 = SM.local(p);
        const stock = [L0.sh[0] - 1, L0.sh[1] + 3.5], along = (d) => [stock[0] + d, stock[1] - d * 0.03];
        SM.reach(p, "arm", 0, along(25), -1); SM.reach(p, "arm", 1, along(7), -1);
        if (u > 3.3) p.lean -= 4 * Math.exp(-(u - 3.3) * 12);
        return { p, rx: A, ry: GY, dir: 1, props: { rifle: k > 0.5 ? along : null } };
      }
      if (u < 4.9) { const x = lerp(A, A + 88, sm(4.2, 4.9, u)); return { p: runPose(x - A), rx: x, ry: GY, dir: 1 }; }
      if (u < 5.2) return { p: SM.clone(P.reachBag), rx: A + 88, ry: GY, dir: 1, props: { collarInHand: true } };
      if (u < 8.2) { // kneel and fit the collar
        const k = sm(5.2, 5.6, u) * (1 - sm(7.8, 8.2, u)), p = SM.mix(st, P.collar, k);
        p.arm[0][1] += 10 * Math.sin(u * 7) * k; p.arm[1][1] -= 8 * Math.sin(u * 7 + 1) * k;
        return { p, rx: A + 88, ry: GY, dir: 1, props: { collarInHand: u < 6.4 } };
      }
      if (u < 8.8) { const x = lerp(A + 88, A + 45, sm(8.2, 8.8, u)); return { p: runPose(A + 88 - x), rx: x, ry: GY, dir: -1 }; }
      if (u < 10.7) return { p: SM.clone(P.standFront), rx: A + 45, ry: GY, dir: 1 };
      if (u < 12.1) { const p = SM.clone(POSE.wave), w = Math.sin((u - 10.7) * 9); p.arm[0][0] += 16 * w; p.arm[0][1] += 22 * w; return { p, rx: A + 45, ry: GY, dir: 1 }; }
      return { p: SM.mix(P.standFront, P.stand, sm(12.1, 12.6, u)), rx: A + 45, ry: GY, dir: 1 };
    },
    back(A, u) { // the leopard: behind the man (when he kneels at its head, and when it bounds past him)
      const lp = leopardState(u, A);
      rig.begin(new M2().translate(D.X(lp.x), D.Y(GY)).scale(lp.dir * LS * D.k, LS * D.k));
      C.leopard.draw(rig, lp.P, lp.Q, u);
      drawOutline(D.ctx, rig, { width: Math.max(1, 1.15 * D.k), color: `rgb(${INK})`, bg: BG, occlude: 0.95, far: 0.45, grain: D.grain, grainA: 0.45, alpha: 1 });
      const part = (sh) => rig.parts.find((p) => p.shape === C.leopard.shapes[sh]);
      if (u > LEO.hit && u < 6.0) { const hp = part("hind"); if (hp) { const a = hp.m.apply(-20, -10), b = hp.m.apply(-20 + 7, -10 - 9); D.lnS([a, b], 1.3, 0.9); } } // the dart
      if (u > 6.4) { const nk = part("neck"); if (nk) collarOn(nk.m, u); }
      if (lp.sleep) { const hd = part("head"); if (hd) { const q = hd.m.apply(4, -18); for (let k = 0; k < 3; k++) { const ph = fract(u * 0.5 + k / 3); D.ctx.fillStyle = `rgba(${INK},${0.75 * (1 - ph)})`; D.ctx.font = `italic ${(7 + 5 * ph) * D.k}px 'WQ Serif', 'Latin Modern Roman', serif`; D.ctx.fillText("z", q[0] - (8 + 10 * ph + k) * D.k, q[1] - (6 + 20 * ph) * D.k); } } }
    },
    extra(A, u, m, J) {
      const pr = m.props || {};
      if (pr.rifle) {
        const M = D.rootM(m.rx, m.ry, m.dir), g = (q) => D.inv(M.apply(q[0], q[1]));
        const st = g(pr.rifle(-5)), mz = g(pr.rifle(38)), sc = g(pr.rifle(16));
        D.ln([st, mz], 1.8, 0.95); D.ln([st, [st[0] + 4, st[1] + 3]], 2.6, 0.9); D.ln([[sc[0] - 3, sc[1] - 3], [sc[0] + 3, sc[1] - 3]], 2, 0.9);
        if (u > 3.3 && u < 3.62) { const k = (u - 3.3) / 0.32, tx = A + LEO.xs + 20, ty = GY - 17, x = lerp(mz[0], tx, k), y = lerp(mz[1], ty, k) - 5 * Math.sin(Math.PI * k); D.ln([[x, y], [x + 7, y - 0.5]], 1.3, 1); }
        if (u > 3.3 && u < 3.42) { D.ctx.fillStyle = `rgba(${INK},0.6)`; D.ctx.beginPath(); D.ctx.arc(D.X(mz[0] + 3), D.Y(mz[1]), 3.5 * D.k, 0, TAU); D.ctx.fill(); }
      }
      if (pr.collarInHand) collarInHand(J.arms[0][2], m.dir);
    },
  });
  // the GPS collar round the leopard's neck (drawn in the neck's own frame, as on the home page)
  const COL = { x: 2.5, w: 6, bulge: 5.5, box: [11, 8] };
  function collarOn(m, t) {
    const ctx = D.ctx, k = m.sx, r = 16 - (1.5 * COL.x) / 12, y0 = -r - 1.4, y1 = r + 0.6, ym = (y0 + y1) / 2, ry = (y1 - y0) / 2;
    const edge = (dx, i0 = 0, i1 = 18) => { const p = []; for (let i = i0; i <= i1; i++) { const a = -Math.PI / 2 + (Math.PI * i) / 18; p.push([COL.x + dx - COL.bulge * Math.cos(a), ym + ry * Math.sin(a)]); } return p; };
    const path = (pts) => pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.save(); ctx.transform(m.a, m.b, m.c, m.d, m.e, m.f);
    ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.fillStyle = BG; ctx.strokeStyle = `rgba(${INK},0.95)`;
    ctx.beginPath(); path([...edge(0), ...edge(COL.w).reverse()]); ctx.closePath(); ctx.fill(); ctx.lineWidth = (1.1 * D.k) / k; ctx.stroke();
    const [bw, bh] = COL.box, bx = COL.x + COL.w / 2;
    ctx.beginPath(); ctx.roundRect(bx - bw / 2, y1 - 1.6, bw, bh, 2); ctx.fill(); ctx.stroke();
    if (fract(t * 1.2) < 0.25) { ctx.fillStyle = `rgba(${INK},1)`; ctx.beginPath(); ctx.arc(bx + bw / 2 - 2.6, y1 + 3.9, 1.4, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  function collarInHand(h, dir) {
    const ctx = D.ctx, rm = 4.6 * D.k, hw = 1.0 * D.k, cx = h[0], cy = h[1] + rm, g = dir < 0 ? Math.PI : 0, gap = 0.62;
    ctx.save(); ctx.fillStyle = BG; ctx.strokeStyle = `rgba(${INK},0.95)`; ctx.lineWidth = Math.max(0.9, 1.0 * D.k);
    ctx.beginPath(); ctx.arc(cx, cy, rm + hw, g + gap, g + TAU - gap); ctx.arc(cx, cy, rm - hw, g + TAU - gap, g + gap, true); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.roundRect(cx - 2.6 * D.k, cy + rm - D.k, 5.2 * D.k, 3.6 * D.k, D.k); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  /* --- 5. ice boulder, dance, dive, swim, out ------------------------------ */
  const ICE = { face: 16, top: 70, lip: 18, edge: 108, wy: 108, lake1: 112, lake2: 330, bank: 342 };
  const CL = { t0: 1.4, t1: 5.4, moves: 4 };
  function climb(u, A) { // hip and limbs on the boulder's face
    const face = A + ICE.face, k = seg(u, CL.t0, CL.t1) * CL.moves, m = Math.min(CL.moves - 1, Math.floor(k)), f = Math.min(1, k - m);
    const hip0 = GY - 38 * MS, hip1 = ICE.top - 4;
    const hipAt = (j) => lerp(hip0, hip1, j / CL.moves), hy = lerp(hipAt(m), hipAt(m + 1), Ease.inOut(clamp((f - 0.35) / 0.5, 0, 1)));
    const p = SM.clone(P.climb); p.lean = -6; p.nk = -16; p.h = 36;
    const rx = face - 12, ry = hy + p.h * MS;
    const pick = (i) => { const up = (j) => hipAt(j + 1) - 27, init = hip0 - (i ? 24 : 30); let y, w = 1;
      if (m % 2 === i) { w = clamp(f / 0.4, 0, 1); y = lerp(m >= 2 ? up(m - 2) : init, up(m), Ease.inOut(w)); } else y = m >= 1 ? up(m - 1) : init;
      return [face - 0.5 - 6 * Math.sin(Math.PI * w) * (w < 1 ? 1 : 0), Math.max(ICE.top + 3, y)]; };
    const foot = (i) => { const at = (j) => hipAt(j + 1) + 20 + (i ? 5 : 0), init = GY - (i ? 2 : 6); let y, w = 1;
      if ((m + 1) % 2 === i) { w = clamp((f - 0.55) / 0.4, 0, 1); y = lerp(m >= 2 ? at(m - 2) : init, at(m), Ease.inOut(w)); } else y = m >= 1 ? at(m - 1) : init;
      return [face - 1 - 3 * Math.sin(Math.PI * w) * (w < 1 ? 1 : 0), Math.min(GY, y)]; };
    const kA = pick(0), kB = pick(1), grip = (kp) => [kp[0] - 6, kp[1] + 9];
    SM.reach(p, "arm", 0, D.toFig(grip(kA), rx, ry, 1), 1); SM.reach(p, "arm", 1, D.toFig(grip(kB), rx, ry, 1), 1);
    for (const i of [0, 1]) { SM.reach(p, "leg", i, D.toFig(foot(i), rx, ry, 1), 1); p.leg[i][2] = p.leg[i][1] + 75; }
    return { p, rx, ry, dir: 1, props: { axes: [[grip(kA), kA], [grip(kB), kB]] } };
  }
  ACTS.push({
    name: "ice", run: 320, dur: 18.4, dxEnd: ICE.bank,
    gap: [ICE.lake1, ICE.lake2],
    scenery(A, u) {
      const f = A + ICE.face, top = ICE.top, e = A + ICE.edge;
      // a serac: a block of ice with a slightly lumpy top (he walks on it, so only a little), streaks down
      // the face he climbs, cracks, and icicles where it drops into the lake
      const topLine = [[A + ICE.lip, top], [A + 27, top - 0.8], [A + 40, top - 0.2], [A + 52, top - 0.9], [A + 64, top - 0.3], [A + 80, top - 0.9], [A + 94, top - 0.2], [e, top]];
      D.fill([[f, GY], [f - 1.5, GY - 12], [f + 1, GY - 24], ...topLine, [e + 2.5, ICE.wy + 12], [f, ICE.wy + 12]]);
      D.ln([[f, GY], [f - 1.5, GY - 12], [f + 1, GY - 24], [A + ICE.lip, top]], 1.7, 0.9);
      D.ln(topLine, 1.6, 0.9);
      D.ln([[e, top], [e + 1.5, top + 14], [e + 0.5, top + 26], [e + 2.5, ICE.wy]], 1.6, 0.85);
      for (let i = 0; i < 4; i++) D.ln([[f + 4 + i * 1.6, GY - 3], [f + 3 + i * 1.8, GY - 22 - i * 3]], 0.8, 0.25); // ice streaks
      D.ln([[A + 38, top + 7], [A + 45, top + 12], [A + 43, top + 20]], 0.8, 0.22); D.ln([[A + 76, top + 5], [A + 71, top + 15]], 0.8, 0.2); // cracks
      for (const [x, y, l] of [[e + 0.6, top + 1.5, 7], [e - 2.6, top + 1, 4.5], [e + 1.8, top + 15, 5.5], [e + 1, top + 27, 4]]) D.ln([[x - 0.9, y], [x + 0.2, y + l], [x + 1.1, y]], 0.9, 0.6); // icicles
      // the lake: water from the boulder to the far bank, which climbs back to the ground
      const x0 = A + ICE.lake1 - 4, x1 = A + ICE.lake2, t = D.t;
      const wave = (y0, amp, a, w) => { const pts = []; for (let x = x0; x <= x1; x += 3) pts.push([x, y0 + amp * Math.sin(x * 0.2 + t * 2.4)]); D.ln(pts, w, a); };
      wave(ICE.wy, 1.1, 0.6, 1.2); wave(ICE.wy + 6, 0.8, 0.22, 1); wave(ICE.wy + 11, 0.6, 0.12, 1);
      D.ln([[x1 - 2, ICE.wy + 10], [x1 + 4, ICE.wy + 2], [A + ICE.bank, GY], [A + ICE.bank + 6, GY]], 1.5, 0.85);
    },
    man(u, A) {
      const f = A + ICE.face;
      if (u < 0.4) return { p: SM.mix(runPose(A), P.stand, sm(0, 0.4, u)), rx: A, ry: GY, dir: 1 };
      if (u < 0.8) return { p: SM.clone(P.reachBag), rx: A, ry: GY, dir: 1 };
      if (u < CL.t0) { const p = SM.clone(P.axes); p.nk = 14 * Math.sin((u - 0.8) * 3); return { p, rx: A + 1, ry: GY, dir: 1, props: { axesV: true } }; }
      if (u < CL.t1) {
        const c = climb(u, A);
        if (u < CL.t0 + 0.3) { const e = sm(CL.t0, CL.t0 + 0.3, u); c.p = SM.mix(P.axes, c.p, e); c.rx = lerp(A + 1, c.rx, e); c.ry = lerp(GY, c.ry, e); }
        return c;
      }
      if (u < 6.2) { // mantle over the top
        const e = seg(u, CL.t1, 6.2), A0 = climb(CL.t1 - 0.001, A), lip = [A + ICE.lip, ICE.top];
        const hipA = [A0.rx, A0.ry - A0.p.h * MS], hipB = [lip[0] + 2, ICE.top - 30], hipC = [A + 30, ICE.top - 38 * MS];
        const hip = e < 0.5 ? [lerp(hipA[0], hipB[0], Ease.inOut(e / 0.5)), lerp(hipA[1], hipB[1], Ease.inOut(e / 0.5))] : [lerp(hipB[0], hipC[0], Ease.inOut((e - 0.5) / 0.5)), lerp(hipB[1], hipC[1], Ease.inOut((e - 0.5) / 0.5))];
        const p = SM.mix(A0.p, P.stand, sm(0.45, 1, e)); p.lean = e < 0.5 ? lerp(-6, 34, Ease.inOut(e / 0.5)) : lerp(34, 2, Ease.inOut((e - 0.5) / 0.5));
        const rx = hip[0], ry = hip[1] + p.h * MS;
        if (e < 0.7) { SM.reach(p, "arm", 0, D.toFig([lip[0] + 6, ICE.top], rx, ry, 1), 1); SM.reach(p, "arm", 1, D.toFig([lip[0] + 2, ICE.top], rx, ry, 1), 1); }
        return { p, rx, ry, dir: 1, props: { axes: e < 0.35 ? A0.props.axes : null } };
      }
      if (u < 6.6) { const x = lerp(A + 30, A + 58, sm(6.2, 6.6, u)); const p = runPose(x - A); p.lean = 6; return { p, rx: x, ry: ICE.top, dir: 1 }; }
      if (u < 11.0) return { p: SM.dance(u - 6.6), rx: A + 58, ry: ICE.top, dir: 1 };
      if (u < 11.4) { const x = lerp(A + 58, A + ICE.edge - 4, sm(11.0, 11.4, u)); return { p: runPose(x - A), rx: x, ry: ICE.top, dir: 1 }; }
      if (u < 12.4) { // the dive
        const e = seg(u, 11.4, 12.4), hx = lerp(A + ICE.edge - 4, A + 168, e), hy0 = ICE.top - 38 * MS, hy = hy0 - 26 * e * (1 - e) * 1.2 + (ICE.wy + 6 - hy0) * e * e;
        const p = SM.mix(P.stand, P.dive, sm(0, 0.35, e)); p.lean = lerp(14, 172, Ease.inOut(e));
        return { p, rx: hx, ry: hy + p.h * MS, dir: 1, water: true };
      }
      if (u < 12.9) return { p: SM.clone(POSE.swim), rx: A + 172, ry: ICE.wy + 8 + 38 * MS, dir: 1, alpha: 0, water: true }; // under water
      if (u < 17.0) { // swimming across
        const e = seg(u, 12.9, 17.0), x = lerp(A + 176, A + ICE.lake2 - 14, e), ph = (u - 12.9) * 0.95, p = SM.clone(POSE.swim);
        for (const i of [0, 1]) { const a = 90 - 360 * fract(ph + i * 0.5); p.arm[i] = [a, a - 14 * Math.sin(TAU * (ph + i * 0.5))]; }
        for (const i of [0, 1]) { const th = -90 + 9 * Math.sin(TAU * ph * 3 + i * Math.PI); p.leg[i] = [th, th - 6, -102]; }
        p.nk = -24 + 10 * Math.sin(TAU * ph);
        const hipY = ICE.wy + 3 + 0.8 * Math.sin(TAU * ph * 2);
        return { p, rx: x, ry: hipY + p.h * MS, dir: 1, water: true, alpha: sm(12.9, 13.2, u) };
      }
      if (u < 17.9) { // up the far bank
        const e = seg(u, 17.0, 17.9), sw = SM.clone(POSE.swim), p = e < 0.5 ? SM.mix(sw, POSE.crouch, sm(0, 0.5, e)) : SM.mix(POSE.crouch, P.stand, sm(0.5, 1, e));
        const hip0 = [A + ICE.lake2 - 14, ICE.wy + 3], hip1 = [A + ICE.bank, GY - 38 * MS], hx = lerp(hip0[0], hip1[0], Ease.inOut(e)), hy = lerp(hip0[1], hip1[1], Ease.inOut(e)) - 4 * Math.sin(Math.PI * e);
        return { p, rx: hx, ry: hy + p.h * MS, dir: 1, water: e < 0.6 };
      }
      const p = SM.clone(P.stand), w = 1 - seg(u, 17.9, 18.4); p.lean += 9 * Math.sin((u - 17.9) * 40) * w; p.nk = 10 * Math.sin((u - 17.9) * 34) * w;
      return { p, rx: A + ICE.bank, ry: GY, dir: 1, drip: w };
    },
    extra(A, u, m, J) {
      const pr = m && m.props || {};
      if (pr.axesV) for (const [i, tilt, pd] of [[0, 0.32, 1], [1, -0.32, -1]]) { const h = D.inv(J.arms[i][2]), top = [h[0] + Math.sin(tilt) * 15, h[1] - Math.cos(tilt) * 15]; D.ln([[h[0] - Math.sin(tilt) * 2, h[1] + Math.cos(tilt) * 2], top], 1.6, 0.95); D.ln([top, [top[0] + pd * 5, top[1] + 2.5]], 1.6, 0.95); D.ln([top, [top[0] - pd * 2.5, top[1] - 0.5]], 1.9, 0.9); }
      if (pr.axes) for (const [g, k] of pr.axes) axe(g, k);
      if (u > 12.35 && u < 13.6) { // splash: rings and drops
        const e = (u - 12.35) / 1.25, x = A + 170;
        for (let r = 1; r <= 3; r++) { const rr = (5 + 30 * e) * (0.5 + r * 0.25); D.ctx.beginPath(); D.ctx.ellipse(D.X(x), D.Y(ICE.wy + 1), rr * D.k, rr * 0.22 * D.k, 0, 0, TAU); D.ctx.strokeStyle = `rgba(${INK},${0.55 * (1 - e) / r})`; D.ctx.lineWidth = D.k; D.ctx.stroke(); }
        const rr = mulberry32(5); D.ctx.fillStyle = `rgba(${INK},${0.8 * (1 - e)})`;
        for (let i = 0; i < 14; i++) { const vx = (rr() - 0.5) * 50, vy = 40 + rr() * 50, tt = e * 0.9, dx = x + vx * tt, dy = ICE.wy - vy * tt + 90 * tt * tt; if (dy < ICE.wy + 1) D.ctx.fillRect(D.X(dx), D.Y(dy), 1.6 * D.k, 1.6 * D.k); }
      }
      if (m && m.drip > 0) { const h = D.inv(J.hip), rr = mulberry32(9); D.ctx.fillStyle = `rgba(${INK},${0.7 * m.drip})`; for (let i = 0; i < 6; i++) { const x = h[0] + (rr() - 0.5) * 10, y = h[1] + fract(rr() + u * 1.7) * 26; D.ctx.fillRect(D.X(x), D.Y(y), 1.2 * D.k, 1.6 * D.k); } }
    },
  });
  function axe(grip, pick) { // handle from the grip to the pick (planted at `pick`)
    D.ln([grip, pick], 1.5, 0.95);
    const dx = pick[0] - grip[0], dy = pick[1] - grip[1], d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d, px = -uy, py = ux;
    D.ln([pick, [pick[0] + px * 3.5 - ux, pick[1] + py * 3.5 - uy], [pick[0] + px * 6 - ux * 3, pick[1] + py * 6 - uy * 3]], 1.6, 0.95);
    D.ln([pick, [pick[0] - px * 3, pick[1] - py * 3]], 2, 0.9);
  }

  /* ------------------------------------------------------------------ the loop's timeline */
  const TL = []; let LOOP = 0, LEN = 0;
  (function build() {
    let t = 0, x = 0;
    for (const a of ACTS) {
      const runT = a.run / V;
      TL.push({ kind: "run", t0: t, t1: t + runT, x0: x, x1: x + a.run });
      t += runT; x += a.run;
      TL.push({ kind: "act", act: a, t0: t, t1: t + a.dur, A: x, x1: x + a.dxEnd });
      t += a.dur; x += a.dxEnd;
    }
    LOOP = t; LEN = x;
  })();
  // where everything is at loop time t (+ how many loops have passed): the man, the camera
  function stateAt(tAll) {
    const n = Math.floor(tAll / LOOP), t = tAll - n * LOOP, off = n * LEN;
    for (let i = 0; i < TL.length; i++) {
      const s = TL[i];
      if (t >= s.t1 && i < TL.length - 1) continue;
      if (s.kind === "run") {
        const e = clamp((t - s.t0) / (s.t1 - s.t0), 0, 1), x = lerp(s.x0, s.x1, e) + off;
        let p = runPose(x);
        if (i > 0 && t - s.t0 < 0.2) p = SM.mix(P.stand, p, sm(0, 0.2, t - s.t0));
        return { n, t, off, seg: s, man: { p, rx: x, ry: GY, dir: 1 }, camX: x };
      }
      const u = t - s.t0, A = s.A + off, man = s.act.man(u, A);
      const camX = lerp(A, s.x1 + off, Ease.inOut(clamp(u / s.act.dur, 0, 1)));
      return { n, t, off, seg: s, u, A, man, camX };
    }
  }

  /* ------------------------------------------------------------------ drawing */
  function start() {
    const el = document.getElementById("strip"); if (!el) return;
    const cv = el.querySelector("canvas"), btn = el.querySelector(".strip__pause"), ctx = cv.getContext("2d");
    const qs = new URLSearchParams(G.location.search), capture = qs.get("capture") === "1";
    const mq = G.matchMedia ? G.matchMedia("(prefers-reduced-motion: reduce)") : null, still = (mq && mq.matches) || qs.get("still") === "1";
    let W = 0, H = 0, dpr = 1, k = 1, cam = 0, anchor = 160, tNow = 0, paused = false, last = 0;
    const grain = WQ.CH ? WQ.CH.grain() : null;
    try { paused = G.localStorage.getItem("wq-strip-paused") === "1"; } catch (e) { /* storage blocked */ }

    D = {
      ctx, grain, get k() { return k; }, get t() { return tNow; },
      X: (x) => (x - cam) * k, Y: (y) => y * k,
      inv: (s) => [s[0] / k + cam, s[1] / k],
      toFig: (pt, rx, ry, dir) => [(pt[0] - rx) / (dir * MS), (pt[1] - ry) / MS],
      rootM: (rx, ry, dir) => new M2().translate((rx - cam) * k, ry * k).scale(dir * MS * k, MS * k),
      ln(pts, w = 1.4, a = 0.85) { SM.line(ctx, pts.map(([x, y]) => [(x - cam) * k, y * k]), w * k, a, INK); },
      lnS(pts, w, a) { SM.line(ctx, pts, w * k, a, INK); },
      poly(pts, w, a, fill) { if (fill) D.fill(pts); D.ln(pts, w, a); },
      fill(pts) { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo((x - cam) * k, y * k) : ctx.moveTo((x - cam) * k, y * k))); ctx.closePath(); ctx.fillStyle = BG; ctx.fill(); },
    };

    function resize() {
      const r = cv.getBoundingClientRect();
      W = Math.max(1, r.width); H = Math.max(1, r.height); dpr = Math.min(2, G.devicePixelRatio || 1);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      k = H / HD; anchor = clamp(0.3 * (W / k), 110, 430);
    }
    function ground(x0, x1, gaps) {
      const inGap = (x) => gaps.some(([a, b]) => x > a && x < b);
      let run = [];
      const flush = () => { if (run.length > 1) D.ln(run, 1.3, 0.7); run = []; };
      for (let x = Math.floor(x0 / 6) * 6; x <= x1 + 6; x += 6) { if (inGap(x)) flush(); else run.push([x, GY]); }
      flush();
      for (let i = Math.floor(x0 / 37); i <= Math.ceil(x1 / 37); i++) { // tufts and pebbles at fixed places along the ground
        const r = mulberry32(i * 7919 + 13), a = r(), x = i * 37 + r() * 30;
        if (inGap(x - 4) || inGap(x + 4)) continue;
        if (a < 0.38) { const h = 3 + r() * 4; D.ln([[x, GY], [x - 1.2, GY - h]], 0.9, 0.38); D.ln([[x + 2, GY], [x + 3, GY - h * 0.7]], 0.9, 0.32); }
        else if (a < 0.5) { ctx.beginPath(); ctx.ellipse(D.X(x), D.Y(GY - 1), 2.4 * k, 1.3 * k, 0, 0, TAU); ctx.strokeStyle = `rgba(${INK},0.35)`; ctx.lineWidth = 0.9 * k; ctx.stroke(); }
      }
    }
    function ridge(x0, x1) { // far hills, moving slower than the ground
      const pts = [];
      for (let sx = 0; sx <= W / k + 8; sx += 8) { const xw = cam * 0.3 + sx; pts.push([sx + cam, 64 + 8 * Math.sin(xw * 0.011) + 5 * Math.sin(xw * 0.027 + 1.3) + 3 * Math.sin(xw * 0.061 + 0.4)]); }
      D.ln(pts, 1.1, 0.07);
    }
    function render(tAll) {
      tNow = tAll;
      const S = stateAt(tAll);
      let cx = 0, n = 0;
      for (let i = 0; i < 6; i++) { const q = i === 0 ? S : stateAt(Math.max(0, tAll - 0.1 * i)); if (q && q.man) { cx += q.man.rx; n++; } }
      cam = (n ? cx / n : S.camX) - anchor;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.lineCap = ctx.lineJoin = "round";
      const x0 = cam - 40, x1 = cam + W / k + 40;
      // every station near the view (this loop and its neighbours)
      const stations = [];
      for (let n = S.n - 1; n <= S.n + 1; n++) for (const s of TL) if (s.kind === "act") {
        const A = s.A + n * LEN; if (A + 420 < x0 || A - 120 > x1) continue;
        stations.push({ s, A, active: n === S.n && S.seg === s });
      }
      ridge(x0, x1);
      ground(x0, x1, stations.filter((o) => o.s.act.gap).map((o) => [o.A + o.s.act.gap[0], o.A + o.s.act.gap[1]]));
      for (const o of stations) o.s.act.scenery(o.A, o.active ? S.u : 0);
      const act = S.seg.kind === "act" ? S.seg.act : null, m = S.man;
      let J = m ? SM.joints(m.p, D.rootM(m.rx, m.ry, m.dir)) : null;
      if (act && act.back) act.back(S.A, S.u, m || {}, J);
      if (m && (m.alpha ?? 1) > 0.01) {
        const M = D.rootM(m.rx, m.ry, m.dir), opt = { width: Math.max(1.2, 1.5 * k), alpha: m.alpha ?? 1, frames: "rect" };
        if (m.water) { // under the water line he shows faintly
          const wy = D.Y(ICE.wy - 0.5);
          ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, wy); ctx.clip(); J = SM.draw(ctx, m.p, M, opt); ctx.restore();
          ctx.save(); ctx.beginPath(); ctx.rect(0, wy, W, H - wy); ctx.clip(); SM.draw(ctx, m.p, M, { ...opt, alpha: opt.alpha * 0.28 }); ctx.restore();
        } else J = SM.draw(ctx, m.p, M, opt);
      }
      if (act && act.extra && (J || !m)) act.extra(S.A, S.u, m || {}, J || { arms: [[0, 0, [0, 0]], [0, 0, [0, 0]]], hip: [0, 0] });
      // soft ends: the ground fades in and out at the edges of the screen
      const f = Math.min(60, W * 0.08);
      ctx.save(); ctx.globalCompositeOperation = "destination-out";
      let g = ctx.createLinearGradient(0, 0, f, 0); g.addColorStop(0, "rgba(0,0,0,1)"); g.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, f, H);
      g = ctx.createLinearGradient(W - f, 0, W, 0); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,1)"); ctx.fillStyle = g; ctx.fillRect(W - f, 0, f, H);
      ctx.restore();
    }
    function loop(now) {
      if (paused || still) return;
      G.requestAnimationFrame(loop);
      const dt = (now - last) / 1000; if (dt < 1 / 64) return;
      last = now; tNow += Math.min(dt, 0.05); render(tNow);
    }
    function setPaused(v) {
      paused = v;
      if (btn) {
        btn.setAttribute("aria-pressed", v ? "true" : "false");
        const label = v ? "Play the animation" : "Pause the animation"; btn.setAttribute("aria-label", label); btn.title = label;
        btn.innerHTML = v ? '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M4 2.5l7 4.5-7 4.5z" fill="currentColor"/></svg>'
          : '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M4 2.5v9M10 2.5v9" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" fill="none"/></svg>';
      }
      try { G.localStorage.setItem("wq-strip-paused", v ? "1" : "0"); } catch (e) { /* storage blocked */ }
      if (!v && !still && !capture) { last = performance.now(); G.requestAnimationFrame(loop); }
    }
    resize();
    const STILL_T = TL.find((s) => s.kind === "act" && s.act.name === "reading").t0 + 3.6;
    if (still) { tNow = STILL_T; render(tNow); }
    G.addEventListener("resize", () => { resize(); render(tNow); });
    if ("ResizeObserver" in G) new ResizeObserver(() => { resize(); render(tNow); }).observe(cv);
    if (btn) btn.addEventListener("click", () => setPaused(!paused));
    WQ.strip = { at(t) { render(t); return stateAt(t); }, LOOP, acts: TL.filter((s) => s.kind === "act").map((s) => [s.act.name, +s.t0.toFixed(2), +s.t1.toFixed(2)]) };
    if (capture) { render(0); return; }
    if (still) return;
    setPaused(paused);
    if (paused) render(tNow);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})(window);
