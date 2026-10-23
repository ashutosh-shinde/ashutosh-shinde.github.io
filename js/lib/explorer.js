/* =============================================================================
   explorer.js — "the explorer": a minimal chalk stick figure with glasses
   -----------------------------------------------------------------------------
   Circle head, one line for the body, two-segment lines for arms and legs,
   short feet, rectangular glasses, a small backpack.

   Pose fields (degrees). Limb angles are measured from straight DOWN,
   + swings toward the way he faces (so 90 = straight ahead, 180 = straight up).
     h      hip height above the root (units)        lean  body tilt (+ forward)
     nk     head tilt (+ nods forward / toward +x)   look  0 profile … 1 facing you
     arm    [[upper, fore], [upper, fore]]  near, far
     leg    [[thigh, shin, foot], ...]      near, far
   Units: head radius 7; whole figure ≈ 81 units tall (≈ 175 cm → 1 u ≈ 2.2 cm).

   API
     SM.draw(ctx, pose, M, opts)   draw with root matrix M (C.root / L.M2)
     SM.joints(pose, M)            named points (hands, feet, hip, head…)
     SM.reach(pose, 'arm'|'leg', i, target, bend)   two-bone IK (figure frame)
     SM.mix(a, b, t)  SM.cyc(keys, phase)  SM.keys(list, t)   pose blending
     SM.dance(t)                   the dance from the reference video
   ============================================================================= */
