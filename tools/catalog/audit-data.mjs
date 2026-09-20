#!/usr/bin/env node

import { readFile } from 'node:fs/promises';

const PATHS = {
  cases: 'public/data/cases.json',
  capsules: 'public/data/capsules.json',
  souvenirs: 'public/data/souvenirs.json',
  others: 'public/data/others.json',
  market: 'public/data/market-items.json',
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

const [caseData, capsuleData, souvenirData, otherData, marketData] = await Promise.all(
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
if (!marketData.catalog?.price_source?.includes('Steam Community Market')) {
  errors.push('Standalone market catalogue must use Steam Community Market prices');
}

auditContainerIds([...cases, ...souvenirs], 'case catalogue');
auditContainerIds([...capsules, ...others], 'capsule catalogue');
auditWeightedPools(cases, 'items', 'cases');
auditWeightedPools(souvenirs, 'items', 'souvenirs');
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

if (marketItems.length !== 1371) {
  errors.push(`Expected 1371 Cologne 2026 market stickers, found ${marketItems.length}`);
}
const marketNames = new Set();
for (const item of marketItems) {
  if (!item.id || !item.market_hash_name || !item.image_url) errors.push('Incomplete standalone market item');
  if (!item.market_hash_name.endsWith('| Cologne 2026')) errors.push(`Unexpected standalone market item: ${item.market_hash_name}`);
  if (!['high_grade', 'remarkable', 'exotic', 'extraordinary'].includes(item.rarity)) {
    errors.push(`${item.market_hash_name}: invalid rarity ${item.rarity}`);
  }
  if (item.price_source !== 'steam') errors.push(`${item.market_hash_name}: price source is not Steam`);
  if (item.market_price !== null && !(item.market_price > 0)) {
    errors.push(`${item.market_hash_name}: invalid Steam market price`);
  }
  if (marketNames.has(item.market_hash_name)) errors.push(`Duplicate standalone market item: ${item.market_hash_name}`);
  marketNames.add(item.market_hash_name);
}

if (errors.length) {
  console.error(`Catalogue audit failed (${errors.length}):\n- ${errors.join('\n- ')}`);
  process.exitCode = 1;
} else {
  console.log(
    `Catalogue audit passed: ${counts.weapon_case} weapon cases, ${counts.terminal} terminals, `
    + `${counts.souvenir_package} souvenir packages, ${counts.sticker_capsule} sticker capsules, `
    + `${counts.other} other containers, ${marketItems.length} standalone market items.`,
  );
}
