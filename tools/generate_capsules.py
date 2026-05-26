#!/usr/bin/env python3
"""Generate capsules.json from reference data.
Rarity weights: high_grade(blue)=60, remarkable(purple)=25, exotic(pink)=13, extraordinary(red)=2
"""
import json, re

# Maps our reference names → Steam/ByMykel market hash names
STEAM_NAME_MAP = {
    'Team Vitality': 'Vitality',
    'Team Falcons': 'Falcons',
    'Aurora Gaming': 'Aurora',
    'FURIA Esports': 'FURIA',
    'B8 Esports': 'B8',
    'Nemiga Gaming': 'Nemiga',
    'BetBoom Team': 'BetBoom',
    'NRG Esports': 'NRG',
    'Lynn Vision Gaming': 'Lynn Vision',
    'The MongolZ': 'The Mongolz',
    'Virtus.pro': 'Virtus.Pro',
}

# ── helpers ──────────────────────────────────────────────────────────────────

def s(name, t=None):
    base = re.sub(r' \([^)]+\)$', '', name)
    quality = name[len(base):]
    steam = STEAM_NAME_MAP.get(base, base)
    mhn = f"Sticker | {steam}{quality}" + (f" | {t}" if t else "")
    return {"name": steam + quality, "market_hash_name": mhn}

def sq(base, q, t=None):
    name = f"{base} ({q})" if q else base
    return s(name, t)

ALL_W = {"high_grade": 60, "remarkable": 25, "exotic": 13, "extraordinary": 2}

def tcap(cid, cname, price, tournament, items, foil="Foil", holo="Holo"):
    """Tournament capsule: plain list → 4 quality tiers."""
    return {
        "id": cid, "name": cname, "price": price,
        "rarity_weights": ALL_W,
        "tiers": {
            "high_grade":    [s(i, tournament) for i in items],
            "remarkable":    [sq(i, holo, tournament) for i in items],
            "exotic":        [sq(i, foil, tournament) for i in items],
            "extraordinary": [sq(i, "Gold", tournament) for i in items],
        }
    }

def ccap(cid, cname, price, items):
    """Community capsule: stickers carry their own quality suffix."""
    tiers = {"high_grade": [], "remarkable": [], "exotic": [], "extraordinary": []}
    for x in items:
        t = "extraordinary" if "(Gold)" in x else "exotic" if "(Foil)" in x else "remarkable" if "(Holo)" in x else "high_grade"
        tiers[t].append(s(x))
    empty_w = sum(v for k, v in ALL_W.items() if not tiers[k])
    w = {k: v for k, v in ALL_W.items() if tiers[k]}
    if "high_grade" in w: w["high_grade"] += empty_w
    elif w: w[next(iter(w))] += empty_w
    return {
        "id": cid, "name": cname, "price": price,
        "rarity_weights": w,
        "tiers": {k: v for k, v in tiers.items() if v}
    }

# ── community capsules ────────────────────────────────────────────────────────

