#!/usr/bin/env python3
"""Fetch Steam CDN image URLs for all souvenir packages and patch souvenirs.json."""
import json, time, urllib.request, urllib.parse, urllib.error

CDN = "https://community.akamai.steamstatic.com/economy/image/"
SEARCH_URL = "https://steamcommunity.com/market/search/render/?appid=730&norender=1&count=100&currency=1&query={query}"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
}

TOURNAMENTS = [
    "DreamHack 2013 Souvenir",
    "EMS One Katowice 2014 Souvenir",
    "ESL One Cologne 2014 Souvenir",
    "DreamHack Winter 2014 Souvenir",
    "ESL One Katowice 2015 Souvenir",
    "ESL One Cologne 2015 Souvenir",
    "DreamHack Cluj-Napoca 2015 Souvenir",
    "MLG Columbus 2016 Souvenir",
    "ESL One Cologne 2016 Souvenir",
    "ELEAGUE Atlanta 2017 Souvenir",
    "PGL Krakow 2017 Souvenir",
    "ELEAGUE Boston 2018 Souvenir",
    "FACEIT London 2018 Souvenir",
    "IEM Katowice 2019 Souvenir",
    "StarLadder Berlin 2019 Souvenir",
    "PGL Stockholm 2021 Souvenir",
    "PGL Antwerp 2022 Souvenir",
    "IEM Rio 2022 Souvenir",
    "BLAST.tv Paris 2023 Souvenir",
    "PGL Copenhagen 2024 Souvenir",
    "Perfect World Shanghai 2024 Souvenir",
    "BLAST Austin 2025 Souvenir",
    "First 2026 Major Souvenir",
]

def fetch_search(query):
    url = SEARCH_URL.format(query=urllib.parse.quote(query))
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode())
    except Exception as e:
        print(f"  ERROR fetching '{query}': {e}")
        return None

def main():
    souvenir_path = "public/data/souvenirs.json"
    with open(souvenir_path) as f:
        data = json.load(f)

    # Build name → entry index lookup
    name_to_idx = {pkg["name"]: i for i, pkg in enumerate(data["cases"])}
    found = 0

    for tournament in TOURNAMENTS:
        print(f"Fetching: {tournament} ...", flush=True)
        result = fetch_search(tournament)

        if result and result.get("results"):
            for item in result["results"]:
                name = item.get("name", "")
                icon = item.get("asset_description", {}).get("icon_url", "")
                if name in name_to_idx and icon:
                    idx = name_to_idx[name]
                    if data["cases"][idx]["image_url"] is None:
                        data["cases"][idx]["image_url"] = CDN + icon
                        found += 1
        else:
            print(f"  No results.")

        time.sleep(3)  # rate limit

    print(f"\nImages found: {found} / {len(data['cases'])}")
    missing = [pkg["name"] for pkg in data["cases"] if pkg["image_url"] is None]
    if missing:
        print(f"Still missing ({len(missing)}):")
        for m in missing:
            print(f"  - {m}")

    with open(souvenir_path, "w") as f:
        json.dump(data, f, indent=2)
    print(f"Updated {souvenir_path}")

if __name__ == "__main__":
    main()
