import { CaseDataStore } from '../foundation/case-data-store.js';

let _container = null;
let _onSelect  = null;

/**
 * Grid of all available cases. Clicking a card fires onSelect(caseId, casePrice).
 *
 * @example
 * CaseBrowserUI.init(container, { onSelect: (caseId, price) => { ... } });
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
  },

  _render() {
    if (!_container) return;
    const cases = CaseDataStore.getCaseList();
    _container.innerHTML = '';

    if (!cases.length) {
      const msg = document.createElement('div');
      msg.className   = 'browser-empty';
      msg.textContent = 'No cases available.';
      _container.appendChild(msg);
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'case-grid';
    cases.forEach(c => grid.appendChild(_makeCard(c, _onSelect)));
    _container.appendChild(grid);
  },
};

function _makeCard(caseData, onSelect) {
  const card = document.createElement('div');
  card.className = 'case-card';
  card.addEventListener('click', () => onSelect?.(caseData.id, caseData.market_price ?? 0.50));

  if (caseData.image_url) {
    const img = new Image();
    img.src       = caseData.image_url;
    img.alt       = caseData.name ?? '';
    img.className = 'case-card-image';
    card.appendChild(img);
  } else {
    const ph = document.createElement('div');
    ph.className = 'case-card-image-placeholder';
    card.appendChild(ph);
  }

  const name = document.createElement('div');
  name.className   = 'case-card-name';
  name.textContent = caseData.name ?? caseData.id;

  const price = document.createElement('div');
  price.className   = 'case-card-price';
  price.textContent = `$${(caseData.market_price ?? 0).toFixed(2)}`;

  card.appendChild(name);
  card.appendChild(price);
  return card;
}
