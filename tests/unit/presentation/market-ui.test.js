import { afterEach, describe, expect, it } from 'vitest';
import { i18n } from '../../../src/foundation/i18n.js';
import {
  marketItemCategory,
  marketItemDisplayName,
  marketItemMatches,
  collapseMusicKitVariants,
  selectMusicKitVariant,
  sortMarketItems,
} from '../../../src/presentation/market-ui.js';

const skin = {
  weapon: 'AK-47',
  skin: 'Redline',
  rarity: 'classified',
  market_price: 10,
  case_names: ['Phoenix Case'],
};
const souvenir = { ...skin, isSouvenir: true };
const sticker = {
  name: 'Crown (Foil)',
  market_hash_name: 'Sticker | Crown (Foil)',
  rarity: 'exotic',
  market_price: 5,
  capsuleType: 'sticker_capsule',
  isCapsuleItem: true,
};

afterEach(() => i18n.setLocale('en-US'));

describe('Market item helpers', () => {
  it('classifies skins, souvenir skins, and capsule items', () => {
    expect(marketItemCategory(skin)).toBe('skin');
    expect(marketItemCategory(souvenir)).toBe('souvenir');
    expect(marketItemCategory(sticker)).toBe('sticker_capsule');
  });

  it('searches against both English and Chinese names', () => {
    expect(marketItemMatches(skin, { query: 'Redline' })).toBe(true);
    expect(marketItemMatches(skin, { query: '红线' })).toBe(true);
    expect(marketItemMatches(sticker, { query: '印花' })).toBe(true);
  });

  it('applies category and rarity filters together', () => {
    expect(marketItemMatches(sticker, { category: 'sticker_capsule', rarity: 'exotic' })).toBe(true);
    expect(marketItemMatches(sticker, { category: 'skin', rarity: 'exotic' })).toBe(false);
    expect(marketItemMatches(sticker, { category: 'sticker_capsule', rarity: 'covert' })).toBe(false);
  });

  it('sorts without mutating the source array', () => {
    const input = [skin, sticker];
    const sorted = sortMarketItems(input, 'price_asc');
    expect(sorted).toEqual([sticker, skin]);
    expect(input).toEqual([skin, sticker]);
  });

  it('changes dynamic market item names with the locale', () => {
    expect(marketItemDisplayName(skin, 'en-US')).toBe('AK-47 | Redline');
    expect(marketItemDisplayName(skin, 'zh-CN')).toContain('红线');
    expect(marketItemDisplayName(sticker, 'zh-CN')).not.toBe(sticker.market_hash_name);
  });

  it('collapses normal and StatTrak music kits into one selectable listing', () => {
    const normal = {
      name: 'Music Kit | Matt Levine, Agency',
      market_hash_name: 'Music Kit | Matt Levine, Agency',
      market_price: 1.25,
      capsuleType: 'music_kit_box',
    };
    const statTrak = {
      ...normal,
      name: 'StatTrak™ Music Kit | Matt Levine, Agency',
      market_hash_name: 'StatTrak™ Music Kit | Matt Levine, Agency',
      market_price: 2.75,
    };

    const [listing] = collapseMusicKitVariants([normal, statTrak]);
    expect(collapseMusicKitVariants([normal, statTrak])).toHaveLength(1);
    expect(selectMusicKitVariant(listing, false)).toMatchObject({ market_price: 1.25, stat_trak: false });
    expect(selectMusicKitVariant(listing, true)).toMatchObject({ market_price: 2.75, stat_trak: true });
  });

  it('groups the upstream TWERL naming aliases and falls back for StatTrak-only kits', () => {
    const normal = {
      name: 'Music Kit | TWERL, Ekko & Sidetrack, Under Bright Lights',
      capsuleType: 'music_kit_box',
    };
    const statTrak = {
      name: 'StatTrak™ Music Kit | TWERL and Ekko & Sidetrack, Under Bright Lights',
      capsuleType: 'music_kit_box',
    };
    const [paired] = collapseMusicKitVariants([normal, statTrak]);
    expect(collapseMusicKitVariants([normal, statTrak])).toHaveLength(1);
    expect(selectMusicKitVariant(paired, true).stat_trak).toBe(true);

    const [only] = collapseMusicKitVariants([{
      name: 'StatTrak™ Music Kit | Beartooth, Aggressive',
      capsuleType: 'music_kit_box',
    }]);
    expect(selectMusicKitVariant(only, false).stat_trak).toBe(true);
  });
});
