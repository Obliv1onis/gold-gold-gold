#!/usr/bin/env node

import { readFile } from 'node:fs/promises';

const PATHS = {
  cases: 'public/data/cases.json',
  capsules: 'public/data/capsules.json',
  souvenirs: 'public/data/souvenirs.json',
  others: 'public/data/others.json',
  market: 'public/data/market-items.json',
  steamPrices: 'public/data/steam-prices.json',
  armory: 'public/data/armory.json',
};

const EXPECTED_COUNTS = {
  weapon_case: 42,
  terminal: 2,
  sticker_capsule: 122,
  souvenir_package: 150,
  other: 26,
};

const REQUIRED_CASE_ITEMS = {
  gallery_case: ['M4A1-S | Vaporwave', 'Glock-18 | Gold Toof'],
  terminal_genesis: ['AK-47 | The Oligarch', 'M4A4 | Full Throttle'],
  terminal_dead_hand: ["AWP | Queen's Gambit", 'Glock-18 | Fully Tuned'],
  revolution_case: ['AWP | Duality'],
  dreams_nightmares_case: ['Butterfly Knife | Bright Water', 'Bowie Knife | Gamma Doppler'],
};

const REQUIRED_CONTAINERS = [
  'Jackass Sticker Capsule',
  'Warhammer 40,000 Xenos Sticker Capsule',
  'Warhammer 40,000 Imperium Sticker Capsule',
  'Warhammer 40,000 Adeptus Astartes Sticker Capsule',
  'Warhammer 40,000 Traitor Astartes Sticker Capsule',
  'Masterminds 2 Music Kit Box',
  'StatTrak™ Masterminds 2 Music Kit Box',
  'Half-Life: Alyx Collectible Pins Capsule',
  'Stockholm 2021 Legends Patch Pack',
  'Stockholm 2021 Challengers Patch Pack',
  'Stockholm 2021 Contenders Patch Pack',
  'Budapest 2025 Inferno Souvenir Package',
  'Budapest 2025 Mirage Souvenir Package',
  'Budapest 2025 Overpass Souvenir Package',
  'Budapest 2025 Dust II Souvenir Package',
  'Budapest 2025 Ancient Souvenir Package',
  'Budapest 2025 Nuke Souvenir Package',
  'Budapest 2025 Train Souvenir Package',
];

const [caseData, capsuleData, souvenirData, otherData, marketData, steamPriceData, armoryData] = await Promise.all(
  Object.values(PATHS).map(path => readFile(path, 'utf8').then(JSON.parse)),
);

const errors = [];
const counts = {};

function auditContainerIds(entries, label) {
  const ids = new Set();
  for (const entry of entries) {
    if (!entry.id || !entry.name) errors.push(`${label}: container missing id or name`);
    if (!entry.image_url) errors.push(`${entry.id}: container image is missing`);
    if (ids.has(entry.id)) errors.push(`${label}: duplicate container id ${entry.id}`);
    ids.add(entry.id);
  }
}

function auditWeightedPools(entries, poolKey, label) {
  for (const entry of entries) {
    const weights = entry.rarity_weights ?? {};
    const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
    if (Math.abs(total - 100) > 0.01) {
      errors.push(`${entry.id}: rarity weights total ${total.toFixed(4)}`);
    }

    const itemIds = new Set();
    for (const [tier, items] of Object.entries(entry[poolKey] ?? {})) {
      if ((weights[tier] ?? 0) > 0 && items.length === 0) {
        errors.push(`${entry.id}: weighted tier ${tier} is empty`);
      }
      for (const item of items) {
        if (!item.image_url) errors.push(`${entry.id}: item image is missing in ${tier}`);
        if (poolKey === 'items' && (!item.item_id || !item.weapon || !item.skin)) {
          errors.push(`${entry.id}: incomplete item in ${tier}`);
        }
        if (poolKey === 'tiers' && (!item.name || !item.market_hash_name)) {
          errors.push(`${entry.id}: incomplete item in ${tier}`);
        }
        const identity = item.item_id ?? item.market_hash_name;
        if (identity && itemIds.has(identity)) errors.push(`${entry.id}: duplicate item ${identity}`);
        if (identity) itemIds.add(identity);
      }
    }

    for (const [tier, weight] of Object.entries(weights)) {
      if (weight > 0 && !(entry[poolKey]?.[tier]?.length > 0)) {
        errors.push(`${entry.id}: weighted tier ${tier} is missing`);
      }
    }
  }
}

