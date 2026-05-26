#!/usr/bin/env python3
"""Generate public/data/souvenirs.json from design/reference/souvenirs.md + souvenir-price.md."""
import json
import re

RARITY_ORDER = ['consumer_grade', 'industrial_grade', 'mil_spec', 'restricted', 'classified', 'covert']

BASE_PROBS = {
    'consumer_grade': 79.9248,
    'industrial_grade': 15.9830,
    'mil_spec': 3.1968,
    'restricted': 0.6394,
    'classified': 0.1277,
    'covert': 0.0255,
}

def make_item_id(weapon, skin):
    raw = f"{weapon}_{skin}"
    raw = re.sub(r"[^a-zA-Z0-9\s\-]", "", raw)
    raw = re.sub(r"\s+", "_", raw.strip())
    return raw.lower()

def make_package_id(name):
    raw = name.lower()
    raw = raw.replace(' ', '_').replace('.', '').replace("'", '').replace('/', '_')
    raw = re.sub(r'[^a-z0-9_]', '', raw)
    raw = re.sub(r'_+', '_', raw)
    return raw.strip('_')

def make_items(pairs):
    return [
        {"item_id": make_item_id(w, s), "weapon": w, "skin": s, "image_url": None, "stattrak": False}
        for w, s in pairs
    ]

def calculate_weights(present_rarities):
    present = [r for r in RARITY_ORDER if r in present_rarities]
    raw = {r: BASE_PROBS[r] for r in present}
    total = sum(raw.values())
    weights = {r: round(v / total * 100, 4) for r, v in raw.items()}
    diff = round(100.0 - sum(weights.values()), 4)
    if diff != 0:
        weights[present[0]] = round(weights[present[0]] + diff, 4)
    return weights

# ── Collection pool definitions ───────────────────────────────────────────────

COLLECTIONS = {}

COLLECTIONS['dust_ii'] = {
    'restricted':      [('M4A1-S', 'Nitro')],
    'mil_spec':        [('AK-47', 'Safari Mesh'), ('Five-SeveN', 'Candy Apple'), ('P250', 'Metallic DDPAT')],
    'industrial_grade':[('AWP', 'Pit Viper'), ('Desert Eagle', 'Mudder'), ('Glock-18', 'Groundwater'), ('P2000', 'Grassland')],
    'consumer_grade':  [('AUG', 'Condemned'), ('Dual Berettas', 'Colony'), ('FAMAS', 'Colony'),
                        ('G3SG1', 'Desert Storm'), ('Galil AR', 'Hunting Blind'), ('M249', 'Gator Mesh'),
                        ('MAC-10', 'Palm'), ('MP7', 'Groundwater'), ('Nova', 'Sand Dune'),
                        ('SCAR-20', 'Sand Mesh'), ('SG 553', 'Gator Mesh'), ('SSG 08', 'Sand Dune'),
                        ('Tec-9', 'Groundwater'), ('XM1014', 'Cali Camo')],
}

COLLECTIONS['mirage'] = {
    'classified':      [('MAG-7', 'Bulldozer')],
    'restricted':      [('MP9', 'Hot Rod')],
    'mil_spec':        [('Glock-18', 'Candy Apple'), ('UMP-45', 'Gunsmoke')],
    'industrial_grade':[('AWP', 'Safari Mesh'), ('Desert Eagle', 'Urban DDPAT'), ('MAC-10', 'Silver'), ('P250', 'Gunsmoke')],
    'consumer_grade':  [('AUG', 'Colony'), ('Dual Berettas', 'Colony'), ('FAMAS', 'Colony'),
                        ('G3SG1', 'Safari Mesh'), ('Galil AR', 'Hunting Blind'),
                        ('P2000', 'Safari Mesh'), ('SG 553', 'Waves Perforated'), ('SSG 08', 'Tropical Storm')],
}

COLLECTIONS['inferno'] = {
    'classified':      [('Tec-9', 'Nuclear Threat')],
    'restricted':      [('P250', 'Nuclear Threat')],
    'mil_spec':        [('M4A4', 'Radiation Hazard')],
    'industrial_grade':[('Glock-18', 'Candy Apple'), ('MAG-7', 'Sand Dune'), ('P2000', 'Granite Marbleized'), ('XM1014', 'Blaze Orange')],
    'consumer_grade':  [('Dual Berettas', 'Colony'), ('MAC-10', 'Candy Apple'), ('MP7', 'Gunsmoke'), ('Nova', 'Walnut')],
}

