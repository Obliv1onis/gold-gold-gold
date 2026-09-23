#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const DEFAULT_SKINS = '/private/tmp/csgo-api-skins.json';
const DEFAULT_PRICES = '/private/tmp/skinstrack-free-prices.json';
const OUTPUT = resolve('public/data/armory.json');
const CASES = resolve('public/data/cases.json');
const PASS_IMAGE = '/assets/armory-pass.webp';
const CREDIT_USD = 15.99 / 40;
const WEAR_KEYS = new Map([
  ['Factory New', 'fn'],
  ['Minimal Wear', 'mw'],
  ['Field-Tested', 'ft'],
  ['Well-Worn', 'ww'],
  ['Battle-Scarred', 'bs'],
]);
const RARITIES = new Map([
  ['rarity_common_weapon', 'consumer_grade'],
  ['rarity_uncommon_weapon', 'industrial_grade'],
  ['rarity_rare_weapon', 'mil_spec'],
  ['rarity_mythical_weapon', 'restricted'],
  ['rarity_legendary_weapon', 'classified'],
  ['rarity_ancient_weapon', 'covert'],
]);
const COLLECTIONS = [
  { id: 'armory_graphic_design', name: 'The Graphic Design Collection', release_date: '2024-10-02', status: 'retired' },
  { id: 'armory_overpass_2024', name: 'The Overpass 2024 Collection', release_date: '2024-10-02', status: 'active' },
  { id: 'armory_sport_field', name: 'The Sport & Field Collection', release_date: '2024-10-02', status: 'retired' },
  { id: 'armory_train_2025', name: 'The Train 2025 Collection', release_date: '2025-03-31', status: 'retired' },
  { id: 'armory_spy_tech', name: 'The Spy Tech Collection', release_date: '2026-07-08', status: 'active' },
  { id: 'armory_arabesque', name: 'The Arabesque Collection', release_date: '2026-07-08', status: 'active' },
];
const LIMITED = [
  { id: 'armory_limited_heat_treated', name: 'Desert Eagle | Heat Treated', release_date: '2024-10-02', credits: 25, status: 'retired' },
  { id: 'armory_limited_xm1014_solitude', name: 'XM1014 | Solitude', release_date: '2025-03-31', credits: 15, status: 'retired' },
  { id: 'armory_limited_m4a1s_solitude', name: 'M4A1-S | Solitude', release_date: '2025-08-14', credits: 25, status: 'retired' },
  { id: 'armory_limited_ak47_aphrodite', name: 'AK-47 | Aphrodite', release_date: '2026-01-21', credits: 125, status: 'active' },
];
const ARMORY_CASES = [
  { id: 'gallery_case', credits: 2, release_date: '2024-10-02', status: 'retired' },
  { id: 'fever_case', credits: 2, release_date: '2025-03-31', status: 'active' },
];
const COLLECTION_WEIGHTS = {
  industrial_grade: 79.92,
  mil_spec: 15.98,
  restricted: 3.2,
  classified: 0.64,
  covert: 0.26,
};

