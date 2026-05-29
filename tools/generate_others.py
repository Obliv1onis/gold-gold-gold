#!/usr/bin/env python3
"""
Generate public/data/others.json from:
  - design/reference/others.md      (container contents)
  - design/reference/other-price.md (container prices)
  - ByMykel CSGO-API                (item images + market_hash_names)

Run: python3 tools/generate_others.py
"""

import json, urllib.request, re, time

DELAY = 1.5
OUT_FILE = 'public/data/others.json'

BYMYKEL_BASE = 'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en'

def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read())

print('Fetching ByMykel item databases...')
time.sleep(DELAY)
charms = fetch(f'{BYMYKEL_BASE}/keychains.json')  # charms are called keychains in ByMykel
print(f'  keychains/charms: {len(charms)}')
time.sleep(DELAY)
patches = fetch(f'{BYMYKEL_BASE}/patches.json')
print(f'  patches: {len(patches)}')
time.sleep(DELAY)
music_kits = fetch(f'{BYMYKEL_BASE}/music_kits.json')
print(f'  music_kits: {len(music_kits)}')
time.sleep(DELAY)
crates = fetch(f'{BYMYKEL_BASE}/crates.json')
print(f'  crates: {len(crates)}')
time.sleep(DELAY)
pins = fetch(f'{BYMYKEL_BASE}/collectibles.json')
print(f'  collectibles/pins: {len(pins)}')

def norm(s): return re.sub(r'\s+', ' ', s.lower().strip())

charm_img    = {norm(c['name']): c for c in charms    if c.get('name')}
patch_img    = {norm(p['name']): p for p in patches   if p.get('name')}
mk_img       = {norm(m['name']): m for m in music_kits if m.get('name')}
pin_img      = {norm(p['name']): p for p in pins       if p.get('name')}
crate_img    = {norm(c['name']): c for c in crates     if c.get('name')}

def lookup(db, name):
    return db.get(norm(name))

def crate_image(name):
    entry = lookup(crate_img, name)
    return entry.get('image') if entry else None

# ── Container price table from other-price.md ──────────────────────────────

PRICES = {
    'Small Arms Charm Capsule': 2.85,
    'Missing Link Charm Capsule': 2.40,
    'CS:GO Patch Pack': 4.25,
    'Half-Life: Alyx Patch Pack': 2.10,
    'Metal Skill Groups Patch Pack': 4.80,
    'Operation Broken Fang Patch Pack': 3.20,
    'Operation Riptide Patch Pack': 3.90,
    'Collectible Pins Capsule Series 1': 42.50,
    'Collectible Pins Capsule Series 2': 12.80,
    'Collectible Pins Capsule Series 3': 14.20,
    'Nightwatch Music Kit Box': 3.40,
    'Deluge Music Kit Box': 3.20,
    'Tacticians Music Kit Box': 3.70,
    'Initiators Music Kit Box': 3.40,
    'Initiation Music Kit Box': 3.40,
    'Masterminds Music Kit Box': 3.20,
    'Radicals Music Kit Box': 3.15,
    'StatTrak™ Nightwatch Music Kit Box': 5.50,
    'StatTrak™ Initiation Music Kit Box': 5.90,
    'StatTrak™ Masterminds Music Kit Box': 5.60,
    'StatTrak™ Deluge Music Kit Box': 5.45,
    'StatTrak™ Radicals Music Kit Box': 6.15,
    'StatTrak™ Tacticians Music Kit Box': 5.85,
}

def make_id(name):
    s = name.lower()
    s = re.sub(r'[™®]', '', s)
    s = re.sub(r"[^a-z0-9]+", '_', s)
    return s.strip('_')

# ── Container definitions ───────────────────────────────────────────────────

containers = []

# ── Charm Capsules ──────────────────────────────────────────────────────────

def make_charm_item(raw_name):
    # raw_name is like "Charm | Baby Karambit"
    entry = lookup(charm_img, raw_name)
    return {
        'name': raw_name,
        'market_hash_name': raw_name,
        'image_url': entry.get('image') if entry else None,
        'market_price': round((entry.get('min_price') or 0.10), 2) if entry else 0.10,
    }

