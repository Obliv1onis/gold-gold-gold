# ADR-0002: Module File Structure and Naming Conventions

## Status
Proposed

## Date
2026-05-21

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Browser (HTML / CSS / JavaScript) |
| **Domain** | Core / Web Platform |
| **Knowledge Risk** | LOW — file system conventions are not engine-API-dependent |
| **References Consulted** | ADR-0001 (Vite module system), docs/architecture/architecture.md (5-layer map) |
| **Post-Cutoff APIs Used** | None |
| **Verification Required** | Confirm Vite resolves cross-layer relative imports (e.g. `src/feature/` importing from `../core/`) without path alias config |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-0001 — Vite + ES modules must be Accepted first |
| **Enables** | All implementation work — every programmer writing a new module follows this spec |
| **Blocks** | All 17 source modules — cannot write the first line of any module until file location and export shape are settled |
| **Ordering Note** | Should be Accepted alongside ADR-0001 before the first sprint begins. |

## Context

### Problem Statement
ADR-0001 established Vite and ES modules. The next decision is where files live and how they export their API. With 17 modules across 4 source layers, an uncoordinated start will produce a mix of flat and nested structures, mixed export styles, and inconsistent naming — all of which require costly refactoring once stories are underway.

### Constraints
- GDDs consistently use `ModuleName.method()` notation (e.g. `VirtualEconomy.spend()`, `CaseDataStore.getCase()`) — the export shape must preserve this calling convention so stories and implementations match
- Test files live in `tests/unit/` and `tests/integration/` per the coding standards — source structure should mirror the test tree
- Vite resolves imports by relative path from the importing file — no alias config is required for `../core/`, `../foundation/` etc.

### Requirements
- Must be immediately obvious which layer a file belongs to from its path
- Must allow enforcement of the layer dependency rule by inspection of import paths
- File names must match GDD slugs exactly — no translation step, no guessing
- Export shape must match the `ModuleName.method()` calling convention in all 17 GDDs

## Decision

**Layer-based subdirectories + kebab-case filenames + named module-object exports.**

### Directory Layout

```
src/
  main.js                          ← entry point; imports and wires all layers
  foundation/
    case-data-store.js
    audio-system.js
    persistence.js
  core/
    drop-rate-engine.js
    reel-animation-engine.js
    virtual-economy.js
    case-inventory.js
    skin-inventory.js
  feature/
    case-opening-orchestrator.js
    skin-image-loader.js
    price-api-layer.js
  presentation/
    hud-app-shell.js
    reel-ui.js
    reveal-ui.js
    inventory-ui.js
    case-browser-ui.js
    market-browser-ui.js

tests/
  unit/
    foundation/
      case-data-store.test.js
      audio-system.test.js
      persistence.test.js
    core/
      drop-rate-engine.test.js
      reel-animation-engine.test.js
      virtual-economy.test.js
      case-inventory.test.js
      skin-inventory.test.js
    feature/
      case-opening-orchestrator.test.js
      skin-image-loader.test.js
      price-api-layer.test.js
  integration/
    case-open-chain.test.js
    economy-persistence.test.js
```

### File Naming

- **Source files**: `kebab-case.js` matching the GDD slug exactly
  - GDD `case-data-store.md` → `src/foundation/case-data-store.js`
  - GDD `drop-rate-engine.md` → `src/core/drop-rate-engine.js`
- **Test files**: `[module-slug].test.js` mirroring the source tree under `tests/`
- **Entry point**: `src/main.js` (not `index.js`)
- **No barrel `index.js` files** — explicit imports only; barrels mask exports and complicate tree-shaking

### Export Pattern

Each module exports a **single named PascalCase constant** (the module object) matching the GDD module name:

```js
// src/core/virtual-economy.js

const STARTING_BALANCE = 2000.00;
const KEY_COST_USD     = 2.49;
const BALANCE_FLOOR    = 0;

let _balance = STARTING_BALANCE;

export const VirtualEconomy = {
  getBalance()      { return _balance; },
  canAfford(amount) { return _balance >= amount; },
  spend(amount)     { /* atomic: check + mutate + persist + dispatch */ },
  earn(amount)      { /* atomic */ },
  reset()           { /* → STARTING_BALANCE */ }
};
```

**Consuming module:**
```js
// src/feature/case-opening-orchestrator.js
import { VirtualEconomy } from '../core/virtual-economy.js';
import { DropRateEngine }  from '../core/drop-rate-engine.js';
import { CaseInventory }   from '../core/case-inventory.js';
import { SkinInventory }   from '../core/skin-inventory.js';
```

### Layer Dependency Rule

Imports may only flow toward the Foundation layer — never upward:

```
presentation → feature      ✓
presentation → core         ✓
presentation → foundation   ✓
feature      → core         ✓
feature      → foundation   ✓
core         → foundation   ✓
foundation   → (nothing in src/)  ✓

presentation → presentation (cross-module)  ✗  FORBIDDEN
feature      → presentation                 ✗  FORBIDDEN
core         → feature                      ✗  FORBIDDEN
foundation   → core                         ✗  FORBIDDEN
```

