#!/usr/bin/env python3
"""Patch image_url into capsules.json from ByMykel CSGO-API + Steam Market fallback."""
import json, urllib.request, re, time

def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())

BASE = 'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/'
print('Fetching ByMykel API...')
crates   = fetch(BASE + 'crates.json')
stickers = fetch(BASE + 'stickers.json')
print(f'  Crates: {len(crates)}, Stickers: {len(stickers)}')

# ── Capsule image lookup ───────────────────────────────────────────────────────
crate_img = {c['name']: c['image'] for c in crates if c.get('image') and c.get('name')}

def _norm(s):
    return re.sub(r'\s+', ' ', s.lower().strip())

crate_norm = {_norm(k): v for k, v in crate_img.items()}

CAPSULE_OVERRIDES = {
    # Post-2021 tournaments: ByMykel uses "Autograph Capsule" while we use "Sticker Capsule"
    'Copenhagen 2024 Legends Sticker Capsule':              'Copenhagen 2024 Legends Autograph Capsule',
    'Copenhagen 2024 Challengers Sticker Capsule':          'Copenhagen 2024 Challengers Autograph Capsule',
    'Copenhagen 2024 Contenders Sticker Capsule':           'Copenhagen 2024 Contenders Autograph Capsule',
    'Austin 2025 Legends Sticker Capsule':                  'Austin 2025 Legends Autograph Capsule',
    'Austin 2025 Challengers Sticker Capsule':              'Austin 2025 Challengers Autograph Capsule',
    'Austin 2025 Contenders Sticker Capsule':               'Austin 2025 Contenders Autograph Capsule',
    'Budapest 2025 Legends Sticker Capsule':                'Budapest 2025 Legends Autograph Capsule',
    'Budapest 2025 Challengers Sticker Capsule':            'Budapest 2025 Challengers Autograph Capsule',
    'Budapest 2025 Contenders Sticker Capsule':             'Budapest 2025 Contenders Autograph Capsule',
    # Berlin 2019: "Attending" → "Returning" and "Sticker Capsule" → "Autograph Capsule"
    'Berlin 2019 Legends Sticker Capsule':                  'Berlin 2019 Legends Autograph Capsule',
    'Berlin 2019 Attending Challengers Sticker Capsule':    'Berlin 2019 Returning Challengers Autograph Capsule',
    'Berlin 2019 Minor Challengers Sticker Capsule':        'Berlin 2019 Minor Challengers Autograph Capsule',
    'Berlin 2019 Attending Challengers Autograph Capsule':  'Berlin 2019 Returning Challengers Autograph Capsule',
    # Katowice 2019: "Sticker Capsule" → "Autograph Capsule"
    'Katowice 2019 Legends Sticker Capsule':                'Katowice 2019 Legends Autograph Capsule',
    'Katowice 2019 Minor Challengers Sticker Capsule':      'Katowice 2019 Minor Challengers Autograph Capsule',
    # Boston 2018: "Sticker Capsule" → "Autograph Capsule"; "Challengers" → "Returning Challengers"
    'Boston 2018 Legends Sticker Capsule':                  'Boston 2018 Legends Autograph Capsule',
    'Boston 2018 Challengers Sticker Capsule':              'Boston 2018 Returning Challengers Autograph Capsule',
    # Kraków 2017: accent removed in ByMykel, "Sticker Capsule" → "Autograph Capsule"
    'Kraków 2017 Legends Sticker Capsule':                  'Krakow 2017 Legends Autograph Capsule',
    'Kraków 2017 Challengers Sticker Capsule':              'Krakow 2017 Challengers Autograph Capsule',
    # 2017 and older: ByMykel uses "(Holo/Foil)" group packs instead of "Autograph Capsule"
    'Atlanta 2017 Legends Sticker Capsule':                 'Atlanta 2017 Legends (Holo/Foil)',
    'Atlanta 2017 Challengers Sticker Capsule':             'Atlanta 2017 Challengers (Holo/Foil)',
    'Cologne 2016 Legends Sticker Capsule':                 'Cologne 2016 Legends (Holo/Foil)',
    'Cologne 2016 Challengers Sticker Capsule':             'Cologne 2016 Challengers (Holo/Foil)',
    'MLG Columbus 2016 Legends Sticker Capsule':            'MLG Columbus 2016 Legends (Holo/Foil)',
    'MLG Columbus 2016 Challengers Sticker Capsule':        'MLG Columbus 2016 Challengers (Holo/Foil)',
    # 2015 events: DreamHack/ESL One prefixes in ByMykel
    'Cluj-Napoca 2015 Legends Sticker Capsule':             'DreamHack Cluj-Napoca 2015 Legends (Foil)',
    'Cluj-Napoca 2015 Challengers Sticker Capsule':         'DreamHack Cluj-Napoca 2015 Challengers (Foil)',
    'Cologne 2015 Legends Sticker Capsule':                 'ESL One Cologne 2015 Legends (Foil)',
    'Cologne 2015 Challengers Sticker Capsule':             'ESL One Cologne 2015 Challengers (Foil)',
    'Katowice 2015 Legends Sticker Capsule':                'ESL One Katowice 2015 Legends (Holo/Foil)',
    'Katowice 2015 Challengers Sticker Capsule':            'ESL One Katowice 2015 Challengers (Holo/Foil)',
    # 2014 events: ESL One / EMS prefixes in ByMykel
    'Cologne 2014 Legends Sticker Capsule':                 'ESL One Cologne 2014 Legends',
    'Cologne 2014 Challengers Sticker Capsule':             'ESL One Cologne 2014 Challengers',
    'EMS One Katowice 2014 Legends':                        'EMS Katowice 2014 Legends',
    'EMS One Katowice 2014 Challengers':                    'EMS Katowice 2014 Challengers',
    # ByMykel drops "CS:GO" prefix
    'CS:GO Perfect World Sticker Capsule 1':                'Perfect World Sticker Capsule 1',
    'CS:GO Perfect World Sticker Capsule 2':                'Perfect World Sticker Capsule 2',
    # ByMykel drops "Sticker" from these names
    'Skill Groups Sticker Capsule':                         'Skill Groups Capsule',
    'Feral Predators Sticker Capsule':                      'Feral Predators Capsule',
    'Halo Sticker Capsule':                                 'Halo Capsule',
    'Poorly Drawn Sticker Capsule':                         'Poorly Drawn Capsule',
    '2021 Community Sticker Capsule':                       '2021 Community Sticker Capsule',
}

