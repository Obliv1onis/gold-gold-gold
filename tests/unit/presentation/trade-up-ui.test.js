import { describe, expect, it, vi } from 'vitest';

const inventoryEntries = [
  {
    instanceId: 'terminal-red',
    item: {
      item_id: 'terminal_red',
      weapon: 'AK-47',
      skin: 'Top Tier',
      rarity: 'covert',
      case_id: 'terminal_genesis',
      float: 0.1,
      stat_trak: false,
    },
  },
  {
    instanceId: 'case-blue',
    item: {
      item_id: 'case_blue',
      weapon: 'MP9',
      skin: 'Upgradeable',
      rarity: 'mil_spec',
      case_id: 'test_case',
      float: 0.1,
      stat_trak: false,
    },
  },
];

vi.mock('../../../src/core/skin-inventory.js', () => ({
  SkinInventory: {
    getItems: vi.fn(() => inventoryEntries),
    addItem: vi.fn(),
    consumeItems: vi.fn(),
  },
}));

vi.mock('../../../src/feature/skin-image-loader.js', () => ({
  SkinImageLoader: {
    getLazyImage: vi.fn(() => document.createElement('img')),
  },
}));

vi.mock('../../../src/foundation/case-data-store.js', () => ({
  CaseDataStore: {
    getItems: vi.fn((caseId, rarity) => {
      if (caseId === 'test_case' && rarity === 'restricted') return [{ item_id: 'next_item' }];
      return [];
    }),
    getCase: vi.fn(caseId => ({ id: caseId, name: caseId })),
  },
}));

import { TradeUpUI } from '../../../src/presentation/trade-up-ui.js';

describe('TradeUpUI material eligibility', () => {
  it('does not add a skin whose source has no higher-tier outcome', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    TradeUpUI.init(container);
    TradeUpUI.show();

    const terminalRed = container.querySelector('[data-instance-id="terminal-red"]');
    expect(terminalRed.classList.contains('tradeup-inv-item--disabled')).toBe(true);
    terminalRed.click();
    expect(container.querySelectorAll('.tradeup-slot--filled')).toHaveLength(0);

    const eligibleBlue = container.querySelector('[data-instance-id="case-blue"]');
    expect(eligibleBlue.classList.contains('tradeup-inv-item--disabled')).toBe(false);
    eligibleBlue.click();
    expect(container.querySelectorAll('.tradeup-slot--filled')).toHaveLength(1);
    container.remove();
  });
});
