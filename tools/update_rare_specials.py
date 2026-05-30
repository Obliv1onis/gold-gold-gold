#!/usr/bin/env python3
"""
Update rare_special items in public/data/cases.json
based on design/reference/rare-specials.md
"""
import json, re, urllib.request, sys

# ── helpers ────────────────────────────────────────────────────────────────────

def slug(s):
    return re.sub(r'[^a-z0-9]+', '_', s.lower()).strip('_')

def avg(*prices):
    """Return average of two prices, or single price."""
    return round(sum(prices) / len(prices), 2)

def parse_price(s):
    """'$342.90 - $480.35' or '$718.16' → average float."""
    nums = [float(n.replace(',', '')) for n in re.findall(r'[\d,]+\.?\d*', s)]
    return round(sum(nums) / len(nums), 2) if nums else 0.0

# ── ByMykel image lookup ────────────────────────────────────────────────────────

def fetch_image_lookup():
    """Build (weapon_no_star, skin_name) → image_url from ByMykel skins API.

    Uses skins.json (contains all items including knives/gloves with ★ prefix).
    First occurrence of each (weapon, skin) pair wins — avoids Doppler phase collisions.
    """
    url = ('https://raw.githubusercontent.com/ByMykel/CSGO-API'
           '/main/public/api/en/skins.json')
    print(f'  Fetching {url}…', flush=True)
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=60) as r:
        items = json.loads(r.read().decode())

    lookup = {}   # exact (weapon, skin) keys
    lookup_ci = {}  # lowercased (weapon, skin) → canonical image, for fallback

    for item in items:
        raw = item.get('name', '')
        img = item.get('image', '') or ''
        if not raw or not img:
            continue
        if not raw.startswith('★ '):
            continue
        name = raw[2:].strip()
        if ' | ' in name:
            weapon, skin = name.split(' | ', 1)
            skin_key = re.sub(r'\s*\(Phase \d+\)|\s*\(Ruby\)|\s*\(Sapphire\)|\s*\(Black Pearl\)', '', skin).strip()
        else:
            weapon, skin_key = name, 'Vanilla'
        if (weapon, skin_key) not in lookup:
            lookup[(weapon, skin_key)] = img
        ci_key = (weapon.lower(), skin_key.lower())
        if ci_key not in lookup_ci:
            lookup_ci[ci_key] = img

    # Merge both dicts into a combined lookup object
    class _Lookup:
        def get(self, key, default=None):
            v = lookup.get(key)
            if v is not None:
                return v
            v = lookup_ci.get((key[0].lower(), key[1].lower()))
            return v if v is not None else default

    print(f'  Loaded {len(lookup)} knife/glove image entries.')
    return _Lookup()

# ── item builder ───────────────────────────────────────────────────────────────

def make_item(weapon, skin_display, prefix, market_price, imgs):
    """
    weapon        – weapon name without ★  (e.g. 'M9 Bayonet')
    skin_display  – plain skin name        (e.g. 'Stained', 'Vanilla', 'Doppler')
    prefix        – item_id prefix         (e.g. 'csgo1_')
    market_price  – float
    imgs          – lookup dict
    """
    skin_in_json = f'★ {skin_display}'  # always store ★ in the skin field
    image_url    = imgs.get((weapon, skin_display), None)
    item_id      = f'{prefix}{slug(weapon)}_{slug(skin_display)}'
    return {
        'weapon':       weapon,
        'skin':         skin_in_json,
        'item_id':      item_id,
        'image_url':    image_url,
        'market_price': market_price,
        'stattrak':     False,
    }

def knife_items(weapon, skin_prices, prefix, imgs):
    return [make_item(weapon, s, prefix, p, imgs) for s, p in skin_prices]

def glove_items(weapon, skin_prices, prefix, imgs):
    return [make_item(weapon, s, prefix, p, imgs) for s, p in skin_prices]

# ── skin/price lists from rare-specials.md ─────────────────────────────────────