const cases = caseData.cases ?? [];
const capsules = capsuleData.capsules ?? [];
const souvenirs = souvenirData.cases ?? [];
const others = otherData.capsules ?? [];
const marketItems = marketData.items ?? [];
const steamPrices = steamPriceData.prices ?? {};
const armory = armoryData.cases ?? [];
if (!marketData.catalog?.price_source?.includes('Steam Community Market')) {
  errors.push('Standalone market catalogue must use Steam Community Market prices');
}
if (caseData.catalog?.price_source !== 'Steam Community Market') {
  errors.push('Case catalogue must use Steam Community Market prices');
}
if (souvenirData.catalog?.price_source !== 'Steam Community Market') {
  errors.push('Souvenir catalogue must use Steam Community Market prices');
}
if (armoryData.catalog?.price_source !== 'Steam Community Market') {
  errors.push('Armory catalogue must use Steam Community Market item prices');
}
if (Object.keys(steamPrices).length < 10000) {
  errors.push(`Expected at least 10000 Steam skin prices, found ${Object.keys(steamPrices).length}`);
}

for (const entry of [...cases, ...souvenirs, ...armory]) {
  if (!(entry.market_price > 0)) errors.push(`${entry.name}: container price is missing or invalid`);
  if (steamPrices[entry.name] && entry.market_price !== steamPrices[entry.name].price) {
    errors.push(`${entry.name}: container price is not synchronized with Steam reference`);
  }
  for (const item of Object.values(entry.items ?? {}).flat()) {
    if (!(item.market_price > 0)) errors.push(`${item.item_id}: item price is missing or invalid`);
    if (!Object.keys(item.market_prices ?? {}).length) errors.push(`${item.item_id}: variant prices are missing`);
    for (const [group, variants] of Object.entries(item.market_prices ?? {})) {
      for (const [wear, price] of Object.entries(variants)) {
        if (!(price > 0)) errors.push(`${item.item_id}: invalid ${group}/${wear} Steam price`);
      }
    }
  }
}

for (const entry of [...capsules, ...others]) {
  if (!(entry.price > 0)) errors.push(`${entry.name}: container price is missing or invalid`);
  for (const item of Object.values(entry.tiers ?? {}).flat()) {
    if (!(item.market_price > 0)) errors.push(`${item.market_hash_name}: item price is missing or invalid`);
  }
}

auditContainerIds([...cases, ...souvenirs, ...armory], 'case catalogue');
auditContainerIds([...capsules, ...others], 'capsule catalogue');
auditWeightedPools(cases, 'items', 'cases');
auditWeightedPools(souvenirs, 'items', 'souvenirs');
auditWeightedPools(armory, 'items', 'armory');
auditWeightedPools(capsules, 'tiers', 'capsules');
auditWeightedPools(others, 'tiers', 'others');

for (const entry of cases) counts[entry.type] = (counts[entry.type] ?? 0) + 1;
counts.sticker_capsule = capsules.filter(entry => (entry.type ?? 'sticker_capsule') === 'sticker_capsule').length;
counts.souvenir_package = souvenirs.length;
counts.other = others.length;

for (const [type, expected] of Object.entries(EXPECTED_COUNTS)) {
  if (counts[type] !== expected) errors.push(`Expected ${expected} ${type} entries, found ${counts[type] ?? 0}`);
}

