#!/usr/bin/env python3
"""Checks tv/webos/appinfo.json (or the file given): the keys webOS needs, and that the icon files beside it exist
and are PNGs of the right size (icon 80x80, largeIcon 130x130). Exits 1 with a message per problem."""
import json
import re
import sys
from pathlib import Path

REQUIRED = ("id", "version", "vendor", "type", "main", "title", "icon", "largeIcon")
SIZES = {"icon": (80, 80), "largeIcon": (130, 130)}


def png_size(path: Path):
    data = path.read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n" or data[12:16] != b"IHDR":
        return None
    return int.from_bytes(data[16:20], "big"), int.from_bytes(data[20:24], "big")


def problems(path: Path):
    try:
        info = json.loads(path.read_text())
    except (OSError, ValueError) as e:
        return [f"{path}: cannot read it as JSON: {e}"]
    if not isinstance(info, dict):
        return [f"{path}: not a JSON object"]
    out = [f"missing key: {k}" for k in REQUIRED if k not in info]
    if out:
        return out
    # the rules of LG's appinfo.json reference
    if not re.fullmatch(r"[a-z0-9-]+(\.[a-z0-9-]+)+", info["id"]) or info["id"].startswith(("com.palm", "com.lge")):
        out.append(f"id {info['id']!r} must be lower-case letters, digits, - and . (such as com.example.app), not starting with com.palm or com.lge")
    if not re.fullmatch(r"(0|[1-9]\d*)(\.(0|[1-9]\d*)){2}", info["version"]):
        out.append(f"version {info['version']!r} must be three numbers without leading zeros, such as 1.0.0")
    if len(str(info["title"])) > 20:
        out.append(f"title {info['title']!r} is longer than the 20 characters the launcher shows")
    if info["type"] != "web":
        out.append(f"type is {info['type']!r}, not 'web'")
    for k in ("vendor", "title", "main"):
        if not str(info[k]).strip():
            out.append(f"{k} is empty")
    for key, want in SIZES.items():
        icon = path.parent / info[key]
        if not icon.is_file():
            out.append(f"{key}: file {info[key]} does not exist next to appinfo.json")
            continue
        got = png_size(icon)
        if got is None:
            out.append(f"{key}: {info[key]} is not a PNG")
        elif got != want:
            out.append(f"{key}: {info[key]} is {got[0]}x{got[1]}, must be {want[0]}x{want[1]}")
    return out


if __name__ == "__main__":
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[1] / "tv" / "webos" / "appinfo.json"
    found = problems(target)
    for p in found:
        print(f"check-webos-appinfo: {p}", file=sys.stderr)
    sys.exit(1 if found else 0)
