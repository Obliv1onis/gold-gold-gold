import { beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  vi.resetModules();
});

describe('Theme', () => {
  it('defaults to dark mode on first visit', async () => {
    const { Theme } = await import('../../../src/foundation/theme.js');
    expect(Theme.init()).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('persists and restores the selected mode', async () => {
    let module = await import('../../../src/foundation/theme.js');
    module.Theme.init();
    module.Theme.setTheme('light');
    expect(localStorage.getItem('vault_theme')).toBe('"light"');

    delete document.documentElement.dataset.theme;
    vi.resetModules();
    module = await import('../../../src/foundation/theme.js');
    expect(module.Theme.init()).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });
});
