#!/usr/bin/env python3
"""Patch null image_urls in others.json using Steam Market search API."""
import json, urllib.request, urllib.parse, time, sys

OTHERS_PATH = 'public/data/others.json'
MARKET_BASE = 'https://steamcommunity.com/market/search/render/?appid=730&norender=1&count=1&query='

def steam_image(name):
    url = MARKET_BASE + urllib.parse.quote(name)
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as r:
            data = json.loads(r.read())
        results = data.get('results', [])
        if results:
            icon = results[0].get('asset_description', {}).get('icon_url', '')
            if icon:
                return f'https://community.akamai.steamstatic.com/economy/image/{icon}'
    except Exception as e:
        print(f'  ERROR fetching {name!r}: {e}', file=sys.stderr)
    return None

with open(OTHERS_PATH) as f:
    data = json.load(f)

patched = 0
charm_capsules = [c for c in data.get('capsules', []) if c.get('type') == 'charm_capsule']

for capsule in charm_capsules:
    # Patch container image
    if not capsule.get('image_url'):
        print(f'Fetching container: {capsule["name"]}')
        url = steam_image(capsule['name'])
        if url:
            capsule['image_url'] = url
            patched += 1
            print(f'  → OK')
        else:
            print(f'  → NOT FOUND')
        time.sleep(1.2)

    # Patch individual charm images
    for tier_items in capsule.get('tiers', {}).values():
        for item in tier_items:
            if not item.get('image_url'):
                name = item['name']
                print(f'Fetching charm: {name}')
                url = steam_image(name)
                if url:
                    item['image_url'] = url
                    patched += 1
                    print(f'  → OK')
                else:
                    print(f'  → NOT FOUND')
                time.sleep(1.2)

with open(OTHERS_PATH, 'w') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print(f'\nDone. Patched {patched} image(s).')
