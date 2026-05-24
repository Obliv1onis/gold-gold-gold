import { VirtualEconomy, KEY_COST_USD } from '../core/virtual-economy.js';
import { CaseInventory }               from '../core/case-inventory.js';
import { SkinInventory }               from '../core/skin-inventory.js';
import { Events }                      from '../foundation/events.js';

// ─── Module-level state ───────────────────────────────────────────────────────

let _isAnimating     = false;
let _revealVisible   = false;
let _reelReady       = false;
let _selectedCaseId  = null;
let _openCost        = 0;
let _currentView     = 'browser'; // 'browser' | 'reel' | 'market' | 'inventory'

// Callbacks
let _onShowInventory = null;
let _onHideInventory = null;
let _onShowMarket    = null;
let _onHideMarket    = null;

// DOM refs
let _balanceEl   = null;
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
  init(rootEl, { onOpenClick, onShowInventory, onHideInventory, onShowMarket, onHideMarket }) {
    _appEl           = rootEl;
    _onShowInventory = onShowInventory ?? null;
    _onHideInventory = onHideInventory ?? null;
    _onShowMarket    = onShowMarket    ?? null;
    _onHideMarket    = onHideMarket    ?? null;

    rootEl.innerHTML = `
      <header class="hud-bar">
        <button class="btn-back" hidden>← Cases</button>
        <div class="hud-balance">
          <span class="balance-label">Balance</span>
          <span class="balance-value">$0.00</span>
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
        <span class="nav-tab active" data-view="cases">Cases</span>
        <span class="nav-tab"       data-view="market">Market</span>
        <span class="nav-tab"       data-view="inventory">Inventory</span>
      </nav>

      <main class="content-region">
        <div class="view active" id="browser-view">
          <div class="case-browser-container"></div>
        </div>
        <div class="view" id="reel-view">
          <div class="reel-container"></div>
        </div>
        <div class="view" id="market-view">
          <div class="market-container"></div>
        </div>
        <div class="view" id="inventory-view">
          <div class="inventory-container"></div>
        </div>
      </main>
    `;

    // Cache refs
    _balanceEl   = rootEl.querySelector('.balance-value');
    _openBtn     = rootEl.querySelector('.btn-open');
    _caseCountEl = rootEl.querySelector('.case-count-badge');
    _resetBtn    = rootEl.querySelector('.btn-reset');
    _errorEl     = rootEl.querySelector('.hud-error-msg');
    _openSection = rootEl.querySelector('.hud-open-section');
    _backBtn     = rootEl.querySelector('.btn-back');

    // Back button — always returns to browser
    _backBtn.addEventListener('click', () => {
      if (_isAnimating) return;
      this.showBrowser();
    });

    // Open button
    _openBtn.addEventListener('click', () => {
      if (_openBtn.disabled || !_selectedCaseId) return;
      _isAnimating = true;
      CaseInventory.addCase(_selectedCaseId);
      this._evaluateOpenButton();
      onOpenClick(_selectedCaseId, _openCost - KEY_COST_USD);
    });

    // Reset button
    _resetBtn.addEventListener('click', () => this._handleReset());

    // Tab navigation (always visible)
    rootEl.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => this._handleTabClick(tab.dataset.view));
    });

    // DOM events
    document.addEventListener(Events.BALANCE_CHANGED,        e  => this._onBalanceChanged(e));
    document.addEventListener(Events.CASE_INVENTORY_CHANGED, () => this._refreshCaseCount());
    document.addEventListener(Events.SKIN_INVENTORY_CHANGED, () => this._refreshResetVisibility());
    document.addEventListener(Events.REEL_READY,             () => { _reelReady = true; this._evaluateOpenButton(); });

    // Initial render
    this._refreshBalance();
    this._refreshResetVisibility();

    return {
      caseBrowserContainer: rootEl.querySelector('.case-browser-container'),
      reelContainer:        rootEl.querySelector('.reel-container'),
      overlayContainer:     rootEl,
      marketContainer:      rootEl.querySelector('.market-container'),
      inventoryContainer:   rootEl.querySelector('.inventory-container'),
    };
  },

  // ── View transitions ────────────────────────────────────────────────────────

  /** Switch to the case-selection grid. Clears any selected case. */
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
    _openCost        = Math.round((casePrice + KEY_COST_USD) * 100) / 100;
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

    } else { // 'cases'
      this._leaveCurrentView();
      // Return to the reel if a case is selected, otherwise go to browser
      if (_selectedCaseId) {
        _currentView = 'reel';
        this._applyView();
      } else {
        _currentView = 'browser';
        this._applyView();
      }
    }
  },

  /** Fires the "leave" callback for whichever view is currently active. */
  _leaveCurrentView() {
    if (_currentView === 'inventory') _onHideInventory?.();
    if (_currentView === 'market')    _onHideMarket?.();
  },

  /** Syncs all view classes, nav tab states, and opening-mode controls. */
  _applyView() {
    const v = _currentView;
    _appEl.querySelector('#browser-view').classList.toggle('active',   v === 'browser');
    _appEl.querySelector('#reel-view').classList.toggle('active',      v === 'reel');
    _appEl.querySelector('#market-view').classList.toggle('active',    v === 'market');
    _appEl.querySelector('#inventory-view').classList.toggle('active', v === 'inventory');

    const inCases = v === 'browser' || v === 'reel';
    _appEl.querySelectorAll('.nav-tab').forEach(t => {
      const tv = t.dataset.view;
      t.classList.toggle('active',
        tv === 'cases'     ? inCases      :
        tv === 'market'    ? v === 'market'    :
        tv === 'inventory' ? v === 'inventory' : false
      );
    });

    const showOpenControls = v === 'reel' && !!_selectedCaseId;
    if (showOpenControls) {
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
