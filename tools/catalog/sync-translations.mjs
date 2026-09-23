#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const args = Object.fromEntries(process.argv.slice(2).map((arg, index, all) => {
  if (!arg.startsWith('--')) return [arg, true];
  const [key, inline] = arg.slice(2).split('=', 2);
  return [key, inline ?? (all[index + 1]?.startsWith('--') ? true : all[index + 1])];
}));

const readJson = file => JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
const API_ROOT = 'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api';
async function readSource(source) {
  if (!/^https?:\/\//.test(source)) return readJson(source);
  const response = await fetch(source);
  if (!response.ok) throw new Error(`Could not fetch ${source}: HTTP ${response.status}`);
  return response.json();
}
const source = (type, locale) => args[`${type}-${locale}`] ?? `${API_ROOT}/${locale === 'en' ? 'en' : 'zh-CN'}/${type}.json`;

const localContainers = ['public/data/cases.json', 'public/data/souvenirs.json', 'public/data/armory.json']
  .flatMap(file => readJson(file).cases ?? []);
const skinsEn = await readSource(source('skins', 'en'));
const skinsZh = await readSource(source('skins', 'zh'));
const cratesEn = await readSource(source('crates', 'en'));
const cratesZh = await readSource(source('crates', 'zh'));
const localCapsules = ['public/data/capsules.json', 'public/data/others.json']
  .flatMap(file => readJson(file).capsules ?? []);
const localMarketItems = fs.existsSync('public/data/market-items.json')
  ? readJson('public/data/market-items.json').items ?? []
  : [];

function pairedMap(english, chinese) {
  const chineseById = new Map(chinese.map(item => [item.id, item]));
  return new Map(english.map(item => [item.name, chineseById.get(item.id)?.name]).filter(([, value]) => value));
}

function marketSkinName(runtimeName) {
  const [weapon, ...skinParts] = runtimeName.split(' | ');
  const skin = skinParts.join(' | ');
  if (!skin.startsWith('★')) return runtimeName;
  const finish = skin.slice(1).trim();
  return finish.toLowerCase() === 'vanilla' ? `★ ${weapon}` : `★ ${weapon} | ${finish}`;
}

function normalizedName(name) {
  return name
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('en-US')
    .replace(/[^\p{Letter}\p{Number}]+/gu, '');
}

const officialSkins = pairedMap(skinsEn, skinsZh);
const officialCrates = pairedMap(cratesEn, cratesZh);
const chineseSkinsById = new Map(skinsZh.map(skin => [skin.id, skin]));
const officialCollections = new Map();
for (const skin of skinsEn) {
  const chinese = chineseSkinsById.get(skin.id);
  for (let i = 0; i < (skin.collections?.length ?? 0); i++) {
    const collection = skin.collections[i];
    const translated = chinese?.collections?.find(item => item.id === collection.id)?.name;
    if (translated) officialCollections.set(collection.name, translated);
  }
}
const translations = {};
const missing = [];

const runtimeSkins = new Set();
for (const container of localContainers) {
  for (const items of Object.values(container.items ?? {})) {
    for (const item of items) runtimeSkins.add(`${item.weapon} | ${item.skin}`);
  }
}
for (const runtimeName of [...runtimeSkins].sort()) {
  const translated = officialSkins.get(marketSkinName(runtimeName));
  if (translated) translations[`skin_name.${runtimeName}`] = translated;
  else missing.push(`skin: ${runtimeName}`);
}

for (const name of [...new Set(localContainers.map(container => container.name))].sort()) {
  const translated = officialCrates.get(name) ?? officialCollections.get(name) ?? officialSkins.get(name);
  if (translated) translations[`case_name.${name}`] = translated;
}

const itemSources = ['stickers', 'keychains', 'patches', 'music', 'collectibles']
  .map(async type => {
    const fileName = type === 'music' ? 'music_kits' : type;
    const [english, chinese] = await Promise.all([
      readSource(args[`${type}-en`] ?? `${API_ROOT}/en/${fileName}.json`),
      readSource(args[`${type}-zh`] ?? `${API_ROOT}/zh-CN/${fileName}.json`),
    ]);
    return pairedMap(english, chinese);
  });
const officialItems = new Map((await Promise.all(itemSources)).flatMap(itemMap => [...itemMap]));
const manualItems = new Map([
  ['Music Kit | Starjunk 95, Industrial Sunset Memories', '音乐盒 | Starjunk 95, 工业落日回忆'],
  ['StatTrak™ Music Kit | Starjunk 95, Industrial Sunset Memories', 'StatTrak™ 音乐盒 | Starjunk 95, 工业落日回忆'],
]);
const normalizedOfficialItems = new Map(
  [...officialItems].map(([name, translated]) => [normalizedName(name), translated]),
);
const runtimeItems = new Set();
for (const capsule of localCapsules) {
  for (const items of Object.values(capsule.tiers ?? {})) {
    for (const item of items) {
      let name = item.market_hash_name ?? item.name;
      if (capsule.type === 'patch_pack' && !name.startsWith('Patch | ')) name = `Patch | ${name}`;
      runtimeItems.add(name);
    }
  }
}
for (const item of localMarketItems) runtimeItems.add(item.market_hash_name ?? item.name);
for (const name of [...runtimeItems].sort()) {
  const translated = manualItems.get(name) ?? officialItems.get(name) ?? normalizedOfficialItems.get(normalizedName(name));
  if (translated) translations[`item_name.${name}`] = translated;
}

const output = path.resolve(args.output || 'src/foundation/languages/zh-CN-catalog.js');
const body = Object.entries(translations)
  .map(([key, value]) => `  ${JSON.stringify(key)}: ${JSON.stringify(value)},`)
  .join('\n');
const generated = `// Generated by tools/catalog/sync-translations.mjs from ByMykel/CSGO-API locale data.\n// Do not edit by hand; update the source snapshots and run npm run data:sync:translations.\nexport default {\n${body}\n};\n`;
fs.writeFileSync(output, generated);

console.log(`Wrote ${Object.keys(translations).length} catalog translations to ${path.relative(process.cwd(), output)}`);
if (missing.length) console.warn(`Kept ${missing.length} manual fallback(s):\n${missing.join('\n')}`);
