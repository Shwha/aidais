// AIDAIS Chrome Extension — Content Script
// Injects collapsible AI sidebar into YouTube pages with integrated controls

(function () {
  "use strict";

  const SIDEBAR_ID = "aidais-sidebar-root";
  let sidebarElement = null;
  let sidebarShadow = null;
  let recognition = null;
  let personas = {};
  let isCollapsed = false;
  let isCapturing = false;
  let chaosMode = "chaos"; // "chaos" | "fred-norris"
  let isPaused = false;

  const PERSONA_CONFIG = {
    "fact-checker": {
      name: "Baba Booey",
      role: "Fact Checker",
      color: "#3B82F6",
      initials: "BB",
    },
    "cynical-troll": {
      name: "The Troll",
      role: "Cynical Troll",
      color: "#EF4444",
      initials: "TT",
    },
    "chaos-agent": {
      name: "Chaos",
      role: "Chaos Agent",
      color: "#A855F7",
      initials: "CA",
    },
    "joke-writer": {
      name: "Not Jackie",
      role: "Joke Writer",
      color: "#F59E0B",
      initials: "JM",
    },
  };

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message) => {
    switch (message.type) {
      case "SHOW_SIDEBAR":
        createSidebar();
        break;
      case "HIDE_SIDEBAR":
        removeSidebar();
        stopTranscription();
        break;
      case "START_MIC_FALLBACK":
        // Only used if tab audio capture completely fails
        startTranscription();
        updateStatus("mic", "Mic fallback — tab capture unavailable");
        break;
      case "CAPTURE_STOPPED":
        isCapturing = false;
        stopTranscription();
        updateStatus("disconnected", "Disconnected");
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
    sidebarShadow = shadow;

    const style = document.createElement("style");
    style.textContent = getSidebarCSS();
    shadow.appendChild(style);

    // Collapse toggle tab
    const toggleTab = document.createElement("button");
    toggleTab.className = "aidais-toggle-tab";
    toggleTab.id = "aidais-toggle";
    toggleTab.innerHTML = `<span style="color:#3B82F6">A</span><span>I</span>`;
    shadow.appendChild(toggleTab);

    const container = document.createElement("div");
    container.className = "aidais-container";
    container.id = "aidais-container";
    container.innerHTML = `
      <div class="aidais-header">
        <span class="aidais-logo"><span style="color:#3B82F6">AI</span>DAIS</span>
        <div class="aidais-header-actions">
          <button class="aidais-play-pause" id="aidais-play-pause" title="Pause agents">&#10074;&#10074;</button>
          <button class="aidais-hide-btn" id="aidais-hide">Hide</button>
        </div>
      </div>

      <div class="aidais-status" id="aidais-status">
        <div class="aidais-status-dot disconnected" id="aidais-status-dot"></div>
        <span id="aidais-status-text">Connecting...</span>
      </div>

      <div class="aidais-personas" id="aidais-personas">
        ${Object.entries(PERSONA_CONFIG)
          .map(
            ([id, p]) => `
          <div class="aidais-persona" id="persona-${id}" data-persona="${id}">
            <div class="aidais-persona-header">
              <div class="aidais-avatar" style="background:${p.color}">${p.initials}</div>
              <div class="aidais-persona-info">
                <div class="aidais-persona-name" id="name-${id}">${p.name}</div>
                <div class="aidais-persona-role" id="role-${id}">${p.role}</div>
              </div>
              ${id === "chaos-agent" ? `<button class="aidais-mode-toggle" id="aidais-chaos-toggle" title="Switch mode">SFX</button>` : ""}
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

      <div class="aidais-footer">
        <button class="aidais-stop-btn" id="aidais-stop">Stop &amp; Close</button>
      </div>
    `;

    shadow.appendChild(container);

    // Play/Pause = toggle agent processing
    shadow.getElementById("aidais-play-pause").addEventListener("click", () => {
      isPaused = !isPaused;
      const btn = shadow.getElementById("aidais-play-pause");
      if (isPaused) {
        btn.innerHTML = "&#9654;"; // ▶
        btn.title = "Resume agents";
        chrome.runtime.sendMessage({ type: "STOP_CAPTURE_AUDIO" });
        updateStatus("paused", "Paused");
      } else {
        btn.innerHTML = "&#10074;&#10074;"; // ⏸
        btn.title = "Pause agents";
        chrome.runtime.sendMessage({ type: "RESUME_CAPTURE_AUDIO" });
        updateStatus("capturing", "Listening");
      }
    });

    // Hide = collapse sidebar (keeps running)
    shadow.getElementById("aidais-hide").addEventListener("click", () => {
      toggleCollapse(true);
    });

    // Stop & Close = fully disconnect and remove sidebar
    shadow.getElementById("aidais-stop").addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "STOP_CAPTURE" });
    });

    // Chaos / Not Fred Norris mode toggle
    shadow.getElementById("aidais-chaos-toggle").addEventListener("click", () => {
      chaosMode = chaosMode === "chaos" ? "fred-norris" : "chaos";
      const btn = shadow.getElementById("aidais-chaos-toggle");
      const nameEl = shadow.getElementById("name-chaos-agent");
      const roleEl = shadow.getElementById("role-chaos-agent");

      if (chaosMode === "fred-norris") {
        btn.textContent = "Chaos";
        if (nameEl) nameEl.textContent = "Not Fred Norris";
        if (roleEl) roleEl.textContent = "Sound Effects & Context";
      } else {
        btn.textContent = "SFX";
        if (nameEl) nameEl.textContent = "Chaos";
        if (roleEl) roleEl.textContent = "Chaos Agent";
      }

      // Tell server to switch mode
      chrome.runtime.sendMessage({
        type: "SET_CHAOS_MODE",
        mode: chaosMode,
      });
    });
    toggleTab.addEventListener("click", () => {
      toggleCollapse(false);
    });

    document.body.appendChild(sidebarElement);
    isCollapsed = false;
    setYouTubeMargin("340px");
  }

  function toggleCollapse(collapse) {
    const container = sidebarShadow?.getElementById("aidais-container");
    const tab = sidebarShadow?.getElementById("aidais-toggle");
    if (!container || !tab) return;

    isCollapsed = collapse;
    container.classList.toggle("collapsed", collapse);
    tab.classList.toggle("visible", collapse);
    setYouTubeMargin(collapse ? "0px" : "340px");
  }

  function setYouTubeMargin(margin) {
    const ytdApp = document.querySelector("ytd-app");
    if (ytdApp) {
      ytdApp.style.marginRight = margin;
      ytdApp.style.transition = "margin-right 0.3s ease";
    }
  }

  function updateStatus(state, text) {
    if (!sidebarShadow) return;
    const dot = sidebarShadow.getElementById("aidais-status-dot");
    const label = sidebarShadow.getElementById("aidais-status-text");
    if (dot) dot.className = "aidais-status-dot " + state;
    if (label) label.textContent = text;
  }

  function removeSidebar() {
    const el = document.getElementById(SIDEBAR_ID);
    if (el) el.remove();
    sidebarElement = null;
    sidebarShadow = null;
    personas = {};
    isCollapsed = false;
    isCapturing = false;
    setYouTubeMargin("");
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
      if (document.getElementById(SIDEBAR_ID)) {
        try {
          recognition.start();
        } catch {
          /* already started */
        }
      }
    };

    recognition.onerror = () => {};

    try {
      recognition.start();
    } catch {
      /* already started */
    }
  }

  function stopTranscription() {
    if (recognition) {
      try {
        recognition.stop();
      } catch {
        /* already stopped */
      }
      recognition = null;
    }
  }

  function handleServerMessage(data) {
    if (!sidebarShadow) return;

    if (data.type === "session_status") {
      if (data.status === "active") {
        updateStatus("connected", "Connected to server");
      } else if (data.status === "stopped") {
        updateStatus("disconnected", "Session stopped");
      }
    }

    if (data.type === "error") {
      updateStatus("error", data.message || "Error");
    }

    if (data.type === "agent_response" && data.persona) {
      const messagesEl = sidebarShadow.getElementById(
        `messages-${data.persona}`
      );
      const dotEl = sidebarShadow.getElementById(`dot-${data.persona}`);
      if (!messagesEl) return;

      if (!personas[data.persona]) {
        personas[data.persona] = { currentId: null };
      }

      const state = personas[data.persona];

      if (data.messageId !== state.currentId) {
        // New message — finalize any previous streaming message first
        if (state.currentId) {
          const prevMsg = sidebarShadow.getElementById(`msg-${state.currentId}`);
          if (prevMsg) prevMsg.classList.remove("aidais-streaming");
        }

        state.currentId = data.messageId;
        const emptyEl = messagesEl.querySelector(".aidais-empty");
        if (emptyEl) emptyEl.remove();

        // Prevent duplicate elements for same messageId
        const existing = sidebarShadow.getElementById(`msg-${data.messageId}`);
        if (existing) {
          existing.textContent = data.text;
        } else {
          const msgEl = document.createElement("div");
          msgEl.className = "aidais-msg aidais-streaming";
          msgEl.id = `msg-${data.messageId}`;
          msgEl.textContent = data.text;
          messagesEl.appendChild(msgEl);
        }
        messagesEl.scrollTop = messagesEl.scrollHeight;
      } else {
        const msgEl = sidebarShadow.getElementById(`msg-${data.messageId}`);
        if (msgEl) {
          msgEl.textContent = data.text;
          messagesEl.scrollTop = messagesEl.scrollHeight;
        }
      }

      if (dotEl) {
        dotEl.classList.toggle("active", !data.isComplete);
      }

      if (data.isComplete) {
        const msgEl = sidebarShadow.getElementById(`msg-${data.messageId}`);
        if (msgEl) {
          msgEl.classList.remove("aidais-streaming");
          if (
            data.text.trim() === "[PASS]" ||
            data.text.trim() === "PASS"
          ) {
            msgEl.remove();
          }
        }
        state.currentId = null;

        const msgs = messagesEl.querySelectorAll(".aidais-msg");
        if (msgs.length > 5) {
          for (let i = 0; i < msgs.length - 5; i++) {
            msgs[i].remove();
          }
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

      /* Main container */
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
        transition: transform 0.3s ease;
      }
      .aidais-container.collapsed {
        transform: translateX(100%);
      }

      /* Collapse toggle tab */
      .aidais-toggle-tab {
        position: fixed;
        top: 50%;
        right: 0;
        transform: translateY(-50%);
        width: 28px;
        height: 72px;
        background: #0f172a;
        border: 1px solid #1e293b;
        border-right: none;
        border-radius: 8px 0 0 8px;
        color: #fff;
        font-weight: 700;
        font-size: 11px;
        cursor: pointer;
        z-index: 2147483646;
        display: none;
        align-items: center;
        justify-content: center;
        writing-mode: vertical-rl;
        letter-spacing: 2px;
        transition: background 0.2s;
      }
      .aidais-toggle-tab:hover { background: #1e293b; }
      .aidais-toggle-tab.visible { display: flex; }

      /* Header */
      .aidais-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 14px;
        border-bottom: 1px solid #1e293b;
        flex-shrink: 0;
      }
      .aidais-header-actions {
        display: flex;
        align-items: center;
        gap: 2px;
      }
      .aidais-logo {
        font-weight: 700;
        font-size: 15px;
        color: #fff;
      }
      .aidais-play-pause {
        background: none;
        border: 1px solid #475569;
        color: #e2e8f0;
        font-size: 11px;
        cursor: pointer;
        padding: 3px 8px;
        border-radius: 4px;
        line-height: 1;
        transition: all 0.2s;
      }
      .aidais-play-pause:hover { border-color: #3B82F6; color: #3B82F6; }
      .aidais-hide-btn {
        background: none;
        border: 1px solid #475569;
        color: #94a3b8;
        font-size: 10px;
        font-weight: 600;
        cursor: pointer;
        padding: 3px 8px;
        border-radius: 4px;
        transition: all 0.2s;
      }
      .aidais-hide-btn:hover { border-color: #94a3b8; color: #fff; }

      /* Status bar */
      .aidais-status {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 14px;
        background: #1e293b;
        font-size: 11px;
        color: #94a3b8;
        flex-shrink: 0;
      }
      .aidais-status-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        flex-shrink: 0;
      }
      .aidais-status-dot.disconnected { background: #ef4444; }
      .aidais-status-dot.connected { background: #22c55e; }
      .aidais-status-dot.capturing { background: #22c55e; animation: pulse 1s infinite; }
      .aidais-status-dot.mic { background: #f59e0b; animation: pulse 1s infinite; }
      .aidais-status-dot.error { background: #ef4444; }
      .aidais-status-dot.paused { background: #f59e0b; }

      @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }

      /* Personas */
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
      .aidais-mode-toggle {
        background: none;
        border: 1px solid #475569;
        border-radius: 4px;
        color: #94a3b8;
        font-size: 9px;
        font-weight: 600;
        padding: 2px 6px;
        cursor: pointer;
        transition: all 0.2s;
        flex-shrink: 0;
      }
      .aidais-mode-toggle:hover {
        border-color: #A855F7;
        color: #A855F7;
      }
      .aidais-dot {
        width: 8px; height: 8px; border-radius: 50%;
        background: transparent; transition: background 0.3s;
      }
      .aidais-dot.active { background: #22c55e; animation: pulse 1s infinite; }

      /* Messages */
      .aidais-messages {
        max-height: 100px;
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
        content: "\\25CA";
        animation: blink 0.8s infinite;
        opacity: 0.7;
        margin-left: 2px;
      }
      @keyframes blink { 0%,50% { opacity:1; } 51%,100% { opacity:0; } }
      .aidais-empty {
        text-align: center;
        color: #475569;
        font-size: 11px;
        padding: 8px;
      }

      /* Footer */
      .aidais-footer {
        padding: 8px 14px;
        border-top: 1px solid #1e293b;
        flex-shrink: 0;
      }
      .aidais-stop-btn {
        width: 100%;
        padding: 8px;
        background: #dc2626;
        color: #fff;
        border: none;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.2s;
      }
      .aidais-stop-btn:hover { background: #b91c1c; }

      /* Scrollbars */
      .aidais-messages::-webkit-scrollbar { width: 4px; }
      .aidais-messages::-webkit-scrollbar-thumb { background: #334155; border-radius: 2px; }
      .aidais-personas::-webkit-scrollbar { width: 4px; }
      .aidais-personas::-webkit-scrollbar-thumb { background: #334155; border-radius: 2px; }
    `;
  }
})();
