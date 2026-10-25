/* =============================================================================
   ode.js — ODE solvers and 2×2 eigenvalues for the simulation pages (WQ.ODE)
   -----------------------------------------------------------------------------
   Pure maths, no page needed (it also loads in node for the tests).

     WQ.ODE.solve(f, y0, t0, t1, opts)        adaptive Dormand–Prince 5(4), non-stiff
     WQ.ODE.solveStiff(f, jac, y0, t0, t1, o)  adaptive ROS2 (Rosenbrock, L-stable, order 2)
                                              for AUTONOMOUS stiff systems only (f must not
                                              depend on t: the method has no ∂f/∂t term)
     WQ.ODE.eig2(a, b, c, d)                   eigenvalues of [[a, b], [c, d]]
     WQ.ODE.classify2(e, tol)                  stable node / saddle / spiral / centre …
     WQ.ODE.bisect(g, a, b)                    a root of g in [a, b]
     WQ.ODE.jacFD(f, y, h)                     numerical Jacobian (for runtime checks)

   f(t, y, dy) writes dy/dt into dy (Float64Array); jac(t, y, J) fills J, a flat
   Float64Array of n·n entries, row-major (J[i*n + j] = ∂f_i/∂y_j).
   Options: rtol, atol (a number, or one per component), samples, times, nonneg, floor (a
   number or one per component), stop(t, y), hmax, h0, maxSteps, big.
   Both solvers return { t, y: [Float64Array per component], n, status, tEnd, yEnd, steps }
   where status is "ok" | "stopped" | "maxsteps" | "blowup", yEnd is the state at tEnd (where
   it stopped or broke off, or at t1), and n counts the filled
   output samples: evenly spaced from t0 to t1, or at `times` (sorted, starting at t0,
   none past t1) when it is given.

   HOW TO EDIT: the default tolerances and step limits in DEFAULTS / STIFF_DEFAULTS.
   ============================================================================= */
