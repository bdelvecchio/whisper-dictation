const DEFAULTS = {
  endpoint: "http://127.0.0.1:2022",
  language: ""
};

const NATIVE_HOST = "com.whisper_dictation.led";

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "transcribe") {
    handleTranscribe(msg.audio).then(sendResponse).catch((err) => {
      sendResponse({ error: err.message });
    });
    return true;
  }

  if (msg.type === "led") {
    setLed(msg.state);
  }
});

async function handleTranscribe(dataUrl) {
  const cfg = await chrome.storage.sync.get(DEFAULTS);
  const endpoint = cfg.endpoint.replace(/\/+$/, "");

  const resp = await fetch(dataUrl);
  const audioBlob = await resp.blob();

  const formData = new FormData();
  formData.append("file", audioBlob, "recording.webm");
  formData.append("model", "whisper-1");
  if (cfg.language) {
    formData.append("language", cfg.language);
  }

  const result = await fetch(endpoint + "/v1/audio/transcriptions", {
    method: "POST",
    body: formData
  });

  if (!result.ok) {
    const body = await result.text();
    throw new Error(`Whisper API ${result.status}: ${body}`);
  }

  const data = await result.json();
  return { text: data.text || "" };
}

function setLed(on) {
  try {
    chrome.runtime.sendNativeMessage(NATIVE_HOST, { led: on ? 1 : 0 });
  } catch {
    // Native host may not be installed yet; fail silently
  }
}
