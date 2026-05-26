#!/usr/bin/env python3
"""Fetch icon URLs from Steam Market item pages for souvenir packages with no image_url."""
import json, time, re, urllib.request, urllib.parse

CDN = "https://community.akamai.steamstatic.com/economy/image/"
BASE = "https://steamcommunity.com/market/listings/730/"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

# Regex to extract icon_url from embedded JS (g_rgAssets or asset_description JSON)
ICON_RE = re.compile(r'"icon_url"\s*:\s*"([^"]+)"')

def fetch_icon(name):
    url = BASE + urllib.parse.quote(name)
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            html = resp.read().decode("utf-8", errors="replace")
        m = ICON_RE.search(html)
        if m:
            return CDN + m.group(1)
    except Exception as e:
        print(f"    ERROR: {e}")
    return None

def main():
    souvenir_path = "public/data/souvenirs.json"
    with open(souvenir_path) as f:
        data = json.load(f)

    missing = [(i, pkg) for i, pkg in enumerate(data["cases"]) if pkg["image_url"] is None]
    print(f"Fetching icons for {len(missing)} packages...\n")

    found = 0
    for i, (idx, pkg) in enumerate(missing):
        name = pkg["name"]
        print(f"[{i+1}/{len(missing)}] {name}", flush=True)
        icon = fetch_icon(name)
        if icon:
            data["cases"][idx]["image_url"] = icon
            found += 1
            print(f"    ✓ {icon[:80]}...")
        else:
            print(f"    ✗ not found")
        time.sleep(2.5)  # rate limit

    print(f"\nFound: {found}/{len(missing)}")
    still_missing = [pkg["name"] for pkg in data["cases"] if pkg["image_url"] is None]
    if still_missing:
        print(f"Still missing ({len(still_missing)}):")
        for m in still_missing[:10]:
            print(f"  - {m}")
        if len(still_missing) > 10:
            print(f"  ... and {len(still_missing)-10} more")

    with open(souvenir_path, "w") as f:
        json.dump(data, f, indent=2)
    print(f"\nUpdated {souvenir_path}")

if __name__ == "__main__":
    main()
