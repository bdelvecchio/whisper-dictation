(() => {
  "use strict";

  const TAG = "[Whisper Dictation]";

  let recording = false;
  let pending = false;
  let mediaRecorder = null;
  let audioChunks = [];
  let indicator = null;
  let targetElement = null;
  let targetSelection = null;

  function createIndicator() {
    const el = document.createElement("div");
    el.id = "whisper-dictation-indicator";
    Object.assign(el.style, {
      position: "fixed",
      bottom: "16px",
      right: "16px",
      width: "14px",
      height: "14px",
      borderRadius: "50%",
      background: "#ef4444",
      boxShadow: "0 0 8px rgba(239,68,68,0.6)",
      zIndex: "2147483647",
      pointerEvents: "none",
      transition: "opacity 0.2s",
      opacity: "0"
    });
    document.body.appendChild(el);
    return el;
  }

  function showIndicator() {
    if (!indicator) indicator = createIndicator();
    indicator.style.background = "#ef4444";
    indicator.style.boxShadow = "0 0 8px rgba(239,68,68,0.6)";
    indicator.style.opacity = "1";
  }

  function hideIndicator() {
    if (indicator) indicator.style.opacity = "0";
  }

  function showTranscribing() {
    if (!indicator) indicator = createIndicator();
    indicator.style.background = "#f59e0b";
    indicator.style.boxShadow = "0 0 8px rgba(245,158,11,0.6)";
    indicator.style.opacity = "1";
  }

  function saveTarget() {
    targetElement = document.activeElement;
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      targetSelection = sel.getRangeAt(0).cloneRange();
    } else {
      targetSelection = null;
    }
    console.log(TAG, "Saved target:", targetElement?.tagName, targetElement?.isContentEditable);
  }

  function restoreTarget() {
    if (!targetElement) return;
    targetElement.focus();
    if (targetSelection && targetElement.isContentEditable) {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(targetSelection);
    }
  }

  async function startRecording() {
    if (pending) return;
    pending = true;

    saveTarget();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunks = [];
      mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunks, { type: "audio/webm" });
        console.log(TAG, "Recording stopped, blob size:", blob.size);

        if (blob.size < 1000) {
          console.log(TAG, "Recording too short, ignoring");
          hideIndicator();
          chrome.runtime.sendMessage({ type: "led", state: false });
          return;
        }

        showTranscribing();
        chrome.runtime.sendMessage({ type: "led", state: false });

        const reader = new FileReader();
        reader.onloadend = () => {
          console.log(TAG, "Sending audio to service worker for transcription...");
          chrome.runtime.sendMessage(
            { type: "transcribe", audio: reader.result },
            (response) => {
              hideIndicator();
              if (chrome.runtime.lastError) {
                console.error(TAG, "Message error:", chrome.runtime.lastError.message);
                return;
              }
              if (response && response.text) {
                console.log(TAG, "Transcription:", response.text);
                restoreTarget();
                insertText(response.text);
              } else if (response && response.error) {
                console.error(TAG, "Transcription error:", response.error);
              } else {
                console.warn(TAG, "Empty response from service worker");
              }
            }
          );
        };
        reader.readAsDataURL(blob);
      };

      mediaRecorder.start(250);
      recording = true;
      pending = false;
      showIndicator();
      chrome.runtime.sendMessage({ type: "led", state: true });
      console.log(TAG, "Recording started");
    } catch (err) {
      console.error(TAG, "Mic access error:", err);
      recording = false;
      pending = false;
      hideIndicator();
    }
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      console.log(TAG, "Stopping recording...");
      mediaRecorder.stop();
    }
    recording = false;
  }

  function insertText(text) {
    const el = document.activeElement;
    if (!el) {
      console.warn(TAG, "No active element for text insertion");
      return;
    }

    if (el.isContentEditable || el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
      document.execCommand("insertText", false, text);
      console.log(TAG, "Text inserted into", el.tagName);
    } else {
      console.warn(TAG, "Active element not editable:", el.tagName);
    }
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "F20") {
      e.preventDefault();
      e.stopPropagation();
      console.log(TAG, "F20 pressed, recording:", recording, "pending:", pending);
      if (recording) {
        stopRecording();
      } else {
        startRecording();
      }
    }
  }, true);

  console.log(TAG, "Content script loaded, listening for F20 (Caps Lock)");
})();
