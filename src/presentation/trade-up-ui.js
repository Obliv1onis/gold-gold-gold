import { SkinInventory }  from '../core/skin-inventory.js';
import { TradeUpEngine, CONTRACT_SIZE } from '../core/trade-up-engine.js';
import { SkinImageLoader }from '../feature/skin-image-loader.js';
import { FloatService }   from '../foundation/float-service.js';
import { CaseDataStore }  from '../foundation/case-data-store.js';
import { Events }         from '../foundation/events.js';

const ELIGIBLE_RARITIES = new Set(['mil_spec', 'restricted', 'classified']);

// ─── Module state ─────────────────────────────────────────────────────────────

let _container  = null;
let _slots      = new Array(CONTRACT_SIZE).fill(null); // {instanceId, item} | null
let _slotsEl    = null;
let _countEl    = null;
let _avgFloatEl = null;
let _tradeBtn   = null;
let _invGridEl  = null;
let _invEmptyEl = null;
let _resultEl   = null;
let _contractEl = null;
let _invSectionEl = null;

/**
 * Trade-Up Contract page.
 * Allows the player to exchange 10 skins of the same rarity for one random
 * skin of the next rarity tier. StatTrak™ skins may only be combined with
 * other StatTrak™ skins.
 *
 * @example
 * TradeUpUI.init(document.querySelector('.tradeup-container'));
 * // Navigation:
 * TradeUpUI.show(); TradeUpUI.hide();
 */
