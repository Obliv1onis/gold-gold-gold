#!/usr/bin/env python3
"""
Patches missing image_url fields in public/data/others.json
using Steam Market search results.

Run: python3 -u tools/patch_others_images.py
"""

import json, urllib.request, urllib.parse, time, sys, re

DATA_FILE    = 'public/data/others.json'
DELAY        = 3.5          # seconds between Steam API calls
SAVE_EVERY   = 10           # save progress every N successful fetches
ICON_BASE    = 'https://community.akamai.steamstatic.com/economy/image/'

def steam_search(query, count=10):
    url = (
        'https://steamcommunity.com/market/search/render/'
        f'?norender=1&appid=730&query={urllib.parse.quote(query)}&start=0&count={count}'
    )
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    delay = DELAY
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=15) as r:
                return json.loads(r.read()).get('results', [])
        except urllib.error.HTTPError as e:
            if e.code == 429:
                wait = delay * (2 ** attempt)
                print(f'  429 — waiting {wait:.0f}s', flush=True)
                time.sleep(wait)
            else:
                return []
        except Exception:
            return []
    return []

def best_icon(results, target_name):
    """Return icon_url for the result whose hash_name best matches target_name."""
    target_norm = re.sub(r'\s+', ' ', target_name.lower().strip())
    # Exact hash_name match first
    for r in results:
        hn = r.get('hash_name', '')
        if re.sub(r'\s+', ' ', hn.lower().strip()) == target_norm:
            icon = r.get('asset_description', {}).get('icon_url', '')
            if icon:
                return ICON_BASE + icon
    # Fallback: first result that contains the target
    for r in results:
        hn = r.get('hash_name', '')
        icon = r.get('asset_description', {}).get('icon_url', '')
        if target_norm in hn.lower() and icon:
            return ICON_BASE + icon
    return None

def icon_from_search(name):
    results = steam_search(name)
    return best_icon(results, name)

# ─────────────────────────────────────────────────────────────────────────────

with open(DATA_FILE) as f:
    data = json.load(f)

# Collect all work: (capsule_idx, 'container'|item_idx_in_tier)
work = []
for ci, cap in enumerate(data['capsules']):
    if not cap.get('image_url'):
        work.append(('container', ci, cap['name']))
    for ii, item in enumerate(cap['tiers'].get('high_grade', [])):
        if not item.get('image_url'):
            work.append(('item', ci, ii, item['name']))

print(f'Items to patch: {len(work)}', flush=True)
if not work:
    print('Nothing to do.')
    sys.exit(0)

found = 0
missed = 0
save_pending = 0

for i, entry in enumerate(work):
    kind = entry[0]
    name = entry[-1]
    print(f'[{i+1}/{len(work)}] {kind}: {name}', flush=True)

    icon = icon_from_search(name)
    time.sleep(DELAY)

    if icon:
        if kind == 'container':
            _, ci, _ = entry
            data['capsules'][ci]['image_url'] = icon
        else:
            _, ci, ii, _ = entry
            data['capsules'][ci]['tiers']['high_grade'][ii]['image_url'] = icon
        found += 1
        save_pending += 1
        print(f'  ✓ found', flush=True)
    else:
        missed += 1
        print(f'  ✗ not found', flush=True)

    if save_pending >= SAVE_EVERY:
        with open(DATA_FILE, 'w') as f:
            json.dump(data, f, indent=2)
        print(f'  → saved progress ({found} found so far)', flush=True)
        save_pending = 0

with open(DATA_FILE, 'w') as f:
    json.dump(data, f, indent=2)

still_missing = sum(
    1 for cap in data['capsules']
    for item in cap['tiers'].get('high_grade', [])
    if not item.get('image_url')
)
container_missing = sum(1 for cap in data['capsules'] if not cap.get('image_url'))

print(f'\n=== Done ===', flush=True)
print(f'Found: {found}  Missed: {missed}', flush=True)
print(f'Remaining: {still_missing} items, {container_missing} containers without images', flush=True)
