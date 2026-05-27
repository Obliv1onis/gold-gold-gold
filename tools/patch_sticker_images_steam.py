#!/usr/bin/env python3
"""
Fetch missing sticker image_urls from Steam Market search API.
Saves progress every SAVE_INTERVAL items — safe to kill and resume.
Run with: python3 -u tools/patch_sticker_images_steam.py
"""
import json, urllib.request, urllib.parse, time, sys

DELAY_S      = 5.0    # seconds between requests (avoid 429)
SAVE_INTERVAL = 50    # save to disk every N successful fetches
DATA_FILE    = 'public/data/capsules.json'

def fetch_steam_image(mhn):
    params = urllib.parse.urlencode({
        'norender': '1', 'query': mhn, 'appid': '730',
        'start': '0', 'count': '1', 'language': 'english',
    })
    url = f'https://steamcommunity.com/market/search/render/?{params}'
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    delay = DELAY_S
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                data = json.loads(r.read())
            results = data.get('results') or []
            if not results:
                return None
            icon = results[0].get('asset_description', {}).get('icon_url')
            if not icon:
                return None
            return f'https://community.akamai.steamstatic.com/economy/image/{icon}/360fx360f'
        except urllib.error.HTTPError as e:
            if e.code == 429:
                print(f'    429 — waiting {delay:.0f}s...', flush=True)
                time.sleep(delay)
                delay = min(delay * 2, 60)
            else:
                print(f'    HTTP {e.code} for: {mhn}', flush=True)
                return None
        except Exception as e:
            print(f'    Error for "{mhn}": {e}', flush=True)
            return None
    return None

with open(DATA_FILE) as f:
    data = json.load(f)

# Collect missing items grouped by unique mhn
unique_mhn: dict[str, list] = {}
for cap in data['capsules']:
    for rarity, items in cap['tiers'].items():
        for item in items:
            if not item.get('image_url'):
                mhn = item.get('market_hash_name', '')
                if mhn:
                    unique_mhn.setdefault(mhn, []).append(item)

total = len(unique_mhn)
print(f'Missing images for {total} unique sticker names', flush=True)
if total == 0:
    print('Nothing to do.')
    sys.exit(0)

found = skipped = 0
save_queue = 0

for i, (mhn, items) in enumerate(unique_mhn.items(), 1):
    print(f'[{i}/{total}] {mhn}', flush=True)
    img = fetch_steam_image(mhn)
    if img:
        for item in items:
            item['image_url'] = img
        found += 1
        save_queue += 1
    else:
        skipped += 1

    if save_queue >= SAVE_INTERVAL:
        with open(DATA_FILE, 'w') as f:
            json.dump(data, f, indent=2)
        print(f'  -> Saved progress ({found} found so far)', flush=True)
        save_queue = 0

    time.sleep(DELAY_S)

# Final save
with open(DATA_FILE, 'w') as f:
    json.dump(data, f, indent=2)

print(f'\n=== Done ===')
print(f'Found: {found}, No image: {skipped}')
print(f'Remaining missing: {skipped}')
