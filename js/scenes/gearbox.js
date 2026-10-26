/* =============================================================================
   Gear box — "particles in a box"                                (Blogs list)
   -----------------------------------------------------------------------------
   Faint chalk tags drift over the board like gas particles in a box: peaks of
   the Himalaya (and a few of the world) with their heights, Himalayan routes
   with the year they were first climbed, routes at Badami and famous routes
   of the world with their grades, glaciers, India's national parks, tiger
   reserves and wildlife sanctuaries, climbing numbers, headline snippets and
   words from the field. (The name is older: the box once held gear sketches.)
   They move at a steady, unhurried speed, bounce off the edges of the box and
   off each other (elastic collisions: they touch but never overlap), and
   after a while each one fades away while a new one slides in from an edge
   of the box. The box is the screen above the explorer strip. The page
   text's calm zones fade the tags that pass behind it.
   HOW TO EDIT: the word lists (PEAKS, ROUTES, GLACIERS, PARKS, NUMBERS,
   HEADLINES, STORY, NAMES), MIX (how often each kind comes), SPEED, DENSITY
   (how many), ALPHA (how faint), LIFE (how long a tag stays).
   ============================================================================= */
(function (G) {
  "use strict";
  const { L, CH, PTS } = G.WQ;
  const { lerp, clamp, smooth, mulberry32, TAU } = L;
  const INK = "246,244,236";

  /* ---------------------------------------------------------------- words */
  // heights as given by Wikipedia's lists (highest mountains on Earth; peaks of Uttarakhand; mountains of Nepal
  // and India); a peak without a reliable height shows its region instead
  const PEAKS = [["Everest", "8849 m"], ["K2", "8611 m"], ["Kangchenjunga", "8586 m"], ["Lhotse", "8516 m"], ["Makalu", "8485 m"],
    ["Cho Oyu", "8188 m"], ["Dhaulagiri", "8167 m"], ["Manaslu", "8163 m"], ["Nanga Parbat", "8126 m"], ["Annapurna", "8091 m"],
    ["Nanda Devi", "7816 m"], ["Kamet", "7756 m"], ["Saser Kangri", "7672 m"], ["Nun", "7135 m"], ["Trisul", "7120 m"],
    ["Kun", "7077 m"], ["Satopanth", "7075 m"], ["Kedarnath", "6940 m"], ["Changabang", "6864 m"], ["Ama Dablam", "6812 m"],
    ["Shivling", "6543 m"], ["Stok Kangri", "6153 m"], ["Hanuman Tibba", "5982 m"], ["Friendship Peak", "5289 m"],
    ["Aconcagua", "6961 m"], ["Denali", "6190 m"], ["Kilimanjaro", "5895 m"], ["Elbrus", "5642 m"], ["Mont Blanc", "4806 m"],
    ["Matterhorn", "4478 m"], ["Eiger", "3967 m"], ["Fitz Roy", "3405 m"], ["Cerro Torre", "3128 m"], ["Kalsubai", "1646 m"],
    // more of the Himalaya: Nepal, Tibet, Bhutan
    ["Shishapangma", "8027 m"], ["Gyachung Kang", "7952 m"], ["Annapurna II", "7937 m"], ["Himalchuli", "7893 m"], ["Nuptse", "7864 m"],
    ["Jannu", "7711 m"], ["Gurla Mandhata", "7694 m"], ["Gangkhar Puensum", "7570 m"], ["Annapurna III", "7555 m"], ["Kula Kangri", "7538 m"],
    ["Annapurna IV", "7525 m"], ["Jongsong", "7462 m"], ["Gangapurna", "7455 m"], ["Ganesh I", "7422 m"], ["Churen Himal", "7385 m"],
    ["Chamlang", "7321 m"], ["Chomolhari", "7326 m"], ["Putha Hiunchuli", "7246 m"], ["Langtang Lirung", "7227 m"], ["Annapurna South", "7219 m"],
    ["Langtang Ri", "7205 m"], ["Gurja Himal", "7193 m"], ["Pumori", "7161 m"], ["Tilicho Peak", "7134 m"], ["Gauri Sankar", "7134 m"],
    ["Api", "7132 m"], ["Baruntse", "7129 m"], ["Ganesh II", "7118 m"], ["Machapuchare", "6993 m"], ["Dorje Lakpa", "6966 m"],
    ["Tukuche", "6920 m"], ["Kanjiroba", "6883 m"], ["Kangtega", "6782 m"], ["Thamserku", "6623 m"], ["Taboche", "6542 m"],
    ["Mera Peak", "6476 m"], ["Hiunchuli", "6441 m"], ["Cholatse", "6440 m"], ["Langshisa Ri", "6412 m"], ["Kyajo Ri", "6151 m"],
    ["Pisang Peak", "6091 m"], ["Dhampus Peak", "6012 m"], ["Naya Kanga", "5863 m"], ["Island Peak", "Imja Tse · Khumbu"],
    ["Lobuche East", "Khumbu"], ["Nilgiri", "Annapurna"], ["Menlungtse", "Rolwaling"], ["Saipal", "Far-west Nepal"],
    ["Namcha Barwa", "7782 m"], ["Gyala Peri", "7294 m"],
    // the Indian Himalaya: Garhwal, Kumaon, Sikkim, Arunachal, Himachal, Ladakh
    ["Nanda Devi East", "7434 m"], ["Kabru North", "7412 m"], ["Abi Gamin", "7355 m"], ["Talung", "7349 m"], ["Mana Peak", "7272 m"],
    ["Mukut Parbat", "7242 m"], ["Hardeol", "7151 m"], ["Chaukhamba", "7138 m"], ["Pauhunri", "7128 m"], ["Dunagiri", "7066 m"],
    ["Kangto", "7060 m"], ["Nyegyi Kansang", "7047 m"], ["Rishi Pahar", "6992 m"], ["Kalanka", "6931 m"], ["Thalay Sagar", "6904 m"],
    ["Panchchuli II", "6903 m"], ["Nanda Kot", "6861 m"], ["Bhagirathi I", "6856 m"], ["Kedar Dome", "6831 m"], ["Janhukut", "6805 m"],
    ["Gangotri I", "6672 m"], ["Meru", "6660 m"], ["Jaonli", "6632 m"], ["Kharchakund", "6612 m"], ["Nilkantha", "6596 m"],
    ["Bhagirathi II", "6512 m"], ["Sudarshan Parbat", "6507 m"], ["Bhagirathi III", "6454 m"], ["Bandarpunch", "6316 m"],
    ["Nanda Ghunti", "6309 m"], ["Swargarohini", "6252 m"], ["Mandani Parbat", "6193 m"], ["Srikanta", "6133 m"],
    ["Siniolchu", "Sikkim"], ["Kangchengyao", "Sikkim"], ["Pandim", "Sikkim"], ["Indrasan", "Kullu"], ["Deo Tibba", "Kullu"],
    ["Mulkila", "Lahaul"], ["Menthosa", "Lahaul"], ["Kinnaur Kailash", "Kinnaur"], ["Reo Purgyil", "Kinnaur"], ["Kang Yatse", "Markha · Ladakh"]];
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
    ["Supercrack", "Indian Creek · 5.10"],
    // the Himalaya: routes with the year they were first climbed, and the landmarks of the Everest routes
    ["South Col", "Everest · 1953"], ["North Ridge", "Everest · 1960"], ["Hornbein Couloir", "Everest · 1963"],
    ["Southwest Face", "Everest · 1975"], ["Japanese Couloir", "Everest · 1980"], ["Kangshung Face", "Everest · 1983"],
    ["Norton Couloir", "Everest"], ["Khumbu Icefall", "Everest"], ["Western Cwm", "Everest"], ["Lhotse Face", "Everest"],
    ["Yellow Band", "Everest"], ["Geneva Spur", "Everest"], ["Hillary Step", "Everest"], ["Second Step", "Everest"],
    ["Rakhiot Route", "Nanga Parbat · 1953"], ["Diamir Face", "Nanga Parbat · 1962"], ["Rupal Face", "Nanga Parbat · 1970"],
    ["Mazeno Ridge", "Nanga Parbat · 2012"], ["North Face", "Annapurna · 1950"], ["South Face", "Annapurna · 1970"],
    ["Yalung Face", "Kangchenjunga · 1955"], ["West Pillar", "Makalu · 1971"], ["South Face", "Lhotse · 1990"],
    ["Northeast Ridge", "Dhaulagiri · 1960"], ["Northwest Ridge", "Cho Oyu · 1954"], ["Northeast Face", "Manaslu · 1956"],
    ["South Ridge", "Nanda Devi · 1936"], ["West Wall", "Changabang · 1976"], ["Shark’s Fin", "Meru · 2011"],
    ["East Pillar", "Shivling · 1981"], ["North Face", "Jannu · 2004"], ["Southwest Ridge", "Ama Dablam · 1961"],
    ["North Face", "Cholatse"]];
  const GLACIERS = [["Gangotri Glacier", "Uttarakhand"], ["Chaturangi Glacier", "Uttarakhand"], ["Raktavarn Glacier", "Uttarakhand"],
    ["Satopanth Glacier", "Uttarakhand"], ["Bhagirath Kharak Glacier", "Uttarakhand"], ["Chorabari Glacier", "Uttarakhand"],
    ["Dokriani Glacier", "Uttarakhand"], ["Khatling Glacier", "Uttarakhand"], ["Pindari Glacier", "Uttarakhand"], ["Kafni Glacier", "Uttarakhand"],
    ["Sunderdhunga Glacier", "Uttarakhand"], ["Milam Glacier", "Uttarakhand"], ["Ralam Glacier", "Uttarakhand"],
    ["Panchachuli Glacier", "Uttarakhand"], ["Zemu Glacier", "Sikkim"], ["Rathong Glacier", "Sikkim"], ["Talung Glacier", "Sikkim"],
    ["Bara Shigri Glacier", "Himachal"], ["Chhota Shigri Glacier", "Himachal"], ["Drang-Drung Glacier", "Zanskar"],
    ["Parkachik Glacier", "Ladakh"], ["Machoi Glacier", "Ladakh"], ["Kolahoi Glacier", "Kashmir"], ["Thajiwas Glacier", "Kashmir"],
    ["Siachen Glacier", "Karakoram"], ["Rimo Glacier", "Karakoram"], ["Baltoro Glacier", "Karakoram"], ["Biafo Glacier", "Karakoram"],
    ["Hispar Glacier", "Karakoram"], ["Khumbu Glacier", "Nepal"], ["Ngozumpa Glacier", "Nepal"], ["Imja Glacier", "Nepal"],
    ["Barun Glacier", "Nepal"], ["Langtang Glacier", "Nepal"], ["Lirung Glacier", "Nepal"], ["Yalung Glacier", "Nepal"],
    ["Kangchenjunga Glacier", "Nepal"], ["Rongbuk Glacier", "Tibet"], ["Kangshung Glacier", "Tibet"]];
  const NP = "National Park", TR = "Tiger Reserve", WLS = "Wildlife Sanctuary", BS = "Bird Sanctuary";
  const PARKS = [
    ["Jim Corbett", NP, "Uttarakhand"], ["Rajaji", NP, "Uttarakhand"], ["Valley of Flowers", NP, "Uttarakhand"], ["Nanda Devi", NP, "Uttarakhand"],
    ["Gangotri", NP, "Uttarakhand"], ["Govind", NP, "Uttarakhand"], ["Askot", WLS, "Uttarakhand"], ["Kedarnath", WLS, "Uttarakhand"],
    ["Binsar", WLS, "Uttarakhand"], ["Great Himalayan", NP, "Himachal"], ["Pin Valley", NP, "Himachal"], ["Khirganga", NP, "Himachal"],
    ["Kibber", WLS, "Himachal"], ["Hemis", NP, "Ladakh"], ["Changthang", WLS, "Ladakh"], ["Karakoram", WLS, "Ladakh"],
    ["Dachigam", NP, "Kashmir"], ["Kishtwar", NP, "Jammu & Kashmir"], ["Khangchendzonga", NP, "Sikkim"], ["Singalila", NP, "West Bengal"],
    ["Neora Valley", NP, "West Bengal"], ["Sundarbans", NP, "West Bengal"], ["Jaldapara", NP, "West Bengal"], ["Gorumara", NP, "West Bengal"],
    ["Buxa", TR, "West Bengal"], ["Mahananda", WLS, "West Bengal"], ["Kaziranga", NP, "Assam"], ["Manas", NP, "Assam"], ["Nameri", NP, "Assam"],
    ["Orang", NP, "Assam"], ["Dibru-Saikhowa", NP, "Assam"], ["Pobitora", WLS, "Assam"], ["Namdapha", NP, "Arunachal"], ["Mouling", NP, "Arunachal"],
    ["Pakke", TR, "Arunachal"], ["Eaglenest", WLS, "Arunachal"], ["Keibul Lamjao", NP, "Manipur"], ["Nokrek", NP, "Meghalaya"],
    ["Balphakram", NP, "Meghalaya"], ["Phawngpui", NP, "Mizoram"], ["Murlen", NP, "Mizoram"], ["Dampa", TR, "Mizoram"], ["Ntangki", NP, "Nagaland"],
    ["Kanha", NP, "Madhya Pradesh"], ["Bandhavgarh", NP, "Madhya Pradesh"], ["Pench", NP, "Madhya Pradesh"], ["Satpura", NP, "Madhya Pradesh"],
    ["Panna", NP, "Madhya Pradesh"], ["Kuno", NP, "Madhya Pradesh"], ["Madhav", NP, "Madhya Pradesh"], ["Ranthambore", NP, "Rajasthan"],
    ["Sariska", TR, "Rajasthan"], ["Keoladeo", NP, "Rajasthan"], ["Desert", NP, "Rajasthan"], ["Kumbhalgarh", WLS, "Rajasthan"],
    ["Mount Abu", WLS, "Rajasthan"], ["Tal Chhapar", "Sanctuary", "Rajasthan"], ["National Chambal", "Sanctuary", "Chambal"],
    ["Gir", NP, "Gujarat"], ["Velavadar", "Blackbuck " + NP, "Gujarat"], ["Gulf of Kutch", "Marine " + NP, "Gujarat"],
    ["Little Rann of Kutch", "Wild Ass Sanctuary", "Gujarat"], ["Tadoba-Andhari", TR, "Maharashtra"], ["Sanjay Gandhi", NP, "Maharashtra"],
    ["Chandoli", NP, "Maharashtra"], ["Navegaon", NP, "Maharashtra"], ["Gugamal", NP, "Maharashtra"], ["Melghat", TR, "Maharashtra"],
    ["Kalsubai Harishchandragad", WLS, "Maharashtra"], ["Bhimashankar", WLS, "Maharashtra"], ["Koyna", WLS, "Maharashtra"],
    ["Radhanagari", WLS, "Maharashtra"], ["Tamhini", WLS, "Maharashtra"], ["Nagzira", WLS, "Maharashtra"], ["Umred-Karhandla", WLS, "Maharashtra"],
    ["Bor", TR, "Maharashtra"], ["Mollem", NP, "Goa"], ["Cotigao", WLS, "Goa"], ["Bandipur", NP, "Karnataka"], ["Nagarhole", NP, "Karnataka"],
    ["Kudremukh", NP, "Karnataka"], ["Bannerghatta", NP, "Karnataka"], ["Bhadra", TR, "Karnataka"], ["Dandeli", WLS, "Karnataka"],
    ["BR Hills", TR, "Karnataka"], ["Ranganathittu", BS, "Karnataka"], ["Mudumalai", NP, "Tamil Nadu"], ["Mukurthi", NP, "Tamil Nadu"],
    ["Anamalai", TR, "Tamil Nadu"], ["Kalakad-Mundanthurai", TR, "Tamil Nadu"], ["Sathyamangalam", TR, "Tamil Nadu"],
    ["Point Calimere", WLS, "Tamil Nadu"], ["Vedanthangal", BS, "Tamil Nadu"], ["Periyar", TR, "Kerala"], ["Silent Valley", NP, "Kerala"],
    ["Eravikulam", NP, "Kerala"], ["Parambikulam", TR, "Kerala"], ["Wayanad", WLS, "Kerala"], ["Chinnar", WLS, "Kerala"], ["Thattekad", BS, "Kerala"],
    ["Nagarjunasagar-Srisailam", TR, "Andhra Pradesh"], ["Papikonda", NP, "Andhra Pradesh"], ["Amrabad", TR, "Telangana"], ["Kawal", TR, "Telangana"],
    ["Similipal", NP, "Odisha"], ["Bhitarkanika", NP, "Odisha"], ["Satkosia", TR, "Odisha"], ["Chilika", "Nalabana " + BS, "Odisha"],
    ["Kanger Valley", NP, "Chhattisgarh"], ["Indravati", NP, "Chhattisgarh"], ["Achanakmar", TR, "Chhattisgarh"], ["Betla", NP, "Jharkhand"],
    ["Valmiki", TR, "Bihar"], ["Dudhwa", NP, "Uttar Pradesh"], ["Pilibhit", TR, "Uttar Pradesh"], ["Sultanpur", NP, "Haryana"], ["Kalesar", NP, "Haryana"],
    ["Campbell Bay", NP, "Nicobar"], ["Mahatma Gandhi Marine", NP, "Andamans"], ["Saddle Peak", NP, "Andamans"],
  ].map(([name, kind, where]) => [name, kind + " · " + where]);
  const NUMBERS = ["8848.86 m", "6b+", "WI4", "M6", "5.12a", "Font 7A", "V10", "E5 6b", "A2", "−22 °C", "70°", "Camp II", "4:00 am",
    "π = 3.14159…", "e = 2.71828…", "√2 = 1.41421…", "φ = 1.61803…"];
  const HEADLINES = ["Tiger escaped", "Leopard sighted", "Leopard rescued", "Camera trap", "Radio-collared", "Elephant corridor",
    "Cheetah returns", "Avalanche warning", "Whiteout", "Summit push", "Weather window", "Rescue op", "Pugmarks found",
    "Straying tiger", "Tranquilised", "Conflict zone"];
  const STORY = ["Boma capture", "Translocation", "Prey base", "Dark Knight", "Carrying capacity", "Home range", "Dispersal",
    "Mark–recapture", "Source–sink", "Kill site", "Scat survey", "Line transect", "GPS fix", "Buffer zone"];
  const NAMES = ["Summit of the Gods"];
  const MIX = { peak: 0.25, route: 0.2, park: 0.18, glacier: 0.13, number: 0.08, headline: 0.07, story: 0.06, name: 0.03 };
  const LISTS = { peak: PEAKS, route: ROUTES, glacier: GLACIERS, park: PARKS, number: NUMBERS, headline: HEADLINES, story: STORY, name: NAMES };

  const SPEED = [20, 34];          // px/s (reference size), each tag picks one
  const DENSITY = 1 / 52000;       // tags per px² of box
  const MAX_TAGS = 26;
  const ALPHA = 0.36;              // how bright a tag is at most
  const LIFE = [20, 40];           // s a tag stays before it fades away
  const FADE = 1.6;                // s to fade in / out

  /* ---------------------------------------------------------------- the scene */
  (G.WQ.scenes = G.WQ.scenes || {}).gearbox = function (env0) {
    let env = env0, W = 0, H = 0, BOX = { x0: 0, y0: 0, x1: 0, y1: 0 }, k = 1, t = 0, built = false;
    let tags = [], rnd = mulberry32(31), spawnClock = 0, grain = null;
    const decks = {};
    const kinds = Object.keys(MIX), sprites = new Map();

    // a deck per kind: every item comes once before any comes again
    function draw1(kind) {
      const src = LISTS[kind];
      let d = decks[kind];
      if (!d || !d.length) { d = decks[kind] = src.map((_, i) => i); for (let i = d.length - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [d[i], d[j]] = [d[j], d[i]]; } }
      return src[d.pop()];
    }
    // a kind and an item that is not on the board just now (no name shows twice at once)
    const keyOf = (item) => (Array.isArray(item) ? item.join("|") : item);
    function pickFresh() {
      const shown = new Set(tags.map((tg) => keyOf(tg.item)));
      let kind = pickKind(), item = draw1(kind);
      for (let i = 0; i < 8 && shown.has(keyOf(item)); i++) { kind = pickKind(); item = draw1(kind); }
      return [kind, item];
    }
    function pickKind() {
      let r = rnd(), s = 0;
      for (const kd of kinds) { s += MIX[kd]; if (r <= s) return kd; }
      return "peak";
    }
    // the tag's picture, drawn once into its own canvas (chalk grain included)
    function sprite(kind, item) {
      const key = kind + "|" + (Array.isArray(item) ? item.join("|") : item) + "|" + k.toFixed(2) + "|" + (CH.q || 1);
      if (sprites.has(key)) return sprites.get(key);
      const q = Math.min(2, env.dpr || 1), pad = 6 * k;
      const serif = "'WQ Serif', 'Latin Modern Roman', Georgia, serif", sans = "'WQ Sans', Inter, system-ui, sans-serif";
      const meas = document.createElement("canvas").getContext("2d");
      let w, h, paint;
      if (Array.isArray(item)) { // two lines: a name, and under it (in small capitals) its height, place or kind
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
        state: "enter", a: 0, solid: false, ph: rnd() * TAU, base: ALPHA };
    }
    const overlaps = (a, b, m = 0) => a.x < b.x + b.w + m && b.x < a.x + a.w + m && a.y < b.y + b.h + m && b.y < a.y + a.h + m;
    function target() { return Math.max(4, Math.min(MAX_TAGS, Math.round((BOX.x1 - BOX.x0) * (BOX.y1 - BOX.y0) * DENSITY))); }

    // a new tag slides in through an edge of the box (0 top, 1 right, 2 bottom = out from behind the strip,
    // 3 left), at a spot where it has room to come in; wide word tags come through the top or the bottom.
    // Returns false when no edge has room just now (the next try comes a moment later).
    function spawn() {
      const [kind, item] = pickFresh(), tg = makeTag(kind, item), bw = BOX.x1 - BOX.x0, bh = BOX.y1 - BOX.y0;
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
        const [kind, item] = pickFresh(), tg = makeTag(kind, item);
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
        vis.forEach((tg, i) => p.scatter("tag" + i, 0.85 / Math.max(1, vis.length), tg.x, tg.y, tg.x + tg.w, tg.y + tg.h));
        p.scatter("tag-air", 0.15, 0, 0, W, H).end();
      },
    };
  };
})(window);