charm_caps = {
    'Small Arms Charm Capsule': [
        'Charm | Baby Karambit', 'Charm | Pocket AWP', 'Charm | Glock-3000',
        'Charm | Semi-Auto', 'Charm | Lil\' Squirt', 'Charm | Whiskers',
        'Charm | Hot Sauce', 'Charm | Taz', 'Charm | Lil\' Crump',
        'Charm | Lil\' Monster', 'Charm | Pint-Sized Pizza', 'Charm | Lil\' Whacker',
    ],
    'Missing Link Charm Capsule': [
        'Charm | Lil\' Ava', 'Charm | Lil\' SAS', 'Charm | Lil\' Larry',
        'Charm | Lil\' Froman', 'Charm | Lil\' Mascot', 'Charm | Lil\' Chef',
        'Charm | Sausage Link', 'Charm | Hot Dog', 'Charm | Pork Chop',
        'Charm | Chicken Lover', 'Charm | Diamond Eye', 'Charm | Kittens',
    ],
}

for cap_name, items in charm_caps.items():
    containers.append({
        'id': make_id(cap_name),
        'name': cap_name,
        'type': 'charm_capsule',
        'price': PRICES.get(cap_name, 2.50),
        'image_url': crate_image(cap_name),
        'rarity_weights': {'high_grade': 100},
        'tiers': {
            'high_grade': [make_charm_item(n) for n in items]
        }
    })

# ── Patch Packs ─────────────────────────────────────────────────────────────

def make_patch_item(raw_name):
    entry = lookup(patch_img, raw_name)
    return {
        'name': raw_name,
        'market_hash_name': raw_name,
        'image_url': entry.get('image') if entry else None,
        'market_price': round((entry.get('min_price') or 0.07), 2) if entry else 0.07,
    }

patch_packs = {
    'CS:GO Patch Pack': [
        'Patch | Dragon Lore', 'Patch | Howl', 'Patch | Ol\' Reliable',
        'Patch | Chicken Lover', 'Patch | Clutch King', 'Patch | Boss',
        'Patch | Health', 'Patch | Vigilance', 'Patch | Welcome to the Clutch',
        'Patch | Dead Eye', 'Patch | Aces High',
    ],
    'Half-Life: Alyx Patch Pack': [
        'Patch | Alyx', 'Patch | Lambda', 'Patch | Combine Helmet',
        'Patch | Vortigaunt', 'Patch | Headcrab', 'Patch | Black Mesa',
        'Patch | Civil Protection', 'Patch | Combine Grub', 'Patch | Health Pen',
        'Patch | Strider',
    ],
    'Metal Skill Groups Patch Pack': [
        'Patch | Silver I', 'Patch | Silver II', 'Patch | Silver III',
        'Patch | Silver IV', 'Patch | Silver Elite', 'Patch | Silver Elite Master',
        'Patch | Gold Nova I', 'Patch | Gold Nova II', 'Patch | Gold Nova III',
        'Patch | Gold Nova Master', 'Patch | Master Guardian I',
        'Patch | Master Guardian II', 'Patch | Master Guardian Elite',
        'Patch | Distinguished Master Guardian', 'Patch | Legendary Eagle',
        'Patch | Legendary Eagle Master', 'Patch | Supreme Master First Class',
        'Patch | The Global Elite',
    ],
    'Operation Broken Fang Patch Pack': [
        'Patch | Broken Fang', 'Patch | Bloody Diamond', 'Patch | Ancient Beast',
        'Patch | Battle Scarred', 'Patch | Medusa', 'Patch | Stone Omega',
        'Patch | Coil Strike', 'Patch | Surgical Strike', 'Patch | Enemy Spotted',
        'Patch | SWAT', 'Patch | Street Drummer', 'Patch | Tiger Pit',
        'Patch | We Can Do It', 'Patch | Tattered',
    ],
    'Operation Riptide Patch Pack': [
        'Patch | Operation Riptide', 'Patch | Liquid Gold', 'Patch | Blood in the Water',
        'Patch | Brainwash', 'Patch | Chemical Hazard', 'Patch | Death Roll',
        'Patch | Diving Frog', 'Patch | Great Wave', 'Patch | Guerilla Podcast',
        'Patch | Hard Knocks', 'Patch | Heist', 'Patch | Militia Outline',
        'Patch | Riptide Cricket', 'Patch | Shark Attack',
    ],
}

for pack_name, items in patch_packs.items():
    containers.append({
        'id': make_id(pack_name),
        'name': pack_name,
        'type': 'patch_pack',
        'price': PRICES.get(pack_name, 3.00),
        'image_url': crate_image(pack_name),
        'rarity_weights': {'high_grade': 100},
        'tiers': {
            'high_grade': [make_patch_item(n) for n in items]
        }
    })

# ── Collectible Pin Capsules ────────────────────────────────────────────────

def make_pin_item(raw_name):
    entry = lookup(pin_img, raw_name)
    return {
        'name': raw_name,
        'market_hash_name': raw_name,
        'image_url': entry.get('image') if entry else None,
        'market_price': round((entry.get('min_price') or 1.00), 2) if entry else 1.00,
    }

