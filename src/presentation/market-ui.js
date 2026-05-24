import { CaseDataStore }   from '../foundation/case-data-store.js';
import { FloatService }    from '../foundation/float-service.js';
import { SkinImageLoader } from '../feature/skin-image-loader.js';
import { VirtualEconomy }  from '../core/virtual-economy.js';
import { SkinInventory }   from '../core/skin-inventory.js';

const RARITY_TIERS      = ['mil_spec', 'restricted', 'classified', 'covert', 'rare_special'];
const WEAR_TIERS        = ['fn', 'mw', 'ft', 'ww', 'bs'];
const STAT_TRAK_MULTIPLIER = 1.50;
// 10 variants per skin: 5 normal + 5 StatTrak™
const LISTING_VARIANTS  = [
  ...WEAR_TIERS.map(tier => ({ tier, statTrak: false })),
  ...WEAR_TIERS.map(tier => ({ tier, statTrak: true  })),
];
const RECOMMEND_SKINS = 2;   // × 10 variants = 20 rows
const SEARCH_SKINS    = 6;   // × 10 variants = 60 rows

let _container   = null;
let _allItems    = null;   // built lazily on first show()
let _recommended = [];     // listings shown when search is empty
let _searchEl    = null;
let _listEl      = null;
let _labelEl     = null;
let _searchTimer = null;

/**
 * Market browse view.
 * Shows randomly recommended skin listings (image, name, case, float scale,
 * price, buy button) and a search bar that filters across all skins.
 *
 * @example
 * MarketUI.init(document.querySelector('.market-container'));
 * // Later, from nav:
 * MarketUI.show(); MarketUI.hide();
 */
