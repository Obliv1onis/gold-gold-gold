# ADR-0009: Test Framework and CI Setup

## Status
Proposed

## Date
2026-05-21

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Browser (HTML / CSS / JavaScript) |
| **Domain** | Core / Testing Infrastructure |
| **Knowledge Risk** | LOW — Vitest 2.x is stable and pre-training-data; confirmed as Vite companion in ADR-0001 |
| **References Consulted** | ADR-0001 (Vitest chosen alongside Vite), ADR-0002 (module file structure — test tree mirrors src/), ADR-0005 (localStorage isolation in tests), ADR-0006 (requestAnimationFrame mocking), ADR-0007 (Canvas/Image mocking) |
| **Post-Cutoff APIs Used** | None |
| **Verification Required** | Confirm Vitest `jsdom` environment provides `document.dispatchEvent` and `localStorage` stubs needed by Foundation module tests |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-0001 (Vite + `vite.config.js` shared with Vitest) |
| **Enables** | All Logic and Integration stories — they cannot be marked Done without passing unit/integration tests |
| **Blocks** | Pre-Production gate check requires `tests/unit/` and `tests/integration/` directories and at least one passing test file |
| **Ordering Note** | Must be Accepted and scaffolded before any story reaches implementation. Test framework must exist before first code is written. |

## Context

### Problem Statement
ADR-0001 chose Vite as the build system, which implicitly selected Vitest as the test runner (they share `vite.config.js`, eliminating dual-config overhead). This ADR formalises the test framework choice, defines the test directory structure, specifies what DOM/browser APIs must be mocked for Foundation and Core module tests, and configures the CI pipeline.

### Constraints
- Foundation and Core modules use browser APIs (`localStorage`, `document.dispatchEvent`, `requestAnimationFrame`, `AudioContext`, `Image`, `Canvas`) — tests must either mock these or run in a jsdom environment
- Vitest and Vite share `vite.config.js` — test configuration lives there, not in a separate `jest.config.js`
- CI must run tests on every push to main and every PR — no merge if tests fail
- Test files must mirror the source tree (ADR-0002): `tests/unit/[layer]/[module].test.js` for unit, `tests/integration/[scenario].test.js` for integration
- AudioContext is not implemented in jsdom — AudioSystem tests must use a mock

### Requirements
- Vitest 2.x with `jsdom` environment
- Test tree mirrors `src/` layer structure
- Browser APIs that jsdom does not implement must have shared mocks in `tests/__mocks__/`
- CI workflow: runs `npm test` on push to `main` and on all PRs; blocks merge on failure
- At least one example test file demonstrating the mock patterns

## Decision

**Use Vitest 2.x with `jsdom` environment. Test tree mirrors src/ layers. Shared mocks for AudioContext, requestAnimationFrame, and Canvas in `tests/__mocks__/`. GitHub Actions CI on all pushes and PRs.**

### Test Directory Structure

```
tests/
├── unit/
│   ├── foundation/
│   │   ├── persistence.test.js
│   │   ├── events.test.js
│   │   ├── audio-system.test.js
│   │   └── skin-image-loader.test.js
│   ├── core/
│   │   ├── virtual-economy.test.js
│   │   ├── case-inventory.test.js
│   │   ├── skin-inventory.test.js
│   │   └── case-data-store.test.js
│   └── feature/
│       ├── drop-rate-engine.test.js
│       ├── reel-animation-engine.test.js
│       └── price-api-layer.test.js
└── integration/
    ├── case-open-flow.test.js      # spin → result → inventory → balance
    └── persistence-round-trip.test.js  # mutate → persist → reload → verify
```

### Vitest Config (appended to vite.config.js)

```js
// vite.config.js
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      '/api/price': {
        target: 'https://csfloat.com/api/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/price/, ''),
      }
    }
  },

  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/__mocks__/browser-apis.js'],
    coverage: {
      reporter: ['text', 'lcov'],
      include: ['src/**/*.js'],
    },
  },
});
```

### Shared Mock File

