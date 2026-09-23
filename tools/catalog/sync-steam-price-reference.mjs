#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const REFERENCE = resolve('design/reference/skin-price.md');
const FALLBACK_REFERENCE = resolve('design/reference/market-price-fallbacks.json');
const CASES = resolve('public/data/cases.json');
const SOUVENIRS = resolve('public/data/souvenirs.json');
const ARMORY = resolve('public/data/armory.json');
const OUTPUT = resolve('public/data/steam-prices.json');
const WEAR_KEYS = new Map([
  ['Factory New', 'fn'],
  ['Minimal Wear', 'mw'],
  ['Field-Tested', 'ft'],
  ['Well-Worn', 'ww'],
  ['Battle-Scarred', 'bs'],
]);

function splitRow(line) {
  return line.slice(1, -1).split(/(?<!\\)\|/).map(cell => cell.trim().replaceAll('\\|', '|').replaceAll('\\\\', '\\'));
}

function marketGroup(hashName) {
  if (hashName.startsWith('Souvenir ')) return 'souvenir';
  if (hashName.startsWith('StatTrak™ ') || hashName.startsWith('★ StatTrak™ ')) return 'stattrak';
  return 'normal';
}

function wearKey(hashName) {
  const wear = hashName.match(/\((Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)$/)?.[1];
  return WEAR_KEYS.get(wear) ?? 'vanilla';
}

function itemPrefix(item, group) {
  const special = item.skin?.startsWith('★');
  const finish = special ? item.skin.slice(1).trim() : item.skin;
  if (special && finish.toLowerCase() === 'vanilla') {
    return group === 'stattrak' ? `★ StatTrak™ ${item.weapon}` : `★ ${item.weapon}`;
  }
  if (special) return group === 'stattrak'
    ? `★ StatTrak™ ${item.weapon} | ${finish}`
    : `★ ${item.weapon} | ${finish}`;
  if (group === 'souvenir') return `Souvenir ${item.weapon} | ${item.skin}`;
  return group === 'stattrak'
    ? `StatTrak™ ${item.weapon} | ${item.skin}`
    : `${item.weapon} | ${item.skin}`;
}

function priceMapFor(item, groups, prices) {
  const result = {};
  for (const group of groups) {
    const prefix = itemPrefix(item, group);
    const variants = {};
    for (const [hashName, quote] of prices) {
      if (hashName === prefix || hashName.startsWith(`${prefix} (`)) variants[wearKey(hashName)] = quote.price;
    }
    if (Object.keys(variants).length) result[group] = variants;
  }
  return result;
}

function fallbackPrice(marketPrices, preferredGroup) {
  const variants = marketPrices[preferredGroup] ?? {};
  return variants.ft ?? variants.fn ?? variants.mw ?? variants.ww ?? variants.bs ?? variants.vanilla ?? null;
}

function skinKey(item) {
  return `${item.weapon} | ${item.skin}`;
}

function mergePriceMaps(fallback = {}, steam = {}) {
  const result = {};
  for (const group of new Set([...Object.keys(fallback), ...Object.keys(steam)])) {
    result[group] = { ...(fallback[group] ?? {}), ...(steam[group] ?? {}) };
  }
  return result;
}

function wearTiers(marketPrices) {
  const available = new Set(Object.values(marketPrices).flatMap(variants => Object.keys(variants)));
  return [...WEAR_KEYS.values()].filter(wear => available.has(wear));
}

function applyItemPrices(item, groups, prices, preferredGroup, fallbackData) {
  const fallback = fallbackData.items?.[skinKey(item)] ?? null;
  const marketPrices = mergePriceMaps(fallback?.market_prices, priceMapFor(item, groups, prices));
  if (!Object.keys(marketPrices).length) return false;

  item.market_prices = marketPrices;
  item.market_price = fallbackPrice(marketPrices, preferredGroup) ?? item.market_price;
  const tiers = wearTiers(marketPrices);
  if (tiers.length && tiers.length < WEAR_KEYS.size) item.wear_tiers = tiers;
  else delete item.wear_tiers;

  if (fallback) {
    item.price_basis = fallback.source;
    item.price_source_url = fallback.source_url;
    item.price_verified_at = fallbackData.verified_at;
  } else {
    delete item.price_basis;
    delete item.price_source_url;
    delete item.price_verified_at;
  }
  return !!fallback;
}

const args = new Set(process.argv.slice(2));
if ([...args].some(arg => arg !== '--write')) throw new Error(`Unknown argument: ${[...args][0]}`);
const [markdown, fallbackData, caseData, souvenirData, armoryData] = await Promise.all([
  readFile(REFERENCE, 'utf8'),
  readFile(FALLBACK_REFERENCE, 'utf8').then(JSON.parse),
  readFile(CASES, 'utf8').then(JSON.parse),
  readFile(SOUVENIRS, 'utf8').then(JSON.parse),
  readFile(ARMORY, 'utf8').then(JSON.parse),
]);
const verifiedAt = markdown.match(/^> Verified at: (.+)\.$/m)?.[1] ?? null;
const bulkSnapshot = markdown.match(/^> Bulk snapshot: (.+)\.$/m)?.[1] ?? null;
const prices = new Map(markdown.split('\n')
  .filter(line => /^\| (?!---|Market hash name)/.test(line))
  .map(splitRow)
  .map(([marketHashName, price, listings, updatedAt, source]) => [marketHashName, {
    price: Number(price),
    listings: listings === '—' ? null : Number(listings),
    updated_at: updatedAt === '—' ? null : updatedAt,
    source,
  }]));
if (!prices.size) throw new Error(`No Steam price rows found in ${REFERENCE}`);

let fallbackItems = 0;

for (const entry of caseData.cases) {
  const containerQuote = prices.get(entry.name);
  if (containerQuote) entry.market_price = containerQuote.price;
  for (const items of Object.values(entry.items ?? {})) {
    for (const item of items) {
      if (applyItemPrices(item, ['normal', 'stattrak'], prices, 'normal', fallbackData)) fallbackItems++;
    }
  }
}

for (const entry of souvenirData.cases) {
  const containerQuote = prices.get(entry.name);
  if (containerQuote) entry.market_price = containerQuote.price;
  for (const items of Object.values(entry.items ?? {})) {
    for (const item of items) {
      if (applyItemPrices(item, ['souvenir'], prices, 'souvenir', fallbackData)) fallbackItems++;
    }
  }
}

for (const entry of armoryData.cases) {
  for (const items of Object.values(entry.items ?? {})) {
    for (const item of items) {
      if (applyItemPrices(item, ['normal', 'stattrak'], prices, 'normal', fallbackData)) fallbackItems++;
    }
  }
}

caseData.catalog.price_source = 'Steam Community Market';
caseData.catalog.price_verified_at = verifiedAt;
caseData.catalog.fallback_price_reference = 'design/reference/market-price-fallbacks.json';
souvenirData.catalog.price_source = 'Steam Community Market';
souvenirData.catalog.price_verified_at = verifiedAt;
armoryData.catalog.price_source = 'Steam Community Market';
armoryData.catalog.price_verified_at = verifiedAt;
souvenirData.catalog.fallback_price_reference = 'design/reference/market-price-fallbacks.json';

const output = {
  format_version: '1.0',
  catalog: {
    source_reference: 'design/reference/skin-price.md',
    price_source: 'Steam Community Market',
    bulk_snapshot: bulkSnapshot,
    verified_at: verifiedAt,
    items: prices.size,
  },
  prices: Object.fromEntries([...prices].map(([name, quote]) => [name, quote])),
};

if (!args.has('--write')) {
  console.log(`Dry run: ${prices.size} Steam prices. Pass --write to update catalogue data.`);
} else {
  await Promise.all([
    writeFile(CASES, `${JSON.stringify(caseData, null, 2)}\n`),
    writeFile(SOUVENIRS, `${JSON.stringify(souvenirData, null, 2)}\n`),
    writeFile(ARMORY, `${JSON.stringify(armoryData, null, 2)}\n`),
    writeFile(OUTPUT, `${JSON.stringify(output, null, 2)}\n`),
  ]);
    console.log(
      `Wrote ${prices.size} Steam prices and updated case/souvenir catalogues `
      + `(${fallbackItems} container-item rows used verified fallback quotes).`,
    );
}
