import { CapsuleDataStore } from '../foundation/capsule-data-store.js';

let _container = null;
let _onSelect  = null;

export const CapsuleBrowserUI = {
  init(container, { onSelect }) {
    _container = container;
    _onSelect  = onSelect;
  },

  show() {
    if (!_container) return;
    this._render();
  },

  hide() {},

  _render() {
    _container.innerHTML = '';

    const section = document.createElement('div');
    section.className = 'browser-section';

    const header = document.createElement('h2');
    header.className   = 'section-header';
    header.textContent = 'Sticker Capsules';
    section.appendChild(header);

    const grid = document.createElement('div');
    grid.className = 'case-grid';

    for (const capsule of CapsuleDataStore.getCapsuleList()) {
      grid.appendChild(_makeCard(capsule, _onSelect));
    }

    section.appendChild(grid);
    _container.appendChild(section);
  },
};

function _makeCard(capsule, onSelect) {
  const card = document.createElement('div');
  card.className = 'case-card';

  card.addEventListener('click', () => {
    onSelect?.(capsule.id, capsule.price);
  });

  if (capsule.image_url) {
    const img = new Image();
    img.src       = capsule.image_url;
    img.alt       = capsule.name;
    img.className = 'case-card-image';
    card.appendChild(img);
  } else {
    const ph = document.createElement('div');
    ph.className = 'case-card-image-placeholder';
    card.appendChild(ph);
  }

  const name = document.createElement('div');
  name.className   = 'case-card-name';
  name.textContent = capsule.name;

  const price = document.createElement('div');
  price.className   = 'case-card-price case-card-price--live';
  price.textContent = `$${capsule.price.toFixed(2)}`;

  card.appendChild(name);
  card.appendChild(price);
  return card;
}
