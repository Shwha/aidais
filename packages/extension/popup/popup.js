// AIDAIS Popup — Controls for starting/stopping capture

const statusDot = document.getElementById("status-dot");
const statusText = document.getElementById("status-text");
const actionBtn = document.getElementById("action-btn");

let isCapturing = false;

async function updateStatus() {
  try {
    const response = await chrome.runtime.sendMessage({ type: "GET_STATUS" });
    isCapturing = response.isCapturing;

    if (isCapturing) {
      statusDot.className = "dot capturing";
      statusText.textContent = "Capturing audio...";
      actionBtn.textContent = "Stop";
      actionBtn.className = "btn-stop";
      actionBtn.disabled = false;
    } else {
      // Check if we're on a YouTube tab
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      const isYouTube = tab?.url?.includes("youtube.com/watch");

      statusDot.className = "dot disconnected";
      statusText.textContent = isYouTube
        ? "Ready — YouTube detected"
        : "Navigate to a YouTube video";
      actionBtn.textContent = "Start Listening";
      actionBtn.className = "btn-start";
      actionBtn.disabled = !isYouTube;

      if (isYouTube) {
        statusDot.className = "dot connected";
      }
    }
  } catch {
    statusDot.className = "dot disconnected";
    statusText.textContent = "Extension error";
    actionBtn.disabled = true;
  }
}

actionBtn.addEventListener("click", async () => {
  if (isCapturing) {
    await chrome.runtime.sendMessage({ type: "STOP_CAPTURE" });
  } else {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab?.id) {
      actionBtn.disabled = true;
      actionBtn.textContent = "Connecting...";
      const response = await chrome.runtime.sendMessage({
        type: "START_CAPTURE",
        tabId: tab.id,
      });
      if (!response.success) {
        statusText.textContent = `Error: ${response.error}`;
        statusDot.className = "dot disconnected";
      }
    }
  }
  updateStatus();
});

// Update status on popup open
updateStatus();
