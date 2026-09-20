import { CaseDataStore }    from '../foundation/case-data-store.js';
import { CapsuleDataStore } from '../foundation/capsule-data-store.js';
import { FloatService }     from '../foundation/float-service.js';
import { SkinImageLoader }  from '../feature/skin-image-loader.js';
import { PriceAPILayer }    from '../feature/price-api-layer.js';
import { MusicKitPlayer }   from '../feature/music-kit-player.js';
import { i18n }             from '../foundation/i18n.js';
import { VirtualEconomy }   from '../core/virtual-economy.js';
import { SkinInventory }    from '../core/skin-inventory.js';
import { Events }           from '../foundation/events.js';

const WEAR_TIERS = ['fn', 'mw', 'ft', 'ww', 'bs'];
const SKIN_RARITIES = [
  'consumer_grade', 'industrial_grade', 'mil_spec', 'restricted',
  'classified', 'covert', 'rare_special',
];
const ITEMS_PER_PAGE = 24;
const RECOMMENDED_SKINS = 8;
const RECOMMENDED_COSMETICS = 4;

const CONTRABAND_ITEMS = [{
  id: 'm4a4_howl',
  weapon: 'M4A4',
  skin: 'Howl',
  rarity: 'contraband',
  market_price: 2500,
  image_url: 'https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyL8ypexwiFO0P_6afVSKP-EAm6extF6ueZhW2exwkl2tmTXwt39eCiUPQR2DMN4TOVetUK8xoLgM-K341eM2otDnC6okGoXufBz_TAB',
  wear_tiers: ['fn', 'mw', 'ft', 'ww'],
  case_id: null,
  case_name: null,
}];

const CATEGORY_KEYS = {
  all: 'market_category_all',
  skin: 'market_category_skins',
  souvenir: 'market_category_souvenir',
  sticker_capsule: 'market_category_stickers',
  charm_capsule: 'market_category_charms',
  patch_pack: 'market_category_patches',
  pin_capsule: 'market_category_pins',
  music_kit_box: 'market_category_music',
};

const RARITY_OPTIONS = [
  'all', 'consumer_grade', 'industrial_grade', 'mil_spec', 'restricted',
  'classified', 'covert', 'rare_special', 'contraband', 'high_grade',
  'remarkable', 'exotic', 'extraordinary',
];

let _container = null;
let _allItems = null;
let _capsuleItems = null;
let _recommended = [];
let _searchEl = null;
let _listEl = null;
let _labelEl = null;
let _pagerEl = null;
let _refreshBtn = null;
let _searchTimer = null;
let _searchQuery = '';
let _category = 'all';
let _rarity = 'all';
let _sort = 'name';
let _wear = 'ft';
let _statTrak = false;
let _currentPage = 1;
let _visibleSourceItems = [];

