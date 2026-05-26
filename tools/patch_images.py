#!/usr/bin/env python3
"""Patch image_url into souvenirs.json and cases.json from ByMykel CSGO-API."""
import json, re, urllib.request

def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())

BASE = 'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/'
print('Fetching ByMykel API...')
crates = fetch(BASE + 'crates.json')
skins  = fetch(BASE + 'skins.json')
print(f'  Crates: {len(crates)}, Skins: {len(skins)}')

# ── Package image lookup ───────────────────────────────────────────────────────
# Build: ByMykel name → image
bymy_pkg = {c['name']: c['image'] for c in crates if c.get('image') and 'Souvenir' in c.get('name', '')}

# Tournament prefix map: our prefix → ByMykel prefix
TOURNAMENT_MAP = {
    'ESL One Cologne 2014': 'ESL One Cologne 2014',
    'ESL One Katowice 2015': 'ESL One Katowice 2015',
    'ESL One Cologne 2015': 'ESL One Cologne 2015',
    'DreamHack Cluj-Napoca 2015': 'DreamHack Cluj-Napoca 2015',
    'MLG Columbus 2016': 'MLG Columbus 2016',
    'ESL One Cologne 2016': 'Cologne 2016',
    'ELEAGUE Atlanta 2017': 'Atlanta 2017',
    'PGL Krakow 2017': 'Krakow 2017',
    'ELEAGUE Boston 2018': 'Boston 2018',
    'FACEIT London 2018': 'London 2018',
    'IEM Katowice 2019': 'Katowice 2019',
    'StarLadder Berlin 2019': 'Berlin 2019',
    'PGL Stockholm 2021': 'Stockholm 2021',
    'PGL Antwerp 2022': 'Antwerp 2022',
    'IEM Rio 2022': 'Rio 2022',
    'BLAST.tv Paris 2023': 'Paris 2023',
    'PGL Copenhagen 2024': 'Copenhagen 2024',
    'Perfect World Shanghai 2024': 'Shanghai 2024',
    'BLAST Austin 2025': 'Austin 2025',
}

# Map name normalizer: strip year suffixes so "Nuke 2018" → "Nuke" etc.
MAP_NORM = re.compile(r'\s+20\d\d$')

# Special cases: our full name → ByMykel name
SPECIAL = {
    # DreamHack 2013: ByMykel has one generic package, no per-map split
    'DreamHack 2013 Dust II Souvenir Package':   'DreamHack 2013 Souvenir Package',
    'DreamHack 2013 Mirage Souvenir Package':    'DreamHack 2013 Souvenir Package',
    'DreamHack 2013 Inferno Souvenir Package':   'DreamHack 2013 Souvenir Package',
    'DreamHack 2013 Nuke Souvenir Package':      'DreamHack 2013 Souvenir Package',
    'DreamHack 2013 Train Souvenir Package':     'DreamHack 2013 Souvenir Package',
    # EMS One Katowice 2014: ByMykel has one generic package
    'EMS One Katowice 2014 Dust II Souvenir Package':   'EMS One 2014 Souvenir Package',
    'EMS One Katowice 2014 Mirage Souvenir Package':    'EMS One 2014 Souvenir Package',
    'EMS One Katowice 2014 Inferno Souvenir Package':   'EMS One 2014 Souvenir Package',
    'EMS One Katowice 2014 Nuke Souvenir Package':      'EMS One 2014 Souvenir Package',
    'EMS One Katowice 2014 Train Souvenir Package':     'EMS One 2014 Souvenir Package',
    # DreamHack Winter 2014: ByMykel drops "Winter"
    'DreamHack Winter 2014 Dust II Souvenir Package':      'DreamHack 2014 Dust II Souvenir Package',
    'DreamHack Winter 2014 Mirage Souvenir Package':       'DreamHack 2014 Mirage Souvenir Package',
    'DreamHack Winter 2014 Inferno Souvenir Package':      'DreamHack 2014 Inferno Souvenir Package',
    'DreamHack Winter 2014 Nuke Souvenir Package':         'DreamHack 2014 Nuke Souvenir Package',
    'DreamHack Winter 2014 Cache Souvenir Package':        'DreamHack 2014 Cache Souvenir Package',
    'DreamHack Winter 2014 Cobblestone Souvenir Package':  'DreamHack 2014 Cobblestone Souvenir Package',
}

def find_image(our_name):
    # 1. Exact match
    if our_name in bymy_pkg:
        return bymy_pkg[our_name]
    # 2. Special case
    if our_name in SPECIAL:
        return bymy_pkg.get(SPECIAL[our_name])
    # 3. Tournament prefix + map normalization
    # Strip "Souvenir Package" suffix to get "TOURNAMENT MAP"
    base = our_name.replace(' Souvenir Package', '')
    for our_prefix, bymy_prefix in TOURNAMENT_MAP.items():
        if base.startswith(our_prefix + ' '):
            map_part = base[len(our_prefix)+1:]
            # Normalize map name: strip year suffix (e.g. "Nuke 2018" → "Nuke")
            map_norm = MAP_NORM.sub('', map_part)
            candidate = f'{bymy_prefix} {map_norm} Souvenir Package'
            if candidate in bymy_pkg:
                return bymy_pkg[candidate]
            # Also try without normalization
            candidate2 = f'{bymy_prefix} {map_part} Souvenir Package'
            if candidate2 in bymy_pkg:
                return bymy_pkg[candidate2]
    return None

