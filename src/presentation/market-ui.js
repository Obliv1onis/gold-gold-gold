import { CaseDataStore }    from '../foundation/case-data-store.js';
import { CapsuleDataStore } from '../foundation/capsule-data-store.js';
import { FloatService }     from '../foundation/float-service.js';
import { SkinImageLoader }  from '../feature/skin-image-loader.js';
import { PriceAPILayer }    from '../feature/price-api-layer.js';
import { VirtualEconomy }   from '../core/virtual-economy.js';
import { SkinInventory }    from '../core/skin-inventory.js';
import { Events }           from '../foundation/events.js';

const RARITY_TIERS      = ['mil_spec', 'restricted', 'classified', 'covert', 'rare_special'];
const WEAR_TIERS        = ['fn', 'mw', 'ft', 'ww', 'bs'];
const STAT_TRAK_MULTIPLIER = 1.50;
// 10 variants per skin: 5 normal + 5 StatTrak™
const LISTING_VARIANTS  = [
  ...WEAR_TIERS.map(tier => ({ tier, statTrak: false })),
  ...WEAR_TIERS.map(tier => ({ tier, statTrak: true  })),
];
const RECOMMEND_SKINS   = 2;   // × 10 variants = 20 rows
const SEARCH_SKINS      = 6;   // × 10 variants = 60 rows
const SEARCH_CAP_ITEMS  = 30;  // capsule items have 1 variant each

// Contraband items exist only in the market — not in any case, not in trade-ups.
const CONTRABAND_ITEMS = [
  {
    id:          'm4a4_howl',
    weapon:      'M4A4',
    skin:        'Howl',
    rarity:      'contraband',
    market_price: 2500,
    image_url:   'https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyL8ypexwiFO0P_6afVSKP-EAm6extF6ueZhW2exwkl2tmTXwt39eCiUPQR2DMN4TOVetUK8xoLgM-K341eM2otDnC6okGoXufBz_TAB',
    wear_tiers:  ['fn', 'mw', 'ft', 'ww'],  // max float 0.4 — no Battle-Scarred
    case_id:     null,
    case_name:   null,
  },
];