export const MarketUI = {
  /**
   * @param {HTMLElement} container
   */
  init(container) {
    _container = container;
    container.innerHTML = `
      <div class="market-view">
        <div class="market-search-wrap">
          <input class="market-search" type="text"
            placeholder="Search weapons, skins, cases…"
            autocomplete="off" spellcheck="false" />
        </div>
        <div class="market-section-label">Recommended</div>
        <div class="market-list"></div>
      </div>
    `;
    _searchEl = container.querySelector('.market-search');
    _listEl   = container.querySelector('.market-list');
    _labelEl  = container.querySelector('.market-section-label');

    _searchEl.addEventListener('input', () => {
      clearTimeout(_searchTimer);
      _searchTimer = setTimeout(() => this._onSearch(_searchEl.value.trim()), 250);
    });
  },

  show() {
    if (!_container) return;
    if (!_allItems) this._buildPool();
    if (_recommended.length === 0) {
      _recommended = this._pickBalanced();
      this._render(_recommended);
      _labelEl.textContent = 'Recommended';
    }
  },

  hide() { /* no teardown needed */ },

  // ── Internal ───────────────────────────────────────────────────────────────

  _buildPool() {
    _allItems = [];
    for (const c of CaseDataStore.getCaseList()) {
      for (const tier of RARITY_TIERS) {
        for (const it of CaseDataStore.getItems(c.id, tier)) {
          _allItems.push({ ...it, rarity: tier, case_id: c.id, case_name: c.name });
        }
      }
    }
  },

  /** Picks `n` random skins and returns all 10 variants (5 normal + 5 StatTrak™) for each. */
  _pickBalanced(n = RECOMMEND_SKINS) {
    if (!_allItems?.length) return [];
    return [..._allItems]
      .sort(() => Math.random() - 0.5)
      .slice(0, n)
      .flatMap(it => LISTING_VARIANTS.map(v => _makeListing(it, v.tier, v.statTrak)));
  },

  _onSearch(query) {
    if (!query) {
      _labelEl.textContent = 'Recommended';
      this._render(_recommended);
      return;
    }
    const q = query.toLowerCase();
    const matchedSkins = (_allItems ?? [])
      .filter(it => {
        const name     = `${it.weapon} ${it.skin}`.toLowerCase();
        const caseName = (it.case_name ?? '').toLowerCase();
        return name.includes(q) || caseName.includes(q);
      })
      .slice(0, SEARCH_SKINS);

    const results = matchedSkins.flatMap(it => LISTING_VARIANTS.map(v => _makeListing(it, v.tier, v.statTrak)));

    _labelEl.textContent = matchedSkins.length
      ? `Results for "${query}" (${matchedSkins.length} skin${matchedSkins.length !== 1 ? 's' : ''})`
      : `No results for "${query}"`;
    this._render(results);
  },

  _render(listings) {
    if (!_listEl) return;
    _listEl.innerHTML = '';
    if (!listings.length) {
      const empty = document.createElement('div');
      empty.className   = 'market-empty';
      empty.textContent = 'No skins found.';
      _listEl.appendChild(empty);
      return;
    }
    const frag = document.createDocumentFragment();
    listings.forEach(l => frag.appendChild(this._makeRow(l)));
    _listEl.appendChild(frag);
  },

  _makeRow(listing) {
    const { item, floatVal, wearTier, adjPrice, statTrak } = listing;
    const displayName = _formatItemName(item.weapon, item.skin);
    const wearLabel   = FloatService.getWearLabel(wearTier);

    const row = document.createElement('div');
    row.className = `market-row rarity-${item.rarity ?? 'unknown'}${statTrak ? ' market-row--st' : ''}`;

    // ── Image ────────────────────────────────────────────────────────────────
    const img = SkinImageLoader.getLazyImage(item.image_url ?? null, item.rarity);
    img.className = 'market-row-img';
    img.alt       = displayName;

    // ── Info (name + case/rarity) ─────────────────────────────────────────
    const info = document.createElement('div');
    info.className = 'market-row-info';

    const nameEl = document.createElement('div');
    nameEl.className = 'market-row-name';
    if (statTrak) {
      const stSpan = document.createElement('span');
      stSpan.className   = 'stat-trak-prefix';
      stSpan.textContent = 'StatTrak™ ';
      nameEl.appendChild(stSpan);
      nameEl.appendChild(document.createTextNode(displayName));
    } else {
      nameEl.textContent = displayName;
    }

    const metaEl = document.createElement('div');
    metaEl.className   = 'market-row-meta';
    metaEl.textContent = `${item.case_name ?? '?'} · ${_formatRarity(item.rarity)}`;

    info.appendChild(nameEl);
    info.appendChild(metaEl);

    // ── Float block (scale bar + badge + value) ────────────────────────────
    const floatBlock = document.createElement('div');
    floatBlock.className = 'market-float-block';

    floatBlock.appendChild(_makeFloatScale(floatVal));

    const floatLabel = document.createElement('div');
    floatLabel.className = 'market-float-label';

    const badge = document.createElement('span');
    badge.className   = `wear-badge wear-${wearTier}`;
    badge.textContent = wearLabel;

    const floatNum = document.createElement('span');
    floatNum.className   = 'market-float-num';
    floatNum.textContent = FloatService.formatFloat(floatVal);

    floatLabel.appendChild(badge);
    floatLabel.appendChild(floatNum);
    floatBlock.appendChild(floatLabel);

    // ── Price ─────────────────────────────────────────────────────────────
    const priceEl = document.createElement('div');
    priceEl.className   = 'market-row-price';
    priceEl.textContent = `$${adjPrice.toFixed(2)}`;

    // ── Buy button ────────────────────────────────────────────────────────
    const buyBtn = document.createElement('button');
    buyBtn.className   = 'btn-market-buy';
    buyBtn.textContent = 'Buy';
    buyBtn.addEventListener('click', () => this._handleBuy(listing, buyBtn, row));

    row.appendChild(img);
    row.appendChild(info);
    row.appendChild(floatBlock);
    row.appendChild(priceEl);
    row.appendChild(buyBtn);
    return row;
  },

  _handleBuy(listing, buyBtn, row) {
    const { item, adjPrice, statTrak } = listing;

    if (!VirtualEconomy.canAfford(adjPrice)) {
      row.classList.add('market-row--no-funds');
      setTimeout(() => row.classList.remove('market-row--no-funds'), 700);
      return;
    }

    buyBtn.disabled = true;
    VirtualEconomy.spend(adjPrice);

    // Issue a fresh float for the item the player actually receives
    const receivedFloat = FloatService.generateFloat();
    const receivedTier  = FloatService.getWearTier(receivedFloat);
    const basePrice     = item.market_price ?? 0;
    const receivedAdj   = Math.round(basePrice * FloatService.getPriceMultiplier(receivedFloat) * 100) / 100;
    const receivedPrice = statTrak ? Math.round(receivedAdj * STAT_TRAK_MULTIPLIER * 100) / 100 : receivedAdj;
    SkinInventory.addItem({ ...item, float: receivedFloat, wear_tier: receivedTier, market_price: receivedPrice, stat_trak: statTrak });

    buyBtn.textContent = 'Bought!';
    buyBtn.classList.add('btn-market-buy--done');

    setTimeout(() => {
      // Refresh this row with a new float, preserving the StatTrak™ status
      const fresh  = _makeListing(item, listing.wearTier, statTrak);
      const newRow = this._makeRow(fresh);
      row.replaceWith(newRow);
    }, 1200);
  },
};

// ── Module helpers ─────────────────────────────────────────────────────────────

function _makeListing(item, forceTier = null, statTrak = false) {
  const floatVal  = forceTier
    ? FloatService.generateFloatForTier(forceTier)
    : FloatService.generateFloat();
  const wearTier  = FloatService.getWearTier(floatVal);
  const basePrice = item.market_price ?? 0;
  const adj       = Math.round(basePrice * FloatService.getPriceMultiplier(floatVal) * 100) / 100;
  const adjPrice  = statTrak ? Math.round(adj * STAT_TRAK_MULTIPLIER * 100) / 100 : adj;
  return { item, floatVal, wearTier, adjPrice, statTrak };
}

function _makeFloatScale(floatVal) {
  const wrap   = document.createElement('div');
  wrap.className = 'float-scale';
  const bar    = document.createElement('div');
  bar.className = 'float-scale-bar';
  const marker = document.createElement('div');
  marker.className   = 'float-scale-marker';
  marker.style.left  = `${(floatVal * 100).toFixed(4)}%`;
  bar.appendChild(marker);
  wrap.appendChild(bar);
  return wrap;
}

function _formatItemName(weapon, skin) {
  if (skin && skin.startsWith('★')) {
    const bare = skin.slice(1).trim();
    if (bare.toLowerCase() === 'vanilla') return `★ ${weapon}`;
    return `★ ${weapon} | ${bare}`;
  }
  return `${weapon} | ${skin}`;
}

function _formatRarity(rarity) {
  if (!rarity) return '';
  return rarity.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