community = [
    ccap("sticker_capsule", "Sticker Capsule", 0.72, [
        "Chicken Strike","Chabo","Lucky 13","Death Garlands","Rising Skull",
        "Vigilance","To B or not to B","Glock Up","I Buy Power","King on the Field",
    ]),
    ccap("sticker_capsule_2", "Sticker Capsule 2", 15.50, [
        "Banana","Bomb Code","Good Game","Good Luck","Have Fun","Nice Shot",
        "Rasta","Shave Master","Skull Lil Boney","Welcome to the Clutch",
        "Bosh (Holo)","Crown (Foil)",
    ]),
    ccap("community_sticker_capsule_1", "Community Sticker Capsule 1", 2.60, [
        "Backstab","Blitzkrieg","Bomb Doge","Burning DJ","Chief","Easy Peasy","Luck Skill","Ninja",
        "Flammable (Foil)","Headhunter (Foil)","Phoenix (Foil)","Swag (Foil)",
    ]),
    ccap("enfu_sticker_capsule", "Enfu Sticker Capsule", 0.77, [
        "Unicorn","Hamster Hawk","Dynamic Diamond","Kimberly","Pineapple Express",
        "Pinup Marine","Pizza T","Baited","Chew Me NW",
        "Unicorn (Holo)","Teamwork (Holo)",
    ]),
    ccap("pinups_capsule", "Pinups Capsule", 0.73, [
        "Martha","Erika","Tamara","Ivette","Sally","Cotton Candy",
        "Martha (Holo)","Erika (Holo)","Tamara (Holo)","Ivette (Holo)","Sally (Holo)",
    ]),
    ccap("slid3_capsule", "Slid3 Capsule", 1.00, [
        "Phoenix","CT-Tech","Skulltorgeist","Till Death Do Us Part","Defuse It",
        "One Shot One Kill (Holo)","Phoenix (Holo)","CT-Tech (Holo)","Skulltorgeist (Holo)",
        "One Shot One Kill",
    ]),
    ccap("team_roles_capsule", "Team Roles Capsule", 0.74, [
        "Awper","Entry Killer","Lurker","Support","IGL",
        "Awper (Foil)","Entry Killer (Foil)","Lurker (Foil)","Support (Foil)","IGL (Foil)",
    ]),
    ccap("sugarface_capsule", "Sugarface Capsule", 0.74, [
        "Drug War Veteran","Bubble Gum","Ice Cream","Lollypop","Cotton Candy",
        "Candy","Candy (Holo)","Bubble Gum (Holo)","Ice Cream (Holo)","Lollypop (Holo)",
    ]),
    ccap("bestiary_capsule", "Bestiary Capsule", 0.84, [
        "Manticore","Pegasus","Cerberus","Griffin","Basilisk","Phoenix Blue",
        "Manticore (Holo)","Pegasus (Holo)","Cerberus (Holo)","Griffin (Holo)","Basilisk (Holo)",
    ]),
    ccap("perfect_world_capsule_1", "CS:GO Perfect World Sticker Capsule 1", 0.65, [
        "Pixels T","Pixels CT","Longevity","Good Fortune","Treat T",
        "Guardian Dragon","Cheongsam","Guardian Dragon (Foil)","Longevity (Foil)",
        "Cheongsam (Holo)",
    ]),
    ccap("perfect_world_capsule_2", "CS:GO Perfect World Sticker Capsule 2", 0.68, [
        "Rice Worker","Noodles","Hot Pot","Mahjong","Fire Dragon","Water Dragon",
        "Baby Lore","Baby Medusa","Baby Lore (Foil)","Baby Medusa (Holo)",
    ]),
    ccap("community_capsule_2018", "Community Capsule 2018", 0.95, [
        "Dragon Lore","Medusa","Howl","Kingfish","Pegasus Blue","Fire Serpent",
        "Bloodhound","Global Elite","Silver",
        "Dragon Lore (Foil)",
    ]),
    ccap("skill_groups_capsule", "Skill Groups Capsule", 0.76, [
        "Silver I","Silver Elite Master","Gold Nova I","Gold Nova Master",
        "Master Guardian I","Master Guardian Elite","Distinguished Master Guardian",
        "Legendary Eagle","Legendary Eagle Master","Supreme Master First Class",
        "Global Elite (Holo)",
    ]),
    ccap("feral_predators_capsule", "Feral Predators Capsule", 1.05, [
        "Roar","Alpha Predator","Apex Predator","Bite","Claws",
        "Roar (Holo)","Alpha Predator (Holo)","Apex Predator (Holo)","Bite (Holo)","Claws (Holo)",
    ]),
    ccap("chicken_capsule", "Chicken Capsule", 1.61, [
        "Swag Chicken","Ninja Chicken","Defuse Chicken","Whack-A-Chicken",
        "Chicken Dinner","Golden Chicken",
        "Chicken Lover","Chicken Strike",
        "Chicken Lover (Holo)","Chicken Strike (Holo)",
    ]),
    ccap("cs20_sticker_capsule", "CS20 Sticker Capsule", 1.20, [
        "CS20","Global Offensive","Door Stuck","Dragon Lore",
        "Classic Knife (Holo)","CS20 (Holo)","Global Offensive (Holo)","Door Stuck (Holo)",
        "Classic Knife","Howl (Gold)",
    ]),
    ccap("halo_capsule", "Halo Capsule", 0.77, [
        "Chief","Noble","Mister Chief","Cortana","Incineration","Killjoy",
        "Chief (Holo)","Noble (Holo)","Legendary (Foil)",
        "Legendary",
    ]),
    ccap("half_life_alyx_sticker_capsule", "Half-Life: Alyx Sticker Capsule", 0.75, [
        "Alyx","Combine Helmet","Lambda","Black Mesa","Vortigaunt","Headcrab",
        "Alyx (Holo)","Combine Helmet (Holo)","Lambda (Holo)","Black Mesa (Holo)",
    ]),
    ccap("warhammer_sticker_capsule", "Warhammer 40,000 Sticker Capsule", 0.84, [
        "Space Marine","Chaos Space Marine","Orks","Tyranids","Necrons","Blood Angels",
        "Space Marine (Holo)","Chaos Space Marine (Holo)",
        "Imperium","Imperium (Foil)",
    ]),
    ccap("poorly_drawn_capsule", "Poorly Drawn Capsule", 0.73, [
        "Poorly Drawn CT","Poorly Drawn T","Poorly Drawn Chicken","Poorly Drawn AWP",
        "Poorly Drawn Ak-47","Poorly Drawn Global Elite","Poorly Drawn Defuse","Poorly Drawn Bomb",
        "Poorly Drawn CT (Holo)","Poorly Drawn T (Holo)",
    ]),
    ccap("community_2021_capsule", "2021 Community Sticker Capsule", 1.38, [
        "Dr. Droll","Cyberpunk","Ez Pz","Great Wave","Recoil","Karambit",
        "Dr. Droll (Holo)","Cyberpunk (Holo)","Great Wave (Holo)","Recoil (Holo)",
    ]),
    ccap("battlefield_2042_capsule", "Battlefield 2042 Sticker Capsule", 0.76, [
        "Battlefield 2042","No-Pat","Wingsuit","T-Rex","Pac","Irish","Boris","Casper",
        "Battlefield 2042 (Holo)","No-Pat (Holo)",
    ]),
    ccap("boardroom_capsule", "The Boardroom Sticker Capsule", 0.79, [
        "Stonks","Bull Market","Bear Market","To The Moon",
        "Diamond Hands","Diamond Hands (Holo)","Stonks (Holo)","To The Moon (Holo)",
        "HODL","HODL (Gold)",
    ]),
    ccap("birthday_10yr_capsule", "10 Year Birthday Sticker Capsule", 0.66, [
        "Zeused","Agent Ava","Conspiracies","Green Bandana","Rush B",
        "Chicken Birthday","Global Elite 10th",
        "10 Year Birthday","10 Year Birthday (Holo)","Zeused (Holo)",
    ]),
    ccap("espionage_capsule", "Espionage Sticker Capsule", 0.68, [
        "Spy Tech","Code Cracker","Classified","Top Secret","Redacted",
        "Agent K","Agent K (Holo)","Blue Gem","Blue Gem (Holo)","Spy Tech (Holo)",
    ]),
    ccap("ambush_capsule", "Ambush Sticker Capsule", 0.68, [
        "Smoke Grenade","Flashbang","Molotov","HE Grenade","Eco Round","Full Buy",
        "Ambush","Ambush (Holo)","Bait","Bait (Holo)",
    ]),
]

# ── Austin 2025 ───────────────────────────────────────────────────────────────
T = "Austin 2025"
F = "Foil"

austin = [
    tcap("austin_2025_legends_sticker", "Austin 2025 Legends Sticker Capsule", 0.27, T, [
        "Team Vitality","MOUZ","Team Spirit","Aurora Gaming",
        "Natus Vincere","G2 Esports","Team Liquid","The MongolZ",
    ], F),
    tcap("austin_2025_challengers_sticker", "Austin 2025 Challengers Sticker Capsule", 0.32, T, [
        "Team Falcons","FaZe Clan","3DMAX","Virtus.pro",
        "paiN Gaming","FURIA Esports","MIBR","M80",
    ], F),
    tcap("austin_2025_contenders_sticker", "Austin 2025 Contenders Sticker Capsule", 0.34, T, [
        "Complexity Gaming","Wildcard","HEROIC","B8 Esports","OG","Nemiga Gaming",
        "BetBoom Team","Imperial Esports","NRG Esports","FlyQuest",
        "Metizport","TYLOO","Fluxo","Chinggis Warriors","Lynn Vision Gaming","Legacy",
    ], F),
    tcap("austin_2025_legends_autograph", "Austin 2025 Legends Autograph Capsule", 0.24, T, [
        "apEX","ZywOo","Spinx","flameZ","mezii",
        "siuhy","xertioN","torzsi","Jimpphat","Brollan",
        "chopper","shalfey","magixx","donk","zont1x",
        "Lack1","KENSI","Norwi","deko","r3salt",
        "Aleksib","iM","b1t","JL","w0nderful",
        "Snax","huNter-","malbsMd","HeavyGod","hades",
        "jks","NAF","YEKINDAR","ultimate","Twistzz",
        "bLitz","Techno4K","9oDBless","Mazaalee","mzinho",
    ], F),
    tcap("austin_2025_challengers_autograph", "Austin 2025 Challengers Autograph Capsule", 0.23, T, [
        "kyxsan","Magisk","NiKo","m0NESY","TeSeS",
        "karrigan","el1an","broky","ropz",
        "Maka","Lucky","Djoko","Ex3rcice","Graviti",
        "Jame","FL1T","fame","n0rb3r7","electroNic",
        "biguzera","kauez","lux","snow","nqz",
        "FalleN","chelo","KSCERATO","yuurih","skullz",
        "exit","brnz4n","insani","drop","sazde",
        "slaxz-","s1n","Swisher","Lake","reck",
    ], F),
    tcap("austin_2025_contenders_autograph", "Austin 2025 Contenders Autograph Capsule", 0.22, T, [
        "JT","floppy","hallzerk","Grim","EliGE",
        "stanislaw","phzy","Sonic","JBa","susp",
        "KySelected","sjuush","NertZ","degster",
        "npl","esphir","headtr1ck","alex666","cptkurtka05",
        "Chr1sN","MoDo","Buzz","Nexius","Fiku",
        "1eeR","BELCHONOKK","khaN","risk","Zweih",
        "Nafany","KaiR0N-","Magnojez","zorte","s1ren",
        "VINI","decenty","noway","try","chayJESUS",
        "nitr0","oSee","Brehze","HexT","jeorge",
        "dexter","Vexite","aliStair","INS","Liazz",
        "Jackinho","nilo","adamb","suspense","zack",
        "JamYoung","Advent","kaze","Mercury","zr",
        "arT","kye","mlhzin","piriajr","zevy",
        "NEUZ","hasteka","dobu","cool4st","Bart4k",
        "Westmelon","z4kr","Starry","Flying","Jee",
        "dumau","latto","n1ssim","saadzin",
    ], F),
    tcap("austin_2025_champions_autograph", "Austin 2025 Champions Autograph Capsule", 0.25, T, [
        "apEX","ZywOo","Spinx","flameZ","mezii",
    ], F),
]

