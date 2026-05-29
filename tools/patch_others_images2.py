#!/usr/bin/env python3
"""
Second-pass image patcher for others.json.
Uses ByMykel name mappings + Steam CDN for containers.

Run: python3 -u tools/patch_others_images2.py
"""

import json, urllib.request, urllib.parse, re, time, sys

DATA_FILE = 'public/data/others.json'
DELAY     = 3.0
BYMYKEL   = 'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en'
ICON_BASE = 'https://community.akamai.steamstatic.com/economy/image/'

def fetch_json(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read())

def norm(s):
    return re.sub(r'\s+', ' ', s.lower().strip())

# ── Load ByMykel databases ────────────────────────────────────────────────────
print('Loading ByMykel data...', flush=True)
patches    = fetch_json(f'{BYMYKEL}/patches.json');    time.sleep(DELAY)
keychains  = fetch_json(f'{BYMYKEL}/keychains.json');  time.sleep(DELAY)
music_kits = fetch_json(f'{BYMYKEL}/music_kits.json'); time.sleep(DELAY)
crates     = fetch_json(f'{BYMYKEL}/crates.json');     time.sleep(DELAY)
collectibles = fetch_json(f'{BYMYKEL}/collectibles.json')

patch_db = {norm(p['name']): p['image'] for p in patches    if p.get('name') and p.get('image')}
kc_db    = {norm(k['name']): k['image'] for k in keychains  if k.get('name') and k.get('image')}
mk_db    = {norm(m['name']): m['image'] for m in music_kits if m.get('name') and m.get('image')}
cr_db    = {norm(c['name']): c['image'] for c in crates      if c.get('name') and c.get('image')}
pin_db   = {norm(p['name']): p['image'] for p in collectibles if p.get('name') and p.get('image')}

print(f'  patches:{len(patch_db)} keychains:{len(kc_db)} music_kits:{len(mk_db)} crates:{len(cr_db)} pins:{len(pin_db)}', flush=True)

# ── Name → ByMykel-name mappings ────────────────────────────────────────────
# game name  →  ByMykel lookup key (lowercased)

PATCH_MAP = {
    # CS:GO Patch Pack
    'patch | dragon lore':             'patch | dragon',
    "patch | ol' reliable":            'patch | ol reliable',
    'patch | clutch king':             'patch | welcome to the clutch',
    'patch | boss':                    'patch | the boss',
    'patch | dead eye':                'patch | dead eye',
    'patch | aces high':               'patch | aces high',
    # Half-Life: Alyx Patch Pack
    'patch | headcrab':                'patch | headcrab glyph',
    'patch | civil protection':        'patch | civil protection',
    'patch | combine grub':            'patch | combine grub',
    'patch | health pen':              'patch | health pen',
    'patch | strider':                 'patch | strider',
    # Metal Skill Groups (Silver → same image, Gold Nova → tier images)
    'patch | silver i':                'patch | metal silver',
    'patch | silver ii':               'patch | metal silver',
    'patch | silver iii':              'patch | metal silver',
    'patch | silver iv':               'patch | metal silver',
    'patch | silver elite':            'patch | metal silver demon',
    'patch | silver elite master':     'patch | metal silver demon',
    'patch | gold nova i':             'patch | metal gold nova i',
    'patch | gold nova ii':            'patch | metal gold nova',
    'patch | gold nova iii':           'patch | metal gold nova',
    'patch | gold nova master':        'patch | metal gold nova master',
    'patch | master guardian i':       'patch | metal master guardian i',
    'patch | master guardian ii':      'patch | metal master guardian elite',
    'patch | master guardian elite':   'patch | metal master guardian elite',
    'patch | distinguished master guardian': 'patch | metal distinguished master guardian ★',
    'patch | legendary eagle':         'patch | metal legendary eagle',
    'patch | legendary eagle master':  'patch | metal legendary eagle master ★',
    'patch | supreme master first class': 'patch | metal supreme master first class',
    'patch | the global elite':        'patch | metal the global elite ★',
    # Operation Broken Fang Patch Pack
    'patch | broken fang':             'patch | broken fang',
    'patch | bloody diamond':          'patch | bloody diamond',
    'patch | ancient beast':           'patch | ancient beast',
    'patch | battle scarred':          'patch | battle scarred',
    'patch | medusa':                  'patch | medusa',
    'patch | stone omega':             'patch | stone omega',
    'patch | coil strike':             'patch | coil strike',
    'patch | surgical strike':         'patch | surgical strike',
    'patch | enemy spotted':           'patch | enemy spotted',
    'patch | swat':                    'patch | swat',
    'patch | street drummer':          'patch | street drummer',
    'patch | tiger pit':               'patch | tiger pit',
    'patch | we can do it':            'patch | we can do it',
    'patch | tattered':                'patch | tattered',
    # Operation Riptide Patch Pack
    'patch | operation riptide':       'patch | operation riptide',
    'patch | liquid gold':             'patch | liquid gold',
    'patch | blood in the water':      'patch | blood in the water',
    'patch | brainwash':               'patch | brainwash',
    'patch | chemical hazard':         'patch | chemical hazard',
    'patch | death roll':              'patch | death roll',
    'patch | diving frog':             'patch | diving frog',
    'patch | great wave':              'patch | great wave',
    'patch | guerilla podcast':        'patch | guerilla podcast',
    'patch | hard knocks':             'patch | hard knocks',
    'patch | heist':                   'patch | heist',
    'patch | militia outline':         'patch | militia outline',
    'patch | riptide cricket':         'patch | riptide cricket',
    'patch | shark attack':            'patch | shark attack',
}

