/**
 * Serves the embeddable widget JavaScript bundle.
 * Include via: <script src="https://beurseason.com/api/widget/widget.js" async></script>
 *
 * The widget creates a floating chat bubble that communicates with /api/chatbot.
 * It is self-contained — no external dependencies.
 */

import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.searchParams.get("origin")
    ?? req.headers.get("referer")?.split("/").slice(0, 3).join("/")
    ?? "https://beurseason.com";

  const apiBase = new URL(req.url).origin;

  const js = `
(function () {
  'use strict';

  var API_BASE   = '${apiBase}';
  var RTL_LOCALE = 'fa';
  var SESSION_KEY = 'beur_widget_session';

  function uid() {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  var sessionId = sessionStorage.getItem(SESSION_KEY) || uid();
  sessionStorage.setItem(SESSION_KEY, sessionId);

  /* ── Styles ── */
  var CSS = \`
    #beur-widget-btn {
      position: fixed; bottom: 24px; right: 24px; z-index: 99999;
      width: 56px; height: 56px; border-radius: 50%;
      background: #000; border: 1.5px solid rgba(194,168,110,.4);
      color: #c9a96e; cursor: pointer; display: flex;
      align-items: center; justify-content: center;
      box-shadow: 0 8px 32px rgba(0,0,0,.35);
      transition: transform .2s, background .2s;
    }
    #beur-widget-btn:hover { transform: scale(1.07); background: #1a1a1a; }
    #beur-widget-panel {
      position: fixed; bottom: 92px; right: 16px; z-index: 99998;
      width: min(360px, calc(100vw - 32px));
      height: min(520px, calc(100dvh - 120px));
      background: #0d0d0d; border-radius: 20px;
      border: 1px solid rgba(255,255,255,.08);
      box-shadow: 0 24px 64px rgba(0,0,0,.6);
      display: flex; flex-direction: column; overflow: hidden;
      font-family: Vazirmatn, Tahoma, sans-serif;
      direction: rtl; font-size: 14px;
    }
    .beur-header {
      display: flex; align-items: center; gap: 10px;
      padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,.07);
      background: #0a0a0a;
    }
    .beur-avatar {
      width: 36px; height: 36px; border-radius: 50%;
      background: rgba(201,169,110,.12); border: 1px solid rgba(201,169,110,.3);
      display: flex; align-items: center; justify-content: center;
      color: #c9a96e; flex-shrink: 0;
    }
    .beur-header-text { flex: 1; }
    .beur-header-title { font-weight: 600; color: #e0cca7; font-size: 13px; }
    .beur-header-sub { font-size: 10px; color: rgba(201,169,110,.7); }
    .beur-dot {
      width: 8px; height: 8px; border-radius: 50%; background: #4ade80;
      animation: beur-pulse 2s infinite;
    }
    @keyframes beur-pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
    .beur-messages {
      flex: 1; overflow-y: auto; padding: 16px; display: flex;
      flex-direction: column; gap: 10px;
    }
    .beur-messages::-webkit-scrollbar { width: 4px; }
    .beur-messages::-webkit-scrollbar-thumb { background: rgba(255,255,255,.1); border-radius: 4px; }
    .beur-row-user { display: flex; justify-content: flex-start; }
    .beur-row-bot  { display: flex; justify-content: flex-end;   }
    .beur-bubble {
      max-width: 80%; border-radius: 16px; padding: 10px 14px;
      font-size: 13px; line-height: 1.55; white-space: pre-wrap; word-break: break-word;
    }
    .beur-bubble-user { background: rgba(201,169,110,.9); color: #0d0d0d; font-weight: 500; border-bottom-right-radius: 4px; }
    .beur-bubble-bot  { background: rgba(255,255,255,.07); color: rgba(224,204,167,.9); border-bottom-left-radius: 4px; }
    .beur-typing { display: flex; gap: 4px; padding: 12px 14px; background: rgba(255,255,255,.07); border-radius: 16px; border-bottom-left-radius: 4px; }
    .beur-dot-anim { width: 6px; height: 6px; border-radius: 50%; background: rgba(201,169,110,.5); animation: beur-bounce .9s ease-in-out infinite; }
    .beur-dot-anim:nth-child(2) { animation-delay: .15s; }
    .beur-dot-anim:nth-child(3) { animation-delay: .3s; }
    @keyframes beur-bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }
    .beur-feedback { display: flex; gap: 6px; margin-top: 4px; }
    .beur-fb-btn {
      background: none; border: none; cursor: pointer;
      font-size: 14px; opacity: .4; transition: opacity .15s;
      padding: 0; line-height: 1;
    }
    .beur-fb-btn:hover { opacity: 1; }
    .beur-input-area {
      padding: 10px 12px; border-top: 1px solid rgba(255,255,255,.07);
    }
    .beur-input-row { display: flex; gap: 8px; }
    .beur-input {
      flex: 1; background: rgba(255,255,255,.07); border: 1px solid transparent;
      border-radius: 12px; padding: 9px 13px; color: #e0cca7; font-size: 13px;
      font-family: inherit; outline: none; direction: rtl;
      transition: border-color .2s;
    }
    .beur-input:focus { border-color: rgba(201,169,110,.4); }
    .beur-input::placeholder { color: rgba(224,204,167,.3); }
    .beur-send {
      width: 36px; height: 36px; border-radius: 10px; background: #c9a96e;
      border: none; cursor: pointer; color: #0d0d0d; display: flex;
      align-items: center; justify-content: center; flex-shrink: 0;
      transition: background .15s; transform: scaleX(-1);
    }
    .beur-send:hover { background: #e0cca7; }
    .beur-send:disabled { opacity: .4; cursor: default; }
    .beur-powered { text-align: center; font-size: 10px; color: rgba(255,255,255,.2); padding: 4px 0; }
    @media (max-width: 400px) {
      #beur-widget-panel { right: 8px; left: 8px; width: auto; }
    }
  \`;

  function injectCSS(css) {
    var el = document.createElement('style');
    el.textContent = css;
    document.head.appendChild(el);
  }

  function svgIcon() {
    return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 10h.01M12 10h.01M16 10h.01" stroke-linecap="round"/></svg>';
  }

  function closeIcon() {
    return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>';
  }

  function sendIcon() {
    return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>';
  }

  /* ── DOM ── */
  var isOpen = false;
  var isLoading = false;
  var messages = [];

  function createWidget() {
    injectCSS(CSS);

    // Toggle button
    var btn = document.createElement('button');
    btn.id = 'beur-widget-btn';
    btn.setAttribute('aria-label', 'باز کردن چت');
    btn.innerHTML = svgIcon();
    btn.onclick = togglePanel;
    document.body.appendChild(btn);

    // Panel
    var panel = document.createElement('div');
    panel.id = 'beur-widget-panel';
    panel.style.display = 'none';
    panel.innerHTML = \`
      <div class="beur-header">
        <div class="beur-avatar">\${svgIcon()}</div>
        <div class="beur-header-text">
          <div class="beur-header-title">BEUR SEASON</div>
          <div class="beur-header-sub">دستیار هوشمند زیبایی</div>
        </div>
        <div class="beur-dot"></div>
      </div>
      <div class="beur-messages" id="beur-msg-list"></div>
      <div class="beur-input-area">
        <div class="beur-input-row">
          <input class="beur-input" id="beur-input" placeholder="پیام خود را بنویسید..." dir="rtl" />
          <button class="beur-send" id="beur-send-btn" disabled>\${sendIcon()}</button>
        </div>
        <div class="beur-powered">BEUR SEASON AI</div>
      </div>
    \`;
    document.body.appendChild(panel);

    var msgList = document.getElementById('beur-msg-list');
    var input   = document.getElementById('beur-input');
    var sendBtn = document.getElementById('beur-send-btn');

    input.oninput = function () {
      sendBtn.disabled = !input.value.trim() || isLoading;
    };
    input.onkeydown = function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    };
    sendBtn.onclick = send;

    // Welcome message
    addMessage('bot', 'سلام! 🌸 به BEUR SEASON خوش آمدید.\\n\\nمی‌توانم در زمینه تحلیل رنگ، رزرو مشاوره و قیمت خدمات کمک کنم. چه سوالی دارید؟');

    function send() {
      var text = input.value.trim();
      if (!text || isLoading) return;
      input.value = '';
      sendBtn.disabled = true;
      addMessage('user', text);
      setLoading(true);
      streamChat(text);
    }

    function addMessage(role, content, id) {
      var row = document.createElement('div');
      row.className = role === 'user' ? 'beur-row-user' : 'beur-row-bot';
      var bubble = document.createElement('div');
      bubble.className = 'beur-bubble ' + (role === 'user' ? 'beur-bubble-user' : 'beur-bubble-bot');
      bubble.textContent = content;
      if (id) bubble.dataset.msgId = id;
      row.appendChild(bubble);
      if (role === 'bot' && id) {
        var fb = document.createElement('div');
        fb.className = 'beur-feedback';
        fb.innerHTML = '<button class="beur-fb-btn" data-rating="1" title="مفید بود">👍</button><button class="beur-fb-btn" data-rating="-1" title="مفید نبود">👎</button>';
        fb.querySelectorAll('.beur-fb-btn').forEach(function(b) {
          b.onclick = function() { sendFeedback(id, Number(b.dataset.rating)); b.style.opacity='1'; };
        });
        row.appendChild(fb);
      }
      msgList.appendChild(row);
      messages.push({ role: role, content: content });
      scrollBottom();
      return bubble;
    }

    var typingEl = null;
    function setLoading(on) {
      isLoading = on;
      if (on && !typingEl) {
        var row = document.createElement('div');
        row.className = 'beur-row-bot';
        typingEl = document.createElement('div');
        typingEl.className = 'beur-typing';
        typingEl.innerHTML = '<span class="beur-dot-anim"></span><span class="beur-dot-anim"></span><span class="beur-dot-anim"></span>';
        row.appendChild(typingEl);
        msgList.appendChild(row);
        scrollBottom();
      } else if (!on && typingEl) {
        if (typingEl.parentNode) typingEl.parentNode.parentNode && msgList.removeChild(typingEl.parentNode);
        typingEl = null;
        sendBtn.disabled = !input.value.trim();
      }
    }

    function scrollBottom() {
      setTimeout(function() { msgList.scrollTop = msgList.scrollHeight; }, 30);
    }

    function streamChat(text) {
      var bubble = null;
      var fullText = '';

      fetch(API_BASE + '/api/chatbot/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId: sessionId, locale: RTL_LOCALE, surface: 'widget' }),
      }).then(function(res) {
        if (!res.ok || !res.body) throw new Error('stream failed');
        var reader = res.body.getReader();
        var decoder = new TextDecoder();

        function read() {
          return reader.read().then(function(result) {
            if (result.done) {
              setLoading(false);
              return;
            }
            var chunk = decoder.decode(result.value, { stream: true });
            var lines = chunk.split('\\n');
            lines.forEach(function(line) {
              if (!line.startsWith('data: ')) return;
              var payload = line.slice(6).trim();
              if (payload === '[DONE]') return;
              try {
                var data = JSON.parse(payload);
                if (data.content) {
                  fullText += data.content;
                  if (!bubble) {
                    setLoading(false);
                    var row = document.createElement('div');
                    row.className = 'beur-row-bot';
                    bubble = document.createElement('div');
                    bubble.className = 'beur-bubble beur-bubble-bot';
                    row.appendChild(bubble);
                    msgList.appendChild(row);
                  }
                  bubble.textContent = fullText;
                  scrollBottom();
                }
              } catch(e) {}
            });
            return read();
          });
        }

        return read();
      }).catch(function(err) {
        console.error('[beur-widget] stream error:', err);
        setLoading(false);
        addMessage('bot', 'متأسفم، مشکلی پیش آمد. دوباره تلاش کنید.');
      });
    }

    function sendFeedback(messageId, rating) {
      fetch(API_BASE + '/api/admin/chatbot/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message_id: messageId, rating: rating }),
      }).catch(function() {});
    }
  }

  function togglePanel() {
    var panel = document.getElementById('beur-widget-panel');
    var btn   = document.getElementById('beur-widget-btn');
    isOpen = !isOpen;
    panel.style.display = isOpen ? 'flex' : 'none';
    btn.innerHTML = isOpen ? closeIcon() : svgIcon();
    if (isOpen) {
      var input = document.getElementById('beur-input');
      if (input) setTimeout(function() { input.focus(); }, 100);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createWidget);
  } else {
    createWidget();
  }
})();
`;

  return new NextResponse(js, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