COLLECTIONS['nuke'] = {
    'classified':      [('M4A4', 'Radiation Hazard')],
    'restricted':      [('P250', 'Nuclear Threat'), ('Tec-9', 'Nuclear Threat')],
    'mil_spec':        [('P2000', 'Radioactive'), ('XM1014', 'Fallout Warning')],
    'industrial_grade':[('Bizon', 'Irradiated Alert'), ('MAG-7', 'Irradiated Alert'), ('MP9', 'Setting Sun'), ('P90', 'Fallout Warning')],
    'consumer_grade':  [('Dual Berettas', 'Colony'), ('G3SG1', 'Desert Storm'), ('Galil AR', 'Hunting Blind'), ('M249', 'Sand Dune')],
}

COLLECTIONS['train'] = {
    'restricted':      [('P250', 'Metallic DDPAT'), ('Tec-9', 'Brass')],
    'mil_spec':        [('Desert Eagle', 'Urban DDPAT'), ('MAC-10', 'Candy Apple')],
    'industrial_grade':[('MAG-7', 'Metallic DDPAT'), ('P2000', 'Silver'), ('SCAR-20', 'Carbon Fiber')],
    'consumer_grade':  [('Dual Berettas', 'Colony'), ('G3SG1', 'Desert Storm'), ('M249', 'Sand Dune'),
                        ('Nova', 'Polar Mesh'), ('P90', 'Sand Spray'), ('UMP-45', 'Urban DDPAT')],
}

COLLECTIONS['cache'] = {
    'covert':          [('FAMAS', 'Styx')],
    'classified':      [('Glock-18', 'Reactor'), ('MP9', 'Setting Sun')],
    'restricted':      [('PP-Bizon', 'Chemical Green'), ('MAC-10', 'Nuclear Garden'), ('XM1014', 'Bone Machine')],
    'mil_spec':        [('AUG', 'Radiation Hazard'), ('Galil AR', 'Cerberus'), ('P250', 'Contamination'), ('Tec-9', 'Toxic')],
    'consumer_grade':  [('Five-SeveN', 'Hot Shot'), ('G3SG1', 'Green Apple'), ('P2000', 'Amber Fade'), ('SG 553', 'Fallout Warning')],
}

COLLECTIONS['cobblestone'] = {
    'covert':          [('AWP', 'Dragon Lore')],
    'classified':      [('M4A1-S', 'Knight')],
    'restricted':      [('Desert Eagle', 'Hand Cannon'), ('MP9', 'Dark Age')],
    'mil_spec':        [('CZ75-Auto', 'Chalice'), ('P2000', 'Chainmail')],
    'industrial_grade':[('MAG-7', 'Silver'), ('Nova', 'Green Apple'), ('Sawed-Off', 'Rust Coat'), ('XM1014', 'Red Leather')],
    'consumer_grade':  [('Dual Berettas', 'Briar'), ('G3SG1', 'Orange Kimono'), ('MAC-10', 'Indigo'),
                        ('P90', 'Storm'), ('SCAR-20', 'Storm'), ('USP-S', 'Royal Blue')],
}

COLLECTIONS['overpass'] = {
    'covert':          [('M4A1-S', 'Master Piece')],
    'classified':      [('AWP', 'Pink DDPAT')],
    'restricted':      [('SSG 08', 'Detour'), ('XM1014', 'VariCamo Blue')],
    'mil_spec':        [('CZ75-Auto', 'Nitro'), ('Glock-18', 'Night'), ('USP-S', 'Road Rash')],
    'industrial_grade':[('Desert Eagle', 'Urban DDPAT'), ('M249', 'Contrast Spray'), ('MP9', 'Storm'), ('P2000', 'Grassland')],
    'consumer_grade':  [('AUG', 'Storm'), ('Dual Berettas', 'Colony'), ('G3SG1', 'VariCamo'),
                        ('MP7', 'Gunsmoke'), ('P90', 'Scorched'), ('SCAR-20', 'Contractor'), ('SG 553', 'Waves Perforated')],
}

