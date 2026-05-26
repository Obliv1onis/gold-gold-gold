import { VirtualEconomy, KEY_COST_USD } from '../core/virtual-economy.js';
import { CaseInventory }               from '../core/case-inventory.js';
import { SkinInventory }               from '../core/skin-inventory.js';
import { Events }                      from '../foundation/events.js';

// ─── Module-level state ───────────────────────────────────────────────────────

let _isAnimating      = false;
let _revealVisible    = false;
let _reelReady        = false;
let _selectedCaseId   = null;
let _caseMarketPrice  = 0;
let _openCost         = 0;
let _currentView      = 'home'; // 'home' | 'browser' | 'reel' | 'market' | 'tradeup' | 'inventory'
let _currentCategory  = null;   // 'weapon_case' | 'souvenir_package' | null

// Callbacks
let _onShowBrowser   = null;
let _onHideBrowser   = null;
let _onShowInventory = null;
let _onHideInventory = null;
let _onShowMarket    = null;
let _onHideMarket    = null;
let _onShowTradeUp   = null;
let _onHideTradeUp   = null;

// DOM refs
let _balanceEl   = null;
let _invValueEl  = null;
let _openBtn     = null;
let _caseCountEl = null;
let _resetBtn    = null;
let _errorEl     = null;
let _openSection = null;
let _backBtn     = null;
let _appEl       = null;

/**
 * Top-level layout shell. Manages three views:
 *   • browser   — case-selection grid (default on init)
 *   • reel      — spin animation for a selected case
 *   • inventory — player's skin collection (accessible from any view)
 *
 * @example
 * const { caseBrowserContainer, reelContainer, overlayContainer, inventoryContainer }
 *   = HudAppShell.init(appEl, { onOpenClick, onShowInventory, onHideInventory });
 */
