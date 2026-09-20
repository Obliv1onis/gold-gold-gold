import { afterEach, describe, expect, it } from 'vitest';
import { i18n } from '../../../src/foundation/i18n.js';

afterEach(() => i18n.setLocale('en-US'));

describe('i18n', () => {
  it('can resolve a dynamic name for a requested locale without changing the active locale', () => {
    i18n.setLocale('en-US');
    expect(i18n.skinName('AK-47', 'Redline', 'zh-CN')).toContain('红线');
    expect(i18n.getLocale()).toBe('en-US');
  });

  it('translates market item prefixes when no exact item translation exists', () => {
    expect(i18n.itemName('Charm | Example', 'zh-CN')).toBe('挂件 | Example');
  });

  it('updates text, placeholder, and accessible labels in the DOM', () => {
    document.body.innerHTML = `
      <span data-i18n="market_category"></span>
      <input data-i18n-ph="market_ph" data-i18n-aria="market_clear">
    `;
    i18n.setLocale('zh-CN');
    expect(document.querySelector('span').textContent).toBe('类别');
    expect(document.querySelector('input').placeholder).toContain('搜索');
    expect(document.querySelector('input').getAttribute('aria-label')).toBe('清除搜索');
  });
});
