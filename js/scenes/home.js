/* =============================================================================
   Home — "the watcher"                                           (section 1)
   -----------------------------------------------------------------------------
   Intro (plays once per visit, ~8.5 s; any scroll skips straight to the chase):
     0.2  Lyapunov-stability and predictability equations write themselves on
          the left; on the right a spiral draws itself: trajectories falling
          into a stable focus, wrapped in Lyapunov level sets
     2.3  the equations break into chalk dust that streams into the spiral…
     3.1  …and the dust becomes an eye: the watcher. It opens, the pupil
          tightens, the gaze slides right, it blinks
     5.1  the camera pulls back: the eye belongs to a tiger hidden in tall grass;
          a chital stag grazes on the right
     6.3  the stag lifts its head, the tiger launches (WildQuant is written in
          chalk as it leaps), the stag bolts
     7.6  the chase runs along the bottom, for as long as you stay
   Always: an owl glides across the top now and then; faint equations drift.
   The intro (equations, spiral, eye) is drawn on top of the calm zone, so it
   stays bright even near text; the chase is calmed behind the title.
   HOW TO EDIT: timeline T, layout in resize(), chase speed V, owl timing OWL.
   ============================================================================= */
(function (G) {
  "use strict";
  const { L, C, CH, PTS } = G.WQ;
  const { lerp, clamp, smooth, Ease, TAU, M2, Rig, drawOutline, blendPose, mulberry32, fract, makeNoise } = L;
  const INK = "246,244,236", BG = CH.BOARD;
  const T = { spiral: 0.25, dust: 2.3, eye: 3.1, open: 3.3, blink: 4.55, zoom0: 5.1, zoom1: 6.15, alert: 6.3,
              pounce: 6.6, bolt: 6.8, land: 7.55, about: 8.2, chase: 8.6 };
  const OWL = { first: 4.0, every: 27, pass: 10 };        // seconds after the chase starts
  // the intro equations: [id, start, duration] (written in this order)
  const EQS = [["w_lyapunov", 0.15, 0.45], ["lyapunov", 0.4, 0.75], ["stable", 0.85, 0.55], ["w_predict", 1.05, 0.4], ["lyap_exp", 1.25, 0.65], ["pred_time", 1.6, 0.6]];
  const GHOSTS = ["lv_inline", "dynsys", "hopf", "jacobian", "eigen", "basin"];
  // spiral: NA arms falling into the focus, PHI radians long, squashed & tilted like a Lyapunov ellipse
  const NA = 5, PHI = 3.4 * Math.PI, KS = Math.log(30) / PHI, TILT = -0.35, AY = 0.78;

  (G.WQ.scenes = G.WQ.scenes || {}).home = function (env0) {
    let env = env0, W = 0, H = 0, S = 1, portrait = false, mobile = false;
    let CX, CY, RS, RE, GY, SC, TX0, DX0, R1, V, OWLS, eqLay = [], built = false;
    const rT = new Rig(), rD = new Rig(), rO = new Rig(), rTmp = new Rig();
    const nz = makeNoise(31);
    let off = 0, tl = 0, ground = 0, lastReveal = -1, aboutSent = false, stored = false, skipped = false;
    let back = [], clumps = [], ridges = [], ghosts = [], dust = [], arc = [], owlOn = false, lastLand = false;
    let NI = 0, P, PEQ, PEY, dly, armOf, uOf, fur = null;
    const tmp2 = [0, 0];

    // skip the intro if it already played in this browser session (or ?intro=0)
    const qs = new URLSearchParams(G.location.search);
    try { if ((G.sessionStorage.getItem("wq-intro") === "1" && qs.get("intro") !== "1") || qs.get("intro") === "0") off = T.chase + 0.4; } catch (e) { /* storage blocked */ }

    /* ---------------------------------------------------------- choreography */
    const deerChaseX = (t) => W * (portrait ? 0.7 : 0.72) + W * 0.025 * Math.sin(t * 0.37) + W * 0.012 * nz.n2(t * 0.21, 3);
    function deerX(t) {
      if (t < T.bolt) return DX0;
      const u = clamp((t - T.bolt) / 1.4, 0, 1);
      return lerp(DX0, deerChaseX(t), Ease.inOut(u)) + W * 0.045 * Math.sin(Math.PI * u);
    }
    const gap = (t) => W * (portrait ? 0.43 : 0.3) * (1 + 0.1 * Math.sin(t * 0.23 + 1) + 0.05 * nz.n2(t * 0.3, 7));
    function tigerX(t) {
      if (t < T.pounce) return TX0 + W * 0.01 * smooth(T.zoom1, T.pounce, t);
      const x0 = TX0 + W * 0.01, xl = deerX(T.land) - gap(T.land);
      if (t < T.land) { const u = (t - T.pounce) / (T.land - T.pounce); return x0 + (xl - x0) * (0.8 * Ease.out(u) + 0.2 * u); }
      return deerX(t) - gap(t);
    }
    const tigerLift = (t) => (t > T.pounce && t < T.land ? H * (portrait ? 0.06 : 0.085) * Math.sin(Math.PI * (t - T.pounce) / (T.land - T.pounce)) : 0);
    function tigerPose(t) {
      const cr = C.tiger.pose("crouch"), po = C.tiger.pose("pounce");
      if (t < T.pounce) {
        const p = { ...cr }; p.h += 1.2 * Math.sin(t * 2.2) - 3 * smooth(T.pounce - 0.35, T.pounce - 0.05, t); p.hd += 3 * Math.sin(t * 0.7);
        return [p, { ...p, fu: p.fu + 10, th: p.th + 6 }];
      }
      const ph = (t - T.land) / 0.46, g = C.tiger.pose("gallop", ph), g2 = C.tiger.pose("gallop", ph + 0.08);
      if (t < T.land) {
        const u = (t - T.pounce) / (T.land - T.pounce), Pp = blendPose(blendPose(cr, po, smooth(0, 0.3, u)), g, smooth(0.78, 1, u));
        return [Pp, { ...Pp, fu: Pp.fu - 8, th: Pp.th + 6 }];
      }
      return [g, g2];
    }
    function deerPose(t) {
      const gz = C.deer.pose("graze"), al = C.deer.pose("alert");
      gz.nk += 4 * Math.sin(t * 1.1); gz.hd += 5 * Math.sin(t * 1.1 + 0.4);
      if (t < T.bolt) { const Pp = blendPose(gz, al, Ease.inOut(smooth(T.alert, T.alert + 0.45, t))); return [Pp, { ...Pp, fu: Pp.fu + 7, th: Pp.th + 7 }]; }
      const ph = (t - T.bolt) / 0.56, g = C.deer.pose("gallop", ph), g2 = C.deer.pose("gallop", ph + 0.07), k = smooth(0, 0.3, t - T.bolt);
      return [blendPose(al, g, k), blendPose(al, g2, k)];
    }
    const speedAt = (t) => V * smooth(T.bolt - 0.2, T.bolt + 1.0, t);

    /* ---------------------------------------------------------- spiral & eye */
    function spiralPt(arm, u, rot, sc) {
      const ph = PHI * u, r = RS * sc * Math.exp(-KS * ph), th = (arm * TAU) / NA + ph + rot;
      const x = r * Math.cos(th), y = r * Math.sin(th) * AY;
      return [CX + x * Math.cos(TILT) - y * Math.sin(TILT), CY + x * Math.sin(TILT) + y * Math.cos(TILT)];
    }
    function levelPt(rad, th) {
      const x = rad * Math.cos(th), y = rad * Math.sin(th) * AY;
      return [CX + x * Math.cos(TILT) - y * Math.sin(TILT), CY + x * Math.sin(TILT) + y * Math.cos(TILT)];
    }
    const spiralRot = (t) => -0.07 * t;
    const spiralScale = (t) => 1 - 0.6 * Ease.in(smooth(T.eye - 0.5, T.eye + 0.55, t));
    function eyeState(t) {
      const te = t - T.open;
      const o = smooth(0, 0.8, te) * (1 - 0.38 * smooth(1.45, 1.75, te)) * (1 - 0.92 * Math.exp(-(((t - T.blink) / 0.075) ** 2)));
      return { o, pupil: 0.56 - 0.2 * smooth(0.3, 1.0, te), lx: 0.36 * smooth(0.9, 1.4, te) };
    }

    /* ---------------------------------------------------------- build (per size) */
    function build() {
      const r = mulberry32(77);
      // grass behind the animals (world-anchored, wraps)
      back = []; const nb = mobile ? 110 : 240;
      for (let i = 0; i < nb; i++) back.push({ wx: r() * W * 2, h: (5 + r() * 15) * S, lean: (r() - 0.5) * 8 * S, ph: r() * TAU, a: 0.12 + r() * 0.2 });
      // tall-grass clumps in front (the tiger hides behind the first one)
      clumps = [];
      const spots = [[TX0 / W - 0.03, 1.25, 14], [TX0 / W + 0.09, 0.85, 8], [0.52, 0.65, 6], [1.1, 0.9, 9], [1.55, 1.0, 10], [2.05, 0.8, 8], [2.45, 1.05, 10]];
      for (const [fx, hs, n] of spots) for (let k = 0; k < n; k++) clumps.push({ wx: W * fx + (r() - 0.5) * 70 * S, h: H * (portrait ? 0.05 : 0.07 + r() * 0.12) * hs * (portrait ? 1 + r() : 1), lean: (r() - 0.3) * 30 * S, w: (1.6 + r() * 2) * S, ph: r() * TAU });
      ridges = [[0.1, 0.62, 0.07, 0.14, 1.3], [0.28, 0.7, 0.05, 0.2, 4.1]].map(([px, base, amp, a, seed]) => ({ px, base: portrait ? base + 0.12 : base, amp, a, seed }));
      // faint drifting equations
      ghosts = GHOSTS.map((id, i) => ({ id, x0: r() * W, y: H * (0.08 + 0.55 * r()), px: (12 + r() * 8) * S, v: (r() - 0.5) * 9 * S, a: 0.045 + r() * 0.03, ph: r() * TAU }));
      // intro equations: stacked on the left (top on phones), sized to fit
      eqLay = []; const x0 = portrait ? W * 0.07 : Math.max(24, W * 0.055), maxW = portrait ? W * 0.86 : CX - RS * 1.05 - x0;
      let y = portrait ? H * 0.12 : H * 0.2;
      for (const [id, st, du] of EQS) {
        const label = id.startsWith("w_");
        let px = (label ? 15 : 25) * Math.max(0.75, S * (portrait ? 1.05 : 1));
        const w = CH.size(id, px)[0]; if (w > maxW) px *= maxW / w;
        const h = CH.size(id, px)[1];
        if (label && eqLay.length) y += 14 * S;
        eqLay.push({ id, st, du, px, x: x0, y: y + h / 2 });
        y += h + (label ? 6 : 12) * S;
      }
      // intro dust: each particle starts on an equation, flows down a spiral arm, ends on the eye
      NI = mobile ? 420 : 820;
      P = new Float32Array(2 * NI); PEQ = new Float32Array(2 * NI); dly = new Float32Array(NI); armOf = new Uint8Array(NI); uOf = new Float32Array(NI);
      const widths = eqLay.map((e) => CH.size(e.id, e.px)[0]), tot = widths.reduce((a, b) => a + b, 0);
      let k = 0;
      eqLay.forEach((e, i) => {
        const m = i === eqLay.length - 1 ? NI - k : Math.round((NI * widths[i]) / tot), pts = CH.points(e.id, e.px, m, r, "left");
        for (let j = 0; j < m && k < NI; j++, k++) { PEQ[2 * k] = e.x + pts[2 * j]; PEQ[2 * k + 1] = e.y + pts[2 * j + 1]; }
      });
      for (let i = 0; i < NI; i++) { dly[i] = 0.35 * (PEQ[2 * i] / W) + 0.25 * r(); armOf[i] = (r() * NA) | 0; uOf[i] = r(); }
      PEY = C.eye.points(NI, 0.75, 0.15, 0.48);
      for (let i = 0; i < NI; i++) { PEY[2 * i] = CX + PEY[2 * i] * RE; PEY[2 * i + 1] = CY + PEY[2 * i + 1] * RE; }
      fur = C.eye.furLayer(RE, Math.min(2, env.dpr), 0.55, CH.grain());
      built = true;
    }

    /* ---------------------------------------------------------- intro / title events */
    function skipIntro() {
      if (tl >= T.chase) return;
      off += T.chase + 0.3 - tl; tl = T.chase + 0.3; skipped = true;
    }
    function events() {
      const rv = smooth(T.pounce - 0.05, T.pounce + 1.45, tl);
      if (Math.abs(rv - lastReveal) > 0.001 || (rv >= 1 && lastReveal < 1)) { lastReveal = rv; env.emit("reveal", rv); }
      if (!aboutSent && tl >= T.about) { aboutSent = true; env.emit("about"); }
      if (!stored && tl >= T.chase) { stored = true; try { G.sessionStorage.setItem("wq-intro", "1"); } catch (e) { /* ignore */ } }
    }

    /* ---------------------------------------------------------- drawing helpers */
    function blade(ctx, x, gy, h, lean, w, fill, edge) {
      const tx = x + lean, ty = gy - h, cx = x + lean * 0.35, cy = gy - h * 0.55;
      ctx.beginPath(); ctx.moveTo(x - w, gy); ctx.quadraticCurveTo(cx - w * 0.5, cy, tx, ty); ctx.quadraticCurveTo(cx + w * 0.5, cy, x + w, gy); ctx.closePath();
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (edge) { ctx.strokeStyle = edge; ctx.stroke(); }
    }
    const wrap = (wx, span) => ((((wx - ground + 0.3 * W) % span) + span) % span) - 0.3 * W;
    const chalk = (r, o) => drawOutline(o.ctx, r, { width: o.w || 1.4 * Math.max(1, S * 0.8), color: `rgb(${INK})`, bg: BG, occlude: 0.95, far: 0.45, alpha: o.a, grain: CH.grain(), grainA: 0.55 });
    function camAt(t) { // camera: from the eye close-up to the wide shot
      const [tp, tq] = tigerPose(t);
      rTmp.begin(C.root(tigerX(t), GY - tigerLift(t), SC)); C.tiger.draw(rTmp, tp, tq, t);
      const hd = rTmp.parts.find((p) => p.shape === C.tiger.shapes.head), pEye = hd.m.apply(13, -5.5);
      const z = Ease.inOut(smooth(T.zoom0, T.zoom1, t)), k = Math.exp(lerp(Math.log(RE / R1), 0, z));
      const e = [lerp(CX, pEye[0], z), lerp(CY, pEye[1], z)];
      return { M: new M2().translate(e[0], e[1]).scale(k).translate(-pEye[0], -pEye[1]), z, k, e, tp, tq };
    }
    function owlAt(t) {
      const tc = t - T.chase - OWL.first;
      if (tc < 0) return null;
      const u = (tc % OWL.every) / OWL.pass;
      if (u > 1) return null;
      const w = C.owl.wingAt(tc, 2.6, 2, 2.2);
      return { x: lerp(W + 150 * S, -150 * S, u), y: H * (portrait ? 0.075 : 0.12) + 10 * S * Math.sin(tc * 1.3), rot: -0.05 + 0.06 * Math.sin(tc * 0.8), wing: w.wing, fold: w.fold, look: Math.sin(tc * 0.5) };
    }

    return {
      still: T.chase + 3.2,
      resize(e) { env = e; W = e.W; H = e.H; portrait = e.portrait; mobile = e.mobile; S = Math.min(W / 960, H / 540);
        if (portrait) { CX = W * 0.52; CY = H * 0.47; RS = W * 0.46; RE = W * 0.15; }
        else { CX = W * 0.7; CY = H * 0.42; RS = Math.min(H * 0.35, W * 0.25); RE = Math.min(H * 0.19, W * 0.11); }
        GY = portrait ? H * 0.9 : H * 0.865;
        SC = portrait ? W * 0.003 : Math.min(W / 900, H / 520) * 1.12;
        TX0 = W * (portrait ? 0.27 : 0.27); DX0 = W * (portrait ? 0.74 : 0.73);
        R1 = 2.4 * SC; V = W * (portrait ? 1.15 : 0.85); OWLS = Math.max(0.75, S) * 1.45;
        build();
      },
      update(dt, t) {
        if (!built) return;
        if (env.scroll > 0.03 && t + off < T.chase) skipIntro();
        tl = t + off;
        events();
        ground += speedAt(tl) * dt;
        // dust: landing burst + gallop puffs (world x)
        if (tl >= T.land && !lastLand) { lastLand = true; const r = env.rand; for (let i = 0; i < 24; i++) dust.push({ wx: tigerX(tl) + ground + (r() - 0.5) * 60 * SC, y: GY, vx: (r() - 0.5) * 140, vy: -20 - r() * 60, life: 1.1, r: (2 + r() * 4) * S }); }
        const r = env.rand;
        if (tl > T.land && r() < 0.45) dust.push({ wx: tigerX(tl) + ground - 40 * SC, y: GY - 2, vx: -20 + r() * 30, vy: -10 - r() * 25, life: 0.9, r: (1.5 + r() * 3) * S });
        if (tl > T.bolt + 0.3 && r() < 0.35) dust.push({ wx: deerX(tl) + ground - 25 * SC, y: GY - 2, vx: -10 + r() * 20, vy: -8 - r() * 20, life: 0.8, r: (1 + r() * 2.5) * S });
        for (const d of dust) { d.wx += d.vx * dt; d.y += d.vy * dt; d.vy += 30 * dt; d.life -= dt; }
        if (dust.length) dust = dust.filter((d) => d.life > 0 && d.wx - ground > -100);
        if (tl > T.pounce && tl < T.land + 0.05) arc.push([tigerX(tl) + ground + 60 * SC, GY - tigerLift(tl) - 70 * SC]);
        if (tl > T.chase) arc.length = 0;
        // rigs for this frame (also used for the dust transitions)
        const [dp, dq] = deerPose(tl);
        rD.begin(C.root(deerX(tl), GY, SC * 0.92)); C.deer.draw(rD, dp, dq);
        const [tp, tq] = tigerPose(tl);
        rT.begin(C.root(tigerX(tl), GY - tigerLift(tl), SC)); C.tiger.draw(rT, tp, tq, tl);
        const o = owlAt(tl); owlOn = !!o;
        if (o) { rO.begin(C.root(o.x, o.y, OWLS, 1, o.rot)); C.owl.draw(rO, o); }
      },
      draw(ctx, a, pass) {
        if (!built) return;
        const t = tl;
        if (pass === "top") return drawIntro(ctx, a, t);
        // faint drifting equations
        for (const g of ghosts) {
          const x = ((g.x0 + g.v * t) % (W + 300) + W + 300) % (W + 300) - 150;
          CH.draw(ctx, g.id, g.px, x, g.y + 6 * Math.sin(t * 0.2 + g.ph), { alpha: a * g.a, align: "center" });
        }
        const wide = smooth(T.zoom0 + 0.3, T.zoom1, t);
        if (wide <= 0.002) return;
        const cam = t < T.zoom1 + 0.05 ? camAt(t) : null, CAM = cam ? cam.M : null, k = cam ? cam.k : 1;
        ctx.save();
        ctx.globalAlpha = a * wide;
        if (CAM) ctx.transform(CAM.a, CAM.b, CAM.c, CAM.d, CAM.e, CAM.f);
        // distant hills (parallax)
        ctx.lineWidth = 1 / k;
        for (const rg of ridges) {
          ctx.strokeStyle = `rgba(${INK},${rg.a})`; ctx.beginPath();
          for (let x = -40; x <= W + 40; x += 10) { const y = H * (rg.base - rg.amp * (0.5 + 0.5 * nz.fbm2((x + ground * rg.px) * 0.0026 / S, rg.seed, 4))); x > -40 ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
          ctx.stroke();
        }
        // ground + grass behind
        ctx.strokeStyle = `rgba(${INK},0.32)`; ctx.beginPath(); ctx.moveTo(-W, GY + 1); ctx.lineTo(2 * W, GY + 1); ctx.stroke();
        ctx.beginPath();
        for (const g of back) { const x = wrap(g.wx, W * 2); if (x < -20 || x > W + 20) continue; ctx.moveTo(x, GY); ctx.quadraticCurveTo(x + g.lean * 0.3, GY - g.h * 0.5, x + g.lean + 2 * Math.sin(t * 1.6 + g.ph), GY - g.h); }
        ctx.strokeStyle = `rgba(${INK},0.22)`; ctx.stroke();
        // pounce arc (dotted trajectory)
        ctx.fillStyle = `rgba(${INK},0.5)`;
        arc.forEach(([wx, y], i) => { if (i % 2) return; ctx.beginPath(); ctx.arc(wx - ground, y, 1.6 * S / Math.sqrt(k), 0, TAU); ctx.fill(); });
        ctx.restore();
        // the animals (camera premultiplied into their root, so the chalk line keeps its width)
        if (CAM) {
          const [dp, dq] = deerPose(t);
          rTmp.begin(CAM.mul(C.root(deerX(t), GY, SC * 0.92))); C.deer.draw(rTmp, dp, dq); chalk(rTmp, { ctx, a: a * wide });
          rTmp.begin(CAM.mul(C.root(tigerX(t), GY - tigerLift(t), SC))); C.tiger.draw(rTmp, cam.tp, cam.tq, t); chalk(rTmp, { ctx, a: a * wide });
        } else {
          chalk(rD, { ctx, a }); chalk(rT, { ctx, a });
        }
        // dust, then tall grass in front (dark-filled, hides the crouching tiger)
        ctx.save(); ctx.globalAlpha = a * wide;
        if (CAM) ctx.transform(CAM.a, CAM.b, CAM.c, CAM.d, CAM.e, CAM.f);
        for (const d of dust) { ctx.fillStyle = `rgba(${INK},${0.25 * d.life})`; ctx.beginPath(); ctx.arc(d.wx - ground, d.y, d.r * (1.7 - d.life), 0, TAU); ctx.fill(); }
        ctx.lineWidth = 1 / k;
        for (const g of clumps) { const x = wrap(g.wx, W * 2.8); if (x < -60 || x > W + 60) continue; blade(ctx, x, GY + 4, g.h, g.lean + 6 * Math.sin(t * 1.3 + g.ph), g.w, "rgba(9,11,11,0.94)", `rgba(${INK},0.45)`); }
        ctx.restore();
        // the owl, now and then
        if (owlOn) drawOutline(ctx, rO, { width: 1.25, color: `rgb(${INK})`, bg: BG, occlude: 0.9, far: 0.45, alpha: a * 0.85, grain: CH.grain(), grainA: 0.5 });
      },
      points(out, n) {
        const p = PTS.begin(out, n);
        if (tl < T.zoom1) { // still in the intro: points on the spiral arms
          const m = 40 * NA, src = new Float32Array(2 * m);
          for (let i = 0; i < m; i++) { const q = spiralPt(i % NA, ((i / NA) | 0) / 40, spiralRot(tl), spiralScale(tl)); src[2 * i] = q[0]; src[2 * i + 1] = q[1]; }
          p.arr("home-spiral", src, m, 1).end(); return;
        }
        p.rig("home-tiger", rT, 0.36).rig("home-deer", rD, 0.34);
        if (owlOn) p.rig("home-owl", rO, 0.1);
        p.poly("home-ground", [[0, GY + 1], [W, GY + 1]], 0.1);
        const g = ghosts[0]; p.eq("home-g0", g.id, g.px, ((g.x0 + g.v * tl) % (W + 300) + W + 300) % (W + 300) - 150, g.y, 0.2, "center").end();
      },
    };

    /* ---------------------------------------------------------- the intro (top pass) */
    function drawIntro(ctx, a, t) {
      if (t > T.zoom1 + 0.1) return;
      // 1 · equations, written in chalk (they leave as dust)
      const eqA = 1 - smooth(T.dust, T.dust + 0.55, t);
      if (eqA > 0.01) for (const e of eqLay) CH.write(ctx, e.id, e.px, e.x, e.y, smooth(e.st, e.st + e.du, t), { alpha: a * eqA * (e.id.startsWith("w_") ? 0.75 : 0.95) });
      // 2 · the spiral: level sets + arms, slowly turning, winding into the eye
      const spA = smooth(T.spiral, T.spiral + 0.4, t) * (1 - smooth(T.eye - 0.2, T.eye + 0.55, t)), rot = spiralRot(t), sc = spiralScale(t);
      if (spA > 0.01) {
        const lv = [0.96, 0.76, 0.58, 0.43, 0.31, 0.21];
        lv.forEach((f, i) => {
          const g = smooth(0.2 + i * 0.12, 1.3 + i * 0.12, t); if (g <= 0) return;
          const pts = [], m = Math.max(2, Math.round(96 * g));
          for (let j = 0; j <= m; j++) pts.push(levelPt(RS * sc * f, rot * 0.6 + (j / 96) * TAU));
          CH.line(ctx, pts, a * spA * (i % 2 ? 0.2 : 0.3), 1.0 * Math.max(1, S * 0.8));
        });
        for (let arm = 0; arm < NA; arm++) {
          const g = smooth(T.spiral + 0.12 * arm, T.spiral + 1.5 + 0.12 * arm, t); if (g <= 0) continue;
          const pts = [], m = Math.max(2, Math.round(150 * g));
          for (let j = 0; j <= m; j++) pts.push(spiralPt(arm, (j / 150), rot, sc));
          CH.line(ctx, pts, a * spA * 0.8, 1.45 * Math.max(1, S * 0.85));
        }
        const pulse = 0.6 + 0.4 * Math.sin(t * 5);
        ctx.fillStyle = `rgba(255,253,244,${a * spA * pulse})`; ctx.beginPath(); ctx.arc(CX, CY, 3.2 * Math.max(1, S), 0, TAU); ctx.fill();
      }
      // 3 · dust: equations → down the spiral arms → onto the eye
      const dA = smooth(T.dust - 0.05, T.dust + 0.2, t) * (1 - smooth(T.open + 0.25, T.open + 1.05, t));
      if (dA > 0.01) {
        const sw = 40 * Math.max(0.7, S), size = mobile ? 1.4 : 1.6;
        ctx.fillStyle = `rgba(${INK},${0.85 * a * dA})`;
        for (let i = 0; i < NI; i++) {
          const u = fract(uOf[i] + Math.max(0, t - T.dust) * 0.17), sp = spiralPt(armOf[i], 0.12 + 0.85 * u, rot, sc);
          const e1 = Ease.inOut(clamp((t - T.dust - dly[i]) / 0.75, 0, 1)), e2 = Ease.inOut(clamp((t - (T.eye - 0.35) - dly[i] * 0.4) / 0.7, 0, 1));
          let x = lerp(lerp(PEQ[2 * i], sp[0], e1), PEY[2 * i], e2), y = lerp(lerp(PEQ[2 * i + 1], sp[1], e1), PEY[2 * i + 1], e2);
          const b = Math.sin(Math.PI * e1) * (1 - e2);
          if (b > 0.02) { nz.curl(x * 0.004, y * 0.004, t * 0.3, tmp2); x += tmp2[0] * sw * b; y += tmp2[1] * sw * b; }
          ctx.fillRect(x - size / 2, y - size / 2, size, size);
        }
      }
      // 4 · the watcher's eye; during the pull-back it shrinks into the tiger's head
      const eyeIn = smooth(T.eye, T.eye + 0.6, t);
      if (eyeIn > 0.01) {
        const cam = camAt(t), es = eyeState(t), R = R1 * cam.k, ea = a * eyeIn * (1 - smooth(0.5, 0.92, cam.z));
        if (ea > 0.01) {
          ctx.save(); ctx.globalAlpha = ea * 0.85 * (0.92 + 0.08 * Math.sin(t * 1.3));
          const kf = R / RE; ctx.drawImage(fur.cv, cam.e[0] + fur.x * kf, cam.e[1] + fur.y * kf, fur.w * kf, fur.h * kf);
          ctx.restore();
          C.eye.draw(ctx, cam.e[0], cam.e[1], R, { o: Math.max(0.02, es.o), pupil: es.pupil, lx: es.lx, alpha: ea, t, noFur: true });
        }
      }
    }
  };
})(window);