let _container    = null;
let _allItems     = null;   // weapon/souvenir skins — built lazily on first show()
let _capsuleItems = null;   // stickers, charms, patches, pins, music kits
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

    // Update price elements and buy buttons when a live price arrives
    document.addEventListener(Events.PRICE_UPDATED, e => {
      const { hashName, price } = e.detail;
      _listEl?.querySelectorAll('[data-hash-name]').forEach(el => {
        if (el.dataset.hashName !== hashName) return;
        if (el.classList.contains('market-row-price')) {
          el.textContent = `$${price.toFixed(2)}`;
          el.classList.remove('market-row-price--loading');
          el.classList.add('market-row-price--live');
        } else if (el.classList.contains('btn-market-buy')) {
          el.disabled = false;
        }
      });
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
    // Kick off price fetches for everything currently visible
    _recommended.forEach(l => PriceAPILayer.prefetch(l.hashName));
  },

  hide() { /* no teardown needed */ },

  // ── Internal ───────────────────────────────────────────────────────────────

  _buildPool() {
    // ── Weapon / souvenir skins ───────────────────────────────────────────────
    const raw = [];
    for (const c of CaseDataStore.getCaseList()) {
      const isSouvenir = c.type === 'souvenir_package';
      for (const tier of RARITY_TIERS) {
        for (const it of CaseDataStore.getItems(c.id, tier)) {
          raw.push({ ...it, rarity: tier, case_id: c.id, case_name: c.name, isSouvenir });
        }
      }
    }
    for (const it of CONTRABAND_ITEMS) {
      raw.push({ ...it, isSouvenir: false });
    }
    const seen = new Set();
    _allItems = raw.filter(it => {
      if (it.rarity !== 'rare_special' && !it.isSouvenir) return true;
      const key = `${it.weapon}|${it.skin}`;
      if (seen.has(key)) return false;
      seen.add(key);
      it.case_name = null;
      return true;
    });

    // ── Capsule items (stickers, charms, patches, pins, music kits) ───────────
    const seenCap = new Set();
    _capsuleItems = CapsuleDataStore.getAllItems()
      .filter(it => {
        const key = it.market_hash_name ?? it.name;
        if (seenCap.has(key)) return false;
        seenCap.add(key);
        return true;
      })
      .map(it => ({ ...it, isCapsuleItem: true }));
  },

  /** Picks `n` random skins and returns all wear variants for each (gloves skip StatTrak™). */
  _pickBalanced(n = RECOMMEND_SKINS) {
    if (!_allItems?.length) return [];
    return [..._allItems]
      .sort(() => Math.random() - 0.5)
      .slice(0, n)
      .flatMap(it => _variantsFor(it).map(v => _makeListing(it, v.tier, v.statTrak)));
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

    const matchedCaps = (_capsuleItems ?? [])
      .filter(it => {
        const name = (it.name ?? '').toLowerCase();
        const src  = (it.capsuleName ?? '').toLowerCase();
        return name.includes(q) || src.includes(q);
      })
      .slice(0, SEARCH_CAP_ITEMS);

    const skinListings = matchedSkins.flatMap(it =>
      _variantsFor(it).map(v => _makeListing(it, v.tier, v.statTrak))
    );
    const capListings = matchedCaps.map(it => _makeCapsuleListing(it));

    const results   = [...skinListings, ...capListings];
    const totalHits = matchedSkins.length + matchedCaps.length;
    _labelEl.textContent = totalHits
      ? `Results for "${query}" (${totalHits} item${totalHits !== 1 ? 's' : ''})`
      : `No results for "${query}"`;
    this._render(results);
    results.forEach(l => PriceAPILayer.prefetch(l.hashName));
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
    const { item, floatVal, wearTier, statTrak, hashName, localPrice } = listing;
    const isCap       = !!item.isCapsuleItem;
    const displayName = isCap ? item.name : _formatItemName(item.weapon, item.skin);
    const hasFloat    = !isCap && floatVal !== null && wearTier !== null;

    const row = document.createElement('div');
    row.className = `market-row rarity-${item.rarity ?? 'unknown'}${statTrak ? ' market-row--st' : ''}`;

    // ── Image ────────────────────────────────────────────────────────────────
    const img = SkinImageLoader.getLazyImage(item.image_url ?? null, item.rarity);
    img.className = 'market-row-img';
    img.alt       = displayName;

    // ── Info (name + meta) ────────────────────────────────────────────────
    const info = document.createElement('div');
    info.className = 'market-row-info';

    const nameEl = document.createElement('div');
    nameEl.className   = 'market-row-name';
    nameEl.textContent = displayName;

    const metaEl = document.createElement('div');
    metaEl.className = 'market-row-meta';
    if (isCap) {
      metaEl.textContent = `${_capsuleTypeLabel(item.capsuleType)} · ${_formatRarity(item.rarity)}`;
    } else {
      const caseLabel = item.case_name ?? (item.rarity === 'contraband' ? 'Contraband Item' : null);
      metaEl.textContent = caseLabel
        ? `${caseLabel} · ${_formatRarity(item.rarity)}`
        : _formatRarity(item.rarity);
    }

    info.appendChild(nameEl);
    info.appendChild(metaEl);

    // ── Float block — hidden for vanilla knives ───────────────────────────
    const floatBlock = document.createElement('div');
    floatBlock.className = 'market-float-block';
    if (hasFloat) {
      floatBlock.appendChild(_makeFloatScale(floatVal));

      const floatLabel = document.createElement('div');
      floatLabel.className = 'market-float-label';

      const badge = document.createElement('span');
      badge.className   = `wear-badge wear-${wearTier}`;
      badge.textContent = FloatService.getWearLabel(wearTier);

      const floatNum = document.createElement('span');
      floatNum.className   = 'market-float-num';
      floatNum.textContent = FloatService.formatFloat(floatVal);

      floatLabel.appendChild(badge);
      floatLabel.appendChild(floatNum);
      floatBlock.appendChild(floatLabel);
    }

    // ── Price — Steam live price overrides local fallback when it arrives ─
    const livePrice    = PriceAPILayer.getCachedPrice(hashName);
    const displayPrice = livePrice ?? localPrice;

    const priceEl = document.createElement('div');
    priceEl.className        = 'market-row-price';
    priceEl.dataset.hashName = hashName;
    if (displayPrice !== null) {
      priceEl.textContent = `$${displayPrice.toFixed(2)}`;
      priceEl.classList.toggle('market-row-price--live', livePrice !== null);
    } else {
      priceEl.textContent = '—';
      priceEl.classList.add('market-row-price--loading');
    }

    // ── Buy button — enabled when any price is available ─────────────────
    const buyBtn = document.createElement('button');
    buyBtn.className   = 'btn-market-buy';
    buyBtn.textContent = 'Buy';
    buyBtn.disabled    = displayPrice === null;
    buyBtn.dataset.hashName = hashName;
    buyBtn.addEventListener('click', () => this._handleBuy(listing, buyBtn, row));

    row.appendChild(img);
    row.appendChild(info);
    row.appendChild(floatBlock);
    row.appendChild(priceEl);
    row.appendChild(buyBtn);
    return row;
  },

  _handleBuy(listing, buyBtn, row) {
    const { item, statTrak, hashName, wearTier, localPrice } = listing;

    const buyPrice = PriceAPILayer.getCachedPrice(hashName) ?? localPrice;

    if (buyPrice === null || !VirtualEconomy.canAfford(buyPrice)) {
      row.classList.add('market-row--no-funds');
      setTimeout(() => row.classList.remove('market-row--no-funds'), 700);
      return;
    }

    buyBtn.disabled = true;
    VirtualEconomy.spend(buyPrice);

    if (item.isCapsuleItem) {
      SkinInventory.addItem({ ...item, market_price: buyPrice, stat_trak: false });
    } else {
      const receivedFloat = wearTier ? FloatService.generateFloatForTier(wearTier) : null;
      const receivedTier  = receivedFloat !== null ? FloatService.getWearTier(receivedFloat) : null;
      SkinInventory.addItem({ ...item, float: receivedFloat, wear_tier: receivedTier, market_price: buyPrice, stat_trak: statTrak });
    }

    buyBtn.textContent = 'Bought!';
    buyBtn.classList.add('btn-market-buy--done');

    setTimeout(() => {
      const fresh  = item.isCapsuleItem
        ? _makeCapsuleListing(item)
        : _makeListing(item, listing.wearTier, statTrak);
      const newRow = this._makeRow(fresh);
      row.replaceWith(newRow);
    }, 1200);
  },
};

