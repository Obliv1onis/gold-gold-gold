# Cross-GDD Review Report — 2026-05-21

**Date:** 2026-05-21
**Reviewer:** /review-all-gdds (full mode)
**GDDs reviewed:** 17 (14 MVP + 3 Vertical Slice)
**Initial Verdict:** **FAIL** — 4 blocking consistency issues; 1 elevated design concern; 13 advisory warnings
**Final Verdict (after inline fixes 2026-05-21):** **PASS** — all 4 blockers resolved in-session; 1 elevated design concern + 13 warnings remain advisory

---

## Resolution Log (2026-05-21)

All 4 blockers fixed in the same session via direct Edit operations. No redesign required.

- **B-1/B-2 resolved:** Changed `case-inventory.md` `buyCase` signature to `(caseId, unitPrice, quantity = 1)`. The 2-arg form `buyCase(caseId, unitPrice)` is now valid and equivalent to `buyCase(caseId, unitPrice, 1)`. Rule 4, public API table, downstream-dependents table, E1, and ACs CI-04/05/06/07/13 updated. New AC-CI-14 added for the 2-arg form. Case Browser UI's existing 2-arg calls remain unchanged and now match the spec.
- **B-3 resolved:** Edited `skin-inventory.md` lines 14, 50, 105 to clarify that `sellItem()` computes `net_proceeds = round(salePrice × (1 - SELL_FEE_RATE))` internally and calls `VirtualEconomy.earn(net_proceeds)`. Fee is applied inside `sellItem()`; callers pass gross. F1 and AC-INV-05 already had the correct behavior — the prose is now consistent.
- **B-4 resolved:** Added `getItem(itemId: string): ItemEntry | null` as the 6th method on the Case Data Store Interface Contract. Two acceptance criteria added for found/not-found cases. Price API Layer's existing `CaseDataStore.getItem(itemId).market_price` references are now valid.
- Systems index `Needs Revision` flags cleared for case-data-store, case-inventory, skin-inventory, case-browser-ui, price-api-layer.

Remaining items (D-1 framing + W-1 through W-7) are advisory; they do not block the Systems Design → Technical Setup gate.

---

## Original Report (preserved below for traceability)

---

## Summary

The 14 MVP GDDs that passed review on 2026-05-21 (re-run) remain internally
coherent. The three Vertical Slice GDDs (Case Browser UI, Price API Layer,
Market Browser UI) introduced four cross-document contradictions during their
authoring — all surface-level documentation defects with no required redesign.
Estimated total fix time: 30-45 minutes via direct edits.

The design-theory holism review surfaces no new structural issues — the
previously logged W-7 (negative open EV) is elevated for fantasy-framing
revision but is not blocking because the math itself is faithful to real CS2
(Pillar 1).

---

## Consistency Issues

### Blocking

**B-1: `buyCase()` signature mismatch (Case Browser UI ↔ Case Inventory)**

- `design/gdd/case-browser-ui.md:12, 49, 85, 134, 160, 335, 337, 353` — calls `CaseInventory.buyCase(caseId, casePrice)` (2 args)
- `design/gdd/case-inventory.md:51` — signature is `buyCase(caseId: string, quantity: number, unitPrice: number): boolean` (3 args; quantity is the 2nd arg)

**Impact:** Implementation will pass `casePrice` where `quantity` is expected → cost computed as `unitPrice * quantity` with undefined `unitPrice` → NaN balance deduction.

**Resolution options:**
- (a) Update Case Browser UI to call `buyCase(caseId, 1, casePrice)` — 4 call sites + AC-CBR-11
- (b) Overload Case Inventory: default `quantity = 1` when called with 2 args. Case Browser only ever buys 1, so (b) is the cleaner fix.

**B-2: `buyCase` acceptance criteria contradict (AC-CBR-11 vs AC-CI-04/13)**

Same root cause as B-1. Acceptance criteria in both GDDs must align after the signature decision.

**B-3: Skin Inventory `sellItem()` fee-application documented inconsistently**

- `design/gdd/skin-inventory.md:14` — "calls `VirtualEconomy.earn(salePrice)`"
- `design/gdd/skin-inventory.md:50` — Rule 5: "calls `VirtualEconomy.earn(salePrice)`"
- `design/gdd/skin-inventory.md:105` — Interactions diagram: "calls `VirtualEconomy.earn(salePrice)`"
- `design/gdd/skin-inventory.md:116-127` — F1: `net_proceeds = market_price × (1 - SELL_FEE_RATE)`; F1 variable description: "Net proceeds = Amount passed to `VirtualEconomy.earn()`"
- `design/gdd/skin-inventory.md:243` — AC-INV-05: `sellItem(instanceId, 10.00)` results in `earn(8.50)` (fee applied inside)

