/* =============================================================================
   Home — "the watcher"                                           (section 1)
   -----------------------------------------------------------------------------
   Intro (plays once per visit, ~10 s; any scroll skips straight to the chase):
     0.2  Lyapunov-stability and predictability equations write themselves on
          the left while a vortex unfurls on the right: four bright chalk arms
          strung with glowing knots, four faint ones, a disc of orbiting dust
          and a hot core, turning slowly on a tilted disc
     2.4  the equations break into chalk dust that is sucked down its arms;
          it spins faster and faster, its arms smear and wind tighter…
     3.5  …it turns to face you and collapses into its core: a flash, rays,
          two shock rings
     4.2  …and there is an eye, watching through out-of-focus blades of grass.
          It opens, the pupil tightens, the gaze slides right, it blinks, narrows
     6.2  the camera pulls back through the grass: the eye belongs to a tiger
          crouched in the grass; a chital stag grazes on the right
     7.7  the stag lifts its head, the tiger launches (WildQuant is written in
          chalk as it leaps), the stag bolts
    10.0  the chase runs along the bottom, for as long as you stay
   Always: an owl glides across the top now and then; equations drift.
   The intro and the animals are drawn above the calm zone (never faded by
   text); the animals are sized so they stay below the title on any screen.
   HOW TO EDIT: timeline T, VORTEX look, layout in resize(), chase speed V.
   ============================================================================= */