(function (G) {
  "use strict";
  const { DEG, TAU, lerp, clamp } = G.WQ.L;
  const U = { r: 7, neck: 3, torso: 26, ua: 14, fa: 13, th: 19, sh: 19, ft: 6 };
  const dirv = (deg) => [Math.sin(deg * DEG), Math.cos(deg * DEG)]; // angle-from-down → vector (x fwd, y down)

  function joints(p, M) {
    const P = (x, y) => M.apply(x, y), hip = [0, -p.h];
    const sp = [Math.sin(p.lean * DEG), -Math.cos(p.lean * DEG)];
    const sh = [hip[0] + sp[0] * U.torso, hip[1] + sp[1] * U.torso];
    const ha = (p.lean + (p.nk || 0)) * DEG, hd = [Math.sin(ha), -Math.cos(ha)];
    const head = [sh[0] + hd[0] * (U.neck + U.r), sh[1] + hd[1] * (U.neck + U.r)];
    const limb = (o, segs) => { const out = [o]; let c = o; for (const [len, a] of segs) { const v = dirv(a); c = [c[0] + v[0] * len, c[1] + v[1] * len]; out.push(c); } return out; };
    const arms = p.arm.map(([a, b]) => limb(sh, [[U.ua, a], [U.fa, b]]));
    const legs = p.leg.map(([a, b, f]) => limb(hip, [[U.th, a], [U.sh, b], [U.ft, f ?? 90]]));
    const w = (q) => P(q[0], q[1]);
    return {
      hip: w(hip), sh: w(sh), neckTop: w([sh[0] + hd[0] * U.neck, sh[1] + hd[1] * U.neck]), head: w(head), headAng: ha,
      arms: arms.map((l) => l.map(w)), legs: legs.map((l) => l.map(w)), s: M.sx, flip: M.a < 0 ? -1 : 1,
      local: { hip, sh, head, arms, legs, sp }, M,
    };
  }

  // chalk-ish line helper (soft halo + core), pts in screen px
  function line(ctx, pts, w, a, color) {
    if (a <= 0.002) return;
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.strokeStyle = `rgba(${color},${0.22 * a})`; ctx.lineWidth = w * 2.3; ctx.stroke();
    ctx.strokeStyle = `rgba(${color},${a})`; ctx.lineWidth = w; ctx.stroke();
  }
  function circle(ctx, c, r, w, a, color, fill) {
    ctx.beginPath(); ctx.arc(c[0], c[1], r, 0, TAU);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    ctx.strokeStyle = `rgba(${color},${0.22 * a})`; ctx.lineWidth = w * 2.3; ctx.stroke();
    ctx.strokeStyle = `rgba(${color},${a})`; ctx.lineWidth = w; ctx.stroke();
  }
  function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  // glasses: profile = one lens at the front + temple arm; front = two lenses + bridge
  function glasses(ctx, J, p, o) {
    const s = J.s, r = U.r * s, f = J.flip, a = o.alpha, col = o.color, lw = Math.max(1, o.width * 0.7);
    ctx.save(); ctx.translate(J.head[0], J.head[1]); ctx.rotate(f * J.headAng); ctx.scale(f, 1);
    const lens = (cx, cy) => {
      if (o.frames === "round") { ctx.beginPath(); ctx.arc(cx, cy, 0.29 * r, 0, TAU); }
      else roundRect(ctx, cx - 0.33 * r, cy - 0.24 * r, 0.66 * r, 0.48 * r, 0.12 * r);
      ctx.fillStyle = `rgba(${col},${0.045 * a})`; ctx.fill();
      ctx.strokeStyle = `rgba(${col},${a})`; ctx.lineWidth = lw; ctx.stroke();
    };
    ctx.lineCap = "round";
    if ((p.look || 0) >= 0.5) {
      lens(-0.4 * r, -0.02 * r); lens(0.4 * r, -0.02 * r);
      ctx.beginPath(); ctx.moveTo(-0.08 * r, -0.08 * r); ctx.quadraticCurveTo(0, -0.18 * r, 0.08 * r, -0.08 * r);
      ctx.moveTo(-0.72 * r, -0.08 * r); ctx.lineTo(-0.96 * r, -0.14 * r); ctx.moveTo(0.72 * r, -0.08 * r); ctx.lineTo(0.96 * r, -0.14 * r);
      ctx.strokeStyle = `rgba(${col},${a})`; ctx.lineWidth = lw; ctx.stroke();
    } else {
      lens(0.6 * r, -0.04 * r);
      ctx.beginPath(); ctx.moveTo(0.27 * r, -0.08 * r); ctx.lineTo(-0.28 * r, -0.04 * r);
      ctx.strokeStyle = `rgba(${col},${a})`; ctx.lineWidth = lw; ctx.stroke();
    }
    ctx.restore();
  }

  // backpack: side view = pack behind the back + shoulder strap; front view = straps + top peeking out
  function backpack(ctx, J, p, o) {
    const L = J.local, M = J.M, a = o.alpha, col = o.color, w = o.width;
    const u = L.sp, f = [-u[1], u[0]]; // up along the spine, forward
    const pt = (along, fwd) => M.apply(L.sh[0] - u[0] * along + f[0] * fwd, L.sh[1] - u[1] * along + f[1] * fwd);
    ctx.save(); ctx.lineJoin = "round"; ctx.lineCap = "round";
    if ((p.look || 0) >= 0.5) {
      line(ctx, [pt(0.5, -2.6), pt(12, -4.2)], w * 0.8, a * 0.85, col);
      line(ctx, [pt(0.5, 2.6), pt(12, 4.2)], w * 0.8, a * 0.85, col);
    } else {
      const A = pt(2, -2), B = pt(2, -10), Cc = pt(19, -10.5), D = pt(20, -2.5);
      ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.lineTo(Cc[0], Cc[1]); ctx.lineTo(D[0], D[1]); ctx.closePath();
      ctx.fillStyle = o.bg; ctx.fill();
      line(ctx, [A, B, Cc, D, A], w, a, col);
      line(ctx, [pt(7, -2.2), pt(7, -10.2)], w * 0.7, a * 0.7, col);          // flap
      line(ctx, [pt(2.2, -2), pt(-0.6, 1.2), pt(6, 2.4)], w * 0.75, a * 0.85, col); // strap over the shoulder
    }
    ctx.restore();
  }

  /* draw the figure. opts: width(px), alpha, color "r,g,b", far (alpha of far
     limbs; 1 = front view), frames 'rect'|'round', bag (default true), bg     */
  function draw(ctx, p, M, o = {}) {
    const J = joints(p, M), s = J.s;
    const op = { width: o.width ?? Math.max(1.4, 1.0 * s), alpha: o.alpha ?? 1, color: o.color || "246,244,236", frames: o.frames || "rect",
      far: o.far ?? ((p.look || 0) >= 0.5 ? 1 : 0.5), bg: o.bg || "#0d0f0f" };
    if (op.alpha <= 0.002) return J;
    ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round";
    const w = op.width, a = op.alpha, c = op.color;
    if (!o.headOnly) {
      line(ctx, J.legs[1], w, a * op.far, c); line(ctx, J.arms[1], w, a * op.far, c);
      if (o.bag !== false) backpack(ctx, J, p, op);
      line(ctx, [J.hip, J.sh, J.neckTop], w, a, c); line(ctx, J.legs[0], w, a, c);
    }
    circle(ctx, J.head, U.r * s, w, a, c, op.bg);
    glasses(ctx, J, p, op);
    if (!o.headOnly) line(ctx, J.arms[0], w, a, c);
    ctx.restore();
    return J;
  }

  /* reach(p, 'arm'|'leg', i, target[x,y] in figure frame, bend ±1): edits the pose
     so that hand/ankle i lands on target (two-bone IK, law of cosines)        */
  function reach(p, kind, i, T, bend = 1) {
    const J = joints(p, new G.WQ.L.M2()).local, o = kind === "arm" ? J.sh : J.hip;
    const l1 = kind === "arm" ? U.ua : U.th, l2 = kind === "arm" ? U.fa : U.sh;
    const dx = T[0] - o[0], dy = T[1] - o[1], d = Math.max(0.5, Math.min(Math.hypot(dx, dy), l1 + l2 - 0.01));
    const base = Math.atan2(dx, dy), al = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
    const a1 = base + bend * al, e = [o[0] + l1 * Math.sin(a1), o[1] + l1 * Math.cos(a1)];
    const a2 = Math.atan2(T[0] - e[0], T[1] - e[1]);
    const seg = (kind === "arm" ? p.arm : p.leg)[i];
    seg[0] = a1 / DEG; seg[1] = a2 / DEG;
    return p;
  }
  const local = (p) => joints(p, new G.WQ.L.M2()).local;

  /* ---------------------------------------------------------- blending */
  const clone = (p) => JSON.parse(JSON.stringify(p));
  function mix(a, b, t) {
    if (typeof a === "number") return a + ((b ?? a) - a) * t;
    if (Array.isArray(a)) return a.map((v, i) => mix(v, b[i], t));
    const o = {}; for (const k in a) o[k] = mix(a[k], b[k] ?? a[k], t); return o;
  }
  function cr(p0, p1, p2, p3, t) {
    if (typeof p1 === "number") return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
    if (Array.isArray(p1)) return p1.map((v, i) => cr(p0[i], v, p2[i], p3[i], t));
    const o = {}; for (const k in p1) o[k] = cr(p0[k] ?? p1[k], p1[k], p2[k] ?? p1[k], p3[k] ?? p1[k], t); return o;
  }
  // periodic Catmull–Rom through evenly spaced keys
  function cyc(keys, phase) { const n = keys.length, f = (((phase % 1) + 1) % 1) * n, i = Math.floor(f); return cr(keys[(i - 1 + n) % n], keys[i], keys[(i + 1) % n], keys[(i + 2) % n], f - i); }
  // timed keys [[t, pose], ...] with an eased hold at each key
  function keys(list, t) {
    if (t <= list[0][0]) return clone(list[0][1]);
    for (let i = 0; i < list.length - 1; i++) {
      const [t0, a] = list[i], [t1, b] = list[i + 1];
      if (t <= t1) { const u = clamp((t - t0) / (t1 - t0), 0, 1); return mix(a, b, u * u * (3 - 2 * u)); }
    }
    return clone(list[list.length - 1][1]);
  }

  /* ---------------------------------------------------------- poses */
  const POSES = {
    standFront: { h: 38, lean: 0, nk: 0, look: 1, arm: [[22, 14], [-22, -14]], leg: [[9, 4, 70], [-9, -4, -70]] },
    stand: { h: 38, lean: 2, nk: 0, look: 0, arm: [[6, 12], [-8, -2]], leg: [[6, -2, 90], [-6, -4, 90]] },
    write: { h: 38, lean: 6, nk: -10, look: 0, arm: [[118, 152], [-6, 8]], leg: [[8, -2, 90], [-12, -16, 90]] },
    run: { h: 36, lean: 14, nk: 4, look: 0, arm: [[-42, 38], [48, 112]], leg: [[42, 22, 100], [-32, -88, -10]] },
    dart: { h: 22, lean: 2, nk: 6, look: 0, arm: [[74, 96], [34, 104]], leg: [[84, 0, 90], [-4, -90, -95]] },
    collar: { h: 19, lean: 34, nk: 22, look: 0, arm: [[62, 28], [44, 16]], leg: [[2, -90, -95], [-6, -92, -95]] },
    axes: { h: 38, lean: 0, nk: 14, look: 1, arm: [[38, 150], [-38, -150]], leg: [[9, 4, 70], [-9, -4, -70]] },
    climb: { h: 38, lean: 0, nk: -18, look: 0, arm: [[168, 176], [132, 168]], leg: [[62, -8, 90], [12, 4, 90]] },
    reachBag: { h: 38, lean: 8, nk: 10, look: 0, arm: [[-60, -10], [-30, -40]], leg: [[6, -2, 90], [-6, -4, 90]] },
    dance: { h: 38, lean: 0, nk: -6, look: 1, arm: [[148, 162], [-148, -162]], leg: [[52, -16, 80], [-6, -2, -70]] },
    dive: { h: 38, lean: 112, nk: -8, look: 0, arm: [[64, 56], [70, 60]], leg: [[-112, -100, -95], [-118, -108, -100]] },
  };
  // running cycle (4 keys, Catmull–Rom)
  const RUN = [
    { h: 36, lean: 14, nk: 4, look: 0, arm: [[-42, 38], [48, 112]], leg: [[42, 22, 100], [-32, -88, -10]] },
    { h: 38.5, lean: 14, nk: 4, look: 0, arm: [[0, 70], [10, 80]], leg: [[8, -30, 80], [10, -60, 30]] },
    { h: 36, lean: 14, nk: 4, look: 0, arm: [[48, 112], [-42, 38]], leg: [[-32, -88, -10], [42, 22, 100]] },
    { h: 38.5, lean: 14, nk: 4, look: 0, arm: [[10, 80], [0, 70]], leg: [[10, -60, 30], [8, -30, 80]] },
  ];

  /* ---------------------------------------------------------- the dance
     From the reference video: a quick dab to each side, arms cross into an X
     over the head, hands up, hands to the chest — then the signature move:
     one hand covers the nose/mouth while the other arm sweeps back and forth
     over the head (~0.66 s per sweep) with a small knee bounce.
     Front view: "near" arm = screen-right (hand on face), "far" = screen-left. */
  const DANCE_INTRO = [
    [0.0, { h: 38, lean: 0, nk: 0, look: 1, arm: [[16, 10], [-16, -10]], leg: [[9, 4, 70], [-9, -4, -70]] }],
    [0.28, { h: 36, lean: -7, nk: -22, look: 1, arm: [[-150, -96], [-126, -126]], leg: [[16, -6, 70], [-6, 2, -70]] }],
    [0.56, { h: 36, lean: 7, nk: 22, look: 1, arm: [[126, 126], [150, 96]], leg: [[6, -2, 70], [-16, 6, -70]] }],
    [0.82, { h: 38, lean: 0, nk: 0, look: 1, arm: [[150, -150], [-150, 150]], leg: [[9, 4, 70], [-9, -4, -70]] }],
    [1.04, { h: 38, lean: 0, nk: -4, look: 1, arm: [[128, 172], [-128, -172]], leg: [[9, 4, 70], [-9, -4, -70]] }],
    [1.26, { h: 37, lean: 0, nk: 6, look: 1, arm: [[26, 168], [-26, -168]], leg: [[10, 2, 70], [-10, -2, -70]] }],
  ];
  const SWEEP_OUT = [-140, -172], SWEEP_OVER = [-176, 98], T_SIG = 1.4, PER = 0.66;
  function dance(t) {
    if (t < T_SIG) return keys(DANCE_INTRO, t);
    const ph = (t - T_SIG) / PER, s = (1 - Math.cos(TAU * ph)) / 2, b = (1 - Math.cos(TAU * ph)) / 2;
    const p = {
      h: 38 - 2.4 * b, lean: 4 * Math.sin(TAU * ph + 0.6), nk: -6 + 9 * Math.sin(TAU * ph), look: 1,
      arm: [[30, 160], [lerp(SWEEP_OUT[0], SWEEP_OVER[0], s), lerp(SWEEP_OUT[1], SWEEP_OVER[1], s)]],
      leg: [[9 + 10 * b, 4 - 14 * b, 70], [-9 - 4 * b, -4 + 7 * b, -70]],
    };
    // ease out of the intro's last pose
    const k = clamp((t - T_SIG) / 0.25, 0, 1), pre = DANCE_INTRO[DANCE_INTRO.length - 1][1];
    const L0 = local(p);
    reach(p, "arm", 0, [L0.head[0] + 1.2, L0.head[1] + 3.4], 1); // hand over nose & mouth
    return k < 1 ? mix(pre, p, k * k * (3 - 2 * k)) : p;
  }

  G.WQ.SM = { U, joints, draw, reach, local, mix, cyc, keys, clone, dance, POSES, RUN, line, circle, DANCE_LEN: 4.4 };
})(window);
