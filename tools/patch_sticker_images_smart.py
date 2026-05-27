#!/usr/bin/env python3
"""
Smart sticker image patcher.
1. Deduplicate by (org_name, tournament) — not by individual quality variants
2. Try ByMykel with extended aliases (case-insensitive, org aliases)
3. If not found: use Steam Market search to find the correct player/team name,
   then look up all quality variants in ByMykel
4. Falls back to Steam Market icon for the specific variant if still missing
5. Saves progress every SAVE_INTERVAL API calls

Run: python3 -u tools/patch_sticker_images_smart.py
"""
import json, urllib.request, urllib.parse, time, re, sys

DELAY_S       = 4.0
SAVE_INTERVAL = 30
DATA_FILE     = 'public/data/capsules.json'
BYMYKEL_URL   = 'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/stickers.json'

# ── ByMykel setup ────────────────────────────────────────────────────────────

print('Loading ByMykel sticker database...', flush=True)
req = urllib.request.Request(BYMYKEL_URL, headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req, timeout=30) as r:
    stickers = json.loads(r.read())
print(f'  {len(stickers)} stickers loaded', flush=True)

sticker_img  = {s['name']: s['image'] for s in stickers if s.get('image') and s.get('name')}
sticker_norm = {re.sub(r'\s+',' ',k.lower().strip()): v for k, v in sticker_img.items()}

TOURNAMENT_ALIASES = {
    'Kraków 2017': 'Krakow 2017',
    'EMS One Katowice 2014': 'Katowice 2014',
}
ORG_ALIASES = {
    'NaVi': 'Natus Vincere',
    'Sprout': 'Sprout Esports',
    'NiP': 'Ninjas in Pyjamas',
}

def _lkp(mhn):
    return sticker_img.get(mhn) or sticker_norm.get(re.sub(r'\s+',' ',mhn.lower().strip()))

def _org_variants(org):
    vs = [org]
    if org in ORG_ALIASES:
        vs.append(ORG_ALIASES[org])
    for sfx in (' Gaming', ' Esports', ' Team', ' Esports Club'):
        if org.endswith(sfx):
            stripped = org[:-len(sfx)]
            if stripped not in vs: vs.append(stripped)
        else:
            added = org + sfx
            if added not in vs: vs.append(added)
    return vs

def find_in_bymykel(mhn):
    img = _lkp(mhn)
    if img: return img
    parts = mhn.split(' | ')
    if len(parts) != 3: return None
    prefix, name_qual, tournament = parts
    m = re.match(r'^(.*?) \(([^)]+)\)$', name_qual)
    org, quality = (m.group(1), f' ({m.group(2)})') if m else (name_qual, '')
    t_alias = TOURNAMENT_ALIASES.get(tournament)
    for o in _org_variants(org):
        for t in [tournament] + ([t_alias] if t_alias else []):
            img = _lkp(f'{prefix} | {o}{quality} | {t}')
            if img: return img
    return None

# ── Steam Market ─────────────────────────────────────────────────────────────

def steam_search(query, count=5):
    url = f'https://steamcommunity.com/market/search/render/?norender=1&appid=730&query={urllib.parse.quote(query)}&start=0&count={count}'
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    delay = DELAY_S
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                data = json.loads(r.read())
            return data.get('results', [])
        except urllib.error.HTTPError as e:
            if e.code == 429:
                print(f'    429 — waiting {delay:.0f}s...', flush=True)
                time.sleep(delay); delay = min(delay * 2, 60)
            else:
                return []
        except Exception:
            return []
    return []

