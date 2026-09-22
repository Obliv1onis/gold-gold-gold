import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/feature/skin-image-loader.js', () => ({
  SkinImageLoader: {
    preloadCase: vi.fn(),
    getImage:    vi.fn(),
  },
}));
vi.mock('../../../src/foundation/case-data-store.js', () => ({
  CaseDataStore: { getCase: vi.fn(), getItems: vi.fn() },
}));

import { ReelUI }          from '../../../src/presentation/reel-ui.js';
import { SkinImageLoader } from '../../../src/feature/skin-image-loader.js';
import { CaseDataStore }   from '../../../src/foundation/case-data-store.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const POOL = Array.from({ length: 10 }, (_, i) => ({
  item_id: `item_${i}`,
  weapon: 'P250',
  skin: `Skin${i}`,
  rarity: 'mil_spec',
  image_url: `https://cdn/item${i}.png`,
  stattrak: false,
}));

const STRIP = Array.from({ length: 60 }, (_, i) => POOL[i % POOL.length]);

function makeContainer() {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

beforeEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  SkinImageLoader.preloadCase.mockResolvedValue({ loaded: 10, failed: 0, skipped: 0 });
  SkinImageLoader.getImage.mockImplementation(() => document.createElement('img'));
  // Use mil_spec: 100 so _pickTier always picks mil_spec — deterministic for DOM tests
  CaseDataStore.getCase.mockReturnValue({
    id: 'recoil_case',
    name: 'Recoil Case',
    image_url: 'https://cdn/recoil-case.png',
    rarity_weights: { mil_spec: 100 },
  });
  CaseDataStore.getItems.mockImplementation((_caseId, rarity) => rarity === 'mil_spec' ? [...POOL] : []);
});

// ─── initialize ───────────────────────────────────────────────────────────────

describe('ReelUI — initialize', () => {
  it('test_rui_initialize_creates_reel_viewport', async () => {
    const container = makeContainer();
    await ReelUI.initialize(container, 'recoil_case');
    expect(container.querySelector('.reel-viewport')).toBeTruthy();
    container.remove();
  });

  it('test_rui_initialize_creates_reel_strip', async () => {
    const container = makeContainer();
    await ReelUI.initialize(container, 'recoil_case');
    expect(container.querySelector('.reel-strip')).toBeTruthy();
    container.remove();
  });

  it('test_rui_initialize_creates_center_marker', async () => {
    const container = makeContainer();
    await ReelUI.initialize(container, 'recoil_case');
    expect(container.querySelector('.reel-center-marker')).toBeTruthy();
    container.remove();
  });

  it('test_rui_initialize_calls_preload_case', async () => {
    const container = makeContainer();
    await ReelUI.initialize(container, 'recoil_case');
    expect(SkinImageLoader.preloadCase).toHaveBeenCalledWith('recoil_case');
    container.remove();
  });

  it('test_rui_initialize_emits_reel_ready_event', async () => {
    const container = makeContainer();
    const handler = vi.fn();
    document.addEventListener('reel-ready', handler);
    await ReelUI.initialize(container, 'recoil_case');
    expect(handler).toHaveBeenCalledTimes(1);
    document.removeEventListener('reel-ready', handler);
    container.remove();
  });

  it('shows the case and contents preview before the reel', async () => {
    const container = makeContainer();
    await ReelUI.initialize(container, 'recoil_case');

    expect(container.querySelector('.case-opening-hero__title').textContent).toBe('Recoil Case');
    expect(container.querySelectorAll('.case-content-card')).toHaveLength(POOL.length);
    expect(container.querySelector('.reel-roll-stage').getAttribute('aria-hidden')).toBe('true');
    expect(container.classList.contains('is-roll-mode')).toBe(false);
    container.remove();
  });

  it('orders preview contents from low to high rarity', async () => {
    const byRarity = {
      consumer_grade: [{ ...POOL[0], weapon: 'Nova', skin: 'Low' }],
      mil_spec: [{ ...POOL[1], weapon: 'P250', skin: 'Middle' }],
      covert: [{ ...POOL[2], weapon: 'AK-47', skin: 'High' }],
      rare_special: [{ ...POOL[3], weapon: 'Knife', skin: '★ Rare' }],
    };
    CaseDataStore.getItems.mockImplementation((_caseId, rarity) => byRarity[rarity] ?? []);
    const container = makeContainer();
    await ReelUI.initialize(container, 'recoil_case');

    const rarities = [...container.querySelectorAll('.case-content-card')]
      .map(card => [...card.classList].find(name => name.startsWith('rarity-')));
    expect(rarities).toEqual([
      'rarity-consumer_grade',
      'rarity-mil_spec',
      'rarity-covert',
      'rarity-rare_special',
    ]);
    container.remove();
  });

  it('smoothly switches from preview mode to roll mode', async () => {
    vi.useFakeTimers();
    const container = makeContainer();
    await ReelUI.initialize(container, 'recoil_case');

    const transition = ReelUI.transitionToRoll();
    await Promise.resolve();
    await Promise.resolve();
    expect(container.classList.contains('is-roll-mode')).toBe(true);
    expect(container.querySelector('.reel-roll-stage').getAttribute('aria-hidden')).toBe('false');

    vi.advanceTimersByTime(420);
    await transition;
    expect(container.querySelector('.case-opening-preview').getAttribute('aria-hidden')).toBe('true');
    container.remove();
  });

  it('restores the contents preview after a roll', async () => {
    vi.useFakeTimers();
    const container = makeContainer();
    await ReelUI.initialize(container, 'recoil_case');

    const transition = ReelUI.transitionToRoll();
    await Promise.resolve();
    await Promise.resolve();
    vi.advanceTimersByTime(420);
    await transition;

    ReelUI.returnToPreview();

    expect(container.classList.contains('is-roll-mode')).toBe(false);
    expect(container.querySelector('.case-opening-preview').getAttribute('aria-hidden')).toBe('false');
    expect(container.querySelector('.reel-roll-stage').getAttribute('aria-hidden')).toBe('true');
    container.remove();
  });
});