# Classic OG skins (csgo cases, esports, winter offensive, bravo, phoenix, vanguard, revolver)
CLASSIC_M9 = [
    ('Vanilla', 718.16),
    ('Stained', avg(342.90, 480.35)),
    ('Boreal Forest', avg(274.76, 1313.65)),
    ('Night', avg(307.35, 1074.06)),
    ('Slaughter', avg(613.37, 812.75)),
    ('Scorched', avg(280.97, 1182.25)),
    ('Forest DDPAT', avg(270.47, 9607.00)),
    ('Crimson Web', avg(406.15, 4360.10)),
    ('Fade', avg(894.04, 975.33)),
    ('Safari Mesh', avg(271.14, 739.00)),
    ('Blue Steel', avg(443.10, 812.89)),
    ('Case Hardened', avg(418.20, 1182.25)),
    ('Urban Masked', avg(289.69, 812.90)),
]
CLASSIC_BAYONET = [
    ('Vanilla', 228.35),
    ('Stained', avg(166.41, 291.17)),
    ('Boreal Forest', avg(120.60, 796.35)),
    ('Night', avg(132.21, 985.23)),
    ('Slaughter', avg(304.47, 381.25)),
    ('Scorched', avg(124.15, 154.98)),
    ('Forest DDPAT', avg(118.98, 317.33)),
    ('Crimson Web', avg(190.50, 2052.65)),
    ('Fade', avg(333.95, 453.58)),
    ('Safari Mesh', avg(119.42, 395.51)),
    ('Blue Steel', avg(191.99, 428.62)),
    ('Case Hardened', avg(221.70, 487.74)),
    ('Urban Masked', avg(127.11, 162.58)),
]
CLASSIC_FLIP = [
    ('Vanilla', 195.10),
    ('Stained', avg(121.12, 172.78)),
    ('Boreal Forest', avg(114.47, 279.05)),
    ('Night', avg(121.20, 591.20)),
    ('Slaughter', avg(261.53, 294.57)),
    ('Scorched', avg(117.50, 283.78)),
    ('Forest DDPAT', avg(113.81, 190.37)),
    ('Crimson Web', avg(183.12, 1246.18)),
    ('Fade', avg(310.38, 406.45)),
    ('Safari Mesh', avg(112.02, 177.36)),
    ('Blue Steel', avg(148.17, 368.69)),
    ('Case Hardened', avg(152.23, 354.28)),
    ('Urban Masked', avg(118.98, 150.02)),
]
CLASSIC_KARAMBIT = [
    ('Vanilla', 957.74),
    ('Stained', avg(472.96, 768.56)),
    ('Boreal Forest', avg(361.96, 1414.45)),
    ('Night', avg(426.85, 2956.00)),
    ('Slaughter', avg(849.85, 1049.38)),
    ('Scorched', avg(389.75, 870.25)),
    ('Forest DDPAT', avg(369.50, 639.53)),
    ('Crimson Web', avg(517.30, 8703.65)),
    ('Fade', avg(1670.07, 1847.43)),
    ('Safari Mesh', avg(362.11, 369.50)),
    ('Blue Steel', avg(614.40, 1256.30)),
    ('Case Hardened', avg(632.58, 1843.95)),
    ('Urban Masked', avg(376.89, 886.65)),
]
CLASSIC_GUT = [
    ('Vanilla', 63.40),
    ('Stained', avg(65.03, 147.50)),
    ('Boreal Forest', avg(48.62, 266.04)),
    ('Night', avg(58.97, 443.40)),
    ('Slaughter', avg(112.31, 117.28)),
    ('Scorched', avg(51.66, 591.05)),
    ('Forest DDPAT', avg(48.76, 59.05)),
    ('Crimson Web', avg(77.96, 1108.50)),
    ('Fade', avg(131.12, 218.74)),
    ('Safari Mesh', avg(48.77, 71.98)),
    ('Blue Steel', avg(72.35, 125.56)),
    ('Case Hardened', avg(94.59, 266.04)),
    ('Urban Masked', avg(54.55, 116.76)),
]

HUNTSMAN = [
    ('Vanilla', 124.08),
    ('Stained', avg(90.16, 267.38)),
    ('Boreal Forest', avg(73.90, 426.85)),
    ('Night', avg(78.26, 145.83)),
    ('Slaughter', avg(199.53, 295.45)),
    ('Scorched', avg(65.77, 985.23)),
    ('Forest DDPAT', avg(63.55, 84.69)),
    ('Crimson Web', avg(107.73, 857.24)),
    ('Fade', 229.02),
    ('Safari Mesh', avg(59.34, 73.90)),
    ('Blue Steel', avg(125.48, 2956.00)),
    ('Case Hardened', avg(162.58, 369.35)),
    ('Urban Masked', avg(66.36, 739.00)),
]

BUTTERFLY = [
    ('Vanilla', 1182.25),
    ('Stained', avg(502.52, 812.90)),
    ('Boreal Forest', avg(406.45, 975.48)),
    ('Night', avg(450.05, 1477.93)),
    ('Slaughter', avg(1064.09, 1321.18)),
    ('Scorched', avg(413.84, 930.99)),
    ('Forest DDPAT', avg(404.82, 679.88)),
    ('Crimson Web', avg(524.69, 5017.81)),
    ('Fade', avg(1891.75, 2052.87)),
    ('Safari Mesh', avg(404.75, 750.53)),
    ('Blue Steel', avg(657.71, 1167.47)),
    ('Case Hardened', avg(627.85, 1319.41)),
    ('Urban Masked', avg(428.32, 1149.44)),
]

FALCHION = [
    ('Vanilla', 113.14),
    ('Stained', avg(81.29, 147.80)),
    ('Boreal Forest', avg(66.44, 216.53)),
    ('Night', avg(83.01, 344.82)),
    ('Slaughter', avg(205.43, 243.87)),
    ('Scorched', avg(64.12, 147.80)),
    ('Forest DDPAT', avg(63.47, 1034.45)),
    ('Crimson Web', avg(120.04, 1182.25)),
    ('Fade', avg(208.40, 266.03)),
    ('Safari Mesh', avg(60.52, 67.84)),
    ('Blue Steel', avg(116.02, 249.59)),
    ('Case Hardened', avg(158.71, 325.09)),
    ('Urban Masked', avg(66.51, 246.23)),
]

SHADOW = [
    ('Vanilla', 70.35),
    ('Stained', avg(58.97, 147.80)),
    ('Boreal Forest', avg(45.02, 205.15)),
    ('Night', avg(53.01, 70.93)),
    ('Slaughter', avg(102.72, 140.40)),
    ('Scorched', avg(49.65, 103.46)),
    ('Forest DDPAT', avg(48.36, 1431.64)),
    ('Crimson Web', avg(66.38, 354.72)),
    ('Fade', avg(144.42, 235.96)),
    ('Safari Mesh', avg(43.55, 63.30)),
    ('Blue Steel', avg(60.15, 280.52)),
    ('Case Hardened', avg(116.02, 265.97)),
    ('Urban Masked', avg(50.61, 147.80)),
]

BOWIE = [
    ('Vanilla', 92.89),
    ('Stained', avg(76.86, 140.34)),
    ('Boreal Forest', avg(57.63, 79.22)),
    ('Night', avg(73.81, 739.00)),
    ('Slaughter', avg(179.64, 236.18)),
    ('Scorched', avg(60.82, 79.81)),
    ('Forest DDPAT', avg(58.81, 162.58)),
    ('Crimson Web', avg(118.24, 2217.00)),
    ('Fade', avg(205.44, 628.15)),
    ('Safari Mesh', avg(53.21, 63.24)),
    ('Blue Steel', avg(96.07, 251.11)),
    ('Case Hardened', avg(146.31, 663.62)),
    ('Urban Masked', avg(59.95, 87.20)),
]

