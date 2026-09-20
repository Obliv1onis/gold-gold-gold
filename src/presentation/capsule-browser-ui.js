import { CapsuleDataStore }  from '../foundation/capsule-data-store.js';
import { makePlaceholder }   from '../feature/item-placeholder.js';
import { i18n }              from '../foundation/i18n.js';
import { createCatalogToolbar, focusCatalogSearch, matchesCatalogQuery } from './catalog-toolbar.js';

const STICKER_TYPES = ['sticker_capsule'];
const OTHER_TYPES   = ['charm_capsule', 'patch_pack', 'pin_capsule', 'music_kit_box'];

const SECTION_LABELS = {
  charm_capsule: 'sec_charms',
  patch_pack:    'sec_patches',
  pin_capsule:   'sec_pins',
  music_kit_box: 'sec_music_kits',
};

let _container       = null;
let _onSelect        = null;
let _activeCategory  = null;
let _query           = '';
let _sort            = 'newest';

export const CapsuleBrowserUI = {
  init(container, { onSelect }) {
    _container = container;
    _onSelect  = onSelect;
    document.addEventListener('locale-changed', () => {
      if (_activeCategory) this._render(_activeCategory);
    });
  },

  /** @param {'sticker_capsule'|'other'} category */
  show(category = 'sticker_capsule') {
    if (!_container) return;
    _activeCategory = category;
    this._render(category);
  },

  hide() {},

  _render(category) {
    _container.innerHTML = '';

    const groups = category === 'sticker_capsule'
      ? [{ type: 'sticker_capsule', title: i18n.t('sec_stickers') }]
      : OTHER_TYPES.map(type => ({ type, title: i18n.t(SECTION_LABELS[type] ?? 'sec_others') }));
    const completeGroups = groups.map(group => ({
      ...group,
      items: CapsuleDataStore.getCapsuleList(group.type),
    }));
    const totalCount = completeGroups.reduce((sum, group) => sum + group.items.length, 0);
    const visibleGroups = completeGroups.map(group => ({
      ...group,
      items: group.items
        .filter(item => matchesCatalogQuery(item, _query))
        .sort(_capsuleSort),
    }));
    const visibleCount = visibleGroups.reduce((sum, group) => sum + group.items.length, 0);

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
        this._render(category);
        focusCatalogSearch(_container);
      },
      onSortChange: value => {
        _sort = value;
        this._render(category);
      },
    }));

    for (const group of visibleGroups) {
      if (!group.items.length) continue;
      _container.appendChild(_makeSection(group.title, group.items, _onSelect));
    }

    if (!visibleCount) {
      const empty = document.createElement('div');
      empty.className = 'browser-empty';
      empty.textContent = totalCount ? i18n.t('catalog_no_results') : i18n.t('no_cases');
      _container.appendChild(empty);
    }
  },
};

function _capsuleSort(a, b) {
  const byName = i18n.caseName(a.name).localeCompare(i18n.caseName(b.name), i18n.getLocale());
  if (_sort === 'name') return byName;
  if (!a.release_date && !b.release_date) return byName;
  if (!a.release_date) return 1;
  if (!b.release_date) return -1;
  const direction = _sort === 'oldest' ? 1 : -1;
  return direction * a.release_date.localeCompare(b.release_date) || byName;
}

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
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'case-card';

  card.addEventListener('click', () => {
    onSelect?.(capsule.id, capsule.price);
  });

  if (capsule.image_url) {
    const img = new Image();
    img.src       = capsule.image_url;
    img.alt       = capsule.name;
    img.className = 'case-card-image';
    img.loading   = 'lazy';
    img.decoding  = 'async';
    card.appendChild(img);
  } else {
    card.appendChild(makePlaceholder(capsule.name, 'card-size'));
  }

  const name = document.createElement('div');
  name.className   = 'case-card-name';
  name.textContent = i18n.caseName(capsule.name);

  const price = document.createElement('div');
  price.className   = 'case-card-price case-card-price--live';
  price.textContent = `$${capsule.price.toFixed(2)}`;

  card.appendChild(name);
  card.appendChild(price);
  return card;
}
