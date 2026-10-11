/* VeilTender demo site behaviour. Plain script, no build step. */
(function () {
  "use strict";

  var Rule = window.VeilRule;
  var I18N = window.VeilI18n;
  var lang = "en";

  function t(key, vars) { return I18N.t(lang, key, vars); }
  function $(id) { return document.getElementById(id); }
  function h(tag, props) {
    var node = document.createElement(tag);
    if (props) Object.keys(props).forEach(function (k) {
      if (k === "text") node.textContent = props[k];
      else if (k === "class") node.className = props[k];
      else node.setAttribute(k, props[k]);
    });
    (function add(list) {
      for (var i = 0; i < list.length; i++) {
        var c = list[i];
        if (c === null || c === undefined) continue;
        if (Array.isArray(c)) add(c);
        else node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
      }
    })(Array.prototype.slice.call(arguments, 2));
    return node;
  }
  function store(key, value) {
    try {
      if (value === undefined) return window.localStorage.getItem(key);
      window.localStorage.setItem(key, value);
    } catch (e) { /* storage can be unavailable; the page works without it */ }
    return null;
  }

  /* ------------------------------------------------- real artifacts from the committed transcript */
  var TRANSCRIPT = window.VEIL_TRANSCRIPT || null;
  function transcriptHandles() {
    var out = [];
    if (!TRANSCRIPT || !TRANSCRIPT.steps) return out;
    TRANSCRIPT.steps.forEach(function (s) {
      (s["public"] || []).forEach(function (line) {
        var m = /input handle (0x[0-9a-fA-F]+…?)/.exec(line);
        if (m) out.push({ actor: s.actor, hex: m[1] });
      });
    });
    return out;
  }
  var HANDLES = transcriptHandles();

  /* ------------------------------------------------- hero: the dark "one bid" card */
  function buildCipher() {
    var dl = $("cipher-rows");
    dl.textContent = "";
    var first = HANDLES[0] || { actor: "ReliableRoute", hex: "0x9451dc58…" };
    var addr = "0x7099…79C8";
    if (TRANSCRIPT && TRANSCRIPT.agents && TRANSCRIPT.agents[0]) addr = TRANSCRIPT.agents[0].address;
    dl.appendChild(h("dt", { text: t("cipher.event") }));
    dl.appendChild(h("dd", { text: t("cipher.event.v", { addr: addr }) }));
    dl.appendChild(h("dt", { text: t("cipher.handle") }));
    dl.appendChild(h("dd", { class: "hex", text: first.hex }));
    dl.appendChild(h("dt", { text: t("cipher.bond") }));
    dl.appendChild(h("dd", { text: t("cipher.bond.v") }));
    dl.appendChild(h("dt", { text: t("cipher.price") }));
    dl.appendChild(h("dd", { class: "never", text: t("cipher.price.v") }));
  }

  /* ------------------------------------------------- the stepped demo */
  var STEPS = ["s1", "s2", "s3", "s4", "s5", "s6"];
  var demoStep = 0;
  var playTimer = null;
  var CODE = [
    "ebool valid   = FHE.le(x, budget);",
    "euint64 score = FHE.select(valid, FHE.add(x, handicap), SCORE_SENT);",
    "ebool beatsBest   = FHE.lt(score, best);",
    "ebool beatsSecond = FHE.lt(score, second);",
    "second = FHE.select(beatsBest, best, FHE.select(beatsSecond, score, second));",
    "best   = FHE.select(beatsBest, score, best);",
    "index  = FHE.select(beatsBest, i, index);",
  ].join("\n");

  function renderDemo() {
    var rail = $("demo-rail");
    rail.textContent = "";
    STEPS.forEach(function (k, i) {
      var b = h("button", { type: "button", class: i < demoStep ? "done" : "" },
        h("span", { class: "n", text: String(i + 1) }),
        h("span", { text: t("demo." + k + ".t") }));
      if (i === demoStep) b.setAttribute("aria-current", "step");
      b.addEventListener("click", function () { stopPlay(); demoStep = i; renderDemo(); });
      rail.appendChild(h("li", null, b));
    });

    var k = STEPS[demoStep];
    if ($("demo-scene")) $("demo-scene").setAttribute("data-step", k);
    var pub = $("stage-pub");
    pub.textContent = "";
    t("demo." + k + ".pub").forEach(function (line) { pub.appendChild(h("li", { text: line })); });
    if (k === "s2") {
      (HANDLES.length ? HANDLES : []).forEach(function (hd) {
        pub.appendChild(h("li", { class: "hexline", text: hd.actor + "  " + hd.hex }));
      });
    }
    var sealed = $("stage-sealed");
    sealed.textContent = "";
    t("demo." + k + ".sealed").forEach(function (line) { sealed.appendChild(h("li", { text: line })); });

    var code = $("stage-code");
    code.hidden = k !== "s3";
    if (k === "s3") code.textContent = CODE;

    var result = $("demo-result");
    result.hidden = demoStep !== STEPS.length - 1;
    if (!result.hidden) result.textContent = t("demo.result");

    $("demo-prev").textContent = t("demo.prev");
    $("demo-prev").disabled = demoStep === 0;
    var last = demoStep === STEPS.length - 1;
    $("demo-next").textContent = t(last ? "demo.restart" : "demo.next");
    $("demo-play").textContent = t(playTimer ? "demo.pause" : "demo.play");
  }
  function stepNext() {
    demoStep = demoStep === STEPS.length - 1 ? 0 : demoStep + 1;
    renderDemo();
  }
  function stopPlay() {
    if (playTimer) { window.clearInterval(playTimer); playTimer = null; }
  }
  function togglePlay() {
    if (playTimer) { stopPlay(); renderDemo(); return; }
    if (demoStep === STEPS.length - 1) demoStep = 0;
    playTimer = window.setInterval(function () {
      if (demoStep === STEPS.length - 1) { stopPlay(); renderDemo(); return; }
      demoStep += 1;
      renderDemo();
    }, 2600);
    renderDemo();
  }

  /* ------------------------------------------------- playground */
  var MULT = { truth: 1, high: 1.25, low: 0.75 };
  var tryState = {
    budget: 1000,
    chartAgent: 0,
    agents: [
      { name: "ReliableRoute", cost: 420, k: 0, strategy: "truth" },
      { name: "FreshStart", cost: 300, k: 150, strategy: "truth" },
      { name: "SteadyHaul", cost: 510, k: 0, strategy: "truth" },
      { name: "OverReach", cost: 1500, k: 0, strategy: "truth" },
    ],
  };
  var handleFor = [];
  var handleBid = [];

  function randomHex(n) {
    var out = "";
    var bytes = null;
    if (window.crypto && window.crypto.getRandomValues) { bytes = new Uint8Array(n); window.crypto.getRandomValues(bytes); }
    for (var i = 0; i < n; i++) {
      var v = bytes ? bytes[i] : Math.floor(Math.random() * 256);
      out += (v < 16 ? "0" : "") + v.toString(16);
    }
    return out;
  }
  function num(v, fallback) {
    var n = Math.floor(Number(v));
    return isFinite(n) && n >= 0 ? n : fallback;
  }
  function bidOf(a) { return Math.round(a.cost * MULT[a.strategy]); }
  function runTry(overrideIndex, overrideBid) {
    var bids = tryState.agents.map(function (a, i) { return i === overrideIndex ? overrideBid : bidOf(a); });
    return Rule.award(bids, tryState.budget, tryState.agents.map(function (a) { return a.k; }));
  }

  function buildTryRows() {
    var body = $("agent-rows");
    body.textContent = "";
    tryState.agents.forEach(function (a, i) {
      var cost = h("input", { type: "number", min: "0", step: "1", value: String(a.cost), "aria-label": a.name + " " + t("try.cost") });
      var k = h("input", { type: "number", min: "0", step: "1", value: String(a.k), "aria-label": a.name + " " + t("try.handicap") });
      var sel = h("select", { "aria-label": a.name + " " + t("try.strategy") });
      [["truth", "try.s.truth"], ["high", "try.s.high"], ["low", "try.s.low"]].forEach(function (o) {
        var opt = h("option", { value: o[0], text: t(o[1]) });
        if (a.strategy === o[0]) opt.selected = true;
        sel.appendChild(opt);
      });
      cost.addEventListener("input", function () { a.cost = num(cost.value, 0); updateTry(); });
      k.addEventListener("input", function () { a.k = num(k.value, 0); updateTry(); });
      sel.addEventListener("change", function () { a.strategy = sel.value; updateTry(); });
      body.appendChild(h("tr", null,
        h("td", { class: "name", text: a.name }),
        h("td", null, cost), h("td", null, k), h("td", null, sel),
        h("td", { id: "bid-" + i }), h("td", { id: "score-" + i }), h("td", { id: "res-" + i })));
    });
    var sel2 = $("chart-agent");
    sel2.textContent = "";
    tryState.agents.forEach(function (a, i) {
      var o = h("option", { value: String(i), text: a.name });
      if (i === tryState.chartAgent) o.selected = true;
      sel2.appendChild(o);
    });
  }

  function updateTry() {
    var r = runTry();
    var budget = tryState.budget;
    tryState.agents.forEach(function (a, i) {
      var bid = bidOf(a);
      $("bid-" + i).textContent = String(bid);
      $("score-" + i).textContent = r.scores[i] === null ? "–" : String(r.scores[i]);
      var cell = $("res-" + i);
      cell.className = "";
      if (bid > budget) { cell.textContent = t("try.r.over"); cell.className = "res-over"; }
      else if (r.winner === i) { cell.textContent = t("try.r.win"); cell.className = "res-win"; }
      else cell.textContent = t("try.r.lost");
    });

    var summary = $("summary");
    if (r.winner === null) summary.textContent = t("try.summary.none");
    else {
      var w = tryState.agents[r.winner];
      summary.textContent = t("try.summary.win", { name: w.name, price: r.price, profit: r.price - w.cost });
    }

    var list = $("handles");
    list.textContent = "";
    tryState.agents.forEach(function (a, i) {
      var bid = bidOf(a);
      if (handleBid[i] !== bid || !handleFor[i]) { handleBid[i] = bid; handleFor[i] = "0x" + randomHex(32); }
      var hex = handleFor[i];
      list.appendChild(h("li", { text: "bid #" + i + " " + a.name + "  " + hex.slice(0, 14) + "…" + hex.slice(-4) }));
    });

    var rev = $("revealed");
    if (r.winner === null) rev.textContent = t("try.revealed.none");
    else if (r.secondScore === null) rev.textContent = t("try.revealed.v1", { idx: r.winner });
    else rev.textContent = t("try.revealed.v", { idx: r.winner, second: r.secondScore });

    drawChart();
  }

  function drawChart() {
    var svg = $("chart");
    var i = tryState.chartAgent;
    var a = tryState.agents[i];
    var budget = tryState.budget;
    var maxX = Math.max(10, Math.ceil(budget * 1.2));
    var step = Math.max(1, Math.round(maxX / 320));
    var pts = [], winMax = -1, payoffWin = null;
    for (var x = 0; x <= maxX; x += step) {
      var r = runTry(i, x);
      var win = r.winner === i;
      var u = win ? r.price - a.cost : 0;
      if (win) { winMax = x; payoffWin = u; }
      pts.push([x, u]);
    }
    var minU = 0, maxU = 0;
    pts.forEach(function (p) { if (p[1] < minU) minU = p[1]; if (p[1] > maxU) maxU = p[1]; });
    if (maxU === minU) { maxU = minU + 1; }
    var pad = (maxU - minU) * 0.12;
    var yLo = minU - pad, yHi = maxU + pad;
    var L = 56, R = 16, T = 18, B = 40, W = 640, H = 280;
    function sx(v) { return L + (v / maxX) * (W - L - R); }
    function sy(v) { return T + (1 - (v - yLo) / (yHi - yLo)) * (H - T - B); }
    var NS = "http://www.w3.org/2000/svg";
    function s(tag, attrs, text) {
      var n = document.createElementNS(NS, tag);
      Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
      if (text !== undefined) n.textContent = text;
      return n;
    }
    svg.textContent = "";
    var y0 = sy(0);
    var line = "M" + pts.map(function (p) { return sx(p[0]).toFixed(1) + " " + sy(p[1]).toFixed(1); }).join(" L");
    var area = line + " L" + sx(maxX).toFixed(1) + " " + y0.toFixed(1) + " L" + sx(0).toFixed(1) + " " + y0.toFixed(1) + " Z";
    svg.appendChild(s("path", { d: area, "class": "area" }));
    svg.appendChild(s("line", { x1: L, y1: y0, x2: W - R, y2: y0, "class": "ax" }));
    svg.appendChild(s("line", { x1: L, y1: T, x2: L, y2: H - B, "class": "ax" }));
    var cx = sx(Math.min(a.cost, maxX));
    svg.appendChild(s("line", { x1: cx, y1: T, x2: cx, y2: H - B, "class": "costline" }));
    svg.appendChild(s("text", { x: Math.min(cx + 6, W - 90), y: T + 10 }, t("chart.cost") + " " + a.cost));
    svg.appendChild(s("path", { d: line, "class": "line" }));
    var cur = bidOf(a);
    var curR = runTry(i, cur);
    var curU = curR.winner === i ? curR.price - a.cost : 0;
    svg.appendChild(s("circle", { cx: sx(Math.min(cur, maxX)), cy: sy(curU), r: 5, "class": "now" }));
    svg.appendChild(s("text", { x: Math.min(sx(Math.min(cur, maxX)) + 8, W - 100), y: sy(curU) - 8 }, t("chart.now") + " " + cur));
    svg.appendChild(s("text", { x: L - 8, y: y0 + 4, "text-anchor": "end" }, "0"));
    if (maxU > 0) svg.appendChild(s("text", { x: L - 8, y: sy(maxU) + 4, "text-anchor": "end" }, String(Math.round(maxU))));
    if (minU < 0) svg.appendChild(s("text", { x: L - 8, y: sy(minU) + 4, "text-anchor": "end" }, String(Math.round(minU))));
    svg.appendChild(s("text", { x: sx(0), y: H - B + 16, "text-anchor": "start" }, "0"));
    svg.appendChild(s("text", { x: sx(maxX), y: H - B + 16, "text-anchor": "end" }, String(maxX)));
    svg.appendChild(s("text", { x: (L + W - R) / 2, y: H - 8, "text-anchor": "middle" }, t("chart.x")));
    svg.appendChild(s("text", { x: 12, y: T + 4, "text-anchor": "start" }, t("chart.y")));

    $("chart-title").textContent = t("chart.title", { name: a.name });
    $("chart-caption").textContent = payoffWin !== null && payoffWin > 0
      ? t("chart.caption.win", { name: a.name, payoff: payoffWin, limit: winMax })
      : t("chart.caption.lose", { name: a.name });
  }

  /* ------------------------------------------------- privacy lists, limits, code */
  function fillList(id, key) {
    var ul = $(id);
    ul.textContent = "";
    t(key).forEach(function (line) { ul.appendChild(h("li", { text: line })); });
  }
  function renderStatic() {
    fillList("privacy-pub", "privacy.pub.l");
    fillList("privacy-sealed", "privacy.sealed.l");
    fillList("limits-list", "limits.l");
    $("fold-code").textContent = CODE;
  }

  /* ------------------------------------------------- language */
  function applyLang(next) {
    lang = next;
    document.documentElement.lang = next === "zh" ? "zh-CN" : "en";
    document.title = t("doc.title");
    Array.prototype.forEach.call(document.querySelectorAll("[data-i18n]"), function (n) {
      n.textContent = t(n.getAttribute("data-i18n"));
    });
    Array.prototype.forEach.call(document.querySelectorAll(".lang button"), function (b) {
      b.setAttribute("aria-pressed", b.getAttribute("data-lang") === next ? "true" : "false");
    });
    buildCipher();
    renderDemo();
    renderStatic();
    buildTryRows();
    updateTry();
    store("veil-lang", next);
  }

  function init() {
    $("demo-prev").addEventListener("click", function () { stopPlay(); if (demoStep > 0) demoStep -= 1; renderDemo(); });
    $("demo-next").addEventListener("click", function () { stopPlay(); stepNext(); });
    $("demo-play").addEventListener("click", togglePlay);
    $("budget").addEventListener("input", function (e) {
      var n = num(e.target.value, 1000);
      tryState.budget = n < 1 ? 1 : n;
      updateTry();
    });
    $("chart-agent").addEventListener("change", function (e) {
      tryState.chartAgent = Number(e.target.value);
      drawChart();
    });
    Array.prototype.forEach.call(document.querySelectorAll(".lang button"), function (b) {
      b.addEventListener("click", function () { applyLang(b.getAttribute("data-lang")); });
    });
    var saved = store("veil-lang");
    var guess = saved || ((navigator.language || "en").toLowerCase().indexOf("zh") === 0 ? "zh" : "en");
    applyLang(guess === "zh" ? "zh" : "en");
  }
  init();
})();