KEYCHAIN_MAP = {
    # Small Arms Charm Capsule
    'charm | baby karambit':   'charm | baby karambit',
    'charm | pocket awp':      'charm | pocket awp',
    'charm | glock-3000':      'charm | glock-3000',
    'charm | semi-auto':       'charm | semi-auto',
    "charm | lil' squirt":     "charm | lil' squirt",
    'charm | whiskers':        "charm | lil' whiskers",
    'charm | hot sauce':       'charm | hot sauce',
    'charm | taz':             'charm | taz',
    "charm | lil' crump":      "charm | lil' crump",
    "charm | lil' monster":    "charm | lil' monster",
    'charm | pint-sized pizza':'charm | pint-sized pizza',
    "charm | lil' whacker":    "charm | lil' whacker",
    # Missing Link Charm Capsule
    "charm | lil' ava":        "charm | lil' ava",
    "charm | lil' sas":        "charm | lil' sas",
    "charm | lil' larry":      "charm | lil' larry",
    "charm | lil' froman":     "charm | lil' froman",
    "charm | lil' mascot":     "charm | lil' mascot",
    "charm | lil' chef":       "charm | lil' chef",
    'charm | sausage link':    'charm | sausage link',
    'charm | hot dog':         'charm | hot dog',
    'charm | pork chop':       'charm | pork chop',
    'charm | chicken lover':   'charm | chicken lover',
    'charm | diamond eye':     'charm | diamond eye',
    'charm | kittens':         'charm | kittens',
}

PIN_MAP = {
    'guardian ii pin':    'guardian ii pin',
    'valkyrie pin':       'valkyrie pin',
    'águila pin':         'Águila pin',
    'guardian iii pin':   'guardian iii pin',
    'neo-noir pin':       'neo-noir pin',
    'chief pin':          'chief pin',
    'mil-spec pin':       'mil-spec pin',
}

MK_MAP = {
    'music kit | twerl and ekko & sidetrack, under bright lights':
        'music kit | twerl and ekko & sidetrack, under bright lights',
    'music kit | laura shigihara, work hard, play hard':
        'music kit | laura shigihara, work hard, play hard',
    'stattrak™ music kit | laura shigihara, work hard, play hard':
        'stattrak™ music kit | laura shigihara, work hard, play hard',
}

# Music kit box containers: our names vs ByMykel names
CRATE_MAP = {
    'small arms charm capsule':         'small arms charm capsule',
    'missing link charm capsule':       'missing link charm capsule',
    'metal skill groups patch pack':    'metal skill group patch collection',
    'operation broken fang patch pack': 'operation broken fang patch pack',
    'operation riptide patch pack':     'operation riptide patch pack',
    'nightwatch music kit box':         'nightmode music kit box',
    'stattrak™ nightwatch music kit box': 'stattrak™ nightmode music kit box',
    'initiation music kit box':         'initiators music kit box',
    'stattrak™ initiation music kit box': 'stattrak™ initiators music kit box',
    'radicals music kit box':           'radicals box',
    'stattrak™ radicals music kit box': 'stattrak™ radicals box',
}

def lookup_image(item_name):
    n = norm(item_name)
    # Patches
    if n.startswith('patch |'):
        lookup = PATCH_MAP.get(n, n)
        return patch_db.get(lookup)
    # Charms
    if n.startswith('charm |'):
        lookup = KEYCHAIN_MAP.get(n, n)
        return kc_db.get(lookup)
    # Pins
    if n.endswith(' pin'):
        lookup = PIN_MAP.get(n, n)
        img = pin_db.get(lookup) or pin_db.get(norm(lookup))
        return img
    # Music kits
    if 'music kit |' in n or 'stattrak™ music kit' in n:
        lookup = MK_MAP.get(n, n)
        return mk_db.get(lookup) or mk_db.get(n)
    return None

def lookup_container_image(container_name):
    n = norm(container_name)
    mapped = norm(CRATE_MAP.get(n, n))
    return cr_db.get(mapped) or cr_db.get(n)

# ── Patch the data ─────────────────────────────────────────────────────────────

with open(DATA_FILE) as f:
    data = json.load(f)

fixed_items = 0
fixed_containers = 0

for cap in data['capsules']:
    # Fix container image
    if not cap.get('image_url'):
        img = lookup_container_image(cap['name'])
        if img:
            cap['image_url'] = img
            fixed_containers += 1
            print(f'  container ✓ {cap["name"]}', flush=True)
        else:
            print(f'  container ✗ {cap["name"]}', flush=True)

    # Fix item images
    for item in cap['tiers'].get('high_grade', []):
        if item.get('image_url'):
            continue
        img = lookup_image(item['name'])
        if img:
            item['image_url'] = img
            fixed_items += 1
        else:
            print(f'    item ✗ {item["name"]}', flush=True)

with open(DATA_FILE, 'w') as f:
    json.dump(data, f, indent=2)

still_missing_items = sum(
    1 for cap in data['capsules']
    for item in cap['tiers'].get('high_grade', [])
    if not item.get('image_url')
)
still_missing_containers = sum(1 for cap in data['capsules'] if not cap.get('image_url'))

print(f'\nFixed: {fixed_items} items, {fixed_containers} containers', flush=True)
print(f'Still missing: {still_missing_items} items, {still_missing_containers} containers', flush=True)
