// AIDAIS Chrome Extension — Content Script
// Injects the AI sidebar into YouTube pages and handles Web Speech API transcription

(function () {
  "use strict";

  const SIDEBAR_ID = "aidais-sidebar-root";
  let sidebarElement = null;
  let recognition = null;
  let personas = {};

  // Persona config
  const PERSONA_CONFIG = {
    "fact-checker": { name: "Baba Booey", role: "Fact Checker", color: "#3B82F6", initials: "BB" },
    "cynical-troll": { name: "The Troll", role: "Cynical Troll", color: "#EF4444", initials: "TT" },
    "chaos-agent": { name: "Chaos", role: "Chaos Agent", color: "#A855F7", initials: "CA" },
    "joke-writer": { name: "Jackie", role: "Joke Writer", color: "#F59E0B", initials: "JM" },
  };

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message) => {
    switch (message.type) {
      case "SHOW_SIDEBAR":
        createSidebar();
        startTranscription();
        break;
      case "HIDE_SIDEBAR":
        removeSidebar();
        stopTranscription();
        break;
      case "SERVER_MESSAGE":
        handleServerMessage(message.data);
        break;
    }
  });

  function createSidebar() {
    if (document.getElementById(SIDEBAR_ID)) return;

    sidebarElement = document.createElement("div");
    sidebarElement.id = SIDEBAR_ID;

    const shadow = sidebarElement.attachShadow({ mode: "closed" });

    const style = document.createElement("style");
    style.textContent = getSidebarCSS();
    shadow.appendChild(style);

    const container = document.createElement("div");
    container.className = "aidais-container";
    container.innerHTML = `
      <div class="aidais-header">
        <span class="aidais-logo"><span style="color:#3B82F6">AI</span>DAIS</span>
        <button class="aidais-close" id="aidais-close">&times;</button>
      </div>
      <div class="aidais-personas" id="aidais-personas">
        ${Object.entries(PERSONA_CONFIG)
          .map(
            ([id, p]) => `
          <div class="aidais-persona" id="persona-${id}" data-persona="${id}">
            <div class="aidais-persona-header">
              <div class="aidais-avatar" style="background:${p.color}">${p.initials}</div>
              <div class="aidais-persona-info">
                <div class="aidais-persona-name">${p.name}</div>
                <div class="aidais-persona-role">${p.role}</div>
              </div>
              <div class="aidais-dot" id="dot-${id}"></div>
            </div>
            <div class="aidais-messages" id="messages-${id}">
              <div class="aidais-empty">Waiting...</div>
            </div>
          </div>
        `
          )
          .join("")}
      </div>
    `;

    shadow.appendChild(container);

    // Close button
    shadow.getElementById("aidais-close").addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "STOP_CAPTURE" });
    });

    document.body.appendChild(sidebarElement);

    // Shrink YouTube player to make room
    const ytdApp = document.querySelector("ytd-app");
    if (ytdApp) {
      ytdApp.style.marginRight = "340px";
      ytdApp.style.transition = "margin-right 0.3s ease";
    }
  }

  function removeSidebar() {
    const el = document.getElementById(SIDEBAR_ID);
    if (el) el.remove();
    sidebarElement = null;
    personas = {};

    const ytdApp = document.querySelector("ytd-app");
    if (ytdApp) {
      ytdApp.style.marginRight = "";
    }
  }

  function startTranscription() {
    const SpeechRecognitionCtor =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;

    recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0]?.transcript;
        if (transcript) {
          chrome.runtime.sendMessage({
            type: "TRANSCRIPT",
            text: transcript,
            isFinal: result.isFinal,
          });
        }
      }
    };

    recognition.onend = () => {
      // Auto-restart if sidebar is still visible
      if (document.getElementById(SIDEBAR_ID)) {
        try { recognition.start(); } catch { /* already started */ }
      }
    };

    recognition.onerror = () => {};

    try { recognition.start(); } catch { /* already started */ }
  }

  function stopTranscription() {
    if (recognition) {
      try { recognition.stop(); } catch { /* already stopped */ }
      recognition = null;
    }
  }

  function handleServerMessage(data) {
    if (!sidebarElement) return;
    const shadow = sidebarElement.shadowRoot;
    if (!shadow) return;

    if (data.type === "agent_response" && data.persona) {
      const messagesEl = shadow.getElementById(`messages-${data.persona}`);
      const dotEl = shadow.getElementById(`dot-${data.persona}`);
      if (!messagesEl) return;

      // Track streaming state
      if (!personas[data.persona]) {
        personas[data.persona] = { currentId: null };
      }

      const state = personas[data.persona];

      if (data.messageId !== state.currentId) {
        // New message — clear empty state and create element
        state.currentId = data.messageId;
        const emptyEl = messagesEl.querySelector(".aidais-empty");
        if (emptyEl) emptyEl.remove();

        const msgEl = document.createElement("div");
        msgEl.className = "aidais-msg aidais-streaming";
        msgEl.id = `msg-${data.messageId}`;
        msgEl.textContent = data.text;
        messagesEl.appendChild(msgEl);
        messagesEl.scrollTop = messagesEl.scrollHeight;
      } else {
        // Update existing streaming message
        const msgEl = shadow.getElementById(`msg-${data.messageId}`);
        if (msgEl) {
          msgEl.textContent = data.text;
          messagesEl.scrollTop = messagesEl.scrollHeight;
        }
      }

      if (dotEl) {
        dotEl.classList.toggle("active", !data.isComplete);
      }

      if (data.isComplete) {
        const msgEl = shadow.getElementById(`msg-${data.messageId}`);
        if (msgEl) {
          msgEl.classList.remove("aidais-streaming");
          // Remove [PASS] messages
          if (data.text.trim() === "[PASS]" || data.text.trim() === "PASS") {
            msgEl.remove();
          }
        }
        state.currentId = null;

        // Keep only last 5 messages
        const msgs = messagesEl.querySelectorAll(".aidais-msg");
        while (msgs.length > 5) {
          msgs[0].remove();
        }
      }
    }
  }

  function getSidebarCSS() {
    return `
      :host {
        all: initial;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }
      .aidais-container {
        position: fixed;
        top: 0;
        right: 0;
        width: 330px;
        height: 100vh;
        background: #0f172a;
        border-left: 1px solid #1e293b;
        display: flex;
        flex-direction: column;
        z-index: 2147483647;
        color: #e2e8f0;
        font-size: 13px;
        overflow: hidden;
      }
      .aidais-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        border-bottom: 1px solid #1e293b;
      }
      .aidais-logo {
        font-weight: 700;
        font-size: 16px;
        color: #fff;
      }
      .aidais-close {
        background: none;
        border: none;
        color: #94a3b8;
        font-size: 20px;
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 4px;
      }
      .aidais-close:hover { background: #1e293b; color: #fff; }
      .aidais-personas {
        flex: 1;
        overflow-y: auto;
        padding: 8px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .aidais-persona {
        border: 1px solid #1e293b;
        border-radius: 10px;
        padding: 10px;
        background: rgba(15,23,42,0.8);
      }
      .aidais-persona-header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 8px;
      }
      .aidais-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        font-size: 12px;
        color: #fff;
        flex-shrink: 0;
      }
      .aidais-persona-info { flex: 1; }
      .aidais-persona-name { font-weight: 600; font-size: 13px; color: #fff; }
      .aidais-persona-role { font-size: 11px; color: #64748b; }
      .aidais-dot {
        width: 8px; height: 8px; border-radius: 50%;
        background: transparent; transition: background 0.3s;
      }
      .aidais-dot.active { background: #22c55e; animation: pulse 1s infinite; }
      @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
      .aidais-messages {
        max-height: 120px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .aidais-msg {
        background: #1e293b;
        border-radius: 6px;
        padding: 6px 10px;
        font-size: 12px;
        line-height: 1.4;
        color: #cbd5e1;
      }
      .aidais-streaming::after {
        content: "▊";
        animation: blink 0.8s infinite;
        opacity: 0.7;
      }
      @keyframes blink { 0%,50% { opacity:1; } 51%,100% { opacity:0; } }
      .aidais-empty {
        text-align: center;
        color: #475569;
        font-size: 11px;
        padding: 8px;
      }
      .aidais-messages::-webkit-scrollbar { width: 4px; }
      .aidais-messages::-webkit-scrollbar-thumb { background: #334155; border-radius: 2px; }
      .aidais-personas::-webkit-scrollbar { width: 4px; }
      .aidais-personas::-webkit-scrollbar-thumb { background: #334155; border-radius: 2px; }
    `;
  }
})();
