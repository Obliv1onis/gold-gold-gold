#!/usr/bin/env python3
"""Generate public/data/cases.json from embedded case definitions."""
import json, re, os

def _id(s):
    return re.sub(r'[^a-z0-9]+', '_', s.lower()).strip('_')

def W(weapon, skin, prefix, market_price, stattrak=True):
    return {"weapon": weapon, "skin": skin,
            "item_id": f"{prefix}{_id(weapon)}_{_id(skin)}",
            "image_url": None, "market_price": market_price, "stattrak": stattrak}

def K(weapon, skin, prefix, price):
    return W(weapon, skin, prefix, price, False)

def G(weapon, skin, prefix, price):
    return W(weapon, skin, prefix, price, False)

WEIGHTS = {"mil_spec": 79.92, "restricted": 15.98, "classified": 3.20,
           "covert": 0.64, "rare_special": 0.26}

CDN = "https://steamcdn-a.akamaihd.net/apps/730/icons/econ/weapon_cases/"

def case(cid, name, date, img, price, items):
    return {"id": cid, "name": name, "release_date": date, "type": "weapon_case",
            "image_url": CDN + img + ".png", "market_price": price,
            "rarity_weights": WEIGHTS, "items": items}

# ── Knife helpers ─────────────────────────────────────────────────────────────

def og_knives(p):  # Original finishes: Karambit, M9, Bayonet, Flip, Gut
    return [K("Karambit","★ Vanilla",p,360), K("M9 Bayonet","★ Vanilla",p,240),
            K("Bayonet","★ Vanilla",p,185), K("Flip Knife","★ Vanilla",p,220),
            K("Gut Knife","★ Vanilla",p,135)]

def navaja_set(p):
    return [K("Navaja Knife","★ Vanilla",p,130), K("Stiletto Knife","★ Vanilla",p,200),
            K("Talon Knife","★ Vanilla",p,230), K("Ursus Knife","★ Vanilla",p,185)]

def spectrum_knives(p):
    return [K("Butterfly Knife","★ Vanilla",p,500), K("Huntsman Knife","★ Vanilla",p,170),
            K("Falchion Knife","★ Vanilla",p,140), K("Bowie Knife","★ Vanilla",p,155),
            K("Shadow Daggers","★ Vanilla",p,130)]

def paracord_set(p):
    return [K("Paracord Knife","★ Vanilla",p,145), K("Survival Knife","★ Vanilla",p,145),
            K("Nomad Knife","★ Vanilla",p,160), K("Skeleton Knife","★ Vanilla",p,175)]

def og_gloves(p):
    return [G("Sport Gloves","★ Pandora's Box",p,450),
            G("Hand Wraps","★ Cobalt Skulls",p,280),
            G("Moto Gloves","★ Eclipse",p,210),
            G("Driver Gloves","★ King Snake",p,180),
            G("Hydra Gloves","★ Rattler",p,100),
            G("Specialist Gloves","★ Crimson Kimono",p,120)]

def bfang_gloves(p):
    return [G("Sport Gloves","★ Vice",p,380),
            G("Hand Wraps","★ Desert Shamagh",p,95),
            G("Specialist Gloves","★ Marble Fade",p,200),
            G("Moto Gloves","★ Blood Pressure",p,80),
            G("Driver Gloves","★ Snow Leopard",p,320),
            G("Hydra Gloves","★ Emerald",p,220)]

# ── All cases (newest → oldest) ───────────────────────────────────────────────