**Impact:** A programmer reading Rule 5 first will implement `earn(salePrice)` with no fee. Fee never applied → portfolio inflates 17.6% over correct value.

**Resolution:** Edit Rule 5 prose to: "calls `VirtualEconomy.earn(net_proceeds)`, where `net_proceeds = round(salePrice × (1 - SELL_FEE_RATE))`." Same fix at lines 14 and 105.

**B-4: `CaseDataStore.getItem(itemId)` referenced but not exposed**

- `design/gdd/price-api-layer.md:70, 86, 132, 174, 194` — references `CaseDataStore.getItem(itemId).market_price` as fallback for skin-tier items
- `design/gdd/case-data-store.md:253-257` — Interface Contract exposes `getCase`, `getCaseList`, `getItems(caseId, rarity)`, `getAllItems(caseId)`, `getAllSkins()`. No singular `getItem(itemId)` method.

**Impact:** Price API Layer's fallback path is unimplementable as written.

**Resolution options:**
- (a) Add `getItem(itemId): ItemEntry | null` to CDS Interface Contract (one-line API addition; internal lookup over all cases). **Recommended.**
- (b) Rewrite price-api-layer fallback to use `getAllSkins().find(i => i.item_id === itemId)`.

### Warnings

| ID | Description | File:Line |
|----|-------------|-----------|
| W-1 | Stale "Pending GDD retrofits" note — HUD retrofit already applied | market-browser-ui.md:217 |
| W-2 | Stale bidirectionality-verification note | case-browser-ui.md:175-178 |
| W-3 | Missing Reveal UI as downstream dependent | skin-image-loader.md:156 |
| W-4 | Stale "caller TBD" for `playReveal()` (Orchestrator owns it) | audio-system.md:289 |
| W-5 | Event-target inconsistency: `price-updated` fires on `window`; others on `document` | price-api-layer.md:79, 136 |
| W-6 | Hardcoded `× 0.85` instead of `SELL_FEE_RATE` reference | reveal-ui.md, inventory-ui.md, market-browser-ui.md |
| W-7 | Live-buy/CDS-sell value leak: Market Browser stores CDS-sourced ItemEntry at buy time | market-browser-ui.md:98, 134 (OQ-1 defers to UX spec) |

---

## Game Design Issues

### Elevated Warning (was logged as W-7 in prior review)

**D-1: Open EV is provably negative; player-fantasy framing implies the opposite**

Per-open EV computed from standard CS2 weights on the Recoil Case example:

- Cost: `case_price ($0.49) + key_cost ($2.49) = $2.98`
- Gross EV (sum of `weight × avg_tier_price`): ≈ $1.33
- Net EV after 15% sell fee: ≈ $1.13
- **Per-open net: ≈ −$1.85**

`design/gdd/game-concept.md:38` reads "Open cases hoping for profit." `design/gdd/virtual-economy.md` framing implies bankroll growth. The math contradicts this.

**Note:** Negative EV is faithful to real CS2 (Pillar 1) and was previously logged as W-7. The design is mathematically correct; the *language* mis-frames the fantasy.

**Resolution (not blocking):** Reframe Player Fantasy text in `virtual-economy.md` and `game-concept.md` from "grow the bankroll" to "ride the variance / chase the dream pull". Or add: "EV is negative by design — this mirrors real CS2."

### Other Design Warnings

| ID | Description | Source |
|----|-------------|--------|
| D-2 | No portfolio target / session-length goal defined (carryover) | virtual-economy.md OQ-1, W-9 |
| D-3 | Market Browser visible-card price-flicker risk at scale | market-browser-ui.md Rule 6 + 7 + E7 |
| D-4 | Stranded state: `$0 < balance < min_open_cost` + empty inventory cannot reset | hud-app-shell.md AC-HUD-09b — Reset only at exactly `$0` |
| D-5 | Reset confirmation does not surface portfolio value destroyed (carryover) | hud-app-shell.md, W-8 |
| D-6 | No "virtual currency" framing despite authentic $-formatting | all UI GDDs |
| D-7 | Case Browser "sell one skin and this is yours" framing breaks for high-tier cases | case-browser-ui.md Player Fantasy |

