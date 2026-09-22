#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const REFERENCE = resolve('design/reference/cologne-2026-stickers.md');
const MUSIC_REFERENCE = resolve('design/reference/music-kit-market.md');
const OUTPUT = resolve('public/data/market-items.json');
const DEFAULT_STICKERS_SOURCE = 'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/stickers.json';
const DEFAULT_MUSIC_SOURCE = 'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/music_kits.json';

function parseArgs(argv) {
  const args = { source: null, musicSource: null, write: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--source') args.source = argv[++i];
    else if (argv[i] === '--music-source') args.musicSource = argv[++i];
    else if (argv[i] === '--write') args.write = true;
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  return args;
}

function splitRow(line) {
  return line.slice(1, -1).split(/(?<!\\)\|/).map(cell => cell.trim().replaceAll('\\|', '|').replaceAll('\\\\', '\\'));
}

async function loadSource(source, fallback) {
  if (source) return JSON.parse(await readFile(resolve(source), 'utf8'));
  const response = await fetch(fallback, { headers: { 'user-agent': 'cs2-case-sim catalog sync' } });
  if (!response.ok) throw new Error(`Catalogue request failed with HTTP ${response.status}`);
  return response.json();
}

const args = parseArgs(process.argv.slice(2));
const [markdown, musicMarkdown] = await Promise.all([
  readFile(REFERENCE, 'utf8'),
  readFile(MUSIC_REFERENCE, 'utf8'),
]);
const verifiedAt = markdown.match(/^> Verified at: (.+)\.$/m)?.[1] ?? null;
const musicVerifiedAt = musicMarkdown.match(/^> Verified at: (.+)\.$/m)?.[1] ?? null;
const rows = markdown.split('\n')
  .filter(line => /^\| sticker-/.test(line))
  .map(splitRow)
  .map(([id, marketHashName, rarity, price, listings, priceBasis]) => ({
    id,
    marketHashName,
    rarity,
    marketPrice: price === '—' ? null : Number(price),
    listings: listings === '—' ? null : Number(listings),
    priceBasis: priceBasis || 'Steam listing',
  }));
const musicRows = musicMarkdown.split('\n')
  .filter(line => /^\| music_kit-/.test(line))
  .map(splitRow)
  .map(([id, marketHashName, rarity, price, volume]) => ({
    id,
    marketHashName,
    rarity,
    marketPrice: price === '—' ? null : Number(price),
    volume: volume === '—' ? null : Number(volume),
  }));

if (!rows.length) throw new Error(`No sticker rows found in ${REFERENCE}`);
if (!musicRows.length) throw new Error(`No music-kit rows found in ${MUSIC_REFERENCE}`);
const [sourceItems, musicSourceItems] = await Promise.all([
  loadSource(args.source, DEFAULT_STICKERS_SOURCE),
  loadSource(args.musicSource, DEFAULT_MUSIC_SOURCE),
]);
const sourceById = new Map(sourceItems.map(item => [item.id, item]));
const musicSourceById = new Map(musicSourceItems.map(item => [item.id, item]));
const errors = [];
const stickerItems = rows.map(row => {
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
    price_basis: row.priceBasis,
    steam_listings: row.listings,
    capsuleType: 'sticker_capsule',
    capsuleName: 'Cologne 2026 Direct Sticker Market',
  };
});
const musicItems = musicRows.map(row => {
  const source = musicSourceById.get(row.id);
  if (!source || source.market_hash_name !== row.marketHashName) errors.push(`${row.id}: music source name mismatch`);
  return {
    id: row.id,
    name: row.marketHashName,
    market_hash_name: row.marketHashName,
    image_url: source?.image ?? null,
    rarity: row.rarity,
    market_price: row.marketPrice,
    price_source: 'steam',
    steam_volume: row.volume,
    capsuleType: 'music_kit_box',
    capsuleName: 'Direct Steam Music Kit Market',
  };
});
if (errors.length) throw new Error(errors.slice(0, 20).join('\n'));
const items = [...stickerItems, ...musicItems];

const output = {
  format_version: '1.0',
  catalog: {
    source_references: [
      'design/reference/cologne-2026-stickers.md',
      'design/reference/music-kit-market.md',
    ],
    metadata_sources: [DEFAULT_STICKERS_SOURCE, DEFAULT_MUSIC_SOURCE],
    price_source: 'Steam Community Market lowest sell listing (USD)',
    price_verified_at: [verifiedAt, musicVerifiedAt].filter(Boolean).sort().at(-1) ?? null,
    items: items.length,
    sticker_items: stickerItems.length,
    music_kit_items: musicItems.length,
    direct_music_kits: new Set(musicItems.map(item => item.market_hash_name.replace(/^StatTrak™\s+/, ''))).size,
    priced_items: items.filter(item => item.market_price !== null).length,
    estimated_items: items.filter(item => item.price_basis && item.price_basis !== 'Steam listing').length,
    missing_images: items.filter(item => !item.image_url).length,
  },
  items,
};

if (!args.write) {
  console.log(
    `Dry run: ${stickerItems.length} Cologne 2026 stickers + ${musicItems.length} direct music-kit variants `
    + `(${output.catalog.priced_items} priced). Pass --write to update ${OUTPUT}.`,
  );
} else {
  await writeFile(OUTPUT, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`Wrote ${items.length} standalone market items to ${OUTPUT}.`);
}