COLLECTIONS['nuke_2016'] = {
    'classified':      [('M4A4', 'Radiation Hazard')],
    'restricted':      [('P250', 'Nuclear Threat'), ('Tec-9', 'Nuclear Threat')],
    'mil_spec':        [('Glock-18', 'Reactor'), ('MP9', 'Setting Sun'), ('P2000', 'Radioactive'), ('XM1014', 'Fallout Warning')],
    'industrial_grade':[('AUG', 'Radiation Hazard'), ('Bizon', 'Irradiated Alert'), ('MAG-7', 'Irradiated Alert'),
                        ('P90', 'Fallout Warning'), ('SG 553', 'Fallout Warning'), ('Tec-9', 'Toxic')],
    'consumer_grade':  [('CZ75-Auto', 'Army Sheen'), ('G3SG1', 'Ventilator'), ('Galil AR', 'Vandal'),
                        ('M249', 'Warbird'), ('MAC-10', 'Carnivore'), ('MP7', 'Asterion'),
                        ('PP-Bizon', 'Chemical Green'), ('SCAR-20', 'Powercore'), ('UMP-45', 'Briefing')],
}

COLLECTIONS['inferno_2018'] = {
    'classified':      [('SG 553', 'Integrale'), ('Dual Berettas', 'Twin Turbo')],
    'restricted':      [('MP7', 'Fade'), ('AK-47', 'Safety Net'), ('P250', 'Vino Primo')],
    'mil_spec':        [('M4A4', 'Converter'), ('USP-S', 'Check Engine'), ('SSG 08', 'Hand Brake'), ('Sawed-Off', 'Brake Light')],
    'industrial_grade':[('Glock-18', 'High Beam'), ('MAC-10', 'Calf Skin'), ('R8 Revolver', 'Nitro'), ('PP-Bizon', 'Candy Apple')],
    'consumer_grade':  [('MAG-7', 'Rust Coat'), ('MP5-SD', 'Dirt Drop'), ('AUG', 'Sweeper'), ('UMP-45', 'Mudder'), ('MP9', 'Slide')],
}

COLLECTIONS['nuke_2018'] = {
    'classified':      [('M4A1-S', 'Control Panel'), ('Tec-9', 'Remote Control')],
    'restricted':      [('Glock-18', 'Nuclear Garden'), ('MAG-7', 'Core Breach'), ('AUG', 'Random Access')],
    'mil_spec':        [('AWP', 'Acheron'), ('MP5-SD', 'Co-Processor'), ('P90', 'Facility Negative'), ('P250', 'Exchanger')],
    'industrial_grade':[('Galil AR', 'Cold Fusion'), ('Negev', 'Bulkhead'), ('M4A4', 'Mainframe'), ('MP7', 'Motherboard')],
    'consumer_grade':  [('PP-Bizon', 'Facility Sketch'), ('Five-SeveN', 'Coolant'), ('Nova', 'Mandrel'),
                        ('P250', 'Facility Draft'), ('UMP-45', 'Facility Dark')],
}

COLLECTIONS['vertigo'] = {
    'restricted':      [('Dual Berettas', 'Demolition')],
    'mil_spec':        [('AK-47', 'Black Laminate'), ('P90', 'Glacier Mesh')],
    'industrial_grade':[('PP-Bizon', 'Carbon Fiber')],
    'consumer_grade':  [('XM1014', 'Urban Perforated'), ('MAC-10', 'Urban DDPAT')],
}

COLLECTIONS['mirage_2021'] = {
    'covert':          [('AWP', 'Desert Hydra')],
    'classified':      [('Desert Eagle', 'Fennec Fox'), ('MP5-SD', 'Oxide Oasis')],
    'restricted':      [('Glock-18', 'Pink DDPAT'), ('XM1014', 'Elegant Vines'), ('AUG', 'Sand Storm')],
    'mil_spec':        [('USP-S', 'Purple DDPAT'), ('M249', 'Humidor'), ('SG 553', 'Desert Blossom'), ('MP9', 'Music Box')],
    'industrial_grade':[('FAMAS', 'CaliCamo'), ('Dual Berettas', 'Drift Wood'), ('P90', 'Verdant Growth'), ('CZ75-Auto', 'Midnight Palm')],
    'consumer_grade':  [('P250', 'Drought'), ('MAG-7', 'Navy Sheen'), ('PP-Bizon', 'Anolis'),
                        ('SSG 08', 'Prey'), ('MAC-10', 'Sienna Damask')],
}