# Chroma skins
CHROMA_M9 = [
    ('Rust Coat', avg(324.94, 347.33)),
    ('Doppler', avg(892.71, 960.70)),
    ('Damascus Steel', avg(399.06, 454.48)),
    ('Marble Fade', avg(737.52, 886.06)),
    ('Ultraviolet', avg(310.38, 1616.93)),
    ('Tiger Tooth', avg(620.02, 642.93)),
]
CHROMA_BAYONET = [
    ('Rust Coat', avg(124.89, 172.33)),
    ('Doppler', avg(383.39, 458.18)),
    ('Damascus Steel', avg(160.36, 203.96)),
    ('Marble Fade', avg(331.74, 517.23)),
    ('Ultraviolet', avg(129.77, 515.82)),
    ('Tiger Tooth', avg(287.25, 412.06)),
]
CHROMA_FLIP = [
    ('Rust Coat', avg(123.27, 126.95)),
    ('Doppler', avg(310.38, 384.06)),
    ('Damascus Steel', avg(128.59, 206.91)),
    ('Marble Fade', avg(258.58, 332.54)),
    ('Ultraviolet', avg(124.00, 367.73)),
    ('Tiger Tooth', avg(209.88, 295.45)),
]
CHROMA_KARAMBIT = [
    ('Rust Coat', avg(435.27, 465.57)),
    ('Doppler', avg(1180.63, 1239.75)),
    ('Damascus Steel', avg(546.85, 642.93)),
    ('Marble Fade', avg(978.44, 1135.10)),
    ('Ultraviolet', avg(421.82, 1699.70)),
    ('Tiger Tooth', avg(823.25, 916.29)),
]
CHROMA_GUT = [
    ('Rust Coat', avg(48.63, 75.23)),
    ('Doppler', avg(125.25, 169.88)),
    ('Damascus Steel', avg(65.03, 86.51)),
    ('Marble Fade', avg(119.64, 265.89)),
    ('Ultraviolet', avg(55.42, 266.04)),
    ('Tiger Tooth', avg(110.85, 150.31)),
]

# Gamma skins
GAMMA_M9 = [
    ('Lore', avg(380.88, 1123.28)),
    ('Gamma Doppler', avg(1149.44, 1313.57)),
    ('Bright Water', avg(310.38, 376.15)),
    ('Autotronic', avg(542.43, 1182.40)),
    ('Freehand', avg(325.01, 397.51)),
    ('Black Laminate', avg(428.32, 709.44)),
]
GAMMA_BAYONET = [
    ('Lore', avg(211.06, 433.64)),
    ('Gamma Doppler', avg(472.81, 665.10)),
    ('Bright Water', avg(138.36, 206.91)),
    ('Autotronic', avg(253.48, 581.95)),
    ('Freehand', avg(157.48, 205.04)),
    ('Black Laminate', avg(147.65, 265.30)),
]
GAMMA_FLIP = [
    ('Lore', avg(155.19, 271.14)),
    ('Gamma Doppler', avg(387.24, 458.11)),
    ('Bright Water', avg(121.94, 137.45)),
    ('Autotronic', avg(155.12, 312.01)),
    ('Freehand', avg(126.14, 137.45)),
    ('Black Laminate', avg(119.57, 190.66)),
]
GAMMA_KARAMBIT = [
    ('Lore', avg(455.15, 1034.45)),
    ('Gamma Doppler', avg(1596.24, 1757.05)),
    ('Bright Water', avg(421.23, 511.39)),
    ('Autotronic', avg(658.38, 1625.80)),
    ('Freehand', avg(457.88, 557.94)),
    ('Black Laminate', avg(561.64, 935.57)),
]
GAMMA_GUT = [
    ('Lore', avg(84.53, 131.08)),
    ('Gamma Doppler', avg(158.89, 279.05)),
    ('Bright Water', avg(56.73, 119.72)),
    ('Autotronic', avg(102.79, 236.48)),
    ('Freehand', avg(58.97, 86.91)),
    ('Black Laminate', avg(57.27, 110.52)),
]

# Glove Case
GLOVE_SPECIALIST = [
    ('Foundation', avg(169.97, 2098.76)),
    ('Forest DDPAT', avg(134.50, 842.09)),
    ('Crimson Kimono', avg(1101.85, 10181.65)),
    ('Emerald Web', avg(374.67, 4877.33)),
]
GLOVE_MOTO_ORIGINAL = [
    ('BOOM!', avg(122.60, 1151.07)),
    ('Eclipse', avg(104.86, 1024.25)),
    ('Cool Mint', avg(180.90, 3087.25)),
    ('Spearmint', avg(352.80, 7685.53)),
]
GLOVE_BLOODHOUND = [
    ('Bronzed', avg(82.75, 657.71)),
    ('Guerrilla', avg(87.20, 524.69)),
    ('Charred', avg(138.70, 618.99)),
    ('Snakebite', avg(94.50, 591.05)),
]
GLOVE_HANDWRAPS_ORIGINAL = [
    ('Spruce DDPAT', avg(115.95, 1002.08)),
    ('Slaughter', avg(191.97, 1374.24)),
    ('Badlands', avg(118.00, 715.94)),
    ('Leather', avg(205.43, 1189.79)),
]
GLOVE_SPORT_ORIGINAL = [
    ('Arid', avg(293.68, 4433.85)),
    ('Hedge Maze', avg(2217.00, 32515.85)),
    ("Pandora's Box", avg(2046.22, 41384.00)),
    ('Superconductor', avg(881.63, 10641.60)),
]
GLOVE_DRIVER_ORIGINAL = [
    ('Convoy', avg(83.06, 985.33)),
    ('Lunar Weave', avg(112.52, 1404.10)),
    ('Crimson Weave', avg(174.48, 4034.94)),
    ('Diamondback', avg(123.90, 1213.31)),
]

