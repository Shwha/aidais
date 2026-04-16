// AIDAIS Chrome Extension — Background Service Worker
// Manages tab audio capture via offscreen document and WebSocket to AIDAIS server

const AIDAIS_SERVER = "ws://localhost:3002/ws";

let activeTabId = null;
let wsConnection = null;
let offscreenReady = false;

// Extension icon click — toggle sidebar on the active tab
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;

  if (activeTabId === tab.id) {
    // Already active on this tab — stop
    stopCapture();
  } else {
    // Start on this tab
    try {
      await startCapture(tab.id);
    } catch (err) {
      console.error("[AIDAIS] Start failed:", err.message);
    }
  }
});

// Listen for messages from content script and offscreen document
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case "START_CAPTURE":
      startCapture(sender.tab?.id ?? message.tabId)
        .then(() => sendResponse({ success: true }))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;

    case "STOP_CAPTURE":
      stopCapture();
      sendResponse({ success: true });
      break;

    case "GET_STATUS":
      sendResponse({
        isCapturing: activeTabId !== null,
        isConnected: wsConnection?.readyState === WebSocket.OPEN,
        activeTabId,
      });
      break;

    case "TRANSCRIPT":
      if (wsConnection?.readyState === WebSocket.OPEN) {
        wsConnection.send(
          JSON.stringify({
            type: "transcript",
            text: message.text,
            isFinal: message.isFinal,
            timestamp: Date.now(),
          })
        );
      }
      break;

    case "STOP_CAPTURE_AUDIO":
      chrome.runtime.sendMessage({ type: "PAUSE_RECORDING" }).catch(() => {});
      if (wsConnection?.readyState === WebSocket.OPEN) {
        wsConnection.send(JSON.stringify({ type: "stop_session" }));
      }
      sendResponse({ success: true });
      break;

    case "RESUME_CAPTURE_AUDIO":
      chrome.runtime.sendMessage({ type: "RESUME_RECORDING" }).catch(() => {});
      if (wsConnection?.readyState === WebSocket.OPEN) {
        wsConnection.send(JSON.stringify({ type: "start_session" }));
      }
      sendResponse({ success: true });
      break;

    case "SET_CHAOS_MODE":
      if (wsConnection?.readyState === WebSocket.OPEN) {
        wsConnection.send(
          JSON.stringify({ type: "set_chaos_mode", mode: message.mode })
        );
      }
      break;

    case "AUDIO_DATA":
      // Forward tab audio chunks to server for server-side STT (when available)
      if (wsConnection?.readyState === WebSocket.OPEN) {
        wsConnection.send(
          JSON.stringify({ type: "audio_chunk", data: message.data })
        );
      }
      break;

    case "CAPTURE_ERROR":
      // Tab audio capture is best-effort — mic transcription is primary
      console.info("[AIDAIS] Tab capture issue (non-fatal):", message.error);
      break;
  }
});

async function ensureOffscreenDocument() {
  if (offscreenReady) return;

  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
  });

  if (existingContexts.length > 0) {
    offscreenReady = true;
    return;
  }

  await chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: ["USER_MEDIA"],
    justification:
      "Tab audio capture for real-time speech-to-text transcription",
  });

  offscreenReady = true;
}

async function startCapture(tabId) {
  if (activeTabId) {
    stopCapture();
  }

  // 1. Connect to AIDAIS server
  wsConnection = new WebSocket(AIDAIS_SERVER);

  await new Promise((resolve, reject) => {
    wsConnection.onopen = () => {
      wsConnection.send(JSON.stringify({ type: "start_session" }));
      resolve();
    };
    wsConnection.onerror = () =>
      reject(
        new Error("Cannot connect to AIDAIS server. Is it running on :3002?")
      );
    setTimeout(() => reject(new Error("Connection timeout")), 5000);
  });

  // Forward server messages to the content script sidebar
  wsConnection.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (tabId) {
        chrome.tabs
          .sendMessage(tabId, { type: "SERVER_MESSAGE", data })
          .catch(() => {});
      }
    } catch {
      // Ignore parse errors
    }
  };

  wsConnection.onclose = () => {
    if (activeTabId) {
      chrome.tabs
        .sendMessage(activeTabId, { type: "CAPTURE_STOPPED" })
        .catch(() => {});
    }
    activeTabId = null;
  };

  activeTabId = tabId;

  // 2. Inject content script (in case page was already open before extension loaded)
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["content.js"],
  }).catch(() => {});

  // 3. Show sidebar
  chrome.tabs.sendMessage(tabId, { type: "SHOW_SIDEBAR" }).catch(() => {});

  // 3. Start tab audio capture — server transcribes via Whisper
  try {
    await ensureOffscreenDocument();
    const streamId = await chrome.tabCapture.getMediaStreamId({
      targetTabId: tabId,
    });
    await chrome.runtime.sendMessage({
      type: "START_TAB_CAPTURE",
      streamId,
    });
    // Notify sidebar
    chrome.tabs
      .sendMessage(tabId, { type: "CAPTURE_STARTED" })
      .catch(() => {});
  } catch (err) {
    // Tab capture failed — fall back to mic
    console.warn("[AIDAIS] Tab capture failed, using mic:", err.message);
    chrome.tabs
      .sendMessage(tabId, { type: "START_MIC_FALLBACK" })
      .catch(() => {});
  }
}

function stopCapture() {
  chrome.runtime.sendMessage({ type: "STOP_TAB_CAPTURE" }).catch(() => {});

  if (wsConnection) {
    try {
      wsConnection.send(JSON.stringify({ type: "stop_session" }));
      wsConnection.close();
    } catch {
      // Already closed
    }
    wsConnection = null;
  }

  if (activeTabId) {
    chrome.tabs
      .sendMessage(activeTabId, { type: "HIDE_SIDEBAR" })
      .catch(() => {});
    activeTabId = null;
  }
}

chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === activeTabId) {
    stopCapture();
  }
});
