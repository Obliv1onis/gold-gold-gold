import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/core/virtual-economy.js', () => ({
  VirtualEconomy: {
    getBalance:  vi.fn(),
    canAfford:   vi.fn(),
    reset:       vi.fn(),
  },
  KEY_COST_USD: 2.49,
}));
vi.mock('../../../src/core/case-inventory.js', () => ({
  CaseInventory: {
    getCaseCount:   vi.fn(),
    hasCase:        vi.fn(),
    addCase:        vi.fn(),
    clearInventory: vi.fn(),
  },
}));
vi.mock('../../../src/core/skin-inventory.js', () => ({
  SkinInventory: {
    getItems:       vi.fn(),
    clearInventory: vi.fn(),
  },
}));

import { HudAppShell } from '../../../src/presentation/hud-app-shell.js';
import { VirtualEconomy } from '../../../src/core/virtual-economy.js';
import { CaseInventory }  from '../../../src/core/case-inventory.js';
import { SkinInventory }  from '../../../src/core/skin-inventory.js';
import { Events }         from '../../../src/foundation/events.js';

// Test case constants (stand-in for real case data)
const TEST_CASE_ID    = 'recoil_case';
const TEST_CASE_PRICE = 0.50;
const TEST_OPEN_COST  = 2.99; // 0.50 + 2.49

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeApp() {
  const el = document.createElement('div');
  el.id = 'app';
  document.body.appendChild(el);
  return el;
}

function teardown(el) {
  el?.remove();
}

function setupMocks({ balance = 2000, caseCount = 1, canAfford = true, items = [] } = {}) {
  VirtualEconomy.getBalance.mockReturnValue(balance);
  VirtualEconomy.canAfford.mockReturnValue(canAfford);
  CaseInventory.getCaseCount.mockReturnValue(caseCount);
  SkinInventory.getItems.mockReturnValue(items);
}

/** Put HudAppShell into case-opening mode with reel-ready fired. */
function enterOpeningMode(appEl, canAfford = true) {
  setupMocks({ canAfford });
  HudAppShell.showCaseOpening(TEST_CASE_ID, TEST_CASE_PRICE);
  document.dispatchEvent(new CustomEvent(Events.REEL_READY));
}

let _appEl = null;

beforeEach(() => {
  vi.clearAllMocks();
  if (_appEl) teardown(_appEl);
  _appEl = makeApp();
  setupMocks();
});

// ─── DOM structure ────────────────────────────────────────────────────────────

describe('HudAppShell — DOM structure', () => {
  it('test_hud_init_creates_hud_bar', () => {
    HudAppShell.init(_appEl, { onOpenClick: vi.fn() });
    expect(_appEl.querySelector('.hud-bar')).toBeTruthy();
  });

  it('test_hud_init_creates_open_button', () => {
    HudAppShell.init(_appEl, { onOpenClick: vi.fn() });
    expect(_appEl.querySelector('.btn-open')).toBeTruthy();
  });

  it('test_hud_init_creates_balance_display', () => {
    HudAppShell.init(_appEl, { onOpenClick: vi.fn() });
    expect(_appEl.querySelector('.balance-value')).toBeTruthy();
  });

  it('test_hud_init_creates_reel_container', () => {
    HudAppShell.init(_appEl, { onOpenClick: vi.fn() });
    expect(_appEl.querySelector('.reel-container')).toBeTruthy();
  });

  it('test_hud_init_creates_case_browser_container', () => {
    HudAppShell.init(_appEl, { onOpenClick: vi.fn() });
    expect(_appEl.querySelector('.case-browser-container')).toBeTruthy();
  });

  it('test_hud_init_browser_view_is_active_by_default', () => {
    HudAppShell.init(_appEl, { onOpenClick: vi.fn() });
    expect(_appEl.querySelector('#browser-view').classList.contains('active')).toBe(true);
    expect(_appEl.querySelector('#reel-view').classList.contains('active')).toBe(false);
  });

  it('test_hud_init_nav_tabs_always_visible_in_browser_mode', () => {
    HudAppShell.init(_appEl, { onOpenClick: vi.fn() });
    expect(_appEl.querySelector('.nav-tabs').hasAttribute('hidden')).toBe(false);
  });
});

// ─── Balance display ──────────────────────────────────────────────────────────