# Spectrum skins
SPECTRUM_FALCHION = [
    ('Rust Coat', avg(58.68, 73.90)),
    ('Doppler', avg(294.12, 381.18)),
    ('Damascus Steel', avg(88.59, 135.98)),
    ('Marble Fade', avg(183.71, 397.00)),
    ('Ultraviolet', avg(75.38, 295.38)),
    ('Tiger Tooth', 138.05),
]
SPECTRUM_SHADOW = [
    ('Rust Coat', avg(43.60, 57.35)),
    ('Doppler', avg(140.26, 264.18)),
    ('Damascus Steel', avg(50.18, 85.06)),
    ('Marble Fade', avg(106.34, 251.11)),
    ('Ultraviolet', avg(52.98, 221.70)),
    ('Tiger Tooth', avg(80.80, 133.02)),
]
SPECTRUM_HUNTSMAN = [
    ('Rust Coat', avg(56.13, 75.19)),
    ('Doppler', avg(286.58, 442.93)),
    ('Damascus Steel', avg(87.00, 118.24)),
    ('Marble Fade', avg(189.18, 295.38)),
    ('Ultraviolet', avg(60.52, 532.08)),
    ('Tiger Tooth', avg(152.23, 234.71)),
]
SPECTRUM_BUTTERFLY = [
    ('Rust Coat', avg(502.37, 517.30)),
    ('Doppler', avg(1921.40, 2511.49)),
    ('Damascus Steel', avg(605.83, 804.03)),
    ('Marble Fade', avg(1267.98, 1477.85)),
    ('Ultraviolet', avg(451.53, 2023.09)),
    ('Tiger Tooth', 1071.55),
]
SPECTRUM_BOWIE = [
    ('Rust Coat', avg(51.58, 73.60)),
    ('Doppler', avg(249.93, 443.22)),
    ('Damascus Steel', avg(82.47, 118.15)),
    ('Marble Fade', avg(162.58, 248.20)),
    ('Ultraviolet', avg(62.08, 391.67)),
    ('Tiger Tooth', avg(130.80, 176.91)),
]

# Clutch / Revolution gloves
CLUTCH_SPECIALIST = [
    ('Mogul', avg(99.66, 589.65)),
    ('Crimson Web', avg(113.80, 1152.62)),
    ('Fade', avg(121.49, 1825.77)),
    ('Buckshot', avg(49.93, 266.04)),
]
CLUTCH_HYDRA = [
    ('Rattler', avg(35.03, 144.55)),
    ('Mangrove', avg(34.67, 212.76)),
    ('Emerald', avg(38.21, 184.75)),
    ('Case Hardened', avg(62.00, 364.47)),
]
CLUTCH_MOTO = [
    ('Transport', avg(39.91, 317.77)),
    ('POW!', avg(60.21, 605.83)),
    ('Polygon', avg(98.73, 605.91)),
    ('Turtle', avg(66.44, 589.43)),
]
CLUTCH_HANDWRAPS = [
    ('Overprint', avg(80.70, 517.26)),
    ('Arboreal', avg(45.01, 218.74)),
    ('Cobalt Skulls', avg(178.10, 1313.65)),
    ('Duct Tape', avg(48.63, 2039.64)),
]
CLUTCH_SPORT = [
    ('Amphibious', avg(232.05, 2252.62)),
    ('Omega', avg(144.84, 1428.63)),
    ('Vice', avg(271.14, 6798.65)),
    ('Bronze Morph', avg(101.57, 458.18)),
]
CLUTCH_DRIVER = [
    ('Racing Green', avg(35.46, 264.63)),
    ('King Snake', avg(110.55, 2496.05)),
    ('Imperial Plaid', avg(145.11, 1048.12)),
    ('Overtake', avg(53.41, 382.80)),
]

