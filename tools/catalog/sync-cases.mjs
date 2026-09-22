#!/usr/bin/env node

/**
 * Synchronise weapon-case and terminal contents with ByMykel's CS2 item API.
 *
 * The repository keeps prices locally, while the upstream catalogue is the
 * source of truth for container names, complete item pools, and images.
 *
 * Usage:
 *   node tools/catalog/sync-cases.mjs --source /path/to/crates.json --write
 *   node tools/catalog/sync-cases.mjs --source /path/to/crates.json --rare-only --write
 *   node tools/catalog/sync-cases.mjs --write
 */

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const API_URL = 'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/crates.json';
const DATA_PATH = resolve('public/data/cases.json');

const CASE_WEIGHTS = {
  mil_spec: 79.92,
  restricted: 15.98,
  classified: 3.20,
  covert: 0.64,
  rare_special: 0.26,
};

const GENESIS_WEIGHTS = {
  mil_spec: 80.13,
  restricted: 16.02,
  classified: 3.21,
  covert: 0.64,
};

const RARITY_MAP = {
  rarity_rare_weapon: 'mil_spec',
  rarity_mythical_weapon: 'restricted',
  rarity_legendary_weapon: 'classified',
  rarity_ancient_weapon: 'covert',
};

const FALLBACK_PRICE = {
  mil_spec: 0.10,
  restricted: 0.75,
  classified: 4.00,
  covert: 30.00,
  rare_special: 120.00,
};

const RELEASE_DATES = {
  'Sealed Dead Hand Terminal': '2026-03-11',
  'Sealed Genesis Terminal': '2025-09-17',
  'Fever Case': '2025-03-31',
  'Gallery Case': '2024-10-02',
  'Kilowatt Case': '2024-02-06',
  'Dreams & Nightmares Case': '2022-01-20',
};

const IDS = {
  'Sealed Dead Hand Terminal': 'terminal_dead_hand',
  'Sealed Genesis Terminal': 'terminal_genesis',
  'Gallery Case': 'gallery_case',
};

const TERMINALS = new Set(['Sealed Genesis Terminal', 'Sealed Dead Hand Terminal']);

