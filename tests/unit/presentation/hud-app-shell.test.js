import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/core/virtual-economy.js', () => ({
  VirtualEconomy: {
    getBalance:  vi.fn(),
    canAfford:   vi.fn(),
    reset:       vi.fn(),
    earn:        vi.fn(),
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
import { Theme }          from '../../../src/foundation/theme.js';
import { i18n }           from '../../../src/foundation/i18n.js';

// Test case constants (stand-in for real case data)
const TEST_CASE_ID    = 'recoil_case';
const TEST_CASE_PRICE = 0.50;
const TEST_OPEN_COST  = 2.99; // 0.50 + 2.49
const TEST_TERMINAL_ID = 'terminal_genesis';

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
  localStorage.clear();
  Theme.setTheme('dark');
  i18n.setLocale('en-US');
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

  it('test_hud_theme_button_toggles_to_light_mode', () => {
    HudAppShell.init(_appEl, { onOpenClick: vi.fn() });
    const button = _appEl.querySelector('.btn-theme');
    expect(button).toBeTruthy();
    expect(button.getAttribute('aria-label')).toBe('Switch to light mode');
    button.click();
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(button.getAttribute('aria-label')).toBe('Switch to dark mode');
  });

  it('test_hud_daily_bonus_changes_to_a_24_hour_countdown_after_claim', () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(100_000_000);
    HudAppShell.init(_appEl, { onOpenClick: vi.fn() });
    const button = _appEl.querySelector('.btn-daily-bonus');

    expect(button.textContent).toBe('Daily $200');
    button.click();
    expect(VirtualEconomy.earn).toHaveBeenCalledWith(200);
    expect(button.disabled).toBe(true);
    expect(button.textContent).toBe('24:00:00');

    now.mockReturnValue(100_001_000);
    HudAppShell._refreshBonusBar();
    expect(button.textContent).toBe('23:59:59');
    now.mockRestore();
  });

  it('test_hud_init_creates_reel_container', () => {
    HudAppShell.init(_appEl, { onOpenClick: vi.fn() });
    expect(_appEl.querySelector('.reel-container')).toBeTruthy();
  });

  it('test_hud_init_creates_case_browser_container', () => {
    HudAppShell.init(_appEl, { onOpenClick: vi.fn() });
    expect(_appEl.querySelector('.case-browser-container')).toBeTruthy();
  });

  it('test_hud_credits_content_updates_to_simplified_chinese', () => {
    HudAppShell.init(_appEl, { onOpenClick: vi.fn() });
    i18n.setLocale('zh-CN');

    const credits = _appEl.querySelector('#credits-view');
    expect(credits.querySelector('.credits-title').textContent).toBe('鸣谢');
    expect(credits.querySelector('.credits-section-title').textContent).toBe('许可证');
    expect(credits.querySelector('.credits-text').textContent).toContain('本项目采用 MIT 许可证发布');
    expect(credits.querySelector('[data-i18n="credits_github"]').textContent).toBe('GitHub 仓库');
    expect(credits.querySelector('[data-i18n="credits_steam"]').textContent).toBe('Steam 个人资料');
  });

  it('test_hud_init_home_view_is_active_by_default', () => {
    HudAppShell.init(_appEl, { onOpenClick: vi.fn() });
    expect(_appEl.querySelector('#home-view').classList.contains('active')).toBe(true);
    expect(_appEl.querySelector('#browser-view').classList.contains('active')).toBe(false);
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

  it('test_hud_show_case_opening_home_tab_remains_active', () => {
    HudAppShell.init(_appEl, { onOpenClick: vi.fn() });
    HudAppShell.showCaseOpening(TEST_CASE_ID, TEST_CASE_PRICE);
    const homeTab = _appEl.querySelector('.nav-tab[data-view="home"]');
    expect(homeTab.classList.contains('active')).toBe(true);
  });

  it('test_hud_init_has_market_tab', () => {
    HudAppShell.init(_appEl, { onOpenClick: vi.fn() });
    expect(_appEl.querySelector('.nav-tab[data-view="market"]')).toBeTruthy();
  });

  it('test_hud_init_market_container_exists', () => {
    HudAppShell.init(_appEl, { onOpenClick: vi.fn() });
    expect(_appEl.querySelector('.market-container')).toBeTruthy();
  });

  it('test_hud_init_has_tradeup_tab', () => {
    HudAppShell.init(_appEl, { onOpenClick: vi.fn() });
    expect(_appEl.querySelector('.nav-tab[data-view="tradeup"]')).toBeTruthy();
  });

  it('test_hud_init_tradeup_container_exists', () => {
    HudAppShell.init(_appEl, { onOpenClick: vi.fn() });
    expect(_appEl.querySelector('.tradeup-container')).toBeTruthy();
  });

  it('test_hud_tradeup_tab_click_activates_tradeup_view', () => {
    const onShow = vi.fn();
    HudAppShell.init(_appEl, { onOpenClick: vi.fn(), onShowTradeUp: onShow });
    _appEl.querySelector('.nav-tab[data-view="tradeup"]').click();
    expect(_appEl.querySelector('#tradeup-view').classList.contains('active')).toBe(true);
    expect(onShow).toHaveBeenCalled();
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

  it('uses the terminal price without adding a key cost', () => {
    HudAppShell.init(_appEl, { onOpenClick: vi.fn() });
    HudAppShell.showCaseOpening(TEST_TERMINAL_ID, TEST_CASE_PRICE, { isTerminal: true });

    expect(_appEl.querySelector('.btn-open').textContent).toContain(`$${TEST_CASE_PRICE.toFixed(2)}`);
    expect(_appEl.querySelector('.case-count-badge')).toBeNull();
  });

  it('starts a terminal without adding it to the case inventory', () => {
    const onOpenClick = vi.fn();
    HudAppShell.init(_appEl, { onOpenClick });
    setupMocks({ canAfford: true });
    HudAppShell.showCaseOpening(TEST_TERMINAL_ID, TEST_CASE_PRICE, { isTerminal: true });
    document.dispatchEvent(new CustomEvent(Events.REEL_READY));

    _appEl.querySelector('.btn-open').click();

    expect(CaseInventory.addCase).not.toHaveBeenCalled();
    expect(onOpenClick).toHaveBeenCalledWith(TEST_TERMINAL_ID, TEST_CASE_PRICE);
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