export const MarketUI = {
  init(container) {
    _container = container;
    container.innerHTML = `
      <div class="market-view">
        <div class="market-toolbar">
          <div class="market-search-wrap">
            <span class="market-search-icon" aria-hidden="true">⌕</span>
            <input class="market-search" type="search"
              placeholder="Search weapons, skins, cases…" data-i18n-ph="market_ph"
              aria-label="Search market" data-i18n-aria="market_ph"
              autocomplete="off" spellcheck="false" />
            <button type="button" class="market-search-clear" data-i18n-aria="market_clear" aria-label="Clear search" hidden>×</button>
          </div>
          <div class="market-filters">
            ${_makeSelect('market-category', 'market_category', CATEGORY_KEYS)}
            ${_makeSelect('market-rarity', 'market_rarity', Object.fromEntries(RARITY_OPTIONS.map(value => [value, value === 'all' ? 'market_rarity_all' : `rarity.${value}`])))}
            ${_makeSelect('market-wear', 'market_wear', Object.fromEntries(WEAR_TIERS.map(value => [value, `wear.${value}`])))}
            <label class="market-stattrak-toggle">
              <input class="market-stattrak" type="checkbox" />
              <span>StatTrak™</span>
            </label>
            ${_makeSelect('market-sort', 'market_sort', {
              name: 'market_sort_name',
              price_asc: 'market_sort_price_asc',
              price_desc: 'market_sort_price_desc',
              rarity: 'market_sort_rarity',
            })}
            <button type="button" class="market-refresh" data-i18n="market_refresh">Refresh picks</button>
          </div>
        </div>
        <div class="market-results-bar">
          <div class="market-section-label"></div>
          <div class="market-variant-note" data-i18n="market_variant_note">One listing per item · choose wear and StatTrak above</div>
        </div>
        <div class="market-list"></div>
        <div class="market-pager" hidden></div>
      </div>
    `;

    _searchEl = container.querySelector('.market-search');
    _listEl = container.querySelector('.market-list');
    _labelEl = container.querySelector('.market-section-label');
    _pagerEl = container.querySelector('.market-pager');
    _refreshBtn = container.querySelector('.market-refresh');

    _searchEl.addEventListener('input', () => {
      clearTimeout(_searchTimer);
      container.querySelector('.market-search-clear').toggleAttribute('hidden', !_searchEl.value);
      _searchTimer = setTimeout(() => {
        _searchQuery = _searchEl.value.trim();
        this._refreshView(true);
      }, 150);
    });
    container.querySelector('.market-search-clear').addEventListener('click', event => {
      clearTimeout(_searchTimer);
      _searchEl.value = '';
      _searchQuery = '';
      event.currentTarget.setAttribute('hidden', '');
      this._refreshView(true);
      _searchEl.focus();
    });
    container.querySelector('.market-category').addEventListener('change', event => {
      _category = event.currentTarget.value;
      this._refreshView(true);
    });
    container.querySelector('.market-rarity').addEventListener('change', event => {
      _rarity = event.currentTarget.value;
      this._refreshView(true);
    });
    container.querySelector('.market-wear').addEventListener('change', event => {
      _wear = event.currentTarget.value;
      this._refreshView(false);
    });
    container.querySelector('.market-stattrak').addEventListener('change', event => {
      _statTrak = event.currentTarget.checked;
      this._refreshView(false);
    });
    container.querySelector('.market-sort').addEventListener('change', event => {
      _sort = event.currentTarget.value;
      this._refreshView(true);
    });
    _refreshBtn.addEventListener('click', () => {
      _recommended = this._pickRecommended();
      this._refreshView(true);
    });

    document.addEventListener('locale-changed', () => {
      if (_allItems) this._refreshView(false);
    });

    document.addEventListener(Events.PRICE_UPDATED, event => {
      const { hashName, price, source } = event.detail;
      _listEl?.querySelectorAll('[data-hash-name]').forEach(element => {
        if (element.dataset.hashName !== hashName) return;
        if (element.dataset.priceSource && element.dataset.priceSource !== source) return;
        if (element.classList.contains('market-row-price')) {
          element.textContent = `$${price.toFixed(2)}`;
          element.classList.remove('market-row-price--loading');
          element.classList.add('market-row-price--live');
          element.title = i18n.t('market_live_price');
        } else if (element.classList.contains('btn-market-buy')) {
          element.disabled = false;
        }
      });
    });
  },

  show() {
    if (!_container) return;
    if (!_allItems) this._buildPool();
    if (!_recommended.length) _recommended = this._pickRecommended();
    this._refreshView(false);
  },

  hide() {},

  _buildPool() {
    const skins = new Map();
    for (const container of CaseDataStore.getCaseList()) {
      const isSouvenir = container.type === 'souvenir_package';
      for (const rarity of SKIN_RARITIES) {
        const items = CaseDataStore.getItems(container.id, rarity);
        for (const source of items) {
          const key = `${isSouvenir ? 'souvenir' : 'skin'}|${source.weapon}|${source.skin}`;
          const existing = skins.get(key);
          if (existing) {
            if (!existing.case_names.includes(container.name)) existing.case_names.push(container.name);
            continue;
          }
          skins.set(key, {
            ...source,
            rarity,
            case_id: container.id,
            case_name: container.name,
            case_names: [container.name],
            isSouvenir,
          });
        }
      }
    }
    for (const source of CONTRABAND_ITEMS) {
      skins.set(`skin|${source.weapon}|${source.skin}`, {
        ...source,
        case_names: [],
        isSouvenir: false,
      });
    }
    _allItems = [...skins.values()];

    const cosmetics = new Map();
    for (const source of [...CapsuleDataStore.getAllItems(), ...CapsuleDataStore.getMarketItems()]) {
      const key = source.market_hash_name ?? `${source.capsuleType}|${source.name}`;
      if (!cosmetics.has(key)) cosmetics.set(key, { ...source, isCapsuleItem: true });
    }
    _capsuleItems = [...cosmetics.values()];
  },

  _pickRecommended() {
    return [
      ..._shuffle(_allItems).slice(0, RECOMMENDED_SKINS),
      ..._shuffle(_capsuleItems).slice(0, RECOMMENDED_COSMETICS),
    ];
  },

  _refreshView(resetPage) {
    if (!_allItems) return;
    if (resetPage) _currentPage = 1;

    const discoveryMode = !_searchQuery && _category === 'all' && _rarity === 'all';
    const source = discoveryMode ? _recommended : [..._allItems, ..._capsuleItems];
    _visibleSourceItems = sortMarketItems(
      source.filter(item => marketItemMatches(item, {
        query: _searchQuery,
        category: _category,
        rarity: _rarity,
      })),
      _sort,
      { wear: _wear, statTrak: _statTrak },
    );

    const totalPages = Math.max(1, Math.ceil(_visibleSourceItems.length / ITEMS_PER_PAGE));
    _currentPage = Math.min(Math.max(1, _currentPage), totalPages);
    const start = (_currentPage - 1) * ITEMS_PER_PAGE;
    const page = _visibleSourceItems.slice(start, start + ITEMS_PER_PAGE);
    const listings = page.map(item => this._listingFor(item));

    _labelEl.textContent = discoveryMode
      ? i18n.t('market_recommended_count', { n: _visibleSourceItems.length })
      : i18n.t('market_results_count', { n: _visibleSourceItems.length });
    _refreshBtn.toggleAttribute('hidden', !discoveryMode);
    this._render(listings);
    this._renderPager(totalPages);
    listings.forEach(listing => {
      if (!listing.hashName) return;
      if (listing.item.price_source === 'steam') PriceAPILayer.prefetchSteam(listing.hashName);
      else PriceAPILayer.prefetch(listing.hashName);
    });
  },

  _listingFor(item) {
    if (item.isCapsuleItem) return _makeCapsuleListing(item);
    const tiers = item.wear_tiers?.length ? item.wear_tiers : WEAR_TIERS;
    const tier = _isVanilla(item) ? null : (tiers.includes(_wear) ? _wear : (tiers.includes('ft') ? 'ft' : tiers[0]));
    const allowsStatTrak = !item.isSouvenir && !_isGlove(item.weapon) && item.rarity !== 'contraband';
    return _makeListing(item, tier, _statTrak && allowsStatTrak);
  },

  _renderPager(totalPages) {
    _pagerEl.innerHTML = '';
    if (totalPages <= 1) {
      _pagerEl.setAttribute('hidden', '');
      return;
    }
    _pagerEl.removeAttribute('hidden');
    const previous = _pagerButton('←', 'market_previous', _currentPage === 1, () => {
      _currentPage--;
      this._refreshView(false);
      _scrollMarketTop();
    });
    const label = document.createElement('span');
    label.className = 'market-pager-label';
    label.textContent = i18n.t('market_page', { current: _currentPage, total: totalPages });
    const next = _pagerButton('→', 'market_next', _currentPage === totalPages, () => {
      _currentPage++;
      this._refreshView(false);
      _scrollMarketTop();
    });
    _pagerEl.append(previous, label, next);
  },

  _render(listings) {
    _listEl.innerHTML = '';
    if (!listings.length) {
      const empty = document.createElement('div');
      empty.className = 'market-empty';
      empty.innerHTML = `<strong>${i18n.t('market_no_results')}</strong><span>${i18n.t('market_no_results_hint')}</span>`;
      _listEl.appendChild(empty);
      return;
    }
    const fragment = document.createDocumentFragment();
    for (const listing of listings) fragment.appendChild(this._makeRow(listing));
    _listEl.appendChild(fragment);
  },

  _makeRow(listing) {
    const { item, floatVal, wearTier, statTrak, hashName, localPrice } = listing;
    const isCosmetic = !!item.isCapsuleItem;
    const displayName = marketItemDisplayName(item);
    const hasFloat = !isCosmetic && floatVal !== null && wearTier !== null;

    const row = document.createElement('article');
    row.className = `market-row rarity-${item.rarity ?? 'unknown'}${statTrak ? ' market-row--st' : ''}`;

    const img = SkinImageLoader.getLazyImage(item.image_url ?? null, item.rarity);
    img.className = 'market-row-img';
    img.alt = displayName;

    const info = document.createElement('div');
    info.className = 'market-row-info';
    const name = document.createElement('div');
    name.className = 'market-row-name';
    if (statTrak) {
      const prefix = document.createElement('span');
      prefix.className = 'stat-trak-prefix';
      prefix.textContent = 'StatTrak™ ';
      name.append(prefix, document.createTextNode(displayName.replace(/^StatTrak™ /, '')));
    } else {
      name.textContent = displayName;
    }
    const meta = document.createElement('div');
    meta.className = 'market-row-meta';
    meta.textContent = _marketItemMeta(item);
    info.append(name, meta);

    const floatBlock = document.createElement('div');
    floatBlock.className = 'market-float-block';
    if (hasFloat) {
      floatBlock.appendChild(_makeFloatScale(floatVal));
      const detail = document.createElement('div');
      detail.className = 'market-float-label';
      const badge = document.createElement('span');
      badge.className = `wear-badge wear-${wearTier}`;
      badge.textContent = i18n.wearLabel(wearTier);
      const number = document.createElement('span');
      number.className = 'market-float-num';
      number.textContent = FloatService.formatFloat(floatVal);
      detail.append(badge, number);
      floatBlock.appendChild(detail);
    } else {
      floatBlock.textContent = i18n.t(isCosmetic ? 'market_no_wear' : 'market_vanilla');
      floatBlock.classList.add('market-float-block--empty');
    }

    const livePrice = PriceAPILayer.getCachedPrice(hashName, item.price_source ?? null);
    const displayPrice = livePrice ?? localPrice;
    const price = document.createElement('div');
    price.className = 'market-row-price';
    price.dataset.hashName = hashName;
    if (item.price_source) price.dataset.priceSource = item.price_source;
    price.textContent = displayPrice === null ? '—' : `$${displayPrice.toFixed(2)}`;
    if (livePrice !== null) {
      price.classList.add('market-row-price--live');
      price.title = i18n.t('market_live_price');
    } else if (displayPrice === null) {
      price.classList.add('market-row-price--loading');
    } else {
      price.title = i18n.t('market_fallback_price');
    }

    const buy = document.createElement('button');
    buy.className = 'btn-market-buy';
    buy.textContent = i18n.t('buy_btn');
    buy.disabled = displayPrice === null;
    buy.dataset.hashName = hashName;
    if (item.price_source) buy.dataset.priceSource = item.price_source;
    buy.addEventListener('click', () => this._handleBuy(listing, buy, row));

    row.append(img, info, floatBlock, price, buy);
    const isMusicKit = isCosmetic && item.capsuleType === 'music_kit_box';
    if (isMusicKit) {
      row.classList.add('market-row--has-play');
      const play = document.createElement('button');
      play.className = 'btn-market-play';
      play.textContent = '♪';
      play.title = i18n.t('market_preview');
      play.setAttribute('aria-label', i18n.t('market_preview'));
      play.addEventListener('click', () => MusicKitPlayer.toggle(item.name, item.youtube_id ?? ''));
      row.appendChild(play);
    }
    return row;
  },

  _handleBuy(listing, button, row) {
    const { item, statTrak, hashName, wearTier, localPrice } = listing;
    const buyPrice = PriceAPILayer.getCachedPrice(hashName, item.price_source ?? null) ?? localPrice;
    if (buyPrice === null || !VirtualEconomy.canAfford(buyPrice)) {
      row.classList.add('market-row--no-funds');
      button.textContent = i18n.t('market_no_funds');
      setTimeout(() => {
        row.classList.remove('market-row--no-funds');
        button.textContent = i18n.t('buy_btn');
      }, 900);
      return;
    }

    button.disabled = true;
    VirtualEconomy.spend(buyPrice);
    if (item.isCapsuleItem) {
      SkinInventory.addItem({ ...item, market_price: buyPrice });
    } else {
      const receivedFloat = wearTier ? FloatService.generateFloatForTier(wearTier) : null;
      SkinInventory.addItem({
        ...item,
        float: receivedFloat,
        wear_tier: receivedFloat === null ? null : FloatService.getWearTier(receivedFloat),
        market_price: buyPrice,
        stat_trak: statTrak,
      });
    }
    button.textContent = i18n.t('bought');
    button.classList.add('btn-market-buy--done');
    setTimeout(() => row.replaceWith(this._makeRow(this._listingFor(item))), 1000);
  },
};