// ── Module helpers ─────────────────────────────────────────────────────────────

function _makeListing(item, forceTier = null, statTrak = false) {
  const vanilla    = _isVanilla(item);
  const floatVal   = vanilla ? null : (forceTier ? FloatService.generateFloatForTier(forceTier) : FloatService.generateFloat());
  const wearTier   = vanilla ? null : FloatService.getWearTier(floatVal);
  const isSouvenir = item.isSouvenir ?? (CaseDataStore.getCase(item.case_id)?.type === 'souvenir_package');
  const hashName   = PriceAPILayer.buildSkinHashName(item, wearTier, statTrak, isSouvenir);
  const localPrice = _localPrice(item, wearTier, statTrak);
  return { item, floatVal, wearTier, statTrak, hashName, localPrice };
}

// Wear-tier price multipliers relative to Field-Tested baseline
const WEAR_MULT = { fn: 3.0, mw: 1.5, ft: 1.0, ww: 0.65, bs: 0.45 };

// Souvenir item market_price in the JSON data stores the PACKAGE price (e.g. $2),
// not the individual skin price. Use rarity-based estimates when the stored value
// looks like a package price (< $20).
const SOUVENIR_RARITY_ESTIMATE = {
  covert:          1200,
  classified:        80,
  restricted:        12,
  mil_spec:           2,
  consumer_grade:  0.50,
  industrial_grade: 0.50,
};

function _localPrice(item, wearTier, statTrak) {
  let base = item.market_price ?? null;
  if (base === null) return null;

  if (item.isSouvenir && base < 20) {
    base = SOUVENIR_RARITY_ESTIMATE[item.rarity] ?? 5;
  }

  const wearMult = WEAR_MULT[wearTier] ?? 1.0;
  const stMult   = statTrak ? 1.5 : 1.0;
  return Math.round(base * wearMult * stMult * 100) / 100;
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

function _isGlove(weapon) {
  return typeof weapon === 'string' && (weapon.includes('Gloves') || weapon.includes('Wraps'));
}

function _isVanilla(item) {
  return item.skin?.startsWith('★') && item.skin.slice(1).trim().toLowerCase() === 'vanilla';
}

/** Returns the applicable listing variants for an item.
 *  - Gloves: 5 wear tiers, no StatTrak™
 *  - Vanilla knives: single listing, no wear tier
 *  - Everything else: 5 normal + 5 StatTrak™ wear tiers
 */
function _variantsFor(item) {
  if (item.rarity === 'contraband') return (item.wear_tiers ?? WEAR_TIERS).map(tier => ({ tier, statTrak: false }));
  const isSouvenir = CaseDataStore.getCase(item.case_id)?.type === 'souvenir_package';
  if (isSouvenir)             return WEAR_TIERS.map(tier => ({ tier, statTrak: false }));
  if (_isGlove(item.weapon))  return WEAR_TIERS.map(tier => ({ tier, statTrak: false }));
  if (_isVanilla(item))       return [{ tier: null, statTrak: false }, { tier: null, statTrak: true }];
  return LISTING_VARIANTS;
}

function _formatRarity(rarity) {
  if (!rarity) return '';
  return rarity.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function _makeCapsuleListing(item) {
  const hashName   = item.market_hash_name ?? item.name;
  const localPrice = item.market_price ?? null;
  return { item, floatVal: null, wearTier: null, statTrak: false, hashName, localPrice };
}

const CAPSULE_TYPE_LABELS = {
  sticker_capsule: 'Sticker',
  charm_capsule:   'Charm',
  patch_pack:      'Patch',
  pin_capsule:     'Collectible Pin',
  music_kit_box:   'Music Kit',
};

function _capsuleTypeLabel(capsuleType) {
  return CAPSULE_TYPE_LABELS[capsuleType] ?? 'Item';
}
