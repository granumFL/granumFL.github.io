// GranumFL site: the live hero simulation, the agent replay, tool chips, client snippets,
// performance bars, theme and the contact form.
(function () {
  "use strict";
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- nav and theme
  var nav = document.getElementById("nav");
  function onScroll() { nav.classList.toggle("solid", window.scrollY > 40); }
  window.addEventListener("scroll", onScroll, { passive: true }); onScroll();
  var themeBtn = document.getElementById("theme");
  try { var saved = localStorage.getItem("gfl-theme"); if (saved) document.documentElement.dataset.theme = saved; } catch (e) {}
  themeBtn.addEventListener("click", function () {
    var dark = document.documentElement.dataset.theme === "dark" || (!document.documentElement.dataset.theme && window.matchMedia("(prefers-color-scheme: dark)").matches);
    var next = dark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("gfl-theme", next); } catch (e) {}
  });

  // ---------- hero simulation
  var canvas = document.getElementById("sim");
  var ctx = canvas.getContext("2d");
  var sim = new window.GranumFLSim();
  var showW = true, showG = true, dpr = 1;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
  }
  window.addEventListener("resize", resize); resize();

  // sim units to pixels: the flume on the right two-thirds of the hero
  function frame() {
    var cw = canvas.width, ch = canvas.height;
    var wide = cw > 900 * dpr;
    var x0 = wide ? cw * 0.45 : cw * 0.02, x1 = cw * 0.985;
    var s = (x1 - x0) / sim.W;
    var base = wide ? ch * 0.70 + (x1 - x0) * 0.08 : ch * 0.86;
    return { s: s, X: function (x) { return x0 + x * s; }, Y: function (y) { return base - y * s; } };
  }
  function grainColour(v) {
    var t = Math.min(1, v / 1.4);
    var r = Math.round(232 - 30 * t), g = Math.round(196 - 140 * t), b = Math.round(130 - 100 * t);
    return "rgb(" + r + "," + g + "," + b + ")";
  }
  function draw() {
    var f = frame(), s = f.s;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // ground
    // the hillside continues to the left edge of the hero, rising as it does in the flume
    ctx.beginPath(); ctx.moveTo(0, canvas.height); ctx.lineTo(0, Math.max(f.Y(sim.floor(0)) - f.X(0) * sim.slope, canvas.height * 0.18));
    for (var x = 0; x <= sim.W; x += 2) ctx.lineTo(f.X(x), f.Y(sim.floor(x)));
    ctx.lineTo(canvas.width, f.Y(sim.floor(sim.W))); ctx.lineTo(canvas.width, canvas.height); ctx.closePath();
    var grd = ctx.createLinearGradient(0, f.Y(25), 0, canvas.height);
    grd.addColorStop(0, "#3a3328"); grd.addColorStop(1, "#1a1712");
    ctx.fillStyle = grd; ctx.fill();
    ctx.strokeStyle = "rgba(244,241,234,.25)"; ctx.lineWidth = 1 * dpr; ctx.stroke();
    // box (a building)
    var b = sim.box;
    ctx.fillStyle = "#56677a"; ctx.fillRect(f.X(b.x0), f.Y(b.y1), (b.x1 - b.x0) * s, b.y1 * s);
    ctx.fillStyle = "rgba(244,241,234,.6)"; ctx.font = (11 * dpr) + "px Inter, sans-serif"; ctx.textAlign = "center";
    ctx.fillText("building", f.X((b.x0 + b.x1) / 2), f.Y(b.y1 + 3));
    // gate
    if (sim.gateY < 70) { ctx.fillStyle = "#8a96a3"; ctx.fillRect(f.X(sim.gateX - 0.6), f.Y(sim.gateY + 60), 1.2 * s, 60 * s); }
    // water: soft blue discs
    var i, rw = 1.35 * s;
    if (showW) {
      ctx.fillStyle = "rgba(64,150,225,.42)";
      for (i = 0; i < sim.nw; i++) { ctx.beginPath(); ctx.arc(f.X(sim.wx[i]), f.Y(sim.wy[i]), rw, 0, 6.2832); ctx.fill(); }
    }
    if (showG) {
      for (i = 0; i < sim.ng; i++) {
        ctx.fillStyle = grainColour(sim.gspeed[i]);
        ctx.beginPath(); ctx.arc(f.X(sim.gx[i]), f.Y(sim.gy[i]), sim.gr[i] * s, 0, 6.2832); ctx.fill();
      }
    }
  }
  var hud = { t: document.getElementById("hud-t"), st: document.getElementById("hud-stage"), g: document.getElementById("hud-g"), w: document.getElementById("hud-w") };
  function stage() {
    if (!sim.gateUp) return "gate closed";
    if (sim.t < 2.4) return "gate lifting";
    if (sim.t < 6.5) return "surge";
    return "depositing";
  }
  var last = performance.now(), acc = 0, running = true, tick = 0;
  function loop(now) {
    if (!running) return;
    var dtw = Math.min(0.1, (now - last) / 1000); last = now; acc += dtw;
    // one physics step per 1/60 s of wall time, at most three per frame
    var n = 0;
    while (acc > 1 / 60 && n < 3) { sim.step(); acc -= 1 / 60; n++; }
    if (n === 3) acc = 0;
    if (sim.t > 11) sim.reset();
    draw();
    if ((tick++ & 7) === 0) {
      var fr = sim.fronts();
      hud.t.textContent = sim.t.toFixed(1) + " s";
      hud.st.textContent = stage();
      hud.g.textContent = "x = " + fr.grains.toFixed(0) + " / " + sim.W;
      hud.w.textContent = "x = " + fr.water.toFixed(0) + " / " + sim.W;
    }
    requestAnimationFrame(loop);
  }
  if (reduce) {
    for (var k = 0; k < 330; k++) sim.step();
    draw(); hud.st.textContent = "still (reduced motion)";
  } else {
    // pause when the hero is off screen
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting && !running) { running = true; last = performance.now(); requestAnimationFrame(loop); } else if (!e.isIntersecting) running = false; });
    });
    io.observe(canvas);
    requestAnimationFrame(loop);
  }
  document.getElementById("replay").addEventListener("click", function () { sim.reset(); if (reduce) { for (var k = 0; k < 330; k++) sim.step(); draw(); } });
  function toggle(id, set) {
    var b = document.getElementById(id);
    b.addEventListener("click", function () { var on = b.getAttribute("aria-pressed") !== "true"; b.setAttribute("aria-pressed", on); set(on); if (reduce) draw(); });
  }
  toggle("tog-w", function (v) { showW = v; });
  toggle("tog-g", function (v) { showG = v; });

  // ---------- agent replay (trial T4: the real calls and the numbers the tools returned)
  var script = [
    ["u", "Engineer: In my Patong debris-flow model, make the erodible bed 2 m thick, enlarge the source to 100 m by 60 m keeping its centre, and add Malin Plaza at 7.88220 N, 98.29259 E as a place. Then tell me how the estimated numbers of grains and water particles changed, and whether anything needs fixing before the GPU run."],
    ["tc", "→ site_info {}"],
    ["r", "  estimate: 254,212 grains, 16,517 water particles; bed 1.0 m, 8 pieces"],
    ["tc", "→ site_set_bed {\"depth_m\": 2.0}"],
    ["r", "  estimate: 451,583 grains, 21,725 water particles"],
    ["tc", "→ site_set_source {\"lat\": 7.8834, \"lon\": 98.3061, \"length_m\": 100, \"width_m\": 60}"],
    ["r", "  source 100 × 60 m, 3.0 m thick (1.80e4 m³); estimate: 480,003 grains, 22,025 water particles"],
    ["tc", "→ site_add_place {\"name\": \"Malin Plaza\", \"lat\": 7.8822, \"lon\": 98.29259}"],
    ["r", "  place Malin Plaza added (a place of that name was replaced)"],
    ["tc", "→ get_water_case {}"],
    ["r", "  warnings: catchment and channel water under two particle spacings; more than 2e5 particles: run it on a CUDA GPU (export_water_case)"],
    ["a", "Agent: Done. Grains went from 254,212 to 480,003 (most from the thicker bed) and water particles from 16,517 to 22,025. Before the GPU run: the grains' grid (769 × 565 m) stops short of Malin Plaza, so grains reaching it would end the run, and the 1 m water layers are thinner than two particle spacings, so only part of that water is kept. Export with export_water_case."]
  ];
  var logEl = document.getElementById("agent-log"), timer = null;
  function runReplay() {
    if (timer) clearTimeout(timer);
    logEl.innerHTML = "";
    var li = 0, ci = 0, span = null;
    function next() {
      if (li >= script.length) return;
      var line = script[li];
      if (!span) { span = document.createElement("span"); span.className = line[0]; logEl.appendChild(span); }
      if (reduce) { span.textContent = line[1] + "\n"; span = null; li++; next(); return; }
      var speed = line[0] === "r" ? 4 : 2;
      span.textContent = line[1].slice(0, ci += speed);
      logEl.scrollTop = logEl.scrollHeight;
      if (ci >= line[1].length) { span.textContent = line[1] + "\n"; span = null; ci = 0; li++; timer = setTimeout(next, line[0] === "tc" ? 420 : 260); }
      else timer = setTimeout(next, 14);
    }
    next();
  }
  var agentSeen = false;
  new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting && !agentSeen) { agentSeen = true; runReplay(); } }); }, { threshold: 0.3 }).observe(logEl);
  document.getElementById("replay-agent").addEventListener("click", runReplay);

  // ---------- tool chips and client snippets
  var tools = ["new_water_case", "get_water_case", "site_open_dem", "site_download_dem", "site_cut_terrain", "site_add_place", "site_remove_place", "site_set_source", "site_set_catchment", "site_trace_path", "site_set_bed", "site_set_soil", "site_set_water", "site_info", "site_measure", "run_water", "load_water_results", "water_results", "site_map", "export_water_case"];
  var chips = document.getElementById("chips");
  tools.forEach(function (t) { var s = document.createElement("span"); s.textContent = t; chips.appendChild(s); });
  var snippets = {
    cc: "claude mcp add granum -- granum --mcp\n\n# then ask, for example:\n# \"Set up a debris-flow model of the Nanai landslide in Patong:\n#  source 80 x 50 x 3 m at 7.8834 N, 98.3061 E, saturated;\n#  mark Nanai Road and the DMR point; erodible bed 1 m;\n#  check it and tell me what to fix before the GPU run.\"",
    json: "{\n  \"mcpServers\": {\n    \"granum\": {\n      \"command\": \"granum\",\n      \"args\": [\"--mcp\"]\n    }\n  }\n}"
  };
  var snip = document.getElementById("snippet"), cur = "cc";
  function showTab(t) {
    cur = t; snip.textContent = snippets[t];
    document.querySelectorAll(".tabs button").forEach(function (b) { b.setAttribute("aria-selected", b.dataset.tab === t); });
  }
  document.querySelectorAll(".tabs button").forEach(function (b) { b.addEventListener("click", function () { showTab(b.dataset.tab); }); });
  showTab("cc");
  document.getElementById("copy").addEventListener("click", function () {
    var btn = this;
    navigator.clipboard && navigator.clipboard.writeText(snippets[cur]).then(function () { btn.textContent = "Copied"; setTimeout(function () { btn.textContent = "Copy"; }, 1400); });
  });

  // ---------- performance bars (measured ms per step, RTX 5090 and 30 threads of an EPYC 7502)
  var perf = [
    ["0.2 M water", 1.20, "gpu"], ["0.2 M water", 79.3, "cpu"],
    ["1.5 M water", 7.98, "gpu"], ["1.5 M water", 440.6, "cpu"],
    ["12.2 M water", 78.0, "gpu"],
    ["4.6 M grains", 335.5, "gpu"]
  ];
  var bars = document.getElementById("bars"), maxLog = Math.log10(500), minLog = Math.log10(0.8);
  perf.forEach(function (p) {
    var row = document.createElement("div"); row.className = "bar";
    row.innerHTML = '<span>' + p[0] + ' · ' + p[2].toUpperCase() + '</span><div class="track"><div class="fill ' + p[2] + '"></div></div><span class="v">' + p[1].toFixed(p[1] < 10 ? 2 : 0) + ' ms</span>';
    bars.appendChild(row);
    row.dataset.w = (100 * (Math.log10(p[1]) - minLog) / (maxLog - minLog)).toFixed(1);
  });
  var barsSeen = false;
  new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (e.isIntersecting && !barsSeen) { barsSeen = true; bars.querySelectorAll(".bar").forEach(function (r) { r.querySelector(".fill").style.width = r.dataset.w + "%"; }); }
    });
  }, { threshold: 0.4 }).observe(bars);
  var note = document.createElement("p"); note.className = "small"; note.textContent = "Time per step on a log scale (shorter is faster).";
  bars.appendChild(note);

  // ---------- downloads of the Education edition (links in downloads/config.js)
  var D = window.GRANUMFL_DOWNLOADS || {};
  var dlg = document.getElementById("dlg"), agree = document.getElementById("agree"), go = document.getElementById("dlgGo");
  var miss = document.getElementById("dlgMissing"), osTxt = document.getElementById("dlgOs");
  var NAMES = { macos: "macOS 11 or later, Apple silicon and Intel (universal)", windows: "Windows 10 and 11, 64-bit" };
  var available = false;
  function refresh() { var ok = agree.checked && available; go.classList.toggle("disabled", !ok); go.setAttribute("aria-disabled", String(!ok)); }
  agree.addEventListener("change", refresh);
  document.querySelectorAll("[data-os]").forEach(function (b) {
    b.addEventListener("click", function () {
      var os = b.dataset.os, url = D[os];
      osTxt.textContent = NAMES[os] + (D.version ? " · version " + D.version : "");
      agree.checked = false; go.href = url || "#"; go.setAttribute("download", "");
      available = !!url; miss.hidden = available; refresh(); dlg.showModal();
    });
  });
  dlg.addEventListener("click", function (e) { if (e.target === dlg) dlg.close(); });
  go.addEventListener("click", function () { setTimeout(function () { dlg.close(); }, 300); });
  var form = document.getElementById("form");
  function setTopic(t) { form.msg.value = form.msg.value || ("I would like to ask about the " + t + ".\n\n"); }
  document.getElementById("dlgAsk").addEventListener("click", function () { setTopic("Education edition"); dlg.close(); });
  document.querySelectorAll("[data-topic]").forEach(function (a) { a.addEventListener("click", function () { setTopic(a.dataset.topic); }); });

  // ---------- contact form: an email to the group
  document.getElementById("form").addEventListener("submit", function (e) {
    e.preventDefault();
    var f = e.target, body = "Name: " + f.name.value + "\nOrganisation: " + f.org.value + "\n\n" + f.msg.value;
    window.location.href = "mailto:tellusfem@gmail.com?subject=" + encodeURIComponent("GranumFL enquiry") + "&body=" + encodeURIComponent(body);
  });
})();