def find_capsule_image(name):
    resolved = CAPSULE_OVERRIDES.get(name, name)
    return crate_img.get(resolved) or crate_norm.get(_norm(resolved))

# ── Sticker image lookup ───────────────────────────────────────────────────────
sticker_img  = {s['name']: s['image'] for s in stickers if s.get('image') and s.get('name')}
sticker_norm = {_norm(k): v for k, v in sticker_img.items()}

TOURNAMENT_ALIASES = {
    'Kraków 2017': 'Krakow 2017',
    'EMS One Katowice 2014': 'Katowice 2014',
}

ORG_ALIASES = {
    'NaVi': 'Natus Vincere',
    'Sprout': 'Sprout Esports',
    'NiP': 'Ninjas in Pyjamas',
}

def _org_variants(org):
    """Generate ByMykel name variants for an org name — handles suffix differences."""
    variants = [org]
    if org in ORG_ALIASES:
        variants.append(ORG_ALIASES[org])
    for suffix in (' Gaming', ' Esports', ' Team', ' Esports Club'):
        if org.endswith(suffix):
            variants.append(org[:-len(suffix)])
        else:
            variants.append(org + suffix)
    return variants

def find_sticker_byMykel(mhn):
    # Try exact
    img = sticker_img.get(mhn) or sticker_norm.get(_norm(mhn))
    if img:
        return img
    # For tournament stickers (Sticker | Name (Quality) | Tournament), try aliases
    parts = mhn.split(' | ')
    if len(parts) == 3:
        prefix, name_qual, tournament = parts
        m = re.match(r'^(.*?) \(([^)]+)\)$', name_qual)
        org, quality = (m.group(1), f' ({m.group(2)})') if m else (name_qual, '')
        t_alias = TOURNAMENT_ALIASES.get(tournament)
        tournaments = [tournament] + ([t_alias] if t_alias else [])
        for org_v in _org_variants(org):
            for t in tournaments:
                candidate = f'{prefix} | {org_v}{quality} | {t}'
                img = sticker_img.get(candidate) or sticker_norm.get(_norm(candidate))
                if img:
                    return img
    return None

def find_sticker_steam(mhn, delay=2.0):
    """Fallback: query Steam Market search API with retry on 429."""
    for attempt in range(3):
        try:
            params = urllib.parse.urlencode({
                'norender': '1',
                'query':    mhn,
                'appid':    '730',
                'start':    '0',
                'count':    '1',
                'language': 'english',
            })
            url = f'https://steamcommunity.com/market/search/render/?{params}'
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
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
                wait = delay * (2 ** attempt)
                print(f'    429 rate limit — waiting {wait:.0f}s...')
                time.sleep(wait)
            else:
                print(f'    Steam API error for "{mhn}": {e}')
                return None
        except Exception as e:
            print(f'    Steam API error for "{mhn}": {e}')
            return None
    return None

# ── Patch capsules.json ────────────────────────────────────────────────────────
import urllib.parse

with open('public/data/capsules.json') as f:
    data = json.load(f)

caps_found = caps_missing = 0
sticker_byMykel = sticker_steam_ok = sticker_missing = 0

# Collect all stickers needing images (avoid duplicate Steam calls)
to_steam = []  # list of (item_dict, mhn)

for cap in data['capsules']:
    if not cap.get('image_url'):
        img = find_capsule_image(cap['name'])
        if img:
            cap['image_url'] = img
            caps_found += 1
        else:
            caps_missing += 1
            print(f'  [capsule] no image: {cap["name"]}')

    for rarity, items in cap['tiers'].items():
        for item in items:
            if not item.get('image_url'):
                mhn = item.get('market_hash_name', '')
                img = find_sticker_byMykel(mhn)
                if img:
                    item['image_url'] = img
                    sticker_byMykel += 1
                else:
                    to_steam.append((item, mhn))

# Deduplicate Steam calls by mhn
unique_mhn = {}
for item, mhn in to_steam:
    unique_mhn.setdefault(mhn, []).append(item)

print(f'\nByMykel pass: {sticker_byMykel} sticker images found')
print(f'Steam fallback needed for {len(unique_mhn)} unique stickers ({len(to_steam)} total items)')

if unique_mhn:
    print('Fetching from Steam Market API (1.5s delay between requests)...')
    done = 0
    for mhn, items in unique_mhn.items():
        done += 1
        print(f'  [{done}/{len(unique_mhn)}] {mhn}')
        img = find_sticker_steam(mhn)
        if img:
            for item in items:
                item['image_url'] = img
            sticker_steam_ok += 1
        else:
            sticker_missing += len(items)
        time.sleep(1.5)

with open('public/data/capsules.json', 'w') as f:
    json.dump(data, f, indent=2)

print(f'\n=== Results ===')
print(f'Capsule images: {caps_found} found, {caps_missing} still missing')
print(f'Sticker images: {sticker_byMykel} via ByMykel + {sticker_steam_ok} via Steam = {sticker_byMykel + sticker_steam_ok} total')
print(f'Still missing: {sticker_missing} stickers')
