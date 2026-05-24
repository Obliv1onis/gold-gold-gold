import { CaseDataStore }   from '../foundation/case-data-store.js';
import { FloatService }    from '../foundation/float-service.js';
import { SkinImageLoader } from '../feature/skin-image-loader.js';
import { VirtualEconomy }  from '../core/virtual-economy.js';
import { SkinInventory }   from '../core/skin-inventory.js';

const RARITY_TIERS    = ['mil_spec', 'restricted', 'classified', 'covert', 'rare_special'];
const RECOMMEND_COUNT = 20;
const SEARCH_LIMIT    = 60;

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
      _recommended = this._pick(RECOMMEND_COUNT);
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

  _pick(n) {
    if (!_allItems?.length) return [];
    return [..._allItems]
      .sort(() => Math.random() - 0.5)
      .slice(0, n)
      .map(it => _makeListing(it));
  },

  _onSearch(query) {
    if (!query) {
      _labelEl.textContent = 'Recommended';
      this._render(_recommended);
      return;
    }
    const q = query.toLowerCase();
    const results = (_allItems ?? [])
      .filter(it => {
        const name     = `${it.weapon} ${it.skin}`.toLowerCase();
        const caseName = (it.case_name ?? '').toLowerCase();
        return name.includes(q) || caseName.includes(q);
      })
      .slice(0, SEARCH_LIMIT)
      .map(it => _makeListing(it));

    _labelEl.textContent = results.length
      ? `Results for "${query}" (${results.length})`
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
    const { item, floatVal, wearTier, adjPrice } = listing;
    const displayName = _formatItemName(item.weapon, item.skin);
    const wearLabel   = FloatService.getWearLabel(wearTier);

    const row = document.createElement('div');
    row.className = `market-row rarity-${item.rarity ?? 'unknown'}`;

    // ── Image ────────────────────────────────────────────────────────────────
    const img = SkinImageLoader.getImage(item.image_url ?? null, item.rarity);
    img.className = 'market-row-img';
    img.alt       = displayName;

    // ── Info (name + case/rarity) ─────────────────────────────────────────
    const info = document.createElement('div');
    info.className = 'market-row-info';

    const nameEl = document.createElement('div');
    nameEl.className   = 'market-row-name';
    nameEl.textContent = displayName;

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
    const { item, floatVal, wearTier, adjPrice } = listing;

    if (!VirtualEconomy.canAfford(adjPrice)) {
      row.classList.add('market-row--no-funds');
      setTimeout(() => row.classList.remove('market-row--no-funds'), 700);
      return;
    }

    buyBtn.disabled = true;
    VirtualEconomy.spend(adjPrice);
    SkinInventory.addItem({ ...item, float: floatVal, wear_tier: wearTier, market_price: adjPrice });

    buyBtn.textContent = 'Bought!';
    buyBtn.classList.add('btn-market-buy--done');

    setTimeout(() => {
      // Refresh this row with a new float so the listing stays live
      const fresh  = _makeListing(item);
      const newRow = this._makeRow(fresh);
      row.replaceWith(newRow);
    }, 1200);
  },
};

// ── Module helpers ─────────────────────────────────────────────────────────────

function _makeListing(item) {
  const floatVal  = FloatService.generateFloat();
  const wearTier  = FloatService.getWearTier(floatVal);
  const basePrice = item.market_price ?? 0;
  const adjPrice  = Math.round(basePrice * FloatService.getPriceMultiplier(floatVal) * 100) / 100;
  return { item, floatVal, wearTier, adjPrice };
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
