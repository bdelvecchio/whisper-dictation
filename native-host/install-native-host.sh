#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MANIFEST_NAME="com.whisper_dictation.led.json"

# Brave uses the same NativeMessagingHosts path structure as Chrome
BRAVE_DIR="$HOME/.config/BraveSoftware/Brave-Browser/NativeMessagingHosts"
CHROME_DIR="$HOME/.config/google-chrome/NativeMessagingHosts"
CHROMIUM_DIR="$HOME/.config/chromium/NativeMessagingHosts"

chmod +x "$SCRIPT_DIR/led-control.py"

if [ -z "${1:-}" ]; then
    echo "Usage: $0 <extension-id>"
    echo ""
    echo "  Load the extension in Brave first (brave://extensions),"
    echo "  then copy its ID and run this script with it."
    echo ""
    echo "  Example: $0 abcdefghijklmnopqrstuvwxyz012345"
    exit 1
fi

EXT_ID="$1"

# Update the manifest with the real extension ID and absolute path
MANIFEST=$(cat "$SCRIPT_DIR/$MANIFEST_NAME")
MANIFEST=$(echo "$MANIFEST" | python3 -c "
import sys, json
m = json.load(sys.stdin)
m['path'] = '$SCRIPT_DIR/led-control.py'
m['allowed_origins'] = ['chrome-extension://$EXT_ID/']
json.dump(m, sys.stdout, indent=2)
print()
")

for dir in "$BRAVE_DIR" "$CHROME_DIR" "$CHROMIUM_DIR"; do
    mkdir -p "$dir"
    echo "$MANIFEST" > "$dir/$MANIFEST_NAME"
    echo "Installed to $dir/$MANIFEST_NAME"
done

echo ""
echo "Native messaging host installed. Restart Brave to pick it up."
