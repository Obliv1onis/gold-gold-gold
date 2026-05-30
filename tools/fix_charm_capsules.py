#!/usr/bin/env python3
"""Replace charm capsule contents with real CS2 charm data from ByMykel."""
import json, urllib.request, urllib.parse, time, sys

OTHERS_PATH = 'public/data/others.json'
KEYCHAINS_URL = 'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/keychains.json'
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
        print(f'  ERROR: {e}', file=sys.stderr)
    return None

# Load keychains
print('Loading keychains...')
with urllib.request.urlopen(KEYCHAINS_URL, timeout=15) as r:
    keychains = json.loads(r.read())

# Group by collection
from collections import defaultdict
by_collection = defaultdict(list)
for k in keychains:
    for col in k.get('collections', []):
        by_collection[col['name']].append({
            'name': k['name'],
            'market_hash_name': k.get('market_hash_name', k['name']),
            'image_url': k.get('image', ''),
            'market_price': 0.10,
        })

# Load others.json
with open(OTHERS_PATH) as f:
    data = json.load(f)

capsules = data.get('capsules', [])

for capsule in capsules:
    if capsule.get('type') != 'charm_capsule':
        continue

    cid = capsule['id']
    print(f'\n=== {capsule["name"]} ===')

    # Assign correct collection
    if cid == 'small_arms_charm_capsule':
        collection_name = 'Small Arms Charm Collection'
    elif cid == 'missing_link_charm_capsule':
        collection_name = 'Missing Link Charm Collection'
    else:
        print(f'  Unknown capsule id: {cid}, skipping')
        continue

    charms = by_collection.get(collection_name, [])
    if charms:
        capsule['tiers'] = {'high_grade': charms}
        print(f'  Replaced tiers with {len(charms)} real charms from {collection_name!r}')
    else:
        print(f'  WARNING: No charms found for {collection_name!r}')

    # Fetch container image if missing
    if not capsule.get('image_url'):
        print(f'  Fetching container image...')
        url = steam_image(capsule['name'])
        if url:
            capsule['image_url'] = url
            print(f'  → Container image OK')
        else:
            print(f'  → Container image NOT FOUND, using first charm image as fallback')
            if charms and charms[0].get('image_url'):
                capsule['image_url'] = charms[0]['image_url']
        time.sleep(1.2)

# Save
with open(OTHERS_PATH, 'w') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print('\nDone. Saved patched others.json.')
