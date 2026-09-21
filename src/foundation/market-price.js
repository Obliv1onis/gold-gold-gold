/**
 * Returns the catalogued Steam price for an exact market variant.
 *
 * @param {object} item
 * @param {string|null} wearTier fn|mw|ft|ww|bs, or null for vanilla items
 * @param {{ statTrak?: boolean, souvenir?: boolean }} variant
 * @returns {number|null}
 */
export function getCatalogMarketPrice(
  item,
  wearTier,
  { statTrak = false, souvenir = false } = {},
) {
  const group = souvenir ? 'souvenir' : (statTrak ? 'stattrak' : 'normal');
  const tier = wearTier ?? 'vanilla';
  const price = item?.market_prices?.[group]?.[tier];
  return Number.isFinite(price) && price > 0 ? price : null;
}