# ── Budapest 2025 ─────────────────────────────────────────────────────────────
T = "Budapest 2025"
F = "Holo"
HOLO = "Embroidered"

budapest = [
    tcap("budapest_2025_legends_sticker", "Budapest 2025 Legends Sticker Capsule", 0.19, T, [
        "Team Vitality","FURIA Esports","Team Falcons","Team Spirit",
        "Natus Vincere","Aurora Gaming","Team Liquid","G2 Esports",
    ], F, HOLO),
    tcap("budapest_2025_challengers_sticker", "Budapest 2025 Challengers Sticker Capsule", 0.32, T, [
        "Legacy","FaZe Clan","MOUZ","Astralis",
        "Ninjas in Pyjamas","PARIVISION","GamerLegion","B8 Esports",
    ], F, HOLO),
    tcap("budapest_2025_contenders_sticker", "Budapest 2025 Contenders Sticker Capsule", 0.31, T, [
        "fnatic","Imperial Esports","The MongolZ","Rare Atom","The Huns",
    ], F, HOLO),
    tcap("budapest_2025_legends_autograph", "Budapest 2025 Legends Autograph Capsule", 0.20, T, [
        "apEX","ZywOo","Spinx","flameZ","mezii",
        "FalleN","chelo","KSCERATO","yuurih","skullz",
        "kyxsan","Magisk","NiKo","m0NESY","TeSeS",
        "chopper","shalfey","magixx","donk","zont1x",
        "Aleksib","iM","b1t","jL","w0nderful",
        "Lack1","KENSI","Norwi","deko","r3salt",
        "jks","NAF","YEKINDAR","ultimate","Twistzz",
        "Snax","huNter-","matys","SunPayus","malbsMd",
    ], F, HOLO),
    tcap("budapest_2025_challengers_autograph", "Budapest 2025 Challengers Autograph Capsule", 0.32, T, [
        "dumau","latto","lux","n1ssim","saadzin",
        "karrigan","broky","ropz","frozen","el1an",
        "siuhy","xertioN","torzsi","Jimpphat","Brollan",
        "dev1ce","Staehr","br0","jabbi","stavn",
        "Maxster","r1nkle","alex","Isak","MisteM",
        "Jerry","Alpha","ArtFr0st","Patsi","Qikert",
        "volt","sl3nd","FL4MUS","aNdu",
        "npl","esphir","headtr1ck","alex666","cptkurtka05",
    ], F, HOLO),
    tcap("budapest_2025_contenders_autograph", "Budapest 2025 Contenders Autograph Capsule", 0.31, T, [
        "KRIMZ","bodyy","blameF","nawwk",
        "VINI","decenty","noway","try","chayJESUS",
        "bLitz","Techno4K","9oDBless","Mazaalee","mzinho",
        "Somebody","Summer","ChildKing","L1haNg",
        "Bart4k","cool4st","machinegun","sk0R","hasteka",
    ], F, HOLO),
    tcap("budapest_2025_champions_autograph", "Budapest 2025 Champions Autograph Capsule", 0.23, T, [
        "apEX","ZywOo","Spinx","flameZ","mezii",
    ], F),
]

# ── Shanghai 2024 ─────────────────────────────────────────────────────────────
T = "Shanghai 2024"
F = "Glitter"

shanghai = [
    tcap("shanghai_2024_legends_sticker", "Shanghai 2024 Legends Sticker Capsule", 0.65, T, [
        "G2 Esports","Natus Vincere","Team Vitality","Team Spirit",
        "MOUZ","FaZe Clan","HEROIC","3DMAX",
    ], F),
    tcap("shanghai_2024_challengers_sticker", "Shanghai 2024 Challengers Sticker Capsule", 0.52, T, [
        "fnatic","Virtus.pro","Team Liquid","Complexity Gaming",
        "BIG","FURIA Esports","The MongolZ","paiN Gaming",
    ], F),
    tcap("shanghai_2024_contenders_sticker", "Shanghai 2024 Contenders Sticker Capsule", 0.77, T, [
        "GamerLegion","MIBR","Cloud9","FlyQuest",
        "Passion UA","Wildcard","Rare Atom","Imperial Esports",
    ], F),
    tcap("shanghai_2024_legends_autograph", "Shanghai 2024 Legends Autograph Capsule", 0.21, T, [
        "Snax","huNter-","malbsMd","m0NESY","NiKo",
        "Aleksib","iM","b1t","jL","w0nderful",
        "apEX","ZywOo","Spinx","flameZ","mezii",
        "chopper","sh1ro","magixx","donk","zont1x",
        "siuhy","xertioN","torzsi","Jimpphat","Brollan",
        "karrigan","rain","broky","ropz","frozen",
        "KySelected","sjuush","TeSeS","NertZ","degster",
        "Maka","Lucky","Djoko","Ex3rcice","Graviti",
    ], F),
    tcap("shanghai_2024_challengers_autograph", "Shanghai 2024 Challengers Autograph Capsule", 0.27, T, [
        "KRIMZ","bodyy","MATYS","blameF","afro",
        "Jame","FL1T","fame","n0rb3r7","electroNic",
        "jks","NAF","YEKINDAR","ultimate","Twistzz",
        "JT","floppy","hallzerk","Grim","EliGE",
        "tabseN","Krimbo","JDC","syrsoN","rigoN",
        "FalleN","chelo","yuurih","KSCERATO","skullz",
        "bLitz","Techno4K","Senzu","mzinho","910",
        "biguzera","lux","kauez","nqz","snow",
    ], F),
    tcap("shanghai_2024_contenders_autograph", "Shanghai 2024 Contenders Autograph Capsule", 0.28, T, [
        "ztr","aNdu","volt","sl3nd","FL4MUS",
        "exit","Lucaozy","saffee","drop","insani",
        "Boombl4","Perfecto","Ax1Le","HeavyGod","ICY",
        "aliStair","dexter","Liazz","Vexite","INS",
        "fear","jambo","s-chilla","jackasmo","zeRRoFIX",
        "stanislaw","Sonic","phzy","susp","jBa",
        "Summer","somebody","ChildKing","L1haNg",
        "felps","VINI","try","decenty","noway",
    ], F),
    tcap("shanghai_2024_champions_autograph", "Shanghai 2024 Champions Autograph Capsule", 0.31, T, [
        "chopper","sh1ro","magixx","zont1x","donk",
    ], F),
]

