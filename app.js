/* စာအုပ်စင် — storefront app. Bold Editorial SPA, written from scratch. */
(function () {
"use strict";

var SS = window.SS || {};
var BOT = SS.BOT || "sarokesin_bot";
var PRICE = SS.PRICE || 3000;
var BATCH_N = 7;

var SETS = [], BYID = {}, CATS = {}, HOME = null,
    COVERS = {}, MANUAL = {}, REALDL = {};

/* ---------- Myanmar digits ---------- */
var MMD = ["၀","၁","၂","၃","၄","၅","၆","၇","၈","၉"];
function mm(x) {
  return String(x).replace(/[0-9]/g, function (d) { return MMD[+d]; });
}
function mmComma(n) {
  return mm(String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","));
}

/* ---------- helpers ---------- */
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}
function firstLetter(name) {
  var t = String(name || "").trim();
  return t ? t[0].toUpperCase() : "စ";
}
function fmtSize(bytes) {
  var b = +bytes || 0;
  if (b >= 1048576) return (b / 1048576).toFixed(b >= 10485760 ? 0 : 1) + " MB";
  if (b >= 1024) return Math.round(b / 1024) + " KB";
  return b + " B";
}

/* ---------- download counts: NEW salt, unlinkable from the main shop ---------- */
function seedCount(set) {
  var s = "sarokesin-2026::" + set.id, h = 0, i;
  for (i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  h = Math.abs(h);
  var fc = set.file_count || 1;
  if (fc >= 6) return 41 + (h % 23);
  if (fc >= 3) return 17 + (h % 19);
  return 5 + (h % 13);
}
function dlOf(set) { return seedCount(set) + (REALDL[set.id] || 0); }

/* ---------- covers ---------- */
function coverURL(set) {
  if (MANUAL[set.id]) return "data/manual_covers/" + set.id + ".jpg";
  if (COVERS[set.id]) return COVERS[set.id];
  return null;
}
function thumbHTML(set, cls) {
  var u = coverURL(set);
  if (u) return '<div class="' + cls + '"><img loading="lazy" src="' + esc(u) +
    '" alt="" onerror="this.parentNode.innerHTML=\'' + esc(firstLetter(set.name)) + "'\"></div>";
  return '<div class="' + cls + '">' + esc(firstLetter(set.name)) + "</div>";
}

/* ---------- categories ---------- */
var CATLABEL = { all: "အားလုံး", english: "အင်္ဂလိပ်စာ", maths: "သင်္ချာ",
                 science: "သိပ္ပံ", others: "အခြား" };
var CATS_ORDER = ["all", "english", "maths", "science", "others"];
function catOf(set) { return CATS[set.id] || "others"; }

/* ---------- component pill labels ---------- */
var COMPLABEL = {
  "Student Book": "ကျောင်းစာအုပ်", "Workbook": "လေ့ကျင့်ခန်း",
  "Teacher's Book": "ဆရာစာအုပ်", "Audio": "အသံဖိုင်",
  "Video": "ဗီဒီယို", "Answer Key": "အဖြေစာအုပ်",
  "Tests": "စာမေးပွဲ", "Word List": "ဝေါဟာရစာရင်း",
  "Resources": "အရင်းအမြစ်", "Worksheets": "လုပ်ငန်းစာရွက်",
  "Flashcards": "မှတ်စုကတ်", "Scripts": "ဖတ်စာသား",
  "Posters": "ပိုစတာ", "Sources": "ရင်းမြစ်",
  "Syllabus": "သင်ရိုးစာရင်း", "ROM": "ROM", "Portfolio": "Portfolio"
};
function compLabel(c) { return COMPLABEL[c] || c; }

/* ---------- data loading ---------- */
function loadJSON(path) {
  return fetch(path, { cache: "no-cache" }).then(function (r) {
    if (!r.ok) throw new Error("load " + path);
    return r.json();
  });
}
function loadAll() {
  return Promise.all([
    loadJSON("data/sets.json"),
    loadJSON("data/cats.json"),
    loadJSON("data/home.json"),
    loadJSON("data/covers.json").catch(function () { return {}; }),
    loadJSON("data/manual.json").catch(function () { return []; }),
    loadJSON("data/downloads.json").catch(function () { return {}; })
  ]).then(function (r) {
    SETS = r[0].sets || [];
    CATS = r[1] || {};
    HOME = r[2] || {};
    COVERS = r[3] || {};
    (r[4] || []).forEach(function (id) { MANUAL[id] = 1; });
    REALDL = r[5] || {};
    SETS.forEach(function (s) { BYID[s.id] = s; });
  });
}

/* ---------- cart ---------- */
var CART_KEY = "sarokesin_cart_v1", SENT_KEY = "sarokesin_cart_sent_v1";
function cartLoad(k) {
  try { return JSON.parse(localStorage.getItem(k)) || []; } catch (e) { return []; }
}
function cartSave(k, v) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
}
function cartItems() {
  return cartLoad(CART_KEY).map(function (id) { return BYID[id]; })
    .filter(function (s) { return !!s; });
}
function cartPending() {
  var sent = cartLoad(SENT_KEY), out = [];
  cartItems().forEach(function (s) {
    if (sent.indexOf(s.id) === -1) out.push(s);
  });
  return out;
}
function updateBadge() {
  var b = document.getElementById("cartCount");
  if (b) b.textContent = mm(cartItems().length);
}
window.ssAddCart = function (pid) {
  var c = cartLoad(CART_KEY);
  if (c.indexOf(pid) === -1) { c.push(pid); cartSave(CART_KEY, c); }
  updateBadge();
  var btn = document.getElementById("addbtn");
  if (btn) btn.textContent = "🧺 ထည့်ပြီးပါပြီ ✓";
};
window.ssRemoveCart = function (pid) {
  cartSave(CART_KEY, cartLoad(CART_KEY).filter(function (id) { return id !== pid; }));
  render();
};
window.ssClearCart = function () {
  cartSave(CART_KEY, []); cartSave(SENT_KEY, []);
  render();
};

