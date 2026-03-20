# Whisper Dictation - Chromium Extension Design

**Date:** 2026-03-20
**Status:** Approved

## Problem

No existing Chromium extension supports voice dictation backed by a local,
self-hosted Whisper STT server. The user has a working local speech stack
(Whisper on `127.0.0.1:2022`, Kokoro TTS on `127.0.0.1:8880`) and wants
to dictate text into any browser text field (Notion Web, Slack, etc.)
using the Caps Lock key as the toggle with its LED as a recording indicator.

## Design

### System Layer

**keyd** remaps Caps Lock → F20 system-wide, disabling normal Caps Lock
behavior. A **udev rule** makes the Caps Lock LED writable by the user
and sets its trigger to `none` for direct control.

- `/etc/keyd/default.conf` — remap capslock to f20
- `/etc/udev/rules.d/99-capslock-led.rules` — chmod 0666 the LED brightness
  file and set trigger to none

### Extension Architecture

Three components plus a native messaging host:

1. **Content Script** (`content.js`) — injected into all pages. Listens
   for F20 keydown. First press starts MediaRecorder (mic capture). Second
   press stops recording and waits for transcription. Injects result at
   cursor via `document.execCommand('insertText', false, text)`.

2. **Service Worker** (`background.js`) — receives audio blob from content
   script, POSTs to Whisper API, returns transcription. Also sends LED
   toggle messages to the native messaging host.

3. **Popup** (`popup.html`) — settings: Whisper endpoint URL, language
   hint, test button.

4. **Native Messaging Host** (`led-control.sh`) — ~10-line shell script
   that reads JSON from stdin and writes 0/1 to
   `/sys/class/leds/input2::capslock/brightness`. Registered with Brave
   via a JSON manifest.

### Data Flow

```
Caps Lock → keyd → F20 keydown
  → content.js starts MediaRecorder, messages background
  → background.js → native host → LED on

Caps Lock again → F20 keydown
  → content.js stops MediaRecorder, sends audio blob to background
  → background.js POSTs to http://127.0.0.1:2022/v1/audio/transcriptions
  → receives transcription text, sends back to content.js
  → content.js: execCommand('insertText', false, text)
  → background.js → native host → LED off
```

### Key Decisions

- **Toggle mode** (not hold-to-talk) — dictation can last 30+ seconds
- **F20** as the remapped key — unused on standard keyboards, no conflicts
- **execCommand for text injection** — fires Notion's internal input
  events correctly, works in contentEditable and standard inputs
- **udev for LED permissions** — cleanest approach, survives reboots,
  no daemon needed
- **Native Messaging for LED** — standard Chrome API for OS-level
  communication from extensions

### Prerequisites

- keyd (system package)
- Local Whisper STT running on 127.0.0.1:2022 (already installed)
- Brave browser with developer mode for unpacked extensions