# Horizon / Danger Zone  (Night → Night Stripe)
NAVAJA = [
    ('Vanilla', 43.82),
    ('Stained', avg(47.00, 101.98)),
    ('Boreal Forest', avg(44.19, 53.49)),
    ('Night Stripe', avg(44.78, 221.63)),
    ('Slaughter', avg(93.10, 103.39)),
    ('Scorched', avg(44.27, 132.87)),
    ('Forest DDPAT', avg(42.42, 49.60)),
    ('Crimson Web', avg(65.42, 573.46)),
    ('Fade', avg(109.37, 145.44)),
    ('Safari Mesh', avg(41.98, 53.93)),
    ('Blue Steel', avg(51.73, 128.59)),
    ('Case Hardened', avg(75.78, 147.80)),
    ('Urban Masked', avg(46.51, 190.37)),
]
URSUS = [
    ('Vanilla', 103.46),
    ('Stained', avg(79.06, 118.09)),
    ('Boreal Forest', avg(57.57, 137.01)),
    ('Night Stripe', avg(72.12, 428.62)),
    ('Slaughter', avg(159.62, 173.66)),
    ('Scorched', avg(61.93, 175.73)),
    ('Forest DDPAT', avg(58.96, 177.21)),
    ('Crimson Web', avg(113.81, 1005.04)),
    ('Fade', avg(195.10, 294.12)),
    ('Safari Mesh', avg(56.16, 140.41)),
    ('Blue Steel', avg(88.68, 190.37)),
    ('Case Hardened', avg(113.81, 240.81)),
    ('Urban Masked', avg(68.73, 295.60)),
]
STILETTO = [
    ('Vanilla', 194.43),
    ('Stained', avg(162.58, 224.66)),
    ('Boreal Forest', avg(120.31, 292.57)),
    ('Night Stripe', avg(131.25, 153.71)),
    ('Slaughter', avg(324.79, 408.74)),
    ('Scorched', avg(128.07, 307.57)),
    ('Forest DDPAT', avg(118.98, 295.60)),
    ('Crimson Web', avg(199.23, 1344.98)),
    ('Fade', avg(394.33, 428.47)),
    ('Safari Mesh', avg(120.38, 369.50)),
    ('Blue Steel', avg(189.04, 336.76)),
    ('Case Hardened', avg(198.88, 502.52)),
    ('Urban Masked', avg(140.26, 369.50)),
]
TALON = [
    ('Vanilla', 299.37),
    ('Stained', avg(273.43, 399.06)),
    ('Boreal Forest', avg(192.14, 484.78)),
    ('Night Stripe', avg(214.31, 531.78)),
    ('Slaughter', avg(487.43, 675.45)),
    ('Scorched', avg(197.53, 413.69)),
    ('Forest DDPAT', avg(189.18, 235.30)),
    ('Crimson Web', avg(309.64, 2956.00)),
    ('Fade', avg(729.91, 975.48)),
    ('Safari Mesh', avg(191.99, 384.28)),
    ('Blue Steel', avg(351.02, 620.76)),
    ('Case Hardened', avg(368.44, 902.32)),
    ('Urban Masked', avg(208.32, 575.83)),
]

# Prisma skins (7 per type: Vanilla + 6)
PRISMA_NAVAJA = [
    ('Vanilla', 43.82),
    ('Rust Coat', avg(42.57, 49.51)),
    ('Doppler', avg(113.07, 169.97)),
    ('Damascus Steel', avg(44.34, 98.27)),
    ('Marble Fade', avg(103.46, 127.11)),
    ('Ultraviolet', avg(47.89, 134.50)),
    ('Tiger Tooth', avg(73.89, 125.62)),
]
PRISMA_URSUS = [
    ('Vanilla', 103.46),
    ('Rust Coat', avg(56.90, 68.73)),
    ('Doppler', avg(236.04, 379.85)),
    ('Damascus Steel', avg(79.52, 106.19)),
    ('Marble Fade', avg(159.33, 199.66)),
    ('Ultraviolet', avg(81.29, 472.96)),
    ('Tiger Tooth', avg(132.72, 155.19)),
]
PRISMA_STILETTO = [
    ('Vanilla', 194.43),
    ('Rust Coat', avg(130.95, 144.84)),
    ('Doppler', avg(421.23, 539.47)),
    ('Damascus Steel', avg(169.97, 221.39)),
    ('Marble Fade', avg(285.25, 310.38)),
    ('Ultraviolet', avg(140.41, 458.18)),
    ('Tiger Tooth', avg(268.26, 292.64)),
]
PRISMA_TALON = [
    ('Vanilla', 299.37),
    ('Rust Coat', avg(236.41, 254.22)),
    ('Doppler', avg(781.57, 837.90)),
    ('Damascus Steel', avg(282.30, 339.94)),
    ('Marble Fade', avg(545.38, 641.45)),
    ('Ultraviolet', avg(233.52, 960.70)),
    ('Tiger Tooth', avg(450.79, 456.70)),
]

# CS20 Nomad
NOMAD_CLASSIC = [
    ('Vanilla', 181.79),
    ('Stained', avg(87.91, 132.95)),
    ('Boreal Forest', avg(65.77, 236.33)),
    ('Night Stripe', avg(96.81, 492.25)),
    ('Slaughter', avg(168.05, 192.14)),
    ('Scorched', avg(73.90, 295.60)),
    ('Forest DDPAT', avg(64.96, 295.60)),
    ('Crimson Web', avg(140.26, 1182.40)),
    ('Fade', avg(268.55, 299.37)),
    ('Safari Mesh', avg(65.77, 251.26)),
    ('Blue Steel', avg(106.12, 221.69)),
    ('Case Hardened', avg(122.53, 298.85)),
    ('Urban Masked', avg(73.90, 354.72)),
]

# Shattered Web
SURVIVAL_CLASSIC = [
    ('Vanilla', 55.43),
    ('Stained', avg(66.21, 113.51)),
    ('Boreal Forest', avg(44.19, 131.25)),
    ('Night Stripe', avg(53.13, 132.80)),
    ('Slaughter', avg(115.12, 127.03)),
    ('Scorched', avg(49.14, 162.43)),
    ('Forest DDPAT', avg(45.74, 156.67)),
    ('Crimson Web', avg(90.16, 753.78)),
    ('Fade', avg(138.12, 192.14)),
    ('Safari Mesh', avg(43.60, 106.42)),
    ('Blue Steel', avg(68.50, 140.41)),
    ('Case Hardened', avg(90.45, 191.25)),
    ('Urban Masked', avg(48.37, 61.34)),
]
NOMAD_SWEB = [
    ('Vanilla', 137.16),
    ('Stained', avg(113.14, 178.75)),
    ('Boreal Forest', avg(81.22, 147.80)),
    ('Night Stripe', avg(91.34, 162.43)),
    ('Slaughter', avg(211.28, 240.69)),
    ('Scorched', avg(83.36, 164.06)),
    ('Forest DDPAT', avg(78.19, 206.92)),
    ('Crimson Web', avg(140.41, 933.65)),
    ('Fade', avg(289.69, 302.92)),
    ('Safari Mesh', avg(74.49, 128.59)),
]

