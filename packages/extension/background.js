// AIDAIS Chrome Extension — Background Service Worker
// Handles tab audio capture and communication with content scripts

const AIDAIS_SERVER = "ws://localhost:3001/ws";

let activeTabId = null;
let wsConnection = null;
let mediaRecorder = null;
let offscreenCreated = false;

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case "START_CAPTURE":
      startCapture(sender.tab?.id ?? message.tabId)
        .then(() => sendResponse({ success: true }))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true; // async response

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

    case "AUDIO_DATA":
      // Forward audio data from offscreen document to WebSocket
      if (wsConnection?.readyState === WebSocket.OPEN) {
        wsConnection.send(JSON.stringify({
          type: "audio_chunk",
          data: message.data,
        }));
      }
      break;

    case "TRANSCRIPT":
      // Forward transcript from content script to server
      if (wsConnection?.readyState === WebSocket.OPEN) {
        wsConnection.send(JSON.stringify({
          type: "transcript",
          text: message.text,
          isFinal: message.isFinal,
          timestamp: Date.now(),
        }));
      }
      break;
  }
});

async function startCapture(tabId) {
  if (activeTabId) {
    stopCapture();
  }

  // Connect to AIDAIS server
  wsConnection = new WebSocket(AIDAIS_SERVER);

  await new Promise((resolve, reject) => {
    wsConnection.onopen = () => {
      wsConnection.send(JSON.stringify({ type: "start_session" }));
      resolve();
    };
    wsConnection.onerror = () => reject(new Error("Failed to connect to AIDAIS server"));
    setTimeout(() => reject(new Error("Connection timeout")), 5000);
  });

  // Forward server messages to the content script
  wsConnection.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (tabId) {
        chrome.tabs.sendMessage(tabId, {
          type: "SERVER_MESSAGE",
          data,
        }).catch(() => {
          // Tab might have been closed
        });
      }
    } catch {
      // Ignore parse errors
    }
  };

  wsConnection.onclose = () => {
    stopCapture();
  };

  activeTabId = tabId;

  // Notify content script to show sidebar
  if (tabId) {
    chrome.tabs.sendMessage(tabId, { type: "SHOW_SIDEBAR" }).catch(() => {});
  }
}

function stopCapture() {
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
    chrome.tabs.sendMessage(activeTabId, { type: "HIDE_SIDEBAR" }).catch(() => {});
    activeTabId = null;
  }
}

// Clean up on tab close
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === activeTabId) {
    stopCapture();
  }
});