---

## Cross-System Scenario Walkthrough

Scenarios walked: 8

| # | Scenario | Verdict |
|---|----------|---------|
| S1 | Buy case from browser → Case Inventory | 🔴 BLOCKER — arg mismatch (B-1) |
| S2 | Click Open → full reel chain → reveal → addItem | ✅ Clean |
| S3 | Direct skin buy → confirm → spend → addItem | ⚠️ Live-buy/CDS-sell leak (W-7) |
| S4 | Reset boundary: $0.50 + empty inventory | ⚠️ Stranded state (D-4) |
| S5 | Price update mid-confirm dialog | ✅ Re-validated at confirm time (AC-MBR-19) |
| S6 | Reveal → Sell button | 🔴 BLOCKER — fee location ambiguous (B-3) |
| S7 | Persistence save races | ✅ Synchronous localStorage — no race |
| S8 | Reset during active spin | ✅ Protected by HUD AC-HUD-09b |

---

## GDDs Flagged for Revision

| GDD | Reason | Type | Priority |
|-----|--------|------|----------|
| design/gdd/case-browser-ui.md | `buyCase()` 2-arg call vs 3-arg signature; AC-CBR-11 conflict | Consistency | 🔴 Blocking |
| design/gdd/case-inventory.md | Same root cause (B-1/B-2); AC-CI-04/13 must align | Consistency | 🔴 Blocking |
| design/gdd/skin-inventory.md | Rule 5 prose contradicts F1 + AC-INV-05 on fee location | Consistency | 🔴 Blocking |
| design/gdd/price-api-layer.md | References `getItem(itemId)` not in CDS interface | Consistency | 🔴 Blocking |
| design/gdd/case-data-store.md | Add `getItem(itemId)` to Interface Contract (resolves B-4) | Consistency | 🔴 Blocking |
| design/gdd/virtual-economy.md | Player Fantasy framing vs negative open EV (D-1) | Design Theory | Warning |
| design/gdd/game-concept.md | Same framing concern | Design Theory | Warning |
| design/gdd/market-browser-ui.md | Stale "pending retrofit" note (W-1) | Consistency | Warning |
| design/gdd/skin-image-loader.md | Missing Reveal UI as downstream dependent (W-3) | Consistency | Warning |
| design/gdd/audio-system.md | Stale "caller TBD" for `playReveal()` (W-4) | Consistency | Warning |

---

## Verdict: **FAIL**

Four hard documentation contradictions will produce incorrect implementations
or runtime failures. All four are surface-level — none require redesign.

**Estimated fix time: 30-45 minutes via direct Edit operations.**

### Required actions before re-running

1. **B-1 / B-2:** Pick a canonical `buyCase()` signature. Recommended: overload in `case-inventory.md` to default `quantity = 1` when called with 2 args; update AC-CI-04/13 to reflect both forms. Case Browser UI remains unchanged.
2. **B-3:** Edit `skin-inventory.md` lines 14, 50, 105 to clarify `earn(net_proceeds)` not `earn(salePrice)`. Single coherent statement.
3. **B-4:** Add `getItem(itemId: string): ItemEntry | null` to `case-data-store.md` Interface Contract (line 257). Add an acceptance criterion in the GIVEN/WHEN/THEN block.

After fixes, re-run `/review-all-gdds since-last-review` to verify clean PASS.

### Recommended advisory follow-ups (do not block architecture)

- Resolve D-1 (negative EV framing) before Vertical Slice player-facing copy is written.
- Add `getItem` to CDS at the same time as B-4 — single edit resolves both.
- Sweep W-1 through W-7 in a single editing pass; estimated 15 minutes total.

---

## Reviewer notes

- The previous 2026-05-21 review report (verdict PASS) covered only the 14 MVP GDDs. This run expanded scope to all 17 (MVP + 3 VS). The 4 blockers found are all in or caused by the 3 newly added VS GDDs interacting with MVP GDDs.
- Registry consistency is clean: 3 formulas + 8 constants verified; no value conflicts. Sell-fee constant (`SELL_FEE_RATE = 0.15`) is hardcoded as `0.85` literal in 3 downstream GDDs (W-6) but the value is correct.
- Engine pre-check: N/A — this is a web app (HTML/CSS/JS), no engine reference docs in scope.
