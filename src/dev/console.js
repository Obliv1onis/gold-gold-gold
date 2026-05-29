/**
 * Browser console dev toolkit.
 * All commands live on `window.game` so they're easy to call from DevTools.
 *
 * Usage (browser console):
 *   game.devMode(1|true)  — turn dev mode on            (always accessible)
 *   game.devMode(0|false) — turn dev mode off           (always accessible)
 *   game.help()           — list commands               (always accessible)
 *   game.setBalance(num)  — set balance to num          (dev mode only)
 *   game.prototype(1|0)   — jump to / from prototype    (dev mode only)
 *   game.confirm()        — confirm a pending action    (dev mode only)
 */

import { VirtualEconomy } from '../core/virtual-economy.js';

let _devMode = false;
let _badge   = null;
let _pending = null; // stores a queued action waiting for game.confirm()

function _applyDevMode(on) {
  document.body.classList.toggle('dev-mode', on);

  if (on && !_badge) {
    _badge = document.createElement('div');
    _badge.id = 'dev-mode-badge';
    _badge.textContent = 'DEV';
    document.body.appendChild(_badge);
  }
  if (_badge) _badge.hidden = !on;

  console.log(
    `%c[DEV] Dev mode ${on ? 'ON ✓' : 'OFF'}`,
    `color: ${on ? '#4caf50' : '#e57373'}; font-weight: bold`,
  );
}

// ─── Command registry ─────────────────────────────────────────────────────────

const _commands = {
  devMode(val) {
    if (val === undefined) {
      _devMode = !_devMode;
    } else if (val === 0 || val === false) {
      _devMode = false;
    } else if (val === 1 || val === true) {
      _devMode = true;
    } else {
      console.warn('%c[game] devMode accepts: 1, 0, true, false, or nothing.', 'color: #e57373');
      return;
    }
    _applyDevMode(_devMode);
  },

  help() {
    console.log('%c── game console commands ──────────────────', 'color: #81c784; font-weight: bold');
    console.log('%c  game.devMode(1|0)    %c  turn on/off, or toggle if empty',           'color: #ffd54f', 'color: #aaa');
    console.log('%c  game.help()          %c  show this list',                            'color: #ffd54f', 'color: #aaa');
    console.log('%c  game.setBalance(num) %c  set balance to num (up to 2 decimals) [dev]', 'color: #ffd54f', 'color: #aaa');
    console.log('%c  game.prototype(1|0)  %c  jump to / from the prototype page      [dev]', 'color: #ffd54f', 'color: #aaa');
    console.log('%c  game.confirm()       %c  confirm a pending action               [dev]', 'color: #ffd54f', 'color: #aaa');
  },

  // ── Add custom dev commands below this line ───────────────────────────────

  prototype(val) {
    const PROTO_PATH = '/prototypes/vault-concept/prototype.html';
    const onProto    = window.location.pathname === PROTO_PATH;

    let goTo;
    if (val === undefined) {
      goTo = !onProto;
    } else if (val === 1 || val === true) {
      goTo = true;
    } else if (val === 0 || val === false) {
      goTo = false;
    } else {
      console.warn('%c[game] prototype accepts: 1, 0, true, false, or nothing.', 'color: #e57373');
      return;
    }

    // Navigating away from prototype needs no confirmation
    if (!goTo) {
      window.location.href = '/';
      return;
    }

    // Navigating TO prototype — require confirmation first
    _pending = () => { window.location.href = PROTO_PATH; };
    console.log(
      '%c[game] ⚠ This command is only to turn on the early dev stage prototype.\n' +
      '        Are you sure you want to proceed? Type %cgame.confirm()%c to confirm.',
      'color: #f9a825; font-weight: bold',
      'color: #ffd54f; font-weight: bold',
      'color: #f9a825; font-weight: bold',
    );
  },

  confirm() {
    if (!_pending) {
      console.warn('%c[game] Nothing to confirm.', 'color: #e57373');
      return;
    }
    const action = _pending;
    _pending = null;
    action();
  },

  setBalance(num) {
    if (!Number.isFinite(num) || num < 0) {
      console.warn('%c[game] setBalance requires a non-negative number.', 'color: #e57373');
      return;
    }
    const target  = Math.round(num * 100) / 100;
    const current = VirtualEconomy.getBalance();
    const diff    = Math.round((target - current) * 100) / 100;
    if (diff > 0)      VirtualEconomy.earn(diff);
    else if (diff < 0) VirtualEconomy.spend(-diff);
    console.log(`%c[game] Balance set to $${target.toFixed(2)}`, 'color: #4caf50; font-weight: bold');
  },

};

// ─── Access-control proxy ─────────────────────────────────────────────────────

export function initDevConsole() {
  window.game = new Proxy(_commands, {
    get(target, prop) {
      if (typeof prop !== 'string' || prop === 'devMode') return target[prop];

      // help() is always allowed
      if (prop === 'help') return target.help;

      if (!_devMode) {
        return () => console.warn(
          '%c[game] Dev mode is off. Run %cgame.devMode()%c to enable.',
          'color: #e57373', 'color: #ffd54f', 'color: #e57373',
        );
      }

      if (!(prop in target)) {
        return () => console.warn(`%c[game] Unknown command: ${prop}`, 'color: #e57373');
      }

      return target[prop];
    },
  });

  console.log(
    '%c[game] console ready — type %cgame.help()%c for commands',
    'color: #555; font-style: italic',
    'color: #81c784',
    'color: #555; font-style: italic',
  );
}
