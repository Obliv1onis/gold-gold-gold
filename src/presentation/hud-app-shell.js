import { VirtualEconomy, KEY_COST_USD } from '../core/virtual-economy.js';
import { CaseInventory }               from '../core/case-inventory.js';
import { SkinInventory }               from '../core/skin-inventory.js';
import { Events }                      from '../foundation/events.js';
import { i18n }                        from '../foundation/i18n.js';

// ─── Module-level state ───────────────────────────────────────────────────────

let _isAnimating      = false;
let _revealVisible    = false;
let _reelReady        = false;
let _selectedCaseId   = null;
let _caseMarketPrice  = 0;
let _openCost         = 0;
let _currentView      = 'home'; // 'home' | 'browser' | 'reel' | 'market' | 'tradeup' | 'inventory' | 'credits'
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
let _balanceEl      = null;
let _invValueEl     = null;
let _openBtn        = null;
let _caseCountEl    = null;
let _resetBtn       = null;
let _resetOverlay   = null;
let _errorEl        = null;
let _openSection    = null;
let _backBtn        = null;
let _appEl          = null;

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
        <button class="btn-back" hidden data-i18n="back_home">← Home</button>
        <div class="hud-balance">
          <span class="balance-label" data-i18n="balance">Balance</span>
          <span class="balance-value">$0.00</span>
        </div>
        <div class="hud-inv-value">
          <span class="inv-value-label" data-i18n="inv_value">Inventory Value</span>
          <span class="inv-value-amount">$0.00</span>
        </div>
        <div class="hud-open-section" hidden>
          <span class="case-count-badge">0 owned</span>
          <button class="btn-open" disabled>Open</button>
          <span class="hud-error-msg" hidden></span>
        </div>
        <div class="hud-actions">
          <div class="lang-wrap">
            <button class="btn-language" data-i18n="language">Language</button>
            <div class="lang-dropdown" hidden>
              <button class="lang-option ${i18n.getLocale() === 'en-US' ? 'active' : ''}" data-locale="en-US">🇺🇸 English (US)</button>
              <button class="lang-option ${i18n.getLocale() === 'zh-CN' ? 'active' : ''}" data-locale="zh-CN">🇨🇳 中文（简体）</button>
            </div>
          </div>
          <button class="btn-reset" data-i18n="reset">Reset</button>
        </div>
      </header>

      <div class="reset-modal-overlay" hidden>
        <div class="reset-modal">
          <div class="reset-modal-title" data-i18n="reset_title">Reset Account?</div>
          <div class="reset-modal-body" data-i18n="reset_body">This will clear your entire inventory and set your balance back to $2,000.00. This cannot be undone.</div>
          <div class="reset-modal-buttons">
            <button class="btn-reset-cancel" data-i18n="cancel">Cancel</button>
            <button class="btn-reset-confirm" data-i18n="reset">Reset</button>
          </div>
        </div>
      </div>

      <nav class="nav-tabs">
        <span class="nav-tab active" data-view="home"      data-i18n="nav_home">Home</span>
        <span class="nav-tab"        data-view="market"    data-i18n="nav_market">Market</span>
        <span class="nav-tab"        data-view="tradeup"   data-i18n="nav_tradeup">Trade Up</span>
        <span class="nav-tab"        data-view="inventory" data-i18n="nav_inventory">Inventory</span>
        <span class="nav-tab"        data-view="credits"   data-i18n="nav_credits">Credits</span>
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
        <div class="view" id="credits-view">
          <div class="credits-page">
            <h2 class="credits-title">Credits</h2>

            <section class="credits-section">
              <h3 class="credits-section-title">License</h3>
              <p class="credits-text">
                This project is released under the
                <strong>MIT License</strong>.
                You are free to use, copy, modify, merge, publish, distribute,
                sublicense, and/or sell copies of the software, provided the
                original copyright notice and permission notice are included in
                all copies or substantial portions of the software.
              </p>
              <p class="credits-text credits-text--muted">
                THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
                EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
                MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
                NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
                HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
                WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
                OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
                DEALINGS IN THE SOFTWARE.
              </p>
            </section>

            <section class="credits-section">
              <h3 class="credits-section-title">Links</h3>
              <ul class="credits-links">
                <li>
                  <a class="credits-link" href="https://github.com/Obliv1onis/gold-gold-gold" target="_blank" rel="noopener noreferrer">GitHub Repo</a>
                </li>
                <li>
                  <a class="credits-link" href="https://space.bilibili.com/646730673?spm_id_from=333.1007.0.0" target="_blank" rel="noopener noreferrer">Bilibili</a>
                </li>
                <li>
                  <a class="credits-link" href="https://steamcommunity.com/id/obliv1onis_/" target="_blank" rel="noopener noreferrer">Steam Profile</a>
                </li>
              </ul>
            </section>

            <section class="credits-section">
              <h3 class="credits-section-title">Contact</h3>
              <p class="credits-text">
                <a class="credits-link credits-link--email" href="mailto:tomori.tkmt@gmail.com">tomori.tkmt@gmail.com</a>
              </p>
            </section>
          </div>
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
    _balanceEl    = rootEl.querySelector('.balance-value');
    _invValueEl   = rootEl.querySelector('.inv-value-amount');
    _openBtn      = rootEl.querySelector('.btn-open');
    _caseCountEl  = rootEl.querySelector('.case-count-badge');
    _resetBtn     = rootEl.querySelector('.btn-reset');
    _resetOverlay = rootEl.querySelector('.reset-modal-overlay');
    _errorEl      = rootEl.querySelector('.hud-error-msg');
    _openSection  = rootEl.querySelector('.hud-open-section');
    _backBtn      = rootEl.querySelector('.btn-back');

    // Language button + dropdown
    const langBtn      = rootEl.querySelector('.btn-language');
    const langDropdown = rootEl.querySelector('.lang-dropdown');
    langBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const hidden = langDropdown.hasAttribute('hidden');
      if (hidden) langDropdown.removeAttribute('hidden');
      else langDropdown.setAttribute('hidden', '');
    });
    langDropdown.querySelectorAll('.lang-option').forEach(btn => {
      btn.addEventListener('click', () => {
        i18n.setLocale(btn.dataset.locale);
        langDropdown.querySelectorAll('.lang-option').forEach(b =>
          b.classList.toggle('active', b.dataset.locale === btn.dataset.locale));
        langDropdown.setAttribute('hidden', '');
      });
    });
    // Close dropdown when clicking outside
    document.addEventListener('click', () => langDropdown.setAttribute('hidden', ''));
    langDropdown.addEventListener('click', e => e.stopPropagation());

    // Re-apply dynamic strings on locale change
    document.addEventListener('locale-changed', () => {
      rootEl.querySelectorAll('.home-tile__count[data-subtitle-key]').forEach(el => {
        el.textContent = i18n.t(el.dataset.subtitleKey, { n: Number(el.dataset.subtitleN) });
      });
      this._refreshCaseCount();
      if (_currentView === 'reel' && _selectedCaseId) {
        _openBtn.textContent = `${i18n.t('open_btn')} ($${_openCost.toFixed(2)})`;
      }
      if (_currentView === 'browser') _backBtn.textContent = i18n.t('back_home');
      else if (_currentView === 'reel') _backBtn.textContent = i18n.t('back');
    });

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

    // Reset button — opens modal
    _resetBtn.addEventListener('click', () => {
      if (_isAnimating) return;
      _resetOverlay.removeAttribute('hidden');
    });
    _resetOverlay.querySelector('.btn-reset-cancel').addEventListener('click', () => {
      _resetOverlay.setAttribute('hidden', '');
    });
    _resetOverlay.querySelector('.btn-reset-confirm').addEventListener('click', () => {
      _resetOverlay.setAttribute('hidden', '');
      this._handleReset();
    });
    _resetOverlay.addEventListener('click', e => {
      if (e.target === _resetOverlay) _resetOverlay.setAttribute('hidden', '');
    });

    // Tab navigation
    rootEl.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => this._handleTabClick(tab.dataset.view));
    });

    // DOM events
    document.addEventListener(Events.BALANCE_CHANGED,        e  => this._onBalanceChanged(e));
    document.addEventListener(Events.CASE_INVENTORY_CHANGED, () => this._refreshCaseCount());
    document.addEventListener(Events.SKIN_INVENTORY_CHANGED, () => {
      this._refreshInvValue();
    });
    document.addEventListener(Events.REEL_READY,             () => { _reelReady = true; this._evaluateOpenButton(); });

    // Initial render
    this._refreshBalance();
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

    _openBtn.textContent = `${i18n.t('open_btn')} ($${_openCost.toFixed(2)})`;
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

    } else if (view === 'credits') {
      this._leaveCurrentView();
      _currentView = 'credits';
      this._applyView();

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
    _appEl.querySelector('#credits-view').classList.toggle('active',   v === 'credits');

    const inHome = v === 'home' || v === 'browser' || v === 'reel';
    _appEl.querySelectorAll('.nav-tab').forEach(t => {
      const tv = t.dataset.view;
      t.classList.toggle('active',
        tv === 'home'      ? inHome            :
        tv === 'market'    ? v === 'market'    :
        tv === 'tradeup'   ? v === 'tradeup'   :
        tv === 'inventory' ? v === 'inventory' :
        tv === 'credits'   ? v === 'credits'   : false
      );
    });

    // Back button: visible in browser (→ Home) and reel (→ browser)
    if (v === 'browser') {
      _backBtn.textContent = i18n.t('back_home');
      _backBtn.removeAttribute('hidden');
      _openSection.setAttribute('hidden', '');
    } else if (v === 'reel' && _selectedCaseId) {
      _backBtn.textContent = i18n.t('back');
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
  },

  _onBalanceChanged(e) {
    const { balance } = e.detail ?? {};
    const val = (typeof balance === 'number' && isFinite(balance))
      ? balance
      : VirtualEconomy.getBalance();
    _balanceEl.textContent = _formatBalance(val);
    this._evaluateOpenButton();
  },

  _refreshCaseCount() {
    if (!_selectedCaseId || !_caseCountEl) return;
    const count = CaseInventory.getCaseCount(_selectedCaseId);
    _caseCountEl.textContent = i18n.t('n_owned', { n: count });
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

  _handleReset() {
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
    badge.dataset.i18n = 'coming_soon';
    badge.textContent = i18n.t('coming_soon');
    tile.appendChild(badge);
  }

  const imgWrap = document.createElement('div');
  imgWrap.className = 'home-tile__img-wrap';
  if (cat.image) {
    const img = document.createElement('img');
    img.className = 'home-tile__img';
    img.src = cat.image;
    img.alt = cat.titleKey ? i18n.t(cat.titleKey) : (cat.title ?? '');
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
  if (cat.titleKey) {
    title.dataset.i18n = cat.titleKey;
    title.textContent  = i18n.t(cat.titleKey);
  } else {
    title.textContent = cat.title ?? '';
  }
  content.appendChild(title);

  if (cat.subtitleKey) {
    const count = document.createElement('div');
    count.className            = 'home-tile__count';
    count.dataset.subtitleKey  = cat.subtitleKey;
    count.dataset.subtitleN    = cat.subtitleN ?? 0;
    count.textContent          = i18n.t(cat.subtitleKey, { n: cat.subtitleN ?? 0 });
    content.appendChild(count);
  } else if (cat.subtitle) {
    const count = document.createElement('div');
    count.className   = 'home-tile__count';
    count.textContent = cat.subtitle;
    content.appendChild(count);
  }

  tile.appendChild(content);
  return tile;
}

function _formatBalance(balance) {
  if (balance === Infinity) return 'Infinity';
  const n = (typeof balance === 'number' && isFinite(balance)) ? balance : 0;
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function _blockedMessage(reason) {
  switch (reason) {
    case 'no_case':            return i18n.t('err_no_case');
    case 'insufficient_funds': return i18n.t('err_no_funds');
    case 'roll_error':         return i18n.t('err_roll');
    default:                   return i18n.t('err_open');
  }
}