# ── Copenhagen 2024 ───────────────────────────────────────────────────────────
T = "Copenhagen 2024"
F = "Glitter"

copenhagen = [
    tcap("copenhagen_2024_legends_sticker", "Copenhagen 2024 Legends Sticker Capsule", 0.55, T, [
        "FaZe Clan","Team Spirit","Team Vitality","MOUZ",
        "Virtus.pro","Natus Vincere","G2 Esports","Complexity Gaming",
    ], F),
    tcap("copenhagen_2024_challengers_sticker", "Copenhagen 2024 Challengers Sticker Capsule", 0.62, T, [
        "Cloud9","Eternal Fire","ENCE","Apeks",
        "HEROIC","GamerLegion","SAW","FURIA Esports",
    ], F),
    tcap("copenhagen_2024_contenders_sticker", "Copenhagen 2024 Contenders Sticker Capsule", 0.44, T, [
        "paiN Gaming","Imperial Esports","The MongolZ","AMKAL ESPORTS",
        "ECSTATIC","KOI","Legacy","Lynn Vision Gaming",
    ], F),
    tcap("copenhagen_2024_legends_autograph", "Copenhagen 2024 Legends Autograph Capsule", 0.31, T, [
        "karrigan","rain","frozen","ropz","broky",
        "chopper","sh1ro","magixx","zont1x","donk",
        "apEX","ZywOo","flameZ","Spinx","mezii",
        "Brollan","siuhy","torzsi","Jimpphat","xertioN",
        "mir","FL1T","Jame","n0rb3r7","fame",
        "Aleksib","iM","b1t","jL","w0nderful",
        "NiKo","huNter-","nexa","HooXi","m0NESY",
        "EliGE","JT","floppy","hallzerk","Grim",
    ], F),
    tcap("copenhagen_2024_challengers_autograph", "Copenhagen 2024 Challengers Autograph Capsule", 0.26, T, [
        "HObbit","electroNic","Boombl4","Ax1Le","Perfecto",
        "MAJ3R","XANTARES","woxic","Calyx","Wicadia",
        "gla1ve","Goofy","dycha","hades","Kylar",
        "STYKO","jkaem","nawwk","sense","CacaNito",
        "NertZ","TeSeS","nicoodoz","sjuush","kyxsan",
        "acoR","Keoz","isak","volt",
        "MUTiRiS","roman","story","ewjerkz","arrozdoce",
        "FalleN","chelo","arT","yuurih","KSCERATO",
    ], F),
    tcap("copenhagen_2024_contenders_autograph", "Copenhagen 2024 Contenders Autograph Capsule", 0.18, T, [
        "biguzera","n1ssim","nqz","kauez","lux",
        "HEN1","felps","VINI","decenty","noway",
        "bLitz","Techno4K","910","mzinho","Senzu",
        "NickelBack","Krad","Forester","TRAVIS","ICY",
        "Nodios","Patti","Queenix","kraghen","salazar",
        "JUST","mopoz","stadodo","dav1g","adamS",
        "coldzera","NEKIZ","dumau","b4rtiN","latto",
        "Westmelon","z4kr","Starry","Flying","Jee",
    ], F),
    tcap("copenhagen_2024_champions_autograph", "Copenhagen 2024 Champions Autograph Capsule", 0.27, T, [
        "Aleksib","iM","b1t","jL","w0nderful",
    ], F),
]

# ── Paris 2023 ────────────────────────────────────────────────────────────────
T = "Paris 2023"
F = "Glitter"

paris = [
    tcap("paris_2023_legends_sticker", "Paris 2023 Legends Sticker Capsule", 0.11, T, [
        "Fnatic","Natus Vincere","FURIA Esports","Team Vitality",
        "Heroic","Bad News Eagles","Into The Breach","9INE",
    ], F),
    tcap("paris_2023_challengers_sticker", "Paris 2023 Challengers Sticker Capsule", 0.09, T, [
        "Ninjas in Pyjamas","G2 Esports","forZe eSports","OG",
        "paiN Gaming","GamerLegion","Apeks","Monte",
    ], F),
    tcap("paris_2023_contenders_sticker", "Paris 2023 Contenders Sticker Capsule", 0.09, T, [
        "Team Liquid","FaZe Clan","ENCE","Grayhound Gaming",
        "MOUZ","Complexity Gaming","Fluxo","The MongolZ",
    ], F),
    tcap("paris_2023_legends_autograph", "Paris 2023 Legends Autograph Capsule", 0.17, T, [
        "KRIMZ","mezii","nicoodoz","roeJ","FASHR",
        "s1mple","electroNic","Perfecto","b1t","npl",
        "arT","drop","yuurih","KSCERATO","saffee",
        "apEX","ZywOo","dupreeh","Magisk","Spinx",
        "stavn","cadiaN","TeSeS","sjuush","jabbi",
        "SENER1","gxx-","juanflatroo","sinnopsyy","rigoN",
        "rallen","CRUC1AL","Thomas","volt","cypher",
        "Goofy","KEi","Kylar","mynio","hades",
    ], F),
    tcap("paris_2023_challengers_autograph", "Paris 2023 Challengers Autograph Capsule", 0.22, T, [
        "REZ","Brollan","Aleksib","headtr1ck","k0nfig",
        "huNter-","NiKo","m0NESY","jks","HooXi",
        "Jerry","zorte","shalfey","Krad","r3salt",
        "flameZ","NEOFRAG","Fiku","degster","nexa",
        "biguzera","hardzao","NEKIZ","zevy","skullz",
        "iM","isak","acoR","siuhy","Keoz",
        "nawwk","jkaem","STYKO","kyxsan","jL",
        "sdy","BOROS","Woro2k","DemQQ","Krasnal",
    ], F),
    tcap("paris_2023_contenders_autograph", "Paris 2023 Contenders Autograph Capsule", 0.13, T, [
        "EliGE","NAF","oSee","nitr0","YEKINDAR",
        "karrigan","rain","Twistzz","ropz","broky",
        "Snappi","dycha","maden","SunPayus","NertZ",
        "Sico","INS","aliStair","Liazz","Vexite",
        "dexter","frozen","torzsi","JDC","xertioN",
        "JT","floppy","hallzerk","Grim","FaNg",
        "felps","WOOD7","history","nqz",
        "Techno4K","Bart4k","hasteka","ANNiMATION",
    ], F),
    tcap("paris_2023_champions_autograph", "Paris 2023 Champions Autograph Capsule", 0.23, T, [
        "apEX","ZywOo","dupreeh","Magisk","Spinx",
    ], F),
]