export function marketItemCategory(item) {
  if (item.isCapsuleItem) return item.capsuleType ?? 'sticker_capsule';
  return item.isSouvenir ? 'souvenir' : 'skin';
}

export function marketItemDisplayName(item, locale = i18n.getLocale()) {
  return item.isCapsuleItem
    ? i18n.itemName(_marketItemTranslationName(item), locale, item.capsuleType)
    : i18n.skinName(item.weapon, item.skin, locale);
}

export function marketItemMatches(item, { query = '', category = 'all', rarity = 'all' } = {}) {
  if (category !== 'all' && marketItemCategory(item) !== category) return false;
  if (rarity !== 'all' && item.rarity !== rarity) return false;
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const sources = item.case_names ?? [item.case_name ?? item.capsuleName].filter(Boolean);
  const text = [
    marketItemDisplayName(item, 'en-US'),
    marketItemDisplayName(item, 'zh-CN'),
    item.market_hash_name,
    ...sources,
    ...sources.map(name => i18n.caseName(name, 'zh-CN')),
  ].filter(Boolean).join(' ').toLocaleLowerCase();
  return words.every(word => text.includes(word));
}

export function sortMarketItems(items, sort = 'name', variant = { wear: 'ft', statTrak: false }) {
  const result = [...items];
  const byName = (a, b) => marketItemDisplayName(a).localeCompare(marketItemDisplayName(b), i18n.getLocale());
  if (sort === 'price_asc' || sort === 'price_desc') {
    const direction = sort === 'price_asc' ? 1 : -1;
    return result.sort((a, b) => direction * (_estimatedPrice(a, variant) - _estimatedPrice(b, variant)) || byName(a, b));
  }
  if (sort === 'rarity') {
    return result.sort((a, b) => _rarityRank(b.rarity) - _rarityRank(a.rarity) || byName(a, b));
  }
  return result.sort(byName);
}

