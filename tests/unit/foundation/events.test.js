import { describe, it, expect, beforeEach } from 'vitest';
import { Events } from '../../../src/foundation/events.js';

describe('Events constants', () => {
  it('test_events_balance_changed_is_correct_string', () => {
    expect(Events.BALANCE_CHANGED).toBe('balance-changed');
  });

  it('test_events_case_inventory_changed_is_correct_string', () => {
    expect(Events.CASE_INVENTORY_CHANGED).toBe('case-inventory-changed');
  });

  it('test_events_skin_inventory_changed_is_correct_string', () => {
    expect(Events.SKIN_INVENTORY_CHANGED).toBe('skin-inventory-changed');
  });

  it('test_events_price_updated_is_correct_string', () => {
    expect(Events.PRICE_UPDATED).toBe('price-updated');
  });

  it('test_events_reel_ready_is_correct_string', () => {
    expect(Events.REEL_READY).toBe('reel-ready');
  });

  it('test_events_has_exactly_five_constants', () => {
    expect(Object.keys(Events)).toHaveLength(5);
  });

  it('test_events_all_values_are_unique_strings', () => {
    const values = Object.values(Events);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
    values.forEach(v => expect(typeof v).toBe('string'));
  });
});

describe('Events — dispatch/subscribe pattern (ADR-0003)', () => {
  it('test_events_balance_changed_listener_receives_correct_detail', () => {
    // Arrange
    let received = null;
    document.addEventListener(Events.BALANCE_CHANGED, ({ detail }) => { received = detail; }, { once: true });

    // Act
    document.dispatchEvent(new CustomEvent(Events.BALANCE_CHANGED, { detail: { balance: 1500 } }));

    // Assert
    expect(received).toEqual({ balance: 1500 });
  });

  it('test_events_skin_inventory_changed_listener_receives_inventory_array', () => {
    // Arrange
    let received = null;
    document.addEventListener(Events.SKIN_INVENTORY_CHANGED, ({ detail }) => { received = detail; }, { once: true });

    // Act
    const inventory = [{ item_id: 'ak47_icecoaled', weapon: 'AK-47' }];
    document.dispatchEvent(new CustomEvent(Events.SKIN_INVENTORY_CHANGED, { detail: { inventory } }));

    // Assert
    expect(received.inventory).toEqual(inventory);
  });

  it('test_events_dispatch_on_document_not_window', () => {
    // Arrange — listener on window should NOT fire for document events (different targets)
    let windowFired = false;
    let documentFired = false;
    window.addEventListener(Events.BALANCE_CHANGED, () => { windowFired = true; }, { once: true });
    document.addEventListener(Events.BALANCE_CHANGED, () => { documentFired = true; }, { once: true });

    // Act
    document.dispatchEvent(new CustomEvent(Events.BALANCE_CHANGED, { detail: { balance: 0 } }));

    // Assert — document listener fired, window listener did not
    expect(documentFired).toBe(true);
    expect(windowFired).toBe(false);
  });
});
