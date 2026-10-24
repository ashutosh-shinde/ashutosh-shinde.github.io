/* =============================================================================
   core.js — shared drawing toolkit for the WildQuant chalkboard
   -----------------------------------------------------------------------------
   Plain JavaScript on <canvas>; no images, no videos, no libraries.
     1. math helpers, easing, seeded random
     2. simplex noise (+ curl noise)          — organic motion
     3. 2D affine matrix                       — transforms for animal rigs
     4. shapes (blob, capsule, ellipse, leaf)  — the "clay" animals are built from
     5. Rig recorder + renderers               — chalk-outline / solid animals
     6. contour tracing + simplification       — outlines from masks
     7. keyframe helpers                       — gait cycles, pose blending
   Everything is exported as WQ.L (scenes usually write: const { L } = WQ).
   ============================================================================= */
(function (G) {
  "use strict";

  /* ---------- 1. math helpers ------------------------------------------- */
  const TAU = Math.PI * 2;
  const DEG = Math.PI / 180;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const fract = (x) => x - Math.floor(x);
  const Ease = {
    inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    out: (t) => 1 - Math.pow(1 - t, 3),
    in: (t) => t * t * t,
    sine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
    outBack: (t) => { const c = 1.6; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
  };
  // window(t, a, b, fadeIn, fadeOut): 0 outside [a,b], ramps at the edges
  const win = (t, a, b, fi = 0.4, fo = 0.4) => smooth(a, a + fi, t) * (1 - smooth(b - fo, b, t));

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // gaussian sample (Box–Muller)
  const gauss = (r) => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(TAU * r());

  /* ---------- 2. simplex noise (Stefan Gustavson, public domain) --------- */
  function makeNoise(seed = 1) {
    const rand = mulberry32(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) { const j = (rand() * (i + 1)) | 0; const t = p[i]; p[i] = p[j]; p[j] = t; }
    const perm = new Uint8Array(512), pm12 = new Uint8Array(512);
    for (let i = 0; i < 512; i++) { perm[i] = p[i & 255]; pm12[i] = perm[i] % 12; }
    const g3 = [1,1,0,-1,1,0,1,-1,0,-1,-1,0,1,0,1,-1,0,1,1,0,-1,-1,0,-1,0,1,1,0,-1,1,0,1,-1,0,-1,-1];
    const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6, F3 = 1 / 3, G3 = 1 / 6;
    function n2(xin, yin) {
      let n0 = 0, n1 = 0, n2v = 0;
      const s = (xin + yin) * F2, i = Math.floor(xin + s), j = Math.floor(yin + s);
      const t = (i + j) * G2, x0 = xin - (i - t), y0 = yin - (j - t);
      const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
      const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
      const ii = i & 255, jj = j & 255;
      let t0 = 0.5 - x0 * x0 - y0 * y0;
      if (t0 > 0) { const g = pm12[ii + perm[jj]] * 3; t0 *= t0; n0 = t0 * t0 * (g3[g] * x0 + g3[g + 1] * y0); }
      let t1 = 0.5 - x1 * x1 - y1 * y1;
      if (t1 > 0) { const g = pm12[ii + i1 + perm[jj + j1]] * 3; t1 *= t1; n1 = t1 * t1 * (g3[g] * x1 + g3[g + 1] * y1); }
      let t2 = 0.5 - x2 * x2 - y2 * y2;
      if (t2 > 0) { const g = pm12[ii + 1 + perm[jj + 1]] * 3; t2 *= t2; n2v = t2 * t2 * (g3[g] * x2 + g3[g + 1] * y2); }
      return 70 * (n0 + n1 + n2v);
    }
    function n3(xin, yin, zin) {
      let n0 = 0, n1 = 0, n2v = 0, n3v = 0;
      const s = (xin + yin + zin) * F3;
      const i = Math.floor(xin + s), j = Math.floor(yin + s), k = Math.floor(zin + s);
      const t = (i + j + k) * G3;
      const x0 = xin - (i - t), y0 = yin - (j - t), z0 = zin - (k - t);
      let i1, j1, k1, i2, j2, k2;
      if (x0 >= y0) {
        if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
        else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
        else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
      } else {
        if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
        else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
        else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
      }
      const x1 = x0 - i1 + G3, y1 = y0 - j1 + G3, z1 = z0 - k1 + G3;
      const x2 = x0 - i2 + 2 * G3, y2 = y0 - j2 + 2 * G3, z2 = z0 - k2 + 2 * G3;
      const x3 = x0 - 1 + 3 * G3, y3 = y0 - 1 + 3 * G3, z3 = z0 - 1 + 3 * G3;
      const ii = i & 255, jj = j & 255, kk = k & 255;
      let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
      if (t0 > 0) { const g = pm12[ii + perm[jj + perm[kk]]] * 3; t0 *= t0; n0 = t0 * t0 * (g3[g] * x0 + g3[g + 1] * y0 + g3[g + 2] * z0); }
      let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
      if (t1 > 0) { const g = pm12[ii + i1 + perm[jj + j1 + perm[kk + k1]]] * 3; t1 *= t1; n1 = t1 * t1 * (g3[g] * x1 + g3[g + 1] * y1 + g3[g + 2] * z1); }
      let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
      if (t2 > 0) { const g = pm12[ii + i2 + perm[jj + j2 + perm[kk + k2]]] * 3; t2 *= t2; n2v = t2 * t2 * (g3[g] * x2 + g3[g + 1] * y2 + g3[g + 2] * z2); }
      let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
      if (t3 > 0) { const g = pm12[ii + 1 + perm[jj + 1 + perm[kk + 1]]] * 3; t3 *= t3; n3v = t3 * t3 * (g3[g] * x3 + g3[g + 1] * y3 + g3[g + 2] * z3); }
      return 32 * (n0 + n1 + n2v + n3v);
    }
    // fractal (fbm) and curl of a 3D potential: divergence-free swirl
    function fbm2(x, y, oct = 4) { let a = 0.5, f = 1, s = 0; for (let o = 0; o < oct; o++) { s += a * n2(x * f, y * f); f *= 2; a *= 0.5; } return s; }
    function curl(x, y, z, out) {
      const e = 0.01;
      const dy = (n3(x, y + e, z) - n3(x, y - e, z)) / (2 * e);
      const dx = (n3(x + e, y, z) - n3(x - e, y, z)) / (2 * e);
      out[0] = dy; out[1] = -dx; return out;
    }
    return { n2, n3, fbm2, curl };
  }

  /* ---------- 3. affine matrix [a b c d e f] (canvas convention) ----------- */
  class M2 {
    constructor(a = 1, b = 0, c = 0, d = 1, e = 0, f = 0) { this.a = a; this.b = b; this.c = c; this.d = d; this.e = e; this.f = f; }
    clone() { return new M2(this.a, this.b, this.c, this.d, this.e, this.f); }
    mul(o) { // this * o
      return new M2(
        this.a * o.a + this.c * o.b, this.b * o.a + this.d * o.b,
        this.a * o.c + this.c * o.d, this.b * o.c + this.d * o.d,
        this.a * o.e + this.c * o.f + this.e, this.b * o.e + this.d * o.f + this.f);
    }
    translate(x, y) { return this.mul(new M2(1, 0, 0, 1, x, y)); }
    rotate(t) { const c = Math.cos(t), s = Math.sin(t); return this.mul(new M2(c, s, -s, c, 0, 0)); }
    scale(x, y = x) { return this.mul(new M2(x, 0, 0, y, 0, 0)); }
    apply(x, y) { return [this.a * x + this.c * y + this.e, this.b * x + this.d * y + this.f]; }
    get sx() { return Math.hypot(this.a, this.b); }
    dom() { return new DOMMatrix([this.a, this.b, this.c, this.d, this.e, this.f]); }
  }

  /* ---------- 4. shapes ----------------------------------------------------
     A shape = closed polygon in LOCAL coords + a Path2D for drawing.
     Animals are unions of shapes; the outline renderer draws only the outer
     silhouette of the union, so overlapping parts melt into one body.        */
  function makeShape(pts) {
    let area = 0, per = 0, x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
      area += ax * by - bx * ay; per += Math.hypot(bx - ax, by - ay);
      x0 = Math.min(x0, ax); y0 = Math.min(y0, ay); x1 = Math.max(x1, ax); y1 = Math.max(y1, ay);
    }
    if (area < 0) pts = pts.slice().reverse(); // every shape winds the same way…
    const mk = (list) => { const p = new Path2D(); p.moveTo(list[0][0], list[0][1]); for (let i = 1; i < list.length; i++) p.lineTo(list[i][0], list[i][1]); p.closePath(); return p; };
    const path = mk(pts), pathR = mk(pts.slice().reverse()); // …and keeps a mirrored copy (see worldPath)
    return { pts, path, pathR, area: Math.abs(area) / 2, per, bbox: [x0, y0, x1, y1] };
  }
  // closed Catmull–Rom spline through control points -> smooth blob
  function splinePts(cp, closed = true, seg = 10) {
    const out = [], n = cp.length;
    const P = (i) => closed ? cp[(i + n) % n] : cp[clamp(i, 0, n - 1)];
    const last = closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      for (let s = 0; s < seg; s++) {
        const t = s / seg, t2 = t * t, t3 = t2 * t;
        out.push([
          0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
          0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
        ]);
      }
    }
    if (!closed) out.push(cp[n - 1]);
    return out;
  }
  const Shape = {
    blob: (cp, seg = 6) => makeShape(splinePts(cp, true, seg)),
    poly: (pts) => makeShape(pts),
    ellipse(cx, cy, rx, ry, n = 28) { const p = []; for (let i = 0; i < n; i++) { const a = (i / n) * TAU; p.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]); } return makeShape(p); },
    // tapered capsule from (0,0) radius r0 to (len,0) radius r1
    capsule(len, r0, r1, n = 10) {
      const al = Math.asin(clamp((r0 - r1) / len, -0.99, 0.99));
      const p = [];
      const a0 = Math.PI / 2 - al;
      for (let i = 0; i <= n; i++) { const a = a0 - (i / n) * (2 * a0); p.push([len + r1 * Math.cos(a), r1 * Math.sin(a)]); }
      const b0 = -a0, span = Math.PI + 2 * al;
      for (let i = 0; i <= n; i++) { const a = b0 - (i / n) * span; p.push([r0 * Math.cos(a), r0 * Math.sin(a)]); }
      return makeShape(p);
    },
    // leaf/ear/feather along +x: length, half-width, bend (+ curls down)
    leaf(len, w, bend = 0, base = 0.35, pw = 0.75) {
      const cp = [], n = 7;
      const hw = (t) => w * Math.max(base * (1 - t), Math.sin(Math.PI * Math.pow(t, pw)));
      for (let i = 0; i <= n; i++) { const t = i / n; cp.push([t * len, -hw(t) + bend * t * t * len]); }
      for (let i = n - 1; i >= 0; i--) { const t = i / n; cp.push([t * len, hw(t) + bend * t * t * len]); }
      cp.push([-0.25 * w * base, 0]);
      return makeShape(splinePts(cp, true, 6));
    },
  };

  /* ---------- 5. Rig recorder + renderers ---------------------------------
     A creature's draw(rig, state) pushes transforms and calls rig.part(...).
     Parts are recorded with their world matrix; renderers then draw them.
     Angles: rig.aim(theta) points local +x at angle theta measured in the
     creature's own frame (0 = forward, +90° = straight down), regardless of
     the parent's rotation — handy for legs.                                  */
  class Rig {
    constructor() { this.parts = []; this.details = []; this.stack = []; this.m = new M2(); this.ang = 0; this.root = new M2(); }
    begin(rootM) { this.parts.length = 0; this.details.length = 0; this.stack.length = 0; this.m = rootM.clone(); this.root = rootM.clone(); this.ang = 0; return this; }
    save() { this.stack.push([this.m, this.ang]); }
    restore() { const s = this.stack.pop(); this.m = s[0]; this.ang = s[1]; }
    translate(x, y) { this.m = this.m.translate(x, y); }
    rotate(a) { this.m = this.m.rotate(a); this.ang += a; }
    aim(a) { this.rotate(a - this.ang); }
    scale(x, y = x) { this.m = this.m.scale(x, y); }
    part(shape, layer = 0) { this.parts.push({ shape, m: this.m, layer }); }
    // style: {w: lineWidth(px), a: alpha, fill: bool, clip: bool (clip to body)}
    detail(shape, style = {}) { this.details.push({ shape, m: this.m, style }); }
    // a chain of capsules (leg/tail). segs: [[shape, len, angle], ...]
    chain(segs, layer = 0) {
      this.save();
      for (const [shape, len, ang] of segs) { this.aim(ang); this.part(shape, layer); this.translate(len, 0); }
      const tip = this.m.apply(0, 0);
      this.restore();
      return tip;
    }
  }

  // a part's outline in screen space; mirrored parts use the reversed copy so all
  // parts wind the same way and a single nonzero fill gives the union of them
  function worldPath(item) { const m = item.m, p = new Path2D(); p.addPath(m.a * m.d - m.b * m.c < 0 ? item.shape.pathR : item.shape.path, m.dom()); return p; }
  function unionPath(list) { const p = new Path2D(); for (const q of list) p.addPath(q); return p; }
  function rigBBox(rig, pad = 8) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const it of rig.parts) {
      const [a, b, c, d] = it.shape.bbox;
      for (const [x, y] of [[a, b], [c, b], [a, d], [c, d]]) { const q = it.m.apply(x, y); x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); }
    }
    return [Math.floor(x0 - pad), Math.floor(y0 - pad), Math.ceil(x1 + pad), Math.ceil(y1 + pad)];
  }

  let _scratch = null;
  function scratch(w, h) {
    if (!_scratch) { _scratch = document.createElement("canvas"); }
    if (_scratch.width < w || _scratch.height < h) { _scratch.width = Math.max(w, _scratch.width); _scratch.height = Math.max(h, _scratch.height); }
    return _scratch;
  }

  /* Outline renderer: draws only the outer silhouette of all parts.
     opts: color, width(px), far (alpha of far-side limbs), occlude (0..1 body
     fill using bg colour so things behind are hidden), bg, glow, alpha        */
  function drawOutline(ctx, rig, o = {}) {
    const color = o.color || "#fff", w = o.width || 1.6, bg = o.bg || "#000";
    const occ = o.occlude ?? 0.85, farA = o.far ?? 0.5, alpha = o.alpha ?? 1;
    if (alpha <= 0.003) return;
    // bbox clipped to the visible canvas; q = device-pixel ratio of ctx (sharp on retina)
    const q = ctx.getTransform().a || 1, cw = ctx.canvas.width / q, ch = ctx.canvas.height / q;
    let [x0, y0, x1, y1] = rigBBox(rig, w * 3 + 4);
    x0 = Math.max(x0, -12); y0 = Math.max(y0, -12); x1 = Math.min(x1, cw + 12); y1 = Math.min(y1, ch + 12);
    const bw = x1 - x0, bh = y1 - y0;
    if (bw <= 0 || bh <= 0) return;
    const sc = scratch(Math.ceil(bw * q), Math.ceil(bh * q)), c = sc.getContext("2d");
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, Math.ceil(bw * q) + 1, Math.ceil(bh * q) + 1);
    c.setTransform(q, 0, 0, q, -x0 * q, -y0 * q);
    c.lineJoin = "round"; c.lineCap = "round";
    const nearL = [], farL = [];
    for (const it of rig.parts) (it.layer ? farL : nearL).push(worldPath(it));
    const near = unionPath(nearL), far = farL.length ? unionPath(farL) : null;
    // far limbs (dimmer)
    if (far) {
      c.globalCompositeOperation = "source-over"; c.globalAlpha = farA; c.strokeStyle = color; c.lineWidth = 2 * w;
      c.stroke(far);
      c.globalAlpha = 1; c.globalCompositeOperation = "destination-out";
      c.fill(far);
    }
    // near body: erase what it hides, then the outline of the union
    c.globalCompositeOperation = "destination-out";
    c.fill(near);
    c.globalCompositeOperation = "source-over"; c.strokeStyle = color; c.lineWidth = 2 * w;
    c.stroke(near);
    c.globalCompositeOperation = "destination-out";
    c.fill(near);
    // details (eyes, stripes, spots...). Details clipped to the body are drawn
    // together inside ONE clip: clipping per detail is very slow on some devices.
    c.globalCompositeOperation = "source-over";
    const detail = (d) => {
      const p = worldPath(d), s = d.style;
      c.globalAlpha = s.a ?? 1;
      if (s.fill) { c.fillStyle = s.color || color; c.fill(p); }
      if (s.w) { c.strokeStyle = s.color || color; c.lineWidth = s.w; c.stroke(p); }
      if (s.erase) { c.globalCompositeOperation = "destination-out"; c.fill(p); c.globalCompositeOperation = "source-over"; }
    };
    if (rig.details.some((d) => d.style.clip)) {
      c.save(); c.clip(near);
      for (const d of rig.details) if (d.style.clip) detail(d);
      c.restore();
    }
    for (const d of rig.details) if (!d.style.clip) detail(d);
    c.globalAlpha = 1;
    // optional chalk grain: punch tiny holes into the lines (o.grain = canvas)
    if (o.grain) {
      c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = "destination-out";
      c.globalAlpha = o.grainA ?? 0.85; c.fillStyle = c.createPattern(o.grain, "repeat"); c.fillRect(0, 0, Math.ceil(bw * q) + 1, Math.ceil(bh * q) + 1); c.restore();
    }
    // occlusion: dark body fill underneath the lines
    if (occ > 0) {
      c.globalCompositeOperation = "destination-over"; c.globalAlpha = occ; c.fillStyle = bg;
      c.fill(near);
      if (far) c.fill(far);
    }
    c.globalCompositeOperation = "source-over"; c.globalAlpha = 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    if (o.glow) { ctx.shadowColor = color; ctx.shadowBlur = o.glow; }
    ctx.drawImage(sc, 0, 0, bw * q, bh * q, x0, y0, bw, bh);
    ctx.restore();
  }
  // solid silhouette
  function drawSolid(ctx, rig, color = "#fff", alpha = 1, farAlpha = 0.6) {
    ctx.save(); ctx.fillStyle = color;
    for (const it of rig.parts) { ctx.globalAlpha = alpha * (it.layer ? farAlpha : 1); ctx.fill(worldPath(it)); } // per part: keeps the far/near alphas
    ctx.restore();
  }

  /* particle sampling of a rig: returns [{pi, x, y}] in part-local coords so a
     particle stays glued to its body part while the animal moves.            */
  function pointInPoly(pts, x, y) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  function sampleRig(rig, n, rand, edgeFrac = 0.45, farW = 0.6) {
    const ps = rig.parts;
    const wA = ps.map((p) => p.shape.area * (p.layer ? farW : 1) * p.m.sx * p.m.sx);
    const wP = ps.map((p) => p.shape.per * (p.layer ? farW : 1) * p.m.sx);
    const sA = wA.reduce((a, b) => a + b, 0), sP = wP.reduce((a, b) => a + b, 0);
    const out = [];
    const pick = (w, s) => { let r = rand() * s; for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) return i; } return w.length - 1; };
    for (let k = 0; k < n; k++) {
      if (rand() < edgeFrac) { // on the edge
        const pi = pick(wP, sP), sh = ps[pi].shape, pts = sh.pts;
        let r = rand() * sh.per;
        for (let i = 0; i < pts.length; i++) {
          const a = pts[i], b = pts[(i + 1) % pts.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
          if (r <= L) { const t = r / L; out.push({ pi, x: lerp(a[0], b[0], t), y: lerp(a[1], b[1], t) }); break; }
          r -= L;
        }
        if (out.length < k + 1) out.push({ pi, x: pts[0][0], y: pts[0][1] });
      } else { // inside
        const pi = pick(wA, sA), sh = ps[pi].shape, [x0, y0, x1, y1] = sh.bbox;
        let x, y, tries = 0;
        do { x = lerp(x0, x1, rand()); y = lerp(y0, y1, rand()); } while (!pointInPoly(sh.pts, x, y) && ++tries < 60);
        out.push({ pi, x, y });
      }
    }
    return out;
  }
  function rigTargets(rig, samples, out) {
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i], m = rig.parts[s.pi].m;
      out[2 * i] = m.a * s.x + m.c * s.y + m.e;
      out[2 * i + 1] = m.b * s.x + m.d * s.y + m.f;
    }
    return out;
  }

  /* ---------- 6. contours: mask -> ordered outline polygon ---------------- */
  // Moore-neighbour tracing of the outer boundary of an alpha mask.
  function traceMask(canvas, step = 1, thr = 128) {
    const w = canvas.width, h = canvas.height;
    const data = canvas.getContext("2d").getImageData(0, 0, w, h).data;
    const W = Math.floor(w / step), H = Math.floor(h / step);
    const on = (x, y) => x >= 0 && y >= 0 && x < W && y < H && data[((y * step) * w + x * step) * 4 + 3] > thr;
    let sx = -1, sy = -1;
    outer: for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (on(x, y)) { sx = x; sy = y; break outer; }
    if (sx < 0) return [];
    const dirs = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
    const pts = [[sx * step, sy * step]];
    let cx = sx, cy = sy, back = 4; // came from the west
    for (let iter = 0; iter < W * H * 2; iter++) {
      let found = false;
      for (let k = 1; k <= 8; k++) {
        const d = (back + k) % 8, nx = cx + dirs[d][0], ny = cy + dirs[d][1];
        if (on(nx, ny)) { cx = nx; cy = ny; back = (d + 4) % 8; found = true; break; }
      }
      if (!found) break;
      if (cx === sx && cy === sy) break;
      pts.push([cx * step, cy * step]);
    }
    return pts;
  }
  // resample a closed polyline to n points evenly spaced by arc length
  function resample(pts, n) {
    const L = [0];
    for (let i = 1; i <= pts.length; i++) { const a = pts[i - 1], b = pts[i % pts.length]; L.push(L[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
    const tot = L[L.length - 1], out = [];
    let j = 0;
    for (let k = 0; k < n; k++) {
      const s = (k / n) * tot;
      while (L[j + 1] < s) j++;
      const a = pts[j], b = pts[(j + 1) % pts.length], t = (s - L[j]) / (L[j + 1] - L[j] || 1);
      out.push([lerp(a[0], b[0], t), lerp(a[1], b[1], t)]);
    }
    return out;
  }
  function smoothClosed(pts, it = 2) {
    let p = pts;
    for (let k = 0; k < it; k++) p = p.map((q, i) => { const a = p[(i - 1 + p.length) % p.length], b = p[(i + 1) % p.length]; return [(a[0] + 2 * q[0] + b[0]) / 4, (a[1] + 2 * q[1] + b[1]) / 4]; });
    return p;
  }
  // Douglas–Peucker simplification (closed polygon handled by splitting)
  function simplify(pts, eps) {
    const dp = (a, b) => {
      let md = 0, mi = -1;
      const [x1, y1] = pts[a], [x2, y2] = pts[b], L = Math.hypot(x2 - x1, y2 - y1) || 1;
      for (let i = a + 1; i < b; i++) { const d = Math.abs((y2 - y1) * pts[i][0] - (x2 - x1) * pts[i][1] + x2 * y1 - y2 * x1) / L; if (d > md) { md = d; mi = i; } }
      if (md > eps) return [...dp(a, mi).slice(0, -1), ...dp(mi, b)];
      return [pts[a], pts[b]];
    };
    const h = Math.floor(pts.length / 2);
    return [...dp(0, h).slice(0, -1), ...dp(h, pts.length - 1).slice(0, -1)];
  }
  // render a rig into a mask canvas and return its outline (screen coords)
  function rigOutline(rig, n = 400, step = 1) {
    const [x0, y0, x1, y1] = rigBBox(rig, 6);
    const cv = document.createElement("canvas"); cv.width = x1 - x0; cv.height = y1 - y0;
    const c = cv.getContext("2d"); c.translate(-x0, -y0); c.fillStyle = "#fff";
    for (const it of rig.parts) c.fill(worldPath(it));
    const raw = traceMask(cv, step).map(([x, y]) => [x + x0, y + y0]);
    return resample(smoothClosed(raw, 3), n);
  }

  // periodic keyframe interpolation: keys = [{...}, {...}] evenly spaced over
  // one cycle; returns the Catmull–Rom-blended object at phase (0..1)
  function cycle(keys, phase) {
    const n = keys.length, f = fract(phase) * n, i = Math.floor(f), t = f - i;
    const k0 = keys[(i - 1 + n) % n], k1 = keys[i], k2 = keys[(i + 1) % n], k3 = keys[(i + 2) % n], o = {};
    for (const key in k1) {
      const p0 = k0[key], p1 = k1[key], p2 = k2[key], p3 = k3[key];
      o[key] = 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
    }
    return o;
  }
  function blendPose(a, b, t) { const o = {}; for (const k in a) o[k] = lerp(a[k], b[k] ?? a[k], t); return o; }

  /* ---------- 7. keyframe helpers (above) + export ------------------------ */
  G.WQ = G.WQ || {};
  G.WQ.L = { TAU, DEG, clamp, lerp, smooth, fract, Ease, win, mulberry32, gauss, makeNoise, M2, Shape, splinePts, makeShape,
             Rig, drawOutline, drawSolid, sampleRig, rigTargets, rigBBox, worldPath, traceMask, resample, smoothClosed,
             simplify, rigOutline, cycle, blendPose, pointInPoly };
})(window);
