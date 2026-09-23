#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const BULK_URL = 'https://raw.githubusercontent.com/SKINSTRACK/CS2-Price-API/main/free_prices.json';
const STEAM_URL = 'https://steamcommunity.com/market/priceoverview/';
const OUTPUT = resolve('design/reference/skin-price.md');
const CACHE = '/private/tmp/cs2-steam-price-overrides.json';
const WEARS = ['Factory New', 'Minimal Wear', 'Field-Tested', 'Well-Worn', 'Battle-Scarred'];
const PRIORITY_DIRECT_NAMES = ['★ Bayonet | Crimson Web (Field-Tested)'];

function parseArgs(argv) {
  const args = { source: null, skipDirect: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--source') args.source = argv[++i];
    else if (argv[i] === '--skip-direct') args.skipDirect = true;
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  return args;
}

function delay(ms) {
  return new Promise(resolveDelay => setTimeout(resolveDelay, ms));
}

async function readJson(source) {
  if (source) return JSON.parse(await readFile(resolve(source), 'utf8'));
  const response = await fetch(BULK_URL, { headers: { 'user-agent': 'cs2-case-sim catalog sync' } });
  if (!response.ok) throw new Error(`Bulk Steam price request failed with HTTP ${response.status}`);
  return response.json();
}

function priceFor(row) {
  return row.prices?.find(price => price.provider === 'steam') ?? null;
}

function skinKey(item) {
  return `${item.weapon} | ${item.skin}`;
}

function isGlove(weapon) {
  return /Gloves|Wraps/.test(weapon ?? '');
}

function normalMarketNames(item) {
  if (item.skin?.startsWith('★')) {
    const finish = item.skin.slice(1).trim();
    if (finish.toLowerCase() === 'vanilla') {
      return [
        `★ ${item.weapon}`,
        ...(!isGlove(item.weapon) ? [`★ StatTrak™ ${item.weapon}`] : []),
      ];
    }
    return WEARS.flatMap(wear => [
      `★ ${item.weapon} | ${finish} (${wear})`,
      ...(!isGlove(item.weapon) ? [`★ StatTrak™ ${item.weapon} | ${finish} (${wear})`] : []),
    ]);
  }
  return WEARS.flatMap(wear => [
    `${item.weapon} | ${item.skin} (${wear})`,
    `StatTrak™ ${item.weapon} | ${item.skin} (${wear})`,
  ]);
}

function souvenirMarketNames(item) {
  return WEARS.map(wear => `Souvenir ${item.weapon} | ${item.skin} (${wear})`);
}

function steamUrl(hashName) {
  const params = new URLSearchParams({ appid: '730', currency: '1', country: 'US', market_hash_name: hashName });
  return `${STEAM_URL}?${params}`;
}

function parseUsd(value) {
  if (typeof value !== 'string') return null;
  const parsed = Number.parseFloat(value.replace(/[^0-9.]/g, ''));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

async function fetchSteamPrice(hashName, attempts = 4) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(steamUrl(hashName), {
        headers: { 'user-agent': 'curl/8.7.1' },
        signal: AbortSignal.timeout(10000),
      });
      if (response.ok) {
        const data = await response.json();
        const price = data.success ? parseUsd(data.lowest_price ?? data.median_price) : null;
        return price ? { price, count: null, updated_at: new Date().toISOString(), source: 'steam-direct' } : null;
      }
      if (![429, 500, 502, 503].includes(response.status)) return null;
    } catch (error) {
      if (attempt === attempts) console.warn(`${hashName}: ${error.message}`);
    }
    await delay(attempt * 2000);
  }
  return null;
}

function escapeCell(value) {
  return String(value ?? '').replaceAll('\\', '\\\\').replaceAll('|', '\\|').replaceAll('\n', ' ');
}

const args = parseArgs(process.argv.slice(2));
const [bulk, caseData, souvenirData, armoryData] = await Promise.all([
  readJson(args.source),
  readFile('public/data/cases.json', 'utf8').then(JSON.parse),
  readFile('public/data/souvenirs.json', 'utf8').then(JSON.parse),
  readFile('public/data/armory.json', 'utf8').then(JSON.parse),
]);
const bulkItems = bulk.data?.items ?? bulk.items ?? bulk;
if (!Array.isArray(bulkItems)) throw new Error('Unexpected bulk Steam price response');

