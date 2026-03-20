#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LED_PATH="/sys/class/leds/input2::capslock"

echo "=== Whisper Dictation — System Layer Install ==="

if ! command -v keyd &>/dev/null; then
    echo "Installing keyd from source..."
    BUILD_DIR="$(mktemp -d)"
    git clone --depth 1 --branch v2.6.0 https://github.com/rvaiya/keyd.git "$BUILD_DIR/keyd"
    make -C "$BUILD_DIR/keyd" -j"$(nproc)"
    sudo make -C "$BUILD_DIR/keyd" install
    sudo systemctl enable keyd
    rm -rf "$BUILD_DIR"
else
    echo "keyd already installed."
fi

echo "Installing keyd config..."
sudo cp "$SCRIPT_DIR/keyd-default.conf" /etc/keyd/default.conf
sudo systemctl enable keyd
sudo systemctl restart keyd

echo "Installing udev rule..."
sudo cp "$SCRIPT_DIR/99-capslock-led.rules" /etc/udev/rules.d/
sudo udevadm control --reload-rules
sudo udevadm trigger --subsystem-match=leds

echo "Applying LED permissions for current session..."
echo none | sudo tee "$LED_PATH/trigger" > /dev/null
sudo chmod 0666 "$LED_PATH/brightness"

echo "Testing LED control..."
echo 1 > "$LED_PATH/brightness"
sleep 0.5
echo 0 > "$LED_PATH/brightness"
echo "LED blinked successfully."

echo ""
echo "Done. Caps Lock now emits F20. LED is under user control."
echo "Verify with: xev -event keyboard  (press Caps Lock, expect F20)"