function parseArgs(argv) {
  const args = { source: null, write: false, rareOnly: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--source') args.source = argv[++i];
    else if (argv[i] === '--write') args.write = true;
    else if (argv[i] === '--rare-only') args.rareOnly = true;
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  return args;
}

function normalize(value) {
  return value
    .normalize('NFKD')
    .replace(/[’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function slug(value) {
  return normalize(value)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function splitName(name, rareSpecial = false) {
  const clean = name.replace(/^★\s*/, '');
  const separator = clean.indexOf(' | ');
  if (separator < 0) {
    return { weapon: clean, skin: rareSpecial ? '★ Vanilla' : 'Vanilla' };
  }
  return {
    weapon: clean.slice(0, separator),
    skin: `${rareSpecial ? '★ ' : ''}${clean.slice(separator + 3)}`,
  };
}

function itemKey({ weapon, skin }) {
  return normalize(`${weapon} | ${skin}`);
}

function buildItems(apiItems, caseId, existingItems, rarity, rareSpecial = false) {
  const existingByName = new Map(existingItems.map(item => [itemKey(item), item]));

  return apiItems.map(apiItem => {
    const parsed = splitName(apiItem.name, rareSpecial);
    const exact = existingByName.get(itemKey(parsed));

    return {
      ...exact,
      weapon: parsed.weapon,
      skin: parsed.skin,
      item_id: exact?.item_id ?? `${caseId}_${slug(parsed.weapon)}_${slug(parsed.skin)}`,
      image_url: exact?.image_url ?? apiItem.image ?? null,
      market_price: exact?.market_price ?? FALLBACK_PRICE[rarity],
      stattrak: exact?.stattrak ?? false,
    };
  });
}

function compactRareItems(items = []) {
  const byName = new Map();
  for (const item of items) {
    if (!byName.has(item.name) || item.phase === 'Phase 1') byName.set(item.name, item);
  }
  return [...byName.values()];
}

function mergeInExistingOrder(existingItems, syncedItems) {
  const syncedByName = new Map(syncedItems.map(item => [itemKey(item), item]));
  const merged = [];
  const used = new Set();
  for (const item of existingItems) {
    const key = itemKey(item);
    if (!syncedByName.has(key) || used.has(key)) continue;
    merged.push(item);
    used.add(key);
  }
  for (const item of syncedItems) {
    const key = itemKey(item);
    if (used.has(key)) continue;
    merged.push(item);
    used.add(key);
  }
  return merged;
}

function groupedNormalItems(crate) {
  const result = { mil_spec: [], restricted: [], classified: [], covert: [] };
  for (const item of crate.contains ?? []) {
    const rarity = RARITY_MAP[item.rarity?.id];
    if (rarity) result[rarity].push(item);
  }
  return result;
}

async function loadUpstream(source) {
  if (source) return JSON.parse(await readFile(resolve(source), 'utf8'));

  const response = await fetch(API_URL, { headers: { 'user-agent': 'cs2-case-sim catalog sync' } });
  if (!response.ok) throw new Error(`Catalogue request failed with HTTP ${response.status}`);
  return response.json();
}

function syncEntry(crate, existing) {
  const id = existing?.id ?? IDS[crate.name] ?? slug(crate.name);
  const isTerminal = TERMINALS.has(crate.name);
  const grouped = groupedNormalItems(crate);
  const items = {};

  for (const rarity of ['mil_spec', 'restricted', 'classified', 'covert']) {
    items[rarity] = buildItems(
      grouped[rarity],
      id,
      existing?.items?.[rarity] ?? [],
      rarity,
    );
  }

  if (crate.contains_rare?.length) {
    items.rare_special = buildItems(
      compactRareItems(crate.contains_rare),
      id,
      existing?.items?.rare_special ?? [],
      'rare_special',
      true,
    );
  } else if (existing?.items?.rare_special) {
    items.rare_special = existing.items.rare_special;
  }

  return {
    ...existing,
    id,
    name: crate.name,
    release_date: RELEASE_DATES[crate.name] ?? existing?.release_date ?? null,
    type: isTerminal ? 'terminal' : 'weapon_case',
    image_url: crate.image ?? existing?.image_url ?? null,
    market_price: existing?.market_price ?? (crate.name === 'Gallery Case' ? 0.64 : 0.50),
    rarity_weights: crate.name === 'Sealed Genesis Terminal' ? GENESIS_WEIGHTS : CASE_WEIGHTS,
    items,
  };
}

function compareNewestFirst(a, b) {
  return (b.release_date ?? '').localeCompare(a.release_date ?? '');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const upstream = await loadUpstream(args.source);
  const data = JSON.parse(await readFile(DATA_PATH, 'utf8'));
  const existingByName = new Map(data.cases.map(entry => [entry.name, entry]));
  const upstreamByName = new Map(upstream.map(entry => [entry.name, entry]));

  const caseCrates = upstream.filter(entry => entry.type === 'Case');
  const terminalCrates = [...TERMINALS].map(name => upstreamByName.get(name)).filter(Boolean);
  const allCrates = [...caseCrates, ...terminalCrates];

  if (args.rareOnly) {
    for (const existing of data.cases) {
      const crate = upstreamByName.get(existing.name);
      if (!crate?.contains_rare?.length) continue;
      const currentItems = existing.items?.rare_special ?? [];
      const syncedItems = buildItems(
        compactRareItems(crate.contains_rare),
        existing.id,
        currentItems,
        'rare_special',
        true,
      );
      existing.items.rare_special = mergeInExistingOrder(currentItems, syncedItems);
    }
    const summary = `${caseCrates.length} weapon cases and ${terminalCrates.length} terminals checked for complete rare-special pools`;
    if (!args.write) {
      console.log(`Dry run: ${summary}. Pass --write to update ${DATA_PATH}.`);
      return;
    }
    await writeFile(DATA_PATH, `${JSON.stringify(data, null, 2)}\n`);
    console.log(`Updated ${DATA_PATH}: ${summary}.`);
    return;
  }

  const syncedNames = new Set(allCrates.map(entry => entry.name));
  const synced = allCrates
    .map(crate => syncEntry(crate, existingByName.get(crate.name)))
    .sort(compareNewestFirst);

  const untouched = data.cases.filter(entry => !syncedNames.has(entry.name));
  data.catalog = {
    source: API_URL,
    verified_on: new Date().toISOString().slice(0, 10),
    weapon_cases: caseCrates.length,
    terminals: terminalCrates.length,
  };
  data.cases = [...synced, ...untouched];

  const summary = `${caseCrates.length} weapon cases, ${terminalCrates.length} terminals, ${data.cases.length} total entries`;
  if (!args.write) {
    console.log(`Dry run: ${summary}. Pass --write to update ${DATA_PATH}.`);
    return;
  }

  await writeFile(DATA_PATH, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`Updated ${DATA_PATH}: ${summary}.`);
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
