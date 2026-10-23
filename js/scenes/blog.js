/* =============================================================================
   Blogs — "the explorer"                                       (section 5)
   -----------------------------------------------------------------------------
   One 32-second loop on the plain blackboard:
     0.0  he writes Lotka–Volterra on the board (right side)
     3.6  a leopard walks out from behind the cliff
     5.2  he takes the dart rifle from his backpack, kneels, darts it
     6.8  the leopard staggers, lies down and sleeps (z z)
     7.2  he runs over, kneels and fits a GPS collar (LED blinks)
    11.6  he runs to the cobra-hood overhang cliff (left side)
    13.8  checks his two ice axes; drops the rope
    15.0  leads the climb — clips the rope to the wall as he goes, hangs under
          the hood, pulls over the lip onto the flat top
    20.0  (the leopard wakes, shakes its head and walks off with its collar)
    21.6  he dances (from the reference video)
    26.0  runs to the edge, dives into the water below
    27.6  the splash turns into chalk dust that flies back to the board and
          becomes him again — while a ghost eraser wipes the board → loop
   Design grid 960×540 (X(), Y() map to the screen; phones show it full width
   at the bottom). HOW TO EDIT: timeline constants T_*, positions in GEO,
   scales MS (man) and LS (leopard).
   ============================================================================= */
