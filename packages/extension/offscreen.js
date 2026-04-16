// AIDAIS Offscreen Document — Tab Audio Capture
// Captures the tab's audio stream, records 5-second segments,
// and sends them to the background worker for server-side transcription.

let mediaStream = null;
let audioCtx = null;
let mediaRecorder = null;
let recordingInterval = null;

const SEGMENT_DURATION_MS = 10000;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case "START_TAB_CAPTURE":
      startCapture(message.streamId)
        .then(() => sendResponse({ success: true }))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;

    case "STOP_TAB_CAPTURE":
      stopCapture();
      sendResponse({ success: true });
      break;

    case "PAUSE_RECORDING":
      pauseRecording();
      sendResponse({ success: true });
      break;

    case "RESUME_RECORDING":
      resumeRecording();
      sendResponse({ success: true });
      break;
  }
});

async function startCapture(streamId) {
  mediaStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: "tab",
        chromeMediaSourceId: streamId,
      },
    },
  });

  // Pass audio through so the user still hears the podcast
  audioCtx = new AudioContext();
  const source = audioCtx.createMediaStreamSource(mediaStream);
  source.connect(audioCtx.destination);

  // Start recording segments
  startRecordingCycle();
}

function startRecordingCycle() {
  function beginSegment() {
    if (!mediaStream || !mediaStream.active) return;

    const chunks = [];
    mediaRecorder = new MediaRecorder(mediaStream, {
      mimeType: "audio/webm;codecs=opus",
    });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      if (chunks.length === 0) return;
      const blob = new Blob(chunks, { type: "audio/webm;codecs=opus" });
      const buffer = await blob.arrayBuffer();
      const base64 = arrayBufferToBase64(buffer);

      chrome.runtime.sendMessage({
        type: "AUDIO_DATA",
        data: base64,
        mimeType: "audio/webm;codecs=opus",
      });
    };

    mediaRecorder.start();
  }

  // Record first segment immediately
  beginSegment();

  // Every SEGMENT_DURATION_MS, stop current recording (triggers send) and start new one
  recordingInterval = setInterval(() => {
    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.stop();
    }
    beginSegment();
  }, SEGMENT_DURATION_MS);
}

function stopCapture() {
  if (recordingInterval) {
    clearInterval(recordingInterval);
    recordingInterval = null;
  }

  if (mediaRecorder && mediaRecorder.state === "recording") {
    try {
      mediaRecorder.stop();
    } catch {
      // already stopped
    }
    mediaRecorder = null;
  }

  if (audioCtx) {
    audioCtx.close().catch(() => {});
    audioCtx = null;
  }

  if (mediaStream) {
    mediaStream.getTracks().forEach((t) => t.stop());
    mediaStream = null;
  }
}

function pauseRecording() {
  if (recordingInterval) {
    clearInterval(recordingInterval);
    recordingInterval = null;
  }
  if (mediaRecorder && mediaRecorder.state === "recording") {
    try { mediaRecorder.stop(); } catch { /* already stopped */ }
  }
}

function resumeRecording() {
  if (!mediaStream || !mediaStream.active) return;
  if (recordingInterval) return; // already running
  startRecordingCycle();
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