// ─── render ───────────────────────────────────────────────────────────────────

describe('ReelUI — render', () => {
  it('test_rui_render_first_call_builds_60_cards', async () => {
    const container = makeContainer();
    await ReelUI.initialize(container, 'recoil_case');
    ReelUI.render(0, STRIP);
    const cards = container.querySelectorAll('.reel-card');
    expect(cards.length).toBe(60);
    container.remove();
  });

  it('test_rui_render_applies_transform_translateX', async () => {
    const container = makeContainer();
    await ReelUI.initialize(container, 'recoil_case');
    ReelUI.render(500, STRIP);
    const strip = container.querySelector('.reel-strip');
    expect(strip.style.transform).toBe('translateX(-500px)');
    container.remove();
  });

  it('test_rui_render_updates_transform_on_subsequent_calls', async () => {
    const container = makeContainer();
    await ReelUI.initialize(container, 'recoil_case');
    ReelUI.render(0, STRIP);
    ReelUI.render(1000, STRIP);
    ReelUI.render(5000, STRIP);
    const strip = container.querySelector('.reel-strip');
    expect(strip.style.transform).toBe('translateX(-5000px)');
    container.remove();
  });

  it('test_rui_render_does_not_rebuild_cards_on_second_call', async () => {
    const container = makeContainer();
    await ReelUI.initialize(container, 'recoil_case');
    ReelUI.render(0, STRIP);
    const cardsBefore = container.querySelectorAll('.reel-card').length;
    ReelUI.render(500, STRIP);
    const cardsAfter = container.querySelectorAll('.reel-card').length;
    expect(cardsAfter).toBe(cardsBefore);
    // getImage should not be called again for card builds
    const callsBefore = SkinImageLoader.getImage.mock.calls.length;
    ReelUI.render(1000, STRIP);
    expect(SkinImageLoader.getImage.mock.calls.length).toBe(callsBefore);
    container.remove();
  });

  it('test_rui_render_card_has_rarity_class', async () => {
    const container = makeContainer();
    await ReelUI.initialize(container, 'recoil_case');
    ReelUI.render(0, STRIP);
    const firstCard = container.querySelector('.reel-card');
    expect(firstCard.classList.contains('rarity-mil_spec')).toBe(true);
    container.remove();
  });

  it('test_rui_render_card_name_matches_item', async () => {
    const container = makeContainer();
    await ReelUI.initialize(container, 'recoil_case');
    ReelUI.render(0, STRIP);
    const nameEl = container.querySelector('.reel-card .card-name');
    expect(nameEl.textContent).toBe(`${STRIP[0].weapon} | ${STRIP[0].skin}`);
    container.remove();
  });
});

// ─── resetSpin ────────────────────────────────────────────────────────────────

describe('ReelUI — resetSpin', () => {
  it('test_rui_reset_spin_causes_next_render_to_rebuild_cards', async () => {
    const container = makeContainer();
    await ReelUI.initialize(container, 'recoil_case');

    ReelUI.render(0, STRIP);
    const callsAfterFirst = SkinImageLoader.getImage.mock.calls.length;

    // Second render without reset — no rebuild
    ReelUI.render(500, STRIP);
    expect(SkinImageLoader.getImage.mock.calls.length).toBe(callsAfterFirst);

    // Reset then render — should rebuild
    ReelUI.resetSpin();
    ReelUI.render(0, STRIP);
    expect(SkinImageLoader.getImage.mock.calls.length).toBeGreaterThan(callsAfterFirst);

    container.remove();
  });
});

// ─── viewportWidth ────────────────────────────────────────────────────────────

describe('ReelUI — viewportWidth', () => {
  it('test_rui_viewport_width_falls_back_to_800_when_not_in_dom', () => {
    // ReelUI not initialized — no _viewport
    // OR viewport not in DOM so offsetWidth = 0
    // Either way fallback kicks in
    expect(ReelUI.viewportWidth).toBe(800);
  });
});
