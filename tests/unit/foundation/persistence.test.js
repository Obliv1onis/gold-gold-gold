import { describe, it, expect, beforeEach } from 'vitest';
import { Persistence } from '../../../src/foundation/persistence.js';

// jsdom provides localStorage — clear it between tests to prevent state leakage.
beforeEach(() => {
  localStorage.clear();
});

describe('Persistence — availability', () => {
  it('test_persistence_is_available_in_jsdom', () => {
    expect(Persistence.isAvailable()).toBe(true);
  });
});

describe('Persistence — save and load', () => {
  it('test_persistence_save_load_roundtrip_number', () => {
    // Arrange / Act
    Persistence.save('balance', 1500.00);

    // Assert
    expect(Persistence.load('balance', 2000.00)).toBe(1500);
  });

  it('test_persistence_save_load_roundtrip_object', () => {
    // Arrange
    const inventory = { recoil_case: 3 };

    // Act
    Persistence.save('case_inventory', inventory);

    // Assert
    expect(Persistence.load('case_inventory', {})).toEqual(inventory);
  });

  it('test_persistence_save_load_roundtrip_array', () => {
    // Arrange
    const skins = [{ item_id: 'ak47_icecoaled', weapon: 'AK-47' }];

    // Act
    Persistence.save('skin_inventory', skins);

    // Assert
    expect(Persistence.load('skin_inventory', [])).toEqual(skins);
  });

  it('test_persistence_load_returns_default_when_key_absent', () => {
    expect(Persistence.load('balance', 2000.00)).toBe(2000.00);
  });

  it('test_persistence_load_returns_null_default_when_not_specified', () => {
    expect(Persistence.load('nonexistent_key')).toBeNull();
  });

  it('test_persistence_save_writes_vault_prefix_to_localstorage', () => {
    // Arrange / Act
    Persistence.save('balance', 42);

    // Assert — raw key in localStorage has vault_ prefix
    expect(localStorage.getItem('vault_balance')).toBe('42');
  });

  it('test_persistence_load_returns_default_for_corrupted_json', () => {
    // Arrange — manually corrupt the stored value
    localStorage.setItem('vault_balance', '{ not valid json }}}');

    // Act / Assert
    expect(Persistence.load('balance', 2000.00)).toBe(2000.00);
  });
});

describe('Persistence — delete', () => {
  it('test_persistence_delete_removes_key', () => {
    // Arrange
    Persistence.save('balance', 999);

    // Act
    Persistence.delete('balance');

    // Assert
    expect(Persistence.load('balance', 2000.00)).toBe(2000.00);
    expect(localStorage.getItem('vault_balance')).toBeNull();
  });

  it('test_persistence_delete_nonexistent_key_does_not_throw', () => {
    expect(() => Persistence.delete('nonexistent_key')).not.toThrow();
  });
});

describe('Persistence — clearAll', () => {
  it('test_persistence_clearAll_removes_all_vault_keys', () => {
    // Arrange
    Persistence.save('balance', 1000);
    Persistence.save('case_inventory', { recoil_case: 1 });
    Persistence.save('skin_inventory', []);

    // Act
    Persistence.clearAll();

    // Assert
    expect(Persistence.load('balance', 2000.00)).toBe(2000.00);
    expect(Persistence.load('case_inventory', {})).toEqual({});
    expect(Persistence.load('skin_inventory', [])).toEqual([]);
  });

  it('test_persistence_clearAll_does_not_remove_non_vault_keys', () => {
    // Arrange
    localStorage.setItem('other_app_key', 'should_survive');
    Persistence.save('balance', 1000);

    // Act
    Persistence.clearAll();

    // Assert — non-vault key untouched
    expect(localStorage.getItem('other_app_key')).toBe('should_survive');
  });

  it('test_persistence_clearAll_does_not_throw_when_no_vault_keys_exist', () => {
    expect(() => Persistence.clearAll()).not.toThrow();
  });
});
