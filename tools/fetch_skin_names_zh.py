#!/usr/bin/env python3
"""
Fetches Chinese skin names from ByMykel CSGO-API (zh-CN) and writes
skin_name.* translation entries into src/foundation/languages/zh-CN.js.

Matches skins by ID across the English and zh-CN datasets, then filters
to only include skins that actually appear in cases.json or souvenirs.json.
"""

import json
import re
import urllib.request
from pathlib import Path


ROOT = Path(__file__).parent.parent

# ── fetch ByMykel data ────────────────────────────────────────────────────────

def fetch_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode())

print("Fetching ByMykel en skins…")
en_skins  = fetch_json("https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/skins.json")
print("Fetching ByMykel zh-CN skins…")
zh_skins  = fetch_json("https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/zh-CN/skins.json")

# id → chinese name
zh_by_id = {s["id"]: s["name"] for s in zh_skins}
# id → english name
en_by_id = {s["id"]: s["name"] for s in en_skins}

# english name → chinese name
en_to_zh = {}
for sid, en_name in en_by_id.items():
    if sid in zh_by_id:
        en_to_zh[en_name] = zh_by_id[sid]

# ── collect all skins used in our data ───────────────────────────────────────

used_skins = set()

def collect(path):
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    for case in data["cases"]:
        for tier_items in case.get("items", {}).values():
            for item in tier_items:
                w = item.get("weapon", "")
                s = item.get("skin", "")
                if w and s:
                    used_skins.add(f"{w} | {s}")

collect(ROOT / "public/data/cases.json")
collect(ROOT / "public/data/souvenirs.json")
print(f"Unique skins in data: {len(used_skins)}")

# ── build translation map ─────────────────────────────────────────────────────

# Our data uses shortened weapon names vs ByMykel in some cases.
WEAPON_ALIASES = {"Bizon": "PP-Bizon"}

# Some China-exclusive skins are stored in ByMykel with Chinese + English in parens:
# "M4A4 | 龍王 (Dragon King)" — build a reverse lookup keyed by the English part.
alt_lookup = {}
for sid, en_name in en_by_id.items():
    m = re.match(r"^(.+?) \| .+ \((.+)\)$", en_name)
    if m and sid in zh_by_id:
        alt_key = f"{m.group(1)} | {m.group(2)}"
        alt_lookup[alt_key] = zh_by_id[sid]

def normalize_key(weapon, skin):
    """Return the ByMykel-style English name for a weapon+skin pair."""
    bw = WEAPON_ALIASES.get(weapon, weapon)
    if skin.startswith("★"):
        bare = skin[1:].strip()
        if bare.lower() == "vanilla":
            return f"★ {bw}"
        return f"★ {bw} | {bare}"
    return f"{bw} | {skin}"

translations = {}
missing = []

for full_name in sorted(used_skins):
    parts = full_name.split(" | ", 1)
    if len(parts) != 2:
        continue
    weapon, skin = parts[0], parts[1]

    bymykel_key = normalize_key(weapon, skin)
    zh = en_to_zh.get(bymykel_key) or en_to_zh.get(full_name) or alt_lookup.get(full_name)

    if zh:
        translations[full_name] = zh
    else:
        missing.append(full_name)

print(f"Matched:  {len(translations)}")
print(f"Missing:  {len(missing)}")
if missing:
    print("  Sample missing:", missing[:5])

# ── inject into zh-CN.js ──────────────────────────────────────────────────────

zh_cn_path = ROOT / "src/foundation/languages/zh-CN.js"
content = zh_cn_path.read_text(encoding="utf-8")

# Build the block to inject
lines = ["  // Skin names (from ByMykel zh-CN)"]
for en_name, zh_name in sorted(translations.items()):
    key = en_name.replace("'", "\\'")
    val = zh_name.replace("'", "\\'")
    lines.append(f"  'skin_name.{key}': '{val}',")

block = "\n".join(lines)

# Replace existing block if present, otherwise insert before // Market
marker_start = "  // Skin names (from ByMykel zh-CN)"
marker_end   = "\n\n  // Market"

if marker_start in content:
    # remove old block
    start_idx = content.index(marker_start)
    end_idx   = content.index("\n\n  // Market", start_idx)
    content   = content[:start_idx] + content[end_idx:]

# Insert before // Market
content = content.replace("\n\n  // Market", f"\n\n{block}\n\n  // Market")

zh_cn_path.write_text(content, encoding="utf-8")
print(f"Written to {zh_cn_path}")