# BFang / Snakebite / Recoil gloves
BFANG_SPECIALIST = [
    ('Field Agent', avg(104.04, 960.63)),
    ('Marble Fade', avg(118.17, 1773.60)),
    ('Tiger Strike', avg(104.05, 1054.10)),
    ('Lt. Commander', avg(96.07, 731.61)),
]
BFANG_MOTO = [
    ('Smoke Out', avg(92.23, 724.07)),
    ('3rd Commando Company', avg(41.93, 354.50)),
    ('Finish Line', avg(78.33, 502.08)),
    ('Blood Pressure', avg(90.08, 783.34)),
]
BFANG_GLOVES = [
    ('Unhinged', avg(58.53, 295.60)),
    ('Jade', avg(84.99, 570.10)),
    ('Needle Point', avg(50.03, 251.26)),
    ('Yellow-banded', avg(51.02, 302.99)),
]
BFANG_HANDWRAPS = [
    ('Desert Shamagh', avg(44.34, 566.92)),
    ('Constrictor', avg(49.19, 279.34)),
    ('CAUTION!', avg(115.11, 591.20)),
    ('Giraffe', avg(45.70, 338.39)),
]
BFANG_SPORT = [
    ('Nocts', avg(405.97, 2611.03)),
    ('Big Game', avg(122.60, 846.95)),
    ('Slingshot', avg(195.79, 3042.83)),
    ('Scarlet Shamagh', avg(147.47, 916.51)),
]
BFANG_DRIVER = [
    ('Rezan the Red', avg(70.21, 731.61)),
    ('Queen Jaguar', avg(53.65, 545.31)),
    ('Black Tie', avg(111.96, 1285.86)),
    ('Snow Leopard', avg(227.17, 2142.95)),
]

# Riptide / Dreams & Nightmares  (gamma finishes + Huntsman Lore only)
RIPTIDE_FALCHION = [
    ('Lore', avg(100.50, 161.69)),
    ('Gamma Doppler', avg(206.92, 273.43)),
    ('Bright Water', avg(67.47, 96.07)),
    ('Autotronic', avg(101.98, 169.23)),
    ('Freehand', avg(79.81, 147.80)),
    ('Black Laminate', avg(61.19, 118.06)),
]
RIPTIDE_SHADOW = [
    ('Lore', avg(55.71, 131.10)),
    ('Gamma Doppler', avg(107.08, 140.34)),
    ('Bright Water', avg(42.27, 54.69)),
    ('Autotronic', avg(50.10, 92.23)),
    ('Freehand', avg(49.96, 65.02)),
    ('Black Laminate', avg(42.56, 73.65)),
]
RIPTIDE_HUNTSMAN = [
    ('Lore', 95.80),
]

# Kilowatt Kukri
KUKRI = [
    ('Vanilla', 101.98),
    ('Stained', avg(64.53, 118.02)),
    ('Boreal Forest', avg(45.21, 96.00)),
    ('Night Stripe', avg(51.66, 72.42)),
    ('Slaughter', avg(125.91, 144.84)),
    ('Scorched', avg(47.30, 131.25)),
    ('Forest DDPAT', avg(46.54, 146.14)),
    ('Crimson Web', avg(84.10, 532.08)),
    ('Fade', avg(176.92, 214.16)),
    ('Safari Mesh', avg(44.86, 112.33)),
    ('Blue Steel', avg(76.12, 133.68)),
    ('Case Hardened', avg(96.06, 205.07)),
    ('Urban Masked', avg(50.99, 146.17)),
]

# Fever chroma finishes
FEVER_SURVIVAL = [
    ('Vanilla', 55.43),
    ('Rust Coat', avg(45.52, 54.19)),
    ('Doppler', avg(194.06, 261.68)),
    ('Damascus Steel', avg(63.33, 77.96)),
    ('Marble Fade', avg(128.00, 276.24)),
    ('Ultraviolet', avg(63.33, 246.53)),
    ('Tiger Tooth', avg(112.33, 189.18)),
]
FEVER_NOMAD = [
    ('Vanilla', 137.16),
    ('Rust Coat', avg(102.28, 107.89)),
    ('Doppler', avg(372.16, 416.80)),
    ('Damascus Steel', avg(124.15, 147.73)),
    ('Marble Fade', avg(231.46, 276.24)),
    ('Ultraviolet', avg(106.78, 292.64)),
    ('Tiger Tooth', avg(189.11, 218.74)),
]
FEVER_PARACORD = [
    ('Vanilla', 58.23),
    ('Rust Coat', avg(47.15, 53.21)),
    ('Doppler', avg(206.92, 264.56)),
    ('Damascus Steel', avg(59.56, 96.07)),
    ('Marble Fade', avg(134.50, 198.05)),
    ('Ultraviolet', avg(68.05, 323.39)),
    ('Tiger Tooth', avg(115.28, 160.36)),
]
FEVER_SKELETON = [
    ('Vanilla', 246.38),
    ('Rust Coat', avg(132.87, 160.36)),
    ('Doppler', avg(595.63, 650.17)),
    ('Damascus Steel', avg(194.21, 221.55)),
    ('Marble Fade', avg(381.03, 450.79)),
    ('Ultraviolet', avg(171.45, 707.74)),
    ('Tiger Tooth', avg(322.20, 347.26)),
]

# ── case-to-rare-special mapping ───────────────────────────────────────────────
#   Each entry: (case_id, prefix, [(weapon, skin_price_list), ...])

def og_group(case_id, prefix):
    return (case_id, prefix, [
        ('M9 Bayonet',  CLASSIC_M9),
        ('Bayonet',     CLASSIC_BAYONET),
        ('Flip Knife',  CLASSIC_FLIP),
        ('Karambit',    CLASSIC_KARAMBIT),
        ('Gut Knife',   CLASSIC_GUT),
    ])

