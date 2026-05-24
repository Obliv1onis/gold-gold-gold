# The Vault — Master Architecture

## Document Status

- **Version**: 1.0
- **Last Updated**: 2026-05-21
- **Engine**: Web (HTML / CSS / JavaScript) — Browser is the platform layer
- **GDDs Covered**: All 17 (14 MVP + 3 Vertical Slice)
- **ADRs Referenced**: ADR-0001 (web stack and module system), ADR-0002 (module file structure), ADR-0003 (DOM event architecture), ADR-0004 (audio implementation)
- **Technical Director Sign-Off**: 2026-05-21 — APPROVED WITH CONDITIONS
- **Lead Programmer Feasibility**: Skipped — Lean mode

---

## Engine Knowledge Gap Summary

**Platform**: Browser (HTML / CSS / JavaScript)
**LLM Knowledge Coverage**: All core browser APIs below are well within LLM training data. No post-cutoff risk for stable Web APIs.

### MEDIUM Risk Domains

| Domain | Risk | Reason | Mitigated By |
|--------|------|--------|--------------|
| Module system / bundler | MEDIUM | ES module native vs. bundler (Vite/Rollup) changes import path conventions, tree-shaking, and test runner setup | ADR-001 must decide before any module is written |
| External Price API + CORS | MEDIUM | CORS strategy (proxy / no-CORS / serverless) is open; wrong choice blocks the Price API Layer entirely | ADR-008 must decide before Sprint 1; Price API Layer GDD logs as OQ-1/OQ-2 |

### LOW Risk Domains (stable Web APIs, all within training data)

| Domain | APIs Used | Risk |
|--------|-----------|------|
| Audio synthesis | Web Audio API: AudioContext, OscillatorNode, GainNode | LOW |
| Animation loop | requestAnimationFrame | LOW |
| DOM events | CustomEvent, dispatchEvent, addEventListener | LOW |
| CSS animation | transform: translateX(), CSS transitions | LOW |
| Local storage | localStorage.getItem/setItem/removeItem | LOW |
| Image loading | HTMLImageElement, onload/onerror, Canvas 2D for placeholders | LOW |
| Fetch | fetch(), Promise.allSettled() | LOW |

### Note on CLAUDE.md Engine Placeholder

`CLAUDE.md` currently lists Godot 4.6 as the engine. This is a stale placeholder — the project is a web app. The `docs/engine-reference/godot/` directory should be quarantined (carry-over advisory from gate-check 2026-05-21). No Godot APIs are used anywhere in the GDDs.

---

## System Layer Map

```
┌─────────────────────────────────────────────────────────────────┐
│  PRESENTATION LAYER                                             │
│  HUD/App Shell (#11) · Reel UI (#12) · Reveal UI (#13)         │
│  Inventory UI (#14) · Case Browser UI (#15)                     │
│  Market Browser UI (#17)                                        │
│  DOM rendering, user interaction, CSS animation                 │
├─────────────────────────────────────────────────────────────────┤
│  FEATURE LAYER                                                  │
│  Case Opening Orchestrator (#9) · Skin Image Loader (#10)       │
│  Price API Layer (#16) [⚠️ MEDIUM — CORS strategy TBD: ADR-008] │
│  Cross-system coordination, async browser capabilities          │
├─────────────────────────────────────────────────────────────────┤
│  CORE LAYER                                                     │
│  Drop Rate Engine (#4) · Reel Animation Engine (#5)             │
│  Virtual Economy (#6) · Case Inventory (#7)                     │
│  Skin Inventory (#8)                                            │
│  Game rules and state; depends on Foundation only               │
├─────────────────────────────────────────────────────────────────┤
│  FOUNDATION LAYER                                               │
│  Case Data Store (#1) · Audio System (#2) · Persistence (#3)   │
│  Static data, browser API wrappers, zero upstream deps          │
├─────────────────────────────────────────────────────────────────┤
│  BROWSER PLATFORM LAYER                                         │
│  Web Audio API · localStorage · requestAnimationFrame           │
│  DOM CustomEvents · Fetch API · Canvas 2D · CSS transforms      │
└─────────────────────────────────────────────────────────────────┘
```

### Layer Assignment Table