# ── Rio 2022 ──────────────────────────────────────────────────────────────────
T = "Rio 2022"
F = "Glitter"

rio = [
    tcap("rio_2022_legends_sticker", "Rio 2022 Legends Sticker Capsule", 0.46, T, [
        "FaZe Clan","Natus Vincere","Ninjas in Pyjamas","ENCE",
        "Sprout","HEROIC","Team Spirit","Team Liquid",
    ], F),
    tcap("rio_2022_challengers_sticker", "Rio 2022 Challengers Sticker Capsule", 0.28, T, [
        "OG","Team Vitality","Evil Geniuses","Cloud9",
        "BIG","Bad News Eagles","MOUZ","9z Team",
    ], F),
    tcap("rio_2022_contenders_sticker", "Rio 2022 Contenders Sticker Capsule", 0.25, T, [
        "GamerLegion","Outsiders","00 NATION","FURIA Esports",
        "Fnatic","Imperial Esports","IHC Esports","Grayhound Gaming",
    ], F),
    tcap("rio_2022_legends_autograph", "Rio 2022 Legends Autograph Capsule", 0.26, T, [
        "karrigan","rain","Twistzz","ropz","broky",
        "s1mple","electroNic","Perfecto","b1t","sdy",
        "REZ","hampus","Brollan","Aleksib","es3tag",
        "Snappi","dycha","maden","SunPayus","valde",
        "Denis","raalz","Staehr","lauNX","Zyphon",
        "stavn","cadiaN","TeSeS","sjuush","jabbi",
        "chopper","magixx","s1ren","Patsi","w0nderful",
        "EliGE","NAF","oSee","nitr0","YEKINDAR",
    ], F),
    tcap("rio_2022_challengers_autograph", "Rio 2022 Challengers Autograph Capsule", 0.26, T, [
        "flameZ","nexa","NEOFRAG","Fiku","degster",
        "apEX","ZywOo","dupreeh","Magisk","Spinx",
        "Brehze","CeRq","Stewie2K","autimatic","RUSH",
        "nafany","sh1ro","interz","Ax1Le","HObbit",
        "tabseN","syrsoN","faveN","Krimbo","s1n",
        "SENER1","gxx-","juanflatroo","sinnopsyy","rigoN",
        "dexter","frozen","torzsi","JDC","xertioN",
        "dgt","max","rox","nqz","buda",
    ], F),
    tcap("rio_2022_contenders_autograph", "Rio 2022 Contenders Autograph Capsule", 0.31, T, [
        "iM","isak","acoR","siuhy","Keoz",
        "Jame","FL1T","qikert","n0rb3r7","fame",
        "coldzera","TACO","laski","dumau","try",
        "arT","yuurih","KSCERATO","drop","saffee",
        "KRIMZ","mezii","nicoodoz","roeJ","FASHR",
        "FalleN","fer","fnx","boltz","VINI",
        "bLitz","Techno4K","kabal","nin9","sk0R",
        "Sico","INS","aliStair","Liazz","Vexite",
    ], F),
    tcap("rio_2022_champions_autograph", "Rio 2022 Champions Autograph Capsule", 0.39, T, [
        "Jame","FL1T","qikert","n0rb3r7","fame",
    ], F),
]

# ── Antwerp 2022 ──────────────────────────────────────────────────────────────
T = "Antwerp 2022"
F = "Glitter"

antwerp = [
    tcap("antwerp_2022_legends_sticker", "Antwerp 2022 Legends Sticker Capsule", 0.52, T, [
        "HEROIC","Copenhagen Flames","BIG","Natus Vincere",
        "FaZe Clan","Ninjas in Pyjamas","Cloud9","FURIA Esports",
    ], F),
    tcap("antwerp_2022_challengers_sticker", "Antwerp 2022 Challengers Sticker Capsule", 0.33, T, [
        "ENCE","G2 Esports","forZe","Astralis",
        "Team Vitality","MIBR","Imperial Esports","Bad News Eagles",
    ], F),
    tcap("antwerp_2022_contenders_sticker", "Antwerp 2022 Contenders Sticker Capsule", 0.53, T, [
        "Eternal Fire","Team Spirit","Outsiders","Complexity Gaming",
        "IHC Esports","Renegades","Team Liquid","9z Team",
    ], F),
    tcap("antwerp_2022_legends_autograph", "Antwerp 2022 Legends Autograph Capsule", 0.25, T, [
        "cadiaN","refrezh","sjuush","TeSeS","stavn",
        "HooXi","nicoodoz","roeJ","jabbi","Zyphon",
        "tabseN","tiziaN","syrsoN","faveN","Krimbo",
        "s1mple","electroNic","Boombl4","Perfecto","b1t",
        "karrigan","rain","Twistzz","ropz","broky",
        "REZ","Plopski","hampus","es3tag","Brollan",
        "nafany","sh1ro","interz","Ax1Le","HObbit",
        "arT","yuurih","KSCERATO","drop","saffee",
    ], F),
    tcap("antwerp_2022_challengers_autograph", "Antwerp 2022 Challengers Autograph Capsule", 0.27, T, [
        "Snappi","dycha","hades","Spinx","maden",
        "JACKZ","NiKo","huNter-","Aleksib","m0NESY",
        "Jerry","zorte","shalfey","KENSI","Norwi",
        "Xyp9x","gla1ve","blameF","k0nfig","Farlig",
        "apEX","dupreeh","Magisk","ZywOo","misutaaa",
        "chelo","exit","WOOD7","Tuurtle","JOTA",
        "FalleN","fer","fnx","boltz","VINI",
        "SENER1","gxx-","juanflatroo","sinnopsyy","rigoN",
    ], F),
    tcap("antwerp_2022_contenders_autograph", "Antwerp 2022 Contenders Autograph Capsule", 0.61, T, [
        "XANTARES","woxic","imoRR","xfl0ud","calyx",
        "chopper","degster","magixx","s1ren","Patsi",
        "buster","qikert","Jame","FL1T","YEKINDAR",
        "JT","FaNg","floppy","Grim","junior",
        "bLitz","Techno4K","kabal","nin9","sk0R",
        "Sico","Liazz","aliStair","INS","Hatz",
        "shox","nitr0","NAF","EliGE","oSee",
        "max","dgt","Luken","rox","dav1deuS",
    ], F),
    tcap("antwerp_2022_champions_autograph", "Antwerp 2022 Champions Autograph Capsule", 0.32, T, [
        "karrigan","rain","Twistzz","ropz","broky",
    ], F),
]