pin_caps = {
    'Collectible Pins Capsule Series 1': [
        'Dust II Pin', 'Mirage Pin', 'Cache Pin', 'Nuke Pin', 'Train Pin',
        'Italy Pin', 'Militia Pin', 'Victory Pin', 'Tactics Pin',
        'Guardian Pin', 'Guardian Elite Pin',
    ],
    'Collectible Pins Capsule Series 2': [
        'Guardian II Pin', 'Bravo Pin', 'Baggage Pin', 'Phoenix Pin', 'Office Pin',
        'Cobblestone Pin', 'Overpass Pin', 'Bloodhound Pin', 'Chroma Pin',
        'Valkyrie Pin', 'Águila Pin',
    ],
    'Collectible Pins Capsule Series 3': [
        'Guardian III Pin', 'Canals Pin', 'Inferno Pin', 'Wildfire Pin', 'Hydra Pin',
        'Neo-Noir Pin', 'Death Sentence Pin', 'Welcome to the Clutch Pin',
        'Easy Peasy Pin', 'Chief Pin', 'Mil-Spec Pin',
    ],
}

for cap_name, items in pin_caps.items():
    containers.append({
        'id': make_id(cap_name),
        'name': cap_name,
        'type': 'pin_capsule',
        'price': PRICES.get(cap_name, 10.00),
        'image_url': crate_image(cap_name),
        'rarity_weights': {'high_grade': 100},
        'tiers': {
            'high_grade': [make_pin_item(n) for n in items]
        }
    })

# ── Music Kit Boxes ─────────────────────────────────────────────────────────

def make_mk_item(raw_name, stat_trak=False):
    full = f'StatTrak™ {raw_name}' if stat_trak else raw_name
    entry = lookup(mk_img, full) or lookup(mk_img, raw_name)
    return {
        'name': full,
        'market_hash_name': full,
        'image_url': entry.get('image') if entry else None,
        'market_price': round((entry.get('min_price') or 0.60), 2) if entry else 0.60,
        'stat_trak': stat_trak,
    }

