/* စာအုပ်စင် — support chat widget. Talks to the sarokesin-support worker. Written from scratch. */
(function () {
"use strict";

var SS = window.SS || {};
var W = (SS.WORKER_URL || "").replace(/\/$/, "");
var BOT = SS.BOT || "sarokesin_bot";

var vid = null;
try { vid = localStorage.getItem("ss_vid"); } catch (e) {}
if (!vid) {
  vid = "v" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  try { localStorage.setItem("ss_vid", vid); } catch (e) {}
}

var lastTs = 0, greeted = false, timer = null, wantEmail = false;
var pending = null;        // {pid,name} or {batch:[{pid,name}]}
var orderIds = [];

var fab, panel, msgs, form, input, fileBtn, fileInput, dot, quick;

function el(t, cls, html) {
  var d = document.createElement(t);
  if (cls) d.className = cls;
  if (html != null) d.innerHTML = html;
  return d;
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}
function linkify(s) {
  return esc(s).replace(/(https?:\/\/[^\s<]+)/g,
    '<a href="$1" target="_blank" rel="noopener">$1</a>');
}
function scrollDown() { msgs.scrollTop = msgs.scrollHeight; }

function say(from, text) {
  msgs.appendChild(el("div", "cmsg " + from, linkify(text)));
  scrollDown();
}
function sayImage(from, dataUrl) {
  var m = el("div", "cmsg " + from);
  var img = el("img"); img.src = dataUrl;
  m.appendChild(img); msgs.appendChild(m); scrollDown();
}
function tgButton(pid) {
  var m = el("div", "cmsg o");
  var a = el("a", null, "📩 Telegram ကနေ မှာယူမယ်");
  a.href = "https://t.me/" + BOT + (pid ? "?start=buy_" + encodeURIComponent(pid) : "");
  a.target = "_blank"; a.rel = "noopener";
  a.style.cssText = "display:inline-block;background:#C93A22;color:#fff;border-radius:4px;" +
    "padding:12px 20px;font-weight:700;text-decoration:none;margin-top:8px;min-height:48px";
  m.appendChild(a); msgs.appendChild(m); scrollDown();
}
function greet() {
  if (greeted) return;
  greeted = true;
  say("o", "မင်္ဂလာပါ 🙏 စာအုပ်စင် က ကူညီပေးပါမယ်။ မေးချင်တာ ဒီမှာ ရေးလိုက်ပါ။");
  var q = el("div", "cquick");
  [["ဈေးနှုန်း သိချင်တယ်", "စာအုပ်တစ်စုံ ဘယ်လောက်လဲ?"],
   ["ဘယ်လို မှာရမလဲ", "ဘယ်လို မှာယူရမလဲ?"],
   ["ဖိုင် ဘယ်လိုရမလဲ", "ဝယ်ပြီးရင် ဖိုင်ကို ဘယ်လိုရမလဲ?"]].forEach(function (p) {
    var b = el("button", null, esc(p[0]));
    b.addEventListener("click", function () { pushText(p[1]); });
    q.appendChild(b);
  });
  quick.appendChild(q);
}

function api(path, opts) {
  return fetch(W + path, opts).then(function (r) { return r.json(); });
}

function pushText(text) {
  text = (text || "").trim();
  if (!text) return;
  if (wantEmail) {
    wantEmail = false;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(text)) {
      say("o", "Gmail လိပ်စာ မှားနေပါတယ် — ဥပမာ name@gmail.com လို ပြန်ရိုက်ပေးပါ။");
      wantEmail = true;
      return;
    }
    say("v", text);
    api("/api/chat/email", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ visitor_id: vid, email: text })
    }).then(function (r) {
      if (!r || r.ok === false) throw new Error("email save failed");
      say("o", "✅ မှတ်ထားလိုက်ပါပြီ။");
      var po = pending; pending = null;
      if (po) {
        if (po.batch) {
          say("o", "💰 စုစုပေါင်း " + po.total + " ကျပ် (" + po.batch.length +
            " အုပ်) — ဒီပမာဏအတိုင်း ငွေလွှဲပြီး ပြေစာပုံကို 📷 ခလုတ်နဲ့ တင်ပေးပါ။");
          createOrders(po.batch);
        } else {
          say("o", '📧 "' + po.name + '" — ' + po.price +
            " ကျပ် လွှဲပြီးရင် ပြေစာပုံကို 📷 ခလုတ်နဲ့ တင်ပေးပါ။");
          createOrders([{ pid: po.pid, name: po.name }]);
        }
      } else {
        say("o", "မှာချင်တဲ့ စာအုပ်နာမည် ပြောပြပါ — ငွေချေပြီးရင် ပြေစာပုံကို 📷 ခလုတ်နဲ့ တင်ပေးပါ။");
      }
    }).catch(function () {
      var po = pending; pending = null;
      say("o", "⚠️ System limit လေးဖြစ်နေလို့ လတ်တလော Gmail နဲ့ မှာယူလို့ အဆင်မပြေပါဘူး 🙏\n" +
        "အောက်က ခလုတ်နှိပ်ပြီး Telegram ကနေ မှာယူလိုက်ပါ 👇");
      tgButton(po && po.pid);
    });
    return;
  }
  say("v", text);
  api("/api/chat/send", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ visitor_id: vid, text: text })
  }).catch(function () {});
}