# ── Stockholm 2021 ────────────────────────────────────────────────────────────
T = "Stockholm 2021"
F = "Foil"

stockholm = [
    tcap("stockholm_2021_legends_sticker", "Stockholm 2021 Legends Sticker Capsule", 1.62, T, [
        "Evil Geniuses","FURIA Esports","G2 Esports","Natus Vincere",
        "Ninjas in Pyjamas","Team Liquid","Team Vitality","Virtus.pro",
    ], F),
    tcap("stockholm_2021_challengers_sticker", "Stockholm 2021 Challengers Sticker Capsule", 3.48, T, [
        "Astralis","BIG","ENCE","FaZe Clan",
        "Heroic","MOUZ","Movistar Riders","Team Spirit",
    ], F),
    tcap("stockholm_2021_contenders_sticker", "Stockholm 2021 Contenders Sticker Capsule", 2.60, T, [
        "Copenhagen Flames","Entropiq","GODSENT","paiN Gaming",
        "Renegades","Sharks Esports","TYLOO","Virtus.pro",
    ], F),
    tcap("stockholm_2021_finalists_autograph", "Stockholm 2021 Finalists Autograph Capsule", 0.61, T, [
        "NiKo","huNter-","nexa","JACKZ","AMANEK",
        "ZywOo","shox","apEX","misutaaa","Kyojin",
        "device","REZ","hampus","Plopski","LNZ",
        "cadiaN","stavn","TeSeS","sjuush","refrezh",
        "sh1ro","Ax1Le","HObbit","nafany","interz",
        "arT","yuurih","KSCERATO","VINI","drop",
        "Jame","qikert","buster","FL1T","Sanji",
    ], F),
    tcap("stockholm_2021_champions_autograph", "Stockholm 2021 Champions Autograph Capsule", 0.78, T, [
        "s1mple","b1t","electroNic","Perfecto","Boombl4",
    ], F),
]

# ── 2020 RMR ──────────────────────────────────────────────────────────────────
T_LABEL = "2020 RMR"
F = "Foil"

rmr2020 = [
    tcap("rmr_2020_legends", "2020 RMR Legends", 0.30, T_LABEL, [
        "Team Vitality","Heroic","Ninjas in Pyjamas","Team Spirit",
        "Natus Vincere","Evil Geniuses","100 Thieves","FURIA Esports",
    ], F),
    tcap("rmr_2020_challengers", "2020 RMR Challengers", 0.32, T_LABEL, [
        "Astralis","BIG","Fnatic","G2 Esports",
        "OG","GODSENT","Nemiga Gaming","Team Liquid",
    ], F),
    tcap("rmr_2020_contenders", "2020 RMR Contenders", 0.39, T_LABEL, [
        "FaZe Clan","North","Virtus.pro","ESPADA",
        "Gen.G Esports","BOOM Esports","Renegades","TYLOO",
    ], F),
]

# ── Berlin 2019 ───────────────────────────────────────────────────────────────
T = "Berlin 2019"
F = "Foil"

berlin = [
    tcap("berlin_2019_legends_sticker", "Berlin 2019 Legends Sticker Capsule", 11.15, T, [
        "Astralis","ENCE","FaZe Clan","MIBR",
        "Natus Vincere","Ninjas in Pyjamas","Renegades","Team Liquid",
    ], F),
    tcap("berlin_2019_challengers_sticker", "Berlin 2019 Attending Challengers Sticker Capsule", 14.50, T, [
        "Avangar","compLexity Gaming","G2 Esports","HellRaisers","Vitality","Cloud9",
    ], F),
    tcap("berlin_2019_minor_sticker", "Berlin 2019 Minor Challengers Sticker Capsule", 2.60, T, [
        "CR4ZY","DreamEaters","Fnatic","forZe eSports","INTZ E-SPORTS CLUB",
        "mousesports","North","NRG Esports","Sharks Esports","Syman Gaming","Team Spirit","TYLOO",
    ], F),
    tcap("berlin_2019_legends_autograph", "Berlin 2019 Legends Autograph Capsule", 1.30, T, [
        "dev1ce","dupreeh","gla1ve","Magisk","Xyp9x",
        "aerial","Aleksib","allu","sergej","xseveN",
        "Guardian","Neo","NiKo","olofmeister","rain",
        "Lucas1","FalleN","fer","TACO","zews",
        "b1t","Boombl4","electroNic","s1mple","Zeus",
        "Golden","GeT_RiGhT","Lekr0","REZ","f0rest",
        "azr","jks","jkaem","Liazz","Gratisfaction",
        "EliGE","NAF","nitr0","Stewie2K","Twistzz",
    ], F),
    tcap("berlin_2019_challengers_autograph", "Berlin 2019 Attending Challengers Autograph Capsule", 1.15, T, [
        "AdreN","buster","Jame","qikert","Sanji",
        "dephh","oBo","rickers","ShahZaM","sick",
        "AmaNEk","Jackz","kennyS","Lucky","shox",
        "nukkye","oskar","ISSAA","loWel","zorte",
        "ALEX","apEX","NBK-","RpK","ZywOo",
        "autimatic","daps","koosta","mixwell","JamezIRL",
    ], F),
    tcap("berlin_2019_minor_autograph", "Berlin 2019 Minor Challengers Autograph Capsule", 1.89, T, [
        "Letn1","nexa","hunter-","OttoNd","SHiPZ",
        "iDISBALANCE","kinqie","Krad","speed4k","svyat",
        "Brollan","JW","KRIMZ","twist","Xizt",
        "almazer","facecrack","FL1T","Jerry","xsepower",
        "chrisJ","frozen","karrigan","ropz","woxic",
        "aizy","gade","JUGi","Kjaerbye","valde",
        "Brehze","CeRq","Ethan","stanislaw","Tarik",
        "exit","jnt","leo_drk","Meyern","RMN",
        "t0rick","iis","Keoz","nealan","Ramz1kBO$$",
        "BnTeT","Freeman","attacker","cy1","somebody",
    ], F),
]