describe('HudAppShell — balance display', () => {
  it('test_hud_balance_shows_formatted_value_on_init', () => {
    VirtualEconomy.getBalance.mockReturnValue(2000);
    HudAppShell.init(_appEl, { onOpenClick: vi.fn() });
    expect(_appEl.querySelector('.balance-value').textContent).toBe('$2,000.00');
  });

  it('test_hud_balance_updates_on_balance_changed_event', () => {
    HudAppShell.init(_appEl, { onOpenClick: vi.fn() });
    document.dispatchEvent(new CustomEvent(Events.BALANCE_CHANGED, { detail: { balance: 150.75 } }));
    expect(_appEl.querySelector('.balance-value').textContent).toBe('$150.75');
  });
});

// ─── View transitions ─────────────────────────────────────────────────────────

describe('HudAppShell — view transitions', () => {
  it('test_hud_show_case_opening_activates_reel_view', () => {
    HudAppShell.init(_appEl, { onOpenClick: vi.fn() });
    HudAppShell.showCaseOpening(TEST_CASE_ID, TEST_CASE_PRICE);
    expect(_appEl.querySelector('#reel-view').classList.contains('active')).toBe(true);
    expect(_appEl.querySelector('#browser-view').classList.contains('active')).toBe(false);
  });

  it('test_hud_show_case_opening_cases_tab_remains_active', () => {
    HudAppShell.init(_appEl, { onOpenClick: vi.fn() });
    HudAppShell.showCaseOpening(TEST_CASE_ID, TEST_CASE_PRICE);
    const casesTab = _appEl.querySelector('.nav-tab[data-view="cases"]');
    expect(casesTab.classList.contains('active')).toBe(true);
  });

  it('test_hud_init_has_market_tab', () => {
    HudAppShell.init(_appEl, { onOpenClick: vi.fn() });
    expect(_appEl.querySelector('.nav-tab[data-view="market"]')).toBeTruthy();
  });

  it('test_hud_init_market_container_exists', () => {
    HudAppShell.init(_appEl, { onOpenClick: vi.fn() });
    expect(_appEl.querySelector('.market-container')).toBeTruthy();
  });

  it('test_hud_show_browser_returns_to_browser_view', () => {
    HudAppShell.init(_appEl, { onOpenClick: vi.fn() });
    HudAppShell.showCaseOpening(TEST_CASE_ID, TEST_CASE_PRICE);
    HudAppShell.showBrowser();
    expect(_appEl.querySelector('#browser-view').classList.contains('active')).toBe(true);
    expect(_appEl.querySelector('#reel-view').classList.contains('active')).toBe(false);
  });

  it('test_hud_show_browser_nav_tabs_remain_visible', () => {
    HudAppShell.init(_appEl, { onOpenClick: vi.fn() });
    HudAppShell.showCaseOpening(TEST_CASE_ID, TEST_CASE_PRICE);
    HudAppShell.showBrowser();
    expect(_appEl.querySelector('.nav-tabs').hasAttribute('hidden')).toBe(false);
  });
});

// ─── Open button state ────────────────────────────────────────────────────────

describe('HudAppShell — Open button state', () => {
  it('test_hud_open_btn_enabled_after_case_selected_and_reel_ready', () => {
    HudAppShell.init(_appEl, { onOpenClick: vi.fn() });
    enterOpeningMode(_appEl, true);
    expect(_appEl.querySelector('.btn-open').disabled).toBe(false);
  });

  it('test_hud_open_btn_disabled_before_reel_ready', () => {
    HudAppShell.init(_appEl, { onOpenClick: vi.fn() });
    HudAppShell.showCaseOpening(TEST_CASE_ID, TEST_CASE_PRICE);
    // reel-ready NOT fired
    expect(_appEl.querySelector('.btn-open').disabled).toBe(true);
  });

  it('test_hud_open_btn_disabled_when_cannot_afford', () => {
    HudAppShell.init(_appEl, { onOpenClick: vi.fn() });
    enterOpeningMode(_appEl, false);
    expect(_appEl.querySelector('.btn-open').disabled).toBe(true);
  });

  it('test_hud_open_btn_disabled_when_animating', () => {
    HudAppShell.init(_appEl, { onOpenClick: vi.fn() });
    enterOpeningMode(_appEl, true);
    _appEl.querySelector('.btn-open').click();
    expect(_appEl.querySelector('.btn-open').disabled).toBe(true);
  });

  it('test_hud_open_btn_re_enables_after_on_ready', () => {
    HudAppShell.init(_appEl, { onOpenClick: vi.fn() });
    enterOpeningMode(_appEl, true);
    _appEl.querySelector('.btn-open').click();
    HudAppShell.onReady();
    expect(_appEl.querySelector('.btn-open').disabled).toBe(false);
  });

  it('test_hud_open_btn_label_shows_open_cost', () => {
    HudAppShell.init(_appEl, { onOpenClick: vi.fn() });
    HudAppShell.showCaseOpening(TEST_CASE_ID, TEST_CASE_PRICE);
    const label = _appEl.querySelector('.btn-open').textContent;
    expect(label).toContain(`$${TEST_OPEN_COST.toFixed(2)}`);
  });
});

