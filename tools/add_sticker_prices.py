#!/usr/bin/env python3
"""Patch market_price into capsules.json sticker items using a rarity × era model."""
import json, re, random

random.seed(42)

# ── Base prices by rarity tier ────────────────────────────────────────────────
BASE = {
    'high_grade':    0.06,
    'remarkable':    0.22,   # Holo
    'exotic':        0.65,   # Foil / Glitter / Embroidered
    'extraordinary': 4.50,   # Gold
}

# ── Era multiplier — keyed on the tournament suffix after the last " | " ──────
ERA = {
    'EMS One Katowice 2014':   16.0,
    'Cologne 2014':            12.0,
    'Katowice 2015':            8.0,
    'Cologne 2015':             7.0,
    'Cluj-Napoca 2015':         7.0,
    'MLG Columbus 2016':        5.5,
    'Cologne 2016':             5.5,
    'Atlanta 2017':             4.5,
    'Kraków 2017':              4.5,
    'Krakow 2017':              4.5,
    'Boston 2018':              3.5,
    'Katowice 2019':            3.0,
    'Berlin 2019':              2.5,
    'Stockholm 2021':           2.0,
    'Antwerp 2022':             1.5,
    'Rio 2022':                 1.4,
    'Paris 2023':               1.3,
    'Copenhagen 2024':          1.2,
    'Austin 2025':              1.0,
    'Budapest 2025':            1.0,
}

def _era_mult(mhn):
    """Extract tournament from 'Sticker | Name | Tournament' and return multiplier."""
    parts = mhn.split(' | ')
    if len(parts) == 3:
        tournament = parts[2].strip()
        return ERA.get(tournament, 1.0)
    return 1.0  # community capsule — no era bonus

def _price(rarity, mhn):
    base = BASE.get(rarity, 0.06)
    mult = _era_mult(mhn)
    raw  = base * mult
    # ±15 % random variance so not every sticker is identical
    raw *= 1.0 + random.uniform(-0.15, 0.15)
    return round(raw, 2)

with open('public/data/capsules.json') as f:
    data = json.load(f)

patched = 0
for cap in data['capsules']:
    for rarity, items in cap['tiers'].items():
        for item in items:
            if item.get('market_price') is None:
                item['market_price'] = _price(rarity, item.get('market_hash_name', ''))
                patched += 1

with open('public/data/capsules.json', 'w') as f:
    json.dump(data, f, indent=2)

print(f'Patched {patched} sticker prices into capsules.json')
