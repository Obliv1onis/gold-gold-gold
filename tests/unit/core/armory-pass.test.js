import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/core/virtual-economy.js', () => ({
  VirtualEconomy: { spend: vi.fn() },
}));

import { ArmoryPass, ARMORY_PASS_DRAWS, ARMORY_PASS_PRICE_USD } from '../../../src/core/armory-pass.js';
import { VirtualEconomy } from '../../../src/core/virtual-economy.js';

describe('ArmoryPass', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ArmoryPass.reset();
  });

  it('purchases ten draws for $15.99', () => {
    VirtualEconomy.spend.mockReturnValue(true);
    expect(ArmoryPass.purchase()).toBe(true);
    expect(VirtualEconomy.spend).toHaveBeenCalledWith(ARMORY_PASS_PRICE_USD);
    expect(ArmoryPass.getRemaining()).toBe(ARMORY_PASS_DRAWS);
  });

  it('consumes a draw without charging the balance again', () => {
    VirtualEconomy.spend.mockReturnValue(true);
    ArmoryPass.purchase();
    vi.clearAllMocks();
    expect(ArmoryPass.consume()).toBe(true);
    expect(ArmoryPass.getRemaining()).toBe(9);
    expect(VirtualEconomy.spend).not.toHaveBeenCalled();
  });

  it('does not consume below zero', () => {
    expect(ArmoryPass.consume()).toBe(false);
    expect(ArmoryPass.getRemaining()).toBe(0);
  });

  it('returns to zero after all ten draws are consumed', () => {
    VirtualEconomy.spend.mockReturnValue(true);
    ArmoryPass.purchase();
    for (let i = 0; i < ARMORY_PASS_DRAWS; i++) expect(ArmoryPass.consume()).toBe(true);
    expect(ArmoryPass.getRemaining()).toBe(0);
    expect(ArmoryPass.consume()).toBe(false);
  });
});
