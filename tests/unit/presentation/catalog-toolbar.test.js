import { describe, expect, it, vi } from 'vitest';
import { createCatalogToolbar, matchesCatalogQuery } from '../../../src/presentation/catalog-toolbar.js';

describe('catalog toolbar', () => {
  it('filters by original name and id', () => {
    const item = { id: 'gallery_case', name: 'Gallery Case' };
    expect(matchesCatalogQuery(item, 'gallery')).toBe(true);
    expect(matchesCatalogQuery(item, 'gallery_case')).toBe(true);
    expect(matchesCatalogQuery(item, 'missing')).toBe(false);
  });

  it('emits search and sort changes', () => {
    const onQueryChange = vi.fn();
    const onSortChange = vi.fn();
    const toolbar = createCatalogToolbar({
      query: '',
      visibleCount: 4,
      totalCount: 42,
      sort: 'newest',
      sortOptions: [
        { value: 'newest', labelKey: 'catalog_newest' },
        { value: 'name', labelKey: 'catalog_name' },
      ],
      onQueryChange,
      onSortChange,
    });

    const input = toolbar.querySelector('input');
    input.value = 'fever';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    const select = toolbar.querySelector('select');
    select.value = 'name';
    select.dispatchEvent(new Event('change', { bubbles: true }));

    expect(onQueryChange).toHaveBeenCalledWith('fever');
    expect(onSortChange).toHaveBeenCalledWith('name');
    expect(toolbar.textContent).toContain('4 of 42');
  });
});