export const HudAppShell = {
  get isAnimating() { return _isAnimating; },

  /**
   * Builds the page DOM. Returns container refs for each sub-module.
   *
   * @param {HTMLElement} rootEl
   * @param {{
   *   onOpenClick: (caseId: string, casePrice: number) => void,
   *   onShowInventory?: () => void,
   *   onHideInventory?: () => void,
   *   onShowMarket?: () => void,
   *   onHideMarket?: () => void,
   * }} opts
   * @returns {{ caseBrowserContainer, reelContainer, overlayContainer, inventoryContainer }}
   */
  init(rootEl, { onOpenClick, categories = [], onShowBrowser, onHideBrowser, onShowInventory, onHideInventory, onShowMarket, onHideMarket, onShowTradeUp, onHideTradeUp }) {
    _appEl           = rootEl;
    _onShowBrowser   = onShowBrowser   ?? null;
    _onHideBrowser   = onHideBrowser   ?? null;
    _onShowInventory = onShowInventory ?? null;
    _onHideInventory = onHideInventory ?? null;
    _onShowMarket    = onShowMarket    ?? null;
    _onHideMarket    = onHideMarket    ?? null;
    _onShowTradeUp   = onShowTradeUp   ?? null;
    _onHideTradeUp   = onHideTradeUp   ?? null;

    rootEl.innerHTML = `
      <header class="hud-bar">
        <button class="btn-back" hidden>← Home</button>
        <div class="hud-balance">
          <span class="balance-label">Balance</span>
          <span class="balance-value">$0.00</span>
        </div>
        <div class="hud-inv-value">
          <span class="inv-value-label">Inventory Value</span>
          <span class="inv-value-amount">$0.00</span>
        </div>
        <div class="hud-open-section" hidden>
          <span class="case-count-badge">0 owned</span>
          <button class="btn-open" disabled>Open</button>
          <span class="hud-error-msg" hidden></span>
        </div>
        <div class="hud-actions">
          <button class="btn-reset" hidden>Reset</button>
        </div>
      </header>

      <nav class="nav-tabs">
        <span class="nav-tab active" data-view="home">Home</span>
        <span class="nav-tab"       data-view="market">Market</span>
        <span class="nav-tab"       data-view="tradeup">Trade Up</span>
        <span class="nav-tab"       data-view="inventory">Inventory</span>
      </nav>

      <main class="content-region">
        <div class="view active" id="home-view">
          <div class="home-grid"></div>
        </div>
        <div class="view" id="browser-view">
          <div class="case-browser-container"></div>
        </div>
        <div class="view" id="reel-view">
          <div class="reel-container"></div>
        </div>
        <div class="view" id="market-view">
          <div class="market-container"></div>
        </div>
        <div class="view" id="tradeup-view">
          <div class="tradeup-container"></div>
        </div>
        <div class="view" id="inventory-view">
          <div class="inventory-container"></div>
        </div>
      </main>
    `;

    // Build home category tiles
    const homeGrid = rootEl.querySelector('.home-grid');
    for (const cat of categories) {
      homeGrid.appendChild(_makeTile(cat, () => {
        if (cat.comingSoon) return;
        _currentCategory = cat.id;
        this.showBrowser();
        _onShowBrowser?.(_currentCategory);
      }));
    }

    // Cache refs
    _balanceEl   = rootEl.querySelector('.balance-value');
    _invValueEl  = rootEl.querySelector('.inv-value-amount');
    _openBtn     = rootEl.querySelector('.btn-open');
    _caseCountEl = rootEl.querySelector('.case-count-badge');
    _resetBtn    = rootEl.querySelector('.btn-reset');
    _errorEl     = rootEl.querySelector('.hud-error-msg');
    _openSection = rootEl.querySelector('.hud-open-section');
    _backBtn     = rootEl.querySelector('.btn-back');

    // Back button — browser → home, reel → browser
    _backBtn.addEventListener('click', () => {
      if (_isAnimating) return;
      if (_currentView === 'browser') this.showHome();
      else this.showBrowser();
    });

    // Open button
    _openBtn.addEventListener('click', () => {
      if (_openBtn.disabled || !_selectedCaseId) return;
      _isAnimating = true;
      CaseInventory.addCase(_selectedCaseId);
      this._evaluateOpenButton();
      onOpenClick(_selectedCaseId, _caseMarketPrice, _currentCategory);
    });

    // Reset button
    _resetBtn.addEventListener('click', () => this._handleReset());

    // Tab navigation
    rootEl.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => this._handleTabClick(tab.dataset.view));
    });

    // DOM events
    document.addEventListener(Events.BALANCE_CHANGED,        e  => this._onBalanceChanged(e));
    document.addEventListener(Events.CASE_INVENTORY_CHANGED, () => this._refreshCaseCount());
    document.addEventListener(Events.SKIN_INVENTORY_CHANGED, () => {
      this._refreshResetVisibility();
      this._refreshInvValue();
    });
    document.addEventListener(Events.REEL_READY,             () => { _reelReady = true; this._evaluateOpenButton(); });

    // Initial render
    this._refreshBalance();
    this._refreshResetVisibility();
    this._refreshInvValue();

    return {
      caseBrowserContainer: rootEl.querySelector('.case-browser-container'),
      reelContainer:        rootEl.querySelector('.reel-container'),
      overlayContainer:     rootEl,
      marketContainer:      rootEl.querySelector('.market-container'),
      tradeUpContainer:     rootEl.querySelector('.tradeup-container'),
      inventoryContainer:   rootEl.querySelector('.inventory-container'),
    };
  },

  // ── View transitions ────────────────────────────────────────────────────────

  /** Navigate to the home screen (4 category tiles). */
  showHome() {
    this._leaveCurrentView();
    _selectedCaseId  = null;
    _currentCategory = null;
    _reelReady       = false;
    _isAnimating     = false;
    _revealVisible   = false;
    _currentView     = 'home';
    this._applyView();
  },

  /** Switch to the case-selection grid for the current category. */
  showBrowser() {
    this._leaveCurrentView();
    _selectedCaseId  = null;
    _reelReady       = false;
    _isAnimating     = false;
    _revealVisible   = false;
    _currentView     = 'browser';
    this._applyView();
  },

  /**
   * Switch to the case-opening screen for a specific case.
   * @param {string} caseId
   * @param {number} casePrice - market price of the case (USD)
   */
  showCaseOpening(caseId, casePrice) {
    this._leaveCurrentView();
    _selectedCaseId  = caseId;
    _caseMarketPrice = casePrice;
    const isKeyless  = _currentCategory === 'souvenir_package' || _currentCategory === 'sticker_capsule';
    _openCost        = Math.round((isKeyless ? casePrice : casePrice + KEY_COST_USD) * 100) / 100;
    _reelReady       = false;
    _isAnimating     = false;
    _revealVisible   = false;
    _currentView     = 'reel';
    this._applyView();

    _openBtn.textContent = `Open ($${_openCost.toFixed(2)})`;
    this._refreshCaseCount();
    this._evaluateOpenButton();
  },

  // ── Orchestrator callbacks ──────────────────────────────────────────────────

  onReady() {
    _isAnimating   = false;
    _revealVisible = false;
    this._evaluateOpenButton();
  },

  onBlocked(reason) {
    _isAnimating = false;
    this._evaluateOpenButton();
    this._showError(_blockedMessage(reason));
  },

  onRevealDismissed() {
    _revealVisible = false;
  },

  // ── Internal ───────────────────────────────────────────────────────────────

  _handleTabClick(view) {
    const inHome = _currentView === 'home' || _currentView === 'browser' || _currentView === 'reel';
    if (view === 'home' && inHome) return;
    if (view === _currentView) return;

    if (view === 'inventory') {
      this._leaveCurrentView();
      _currentView = 'inventory';
      this._applyView();
      _onShowInventory?.();

    } else if (view === 'market') {
      this._leaveCurrentView();
      _currentView = 'market';
      this._applyView();
      _onShowMarket?.();

    } else if (view === 'tradeup') {
      this._leaveCurrentView();
      _currentView = 'tradeup';
      this._applyView();
      _onShowTradeUp?.();

    } else { // 'home'
      this.showHome();
    }
  },

  /** Fires the "leave" callback for whichever view is currently active. */
  _leaveCurrentView() {
    if (_currentView === 'browser')   _onHideBrowser?.();
    if (_currentView === 'inventory') _onHideInventory?.();
    if (_currentView === 'market')    _onHideMarket?.();
    if (_currentView === 'tradeup')   _onHideTradeUp?.();
  },

  /** Syncs all view classes, nav tab states, and opening-mode controls. */
  _applyView() {
    const v = _currentView;
    _appEl.querySelector('#home-view').classList.toggle('active',      v === 'home');
    _appEl.querySelector('#browser-view').classList.toggle('active',   v === 'browser');
    _appEl.querySelector('#reel-view').classList.toggle('active',      v === 'reel');
    _appEl.querySelector('#market-view').classList.toggle('active',    v === 'market');
    _appEl.querySelector('#tradeup-view').classList.toggle('active',   v === 'tradeup');
    _appEl.querySelector('#inventory-view').classList.toggle('active', v === 'inventory');

    const inHome = v === 'home' || v === 'browser' || v === 'reel';
    _appEl.querySelectorAll('.nav-tab').forEach(t => {
      const tv = t.dataset.view;
      t.classList.toggle('active',
        tv === 'home'      ? inHome            :
        tv === 'market'    ? v === 'market'    :
        tv === 'tradeup'   ? v === 'tradeup'   :
        tv === 'inventory' ? v === 'inventory' : false
      );
    });

    // Back button: visible in browser (→ Home) and reel (→ browser)
    if (v === 'browser') {
      _backBtn.textContent = '← Home';
      _backBtn.removeAttribute('hidden');
      _openSection.setAttribute('hidden', '');
    } else if (v === 'reel' && _selectedCaseId) {
      _backBtn.textContent = '← Back';
      _backBtn.removeAttribute('hidden');
      _openSection.removeAttribute('hidden');
    } else {
      _backBtn.setAttribute('hidden', '');
      _openSection.setAttribute('hidden', '');
    }
  },

  _refreshBalance() {
    const bal = VirtualEconomy.getBalance();
    _balanceEl.textContent = _formatBalance(bal);
    this._refreshResetVisibility();
  },

  _onBalanceChanged(e) {
    const { balance } = e.detail ?? {};
    const val = (typeof balance === 'number' && isFinite(balance))
      ? balance
      : VirtualEconomy.getBalance();
    _balanceEl.textContent = _formatBalance(val);
    this._evaluateOpenButton();
    this._refreshResetVisibility();
  },

  _refreshCaseCount() {
    if (!_selectedCaseId || !_caseCountEl) return;
    const count = CaseInventory.getCaseCount(_selectedCaseId);
    _caseCountEl.textContent = `${count} owned`;
    this._evaluateOpenButton();
  },

  _evaluateOpenButton() {
    if (!_openBtn) return;
    const enabled = !_isAnimating
      && !_revealVisible
      && _reelReady
      && !!_selectedCaseId
      && VirtualEconomy.canAfford(_openCost);
    _openBtn.disabled = !enabled;
  },

  _refreshInvValue() {
    if (!_invValueEl) return;
    const total = SkinInventory.getItems().reduce((s, e) => s + (e.item.market_price ?? 0), 0);
    _invValueEl.textContent = `$${total.toFixed(2)}`;
  },

  _refreshResetVisibility() {
    if (!_resetBtn) return;
    const bal      = VirtualEconomy.getBalance();
    const invEmpty = SkinInventory.getItems().length === 0;
    if (bal === 0 && invEmpty) {
      _resetBtn.removeAttribute('hidden');
    } else {
      _resetBtn.setAttribute('hidden', '');
    }
  },

  _handleReset() {
    if (_isAnimating) return;
    const ok = window.confirm(
      'Start over? This will clear your balance and all inventory. It cannot be undone.'
    );
    if (!ok) return;
    VirtualEconomy.reset();
    try { CaseInventory.clearInventory(); } catch (e) { console.error(e); }
    try { SkinInventory.clearInventory(); } catch (e) { console.error(e); }
    if (_selectedCaseId) this._refreshCaseCount();
    this._evaluateOpenButton();
  },

  _showError(msg) {
    if (!_errorEl) return;
    _errorEl.textContent = msg;
    _errorEl.removeAttribute('hidden');
    setTimeout(() => _errorEl.setAttribute('hidden', ''), 2600);
  },
};

