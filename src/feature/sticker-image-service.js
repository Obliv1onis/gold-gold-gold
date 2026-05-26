const _cache = new Map();

export const StickerImageService = {
  /**
   * Returns a CDN URL for the sticker image via the Steam market search API.
   * Results are cached per hash name.
   * @param {string} marketHashName
   * @returns {Promise<string|null>}
   */
  async getImageUrl(marketHashName) {
    if (_cache.has(marketHashName)) return _cache.get(marketHashName);

    try {
      const params = new URLSearchParams({
        norender: '1',
        query:    marketHashName,
        appid:    '730',
        start:    '0',
        count:    '1',
        language: 'english',
      });
      const res  = await fetch(`/api/steam-search/?${params}`);
      const json = await res.json();
      const iconUrl = json?.results?.[0]?.asset_description?.icon_url;
      if (!iconUrl) return null;
      const url = `https://community.akamai.steamstatic.com/economy/image/${iconUrl}/360fx360f`;
      _cache.set(marketHashName, url);
      return url;
    } catch {
      return null;
    }
  },
};