COLLECTIONS['dust_ii_2021'] = {
    'covert':          [('AK-47', 'Gold Arabesque')],
    'classified':      [('SSG 08', 'Death Strike'), ('UMP-45', 'Fade')],
    'restricted':      [('M4A4', 'Red DDPAT'), ('USP-S', 'Orange Anolis'), ('MAC-10', 'Case Hardened')],
    'mil_spec':        [('Galil AR', 'Amber Fade'), ('G3SG1', 'New Roots'), ('Nova', 'Quick Sand'), ('P250', 'Black Tan')],
    'industrial_grade':[('Five-SeveN', 'Withered Vine'), ('AUG', 'Spalted Wood'), ('MP9', 'Old Roots'), ('M249', 'Midnight Palm')],
    'consumer_grade':  [('MP7', 'Prey'), ('R8 Revolver', 'Desert Brush'), ('P90', 'Desert DDPAT'),
                        ('Sawed-Off', 'Parched'), ('SG 553', 'Bleached')],
}

COLLECTIONS['ancient'] = {
    'covert':          [('M4A1-S', 'Welcome to the Jungle')],
    'classified':      [('AK-47', 'Panthera onca'), ('P90', 'Run and Hide')],
    'restricted':      [('MAC-10', 'Gold Brick'), ('XM1014', 'Ancient Lore'), ('USP-S', 'Ancient Visions')],
    'mil_spec':        [('AUG', 'Carved Jade'), ('Galil AR', 'Dusk Ruins'), ('FAMAS', 'Dark Water'), ('Tec-9', 'Blast From the Past')],
    'industrial_grade':[('CZ75-Auto', 'Silver'), ('MP7', 'Tall Grass'), ('P2000', 'Panther Camo'), ('G3SG1', 'Ancient Ritual')],
    'consumer_grade':  [('SSG 08', 'Jungle Dashed'), ('R8 Revolver', 'Night'), ('P90', 'Ancient Earth'),
                        ('SG 553', 'Lush Ruins'), ('Nova', 'Army Sheen')],
}

COLLECTIONS['vertigo_2021'] = {
    'covert':          [('M4A1-S', 'Imminent Danger')],
    'classified':      [('SG 553', 'Hazard Pay'), ('Five-SeveN', 'Fall Hazard')],
    'restricted':      [('Galil AR', 'CAUTION'), ('MAG-7', 'Prism Terrace'), ('P250', 'Digital Architect')],
    'mil_spec':        [('AK-47', 'Green Laminate'), ('Negev', 'Infrastructure'), ('Nova', 'Interlock'), ('P90', 'Schematic')],
    'industrial_grade':[('Glock-18', 'Red Tire'), ('SSG 08', 'Carbon Fiber'), ('UMP-45', 'Mechanism'), ('PP-Bizon', 'Breaker Box')],
    'consumer_grade':  [('XM1014', 'Blue Tire'), ('FAMAS', 'Faulty Wiring'), ('CZ75-Auto', 'Framework'),
                        ('MAC-10', 'Strats'), ('Dual Berettas', 'Oil Change')],
}

COLLECTIONS['anubis'] = {
    'covert':          [('M4A4', 'Eye of Horus')],
    'classified':      [('P250', 'Apeps Curse'), ('FAMAS', 'Waters of Nephthys')],
    'restricted':      [('Glock-18', 'Rameses Reach'), ('P90', 'ScaraB Rush'), ('Nova', 'Sobeks Bite')],
    'mil_spec':        [('AWP', 'Black Nile'), ('AK-47', 'Steel Delta'), ('MAG-7', 'Copper Coated'), ('Tec-9', 'Mummys Rot')],
    'industrial_grade':[('M4A1-S', 'Mud-Spec'), ('USP-S', 'Desert Tactical'), ('SSG 08', 'Azure Glyph'), ('MAC-10', 'Echoing Sands')],
    'consumer_grade':  [('MP7', 'Sunbaked'), ('AUG', 'Snake Pit'), ('XM1014', 'Hieroglyph'),
                        ('R8 Revolver', 'Inlay'), ('M249', 'Submerged')],
}