for (const [id, expectedNames] of Object.entries(REQUIRED_CASE_ITEMS)) {
  const entry = cases.find(item => item.id === id);
  if (!entry) {
    errors.push(`Missing required container: ${id}`);
    continue;
  }
  const names = new Set(Object.values(entry.items).flat().map(item => `${item.weapon} | ${item.skin.replace(/^★\s*/, '')}`));
  for (const name of expectedNames) {
    if (!names.has(name)) errors.push(`${id}: missing ${name}`);
  }
}

const containerNames = new Set([...capsules, ...souvenirs, ...others].map(entry => entry.name));
for (const name of REQUIRED_CONTAINERS) {
  if (!containerNames.has(name)) errors.push(`Missing required container: ${name}`);
}

const forbiddenCologneContainers = [...capsules, ...souvenirs]
  .filter(entry => /Cologne 2026/i.test(entry.name));
if (forbiddenCologneContainers.length) {
  errors.push('Cologne 2026 must not be modelled as a capsule or traditional souvenir package');
}

const marketStickers = marketItems.filter(item => item.capsuleType === 'sticker_capsule');
const marketMusicKits = marketItems.filter(item => item.capsuleType === 'music_kit_box');
if (marketStickers.length !== 1371) errors.push(`Expected 1371 Cologne 2026 market stickers, found ${marketStickers.length}`);
if (marketMusicKits.length !== 90) errors.push(`Expected 90 direct music-kit variants, found ${marketMusicKits.length}`);
const marketNames = new Set();
for (const item of marketItems) {
  if (!item.id || !item.market_hash_name || !item.image_url) errors.push('Incomplete standalone market item');
  if (item.capsuleType === 'sticker_capsule' && !item.market_hash_name.endsWith('| Cologne 2026')) {
    errors.push(`Unexpected standalone sticker: ${item.market_hash_name}`);
  }
  if (item.capsuleType === 'music_kit_box' && !/^(?:StatTrak™\s+)?Music Kit \|/.test(item.market_hash_name)) {
    errors.push(`Unexpected standalone music kit: ${item.market_hash_name}`);
  }
  if (!['sticker_capsule', 'music_kit_box'].includes(item.capsuleType)) {
    errors.push(`Unsupported standalone market category: ${item.capsuleType}`);
  }
  if (!['high_grade', 'remarkable', 'exotic', 'extraordinary'].includes(item.rarity)) {
    errors.push(`${item.market_hash_name}: invalid rarity ${item.rarity}`);
  }
  if (item.price_source !== 'steam') errors.push(`${item.market_hash_name}: price source is not Steam`);
  if (!(item.market_price > 0)) {
    errors.push(`${item.market_hash_name}: invalid Steam market price`);
  }
  if (marketNames.has(item.market_hash_name)) errors.push(`Duplicate standalone market item: ${item.market_hash_name}`);
  marketNames.add(item.market_hash_name);
}
for (const name of [
  'Music Kit | The Verkkars, EZ4ENCE',
  'StatTrak™ Music Kit | The Verkkars, EZ4ENCE',
  'Music Kit | ALRT, DOPAMINE HIT',
  'StatTrak™ Music Kit | ALRT, DOPAMINE HIT',
]) {
  if (!marketNames.has(name)) errors.push(`Missing direct music kit: ${name}`);
}

if (errors.length) {
  console.error(`Catalogue audit failed (${errors.length}):\n- ${errors.join('\n- ')}`);
  process.exitCode = 1;
} else {
  console.log(
    `Catalogue audit passed: ${counts.weapon_case} weapon cases, ${counts.terminal} terminals, `
    + `${armoryData.catalog.collections} Armory collections, ${armoryData.catalog.limited_editions} limited editions, `
    + `${counts.souvenir_package} souvenir packages, ${counts.sticker_capsule} sticker capsules, `
    + `${counts.other} other containers, ${marketStickers.length} standalone stickers, `
    + `${marketMusicKits.length} direct music-kit variants.`,
  );
}