function pushImage(file) {
  if (!file || !file.type.match(/^image\//)) return;
  var img = new Image();
  img.onload = function () {
    var k = Math.min(1, 1280 / Math.max(img.width, img.height));
    var c = document.createElement("canvas");
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    var durl = c.toDataURL("image/jpeg", 0.8);
    var b64 = durl.split(",")[1];
    URL.revokeObjectURL(img.src);
    sayImage("v", durl);
    var oids = orderIds.slice(); orderIds = [];
    api("/api/chat/send", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ visitor_id: vid, text: "", image_b64: b64,
        image_name: file.name, order_ids: oids })
    }).then(function (r) {
      say("o", r && r.ok
        ? "✅ ပြေစာပုံ ရရှိပါပြီ — စစ်ဆေးပြီးရင် ဖိုင်ပို့ပေးပါမယ်။"
        : "ပုံ ပို့ရာမှာ အမှားဖြစ်နေပါတယ် — ပြန်စမ်းကြည့်ပါ။");
    }).catch(function () {
      say("o", "ပုံ ပို့ရာမှာ အမှားဖြစ်နေပါတယ် — ပြန်စမ်းကြည့်ပါ။");
    });
  };
  img.src = URL.createObjectURL(file);
}

function createOrders(items) {
  var i = 0;
  (function next() {
    if (i >= items.length) return;
    var it = items[i++];
    api("/api/order", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ visitor_id: vid, pid: it.pid, set_name: it.name })
    }).then(function (r) {
      if (r && r.ok && r.order_id) orderIds.push(r.order_id);
      else say("o", "အော်ဒါတင်ရာမှာ အမှားဖြစ်နေပါတယ် — chat မှာ တိုက်ရိုက်ပြောပေးပါ။");
    }).catch(function () {
      say("o", "အော်ဒါတင်ရာမှာ အမှားဖြစ်နေပါတယ် — chat မှာ တိုက်ရိုက်ပြောပေးပါ။");
    }).then(next);
  })();
}

function poll() {
  api("/api/chat/poll?visitor_id=" + encodeURIComponent(vid) + "&since=" + lastTs)
    .then(function (r) {
      (r.messages || []).forEach(function (m) {
        if (m.ts > lastTs) lastTs = m.ts;
        if (m.from === "v") return;
        if (m.img_data) sayImage(m.from, m.img_data);
        else say(m.from, m.text || "");
        if (!panel.classList.contains("open")) dot.classList.add("on");
      });
    }).catch(function () {});
}

function open() {
  build(); panel.classList.add("open"); dot.classList.remove("on");
  greet(); poll();
  if (!timer) timer = setInterval(poll, 3000);
}
function close() { if (panel) panel.classList.remove("open"); }
function toggle() {
  build();
  panel.classList.contains("open") ? close() : open();
}

function build() {
  if (fab) return;
  fab = el("button", "cfab", "💬");
  fab.setAttribute("aria-label", "အကူအညီ chat");
  dot = el("span", "cdot"); fab.appendChild(dot);
  panel = el("div", "cpanel");
  var head = el("div", "chead", "<b>စာအုပ်စင် · အကူအညီ</b>");
  var x = el("button", "x", "✕");
  x.setAttribute("aria-label", "ပိတ်ရန်");
  x.addEventListener("click", close);
  head.appendChild(x);
  msgs = el("div", "cmsgs"); quick = el("div");
  form = el("form", "cform");
  input = el("input"); input.placeholder = "စာရိုက်ပါ…"; input.setAttribute("aria-label", "စာရိုက်ရန်");
  fileInput = el("input"); fileInput.type = "file"; fileInput.accept = "image/*";
  fileInput.style.display = "none";
  fileBtn = el("button", "att", "📷");
  fileBtn.type = "button"; fileBtn.setAttribute("aria-label", "ပုံတင်ရန်");
  fileBtn.addEventListener("click", function () { fileInput.click(); });
  fileInput.addEventListener("change", function () {
    if (fileInput.files[0]) pushImage(fileInput.files[0]);
    fileInput.value = "";
  });
  var send = el("button", "send", "➤");
  send.type = "submit"; send.setAttribute("aria-label", "ပို့ရန်");
  form.appendChild(fileBtn); form.appendChild(input); form.appendChild(send);
  form.addEventListener("submit", function (e) {
    e.preventDefault(); pushText(input.value); input.value = "";
  });
  panel.appendChild(head); panel.appendChild(msgs); panel.appendChild(quick);
  panel.appendChild(fileInput); panel.appendChild(form);
  document.body.appendChild(panel); document.body.appendChild(fab);
  fab.addEventListener("click", toggle);
  setInterval(function () { if (!panel.classList.contains("open")) poll(); }, 15000);
}

function askEmailFor(po, intro) {
  open();
  say("o", intro);
  wantEmail = true;
  pending = po;
}

window.SSChat = {
  open: open, close: close, toggle: toggle,
  orderOne: function (pid, name) {
    askEmailFor({ pid: pid, name: name, price: (SS.PRICE || 3000).toLocaleString() },
      '📧 "' + name + '" ကို Gmail / Drive နဲ့ မှာမယ်ဆိုရင် — ဖိုင်ပို့ပေးရမယ့် Gmail လိပ်စာကို ရိုက်ပေးပါ။');
  },
  orderBatch: function (batch) {
    var total = batch.reduce(function (s) { return s + (SS.PRICE || 3000); }, 0);
    var names = batch.map(function (it) { return it.name; }).join(", ");
    askEmailFor({ batch: batch, total: total.toLocaleString() },
      "📧 ရွေးထားတဲ့ " + batch.length + " အုပ် (" + names +
      ") ကို Gmail / Drive နဲ့ မှာမယ်ဆိုရင် — ဖိုင်ပို့ပေးရမယ့် Gmail လိပ်စာကို ရိုက်ပေးပါ။");
  }
};
if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", build);
else build();
})();
