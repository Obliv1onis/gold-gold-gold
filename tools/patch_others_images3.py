#!/usr/bin/env python3
"""
Final image patcher — applies all known name mappings in one pass.
Run: python3 -u tools/patch_others_images3.py
"""

import json, urllib.request, re, time

DATA_FILE = 'public/data/others.json'
DELAY = 1.5
BYMYKEL = 'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en'

def fetch_json(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read())

def norm(s): return re.sub(r'\s+', ' ', s.lower().strip())

print('Loading ByMykel...', flush=True)
patches      = fetch_json(f'{BYMYKEL}/patches.json');      time.sleep(DELAY)
keychains    = fetch_json(f'{BYMYKEL}/keychains.json');    time.sleep(DELAY)
music_kits   = fetch_json(f'{BYMYKEL}/music_kits.json');   time.sleep(DELAY)
crates       = fetch_json(f'{BYMYKEL}/crates.json');       time.sleep(DELAY)
collectibles = fetch_json(f'{BYMYKEL}/collectibles.json')

# Build lookup: lowercase name → image URL
def build_db(items):
    return {norm(i['name']): i['image'] for i in items if i.get('name') and i.get('image')}

patch_db = build_db(patches)
kc_db    = build_db(keychains)
mk_db    = build_db(music_kits)
cr_db    = build_db(crates)
pin_db   = build_db(collectibles)

# ── Comprehensive name maps ──────────────────────────────────────────────────

ITEM_MAP = {
    # ── Patches: CS:GO Patch Pack ────────────────────────────────────────────
    'patch | dragon lore':          ('patch', 'patch | dragon'),
    "patch | ol' reliable":         ('patch', "patch | ol' reliable"),
    'patch | clutch king':          ('patch', 'patch | welcome to the clutch'),
    'patch | boss':                 ('patch', 'patch | the boss'),
    'patch | health':               ('patch', 'patch | health'),
    'patch | vigilance':            ('patch', 'patch | vigilance'),
    'patch | dead eye':             ('patch', 'patch | dead eye'),
    'patch | aces high':            ('patch', 'patch | aces high'),
    # ── Patches: Half-Life ──────────────────────────────────────────────────
    'patch | alyx':                 ('patch', 'patch | alyx'),
    'patch | lambda':               ('patch', 'patch | lambda'),
    'patch | combine helmet':       ('patch', 'patch | combine helmet'),
    'patch | vortigaunt':           ('patch', 'patch | vortigaunt'),
    'patch | headcrab':             ('patch', 'patch | headcrab glyph'),
    'patch | black mesa':           ('patch', 'patch | black mesa'),
    'patch | civil protection':     ('patch', 'patch | civil protection'),
    'patch | combine grub':         ('patch', 'patch | combine grub'),
    'patch | health pen':           ('patch', 'patch | health pen'),
    'patch | strider':              ('patch', 'patch | strider'),
    # ── Patches: Metal Skill Groups ─────────────────────────────────────────
    'patch | silver i':             ('patch', 'patch | metal silver'),
    'patch | silver ii':            ('patch', 'patch | metal silver'),
    'patch | silver iii':           ('patch', 'patch | metal silver'),
    'patch | silver iv':            ('patch', 'patch | metal silver'),
    'patch | silver elite':         ('patch', 'patch | metal silver demon'),
    'patch | silver elite master':  ('patch', 'patch | metal silver demon'),
    'patch | gold nova i':          ('patch', 'patch | metal gold nova i'),
    'patch | gold nova ii':         ('patch', 'patch | metal gold nova'),
    'patch | gold nova iii':        ('patch', 'patch | metal gold nova'),
    'patch | gold nova master':     ('patch', 'patch | metal gold nova master'),
    'patch | master guardian i':    ('patch', 'patch | metal master guardian i'),
    'patch | master guardian ii':   ('patch', 'patch | metal master guardian elite'),
    'patch | master guardian elite':('patch', 'patch | metal master guardian elite'),
    'patch | distinguished master guardian': ('patch', 'patch | metal distinguished master guardian ★'),
    'patch | legendary eagle':      ('patch', 'patch | metal legendary eagle'),
    'patch | legendary eagle master':('patch','patch | metal legendary eagle master ★'),
    'patch | supreme master first class': ('patch','patch | metal supreme master first class'),
    'patch | the global elite':     ('patch', 'patch | metal the global elite ★'),
    # ── Patches: Operation Broken Fang ──────────────────────────────────────
    'patch | broken fang':          ('patch', 'patch | broken fang'),
    'patch | bloody diamond':       ('patch', 'patch | bloody diamond'),
    'patch | ancient beast':        ('patch', 'patch | ancient beast'),
    'patch | battle scarred':       ('patch', 'patch | battle scarred'),
    'patch | medusa':               ('patch', 'patch | medusa'),
    'patch | stone omega':          ('patch', 'patch | stone omega'),
    'patch | coil strike':          ('patch', 'patch | coil strike'),
    'patch | surgical strike':      ('patch', 'patch | surgical strike'),
    'patch | enemy spotted':        ('patch', 'patch | enemy spotted'),
    'patch | swat':                 ('patch', 'patch | swat'),
    'patch | street drummer':       ('patch', 'patch | street drummer'),
    'patch | tiger pit':            ('patch', 'patch | tiger pit'),
    'patch | we can do it':         ('patch', 'patch | we can do it'),
    'patch | tattered':             ('patch', 'patch | tattered'),
    # ── Patches: Operation Riptide ──────────────────────────────────────────
    'patch | operation riptide':    ('patch', 'patch | operation riptide'),
    'patch | liquid gold':          ('patch', 'patch | liquid gold'),
    'patch | blood in the water':   ('patch', 'patch | blood in the water'),
    'patch | brainwash':            ('patch', 'patch | brainwash'),
    'patch | chemical hazard':      ('patch', 'patch | chemical hazard'),
    'patch | death roll':           ('patch', 'patch | death roll'),
    'patch | diving frog':          ('patch', 'patch | diving frog'),
    'patch | great wave':           ('patch', 'patch | great wave'),
    'patch | guerilla podcast':     ('patch', 'patch | guerilla podcast'),
    'patch | hard knocks':          ('patch', 'patch | hard knocks'),
    'patch | heist':                ('patch', 'patch | heist'),
    'patch | militia outline':      ('patch', 'patch | militia outline'),
    'patch | riptide cricket':      ('patch', 'patch | riptide cricket'),
    'patch | shark attack':         ('patch', 'patch | shark attack'),
    # ── Pins (using "2"/"3" variants) ───────────────────────────────────────
    'guardian ii pin':              ('pin', 'guardian 2 pin'),
    'guardian iii pin':             ('pin', 'guardian 3 pin'),
    'neo-noir pin':                 ('pin', 'neo-noir pin'),
    'chief pin':                    ('pin', 'chief pin'),
    'mil-spec pin':                 ('pin', 'mil-spec pin'),
    # Music kits
    'music kit | twerl and ekko & sidetrack, under bright lights':
        ('mk', 'music kit | twerl and ekko & sidetrack, under bright lights'),
    'music kit | laura shigihara, work hard, play hard':
        ('mk', 'music kit | laura shigihara, work hard, play hard'),
    'stattrak™ music kit | laura shigihara, work hard, play hard':
        ('mk', 'stattrak™ music kit | laura shigihara, work hard, play hard'),
}

