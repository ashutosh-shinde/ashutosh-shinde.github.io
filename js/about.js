/* =============================================================================
   about.js — the small moving parts of the About page               (about/)
   -----------------------------------------------------------------------------
   • Skill cards: a tap turns a card over to show every skill on it. On the
     front, its skills roll past one by one under a small chalk sketch that
     keeps drawing itself:
       fourier    a square wave built from its Fourier sums, term by term
       orbits     predator–prey orbits around their equilibrium (Lotka–Volterra)
       terminal   R and Python typed into a console
       telemetry  a tracked animal's radio fixes appearing over a contour map
   • In the field: the numbers count up the first time they come into view.
   Everything waits while it is off screen. Reduced motion: still sketches, no
   rolling or counting; the cards still turn over.
   HOW TO EDIT: a card's skills are the <li>s on its back in about/index.html;
   its sketch is its data-sketch. Timings in ROLL and in each sketch below.
   ============================================================================= */
(function (G) {
  "use strict";
  const reduced = () => G.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const smooth = (u) => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
  const ink = (a) => "rgba(246,244,236," + clamp(a, 0, 1).toFixed(3) + ")";
  const SERIF = '"WQ Serif", "Latin Modern Roman", Georgia, serif';
  const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  // a chalk stroke (the site's own, js/lib/chalk.js), or a plain one if that is missing
  function line(c, pts, a, w, dash) {
    const CH = G.WQ && G.WQ.CH;
    if (CH && CH.line) return CH.line(c, pts, a, w, dash);
    c.strokeStyle = ink(a); c.lineWidth = w; c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke();
  }

  /* ---------------------------------------------------------------- the sketches */
  // predator–prey orbits (x' = x(1 − y), y' = y(x − 1)), worked out once
  let ORB = null;
  function orbitsOnce() {
    if (ORB) return ORB;
    const f = (x, y) => [x * (1 - y), y * (x - 1)];
    ORB = [1.55, 2.25, 3.0].map((x0) => {
      let x = x0, y = 1, pts = [[x, y]], dt = 0.012;
      for (let i = 0; i < 4000; i++) {
        const k1 = f(x, y), k2 = f(x + dt / 2 * k1[0], y + dt / 2 * k1[1]), k3 = f(x + dt / 2 * k2[0], y + dt / 2 * k2[1]), k4 = f(x + dt * k3[0], y + dt * k3[1]);
        const nx = x + dt / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]), ny = y + dt / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
        if (i > 50 && y < 1 && ny >= 1 && nx > 1) { pts.push([nx, ny]); break; }   // back where it started: one full turn
        x = nx; y = ny; pts.push([x, y]);
      }
      return pts;
    });
    return ORB;
  }
  const CODE = [
    ["> ", "r <- 0.8; K <- 500"],
    ["> ", "out <- ode(N0, t, f, p)"],
    [">>> ", "import numpy as np"],
    [">>> ", "x += mu*dt + s*dW"],
    ["> ", "plot(out, type = 'l')"],
    [">>> ", "fixes = read('collar')"],
  ];
  const SKETCH = {
    // a square wave and its Fourier sums: one more odd harmonic every second, then it starts again
    fourier(c, w, h, t, still) {
      const x0 = 6, x1 = w - 6, y0 = h * 0.5, A = Math.min(h * 0.27, 46), P = 3 * Math.PI, X = (u) => x0 + ((x1 - x0) * u) / P;
      const steps = 8, per = 1, hold = 1.8, cycle = steps * per + hold, tt = still ? 3.6 : t % cycle;
      const k = Math.min(steps - 1, Math.floor(tt / per)), f = k < steps - 1 ? smooth((tt - k * per) / (per * 0.75)) : 1;
      const fade = still ? 1 : 1 - smooth((tt - (cycle - 0.4)) / 0.4);
      line(c, [[x0, y0], [x1, y0]], 0.16, 1, false);
      const sq = []; for (let i = 0; i <= 3; i++) { const s = i % 2 ? -1 : 1, a = X(i * Math.PI), b = X(Math.min(P, (i + 1) * Math.PI)); if (a >= x1) break; sq.push([a, y0 - s * A], [b, y0 - s * A]); }
      c.save(); c.setLineDash([3, 4]); c.strokeStyle = ink(0.3); c.lineWidth = 1; c.beginPath(); sq.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke(); c.restore();
      const pts = [];
      for (let i = 0; i <= 240; i++) {
        const u = (P * i) / 240; let v = 0;
        for (let j = 1; j <= 2 * k + 1; j += 2) v += Math.sin(j * u) / j;
        if (k < steps - 1) v += (f * Math.sin((2 * k + 3) * u)) / (2 * k + 3);
        pts.push([X(u), y0 - (A * 4 * v) / Math.PI]);
      }
      line(c, pts, 0.95 * fade, 1.6, true);
      const n = k * 2 + 1 + (k < steps - 1 && f > 0.5 ? 2 : 0);
      c.font = `italic 400 12.5px ${SERIF}`; c.fillStyle = ink(0.55 * fade); c.textAlign = "right"; c.textBaseline = "alphabetic";
      c.fillText(`${(n + 1) / 2} term${n > 1 ? "s" : ""}`, x1, h - 4);
    },
    // predator–prey: faint orbits round the equilibrium, one state travelling round with a fading trail
    orbits(c, w, h, t, still) {
      const O = orbitsOnce(), ox = 14, oy = h - 16, m = 3.25, sx = (w - ox - 10) / m, sy = (oy - 10) / m;
      const P = ([x, y]) => [ox + x * sx, oy - y * sy];
      line(c, [[ox, 8], [ox, oy], [w - 6, oy]], 0.34, 1.1, false);
      c.font = `italic 400 11.5px ${SERIF}`; c.fillStyle = ink(0.5); c.textBaseline = "alphabetic";
      c.textAlign = "right"; c.fillText("prey", w - 6, oy + 13);
      c.textAlign = "left"; c.fillText("predators", ox + 6, 14);
      O.forEach((o, i) => { if (i !== 1) line(c, o.map(P), 0.2, 1, false); });
      const o = O[1], n = o.length, head = still ? Math.floor(n * 0.62) : Math.floor((((t * 0.2 * n) % n) + n) % n);
      line(c, o.map(P), 0.14, 1, false);
      const seg = 10, len = Math.floor(n * 0.45);
      for (let s = 0; s < seg; s++) {
        const a = head - len + Math.floor((len * s) / seg), b = head - len + Math.floor((len * (s + 1)) / seg) + 1, pts = [];
        for (let i = a; i <= b; i++) pts.push(P(o[((i % n) + n) % n]));
        line(c, pts, 0.15 + (0.8 * (s + 1)) / seg, 1.5, false);
      }
      const [hx, hy] = P(o[head]), g = c.createRadialGradient(hx, hy, 0, hx, hy, 9);
      g.addColorStop(0, ink(0.6)); g.addColorStop(1, ink(0)); c.fillStyle = g; c.fillRect(hx - 9, hy - 9, 18, 18);
      c.fillStyle = ink(0.98); c.beginPath(); c.arc(hx, hy, 2.6, 0, 7); c.fill();
      const [ex, ey] = P([1, 1]); c.strokeStyle = ink(0.55); c.lineWidth = 1; c.beginPath(); c.arc(ex, ey, 3, 0, 7); c.stroke();
    },
    // a console: R and Python typed line by line, the oldest scrolling away
    terminal(c, w, h, t, still) {
      const fs = w < 200 ? 10.5 : 11.5, lh = Math.round(fs * 1.55), rows = Math.max(2, Math.floor((h - 6) / lh)), cps = 22;
      const dur = CODE.map(([p, s]) => s.length / cps + 0.6), T = dur.reduce((a, b) => a + b, 0);
      const tt = still ? T * 1000 - 0.3 : t, cyc = Math.floor(tt / T); let r = tt - cyc * T, i = 0;
      while (i < CODE.length - 1 && r >= dur[i]) { r -= dur[i]; i++; }
      const g = cyc * CODE.length + i, typed = Math.min(CODE[i][1].length, Math.floor(r * cps));
      c.save(); c.beginPath(); c.rect(0, 0, w, h); c.clip();
      c.font = `400 ${fs}px ${MONO}`; c.textAlign = "left"; c.textBaseline = "alphabetic";
      for (let k = 0; k < rows; k++) {
        const gi = g - (rows - 1 - k); if (gi < 0) continue;
        const [p, s] = CODE[gi % CODE.length], y = 4 + lh * (k + 1) - 4, text = gi === g ? s.slice(0, typed) : s;
        c.fillStyle = ink(0.42); c.fillText(p, 4, y);
        const px = 4 + c.measureText(p).width; c.fillStyle = ink(gi === g ? 0.95 : 0.66); c.fillText(text, px, y);
        if (gi === g && (typed < s.length || still || Math.floor(t * 2) % 2 === 0)) { const cx = px + c.measureText(text).width + 1; c.fillStyle = ink(0.85); c.fillRect(cx, y - fs + 2, fs * 0.55, fs); }
      }
      c.restore();
    },
    // radio telemetry: fixes appear one by one along an animal's path over a faint contour map, each with a ping
    telemetry(c, w, h, t, still) {
      const key = w + "x" + h;
      if (!this._tm || this._tm.key !== key) {
        const r = rng(7), blobs = [[0.25, 0.3, 0.2], [0.7, 0.65, 0.24], [0.78, 0.22, 0.13]].map(([cx, cy, rr]) => ({ cx: cx * w, cy: cy * h, rr: rr * Math.min(w, h) * 1.3, p: r() * 6, q: r() * 6 }));
        const fixes = []; let x = w * 0.1, y = h * 0.8;
        for (let i = 0; i < 13; i++) { fixes.push([x, y]); x += w * (0.045 + 0.05 * r()); y += h * (-0.05 - 0.05 * (r() - 0.35)); x = clamp(x, 10, w - 10); y = clamp(y + (r() - 0.5) * h * 0.08, 14, h - 10); }
        this._tm = { key, blobs, fixes };
      }
      const { blobs, fixes } = this._tm, n = fixes.length, per = 0.6, hold = 2.2, cycle = n * per + hold, tt = still ? cycle - hold : t % cycle;
      const fade = still ? 1 : 1 - smooth((tt - (cycle - 0.5)) / 0.5);
      for (const b of blobs) for (let lv = 1; lv <= 2; lv++) {   // the contours
        const pts = []; for (let i = 0; i <= 60; i++) { const th = (i / 60) * Math.PI * 2, rad = b.rr * (0.5 * lv) * (1 + 0.16 * Math.sin(3 * th + b.p) + 0.08 * Math.sin(5 * th + b.q)); pts.push([b.cx + rad * Math.cos(th), b.cy + rad * 0.72 * Math.sin(th)]); }
        line(c, pts, 0.13, 0.9, false);
      }
      const shown = still ? n : Math.min(n, Math.floor(tt / per) + 1);
      c.save(); c.setLineDash([3, 4]); c.strokeStyle = ink(0.45 * fade); c.lineWidth = 1.1; c.beginPath();
      for (let i = 0; i < shown; i++) (i ? c.lineTo(...fixes[i]) : c.moveTo(...fixes[i]));
      c.stroke(); c.restore();
      for (let i = 0; i < shown; i++) { const [fx, fy] = fixes[i], last = i === shown - 1; c.fillStyle = ink((last ? 0.98 : 0.6) * fade); c.beginPath(); c.arc(fx, fy, last ? 3 : 2, 0, 7); c.fill(); }
      if (!still && shown > 0) {                                  // the newest fix pings
        const age = tt - (shown - 1) * per, [fx, fy] = fixes[shown - 1];
        for (const d of [0, 0.25]) { const a = age - d; if (a <= 0 || a > 0.9) continue; c.strokeStyle = ink(0.6 * (1 - a / 0.9) * fade); c.lineWidth = 1; c.beginPath(); c.arc(fx, fy, 3 + a * 20, 0, 7); c.stroke(); }
      }
      c.font = `italic 400 11.5px ${SERIF}`; c.fillStyle = ink(0.5); c.textAlign = "center"; c.textBaseline = "alphabetic";
      c.fillText("N", w - 10, 12); line(c, [[w - 10, 16], [w - 10, 30]], 0.4, 1, false);
    },
  };

  /* ---------------------------------------------------------------- skill cards */
  const ROLL = { every: 2.2, stagger: 0.55 };                    // seconds between skills on a card's front, and between cards
  function skills() {
    const cards = [...document.querySelectorAll(".skill")];
    if (!cards.length) return;
    const items = cards.map((card, idx) => {
      const names = [...card.querySelectorAll(".skill__list li")].map((li) => li.textContent.trim());
      const roll = card.querySelector(".skill__roll span"), count = card.querySelector(".skill__count");
      const kind = card.querySelector(".skill__front .skill__kind").textContent.trim();
      const btn = card.querySelector(".skill__flip"), label = btn.querySelector(".visually-hidden");
      if (roll) roll.textContent = names[0] || "";
      if (count) count.textContent = names.length + " skills";
      btn.addEventListener("click", () => {
        const on = !card.classList.contains("is-flipped");
        card.classList.toggle("is-flipped", on); btn.setAttribute("aria-expanded", String(on));
        label.textContent = on ? kind + ": turn the card back" : kind + ": show every skill";
      });
      const cv = card.querySelector(".skill__sketch");
      return { card, names, roll, i: 0, next: ROLL.every + idx * ROLL.stagger, cv, c: cv ? cv.getContext("2d") : null, draw: SKETCH[card.dataset.sketch], w: 0, h: 0 };
    });
    const fit = (it) => {
      if (!it.cv) return;
      const q = Math.min(2, G.devicePixelRatio || 1), w = Math.max(1, Math.round(it.cv.clientWidth)), h = Math.max(1, Math.round(it.cv.clientHeight));
      if (w === it.w && h === it.h) return;
      it.w = w; it.h = h; it.cv.width = Math.round(w * q); it.cv.height = Math.round(h * q); it.c.setTransform(q, 0, 0, q, 0, 0);
    };
    const paint = (it, t, still) => {
      if (!it.c || !it.draw) return;
      fit(it); it.c.clearRect(0, 0, it.w, it.h); it.c.lineCap = it.c.lineJoin = "round";
      it.draw.call(SKETCH, it.c, it.w, it.h, t, still);
    };
    const rollTo = (it) => {
      if (!it.roll || it.names.length < 2 || it.card.classList.contains("is-flipped")) return;
      it.i = (it.i + 1) % it.names.length;
      const s = it.roll, next = it.names[it.i];
      if (!s.animate) { s.textContent = next; return; }
      s.animate([{ transform: "translateY(0)", opacity: 1 }, { transform: "translateY(-70%)", opacity: 0 }], { duration: 200, easing: "ease-in" }).onfinish = () => {
        s.textContent = next;
        s.animate([{ transform: "translateY(70%)", opacity: 0 }, { transform: "translateY(0)", opacity: 1 }], { duration: 260, easing: "ease-out" });
      };
    };
    let on = false, raf = 0, t0 = 0, last = 0;
    const frame = (now) => {
      const t = Math.max(0, (now - t0) / 1000); last = t;
      for (const it of items) {
        paint(it, t, false);
        if (t >= it.next) { it.next = t + ROLL.every; rollTo(it); }
      }
      raf = on ? G.requestAnimationFrame(frame) : 0;
    };
    const start = () => { if (on || reduced()) return; on = true; t0 = performance.now() - last * 1000; raf = G.requestAnimationFrame(frame); };
    const stop = () => { on = false; G.cancelAnimationFrame(raf); };
    const still = () => items.forEach((it) => paint(it, 0, true));
    const list = cards[0].parentElement;
    let seen = false;
    new IntersectionObserver((es) => { seen = es[es.length - 1].isIntersecting; if (seen && !document.hidden) start(); else stop(); }, { rootMargin: "60px 0px" }).observe(list);
    document.addEventListener("visibilitychange", () => (document.hidden ? stop() : seen && start()));
    new ResizeObserver(() => { if (!on) still(); }).observe(list);
    const fonts = document.fonts ? document.fonts.ready : Promise.resolve();
    fonts.then(() => { if (!on) still(); });
  }

  /* ---------------------------------------------------------------- in the field: the numbers count up */
  function tally() {
    const box = document.querySelector(".tally");
    if (!box || reduced()) return;
    const nums = [...box.querySelectorAll(".tally__n[data-count]")];
    const io = new IntersectionObserver((es) => {
      if (!es.some((e) => e.isIntersecting)) return;
      io.disconnect();
      const t0 = performance.now();
      nums.forEach((el) => { el.textContent = "0"; });
      const tick = (now) => {
        let more = false;
        nums.forEach((el, i) => {
          const n = +el.dataset.count, p = clamp((now - t0 - i * 120) / 1300, 0, 1), e = 1 - Math.pow(1 - p, 3);
          el.textContent = Math.round(n * e) + (p >= 1 ? el.dataset.suffix || "" : "");
          if (p < 1) more = true;
        });
        if (more) G.requestAnimationFrame(tick);
      };
      G.requestAnimationFrame(tick);
    }, { threshold: 0.35 });
    io.observe(box);
  }

  function start() { skills(); tally(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})(window);