# (box_name, [kit_names], is_stattrak_box)
mk_boxes = [
    ('Nightwatch Music Kit Box', [
        'Music Kit | DRYDEN, Feel The Power',
        'Music Kit | ISOxo, inhuman',
        'Music Kit | KILL SCRIPT, All Night',
        'Music Kit | Knock2, Make U SWEAT!',
        'Music Kit | Rad Cat, Reason',
        'Music Kit | TWERL and Ekko & Sidetrack, Under Bright Lights',
    ], False),
    ('StatTrak™ Nightwatch Music Kit Box', [
        'Music Kit | DRYDEN, Feel The Power',
        'Music Kit | ISOxo, inhuman',
        'Music Kit | KILL SCRIPT, All Night',
        'Music Kit | Knock2, Make U SWEAT!',
        'Music Kit | Rad Cat, Reason',
        'Music Kit | TWERL and Ekko & Sidetrack, Under Bright Lights',
    ], True),
    ('Deluge Music Kit Box', [
        'Music Kit | Adam Beyer, Red Room',
        'Music Kit | Ghost, Skeletá',
        'Music Kit | HEALTH, RAT WARS',
        'Music Kit | James and the Cold Gun, Chewing Glass',
        'Music Kit | Jonathan Young, Starship Velociraptor',
        'Music Kit | Juelz, Floorspace',
        'Music Kit | Killer Mike, MICHAEL',
        'Music Kit | PVRIS, Evergreen',
        'Music Kit | Selective Response, No Love Only Pleasure',
        'Music Kit | Tigercub, The Perfume of Decay',
    ], False),
    ('StatTrak™ Deluge Music Kit Box', [
        'Music Kit | Adam Beyer, Red Room',
        'Music Kit | Ghost, Skeletá',
        'Music Kit | HEALTH, RAT WARS',
        'Music Kit | James and the Cold Gun, Chewing Glass',
        'Music Kit | Jonathan Young, Starship Velociraptor',
        'Music Kit | Juelz, Floorspace',
        'Music Kit | Killer Mike, MICHAEL',
        'Music Kit | PVRIS, Evergreen',
        'Music Kit | Selective Response, No Love Only Pleasure',
        'Music Kit | Tigercub, The Perfume of Decay',
    ], True),
    ('Tacticians Music Kit Box', [
        'Music Kit | Laura Shigihara, Work Hard, Play Hard',
        'Music Kit | Freaky DNA, Vici',
        'Music Kit | Chipzel, ~Yellow Magic~',
        'Music Kit | Austin Wintory, Mocha Petal',
        'Music Kit | Jesse Harlin, Astro Bellum',
        'Music Kit | Sarah Schachner, KOLIBRI',
    ], False),
    ('StatTrak™ Tacticians Music Kit Box', [
        'Music Kit | Laura Shigihara, Work Hard, Play Hard',
        'Music Kit | Freaky DNA, Vici',
        'Music Kit | Chipzel, ~Yellow Magic~',
        'Music Kit | Austin Wintory, Mocha Petal',
        'Music Kit | Jesse Harlin, Astro Bellum',
        'Music Kit | Sarah Schachner, KOLIBRI',
    ], True),
    ('Initiation Music Kit Box', [
        'Music Kit | 3kliksphilip, Heading for the Source',
        'Music Kit | Humanity\'s Last Breath, Void',
        'Music Kit | Juelz, Shooters',
        'Music Kit | Knock2, dashstar*',
        'Music Kit | Meechy Darko, Gothic Luxury',
        'Music Kit | Sullivan King, Lock Me Up',
    ], False),
    ('StatTrak™ Initiation Music Kit Box', [
        'Music Kit | 3kliksphilip, Heading for the Source',
        'Music Kit | Humanity\'s Last Breath, Void',
        'Music Kit | Juelz, Shooters',
        'Music Kit | Knock2, dashstar*',
        'Music Kit | Meechy Darko, Gothic Luxury',
        'Music Kit | Sullivan King, Lock Me Up',
    ], True),
    ('Masterminds Music Kit Box', [
        'Music Kit | Dren, Gunman Taco Truck',
        'Music Kit | Sam Marshall, Bodacious',
        'Music Kit | Austin Wintory, Bachram',
        'Music Kit | Matt Levine, Drifter',
        'Music Kit | Tree Adams and Ben Bromfield, M.U.D.D. FORCE',
        'Music Kit | Daniel Sadowski, Eye of the Dragon',
        'Music Kit | Tim Huling, Neo Noir',
    ], False),
    ('StatTrak™ Masterminds Music Kit Box', [
        'Music Kit | Dren, Gunman Taco Truck',
        'Music Kit | Sam Marshall, Bodacious',
        'Music Kit | Austin Wintory, Bachram',
        'Music Kit | Matt Levine, Drifter',
        'Music Kit | Tree Adams and Ben Bromfield, M.U.D.D. FORCE',
        'Music Kit | Daniel Sadowski, Eye of the Dragon',
        'Music Kit | Tim Huling, Neo Noir',
    ], True),
    ('Radicals Music Kit Box', [
        'Music Kit | Beartooth, Aggressive',
        'Music Kit | Roam, Backbone',
        'Music Kit | Blitz Kids, The Good Youth',
        'Music Kit | Neck Deep, Life\'s Not Out To Get You',
        'Music Kit | Hundredth, FREE',
        'Music Kit | Skog, III-Arena',
        'Music Kit | Twin Atlantic, GLA',
    ], False),
    ('StatTrak™ Radicals Music Kit Box', [
        'Music Kit | Beartooth, Aggressive',
        'Music Kit | Roam, Backbone',
        'Music Kit | Blitz Kids, The Good Youth',
        'Music Kit | Neck Deep, Life\'s Not Out To Get You',
        'Music Kit | Hundredth, FREE',
        'Music Kit | Skog, III-Arena',
        'Music Kit | Twin Atlantic, GLA',
    ], True),
]

for box_name, kit_names, is_st in mk_boxes:
    containers.append({
        'id': make_id(box_name),
        'name': box_name,
        'type': 'music_kit_box',
        'price': PRICES.get(box_name, 3.50),
        'image_url': crate_image(box_name),
        'rarity_weights': {'high_grade': 100},
        'tiers': {
            'high_grade': [make_mk_item(n, stat_trak=is_st) for n in kit_names]
        }
    })

# ── Write output ─────────────────────────────────────────────────────────────

out = {'format_version': 1, 'capsules': containers}
with open(OUT_FILE, 'w') as f:
    json.dump(out, f, indent=2)

# Stats
no_img = sum(
    1 for c in containers
    for item in c['tiers']['high_grade']
    if not item.get('image_url')
)
total_items = sum(len(c['tiers']['high_grade']) for c in containers)
print(f'\nWrote {OUT_FILE}')
print(f'  {len(containers)} containers, {total_items} items')
print(f'  {no_img} items missing images ({total_items - no_img} found)')
