#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const REFERENCE = resolve('design/reference/cologne-2026-stickers.md');
const OUTPUT = resolve('public/data/market-items.json');
const DEFAULT_STICKERS_SOURCE = 'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/stickers.json';

function parseArgs(argv) {
  const args = { source: null, write: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--source') args.source = argv[++i];
    else if (argv[i] === '--write') args.write = true;
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  return args;
}

function splitRow(line) {
  return line.slice(1, -1).split(/(?<!\\)\|/).map(cell => cell.trim().replaceAll('\\|', '|').replaceAll('\\\\', '\\'));
}

async function loadSource(source) {
  if (source) return JSON.parse(await readFile(resolve(source), 'utf8'));
  const response = await fetch(DEFAULT_STICKERS_SOURCE, { headers: { 'user-agent': 'cs2-case-sim catalog sync' } });
  if (!response.ok) throw new Error(`Sticker catalogue request failed with HTTP ${response.status}`);
  return response.json();
}

const args = parseArgs(process.argv.slice(2));
const markdown = await readFile(REFERENCE, 'utf8');
const verifiedAt = markdown.match(/^> Verified at: (.+)\.$/m)?.[1] ?? null;
const rows = markdown.split('\n')
  .filter(line => /^\| sticker-/.test(line))
  .map(splitRow)
  .map(([id, marketHashName, rarity, price, listings]) => ({
    id,
    marketHashName,
    rarity,
    marketPrice: price === '—' ? null : Number(price),
    listings: listings === '—' ? null : Number(listings),
  }));

if (!rows.length) throw new Error(`No sticker rows found in ${REFERENCE}`);
const sourceItems = await loadSource(args.source);
const sourceById = new Map(sourceItems.map(item => [item.id, item]));
const errors = [];
const items = rows.map(row => {
  const source = sourceById.get(row.id);
  if (!source || source.name !== row.marketHashName) errors.push(`${row.id}: source name mismatch`);
  return {
    id: row.id,
    name: row.marketHashName,
    market_hash_name: row.marketHashName,
    image_url: source?.image ?? null,
    rarity: row.rarity,
    market_price: row.marketPrice,
    price_source: 'steam',
    steam_listings: row.listings,
    capsuleType: 'sticker_capsule',
    capsuleName: 'Cologne 2026 Direct Sticker Market',
  };
});
if (errors.length) throw new Error(errors.slice(0, 20).join('\n'));

const output = {
  format_version: '1.0',
  catalog: {
    source_reference: 'design/reference/cologne-2026-stickers.md',
    metadata_source: DEFAULT_STICKERS_SOURCE,
    price_source: 'Steam Community Market lowest sell listing (USD)',
    price_verified_at: verifiedAt,
    items: items.length,
    priced_items: items.filter(item => item.market_price !== null).length,
    missing_images: items.filter(item => !item.image_url).length,
  },
  items,
};

if (!args.write) {
  console.log(`Dry run: ${items.length} Cologne 2026 stickers (${output.catalog.priced_items} priced). Pass --write to update ${OUTPUT}.`);
} else {
  await writeFile(OUTPUT, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`Wrote ${items.length} Cologne 2026 stickers to ${OUTPUT}.`);
}