DB = {'patch': patch_db, 'kc': kc_db, 'mk': mk_db, 'pin': pin_db}

def get_item_image(item_name):
    n = norm(item_name)
    if n in ITEM_MAP:
        db_key, lookup = ITEM_MAP[n]
        return DB[db_key].get(norm(lookup))
    return None

CONTAINER_MAP = {
    'small arms charm capsule':             'small arms charm capsule',
    'missing link charm capsule':           'missing link charm capsule',
    'metal skill groups patch pack':        'metal skill group patch collection',
    'operation broken fang patch pack':     'operation broken fang patch pack',
    'operation riptide patch pack':         'operation riptide patch collection',
    'nightwatch music kit box':             'nightmode music kit box',
    'stattrak™ nightwatch music kit box':   'stattrak™ nightmode music kit box',
    'initiation music kit box':             'initiators music kit box',
    'stattrak™ initiation music kit box':   'stattrak™ initiators music kit box',
    'radicals music kit box':               'radicals box',
    'stattrak™ radicals music kit box':     'stattrak™ radicals box',
}

def get_container_image(name):
    n = norm(name)
    lookup = norm(CONTAINER_MAP.get(n, n))
    return cr_db.get(lookup) or cr_db.get(n)

# ── Apply ─────────────────────────────────────────────────────────────────────
with open(DATA_FILE) as f:
    data = json.load(f)

fixed_items = fixed_containers = 0

for cap in data['capsules']:
    if not cap.get('image_url'):
        img = get_container_image(cap['name'])
        if img:
            cap['image_url'] = img
            fixed_containers += 1
            print(f'  container ✓ {cap["name"]}', flush=True)
        else:
            print(f'  container ✗ {cap["name"]}', flush=True)

    for item in cap['tiers'].get('high_grade', []):
        if item.get('image_url'):
            continue
        img = get_item_image(item['name'])
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
still_containers = sum(1 for cap in data['capsules'] if not cap.get('image_url'))

print(f'\nFixed this pass: {fixed_items} items, {fixed_containers} containers', flush=True)
print(f'Still missing: {still_missing_items} items, {still_containers} containers', flush=True)
