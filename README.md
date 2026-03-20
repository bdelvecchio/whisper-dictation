# Whisper Dictation

Chromium extension for voice dictation powered by a local Whisper STT server.
Press **Caps Lock** to toggle recording — the LED lights up while dictating,
and transcribed text is inserted at the cursor in any browser text field.

## Prerequisites

- Linux (tested on Ubuntu with X11/GNOME)
- Local Whisper STT server running an OpenAI-compatible API (e.g. on `127.0.0.1:2022`)
- Brave, Chrome, or Chromium
- Python 3

## Install

### 1. System layer (keyd + udev)

Remaps Caps Lock to F20 and makes the LED user-controllable:

```bash
cd system/
chmod +x install-system.sh
./install-system.sh
```

Verify: press Caps Lock — it should **not** toggle caps. Run `xev -event keyboard`
and press Caps Lock to confirm it emits `F20`.

### 2. Load the extension

1. Open `brave://extensions` (or `chrome://extensions`)
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked** → select the `extension/` directory
4. Note the **Extension ID** shown on the card

### 3. Native messaging host (for LED control)

```bash
cd native-host/
chmod +x install-native-host.sh
./install-native-host.sh <extension-id>
```

Replace `<extension-id>` with the ID from step 2.

### 4. Restart Brave

Close and reopen Brave so it picks up the native messaging host.

## Usage

1. Click into any text field (Notion, Slack, Google Docs, etc.)
2. Press **Caps Lock** — the LED turns on, a red dot appears in the corner
3. Speak
4. Press **Caps Lock** again — the LED turns off, dot turns amber while
   transcribing, then your text appears at the cursor

## Configuration

Click the extension icon in the toolbar to open settings:

- **Whisper Endpoint** — URL of your Whisper server (default: `http://127.0.0.1:2022`)
- **Language** — hint for the Whisper model (default: auto-detect)

## How it works

```
Caps Lock → keyd → F20 → content script (MediaRecorder)
                        → service worker → Whisper API
                        → content script → execCommand('insertText')
                        → native host → LED on/off
```

## Troubleshooting

**Caps Lock still toggles caps:** `sudo systemctl restart keyd`

**LED doesn't light up:** Check `ls -la /sys/class/leds/input2::capslock/brightness`
— it should be world-writable. If not, re-run `system/install-system.sh`.

**No transcription:** Click the extension icon and check the status dot.
Green = Whisper reachable. Red = check that your Whisper server is running.

**Mic permission denied:** Brave will prompt for mic access on first use.
Grant it, or check `brave://settings/content/microphone`.
