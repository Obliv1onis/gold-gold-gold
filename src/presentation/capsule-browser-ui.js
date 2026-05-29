import { CapsuleDataStore }  from '../foundation/capsule-data-store.js';
import { makePlaceholder }   from '../feature/item-placeholder.js';

const STICKER_TYPES = ['sticker_capsule'];
const OTHER_TYPES   = ['charm_capsule', 'patch_pack', 'pin_capsule', 'music_kit_box'];

const SECTION_LABELS = {
  charm_capsule: 'Charm Capsules',
  patch_pack:    'Patch Packs',
  pin_capsule:   'Collectible Pin Capsules',
  music_kit_box: 'Music Kit Boxes',
};

let _container = null;
let _onSelect  = null;

export const CapsuleBrowserUI = {
  init(container, { onSelect }) {
    _container = container;
    _onSelect  = onSelect;
  },

  /** @param {'sticker_capsule'|'other'} category */
  show(category = 'sticker_capsule') {
    if (!_container) return;
    this._render(category);
  },

  hide() {},

  _render(category) {
    _container.innerHTML = '';

    if (category === 'sticker_capsule') {
      const items = CapsuleDataStore.getCapsuleList('sticker_capsule');
      _container.appendChild(_makeSection('Sticker Capsules', items, _onSelect));
      return;
    }

    // 'other' — render grouped sections
    for (const type of OTHER_TYPES) {
      const items = CapsuleDataStore.getCapsuleList(type);
      if (!items.length) continue;
      _container.appendChild(_makeSection(SECTION_LABELS[type] ?? type, items, _onSelect));
    }
  },
};

function _makeSection(title, items, onSelect) {
  const section = document.createElement('div');
  section.className = 'browser-section';

  const header = document.createElement('h2');
  header.className   = 'section-header';
  header.textContent = title;
  section.appendChild(header);

  const grid = document.createElement('div');
  grid.className = 'case-grid';
  for (const capsule of items) {
    grid.appendChild(_makeCard(capsule, onSelect));
  }
  section.appendChild(grid);
  return section;
}

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
    card.appendChild(makePlaceholder(capsule.name, 'card-size'));
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
