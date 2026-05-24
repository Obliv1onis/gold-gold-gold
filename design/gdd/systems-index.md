# Systems Index: The Vault — CS2 Case Opening Simulator

> **Status**: Draft
> **Created**: 2026-05-18
> **Last Updated**: 2026-05-21 (market-browser-ui added; all 3 VS GDDs complete)
> **Source Concept**: design/gdd/game-concept.md

---

## Overview

The Vault is a web application, not a traditional engine-based game. Its systems
map to JavaScript modules and UI components rather than game engine nodes. The core
loop — select case → spend key → reel spin → item reveal → inventory update — is
orchestrated by the Case Opening Orchestrator, which coordinates five dependent
systems. The architectural bottleneck is the Case Data Store: every other system
reads from it, so its accuracy (correct CS2 rarity tiers, correct drop weights,
correct item names) is the highest-risk single point of failure.

Design pillars that shape system scope:
- **Faithful Over Flashy** — systems must produce CS2-authentic output, not creative invention
- **Zero Friction** — no system may add steps to the open → reveal → close path
- **Every Case Counts** — the Case Data Store must eventually hold all CS2 cases
- **Sound Is Sacred** — the Audio System is not optional; timing precision is required

---

## Systems Enumeration

| # | System Name | Category | Priority | Status | Design Doc | Depends On |
|---|-------------|----------|----------|--------|------------|------------|
| 1 | Case Data Store | Economy | MVP | Designed | design/gdd/case-data-store.md | — |
| 2 | Audio System | Audio | MVP | Designed | design/gdd/audio-system.md | — |
| 3 | Persistence | Core | MVP | Designed | design/gdd/persistence.md | — |
| 4 | Drop Rate Engine | Gameplay | MVP | Designed | design/gdd/drop-rate-engine.md | Case Data Store |
| 5 | Reel Animation Engine | Gameplay | MVP | Designed | design/gdd/reel-animation-engine.md | Case Data Store |
| 6 | Virtual Economy | Economy | MVP | Designed | design/gdd/virtual-economy.md | Persistence |
| 7 | Case Inventory | Economy | MVP | Designed | design/gdd/case-inventory.md | Case Data Store, Persistence, Virtual Economy |
| 8 | Skin Inventory | Economy | MVP | Designed | design/gdd/skin-inventory.md | Case Data Store, Persistence |
| 9 | Case Opening Orchestrator | Gameplay | MVP | Designed | design/gdd/case-opening-orchestrator.md | Virtual Economy, Case Inventory, Skin Inventory, Drop Rate Engine, Reel Animation Engine, Audio System |
| 10 | Skin Image Loader | Core | MVP | Designed | design/gdd/skin-image-loader.md | Case Data Store |
| 11 | HUD / App Shell | UI | MVP | Designed | design/gdd/hud-app-shell.md | Virtual Economy |
| 12 | Reel UI | UI | MVP | Designed | design/gdd/reel-ui.md | Reel Animation Engine, Skin Image Loader |
| 13 | Reveal UI | UI | MVP | Designed | design/gdd/reveal-ui.md | Case Opening Orchestrator, Audio System |
| 14 | Inventory UI | UI | MVP | Designed | design/gdd/inventory-ui.md | Skin Inventory, Skin Image Loader |
| 15 | Case Browser UI | UI | Vertical Slice | Designed | design/gdd/case-browser-ui.md | Case Data Store, Virtual Economy, Case Inventory, HUD / App Shell |
| 16 | Price API Layer | Core | Vertical Slice | Designed | design/gdd/price-api-layer.md | Case Data Store |
| 17 | Market Browser UI | UI | Vertical Slice | Designed | design/gdd/market-browser-ui.md | Price API Layer, Skin Image Loader, Virtual Economy, Case Data Store, Skin Inventory |
| 18 | Wear / Float System (inferred) | Gameplay | Full Vision | Not Started | — | Drop Rate Engine, Skin Inventory |
| 19 | StatTrak Module (inferred) | Gameplay | Full Vision | Not Started | — | Drop Rate Engine, Skin Inventory |

---

## Categories

| Category | Description | Systems |
|----------|-------------|---------|
| **Core** | Infrastructure modules with no gameplay logic | Persistence, Skin Image Loader |
| **Gameplay** | The systems that make the simulator work | Drop Rate Engine, Reel Animation Engine, Case Opening Orchestrator, Wear/Float System, StatTrak Module |
| **Economy** | Item data, currency, collection | Case Data Store, Key Economy, Inventory |
| **UI** | Player-facing components | HUD/App Shell, Reel UI, Reveal UI, Inventory UI, Case Browser UI |
| **Audio** | Sound and music systems | Audio System |

---

## Priority Tiers

| Tier | Definition | Target Milestone |
|------|------------|------------------|
| **MVP** | Required for the core loop — 10 cases, reel, sounds, key economy, basic inventory | First playable build (2–3 weeks) |
| **Vertical Slice** | One complete polished experience — browsable case archive, full inventory UI | 4–5 weeks |
| **Full Vision** | CS2 authenticity complete — float values, StatTrak, mobile layout, all 100+ cases | 3+ months |

---

## Dependency Map

### Foundation Layer (no dependencies — design and build first)