export const TradeUpUI = {
  /**
   * @param {HTMLElement} container
   */
  init(container) {
    _container = container;
    container.innerHTML = `
      <div class="tradeup-page">

        <div class="tradeup-contract" id="tradeup-contract">
          <div class="tradeup-contract-bar">
            <div class="tradeup-bar-left">
              <span class="tradeup-count">0 / ${CONTRACT_SIZE}</span>
              <span class="tradeup-avg-float"></span>
            </div>
            <button class="btn-tradeup" disabled>Trade Up →</button>
          </div>
          <div class="tradeup-slots-grid"></div>
          <div class="tradeup-hint">Select 10 skins of the same rarity (Mil-Spec / Restricted / Classified)</div>
        </div>

        <div class="tradeup-inventory" id="tradeup-inventory">
          <div class="tradeup-inv-label">Your Skins</div>
          <div class="tradeup-inv-grid"></div>
          <div class="tradeup-inv-empty">No eligible skins in inventory.</div>
        </div>

        <div class="tradeup-result" hidden></div>

      </div>
    `;

    _slotsEl      = container.querySelector('.tradeup-slots-grid');
    _countEl      = container.querySelector('.tradeup-count');
    _avgFloatEl   = container.querySelector('.tradeup-avg-float');
    _tradeBtn     = container.querySelector('.btn-tradeup');
    _invGridEl    = container.querySelector('.tradeup-inv-grid');
    _invEmptyEl   = container.querySelector('.tradeup-inv-empty');
    _resultEl     = container.querySelector('.tradeup-result');
    _contractEl   = container.querySelector('#tradeup-contract');
    _invSectionEl = container.querySelector('#tradeup-inventory');

    _tradeBtn.addEventListener('click', () => this._executeTradeUp());

    document.addEventListener(Events.SKIN_INVENTORY_CHANGED, () => {
      // Remove any slots whose item was sold/consumed outside this UI
      const ids = new Set(SkinInventory.getItems().map(e => e.instanceId));
      let changed = false;
      for (let i = 0; i < _slots.length; i++) {
        if (_slots[i] && !ids.has(_slots[i].instanceId)) {
          _slots[i] = null;
          changed = true;
        }
      }
      this._refreshSlots();
      this._refreshInventory();
    });

    this._refreshSlots();
  },

  show() {
    if (!_container) return;
    this._refreshInventory();
  },

  hide() { /* preserve slot state across tab switches */ },

  // ── Internal ───────────────────────────────────────────────────────────────

  _lockedRarity()   { return _slots.find(Boolean)?.item.rarity  ?? null; },
  _lockedStatTrak() {
    const first = _slots.find(Boolean);
    return first ? !!first.item.stat_trak : null;
  },
  _filledCount()    { return _slots.filter(Boolean).length; },
  _slottedIds()     { return new Set(_slots.filter(Boolean).map(s => s.instanceId)); },

  _isCompatible(entry) {
    const item    = entry.item;
    if (!item.case_id) return false;
    if (!ELIGIBLE_RARITIES.has(item.rarity)) return false;

    const lr = this._lockedRarity();
    if (lr !== null && item.rarity !== lr) return false;

    const lst = this._lockedStatTrak();
    if (lst !== null && !!item.stat_trak !== lst) return false;

    return true;
  },

  _addToSlot(entry) {
    if (this._filledCount() >= CONTRACT_SIZE) return;
    if (this._slottedIds().has(entry.instanceId)) return;
    if (!this._isCompatible(entry)) return;

    const idx = _slots.findIndex(s => s === null);
    if (idx === -1) return;
    _slots[idx] = { instanceId: entry.instanceId, item: entry.item };

    this._refreshSlots();
    this._refreshInventory();
  },

  _removeFromSlot(i) {
    _slots[i] = null;
    this._refreshSlots();
    this._refreshInventory();
  },

  _refreshSlots() {
    if (!_slotsEl) return;
    _slotsEl.innerHTML = '';
    const frag = document.createDocumentFragment();

    for (let i = 0; i < CONTRACT_SIZE; i++) {
      const slot = _slots[i];
      const el   = document.createElement('div');

      if (slot) {
        const item      = slot.item;
        const wearTier  = item.wear_tier ?? FloatService.getWearTier(item.float ?? 0);
        const wearLabel = FloatService.getWearLabel(wearTier);
        const name      = _formatName(item.weapon, item.skin);

        el.className = 'tradeup-slot tradeup-slot--filled';

        const img = SkinImageLoader.getLazyImage(item.image_url ?? null, item.rarity);
        img.className = 'tradeup-slot-img';
        img.alt = name;

        const info = document.createElement('div');
        info.className = 'tradeup-slot-info';

        const badge = document.createElement('span');
        badge.className = `wear-badge wear-${wearTier}`;
        badge.textContent = wearLabel;

        const nameEl = document.createElement('div');
        nameEl.className = 'tradeup-slot-name';
        if (item.stat_trak) {
          const st = document.createElement('span');
          st.className = 'stat-trak-prefix';
          st.textContent = 'ST™ ';
          nameEl.appendChild(st);
        }
        nameEl.appendChild(document.createTextNode(name));

        info.appendChild(badge);
        info.appendChild(nameEl);

        const removeBtn = document.createElement('button');
        removeBtn.className = 'tradeup-slot-remove';
        removeBtn.textContent = '×';
        removeBtn.title = 'Remove';
        removeBtn.addEventListener('click', () => this._removeFromSlot(i));

        el.appendChild(img);
        el.appendChild(info);
        el.appendChild(removeBtn);

      } else {
        el.className = 'tradeup-slot tradeup-slot--empty';
        const num = document.createElement('span');
        num.className = 'tradeup-slot-num';
        num.textContent = i + 1;
        el.appendChild(num);
      }

      frag.appendChild(el);
    }
    _slotsEl.appendChild(frag);

    // Update status bar
    const count = this._filledCount();
    if (_countEl) _countEl.textContent = `${count} / ${CONTRACT_SIZE}`;

    if (_avgFloatEl) {
      const filled = _slots.filter(Boolean);
      if (filled.length > 0) {
        const avg = filled.reduce((s, sl) => s + (sl.item.float ?? 0), 0) / filled.length;
        _avgFloatEl.textContent = `Avg float: ${avg.toFixed(6)}`;
      } else {
        _avgFloatEl.textContent = '';
      }
    }

    if (_tradeBtn) _tradeBtn.disabled = count < CONTRACT_SIZE;
  },

  _refreshInventory() {
    if (!_invGridEl) return;
    const inSlot   = this._slottedIds();
    const allItems = SkinInventory.getItems();

    // Partition into compatible and incompatible
    const compatible   = allItems.filter(e => !inSlot.has(e.instanceId) && this._isCompatible(e));
    const incompatible = allItems.filter(e => !inSlot.has(e.instanceId) && !this._isCompatible(e));

    const eligible = [...compatible, ...incompatible];

    const full = this._filledCount() >= CONTRACT_SIZE;

    if (eligible.length === 0 && allItems.length === 0) {
      _invGridEl.hidden  = true;
      _invEmptyEl.hidden = false;
      return;
    }
    _invGridEl.hidden  = false;
    _invEmptyEl.hidden = true;

    _invGridEl.innerHTML = '';
    const frag = document.createDocumentFragment();

    for (const entry of eligible) {
      const item      = entry.item;
      const compat    = compatible.includes(entry);
      const wearTier  = item.wear_tier ?? FloatService.getWearTier(item.float ?? 0);
      const wearLabel = FloatService.getWearLabel(wearTier);
      const name      = _formatName(item.weapon, item.skin);
      const caseName  = item.case_name ?? CaseDataStore.getCase(item.case_id)?.name ?? item.case_id ?? '—';

      const card = document.createElement('div');
      card.className = `tradeup-inv-item rarity-${item.rarity ?? 'unknown'}${compat && !full ? '' : ' tradeup-inv-item--disabled'}`;
      card.dataset.instanceId = entry.instanceId;

      const img = SkinImageLoader.getLazyImage(item.image_url ?? null, item.rarity);
      img.className = 'tradeup-inv-img';
      img.alt = name;

      const nameEl = document.createElement('div');
      nameEl.className = 'tradeup-inv-name';
      if (item.stat_trak) {
        const st = document.createElement('span');
        st.className = 'stat-trak-prefix';
        st.textContent = 'ST™ ';
        nameEl.appendChild(st);
      }
      nameEl.appendChild(document.createTextNode(name));

      const metaEl = document.createElement('div');
      metaEl.className = 'tradeup-inv-meta';

      const badge = document.createElement('span');
      badge.className = `wear-badge wear-${wearTier}`;
      badge.textContent = wearLabel;

      const floatEl = document.createElement('span');
      floatEl.className = 'tradeup-inv-float';
      floatEl.textContent = item.float != null ? item.float.toFixed(6) : '—';

      metaEl.appendChild(badge);
      metaEl.appendChild(floatEl);

      const caseEl = document.createElement('div');
      caseEl.className = 'tradeup-inv-case';
      caseEl.textContent = caseName;

      card.appendChild(img);
      card.appendChild(nameEl);
      card.appendChild(metaEl);
      card.appendChild(caseEl);

      if (compat && !full) {
        card.addEventListener('click', () => this._addToSlot(entry));
      }

      frag.appendChild(card);
    }

    _invGridEl.appendChild(frag);
  },

  _executeTradeUp() {
    if (this._filledCount() < CONTRACT_SIZE) return;
    _tradeBtn.disabled = true;

    const items = _slots.filter(Boolean).map(s => s.item);
    const instanceIds = _slots.filter(Boolean).map(s => s.instanceId);

    let resultItem;
    try {
      resultItem = TradeUpEngine.execute(items);
    } catch (err) {
      console.error('[TradeUpUI] execute failed:', err.message);
      _tradeBtn.disabled = false;
      return;
    }

    // Add result to inventory first so the event fires with the new item present
    const resultEntry = SkinInventory.addItem(resultItem);
    // Then consume the 10 inputs
    SkinInventory.consumeItems(instanceIds);

    // Reset slots
    _slots.fill(null);

    this._showResult(resultEntry);
  },

  _showResult(entry) {
    if (!_resultEl) return;
    _contractEl?.setAttribute('hidden', '');
    _invSectionEl?.setAttribute('hidden', '');
    _resultEl.removeAttribute('hidden');

    const item     = entry.item;
    const wearTier = item.wear_tier ?? FloatService.getWearTier(item.float ?? 0);
    const name     = _formatName(item.weapon, item.skin);
    const caseName = item.case_name ?? CaseDataStore.getCase(item.case_id)?.name ?? '';

    const img = SkinImageLoader.getLazyImage(item.image_url ?? null, item.rarity);
    img.className = 'tradeup-result-img';
    img.alt = name;

    _resultEl.innerHTML = '';
    const card = document.createElement('div');
    card.className = `tradeup-result-card rarity-${item.rarity ?? 'unknown'}`;

    const heading = document.createElement('div');
    heading.className = 'tradeup-result-heading';
    heading.textContent = 'Trade-Up Result';

    const rarityEl = document.createElement('div');
    rarityEl.className = 'tradeup-result-rarity';
    rarityEl.textContent = _formatRarity(item.rarity);

    const floatRow = document.createElement('div');
    floatRow.className = 'float-row';
    const wbadge = document.createElement('span');
    wbadge.className = `wear-badge wear-${wearTier}`;
    wbadge.textContent = FloatService.getWearLabel(wearTier);
    const floatVal = document.createElement('span');
    floatVal.className = 'float-value';
    floatVal.textContent = item.float != null ? FloatService.formatFloat(item.float) : '—';
    floatRow.appendChild(wbadge);
    floatRow.appendChild(floatVal);

    const nameEl = document.createElement('div');
    nameEl.className = 'tradeup-result-name';
    if (item.stat_trak) {
      const st = document.createElement('span');
      st.className = 'stat-trak-prefix';
      st.textContent = 'StatTrak™ ';
      nameEl.appendChild(st);
    }
    nameEl.appendChild(document.createTextNode(name));

    if (item.stat_trak) {
      const kills = document.createElement('div');
      kills.className = 'stat-trak-kills';
      kills.textContent = '☆ 0 Kills';
      card.appendChild(heading);
      card.appendChild(img);
      card.appendChild(rarityEl);
      card.appendChild(floatRow);
      card.appendChild(nameEl);
      card.appendChild(kills);
    } else {
      card.appendChild(heading);
      card.appendChild(img);
      card.appendChild(rarityEl);
      card.appendChild(floatRow);
      card.appendChild(nameEl);
    }

    if (caseName) {
      const caseEl = document.createElement('div');
      caseEl.className = 'tradeup-result-case';
      caseEl.textContent = caseName;
      card.appendChild(caseEl);
    }

    const priceEl = document.createElement('div');
    priceEl.className = 'tradeup-result-price';
    priceEl.textContent = `$${(item.market_price ?? 0).toFixed(2)}`;
    card.appendChild(priceEl);

    const acceptBtn = document.createElement('button');
    acceptBtn.className = 'btn-tradeup-accept';
    acceptBtn.textContent = 'Accept';
    acceptBtn.addEventListener('click', () => this._dismissResult());
    card.appendChild(acceptBtn);

    _resultEl.appendChild(card);
  },

  _dismissResult() {
    if (!_resultEl) return;
    _resultEl.setAttribute('hidden', '');
    _contractEl?.removeAttribute('hidden');
    _invSectionEl?.removeAttribute('hidden');
    this._refreshSlots();
    this._refreshInventory();
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function _formatName(weapon, skin) {
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
