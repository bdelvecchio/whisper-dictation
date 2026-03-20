(() => {
  "use strict";

  let recording = false;
  let mediaRecorder = null;
  let audioChunks = [];
  let indicator = null;

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
    indicator.style.opacity = "1";
  }

  function hideIndicator() {
    if (indicator) indicator.style.opacity = "0";
  }

  function showTranscribing() {
    if (!indicator) indicator = createIndicator();
    indicator.style.background = "#f59e0b";
    indicator.style.boxShadow = "0 0 8px rgba(245,158,11,0.6)";
  }

  function resetIndicator() {
    if (indicator) {
      indicator.style.background = "#ef4444";
      indicator.style.boxShadow = "0 0 8px rgba(239,68,68,0.6)";
    }
  }

  async function startRecording() {
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
        if (blob.size < 1000) {
          hideIndicator();
          resetIndicator();
          return;
        }
        showTranscribing();
        chrome.runtime.sendMessage({ type: "led", state: false });

        const reader = new FileReader();
        reader.onloadend = () => {
          chrome.runtime.sendMessage(
            { type: "transcribe", audio: reader.result },
            (response) => {
              hideIndicator();
              resetIndicator();
              if (response && response.text) {
                insertText(response.text);
              } else if (response && response.error) {
                console.error("[Whisper Dictation]", response.error);
              }
            }
          );
        };
        reader.readAsDataURL(blob);
      };

      mediaRecorder.start(250);
      recording = true;
      showIndicator();
      chrome.runtime.sendMessage({ type: "led", state: true });
    } catch (err) {
      console.error("[Whisper Dictation] Mic access denied:", err);
      recording = false;
      hideIndicator();
    }
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
    recording = false;
  }

  function insertText(text) {
    const el = document.activeElement;
    if (!el) return;

    if (el.isContentEditable || el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
      el.focus();
      document.execCommand("insertText", false, text);
    }
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "F20") {
      e.preventDefault();
      e.stopPropagation();
      if (recording) {
        stopRecording();
      } else {
        startRecording();
      }
    }
  }, true);
})();