const quotes = new Map();
for (const item of bulkItems) {
  const quote = priceFor(item);
  if (item.market_hash_name && quote?.price > 0) {
    quotes.set(item.market_hash_name, {
      price: quote.price,
      count: quote.count ?? null,
      updated_at: quote.updated_at ?? bulk.fetched_at ?? null,
      source: 'steam-bulk',
    });
  }
}

const normalItems = new Map();
for (const entry of caseData.cases) {
  for (const item of Object.values(entry.items ?? {}).flat()) normalItems.set(skinKey(item), item);
}
for (const entry of armoryData.cases) {
  for (const item of Object.values(entry.items ?? {}).flat()) normalItems.set(skinKey(item), item);
}
normalItems.set('M4A4 | Howl', { weapon: 'M4A4', skin: 'Howl' });
const souvenirItems = new Map();
for (const entry of souvenirData.cases) {
  for (const item of Object.values(entry.items ?? {}).flat()) souvenirItems.set(skinKey(item), item);
}

const containers = [...caseData.cases, ...souvenirData.cases];
const relevantNames = new Set(containers.map(entry => entry.name));
for (const item of normalItems.values()) normalMarketNames(item).forEach(name => relevantNames.add(name));
for (const item of souvenirItems.values()) souvenirMarketNames(item).forEach(name => relevantNames.add(name));

let cache = {};
try {
  cache = JSON.parse(await readFile(CACHE, 'utf8'));
} catch { /* Missing on the first run. */ }
for (const [name, quote] of Object.entries(cache)) {
  if (quote?.price > 0) quotes.set(name, quote);
}

// Always refresh the small container set. For skins, query Steam directly only
// when the bulk Steam snapshot has no variant for that catalogue family.
const refreshNames = new Set([
  ...caseData.cases.map(entry => entry.name),
  ...PRIORITY_DIRECT_NAMES,
]);
for (const item of normalItems.values()) {
  const names = normalMarketNames(item);
  if (!names.some(name => quotes.has(name))) names.forEach(name => refreshNames.add(name));
}
for (const item of souvenirItems.values()) {
  const names = souvenirMarketNames(item);
  if (!names.some(name => quotes.has(name))) names.forEach(name => refreshNames.add(name));
}

let completed = 0;
const pendingNames = args.skipDirect ? [] : [...refreshNames];
async function runWorker() {
  while (pendingNames.length) {
    const name = pendingNames.shift();
    const cacheHit = name in cache && cache[name] !== null;
    if (!cacheHit) cache[name] = await fetchSteamPrice(name);
    if (cache[name]) quotes.set(name, cache[name]);
    completed++;
    if (completed % 10 === 0) {
      await writeFile(CACHE, JSON.stringify(cache));
      console.log(`Steam direct checks: ${completed} / ${refreshNames.size}`);
    }
    if (!cacheHit) await delay(250);
  }
}
await Promise.all(Array.from({ length: 4 }, () => runWorker()));
await writeFile(CACHE, JSON.stringify(cache));

const rows = [...relevantNames]
  .map(name => ({ name, ...quotes.get(name) }))
  .filter(row => row.price > 0)
  .sort((a, b) => a.name.localeCompare(b.name, 'en-US'));
const verifiedAt = new Date().toISOString();
const lines = [
  '# Steam Skin and Case Price Reference',
  '',
  '> Canonical price input for weapon skins, souvenir skins, weapon cases, and terminals used by the simulator.',
  `> Bulk source: [Skinstrack Steam-only snapshot](${BULK_URL}).`,
  '> Direct checks: Steam Community Market priceoverview, lowest sell listing in USD.',
  '> Prices are snapshots and are refreshed from Steam at runtime when an item is visible.',
  `> Bulk snapshot: ${bulk.fetched_at ?? 'unknown'}.`,
  `> Verified at: ${verifiedAt}.`,
  '',
  `Priced market variants: ${rows.length}. Directly refreshed entries: ${[...refreshNames].filter(name => cache[name]).length}.`,
  '',
  '| Market hash name | Steam price (USD) | Listings | Updated at | Source |',
  '| --- | ---: | ---: | --- | --- |',
];
for (const row of rows) {
  lines.push(
    `| ${escapeCell(row.name)} | ${row.price.toFixed(2)} | ${row.count ?? '—'} | `
    + `${escapeCell(row.updated_at ?? '—')} | ${row.source} |`,
  );
}
lines.push('');

await writeFile(OUTPUT, `${lines.join('\n')}\n`);
console.log(`Wrote ${rows.length} Steam prices to ${OUTPUT}`);
