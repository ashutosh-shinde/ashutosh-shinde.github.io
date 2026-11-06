/* =============================================================================
   about/life.js — "My time series" on the About page: every line, its dates
   and its card. (The drawing itself is js/lib/lifeline.js.)
   -----------------------------------------------------------------------------
   HOW TO EDIT (on GitHub: open this file, the pencil, change, Commit changes)
   • Dates: "2019" (a year), "2019-06" (a month: the line starts in one random
     week of it, the same week on every visit) or "2019-06-14". Dates place the
     lines; the cards do not show them.
   • Rows: 0 is the main line in the middle; 1 … 4 above it, -1 … -4 below.
     Short branches find a free row by themselves among the rows they may use.
   • A card shows the line's name (title, else box). To add more, give the line
     note: "one or two short lines" and/or photos (below); what: "a short tag"
     shows above the name.
   • Photos: put the file in about/photos/ and list it on its line, e.g.
       photos: [{ src: "photos/kabaddi.jpg", date: "2016", alt: "Kabaddi final" }]
     With dates, the card shows the photo nearest the year under the pen;
     without, a random one each time it opens. Cards without photos show none.
   • A line without "to" is still going.
   ============================================================================= */
window.WQ_LIFE = {
  now: null,                         // null = today; or a date such as "2026-11-06"
  nowLabel: "Now · CES, IISc",       // the last stop's name once the line reaches today

  // how quickly each stretch of years rolls past (1 = normal, smaller = quicker)
  pace: [
    ["2005-06", 0.3],                // school (and the JEE years after it): quick
    ["2019-06", 1],                  // NISER
    ["2024-12", 1.4],
    ["2025-05", 4.5],                // RESQ: a crowded year, drawn wide so every name has room
    ["2026-09", 1.6],
  ],

  // the bold line in the middle: one stop after another
  main: [
    { id: "jp", box: "Jnana Prabodhini", title: "Jnana Prabodhini", from: "2005-06", to: "2017-06" },
    { id: "niser", box: "NISER Bhubaneswar", title: "National Institute of Science Education and Research, Bhubaneswar", from: "2019-06", to: "2024-06" },
    { id: "intern", box: "Optimization Intern", title: "Optimization Intern", from: "2025-01", to: "2025-03" },
    { id: "resq", box: "RESQ CT", title: "RESQ Charitable Trust, Pune", from: "2025-05", to: "2026-07" },
    { id: "iisc", box: "CES, IISc", title: "Centre for Ecological Sciences, Indian Institute of Science, Bengaluru", from: "2026-09" },
  ],

  /* side lines.
     start: "scale" (rises from the years) or "main" (peels off the main line).
     end: "burst" (a puff of chalk dust: a chapter closed) or "merge" (curves into the main line).
     style: "wave", "trek" (rough) or "climb" (rough and sharp).
     priority: [date, 0…1] pairs: the line presses harder (brighter) while it was the priority.
     marks: benchmarks on the line, each with its own card. */
  lines: [
    { id: "chess", row: 2, box: "Chess", from: "2005-09", to: "2014-04", end: "burst",
      priority: [["2005-09", 0.9], ["2014-01", 0.9], ["2014-03", 0.4]] },
    { id: "swimming", row: -4, box: "Swimming", from: "2006-12", style: "wave", priority: [["2006-12", 0.5]] },
    { id: "theatre", row: 1, box: "Theatre", from: "2008-02", to: "2017-02", start: "main", end: "burst", priority: "flicker" },
    { id: "kabaddi", row: -1, box: "Kabaddi", from: "2012-11", to: "2024-12", start: "main", end: "burst",
      priority: [["2012-11", 0.55], ["2014-02", 0.55], ["2014-05", 0.95], ["2023-01", 0.95], ["2023-05", 0.5]] },
    { id: "trekking", row: 3, box: "Trekking", from: "2020-10", style: "trek",
      priority: [["2020-10", 0.5], ["2022-12", 0.55], ["2023-03", 0.95], ["2024-06", 0.95], ["2024-09", 0.55]] },
    { id: "flute", row: -3, box: "Flute", from: "2021-04",
      priority: [["2021-04", 0.6], ["2021-05", 0.95], ["2021-10", 0.95], ["2022-02", 0.35]] },
    { id: "climbing", row: 4, box: "Climbing", from: "2022-08", style: "climb",
      priority: [["2022-08", 0.5], ["2024-03", 0.55], ["2024-07", 0.95]],
      marks: [
        { id: "basic-course", box: "Basic course · ABVIMAS", title: "Basic Mountaineering Course, ABVIMAS Manali", from: "2023-06", to: "2023-08" },
        { id: "advanced-course", box: "Advanced course · HMI", title: "Advanced Mountaineering Course, Himalayan Mountaineering Institute, Darjeeling", from: "2025-04", to: "2025-05" },
      ] },
    { id: "em", row: 1, box: "Ecosystems & Modelling", title: "Ecosystems & Mathematical Modelling", from: "2026-02", to: "2026-09", end: "merge", priority: [["2026-02", 0.8]] },
  ],

  /* short lines that rise from the years and merge: into the main line, or into another line ("into").
     run: months before a branch curves in. rows: the rows its branches may use, nearest first. */
  branches: [
    { rows: [1, 2], items: [                                        // at NISER
      { box: "Bird photography", from: "2020-01", run: 4 },
      { box: "Separately open topology", title: "Partial Derivatives and Separately Open Topology", from: "2021-08", run: 3 },
      { box: "Lp spaces", title: "Lp Spaces and Distribution Functions", from: "2022-08", run: 3 },
      { box: "Fourier analysis", title: "Fourier analysis on finite abelian groups", from: "2023-01", run: 3 },
      { box: "Ecology", from: "2023-08", run: 3 },
      { box: "Uncertainty principles", from: "2023-10", run: 3 },
    ] },
    { rows: [2], into: "em", items: [                               // into Ecosystems & Modelling
      { box: "Mathematical modelling", from: "2026-02", run: 0.7 },
      { box: "Population dynamics", from: "2026-03", run: 0.7 },
      { box: "Stochastic spatial modelling", from: "2026-04", run: 0.7 },
      { box: "Spatial tipping points", from: "2026-05", run: 0.7 },
      { box: "Nonlinear dynamics", from: "2026-06", run: 0.7 },
    ] },
    { rows: [-1, -2, 1, 2], items: [                                // at RESQ CT
      { box: "Snakes", from: "2025-06" },
      { box: "Kites", from: "2025-07" },
      { box: "Crows", from: "2025-07" },
      { box: "Bats", from: "2025-08" },
      { box: "Civets", from: "2025-08" },
      { box: "Eagle owls", from: "2025-09" },
      { box: "Ambajogai blackbuck", title: "Blackbuck translocation, Ambajogai", from: "2025-10", run: 1.2 },
      { box: "Junnar leopards", title: "Leopards of Junnar", from: "2025-11", run: 1.2 },
      { box: "Jackals", from: "2025-12" },
      { box: "Hyenas", from: "2025-12" },
      { box: "Melghat crocodiles", title: "Crocodile translocation, Melghat", from: "2026-01", run: 1.2 },
      { box: "Deer · STR", title: "Prey-base improvement: deer, Sahyadri Tiger Reserve", from: "2026-02", run: 1.2 },
      { box: "Rajahmundry tiger", title: "Tiger operation, Rajahmundry", from: "2026-03", run: 1.2 },
      { box: "Siddipet tiger", title: "Dispersing tiger, Siddipet", from: "2026-04", run: 1.2 },
      { box: "Hirkani · STR", title: "Hirkani the tigress, Sahyadri Tiger Reserve", from: "2026-05", run: 1.2 },
      { box: "Wolves", from: "2026-06" },
    ] },
  ],
};