def find_via_steam_then_bymykel(mhn):
    """
    1. Search Steam Market for the org+tournament combo.
    2. From the results, extract the correctly-spelled org name.
    3. Look up every quality variant of that org in ByMykel.
    Returns (correct_mhn, image_url) or (None, None).
    """
    parts = mhn.split(' | ')
    if len(parts) != 3: return None, None
    prefix, name_qual, tournament = parts
    m = re.match(r'^(.*?) \(([^)]+)\)$', name_qual)
    org, quality = (m.group(1), m.group(2)) if m else (name_qual, None)

    query = f'{org} {tournament}'
    results = steam_search(query, 8)
    if not results:
        return None, None
    time.sleep(DELAY_S)

    # Find the result with matching tournament
    for r in results:
        hn = r.get('hash_name', '')
        hp = hn.split(' | ')
        if len(hp) != 3 or hp[2] != tournament: continue
        hm = re.match(r'^(.*?) \(([^)]+)\)$', hp[1])
        correct_org = hm.group(1) if hm else hp[1]
        # Now try to find this org + our quality in ByMykel
        correct_quality = f' ({quality})' if quality else ''
        correct_mhn = f'{prefix} | {correct_org}{correct_quality} | {tournament}'
        bm_img = _lkp(correct_mhn)
        if bm_img:
            return correct_mhn, bm_img
        # Last resort: use Steam icon from the search result
        icon = r.get('asset_description', {}).get('icon_url')
        if icon:
            return correct_mhn, f'https://community.akamai.steamstatic.com/economy/image/{icon}/360fx360f'
    return None, None

# ── Main patch loop ───────────────────────────────────────────────────────────

with open(DATA_FILE) as f:
    data = json.load(f)

# Group missing items by (org, tournament) to deduplicate
# key: (org, tournament) → list of items sharing the same org
groups: dict[tuple, list] = {}
for cap in data['capsules']:
    for rarity, items in cap['tiers'].items():
        for item in items:
            if item.get('image_url'): continue
            mhn = item.get('market_hash_name', '')
            if not mhn: continue
            img = find_in_bymykel(mhn)
            if img:
                item['image_url'] = img
                continue
            parts = mhn.split(' | ')
            if len(parts) == 3:
                nm = re.match(r'^(.*?) \(', parts[1])
                org = nm.group(1) if nm else parts[1]
                key = (org, parts[2])
            else:
                key = (mhn, '')
            groups.setdefault(key, []).append(item)

total_bymykel = sum(1 for cap in data['capsules'] for rarity, items in cap['tiers'].items() for item in items if item.get('image_url') and item['image_url'] not in [''])
still_missing  = sum(len(v) for v in groups.values())
print(f'ByMykel pass: fixed some, {still_missing} items still need Steam ({len(groups)} unique org/tournament pairs)', flush=True)

if not groups:
    print('All done!', flush=True)
    with open(DATA_FILE, 'w') as f: json.dump(data, f, indent=2)
    sys.exit(0)

steam_found = steam_miss = 0
save_queue = 0

for i, ((org, tournament), items) in enumerate(groups.items(), 1):
    print(f'[{i}/{len(groups)}] {org} | {tournament} ({len(items)} variants)', flush=True)
    # Skip community stickers (no tournament) — Steam rarely has them
    if not tournament:
        steam_miss += 1
        print(f'  skip (no tournament)', flush=True)
        continue
    # Build a representative mhn (base quality) for the search
    sample_mhn = items[0].get('market_hash_name', f'Sticker | {org} | {tournament}')
    _, img = find_via_steam_then_bymykel(sample_mhn)
    if img:
        for item in items:
            if not item.get('image_url'):
                item['image_url'] = img
        steam_found += 1
        save_queue += 1
        print(f'  FOUND', flush=True)
    else:
        steam_miss += 1
        print(f'  not found', flush=True)

    if save_queue >= SAVE_INTERVAL:
        with open(DATA_FILE, 'w') as f: json.dump(data, f, indent=2)
        print(f'  -> Saved progress', flush=True)
        save_queue = 0

    time.sleep(DELAY_S)

with open(DATA_FILE, 'w') as f: json.dump(data, f, indent=2)

remaining = sum(1 for cap in data['capsules'] for rarity, items in cap['tiers'].items() for item in items if not item.get('image_url'))
print(f'\n=== Done ===', flush=True)
print(f'Steam found: {steam_found} org/tournament pairs, missed: {steam_miss}', flush=True)
print(f'Total items still without images: {remaining}', flush=True)
