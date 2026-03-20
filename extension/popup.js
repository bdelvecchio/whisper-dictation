const DEFAULTS = {
  endpoint: "http://127.0.0.1:2022",
  language: ""
};

const $endpoint = document.getElementById("endpoint");
const $language = document.getElementById("language");
const $save = document.getElementById("save");
const $test = document.getElementById("test");
const $status = document.getElementById("status");

chrome.storage.sync.get(DEFAULTS, (cfg) => {
  $endpoint.value = cfg.endpoint;
  $language.value = cfg.language;
  checkHealth(cfg.endpoint);
});

$save.addEventListener("click", () => {
  const cfg = {
    endpoint: $endpoint.value.replace(/\/+$/, ""),
    language: $language.value
  };
  chrome.storage.sync.set(cfg, () => {
    $save.textContent = "Saved";
    setTimeout(() => { $save.textContent = "Save"; }, 1200);
    checkHealth(cfg.endpoint);
  });
});

$test.addEventListener("click", () => {
  $test.textContent = "Testing...";
  checkHealth($endpoint.value.replace(/\/+$/, "")).then((ok) => {
    $test.textContent = ok ? "Connected" : "Failed";
    setTimeout(() => { $test.textContent = "Test"; }, 2000);
  });
});

async function checkHealth(endpoint) {
  try {
    const resp = await fetch(endpoint + "/health", { signal: AbortSignal.timeout(3000) });
    const ok = resp.ok;
    $status.className = "status " + (ok ? "ok" : "err");
    $status.title = ok ? "Connected" : "Unhealthy";
    return ok;
  } catch {
    $status.className = "status err";
    $status.title = "Unreachable";
    return false;
  }
}