(function (G) {
  "use strict";

  const DEFAULTS = { rtol: 1e-7, atol: 1e-9, maxSteps: 200000, samples: 600, nonneg: true, big: 1e9 };
  const STIFF_DEFAULTS = { rtol: 1e-5, atol: 1e-8, maxSteps: 100000, samples: 600, nonneg: true, big: 1e9 };

  /* ------------------------------------------------ Dormand–Prince 5(4) tableau */
  const C = [0, 1 / 5, 3 / 10, 4 / 5, 8 / 9, 1, 1];
  const A = [
    [],
    [1 / 5],
    [3 / 40, 9 / 40],
    [44 / 45, -56 / 15, 32 / 9],
    [19372 / 6561, -25360 / 2187, 64448 / 6561, -212 / 729],
    [9017 / 3168, -355 / 33, 46732 / 5247, 49 / 176, -5103 / 18656],
    [35 / 384, 0, 500 / 1113, 125 / 192, -2187 / 6784, 11 / 84],
  ];
  const B = [35 / 384, 0, 500 / 1113, 125 / 192, -2187 / 6784, 11 / 84, 0];
  const E = [71 / 57600, 0, -71 / 16695, 71 / 1920, -17253 / 339200, 22 / 525, -1 / 40]; // b − b*

  function setup(y0, t0, t1, opts, defaults) {
    const o = Object.assign({}, defaults, opts || {});
    const n = y0.length, span = t1 - t0;
    if (o.h0 == null) o.h0 = span * 1e-4;
    if (o.hmax == null) o.hmax = span / 20;
    const S = o.times ? o.times.length : Math.max(2, o.samples | 0);
    const out = { t: new Float64Array(S), y: [], n: 0, status: "ok", tEnd: t0, steps: 0 };
    for (let i = 0; i < n; i++) out.y.push(new Float64Array(S));
    for (let k = 0; k < S; k++) out.t[k] = o.times ? o.times[k] : t0 + (span * k) / (S - 1);
    let floor = null;
    if (o.floor != null) { floor = new Float64Array(n); for (let i = 0; i < n; i++) floor[i] = Array.isArray(o.floor) || ArrayBuffer.isView(o.floor) ? o.floor[i] : o.floor; }
    return { o, n, S, out, floor };
  }
  function bound(y, n, o, floor) { // non-negativity and floor, after an accepted step (or an interpolation)
    if (o.nonneg) for (let i = 0; i < n; i++) if (y[i] < 0) y[i] = 0;
    if (floor) for (let i = 0; i < n; i++) if (y[i] < floor[i]) y[i] = floor[i];
  }
  function bad(y, n, big) { for (let i = 0; i < n; i++) if (!Number.isFinite(y[i]) || Math.abs(y[i]) > big) return true; return false; }
  function errNorm(err, y, ynew, n, o) { // (atol: one number, or one per component)
    let s = 0; const per = Array.isArray(o.atol) || ArrayBuffer.isView(o.atol);
    for (let i = 0; i < n; i++) { const sc = (per ? o.atol[i] : o.atol) + o.rtol * Math.max(Math.abs(y[i]), Math.abs(ynew[i])); const r = err[i] / sc; s += r * r; }
    return Math.sqrt(s / n);
  }

  /* ------------------------------------------------ solve: Dormand–Prince 5(4) */
  function solve(f, y0, t0, t1, opts) {
    const { o, n, S, out, floor } = setup(y0, t0, t1, opts, DEFAULTS);
    const K = []; for (let s = 0; s < 7; s++) K.push(new Float64Array(n));
    let y = Float64Array.from(y0), yn = new Float64Array(n), tmp = new Float64Array(n), err = new Float64Array(n);
    const fN = new Float64Array(n), yi = new Float64Array(n);
    bound(y, n, o, floor);
    let t = t0, h = Math.min(o.h0, o.hmax), k = 0;
    const put = (yy) => { for (let i = 0; i < n; i++) out.y[i][k] = yy[i]; k++; };
    put(y); out.tEnd = t0;
    if (bad(y, n, o.big)) { out.n = k; out.status = "blowup"; out.yEnd = Float64Array.from(y); return out; }
    if (o.stop && o.stop(t, y)) { out.n = k; out.status = "stopped"; out.yEnd = Float64Array.from(y); return out; }
    f(t, y, K[0]);
    let tries = 0;
    while (k < S) {
      if (tries >= o.maxSteps) { out.status = "maxsteps"; break; }
      tries++;
      if (t + h > t1) h = t1 - t;
      if (h <= Math.abs(t) * 1e-15 + 1e-300) { h = Math.max(h, 1e-15); }
      for (let s = 1; s < 7; s++) {
        for (let i = 0; i < n; i++) { let acc = 0; const a = A[s]; for (let j = 0; j < s; j++) acc += a[j] * K[j][i]; tmp[i] = y[i] + h * acc; }
        f(t + C[s] * h, tmp, K[s]);
      }
      // tmp now holds the 5th-order solution (row 7 = b), K[6] = f at it (FSAL)
      for (let i = 0; i < n; i++) { yn[i] = tmp[i]; let e = 0; for (let j = 0; j < 7; j++) e += E[j] * K[j][i]; err[i] = h * e; }
      const En = errNorm(err, y, yn, n, o);
      if (!(En <= 1) && Number.isFinite(En)) { h *= Math.max(0.2, 0.9 * Math.pow(En, -0.2)); continue; }
      if (!Number.isFinite(En)) { h *= 0.2; if (bad(yn, n, o.big)) { /* the step itself exploded: shrink and retry */ } continue; }
      // accepted
      let tNew = t + h, stopped = false;
      for (let i = 0; i < n; i++) fN[i] = K[0][i];
      const interp = (th, dst) => { // cubic Hermite between (t, y) and (t + h, yn)
        const th2 = th * th, th3 = th2 * th;
        const h00 = 2 * th3 - 3 * th2 + 1, h10 = th3 - 2 * th2 + th, h01 = -2 * th3 + 3 * th2, h11 = th3 - th2;
        for (let i = 0; i < n; i++) dst[i] = h00 * y[i] + h10 * h * fN[i] + h01 * yn[i] + h11 * h * K[6][i];
        bound(dst, n, o, floor);
      };
      let tStop = tNew, bStop = 1;
      if (o.stop && o.stop(tNew, yn)) { // locate the first moment the stop condition holds inside this step
        let a = 0, b = 1;
        for (let it = 0; it < 40; it++) { const m = 0.5 * (a + b); interp(m, yi); if (o.stop(t + m * h, yi)) b = m; else a = m; }
        tStop = t + b * h; bStop = b; stopped = true;
      }
      // fill the samples in (t, tStop] by interpolation
      while (k < S && out.t[k] <= tStop + 1e-12 * Math.max(1, Math.abs(tStop))) { interp((out.t[k] - t) / h, yi); put(yi); }
      // (the final state at the very point the bisection tested, so it satisfies the stop condition: from
      // (tStop − t)/h the rounding could put it a hair on the other side)
      if (stopped) { interp(bStop, yi); out.steps++; out.tEnd = tStop; out.status = "stopped"; y.set(yi); break; }
      t = tNew; out.steps++;
      const swap = y; y = yn; yn = swap;
      const clampedBefore = Float64Array.from(y); bound(y, n, o, floor);
      let changed = false; for (let i = 0; i < n; i++) if (y[i] !== clampedBefore[i]) { changed = true; break; }
      out.tEnd = t;
      if (bad(y, n, o.big)) { out.status = "blowup"; break; }
      if (t >= t1) break;
      // FSAL: reuse the last stage unless the state was clamped
      if (changed) f(t, y, K[0]); else { const s0 = K[0]; K[0] = K[6]; K[6] = s0; }
      const fac = En === 0 ? 5 : Math.min(5, Math.max(0.2, 0.9 * Math.pow(En, -0.2)));
      h = Math.min(h * fac, o.hmax);
    }
    out.n = k;
    if (out.status === "ok" && k < S) { // round-off at the very end: fill with the final state
      while (k < S) { for (let i = 0; i < n; i++) out.y[i][k] = y[i]; k++; }
      out.n = k;
    }
    out.yEnd = Float64Array.from(y); // (the state at tEnd)
    return out;
  }

  /* ------------------------------------------------ solveStiff: ROS2 */
  const GAMMA = 1 + 1 / Math.SQRT2;
  function solveLinear(n, M, r) { // Gaussian elimination with partial pivoting; M (flat n·n) and r are overwritten; returns r
    for (let c = 0; c < n; c++) {
      let p = c, best = Math.abs(M[c * n + c]);
      for (let i = c + 1; i < n; i++) { const v = Math.abs(M[i * n + c]); if (v > best) { best = v; p = i; } }
      if (best === 0) return null;
      if (p !== c) { for (let j = 0; j < n; j++) { const a = M[c * n + j]; M[c * n + j] = M[p * n + j]; M[p * n + j] = a; } const b = r[c]; r[c] = r[p]; r[p] = b; }
      for (let i = c + 1; i < n; i++) {
        const m = M[i * n + c] / M[c * n + c]; if (m === 0) continue;
        for (let j = c; j < n; j++) M[i * n + j] -= m * M[c * n + j];
        r[i] -= m * r[c];
      }
    }
    for (let i = n - 1; i >= 0; i--) { let s = r[i]; for (let j = i + 1; j < n; j++) s -= M[i * n + j] * r[j]; r[i] = s / M[i * n + i]; }
    return r;
  }
  function solveStiff(f, jac, y0, t0, t1, opts) {
    const { o, n, S, out, floor } = setup(y0, t0, t1, opts, STIFF_DEFAULTS);
    let y = Float64Array.from(y0); bound(y, n, o, floor);
    const J = new Float64Array(n * n), M = new Float64Array(n * n), M2 = new Float64Array(n * n);
    const k1 = new Float64Array(n), k2 = new Float64Array(n), ytmp = new Float64Array(n), yn = new Float64Array(n), err = new Float64Array(n), fy = new Float64Array(n);
    let t = t0, h = Math.min(o.h0, o.hmax), k = 0, tries = 0;
    const put = (yy) => { for (let i = 0; i < n; i++) out.y[i][k] = yy[i]; k++; };
    put(y); out.tEnd = t0;
    if (bad(y, n, o.big)) { out.n = k; out.status = "blowup"; out.yEnd = Float64Array.from(y); return out; }
    if (o.stop && o.stop(t, y)) { out.n = k; out.status = "stopped"; out.yEnd = Float64Array.from(y); return out; }
    while (k < S) {
      if (tries >= o.maxSteps) { out.status = "maxsteps"; break; }
      tries++;
      if (t + h > t1) h = t1 - t;
      jac(t, y, J); f(t, y, fy);
      for (let i = 0; i < n * n; i++) M[i] = -GAMMA * h * J[i];
      for (let i = 0; i < n; i++) M[i * n + i] += 1;
      M2.set(M);
      k1.set(fy);
      if (!solveLinear(n, M, k1)) { h *= 0.5; continue; }
      for (let i = 0; i < n; i++) ytmp[i] = y[i] + h * k1[i];
      f(t + h, ytmp, k2);
      for (let i = 0; i < n; i++) k2[i] -= 2 * k1[i];
      if (!solveLinear(n, M2, k2)) { h *= 0.5; continue; }
      for (let i = 0; i < n; i++) { yn[i] = y[i] + 1.5 * h * k1[i] + 0.5 * h * k2[i]; err[i] = yn[i] - (y[i] + h * k1[i]); }
      const En = errNorm(err, y, yn, n, o);
      if (!Number.isFinite(En)) { h *= 0.2; continue; }
      if (En > 1) { h *= Math.max(0.2, 0.9 * Math.pow(En, -0.5)); continue; }
      const tNew = t + h;
      bound(yn, n, o, floor);
      while (k < S && out.t[k] <= tNew + 1e-12 * Math.max(1, Math.abs(tNew))) { // linear interpolation
        const th = (out.t[k] - t) / h;
        for (let i = 0; i < n; i++) out.y[i][k] = y[i] + th * (yn[i] - y[i]);
        k++;
      }
      t = tNew; out.steps++; y.set(yn); out.tEnd = t;
      if (bad(y, n, o.big)) { out.status = "blowup"; break; }
      if (o.stop && o.stop(t, y)) { out.status = "stopped"; break; }
      if (t >= t1) break;
      const fac = En === 0 ? 4 : Math.min(4, Math.max(0.2, 0.9 * Math.pow(En, -0.5)));
      h = Math.min(h * fac, o.hmax);
    }
    out.n = k;
    if (out.status === "ok" && k < S) { while (k < S) { for (let i = 0; i < n; i++) out.y[i][k] = y[i]; k++; } out.n = k; }
    out.yEnd = Float64Array.from(y); // (the state at tEnd)
    return out;
  }

  /* ------------------------------------------------ 2×2 eigenvalues and their type */
  function eig2(a, b, c, d) {
    const tr = a + d, det = a * d - b * c, disc = tr * tr - 4 * det;
    if (disc < -1e-14 * (tr * tr + Math.abs(det) + 1)) {
      const im = Math.sqrt(-disc) / 2;
      return { tr, det, disc, complex: true, re1: tr / 2, im1: -im, re2: tr / 2, im2: im };
    }
    const s = Math.sqrt(Math.max(disc, 0)) / 2;
    return { tr, det, disc, complex: false, re1: tr / 2 - s, im1: 0, re2: tr / 2 + s, im2: 0 };
  }
  function classify2(e, tol = 1e-8) {
    let label;
    if (e.complex) label = e.re1 < -tol ? "stable spiral" : e.re1 > tol ? "unstable spiral" : "center";
    else {
      const l1 = e.re1, l2 = e.re2;
      if (l1 < -tol && l2 < -tol) label = "stable node";
      else if (l1 > tol && l2 > tol) label = "unstable node";
      else if ((l1 > tol && l2 < -tol) || (l1 < -tol && l2 > tol)) label = "saddle";
      else label = "non-hyperbolic";
    }
    return { label, stable: label.startsWith("stable"), repeated: !e.complex && Math.abs(e.re2 - e.re1) <= tol };
  }

  /* ------------------------------------------------ small helpers */
  function bisect(g, a, b, tol = 1e-13, maxIt = 200) {
    let ga = g(a), gb = g(b);
    if (ga === 0) return a; if (gb === 0) return b;
    for (let i = 0; i < maxIt; i++) {
      const m = 0.5 * (a + b), gm = g(m);
      if (gm === 0 || Math.abs(b - a) <= tol * Math.max(1, Math.abs(m))) return m;
      if ((ga < 0) === (gm < 0)) { a = m; ga = gm; } else { b = m; gb = gm; }
    }
    return 0.5 * (a + b);
  }
  // numerical Jacobian of f(t, y, dy) at y (t = 0): returns a flat row-major Float64Array
  function jacFD(f, y, h = 1e-6) {
    const n = y.length, J = new Float64Array(n * n), yp = Float64Array.from(y), ym = Float64Array.from(y), fp = new Float64Array(n), fm = new Float64Array(n);
    for (let j = 0; j < n; j++) {
      const dj = h * Math.max(1, Math.abs(y[j]));
      yp[j] = y[j] + dj; ym[j] = y[j] - dj;
      f(0, yp, fp); f(0, ym, fm);
      for (let i = 0; i < n; i++) J[i * n + j] = (fp[i] - fm[i]) / (2 * dj);
      yp[j] = y[j]; ym[j] = y[j];
    }
    return J;
  }

  (G.WQ = G.WQ || {}).ODE = { solve, solveStiff, eig2, classify2, bisect, jacFD, solveLinear };
})(typeof window !== "undefined" ? window : globalThis);
