#!/usr/bin/env python3
"""Patch market_price into souvenirs.json skin items using a rarity × era model."""
import json, re, random

random.seed(42)

# ── Base prices by rarity tier (souvenir prefix adds a 3-6× premium vs vanilla) ─
BASE = {
    'consumer_grade':   0.18,
    'industrial_grade': 0.55,
    'mil_spec':         2.80,
    'restricted':      14.00,
}

# ── Era multiplier — keyed on substrings in the package name ─────────────────
ERA_RULES = [
    # oldest first so first match wins for the most specific name
    ('DreamHack 2013',      25.0),
    ('EMS One Katowice 2014', 18.0),
    ('Cologne 2014',          14.0),
    ('Katowice 2015',         10.0),
    ('Cologne 2015',           9.0),
    ('Cluj-Napoca 2015',       9.0),
    ('MLG Columbus 2016',      6.0),
    ('Cologne 2016',           6.0),
    ('Atlanta 2017',           5.0),
    ('Kraków 2017',            5.0),
    ('Krakow 2017',            5.0),
    ('Boston 2018',            4.0),
    ('Katowice 2019',          3.5),
    ('Berlin 2019',            3.0),
    ('Stockholm 2021',         2.2),
    ('Antwerp 2022',           1.8),
    ('Rio 2022',               1.7),
    ('Paris 2023',             1.5),
    ('Copenhagen 2024',        1.3),
    ('Austin 2025',            1.0),
    ('Budapest 2025',          1.0),
]

def _era_mult(package_name):
    for keyword, mult in ERA_RULES:
        if keyword.lower() in package_name.lower():
            return mult
    return 1.0

def _price(rarity, era_mult):
    base = BASE.get(rarity, 0.18)
    raw  = base * era_mult
    raw *= 1.0 + random.uniform(-0.15, 0.15)
    return round(raw, 2)

with open('public/data/souvenirs.json') as f:
    data = json.load(f)

patched = 0
for pkg in data['cases']:
    mult = _era_mult(pkg['name'])
    for rarity, items in pkg['items'].items():
        for item in items:
            if item.get('market_price') is None:
                item['market_price'] = _price(rarity, mult)
                patched += 1

with open('public/data/souvenirs.json', 'w') as f:
    json.dump(data, f, indent=2)

print(f'Patched {patched} souvenir skin prices into souvenirs.json')
