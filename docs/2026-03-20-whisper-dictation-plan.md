# Whisper Dictation Extension - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Chromium extension that uses Caps Lock as a dictation toggle, records audio, transcribes via local Whisper, and injects text into any browser text field with the Caps Lock LED as a recording indicator.

**Architecture:** System layer (keyd + udev) remaps Caps Lock to F20 and exposes the LED. A Manifest V3 Chrome extension with content script, service worker, popup, and native messaging host handles recording, transcription, and LED control.

**Tech Stack:** Vanilla JS (no build step), Chrome Extension Manifest V3, Web Audio API / MediaRecorder, OpenAI-compatible Whisper API, keyd, udev, Native Messaging

---

### Task 1: System Layer - keyd and udev

**Files:**
- Create: `system/keyd-default.conf`
- Create: `system/99-capslock-led.rules`
- Create: `system/install-system.sh`

**Step 1: Create keyd config**

```ini
# system/keyd-default.conf
[ids]
*

[main]
capslock = f20
```

**Step 2: Create udev rule**

```
# system/99-capslock-led.rules
ACTION=="add", SUBSYSTEM=="leds", KERNEL=="*::capslock", RUN+="/bin/chmod 0666 %S%p/brightness", RUN+="/bin/sh -c 'echo none > %S%p/trigger'"
```

**Step 3: Create install script**

```bash
#!/usr/bin/env bash
set -euo pipefail

echo "Installing keyd..."
sudo apt-get install -y keyd

echo "Installing keyd config..."
sudo cp system/keyd-default.conf /etc/keyd/default.conf
sudo systemctl enable keyd
sudo systemctl restart keyd

echo "Installing udev rule..."
sudo cp system/99-capslock-led.rules /etc/udev/rules.d/
sudo udevadm control --reload-rules
sudo udevadm trigger --subsystem-match=leds

# Apply immediately for current session
echo none | sudo tee /sys/class/leds/input2::capslock/trigger > /dev/null
sudo chmod 0666 /sys/class/leds/input2::capslock/brightness

echo "Testing LED control..."
echo 1 > /sys/class/leds/input2::capslock/brightness
sleep 0.5
echo 0 > /sys/class/leds/input2::capslock/brightness
echo "LED blinked successfully."

echo "Done. Caps Lock is now F20. LED is under user control."
```

**Step 4: Run install script and verify**

Run: `cd ~/projects/whisper-dictation && chmod +x system/install-system.sh && ./system/install-system.sh`
Expected: keyd installed, Caps Lock emits F20, LED blinks once.

Verify: `xev -event keyboard` then press Caps Lock — should show `F20` keycode.

**Step 5: Commit**

```bash
git add system/
git commit -m "feat: add keyd and udev system layer for caps lock remap"
```

---

### Task 2: Extension Manifest and Popup

**Files:**
- Create: `extension/manifest.json`
- Create: `extension/popup.html`
- Create: `extension/popup.js`
- Create: `extension/icons/` (16, 48, 128 px)

**Step 1: Create manifest.json**

```json
{
  "manifest_version": 3,
  "name": "Whisper Dictation",
  "version": "0.1.0",
  "description": "Caps Lock dictation powered by local Whisper",
  "permissions": ["activeTab", "nativeMessaging", "storage"],
  "host_permissions": ["http://127.0.0.1:2022/*"],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ],
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/mic-16.png",
      "48": "icons/mic-48.png",
      "128": "icons/mic-128.png"
    }
  },
  "icons": {
    "16": "icons/mic-16.png",
    "48": "icons/mic-48.png",
    "128": "icons/mic-128.png"
  }
}
```

**Step 2: Create popup.html and popup.js**

Minimal settings UI: Whisper endpoint URL input, language select, save button, test button.

**Step 3: Generate simple SVG-based icons**

Create mic icon PNGs at 16, 48, 128px.

**Step 4: Load unpacked in Brave and verify popup opens**

Navigate to `brave://extensions`, enable Developer Mode, Load Unpacked → select `extension/` dir.

**Step 5: Commit**

```bash
git add extension/
git commit -m "feat: add extension manifest and settings popup"
```

---

### Task 3: Content Script - F20 Listener and MediaRecorder

**Files:**
- Create: `extension/content.js`

**Step 1: Write content script with F20 toggle and audio recording**

Listens for F20 keydown. First press: requests mic permission, starts
MediaRecorder capturing webm/opus audio. Second press: stops recording,
collects blob, sends to service worker via chrome.runtime.sendMessage.
On response, injects text via execCommand('insertText').

Shows a small visual indicator (red dot) at bottom-right while recording
as a secondary feedback alongside the LED.

**Step 2: Test manually in Brave**

Open any page with a text field, press Caps Lock, speak, press Caps Lock
again. The content script should log the audio blob size to console.
Text injection won't work yet (service worker not implemented).

**Step 3: Commit**

```bash
git add extension/content.js
git commit -m "feat: add content script with F20 recording toggle"
```

---

### Task 4: Service Worker - Whisper API and LED Control

**Files:**
- Create: `extension/background.js`

**Step 1: Write service worker**

Handles two message types from content script:
- `{ type: "transcribe", audio: <base64> }` — decodes audio, POSTs
  multipart/form-data to Whisper endpoint, returns `{ text }`.
- `{ type: "led", state: true|false }` — sends to native messaging host.

Reads Whisper endpoint URL from chrome.storage.sync (set by popup).
Default: `http://127.0.0.1:2022`.

**Step 2: Test transcription end-to-end**

Press Caps Lock in a Notion text block, dictate a sentence, press
Caps Lock again. Transcribed text should appear at cursor.

**Step 3: Commit**

```bash
git add extension/background.js
git commit -m "feat: add service worker with Whisper API integration"
```

---

### Task 5: Native Messaging Host for LED Control

**Files:**
- Create: `native-host/led-control.sh`
- Create: `native-host/com.whisper_dictation.led.json`
- Create: `native-host/install-native-host.sh`

**Step 1: Create the native messaging host script**

Shell script that reads JSON messages from stdin (length-prefixed per
Chrome Native Messaging protocol), parses `{ "led": 1 }` or
`{ "led": 0 }`, writes to `/sys/class/leds/input2::capslock/brightness`.

**Step 2: Create the host manifest**

```json
{
  "name": "com.whisper_dictation.led",
  "description": "Caps Lock LED control for Whisper Dictation",
  "path": "/home/bdelvecchio/projects/whisper-dictation/native-host/led-control.sh",
  "type": "stdio",
  "allowed_origins": ["chrome-extension://EXTENSION_ID_HERE/"]
}
```

**Step 3: Create install script**

Copies manifest to `~/.config/BraveSoftware/Brave-Browser/NativeMessagingHosts/`.
Sets execute permission on led-control.sh.

**Step 4: Install, reload extension, test LED toggles with Caps Lock**

**Step 5: Commit**

```bash
git add native-host/
git commit -m "feat: add native messaging host for caps lock LED"
```

---

### Task 6: Polish and README

**Files:**
- Create: `README.md`
- Modify: `extension/content.js` (error handling, edge cases)

**Step 1: Add error handling**

- Whisper server unreachable → show browser notification
- Mic permission denied → show popup explaining
- Empty transcription → don't inject, show subtle indicator

**Step 2: Write README**

Prerequisites, install steps, usage, configuration, troubleshooting.

**Step 3: Commit**

```bash
git add .
git commit -m "docs: add README and error handling polish"
```
