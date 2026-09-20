#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const STICKERS_URL = 'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/stickers.json';
const STEAM_SEARCH_URL = 'https://steamcommunity.com/market/search/render/';
const OUTPUT = resolve('design/reference/cologne-2026-stickers.md');
const CACHE = '/private/tmp/cs2-cologne-2026-steam-pages.json';
const PAGE_SIZE = 10;
const rarityMap = {
  rarity_rare: 'high_grade',
  rarity_mythical: 'remarkable',
  rarity_legendary: 'exotic',
  rarity_ancient: 'extraordinary',
};

function delay(ms) {
  return new Promise(resolveDelay => setTimeout(resolveDelay, ms));
}

async function fetchJson(url, attempts = 12) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const response = await fetch(url, { headers: { 'user-agent': 'cs2-case-sim catalog sync' } });
    if (response.ok) return response.json();
    if (attempt === attempts || ![429, 500, 502, 503].includes(response.status)) {
      throw new Error(`${url} returned HTTP ${response.status}`);
    }
    await delay(Math.min(30000, attempt * 5000));
  }
}

function steamPageUrl(start) {
  const params = new URLSearchParams({
    query: 'Cologne 2026',
    start: String(start),
    count: String(PAGE_SIZE),
    search_descriptions: '0',
    sort_column: 'name',
    sort_dir: 'asc',
    appid: '730',
    norender: '1',
    currency: '1',
    l: 'english',
  });
  params.append('category_730_Type[]', 'tag_CSGO_Tool_Sticker');
  return `${STEAM_SEARCH_URL}?${params}`;
}

function escapeCell(value) {
  return String(value ?? '').replaceAll('\\', '\\\\').replaceAll('|', '\\|').replaceAll('\n', ' ');
}

const stickers = (await fetchJson(STICKERS_URL))
  .filter(item => item.name?.startsWith('Sticker | ') && item.name.endsWith('| Cologne 2026'))
  .sort((a, b) => a.name.localeCompare(b.name, 'en-US'));
const expected = new Set(stickers.map(item => item.name));
const normalizedExpected = new Map(stickers.map(item => [item.name.replace(/\s+/g, ' ').trim(), item.name]));
const steamPrices = new Map();
let pageCache = {};
try {
  pageCache = JSON.parse(await readFile(CACHE, 'utf8'));
} catch { /* A missing cache is expected on the first run. */ }

const loadPage = async start => {
  if (pageCache[start]) return pageCache[start];
  const page = await fetchJson(steamPageUrl(start));
  pageCache[start] = page;
  await writeFile(CACHE, JSON.stringify(pageCache));
  await delay(750);
  return page;
};

const firstPage = await loadPage(0);
const total = firstPage.total_count ?? 0;
const consume = page => {
  for (const result of page.results ?? []) {
    const canonicalName = normalizedExpected.get(result.hash_name?.replace(/\s+/g, ' ').trim());
    if (canonicalName && expected.has(canonicalName)) {
      steamPrices.set(canonicalName, {
        price: Number.isFinite(result.sell_price) ? result.sell_price / 100 : null,
        listings: result.sell_listings ?? null,
      });
    }
  }
};
consume(firstPage);

for (let start = PAGE_SIZE; start < total; start += PAGE_SIZE) {
  consume(await loadPage(start));
  if (start % 100 === 0) console.log(`Steam market: ${Math.min(start + PAGE_SIZE, total)} / ${total}`);
}

const verifiedAt = new Date().toISOString();
const lines = [
  '# Cologne 2026 Sticker Market Reference',
  '',
  '> Canonical input for the simulator\'s standalone Cologne 2026 market catalogue.',
  `> Sticker metadata: [ByMykel/CSGO-API](${STICKERS_URL}).`,
  '> Prices: Steam Community Market lowest sell listing in USD; prices are snapshots and may change.',
  `> Verified at: ${verifiedAt}.`,
  '',
  `Items: ${stickers.length}. Steam-priced items: ${steamPrices.size}.`,
  '',
  '| API ID | Market hash name | Rarity | Steam price (USD) | Listings |',
  '| --- | --- | --- | ---: | ---: |',
];
for (const item of stickers) {
  const quote = steamPrices.get(item.name);
  lines.push(
    `| ${escapeCell(item.id)} | ${escapeCell(item.name)} | ${rarityMap[item.rarity?.id] ?? 'high_grade'} | `
    + `${quote?.price?.toFixed(2) ?? '—'} | ${quote?.listings ?? '—'} |`,
  );
}
lines.push('');

await writeFile(OUTPUT, `${lines.join('\n')}\n`);
console.log(`Wrote ${stickers.length} stickers (${steamPrices.size} priced) to ${OUTPUT}`);
