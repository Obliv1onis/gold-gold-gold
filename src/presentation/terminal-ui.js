import { TerminalOrchestrator } from '../core/terminal-orchestrator.js';
import { FloatService }         from '../foundation/float-service.js';

let _overlay  = null;
let _onClosed = null;

/**
 * Full-screen overlay for terminal opening sessions.
 * Shows up to 5 sequential skin offers with Buy / Skip / End controls.
 *
 * @example
 * TerminalUI.init(document.getElementById('app'), () => {});
 * // When a terminal is selected in the browser:
 * TerminalUI.show('terminal_genesis');
 */
export const TerminalUI = {
  /**
   * Creates the overlay and appends it (hidden) to container.
   * @param {HTMLElement} container
   * @param {function}    [onClosed]
   */
  init(container, onClosed) {
    _onClosed = onClosed ?? (() => {});
    _overlay  = document.createElement('div');
    _overlay.className = 'terminal-overlay';
    _overlay.setAttribute('hidden', '');
    container.appendChild(_overlay);
  },

  /**
   * Opens a terminal session, charging entryCost upfront.
   * @param {string} terminalId
   * @param {number} [entryCost] - terminal market_price to charge on open
   */
  show(terminalId, entryCost = 0) {
    if (!_overlay) return;
    _overlay.innerHTML = '';
    _overlay.removeAttribute('hidden');
    TerminalOrchestrator.open(terminalId, entryCost, {
      onOffer:   (skin, num, isFinal) => this._renderOffer(skin, num, isFinal),
      onClose:   ()                   => this.hide(),
      onBlocked: (reason)             => this._renderBlocked(reason),
    });
  },

  hide() {
    if (!_overlay) return;
    _overlay.innerHTML = '';
    _overlay.setAttribute('hidden', '');
    _onClosed();
  },

  _renderOffer(skin, offerNum, isFinal) {
    if (!_overlay) return;
    _overlay.innerHTML = '';

    const rarity    = skin.rarity ?? 'unknown';
    const wearLabel = FloatService.getWearLabel(skin.wear_tier);
    const floatStr  = FloatService.formatFloat(skin.float);

    // Card
    const card = document.createElement('div');
    card.className = `terminal-card rarity-${rarity}`;

    // Offer counter
    const counter = document.createElement('div');
    counter.className   = 'terminal-offer-counter';
    counter.textContent = `Offer ${offerNum} / 5`;
    card.appendChild(counter);

    // Image
    const imgWrap = document.createElement('div');
    imgWrap.className = 'terminal-skin-img-wrap';
    if (skin.image_url) {
      const img = document.createElement('img');
      img.className = 'terminal-skin-img';
      img.src = skin.image_url;
      img.alt = `${skin.weapon} | ${skin.skin}`;
      imgWrap.appendChild(img);
    } else {
      const ph = document.createElement('div');
      ph.className = 'terminal-img-placeholder';
      imgWrap.appendChild(ph);
    }
    card.appendChild(imgWrap);

    // Name
    const nameEl = document.createElement('div');
    nameEl.className   = 'terminal-skin-name';
    nameEl.textContent = `${skin.weapon} | ${skin.skin}`;
    card.appendChild(nameEl);

    // Wear + float row
    const meta = document.createElement('div');
    meta.className = 'terminal-skin-meta';
    const wearBadge = document.createElement('span');
    wearBadge.className   = `terminal-wear-badge rarity-${rarity}`;
    wearBadge.textContent = wearLabel;
    const floatVal = document.createElement('span');
    floatVal.className   = 'terminal-float-val';
    floatVal.textContent = floatStr;
    meta.appendChild(wearBadge);
    meta.appendChild(floatVal);
    card.appendChild(meta);

    // Error slot (hidden)
    const errEl = document.createElement('div');
    errEl.className = 'terminal-error';
    errEl.setAttribute('hidden', '');
    card.appendChild(errEl);

    // Actions
    const actions = document.createElement('div');
    actions.className = 'terminal-actions';

    const buyBtn = document.createElement('button');
    buyBtn.className = 'btn-terminal-buy';
    const buyLabel = document.createElement('span');
    buyLabel.textContent = 'Buy ';
    const buyPrice = document.createElement('span');
    buyPrice.className   = 'terminal-price';
    buyPrice.textContent = `$${skin.market_price.toFixed(2)}`;
    buyBtn.appendChild(buyLabel);
    buyBtn.appendChild(buyPrice);
    buyBtn.addEventListener('click', () => TerminalOrchestrator.buy(skin));

    const skipBtn = document.createElement('button');
    skipBtn.className = 'btn-terminal-skip';
    skipBtn.disabled  = true;
    const label = isFinal ? 'End' : 'Skip';
    let countdown = 3;
    skipBtn.textContent = `${label} (${countdown}s)`;
    const timer = setInterval(() => {
      countdown--;
      if (countdown <= 0) {
        clearInterval(timer);
        skipBtn.textContent = label;
        skipBtn.disabled = false;
      } else {
        skipBtn.textContent = `${label} (${countdown}s)`;
      }
    }, 1000);
    skipBtn.addEventListener('click', () => TerminalOrchestrator.skip());

    actions.appendChild(buyBtn);
    actions.appendChild(skipBtn);
    card.appendChild(actions);

    _overlay.appendChild(card);
  },

  _showError(reason) {
    const errEl = _overlay?.querySelector('.terminal-error');
    if (!errEl) return;
    errEl.textContent = reason === 'insufficient_funds' ? 'Insufficient balance.' : 'Error.';
    errEl.removeAttribute('hidden');
    setTimeout(() => errEl.setAttribute('hidden', ''), 2600);
  },

  _renderBlocked(reason) {
    if (!_overlay) return;
    _overlay.innerHTML = '';
    const card = document.createElement('div');
    card.className = 'terminal-card rarity-unknown';
    const msg = document.createElement('div');
    msg.className   = 'terminal-skin-name';
    msg.textContent = reason === 'insufficient_funds' ? 'Insufficient balance.' : 'Cannot open terminal.';
    const closeBtn = document.createElement('button');
    closeBtn.className   = 'btn-terminal-skip';
    closeBtn.textContent = 'Close';
    closeBtn.style.marginTop = '12px';
    closeBtn.addEventListener('click', () => this.hide());
    card.appendChild(msg);
    card.appendChild(closeBtn);
    _overlay.appendChild(card);
  },
};
