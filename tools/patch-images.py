#!/usr/bin/env python3
"""
Patch cases.json with real image URLs from the ByMykel CSGO-API data.
Run after generate-cases.py.
Usage: python3 tools/patch-images.py
"""
import json, os, re

ROOT = os.path.join(os.path.dirname(__file__), '..')
CASES_PATH   = os.path.join(ROOT, 'public', 'data', 'cases.json')
CRATES_PATH  = '/tmp/cs2_crates.json'
SKINS_PATH   = '/tmp/cs2_skins.json'

# ── Load API data ─────────────────────────────────────────────────────────────

crates = json.load(open(CRATES_PATH))
skins  = json.load(open(SKINS_PATH))

# Case name → image URL
case_imgs = {c['name']: c['image'] for c in crates if c.get('image')}

# Skin full name → image URL  (first occurrence wins, avoids Doppler-phase collisions)
# Include entries without '|' so vanilla knives like '★ Karambit' are found.
skin_imgs = {}
for s in skins:
    name = s.get('name', '')
    img  = s.get('image', '')
    if name and img and name not in skin_imgs:
        skin_imgs[name] = img

print(f"Loaded {len(case_imgs)} case images, {len(skin_imgs)} skin images")

# Aliases where our name differs from the API name
SKIN_ALIASES = {
    'M4A4 | Dragon King': 'M4A4 | 龍王 (Dragon King)',
}

# ── Build lookup key for each item ────────────────────────────────────────────

def skin_lookup_key(weapon, skin):
    """
    Map our (weapon, skin) pair to the ByMykel API name.

    Regular weapons: 'AK-47 | Fire Serpent'
    Knives/gloves:   '★ Karambit | Fade'  or  '★ Karambit'  (vanilla — no pipe)
    """
    if skin.startswith('★'):
        bare = skin.lstrip('★').strip()
        if bare.lower() == 'vanilla':
            return f'★ {weapon}'      # vanilla: no pipe, just the weapon name
        return f'★ {weapon} | {bare}'
    return f'{weapon} | {skin}'

# ── Patch cases.json ──────────────────────────────────────────────────────────

data = json.load(open(CASES_PATH))

case_hits = case_miss = 0
item_hits = item_miss = 0
misses = []

for c in data['cases']:
    # Case image
    api_img = case_imgs.get(c['name'])
    if api_img:
        c['image_url'] = api_img
        case_hits += 1
    else:
        case_miss += 1
        misses.append(f'[CASE] {c["name"]}')

    # Item images
    for rarity, items in c['items'].items():
        for item in items:
            key = skin_lookup_key(item['weapon'], item['skin'])
            resolved = SKIN_ALIASES.get(key, key)
            api_img = skin_imgs.get(resolved)
            if api_img:
                item['image_url'] = api_img
                item_hits += 1
            else:
                item_miss += 1
                misses.append(f'[SKIN] {key}')

# Write patched file
with open(CASES_PATH, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print(f"\nCase images: {case_hits} patched, {case_miss} missing")
print(f"Skin images: {item_hits} patched, {item_miss} missing")

if misses:
    print(f"\nMissing ({len(misses)}):")
    for m in misses[:30]:
        print(f"  {m}")
    if len(misses) > 30:
        print(f"  ... and {len(misses)-30} more")
