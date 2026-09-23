import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import enUS from '../../src/foundation/languages/en-US.js';
import zhCN from '../../src/foundation/languages/zh-CN.js';

const containers = ['public/data/cases.json', 'public/data/souvenirs.json', 'public/data/armory.json']
  .flatMap(file => JSON.parse(fs.readFileSync(file, 'utf8')).cases ?? []);
const marketItems = JSON.parse(fs.readFileSync('public/data/market-items.json', 'utf8')).items ?? [];

describe('Chinese translation coverage', () => {
  it('covers every English interface key', () => {
    const interfaceKeys = Object.keys(enUS).filter(key => !/^(case_name|skin_name|item_name)\./.test(key));
    expect(interfaceKeys.filter(key => !zhCN[key])).toEqual([]);
  });

  it('covers every case and souvenir package in the runtime catalog', () => {
    const missing = containers
      .map(container => container.name)
      .filter(name => !zhCN[`case_name.${name}`]);
    expect(missing).toEqual([]);
  });

  it('covers every skin in the runtime catalog', () => {
    const missing = [];
    for (const container of containers) {
      for (const items of Object.values(container.items ?? {})) {
        for (const item of items) {
          const name = `${item.weapon} | ${item.skin}`;
          if (!zhCN[`skin_name.${name}`]) missing.push(name);
        }
      }
    }
    expect([...new Set(missing)]).toEqual([]);
  });

  it('covers every standalone market item', () => {
    const missing = marketItems.filter(item => !zhCN[`item_name.${item.market_hash_name}`]);
    expect(missing.map(item => item.market_hash_name)).toEqual([]);
  });
});