CASES = [

case("fever_case","Fever Case","2025-01-14","fever_case",1.20,{
"mil_spec":[W("M4A4","Choppa","fever_",0.06),W("MAG-7","Resupply","fever_",0.05),
            W("MP9","Nexus","fever_",0.05),W("P2000","Sure Grip","fever_",0.05),
            W("SSG 08","Memorial","fever_",0.06),W("USP-S","PC-GRN","fever_",0.07),
            W("XM1014","Mockingbird","fever_",0.05)],
"restricted":[W("Desert Eagle","Serpent Strike","fever_",0.30),W("Galil AR","Control","fever_",0.18),
              W("Nova","Rising Sun","fever_",0.15),W("P90","Wave Breaker","fever_",0.20),
              W("Zeus x27","Tosai","fever_",0.15,False)],
"classified":[W("AK-47","Searing Rage","fever_",4.00),W("Glock-18","Shinobu","fever_",3.50),
              W("UMP-45","K.O. Factory","fever_",2.50)],
"covert":[W("AWP","Printstream","fever_",80.00),W("FAMAS","Bad Trip","fever_",30.00)],
"rare_special":[K("Nomad Knife","★ Doppler","fever_",250),K("Paracord Knife","★ Marble Fade","fever_",280),
                K("Skeleton Knife","★ Tiger Tooth","fever_",300),K("Survival Knife","★ Vanilla","fever_",145)]}),

case("kilowatt_case","Kilowatt Case","2024-02-01","kilowatt_case",1.55,{
"mil_spec":[W("Dual Berettas","Hideout","kw_",0.07),W("MP7","Just Smile","kw_",0.06),
            W("Nova","Dark Water","kw_",0.06),W("SSG 08","Dezastre","kw_",0.07),
            W("Tec-9","Slag","kw_",0.06),W("UMP-45","Motorized","kw_",0.07),
            W("XM1014","Irezumi","kw_",0.06)],
"restricted":[W("Five-SeveN","Hybrid","kw_",0.28),W("Glock-18","Block-18","kw_",0.22),
              W("M4A4","Etch Lord","kw_",0.35),W("MAC-10","Light Box","kw_",0.20),
              W("Sawed-Off","Analog Input","kw_",0.18)],
"classified":[W("M4A1-S","Black Lotus","kw_",8.50),W("USP-S","Jawbreaker","kw_",5.00),
              W("Zeus x27","Olympus","kw_",3.50,False)],
"covert":[W("AK-47","Inheritance","kw_",40.00),W("AWP","Chrome Cannon","kw_",28.00)],
"rare_special":[K("Kukri Knife","★ Fade","kw_",380),K("Kukri Knife","★ Crimson Web","kw_",220),
                K("Kukri Knife","★ Slaughter","kw_",200),K("Kukri Knife","★ Vanilla","kw_",180)]}),

case("revolution_case","Revolution Case","2023-02-09","revolution_case",0.28,{
"mil_spec":[W("MAG-7","Insomnia","rev_",0.04),W("MP5-SD","Liquidation","rev_",0.05),
            W("MP9","Featherweight","rev_",0.05),W("P250","Re.built","rev_",0.05),
            W("PP-Bizon","Synergist","rev_",0.04),W("SCAR-20","Fragments","rev_",0.04),
            W("Tec-9","Rebel","rev_",0.05)],
"restricted":[W("Glock-18","Umbral Rabbit","rev_",0.09),W("M4A1-S","Emphorosaur-S","rev_",0.15),
              W("P2000","Wicked Sick","rev_",0.10),W("R8 Revolver","Banana Cannon","rev_",0.12),
              W("SG 553","Cyberforce","rev_",0.10)],
"classified":[W("MAC-10","Sakkaku","rev_",1.20),W("P90","Neoqueen","rev_",2.00),
              W("UMP-45","Wild Child","rev_",1.50)],
"covert":[W("AK-47","Head Shot","rev_",12.00),W("M4A4","Temukau","rev_",18.00)],
"rare_special":[G("Hydra Gloves","★ Rattler","rev_",180),G("Moto Gloves","★ Polygon","rev_",90),
                G("Sport Gloves","★ Amphibious","rev_",320),G("Hand Wraps","★ Duct Tape","rev_",120)]}),

case("recoil_case","Recoil Case","2022-07-01","recoil_case",0.49,{
"mil_spec":[W("FAMAS","Meow 36","rc_",0.06),W("Galil AR","Destroyer","rc_",0.05),
            W("Glock-18","Winterized","rc_",0.06,True),W("M4A4","Poly Mag","rc_",0.05),
            W("MAC-10","Monkeyflage","rc_",0.05),W("Negev","Drop Me","rc_",0.05),
            W("UMP-45","Roadblock","rc_",0.05)],
"restricted":[W("Dual Berettas","Flora Carnivora","rc_",0.12),W("M249","Downtown","rc_",0.11),
              W("P90","Vent Rush","rc_",0.14),W("R8 Revolver","Crazy 8","rc_",0.13),
              W("SG 553","Dragon Tech","rc_",0.17)],
"classified":[W("AK-47","Ice Coaled","rc_",3.50),W("P250","Visions","rc_",2.80),
              W("Sawed-Off","Kiss♥Love","rc_",1.50)],
"covert":[W("AWP","Chromatic Aberration","rc_",22.00),W("USP-S","Printstream","rc_",35.00)],
"rare_special":[G("Sport Gloves","★ Pandora's Box","rc_",450),G("Hand Wraps","★ Cobalt Skulls","rc_",280),
                G("Moto Gloves","★ Eclipse","rc_",210),G("Driver Gloves","★ King Snake","rc_",180)]}),

case("dreams_nightmares_case","Dreams & Nightmares Case","2022-01-21","dreams_nightmares_case",0.32,{
"mil_spec":[W("Five-SeveN","Scrawl","dn_",0.05),W("MAC-10","Ensnared","dn_",0.04),
            W("MAG-7","Foresight","dn_",0.04),W("MP5-SD","Necro Jr.","dn_",0.05),
            W("P2000","Lifted Spirits","dn_",0.04),W("Sawed-Off","Spirit Board","dn_",0.04),
            W("SCAR-20","Poultrygeist","dn_",0.04)],
"restricted":[W("G3SG1","Dream Glade","dn_",0.09),W("M4A1-S","Night Terror","dn_",0.15),
              W("PP-Bizon","Space Cat","dn_",0.11),W("USP-S","Ticket to Hell","dn_",0.20),
              W("XM1014","Zombie Offensive","dn_",0.08)],
"classified":[W("Dual Berettas","Melondrama","dn_",1.20),W("FAMAS","Rapid Eye Movement","dn_",1.80),
              W("MP7","Abyssal Apparition","dn_",1.50)],
"covert":[W("AK-47","Nightwish","dn_",10.00),W("MP9","Starlight Protector","dn_",8.00)],
"rare_special":spectrum_knives("dn_")}),

case("operation_riptide_case","Operation Riptide Case","2021-09-21","operation_riptide_case",0.28,{
"mil_spec":[W("AUG","Plague","riptide_",0.06),W("Dual Berettas","Tread","riptide_",0.05),
            W("G3SG1","Keeping Tabs","riptide_",0.05),W("MP7","Guerrilla","riptide_",0.06),
            W("PP-Bizon","Lumen","riptide_",0.05),W("USP-S","Black Lotus","riptide_",0.12)],
"restricted":[W("FAMAS","ZX Spectron","riptide_",0.10),W("M4A4","Spider Lily","riptide_",0.25),
              W("MAG-7","BI83 Spectrum","riptide_",0.09),W("MP9","Mount Fuji","riptide_",0.10),
              W("XM1014","Watchdog","riptide_",0.08)],
"classified":[W("Glock-18","Snack Attack","riptide_",1.50),W("MAC-10","Toybox","riptide_",1.20),
              W("SSG 08","Turbo Peek","riptide_",1.80)],
"covert":[W("AK-47","Leet Museo","riptide_",12.00),W("Desert Eagle","Ocean Drive","riptide_",25.00)],
"rare_special":spectrum_knives("riptide_")}),

case("snakebite_case","Snakebite Case","2021-05-03","snakebite_case",0.30,{
"mil_spec":[W("CZ75-Auto","Circaetus","snake_",0.06),W("Glock-18","Clear Catch","snake_",0.05),
            W("M249","O.S.I.P.R.","snake_",0.05),W("Nova","Windblown","snake_",0.04),
            W("P2000","Dispatch","snake_",0.04),W("SG 553","Heavy Metal","snake_",0.05),
            W("UMP-45","Oscillator","snake_",0.05)],
"restricted":[W("AK-47","Slate","snake_",0.10),W("Desert Eagle","Trigger Discipline","snake_",0.15),
              W("MAC-10","Button Masher","snake_",0.09),W("Negev","dev_texture","snake_",0.08),
              W("P250","Cyber Shell","snake_",0.09)],
"classified":[W("Galil AR","Chromatic Aberration","snake_",1.50),W("MP9","Food Chain","snake_",1.20),
              W("XM1014","XOXO","snake_",1.00)],
"covert":[W("M4A4","In Living Color","snake_",15.00),W("USP-S","The Traitor","snake_",20.00)],
"rare_special":bfang_gloves("snake_")}),

case("operation_broken_fang_case","Operation Broken Fang Case","2020-12-03","operation_broken_fang_case",0.45,{
"mil_spec":[W("CZ75-Auto","Vendetta","bfang_",0.06),W("G3SG1","Digital Mesh","bfang_",0.05),
            W("Galil AR","Vandal","bfang_",0.05),W("M249","Deep Relief","bfang_",0.05),
            W("MP5-SD","Condition Zero","bfang_",0.05),W("P250","Contaminant","bfang_",0.05),
            W("P90","Cocoa Rampage","bfang_",0.07)],
"restricted":[W("AWP","Exoskeleton","bfang_",0.15),W("Dual Berettas","Dezastre","bfang_",0.10),
              W("Nova","Clear Polymer","bfang_",0.08),W("SSG 08","Parallax","bfang_",0.10),
              W("UMP-45","Gold Bismuth","bfang_",0.12)],
"classified":[W("Five-SeveN","Fairy Tale","bfang_",2.50),W("M4A4","Cyber Security","bfang_",3.00),
              W("USP-S","Monster Mashup","bfang_",2.00)],
"covert":[W("Glock-18","Neo-Noir","bfang_",20.00),W("M4A1-S","Printstream","bfang_",65.00)],
"rare_special":bfang_gloves("bfang_")}),

case("fracture_case","Fracture Case","2020-07-01","fracture_case",0.50,{
"mil_spec":[W("Negev","Ultralight","frac_",0.05),W("P2000","Gnarled","frac_",0.05),
            W("P250","Cassette","frac_",0.06),W("P90","Freight","frac_",0.05),
            W("PP-Bizon","Runic","frac_",0.05),W("SG 553","Ol' Rusty","frac_",0.05),
            W("SSG 08","Mainframe 001","frac_",0.07)],
"restricted":[W("Galil AR","Connexion","frac_",0.10),W("MAC-10","Allure","frac_",0.13),
              W("MAG-7","Monster Call","frac_",0.10),W("MP5-SD","Kitbash","frac_",0.11),
              W("Tec-9","Brother","frac_",0.12)],
"classified":[W("Glock-18","Vogue","frac_",2.50),W("M4A4","Tooth Fairy","frac_",3.00),
              W("XM1014","Entombed","frac_",1.80)],
"covert":[W("AK-47","Legion of Anubis","frac_",15.00),W("Desert Eagle","Printstream","frac_",45.00)],
"rare_special":paracord_set("frac_")}),

case("prisma2_case","Prisma 2 Case","2020-03-31","prisma2_case",0.38,{
"mil_spec":[W("AUG","Tom Cat","prisma2_",0.06),W("AWP","Capillary","prisma2_",0.07),
            W("CZ75-Auto","Distressed","prisma2_",0.05),W("Desert Eagle","Blue Ply","prisma2_",0.08),
            W("MP5-SD","Desert Strike","prisma2_",0.05),W("Negev","Prototype","prisma2_",0.05),
            W("R8 Revolver","Bone Forged","prisma2_",0.05)],
"restricted":[W("P2000","Acid Etched","prisma2_",0.10),W("Sawed-Off","Apocalypto","prisma2_",0.09),
              W("SCAR-20","Enforcer","prisma2_",0.10),W("SG 553","Darkwing","prisma2_",0.11),
              W("SSG 08","Fever Dream","prisma2_",0.12)],
"classified":[W("AK-47","Phantom Disruptor","prisma2_",2.00),W("MAC-10","Disco Tech","prisma2_",1.80),
              W("MAG-7","Justice","prisma2_",1.50)],
"covert":[W("Glock-18","Bullet Queen","prisma2_",20.00),W("M4A1-S","Player Two","prisma2_",15.00)],
"rare_special":navaja_set("prisma2_")}),

case("shattered_web_case","Shattered Web Case","2019-11-18","shattered_web_case",0.45,{
"mil_spec":[W("Dual Berettas","Balance","sweb_",0.06),W("G3SG1","Black Sand","sweb_",0.05),
            W("M249","Warbird","sweb_",0.05),W("MP5-SD","Acid Wash","sweb_",0.06),
            W("Nova","Plume","sweb_",0.05),W("R8 Revolver","Memento","sweb_",0.05),
            W("SCAR-20","Torn","sweb_",0.05)],
"restricted":[W("AK-47","Rat Rod","sweb_",0.12),W("AUG","Arctic Wolf","sweb_",0.10),
              W("MP7","Neon Ply","sweb_",0.10),W("P2000","Obsidian","sweb_",0.12),
              W("PP-Bizon","Embargo","sweb_",0.09)],
"classified":[W("SG 553","Colony IV","sweb_",1.80),W("SSG 08","Bloodshot","sweb_",2.00),
              W("Tec-9","Decimator","sweb_",1.50)],
"covert":[W("AWP","Containment Breach","sweb_",20.00),W("MAC-10","Stalker","sweb_",15.00)],
"rare_special":paracord_set("sweb_")}),

case("cs20_case","CS20 Case","2019-10-18","cs20_case",0.40,{
"mil_spec":[W("Dual Berettas","Elite 1.6","cs20_",0.06),W("FAMAS","Decommissioned","cs20_",0.05),
            W("Glock-18","Sacrifice","cs20_",0.06),W("MAC-10","Classic Crate","cs20_",0.05),
            W("MAG-7","Popdog","cs20_",0.05),W("SCAR-20","Assault","cs20_",0.05),
            W("Tec-9","Flash Out","cs20_",0.05)],
"restricted":[W("Five-SeveN","Buddy","cs20_",0.10),W("M249","Aztec","cs20_",0.08),
              W("MP5-SD","Agent","cs20_",0.10),W("P250","Inferno","cs20_",0.12),
              W("UMP-45","Plastique","cs20_",0.09)],
"classified":[W("AUG","Death by Puppy","cs20_",1.50),W("MP9","Hydra","cs20_",1.20),
              W("P90","Nostalgia","cs20_",2.00)],
"covert":[W("AWP","Wildfire","cs20_",25.00),W("FAMAS","Commemoration","cs20_",20.00)],
"rare_special":[K("Classic Knife","★ Vanilla","cs20_",200),K("Classic Knife","★ Fade","cs20_",350),
                K("Classic Knife","★ Crimson Web","cs20_",220),K("Classic Knife","★ Slaughter","cs20_",200)]}),

case("prisma_case","Prisma Case","2019-03-13","prisma_case",0.45,{
"mil_spec":[W("AK-47","Uncharted","prisma1_",0.06),W("FAMAS","Crypsis","prisma1_",0.05),
            W("Galil AR","Akoben","prisma1_",0.05),W("MAC-10","Whitefish","prisma1_",0.05),
            W("MP7","Mischief","prisma1_",0.06),W("P250","Verdigris","prisma1_",0.05)],
"restricted":[W("Desert Eagle","Light Rail","prisma1_",0.15),W("MP5-SD","Gauss","prisma1_",0.10),
              W("R8 Revolver","Skull Crusher","prisma1_",0.10),W("Tec-9","Bamboozle","prisma1_",0.10),
              W("UMP-45","Moonrise","prisma1_",0.12)],
"classified":[W("AUG","Momentum","prisma1_",2.00),W("AWP","Atheris","prisma1_",3.50),
              W("XM1014","Incinegator","prisma1_",1.50)],
"covert":[W("Five-SeveN","Angry Mob","prisma1_",15.00),W("M4A4","The Emperor","prisma1_",20.00)],
"rare_special":navaja_set("prisma1_")}),

case("danger_zone_case","Danger Zone Case","2018-12-06","danger_zone_case",0.45,{
"mil_spec":[W("Glock-18","Oxide Blaze","dz_",0.06),W("M4A4","Magnesium","dz_",0.06),
            W("Nova","Wood Fired","dz_",0.05),W("P90","Off World","dz_",0.06),
            W("Sawed-Off","Black Sand","dz_",0.05),W("SG 553","Danger Close","dz_",0.05),
            W("Tec-9","FNC","dz_",0.05)],
"restricted":[W("G3SG1","Scavenger","dz_",0.10),W("Galil AR","Signal","dz_",0.10),
              W("MAC-10","Pipe Down","dz_",0.09),W("P250","Nevermore","dz_",0.10),
              W("USP-S","Flashback","dz_",0.15)],
"classified":[W("Desert Eagle","Mecha Industries","dz_",2.50),W("MP5-SD","Phosphor","dz_",2.00),
              W("UMP-45","Momentum","dz_",1.80)],
"covert":[W("AK-47","Asiimov","dz_",25.00),W("AWP","Neo-Noir","dz_",25.00)],
"rare_special":navaja_set("dz_")}),

case("horizon_case","Horizon Case","2018-08-02","horizon_case",0.60,{
"mil_spec":[W("AUG","Amber Slipstream","horizon_",0.06),W("Dual Berettas","Shred","horizon_",0.05),
            W("Glock-18","Warhawk","horizon_",0.06),W("MP9","Capillary","horizon_",0.05),
            W("P90","Traction","horizon_",0.06),W("R8 Revolver","Survivalist","horizon_",0.05),
            W("Tec-9","Snek-9","horizon_",0.06)],
"restricted":[W("AWP","PAW","horizon_",0.12),W("CZ75-Auto","Eco","horizon_",0.10),
              W("G3SG1","High Seas","horizon_",0.10),W("MP7","Powercore","horizon_",0.10),
              W("Nova","Toy Soldier","horizon_",0.08)],
"classified":[W("FAMAS","Eye of Athena","horizon_",2.00),W("M4A1-S","Nightmare","horizon_",3.50),
              W("Sawed-Off","Devourer","horizon_",1.50)],
"covert":[W("AK-47","Neon Rider","horizon_",35.00),W("Desert Eagle","Code Red","horizon_",20.00)],
"rare_special":navaja_set("horizon_")}),

case("clutch_case","Clutch Case","2018-02-15","clutch_case",3.50,{
"mil_spec":[W("Five-SeveN","Flame Test","clutch_",0.08),W("MP9","Black Sand","clutch_",0.07),
            W("P2000","Urban Hazard","clutch_",0.07),W("PP-Bizon","Night Riot","clutch_",0.07),
            W("R8 Revolver","Grip","clutch_",0.07),W("SG 553","Aloha","clutch_",0.07),
            W("XM1014","Oxide Blaze","clutch_",0.07)],
"restricted":[W("Glock-18","Moonrise","clutch_",0.20),W("MAG-7","SWAG-7","clutch_",0.15),
              W("Negev","Lionfish","clutch_",0.15),W("Nova","Wild Six","clutch_",0.12),
              W("UMP-45","Arctic Wolf","clutch_",0.18)],
"classified":[W("AUG","Stymphalian","clutch_",3.00),W("AWP","Mortis","clutch_",5.00),
              W("USP-S","Cortex","clutch_",4.00)],
"covert":[W("M4A4","Neo-Noir","clutch_",25.00),W("MP7","Bloodsport","clutch_",15.00)],
"rare_special":og_gloves("clutch_")}),

case("spectrum2_case","Spectrum 2 Case","2017-09-14","spectrum2_case",0.60,{
"mil_spec":[W("AUG","Triqua","spectrum2_",0.07),W("G3SG1","Hunter","spectrum2_",0.06),
            W("Glock-18","Off World","spectrum2_",0.07),W("MAC-10","Oceanic","spectrum2_",0.06),
            W("Sawed-Off","Morris","spectrum2_",0.06),W("SCAR-20","Jungle Slipstream","spectrum2_",0.06),
            W("Tec-9","Cracked Opal","spectrum2_",0.07)],
"restricted":[W("CZ75-Auto","Tacticat","spectrum2_",0.12),W("MP9","Goo","spectrum2_",0.10),
              W("SG 553","Aloha","spectrum2_",0.10),W("UMP-45","Exposure","spectrum2_",0.10),
              W("XM1014","Ziggy","spectrum2_",0.09)],
"classified":[W("M4A1-S","Leaded Glass","spectrum2_",3.00),W("PP-Bizon","High Roller","spectrum2_",2.00),
              W("R8 Revolver","Llama Cannon","spectrum2_",2.50)],
"covert":[W("AK-47","The Empress","spectrum2_",25.00),W("P250","See Ya Later","spectrum2_",15.00)],
"rare_special":spectrum_knives("spectrum2_")}),

case("operation_hydra_case","Operation Hydra Case","2017-05-23","operation_hydra_case",2.00,{
"mil_spec":[W("FAMAS","Macabre","hydra_",0.08),W("M4A1-S","Briefing","hydra_",0.10),
            W("MAC-10","Aloha","hydra_",0.07),W("MAG-7","Hard Water","hydra_",0.07),
            W("Tec-9","Cut","hydra_",0.08),W("UMP-45","Metal Flowers","hydra_",0.07),
            W("USP-S","Blueprint","hydra_",0.12)],
"restricted":[W("AK-47","Orbit Mk01","hydra_",0.15),W("P2000","Woodsman","hydra_",0.12),
              W("P250","Red Rock","hydra_",0.10),W("P90","Death Grip","hydra_",0.12),
              W("SSG 08","Death's Head","hydra_",0.12)],
"classified":[W("Dual Berettas","Cobra Strike","hydra_",2.50),W("Galil AR","Sugar Rush","hydra_",2.00),
              W("M4A4","Hellfire","hydra_",4.00)],
"covert":[W("AWP","Oni Taiji","hydra_",40.00),W("Five-SeveN","Hyper Beast","hydra_",25.00)],
"rare_special":og_gloves("hydra_")}),

case("spectrum_case","Spectrum Case","2017-03-15","spectrum_case",0.80,{
"mil_spec":[W("Desert Eagle","Oxide Blaze","spectrum1_",0.08),W("Five-SeveN","Capillary","spectrum1_",0.07),
            W("MP7","Akoben","spectrum1_",0.07),W("P250","Ripple","spectrum1_",0.07),
            W("PP-Bizon","Jungle Slipstream","spectrum1_",0.06),W("Sawed-Off","Zander","spectrum1_",0.06),
            W("SCAR-20","Blueprint","spectrum1_",0.06)],
"restricted":[W("Galil AR","Crimson Tsunami","spectrum1_",0.12),W("MAC-10","Last Dive","spectrum1_",0.10),
              W("SG 553","Phantom","spectrum1_",0.10),W("UMP-45","Scaffold","spectrum1_",0.10),
              W("XM1014","Seasons","spectrum1_",0.09)],
"classified":[W("AWP","Fever Dream","spectrum1_",4.00),W("CZ75-Auto","Xiangliu","spectrum1_",2.50),
              W("M4A1-S","Decimator","spectrum1_",3.00)],
"covert":[W("AK-47","Bloodsport","spectrum1_",20.00),W("USP-S","Neo-Noir","spectrum1_",15.00)],
"rare_special":spectrum_knives("spectrum1_")}),

case("glove_case","Glove Case","2016-11-28","glove_case",5.00,{
"mil_spec":[W("CZ75-Auto","Polymer","glove_",0.10),W("Galil AR","Black Sand","glove_",0.08),
            W("M249","Emerald Poison Dart","glove_",0.08),W("MAG-7","Sonar","glove_",0.08),
            W("MP7","Cirrus","glove_",0.08),W("MP9","Sand Scale","glove_",0.08),
            W("P2000","Turf","glove_",0.07)],
"restricted":[W("Dual Berettas","Royal Consorts","glove_",0.18),W("Glock-18","Ironwork","glove_",0.15),
              W("M4A1-S","Flashback","glove_",0.25),W("Nova","Gila","glove_",0.12),
              W("USP-S","Cyrex","glove_",0.20)],
"classified":[W("FAMAS","Mecha Industries","glove_",3.00),W("P90","Shallow Grave","glove_",2.50),
              W("Sawed-Off","Wasteland Princess","glove_",2.00)],
"covert":[W("M4A4","Buzz Kill","glove_",50.00),W("SSG 08","Dragonfire","glove_",30.00)],
"rare_special":og_gloves("glove_")}),

case("gamma2_case","Gamma 2 Case","2016-08-18","gamma2_case",0.60,{
"mil_spec":[W("CZ75-Auto","Imprint","gamma2_",0.07),W("G3SG1","Ventilator","gamma2_",0.06),
            W("Negev","Dazzle","gamma2_",0.06),W("P90","Grim","gamma2_",0.07),
            W("UMP-45","Briefing","gamma2_",0.06),W("XM1014","Slipstream","gamma2_",0.06)],
"restricted":[W("Desert Eagle","Directive","gamma2_",0.15),W("Glock-18","Weasel","gamma2_",0.12),
              W("MAG-7","Petroglyph","gamma2_",0.10),W("SCAR-20","Powercore","gamma2_",0.10),
              W("SG 553","Triarch","gamma2_",0.12)],
"classified":[W("AUG","Syd Mead","gamma2_",2.50),W("MP9","Airlock","gamma2_",2.00),
              W("Tec-9","Fuel Injector","gamma2_",3.00)],
"covert":[W("AK-47","Neon Revolution","gamma2_",18.00),W("FAMAS","Roll Cage","gamma2_",12.00)],
"rare_special":og_knives("gamma2_")}),

case("gamma_case","Gamma Case","2016-06-15","gamma_case",1.00,{
"mil_spec":[W("AUG","Aristocrat","gamma1_",0.08),W("Five-SeveN","Scumbria","gamma1_",0.07),
            W("MAC-10","Carnivore","gamma1_",0.07),W("P90","Chopper","gamma1_",0.08),
            W("PP-Bizon","Harvester","gamma1_",0.07),W("SG 553","Aerial","gamma1_",0.07),
            W("Tec-9","Ice Cap","gamma1_",0.07)],
"restricted":[W("AWP","Phobos","gamma1_",0.18),W("Nova","Exo","gamma1_",0.12),
              W("P250","Iron Clad","gamma1_",0.15),W("R8 Revolver","Reboot","gamma1_",0.12),
              W("Sawed-Off","Limelight","gamma1_",0.10)],
"classified":[W("M4A4","Desolate Space","gamma1_",3.00),W("P2000","Imperial Dragon","gamma1_",2.50),
              W("SCAR-20","Bloodsport","gamma1_",3.50)],
"covert":[W("Glock-18","Wasteland Rebel","gamma1_",15.00),W("M4A1-S","Mecha Industries","gamma1_",20.00)],
"rare_special":og_knives("gamma1_")}),

case("chroma3_case","Chroma 3 Case","2016-04-27","chroma3_case",1.00,{
"mil_spec":[W("Dual Berettas","Ventilators","chroma3_",0.08),W("G3SG1","Orange Crash","chroma3_",0.07),
            W("M249","Spectre","chroma3_",0.07),W("MP9","Bioleak","chroma3_",0.07),
            W("P2000","Oceanic","chroma3_",0.07),W("Sawed-Off","Fubar","chroma3_",0.07),
            W("SG 553","Atlas","chroma3_",0.08)],
"restricted":[W("CZ75-Auto","Red Astor","chroma3_",0.12),W("Galil AR","Firefight","chroma3_",0.12),
              W("SSG 08","Ghost Crusader","chroma3_",0.12),W("Tec-9","Re-Entry","chroma3_",0.12),
              W("XM1014","Black Tie","chroma3_",0.10)],
"classified":[W("AUG","Fleet Flock","chroma3_",2.50),W("P250","Asiimov","chroma3_",3.50),
              W("UMP-45","Primal Saber","chroma3_",2.00)],
"covert":[W("M4A1-S","Chantico's Fire","chroma3_",20.00),W("PP-Bizon","Judgement of Anubis","chroma3_",15.00)],
"rare_special":og_knives("chroma3_")}),

case("operation_wildfire_case","Operation Wildfire Case","2016-02-17","operation_wildfire_case",2.50,{
"mil_spec":[W("Dual Berettas","Cartel","wildfire_",0.10),W("MAC-10","Lapis Gator","wildfire_",0.08),
            W("PP-Bizon","Photic Zone","wildfire_",0.08),W("SSG 08","Necropos","wildfire_",0.08),
            W("Tec-9","Jambiya","wildfire_",0.08),W("USP-S","Lead Conduit","wildfire_",0.10)],
"restricted":[W("FAMAS","Valence","wildfire_",0.15),W("Five-SeveN","Triumvirate","wildfire_",0.15),
              W("Glock-18","Royal Legion","wildfire_",0.15),W("MAG-7","Praetorian","wildfire_",0.12),
              W("MP7","Impire","wildfire_",0.12)],
"classified":[W("AWP","Elite Build","wildfire_",5.00),W("Desert Eagle","Kumicho Dragon","wildfire_",4.00),
              W("Nova","Hyper Beast","wildfire_",3.00)],
"covert":[W("AK-47","Fuel Injector","wildfire_",25.00),W("M4A4","The Battlestar","wildfire_",20.00)],
"rare_special":[K("Bowie Knife","★ Vanilla","wildfire_",155),K("Bowie Knife","★ Fade","wildfire_",320),
                K("Bowie Knife","★ Marble Fade","wildfire_",280),K("Bowie Knife","★ Tiger Tooth","wildfire_",260)]}),

case("revolver_case","Revolver Case","2015-12-08","revolver_case",1.00,{
"mil_spec":[W("AUG","Ricochet","revolver_",0.10),W("Desert Eagle","Corinthian","revolver_",0.10),
            W("P2000","Imperial","revolver_",0.08),W("R8 Revolver","Crimson Web","revolver_",0.12),
            W("Sawed-Off","Yorick","revolver_",0.08),W("SCAR-20","Outbreak","revolver_",0.08)],
"restricted":[W("Negev","Power Loader","revolver_",0.15),W("PP-Bizon","Fuel Rod","revolver_",0.12),
              W("SG 553","Tiger Moth","revolver_",0.15),W("Tec-9","Avalanche","revolver_",0.15),
              W("XM1014","Teclu Burner","revolver_",0.12)],
"classified":[W("AK-47","Point Disarray","revolver_",3.50),W("Five-SeveN","Retrobution","revolver_",2.50),
              W("P90","Shapewood","revolver_",2.00)],
"covert":[W("M4A4","Royal Paladin","revolver_",15.00),W("R8 Revolver","Fade","revolver_",20.00)],
"rare_special":og_knives("revolver_")}),

case("shadow_case","Shadow Case","2015-09-17","shadow_case",3.50,{
"mil_spec":[W("Dual Berettas","Dualing Dragons","shadow_",0.10),W("FAMAS","Survivor Z","shadow_",0.08),
            W("Glock-18","Wraiths","shadow_",0.10),W("MAC-10","Rangeen","shadow_",0.08),
            W("MAG-7","Cobalt Core","shadow_",0.08),W("SCAR-20","Green Marine","shadow_",0.08),
            W("XM1014","Scumbria","shadow_",0.07)],
"restricted":[W("Galil AR","Stone Cold","shadow_",0.18),W("M249","Nebula Crusader","shadow_",0.15),
              W("MP7","Special Delivery","shadow_",0.15),W("P250","Wingshot","shadow_",0.15)],
"classified":[W("AK-47","Frontside Misty","shadow_",4.00),W("G3SG1","Flux","shadow_",2.50),
              W("SSG 08","Big Iron","shadow_",3.00)],
"covert":[W("M4A1-S","Golden Coil","shadow_",40.00),W("USP-S","Kill Confirmed","shadow_",60.00)],
"rare_special":[K("Shadow Daggers","★ Vanilla","shadow_",130),K("Shadow Daggers","★ Fade","shadow_",280),
                K("Shadow Daggers","★ Marble Fade","shadow_",250),K("Shadow Daggers","★ Tiger Tooth","shadow_",220)]}),

case("falchion_case","Falchion Case","2015-05-26","falchion_case",1.50,{
"mil_spec":[W("Galil AR","Rocket Pop","falchion_",0.10),W("Glock-18","Bunsen Burner","falchion_",0.10),
            W("Nova","Ranger","falchion_",0.08),W("P90","Elite Build","falchion_",0.10),
            W("UMP-45","Riot","falchion_",0.08),W("USP-S","Torque","falchion_",0.12)],
"restricted":[W("FAMAS","Neural Net","falchion_",0.15),W("M4A4","Evil Daimyo","falchion_",0.18),
              W("MP9","Ruby Poison Dart","falchion_",0.20),W("Negev","Loudmouth","falchion_",0.12),
              W("P2000","Handgun","falchion_",0.12)],
"classified":[W("CZ75-Auto","Yellow Jacket","falchion_",3.00),W("MP7","Nemesis","falchion_",2.50),
              W("SG 553","Cyrex","falchion_",3.50)],
"covert":[W("AK-47","Aquamarine Revenge","falchion_",20.00),W("AWP","Hyper Beast","falchion_",30.00)],
"rare_special":[K("Falchion Knife","★ Vanilla","falchion_",140),K("Falchion Knife","★ Fade","falchion_",300),
                K("Falchion Knife","★ Marble Fade","falchion_",260),K("Falchion Knife","★ Tiger Tooth","falchion_",240)]}),

case("chroma2_case","Chroma 2 Case","2015-09-17","chroma2_case",2.50,{
"mil_spec":[W("AK-47","Elite Build","chroma2_",0.10),W("Desert Eagle","Bronze Deco","chroma2_",0.10),
            W("MP7","Armor Core","chroma2_",0.08),W("Negev","Man-o'-war","chroma2_",0.08),
            W("P250","Valence","chroma2_",0.08),W("Sawed-Off","Origami","chroma2_",0.08)],
"restricted":[W("AWP","Worm God","chroma2_",0.25),W("CZ75-Auto","Pole Position","chroma2_",0.15),
              W("MAG-7","Heat","chroma2_",0.15),W("UMP-45","Grand Prix","chroma2_",0.15)],
"classified":[W("FAMAS","Djinn","chroma2_",3.00),W("Five-SeveN","Monkey Business","chroma2_",4.00),
              W("Galil AR","Eco","chroma2_",2.50)],
"covert":[W("M4A1-S","Hyper Beast","chroma2_",35.00),W("MAC-10","Neon Rider","chroma2_",20.00)],
"rare_special":og_knives("chroma2_")}),

case("chroma_case","Chroma Case","2015-02-09","chroma_case",2.00,{
"mil_spec":[W("Glock-18","Catacombs","chroma1_",0.10),W("M249","System Lock","chroma1_",0.08),
            W("MP9","Deadly Poison","chroma1_",0.08),W("SCAR-20","Grotto","chroma1_",0.08),
            W("XM1014","Quicksilver","chroma1_",0.08)],
"restricted":[W("Desert Eagle","Naga","chroma1_",0.20),W("Dual Berettas","Urban Shock","chroma1_",0.15),
              W("MAC-10","Malachite","chroma1_",0.15),W("Sawed-Off","Serenity","chroma1_",0.12)],
"classified":[W("AK-47","Cartel","chroma1_",3.50),W("M4A4","Dragon King","chroma1_",5.00),
              W("P250","Muertos","chroma1_",2.50)],
"covert":[W("AWP","Man-o'-war","chroma1_",25.00),W("Galil AR","Chatterbox","chroma1_",15.00)],
"rare_special":og_knives("chroma1_")}),

case("operation_vanguard_case","Operation Vanguard Weapon Case","2014-11-11","operation_vanguard_weapon_case",2.00,{
"mil_spec":[W("Five-SeveN","Urban Hazard","vanguard_",0.12),W("MAG-7","Firestarter","vanguard_",0.10),
            W("MP9","Dart","vanguard_",0.10),W("Sawed-Off","Highwayman","vanguard_",0.10),
            W("UMP-45","Delusion","vanguard_",0.10)],
"restricted":[W("G3SG1","Murky","vanguard_",0.18),W("Glock-18","Grinder","vanguard_",0.15),
              W("M4A1-S","Basilisk","vanguard_",0.25),W("SCAR-20","Cardiac","vanguard_",0.15)],
"classified":[W("M4A4","Griffin","vanguard_",4.00),W("P250","Cartel","vanguard_",3.00),
              W("XM1014","Tranquility","vanguard_",2.50)],
"covert":[W("AK-47","Wasteland Rebel","vanguard_",20.00),W("P2000","Fire Elemental","vanguard_",18.00)],
"rare_special":og_knives("vanguard_")}),

case("esports_2014_summer_case","eSports 2014 Summer Case","2014-07-10","esports_2014_summer_case",3.00,{
"mil_spec":[W("CZ75-Auto","Hexane","es14s_",0.12),W("Negev","Bratatat","es14s_",0.10),
            W("SSG 08","Dark Water","es14s_",0.12),W("USP-S","Blood Tiger","es14s_",0.15),
            W("XM1014","Red Python","es14s_",0.10)],
"restricted":[W("Desert Eagle","Crimson Web","es14s_",0.25),W("Glock-18","Steel Disruption","es14s_",0.18),
              W("MAC-10","Ultraviolet","es14s_",0.15),W("MP7","Ocean Foam","es14s_",0.15),
              W("P90","Virus","es14s_",0.18),W("PP-Bizon","Blue Streak","es14s_",0.12)],
"classified":[W("AUG","Bengal Tiger","es14s_",4.00),W("AWP","Corticera","es14s_",5.00),
              W("Nova","Bloomstick","es14s_",2.50),W("P2000","Corticera","es14s_",2.50)],
"covert":[W("AK-47","Jaguar","es14s_",25.00),W("M4A4","Bullet Rain","es14s_",20.00)],
"rare_special":og_knives("es14s_")}),

case("operation_breakout_case","Operation Breakout Weapon Case","2014-07-01","operation_breakout_weapon_case",6.00,{
"mil_spec":[W("MP7","Urban Hazard","breakout_",0.12),W("Negev","Desert-Strike","breakout_",0.10),
            W("P2000","Ivory","breakout_",0.10),W("SSG 08","Abyss","breakout_",0.12),
            W("UMP-45","Labyrinth","breakout_",0.10)],
"restricted":[W("CZ75-Auto","Tigris","breakout_",0.20),W("Nova","Koi","breakout_",0.18),
              W("P250","Supernova","breakout_",0.18),W("PP-Bizon","Osiris","breakout_",0.15)],
"classified":[W("Desert Eagle","Conspiracy","breakout_",5.00),W("Five-SeveN","Fowl Play","breakout_",4.00),
              W("Glock-18","Water Elemental","breakout_",4.50)],
"covert":[W("M4A1-S","Cyrex","breakout_",15.00),W("P90","Asiimov","breakout_",30.00)],
"rare_special":[K("Butterfly Knife","★ Vanilla","breakout_",500),K("Butterfly Knife","★ Fade","breakout_",900),
                K("Butterfly Knife","★ Marble Fade","breakout_",800),K("Butterfly Knife","★ Tiger Tooth","breakout_",700)]}),

case("huntsman_weapon_case","Huntsman Weapon Case","2014-05-01","huntsman_weapon_case",4.00,{
"mil_spec":[W("CZ75-Auto","Twist","hunt_",0.12),W("Galil AR","Kami","hunt_",0.10),
            W("P2000","Pulse","hunt_",0.10),W("P90","Desert Warfare","hunt_",0.12),
            W("SSG 08","Slashed","hunt_",0.10),W("Tec-9","Isaac","hunt_",0.10)],
"restricted":[W("AUG","Torque","hunt_",0.20),W("MAC-10","Tatter","hunt_",0.18),
              W("PP-Bizon","Antique","hunt_",0.15),W("XM1014","Heaven Guard","hunt_",0.15)],
"classified":[W("M4A1-S","Atomic Alloy","hunt_",5.00),W("SCAR-20","Cyrex","hunt_",4.00),
              W("USP-S","Caiman","hunt_",4.50)],
"covert":[W("AK-47","Vulcan","hunt_",80.00),W("M4A4","Desert-Strike","hunt_",25.00)],
"rare_special":[K("Huntsman Knife","★ Vanilla","hunt_",170),K("Huntsman Knife","★ Fade","hunt_",350),
                K("Huntsman Knife","★ Marble Fade","hunt_",300),K("Huntsman Knife","★ Tiger Tooth","hunt_",280)]}),

case("operation_phoenix_case","Operation Phoenix Weapon Case","2014-02-20","operation_phoenix_weapon_case",1.50,{
"mil_spec":[W("MAG-7","Heaven Guard","phoenix_",0.12),W("Negev","Terrain","phoenix_",0.10),
            W("Tec-9","Sandstorm","phoenix_",0.10),W("UMP-45","Corporal","phoenix_",0.10)],
"restricted":[W("FAMAS","Sergeant","phoenix_",0.18),W("MAC-10","Heat","phoenix_",0.18),
              W("SG 553","Pulse","phoenix_",0.18),W("USP-S","Guardian","phoenix_",0.20)],
"classified":[W("AK-47","Redline","phoenix_",8.00),W("Nova","Antique","phoenix_",3.00),
              W("P90","Trigon","phoenix_",3.50)],
"covert":[W("AUG","Chameleon","phoenix_",15.00),W("AWP","Asiimov","phoenix_",60.00)],
"rare_special":og_knives("phoenix_")}),

case("csgo_weapon_case_3","CS:GO Weapon Case 3","2015-01-08","weapon_case_3",2.00,{
"mil_spec":[W("CZ75-Auto","Crimson Web","csgo3_",0.15),W("Dual Berettas","Panther","csgo3_",0.12),
            W("Glock-18","Blue Fissure","csgo3_",0.12),W("P2000","Red FragCam","csgo3_",0.12),
            W("USP-S","Stainless","csgo3_",0.15)],
"restricted":[W("CZ75-Auto","Tread Plate","csgo3_",0.25),W("Desert Eagle","Heirloom","csgo3_",0.25),
              W("Five-SeveN","Copper Galaxy","csgo3_",0.20),W("Tec-9","Titanium Bit","csgo3_",0.18)],
"classified":[W("CZ75-Auto","The Fuschia Is Now","csgo3_",4.00),W("P250","Undertow","csgo3_",3.50)],
"covert":[W("CZ75-Auto","Victoria","csgo3_",25.00)],
"rare_special":og_knives("csgo3_")}),

case("winter_offensive_case","Winter Offensive Weapon Case","2014-12-18","winter_offensive_case",2.00,{
"mil_spec":[W("Five-SeveN","Kami","wo_",0.12),W("Galil AR","Sandstorm","wo_",0.10),
            W("M249","Magma","wo_",0.10),W("PP-Bizon","Cobalt Halftone","wo_",0.10)],
"restricted":[W("Dual Berettas","Marina","wo_",0.20),W("FAMAS","Pulse","wo_",0.18),
              W("MP9","Rose Iron","wo_",0.18),W("Nova","Rising Skull","wo_",0.15)],
"classified":[W("AWP","Redline","wo_",8.00),W("M4A1-S","Guardian","wo_",5.00),
              W("P250","Mehndi","wo_",3.00)],
"covert":[W("M4A4","Asiimov","wo_",25.00),W("Sawed-Off","The Kraken","wo_",12.00)],
"rare_special":og_knives("wo_")}),

case("esports_2013_winter_case","eSports 2013 Winter Case","2013-12-18","esports_2013_winter_case",2.50,{
"mil_spec":[W("Five-SeveN","Nightshade","es13w_",0.15),W("G3SG1","Azure Zebra","es13w_",0.12),
            W("Galil AR","Blue Titanium","es13w_",0.12),W("Nova","Ghost Camo","es13w_",0.12),
            W("P250","Steel Disruption","es13w_",0.12),W("PP-Bizon","Water Sigil","es13w_",0.10)],
"restricted":[W("AK-47","Blue Laminate","es13w_",0.30),W("P90","Blind Spot","es13w_",0.25)],
"classified":[W("AWP","Electric Hive","es13w_",6.00),W("Desert Eagle","Cobalt Disruption","es13w_",4.00),
              W("FAMAS","Afterimage","es13w_",3.00)],
"covert":[W("M4A4","X-Ray","es13w_",20.00)],
"rare_special":og_knives("es13w_")}),

case("csgo_weapon_case_2","CS:GO Weapon Case 2","2013-11-08","weapon_case_2",3.00,{
"mil_spec":[W("FAMAS","Hexane","csgo2_",0.15),W("M4A1-S","Blood Tiger","csgo2_",0.18),
            W("P250","Hive","csgo2_",0.12),W("SCAR-20","Crimson Web","csgo2_",0.12),
            W("Tec-9","Blue Titanium","csgo2_",0.12)],
"restricted":[W("Dual Berettas","Hemoglobin","csgo2_",0.20),W("Five-SeveN","Case Hardened","csgo2_",0.25),
              W("MP9","Hypnotic","csgo2_",0.20),W("Nova","Graphite","csgo2_",0.18)],
"classified":[W("P90","Cold Blooded","csgo2_",5.00),W("USP-S","Serum","csgo2_",4.00)],
"covert":[W("SSG 08","Blood in the Water","csgo2_",35.00)],
"rare_special":og_knives("csgo2_")}),

case("operation_bravo_case","Operation Bravo Case","2013-09-19","operation_bravo_case",18.00,{
"mil_spec":[W("Dual Berettas","Black Limba","bravo_",0.20),W("G3SG1","Demeter","bravo_",0.15),
            W("Galil AR","Shattered","bravo_",0.15),W("Nova","Tempest","bravo_",0.15),
            W("SG 553","Wave Spray","bravo_",0.15),W("UMP-45","Bone Pile","bravo_",0.15)],
"restricted":[W("M4A1-S","Bright Water","bravo_",0.50),W("M4A4","Zirka","bravo_",0.40),
              W("MAC-10","Graven","bravo_",0.35),W("USP-S","Overgrowth","bravo_",0.40)],
"classified":[W("AWP","Graphite","bravo_",8.00),W("P2000","Ocean Foam","bravo_",5.00),
              W("P90","Emerald Dragon","bravo_",6.00)],
"covert":[W("AK-47","Fire Serpent","bravo_",280.00),W("Desert Eagle","Golden Koi","bravo_",40.00)],
"rare_special":og_knives("bravo_")}),

case("esports_2013_case","eSports 2013 Case","2013-10-09","esports_2013_case",3.50,{
"mil_spec":[W("FAMAS","Doomkitty","es13_",0.15),W("M4A4","Faded Zebra","es13_",0.15),
            W("MAG-7","Memento","es13_",0.12)],
"restricted":[W("Galil AR","Orange DDPAT","es13_",0.25),W("P250","Splash","es13_",0.20),
              W("Sawed-Off","Orange DDPAT","es13_",0.18)],
"classified":[W("AK-47","Red Laminate","es13_",5.00),W("AWP","BOOM","es13_",8.00)],
"covert":[W("P90","Death by Kitty","es13_",30.00)],
"rare_special":og_knives("es13_")}),

case("csgo_weapon_case","CS:GO Weapon Case","2013-08-14","weapon_case",12.00,{
"mil_spec":[W("AUG","Wings","csgo1_",0.25),W("MP7","Skulls","csgo1_",0.20),
            W("SG 553","Ultraviolet","csgo1_",0.18)],
"restricted":[W("Glock-18","Dragon Tattoo","csgo1_",8.00),W("M4A1-S","Dark Water","csgo1_",5.00),
              W("USP-S","Dark Water","csgo1_",4.00)],
"classified":[W("AK-47","Case Hardened","csgo1_",25.00),W("Desert Eagle","Hypnotic","csgo1_",12.00)],
"covert":[W("AWP","Lightning Strike","csgo1_",50.00)],
"rare_special":og_knives("csgo1_")}),

]

output = {"format_version": "1.0", "cases": CASES}

out_path = os.path.join(os.path.dirname(__file__), '..', 'public', 'data', 'cases.json')
with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(output, f, indent=2, ensure_ascii=False)

print(f"Written {len(CASES)} cases to {out_path}")

# Quick validation
weights_ok = all(abs(sum(c['rarity_weights'].values()) - 100.0) < 0.01 for c in CASES)
tiers_ok = all(all(len(c['items'][r]) > 0 for r in ['mil_spec','restricted','classified','covert','rare_special']) for c in CASES)
ids = [c['id'] for c in CASES]
unique_ok = len(ids) == len(set(ids))
print(f"Weights sum to 100: {weights_ok}")
print(f"All tiers populated: {tiers_ok}")
print(f"IDs unique: {unique_ok}")
print(f"Item counts per case: {[(c['id'], {r: len(c['items'][r]) for r in c['items']}) for c in CASES[:3]]}")