function args(argv) {
  const parsed = { skins: DEFAULT_SKINS, prices: DEFAULT_PRICES, write: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--skins') parsed.skins = argv[++i];
    else if (argv[i] === '--prices') parsed.prices = argv[++i];
    else if (argv[i] === '--write') parsed.write = true;
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  return parsed;
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function steamQuotes(snapshot) {
  const rows = snapshot.data?.items ?? snapshot.items ?? snapshot;
  const result = new Map();
  for (const row of rows) {
    const quote = row.prices?.find(price => price.provider === 'steam');
    if (row.market_hash_name && quote?.price > 0) result.set(row.market_hash_name, quote.price);
  }
  return result;
}

function itemPrices(skin, prices) {
  const marketPrices = {};
  for (const wear of skin.wears ?? []) {
    const key = WEAR_KEYS.get(wear.name);
    if (!key) continue;
    const price = prices.get(`${skin.name} (${wear.name})`);
    if (price > 0) marketPrices[key] = price;
  }
  return marketPrices;
}

function preferredPrice(prices) {
  return prices.ft ?? prices.fn ?? prices.mw ?? prices.ww ?? prices.bs ?? null;
}

function makeItem(skin, entryId, prices, supportsStatTrak) {
  const normal = itemPrices(skin, prices);
  const stattrak = {};
  if (supportsStatTrak) {
    for (const wear of skin.wears ?? []) {
      const key = WEAR_KEYS.get(wear.name);
      if (!key) continue;
      const price = prices.get(`StatTrak™ ${skin.name} (${wear.name})`);
      if (price > 0) stattrak[key] = price;
    }
  }
  if (!Object.keys(normal).length) throw new Error(`No Steam Community Market price found for ${skin.name}`);
  const marketPrices = { normal };
  if (Object.keys(stattrak).length) marketPrices.stattrak = stattrak;
  return {
    weapon: skin.weapon.name,
    skin: skin.pattern.name,
    item_id: `${entryId}_${slug(skin.weapon.name)}_${slug(skin.pattern.name)}`,
    image_url: skin.image,
    market_price: preferredPrice(normal),
    stattrak: supportsStatTrak,
    market_prices: marketPrices,
    wear_tiers: [...WEAR_KEYS.values()].filter(key => key in normal),
  };
}

function emptyItems() {
  return Object.fromEntries([...RARITIES.values()].map(rarity => [rarity, []]));
}

const options = args(process.argv.slice(2));
const [skins, priceSnapshot, caseData] = await Promise.all([
  readFile(resolve(options.skins), 'utf8').then(JSON.parse),
  readFile(resolve(options.prices), 'utf8').then(JSON.parse),
  readFile(CASES, 'utf8').then(JSON.parse),
]);
const prices = steamQuotes(priceSnapshot);
const skinByName = new Map(skins.map(skin => [skin.name, skin]));
const armoryEntries = [];

for (const meta of COLLECTIONS) {
  const collectionSkins = skins.filter(skin => skin.collections?.some(collection => collection.name === meta.name));
  if (collectionSkins.length < 16) throw new Error(`${meta.name} is incomplete (${collectionSkins.length} skins)`);
  const items = emptyItems();
  for (const skin of collectionSkins) {
    const rarity = RARITIES.get(skin.rarity.id);
    if (!rarity) throw new Error(`Unknown rarity ${skin.rarity.id} for ${skin.name}`);
    items[rarity].push(makeItem(skin, meta.id, prices, false));
  }
  armoryEntries.push({
    ...meta,
    type: 'armory_collection',
    armory_kind: 'weapon_collection',
    credits: 4,
    image_url: PASS_IMAGE,
    market_price: Number((4 * CREDIT_USD).toFixed(2)),
    rarity_weights: { ...COLLECTION_WEIGHTS },
    items,
  });
}

for (const meta of LIMITED) {
  const skin = skinByName.get(meta.name);
  if (!skin) throw new Error(`Missing limited-edition skin ${meta.name}`);
  const rarity = RARITIES.get(skin.rarity.id);
  const items = emptyItems();
  items[rarity].push(makeItem(skin, meta.id, prices, false));
  armoryEntries.push({
    ...meta,
    type: 'armory_limited',
    armory_kind: 'limited_edition',
    image_url: PASS_IMAGE,
    market_price: Number((meta.credits * CREDIT_USD).toFixed(2)),
    rarity_weights: { [rarity]: 100 },
    items,
  });
}

for (const meta of ARMORY_CASES) {
  const entry = caseData.cases.find(item => item.id === meta.id);
  if (!entry) throw new Error(`Missing Armory case ${meta.id}`);
  Object.assign(entry, {
    armory: true,
    armory_kind: 'weapon_case',
    armory_status: meta.status,
    armory_credits: meta.credits,
    armory_image_url: PASS_IMAGE,
  });
}

const output = {
  format_version: '1.0',
  catalog: {
    source: 'ByMykel/CSGO-API',
    price_source: 'Steam Community Market',
    price_snapshot: priceSnapshot.fetched_at ?? null,
    verified_on: new Date().toLocaleDateString('en-CA'),
    collections: COLLECTIONS.length,
    limited_editions: LIMITED.length,
    weapon_cases: ARMORY_CASES.length,
    simulator_pass_price: 15.99,
    simulator_draws_per_pass: 10,
    items: armoryEntries.reduce((sum, entry) => sum + Object.values(entry.items).flat().length, 0),
    armory_case_ids: ARMORY_CASES.map(entry => entry.id),
  },
  cases: armoryEntries,
};

if (!options.write) {
  console.log(`Dry run: ${COLLECTIONS.length} collections, ${LIMITED.length} limited editions, ${output.catalog.items} skins.`);
} else {
  await Promise.all([
    writeFile(OUTPUT, `${JSON.stringify(output, null, 2)}\n`),
    writeFile(CASES, `${JSON.stringify(caseData, null, 2)}\n`),
  ]);
  console.log(`Wrote ${OUTPUT} with ${output.catalog.items} Steam-priced Armory skins.`);
}