# ── Katowice 2019 ─────────────────────────────────────────────────────────────
T = "Katowice 2019"
F = "Foil"

katowice19 = [
    tcap("katowice_2019_legends_sticker", "Katowice 2019 Legends Sticker Capsule", 38.90, T, [
        "Astralis","BIG","Complexity Gaming","FaZe Clan",
        "HellRaisers","MIBR","Natus Vincere","Team Liquid",
    ], F),
    tcap("katowice_2019_minor_sticker", "Katowice 2019 Minor Challengers Sticker Capsule", 28.10, T, [
        "Avangar","Cloud9","ENCE","Fnatic","FURIA","G2 Esports",
        "Grayhound Gaming","Ninjas in Pyjamas","NRG Esports","Renegades",
        "Team Spirit","TYLOO","Vega Squadron","ViCi Gaming","Winstrike Team",
    ], F),
    tcap("katowice_2019_legends_autograph", "Katowice 2019 Legends Autograph Capsule", 5.26, T, [
        "dev1ce","dupreeh","gla1ve","Magisk","Xyp9x",
        "gob b","tabseN","tiziaN","nex","XANTARES",
        "dephh","n0thing","ShahZaM","stanislaw","Rickeh",
        "AdreN","Guardian","NiKo","olofmeister","rain",
        "ANGE1","DeadFox","HObbit","ISSAA","woxic",
        "coldzera","FalleN","fer","felps","TACO",
        "Edward","electroNic","flamie","s1mple","Zeus",
        "EliGE","NAF","nitr0","Stewie2K","Twistzz",
    ], F),
    tcap("katowice_2019_minor_autograph", "Katowice 2019 Minor Challengers Autograph Capsule", 6.53, T, [
        "buster","fitch","Jame","KrizzeN","qikert",
        "autimatic","flusha","kioShiMa","RUSH","Zellsis",
        "aleksib","allu","sergej","xseveN","Aerial",
        "Brollan","JW","KRIMZ","twist","Xizt",
        "ableJ","arT","KSCERATO","VINI","yuurih",
        "bodyy","Lucky","JACKZ","kennyS","shox",
        "dexter","DickStacy","erkaSt","malta","sterling",
        "dennis","f0rest","GeT_RiGhT","Lekr0","REZ",
        "Brehze","daps","Ethan","FugLy","CeRq",
        "azr","jkaem","jks","Liazz","Gratisfaction",
        "attacker","BnTeT","somebody","Summer","xccurate",
        "chopper","crush","hutji","jR","tonyblack",
        "advent","aumaN","Freeman","kaze","zhokiNg",
        "Boombl4","Kvik","n0rb3r7","wayLander","WorldEdit",
    ], F),
]

# ── Boston 2018 ───────────────────────────────────────────────────────────────
T = "Boston 2018"
F = "Foil"

boston = [
    tcap("boston_2018_legends_sticker", "Boston 2018 Legends Sticker Capsule", 44.00, T, [
        "Gambit Esports","100 Thieves","Astralis","Virtus.pro",
        "Fnatic","SK Gaming","BIG","North",
    ], F),
    tcap("boston_2018_challengers_sticker", "Boston 2018 Challengers Sticker Capsule", 55.20, T, [
        "Cloud9","FlipSid3 Tactics","G2 Esports","Natus Vincere","mousesports","Sprout",
        "FaZe Clan","Vega Squadron","Space Soldiers","Team EnVyUs",
        "Misfits Gaming","Team Liquid","Renegades","Flash Gaming",
        "Quantum Bellator Fire","AVANGAR",
    ], F),
    tcap("boston_2018_legends_autograph", "Boston 2018 Legends Autograph Capsule", 101.63, T, [
        "Dosia","AdreN","mou","HObbit","fitch",
        "kNgV-","HEN1","LUCAS1","fnx","bit",
        "dev1ce","dupreeh","gla1ve","Kjaerbye","Xyp9x",
        "TaZ","NEO","pashaBiceps","snax","byali",
        "JW","flusha","KRIMZ","Golden","Lekr0",
        "FalleN","fer","coldzera","TACO","felps",
        "gob b","nex","tabseN","keev","LEGIJA",
        "MSL","k0nfig","cajunb","aizy","valde",
    ], F),
    tcap("boston_2018_attending_legends_autograph", "Boston 2018 Attending Legends Autograph Capsule", 7.70, T, [
        "Dosia","AdreN","mou","HObbit","fitch",
        "dev1ce","dupreeh","gla1ve","Kjaerbye","Xyp9x",
        "TaZ","NEO","pashaBiceps","snax","byali",
        "JW","flusha","KRIMZ","Golden","Lekr0",
        "FalleN","fer","coldzera","TACO","felps",
        "gob b","nex","tabseN","keev","LEGIJA",
        "MSL","k0nfig","cajunb","aizy","valde",
    ], F),
    tcap("boston_2018_challengers_autograph", "Boston 2018 Returning Challengers Autograph Capsule", 11.93, T, [
        "Tarik","Stewie2K","autimatic","RUSH","Skadoodle",
        "B1ad3","markeloff","WorldEdit","wayLander","seized",
        "shox","bodyy","NBK-","apEX","kennyS",
        "Edward","flamie","s1mple","Zeus","electronic",
        "chrisJ","oskar","suNny","STYKO","ropz",
        "kRYSTAL","innocent","zehN","denis","Spiidi",
        "karrigan","rain","NiKo","Guardian","olofmeister",
        "jR","mir","keshandr","hutji","chopper",
    ], F),
    tcap("boston_2018_minor_autograph", "Boston 2018 Minor Challengers Autograph Capsule", 420.60, T, [
        "XANTARES","NGIN","MAJ3R","Paz","Calyx",
        "Happy","SIXER","RpK","xms","ScreaM",
        "seang@res","ShahZaM","SicK","devoduvek","AmaNEk",
        "jdm64","nitr0","EliGE","Twistzz","zews",
        "AZR","jks","USTILO","Nifty","NAF",
        "Fancy1","AttackeR","Kaze","LOVEYY","zhokiNg",
        "balblna","Krad","waterfaLLZ","Boombl4","jmqa",
        "Jame","buster","KrizzeN","Qikert","dimasick",
    ], F),
]

# ── Vintage sticker-only capsules (2014-2017) ─────────────────────────────────