CASE_DEFS = [
    # OG cases
    og_group('csgo_weapon_case',         'csgo1_'),
    og_group('csgo_weapon_case_2',        'csgo2_'),
    og_group('csgo_weapon_case_3',        'csgo3_'),
    og_group('esports_2013_case',         'es13_'),
    og_group('esports_2013_winter_case',  'es13w_'),
    og_group('esports_2014_summer_case',  'es14s_'),
    og_group('winter_offensive_case',     'wo_'),
    og_group('operation_bravo_case',      'bravo_'),
    og_group('operation_phoenix_case',    'phoenix_'),
    og_group('operation_vanguard_case',   'vanguard_'),
    og_group('revolver_case',             'revolver_'),
    # Huntsman
    ('huntsman_weapon_case', 'hunt_', [
        ('Huntsman Knife', HUNTSMAN),
    ]),
    # Operation Breakout
    ('operation_breakout_case', 'breakout_', [
        ('Butterfly Knife', BUTTERFLY),
    ]),
    # Chroma cases
    ('chroma_case',  'chroma1_', [
        ('M9 Bayonet', CHROMA_M9), ('Bayonet', CHROMA_BAYONET),
        ('Flip Knife', CHROMA_FLIP), ('Karambit', CHROMA_KARAMBIT), ('Gut Knife', CHROMA_GUT),
    ]),
    ('chroma2_case', 'chroma2_', [
        ('M9 Bayonet', CHROMA_M9), ('Bayonet', CHROMA_BAYONET),
        ('Flip Knife', CHROMA_FLIP), ('Karambit', CHROMA_KARAMBIT), ('Gut Knife', CHROMA_GUT),
    ]),
    ('chroma3_case', 'chroma3_', [
        ('M9 Bayonet', CHROMA_M9), ('Bayonet', CHROMA_BAYONET),
        ('Flip Knife', CHROMA_FLIP), ('Karambit', CHROMA_KARAMBIT), ('Gut Knife', CHROMA_GUT),
    ]),
    # Falchion
    ('falchion_case', 'falchion_', [
        ('Falchion Knife', FALCHION),
    ]),
    # Shadow
    ('shadow_case', 'shadow_', [
        ('Shadow Daggers', SHADOW),
    ]),
    # Operation Wildfire
    ('operation_wildfire_case', 'wildfire_', [
        ('Bowie Knife', BOWIE),
    ]),
    # Gamma cases
    ('gamma_case',  'gamma1_', [
        ('M9 Bayonet', GAMMA_M9), ('Bayonet', GAMMA_BAYONET),
        ('Flip Knife', GAMMA_FLIP), ('Karambit', GAMMA_KARAMBIT), ('Gut Knife', GAMMA_GUT),
    ]),
    ('gamma2_case', 'gamma2_', [
        ('M9 Bayonet', GAMMA_M9), ('Bayonet', GAMMA_BAYONET),
        ('Flip Knife', GAMMA_FLIP), ('Karambit', GAMMA_KARAMBIT), ('Gut Knife', GAMMA_GUT),
    ]),
    # Glove Case
    ('glove_case', 'glove_', [
        ('Specialist Gloves', GLOVE_SPECIALIST),
        ('Moto Gloves',       GLOVE_MOTO_ORIGINAL),
        ('Bloodhound Gloves', GLOVE_BLOODHOUND),
        ('Hand Wraps',        GLOVE_HANDWRAPS_ORIGINAL),
        ('Sport Gloves',      GLOVE_SPORT_ORIGINAL),
        ('Driver Gloves',     GLOVE_DRIVER_ORIGINAL),
    ]),
    # Spectrum cases
    ('spectrum_case',  'spectrum1_', [
        ('Falchion Knife',  SPECTRUM_FALCHION),
        ('Shadow Daggers',  SPECTRUM_SHADOW),
        ('Huntsman Knife',  SPECTRUM_HUNTSMAN),
        ('Butterfly Knife', SPECTRUM_BUTTERFLY),
        ('Bowie Knife',     SPECTRUM_BOWIE),
    ]),
    ('spectrum2_case', 'spectrum2_', [
        ('Falchion Knife',  SPECTRUM_FALCHION),
        ('Shadow Daggers',  SPECTRUM_SHADOW),
        ('Huntsman Knife',  SPECTRUM_HUNTSMAN),
        ('Butterfly Knife', SPECTRUM_BUTTERFLY),
        ('Bowie Knife',     SPECTRUM_BOWIE),
    ]),
    # Clutch / Revolution
    ('clutch_case', 'clutch_', [
        ('Specialist Gloves', CLUTCH_SPECIALIST),
        ('Hydra Gloves',      CLUTCH_HYDRA),
        ('Moto Gloves',       CLUTCH_MOTO),
        ('Hand Wraps',        CLUTCH_HANDWRAPS),
        ('Sport Gloves',      CLUTCH_SPORT),
        ('Driver Gloves',     CLUTCH_DRIVER),
    ]),
    ('revolution_case', 'rev_', [
        ('Specialist Gloves', CLUTCH_SPECIALIST),
        ('Hydra Gloves',      CLUTCH_HYDRA),
        ('Moto Gloves',       CLUTCH_MOTO),
        ('Hand Wraps',        CLUTCH_HANDWRAPS),
        ('Sport Gloves',      CLUTCH_SPORT),
        ('Driver Gloves',     CLUTCH_DRIVER),
    ]),
    # Operation Hydra (same gloves as Glove Case)
    ('operation_hydra_case', 'hydra_', [
        ('Specialist Gloves', GLOVE_SPECIALIST),
        ('Moto Gloves',       GLOVE_MOTO_ORIGINAL),
        ('Bloodhound Gloves', GLOVE_BLOODHOUND),
        ('Hand Wraps',        GLOVE_HANDWRAPS_ORIGINAL),
        ('Sport Gloves',      GLOVE_SPORT_ORIGINAL),
        ('Driver Gloves',     GLOVE_DRIVER_ORIGINAL),
    ]),
    # Horizon / Danger Zone
    ('horizon_case',     'horizon_', [
        ('Navaja Knife',  NAVAJA), ('Ursus Knife',   URSUS),
        ('Stiletto Knife',STILETTO), ('Talon Knife',  TALON),
    ]),
    ('danger_zone_case', 'dz_', [
        ('Navaja Knife',  NAVAJA), ('Ursus Knife',   URSUS),
        ('Stiletto Knife',STILETTO), ('Talon Knife',  TALON),
    ]),
    # Prisma cases
    ('prisma_case',  'prisma1_', [
        ('Navaja Knife',  PRISMA_NAVAJA), ('Ursus Knife',  PRISMA_URSUS),
        ('Stiletto Knife',PRISMA_STILETTO), ('Talon Knife', PRISMA_TALON),
    ]),
    ('prisma2_case', 'prisma2_', [
        ('Navaja Knife',  PRISMA_NAVAJA), ('Ursus Knife',  PRISMA_URSUS),
        ('Stiletto Knife',PRISMA_STILETTO), ('Talon Knife', PRISMA_TALON),
    ]),
    # CS20
    ('cs20_case', 'cs20_', [
        ('Nomad Knife', NOMAD_CLASSIC),
    ]),
    # Shattered Web
    ('shattered_web_case', 'sweb_', [
        ('Survival Knife', SURVIVAL_CLASSIC),
        ('Nomad Knife',    NOMAD_SWEB),
    ]),
    # Operation Broken Fang / Snakebite / Recoil
    ('operation_broken_fang_case', 'bfang_', [
        ('Specialist Gloves',  BFANG_SPECIALIST),
        ('Moto Gloves',        BFANG_MOTO),
        ('Broken Fang Gloves', BFANG_GLOVES),
        ('Hand Wraps',         BFANG_HANDWRAPS),
        ('Sport Gloves',       BFANG_SPORT),
        ('Driver Gloves',      BFANG_DRIVER),
    ]),
    ('snakebite_case', 'snake_', [
        ('Specialist Gloves',  BFANG_SPECIALIST),
        ('Moto Gloves',        BFANG_MOTO),
        ('Broken Fang Gloves', BFANG_GLOVES),
        ('Hand Wraps',         BFANG_HANDWRAPS),
        ('Sport Gloves',       BFANG_SPORT),
        ('Driver Gloves',      BFANG_DRIVER),
    ]),
    ('recoil_case', 'rc_', [
        ('Specialist Gloves',  BFANG_SPECIALIST),
        ('Moto Gloves',        BFANG_MOTO),
        ('Broken Fang Gloves', BFANG_GLOVES),
        ('Hand Wraps',         BFANG_HANDWRAPS),
        ('Sport Gloves',       BFANG_SPORT),
        ('Driver Gloves',      BFANG_DRIVER),
    ]),
    # Operation Riptide / Dreams & Nightmares
    ('operation_riptide_case',  'riptide_', [
        ('Falchion Knife',  RIPTIDE_FALCHION),
        ('Shadow Daggers',  RIPTIDE_SHADOW),
        ('Huntsman Knife',  RIPTIDE_HUNTSMAN),
    ]),
    ('dreams_nightmares_case', 'dn_', [
        ('Falchion Knife',  RIPTIDE_FALCHION),
        ('Shadow Daggers',  RIPTIDE_SHADOW),
        ('Huntsman Knife',  RIPTIDE_HUNTSMAN),
    ]),
    # Kilowatt
    ('kilowatt_case', 'kw_', [
        ('Kukri Knife', KUKRI),
    ]),
    # Fever
    ('fever_case', 'fever_', [
        ('Survival Knife', FEVER_SURVIVAL),
        ('Nomad Knife',    FEVER_NOMAD),
        ('Paracord Knife', FEVER_PARACORD),
        ('Skeleton Knife', FEVER_SKELETON),
    ]),
    # fracture_case intentionally omitted (not in reference MD)
]