| # | System | Layer | Owns | Key Dep(s) |
|---|--------|-------|------|-----------|
| 1 | Case Data Store | Foundation | All case/item static data | — |
| 2 | Audio System | Foundation | Web Audio API lifecycle + synthesis | — |
| 3 | Persistence | Foundation | localStorage read/write wrapper | — |
| 4 | Drop Rate Engine | Core | Roll logic, rarity selection | CDS |
| 5 | Reel Animation Engine | Core | RAF loop, easing, strip indexing | — |
| 6 | Virtual Economy | Core | Balance float, spend/earn/reset | Persistence |
| 7 | Case Inventory | Core | Owned case counts | Persistence, CDS |
| 8 | Skin Inventory | Core | Owned skin instances | Persistence |
| 9 | Case Opening Orchestrator | Feature | Step chain: check→roll→spend→animate→reveal | DRE, RAE, VE, CI, SI, Audio |
| 10 | Skin Image Loader | Feature | HTMLImageElement cache, Canvas placeholder | CDS |
| 16 | Price API Layer | Feature | Price cache, background fetch, fallback | CDS, Persistence [⚠️ MEDIUM: CORS] |
| 11 | HUD / App Shell | Presentation | App layout, Open/Reset button state | VE, CI, SI, Orchestrator, Audio |
| 12 | Reel UI | Presentation | .reel-strip DOM, CSS translateX render | SkinImageLoader |
| 13 | Reveal UI | Presentation | Overlay, Sell button | SI, VE |
| 14 | Inventory UI | Presentation | Skin grid, inline sell confirm | SI, VE |
| 15 | Case Browser UI | Presentation | Case list modal, buy flow | CI, CDS, VE |
| 17 | Market Browser UI | Presentation | Skin buy modal, price display | SI, CDS, VE, PriceAPI |

### Placement Rationale (non-obvious)

- **Audio System → Foundation**: Wraps Web Audio API with no game-state dependencies. Every layer calls it upward; it calls nothing.
- **Price API Layer → Feature** (not Presentation): Manages an async cache, fires events, and wraps an external API — infrastructure, not UI. Presentation consumes its output.
- **Skin Image Loader → Feature** (not Presentation): Maintains a shared image cache across two Presentation modules (Reel UI, Inventory UI). Cross-presentation ownership belongs at Feature.
- **Reel Animation Engine → Core** (not Feature): Stateless mathematical engine (RAF loop + easing). The Orchestrator at Feature layer wires its callbacks; RAE itself has no cross-system dependencies.

---

## Module Ownership

### Foundation Layer

| Module | Owns | Exposes | Consumes | Browser APIs |
|--------|------|---------|----------|-------------|
| **Case Data Store** | All static case + item data (hardcoded JSON or data file) | `getCase(id)`, `getCaseList()`, `getItems(caseId, rarity)`, `getAllItems(caseId)`, `getAllSkins()`, `getItem(itemId)` | — | None |
| **Audio System** | AudioContext lifecycle; OscillatorNode/GainNode synthesis | `resume()`, `playTick(pitch)`, `playReveal()`, `playUI(type)`, `playAmbient()`, `stopAmbient()`, `setVolume(v)` | — | Web Audio API: AudioContext, OscillatorNode, GainNode |
| **Persistence** | All localStorage reads/writes; `vault_` key namespace | `save(key, value)`, `load(key, default)`, `delete(key)`, `clearAll()`, `isAvailable()` | — | localStorage |

### Core Layer

| Module | Owns | Exposes | Consumes | Browser APIs |
|--------|------|---------|----------|-------------|
| **Drop Rate Engine** | Two-phase roll algorithm; injectable RNG | `roll(caseId, rng?)`: `ItemEntry` | CDS: `getItems()`, `getAllItems()` | None (pure JS) |
| **Reel Animation Engine** | RAF loop; ease-out-quint; strip indexing; tick pitch mapping | `spin(caseId, selectedItem, viewportWidth, callbacks)` | CDS: `getAllItems(caseId)` (builds strip) | requestAnimationFrame |
| **Virtual Economy** | `balance` float; atomic spend/earn/reset; `balance-changed` event | `getBalance()`, `canAfford(n)`, `spend(n)`, `earn(n)`, `reset()` | Persistence: load/save `balance` | `document.dispatchEvent` |
| **Case Inventory** | Per-case count map; `case-inventory-changed` event | `hasCase(id)`, `getCaseCount(id)`, `buyCase(id, price, qty?)`, `removeCase(id)`, `clearInventory()` | Persistence: load/save `case_inventory`; VE: `spend()` | `document.dispatchEvent` |
| **Skin Inventory** | Skin instance array (with instanceId); `skin-inventory-changed` event | `addItem(entry)`, `sellItem(instanceId, grossPrice)`, `getInventory()`, `clearInventory()` | Persistence: load/save `skin_inventory`; VE: `earn(net_proceeds)` | `document.dispatchEvent` |