1. **Case Data Store** — owns all case/item/odds truth; every other system reads from it
2. **Audio System** — wraps Web Audio API; no game logic dependencies
3. **Persistence** — wraps localStorage; no game logic dependencies

### Core Layer (depends on Foundation)

4. **Drop Rate Engine** — depends on: Case Data Store (item pools + rarity weights)
5. **Reel Animation Engine** — depends on: Case Data Store (items to populate the strip)
6. **Virtual Economy** — depends on: Persistence (save/load balance)
7. **Case Inventory** — depends on: Case Data Store + Persistence + Virtual Economy (buy cases, deduct balance)
8. **Skin Inventory** — depends on: Case Data Store (item schema) + Persistence (save/load items)

### Feature Layer (depends on Core)

9. **Case Opening Orchestrator** — depends on: Virtual Economy, Case Inventory, Skin Inventory, Drop Rate Engine, Reel Animation Engine, Audio System
10. **Skin Image Loader** — depends on: Case Data Store (item IDs → Steam CDN URLs)

### Presentation Layer (depends on Features)

11. **HUD / App Shell** — depends on: Virtual Economy
12. **Reel UI** — depends on: Reel Animation Engine, Skin Image Loader
13. **Reveal UI** — depends on: Case Opening Orchestrator, Audio System
14. **Inventory UI** — depends on: Skin Inventory, Skin Image Loader
15. **Case Browser UI** — depends on: Case Data Store, Virtual Economy

### Vertical Slice Layer

16. **Price API Layer** — no dependencies (wraps external price API)
17. **Market Browser UI** — depends on: Price API Layer, Skin Image Loader, Virtual Economy

### Polish Layer

18. **Wear / Float System** — depends on: Drop Rate Engine, Skin Inventory
19. **StatTrak Module** — depends on: Drop Rate Engine, Skin Inventory

---

## Circular Dependencies

None found. Data flows in one direction: Foundation → Core → Feature → Presentation → Polish.

---

## High-Risk Systems

| System | Risk Type | Risk Description | Mitigation |
|--------|-----------|-----------------|------------|
| **Case Data Store** | Scope + Data | 100+ cases × all items = significant data entry. Community odds are estimates, not official. Rarity tier rules differ between regular cases, souvenir packages, and capsules (prototype revealed this). | Source community JSON databases early; validate against a known case before building; treat souvenir packages as a separate schema |
| **Reel Animation Engine** | Technical | Getting the ease-out curve, stop positioning, and tick timing to match CS2's feel exactly. Prototype validated the general approach but exact easing is still empirical. | Prototype already confirmed approach; tune against video frame analysis of real CS2 reel |
| **Case Opening Orchestrator** | Integration | Coordinates 5 systems — timing chain (reel end → pause → reveal) is fragile if any system is async. | Design the timing contract explicitly in the GDD; use event-based coordination not callbacks |
| **Skin Image Loader** | Technical | Steam CDN hot-linking reliability is unknown. Images may be rate-limited or change URLs. | Test CDN reliability early; design fallback to rarity-color placeholder cards |
| **Price API Layer** | Technical + Scope | Steam Market API rate limits (~20 req/5 min), CORS restrictions from browser, thousands of items need prices, prices change constantly. Community APIs (CSFloat, Skinport) may have better terms. | Use hardcoded prices in MVP; design the API layer as a caching proxy for Vertical Slice; evaluate CORS proxy vs. server-side approach early |
| **Case Data Store** (update) | Data | Now also requires market_price field per case and per item. Thousands of price entries must be sourced and maintained. | Add price field to schema; source from community JSON databases that already include prices (CS2 community maintains these) |

---

## Recommended Design Order

| Order | System | Priority | Layer | Effort |
|-------|--------|----------|-------|--------|
| 1 | Case Data Store | MVP | Foundation | M |
| 2 | Audio System | MVP | Foundation | S |
| 3 | Persistence | MVP | Foundation | S |
| 4 | Drop Rate Engine | MVP | Core | S |
| 5 | Reel Animation Engine | MVP | Core | M |
| 6 | Key Economy | MVP | Core | S |
| 7 | Inventory | MVP | Core | S |
| 8 | Case Opening Orchestrator | MVP | Feature | M |
| 9 | Skin Image Loader | MVP | Feature | S |
| 10 | HUD / App Shell | MVP | Presentation | S |
| 11 | Reel UI | MVP | Presentation | M |
| 12 | Reveal UI | MVP | Presentation | S |
| 13 | Inventory UI | MVP | Presentation | S |
| 14 | Case Browser UI | Vertical Slice | Presentation | M |
| 15 | Wear / Float System | Full Vision | Polish | S |
| 16 | StatTrak Module | Full Vision | Polish | S |

*S = 1 session (~1 GDD), M = 2–3 sessions*

---

## Progress Tracker

| Metric | Count |
|--------|-------|
| Total systems identified | 19 |
| Design docs started | 6 |
| Design docs reviewed | 0 |
| Design docs approved | 0 |
| MVP systems designed | 14 / 14 |
| Vertical Slice systems designed | 3 / 3 |

---

## Next Steps

- [ ] Design systems in the recommended order above — run `/design-system case-data-store`
- [ ] Run `/design-review design/gdd/[system].md` after each GDD is authored
- [ ] Run `/gate-check` when all 13 MVP GDDs are complete
