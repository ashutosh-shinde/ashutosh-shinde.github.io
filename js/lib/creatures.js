/* =============================================================================
   creatures.js — procedurally drawn animals (no images) → WQ.C
   -----------------------------------------------------------------------------
   Each animal = a skeleton + simple shapes (blobs/capsules) per bone.
   Gaits are 4 keyframes per cycle, blended smoothly (L.cycle).
   Units ≈ centimetres, facing right (+x), y down, feet on y = 0.

   API per creature:
     C.hare.pose(mode, phase)   -> pose object (numbers, degrees)
     C.hare.draw(rig, P, Q)     -> records parts; P = near-limb pose,
                                   Q = far-limb pose (usually phase-shifted)
     C.hare.render(rig, M, mode, phase)  convenience: begin + pose + draw
   Leg angles: degrees from vertical, + swings the leg forward.
   HOW TO EDIT: tweak numbers in *_KEYS (gaits) or shapes (*_S).
   ============================================================================= */
(function (G) {
  "use strict";
  const { DEG, Shape, cycle, M2, lerp, TAU } = G.WQ.L;
  const A = (thetaDeg) => (90 - thetaDeg) * DEG; // leg angle -> rig.aim angle
  const B = Shape.blob, Cap = Shape.capsule, E = Shape.ellipse;

  // helper: pose(mode, phase) from gait keys or static poses
  function mkPose(keys, statics) {
    return (mode, phase = 0) => (keys[mode] ? cycle(keys[mode], phase) : { ...statics[mode] });
  }

  /* ------------------------------------------------------------------ HARE */
  const HS = {
    rump: B([[4, -8.5], [-6, -10.5], [-16, -11], [-23, -8.5], [-27, -3], [-27, 3.5], [-23, 8.5], [-15, 10], [-5, 8.5], [3, 7]]),
    chest: B([[-6, -8.5], [4, -9], [12, -8], [18, -4.5], [20, 1], [17, 7], [9, 8.5], [0, 7.5], [-6, 7]]),
    head: B([[-5, -2], [-3, -5.5], [2, -7.2], [7, -6.5], [12, -3.6], [15.5, -0.6], [15, 1.8], [12.5, 3.4], [7, 5.2], [0, 6], [-4.5, 3.5]]),
    ear: Shape.leaf(19, 2.5, 0.02, 0.6, 0.6),
    tail: E(0, 0, 4.2, 3.6),
    thigh: Cap(13, 7.8, 3.6), shin: Cap(14, 3.1, 1.8), foot: Cap(14, 2.2, 1.5),
    upper: Cap(8, 4, 2.5), fore: Cap(10, 2.3, 1.6), paw: Cap(4.5, 1.7, 1.5),
    eye: E(0, 0, 1.9, 1.75), pupil: E(0.35, 0, 1.05, 1.05), nose: E(0, 0, 0.9, 0.7),
    earTip: B([[14.5, -1.8], [19.5, 0], [14.5, 1.8], [15.5, 0]]),
  };
  const HARE_KEYS = {
    hop: [
      { h: 23, p: -9, f: -4, th: -32, sh: -55, ft: -80, fu: 40, ff: 52, fp: 70, hd: 6, ear: -165 },
      { h: 28, p: -1, f: -9, th: -42, sh: -68, ft: -92, fu: 48, ff: 58, fp: 78, hd: 2, ear: -168 },
      { h: 21, p: 11, f: 6, th: 28, sh: -22, ft: -45, fu: 14, ff: 0, fp: 15, hd: -4, ear: -160 },
      { h: 17, p: 3, f: 24, th: 72, sh: 25, ft: 85, fu: -28, ff: -45, fp: -80, hd: 2, ear: -158 },
    ],
  };
  const HARE_STATIC = {
    sit: { h: 15, p: -28, f: 14, th: 55, sh: -115, ft: 95, fu: -5, ff: 5, fp: 60, hd: 30, ear: -110 },
    alert: { h: 19, p: -12, f: 4, th: 50, sh: -95, ft: 95, fu: 0, ff: 0, fp: 70, hd: 14, ear: -100 },
  };
  function hareDraw(R, P, Q) {
    Q = Q || P;
    R.save();
    R.translate(0, -P.h); R.rotate(P.p * DEG);
    const hind = (k, layer) => { R.save(); R.rotate(-P.f * DEG); R.translate(-14, 2); R.chain([[HS.thigh, 13, A(k.th)], [HS.shin, 14, A(k.sh)], [HS.foot, 14, A(k.ft)]], layer); R.restore(); };
    const front = (k, layer) => { R.save(); R.rotate(P.f * DEG); R.translate(11, 3); R.chain([[HS.upper, 8, A(k.fu)], [HS.fore, 10, A(k.ff)], [HS.paw, 4.5, A(k.fp)]], layer); R.restore(); };
    hind(Q, 1); front(Q, 1);
    // head frame (shared by far ear, head, near ear)
    const headFrame = () => { R.rotate(P.f * DEG); R.translate(16, -6); R.rotate(P.hd * DEG); };
    R.save(); headFrame(); R.translate(3, -5.5); R.rotate((P.ear + 10) * DEG); R.part(HS.ear, 1); R.restore();
    // body
    R.save(); R.rotate(-P.f * DEG); R.save(); R.translate(-25, -6); R.part(HS.tail); R.restore(); R.part(HS.rump); R.restore();
    R.save(); R.rotate(P.f * DEG); R.part(HS.chest); R.restore();
    R.save(); headFrame(); R.part(HS.head);
    R.save(); R.translate(6.2, -2.4); R.detail(HS.eye, { w: 1.1 }); R.detail(HS.pupil, { fill: true }); R.restore();
    R.save(); R.translate(15, 0); R.detail(HS.nose, { fill: true, a: 0.8 }); R.restore();
    R.save(); R.translate(1, -5.5); R.rotate(P.ear * DEG); R.part(HS.ear); R.detail(HS.earTip, { fill: true, a: 0.9 }); R.restore();
    R.restore();
    hind(P, 0); front(P, 0);
    R.restore();
  }

  /* ------------------------------------------------------------------ WOLF */
  const WS = {
    hind: B([[4, -13], [-10, -14], [-26, -14.5], [-40, -13], [-49, -7], [-51, 2], [-46, 10], [-34, 12], [-20, 8], [-6, 9], [4, 8]]),
    chest: B([[-10, -15], [6, -16.5], [22, -17], [34, -14], [41, -6], [41, 6], [34, 17], [20, 23], [6, 19], [-6, 12], [-12, 0]]),
    neck: Cap(20, 13, 9.5),
    head: B([[-7, -5], [-2, -8.5], [6, -8], [12, -5.5], [18, -3.4], [25, -2], [28, -0.5], [28, 2.2], [24, 3.5], [20, 5.5], [10, 7.5], [2, 7.5], [-5, 5]]),
    ear: B([[-4.5, 0], [-2.5, -6], [0, -12], [2, -6], [4, 0]]),
    t1: Cap(15, 5, 7.5), t2: Cap(15, 7.5, 6.5), t3: Cap(14, 6.5, 2),
    upper: Cap(23, 8.5, 5), fore: Cap(24, 4.2, 3.1), fpaw: Cap(9, 3.1, 3.6),
    thigh: Cap(25, 11.5, 6), shin: Cap(26, 5.4, 3.3), meta: Cap(17, 3.1, 2.9), hpaw: Cap(7, 3.3, 3.6),
    eye: B([[-2.2, 0], [0, -1.2], [2.2, 0], [0, 1]]), nose: E(0, 0, 1.8, 1.4), mouth: Shape.poly([[14, 5.2], [24, 3.6], [24, 4.1], [14, 5.8]]),
  };
  const WOLF_KEYS = {
    gallop: [
      { h: 55, p: 1, f: 13, fu: -30, ff: -62, fp: -95, th: 58, sh: 12, mt: 45, hp: 70, nk: -16, hd: 16, tl: 168, ear: -22 },
      { h: 58, p: -4, f: 3, fu: 32, ff: 42, fp: 40, th: 22, sh: -18, mt: -5, hp: 25, nk: -20, hd: 12, tl: 172, ear: -20 },
      { h: 61, p: 0, f: -9, fu: 55, ff: 62, fp: 72, th: -32, sh: -58, mt: -80, hp: -85, nk: -14, hd: 14, tl: 176, ear: -24 },
      { h: 57, p: 5, f: 2, fu: 8, ff: -6, fp: 25, th: 18, sh: -42, mt: -62, hp: -50, nk: -12, hd: 18, tl: 170, ear: -22 },
    ],
  };
  const WOLF_STATIC = {
    stand: { h: 60, p: 0, f: 0, fu: 2, ff: -2, fp: 5, th: 25, sh: -30, mt: 5, hp: 85, nk: -40, hd: 10, tl: 120, ear: -5 },
    howl: { h: 37, p: -50, f: 8, fu: 6, ff: 2, fp: 88, th: 95, sh: -80, mt: 92, hp: 95, nk: -82, hd: -52, tl: 178, ear: -30 },
  };
  function wolfDraw(R, P, Q) {
    Q = Q || P;
    R.save();
    R.translate(0, -P.h); R.rotate(P.p * DEG);
    const hind = (k, layer) => { R.save(); R.rotate(-P.f * DEG); R.translate(-34, -2); R.chain([[WS.thigh, 25, A(k.th)], [WS.shin, 26, A(k.sh)], [WS.meta, 17, A(k.mt)], [WS.hpaw, 7, A(k.hp)]], layer); R.restore(); };
    const front = (k, layer) => { R.save(); R.rotate(P.f * DEG); R.translate(25, 6); R.chain([[WS.upper, 23, A(k.fu)], [WS.fore, 24, A(k.ff)], [WS.fpaw, 9, A(k.fp)]], layer); R.restore(); };
    hind(Q, 1); front(Q, 1);
    // tail
    R.save(); R.rotate(-P.f * DEG); R.translate(-47, -9);
    R.chain([[WS.t1, 15, P.tl * DEG], [WS.t2, 15, (P.tl - 6) * DEG], [WS.t3, 14, (P.tl - 14) * DEG]]);
    R.restore();
    R.save(); R.rotate(-P.f * DEG); R.part(WS.hind); R.restore();
    R.save(); R.rotate(P.f * DEG); R.part(WS.chest);
    // neck + head
    R.translate(31, -7); R.aim(P.nk * DEG); R.part(WS.neck); R.translate(18, 0); R.aim(P.hd * DEG);
    R.save(); R.translate(3, -6.5); R.rotate((P.ear + 14) * DEG); R.part(WS.ear, 1); R.restore();
    R.part(WS.head);
    R.save(); R.translate(-1, -6.5); R.rotate(P.ear * DEG); R.part(WS.ear); R.restore();
    R.save(); R.translate(12, -3.6); R.detail(WS.eye, { fill: true }); R.restore();
    R.save(); R.translate(27.2, 0.6); R.detail(WS.nose, { fill: true }); R.restore();
    R.detail(WS.mouth, { fill: true, a: 0.7 });
    R.restore();
    hind(P, 0); front(P, 0);
    R.restore();
  }

  /* ------------------------------------------------------------------ DEER (chital stag) */
  const DS = {
    hind: B([[4, -12], [-12, -13], [-28, -12.5], [-40, -9], [-45, -1], [-42, 8], [-31, 11], [-17, 8], [-4, 9], [4, 7]]),
    chest: B([[-8, -13], [8, -14], [24, -13.5], [33, -9], [36, 1], [32, 11], [20, 16], [6, 13], [-8, 9]]),
    neck: Cap(32, 10.5, 6.2),
    head: B([[-5, -4], [1, -6.5], [8, -5.5], [15, -3], [21, -0.5], [22, 2], [19, 4], [12, 5.2], [4, 5.5], [-4, 4]]),
    ear: Shape.leaf(12, 3.3, 0.01, 0.6, 0.7),
    tail: Cap(9, 3, 2),
    upper: Cap(20, 6.5, 3.6), fore: Cap(27, 2.6, 1.8), cannon: Cap(16, 1.8, 1.9), hoof: Cap(3.5, 2.0, 2.3),
    thigh: Cap(26, 9.5, 4.5), shin: Cap(29, 3.6, 2.2), meta: Cap(24, 2.1, 1.8), hhoof: Cap(3.5, 2.0, 2.3),
    beam1: Cap(12, 1.7, 1.4), beam2: Cap(12, 1.4, 1.1), beam3: Cap(12, 1.1, 0.5), tine: Cap(9, 1.1, 0.4), brow: Cap(10, 1.2, 0.4),
    eye: E(0, 0, 1.6, 1.3), nose: E(0, 0, 1.4, 1.2),
    spot: E(0, 0, 1.25, 1.0),
  };
  // chital spots (in hind/chest local frames)
  const SPOTS_H = [], SPOTS_C = [];
  (function () {
    const r = G.WQ.L.mulberry32(11);
    for (let i = 0; i < 26; i++) SPOTS_H.push([-6 - r() * 36, -9 + r() * 12]);
    for (let i = 0; i < 18; i++) SPOTS_C.push([-4 + r() * 30, -10 + r() * 11]);
  })();
  const DEER_KEYS = {
    gallop: [
      { h: 72, p: 0, f: 12, fu: -25, ff: -75, fp: -110, th: 55, sh: 0, mt: 45, hp: 60, nk: -48, hd: 30, tl: -150, ear: -150 },
      { h: 76, p: -6, f: 3, fu: 40, ff: 55, fp: 45, th: 15, sh: -25, mt: -10, hp: 10, nk: -55, hd: 35, tl: -145, ear: -152 },
      { h: 80, p: 0, f: -10, fu: 70, ff: 82, fp: 85, th: -40, sh: -65, mt: -95, hp: -100, nk: -45, hd: 35, tl: -150, ear: -155 },
      { h: 73, p: 6, f: 2, fu: 5, ff: -8, fp: 10, th: 10, sh: -50, mt: -70, hp: -60, nk: -42, hd: 32, tl: -148, ear: -150 },
    ],
  };
  const DEER_STATIC = {
    stand: { h: 76, p: 0, f: 0, fu: 2, ff: -2, fp: 2, th: 22, sh: -28, mt: 2, hp: 5, nk: -58, hd: 38, tl: 110, ear: -140 },
    graze: { h: 75, p: 3, f: 2, fu: 4, ff: -2, fp: 2, th: 22, sh: -28, mt: 2, hp: 5, nk: 62, hd: 85, tl: 115, ear: -170 },
    alert: { h: 77, p: -2, f: -2, fu: 0, ff: -2, fp: 2, th: 20, sh: -28, mt: 2, hp: 5, nk: -70, hd: 28, tl: -150, ear: -115 },
  };
  function deerDraw(R, P, Q) {
    Q = Q || P;
    R.save();
    R.translate(0, -P.h); R.rotate(P.p * DEG);
    const hind = (k, layer) => { R.save(); R.rotate(-P.f * DEG); R.translate(-31, -1); R.chain([[DS.thigh, 26, A(k.th)], [DS.shin, 29, A(k.sh)], [DS.meta, 24, A(k.mt)], [DS.hhoof, 3.5, A(k.hp)]], layer); R.restore(); };
    const front = (k, layer) => { R.save(); R.rotate(P.f * DEG); R.translate(23, 7); R.chain([[DS.upper, 20, A(k.fu)], [DS.fore, 27, A(k.ff)], [DS.cannon, 16, A(k.fp)], [DS.hoof, 3.5, A(k.fp)]], layer); R.restore(); };
    hind(Q, 1); front(Q, 1);
    R.save(); R.rotate(-P.f * DEG); R.translate(-42, -8); R.aim(P.tl * DEG); R.part(DS.tail); R.restore();
    R.save(); R.rotate(-P.f * DEG); R.part(DS.hind); for (const [x, y] of SPOTS_H) { R.save(); R.translate(x, y); R.detail(DS.spot, { fill: true, a: 0.55, clip: true }); R.restore(); } R.restore();
    R.save(); R.rotate(P.f * DEG); R.part(DS.chest); for (const [x, y] of SPOTS_C) { R.save(); R.translate(x, y); R.detail(DS.spot, { fill: true, a: 0.55, clip: true }); R.restore(); }
    R.translate(26, -7); R.aim(P.nk * DEG); R.part(DS.neck); R.translate(31, 0); R.aim(P.hd * DEG);
    const antler = (layer, dx, da) => {
      R.save(); R.translate(1 + dx, -5.5); R.aim((P.hd - 125 + da) * DEG);
      R.part(DS.beam1, layer);
      R.save(); R.translate(2.5, 0); R.rotate(78 * DEG); R.part(DS.brow, layer); R.restore();
      R.translate(11, 0); R.rotate(-14 * DEG); R.part(DS.beam2, layer);
      R.save(); R.translate(9, 0); R.rotate(55 * DEG); R.part(DS.tine, layer); R.restore();
      R.translate(11, 0); R.rotate(-16 * DEG); R.part(DS.beam3, layer);
      R.restore();
    };
    antler(1, 2.5, 8);
    R.save(); R.translate(2, -4); R.rotate((P.ear + 12) * DEG); R.part(DS.ear, 1); R.restore();
    R.part(DS.head);
    antler(0, 0, 0);
    R.save(); R.translate(0, -4); R.rotate(P.ear * DEG); R.part(DS.ear); R.restore();
    R.save(); R.translate(9, -2.2); R.detail(DS.eye, { fill: true }); R.restore();
    R.save(); R.translate(21, 0.8); R.detail(DS.nose, { fill: true, a: 0.8 }); R.restore();
    R.restore();
    hind(P, 0); front(P, 0);
    R.restore();
  }

  /* ------------------------------------------------------------------ TIGER */
  const TS = {
    hind: B([[4, -16], [-14, -17], [-30, -17], [-43, -13], [-50, -3], [-47, 10], [-36, 15], [-21, 13], [-6, 15], [4, 12]]),
    chest: B([[-10, -18], [8, -20], [24, -19.5], [35, -15], [42, -4], [41, 10], [32, 22], [16, 25], [2, 21], [-10, 15]]),
    neck: Cap(12, 16, 14.5),
    head: B([[-9, -6], [-4, -12.5], [5, -14.5], [13, -12.5], [18, -8], [21.5, -3.5], [23, 1.5], [21, 6], [15, 9.5], [7, 13], [-1, 13.5], [-8, 9], [-11, 2]]),
    ear: B([[-4.2, 0.5], [-3.8, -4.2], [0, -6.6], [3.8, -4.2], [4.2, 0.5]]),
    tail: Cap(13.5, 5.4, 4.9), tailTip: Cap(13.5, 4.9, 3.4),
    upper: Cap(21, 11, 7.6), fore: Cap(19, 6.8, 5.4), fpaw: Cap(8, 5.8, 6.4),
    thigh: Cap(25, 14.5, 7.5), shin: Cap(22, 7, 4.4), meta: Cap(14, 4.4, 4.1), hpaw: Cap(7.5, 4.8, 5.3),
    eye: B([[-2.6, 0.2], [0, -1.6], [2.8, -0.4], [0.4, 1.2]]), nose: B([[-2.4, -1.4], [2.4, -1.4], [0, 1.8]]),
    muzzle: E(0, 0, 4.2, 3.2),
  };
  // stripes: thin tapered strokes in body-local coords [x, y, length, angle°]
  const STRIPES_H = [[-8, -15, 15, 98], [-17, -15.5, 16, 104], [-26, -15, 16, 110], [-35, -14, 14, 118], [-43, -11, 12, 128], [-12, 6, 7, 70], [-30, 5, 7, 75]];
  const STRIPES_C = [[2, -18.5, 15, 82], [11, -19, 13, 78], [20, -18.5, 12, 74], [29, -16, 9, 70], [-4, -17.5, 14, 88]];
  const TSTRIPE = Shape.leaf(1, 0.09, 0.05, 0.3, 0.9); // unit stripe, scaled per use
  // leopard rosettes: broken rings scattered over hind/chest (local coords) [x, y, radius]
  const ROSETTE = Shape.ellipse(0, 0, 1, 0.82, 14);
  const ROS_H = [], ROS_C = [];
  (function () {
    const r = G.WQ.L.mulberry32(23);
    for (let i = 0; i < 30; i++) ROS_H.push([-4 - r() * 44, -14 + r() * 24, 1.6 + r() * 1.4]);
    for (let i = 0; i < 24; i++) ROS_C.push([-6 + r() * 44, -16 + r() * 30, 1.5 + r() * 1.4]);
  })();
  const TIGER_KEYS = {
    gallop: [
      { h: 46, p: 1, f: 16, fu: -32, ff: -62, fp: -95, th: 60, sh: 12, mt: 48, hp: 72, nk: -4, hd: 12, tl: 168, tc: -6, ear: -12 },
      { h: 49, p: -4, f: 4, fu: 32, ff: 42, fp: 35, th: 22, sh: -18, mt: -5, hp: 25, nk: -6, hd: 10, tl: 172, tc: -3, ear: -12 },
      { h: 52, p: 0, f: -12, fu: 55, ff: 62, fp: 72, th: -34, sh: -60, mt: -82, hp: -88, nk: -2, hd: 8, tl: 178, tc: 4, ear: -14 },
      { h: 48, p: 6, f: 2, fu: 8, ff: -6, fp: 25, th: 18, sh: -42, mt: -62, hp: -50, nk: 0, hd: 14, tl: 172, tc: 0, ear: -12 },
    ],
  };
  // walking (lateral-sequence) — draw the far legs at phase + 0.5
  TIGER_KEYS.walk = [
    { h: 50, p: 0, f: 0, fu: 22, ff: 12, fp: 75, th: -18, sh: -40, mt: -8, hp: 70, nk: -4, hd: 14, tl: 158, tc: -14, ear: -6 },
    { h: 51, p: 0, f: 2, fu: 4, ff: -4, fp: 82, th: 8, sh: -34, mt: 4, hp: 82, nk: -3, hd: 13, tl: 160, tc: -13, ear: -6 },
    { h: 50, p: 0, f: 0, fu: -22, ff: -40, fp: 28, th: 26, sh: -14, mt: 32, hp: 62, nk: -4, hd: 14, tl: 158, tc: -14, ear: -6 },
    { h: 51, p: 0, f: -2, fu: 12, ff: 34, fp: 70, th: -4, sh: -42, mt: -14, hp: 58, nk: -3, hd: 13, tl: 160, tc: -13, ear: -6 },
  ];
  const TIGER_STATIC = {
    stand: { h: 50, p: 0, f: 0, fu: 2, ff: -3, fp: 85, th: 25, sh: -30, mt: 8, hp: 85, nk: -14, hd: 12, tl: 112, tc: 12, ear: 0 },
    crouch: { h: 30, p: 4, f: 10, fu: -55, ff: 35, fp: 88, th: 78, sh: -95, mt: 62, hp: 92, nk: 8, hd: 4, tl: 172, tc: 3, ear: -18 },
    lie: { h: 21, p: 1, f: 8, fu: 60, ff: 84, fp: 92, th: 94, sh: -42, mt: 88, hp: 95, nk: 26, hd: 16, tl: 174, tc: -10, ear: -16 },
    pounce: { h: 66, p: -10, f: -12, fu: 52, ff: 60, fp: 78, th: -48, sh: -70, mt: -92, hp: -98, nk: -12, hd: 8, tl: 182, tc: 4, ear: -26 },
  };
  function tigerDraw(R, P, Q, t = 0, spots = false) {
    Q = Q || P;
    R.save();
    R.translate(0, -P.h); R.rotate(P.p * DEG);
    const hind = (k, layer) => { R.save(); R.rotate(-P.f * DEG); R.translate(-36, -2); R.chain([[TS.thigh, 28, A(k.th)], [TS.shin, 24, A(k.sh)], [TS.meta, 15, A(k.mt)], [TS.hpaw, 7.5, A(k.hp)]], layer); R.restore(); };
    const front = (k, layer) => { R.save(); R.rotate(P.f * DEG); R.translate(26, 6); R.chain([[TS.upper, 24, A(k.fu)], [TS.fore, 22, A(k.ff)], [TS.fpaw, 8, A(k.fp)]], layer); R.restore(); };
    hind(Q, 1); front(Q, 1);
    // long tail: 6 segments with a travelling curl
    R.save(); R.rotate(-P.f * DEG); R.translate(-50, -9);
    const segs = [];
    for (let i = 0; i < 6; i++) segs.push([i < 5 ? TS.tail : TS.tailTip, 13.5, (P.tl + P.tc * i * i / 5 + 6 * Math.sin(t * 4 - i * 0.7)) * DEG]);
    R.chain(segs);
    R.restore();
    const stripe = (x, y, len, ang) => { if (spots) return; R.save(); R.translate(x, y); R.rotate(ang * DEG); R.scale(len, len); R.detail(TSTRIPE, { fill: true, a: 0.85, clip: true }); R.restore(); };
    const rosettes = (list) => { if (!spots) return; for (const [x, y, r] of list) { R.save(); R.translate(x, y); R.scale(r, r); R.detail(ROSETTE, { w: 0.75, a: 0.8, clip: true }); R.restore(); } };
    R.save(); R.rotate(-P.f * DEG); R.part(TS.hind); for (const s of STRIPES_H) stripe(...s); rosettes(ROS_H); R.restore();
    R.save(); R.rotate(P.f * DEG); R.part(TS.chest); for (const s of STRIPES_C) stripe(...s); rosettes(ROS_C);
    R.translate(33, -7); R.aim(P.nk * DEG); R.part(TS.neck); R.translate(12, 0); R.aim(P.hd * DEG);
    R.save(); R.translate(6, -12.5); R.rotate((P.ear + 12) * DEG); R.part(TS.ear, 1); R.restore();
    R.part(TS.head);
    R.save(); R.translate(1, -12); R.rotate(P.ear * DEG); R.part(TS.ear); R.restore();
    R.save(); R.translate(13, -5.5); R.detail(TS.eye, { fill: true }); R.restore();
    R.save(); R.translate(21.5, 0); R.detail(TS.nose, { fill: true }); R.restore();
    R.save(); R.translate(16, 5); R.detail(TS.muzzle, { w: 0.8, a: 0.6, clip: true }); R.restore();
    stripe(3, -13, 8, 72); stripe(8, -14, 6, 88); stripe(-4, -7, 9, 95); stripe(-6, 4, 8, 120); stripe(6, 10, 6, 160);
    R.restore();
    hind(P, 0); front(P, 0);
    R.restore();
  }

  /* ------------------------------------------------------------------ OWL (front view, wings spread) */
  const OS = {
    body: B([[0, -13], [8, -10], [11.5, 0], [10, 11], [5, 17], [0, 18.5], [-5, 17], [-10, 11], [-11.5, 0], [-8, -10]]),
    head: B([[-10, 1], [-12, -6], [-11, -13], [-13.5, -20.5], [-6.5, -16.5], [0, -17], [6.5, -16.5], [13.5, -20.5], [11, -13], [12, -6], [10, 1], [4, 3.5], [-4, 3.5]]),
    wing: B([[0, -4], [8, -7.5], [20, -9.5], [32, -9], [42, -7], [49, -4.5], [47, 1], [43, 3], [40, 7], [36, 6], [33, 10], [28, 9], [24, 12.5], [19, 11.5], [14, 13], [8, 11.5], [2, 9]]),
    prim: Shape.leaf(13, 1.7, 0.02, 0.4, 0.7),
    tail: B([[-5, 0], [-7.5, 9], [-3, 11.5], [0, 12], [3, 11.5], [7.5, 9], [5, 0]]),
    disc: E(0, 0, 5.4, 5.6), eye: E(0, 0, 3.1, 3.1), pupil: E(0, 0, 1.55, 1.55),
    beak: Shape.poly([[-1.3, 0], [1.3, 0], [0, 3.6]]),
    v: Shape.poly([[-1.8, -0.6], [0, 0.8], [1.8, -0.6], [1.8, 0.1], [0, 1.6], [-1.8, 0.1]]),
  };
  // flap: 0 = glide; wing angle in degrees (+ = down), fold 0..1 shortens wing
  function owlDraw(R, st) {
    const wa = st.wing ?? -6, fold = st.fold ?? 0;
    const wing = (side) => {
      R.save(); R.translate(side * 8, -7); R.scale(side, 1); R.rotate(wa * DEG); R.scale(1 - 0.35 * fold, 1 - 0.1 * fold);
      R.part(OS.wing);
      for (let i = 0; i < 5; i++) { R.save(); R.translate(39 + i * 2.2, -5 + i * 1.6); R.rotate((-14 + i * 11) * DEG); R.part(OS.prim); R.restore(); }
      R.restore();
    };
    R.save();
    R.translate(0, -20); // centre the bird around its body
    wing(-1); wing(1);
    R.save(); R.translate(0, 15); R.part(OS.tail); R.restore();
    R.part(OS.body);
    for (const [x, y] of [[-4, -2], [4, -2], [0, 3], [-5, 7], [5, 7], [0, 11]]) { R.save(); R.translate(x, y); R.detail(OS.v, { fill: true, a: 0.55, clip: true }); R.restore(); }
    R.save(); R.translate(0, -13); R.part(OS.head);
    for (const s of [-1, 1]) {
      R.save(); R.translate(s * 5, -7.5); R.detail(OS.disc, { w: 0.9, a: 0.7 }); R.detail(OS.eye, { w: 1.2 }); R.save(); R.translate((st.look || 0) * 0.8, 0); R.detail(OS.pupil, { fill: true }); R.restore(); R.restore();
    }
    R.save(); R.translate(0, -4.5); R.detail(OS.beak, { fill: true, a: 0.9 }); R.restore();
    R.restore();
    R.restore();
  }
  // wing motion over time: occasional flaps between glides
  function owlWing(t, flapEvery = 2.6, flaps = 2, rate = 2.2) {
    const local = t % flapEvery, dur = flaps / rate;
    if (local < dur) { const ph = local * rate; return { wing: -6 + 32 * Math.sin(ph * TAU - Math.PI / 2) * -1, fold: Math.max(0, Math.sin(ph * TAU)) * 0.4 }; }
    return { wing: -6 + 2 * Math.sin(t * 1.7), fold: 0 };
  }

  /* ------------------------------------------------------------------ small flock bird (direct drawing) */
  function bird(ctx, x, y, s, flap, heading = 0) {
    const f = Math.sin(flap);
    const ch = Math.cos(heading), sh = Math.sin(heading) * 0.35;
    const P = (dx, dy) => [x + dx * ch - dy * sh, y + dy + dx * sh];
    const a = P(-s, -s * 0.55 * f), b = P(-s * 0.45, -s * 0.25 - s * 0.2 * f), c = P(0, 0), d = P(s * 0.45, -s * 0.25 - s * 0.2 * f), e = P(s, -s * 0.55 * f);
    ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(b[0], b[1], c[0], c[1]); ctx.quadraticCurveTo(d[0], d[1], e[0], e[1]);
  }


  /* ------------------------------------------------------------------ TIGER EYE (close-up)
     Normalised coords: eye corners at u = ±1, v down. o = openness 0..1.     */
  const EYE = {
    // cubic bezier helpers for the lids
    lid(o, upper) {
      return upper
        ? [[-1, 0.06], [-0.52, -0.78 * o], [0.42, -0.84 * o], [1, -0.1]]
        : [[-1, 0.06], [-0.42, 0.5 * o], [0.5, 0.44 * o], [1, -0.1]];
    },
    bez(c, t) { const m = 1 - t; return [m * m * m * c[0][0] + 3 * m * m * t * c[1][0] + 3 * m * t * t * c[2][0] + t * t * t * c[3][0], m * m * m * c[0][1] + 3 * m * m * t * c[1][1] + 3 * m * t * t * c[2][1] + t * t * t * c[3][1]]; },
    fur: null,
    // static fur field: [u, v, angle, len, brightness]
    makeFur(n = 2600) {
      const r = G.WQ.L.mulberry32(5), nz = G.WQ.L.makeNoise(9), out = [];
      while (out.length < n) {
        const u = (r() * 2 - 1) * 2.7, v = (r() * 2 - 1) * 2.0;
        if ((u / 2.7) ** 2 + (v / 2.0) ** 2 > 1) continue;
        // skip inside the (fully open) eye + margin
        const up = EYE.lidY(1, u, true), lo = EYE.lidY(1, u, false);
        if (Math.abs(u) < 1.08 && v > up - 0.1 && v < lo + 0.1) continue;
        const ang = Math.atan2(v * 0.8, u) * 0.45 + 0.15 + 0.5 * nz.n2(u * 0.8, v * 0.8);
        let b = 0.42 + 0.12 * nz.n2(u * 3, v * 3);
        if (v < -0.42 && v > -1.15 && Math.abs(u + 0.1) < 0.95) b = 0.88;               // white brow patch
        const st = Math.sin(4.2 * (u * 0.55 + v * 0.95) + 1.6 * nz.n2(u * 1.3, v * 1.3));  // stripes
        if (st > 0.5 && !(v < -0.42 && v > -1.15 && Math.abs(u + 0.1) < 0.95)) b = 0.06;
        if (Math.abs(u) < 1.1 && (Math.abs(v - up) < 0.18 || Math.abs(v - lo) < 0.14)) b = 0.04; // dark rim
        if (u < -1 && u > -1.5 && v > 0.05 && v < 0.6 && Math.abs(v - 0.05 - (-(u + 1)) * 0.9) < 0.12) b = 0.03; // tear line
        out.push([u, v, ang, 0.07 + r() * 0.13, b, r() * 6.28]);
      }
      return out;
    },
    // y of a lid at horizontal position u (by bisection on the bezier)
    lidY(o, u, upper) {
      const c = EYE.lid(o, upper); let a = 0, b = 1;
      for (let i = 0; i < 18; i++) { const m = (a + b) / 2; if (EYE.bez(c, m)[0] < u) a = m; else b = m; }
      return EYE.bez(c, (a + b) / 2)[1];
    },
    // st: {o: openness, pupil: 0..1, lx, ly: gaze, alpha, t}
    draw(ctx, cx, cy, R, st) {
      if (!EYE.fur) EYE.fur = EYE.makeFur();
      const o = st.o ?? 1, a = st.alpha ?? 1, t = st.t || 0;
      ctx.save(); ctx.translate(cx, cy); ctx.globalAlpha = a;
      // fur strokes (skipped when st.noFur — use EYE.furLayer() cached instead)
      ctx.lineCap = "round"; ctx.lineWidth = Math.max(1, R * 0.012);
      if (!st.noFur) for (const [u, v, ang, len, b, ph] of EYE.fur) {
        if (b < 0.08) continue;
        ctx.strokeStyle = `rgba(255,255,255,${(b * 0.42 * (st.fur ?? 1) * (0.88 + 0.12 * Math.sin(t * 1.3 + ph))).toFixed(3)})`;
        ctx.beginPath(); ctx.moveTo(u * R, v * R); ctx.lineTo((u + Math.cos(ang) * len) * R, (v + Math.sin(ang) * len) * R); ctx.stroke();
      }
      // eye opening path
      const U = EYE.lid(o, true), Lo = EYE.lid(o, false);
      const P = (p) => [p[0] * R, p[1] * R];
      const open = new Path2D();
      open.moveTo(...P(U[0])); open.bezierCurveTo(...P(U[1]), ...P(U[2]), ...P(U[3]));
      open.bezierCurveTo(...P(Lo[2]), ...P(Lo[1]), ...P(Lo[0])); open.closePath();
      // dark socket so fur doesn't show through
      ctx.fillStyle = "#020203"; ctx.fill(open);
      if (o > 0.02) {
        ctx.save(); ctx.clip(open);
        const ix = (0.02 + (st.lx || 0) * 0.22) * R, iy = (-0.05 + (st.ly || 0) * 0.1) * R, ir = 0.58 * R, pr = ir * (st.pupil ?? 0.42);
        const g = ctx.createRadialGradient(ix, iy, pr, ix, iy, ir);
        g.addColorStop(0, "#9a9a9a"); g.addColorStop(0.35, "#6d6d6d"); g.addColorStop(0.85, "#3b3b3b"); g.addColorStop(1, "#0c0c0c");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ix, iy, ir, 0, TAU); ctx.fill();
        // iris fibres
        const r2 = G.WQ.L.mulberry32(3);
        ctx.lineWidth = Math.max(0.8, R * 0.008);
        for (let k = 0; k < 170; k++) {
          const th = (k / 170) * TAU + r2() * 0.03, r0 = pr * (1.02 + r2() * 0.1), r1 = ir * (0.7 + r2() * 0.28), w = (r2() - 0.5) * 0.12;
          ctx.strokeStyle = `rgba(255,255,255,${(0.07 + r2() * 0.2).toFixed(3)})`;
          ctx.beginPath(); ctx.moveTo(ix + Math.cos(th) * r0, iy + Math.sin(th) * r0);
          ctx.quadraticCurveTo(ix + Math.cos(th + w) * (r0 + r1) / 2, iy + Math.sin(th + w) * (r0 + r1) / 2, ix + Math.cos(th) * r1, iy + Math.sin(th) * r1); ctx.stroke();
        }
        ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(ix, iy, pr, 0, TAU); ctx.fill();
        // catch-lights
        ctx.fillStyle = "rgba(255,255,255,0.92)"; ctx.beginPath(); ctx.ellipse(ix - ir * 0.28, iy - ir * 0.3, ir * 0.13, ir * 0.09, -0.5, 0, TAU); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.beginPath(); ctx.ellipse(ix + ir * 0.3, iy + ir * 0.28, ir * 0.06, ir * 0.04, -0.5, 0, TAU); ctx.fill();
        // upper-lid shadow
        const sg = ctx.createLinearGradient(0, -0.8 * R, 0, 0.1 * R); sg.addColorStop(0, "rgba(0,0,0,0.75)"); sg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = sg; ctx.fillRect(-R, -R, 2 * R, R * 1.1);
        ctx.restore();
      }
      // lid lines: dark liner + bright rim
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#000"; ctx.lineWidth = R * 0.07; ctx.stroke(open);
      const up = new Path2D(); up.moveTo(...P(U[0])); up.bezierCurveTo(...P(U[1]), ...P(U[2]), ...P(U[3]));
      const lo = new Path2D(); lo.moveTo(...P(Lo[0])); lo.bezierCurveTo(...P(Lo[1]), ...P(Lo[2]), ...P(Lo[3]));
      ctx.save(); ctx.translate(0, -R * 0.045); ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = Math.max(1.2, R * 0.016); ctx.stroke(up); ctx.restore();
      ctx.save(); ctx.translate(0, R * 0.04); ctx.strokeStyle = "rgba(255,255,255,0.55)"; ctx.lineWidth = Math.max(1, R * 0.012); ctx.stroke(lo); ctx.restore();
      ctx.restore();
    },
    // pre-rendered fur (static) for a given eye size; returns {cv, x, y, w, h} relative to centre
    furLayer(R, q = 1, k = 1, grain = null) {
      const key = R.toFixed(1) + "|" + q + "|" + k;
      EYE._fl = EYE._fl || {};
      if (EYE._fl[key]) return EYE._fl[key];
      if (!EYE.fur) EYE.fur = EYE.makeFur();
      const w = 5.6 * R, h = 4.3 * R, cv = document.createElement("canvas");
      cv.width = Math.ceil(w * q); cv.height = Math.ceil(h * q);
      const g = cv.getContext("2d"); g.scale(q, q); g.translate(w / 2, h / 2); g.lineCap = "round"; g.lineWidth = Math.max(1, R * 0.012);
      for (const [u, v, ang, len, b] of EYE.fur) {
        if (b < 0.08) continue;
        g.strokeStyle = `rgba(246,244,236,${(b * 0.42 * k).toFixed(3)})`;
        g.beginPath(); g.moveTo(u * R, v * R); g.lineTo((u + Math.cos(ang) * len) * R, (v + Math.sin(ang) * len) * R); g.stroke();
      }
      if (grain) { g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = "destination-out"; g.globalAlpha = 0.55; g.fillStyle = g.createPattern(grain, "repeat"); g.fillRect(0, 0, cv.width, cv.height); }
      return (EYE._fl[key] = { cv, x: -w / 2, y: -h / 2, w, h });
    },
    // geometric point set for particles: returns n points at openness o
    points(n, o = 1, lx = 0, pupil = 0.42) {
      if (!EYE.fur) EYE.fur = EYE.makeFur();
      const out = new Float32Array(2 * n), r = G.WQ.L.mulberry32(17);
      const U = EYE.lid(o, true), Lo = EYE.lid(o, false);
      const ix = 0.02 + lx * 0.22, iy = -0.05, ir = 0.58;
      for (let i = 0; i < n; i++) {
        const k = r(); let x, y;
        if (k < 0.22) { [x, y] = EYE.bez(U, r()); y -= 0.04; }
        else if (k < 0.36) { [x, y] = EYE.bez(Lo, r()); y += 0.03; }
        else if (k < 0.5) { const a = r() * TAU; x = ix + Math.cos(a) * ir; y = iy + Math.sin(a) * ir; }
        else if (k < 0.6) { const a = r() * TAU; x = ix + Math.cos(a) * ir * pupil; y = iy + Math.sin(a) * ir * pupil; }
        else if (k < 0.8) { const a = r() * TAU, rr = ir * (pupil + r() * (0.98 - pupil)); x = ix + Math.cos(a) * rr; y = iy + Math.sin(a) * rr; }
        else { const f = EYE.fur[(r() * EYE.fur.length) | 0]; if (f[4] < 0.3) { i--; continue; } const s = r() * f[3]; x = f[0] + Math.cos(f[2]) * s; y = f[1] + Math.sin(f[2]) * s; }
        // keep iris points inside the opening
        if (k >= 0.36 && k < 0.8) { const a2 = EYE.lidY(o, x, true), b2 = EYE.lidY(o, x, false); if (y < a2) y = a2; if (y > b2) y = b2; }
        out[2 * i] = x; out[2 * i + 1] = y;
      }
      return out;
    },
  };

  /* ------------------------------------------------------------------ IBEX (side view)
     A wild mountain goat: stocky body, short strong legs, a beard, and long
     ridged horns sweeping back in an arc. Poses: stand, graze, alert, gallop. */
  const XS = {
    hind: B([[4, -14], [-12, -15.5], [-27, -15], [-37, -11], [-42, -3], [-40, 7], [-31, 12], [-17, 10.5], [-4, 11.5], [4, 9]]),
    chest: B([[-8, -15.5], [8, -17], [21, -16], [30, -11], [33, 1], [29, 12], [17, 17], [4, 14.5], [-8, 10]]),
    neck: Cap(22, 11, 8.2),
    head: B([[-5, -5], [0, -7.5], [7, -6.8], [13, -4.2], [18.5, -1.6], [20, 1.2], [18.2, 3.8], [12, 5], [5, 5.6], [-3, 4.6]]),
    beard: Shape.leaf(8, 2.4, 0.03, 0.5, 0.6),
    ear: Shape.leaf(8.5, 2.6, 0.01, 0.6, 0.7),
    tail: Cap(7, 2.8, 1.6),
    upper: Cap(15, 8, 4.9), fore: Cap(17, 4, 3.1), cannon: Cap(11, 3.1, 2.9), hoof: Cap(3.5, 3.1, 3.3),
    thigh: Cap(19, 11.8, 6), shin: Cap(19, 5.4, 3.4), meta: Cap(14, 3.3, 2.9), hhoof: Cap(3.5, 3.1, 3.3),
    h1: Cap(10, 2.9, 2.5), h2: Cap(10, 2.5, 2.1), h3: Cap(10, 2.1, 1.7), h4: Cap(9, 1.7, 1.2), h5: Cap(8, 1.2, 0.4),
    knob: Shape.poly([[-0.4, -2.3], [0.4, -2.3], [0.4, 2.3], [-0.4, 2.3]]),
    eye: E(0, 0, 1.6, 1.25), nose: E(0, 0, 1.3, 1.1),
  };
  const IBEX_KEYS = { gallop: DEER_KEYS.gallop.map((k) => ({ ...k, h: k.h * 0.66, nk: k.nk + 8, tl: -130, ear: -150 })) };
  const IBEX_STATIC = {
    stand: { h: 51, p: 0, f: 0, fu: 2, ff: -2, fp: 2, th: 22, sh: -28, mt: 2, hp: 5, nk: -50, hd: 40, tl: -128, ear: -150 },
    graze: { h: 50, p: 3, f: 2, fu: 4, ff: -2, fp: 2, th: 22, sh: -28, mt: 2, hp: 5, nk: 52, hd: 84, tl: -125, ear: -165 },
    alert: { h: 52, p: -3, f: -2, fu: 0, ff: -2, fp: 2, th: 20, sh: -28, mt: 2, hp: 5, nk: -68, hd: 26, tl: -112, ear: -118 },
  };
  function ibexDraw(R, P, Q) {
    Q = Q || P;
    R.save();
    R.translate(0, -P.h); R.rotate(P.p * DEG);
    const hind = (k, layer) => { R.save(); R.rotate(-P.f * DEG); R.translate(-29, 0); R.chain([[XS.thigh, 19, A(k.th)], [XS.shin, 19, A(k.sh)], [XS.meta, 14, A(k.mt)], [XS.hhoof, 3.5, A(k.hp)]], layer); R.restore(); };
    const front = (k, layer) => { R.save(); R.rotate(P.f * DEG); R.translate(20, 6); R.chain([[XS.upper, 15, A(k.fu)], [XS.fore, 17, A(k.ff)], [XS.cannon, 11, A(k.fp)], [XS.hoof, 3.5, A(k.fp)]], layer); R.restore(); };
    hind(Q, 1); front(Q, 1);
    R.save(); R.rotate(-P.f * DEG); R.translate(-39, -9); R.aim(P.tl * DEG); R.part(XS.tail); R.restore();
    R.save(); R.rotate(-P.f * DEG); R.part(XS.hind); R.restore();
    R.save(); R.rotate(P.f * DEG); R.part(XS.chest);
    R.translate(24, -8); R.aim(P.nk * DEG); R.part(XS.neck); R.translate(21, 0); R.aim(P.hd * DEG);
    // horns: five tapering segments bending back, with ridges on the near horn
    const horn = (layer, dx, da) => {
      R.save(); R.translate(1 + dx, -6); R.aim((P.hd - 122 + da) * DEG);
      const segs = [XS.h1, XS.h2, XS.h3, XS.h4, XS.h5], lens = [10, 10, 9.5, 9, 8];
      for (let i = 0; i < 5; i++) {
        R.part(segs[i], layer);
        if (!layer && i < 4) for (const kx of [3, 7]) { R.save(); R.translate(kx, 0); R.detail(XS.knob, { w: 0.7, a: 0.6 }); R.restore(); }
        R.translate(lens[i], 0); R.rotate(-19 * DEG);
      }
      R.restore();
    };
    horn(1, 2.5, 6);
    R.save(); R.translate(1, -3); R.rotate((P.ear + 12) * DEG); R.part(XS.ear, 1); R.restore();
    R.part(XS.head);
    R.save(); R.translate(9, 4.4); R.rotate(84 * DEG); R.part(XS.beard); R.restore();
    horn(0, 0, 0);
    R.save(); R.translate(0, -3); R.rotate(P.ear * DEG); R.part(XS.ear); R.restore();
    R.save(); R.translate(8.5, -2); R.detail(XS.eye, { fill: true }); R.restore();
    R.save(); R.translate(19, 0.8); R.detail(XS.nose, { fill: true, a: 0.8 }); R.restore();
    R.restore();
    hind(P, 0); front(P, 0);
    R.restore();
  }

  /* ------------------------------------------------------------------ SNOW LEOPARD
     Side-view body like the big cats but smaller head, big paws, open rosettes
     and a very long, thick tail. o.noHead leaves the head out (so a front-facing
     face can be drawn instead with C.snow.face). P.tails (7 angles) can set the
     tail shape directly, e.g. wrapped round the paws when sitting.           */
  const SS = {
    hind: B([[4, -15], [-14, -16.5], [-30, -16.5], [-43, -12.5], [-50, -3], [-47, 10], [-36, 15], [-21, 13], [-6, 15], [4, 12]]),
    chest: B([[-10, -17], [8, -19], [24, -18.5], [34, -14], [41, -4], [40, 10], [31, 21], [16, 24], [2, 20], [-10, 14]]),
    neck: Cap(12, 15, 13),
    head: B([[-8, -5], [-3, -11], [5, -12.5], [12, -10.5], [16.5, -6.5], [19, -2.5], [20, 1.5], [18, 5.5], [13, 8.5], [6, 11], [-1, 11.5], [-7, 8], [-10, 2]]),
    ear: B([[-3.8, 0.5], [-3.6, -3.6], [0, -5.4], [3.6, -3.6], [3.8, 0.5]]),
    tail: Cap(15, 7.4, 7), tailTip: Cap(14, 7, 5.6),
    upper: Cap(22, 10.5, 7.4), fore: Cap(19, 6.8, 5.6), fpaw: Cap(8, 6.4, 6.8),
    thigh: Cap(25, 14, 7.5), shin: Cap(21, 7, 4.6), meta: Cap(13, 4.6, 4.4), hpaw: Cap(7.5, 5.4, 5.8),
    eye: B([[-2.4, 0.2], [0, -1.5], [2.6, -0.4], [0.4, 1.1]]), nose: B([[-2.2, -1.3], [2.2, -1.3], [0, 1.6]]),
    ring: Shape.ellipse(0, 0, 1, 0.8, 12), dot: E(0, 0, 0.55, 0.5, 8),
  };
  const SNOW_H = [], SNOW_C = [];
  (function () {
    const r = G.WQ.L.mulberry32(41);
    for (let i = 0; i < 16; i++) SNOW_H.push([-6 - r() * 40, -12 + r() * 22, 2.4 + r() * 1.8]);
    for (let i = 0; i < 13; i++) SNOW_C.push([-4 + r() * 40, -14 + r() * 28, 2.2 + r() * 1.8]);
  })();
  const SNOW_KEYS = { walk: TIGER_KEYS.walk.map((k) => ({ ...k, h: k.h - 3, nk: k.nk + 8, tl: 172, tc: -6 })) };
  const SNOW_STATIC = {
    stand: { h: 47, p: 0, f: 0, fu: 2, ff: -3, fp: 85, th: 25, sh: -30, mt: 8, hp: 85, nk: -10, hd: 12, tl: 150, tc: 10, ear: 0 },
    sit: { h: 36, p: -45, f: 4, fu: 4, ff: -4, fp: 84, th: 84, sh: -98, mt: 86, hp: 92, nk: -64, hd: 6, tl: 100, tc: 0, ear: -4 },
  };
  // sitting: the tail rests on the ground behind, its tip curled up (and flicking)
  const SIT_TAIL = [174, 179, 183, 188, 198, 226, 256];
  function snowDraw(R, P, Q, t = 0, o = {}) {
    Q = Q || P;
    R.save();
    R.translate(0, -P.h); R.rotate(P.p * DEG);
    const hind = (k, layer) => { R.save(); R.rotate(-P.f * DEG); R.translate(-36, -2); R.chain([[SS.thigh, 25, A(k.th)], [SS.shin, 21, A(k.sh)], [SS.meta, 13, A(k.mt)], [SS.hpaw, 7.5, A(k.hp)]], layer); R.restore(); };
    const front = (k, layer) => { R.save(); R.rotate(P.f * DEG); R.translate(26, 6); R.chain([[SS.upper, 22, A(k.fu)], [SS.fore, 19, A(k.ff)], [SS.fpaw, 8, A(k.fp)]], layer); R.restore(); };
    if (!o.headOnly) {
      hind(Q, 1); front(Q, 1);
      // the long thick tail: 7 segments, a slow wave travelling to the tip
      R.save(); R.rotate(-P.f * DEG); R.translate(-48, -9);
      const segs = [];
      for (let i = 0; i < 7; i++) {
        const base = P.tails ? P.tails[i] : P.tl + (P.tc * i * i) / 6;
        segs.push([i < 6 ? SS.tail : SS.tailTip, 14.5, (base + (P.tails ? 3 : 6) * Math.sin(t * (P.tails ? 1.6 : 3.2) - i * 0.7) * (i / 6)) * DEG]);
      }
      R.chain(segs);
      R.restore();
      const ros = (list) => { for (const [x, y, r] of list) { R.save(); R.translate(x, y); R.scale(r, r); R.detail(SS.ring, { w: 0.8, a: 0.75, clip: true }); R.detail(SS.dot, { fill: true, a: 0.5, clip: true }); R.restore(); } };
      R.save(); R.rotate(-P.f * DEG); R.part(SS.hind); ros(SNOW_H); R.restore();
    }
    R.save(); R.rotate(P.f * DEG);
    if (!o.headOnly) { R.part(SS.chest); ros2(R, SNOW_C); }
    R.translate(33, -7); R.aim(P.nk * DEG);
    if (!o.headOnly) R.part(SS.neck);
    R.translate(12, 0); R.aim(P.hd * DEG);
    if (!o.noHead) {
      R.save(); R.translate(5, -10.5); R.rotate((P.ear + 12) * DEG); R.part(SS.ear, 1); R.restore();
      R.part(SS.head);
      R.save(); R.translate(1, -10); R.rotate(P.ear * DEG); R.part(SS.ear); R.restore();
      R.save(); R.translate(11.5, -4.5); R.detail(SS.eye, { fill: true }); R.restore();
      R.save(); R.translate(18.5, 0.5); R.detail(SS.nose, { fill: true }); R.restore();
      for (const [x, y] of [[2, -8], [-2, -4], [6, -9], [0, 3], [-4, 5]]) { R.save(); R.translate(x, y); R.detail(SS.dot, { fill: true, a: 0.55, clip: true }); R.restore(); }
    } else R.part(Shape.ellipse(0, 0, 0.01, 0.01, 4)); // keeps the part list stable
    R.restore();
    if (!o.headOnly) { hind(P, 0); front(P, 0); }
    R.restore();
  }
  function ros2(R, list) { for (const [x, y, r] of list) { R.save(); R.translate(x, y); R.scale(r, r); R.detail(SS.ring, { w: 0.8, a: 0.75, clip: true }); R.detail(SS.dot, { fill: true, a: 0.5, clip: true }); R.restore(); } }
  /* the face, seen from the front (it turns to look at you). (x, y) = face
     centre, s = px per unit; o: {open 0..1 (blink), turn 0..1, alpha, color, bg} */
  const FACE = splineClosed([[-15, -4], [-13, -11], [-7, -14.5], [0, -15.5], [7, -14.5], [13, -11], [15, -4], [16, 3], [12.5, 9], [6.5, 12.5], [0, 13.5], [-6.5, 12.5], [-12.5, 9], [-16, 3]]);
  function splineClosed(cp) { return G.WQ.L.splinePts(cp, true, 6); }
  function snowFace(ctx, x, y, s, o = {}) {
    const a = o.alpha ?? 1, col = o.color || "246,244,236", open = o.open ?? 1, sx = 0.55 + 0.45 * (o.turn ?? 1);
    ctx.save(); ctx.translate(x, y); ctx.scale(s * sx, s); ctx.lineJoin = "round"; ctx.lineCap = "round";
    const stroke = (w, al = 1) => { ctx.strokeStyle = `rgba(${col},${0.2 * a * al})`; ctx.lineWidth = (w * 2.2) / s; ctx.stroke(); ctx.strokeStyle = `rgba(${col},${0.9 * a * al})`; ctx.lineWidth = w / s; ctx.stroke(); };
    // ears (behind the head), then the face shape filled with the board colour
    for (const sd of [-1, 1]) {
      ctx.beginPath(); ctx.ellipse(sd * 11, -12.5, 4.6, 5.2, sd * 0.5, 0, TAU); ctx.fillStyle = o.bg || "#0d0f0f"; ctx.globalAlpha = Math.min(1, a * 1.4); ctx.fill(); ctx.globalAlpha = 1; stroke(1.25);
      ctx.beginPath(); ctx.ellipse(sd * 11, -11.8, 2.2, 2.8, sd * 0.5, 0, TAU); stroke(0.8, 0.5);
    }
    ctx.beginPath(); FACE.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.closePath();
    ctx.fillStyle = o.bg || "#0d0f0f"; ctx.globalAlpha = Math.min(1, a * 1.4); ctx.fill(); ctx.globalAlpha = 1; stroke(1.35);
    // fur markings: small spots on the forehead and cheeks
    ctx.fillStyle = `rgba(${col},${0.5 * a})`;
    for (const [px, py, r] of [[-2.5, -11, 0.9], [2.5, -11.5, 0.8], [0, -8.5, 0.7], [-6, -9.5, 0.75], [6, -9.8, 0.75], [-11, 2, 0.8], [11, 2.5, 0.8], [-12.5, -2, 0.7], [12.5, -1.5, 0.7]]) { ctx.beginPath(); ctx.arc(px, py, r, 0, TAU); ctx.fill(); }
    // eyes: pale almond eyes with round pupils; `open` closes them (a slow cat blink)
    for (const sd of [-1, 1]) {
      const ex = sd * 6, ey = -3, w = 3.7, h = 2.5 * Math.max(0.04, open);
      ctx.beginPath(); ctx.moveTo(ex - w, ey); ctx.quadraticCurveTo(ex, ey - 2 * h, ex + w, ey - 0.4); ctx.quadraticCurveTo(ex, ey + 1.6 * h, ex - w, ey); ctx.closePath();
      if (open > 0.15) {
        ctx.save(); ctx.clip(); ctx.fillStyle = `rgba(${col},${0.22 * a})`; ctx.fillRect(ex - w, ey - 3, 2 * w, 6);
        ctx.fillStyle = `rgba(4,5,5,${a})`; ctx.beginPath(); ctx.arc(ex + sd * 0.2, ey - 0.2, 1.45, 0, TAU); ctx.fill();
        ctx.fillStyle = `rgba(255,255,250,${0.9 * a})`; ctx.beginPath(); ctx.arc(ex + sd * 0.2 - 0.5, ey - 0.8, 0.45, 0, TAU); ctx.fill(); ctx.restore();
      }
      stroke(1.1);
      ctx.beginPath(); ctx.moveTo(ex - sd * 3.6, ey + 0.4); ctx.quadraticCurveTo(ex - sd * 4.2, ey + 3.4, ex - sd * 2.6, ey + 5.2); stroke(0.7, 0.45); // tear line
    }
    // nose, mouth, whisker pads, whiskers
    ctx.beginPath(); ctx.moveTo(-2.3, 3.3); ctx.lineTo(2.3, 3.3); ctx.lineTo(0, 5.8); ctx.closePath(); ctx.fillStyle = `rgba(${col},${0.85 * a})`; ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, 5.8); ctx.lineTo(0, 7.4); ctx.moveTo(0, 7.4); ctx.quadraticCurveTo(-1.6, 9.2, -3.4, 8.4); ctx.moveTo(0, 7.4); ctx.quadraticCurveTo(1.6, 9.2, 3.4, 8.4); stroke(0.9);
    ctx.fillStyle = `rgba(${col},${0.5 * a})`;
    for (const sd of [-1, 1]) for (const [px, py] of [[3.2, 6.7], [4.6, 7.4], [3.6, 8.4]]) { ctx.beginPath(); ctx.arc(sd * px, py, 0.32, 0, TAU); ctx.fill(); }
    for (const sd of [-1, 1]) for (const [dy, len, bend] of [[-0.6, 12, -1.5], [0.8, 13, 0], [2.2, 11, 1.8]]) { ctx.beginPath(); ctx.moveTo(sd * 5.2, 7.2 + dy); ctx.quadraticCurveTo(sd * (5.2 + len * 0.5), 7.2 + dy + bend * 0.4, sd * (5.2 + len), 7.2 + dy + bend); stroke(0.55, 0.55); }
    ctx.restore();
  }

  /* ------------------------------------------------------------------ registry */
  const mk = (draw, keys, statics, farShift = 0.07, shapes = null) => {
    const pose = mkPose(keys, statics);
    return {
      pose, draw, shapes,
      // convenience: full render for gait/static mode at phase
      record(rig, M, mode, phase = 0, extra) {
        rig.begin(M);
        const P = pose(mode, phase);
        let Q;
        if (keys[mode]) Q = pose(mode, phase + farShift);
        else { Q = { ...P }; for (const k of ["fu", "ff", "th", "sh"]) if (k in Q) Q[k] += 8; }
        draw(rig, P, Q, extra);
        return rig;
      },
    };
  };
  G.WQ.C = {
    hare: mk(hareDraw, HARE_KEYS, HARE_STATIC, 0.06, HS),
    wolf: mk(wolfDraw, WOLF_KEYS, WOLF_STATIC, 0.08, WS),
    deer: mk(deerDraw, DEER_KEYS, DEER_STATIC, 0.07, DS),
    tiger: mk(tigerDraw, TIGER_KEYS, TIGER_STATIC, 0.08, TS),
    leopard: mk((R, P, Q, t) => tigerDraw(R, P, Q, t, true), TIGER_KEYS, TIGER_STATIC, 0.08, TS),
    ibex: mk(ibexDraw, IBEX_KEYS, IBEX_STATIC, 0.07, XS),
    snow: Object.assign(mk(snowDraw, SNOW_KEYS, SNOW_STATIC, 0.5, SS), { face: snowFace, SIT_TAIL }),
    owl: { draw: owlDraw, wingAt: owlWing, record(rig, M, st) { rig.begin(M); owlDraw(rig, st); return rig; } },
    bird,
    eye: EYE,
    // make a root matrix: x,y = ground point, s = scale (px per unit), dir = ±1
    root: (x, y, s, dir = 1, rot = 0) => new M2().translate(x, y).rotate(rot).scale(s * dir, s),
  };
})(window);