### Feature Layer

| Module | Owns | Exposes | Consumes | Browser APIs |
|--------|------|---------|----------|-------------|
| **Case Opening Orchestrator** | `isAnimating` flag; full open step-chain | `open(caseId, casePrice, callbacks)` where `callbacks = {onReveal, onBlocked, onReady}` | DRE: `roll()`; VE: `canAfford()`, `spend()`; CI: `hasCase()`, `removeCase()`; SI: `addItem()`; RAE: `spin()`; Audio: `playTick()`, `playReveal()` | setTimeout (CHORD_DECAY_MS = 800ms) |
| **Skin Image Loader** | `Map<URL, HTMLImageElement>` cache; Canvas placeholder generation | `preloadCase(caseId)`: `Promise<void>`, `getImage(url)`: `HTMLImageElement` | CDS: `getAllItems()` for URL list | Promise.allSettled(), HTMLImageElement, Canvas 2D API |
| **Price API Layer** [⚠️ MEDIUM: CORS] | Memory price cache; localStorage stale cache; in-flight dedup map | `getPrice(itemId)`: `PriceResult` (never throws); fires `price-updated` on `window` | CDS: `getItem(itemId)` (fallback); Persistence: stale price cache | Fetch API, `window.dispatchEvent` |

### Presentation Layer

| Module | Owns | Exposes | Consumes | Browser APIs |
|--------|------|---------|----------|-------------|
| **HUD / App Shell** | App layout DOM; Open/Reset button state machine | `onReveal(entry)`, `onBlocked(reason)`, `onReady()` callbacks passed to Orchestrator | VE: `getBalance()`, listens `balance-changed`; CI: `hasCase()`, listens `case-inventory-changed`; SI: listens `skin-inventory-changed`; Audio: `resume()` on first click | DOM, addEventListener |
| **Reel UI** | `.reel-viewport > .reel-strip > .reel-card×60` DOM; CSS translateX state | `render(offset, strip)` (onFrame callback), `viewportWidth` (read), fires `reel-ready` | SkinImageLoader: `preloadCase()`, `getImage()` | DOM manipulation, CSS transforms, offsetWidth, CustomEvent |
| **Reveal UI** | Overlay DOM; show/hide state | `show(entry)` | SI: `sellItem()`; VE: `getBalance()` (post-sell display) | DOM |
| **Inventory UI** | Skin grid DOM; dirty-flag when hidden | — (reactive; no callers) | SI: `getInventory()`, listens `skin-inventory-changed`; VE: `getBalance()` (portfolio display) | DOM, addEventListener |
| **Case Browser UI** | Full-screen modal DOM; case list display | — (reactive; opened by HUD) | CDS: `getCaseList()`; CI: `buyCase()`; VE: `getBalance()`, listens `balance-changed` | DOM, addEventListener |
| **Market Browser UI** | Full-screen modal DOM; skin grid + filter/sort | — (reactive; opened by HUD) | CDS: `getAllSkins()`; SI: `addItem()` (via confirm flow); VE: `spend()`, `getBalance()`, listens `balance-changed`; PriceAPI: `getPrice()`, listens `price-updated` | DOM, addEventListener |

### Dependency Diagram

```
                    BROWSER PLATFORM
                         ↑
       ┌─────────────────┼─────────────────┐
   CDS(1)            Audio(2)         Persist(3)
       ↑                ↑                  ↑
  ┌────┼────┐      ┌────┴────┐     ┌───────┼───────┐
DRE(4) RAE(5)    Orchestr(9) VE(6) CaseInv(7) SkinInv(8)
  ↑     ↑              ↑
  └─────┘        ┌─────┼──────────┐
             ImgLoad(10) PriceAPI(16) [⚠️ MEDIUM]
                  ↑          ↑
       ┌──────────┴──┐   ┌───┘
    ReelUI(12)  MktBrsr(17)
                         ↑
      HUD(11) ← RevealUI(13) ← InvUI(14) ← CaseBrsr(15)
```