/* pid -> 8 base64url chars (mirrors the bot's _webcart_decode) */
function pidChunk(pid) {
  var bytes = pid.match(/.{2}/g).map(function (h) { return parseInt(h, 16); });
  var bin = "";
  for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function batchURL(batch, total) {
  var blob = batch.map(function (s) { return pidChunk(s.id); }).join("");
  return "https://t.me/" + BOT + "?start=w" + total + "-" + blob;
}
window.ssBatchSent = function (n) {
  var sent = cartLoad(SENT_KEY);
  cartPending().slice(0, BATCH_N).forEach(function (s) {
    if (sent.indexOf(s.id) === -1) sent.push(s.id);
  });
  cartSave(SENT_KEY, sent);
  if (!cartPending().length) {
    cartSave(CART_KEY, []); cartSave(SENT_KEY, []);
  }
  render();
};
window.ssBuy = function (pid) {
  window.open("https://t.me/" + BOT + "?start=buy_" + encodeURIComponent(pid), "_blank");
};
window.ssGmailOne = function (pid) {
  var s = BYID[pid];
  if (s && window.SSChat) window.SSChat.orderOne(pid, s.name);
};
window.ssGmailCart = function () {
  var items = cartItems().map(function (s) { return { pid: s.id, name: s.name }; });
  if (items.length && window.SSChat) window.SSChat.orderBatch(items);
};

/* ---------- row / card builders ---------- */
function rowHTML(set, num) {
  var n = mm(num), dl = mmComma(dlOf(set));
  return '<a class="erow" href="#/d/' + set.id + '">' +
    '<span class="enum">' + n + "</span>" +
    thumbHTML(set, "ethumb") +
    '<div class="einfo"><h3>' + esc(set.name) + "</h3>" +
    '<div class="meta">' + mm(set.file_count || 1) + " ဖိုင် · ⬇ " + dl + " ကြိမ် ဒေါင်းပြီး</div></div>" +
    '<span class="eprice">' + mmComma(set.price || PRICE) + '<small>ကျပ်</small></span></a>';
}
function cardHTML(set, sticker) {
  var ex = (set.series || "") + " · " + mm(set.file_count || 1) + " ဖိုင်";
  return '<a class="fcard" href="#/d/' + set.id + '">' +
    (sticker ? '<span class="fstick">' + esc(sticker) + "</span>" : "") +
    thumbHTML(set, "fcover") +
    "<h3>" + esc(set.name) + "</h3>" +
    '<p class="ex">' + esc(ex) + "</p>" +
    '<span class="more">အသေးစိတ်ကြည့်ရန် →</span></a>';
}
function catNavHTML(active) {
  var h = '<nav class="catnav">';
  CATS_ORDER.forEach(function (c) {
    var href = c === "all" ? "#/" : "#/cat/" + c;
    h += '<a href="' + href + '"' + (c === active ? ' class="on"' : "") + ">" +
      esc(CATLABEL[c]) + "</a>";
  });
  return h + "</nav>";
}
function colophonHTML() {
  return '<footer class="colophon"><div class="cb"><b>စာအုပ်စင်</b><br>' +
    "စာအုပ်ကောင်းများ စုစည်းရာ<br>" +
    "ထုတ်ဝေမှု — အမှတ် " + mm("108") + " · " + mm("2026") + "<br>" +
    'ဆက်သွယ်ရန် — <a href="https://t.me/' + BOT + '" target="_blank" rel="noopener">Telegram @' + esc(BOT) + "</a></div></footer>";
}

/* ---------- home ---------- */
function pickStory() {
  // editorial pick: first manual-cover set among the newest
  var news = (HOME.new || []).map(function (e) { return BYID[e.id]; }).filter(Boolean);
  for (var i = 0; i < news.length; i++) if (MANUAL[news[i].id]) return news[i];
  for (var j = 0; j < SETS.length; j++) if (MANUAL[SETS[j].id]) return SETS[j];
  return SETS[0];
}
function viewHome() {
  var story = pickStory();
  var news = (HOME.new || []).slice(0, 8).map(function (e) { return BYID[e.id]; }).filter(Boolean);
  var popular = SETS.slice().sort(function (a, b) { return dlOf(b) - dlOf(a); });
  var popCovered = popular.filter(function (s) { return coverURL(s); }).slice(0, 4);

  var h = '<div class="mast"><h1>စာအုပ်စင်</h1>' +
    '<div class="tag">စာအုပ်ကောင်းများ စုစည်းရာ</div>' +
    '<div class="dateline"><span>အမှတ် ' + mm("108") + "</span><span>" +
    mm("၉ အောက်တိုဘာ ၂၀၂၆") + "</span><span>တစ်စုံ — " + mmComma(PRICE) + " ကျပ်</span></div></div>";
  h += catNavHTML("all");

  if (story) {
    h += '<div class="story">' + thumbHTML(story, "cov") +
      '<div><span class="kicker">ဒီနေ့ အထူး</span>' +
      "<h2>" + esc(story.name) + "</h2>" +
      "<p>" + esc(story.series || "") + " — " + mm(story.file_count || 1) +
      " ဖိုင်ပါဝင်သော တစ်စုံအပြည့်။ မှာယူပြီး ချက်ချင်း ဒေါင်းလို့ရပါတယ်။</p>" +
      '<a class="btn btn-acc" href="#/d/' + story.id + '">အသေးစိတ်ကြည့်ရန်</a></div></div>';
  }

  h += '<section class="sec"><div class="sec-h"><span class="sec-n">၀၁</span><h2>အသစ်ရောက်များ</h2></div>';
  news.forEach(function (s, i) { h += rowHTML(s, i + 1); });
  h += "</section>";

  h += '<div class="quote"><p>"စာအုပ်တစ်အုပ်သည်<br>ကမ္ဘာသစ်တစ်ခု၏ တံခါးပင်။"</p>' +
    "<cite>— စာအုပ်စင် အယ်ဒီတာ</cite></div>";

  h += '<section class="sec"><div class="sec-h"><span class="sec-n">၀၂</span><h2>လူကြိုက်များ</h2></div>' +
    '<div class="fgrid">';
  popCovered.forEach(function (s) { h += cardHTML(s, "အသစ်"); });
  h += "</div></section>";

  h += '<section class="sec"><div class="sec-h"><span class="sec-n">၀၃</span><h2>အမျိုးအစားများ</h2></div>' +
    '<div class="idx">';
  ["english", "maths", "science", "others"].forEach(function (c) {
    var n = SETS.filter(function (s) { return catOf(s) === c; }).length;
    h += '<a href="#/cat/' + c + '"><span>' + esc(CATLABEL[c]) + ' စာအုပ်များ</span>' +
      '<span class="ct">' + mmComma(n) + " အုပ်</span></a>";
  });
  h += "</div></section>" + colophonHTML();
  return h;
}

/* ---------- search ---------- */
function searchSets(q) {
  q = String(q || "").trim().toLowerCase();
  if (!q) return [];
  var out = [];
  for (var i = 0; i < SETS.length; i++) {
    var s = SETS[i];
    var nm = (s.name || "").toLowerCase(), sr = (s.series || "").toLowerCase();
    var score = 0;
    if (nm.indexOf(q) === 0) score = 4;
    else if (sr.indexOf(q) === 0) score = 3;
    else if (nm.indexOf(q) >= 0) score = 2;
    else if (sr.indexOf(q) >= 0) score = 1;
    if (score) out.push({ s: s, score: score });
  }
  out.sort(function (a, b) {
    return (b.score - a.score) || (dlOf(b.s) - dlOf(a.s));
  });
  return out.slice(0, 80).map(function (e) { return e.s; });
}
function viewSearch(q) {
  var res = searchSets(q);
  var h = '<div class="sfield"><input id="q" type="search" placeholder="စာအုပ်နာမည် ရိုက်ရှာပါ…" value="' +
    esc(q) + '"><button id="go">ရှာရန်</button></div>';
  h += catNavHTML(null);
  if (!String(q || "").trim()) {
    return h + '<div class="empty"><div class="big">🔍</div>စာအုပ်နာမည်၊ စီးရီးနာမည် ရိုက်ပြီး ရှာနိုင်ပါတယ်။</div>' +
      colophonHTML();
  }
  h += '<section class="sec"><div class="sec-h"><span class="sec-n">🔍</span><h2>ရှာဖွေမှု — “' +
    esc(q) + "”</h2></div>";
  if (!res.length) {
    h += '<div class="empty"><div class="big">📭</div>မတွေ့ပါ — တခြားစကားလုံးနဲ့ ပြန်ရှာကြည့်ပါ။</div>';
  } else {
    h += '<div style="font-size:12.5px;color:var(--muted);padding:6px 4px">' +
      mm(res.length) + " ခု တွေ့ပါတယ်</div>";
    res.forEach(function (s, i) { h += rowHTML(s, i + 1); });
  }
  h += "</section>" + colophonHTML();
  return h;
}
function viewCat(c) {
  var list = SETS.filter(function (s) { return c === "all" || catOf(s) === c; });
  list.sort(function (a, b) { return dlOf(b) - dlOf(a); });
  list = list.slice(0, 120);
  var h = catNavHTML(c);
  h += '<section class="sec"><div class="sec-h"><span class="sec-n">📚</span><h2>' +
    esc(CATLABEL[c] || c) + ' စာအုပ်များ</h2></div>';
  h += '<div style="font-size:12.5px;color:var(--muted);padding:6px 4px">' +
    mmComma(list.length) + " အုပ် (လူကြိုက်များစဉ်)</div>";
  list.forEach(function (s, i) { h += rowHTML(s, i + 1); });
  h += "</section>" + colophonHTML();
  return h;
}

/* ---------- detail ---------- */
function viewDetail(pid) {
  var s = BYID[pid];
  if (!s) return '<div class="empty"><div class="big">📭</div>ဒီစာအုပ် မရှိတော့ပါ။</div>';
  window._detail = { id: s.id, name: s.name };
  var comps = s.components || [];
  var tabs = comps.length
    ? '<div class="ptabs">' + comps.map(function (c) {
        return '<span class="ptab">' + esc(compLabel(c)) + "</span>";
      }).join("") + "</div>"
    : "";
  var h = '<div class="dwrap"><a class="dback" href="javascript:history.back()">‹ နောက်သို့</a>' +
    '<div><span class="dkick">' + esc(CATLABEL[catOf(s)] || "") + "</span></div>" +
    '<h1 class="dtitle">' + esc(s.name) + "</h1>" +
    '<div class="dseries">' + esc(s.series || "") + "</div>" +
    thumbHTML(s, "dcover") + tabs +
    '<div class="dprice">' + mmComma(s.price || PRICE) +
    ' <small>ကျပ် / တစ်စုံ (' + mm(s.file_count || 1) + " ဖိုင်)</small></div>" +
    '<div id="filebox"><div style="padding:20px;color:var(--muted);font-size:13px">ဖိုင်စာရင်း ဖွင့်နေပါတယ်…</div></div>' +
    "</div>" +
    '<div class="buybar"><div class="inner">' +
    '<button class="btn btn-acc acc" onclick="ssBuy(\'' + s.id + "')\">📩 Telegram က မှာယူမယ်</button>" +
    '<button class="btn btn-line" onclick="ssGmailOne(\'' + s.id + "')\">📧 Gmail</button>" +
    '<button class="btn btn-line" id="addbtn" onclick="ssAddCart(\'' + s.id + "')\">🧺 ထည့်မယ်</button>" +
    "</div></div>";
  loadJSON("data/sets/" + s.id + ".json").then(function (d) {
    var box = document.getElementById("filebox");
    if (!box) return;
    var items = d.items || [];
    var lh = '<ul class="flist">' + items.map(function (f) {
      var tag = f.src === "local" ? '<span class="now">ချက်ချင်းရ</span>' : "";
      return "<li>" + tag + '<span class="fn">' + esc(f.n) + '</span><span class="fs">' +
        esc(fmtSize(f.s)) + "</span></li>";
    }).join("") + "</ul>";
    box.innerHTML = lh;
  }).catch(function () {
    var box = document.getElementById("filebox");
    if (box) box.innerHTML = "";
  });
  return h;
}

/* ---------- cart view ---------- */
function viewCart() {
  var items = cartItems(), pending = cartPending();
  var h = '<div class="cartsec"><h2>🧺 ခြင်းတောင်း</h2>';
  if (!items.length) {
    h += '<div class="empty"><div class="big">🧺</div>ခြင်းတောင်းထဲ ဘာမှမရှိသေးပါ။<br>' +
      '<a href="#/" style="color:var(--verm);font-weight:700">စာအုပ်များ ကြည့်ရန် →</a></div></div>';
    return h;
  }
  items.forEach(function (s) {
    var sent = pending.indexOf(s) === -1;
    h += '<div class="cartrow">' + thumbHTML(s, "ethumb") +
      '<div class="einfo"><h3>' + esc(s.name) + "</h3>" +
      '<div class="meta">' + mmComma(s.price || PRICE) + " ကျပ်" +
      (sent ? ' · <span style="color:var(--verm)">ပို့ပြီးပါပြီ ✓</span>' : "") + "</div></div>" +
      '<button class="crm" onclick="ssRemoveCart(\'' + s.id + "')\" aria-label=\"ဖျက်ရန်\">✕</button></div>";
  });
  var total = items.reduce(function (t, s) { return t + (s.price || PRICE); }, 0);
  h += '<div class="cartotal"><span>စုစုပေါင်း (' + mm(items.length) + " အုပ်)</span><b>" +
    mmComma(total) + " ကျပ်</b></div>";

  if (pending.length) {
    h += '<div class="batch"><h4>📩 Telegram ဖြင့် မှာယူရန်</h4>' +
      "<p>အသုတ် " + mm(Math.ceil(pending.length / BATCH_N)) + " သုတ် ခွဲပို့ရပါမယ် " +
      "(တစ်သုတ် " + mm(BATCH_N) + " အုပ်)။ လင့်ခ်တစ်ခုချင်းစီ နှိပ်ပြီး bot ကို ပို့ပါ — " +
      "bot က တစ်ခြင်းတည်းအဖြစ် စုပေးပါမယ်။</p>";
    for (var i = 0; i < pending.length; i += BATCH_N) {
      var batch = pending.slice(i, i + BATCH_N), bn = i / BATCH_N + 1;
      h += '<div class="batch" style="margin:10px 0"><h4>အသုတ် ' + mm(bn) + " — " +
        mm(batch.length) + " အုပ်</h4><p>" +
        esc(batch.map(function (s) { return s.name; }).join(" · ")) + "</p>" +
        '<a class="btn btn-acc" target="_blank" rel="noopener" href="' +
        esc(batchURL(batch, pending.length)) +
        '" onclick="setTimeout(function(){ssBatchSent(' + bn + ")},800)\">အသုတ် " + mm(bn) +
        " ပို့ရန် →</a></div>";
    }
    h += "</div>";
    h += '<div class="batch"><h4>📧 Gmail ဖြင့် မှာယူရန်</h4>' +
      "<p>ခြင်းထဲက " + mm(pending.length) +
      " အုပ်လုံးကို Gmail / Drive နဲ့ လက်ခံချင်ရင် — chat မှာ လိပ်စာပေးပြီး မှာယူနိုင်ပါတယ်။</p>" +
      '<button class="btn btn-line" style="width:100%" onclick="ssGmailCart()">📧 Gmail နဲ့ မှာယူမယ်</button></div>';
  } else {
    h += '<div class="batch"><h4>✅ အားလုံး ပို့ပြီးပါပြီ</h4>' +
      "<p>Telegram bot မှာ ငွေချေမှု ဆက်လုပ်ပါ။ မှားရွေးမိရင် အောက်က ခလုတ်နဲ့ ရှင်းနိုင်ပါတယ်။</p></div>";
  }
  h += '<button class="btn btn-line" style="width:100%;margin-top:8px" onclick="ssClearCart()">ခြင်းတောင်း ရှင်းရန်</button>';
  h += "</div>";
  return h;
}

/* ---------- router ---------- */
function route() {
  var hsh = location.hash || "#/";
  var app = document.getElementById("app");
  var html;
  if (hsh.indexOf("#/d/") === 0) html = viewDetail(hsh.slice(4));
  else if (hsh.indexOf("#/cat/") === 0) html = viewCat(hsh.slice(6));
  else if (hsh.indexOf("#/q/") === 0) html = viewSearch(decodeURIComponent(hsh.slice(4)));
  else if (hsh === "#/cart") html = viewCart();
  else html = viewHome();
  app.innerHTML = html;
  updateBadge();
  window.scrollTo(0, 0);
  var q = document.getElementById("q");
  if (q) {
    var go = function () {
      var v = q.value.trim();
      location.hash = "#/q/" + encodeURIComponent(v);
    };
    document.getElementById("go").addEventListener("click", go);
    q.addEventListener("keydown", function (e) { if (e.key === "Enter") go(); });
  }
}
function render() { route(); }

/* ---------- strip: search + cart buttons ---------- */
function wireStrip() {
  var sb = document.getElementById("searchBtn");
  if (sb) sb.addEventListener("click", function () {
    location.hash = "#/q/";
    setTimeout(function () {
      var q = document.getElementById("q");
      if (q) q.focus();
    }, 150);
  });
}

document.addEventListener("DOMContentLoaded", function () {
  wireStrip();
  loadAll().then(function () {
    window.addEventListener("hashchange", route);
    route();
  }).catch(function () {
    document.getElementById("app").innerHTML =
      '<div class="empty"><div class="big">⚠️</div>ဒေတာ ဖွင့်မရပါ — ပြန်လည်စမ်းကြည့်ပါ။</div>';
  });
});
})();
