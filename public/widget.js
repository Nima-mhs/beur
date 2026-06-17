/* BEUR SEASON Chat Widget — embed with:
   <script src="https://YOUR_DOMAIN/widget.js"
           data-api="https://YOUR_DOMAIN"
           data-locale="fa"
           data-color="#b29560"></script>
*/
(function () {
  "use strict";

  if (window.__beurWidgetLoaded) return;
  window.__beurWidgetLoaded = true;

  /* ── Config ── */
  var s =
    document.currentScript ||
    document.querySelector("script[src*='widget.js']");

  var API_BASE   = (s && s.getAttribute("data-api"))    || "";
  var PRIMARY    = (s && s.getAttribute("data-color"))  || "#b29560";
  var LOCALE     = (s && s.getAttribute("data-locale")) || "fa";
  var IS_RTL     = LOCALE === "fa";
  var SIDE       = IS_RTL ? "left" : "right";

  var SESSION_ID =
    "widget_" + Math.random().toString(36).slice(2) + Date.now();
  var history    = [];
  var isOpen     = false;
  var isLoading  = false;

  /* ── Styles ── */
  var css = [
    "#bw-btn{position:fixed;bottom:24px;" + SIDE + ":24px;z-index:2147483647;",
    "width:56px;height:56px;border-radius:50%;background:" + PRIMARY + ";",
    "border:none;cursor:pointer;box-shadow:0 4px 24px rgba(0,0,0,.35);",
    "display:flex;align-items:center;justify-content:center;",
    "transition:transform .2s,opacity .2s;outline:none;}",
    "#bw-btn:hover{transform:scale(1.1);}",

    "#bw-panel{position:fixed;bottom:92px;" + SIDE + ":24px;z-index:2147483646;",
    "width:340px;max-height:520px;",
    "background:#111;border:1px solid rgba(178,149,96,.3);border-radius:16px;",
    "display:none;flex-direction:column;overflow:hidden;",
    "box-shadow:0 12px 48px rgba(0,0,0,.6);",
    "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;}",
    "#bw-panel.bw-open{display:flex;}",

    "#bw-head{background:#000;padding:12px 16px;display:flex;align-items:center;gap:10px;",
    "border-bottom:1px solid rgba(178,149,96,.2);}",
    "#bw-head .bw-avatar{width:34px;height:34px;border-radius:50%;",
    "background:rgba(178,149,96,.12);border:1px solid rgba(178,149,96,.3);",
    "display:flex;align-items:center;justify-content:center;flex-shrink:0;}",
    "#bw-head .bw-info{flex:1;}",
    "#bw-head .bw-name{color:" + PRIMARY + ";font-weight:700;font-size:14px;line-height:1.2;}",
    "#bw-head .bw-sub{color:rgba(200,200,200,.5);font-size:11px;}",
    "#bw-head .bw-dot{width:8px;height:8px;border-radius:50%;background:#4ade80;",
    "animation:bwPulse 2s infinite;flex-shrink:0;}",
    "#bw-close{background:none;border:none;color:rgba(200,200,200,.4);",
    "font-size:18px;cursor:pointer;padding:4px;line-height:1;flex-shrink:0;}",
    "#bw-close:hover{color:rgba(200,200,200,.8);}",

    "#bw-msgs{flex:1;overflow-y:auto;padding:12px;",
    "display:flex;flex-direction:column;gap:8px;direction:" + (IS_RTL ? "rtl" : "ltr") + ";}",
    "#bw-msgs::-webkit-scrollbar{width:4px;}",
    "#bw-msgs::-webkit-scrollbar-thumb{background:rgba(178,149,96,.2);border-radius:2px;}",

    ".bw-row{display:flex;align-items:flex-end;gap:6px;}",
    ".bw-row.bw-user{flex-direction:" + (IS_RTL ? "row" : "row-reverse") + ";}",
    ".bw-bubble{max-width:78%;padding:9px 13px;border-radius:16px;",
    "font-size:13px;line-height:1.55;word-break:break-word;white-space:pre-wrap;}",
    ".bw-bot-bubble{background:rgba(255,255,255,.07);color:#e2e2e2;",
    "border:1px solid rgba(178,149,96,.1);}",
    ".bw-user-bubble{background:" + PRIMARY + ";color:#000;font-weight:500;}",
    ".bw-small-av{width:24px;height:24px;border-radius:50%;flex-shrink:0;",
    "background:rgba(178,149,96,.12);border:1px solid rgba(178,149,96,.25);",
    "display:flex;align-items:center;justify-content:center;}",

    ".bw-dots{display:flex;gap:4px;padding:3px 0;}",
    ".bw-dot-a{width:6px;height:6px;border-radius:50%;",
    "background:" + PRIMARY + ";opacity:.6;animation:bwBounce .8s infinite;}",
    ".bw-dot-a:nth-child(2){animation-delay:.15s;}",
    ".bw-dot-a:nth-child(3){animation-delay:.3s;}",

    "#bw-foot{padding:10px;border-top:1px solid rgba(178,149,96,.15);display:flex;gap:6px;}",
    "#bw-input{flex:1;background:rgba(255,255,255,.07);",
    "border:1px solid rgba(178,149,96,.2);border-radius:10px;",
    "padding:9px 12px;color:#e8e8e8;font-size:13px;",
    "direction:" + (IS_RTL ? "rtl" : "ltr") + ";outline:none;",
    "font-family:inherit;}",
    "#bw-input::placeholder{color:rgba(200,200,200,.35);}",
    "#bw-input:focus{border-color:" + PRIMARY + ";}",
    "#bw-send{background:" + PRIMARY + ";color:#000;border:none;border-radius:10px;",
    "padding:9px 14px;font-size:13px;font-weight:700;cursor:pointer;",
    "white-space:nowrap;font-family:inherit;}",
    "#bw-send:disabled{opacity:.35;cursor:not-allowed;}",

    "@keyframes bwBounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}}",
    "@keyframes bwPulse{0%,100%{opacity:1}50%{opacity:.4}}",
  ].join("");

  var styleEl = document.createElement("style");
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  /* ── SVG helpers ── */
  var CHAT_ICON =
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 10h.01M12 10h.01M16 10h.01"/></svg>';
  var CLOSE_ICON =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.5" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>';
  var BOT_ICON =
    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="' + PRIMARY + '" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2"/></svg>';

  /* ── DOM ── */
  var btn = document.createElement("button");
  btn.id = "bw-btn";
  btn.setAttribute("aria-label", IS_RTL ? "گفتگو با دستیار" : "Chat with assistant");
  btn.innerHTML = CHAT_ICON;

  var panel = document.createElement("div");
  panel.id = "bw-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "BEUR SEASON Chat");
  panel.innerHTML =
    '<div id="bw-head">' +
    '  <div class="bw-avatar">' + BOT_ICON + "</div>" +
    '  <div class="bw-info">' +
    '    <div class="bw-name">BEUR SEASON</div>' +
    '    <div class="bw-sub">' + (IS_RTL ? "دستیار هوشمند" : "AI Assistant") + "</div>" +
    "  </div>" +
    '  <div class="bw-dot"></div>' +
    '  <button id="bw-close" aria-label="Close">✕</button>' +
    "</div>" +
    '<div id="bw-msgs"></div>' +
    '<div id="bw-foot">' +
    '  <input id="bw-input" type="text" placeholder="' +
    (IS_RTL ? "پیام بنویسید..." : "Type a message...") +
    '" autocomplete="off" />' +
    '  <button id="bw-send">' + (IS_RTL ? "ارسال" : "Send") + "</button>" +
    "</div>";

  document.body.appendChild(btn);
  document.body.appendChild(panel);

  var msgsEl  = document.getElementById("bw-msgs");
  var inputEl = document.getElementById("bw-input");
  var sendBtn = document.getElementById("bw-send");
  var closeEl = document.getElementById("bw-close");

  /* ── Rendering ── */
  function scrollBottom() {
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }

  function renderBubble(role, text) {
    var row = document.createElement("div");
    row.className = "bw-row" + (role === "user" ? " bw-user" : "");

    if (role === "assistant") {
      var av = document.createElement("div");
      av.className = "bw-small-av";
      av.innerHTML = BOT_ICON;
      row.appendChild(av);
    }

    var bubble = document.createElement("div");
    bubble.className =
      "bw-bubble " + (role === "user" ? "bw-user-bubble" : "bw-bot-bubble");
    bubble.dir = "auto";
    bubble.textContent = text;
    row.appendChild(bubble);

    msgsEl.appendChild(row);
    history.push({ role: role, content: text });
    scrollBottom();
  }

  var loadingRow = null;
  function showLoading() {
    loadingRow = document.createElement("div");
    loadingRow.className = "bw-row";
    var av = document.createElement("div");
    av.className = "bw-small-av";
    av.innerHTML = BOT_ICON;
    var bubble = document.createElement("div");
    bubble.className = "bw-bubble bw-bot-bubble";
    bubble.innerHTML =
      '<div class="bw-dots">' +
      '<div class="bw-dot-a"></div><div class="bw-dot-a"></div><div class="bw-dot-a"></div>' +
      "</div>";
    loadingRow.appendChild(av);
    loadingRow.appendChild(bubble);
    msgsEl.appendChild(loadingRow);
    scrollBottom();
  }

  function hideLoading() {
    if (loadingRow) {
      loadingRow.remove();
      loadingRow = null;
    }
  }

  /* ── Send ── */
  async function doSend() {
    var text = inputEl.value.trim();
    if (!text || isLoading) return;
    inputEl.value = "";
    isLoading = true;
    sendBtn.disabled = true;

    renderBubble("user", text);
    showLoading();

    try {
      var res = await fetch(API_BASE + "/api/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          sessionId: SESSION_ID,
          locale: LOCALE,
        }),
      });
      var data = await res.json();
      hideLoading();
      renderBubble(
        "assistant",
        data.reply ||
          (IS_RTL ? "خطا در دریافت پاسخ." : "Error receiving response.")
      );
    } catch {
      hideLoading();
      renderBubble(
        "assistant",
        IS_RTL
          ? "خطای اتصال. لطفاً دوباره تلاش کنید."
          : "Connection error. Please try again."
      );
    } finally {
      isLoading = false;
      sendBtn.disabled = false;
      inputEl.focus();
    }
  }

  /* ── Toggle ── */
  function openPanel() {
    isOpen = true;
    panel.classList.add("bw-open");
    btn.innerHTML = CLOSE_ICON;
    if (history.length === 0) {
      renderBubble(
        "assistant",
        IS_RTL
          ? "سلام! دستیار BEUR SEASON هستم 🌸 چطور می‌توانم کمک کنم؟"
          : "Hello! I'm BEUR SEASON's assistant 🌸 How can I help?"
      );
    }
    setTimeout(function () { inputEl.focus(); }, 120);
  }

  function closePanel() {
    isOpen = false;
    panel.classList.remove("bw-open");
    btn.innerHTML = CHAT_ICON;
  }

  /* ── Events ── */
  btn.addEventListener("click", function () {
    isOpen ? closePanel() : openPanel();
  });
  closeEl.addEventListener("click", function (e) {
    e.stopPropagation();
    closePanel();
  });
  sendBtn.addEventListener("click", doSend);
  inputEl.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      doSend();
    }
  });
})();
