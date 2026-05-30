#!/usr/bin/env python3
"""Add Sealed Genesis Terminal and Sealed Dead Hand Terminal to cases.json.
Fetches skin images from ByMykel skins API."""
import json, re, urllib.request

def slug(s):
    return re.sub(r'[^a-z0-9]+', '_', s.lower()).strip('_')

def avg(a, b):
    return round((a + b) / 2, 2)

def item(weapon, skin, prefix, price, img=None):
    return {
        'weapon':       weapon,
        'skin':         skin,
        'item_id':      f'{prefix}{slug(weapon)}_{slug(skin)}',
        'image_url':    img,
        'market_price': price,
        'stattrak':     False,
    }

# ── skin data ─────────────────────────────────────────────────────────────────

GENESIS_ITEMS = {
    'covert': [
        item('AK-47',          'Golden Dynasty',    'genesis_', avg(37.39, 276.15)),
        item('M4A4',           'Wavebreaker',       'genesis_', avg(28.08, 206.69)),
    ],
    'classified': [
        item('AWP',            'Methane Ice',       'genesis_', avg(4.66, 31.04)),
        item('MP7',            'Hazardous Smoking', 'genesis_', avg(3.94, 27.85)),
        item('Glock-18',       'Mirror Mosaic',     'genesis_', avg(3.98, 25.94)),
    ],
    'restricted': [
        item('M4A1-S',         'Liquefaction',      'genesis_', avg(0.95, 10.79)),
        item('MAC-10',         'Paper Tiger',       'genesis_', avg(0.40, 3.03)),
        item('UMP-45',         'Continuum',         'genesis_', avg(0.38, 2.84)),
        item('Dual Berettas',  'Sky Arrow',         'genesis_', avg(0.38, 2.86)),
        item('Nova',           'Eyepiece',          'genesis_', avg(0.43, 2.84)),
    ],
    'mil_spec': [
        item('AUG',            'Counter-Strike',    'genesis_', avg(0.06, 0.88)),
        item('MAG-7',          'Magnitude',         'genesis_', avg(0.06, 0.88)),
        item('MP5-SD',         'Focus',             'genesis_', avg(0.06, 0.85)),
        item('MP9',            'Bootleg Vinyl',     'genesis_', avg(0.06, 0.80)),
        item('P2000',          'Red Wing',          'genesis_', avg(0.06, 0.86)),
        item('P250',           'Bullfrog',          'genesis_', avg(0.06, 0.87)),
        item('SCAR-20',        'Cage',              'genesis_', avg(0.05, 0.90)),
    ],
}

DEADHAND_ITEMS = {
    'covert': [
        item('AWP',            "Queen's Gambit",    'deadhand_', avg(40.28, 262.93)),
        item('Glock-18',       'Peak Performance',  'deadhand_', avg(38.43, 206.85)),
    ],
    'classified': [
        item('AK-47',          'Soaring Crane',     'deadhand_', avg(10.92, 81.12)),
        item('P250',           'Kintsugi',          'deadhand_', avg(4.06, 23.77)),
        item('P90',            "Medusa's Gaze",     'deadhand_', avg(4.21, 22.76)),
    ],
    'restricted': [
        item('M4A1-S',         'Green Amber',       'deadhand_', avg(0.91, 9.75)),
        item('MP7',            'Amber Fade',        'deadhand_', avg(0.54, 5.16)),
        item('MP9',            'Urban Overlord',    'deadhand_', avg(0.53, 4.92)),
        item('Galil AR',       'Croc',              'deadhand_', avg(0.54, 5.42)),
        item('Desert Eagle',   'Frostflame',        'deadhand_', avg(0.71, 6.70)),
    ],
    'mil_spec': [
        item('Five-SeveN',     'Night Polymer',     'deadhand_', avg(0.06, 1.02)),
        item('M249',           'Block Matrix',      'deadhand_', avg(0.06, 0.90)),
        item('M4A4',           'Jagged Edge',       'deadhand_', avg(0.06, 1.13)),
        item('PP-Bizon',       'Remix',             'deadhand_', avg(0.07, 1.22)),
        item('UMP-45',         'Kill Time',         'deadhand_', avg(0.06, 0.98)),
        item('USP-S',          'Silent Strike',     'deadhand_', avg(0.24, 2.23)),
        item('Sawed-Off',      'Fusion',            'deadhand_', avg(0.06, 0.88)),
    ],
}

WEIGHTS = {'mil_spec': 80.13, 'restricted': 16.02, 'classified': 3.21, 'covert': 0.64}

TERMINALS = [
    {
        'id':             'terminal_genesis',
        'name':           'Sealed Genesis Terminal',
        'release_date':   '2024-07-01',
        'type':           'terminal',
        'image_url':      None,
        'market_price':   0.38,
        'rarity_weights': WEIGHTS,
        'items':          GENESIS_ITEMS,
    },
    {
        'id':             'terminal_dead_hand',
        'name':           'Sealed Dead Hand Terminal',
        'release_date':   '2024-07-01',
        'type':           'terminal',
        'image_url':      None,
        'market_price':   1.84,
        'rarity_weights': WEIGHTS,
        'items':          DEADHAND_ITEMS,
    },
]

# ── fetch images ───────────────────────────────────────────────────────────────

def fetch_image_lookup():
    url = 'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/skins.json'
    print(f'Fetching {url}…')
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=60) as r:
        skins = json.loads(r.read().decode())
    lookup = {}
    for s in skins:
        name = s.get('name', '')
        img  = s.get('image', '') or ''
        if '|' in name and img and name not in lookup:
            lookup[name] = img
    print(f'  {len(lookup)} skin images loaded.')
    return lookup

def patch_images(terminals, imgs):
    patched = missing = 0
    for t in terminals:
        for rarity, items in t['items'].items():
            for it in items:
                key = f'{it["weapon"]} | {it["skin"]}'
                if key in imgs:
                    it['image_url'] = imgs[key]
                    patched += 1
                else:
                    missing += 1
                    print(f'  No image: {key}')
    print(f'  Patched {patched}, missing {missing}')

# ── update cases.json ──────────────────────────────────────────────────────────

def main():
    imgs = fetch_image_lookup()
    patch_images(TERMINALS, imgs)

    with open('public/data/cases.json') as f:
        data = json.load(f)

    # Remove any existing terminal entries first (idempotent re-run)
    terminal_ids = {t['id'] for t in TERMINALS}
    data['cases'] = [c for c in data['cases'] if c['id'] not in terminal_ids]

    # Insert terminals at the front (newest first)
    data['cases'] = TERMINALS + data['cases']

    with open('public/data/cases.json', 'w') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f'Added {len(TERMINALS)} terminal(s) to cases.json.')

if __name__ == '__main__':
    main()