(function (G) {
  "use strict";
  const { L, C, SM } = G.WQ, VQ = G.WQ.CH, PTS = G.WQ.PTS;
(G.WQ.scenes = G.WQ.scenes || {}).blog = function (env0) {
  let env = env0;
  const { lerp, clamp, smooth, Ease, TAU, M2, Rig, mulberry32, drawOutline, fract } = L;
  const INK = "246,244,236", BG = "#0d0f0f", T = 32;
  const GY = 470, MS = 2.0, LS = 0.86, CX = 44; // CX: shifts the cliff/water to the right
  const GEO = {
    // cliff outline: right face (bottom→up), hood, flat top, left face (→ water)
    face: [[236, 470], [232, 444], [237, 416], [231, 388], [234, 360], [240, 334], [252, 310], [270, 288], [292, 270], [312, 254], [327, 239], [326, 224], [312, 211], [290, 202], [264, 196], [246, 193]],
    top: [[246, 193], [182, 192], [120, 193]],
    left: [[120, 193], [115, 232], [121, 272], [111, 320], [117, 370], [107, 424], [101, 484]],
    water: 484, board: [650, 236, 930, 420], waterX: 104 + CX,
    quick: [[239, 420], [236, 362], [251, 314], [284, 280], [318, 250]], quickU: [0.1, 0.27, 0.45, 0.62, 0.8],
    coil: [302, 466], anchor: [246, 194],
  };
  const sh = (pts) => pts.map(([x, y]) => [x + CX, y]);
  for (const k of ["face", "top", "left", "quick"]) GEO[k] = sh(GEO[k]); GEO.coil = [GEO.coil[0] + CX, GEO.coil[1]]; GEO.anchor = [GEO.anchor[0] + CX, GEO.anchor[1]];
  // climbing follows the real rock: arc length s along the right face (base → lip)
  const T_CLIMB = [15.0, 21.0], T_MANTLE = 20.1, T_DANCE = 21.6, T_DIVE = 26.0, T_SPLASH = 27.6;
  const LIP = 10, NMV = 9, SH0 = 66; // lip vertex index, number of climbing moves, start hip arc length

  let W, H, S, ox, oy, stage, rnd, grain, dust = [], drops = [];
  const rig = new Rig();
  const X = (x) => ox + x * S, Y = (y) => oy + y * S;

  // ------------------------------------------------------------ helpers
  function poly(pts) { const L0 = [0]; for (let i = 1; i < pts.length; i++) L0.push(L0[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return { pts, L: L0, tot: L0[L0.length - 1] }; }
  function at(P, u) { const s = clamp(u, 0, 1) * P.tot; let i = 1; while (i < P.L.length - 1 && P.L[i] < s) i++; const a = P.pts[i - 1], b = P.pts[i], f = (s - P.L[i - 1]) / (P.L[i] - P.L[i - 1] || 1); return [lerp(a[0], b[0], f), lerp(a[1], b[1], f)]; }
  const FACE = poly(GEO.face.slice(0, LIP + 2)), SH1 = FACE.L[LIP] - 34;
  const ptAt = (s) => at(FACE, s / FACE.tot);
  function wall(s) { // point, smoothed tangent (up the rock) and outward normal at arc length s
    const a = ptAt(s - 14), b = ptAt(s + 14), d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, tx = (b[0] - a[0]) / d, ty = (b[1] - a[1]) / d;
    return { p: ptAt(s), t: [tx, ty], n: [-ty, tx] };
  }
  const nearestS = (q) => { let best = 0, bd = 1e9; for (let s = 0; s <= FACE.tot; s += 2) { const p = ptAt(s), d = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2; if (d < bd) { bd = d; best = s; } } return best; };
  const QS = GEO.quick.map(nearestS); // arc length of each quickdraw
  const shAt = (m) => lerp(SH0, SH1, m / NMV);
  function climbState(t) {
    const k = clamp((t - T_CLIMB[0]) / (T_MANTLE - T_CLIMB[0]), 0, 1) * NMV, m = Math.min(NMV - 1, Math.floor(k)), f = Math.min(1, k - m);
    return { k, m, f, s: lerp(shAt(m), shAt(m + 1), Ease.inOut(clamp((f - 0.3) / 0.6, 0, 1))) };
  }
  function handS(i, m, f) { // hand i moves on moves with m%2 === i; the pick lands ~90 px above the hip
    const hs = (j) => shAt(j + 1) + 118, init = SH0 + (i === 0 ? 118 : 96);
    if (m % 2 === i) { const pv = m >= 2 ? hs(m - 2) : init, w = clamp(f / 0.4, 0, 1); return { s: lerp(pv, hs(m), Ease.inOut(w)), w }; }
    return { s: m >= 1 ? hs(m - 1) : init, w: 1 };
  }
  function footS(i, m, f) { // feet follow on the other beat
    const fs = (j) => shAt(j + 1) - 34 - (i ? 22 : 0), init = SH0 - 34 - (i ? 22 : 0);
    if ((m + 1) % 2 === i) { const pv = m >= 2 ? fs(m - 2) : init, w = clamp((f - 0.55) / 0.4, 0, 1); return { s: lerp(pv, fs(m), Ease.inOut(w)), w }; }
    return { s: m >= 1 ? fs(m - 1) : init, w: 1 };
  }
  // the climber at a wall arc length: hip off the rock, body between the rock line and vertical
  function climberAt(sHip) {
    const w0 = wall(sHip), off = lerp(25, 36, smooth(0.42, 0.72, sHip / FACE.tot)), hip = [w0.p[0] + w0.n[0] * off, w0.p[1] + w0.n[1] * off];
    const wt = wall(sHip + 34).t, bx = 0.6 * wt[0], by = 0.6 * wt[1] - 0.4, d = Math.hypot(bx, by);
    const lean = Math.atan2(-bx / d, -by / d) / L.DEG; // dir = -1 (facing the rock on his left)
    return { hip, lean };
  }
  const ln = (ctx, pts, w = 1.6, a = 0.85) => SM.line(ctx, pts.map(([x, y]) => [X(x), Y(y)]), w * S, a, INK);
  const sm = (a, b, t) => smooth(a, b, t);

  /* ------------------------------------------------------------ the man
     returns {pose, M, dir, props} for time t (design coords)             */
  const P = SM.POSES, clone = SM.clone;
  const rootM = (x, y, dir) => new M2().translate(X(x), Y(y)).scale(dir * MS * S, MS * S);
  const hipM = (hx, hy, dir, h) => rootM(hx, hy + h * MS, dir);
  const toFig = (pt, rx, ry, dir) => [(pt[0] - rx) / (dir * MS), (pt[1] - ry) / MS]; // design → figure frame (root-based)
  const runPose = (ph) => SM.cyc(SM.RUN, ph);


  function man(t) {
    const out = { props: {} };
    // ---- 1 writing (shuffles right along the board)
    if (t < 4.7) {
      const prog = sm(0.4, 4.2, t), rx = lerp(682, 748, prog), p = clone(P.write);
      const hx = 712 + 92 * prog + (t < 4.2 ? 0 : 0), hy = 330 + (t < 4.2 ? 18 * Math.sin(t * 11) * Math.sin(t * 2.1) : 22 + 10 * (t - 4.2));
      SM.reach(p, "arm", 0, toFig([hx, hy], rx, GY, 1), -1);
      p.leg[0][0] += 4 * Math.sin(t * 5); p.leg[1][0] -= 4 * Math.sin(t * 5);
      Object.assign(out, { p, rx, ry: GY, dir: 1 }); out.props.chalk = true; return out;
    }
    // ---- turn to face left
    if (t < 5.2) { const p = clone(t < 4.95 ? P.stand : P.standFront); Object.assign(out, { p, rx: 748, ry: GY, dir: t < 4.95 ? 1 : -1 }); return out; }
    // ---- reach into the bag for the dart rifle, kneel, aim, fire
    if (t < 7.0) {
      const rx = 748;
      if (t < 5.6) { Object.assign(out, { p: clone(P.reachBag), rx, ry: GY, dir: -1 }); return out; }
      const k = sm(5.6, 6.0, t), p = SM.mix(P.stand, P.dart, k), L0 = SM.local(p);
      const stock = [L0.sh[0] - 1, L0.sh[1] + 3.5], along = (d) => [stock[0] + d, stock[1] - d * 0.03];
      SM.reach(p, "arm", 0, along(25), -1); SM.reach(p, "arm", 1, along(7), -1);
      if (t > 6.5) p.lean -= 4 * Math.exp(-(t - 6.5) * 12); // recoil
      Object.assign(out, { p, rx, ry: GY, dir: -1 }); out.props.rifle = along; return out;
    }
    // ---- stand, run to the leopard
    if (t < 8.7) {
      const u = sm(7.2, 8.7, t), rx = lerp(748, 566, u);
      const p = t < 7.2 ? SM.mix(P.dart, P.stand, sm(7.0, 7.2, t)) : runPose((t - 7.2) / 0.5);
      Object.assign(out, { p, rx, ry: GY, dir: -1 }); return out;
    }
    // ---- bag → collar → kneel and fit it
    if (t < 11.6) {
      const rx = 566;
      if (t < 9.1) { Object.assign(out, { p: clone(P.reachBag), rx, ry: GY, dir: -1 }); return out; }
      const k = sm(9.1, 9.5, t) * (1 - sm(11.2, 11.6, t)), p = SM.mix(P.stand, P.collar, k);
      p.arm[0][1] += 10 * Math.sin(t * 7) * k; p.arm[1][1] -= 8 * Math.sin(t * 7 + 1) * k;
      Object.assign(out, { p, rx, ry: GY, dir: -1 }); out.props.collarInHand = t < 10.2; return out;
    }
    // ---- run to the cliff
    if (t < 13.4) { const u = sm(11.6, 13.4, t), rx = lerp(566, 282 + CX, u); Object.assign(out, { p: runPose((t - 11.6) / 0.5), rx, ry: GY, dir: -1 }); return out; }
    // ---- bag → ice axes, look at them; drop the rope
    if (t < 15.0) {
      if (t < 13.8) { Object.assign(out, { p: clone(P.reachBag), rx: 282 + CX, ry: GY, dir: -1 }); return out; }
      const p = clone(P.axes); p.nk = 14 * Math.sin((t - 13.8) * 2.4);
      Object.assign(out, { p, rx: 282 + CX, ry: GY, dir: 1 }); out.props.axesV = true; return out;
    }
    // ---- climb: lead with the axes, feet on the wall, hang under the hood
    if (t < T_MANTLE) {
      const c = climbState(t), cl = climberAt(c.s), dir = -1, p = clone(P.climb);
      p.lean = cl.lean; p.nk = -18; p.h = 38;
      const rx = cl.hip[0], ry = cl.hip[1] + p.h * MS;
      const J = SM.joints(p, new M2().translate(rx, ry).scale(dir * MS, MS)), shp = J.sh;
      const pick = (i) => { const h = handS(i, c.m, c.f), w0 = wall(h.s), lift = 22 * Math.sin(Math.PI * h.w) * (h.w < 1 ? 1 : 0); return [w0.p[0] + w0.n[0] * (2 + lift), w0.p[1] + w0.n[1] * (2 + lift)]; };
      const grip = (k) => { const v = [shp[0] - k[0], shp[1] - k[1]], d = Math.hypot(v[0], v[1]) || 1; return [k[0] + (v[0] / d) * 26, k[1] + (v[1] / d) * 26]; };
      const kA = pick(0), kB = pick(1), gA = grip(kA), gB = grip(kB);
      SM.reach(p, "arm", 0, toFig(gA, rx, ry, dir), 1); SM.reach(p, "arm", 1, toFig(gB, rx, ry, dir), 1);
      for (const i of [0, 1]) { const fh = footS(i, c.m, c.f), w0 = wall(fh.s), lift = 10 * Math.sin(Math.PI * fh.w) * (fh.w < 1 ? 1 : 0); SM.reach(p, "leg", i, toFig([w0.p[0] + w0.n[0] * (3 + lift), w0.p[1] + w0.n[1] * (3 + lift)], rx, ry, dir), 1); p.leg[i][2] = p.leg[i][1] + 75; }
      Object.assign(out, { p, rx, ry, dir }); out.props.axes = [[gA, kA], [gB, kB]]; out.props.harness = cl.hip; out.props.sHip = c.s; return out;
    }
    // ---- mantle over the lip onto the flat top
    if (t < T_CLIMB[1]) {
      const u = clamp((t - T_MANTLE) / (T_CLIMB[1] - T_MANTLE), 0, 1), dir = -1, lip = GEO.face[LIP];
      const A = climberAt(SH1).hip, B = [lip[0] - 6, lip[1] - 50], Cc = [336, 116];
      const hip = u < 0.55 ? [lerp(A[0], B[0], Ease.inOut(u / 0.55)), lerp(A[1], B[1], Ease.inOut(u / 0.55))] : [lerp(B[0], Cc[0], Ease.inOut((u - 0.55) / 0.45)), lerp(B[1], Cc[1], Ease.inOut((u - 0.55) / 0.45))];
      const p = SM.mix(P.climb, P.stand, sm(0.55, 1, u)); p.lean = u < 0.55 ? lerp(climberAt(SH1).lean, 38, Ease.inOut(u / 0.55)) : lerp(38, 2, Ease.inOut((u - 0.55) / 0.45)); p.nk = lerp(-10, 0, u);
      const rx = hip[0], ry = hip[1] + p.h * MS;
      if (u < 0.75) { SM.reach(p, "arm", 0, toFig([lip[0] - 26, 192], rx, ry, dir), 1); SM.reach(p, "arm", 1, toFig([lip[0] - 8, 193], rx, ry, dir), 1); }
      if (u > 0.3 && u < 0.85) SM.reach(p, "leg", 0, toFig([lip[0] - 4 - 30 * sm(0.55, 0.85, u), 192 + 40 * (1 - sm(0.3, 0.6, u))], rx, ry, dir), 1);
      if (u < 0.6) SM.reach(p, "leg", 1, toFig(wall(SH1 - 40).p, rx, ry, dir), 1);
      Object.assign(out, { p, rx, ry, dir }); out.props.harness = hip; if (u < 0.45) out.props.axes = []; return out;
    }
    // ---- stand on top, walk to the dance spot
    if (t < T_DANCE) { const u = sm(T_CLIMB[1], T_DANCE, t), rx = lerp(292 + CX, 200 + CX, u); Object.assign(out, { p: runPose((t - 21) / 0.7), rx, ry: 192, dir: -1 }); out.p.lean = 4; return out; }
    // ---- dance
    if (t < T_DIVE) { Object.assign(out, { p: SM.dance(t - T_DANCE), rx: 200 + CX, ry: 192, dir: 1 }); return out; }
    // ---- run to the edge and dive
    if (t < T_DIVE + 0.5) { const u = sm(T_DIVE, T_DIVE + 0.5, t), rx = lerp(200 + CX, 134 + CX, u); Object.assign(out, { p: runPose((t - T_DIVE) / 0.42), rx, ry: 192, dir: -1 }); return out; }
    if (t < T_SPLASH + 0.1) {
      const u = clamp((t - T_DIVE - 0.5) / (T_SPLASH - T_DIVE - 0.5), 0, 1);
      const hx = lerp(134 + CX, 62, u), hy = 116 - 70 * u * (1 - u) * 1.2 + (490 - 116) * u * u;
      const p = SM.mix(P.stand, P.dive, sm(0, 0.35, u)); p.lean = lerp(14, 172, Ease.inOut(u));
      Object.assign(out, { p, rx: hx, ry: hy + p.h * MS, dir: -1, alpha: 1 - sm(0.94, 1, u) }); return out;
    }
    return null; // underwater → chalk dust phase
  }

  /* ------------------------------------------------------------ the leopard */
  function leopard(t) {
    const L_ = C.leopard;
    if (t < 3.6 || t > 26.6) return null;
    if (t < 6.8) { const x = lerp(196 + CX, 470, (t - 3.6) / 3.2), ph = (t - 3.6) / 1.05; return { x, P: L_.pose("walk", ph), Q: L_.pose("walk", ph + 0.5) }; }
    if (t < 20.0) {
      const st = L_.pose("stand"), cr = L_.pose("crouch"), li = L_.pose("lie"), w = L_.pose("walk", 3.2 / 1.05);
      let P0 = t < 7.0 ? SM.mix(w, st, sm(6.8, 7.0, t)) : t < 7.6 ? SM.mix(st, cr, sm(7.0, 7.6, t)) : SM.mix(cr, li, sm(7.6, 8.3, t));
      if (t > 8.3) { P0.h += 0.5 * Math.sin(t * 2.2); P0.tc += 4 * Math.sin(t * 0.9); }
      if (t > 6.8 && t < 7.2) P0.hd -= 18 * Math.sin((t - 6.8) / 0.4 * Math.PI);
      return { x: 470, P: P0, Q: { ...P0, fu: P0.fu + 8, th: P0.th + 6 }, sleep: t > 8.6 };
    }
    if (t < 21.6) {
      const li = L_.pose("lie"), cr = L_.pose("crouch"), st = L_.pose("stand");
      const P0 = t < 20.8 ? SM.mix(li, cr, sm(20.0, 20.8, t)) : SM.mix(cr, st, sm(20.8, 21.2, t));
      if (t > 21.1) P0.hd += 14 * Math.sin((t - 21.1) * 9) * (1 - sm(21.3, 21.6, t)); // head shake
      return { x: 470, P: P0, Q: { ...P0, fu: P0.fu + 8, th: P0.th + 6 } };
    }
    const ph = (t - 21.6) / 1.05; return { x: 470 + (t - 21.6) * 120, P: L_.pose("walk", ph), Q: L_.pose("walk", ph + 0.5) };
  }

  // ------------------------------------------------------------ static stage (board texture, cliff, board frame, ground)
  function buildStage() {
    const q = Math.min(2, env.dpr), cv = document.createElement("canvas"); cv.width = Math.round(W * q); cv.height = Math.round(H * q);
    const c = cv.getContext("2d"); c.scale(q, q);
    const r = mulberry32(21);
    // ghost equations (very faint)
    c.globalAlpha = 0.05; c.filter = "blur(0.8px)";
    for (const [id, x, y, px] of [["fokker_planck", 380, 470 + 40, 12], ["random_walk", 560, 515, 11], ["hopf", 820, 60, 12], ["diffusion", 40, 40, 12]]) VQ.draw(c, id, px * S, X(x), Y(y), { chalk: false, q });
    c.filter = "none"; c.globalAlpha = 1;
    // ground with tufts
    const lnc = (pts, w, a) => SM.line(c, pts.map(([x, y]) => [X(x), Y(y)]), w * S, a, INK);
    lnc([[236 + CX, GY], [960, GY]], 1.4, 0.7);
    for (let i = 0; i < 42; i++) { const x = 250 + CX + r() * 660, h = 4 + r() * 7; lnc([[x, GY + 1], [x - 2, GY - h]], 1, 0.35); lnc([[x + 3, GY + 1], [x + 4, GY - h * 0.7]], 1, 0.3); }
    // cliff: dark body, chalk outline, rock + ice texture
    const body = [...GEO.face, ...GEO.top.slice(1), ...GEO.left.slice(1), [101 + CX, 540], [236 + CX, 540]];
    c.beginPath(); body.forEach(([x, y], i) => (i ? c.lineTo(X(x), Y(y)) : c.moveTo(X(x), Y(y)))); c.closePath(); c.fillStyle = BG; c.fill();
    lnc(GEO.face, 1.8, 0.9); lnc(GEO.top, 1.6, 0.85); lnc(GEO.left, 1.6, 0.8);
    for (let i = 0; i < 26; i++) { const y = 210 + r() * 250, x = 130 + CX + r() * 90; lnc([[x, y], [x + 8 + r() * 14, y + 2 + r() * 4]], 1, 0.18); }
    for (let i = 0; i < 9; i++) { const x = 290 + CX + i * 4.2, y = 246 - i * 1.4; lnc([[x - 2, y], [x, y + 8 + (i % 3) * 5], [x + 2, y]], 0.9, 0.55); } // icicles under the hood
    for (let i = 0; i < 5; i++) { const x0 = 234 + CX + i * 1.5; const pts = []; for (let y = 300 + i * 18; y < 452; y += 8) pts.push([x0 - 3 + 2 * Math.sin(y * 0.2 + i), y]); lnc(pts, 0.9, 0.22); } // ice streaks
    // blackboard frame + tray + brackets
    const [bx0, by0, bx1, by1] = GEO.board;
    lnc([[bx0, by0], [bx1, by0], [bx1, by1], [bx0, by1], [bx0, by0]], 1.8, 0.75);
    lnc([[bx0 + 5, by0 + 5], [bx1 - 5, by0 + 5], [bx1 - 5, by1 - 5], [bx0 + 5, by1 - 5], [bx0 + 5, by0 + 5]], 1, 0.25);
    lnc([[bx0 - 6, by1 + 8], [bx1 + 6, by1 + 8]], 1.4, 0.6);
    // pre-drawn expedition sketch on the board: mountain with route + flag, paw print
    lnc([[848, 300], [872, 262], [884, 278], [902, 250], [920, 300]], 1.2, 0.6);
    c.setLineDash([2 * S, 3 * S]); lnc([[860, 296], [876, 276], [890, 268], [902, 252]], 1, 0.6); c.setLineDash([]);
    lnc([[902, 252], [902, 238], [912, 242], [902, 246]], 1, 0.7);
    c.fillStyle = `rgba(${INK},0.55)`; for (const [x, y, rr] of [[868, 336, 6], [860, 324, 2.5], [866, 320, 2.5], [873, 320, 2.5], [879, 325, 2.5]]) { c.beginPath(); c.ellipse(X(x), Y(y), rr * S, rr * 0.85 * S, 0, 0, TAU); c.fill(); }
    return cv;
  }

  // ------------------------------------------------------------ props
  function axe(ctx, grip, pick, a = 1) { // handle from the grip to the pick (planted at `pick`)
    ln(ctx, [grip, pick], 2, 0.95 * a);
    const dx = pick[0] - grip[0], dy = pick[1] - grip[1], d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
    const px = -uy, py = ux; // perpendicular to the shaft
    ln(ctx, [pick, [pick[0] + px * 7 - ux * 2, pick[1] + py * 7 - uy * 2], [pick[0] + px * 12 - ux * 6, pick[1] + py * 12 - uy * 6]], 2.2, 0.95 * a); // curved pick
    ln(ctx, [pick, [pick[0] - px * 6, pick[1] - py * 6]], 2.8, 0.9 * a);                                                                         // adze
  }
  function rope(ctx, pts, a = 0.85) {
    if (pts.length < 2 || a <= 0) return;
    const sp = L.splinePts(pts, false, 8);
    ctx.save(); ctx.setLineDash([5 * S, 3 * S]); ln(ctx, sp, 1.4, a); ctx.restore();
  }
  /* GPS collar on the leopard, side view. The strap wraps the neck as an open
     "C": only its near half shows, and its ends turn round the top (nape) and
     bottom (throat) of the neck. The GPS/battery unit hangs under the throat,
     with a blinking LED. Drawn in the neck bone's own frame (x → head,
     y → throat), so it follows every pose. Neck shape = Cap(12, 16, 14.5).
     HOW TO EDIT: COL.x moves the strap along the neck, COL.w is its width,
     COL.bulge how deep the "C" curves (all in leopard units).               */
  const COL = { x: 2.5, w: 6, bulge: 5.5, box: [11, 8] };
  function leopardCollar(ctx, m, t) {
    const k = m.sx, r = 16 - (1.5 * COL.x) / 12;          // px per unit; neck radius at the strap
    const y0 = -r - 1.4, y1 = r + 0.6, ym = (y0 + y1) / 2, ry = (y1 - y0) / 2;
    const edge = (dx, i0 = 0, i1 = 18) => { const p = []; for (let i = i0; i <= i1; i++) { const a = -Math.PI / 2 + (Math.PI * i) / 18; p.push([COL.x + dx - COL.bulge * Math.cos(a), ym + ry * Math.sin(a)]); } return p; };
    const path = (pts) => pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    const back = edge(0), front = edge(COL.w).reverse();
    ctx.save(); ctx.transform(m.a, m.b, m.c, m.d, m.e, m.f);
    ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.fillStyle = BG; ctx.strokeStyle = `rgba(${INK},0.95)`;
    // strap: dark fill hides the fur beneath; chalk edges and end caps
    ctx.beginPath(); path([...back, ...front]); ctx.closePath(); ctx.fill();
    ctx.lineWidth = (1.35 * S) / k; ctx.stroke();
    // stitching along the middle of the strap
    ctx.save(); ctx.globalAlpha = 0.5; ctx.lineWidth = (0.8 * S) / k; ctx.setLineDash([1.4, 2.2]);
    ctx.beginPath(); path(edge(COL.w / 2, 3, 15)); ctx.stroke(); ctx.restore();
    // GPS unit under the throat + LED (blinks once every ~0.8 s)
    const [bw, bh] = COL.box, bx = COL.x + COL.w / 2;
    ctx.beginPath(); ctx.roundRect(bx - bw / 2, y1 - 1.6, bw, bh, 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bx - bw / 2 + 2, y1 + 1.6); ctx.lineTo(bx + bw / 2 - 2, y1 + 1.6); ctx.globalAlpha = 0.45; ctx.lineWidth = (0.8 * S) / k; ctx.stroke(); ctx.globalAlpha = 1;
    if (fract(t * 1.2) < 0.25) { ctx.fillStyle = `rgba(${INK},1)`; ctx.beginPath(); ctx.arc(bx + bw / 2 - 2.6, y1 + 3.9, 1.3, 0, TAU); ctx.fill(); ctx.fillStyle = `rgba(${INK},0.18)`; ctx.beginPath(); ctx.arc(bx + bw / 2 - 2.6, y1 + 3.9, 3.4, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  // the same collar, open, carried in his hand before it is fitted: a C-shaped
  // strap held at its top, the opening facing the leopard, GPS box at the bottom
  function collarInHand(ctx, h, dir) {
    const rm = 7.2 * S, hw = 1.5 * S, cx = h[0], cy = h[1] + rm, g = dir < 0 ? Math.PI : 0, gap = 0.62;
    ctx.save(); ctx.lineJoin = "round"; ctx.fillStyle = BG; ctx.strokeStyle = `rgba(${INK},0.95)`; ctx.lineWidth = 1.3 * S;
    ctx.beginPath(); ctx.arc(cx, cy, rm + hw, g + gap, g + TAU - gap); ctx.arc(cx, cy, rm - hw, g + TAU - gap, g + gap, true); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.roundRect(cx - 4 * S, cy + rm - 1.5 * S, 8 * S, 5.5 * S, 1.5 * S); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  let SA = 1, tc = 0, t = 0, lp = null, mm = null, box = null;
  function layout(e) {
    env = e; W = e.W; H = e.H;
    if (e.portrait) { // phones: full width, centred in the space under the text
      S = W / 900; ox = -28 * S;
      const top = box ? box.y + box.h + 24 : H * 0.35, room = H - top;
      oy = top + Math.max(0, (room - 540 * S) * 0.55) - 150 * S;
      oy = Math.min(oy, H - 540 * S - H * 0.02);
    }
    else { S = Math.min(W / 960, H / 540); ox = (W - 960 * S) / 2; oy = (H - 540 * S) / 2; }
    rnd = mulberry32(9); grain = VQ.grain(); stage = buildStage();
    // chalk-dust targets: his figure at the board (t = 0)
    const r = mulberry32(4);
    const m0 = man(0.001), J0 = SM.joints(m0.p, new M2().translate(m0.rx, m0.ry).scale(MS, MS));
    const segs = [[J0.hip, J0.sh], [J0.sh, J0.neckTop], ...J0.legs.map((l) => l), ...J0.arms.map((l) => l)];
    const tgt = [];
    for (let i = 0; i < 420; i++) {
      if (i % 4 === 0) { const a = r() * TAU; tgt.push([J0.head[0] + Math.cos(a) * 7 * MS, J0.head[1] + Math.sin(a) * 7 * MS]); continue; }
      const sgm = segs[(r() * segs.length) | 0], k = (r() * (sgm.length - 1)) | 0, f = r();
      tgt.push([lerp(sgm[k][0], sgm[k + 1][0], f), lerp(sgm[k][1], sgm[k + 1][1], f)]);
    }
    dust = tgt.map((q) => ({ q, vx: (r() - 0.5) * 220, vy: -(60 + r() * 260), d: r() * 0.9, cx: 300 + r() * 360, cy: 40 + r() * 140 }));
  }
  // live points on the drawings (for the dust transitions between sections)
  const figPts = (p, M) => { const J = SM.joints(p, M), out = [J.hip, J.sh, J.neckTop, ...J.legs.flat(), ...J.arms.flat()]; for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; out.push([J.head[0] + Math.cos(a) * 7 * J.s, J.head[1] + Math.sin(a) * 7 * J.s]); } return out; };

  return {
    still: 23.2,
    resize(e, b) { box = b || box; layout(e); },
    update(dt, tt) {
      tc = tt; t = ((tt % T) + T) % T;
      lp = leopard(t); mm = man(t);
      if (lp) { rig.begin(new M2().translate(X(lp.x), Y(GY)).scale(LS * S, LS * S)); C.leopard.draw(rig, lp.P, lp.Q, t); }
    },
    points(out, n) {
      const p = PTS.begin(out, n);
      let fig;
      if (mm) fig = figPts(mm.p, rootM(mm.rx, mm.ry, mm.dir)); else fig = dust.slice(0, 60).map((d) => [X(d.q[0]), Y(d.q[1])]);
      const src = new Float32Array(2 * fig.length); fig.forEach((q, i) => { src[2 * i] = q[0]; src[2 * i + 1] = q[1]; });
      p.arr("blog-man", src, fig.length, 0.22);
      if (lp) p.rig("blog-leo", rig, 0.22);
      p.poly("blog-cliff", [...GEO.face, ...GEO.top.slice(1), ...GEO.left.slice(1)].map(([x, y]) => [X(x), Y(y)]), 0.3);
      const [bx0, by0, bx1, by1] = GEO.board;
      p.poly("blog-board", [[bx0, by0], [bx1, by0], [bx1, by1], [bx0, by1], [bx0, by0]].map(([x, y]) => [X(x), Y(y)]), 0.18);
      p.poly("blog-ground", [[236 + CX, GY], [960, GY]].map(([x, y]) => [X(x), Y(y)]), 0.08).end();
    },
    draw(ctx, A, pass) {
      if (pass !== "base") return;
      const tAbs = tc;
      SA = A; ctx.save(); ctx.globalAlpha = A;
      ctx.drawImage(stage, 0, 0, W, H);
      // ---- board writing (+ ghost eraser at reset)
      const wp = sm(0.4, 4.2, t), er = sm(28.0, 29.6, t);
      if (wp > 0 && er < 1) {
        ctx.save();
        const ex = X(lerp(GEO.board[0], 846, er));
        if (er > 0) { ctx.beginPath(); ctx.rect(ex, 0, W, H); ctx.clip(); }
        VQ.write(ctx, "lv", 13 * S, X(712), Y(330), wp, { alpha: 0.95 });
        ctx.restore();
        if (t > 4.2 && t < 29.6) ln(ctx, [[712, 372], [lerp(712, 806, sm(4.2, 4.6, t)), 371]], 1.2, 0.7 * (1 - er));
        if (er > 0 && er < 1) { const x = lerp(GEO.board[0], 846, er); ctx.save(); ctx.fillStyle = BG; ctx.strokeStyle = `rgba(${INK},0.8)`; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.roundRect(X(x) - 9 * S, Y(318), 18 * S, 34 * S, 4 * S); ctx.fill(); ctx.stroke(); ctx.restore(); }
      }
      // ---- water (waves)
      ctx.save(); ctx.beginPath();
      for (let x = 0; x <= GEO.waterX; x += 3) { const y = GEO.water + 2.2 * Math.sin(x * 0.18 + tAbs * 2.4); x ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y)); }
      ctx.strokeStyle = `rgba(${INK},0.6)`; ctx.lineWidth = 1.3 * S; ctx.stroke();
      for (let k = 0; k < 3; k++) { ctx.beginPath(); const y0 = GEO.water + 14 + k * 14; for (let x = 6; x <= GEO.waterX - 12; x += 3) { const y = y0 + 1.5 * Math.sin(x * 0.25 + tAbs * 1.7 + k); x > 6 ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y)); } ctx.strokeStyle = `rgba(${INK},${0.18 - k * 0.04})`; ctx.stroke(); }
      ctx.restore();
      // ---- rope coil, quickdraws, rope
      const ra = sm(14.4, 14.7, t) * (1 - sm(27.8, 29.0, t));
      if (ra > 0) {
        for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.ellipse(X(GEO.coil[0]), Y(GEO.coil[1] - k * 2), (11 - k * 2) * S, 3.5 * S, 0, 0, TAU); ctx.strokeStyle = `rgba(${INK},${0.7 * ra})`; ctx.lineWidth = 1.3 * S; ctx.stroke(); }
        const cs = t >= T_MANTLE ? 1e9 : t >= T_CLIMB[0] ? climbState(t).s : -1, clipped = GEO.quick.filter((q, i) => cs > QS[i] + 6);
        for (const q of clipped) { ln(ctx, [q, [q[0] + 4, q[1] + 7]], 1.2, 0.85 * ra); ctx.beginPath(); ctx.ellipse(X(q[0] + 5), Y(q[1] + 10), 2.4 * S, 3.6 * S, 0.3, 0, TAU); ctx.strokeStyle = `rgba(${INK},${0.85 * ra})`; ctx.stroke(); }
        const m = t < T_CLIMB[1] && t >= T_CLIMB[0] ? man(t) : null;
        const end = m && m.props.harness ? m.props.harness : t >= T_CLIMB[1] ? GEO.anchor : [282 + CX, 398];
        if (t >= T_CLIMB[0] - 0.4) rope(ctx, [GEO.coil, ...clipped.map((q) => [q[0] + 5, q[1] + 12]), end, ...(t >= T_CLIMB[1] ? [[226 + CX, 191], [212 + CX, 192]] : [])], 0.8 * ra);
      }
      // ---- the leopard (+ dart, collar, z z)
      const drawLeo = () => {
        if (!lp) return;
        drawOutline(ctx, rig, { width: Math.max(1.1, 1.4 * S), color: `rgb(${INK})`, bg: BG, occlude: 0.95, far: 0.45, grain, grainA: 0.6, alpha: SA });
        const nk = rig.parts.find((p) => p.shape === C.leopard.shapes.neck);
        if (t > 10.2 && nk) leopardCollar(ctx, nk.m, t); // GPS collar round the neck
        if (t > 6.8 && t < 9.6) { const hp = rig.parts.find((p) => p.shape === C.leopard.shapes.hind); if (hp) { const a = hp.m.apply(-20, -10); ln(ctx, [[(a[0] - ox) / S, (a[1] - oy) / S], [(a[0] - ox) / S + 7, (a[1] - oy) / S - 9]], 1.4, 0.9); } }
        if (lp.sleep && t < 19.8) for (let k = 0; k < 3; k++) { const ph = fract(t * 0.5 + k / 3); ctx.fillStyle = `rgba(${INK},${0.7 * (1 - ph)})`; ctx.font = `italic ${(10 + 6 * ph) * S}px 'WQ Serif', 'Latin Modern Roman', serif`; ctx.fillText("z", X(lp.x + 70 + 18 * ph + k * 2), Y(GY - 40 - 34 * ph)); }
      };
      const drawMan = () => {
        if (!mm) return;
        const M = rootM(mm.rx, mm.ry, mm.dir), a = mm.alpha ?? 1;
        const J = SM.draw(ctx, mm.p, M, { width: Math.max(1.3, 2 * S), alpha: a, frames: "rect" });
        const pr = mm.props;
        if (pr.chalk) { const h = J.arms[0][2]; ctx.fillStyle = `rgba(${INK},0.95)`; ctx.fillRect(h[0] - 1.5 * S, h[1] - 1.5 * S, 3 * S, 3 * S); }
        if (pr.rifle) {
          const g = (q) => { const s = M.apply(q[0], q[1]); return [(s[0] - ox) / S, (s[1] - oy) / S]; };
          const st = g(pr.rifle(-5)), mz = g(pr.rifle(38)), sc = g(pr.rifle(16));
          ln(ctx, [st, mz], 2.2, 0.95); ln(ctx, [st, [st[0] + 6, st[1] + 4]], 3.2, 0.9); ln(ctx, [[sc[0] - 4, sc[1] - 4], [sc[0] + 4, sc[1] - 4]], 2.4, 0.9);
          if (t > 6.5 && t < 6.85) { const u = (t - 6.5) / 0.3, dx = lerp(mz[0], 452, u), dy = lerp(mz[1], 424, u) - 10 * Math.sin(Math.PI * u); ln(ctx, [[dx, dy], [dx + 12, dy - 1]], 1.6, 1); }
          if (t > 6.5 && t < 6.62) { ctx.fillStyle = `rgba(${INK},0.6)`; ctx.beginPath(); ctx.arc(X(mz[0] - 4), Y(mz[1]), 5 * S, 0, TAU); ctx.fill(); }
        }
        if (pr.collarInHand) collarInHand(ctx, J.arms[0][2], mm.dir);
        if (pr.axesV) { for (const [i, tilt, pd] of [[0, 0.32, 1], [1, -0.32, -1]]) { const h = J.arms[i][2], hd = [(h[0] - ox) / S, (h[1] - oy) / S], top = [hd[0] + Math.sin(tilt) * 32, hd[1] - Math.cos(tilt) * 32]; ln(ctx, [[hd[0] - Math.sin(tilt) * 4, hd[1] + Math.cos(tilt) * 4], top], 2, 0.95); ln(ctx, [top, [top[0] + pd * 11, top[1] + 5]], 2, 0.95); ln(ctx, [top, [top[0] - pd * 5, top[1] - 1]], 2.4, 0.9); } }
        if (pr.axes) for (const [g, k] of pr.axes) axe(ctx, g, k);
      };
      // depth: kneeling at the leopard → man in front; running past → man behind
      if (t > 11.6 && t < 13.4) { drawMan(); drawLeo(); } else { drawLeo(); drawMan(); }
      // ---- splash + chalk dust back to the board
      if (t > T_SPLASH - 0.05 && t < T_SPLASH + 1.6) {
        const u = (t - T_SPLASH) / 1.6;
        for (let k = 1; k <= 3; k++) { const rr = (10 + 60 * u) * (0.5 + k * 0.25); ctx.beginPath(); ctx.ellipse(X(62), Y(GEO.water + 2), rr * S, rr * 0.22 * S, 0, 0, TAU); ctx.strokeStyle = `rgba(${INK},${0.5 * (1 - u) / k})`; ctx.lineWidth = 1.2 * S; ctx.stroke(); }
      }
      if (t > T_SPLASH) {
        const fly0 = T_SPLASH + 0.55, fly1 = 31.2;
        ctx.save();
        for (const d of dust) {
          const tb = t - T_SPLASH;
          let x, y, a;
          if (t < fly0) { x = 62 + d.vx * tb * 0.35; y = GEO.water - (d.vy * -1) * tb * 0.55 + 260 * tb * tb; a = 0.9; }
          else {
            const p0 = [62 + d.vx * 0.55 * 0.35, GEO.water - (-d.vy) * 0.55 * 0.55 + 260 * 0.55 * 0.55], u = Ease.inOut(clamp((t - fly0 - d.d) / (fly1 - fly0 - 0.9), 0, 1));
            const c = [d.cx, d.cy], q = d.q;
            x = (1 - u) * (1 - u) * p0[0] + 2 * (1 - u) * u * c[0] + u * u * q[0]; y = (1 - u) * (1 - u) * p0[1] + 2 * (1 - u) * u * c[1] + u * u * q[1];
            a = 0.85 * (1 - sm(31.3, 31.95, t));
          }
          ctx.fillStyle = `rgba(${INK},${a})`; ctx.fillRect(X(x) - 1, Y(y) - 1, 2 * S, 2 * S);
        }
        ctx.restore();
        // the explorer re-forms at the board
        const fa = sm(31.0, 31.9, t);
        if (fa > 0) { const m0 = man(0.001); SM.draw(ctx, m0.p, rootM(m0.rx, m0.ry, m0.dir), { width: Math.max(1.3, 2 * S), alpha: fa, frames: "rect" }); }
      }
      ctx.restore();
    },
  };
};
})(window);