# ── main ───────────────────────────────────────────────────────────────────────

def main():
    print('Fetching image lookup from ByMykel…')
    imgs = fetch_image_lookup()

    print('Loading cases.json…')
    with open('public/data/cases.json') as f:
        data = json.load(f)

    # Build case id → index
    case_idx = {c['id']: i for i, c in enumerate(data['cases'])}

    total_items = 0
    missing_imgs = []

    for case_id, prefix, weapon_defs in CASE_DEFS:
        idx = case_idx.get(case_id)
        if idx is None:
            print(f'  WARNING: case not found in JSON: {case_id}')
            continue

        new_items = []
        for weapon, skin_prices in weapon_defs:
            for skin_name, price in skin_prices:
                item = make_item(weapon, skin_name, prefix, price, imgs)
                if item['image_url'] is None:
                    missing_imgs.append(f'{weapon} | {skin_name}')
                new_items.append(item)

        data['cases'][idx]['items']['rare_special'] = new_items
        total_items += len(new_items)
        print(f'  {case_id}: {len(new_items)} items')

    print(f'\nWriting {total_items} total rare_special items…')
    with open('public/data/cases.json', 'w') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    if missing_imgs:
        print(f'\nMissing image URLs ({len(missing_imgs)}):')
        for m in sorted(set(missing_imgs)):
            print(f'  {m}')
    else:
        print('All images found.')

    print('Done.')

if __name__ == '__main__':
    main()