# ── Skin image lookup ─────────────────────────────────────────────────────────
# Sanitization fixes: our stored name → ByMykel canonical name
SKIN_FIXES = {
    'XM1014 | Cali Camo':          'XM1014 | CaliCamo',
    'Bizon | Irradiated Alert':     'PP-Bizon | Irradiated Alert',
    'Galil AR | CAUTION':           'Galil AR | CAUTION!',
    'P250 | Black Tan':             'P250 | Black & Tan',
    "P250 | Apeps Curse":           "P250 | Apep's Curse",
    "Glock-18 | Rameses Reach":     "Glock-18 | Ramese's Reach",
    "Nova | Sobeks Bite":           "Nova | Sobek's Bite",
    "Tec-9 | Mummys Rot":           "Tec-9 | Mummy's Rot",
    # Weapon case skin fixes
    'Tec-9 | Cut':                  'Tec-9 | Cut Out',
}

skin_img = {s['name']: s['image'] for s in skins if s.get('image') and s.get('name')}

def find_skin(weapon, skin):
    key = f'{weapon} | {skin}'
    img = skin_img.get(key)
    if img:
        return img
    fixed_key = SKIN_FIXES.get(key)
    if fixed_key:
        return skin_img.get(fixed_key)
    return None

# ── Patch souvenirs.json ──────────────────────────────────────────────────────
with open('public/data/souvenirs.json') as f:
    souvenirs = json.load(f)

pkg_found = pkg_missing = 0
skin_found_s = skin_missing_s = 0

for pkg in souvenirs['cases']:
    if pkg['image_url'] is None:
        img = find_image(pkg['name'])
        if img:
            pkg['image_url'] = img
            pkg_found += 1
        else:
            pkg_missing += 1
    for rarity, items in pkg['items'].items():
        for item in items:
            if item['image_url'] is None:
                img = find_skin(item['weapon'], item['skin'])
                if img:
                    item['image_url'] = img
                    skin_found_s += 1
                else:
                    skin_missing_s += 1

# ── Package image fallback: use a sibling package from the same tournament ────
# For packages ByMykel has no entry for, borrow an image from another package
# in the same tournament (all packages for a tournament share the same artwork).
name_to_pkg = {p['name']: p for p in souvenirs['cases']}

TOURNAMENT_FALLBACK_ORDER = [
    # (missing package name, sibling package to copy image from)
    ('ESL One Cologne 2015 Nuke Souvenir Package',
     'ESL One Cologne 2015 Dust II Souvenir Package'),
    ('DreamHack Cluj-Napoca 2015 Nuke Souvenir Package',
     'DreamHack Cluj-Napoca 2015 Dust II Souvenir Package'),
    ('BLAST Austin 2025 Vertigo 2021 Souvenir Package',
     'BLAST Austin 2025 Mirage 2021 Souvenir Package'),
]
for missing_name, sibling_name in TOURNAMENT_FALLBACK_ORDER:
    pkg = name_to_pkg.get(missing_name)
    sibling = name_to_pkg.get(sibling_name)
    if pkg and pkg['image_url'] is None and sibling and sibling.get('image_url'):
        pkg['image_url'] = sibling['image_url']
        pkg_found += 1
        pkg_missing -= 1

with open('public/data/souvenirs.json', 'w') as f:
    json.dump(souvenirs, f, indent=2)

print(f'\nsouvenirs.json  packages: {pkg_found} images found, {pkg_missing} still missing')
print(f'souvenirs.json  skins:    {skin_found_s} images found, {skin_missing_s} still missing')

# Show which packages are still missing images
if pkg_missing > 0:
    missing_pkgs = [p['name'] for p in souvenirs['cases'] if p['image_url'] is None]
    print('  Missing packages:')
    for m in missing_pkgs:
        print(f'    - {m}')

# ── Patch cases.json (weapon case skin images) ────────────────────────────────
with open('public/data/cases.json') as f:
    cases = json.load(f)

skin_found_c = skin_missing_c = 0
for case in cases['cases']:
    for rarity, items in case.get('items', {}).items():
        for item in items:
            if item.get('image_url') is None:
                img = find_skin(item['weapon'], item['skin'])
                if img:
                    item['image_url'] = img
                    skin_found_c += 1
                else:
                    skin_missing_c += 1

with open('public/data/cases.json', 'w') as f:
    json.dump(cases, f, indent=2)

print(f'\ncases.json      skins:    {skin_found_c} images found, {skin_missing_c} still missing')
