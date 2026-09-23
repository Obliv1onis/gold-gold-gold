#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const MUSIC_KITS_URL = 'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/music_kits.json';
const STEAM_PRICE_URL = 'https://steamcommunity.com/market/priceoverview/';
const OTHERS = resolve('public/data/others.json');
const OUTPUT = resolve('design/reference/music-kit-market.md');
const CACHE = '/private/tmp/cs2-direct-music-kit-prices.json';
const STORE_PRICE_FALLBACKS = new Map([
  ['Music Kit | Starjunk 95, Industrial Sunset Memories', 4.99],
  ['StatTrak™ Music Kit | Starjunk 95, Industrial Sunset Memories', 7.99],
]);

function delay(ms) {
  return new Promise(resolveDelay => setTimeout(resolveDelay, ms));
}

async function fetchJson(url, attempts = 8) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { 'user-agent': 'cs2-case-sim catalog sync' },
        signal: AbortSignal.timeout(12000),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success !== false) return data;
      }
      if (attempt === attempts || ![429, 500, 502, 503].includes(response.status)) {
        throw new Error(`${url} returned HTTP ${response.status}`);
      }
    } catch (error) {
      if (attempt === attempts) throw error;
    }
    await delay(Math.min(30000, attempt * 3000));
  }
}

function steamPriceUrl(hashName) {
  const params = new URLSearchParams({
    appid: '730',
    currency: '1',
    market_hash_name: hashName,
  });
  return `${STEAM_PRICE_URL}?${params}`;
}

function parseUsd(value) {
  if (typeof value !== 'string') return null;
  const parsed = Number.parseFloat(value.replace(/[^0-9.]/g, ''));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function escapeCell(value) {
  return String(value ?? '').replaceAll('\\', '\\\\').replaceAll('|', '\\|').replaceAll('\n', ' ');
}

const [musicKits, otherData] = await Promise.all([
  fetchJson(MUSIC_KITS_URL),
  readFile(OTHERS, 'utf8').then(JSON.parse),
]);
const boxedImages = new Set(
  otherData.capsules
    .filter(entry => entry.type === 'music_kit_box')
    .flatMap(entry => Object.values(entry.tiers ?? {}).flat())
    .map(item => item.image_url),
);
const directKits = musicKits
  .filter(item => item.market_hash_name && !boxedImages.has(item.image))
  .sort((a, b) => a.market_hash_name.localeCompare(b.market_hash_name, 'en-US'));

let cache = {};
try {
  cache = JSON.parse(await readFile(CACHE, 'utf8'));
} catch { /* A missing cache is expected on the first run. */ }

let completed = 0;
for (const item of directKits) {
  if (!cache[item.market_hash_name]) {
    try {
      const quote = await fetchJson(steamPriceUrl(item.market_hash_name));
      cache[item.market_hash_name] = {
        price: parseUsd(quote.lowest_price ?? quote.median_price),
        volume: Number.parseInt(String(quote.volume ?? '').replace(/\D/g, ''), 10) || null,
      };
      await writeFile(CACHE, JSON.stringify(cache));
      await delay(300);
    } catch (error) {
      console.warn(`${item.market_hash_name}: ${error.message}`);
    }
  }
  completed++;
  if (completed % 10 === 0) console.log(`Steam market: ${completed} / ${directKits.length}`);
}

const verifiedAt = new Date().toISOString();
const uniqueKits = new Set(directKits.map(item => item.market_hash_name.replace(/^StatTrak™\s+/, ''))).size;
const marketPriced = directKits.filter(item => cache[item.market_hash_name]?.price).length;
const storePriced = directKits.filter(item => !cache[item.market_hash_name]?.price && STORE_PRICE_FALLBACKS.has(item.market_hash_name)).length;
const priced = marketPriced + storePriced;
const lines = [
  '# Direct Music Kit Market Reference',
  '',
  '> Canonical input for music kits sold individually in the simulator market and not contained in a music-kit box.',
  `> Music-kit metadata: [ByMykel/CSGO-API](${MUSIC_KITS_URL}).`,
  '> Prices: Steam Community Market lowest sell listing in USD; newly released trade-locked items use their CS2 Store price until a market quote exists.',
  `> Verified at: ${verifiedAt}.`,
  '',
  `Music kits: ${uniqueKits}. Market variants: ${directKits.length}. Priced variants: ${priced} (${marketPriced} Community Market, ${storePriced} CS2 Store).`,
  '',
  '| API ID | Market hash name | Rarity | Price (USD) | 24h volume | Price basis |',
  '| --- | --- | --- | ---: | ---: | --- |',
];
for (const item of directKits) {
  const quote = cache[item.market_hash_name];
  const price = quote?.price ?? STORE_PRICE_FALLBACKS.get(item.market_hash_name) ?? null;
  const priceBasis = quote?.price ? 'Steam Community Market' : STORE_PRICE_FALLBACKS.has(item.market_hash_name) ? 'CS2 Store listing' : 'Unavailable';
  lines.push(
    `| ${escapeCell(item.id)} | ${escapeCell(item.market_hash_name)} | high_grade | `
    + `${price?.toFixed(2) ?? '—'} | ${quote?.volume ?? '—'} | ${priceBasis} |`,
  );
}
lines.push('');

await writeFile(OUTPUT, `${lines.join('\n')}\n`);
console.log(`Wrote ${directKits.length} variants (${priced} priced) to ${OUTPUT}`);
