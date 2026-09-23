// All application event name constants. Import Events.* everywhere — no inline strings.
// See ADR-0003 for dispatch/subscribe patterns and payload contracts.

export const Events = {
  // Core layer — game state changes
  BALANCE_CHANGED:        'balance-changed',
  CASE_INVENTORY_CHANGED: 'case-inventory-changed',
  SKIN_INVENTORY_CHANGED: 'skin-inventory-changed',
  ARMORY_PASS_CHANGED:    'armory-pass-changed',

  // Feature layer — async data
  PRICE_UPDATED:          'price-updated',
  THEME_CHANGED:          'theme-changed',

  // Presentation layer — UI readiness
  REEL_READY:             'reel-ready',
};