function _makeSelect(className, labelKey, options) {
  const optionHtml = Object.entries(options)
    .map(([value, key]) => `<option value="${value}" data-i18n="${key}">${i18n.t(key)}</option>`)
    .join('');
  return `<label class="market-filter"><span data-i18n="${labelKey}">${i18n.t(labelKey)}</span><select class="${className}">${optionHtml}</select></label>`;
}

function _pagerButton(text, labelKey, disabled, onClick) {
  const button = document.createElement('button');
  button.className = 'market-pager-btn';
  button.textContent = text;
  button.disabled = disabled;
  button.title = i18n.t(labelKey);
  button.setAttribute('aria-label', i18n.t(labelKey));
  button.addEventListener('click', onClick);
  return button;
}

function _scrollMarketTop() {
  _labelEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function _shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function _marketItemMeta(item) {
  if (item.isCapsuleItem) {
    return `${i18n.t(CATEGORY_KEYS[marketItemCategory(item)] ?? 'market_category_cosmetics')} · ${i18n.rarityLabel(item.rarity)}`;
  }
  const sources = item.case_names ?? [];
  const source = sources[0] ?? (item.rarity === 'contraband' ? i18n.t('market_contraband_item') : null);
  const translated = source ? i18n.caseName(source) : null;
  const extra = sources.length > 1 ? i18n.t('market_more_sources', { n: sources.length - 1 }) : '';
  return [translated, extra, i18n.rarityLabel(item.rarity)].filter(Boolean).join(' · ');
}

function _marketItemTranslationName(item) {
  return item.market_hash_name ?? item.name;
}

function _makeListing(item, forceTier = null, statTrak = false) {
  const vanilla = _isVanilla(item);
  const floatVal = vanilla ? null : (forceTier ? FloatService.generateFloatForTier(forceTier) : FloatService.generateFloat());
  const wearTier = vanilla ? null : FloatService.getWearTier(floatVal);
  const hashName = PriceAPILayer.buildSkinHashName(item, wearTier, statTrak, item.isSouvenir);
  return { item, floatVal, wearTier, statTrak, hashName, localPrice: _localPrice(item, wearTier, statTrak) };
}

const WEAR_MULTIPLIERS = { fn: 3, mw: 1.5, ft: 1, ww: 0.65, bs: 0.45 };
const SOUVENIR_RARITY_ESTIMATE = {
  covert: 1200,
  classified: 80,
  restricted: 12,
  mil_spec: 2,
  consumer_grade: 0.5,
  industrial_grade: 0.5,
};

function _localPrice(item, wearTier, statTrak) {
  let base = item.market_price ?? null;
  if (base === null) return null;
  if (item.isSouvenir && base < 20) base = SOUVENIR_RARITY_ESTIMATE[item.rarity] ?? 5;
  return Math.round(base * (WEAR_MULTIPLIERS[wearTier] ?? 1) * (statTrak ? 1.5 : 1) * 100) / 100;
}

function _estimatedPrice(item, { wear, statTrak }) {
  if (item.isCapsuleItem) return item.market_price ?? Number.POSITIVE_INFINITY;
  return _localPrice(item, wear, statTrak) ?? Number.POSITIVE_INFINITY;
}

function _rarityRank(rarity) {
  return ['consumer_grade', 'industrial_grade', 'mil_spec', 'high_grade', 'restricted', 'remarkable', 'classified', 'exotic', 'covert', 'extraordinary', 'rare_special', 'contraband'].indexOf(rarity);
}

function _makeFloatScale(floatVal) {
  const wrap = document.createElement('div');
  wrap.className = 'float-scale';
  const bar = document.createElement('div');
  bar.className = 'float-scale-bar';
  const marker = document.createElement('div');
  marker.className = 'float-scale-marker';
  marker.style.left = `${(floatVal * 100).toFixed(4)}%`;
  bar.appendChild(marker);
  wrap.appendChild(bar);
  return wrap;
}

function _isGlove(weapon) {
  return typeof weapon === 'string' && (weapon.includes('Gloves') || weapon.includes('Wraps'));
}

function _isVanilla(item) {
  return item.skin?.startsWith('★') && item.skin.slice(1).trim().toLowerCase() === 'vanilla';
}

function _makeCapsuleListing(item) {
  return {
    item,
    floatVal: null,
    wearTier: null,
    statTrak: !!item.stat_trak,
    hashName: item.market_hash_name ?? item.name,
    localPrice: item.market_price ?? null,
  };
}