```js
// tests/__mocks__/browser-apis.js
// Vitest setup file — runs before every test file

// AudioContext mock (jsdom does not implement Web Audio API)
globalThis.AudioContext = class {
  createOscillator() { return { connect: () => this, type: '', frequency: { value: 0 }, start: () => {}, stop: () => {} }; }
  createGain()       { return { connect: () => this, gain: { setValueAtTime: () => {}, linearRampToValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} } }; }
  get currentTime()  { return 0; }
  resume()           { return Promise.resolve(); }
  get state()        { return 'running'; }
  get destination()  { return {}; }
};

// requestAnimationFrame mock
let _rafId = 0;
globalThis.requestAnimationFrame = (cb) => { ++_rafId; Promise.resolve().then(() => cb(Date.now())); return _rafId; };
globalThis.cancelAnimationFrame  = () => {};

// Canvas mock (jsdom canvas support is limited — provide a stub for placeholder generation)
HTMLCanvasElement.prototype.getContext = () => ({
  fillStyle: '',
  fillRect: () => {},
});
HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,placeholder';

// localStorage is available in jsdom — no mock needed. Use vitest's beforeEach to clear:
// beforeEach(() => localStorage.clear());
```

### Example Unit Test

```js
// tests/unit/core/virtual-economy.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { VirtualEconomy } from '../../../src/core/virtual-economy.js';
import { Persistence }    from '../../../src/foundation/persistence.js';

describe('VirtualEconomy', () => {
  beforeEach(() => {
    localStorage.clear();
    VirtualEconomy.reset();
  });

  it('starts at the default balance of 2000', () => {
    expect(VirtualEconomy.balance).toBe(2000);
  });

  it('spend() reduces balance by the given amount', () => {
    VirtualEconomy.spend(50);
    expect(VirtualEconomy.balance).toBe(1950);
  });

  it('spend() persists the new balance to localStorage', () => {
    VirtualEconomy.spend(100);
    expect(Persistence.load('balance', 2000)).toBe(1900);
  });

  it('spend() dispatches balance-changed event with new balance', () => {
    const received = [];
    document.addEventListener('balance-changed', (e) => received.push(e.detail.balance));
    VirtualEconomy.spend(200);
    expect(received).toEqual([1800]);
  });

  it('spend() throws when amount exceeds balance', () => {
    expect(() => VirtualEconomy.spend(9999)).toThrow();
  });
});
```

### CI Workflow

```yaml
# .github/workflows/tests.yml
name: Tests
on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci
      - run: npm test
```

## Alternatives Considered

### Alternative A: Jest
- **Description**: Most widely-used JS test framework. Separate config file (`jest.config.js`). Has jsdom environment.
- **Pros**: Largest community; extensive documentation; snapshot testing.
- **Cons**: Does not natively understand ES modules without a Babel transform or `--experimental-vm-modules`; requires separate config from Vite; adds ~5MB to dev dependencies; the `vite.config.js` sharing with Vitest is a documented advantage of ADR-0001's choice.
- **Rejection Reason**: ES module compatibility requires extra config; ADR-0001 already established Vitest as the companion to Vite.

### Alternative B: Playwright (component testing)
- **Description**: E2E and component testing framework with real browser execution.
- **Pros**: Tests run in real Chrome/Firefox/Safari — no jsdom approximations.
- **Cons**: E2E tests are slow (~5-15s per test) and overkill for unit-testing pure logic modules like VirtualEconomy or DropRateEngine. Playwright is suited for integration/E2E, not unit.
- **Rejection Reason**: Unit and integration tests for formula logic do not need a real browser. Vitest with jsdom is sufficient and 100× faster for the unit test suite.

### Alternative C: No CI (run tests locally only)
- **Description**: Tests exist but are not run automatically on push.
- **Pros**: Zero setup cost.
- **Cons**: Broken tests are not caught before merge; the Pre-Production gate check requires a CI workflow file to be present.
- **Rejection Reason**: Violates the coding standards requirement: "No merge if tests fail — tests are a blocking gate in CI."

## Consequences

