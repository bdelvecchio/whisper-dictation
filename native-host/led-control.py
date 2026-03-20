#!/usr/bin/env python3
"""
Chrome Native Messaging host for Caps Lock LED control.
Reads length-prefixed JSON from stdin, writes to the LED sysfs file.
"""
import json
import struct
import sys

LED_PATH = "/sys/class/leds/input2::capslock/brightness"


def read_message():
    raw_length = sys.stdin.buffer.read(4)
    if len(raw_length) < 4:
        return None
    length = struct.unpack("<I", raw_length)[0]
    data = sys.stdin.buffer.read(length)
    return json.loads(data)


def send_message(obj):
    encoded = json.dumps(obj).encode("utf-8")
    sys.stdout.buffer.write(struct.pack("<I", len(encoded)))
    sys.stdout.buffer.write(encoded)
    sys.stdout.buffer.flush()


def set_led(value):
    try:
        with open(LED_PATH, "w") as f:
            f.write(str(value))
        return True
    except OSError:
        return False


while True:
    msg = read_message()
    if msg is None:
        break
    led_val = msg.get("led", 0)
    ok = set_led(1 if led_val else 0)
    send_message({"ok": ok})
