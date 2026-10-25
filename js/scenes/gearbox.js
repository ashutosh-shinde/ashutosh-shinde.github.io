/* =============================================================================
   Gear box — "particles in a box"                                (Blogs list)
   -----------------------------------------------------------------------------
   Faint chalk tags drift over the board like gas particles in a box: peaks
   with their heights, routes at Badami and famous routes of the world with
   their grades, climbing and trekking numbers, gear drawn in chalk, headline
   snippets and words from the field. They move at a steady, unhurried speed,
   bounce off the edges of the box and off each other (elastic collisions:
   they touch but never overlap), and after a while each one fades away while
   a new one slides in from an edge of the box. The box is the screen above
   the explorer strip. The page text's calm zones fade the tags that pass
   behind it.
   HOW TO EDIT: the word lists (PEAKS, ROUTES, NUMBERS, HEADLINES, STORY,
   NAMES, GEAR), MIX (how often each kind comes), SPEED, DENSITY (how many),
   ALPHA (how faint), LIFE (how long a tag stays).
   ============================================================================= */
(function (G) {
  "use strict";
  const { L, CH, PTS } = G.WQ;
  const { lerp, clamp, smooth, mulberry32, TAU } = L;
  const INK = "246,244,236";

  /* ---------------------------------------------------------------- words */
  const PEAKS = [["Everest", "8849 m"], ["K2", "8611 m"], ["Kangchenjunga", "8586 m"], ["Lhotse", "8516 m"], ["Makalu", "8485 m"],
    ["Cho Oyu", "8188 m"], ["Dhaulagiri", "8167 m"], ["Manaslu", "8163 m"], ["Nanga Parbat", "8126 m"], ["Annapurna", "8091 m"],
    ["Nanda Devi", "7816 m"], ["Kamet", "7756 m"], ["Saser Kangri", "7672 m"], ["Nun", "7135 m"], ["Trisul", "7120 m"],
    ["Kun", "7077 m"], ["Satopanth", "7075 m"], ["Kedarnath", "6940 m"], ["Changabang", "6864 m"], ["Ama Dablam", "6812 m"],
    ["Shivling", "6543 m"], ["Stok Kangri", "6153 m"], ["Hanuman Tibba", "5982 m"], ["Friendship Peak", "5289 m"],
    ["Aconcagua", "6961 m"], ["Denali", "6190 m"], ["Kilimanjaro", "5895 m"], ["Elbrus", "5642 m"], ["Mont Blanc", "4806 m"],
    ["Matterhorn", "4478 m"], ["Eiger", "3967 m"], ["Fitz Roy", "3405 m"], ["Cerro Torre", "3128 m"], ["Kalsubai", "1646 m"]];
  const ROUTES = [ // Badami (grades from the Bangalore Climbing Initiatives guide; Sloper and Top Tree from theCrag
    // and 27crags), then famous routes and boulders of the world
    ["Ganesha", "Badami · 8b+"], ["Samsara", "Badami · 8a"], ["Badami Killer", "Badami · 8a"], ["Export Reject", "Badami · 7b+"],
    ["Honey Moon", "Badami · 7b"], ["Sloper", "Badami · 7b"], ["Top Tree", "Badami · 7a"], ["Happy Lion", "Badami · 6c"],
    ["Dizzy", "Badami · 6c"], ["Chimney", "Badami · 6c"], ["Grey Chair", "Badami · 6b+"], ["Master of Biscuits", "Badami · 6a+"],
    ["Silence", "Flatanger · 9c"], ["La Dura Dura", "Oliana · 9b+"], ["Change", "Flatanger · 9b+"], ["Jumbo Love", "Clark Mountain · 9b"],
    ["Biographie", "Céüse · 9a+"], ["Action Directe", "Frankenjura · 9a"], ["Hubble", "Raven Tor · 8c+"],
    ["La Rose et le Vampire", "Buoux · 8b"], ["The Nose", "El Capitan · 5.14a"], ["The Dawn Wall", "El Capitan · 5.14d"],
    ["Freerider", "El Capitan · 5.12d"], ["Separate Reality", "Yosemite · 5.11d"], ["Astroman", "Yosemite · 5.11c"],
    ["Midnight Lightning", "Yosemite · V8"], ["To Bolt or Not to Be", "Smith Rock · 5.14a"], ["Moonlight Buttress", "Zion · 5.12d"],
    ["Cobra Crack", "Squamish · 5.14b"], ["The Indian Face", "Clogwyn Du’r Arddu · E9 6c"], ["Gaia", "Black Rocks · E8 6c"],
    ["Cenotaph Corner", "Dinas Cromlech · E1 5c"], ["Burden of Dreams", "Lappnor · 9A"], ["The Mandala", "Buttermilks · V12"],
    ["Supercrack", "Indian Creek · 5.10"]];
  const NUMBERS = ["8848.86 m", "6b+", "WI4", "M6", "5.12a", "Font 7A", "V10", "E5 6b", "A2", "−22 °C", "22 kN", "9.8 mm", "60 m",
    "70°", "Camp II", "4:00 am", "π = 3.14159…", "e = 2.71828…", "√2 = 1.41421…", "φ = 1.61803…"];
  const HEADLINES = ["Tiger escaped", "Leopard sighted", "Leopard rescued", "Camera trap", "Radio-collared", "Elephant corridor",
    "Cheetah returns", "Avalanche warning", "Whiteout", "Summit push", "Weather window", "Rescue op", "Pugmarks found",
    "Straying tiger", "Tranquilised", "Conflict zone"];
  const STORY = ["Boma capture", "Translocation", "Prey base", "Dark Knight", "Carrying capacity", "Home range", "Dispersal",
    "Mark–recapture", "Source–sink", "Kill site", "Scat survey", "Line transect", "GPS fix", "Buffer zone"];
  const NAMES = ["Decathlon", "The North Face", "Summit of the Gods"];
  const GEAR = ["ice axe", "carabiner", "crampons", "boots", "harness", "chalk bag", "climbing shoes", "helmet", "rope",
    "quickdraw", "cam", "headlamp", "tent", "trekking pole", "ice screw"];
  const MIX = { gear: 0.30, peak: 0.22, route: 0.20, number: 0.10, headline: 0.08, story: 0.07, name: 0.03 };

  const SPEED = [20, 34];          // px/s (reference size), each tag picks one
  const DENSITY = 1 / 52000;       // tags per px² of box
  const MAX_TAGS = 26;
  const ALPHA = { text: 0.36, gear: 0.42 };
  const LIFE = [20, 40];           // s a tag stays before it fades away
  const FADE = 1.6;                // s to fade in / out

  /* ---------------------------------------------------------------- gear, drawn in chalk
     Each sketch is drawn in a 64 × 64 box (y down) with plain canvas paths.  */
  const SK = {
    "ice axe"(c) { c.moveTo(24, 60); c.lineTo(38, 10); c.moveTo(38, 10); c.quadraticCurveTo(50, 12, 58, 22); c.moveTo(38, 10); c.lineTo(26, 6); c.lineTo(25, 10);
      c.moveTo(24, 60); c.lineTo(22, 64); c.moveTo(27, 47); c.lineTo(31, 48); },
    carabiner(c) { c.moveTo(24, 8); c.bezierCurveTo(40, 2, 52, 10, 48, 26); c.lineTo(42, 52); c.bezierCurveTo(38, 62, 22, 62, 20, 50); c.lineTo(18, 34);
      c.moveTo(24, 8); c.bezierCurveTo(16, 10, 14, 18, 16, 24); c.moveTo(18, 34); c.lineTo(17, 28); c.moveTo(19, 36); c.lineTo(23, 37); },
    crampons(c) { c.moveTo(6, 28); c.lineTo(52, 28); c.quadraticCurveTo(60, 28, 60, 34);
      for (let x = 10; x <= 50; x += 8) { c.moveTo(x, 28); c.lineTo(x + 2, 40); c.lineTo(x + 4, 28); }
      c.moveTo(56, 31); c.lineTo(64, 36); c.moveTo(56, 34); c.lineTo(63, 40); c.moveTo(14, 28); c.quadraticCurveTo(26, 12, 44, 28); },
    boots(c) { c.moveTo(14, 6); c.lineTo(34, 6); c.lineTo(36, 30); c.quadraticCurveTo(56, 34, 60, 46); c.lineTo(60, 52); c.lineTo(10, 52); c.lineTo(10, 44); c.lineTo(14, 6);
      c.moveTo(10, 56); c.lineTo(60, 56); for (let y = 12; y <= 28; y += 8) { c.moveTo(30, y); c.lineTo(36, y + 2); } },
    harness(c) { c.ellipse(32, 18, 22, 8, 0, 0, TAU); c.moveTo(32, 26); c.lineTo(32, 36);
      c.moveTo(29, 41); c.ellipse(20, 41, 9, 13, 0.25, 0, TAU); c.moveTo(53, 41); c.ellipse(44, 41, 9, 13, -0.25, 0, TAU); c.moveTo(28, 36); c.ellipse(32, 36, 4, 3, 0, 0, TAU); },
    "chalk bag"(c) { c.moveTo(16, 16); c.lineTo(18, 54); c.quadraticCurveTo(32, 60, 46, 54); c.lineTo(48, 16); c.ellipse(32, 16, 16, 4, 0, 0, TAU);
      c.moveTo(48, 22); c.lineTo(54, 20); c.lineTo(54, 30); c.moveTo(26, 13); c.lineTo(22, 4); c.moveTo(38, 13); c.lineTo(42, 4); },
    "climbing shoes"(c) { c.moveTo(6, 30); c.quadraticCurveTo(8, 14, 22, 14); c.lineTo(40, 18); c.quadraticCurveTo(54, 24, 62, 40); c.quadraticCurveTo(50, 44, 30, 42);
      c.quadraticCurveTo(14, 44, 6, 40); c.closePath(); c.moveTo(20, 16); c.lineTo(28, 30); c.moveTo(30, 17); c.lineTo(38, 31); c.moveTo(8, 44); c.quadraticCurveTo(36, 50, 60, 44); },
    helmet(c) { c.moveTo(8, 42); c.bezierCurveTo(8, 10, 56, 10, 56, 42); c.lineTo(8, 42); c.moveTo(4, 46); c.lineTo(60, 46); c.moveTo(24, 22); c.lineTo(28, 16); c.moveTo(36, 16); c.lineTo(40, 22);
      c.moveTo(14, 46); c.quadraticCurveTo(20, 58, 32, 58); c.quadraticCurveTo(44, 58, 50, 46); },
    rope(c) { for (let i = 0; i < 4; i++) c.ellipse(32, 32 + i * 2, 24 - i * 2.5, 14 - i * 1.2, 0, 0, TAU); c.moveTo(52, 40); c.quadraticCurveTo(60, 52, 54, 62); c.moveTo(14, 42); c.quadraticCurveTo(6, 54, 12, 62); },
    quickdraw(c) { c.ellipse(22, 14, 8, 11, 0.15, 0, TAU); c.moveTo(48, 50); c.ellipse(42, 50, 8, 11, 0.15, 0, TAU);
      c.moveTo(24, 24); c.lineTo(38, 40); c.moveTo(30, 22); c.lineTo(44, 38); c.moveTo(24, 24); c.lineTo(30, 22); c.moveTo(38, 40); c.lineTo(44, 38); },
    cam(c) { c.moveTo(32, 62); c.lineTo(32, 24); c.moveTo(22, 46); c.lineTo(42, 46); c.moveTo(32, 62); c.ellipse(32, 58, 6, 4, 0, 0, TAU);
      c.moveTo(32, 24); c.arc(24, 18, 9, 0.2, 3.6); c.moveTo(32, 24); c.arc(40, 18, 9, -0.46, 2.94, true); },
    headlamp(c) { c.ellipse(26, 34, 20, 14, 0, 0, TAU); c.moveTo(40, 26); c.lineTo(52, 24); c.lineTo(52, 42); c.lineTo(40, 40);
      c.moveTo(56, 26); c.lineTo(63, 20); c.moveTo(57, 33); c.lineTo(64, 33); c.moveTo(56, 40); c.lineTo(63, 46); },
    tent(c) { c.moveTo(6, 54); c.lineTo(32, 10); c.lineTo(58, 54); c.closePath(); c.moveTo(32, 10); c.lineTo(32, 6); c.moveTo(26, 54); c.lineTo(32, 32); c.lineTo(38, 54);
      c.moveTo(6, 54); c.lineTo(0, 60); c.moveTo(58, 54); c.lineTo(64, 60); },
    "trekking pole"(c) { c.moveTo(18, 4); c.lineTo(46, 62); c.moveTo(14, 2); c.lineTo(22, 6); c.lineTo(26, 14); c.moveTo(19, 8); c.bezierCurveTo(6, 10, 6, 22, 16, 20);
      c.moveTo(34, 38); c.lineTo(38, 36); c.moveTo(37, 52); c.ellipse(41, 52, 8, 3, 0.45, 0, TAU); },
    "ice screw"(c) { c.moveTo(10, 28); c.lineTo(52, 28); c.lineTo(52, 36); c.lineTo(10, 36); c.closePath();
      for (let x = 14; x < 50; x += 6) { c.moveTo(x, 28); c.lineTo(x + 3, 36); } c.moveTo(52, 26); c.lineTo(60, 22); c.lineTo(62, 32); c.lineTo(56, 40); c.lineTo(52, 38);
      c.moveTo(56, 40); c.lineTo(58, 52); c.lineTo(50, 54); },
  };

  /* ---------------------------------------------------------------- the scene */
  (G.WQ.scenes = G.WQ.scenes || {}).gearbox = function (env0) {
    let env = env0, W = 0, H = 0, BOX = { x0: 0, y0: 0, x1: 0, y1: 0 }, k = 1, t = 0, built = false;
    let tags = [], rnd = mulberry32(31), spawnClock = 0, grain = null;
    const decks = {};
    const kinds = Object.keys(MIX), sprites = new Map();

    // a deck per kind: every item comes once before any comes again
    function draw1(kind) {
      const src = { gear: GEAR, peak: PEAKS, route: ROUTES, number: NUMBERS, headline: HEADLINES, story: STORY, name: NAMES }[kind];
      let d = decks[kind];
      if (!d || !d.length) { d = decks[kind] = src.map((_, i) => i); for (let i = d.length - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [d[i], d[j]] = [d[j], d[i]]; } }
      return src[d.pop()];
    }
    function pickKind() {
      let r = rnd(), s = 0;
      for (const kd of kinds) { s += MIX[kd]; if (r <= s) return kd; }
      return "word";
    }
    // the tag's picture, drawn once into its own canvas (chalk grain included)
    function sprite(kind, item) {
      const key = kind + "|" + (Array.isArray(item) ? item.join("|") : item) + "|" + k.toFixed(2) + "|" + (CH.q || 1);
      if (sprites.has(key)) return sprites.get(key);
      const q = Math.min(2, env.dpr || 1), pad = 6 * k;
      const serif = "'WQ Serif', 'Latin Modern Roman', Georgia, serif", sans = "'WQ Sans', Inter, system-ui, sans-serif";
      const meas = document.createElement("canvas").getContext("2d");
      let w, h, paint;
      if (kind === "gear") {
        const s = 46 * k, fs = 10.5 * k;
        meas.font = `500 ${fs}px ${sans}`; const lw = meas.measureText(item.toUpperCase()).width + item.length * 0.12 * fs;
        w = Math.max(s, lw) + 2 * pad; h = s + fs * 1.9 + 2 * pad;
        paint = (c) => {
          c.save(); c.translate((w - s) / 2, pad); c.scale(s / 64, s / 64);
          c.beginPath(); SK[item](c); c.lineJoin = c.lineCap = "round";
          c.strokeStyle = `rgba(${INK},0.25)`; c.lineWidth = 64 / s * 3.6 * k; c.stroke();
          c.strokeStyle = `rgba(${INK},0.95)`; c.lineWidth = 64 / s * 1.5 * k; c.stroke(); c.restore();
          c.font = `500 ${fs}px ${sans}`; c.fillStyle = `rgba(${INK},0.8)`; c.textAlign = "center"; c.textBaseline = "alphabetic";
          if ("letterSpacing" in c) c.letterSpacing = `${0.12 * fs}px`;
          c.fillText(item.toUpperCase(), w / 2, h - pad - fs * 0.25);
        };
      } else if (kind === "peak" || kind === "route") {
        const [main, sub] = item, f1 = (kind === "peak" ? 19 : 17) * k, f2 = 10.5 * k;
        meas.font = `italic 400 ${f1}px ${serif}`; const w1 = meas.measureText(main).width;
        meas.font = `500 ${f2}px ${sans}`; const w2 = meas.measureText(sub.toUpperCase()).width + sub.length * 0.12 * f2;
        w = Math.max(w1, w2) + 2 * pad; h = f1 * 1.15 + f2 * 1.6 + 2 * pad;
        paint = (c) => {
          c.textAlign = "left"; c.textBaseline = "alphabetic"; c.fillStyle = `rgba(${INK},0.97)`;
          c.font = `italic 400 ${f1}px ${serif}`; c.fillText(main, pad, pad + f1 * 0.92);
          c.font = `500 ${f2}px ${sans}`; c.fillStyle = `rgba(${INK},0.78)`; if ("letterSpacing" in c) c.letterSpacing = `${0.12 * f2}px`;
          c.fillText(sub.toUpperCase(), pad, h - pad - f2 * 0.3);
          c.strokeStyle = `rgba(${INK},0.5)`; c.lineWidth = Math.max(0.8, 0.9 * k); c.beginPath(); c.moveTo(pad, pad + f1 * 1.12); c.lineTo(pad + Math.min(w1, 46 * k), pad + f1 * 1.12); c.stroke();
        };
      } else {
        const num = kind === "number", f = (num ? 21 : 17) * k, font = num ? `400 ${f}px ${serif}` : `italic 400 ${f}px ${serif}`;
        meas.font = font; const w1 = meas.measureText(item).width;
        w = w1 + 2 * pad; h = f * 1.3 + 2 * pad;
        paint = (c) => { c.font = font; c.fillStyle = `rgba(${INK},0.97)`; c.textBaseline = "alphabetic"; c.fillText(item, pad, pad + f * 0.98); };
      }
      const cv = document.createElement("canvas"); cv.width = Math.ceil(w * q); cv.height = Math.ceil(h * q);
      const c = cv.getContext("2d"); c.scale(q, q); paint(c);
      if (grain) { // chalk: punch tiny holes into the strokes
        c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = "destination-out"; c.globalAlpha = 0.55;
        c.fillStyle = c.createPattern(grain, "repeat"); c.fillRect(0, 0, cv.width, cv.height);
      }
      const sp = { cv, w, h };
      if (sprites.size > 140) sprites.delete(sprites.keys().next().value);
      sprites.set(key, sp);
      return sp;
    }
    function makeTag(kind, item) {
      const sp = sprite(kind, item), sp0 = lerp(SPEED[0], SPEED[1], rnd()) * k;
      return { kind, item, sp, w: sp.w, h: sp.h, x: 0, y: 0, vx: 0, vy: 0, v0: sp0, age: 0, life: lerp(LIFE[0], LIFE[1], rnd()),
        state: "enter", a: 0, solid: false, ph: rnd() * TAU, base: kind === "gear" ? ALPHA.gear : ALPHA.text };
    }
    const overlaps = (a, b, m = 0) => a.x < b.x + b.w + m && b.x < a.x + a.w + m && a.y < b.y + b.h + m && b.y < a.y + a.h + m;
    function target() { return Math.max(4, Math.min(MAX_TAGS, Math.round((BOX.x1 - BOX.x0) * (BOX.y1 - BOX.y0) * DENSITY))); }

    // a new tag slides in through an edge of the box (0 top, 1 right, 2 bottom = out from behind the strip,
    // 3 left), at a spot where it has room to come in; wide word tags come through the top or the bottom.
    // Returns false when no edge has room just now (the next try comes a moment later).
    function spawn() {
      const kind = pickKind(), item = draw1(kind), tg = makeTag(kind, item), bw = BOX.x1 - BOX.x0, bh = BOX.y1 - BOX.y0;
      if (tg.w > bw - 8 || tg.h > bh - 8) return false;
      for (let tries = 0; tries < 14; tries++) {
        const e = tg.w > 1.6 * tg.h ? (rnd() < 0.5 ? 0 : 2) : (rnd() * 4) | 0;
        if (e === 0 || e === 2) { tg.x = BOX.x0 + rnd() * (bw - tg.w); tg.y = e === 0 ? BOX.y0 : BOX.y1 - tg.h; }
        else { tg.x = e === 3 ? BOX.x0 : BOX.x1 - tg.w; tg.y = BOX.y0 + rnd() * (bh - tg.h); }
        if (tags.some((o) => o.solid && overlaps(tg, o, 16 * k))) continue; // its way in must be clear
        // start just outside that edge, heading in (at most 45° off straight in)
        const ang = lerp(-0.25, 0.25, rnd()) * Math.PI + [0.5, 1, 1.5, 0][e] * Math.PI;
        if (e === 0) tg.y = BOX.y0 - tg.h; else if (e === 2) tg.y = BOX.y1; else if (e === 1) tg.x = BOX.x1; else tg.x = BOX.x0 - tg.w;
        tg.edge = e; tg.vx = Math.cos(ang) * tg.v0; tg.vy = Math.sin(ang) * tg.v0;
        tags.push(tg);
        return true;
      }
      return false;
    }
    // at the start the box is already full: tags placed inside, none overlapping
    function populate() {
      tags = [];
      const n = target(), bw = BOX.x1 - BOX.x0, bh = BOX.y1 - BOX.y0;
      for (let i = 0, tries = 0; i < n && tries < n * 60; tries++) {
        const kind = pickKind(), tg = makeTag(kind, draw1(kind));
        if (tg.w > bw - 8 || tg.h > bh - 8) continue;
        tg.x = BOX.x0 + 4 + rnd() * (bw - tg.w - 8); tg.y = BOX.y0 + 4 + rnd() * (bh - tg.h - 8);
        if (tags.some((o) => overlaps(tg, o, 10 * k))) continue;
        const ang = rnd() * TAU; tg.vx = Math.cos(ang) * tg.v0; tg.vy = Math.sin(ang) * tg.v0;
        tg.state = "live"; tg.solid = true; tg.a = 1; tg.age = rnd() * tg.life * 0.8;
        tags.push(tg); i++;
      }
    }
    function layout() {
      const S = Math.min(W / 1440, H / 900);
      const nk = clamp(0.62 + 0.38 * S, env.mobile ? 0.74 : 0.8, 1.15);
      if (Math.abs(nk - k) > 0.02) { k = nk; sprites.clear(); }
      const strip = document.getElementById("strip"), sh = strip ? strip.getBoundingClientRect().height : 0;
      BOX = { x0: 0, y0: 0, x1: W, y1: Math.max(120, H - sh) };
      if (!grain) grain = CH.grain();
      if (!built) { populate(); built = true; return; }
      for (const tg of tags) { // keep everyone inside the new box
        const fresh = sprite(tg.kind, tg.item); tg.sp = fresh; tg.w = fresh.w; tg.h = fresh.h;
        tg.x = clamp(tg.x, BOX.x0, Math.max(BOX.x0, BOX.x1 - tg.w)); tg.y = clamp(tg.y, BOX.y0, Math.max(BOX.y0, BOX.y1 - tg.h));
      }
      const n = target(); // a smaller box: the extra tags fade away
      let live = tags.filter((tg) => tg.state !== "leave");
      for (let i = live.length - 1; i >= n; i--) live[i].state = "leave";
    }

    function step(dt) {
      t += dt; spawnClock -= dt;
      const live = tags.filter((tg) => tg.state !== "leave");
      if (live.length < target() && spawnClock <= 0) spawnClock = spawn() ? 0.4 + rnd() * 0.6 : 0.3;
      for (const tg of tags) {
        tg.age += dt; tg.x += tg.vx * dt; tg.y += tg.vy * dt;
        const inside = tg.x >= BOX.x0 - 0.5 && tg.y >= BOX.y0 - 0.5 && tg.x + tg.w <= BOX.x1 + 0.5 && tg.y + tg.h <= BOX.y1 + 0.5;
        if (tg.state === "enter") {
          tg.a = Math.min(1, tg.a + dt / FADE);
          if (inside) tg.state = "live";
          else if (tg.age > 14) tg.state = "leave"; // kept out too long: let it go
          else { // keep heading in (a bump may have turned it round)
            if (tg.edge === 0) tg.vy = Math.abs(tg.vy); else if (tg.edge === 2) tg.vy = -Math.abs(tg.vy);
            else if (tg.edge === 3) tg.vx = Math.abs(tg.vx); else tg.vx = -Math.abs(tg.vx);
          }
        } else if (tg.state === "live") {
          tg.a = Math.min(1, tg.a + dt / FADE);
          if (tg.age > tg.life) tg.state = "leave";
        } else tg.a -= dt / FADE;
        // a tag is solid while it is coming in, alive, or not yet nearly faded away: solid tags never overlap
        tg.solid = tg.state !== "leave" || tg.a > 0.2;
        if (tg.solid) { // the walls of the box (a tag coming in passes through the edge it comes in by)
          const skip = tg.state === "enter" ? tg.edge : -1;
          if (skip !== 3 && tg.x < BOX.x0) { tg.x = BOX.x0; tg.vx = Math.abs(tg.vx); }
          if (skip !== 1 && tg.x + tg.w > BOX.x1) { tg.x = BOX.x1 - tg.w; tg.vx = -Math.abs(tg.vx); }
          if (skip !== 0 && tg.y < BOX.y0) { tg.y = BOX.y0; tg.vy = Math.abs(tg.vy); }
          if (skip !== 2 && tg.y + tg.h > BOX.y1) { tg.y = BOX.y1 - tg.h; tg.vy = -Math.abs(tg.vy); }
        }
      }
      // collisions: equal masses, elastic, along the axis of least overlap; positions are pushed apart
      const solid = tags.filter((tg) => tg.solid);
      for (let i = 0; i < solid.length; i++) for (let j = i + 1; j < solid.length; j++) {
        const a = solid[i], b = solid[j];
        if (!overlaps(a, b)) continue;
        const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        if (ox < oy) {
          const s = a.x + a.w / 2 < b.x + b.w / 2 ? -1 : 1;
          a.x += s * ox / 2; b.x -= s * ox / 2;
          if ((b.vx - a.vx) * s > 0) { const v = a.vx; a.vx = b.vx; b.vx = v; }
        } else {
          const s = a.y + a.h / 2 < b.y + b.h / 2 ? -1 : 1;
          a.y += s * oy / 2; b.y -= s * oy / 2;
          if ((b.vy - a.vy) * s > 0) { const v = a.vy; a.vy = b.vy; b.vy = v; }
        }
      }
      // keep each tag near its own speed (collisions swap speeds around)
      for (const tg of tags) {
        const v = Math.hypot(tg.vx, tg.vy) || 1, f = 1 + (tg.v0 / v - 1) * Math.min(1, dt * 0.6);
        tg.vx *= f; tg.vy *= f;
      }
      tags = tags.filter((tg) => !(tg.state === "leave" && tg.a <= 0) && tg.x > BOX.x0 - 3 * tg.w - 200 && tg.x < BOX.x1 + 3 * tg.w + 200 && tg.y > BOX.y0 - 400 && tg.y < BOX.y1 + 400);
    }

    // the tags are painted with the site's fonts: once those have loaded, paint them again
    if (document.fonts && document.fonts.load) {
      Promise.all(["italic 18px 'WQ Serif'", "18px 'WQ Serif'", "500 11px 'WQ Sans'"].map((f) => document.fonts.load(f).catch(() => null)))
        .then(() => { sprites.clear(); for (const tg of tags) { const s = sprite(tg.kind, tg.item); tg.sp = s; tg.w = s.w; tg.h = s.h; } });
    }

    return {
      still: 8,
      resize(e) { env = e; W = e.W; H = e.H; layout(); },
      update(dt, tt) {
        if (!built) return;
        const n = Math.max(1, Math.ceil(dt / 0.02)); // small steps: no tunnelling through each other
        for (let i = 0; i < n; i++) step(dt / n);
      },
      draw(ctx, A, pass) {
        if (!built || pass !== "base") return; // calmed near the text
        for (const tg of tags) {
          const a = A * tg.base * smooth(0, 1, tg.a) * (0.9 + 0.1 * Math.sin(t * 0.7 + tg.ph));
          if (a < 0.004) continue;
          ctx.globalAlpha = a;
          ctx.drawImage(tg.sp.cv, tg.x, tg.y, tg.w, tg.h);
        }
        ctx.globalAlpha = 1;
        // a little chalk dust where a tag is fading away
        ctx.fillStyle = `rgba(${INK},${0.4 * A})`;
        for (const tg of tags) if (tg.state === "leave" && tg.a > 0) {
          const u = 1 - tg.a, r = mulberry32((tg.ph * 1e4) | 0);
          for (let i = 0; i < 10; i++) { const x = tg.x + r() * tg.w, y = tg.y + r() * tg.h - u * 18 * r(); if (r() < tg.a) ctx.fillRect(x, y, 1.3, 1.3); }
        }
      },
      // where the tags are (for checks): [[x0, y0, x1, y1], ...] of the solid ones; how many in each state
      boxes() { return tags.filter((tg) => tg.solid).map((tg) => [tg.x, tg.y, tg.x + tg.w, tg.y + tg.h]); },
      stats() { const s = { enter: 0, live: 0, leave: 0, target: target() }; for (const tg of tags) s[tg.state]++; return s; },
      points(out, n) { // for the page change: points spread over the tags on screen
        const p = PTS.begin(out, n), vis = tags.filter((tg) => tg.a > 0.3).slice(0, 14);
        vis.forEach((tg, i) => p.scatter("gear" + i, 0.85 / Math.max(1, vis.length), tg.x, tg.y, tg.x + tg.w, tg.y + tg.h));
        p.scatter("gear-air", 0.15, 0, 0, W, H).end();
      },
    };
  };
})(window);