vintage = [
    tcap("krakow_2017_legends_sticker", "Kraków 2017 Legends Sticker Capsule", 54.00, "Kraków 2017", [
        "Astralis","Virtus.pro","Fnatic","SK Gaming","Natus Vincere","Gambit Esports","North","FaZe Clan",
    ], "Foil"),
    tcap("krakow_2017_challengers_sticker", "Kraków 2017 Challengers Sticker Capsule", 68.50, "Kraków 2017", [
        "mousesports","G2 Esports","Cloud9","FlipSid3 Tactics","PENTA Sports","BIG","Vega Squadron","Immortals",
    ], "Foil"),
    tcap("atlanta_2017_legends_sticker", "Atlanta 2017 Legends Sticker Capsule", 92.00, "Atlanta 2017", [
        "SK Gaming","Team Liquid","Virtus.pro","Fnatic","Astralis","Gambit Gaming","Natus Vincere","FlipSid3 Tactics",
    ], "Foil"),
    tcap("atlanta_2017_challengers_sticker", "Atlanta 2017 Challengers Sticker Capsule", 110.00, "Atlanta 2017", [
        "FaZe Clan","mousesports","G2 Esports","OpTic Gaming","Team Dignitas","Team EnVyUs","GODSENT","HellRaisers",
    ], "Foil"),
    tcap("cologne_2016_legends_sticker", "Cologne 2016 Legends Sticker Capsule", 18.50, "Cologne 2016", [
        "SK Gaming","Natus Vincere","Astralis","Team Liquid","Ninjas in Pyjamas","Fnatic","Virtus.pro","Counter Logic Gaming",
    ], "Foil"),
    tcap("cologne_2016_challengers_sticker", "Cologne 2016 Challengers Sticker Capsule", 21.00, "Cologne 2016", [
        "mousesports","FaZe Clan","OpTic Gaming","Gambit Gaming","Team EnVyUs","G2 Esports","Team Dignitas","FlipSid3 Tactics",
    ], "Foil"),
    tcap("mlg_columbus_2016_legends_sticker", "MLG Columbus 2016 Legends Sticker Capsule", 65.00, "MLG Columbus 2016", [
        "Team EnVyUs","Natus Vincere","FaZe Clan","Ninjas in Pyjamas","Fnatic","Virtus.pro","Astralis","Luminosity Gaming",
    ], "Foil"),
    tcap("mlg_columbus_2016_challengers_sticker", "MLG Columbus 2016 Challengers Sticker Capsule", 72.00, "MLG Columbus 2016", [
        "Counter Logic Gaming","mousesports","Cloud9","FlipSid3 Tactics","Team Liquid","Gambit Gaming","G2 Esports","Splyce",
    ], "Foil"),
    tcap("cluj_napoca_2015_legends_sticker", "Cluj-Napoca 2015 Legends Sticker Capsule", 45.00, "Cluj-Napoca 2015", [
        "Fnatic","Team EnVyUs","Virtus.pro","Natus Vincere","Team SoloMid","Ninjas in Pyjamas","Luminosity Gaming","G2 Kinguin",
    ], "Foil"),
    tcap("cluj_napoca_2015_challengers_sticker", "Cluj-Napoca 2015 Challengers Sticker Capsule", 52.00, "Cluj-Napoca 2015", [
        "Cloud9","mousesports","Titan","Team Dignitas","FlipSid3 Tactics","Team Liquid","Counter Logic Gaming","Vexed Gaming",
    ], "Foil"),
    tcap("cologne_2015_legends_sticker", "Cologne 2015 Legends Sticker Capsule", 58.00, "Cologne 2015", [
        "Fnatic","Ninjas in Pyjamas","Natus Vincere","Virtus.pro","Team SoloMid","Team EnVyUs","Luminosity Gaming","Counter Logic Gaming",
    ], "Foil"),
    tcap("cologne_2015_challengers_sticker", "Cologne 2015 Challengers Sticker Capsule", 64.00, "Cologne 2015", [
        "Cloud9","mousesports","Team Kinguin","FlipSid3 Tactics","Titan","Team eBettle","Team Liquid","Renegades",
    ], "Foil"),
    tcap("katowice_2015_legends_sticker", "Katowice 2015 Legends Sticker Capsule", 490.00, "Katowice 2015", [
        "Fnatic","Ninjas in Pyjamas","Virtus.pro","Natus Vincere","Team EnVyUs","Team SoloMid","PENTA Sports","HellRaisers",
    ], "Foil"),
    tcap("katowice_2015_challengers_sticker", "Katowice 2015 Challengers Sticker Capsule", 560.00, "Katowice 2015", [
        "Cloud9","LGB eSports","Vox Eminor","Titan","3DMAX","Counter Logic Gaming","Keyd Stars","FlipSid3 Tactics",
    ], "Foil"),
    tcap("cologne_2014_legends_sticker", "Cologne 2014 Legends Sticker Capsule", 380.00, "Cologne 2014", [
        "Virtus.pro","Ninjas in Pyjamas","Team Dignitas","Team LDLC","Fnatic","Cloud9","HellRaisers","Natus Vincere",
    ], "Foil"),
    tcap("cologne_2014_challengers_sticker", "Cologne 2014 Challengers Sticker Capsule", 410.00, "Cologne 2014", [
        "Copenhagen Wolves","Titan","iBUYPOWER","mousesports","Vox Eminor","MTS GameGod Wolf","dAT Team","Epsilon eSports",
    ], "Foil"),
    tcap("ems_katowice_2014_legends", "EMS One Katowice 2014 Legends", 3100.00, "EMS One Katowice 2014", [
        "Fnatic","Ninjas in Pyjamas","Complexity Gaming","Team Dignitas","Virtus.pro","HellRaisers","Team LDLC","LGB eSports",
    ], "Foil"),
    tcap("ems_katowice_2014_challengers", "EMS One Katowice 2014 Challengers", 3450.00, "EMS One Katowice 2014", [
        "iBUYPOWER","mousesports","Titan","Vox Eminor","Reason Gaming","Natus Vincere","3DMAX","Clan-Mystik",
    ], "Foil"),
]

# ── assemble & write ──────────────────────────────────────────────────────────

all_capsules = (
    community + austin + budapest + shanghai + copenhagen +
    paris + rio + antwerp + stockholm + rmr2020 +
    berlin + katowice19 + boston + vintage
)

out = {"format_version": "1.0", "capsules": all_capsules}
with open("public/data/capsules.json", "w") as f:
    json.dump(out, f, indent=2)

print(f"Written {len(all_capsules)} capsules to public/data/capsules.json")

# Validate: check all weights sum to 100 and no empty tiers with nonzero weight
errors = 0
for cap in all_capsules:
    w = cap["rarity_weights"]
    total = sum(w.values())
    if abs(total - 100) > 0.5:
        print(f"  ERROR weight sum {total} in {cap['id']}")
        errors += 1
    for rarity, weight in w.items():
        items = cap["tiers"].get(rarity, [])
        if weight > 0 and not items:
            print(f"  ERROR empty tier {rarity} with weight {weight} in {cap['id']}")
            errors += 1
print(f"Validation: {errors} errors")