### Positive
- `vite.config.js` is the single configuration file for both the dev server and tests — no config duplication
- jsdom provides `document`, `localStorage`, and `CustomEvent` — the three most commonly used browser APIs in Foundation/Core tests
- Shared mock file at `tests/__mocks__/browser-apis.js` ensures AudioContext and Canvas mocks are applied consistently across all test files
- CI blocks merges on test failure — regression protection from the first commit

### Negative
- jsdom does not fully implement the Web Audio API, Canvas 2D, or requestAnimationFrame timing — mocks are approximations. Visual regression testing is explicitly out of scope (see Coding Standards: "What NOT to Automate").
- The `requestAnimationFrame` mock in setup does not replicate real 60fps frame timing — RAE tests that depend on precise timing must use mocked timestamps rather than real `Date.now()`.

### Risks
- **jsdom environment incompatibility**: Some browser API behavior in jsdom differs from real browsers (e.g., `canvas.getContext('2d')` is a stub). Tests pass in jsdom but could fail in a real browser. Mitigation: the coding standards list explicitly excludes visual/shader tests from automation; those are playtested.
- **Vitest version drift**: Vitest is a fast-moving project. `package.json` should pin `vitest` to a minor version (`~2.x`), not `latest`.

## GDD Requirements Addressed

| GDD System | Requirement | How This ADR Addresses It |
|------------|-------------|--------------------------|
| All GDDs with Acceptance Criteria | Logic stories require automated unit tests | Vitest + jsdom + shared mocks enables tests for all 17 modules |
| reel-animation-engine.md | "mock RAF advancing in 100ms steps" in AC-07 through AC-09 | `requestAnimationFrame` mock + deterministic timestamp injection in tests |
| persistence.md | Test: mock localStorage unavailable | jsdom provides `localStorage`; override `localStorage.setItem` to throw in specific tests |
| audio-system.md | AudioSystem tests — no real audio hardware in CI | `AudioContext` mock in `browser-apis.js` |
| skin-image-loader.md | `canvas.getContext('2d')` in CI | Canvas mock in `browser-apis.js` |

## Performance Implications
- **CI run time**: Vitest with jsdom runs unit tests in ~2-5 seconds for this project's scale. Integration tests add ~5-10 seconds. Total CI time: under 30 seconds.
- **Local dev**: `vitest --watch` re-runs only changed test files — fast feedback loop.
- **Build size**: Vitest and its dependencies are `devDependencies` — zero production bundle impact.

## Migration Plan
No existing tests. Scaffold on Accepted:
1. Add to `package.json`: `"test": "vitest run"`, `"test:watch": "vitest"`
2. `npm install --save-dev vitest jsdom @vitest/coverage-v8`
3. Append `test:` block to `vite.config.js`
4. Create `tests/__mocks__/browser-apis.js`
5. Create `tests/unit/` and `tests/integration/` directory structure (empty, with `.gitkeep`)
6. Write one passing example test (e.g., `tests/unit/foundation/persistence.test.js`)
7. Create `.github/workflows/tests.yml`
8. Verify `npm test` passes in CI

## Validation Criteria
- `npm test` exits 0 with at least one passing test
- `tests/unit/` and `tests/integration/` directories exist
- `.github/workflows/tests.yml` exists and runs on push to main
- A test that dispatches a `CustomEvent` on `document` and asserts the listener received `event.detail` passes
- A test that calls `Persistence.save()` and `Persistence.load()` passes (localStorage available in jsdom)
- A test that imports `AudioSystem` and calls `AudioSystem.resume()` does not throw (AudioContext mock active)

## Related Decisions
- ADR-0001: Vitest selected as Vite companion — `vite.config.js` shared
- ADR-0002: Test tree mirrors `src/` layer structure: `tests/unit/[layer]/[module].test.js`
- ADR-0003: `document.dispatchEvent` / `document.addEventListener` available in jsdom — event tests work without mocking
- ADR-0005: `localStorage` available in jsdom — Persistence tests work with `localStorage.clear()` in `beforeEach`
- ADR-0006: `requestAnimationFrame` mock enables deterministic RAE tests
- ADR-0007: Canvas mock enables SkinImageLoader placeholder tests