// ─── Case count badge ─────────────────────────────────────────────────────────

describe('HudAppShell — case count badge', () => {
  it('test_hud_case_count_shows_count_when_case_selected', () => {
    CaseInventory.getCaseCount.mockReturnValue(3);
    HudAppShell.init(_appEl, { onOpenClick: vi.fn() });
    HudAppShell.showCaseOpening(TEST_CASE_ID, TEST_CASE_PRICE);
    expect(_appEl.querySelector('.case-count-badge').textContent).toBe('3 owned');
  });

  it('test_hud_case_count_updates_on_case_inventory_changed', () => {
    HudAppShell.init(_appEl, { onOpenClick: vi.fn() });
    HudAppShell.showCaseOpening(TEST_CASE_ID, TEST_CASE_PRICE);
    CaseInventory.getCaseCount.mockReturnValue(2);
    document.dispatchEvent(new CustomEvent(Events.CASE_INVENTORY_CHANGED));
    expect(_appEl.querySelector('.case-count-badge').textContent).toBe('2 owned');
  });
});

// ─── Reset button visibility ──────────────────────────────────────────────────

describe('HudAppShell — Reset button visibility', () => {
  it('test_hud_reset_hidden_when_balance_above_zero', () => {
    setupMocks({ balance: 500, items: [] });
    HudAppShell.init(_appEl, { onOpenClick: vi.fn() });
    expect(_appEl.querySelector('.btn-reset').hasAttribute('hidden')).toBe(true);
  });

  it('test_hud_reset_hidden_when_balance_zero_but_has_items', () => {
    const fakeItem = { instanceId: 'x', item: { market_price: 5 } };
    setupMocks({ balance: 0, items: [fakeItem] });
    HudAppShell.init(_appEl, { onOpenClick: vi.fn() });
    expect(_appEl.querySelector('.btn-reset').hasAttribute('hidden')).toBe(true);
  });

  it('test_hud_reset_visible_when_balance_zero_and_no_items', () => {
    setupMocks({ balance: 0, items: [] });
    HudAppShell.init(_appEl, { onOpenClick: vi.fn() });
    expect(_appEl.querySelector('.btn-reset').hasAttribute('hidden')).toBe(false);
  });

  it('test_hud_reset_disappears_after_earn_event', () => {
    setupMocks({ balance: 0, items: [] });
    HudAppShell.init(_appEl, { onOpenClick: vi.fn() });
    VirtualEconomy.getBalance.mockReturnValue(1.50);
    document.dispatchEvent(new CustomEvent(Events.BALANCE_CHANGED, { detail: { balance: 1.50 } }));
    expect(_appEl.querySelector('.btn-reset').hasAttribute('hidden')).toBe(true);
  });
});

// ─── Open button interaction ──────────────────────────────────────────────────

describe('HudAppShell — Open button interaction', () => {
  it('test_hud_open_btn_click_calls_on_open_click', () => {
    const cb = vi.fn();
    HudAppShell.init(_appEl, { onOpenClick: cb });
    enterOpeningMode(_appEl, true);
    _appEl.querySelector('.btn-open').click();
    expect(cb).toHaveBeenCalledWith(TEST_CASE_ID, TEST_CASE_PRICE);
  });

  it('test_hud_open_btn_click_disabled_does_not_call_callback', () => {
    const cb = vi.fn();
    HudAppShell.init(_appEl, { onOpenClick: cb });
    enterOpeningMode(_appEl, false); // canAfford: false → button disabled
    _appEl.querySelector('.btn-open').click();
    expect(cb).not.toHaveBeenCalled();
  });
});
