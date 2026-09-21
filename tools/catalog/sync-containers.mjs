#!/usr/bin/env node

/**
 * Synchronise sticker capsules, souvenir packages, patch/pin capsules, and
 * music-kit boxes with ByMykel's crates catalogue.
 *
 * Cologne 2026 is intentionally excluded: Valve replaced capsules and
 * traditional souvenir packages with direct sticker purchases and crafted
 * souvenirs for that Major.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getMusicKitPreviewId } from '../../src/foundation/music-kit-previews.js';

const API_URL = 'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/crates.json';
const PATHS = {
  capsules: resolve('public/data/capsules.json'),
  souvenirs: resolve('public/data/souvenirs.json'),
  others: resolve('public/data/others.json'),
};

const TIER_MAP = {
  rarity_rare: 'high_grade',
  rarity_mythical: 'remarkable',
  rarity_legendary: 'exotic',
  rarity_ancient: 'extraordinary',
};

const SKIN_RARITY_MAP = {
  rarity_common_weapon: 'consumer_grade',
  rarity_uncommon_weapon: 'industrial_grade',
  rarity_rare_weapon: 'mil_spec',
  rarity_mythical_weapon: 'restricted',
  rarity_legendary_weapon: 'classified',
  rarity_ancient_weapon: 'covert',
};

const CAPSULE_BASE_WEIGHTS = {
  high_grade: 80.13,
  remarkable: 16.02,
  exotic: 3.21,
  extraordinary: 0.64,
};

const SOUVENIR_BASE_WEIGHTS = {
  consumer_grade: 79.9248,
  industrial_grade: 15.9830,
  mil_spec: 3.1968,
  restricted: 0.6394,
  classified: 0.1277,
  covert: 0.0255,
};

const CAPSULE_ADDITIONS = new Set([
  'Jackass Sticker Capsule',
  'Warhammer 40,000 Xenos Sticker Capsule',
  'Warhammer 40,000 Imperium Sticker Capsule',
  'Warhammer 40,000 Adeptus Astartes Sticker Capsule',
  'Warhammer 40,000 Traitor Astartes Sticker Capsule',
]);

function parseArgs(argv) {
  const args = { source: null, write: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--source') args.source = argv[++i];
    else if (argv[i] === '--write') args.write = true;
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  return args;
}

function normalize(value) {
  return value.normalize('NFKD').replace(/[’]/g, "'").replace(/\s+/g, ' ').trim().toLowerCase();
}

function slug(value) {
  return normalize(value)
    .replace(/[™®]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function normalizeDate(value) {
  if (!value) return null;
  const parts = value.split(/[-/]/).map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
  return `${parts[0].toString().padStart(4, '0')}-${parts[1].toString().padStart(2, '0')}-${parts[2].toString().padStart(2, '0')}`;
}

function normalizedWeights(baseWeights, presentTiers) {
  const entries = Object.entries(baseWeights).filter(([tier]) => presentTiers.has(tier));
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  const result = Object.fromEntries(entries.map(([tier, weight]) => [tier, Number((weight / total * 100).toFixed(4))]));
  const first = entries[0]?.[0];
  if (first) result[first] = Number((result[first] + 100 - Object.values(result).reduce((a, b) => a + b, 0)).toFixed(4));
  return result;
}

function existingItemMap(entry) {
  return new Map(
    Object.values(entry?.tiers ?? entry?.items ?? {})
      .flat()
      .map(item => [normalize(item.name ?? `${item.weapon} | ${item.skin}`), item]),
  );
}

function capsuleContainerKey(name) {
  const aliases = {
    'CS:GO Perfect World Sticker Capsule 1': 'Perfect World Sticker Capsule 1',
    'CS:GO Perfect World Sticker Capsule 2': 'Perfect World Sticker Capsule 2',
    'Berlin 2019 Attending Challengers Sticker Capsule': 'Berlin 2019 Returning Challengers (Holo/Foil)',
    'Berlin 2019 Minor Challengers Sticker Capsule': 'Berlin 2019 Minor Challengers (Holo/Foil)',
    'Cologne 2014 Legends Sticker Capsule': 'ESL One Cologne 2014 Legends',
    'Cologne 2014 Challengers Sticker Capsule': 'ESL One Cologne 2014 Challengers',
    'EMS One Katowice 2014 Legends': 'EMS Katowice 2014 Legends',
    'EMS One Katowice 2014 Challengers': 'EMS Katowice 2014 Challengers',
    'Berlin 2019 Attending Challengers Autograph Capsule': 'Berlin 2019 Returning Challengers Autograph Capsule',
  };
  return aliases[name] ?? name;
}

function catalogueSummary(entries, poolKey) {
  const items = entries.reduce(
    (sum, entry) => sum + Object.values(entry[poolKey] ?? {}).flat().length,
    0,
  );
  const missingImages = entries.reduce(
    (sum, entry) => sum + Object.values(entry[poolKey] ?? {}).flat().filter(item => !item.image_url).length,
    0,
  );
  return { containers: entries.length, items, missing_images: missingImages };
}

function syncCapsule(crate, existing, type = 'sticker_capsule') {
  const oldItems = existingItemMap(existing);
  const tiers = {};
  for (const source of crate.contains ?? []) {
    const tier = TIER_MAP[source.rarity?.id];
    if (!tier) continue;
    const old = oldItems.get(normalize(source.name));
    (tiers[tier] ??= []).push({
      name: source.name,
      market_hash_name: source.name.startsWith('Sticker |') ? source.name : `Sticker | ${source.name}`,
      image_url: source.image ?? old?.image_url ?? null,
      market_price: old?.market_price ?? 0.10,
    });
  }

  return {
    ...existing,
    id: existing?.id ?? slug(crate.name),
    name: crate.name,
    type,
    release_date: normalizeDate(crate.first_sale_date) ?? existing?.release_date ?? null,
    price: existing?.price ?? 0.99,
    image_url: crate.image ?? existing?.image_url ?? null,
    rarity_weights: normalizedWeights(CAPSULE_BASE_WEIGHTS, new Set(Object.keys(tiers))),
    tiers,
  };
}

function syncOther(crate, existing) {
  const type = crate.type === 'Music Kit Box' ? 'music_kit_box'
    : crate.type === 'Patch Capsule' ? 'patch_pack'
      : 'pin_capsule';
  const oldMusicItems = existingItemMap(existing);
  const entry = syncCapsule(crate, existing, type);

  for (const items of Object.values(entry.tiers)) {
    for (const item of items) {
      item.market_hash_name = item.name;
      if (type === 'music_kit_box') {
        item.youtube_id = getMusicKitPreviewId(item.name)
          || oldMusicItems.get(normalize(item.name))?.youtube_id
          || undefined;
      }
    }
  }
  return entry;
}

function otherContainerKey(name) {
  const aliases = {
    'Metal Skill Groups Patch Pack': 'Metal Skill Group Patch Collection',
    'Operation Riptide Patch Pack': 'Operation Riptide Patch Collection',
    'Nightwatch Music Kit Box': 'NIGHTMODE Music Kit Box',
    'StatTrak™ Nightwatch Music Kit Box': 'StatTrak™ NIGHTMODE Music Kit Box',
    'Initiation Music Kit Box': 'Initiators Music Kit Box',
    'StatTrak™ Initiation Music Kit Box': 'StatTrak™ Initiators Music Kit Box',
    'StatTrak™ Radicals Music Kit Box': 'StatTrak™ Radicals Box',
  };
  return aliases[name] ?? name;
}

function splitSkinName(name) {
  const separator = name.indexOf(' | ');
  return separator < 0
    ? { weapon: name, skin: 'Vanilla' }
    : { weapon: name.slice(0, separator), skin: name.slice(separator + 3) };
}

function souvenirKey(name) {
  return name
    .replace(/^DreamHack Winter 2014 /, 'DreamHack 2014 ')
    .replace(/^ESL One Cologne 2016 /, 'Cologne 2016 ')
    .replace(/^ELEAGUE Atlanta 2017 /, 'Atlanta 2017 ')
    .replace(/^PGL Krakow 2017 /, 'Krakow 2017 ')
    .replace(/^ELEAGUE Boston 2018 /, 'Boston 2018 ')
    .replace(/^FACEIT London 2018 /, 'London 2018 ')
    .replace(/^IEM Katowice 2019 /, 'Katowice 2019 ')
    .replace(/^StarLadder Berlin 2019 /, 'Berlin 2019 ')
    .replace(/^PGL Stockholm 2021 /, 'Stockholm 2021 ')
    .replace(/^PGL Antwerp 2022 /, 'Antwerp 2022 ')
    .replace(/^IEM Rio 2022 /, 'Rio 2022 ')
    .replace(/^BLAST\.tv Paris 2023 /, 'Paris 2023 ')
    .replace(/^PGL Copenhagen 2024 /, 'Copenhagen 2024 ')
    .replace(/^Perfect World Shanghai 2024 /, 'Shanghai 2024 ')
    .replace(/^BLAST Austin 2025 /, 'Austin 2025 ')
    .replace(/ (Inferno|Nuke|Mirage|Vertigo|Dust II|Train) (2018|2021|2023|2024) Souvenir Package$/, ' $1 Souvenir Package');
}

function syncSouvenir(crate, existing = null) {
  const oldItems = existingItemMap(existing);
  const items = {};
  for (const source of crate.contains ?? []) {
    const rarity = SKIN_RARITY_MAP[source.rarity?.id];
    if (!rarity) continue;
    const { weapon, skin } = splitSkinName(source.name);
    const old = oldItems.get(normalize(source.name));
    (items[rarity] ??= []).push({
      item_id: old?.item_id ?? `${slug(weapon)}_${slug(skin)}`,
      weapon,
      skin,
      image_url: source.image ?? old?.image_url ?? null,
      stattrak: false,
      market_price: old?.market_price ?? 0.50,
    });
  }

  return {
    ...existing,
    id: existing?.id ?? slug(crate.name),
    name: existing?.name ?? crate.name,
    release_date: normalizeDate(crate.first_sale_date) ?? existing?.release_date ?? null,
    type: 'souvenir_package',
    market_price: existing?.market_price ?? 3.50,
    image_url: crate.image ?? existing?.image_url ?? null,
    rarity_weights: normalizedWeights(SOUVENIR_BASE_WEIGHTS, new Set(Object.keys(items))),
    items,
  };
}

async function loadUpstream(source) {
  if (source) return JSON.parse(await readFile(resolve(source), 'utf8'));
  const response = await fetch(API_URL, { headers: { 'user-agent': 'cs2-case-sim catalog sync' } });
  if (!response.ok) throw new Error(`Catalogue request failed with HTTP ${response.status}`);
  return response.json();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const upstream = await loadUpstream(args.source);
  const [capsuleData, souvenirData, otherData] = await Promise.all([
    readFile(PATHS.capsules, 'utf8').then(JSON.parse),
    readFile(PATHS.souvenirs, 'utf8').then(JSON.parse),
    readFile(PATHS.others, 'utf8').then(JSON.parse),
  ]);
  const upstreamByName = new Map(upstream.map(entry => [entry.name, entry]));

  const capsuleNames = new Set(capsuleData.capsules.map(entry => entry.name));
  capsuleData.capsules = capsuleData.capsules.map(existing => {
    const crate = upstreamByName.get(capsuleContainerKey(existing.name));
    return crate && ['Sticker Capsule', 'Autograph Capsule'].includes(crate.type)
      ? syncCapsule(crate, existing)
      : existing;
  });
  for (const name of CAPSULE_ADDITIONS) {
    if (!capsuleNames.has(name) && upstreamByName.has(name)) {
      capsuleData.capsules.unshift(syncCapsule(upstreamByName.get(name)));
    }
  }
  capsuleData.catalog = {
    source: API_URL,
    verified_on: new Date().toISOString().slice(0, 10),
    ...catalogueSummary(capsuleData.capsules, 'tiers'),
  };

  const existingSouvenirs = new Map(souvenirData.cases.map(entry => [souvenirKey(entry.name), entry]));
  souvenirData.cases = upstream
    .filter(entry => entry.type === 'Souvenir' && !/Cologne 2026/i.test(entry.name))
    .map(crate => syncSouvenir(crate, existingSouvenirs.get(crate.name)));
  souvenirData.catalog = {
    source: API_URL,
    verified_on: new Date().toISOString().slice(0, 10),
    ...catalogueSummary(souvenirData.cases, 'items'),
  };

  const charms = otherData.capsules.filter(entry => entry.type === 'charm_capsule');
  const existingOthers = new Map(otherData.capsules.map(entry => [otherContainerKey(entry.name), entry]));
  const officialOthers = upstream
    .filter(entry => ['Music Kit Box', 'Patch Capsule', 'Pins'].includes(entry.type))
    .map(crate => syncOther(crate, existingOthers.get(crate.name)));
  otherData.capsules = [...charms, ...officialOthers];
  otherData.catalog = {
    source: API_URL,
    verified_on: new Date().toISOString().slice(0, 10),
    ...catalogueSummary(otherData.capsules, 'tiers'),
  };

  const summary = `${capsuleData.capsules.length} capsules, ${souvenirData.cases.length} souvenirs, ${otherData.capsules.length} other containers`;
  if (!args.write) {
    console.log(`Dry run: ${summary}. Pass --write to update the catalogues.`);
    return;
  }

  await Promise.all([
    writeFile(PATHS.capsules, `${JSON.stringify(capsuleData, null, 2)}\n`),
    writeFile(PATHS.souvenirs, `${JSON.stringify(souvenirData, null, 2)}\n`),
    writeFile(PATHS.others, `${JSON.stringify(otherData, null, 2)}\n`),
  ]);
  console.log(`Updated catalogues: ${summary}.`);
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
