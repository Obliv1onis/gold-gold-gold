import { CaseDataStore }  from '../foundation/case-data-store.js';
import { PriceAPILayer }  from '../feature/price-api-layer.js';
import { Events }         from '../foundation/events.js';
import { i18n }           from '../foundation/i18n.js';
import { createCatalogToolbar, focusCatalogSearch, matchesCatalogQuery } from './catalog-toolbar.js';

let _container      = null;
let _onSelect       = null;
let _activeFilter   = null; // 'weapon_case' | 'souvenir_package' | null (all)
let _query          = '';
let _sort           = 'newest';

/**
 * Grid of all available cases. Clicking a card fires onSelect(caseId, casePrice).
 * Cards are non-interactive until a live Steam price has loaded.
 *
 * @example
 * CaseBrowserUI.init(container, { onSelect: (caseId, price) => { ... } });
 * // On tab navigation:
 * CaseBrowserUI.show();
 */
export const CaseBrowserUI = {
  /**
   * @param {HTMLElement} container
   * @param {{ onSelect: (caseId: string, casePrice: number) => void }} opts
   */
  init(container, { onSelect }) {
    _container = container;
    _onSelect  = onSelect;
    this._render();

    document.addEventListener('locale-changed', () => this._render());

    // When a live price arrives, replace the placeholder with the real Steam price
    document.addEventListener(Events.PRICE_UPDATED, e => {
      const { hashName, price } = e.detail;
      _container?.querySelectorAll(`[data-hash-name="${CSS.escape(hashName)}"]`).forEach(el => {
        el.textContent = `$${price.toFixed(2)}`;
        el.classList.remove('case-card-price--loading');
        el.classList.add('case-card-price--live');
        const card = el.closest('.case-card');
        if (card) card.dataset.livePrice = price;
      });
    });
  },

  /** Re-render for a category and prefetch prices. */
  show(filter = null) {
    if (!_container) return;
    _activeFilter = filter;
    this._render();
    const cases = filter ? CaseDataStore.getCaseList(filter) : CaseDataStore.getCaseList();
    cases.forEach(c => {
      PriceAPILayer.prefetch(PriceAPILayer.buildCaseHashName(c.name ?? c.id));
    });
  },

  hide() { /* no teardown needed */ },

  _render() {
    if (!_container) return;
    _container.innerHTML = '';

    const sections = _activeFilter === 'weapon_case'
      ? [{ type: 'terminal', titleKey: 'sec_terminals' }, { type: 'weapon_case', titleKey: 'sec_cases' }]
      : _activeFilter
        ? [{ type: _activeFilter, titleKey: _activeFilter === 'souvenir_package' ? 'sec_souvenirs' : 'sec_cases' }]
        : [{ type: 'weapon_case', titleKey: 'sec_cases' }, { type: 'souvenir_package', titleKey: 'sec_souvenirs' }];

    const allLists = sections.map(section => ({
      ...section,
      list: CaseDataStore.getCaseList(section.type),
    }));
    const totalCount = allLists.reduce((sum, section) => sum + section.list.length, 0);
    const visibleLists = allLists.map(section => ({
      ...section,
      list: section.list
        .filter(item => matchesCatalogQuery(item, _query))
        .sort(_caseSort),
    }));
    const visibleCount = visibleLists.reduce((sum, section) => sum + section.list.length, 0);

    _container.appendChild(createCatalogToolbar({
      query: _query,
      visibleCount,
      totalCount,
      sort: _sort,
      sortOptions: [
        { value: 'newest', labelKey: 'catalog_newest' },
        { value: 'oldest', labelKey: 'catalog_oldest' },
        { value: 'name', labelKey: 'catalog_name' },
      ],
      onQueryChange: value => {
        _query = value;
        this._render();
        focusCatalogSearch(_container);
      },
      onSortChange: value => {
        _sort = value;
        this._render();
      },
    }));

    let anyItems = false;
    for (const { titleKey, list } of visibleLists) {
      if (list.length) {
        _container.appendChild(_makeSection(i18n.t(titleKey), list));
        anyItems = true;
      }
    }

    if (!anyItems) {
      const msg = document.createElement('div');
      msg.className   = 'browser-empty';
      msg.textContent = totalCount ? i18n.t('catalog_no_results') : i18n.t('no_cases');
      _container.appendChild(msg);
    }
  },
};

function _caseSort(a, b) {
  const byName = i18n.caseName(a.name).localeCompare(i18n.caseName(b.name), i18n.getLocale());
  if (_sort === 'name') return byName;
  if (!a.release_date && !b.release_date) return byName;
  if (!a.release_date) return 1;
  if (!b.release_date) return -1;
  const direction = _sort === 'oldest' ? 1 : -1;
  return direction * a.release_date.localeCompare(b.release_date) || byName;
}

function _makeSection(title, caseList) {
  const section = document.createElement('div');
  section.className = 'browser-section';

  const header = document.createElement('h2');
  header.className   = 'section-header';
  header.textContent = title;

  const grid = document.createElement('div');
  grid.className = 'case-grid';
  caseList.forEach(c => grid.appendChild(_makeCard(c, _onSelect)));

  section.appendChild(header);
  section.appendChild(grid);
  return section;
}

function _makeCard(caseData, onSelect) {
  const hashName  = PriceAPILayer.buildCaseHashName(caseData.name ?? caseData.id);
  const livePrice = PriceAPILayer.getCachedPrice(hashName);

  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'case-card';

  card.addEventListener('click', () => {
    // Prefer live price; fall back to JSON placeholder while Steam price is loading
    const live = card.dataset.livePrice ? parseFloat(card.dataset.livePrice) : null;
    onSelect?.(caseData.id, live ?? caseData.market_price ?? 0.50);
  });

  if (caseData.image_url) {
    const img = new Image();
    img.src       = caseData.image_url;
    img.alt       = caseData.name ?? '';
    img.className = 'case-card-image';
    img.loading   = 'lazy';
    img.decoding  = 'async';
    card.appendChild(img);
  } else {
    const ph = document.createElement('div');
    ph.className = 'case-card-image-placeholder';
    card.appendChild(ph);
  }

  const name = document.createElement('div');
  name.className   = 'case-card-name';
  name.textContent = i18n.caseName(caseData.name ?? caseData.id);

  const price = document.createElement('div');
  price.className        = 'case-card-price';
  price.dataset.hashName = hashName;
  if (livePrice !== null) {
    price.textContent = `$${livePrice.toFixed(2)}`;
    price.classList.add('case-card-price--live');
    card.dataset.livePrice = livePrice;
  } else {
    price.textContent = `$${(caseData.market_price ?? 0).toFixed(2)}`;
    price.classList.add('case-card-price--loading');
  }

  card.appendChild(name);
  card.appendChild(price);

  // Kick off live price fetch in the background; display updates via PRICE_UPDATED
  PriceAPILayer.prefetch(hashName);

  return card;
}