function _makeTile(cat, onClick) {
  const tile = document.createElement('div');
  tile.className = `home-tile${cat.comingSoon ? ' home-tile--coming-soon' : ''}`;
  tile.addEventListener('click', onClick);

  if (cat.comingSoon) {
    const badge = document.createElement('div');
    badge.className   = 'home-tile__badge';
    badge.textContent = 'Coming Soon';
    tile.appendChild(badge);
  }

  const imgWrap = document.createElement('div');
  imgWrap.className = 'home-tile__img-wrap';
  if (cat.image) {
    const img = document.createElement('img');
    img.className = 'home-tile__img';
    img.src = cat.image;
    img.alt = cat.title;
    imgWrap.appendChild(img);
  }
  tile.appendChild(imgWrap);

  const gradient = document.createElement('div');
  gradient.className = 'home-tile__gradient';
  tile.appendChild(gradient);

  const content = document.createElement('div');
  content.className = 'home-tile__content';

  const title = document.createElement('div');
  title.className   = 'home-tile__title';
  title.textContent = cat.title;
  content.appendChild(title);

  if (cat.subtitle) {
    const count = document.createElement('div');
    count.className   = 'home-tile__count';
    count.textContent = cat.subtitle;
    content.appendChild(count);
  }

  tile.appendChild(content);
  return tile;
}

function _formatBalance(balance) {
  const n = (typeof balance === 'number' && isFinite(balance)) ? balance : 0;
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function _blockedMessage(reason) {
  switch (reason) {
    case 'no_case':            return 'No cases owned.';
    case 'insufficient_funds': return 'Insufficient balance.';
    case 'roll_error':         return 'Case data error — cannot open.';
    default:                   return 'Could not open case.';
  }
}