(function (G) {
  "use strict";
  const { L, C, CH, PTS } = G.WQ;
  const { lerp, clamp, smooth, Ease, TAU, M2, Rig, drawOutline, blendPose, mulberry32, fract, makeNoise, rigBBox } = L;
  const INK = "246,244,236", BG = CH.BOARD;
  const T = { spiral: 0.15, dust: 2.4, collapse: 3.45, eye: 4.15, open: 4.35, blink: 5.6, zoom0: 6.15, zoom1: 7.45,
              alert: 7.65, pounce: 8.0, bolt: 8.2, land: 8.95, about: 9.55, chase: 9.95 };
  const OWL = { first: 4.0, every: 27, pass: 10 };        // seconds after the chase starts
  // the intro equations: [id, start, duration] (written in this order)
  const EQS = [["w_lyapunov", 0.15, 0.45], ["lyapunov", 0.4, 0.75], ["stable", 0.85, 0.55], ["w_predict", 1.05, 0.4], ["lyap_exp", 1.25, 0.65], ["pred_time", 1.6, 0.6]];
  const GHOSTS = ["lv_inline", "dynsys", "hopf", "jacobian", "eigen", "basin", "lyap_exp", "fokker_planck"];
  // the vortex: arms, turns, perspective squash and tilt, wobble
  const VORTEX = { arms: 8, phi: 4.4 * Math.PI, inner: 1 / 42, squash: 0.6, tilt: -0.38, wobble: 0.05 };
  const KS = Math.log(1 / VORTEX.inner) / VORTEX.phi;

  (G.WQ.scenes = G.WQ.scenes || {}).home = function (env0, opts = {}) {
    let env = env0, W = 0, H = 0, S = 1, portrait = false, mobile = false, box = null;
    let CX, CY, RS, RE, GY, SC, GH = 1e9, TX0, DX0, R1, V, OWLS, eqLay = [], built = false;
    const rT = new Rig(), rD = new Rig(), rO = new Rig(), rTmp = new Rig();
    const nz = makeNoise(31);
    let off = 0, tl = 0, ground = 0, spin = 0, lastReveal = -1, aboutSent = false, stored = false;
    let back = [], clumps = [], ridges = [], ghosts = [], dust = [], arc = [], owlOn = false, lastLand = false;
    let NI = 0, PEQ, dly, armOf, uOf, ND = 0, disc = null, fur = null, blades = [], OY = 0, owlOK = true, camMemo = { t: -1, v: null };
    const tmp2 = [0, 0];

    // skip the intro if it already played in this browser session (or ?intro=0), or if the page opens
    // further down (a link to #feedback, or a back link to where the visitor left): they came for that part
    const qs = new URLSearchParams(G.location.search);
    try { if ((G.sessionStorage.getItem("wq-intro") === "1" && qs.get("intro") !== "1") || qs.get("intro") === "0") off = T.chase + 0.4; } catch (e) { /* storage blocked */ }
    if ((opts.startY ?? G.scrollY) > G.innerHeight * 0.5) off = T.chase + 0.4; // where the page opened

    /* ---------------------------------------------------------- choreography */
    const deerChaseX = (t) => W * (portrait ? 0.73 : 0.72) + W * 0.025 * Math.sin(t * 0.37) + W * 0.012 * nz.n2(t * 0.21, 3);
    function deerX(t) {
      if (t < T.bolt) return DX0;
      const u = clamp((t - T.bolt) / 1.4, 0, 1);
      return lerp(DX0, deerChaseX(t), Ease.inOut(u)) + W * 0.045 * Math.sin(Math.PI * u);
    }
    const gap = (t) => W * (portrait ? 0.5 : 0.3) * (1 + 0.1 * Math.sin(t * 0.23 + 1) + 0.05 * nz.n2(t * 0.3, 7));
    function tigerX(t) {
      if (t < T.pounce) return TX0 + W * 0.01 * smooth(T.zoom1, T.pounce, t);
      const x0 = TX0 + W * 0.01, xl = deerX(T.land) - gap(T.land);
      if (t < T.land) { const u = (t - T.pounce) / (T.land - T.pounce); return x0 + (xl - x0) * (0.8 * Ease.out(u) + 0.2 * u); }
      return deerX(t) - gap(t);
    }
    const tigerLift = (t) => (t > T.pounce && t < T.land ? Math.min(H * 0.085, 60 * SC) * Math.sin(Math.PI * (t - T.pounce) / (T.land - T.pounce)) : 0);
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

    /* ---------------------------------------------------------- the vortex
       A spiral galaxy of chalk on a tilted disc. As it spins faster its arms
       wind tighter, it turns to face you and collapses into its core. */
    const VS = { phi: VORTEX.phi, ks: KS, sq: VORTEX.squash, c: 1, s: 0 };
    function setVortex(t) {
      const face = Ease.inOut(smooth(T.collapse - 0.55, T.eye, t)), wind = smooth(T.dust - 0.3, T.eye, t);
      VS.phi = VORTEX.phi * (1 + 0.6 * wind * wind);
      VS.ks = Math.log(1 / VORTEX.inner) / VS.phi;
      VS.sq = lerp(VORTEX.squash + 0.06 * Math.sin(t * 0.9), 1, face);
      const tilt = lerp(VORTEX.tilt + 0.1 * Math.sin(t * 0.5), 0, face);
      VS.c = Math.cos(tilt); VS.s = Math.sin(tilt); VS.tilt = tilt;
    }
    // a point at radius r (px) and angle th on the tilted, squashed disc
    function disk(r, th) {
      const x = r * Math.cos(th), y = r * Math.sin(th) * VS.sq;
      return [CX + x * VS.c - y * VS.s, CY + x * VS.s + y * VS.c];
    }
    const vScale = (t) => 1 - 0.95 * Ease.in(smooth(T.collapse - 0.3, T.eye, t));           // winds into the core
    const spinRate = (t) => 0.25 + 4.3 * Math.pow(smooth(T.dust - 0.4, T.eye, t), 2);         // rad/s, speeding up
    function armPt(arm, u, sc, rot, t) { // u: 0 = outer tip … 1 = core
      const ph = VS.phi * u, r = RS * sc * Math.exp(-VS.ks * ph) * (1 + VORTEX.wobble * Math.sin(3 * ph + 2.1 * t + arm));
      return disk(r, (arm * TAU) / VORTEX.arms + ph + rot);
    }
    // soft light (one cached sprite, stamped)
    let glowCv = null;
    function glowAt(ctx, x, y, r, a, sq = 1, rot = 0) {
      if (a <= 0.004 || r <= 0.5) return;
      if (!glowCv) {
        glowCv = document.createElement("canvas"); glowCv.width = glowCv.height = 128;
        const g = glowCv.getContext("2d"), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
        gr.addColorStop(0, "rgba(255,253,244,1)"); gr.addColorStop(0.16, "rgba(255,253,244,0.6)"); gr.addColorStop(0.42, "rgba(255,253,244,0.16)"); gr.addColorStop(1, "rgba(255,253,244,0)");
        g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
      }
      ctx.save(); ctx.globalAlpha = Math.min(1, a); ctx.translate(x, y); if (rot) ctx.rotate(rot); if (sq !== 1) ctx.scale(1, sq);
      ctx.drawImage(glowCv, -r, -r, 2 * r, 2 * r); ctx.restore();
    }
    function eyeState(t) {
      const te = t - T.open;
      const blink = 1 - 0.94 * Math.exp(-(((t - T.blink) / 0.08) ** 2));
      const o = smooth(0, 0.8, te) * (1 - 0.38 * smooth(1.45, 1.75, te)) * blink;
      return { o, pupil: 0.56 - 0.22 * smooth(0.3, 1.0, te), lx: 0.36 * smooth(0.9, 1.4, te) };
    }

    /* ---------------------------------------------------------- out-of-focus grass in front of the eye
       Curved, tapering blades, pre-blurred once (shadow blur works in every
       browser) and then stamped with a little sway. Dark ones have one edge
       catching the light; pale ones are far out of focus. */
    // dx (eye radii from the eye), tip height above the eye, half-width, bend, kind, light
    // kinds: 2 thin + sharp (near the eye's focus), 0 dark with a lit edge, 1 pale + far out of focus, 3 dark + far out of focus
    const BLADES = [
      [0.62, 0.95, 0.03, 0.55, 2, 0.5], [-1.2, 1.25, 0.035, -0.6, 2, 0.45], [1.55, 2.1, 0.03, 0.8, 2, 0.4],
      [-0.42, 1.45, 0.1, 0.75, 0, 0.4], [1.15, 0.7, 0.09, -0.55, 0, 0.38], [-1.45, 2.3, 0.14, 0.35, 0, 0.32],
      [0.5, 2.3, 0.08, 1.1, 0, 0.3], [1.9, 1.6, 0.13, -0.9, 0, 0.32], [-2.35, 1.0, 0.16, 1.25, 0, 0.3],
      [2.75, 2.5, 0.15, -0.4, 0, 0.28], [0.15, -0.75, 0.13, -0.3, 0, 0.36], [-0.95, -0.2, 0.11, 0.45, 0, 0.32],
      [-1.95, 1.7, 0.22, -0.2, 1, 0.15], [2.3, 0.35, 0.2, 0.4, 1, 0.13],
      [-3.35, 2.0, 0.34, 0.7, 3, 0], [3.55, 1.1, 0.3, -0.9, 3, 0],
    ];
    const BLUR = [0.5, 1.15, 0.12, 1.5], DEPTH = [1, 1.3, 0.8, 1.5]; // blur (× half-width) and parallax per kind
    function bladeOutline(w, h, bend, n = 26) { // centre line: cubic from the base (0,0) to the tip (bend, -h)
      const left = [], right = [];
      for (let i = 0; i <= n; i++) {
        const s = i / n, m = 1 - s;
        const x = 3 * m * s * s * 0.45 * bend + s * s * s * bend, y = -(3 * m * m * s * 0.45 + 3 * m * s * s * 0.85 + s * s * s) * h;
        const dx = 6 * m * s * 0.45 * bend + 3 * s * s * 0.55 * bend, dy = -(3 * m * m * 0.45 + 6 * m * s * 0.4 + 3 * s * s * 0.15) * h;
        const d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d, hw = w * Math.pow(m, 0.7) * (1 + 0.15 * Math.sin(Math.PI * s));
        left.push([x - nx * hw, y - ny * hw]); right.push([x + nx * hw, y + ny * hw]);
      }
      return { all: left.concat(right.slice().reverse()), edge: bend > 0 ? right : left };
    }
    function makeBlade(w, h, bend, kind, light) {
      const o = bladeOutline(w, h, bend), q = kind === 2 ? 1 : 0.5, blur = Math.max(kind === 2 ? 0.6 : 4, w * BLUR[kind]);
      let x0 = 1e9, x1 = -1e9; for (const [x] of o.all) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
      const pad = 2 * blur + 6, cw = x1 - x0 + 2 * pad, chh = h + 2 * pad, ox = pad - x0, oy = h + pad, off = 10000;
      const cv = document.createElement("canvas"); cv.width = Math.ceil(cw * q); cv.height = Math.ceil(chh * q);
      const c = cv.getContext("2d"); c.scale(q, q); c.shadowOffsetX = off * q; c.lineJoin = c.lineCap = "round";
      const path = (pts, close) => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x + ox - off, y + oy) : c.moveTo(x + ox - off, y + oy))); if (close) c.closePath(); };
      if (kind === 1) { c.shadowColor = `rgba(${INK},${light})`; c.shadowBlur = blur * q; path(o.all, true); c.fill(); }
      else {
        c.shadowColor = "rgba(4,5,5,0.97)"; c.shadowBlur = blur * q; path(o.all, true); c.fill();
        if (light > 0) { c.shadowColor = `rgba(${INK},${light})`; c.shadowBlur = Math.max(1.2, blur * 0.6) * q; c.lineWidth = Math.max(kind === 2 ? 1 : 2, w * 0.3); path(o.edge, false); c.stroke(); }
      }
      return { cv, ox, oy, w: cw, h: chh };
    }
    function buildBlades() {
      const r = mulberry32(9), base = H * 1.03;
      blades = BLADES.map(([dx, tip, w, bend, kind, light]) => {
        const h = Math.max(RE, base - (CY - tip * RE));
        return { dx: dx * RE, kind, sprite: makeBlade(w * RE, h, bend * RE, kind, light), ph: r() * TAU, sp: 0.5 + 0.6 * r(), amp: (0.01 + 0.014 * r()) * DEPTH[kind] };
      }).sort((p, q) => BLUR[p.kind] - BLUR[q.kind]); // sharp ones (nearest the eye) first, the most blurred (nearest you) last
    }
    function drawBlades(ctx, a, t, z) {
      const fade = a * (1 - smooth(0.15, 0.75, z));
      if (fade <= 0.01) return;
      for (const b of blades) {
        const d = DEPTH[b.kind], sx = b.dx * (1 + 3.2 * z * d), sw = b.amp * Math.sin(t * b.sp + b.ph) + 0.005 * Math.sin(t * 2.3 + b.ph), s = 1 + 0.6 * z * d, sp = b.sprite;
        ctx.save(); ctx.globalAlpha = fade;
        ctx.translate(CX + sx, H * 1.03); ctx.rotate(sw); ctx.scale(s, s);
        ctx.drawImage(sp.cv, -sp.ox, -sp.oy, sp.w, sp.h);
        ctx.restore();
      }
    }

    /* ---------------------------------------------------------- build (per size) */
    function build() {
      const r = mulberry32(77);
      back = []; const nb = mobile ? 110 : 240;
      for (let i = 0; i < nb; i++) back.push({ wx: r() * W * 2, h: (5 + r() * 15) * S, lean: (r() - 0.5) * 8 * S, ph: r() * TAU, a: 0.12 + r() * 0.2 });
      clumps = [];
      const spots = [[TX0 / W - 0.03, 1.25, 14], [TX0 / W + 0.09, 0.85, 8], [0.52, 0.65, 6], [1.1, 0.9, 9], [1.55, 1.0, 10], [2.05, 0.8, 8], [2.45, 1.05, 10]];
      const gh = Math.min(GH, Math.max(40, Math.min(H * 0.19, 95 * SC)));
      for (const [fx, hs, n] of spots) for (let k = 0; k < n; k++) clumps.push({ wx: W * fx + (r() - 0.5) * 70 * S, h: gh * (0.4 + 0.6 * r()) * hs, lean: (r() - 0.3) * 30 * S, w: (1.6 + r() * 2) * S, ph: r() * TAU });
      ridges = [[0.1, 0.11, 0.07, 0.16, 1.3], [0.28, 0.05, 0.05, 0.22, 4.1]].map(([px, lift, amp, a, seed]) => ({ px, lift, amp, a, seed }));
      ghosts = GHOSTS.map((id) => ({ id, x0: r() * W, y: H * (0.06 + 0.5 * r()), px: (13 + r() * 8) * Math.max(0.8, S), v: (r() - 0.5) * 9 * S, a: 0.11 + r() * 0.07, ph: r() * TAU }));
      // intro equations: stacked on the left (top on phones), sized to fit beside the vortex
      eqLay = []; const x0 = portrait ? W * 0.07 : Math.max(24, W * 0.055), maxW = portrait ? W * 0.86 : Math.max(W * 0.3, CX - RS * 0.78 - x0);
      let y = portrait ? H * 0.1 : H * 0.2;
      for (const [id, st, du] of EQS) {
        const label = id.startsWith("w_");
        let px = (label ? 15 : 25) * Math.max(0.75, S * (portrait ? 1.05 : 1));
        const w = CH.size(id, px)[0]; if (w > maxW) px *= maxW / w;
        const h = CH.size(id, px)[1];
        if (label && eqLay.length) y += 14 * S;
        eqLay.push({ id, st, du, px, x: x0, y: y + h / 2 });
        y += h + (label ? 6 : 12) * S;
      }
      // equation dust: each particle starts on an equation and is sucked down a vortex arm
      NI = mobile ? 420 : 820;
      PEQ = new Float32Array(2 * NI); dly = new Float32Array(NI); armOf = new Uint8Array(NI); uOf = new Float32Array(NI);
      const widths = eqLay.map((e) => CH.size(e.id, e.px)[0]), tot = widths.reduce((a, b) => a + b, 0);
      let k = 0;
      eqLay.forEach((e, i) => {
        const m = i === eqLay.length - 1 ? NI - k : Math.round((NI * widths[i]) / tot), pts = CH.points(e.id, e.px, m, r, "left");
        for (let j = 0; j < m && k < NI; j++, k++) { PEQ[2 * k] = e.x + pts[2 * j]; PEQ[2 * k + 1] = e.y + pts[2 * j + 1]; }
      });
      for (let i = 0; i < NI; i++) { dly[i] = 0.35 * (PEQ[2 * i] / W) + 0.25 * r(); armOf[i] = (r() * VORTEX.arms) | 0; uOf[i] = r(); }
      // the dust disc: particles bunched along the arms (inner ones orbit faster), plus an outer ring of debris
      ND = mobile ? 620 : 1600; disc = new Float32Array(4 * ND);
      for (let i = 0; i < ND; i++) {
        const u = Math.pow(r(), 0.8), arm = (r() * VORTEX.arms) | 0, ph = VORTEX.phi * u, ring = i % 5 === 0;
        disc[4 * i] = ring ? 1.0 + 0.32 * r() : Math.exp(-KS * ph) * (0.92 + 0.16 * r());  // radius (fraction of RS)
        disc[4 * i + 1] = ring ? r() * TAU : (arm * TAU) / VORTEX.arms + ph + (r() - 0.5) * 0.55 * (r() < 0.25 ? 3 : 1); // angle
        disc[4 * i + 2] = ring ? 0.35 + 0.3 * r() : 0.6 + 0.8 * r();                       // speed factor
        disc[4 * i + 3] = 0.8 + 1.4 * r();                                                 // dot size
      }
      fur = C.eye.furLayer(RE, Math.min(2, env.dpr), 1.0, CH.grain());
      buildBlades();
      built = true;
    }

    /* ---------------------------------------------------------- intro / title events */
    function skipIntro() { if (tl < T.chase) { off += T.chase + 0.3 - tl; tl = T.chase + 0.3; } }
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
    function camAt(t) { // camera: from the eye close-up to the wide shot (computed once per frame)
      if (camMemo.t === t && camMemo.v) return camMemo.v;
      camMemo.t = t; return (camMemo.v = camCompute(t));
    }
    function camCompute(t) {
      const [tp, tq] = tigerPose(t);
      rTmp.begin(C.root(tigerX(t), GY - tigerLift(t), SC)); C.tiger.draw(rTmp, tp, tq, t);
      const hd = rTmp.parts.find((p) => p.shape === C.tiger.shapes.head), pEye = hd.m.apply(13, -5.5);
      const z = Ease.inOut(smooth(T.zoom0, T.zoom1, t)), k = Math.exp(lerp(Math.log(RE / R1), 0, z));
      const e = [lerp(CX, pEye[0], z), lerp(CY, pEye[1], z)];
      return { M: new M2().translate(e[0], e[1]).scale(k).translate(-pEye[0], -pEye[1]), z, k, e, tp, tq };
    }
    function owlAt(t) {
      const tc = t - T.chase - OWL.first;
      if (tc < 0 || !owlOK) return null;
      const u = (tc % OWL.every) / OWL.pass;
      if (u > 1) return null;
      const w = C.owl.wingAt(tc, 2.6, 2, 2.2);
      return { x: lerp(W + 150 * S, -150 * S, u), y: OY + 8 * S * Math.sin(tc * 1.3), rot: -0.05 + 0.06 * Math.sin(tc * 0.8), wing: w.wing, fold: w.fold, look: Math.sin(tc * 0.5) };
    }
    /* The chase must stay clear of the title block on every screen shape: any
       animal whose path runs under the text must fit between the text and the
       ground. On short screens the animals shrink a little and the ground drops
       a little (heights in creature units, measured from the rigs). */
    const FIT = { tigerRun: 76, tigerCrouch: 56, deer: 152 * 0.92, tigerBack: 135, tigerFront: 83, deerBack: 56 * 0.92, margin: 14 };
    function fitChase() {
      const gy0 = portrait ? H * 0.9 : H * 0.87, want = portrait ? W * 0.0025 : Math.min(W / 900, H / 520) * 1.12;
      GY = gy0; SC = want; GH = 1e9;
      if (!box) return;
      const top = box.y + box.h + FIT.margin, bx0 = box.x - 10, bx1 = box.x + box.w + 10;
      const under = (x0, x1) => x1 > bx0 && x0 < bx1;
      const ok = (sc, gy) => {
        const dMin = W * (portrait ? 0.693 : 0.683), gapMax = W * (portrait ? 0.5 : 0.3) * 1.15, gapMin = W * (portrait ? 0.5 : 0.3) * 0.85;
        const crouch = [W * 0.27 - FIT.tigerBack * sc, W * 0.28 + FIT.tigerFront * sc], run = [dMin - gapMax - FIT.tigerBack * sc, W * 0.76 - gapMin + FIT.tigerFront * sc];
        if (under(...crouch) && gy - FIT.tigerCrouch * sc < top) return false;
        if (under(...run) && gy - FIT.tigerRun * sc < top) return false;
        if (under(dMin - FIT.deerBack * sc, W) && gy - FIT.deer * sc < top) return false;
        return true;
      };
      const best = (gy, lo) => { let sc = want; while (sc > want * lo && !ok(sc, gy)) sc *= 0.98; return ok(sc, gy) ? sc : 0; };
      let found = false;
      for (const f of [0, 0.015, 0.03, 0.045]) { const sc = best(gy0 + H * f, 0.78); if (sc) { GY = gy0 + H * f; SC = sc; found = true; break; } }
      if (!found) { GY = gy0 + H * 0.045; SC = best(GY, 0.45) || want * 0.45; }
      GH = Math.max(12, (GY - top) / 1.25); // the tall grass stays below the text as well
    }

    return {
      still: T.chase + 3.2,
      resize(e, b) {
        env = e; W = e.W; H = e.H; portrait = e.portrait; mobile = e.mobile; box = b || box; S = Math.min(W / 960, H / 540);
        if (portrait) { CX = W * 0.52; CY = H * 0.5; RS = W * 0.62; RE = W * 0.16; }
        else { CX = W * 0.67; CY = H * 0.44; RS = Math.min(H * 0.5, W * 0.34); RE = Math.min(H * 0.2, W * 0.115); }
        fitChase();
        TX0 = W * (portrait ? 0.27 : 0.27); DX0 = W * (portrait ? 0.74 : 0.73);
        R1 = 2.4 * SC; V = W * (portrait ? 1.15 : 0.85); OWLS = Math.max(0.75, S) * 1.45;
        // the owl glides in the gap between the top of the screen and the title: smaller if that gap is
        // thin, not at all if there is none. Its drawing reaches 70 units above its centre and 10 below.
        const owlRoom = (box ? box.y - 14 : H * 0.3) - 8 - 16 * S; // less the top margin and its bobbing
        OWLS = Math.min(OWLS, owlRoom / 80); owlOK = OWLS >= 0.6;
        OY = 8 + 8 * S + 70 * OWLS + Math.max(0, (Math.min(owlRoom, H * 0.2) - 80 * OWLS) * 0.5);
        build();
      },
      update(dt, t) {
        if (!built) return;
        if (env.scroll > 0.03 && t + off < T.chase) skipIntro();
        tl = t + off;
        events();
        ground += speedAt(tl) * dt;
        spin += spinRate(tl) * dt;
        const r = env.rand;
        if (tl >= T.land && !lastLand) { lastLand = true; for (let i = 0; i < 24; i++) dust.push({ wx: tigerX(tl) + ground + (r() - 0.5) * 60 * SC, y: GY, vx: (r() - 0.5) * 140, vy: -20 - r() * 60, life: 1.1, r: (2 + r() * 4) * S }); }
        if (tl > T.land && r() < 0.45) dust.push({ wx: tigerX(tl) + ground - 40 * SC, y: GY - 2, vx: -20 + r() * 30, vy: -10 - r() * 25, life: 0.9, r: (1.5 + r() * 3) * S });
        if (tl > T.bolt + 0.3 && r() < 0.35) dust.push({ wx: deerX(tl) + ground - 25 * SC, y: GY - 2, vx: -10 + r() * 20, vy: -8 - r() * 20, life: 0.8, r: (1 + r() * 2.5) * S });
        for (const d of dust) { d.wx += d.vx * dt; d.y += d.vy * dt; d.vy += 30 * dt; d.life -= dt; }
        if (dust.length) dust = dust.filter((d) => d.life > 0 && d.wx - ground > -100);
        if (tl > T.pounce && tl < T.land + 0.05) arc.push([tigerX(tl) + ground + 60 * SC, GY - tigerLift(tl) - 70 * SC]);
        if (tl > T.chase) arc.length = 0;
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
        if (pass === "top") { // animals and the intro are never faded by the text's calm zone
          drawChase(ctx, a, t); drawIntro(ctx, a, t);
          if (owlOn) drawOutline(ctx, rO, { width: 1.25, color: `rgb(${INK})`, bg: BG, occlude: 0.9, far: 0.45, alpha: a * 0.85, grain: CH.grain(), grainA: 0.5 });
          return;
        }
        // drifting equations (calmed behind the text)
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
        ctx.lineWidth = 1 / k;
        for (const rg of ridges) { // distant hills (parallax), just above the chase strip
          ctx.strokeStyle = `rgba(${INK},${rg.a})`; ctx.beginPath();
          for (let x = -40; x <= W + 40; x += 10) { const y = GY - H * (rg.lift + rg.amp * (0.5 + 0.5 * nz.fbm2((x + ground * rg.px) * 0.0026 / S, rg.seed, 4))); x > -40 ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
          ctx.stroke();
        }
        ctx.strokeStyle = `rgba(${INK},0.32)`; ctx.beginPath(); ctx.moveTo(-W, GY + 1); ctx.lineTo(2 * W, GY + 1); ctx.stroke();
        ctx.beginPath();
        for (const g of back) { const x = wrap(g.wx, W * 2); if (x < -20 || x > W + 20) continue; ctx.moveTo(x, GY); ctx.quadraticCurveTo(x + g.lean * 0.3, GY - g.h * 0.5, x + g.lean + 2 * Math.sin(t * 1.6 + g.ph), GY - g.h); }
        ctx.strokeStyle = `rgba(${INK},0.22)`; ctx.stroke();
        ctx.fillStyle = `rgba(${INK},0.5)`;
        arc.forEach(([wx, y], i) => { if (i % 2) return; ctx.beginPath(); ctx.arc(wx - ground, y, 1.6 * S / Math.sqrt(k), 0, TAU); ctx.fill(); });
        ctx.restore();
      },
      // where the animals are (for layout checks): [[x0,y0,x1,y1], ...]
      actors() { return tl < T.zoom1 ? [] : [rigBBox(rT, 0), rigBBox(rD, 0)].concat(owlOn ? [rigBBox(rO, 0)] : []); },
      points(out, n) {
        const p = PTS.begin(out, n);
        if (tl < T.zoom1) { // still in the intro: points on the vortex arms
          setVortex(tl);
          const m = 30 * VORTEX.arms, src = new Float32Array(2 * m), sc = vScale(tl);
          for (let i = 0; i < m; i++) { const q = armPt(i % VORTEX.arms, ((i / VORTEX.arms) | 0) / 30, sc, spin, tl); src[2 * i] = q[0]; src[2 * i + 1] = q[1]; }
          p.arr("home-vortex", src, m, 1).end(); return;
        }
        p.rig("home-tiger", rT, 0.36).rig("home-deer", rD, 0.34);
        if (owlOn) p.rig("home-owl", rO, 0.1);
        p.poly("home-ground", [[0, GY + 1], [W, GY + 1]], 0.1);
        const g = ghosts[0]; p.eq("home-g0", g.id, g.px, ((g.x0 + g.v * tl) % (W + 300) + W + 300) % (W + 300) - 150, g.y, 0.2, "center").end();
      },
    };

    /* ---------------------------------------------------------- the chase (top pass: text never fades it) */
    function drawChase(ctx, a, t) {
      const wide = smooth(T.zoom0 + 0.3, T.zoom1, t);
      if (wide <= 0.002) return;
      const cam = t < T.zoom1 + 0.05 ? camAt(t) : null, CAM = cam ? cam.M : null, k = cam ? cam.k : 1;
      if (CAM) {
        const [dp, dq] = deerPose(t);
        rTmp.begin(CAM.mul(C.root(deerX(t), GY, SC * 0.92))); C.deer.draw(rTmp, dp, dq); chalk(rTmp, { ctx, a: a * wide });
        rTmp.begin(CAM.mul(C.root(tigerX(t), GY - tigerLift(t), SC))); C.tiger.draw(rTmp, cam.tp, cam.tq, t); chalk(rTmp, { ctx, a: a * wide });
      } else { chalk(rD, { ctx, a }); chalk(rT, { ctx, a }); }
      // dust, then tall grass in front (dark-filled, hides the crouching tiger)
      ctx.save(); ctx.globalAlpha = a * wide;
      if (CAM) ctx.transform(CAM.a, CAM.b, CAM.c, CAM.d, CAM.e, CAM.f);
      for (const d of dust) { ctx.fillStyle = `rgba(${INK},${0.25 * d.life})`; ctx.beginPath(); ctx.arc(d.wx - ground, d.y, d.r * (1.7 - d.life), 0, TAU); ctx.fill(); }
      ctx.lineWidth = 1 / k;
      for (const g of clumps) { const x = wrap(g.wx, W * 2.8); if (x < -60 || x > W + 60) continue; blade(ctx, x, GY + 4, g.h, g.lean + 6 * Math.sin(t * 1.3 + g.ph), g.w, "rgba(9,11,11,0.94)", `rgba(${INK},0.45)`); }
      ctx.restore();
    }

    /* ---------------------------------------------------------- the intro (top pass) */
    function drawIntro(ctx, a, t) {
      if (t > T.zoom1 + 0.1) return;
      setVortex(t);
      const sc = vScale(t), rot = spin, lw = Math.max(1, S * 0.85), wr = spinRate(t);
      // 1 · equations, written in chalk (they leave as dust)
      const eqA = 1 - smooth(T.dust, T.dust + 0.55, t);
      if (eqA > 0.01) for (const e of eqLay) CH.write(ctx, e.id, e.px, e.x, e.y, smooth(e.st, e.st + e.du, t), { alpha: a * eqA * (e.id.startsWith("w_") ? 0.75 : 0.95) });
      // 2 · the vortex
      const vA = smooth(T.spiral, T.spiral + 0.5, t) * (1 - smooth(T.eye - 0.12, T.eye + 0.1, t));
      if (vA > 0.01) {
        const grow = smooth(T.spiral, T.spiral + 1.6, t), fast = smooth(T.dust, T.collapse, t);
        // diffuse light of the disc, brightening as it speeds up
        glowAt(ctx, CX, CY, RS * sc * 1.05, a * vA * (0.1 + 0.12 * fast) * grow, VS.sq, VS.tilt);
        // faint level-set rings (a nod to the Lyapunov function), turning with the disc
        for (const f of [1.12, 0.84, 0.6, 0.4]) {
          const pts = []; for (let j = 0; j <= 72; j++) pts.push(disk(RS * sc * f, rot * 0.5 + (j / 72) * TAU));
          CH.line(ctx, pts, a * vA * 0.15 * grow, lw, true);
        }
        // the arms: 4 bright main arms (three strands, smeared when spinning fast) and 4 faint ones between them
        const smear = smooth(1.2, 3.5, wr);
        for (let arm = 0; arm < VORTEX.arms; arm++) {
          const main = arm % 2 === 0, g = Ease.out(smooth(T.spiral + 0.06 * arm, T.spiral + 1.5 + 0.06 * arm, t));
          if (g <= 0.01) continue;
          const u0 = 1 - g; // grows from the core outward
          const strands = main ? [[-0.08, 0.36, 0.85, 0], [0, 1, 1.9, 0], [0.08, 0.36, 0.85, 0], [-0.026 * wr, 0.34 * smear, 1.3, 1], [-0.052 * wr, 0.16 * smear, 1.1, 1]] // last two: motion smear
                               : [[0, 0.42, 0.9, 0]];
          for (const [dth, al, wk, sm] of strands) {
            if (al < 0.01) continue;
            for (const [a0, a1, wt] of [[u0, u0 + (1 - u0) * 0.34, 1.35], [u0 + (1 - u0) * 0.32, u0 + (1 - u0) * 0.68, 1], [u0 + (1 - u0) * 0.66, 1, 0.6]]) {
              const pts = [], m = Math.ceil((a1 - a0) * 80 * VS.phi / VORTEX.phi) + 4; // enough points for a smooth curve
              for (let j = 0; j <= m; j++) { const u = lerp(a0, a1, j / m); pts.push(armPt(arm, u, sc, rot + dth * (sm ? 1 : 1 - u * 0.7), t)); }
              CH.line(ctx, pts, a * vA * al, lw * wk * wt, !main || al < 0.5);
            }
          }
          // bright knots strung along the main arms
          if (main) for (const [u, kr] of [[0.14, 1], [0.27, 0.85], [0.4, 0.75], [0.53, 0.6], [0.66, 0.5]]) {
            if (u < u0) continue;
            const q = armPt(arm, u, sc, rot, t), tw = 0.75 + 0.25 * Math.sin(t * 5 + arm * 1.7 + u * 20);
            glowAt(ctx, q[0], q[1], RS * sc * 0.07 * kr, a * vA * 0.55 * tw);
          }
        }
        // the dust disc: inner dust orbits faster; each grain trails a streak as the spin speeds up
        const sz = mobile ? 1.15 : 1.35, tail = 0.07 + 0.05 * fast; // seconds of motion shown as a streak
        const dots = [new Path2D(), new Path2D(), new Path2D(), new Path2D()], streak = new Path2D();
        for (let i = 0; i < ND; i++) {
          const rf = disc[4 * i]; if (rf > 0.12 + 1.3 * grow) continue; // the disc grows outward with the arms
          const w = disc[4 * i + 2] * (0.6 + 0.5 / Math.sqrt(rf + 0.05)), ang = disc[4 * i + 1] + rot * w;
          const rr = RS * sc * rf * (1 - 0.4 * fast * (1 - Math.min(1, rf))), q = disk(rr, ang), s = disc[4 * i + 3] * sz, da = wr * w * tail;
          dots[Math.max(0, Math.min(3, ((1.1 - rf) * 4) | 0))].rect(q[0] - s / 2, q[1] - s / 2, s, s);
          if (da * rr > 2.5) { const p0 = disk(rr, ang - da), pm = disk(rr, ang - da / 2); streak.moveTo(p0[0], p0[1]); streak.lineTo(pm[0], pm[1]); streak.lineTo(q[0], q[1]); }
        }
        ctx.lineWidth = 1; ctx.lineCap = "round"; ctx.strokeStyle = `rgba(${INK},${0.24 * a * vA})`; ctx.stroke(streak);
        dots.forEach((p, k) => { ctx.fillStyle = `rgba(${INK},${a * vA * (0.3 + 0.2 * k)})`; ctx.fill(p); });
        // the glowing core: brighter and hotter as everything falls in
        const pulse = 0.8 + 0.2 * Math.sin(t * 7), heat = smooth(T.dust, T.eye, t);
        glowAt(ctx, CX, CY, RS * (0.16 + 0.12 * heat) * pulse * Math.max(0.35, sc), a * vA * (0.75 + 0.25 * heat));
        glowAt(ctx, CX, CY, RS * 0.045 * pulse, a * vA);
      }
      // 3 · equation dust: sucked down the arms into the core
      const dA = smooth(T.dust - 0.05, T.dust + 0.2, t) * (1 - smooth(T.eye - 0.25, T.eye, t));
      if (dA > 0.01) {
        const sw = 46 * Math.max(0.7, S), size = mobile ? 1.4 : 1.7;
        ctx.fillStyle = `rgba(${INK},${0.9 * a * dA})`;
        for (let i = 0; i < NI; i++) {
          const u = Math.min(1, uOf[i] * 0.25 + Math.max(0, t - T.dust - dly[i] * 0.5) * 0.42), sp = armPt(armOf[i], u, sc, rot, t);
          const e1 = Ease.inOut(clamp((t - T.dust - dly[i]) / 0.7, 0, 1));
          let x = lerp(PEQ[2 * i], sp[0], e1), y = lerp(PEQ[2 * i + 1], sp[1], e1);
          const b = Math.sin(Math.PI * e1);
          if (b > 0.02) { nz.curl(x * 0.004, y * 0.004, t * 0.3, tmp2); x += tmp2[0] * sw * b; y += tmp2[1] * sw * b; }
          ctx.fillRect(x - size / 2, y - size / 2, size, size);
        }
      }
      // 4 · the collapse: a flash with rays, two shock rings, a fading afterglow
      const fl = Math.exp(-(((t - T.eye) / 0.09) ** 2)), rays = smooth(T.eye - 0.08, T.eye + 0.12, t) * (1 - smooth(T.eye + 0.05, T.eye + 0.35, t));
      if (fl > 0.01) { glowAt(ctx, CX, CY, RS * 0.85, a * fl * 0.85); glowAt(ctx, CX, CY, RS * 0.2, a * fl); }
      if (rays > 0.01) {
        ctx.save(); ctx.lineCap = "round"; ctx.strokeStyle = `rgba(255,253,244,${0.6 * a * rays})`; ctx.lineWidth = 1.3 * lw; ctx.beginPath();
        for (let k = 0; k < 18; k++) {
          const th = (k / 18) * TAU + 0.25 * Math.sin(k * 7.1), len = RS * (0.35 + 0.65 * fract(Math.sin(k * 12.9898) * 43758.5453)) * (0.4 + 0.6 * smooth(T.eye - 0.08, T.eye + 0.2, t));
          ctx.moveTo(CX + RS * 0.04 * Math.cos(th), CY + RS * 0.04 * Math.sin(th)); ctx.lineTo(CX + len * Math.cos(th), CY + len * Math.sin(th));
        }
        ctx.stroke(); ctx.restore();
      }
      for (const [d0, k] of [[0, 1], [0.14, 0.55]]) {
        const ring = smooth(T.eye + d0, T.eye + d0 + 0.85, t);
        if (ring > 0 && ring < 1) { const pts = [], rr = RS * (0.08 + 1.45 * Ease.out(ring)); for (let j = 0; j <= 90; j++) pts.push([CX + rr * Math.cos((j / 90) * TAU), CY + rr * Math.sin((j / 90) * TAU)]); CH.line(ctx, pts, a * 0.8 * k * (1 - ring), lw * (2.2 - 1.2 * ring), false); }
      }
      const ag = smooth(T.eye - 0.05, T.eye + 0.05, t) * (1 - smooth(T.eye + 0.05, T.eye + 0.9, t));
      if (ag > 0.01) glowAt(ctx, CX, CY, RE * 2.2, a * ag * 0.22);
      // 5 · the watcher's eye behind the grass; the pull-back shrinks it into the tiger's head
      const eyeIn = smooth(T.eye - 0.05, T.eye + 0.5, t);
      if (eyeIn > 0.01) {
        const cam = camAt(t), es = eyeState(t), R = R1 * cam.k, ea = a * eyeIn * (1 - smooth(0.5, 0.92, cam.z));
        if (ea > 0.01) {
          ctx.save(); ctx.globalAlpha = ea * 0.9 * (0.92 + 0.08 * Math.sin(t * 1.3));
          const kf = R / RE; ctx.drawImage(fur.cv, cam.e[0] + fur.x * kf, cam.e[1] + fur.y * kf, fur.w * kf, fur.h * kf);
          ctx.restore();
          C.eye.draw(ctx, cam.e[0], cam.e[1], R, { o: Math.max(0.02, es.o), pupil: es.pupil, lx: es.lx, alpha: ea, t, noFur: true });
        }
        drawBlades(ctx, a * eyeIn, t, cam.z);
      }
    }
  };
})(window);