> Note: HUD/App Shell (#11) orchestrates the Presentation layer — it listens to all three DOM events and coordinates which panel is visible. Arrows above show data/call dependencies, not visual containment.

---

## Data Flow

### DF-1: Case Open Chain (click → reel → reveal → inventory)

```
Player clicks Open button
│
└─▶ HUD/App Shell
    ├── isAnimating? → NO
    ├── hasCase(caseId)? → YES (CI)
    ├── canAfford(casePrice + KEY_COST)? → YES (VE)
    └── Orchestrator.open(caseId, casePrice, {onReveal, onBlocked, onReady})
        │
        ├─[1] DRE.roll(caseId)        → ItemEntry (sync)
        ├─[2] VE.spend(total)         → balance updated, balance-changed fired
        ├─[3] CI.removeCase(caseId)   → count decremented, case-inventory-changed fired
        ├─[4] isAnimating = true
        ├─[5] RAE.spin(caseId, item, viewportWidth, {
        │         onFrame: (offset, strip) → ReelUI.render(offset, strip)  [CSS translateX]
        │         onTick:  (pitch)         → Audio.playTick(pitch)
        │         onComplete:             → Audio.playReveal()
        │                                    SI.addItem(item)
        │                                    callbacks.onReveal(item)  → RevealUI.show(item)
        │                                    setTimeout(800ms) →
        │                                      isAnimating = false
        │                                      callbacks.onReady()
        │     })
        │
        └─ [roll-before-spend invariant]: If roll() throws RollError (invalid caseId),
           Orchestrator calls onBlocked("data error") and returns — spend() is never called.
```

**Producer → Consumer data:**

| Producer | Consumer | Data | Transport |
|----------|----------|------|-----------|
| DRE | Orchestrator | `ItemEntry` | Sync return value |
| RAE | ReelUI | `(offset: number, strip: ItemEntry[])` | Sync callback per RAF frame (~60fps) |
| RAE | Audio | `pitch: number` | Sync callback per tick |
| Orchestrator | SI | `ItemEntry` | Sync direct call on complete |
| Orchestrator | HUD (→ RevealUI) | `ItemEntry` | onReveal() callback |

---

### DF-2: DOM Event Bus (reactive UI updates)

```
document events (Core → Presentation):
  balance-changed          fired by: VE.spend(), VE.earn(), VE.reset()
    listeners: HUD (balance display), CaseBrowserUI (affordability tint)

  case-inventory-changed   fired by: CI.buyCase(), CI.removeCase(), CI.clearInventory()
    listeners: HUD (Open button enable/disable)

  skin-inventory-changed   fired by: SI.addItem(), SI.sellItem(), SI.clearInventory()
    listeners: InventoryUI (re-render grid), HUD (Reset button state)

window events (Feature → Presentation):
  price-updated            fired by: PriceAPI background fetch completion
    listeners: MarketBrowserUI (refresh displayed prices)
```

> ⚠️ **W-5 Advisory**: `price-updated` fires on `window`; the three Core events fire on `document`. ADR-003 should standardize to one event target. No functional difference in a single-page app, but inconsistency creates maintenance risk.

**Communication type**: All synchronous (browser CustomEvent dispatch is synchronous). No async gaps in the event bus.

---

### DF-3: Persistence Save/Load Path

```
Initialization (page load):
  VE.init()  →  Persistence.load("balance", 2000.00)      → balance float
  CI.init()  →  Persistence.load("case_inventory", {})    → {[caseId]: count} map
  SI.init()  →  Persistence.load("skin_inventory", [])    → SkinEntry[] array

On mutation (atomic — check + mutate + persist + event in single sync call):
  VE.spend(n)  →  balance -= n  →  Persistence.save("balance", balance)    →  dispatch balance-changed
  CI.buyCase() →  count++       →  Persistence.save("case_inventory", map)  →  dispatch case-inventory-changed
  SI.addItem() →  push entry    →  Persistence.save("skin_inventory", arr)  →  dispatch skin-inventory-changed

localStorage keys:
  vault_balance         → number (float, 2dp)
  vault_case_inventory  → JSON object {[caseId]: count}
  vault_skin_inventory  → JSON array of SkinEntry
  vault_price_[itemId]  → {price, timestamp} (Price API stale cache)

Graceful degradation:
  If Persistence.isAvailable() === false → modules operate in-memory only.
  No errors thrown; state survives the session but does not persist across reloads.
```

---

### DF-4: Initialization Order

```
Phase 1 — Browser APIs (implicit):
  AudioContext created lazily on first user gesture (browser autoplay policy)

Phase 2 — Foundation (no deps; can run in parallel):
  CaseDataStore.init()   → validates data, builds internal lookup maps
  Persistence.init()     → calls isAvailable(), sets degraded flag if absent

Phase 3 — Core (depends on Foundation; all can run in parallel within phase):
  VirtualEconomy.init()  → loads balance from Persistence
  CaseInventory.init()   → loads case_inventory from Persistence
  SkinInventory.init()   → loads skin_inventory from Persistence
  DropRateEngine         → stateless, no init required
  ReelAnimationEngine    → stateless, no init required

Phase 4 — Feature (depends on Core + Foundation):
  SkinImageLoader        → no init; cache populates lazily via preloadCase()
  PriceAPILayer          → loads stale price cache from Persistence

Phase 5 — Presentation (depends on all layers above):
  HUD/AppShell.init()    → reads initial VE/CI/SI state, attaches event listeners
  ReelUI.init()          → builds 60-card DOM skeleton, reads viewportWidth
  InventoryUI.init()     → reads SI.getInventory(), renders initial grid
  CaseBrowserUI          → lazy — DOM built on first open()
  MarketBrowserUI        → lazy — DOM built on first open()
  RevealUI               → lazy — overlay hidden until show() called

Critical ordering constraints:
  Core MUST init before Presentation (Presentation reads initial state on init).
  AudioContext MUST NOT be created before a user gesture (browser autoplay policy).
  Price API Layer MUST init after Persistence (loads stale cache on startup).
```

---

## API Boundaries

### Foundation Layer

```js
// ── Case Data Store ───────────────────────────────────────────────────
// Invariants:
//   - All methods return synchronously (data is in-memory after init)
//   - getItems/getAllItems: returned arrays are read-only copies
//   - getItem: returns null if itemId not found across any case

CaseDataStore.getCase(caseId: string): CaseEntry | null
CaseDataStore.getCaseList(): CaseEntry[]
CaseDataStore.getItems(caseId: string, rarity: string): ItemEntry[]
CaseDataStore.getAllItems(caseId: string): ItemEntry[]
CaseDataStore.getAllSkins(): ItemEntry[]
CaseDataStore.getItem(itemId: string): ItemEntry | null

// CaseEntry: { case_id, name, image_url, market_price }
// ItemEntry: { item_id, name, rarity, image_url, market_price }

// ── Audio System ──────────────────────────────────────────────────────
// Invariants:
//   - All play* methods are no-ops if AudioContext is Suspended (safe to call before resume())
//   - resume() must be called from a user-gesture handler
//   - playTick/playReveal/playUI: fire-and-forget (return void, not Promise)

AudioSystem.resume(): Promise<void>
AudioSystem.playTick(pitch: number): void     // pitch: 220–880 Hz
AudioSystem.playReveal(): void                // 3-oscillator chord, 800ms decay
AudioSystem.playUI(type: 'click' | 'hover'): void
AudioSystem.playAmbient(): void
AudioSystem.stopAmbient(): void
AudioSystem.setVolume(v: number): void        // v: 0.0–1.0

// ── Persistence ───────────────────────────────────────────────────────
// Invariants:
//   - Keys are namespaced vault_[key] internally; callers pass bare keys
//   - load() ALWAYS returns a value (defaultValue if key absent or parse fails)
//   - isAvailable() returns false if localStorage is blocked; never throws

Persistence.save(key: string, value: any): void
Persistence.load(key: string, defaultValue: any): any
Persistence.delete(key: string): void
Persistence.clearAll(): void                  // removes all vault_* keys only
Persistence.isAvailable(): boolean
```

### Core Layer

```js
// ── Drop Rate Engine ──────────────────────────────────────────────────
// Invariants:
//   - roll() is stateless and synchronous
//   - Throws RollError if caseId not found (caller must guard before spend)
//   - rng defaults to Math.random; override for deterministic tests

DropRateEngine.roll(caseId: string, rng?: () => number): ItemEntry
// Throws: RollError (extends Error) if caseId invalid

// ── Reel Animation Engine ─────────────────────────────────────────────
// Invariants:
//   - spin() starts a RAF loop; returns void immediately
//   - onFrame called ~60fps; onTick on velocity events; onComplete called once
//   - Only one spin active at a time (caller guards via isAnimating)
//   - SPIN_DURATION_MS = 7800; CARD_WIDTH = 250; selected item at strip index 55

ReelAnimationEngine.spin(
  caseId: string,
  selectedItem: ItemEntry,
  viewportWidth: number,
  callbacks: {
    onFrame(offset: number, strip: ItemEntry[]): void,
    onTick(pitch: number): void,
    onComplete(): void
  }
): void

// ── Virtual Economy ───────────────────────────────────────────────────
// Invariants:
//   - balance is always ≥ BALANCE_FLOOR (0)
//   - balance rounded to 2dp after every mutation
//   - spend() throws InsufficientFundsError if amount > balance
//   - All mutations atomic: mutate + persist + dispatch in same sync call
//   - Fires CustomEvent('balance-changed', {detail: {balance}}) on document

VirtualEconomy.getBalance(): number
VirtualEconomy.canAfford(amount: number): boolean
VirtualEconomy.spend(amount: number): void    // Throws: InsufficientFundsError
VirtualEconomy.earn(amount: number): void
VirtualEconomy.reset(): void                  // → STARTING_BALANCE = $2000.00
// Constants: STARTING_BALANCE = 2000.00, KEY_COST_USD = 2.49, BALANCE_FLOOR = 0

// ── Case Inventory ────────────────────────────────────────────────────
// Invariants:
//   - buyCase(caseId, unitPrice, qty=1): calls VE.spend(unitPrice × qty) internally
//   - All mutations atomic: mutate + persist + dispatch
//   - Fires CustomEvent('case-inventory-changed') on document

CaseInventory.hasCase(caseId: string): boolean
CaseInventory.getCaseCount(caseId: string): number
CaseInventory.buyCase(caseId: string, unitPrice: number, quantity?: number): boolean
CaseInventory.removeCase(caseId: string): void
CaseInventory.clearInventory(): void

// ── Skin Inventory ────────────────────────────────────────────────────
// Invariants:
//   - sellItem() computes net_proceeds = round(grossPrice × 0.85) internally
//   - Callers pass gross market_price; SELL_FEE_RATE applied inside, never by callers
//   - All mutations atomic: mutate + persist + dispatch
//   - Fires CustomEvent('skin-inventory-changed') on document

SkinInventory.addItem(entry: ItemEntry): SkinEntry   // returns entry with instanceId
SkinInventory.sellItem(instanceId: string, grossPrice: number): void
SkinInventory.getInventory(): SkinEntry[]
SkinInventory.clearInventory(): void
// SkinEntry: { instanceId: string (UUID), item: ItemEntry, acquiredAt: timestamp }
// SELL_FEE_RATE = 0.15 — applied inside sellItem(), never by callers
```

### Feature Layer

```js
// ── Case Opening Orchestrator ─────────────────────────────────────────
// Invariants:
//   - open() is a no-op if isAnimating === true
//   - roll() called BEFORE spend() — RollError aborts chain without deducting balance
//   - onBlocked: isAnimating | !hasCase | !canAfford | RollError
//   - onReveal called with won ItemEntry after animation completes
//   - onReady called CHORD_DECAY_MS (800ms) after onReveal

Orchestrator.open(
  caseId: string,
  casePrice: number,
  callbacks: {
    onReveal(entry: ItemEntry): void,
    onBlocked(reason: string): void,
    onReady(): void
  }
): void
Orchestrator.isAnimating: boolean  // read-only

// ── Skin Image Loader ─────────────────────────────────────────────────
// Invariants:
//   - getImage() is always synchronous and NEVER returns null
//   - If URL is null or load failed: returns Canvas-generated rarity-color placeholder (250×250)
//   - preloadCase() uses Promise.allSettled() — never rejects
//   - Module-level singleton (shared cache across ReelUI and InventoryUI)

SkinImageLoader.preloadCase(caseId: string): Promise<void>
SkinImageLoader.getImage(url: string | null, rarity?: string): HTMLImageElement

// ── Price API Layer ───────────────────────────────────────────────────
// Invariants:
//   - getPrice() NEVER throws (returns fallback PriceResult on all error paths)
//   - Cache order: memory → localStorage stale → background fetch → CDS fallback
//   - In-flight deduplication: concurrent getPrice(id) calls share one fetch
//   - Fires CustomEvent('price-updated', {detail: {itemId, price}}) on window
// ⚠️ MEDIUM RISK: CORS strategy for external price fetch unresolved — ADR-008 required

PriceAPILayer.getPrice(itemId: string): PriceResult
// PriceResult: { price: number, source: 'live' | 'stale' | 'fallback', timestamp: number }
```

### Presentation Layer

```js
// ── HUD / App Shell ───────────────────────────────────────────────────
// Invariants:
//   - Open button: enabled only when !isAnimating AND hasCase(active) AND canAfford(total)
//   - Reset button: visible only when balance === 0 AND getInventory().length === 0
//   - AudioSystem.resume() called on the FIRST user click
//   - Listens to: balance-changed, case-inventory-changed, skin-inventory-changed

HUD.init(): void

// ── Reel UI ───────────────────────────────────────────────────────────
// Invariants:
//   - render() uses CSS transform: translateX() — no DOM reflow per frame
//   - Card DOM rebuilt only on first render() of each new spin
//   - viewportWidth reads .reel-viewport.offsetWidth; fallback 800 if 0
//   - Fires CustomEvent('reel-ready') on document after preloadCase() resolves

ReelUI.render(offset: number, strip: ItemEntry[]): void  // onFrame callback
ReelUI.viewportWidth: number  // read-only

// ── Reveal UI ─────────────────────────────────────────────────────────
// Invariants:
//   - show() called by HUD on onReveal callback
//   - Sell calls SkinInventory.sellItem(entry.instanceId, entry.item.market_price)
//   - Displayed net proceeds = market_price × 0.85 (mirrors sellItem() formula)

RevealUI.show(entry: ItemEntry): void

// ── Inventory UI, Case Browser UI, Market Browser UI ──────────────────
// Invariants:
//   - All reactive: re-render triggered by DOM events, not direct calls
//   - InventoryUI: dirty-flag when panel not visible; re-renders on next show
//   - CaseBrowserUI / MarketBrowserUI: DOM built lazily on first open
//   - MarketBrowserUI: re-prices cards on price-updated event

// No public callable API beyond open()/close() controlled by HUD.
```

---

## ADR Audit

### Status

**Existing ADRs: Zero.** `docs/architecture/` contains only `tr-registry.yaml`.
All 62 Technical Requirements are uncovered — the Required ADRs section lists
the 9 decisions that must be made before implementation begins.

### ADR Quality Check

| ADR | Engine Compat | GDD Linkage | Conflicts | Valid |
|-----|--------------|-------------|-----------|-------|
| *None exist* | — | — | — | — |

### Traceability Coverage (representative sample — all 62 are gaps)

| Req ID | Requirement | ADR Coverage | Status |
|--------|-------------|--------------|--------|
| TR-case-data-store-001 | Static case+item data store | — | ❌ GAP |
| TR-audio-001 | Web Audio API synthesis (no audio files) | — | ❌ GAP |
| TR-audio-002 | AudioContext lazy init on user gesture | — | ❌ GAP |
| TR-persistence-001 | localStorage wrapper, vault_ prefix | — | ❌ GAP |
| TR-persistence-002 | Graceful degradation if storage unavailable | — | ❌ GAP |
| TR-drop-rate-001 | Two-phase weighted roll algorithm | — | ❌ GAP |
| TR-drop-rate-002 | Injectable RNG for test determinism | — | ❌ GAP |
| TR-reel-animation-001 | RAF loop + ease-out-quint easing | — | ❌ GAP |
| TR-reel-animation-002 | CSS translateX (no DOM reflow) | — | ❌ GAP |
| TR-virtual-economy-001 | Atomic spend/earn/reset with persistence | — | ❌ GAP |
| TR-orchestrator-001 | roll-before-spend ordering invariant | — | ❌ GAP |
| TR-skin-image-001 | Canvas placeholder for null/failed URLs | — | ❌ GAP |
| TR-price-api-002 | CORS strategy for external price fetch | — | ❌ GAP ⚠️ MEDIUM |
| *[49 more TRs — all uncovered]* | — | — | ❌ GAP |

**Coverage: 0 / 62 requirements have ADR coverage.**

---

## Required ADRs

### Must Have Before Any Module Is Written (Foundation + cross-cutting)

**1. `/architecture-decision "Web stack and module system"` → ADR-001**
Decides: ES modules native vs. Vite/Rollup bundler, import path conventions, whether
to use a `package.json` build step or a pure `<script type="module">` approach.
⚠️ MEDIUM RISK — affects every module's file structure and test runner compatibility.
Covers: module-loading pattern for all 17 modules.

**2. `/architecture-decision "Module file structure and naming conventions"` → ADR-002**
Decides: one file per module vs. directory modules, export pattern (default vs. named),
`src/` subdirectory layout (e.g. `src/foundation/`, `src/core/`, etc.).
Covers: implementation shape for all layers.

**3. `/architecture-decision "DOM event architecture"` → ADR-003**
Decides: standardize event target (`document` vs. `window`), custom event naming
convention, whether to introduce a thin EventBus abstraction.
Resolves W-5 advisory (`price-updated` fires on `window`; Core events fire on `document`).
Covers: TR-virtual-economy-002 (balance-changed), TR-case-inventory events,
TR-skin-inventory events, TR-price-api-001 (price-updated).

**4. `/architecture-decision "Audio implementation — Web Audio API vs library"` → ADR-004**
Decides: raw Web Audio API (as GDDs specify) vs. Howler.js wrapper.
GDDs specify raw synthesis; this ADR locks the approach or overrides with a library.
Covers: TR-audio-001, TR-audio-002.

**5. `/architecture-decision "Persistence strategy — localStorage wrapper"` → ADR-005**
Decides: wrapper shape, key schema, degraded-mode behavior, whether to add
IndexedDB as a future-proof path for larger inventories.
Covers: TR-persistence-001, TR-persistence-002.

### Must Have Before the Relevant System Is Built

**6. `/architecture-decision "Animation loop and reel-to-UI data transport"` → ADR-006**
Decides: RAF loop ownership (RAE owns vs. ReelUI owns), callback vs. EventEmitter
for onFrame/onTick/onComplete, whether transport is synchronous callback or queued.
Covers: TR-reel-animation-001, TR-reel-animation-002, TR-reel-ui-001.

**7. `/architecture-decision "Skin image loading and placeholder strategy"` → ADR-007**
Decides: module-level singleton vs. class instance, Canvas placeholder spec
(250×250, rarity hex colors), cache eviction policy.
Covers: TR-skin-image-001, TR-skin-image-002.

**8. `/architecture-decision "Price API and CORS solution"` → ADR-008** ⚠️ MEDIUM
Decides: which external price API to use, CORS approach (proxy server / serverless
function / no-CORS / backend-for-frontend), fallback chain behavior, cache TTL.
Must be resolved before Sprint 1 (gate-check advisory).
Covers: TR-price-api-001, TR-price-api-002.

### Can Defer to Pre-Production Gate

**9. `/architecture-decision "Test framework and CI setup"` → ADR-009**
Decides: Jest vs. Vitest vs. vanilla Node test runner, how to test DOM-dependent
modules (jsdom / happy-dom), CI trigger configuration.
Covers: test-coverage requirements for all Logic-type stories.

---

## Architecture Principles

**Principle 1 — Synchronous Spine, Async Edges**
All state mutations (spend, earn, roll, addItem, removeCase) are synchronous and
atomic: check + mutate + persist + dispatch in a single call. Async work (image
preloading, price fetches, AudioContext resume) is isolated at the edges — Feature
and Foundation layers — and never interrupts the mutation path. This prevents
partial-state bugs and makes the core loop trivially testable.

**Principle 2 — One Owner, One Source of Truth**
Each piece of game state has exactly one owning module. Balance lives only in
VirtualEconomy. Skin instances live only in SkinInventory. No two modules cache the
same mutable state. Presentation reads state once on init and stays current via DOM
events — it never holds its own copy of game data.

**Principle 3 — Sound Is First Class**
Audio cues are wired at the Feature layer (Orchestrator), not bolted onto Presentation.
The tick pitch formula, chord timing, and AudioContext lifecycle are architecture-level
concerns (ADR-004). A UI module that bypasses AudioSystem to play sounds directly
violates this principle.

---

## Open Questions

| ID | Summary | Priority | Resolution Path |
|----|---------|----------|-----------------|
| QQ-01 | Module system / bundler choice | High | ADR-001 — must resolve before first file is written |
| QQ-02 | CORS strategy for Price API external fetch | High | ADR-008 — must resolve before Sprint 1 |
| QQ-03 | Event target standardization (document vs. window) | Medium | ADR-003 |
| QQ-04 | Audio library choice (raw Web Audio API vs. Howler.js) | Medium | ADR-004 |
| QQ-05 | Canvas placeholder rarity hex values (6 CS2 rarities) | Medium | Day-1 art bible task (gate-check carry-over) |
| QQ-06 | Player fantasy framing — "grow bankroll" vs. "ride the variance" (D-1) | Low | CD framing pass before Vertical Slice player-facing copy |
