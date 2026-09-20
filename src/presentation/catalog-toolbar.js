import { i18n } from '../foundation/i18n.js';

/** Shared search/sort controls used by each container catalogue. */
export function createCatalogToolbar({
  query,
  visibleCount,
  totalCount,
  sort,
  sortOptions,
  onQueryChange,
  onSortChange,
}) {
  const toolbar = document.createElement('div');
  toolbar.className = 'catalog-toolbar';

  const searchWrap = document.createElement('label');
  searchWrap.className = 'catalog-search';

  const searchIcon = document.createElement('span');
  searchIcon.className = 'catalog-search__icon';
  searchIcon.setAttribute('aria-hidden', 'true');
  searchIcon.textContent = '⌕';

  const input = document.createElement('input');
  input.className = 'catalog-search__input';
  input.type = 'search';
  input.value = query;
  input.placeholder = i18n.t('catalog_search');
  input.setAttribute('aria-label', i18n.t('catalog_search'));
  input.addEventListener('input', event => onQueryChange(event.currentTarget.value));

  searchWrap.append(searchIcon, input);

  const meta = document.createElement('div');
  meta.className = 'catalog-toolbar__meta';
  meta.textContent = i18n.t('catalog_count', { visible: visibleCount, total: totalCount });

  const select = document.createElement('select');
  select.className = 'catalog-sort';
  select.setAttribute('aria-label', i18n.t('catalog_sort'));
  for (const optionData of sortOptions) {
    const option = document.createElement('option');
    option.value = optionData.value;
    option.textContent = i18n.t(optionData.labelKey);
    option.selected = optionData.value === sort;
    select.appendChild(option);
  }
  select.addEventListener('change', event => onSortChange(event.currentTarget.value));

  toolbar.append(searchWrap, meta, select);
  return toolbar;
}

export function matchesCatalogQuery(item, query) {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return true;
  return [item.id, item.name, i18n.caseName(item.name)]
    .filter(Boolean)
    .some(value => value.toLocaleLowerCase().includes(normalized));
}

export function focusCatalogSearch(container) {
  const input = container.querySelector('.catalog-search__input');
  if (!input) return;
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);
}
