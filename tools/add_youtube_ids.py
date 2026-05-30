#!/usr/bin/env python3
"""Add YouTube preview video IDs to music kit items in others.json."""
import json

OTHERS_PATH = 'public/data/others.json'

# YouTube video ID map: kit suffix (after "Music Kit | ") -> video ID
YOUTUBE_IDS = {
    "DRYDEN, Feel The Power":                       "WsUJ4qLAnM4",
    "ISOxo, inhuman":                               "ps-V1GQZPRM",
    "KILL SCRIPT, All Night":                       "ZjnYQDRBk1A",
    "Knock2, Make U SWEAT!":                        "vekNwu9_VD4",
    "Rad Cat, Reason":                              "IYMhhpg2nho",
    "TWERL and Ekko & Sidetrack, Under Bright Lights": "9fg9ic46ik0",
    "Adam Beyer, Red Room":                         "GIf50k8j270",
    "Ghost, Skeletá":                               "6ZDG_mlKq4I",
    "HEALTH, RAT WARS":                             "5VSVvT9EQXI",
    "James and the Cold Gun, Chewing Glass":        "lpWANy9j0PY",
    "Jonathan Young, Starship Velociraptor":        "iai5rBxywJ0",
    "Juelz, Floorspace":                            "BBgiopENh7g",
    "Killer Mike, MICHAEL":                         "AjpT37o9dCo",
    "PVRIS, Evergreen":                             "XbuXGoOMiqg",
    "Selective Response, No Love Only Pleasure":    "69XPnu1TI0Q",
    "Tigercub, The Perfume of Decay":               "i9sgCEI4KUg",
    "Laura Shigihara, Work Hard, Play Hard":        "CJVr7wVRL70",
    "Freaky DNA, Vici":                             "PAmQ6Xl6NkI",
    "Chipzel, ~Yellow Magic~":                      "THChLWmCEA4",
    "Austin Wintory, Mocha Petal":                  "mwHTecB638E",
    "Jesse Harlin, Astro Bellum":                   "P4HpUNmo_AQ",
    "Sarah Schachner, KOLIBRI":                     "G2bMJMber5g",
    "3kliksphilip, Heading for the Source":         "xqcwgRlfeAY",
    "Humanity's Last Breath, Void":                 "b4H9qZHfLPM",
    "Juelz, Shooters":                              "FxZWIscBpqE",
    "Knock2, dashstar*":                            "OCxmJWVv31o",
    "Meechy Darko, Gothic Luxury":                  "ZP-P4ieTMKs",
    "Sullivan King, Lock Me Up":                    "jaWkZCTpuQ8",
    "Dren, Gunman Taco Truck":                      "kSENMW9KHJ0",
    "Sam Marshall, Bodacious":                      "w8Wph6r8g4M",
    "Austin Wintory, Bachram":                      "z0tboG1zirM",
    "Matt Levine, Drifter":                         "97incUZu5f8",
    "Tree Adams and Ben Bromfield, M.U.D.D. FORCE": "t8QKDnCPmNM",
    "Daniel Sadowski, Eye of the Dragon":           "MDz2APnwJvU",
    "Tim Huling, Neo Noir":                         "1_aIPw_0gXE",
    "Beartooth, Aggressive":                        "vnMSivyiFEE",
    "Roam, Backbone":                               "auum2IQVmEw",
    "Blitz Kids, The Good Youth":                   "3aFh__HBYGM",
    "Neck Deep, Life's Not Out To Get You":         "BP3yqucVzjc",
    "Hundredth, FREE":                              "RKGAUvW96fo",
    "Skog, III-Arena":                              "vr7nfZsuucI",
    "Twin Atlantic, GLA":                           "POXMI1ZfImM",
}

with open(OTHERS_PATH) as f:
    data = json.load(f)

patched = 0
for capsule in data.get('capsules', []):
    if capsule.get('type') != 'music_kit_box':
        continue
    for item in capsule.get('tiers', {}).get('high_grade', []):
        name = item.get('name', '')
        # Strip "Music Kit | " and "StatTrak™ Music Kit | "
        suffix = name.replace('StatTrak™ Music Kit | ', '').replace('Music Kit | ', '')
        yt_id = YOUTUBE_IDS.get(suffix)
        if yt_id:
            item['youtube_id'] = yt_id
            patched += 1
        else:
            print(f'  NO ID for: {suffix!r}')

with open(OTHERS_PATH, 'w') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print(f'Done. Patched {patched} music kit items.')