COLLECTIONS['train_2025'] = {
    'covert':          [('AWP', 'LongDog')],
    'classified':      [('M4A4', 'Hellish'), ('MP9', 'Latte Rush')],
    'restricted':      [('Tec-9', 'Whiteout'), ('Zeus x27', 'Charged Up'), ('MAC-10', 'Derailment')],
    'mil_spec':        [('Glock-18', 'Green Line'), ('FAMAS', '2A2F'), ('UMP-45', 'Late Night Transit'), ('XM1014', 'Run Run Run')],
    'industrial_grade':[('P90', 'Straight Dimes'), ('AUG', 'Steel Sentinel'), ('Galil AR', 'Green Apple'),
                        ('CZ75-Auto', 'Copper Fiber'), ('P250', 'Constructivist'), ('Nova', 'Rain Station')],
}

# ── Package list: (display_name, collection_key, market_price) ────────────────

PACKAGES = [
    # 2013-2015 Era
    ('DreamHack 2013 Dust II Souvenir Package',          'dust_ii',      45.00),
    ('DreamHack 2013 Mirage Souvenir Package',           'mirage',       55.00),
    ('DreamHack 2013 Inferno Souvenir Package',          'inferno',      60.00),
    ('DreamHack 2013 Nuke Souvenir Package',             'nuke',         75.00),
    ('DreamHack 2013 Train Souvenir Package',            'train',        40.00),

    ('EMS One Katowice 2014 Dust II Souvenir Package',   'dust_ii',     110.00),
    ('EMS One Katowice 2014 Mirage Souvenir Package',    'mirage',      130.00),
    ('EMS One Katowice 2014 Inferno Souvenir Package',   'inferno',     145.00),
    ('EMS One Katowice 2014 Nuke Souvenir Package',      'nuke',        160.00),
    ('EMS One Katowice 2014 Train Souvenir Package',     'train',        95.00),

    ('ESL One Cologne 2014 Dust II Souvenir Package',    'dust_ii',      45.00),
    ('ESL One Cologne 2014 Mirage Souvenir Package',     'mirage',       55.00),
    ('ESL One Cologne 2014 Inferno Souvenir Package',    'inferno',      65.00),
    ('ESL One Cologne 2014 Nuke Souvenir Package',       'nuke',         80.00),
    ('ESL One Cologne 2014 Cache Souvenir Package',      'cache',        90.00),
    ('ESL One Cologne 2014 Cobblestone Souvenir Package','cobblestone', 950.00),

    ('DreamHack Winter 2014 Dust II Souvenir Package',   'dust_ii',      40.00),
    ('DreamHack Winter 2014 Mirage Souvenir Package',    'mirage',       50.00),
    ('DreamHack Winter 2014 Inferno Souvenir Package',   'inferno',      55.00),
    ('DreamHack Winter 2014 Nuke Souvenir Package',      'nuke',         70.00),
    ('DreamHack Winter 2014 Cache Souvenir Package',     'cache',        75.00),
    ('DreamHack Winter 2014 Cobblestone Souvenir Package','cobblestone', 850.00),

    ('ESL One Katowice 2015 Dust II Souvenir Package',   'dust_ii',      55.00),
    ('ESL One Katowice 2015 Mirage Souvenir Package',    'mirage',       70.00),
    ('ESL One Katowice 2015 Inferno Souvenir Package',   'inferno',      75.00),
    ('ESL One Katowice 2015 Nuke Souvenir Package',      'nuke',         95.00),
    ('ESL One Katowice 2015 Cache Souvenir Package',     'cache',        85.00),
    ('ESL One Katowice 2015 Cobblestone Souvenir Package','cobblestone',1100.00),

    ('ESL One Cologne 2015 Dust II Souvenir Package',    'dust_ii',      35.00),
    ('ESL One Cologne 2015 Mirage Souvenir Package',     'mirage',       40.00),
    ('ESL One Cologne 2015 Inferno Souvenir Package',    'inferno',      45.00),
    ('ESL One Cologne 2015 Nuke Souvenir Package',       'nuke',         55.00),
    ('ESL One Cologne 2015 Cache Souvenir Package',      'cache',        50.00),
    ('ESL One Cologne 2015 Cobblestone Souvenir Package','cobblestone',  750.00),
    ('ESL One Cologne 2015 Overpass Souvenir Package',   'overpass',     65.00),

    ('DreamHack Cluj-Napoca 2015 Dust II Souvenir Package',   'dust_ii',     30.00),
    ('DreamHack Cluj-Napoca 2015 Mirage Souvenir Package',    'mirage',      35.00),
    ('DreamHack Cluj-Napoca 2015 Inferno Souvenir Package',   'inferno',     40.00),
    ('DreamHack Cluj-Napoca 2015 Nuke Souvenir Package',      'nuke',        50.00),
    ('DreamHack Cluj-Napoca 2015 Cache Souvenir Package',     'cache',       45.00),
    ('DreamHack Cluj-Napoca 2015 Cobblestone Souvenir Package','cobblestone',700.00),
    ('DreamHack Cluj-Napoca 2015 Overpass Souvenir Package',  'overpass',    55.00),
    ('DreamHack Cluj-Napoca 2015 Train Souvenir Package',     'train',       35.00),

    # 2016-2017 Era
    ('MLG Columbus 2016 Dust II Souvenir Package',    'dust_ii',     35.00),
    ('MLG Columbus 2016 Mirage Souvenir Package',     'mirage',      40.00),
    ('MLG Columbus 2016 Inferno Souvenir Package',    'inferno',     45.00),
    ('MLG Columbus 2016 Nuke Souvenir Package',       'nuke_2016',   50.00),
    ('MLG Columbus 2016 Cache Souvenir Package',      'cache',       45.00),
    ('MLG Columbus 2016 Cobblestone Souvenir Package','cobblestone', 650.00),
    ('MLG Columbus 2016 Overpass Souvenir Package',   'overpass',    45.00),
    ('MLG Columbus 2016 Train Souvenir Package',      'train',       30.00),

    ('ESL One Cologne 2016 Dust II Souvenir Package',    'dust_ii',     32.00),
    ('ESL One Cologne 2016 Mirage Souvenir Package',     'mirage',      38.00),
    ('ESL One Cologne 2016 Nuke Souvenir Package',       'nuke_2016',   48.00),
    ('ESL One Cologne 2016 Cache Souvenir Package',      'cache',       42.00),
    ('ESL One Cologne 2016 Cobblestone Souvenir Package','cobblestone', 600.00),
    ('ESL One Cologne 2016 Overpass Souvenir Package',   'overpass',    42.00),
    ('ESL One Cologne 2016 Train Souvenir Package',      'train',       28.00),

    ('ELEAGUE Atlanta 2017 Dust II Souvenir Package',    'dust_ii',     35.00),
    ('ELEAGUE Atlanta 2017 Mirage Souvenir Package',     'mirage',      42.00),
    ('ELEAGUE Atlanta 2017 Nuke Souvenir Package',       'nuke_2016',   52.00),
    ('ELEAGUE Atlanta 2017 Cache Souvenir Package',      'cache',       45.00),
    ('ELEAGUE Atlanta 2017 Cobblestone Souvenir Package','cobblestone', 680.00),
    ('ELEAGUE Atlanta 2017 Overpass Souvenir Package',   'overpass',    48.00),
    ('ELEAGUE Atlanta 2017 Train Souvenir Package',      'train',       32.00),

    ('PGL Krakow 2017 Mirage Souvenir Package',     'mirage',      45.00),
    ('PGL Krakow 2017 Inferno Souvenir Package',    'inferno',     50.00),
    ('PGL Krakow 2017 Nuke Souvenir Package',       'nuke_2016',   60.00),
    ('PGL Krakow 2017 Cache Souvenir Package',      'cache',       55.00),
    ('PGL Krakow 2017 Cobblestone Souvenir Package','cobblestone', 800.00),
    ('PGL Krakow 2017 Overpass Souvenir Package',   'overpass',    58.00),
    ('PGL Krakow 2017 Train Souvenir Package',      'train',       38.00),

    # 2018-2019 Era
    ('ELEAGUE Boston 2018 Mirage Souvenir Package',     'mirage',      50.00),
    ('ELEAGUE Boston 2018 Inferno Souvenir Package',    'inferno',     55.00),
    ('ELEAGUE Boston 2018 Nuke Souvenir Package',       'nuke_2016',   65.00),
    ('ELEAGUE Boston 2018 Cache Souvenir Package',      'cache',       60.00),
    ('ELEAGUE Boston 2018 Cobblestone Souvenir Package','cobblestone', 900.00),
    ('ELEAGUE Boston 2018 Overpass Souvenir Package',   'overpass',    70.00),
    ('ELEAGUE Boston 2018 Train Souvenir Package',      'train',       42.00),

    ('FACEIT London 2018 Mirage Souvenir Package',          'mirage',       14.00),
    ('FACEIT London 2018 Inferno 2018 Souvenir Package',    'inferno_2018', 15.00),
    ('FACEIT London 2018 Nuke 2018 Souvenir Package',       'nuke_2018',    13.00),
    ('FACEIT London 2018 Cache Souvenir Package',           'cache',        18.00),
    ('FACEIT London 2018 Overpass Souvenir Package',        'overpass',     16.00),
    ('FACEIT London 2018 Train Souvenir Package',           'train',        12.00),
    ('FACEIT London 2018 Dust II Souvenir Package',         'dust_ii',      15.00),

    ('IEM Katowice 2019 Mirage Souvenir Package',           'mirage',       12.50),
    ('IEM Katowice 2019 Inferno 2018 Souvenir Package',     'inferno_2018', 13.50),
    ('IEM Katowice 2019 Nuke 2018 Souvenir Package',        'nuke_2018',    11.50),
    ('IEM Katowice 2019 Cache Souvenir Package',            'cache',        16.50),
    ('IEM Katowice 2019 Overpass Souvenir Package',         'overpass',     14.50),
    ('IEM Katowice 2019 Train Souvenir Package',            'train',        11.00),
    ('IEM Katowice 2019 Dust II Souvenir Package',          'dust_ii',      13.50),

    ('StarLadder Berlin 2019 Mirage Souvenir Package',          'mirage',       11.00),
    ('StarLadder Berlin 2019 Inferno 2018 Souvenir Package',    'inferno_2018', 12.50),
    ('StarLadder Berlin 2019 Nuke 2018 Souvenir Package',       'nuke_2018',    10.50),
    ('StarLadder Berlin 2019 Vertigo Souvenir Package',         'vertigo',      14.00),
    ('StarLadder Berlin 2019 Overpass Souvenir Package',        'overpass',     13.00),
    ('StarLadder Berlin 2019 Train Souvenir Package',           'train',        10.00),
    ('StarLadder Berlin 2019 Dust II Souvenir Package',         'dust_ii',      12.00),

    # 2021-2023 Era
    ('PGL Stockholm 2021 Mirage 2021 Souvenir Package',  'mirage_2021',  24.00),
    ('PGL Stockholm 2021 Inferno 2018 Souvenir Package', 'inferno_2018',  9.50),
    ('PGL Stockholm 2021 Nuke 2018 Souvenir Package',    'nuke_2018',     9.00),
    ('PGL Stockholm 2021 Ancient Souvenir Package',      'ancient',      18.00),
    ('PGL Stockholm 2021 Overpass Souvenir Package',     'overpass',     11.50),
    ('PGL Stockholm 2021 Vertigo 2021 Souvenir Package', 'vertigo_2021', 12.00),
    ('PGL Stockholm 2021 Dust II 2021 Souvenir Package', 'dust_ii_2021', 32.00),

    ('PGL Antwerp 2022 Mirage 2021 Souvenir Package',  'mirage_2021',  14.00),
    ('PGL Antwerp 2022 Inferno 2018 Souvenir Package', 'inferno_2018',  6.50),
    ('PGL Antwerp 2022 Nuke 2018 Souvenir Package',    'nuke_2018',     6.00),
    ('PGL Antwerp 2022 Ancient Souvenir Package',      'ancient',      10.50),
    ('PGL Antwerp 2022 Overpass Souvenir Package',     'overpass',      7.50),
    ('PGL Antwerp 2022 Vertigo 2021 Souvenir Package', 'vertigo_2021',  7.00),
    ('PGL Antwerp 2022 Dust II 2021 Souvenir Package', 'dust_ii_2021', 18.00),

    ('IEM Rio 2022 Mirage 2021 Souvenir Package',  'mirage_2021',  13.00),
    ('IEM Rio 2022 Inferno 2018 Souvenir Package', 'inferno_2018',  6.00),
    ('IEM Rio 2022 Nuke 2018 Souvenir Package',    'nuke_2018',     5.50),
    ('IEM Rio 2022 Ancient Souvenir Package',      'ancient',      11.00),
    ('IEM Rio 2022 Overpass Souvenir Package',     'overpass',      7.00),
    ('IEM Rio 2022 Vertigo 2021 Souvenir Package', 'vertigo_2021',  6.50),
    ('IEM Rio 2022 Dust II 2021 Souvenir Package', 'dust_ii_2021', 16.50),

    ('BLAST.tv Paris 2023 Anubis Souvenir Package',       'anubis',       6.50),
    ('BLAST.tv Paris 2023 Mirage 2021 Souvenir Package',  'mirage_2021',  5.50),
    ('BLAST.tv Paris 2023 Inferno 2018 Souvenir Package', 'inferno_2018', 4.50),
    ('BLAST.tv Paris 2023 Nuke 2018 Souvenir Package',    'nuke_2018',    4.00),
    ('BLAST.tv Paris 2023 Ancient Souvenir Package',      'ancient',      5.00),
    ('BLAST.tv Paris 2023 Overpass Souvenir Package',     'overpass',     4.80),
    ('BLAST.tv Paris 2023 Vertigo 2021 Souvenir Package', 'vertigo_2021', 4.20),

    # Modern CS2 Era (2024-2026)
    ('PGL Copenhagen 2024 Anubis Souvenir Package',       'anubis',       5.20),
    ('PGL Copenhagen 2024 Mirage 2021 Souvenir Package',  'mirage_2021',  4.80),
    ('PGL Copenhagen 2024 Inferno 2023 Souvenir Package', 'inferno_2018', 4.80),
    ('PGL Copenhagen 2024 Nuke 2018 Souvenir Package',    'nuke_2018',    3.80),
    ('PGL Copenhagen 2024 Ancient Souvenir Package',      'ancient',      4.20),
    ('PGL Copenhagen 2024 Overpass Souvenir Package',     'overpass',     4.50),
    ('PGL Copenhagen 2024 Vertigo 2021 Souvenir Package', 'vertigo_2021', 3.50),

    ('Perfect World Shanghai 2024 Anubis Souvenir Package',       'anubis',       4.50),
    ('Perfect World Shanghai 2024 Mirage 2021 Souvenir Package',  'mirage_2021',  4.00),
    ('Perfect World Shanghai 2024 Inferno 2023 Souvenir Package', 'inferno_2018', 3.80),
    ('Perfect World Shanghai 2024 Nuke 2018 Souvenir Package',    'nuke_2018',    3.20),
    ('Perfect World Shanghai 2024 Ancient Souvenir Package',      'ancient',      3.80),
    ('Perfect World Shanghai 2024 Vertigo 2021 Souvenir Package', 'vertigo_2021', 3.00),

    ('BLAST Austin 2025 Anubis Souvenir Package',       'anubis',       4.20),
    ('BLAST Austin 2025 Mirage 2021 Souvenir Package',  'mirage_2021',  3.80),
    ('BLAST Austin 2025 Inferno 2023 Souvenir Package', 'inferno_2018', 3.50),
    ('BLAST Austin 2025 Nuke 2018 Souvenir Package',    'nuke_2018',    3.20),
    ('BLAST Austin 2025 Ancient Souvenir Package',      'ancient',      3.60),
    ('BLAST Austin 2025 Vertigo 2021 Souvenir Package', 'vertigo_2021', 3.00),
    ('BLAST Austin 2025 Train 2024 Souvenir Package',   'train_2025',   6.00),

]

# ── Build JSON ────────────────────────────────────────────────────────────────

output = {"format_version": "1.0", "cases": []}

for pkg_name, col_key, price in PACKAGES:
    collection = COLLECTIONS[col_key]
    present_rarities = set(collection.keys())
    weights = calculate_weights(present_rarities)
    items = {rarity: make_items(pairs) for rarity, pairs in collection.items()}

    output["cases"].append({
        "id":             make_package_id(pkg_name),
        "name":           pkg_name,
        "type":           "souvenir_package",
        "market_price":   price,
        "image_url":      None,
        "rarity_weights": weights,
        "items":          items,
    })

out_path = "public/data/souvenirs.json"
with open(out_path, "w") as f:
    json.dump(output, f, indent=2)

print(f"Generated {out_path} with {len(output['cases'])} packages.")
for col_key in COLLECTIONS:
    count = sum(1 for _, ck, _ in PACKAGES if ck == col_key)
    print(f"  {col_key}: {count} packages")