Violations are detectable by inspection: if `src/core/` has an import starting with `../feature/` or `../presentation/`, the rule is broken.

### Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Source files | `kebab-case.js` | `case-data-store.js` |
| Test files | `kebab-case.test.js` | `drop-rate-engine.test.js` |
| Module export object | `PascalCase` | `VirtualEconomy`, `CaseDataStore` |
| Private module state | `_camelCase` (leading underscore) | `_balance`, `_cache` |
| Module-level constants | `SCREAMING_SNAKE_CASE` | `STARTING_BALANCE`, `SELL_FEE_RATE` |
| DOM event names | `kebab-case` | `balance-changed`, `price-updated` |
| localStorage keys | `vault_snake_case` | `vault_balance`, `vault_case_inventory` |

## Alternatives Considered

### Alternative A: Flat `src/` directory
- **Description**: All 17 modules at `src/[module-slug].js` with no subdirectories.
- **Pros**: Zero nesting overhead; trivial relative imports (`'./virtual-economy.js'`).
- **Cons**: 17+ files in one directory; layer violations become invisible; test mirroring becomes ambiguous.
- **Rejection Reason**: The layer boundary is a key architectural constraint. A flat structure removes the primary mechanism for detecting cross-layer import violations by inspection.

### Alternative B: Feature-based grouping
- **Description**: `src/case-opening/`, `src/economy/`, `src/inventory/`, `src/ui/` — grouped by user-facing feature.
- **Pros**: Familiar to React/component developers; co-locates related code.
- **Cons**: Infrastructure modules (Audio, Persistence, CDS) don't belong to a feature. VirtualEconomy is used by three different features — must pick one arbitrarily. Grouping becomes contentious as the codebase grows.
- **Rejection Reason**: The 5-layer architecture is the organizing principle of this codebase. Feature grouping would obscure it and create ambiguous module ownership.

### Alternative C: Individual named function exports
- **Description**: `export function getBalance() { ... }` instead of a module object.
- **Pros**: Maximum tree-shaking; most idiomatic for utility functions.
- **Cons**: Callers cannot use `VirtualEconomy.spend()` — the GDD calling convention is broken. Import lines become verbose: `import { getBalance, canAfford, spend, earn, reset } from './virtual-economy.js'`. The module namespace is lost at the call site.
- **Rejection Reason**: GDD calling convention is used throughout 17 design documents and will appear in stories. Preserving `ModuleName.method()` eliminates a permanent translation step for every developer reading a GDD alongside the code.

## Consequences

### Positive
- File path → layer is immediately readable (`src/core/` = Core layer)
- Layer violations are detectable without tooling by inspecting import paths
- `ModuleName.method()` calling convention matches all 17 GDDs exactly
- Test tree mirrors source tree — `tests/unit/core/virtual-economy.test.js` is always findable

### Negative
- Relative import paths within `src/` are slightly verbose: `'../core/virtual-economy.js'` from `src/feature/`
- Module-object export pattern is slightly less tree-shakeable than individual function exports (entire `VirtualEconomy` object is included if any method is used)

### Risks
- **Circular imports**: If a Core module accidentally imports from Feature, Vite will throw a circular dependency warning. Mitigation: layer rule documented here is enforced at code review; a Vitest test can assert no `../feature/` imports appear in `src/core/` files.
- **Private state mutation**: Module-level `let _balance` is mutable shared state. Tests must reset state between runs. Mitigation: each module exposes a `_reset()` test helper (not part of the public API) or Vitest `vi.mock()` is used to isolate state.

## GDD Requirements Addressed

| GDD System | Requirement | How This ADR Addresses It |
|------------|-------------|--------------------------|
| All 17 systems | GDDs use `ModuleName.method()` calling convention throughout rules, examples, and ACs | Named module-object export `export const ModuleName = { ... }` preserves this convention in source code |
| architecture.md | 5-layer system (Foundation/Core/Feature/Presentation) | `src/foundation/`, `src/core/`, `src/feature/`, `src/presentation/` directories enforce the map physically |
| coding-standards.md | File naming should follow consistent conventions | `kebab-case.js` matching GDD slug + `PascalCase` module object name |

## Performance Implications
- **CPU**: None — file structure has no runtime performance impact
- **Memory**: None
- **Load Time**: No barrel files → Vite's tree-shaking operates on explicit named imports → smaller production bundle
- **Network**: Marginal improvement from better tree-shaking

## Migration Plan
No existing source code — greenfield. This structure is established on the first day of implementation.

## Validation Criteria
- `src/` contains exactly the 4 subdirectories listed above
- All 17 module files exist at the paths specified in the directory layout
- `grep -r "from '.*presentation" src/core/` returns no matches (layer rule)
- `grep -r "from '.*feature" src/core/` returns no matches (layer rule)
- `grep -r "from '.*core" src/foundation/` returns no matches (layer rule)
- Every module file has exactly one `export const [PascalCase] = {` statement

## Related Decisions
- ADR-0001: Web stack and module system (this ADR depends on it)
- ADR-0003: DOM event architecture (event names use `kebab-case` per this ADR)
- ADR-0009: Test framework (test file naming and directory structure defined here)
