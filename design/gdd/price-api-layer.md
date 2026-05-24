# Price API Layer

> **Status**: Complete
> **Author**: User + Claude Code
> **Last Updated**: 2026-05-21
> **Implements Pillar**: Faithful Over Flashy · Every Case Counts

## Overview

The Price API Layer is the price-data abstraction module for The Vault. Its sole responsibility is to provide current market prices for CS2 cases and skins to callers that need them — without exposing the complexity of the external price source, CORS workarounds, or caching mechanics to any other system. The primary interface is `getPrice(itemId: string): PriceResult`, which returns a price in USD, a status flag indicating whether the price is live or stale, and a timestamp. Callers receive a price and a freshness indicator; they do not know or care how the price was sourced.

In MVP, this system does not exist — case and item prices are hardcoded in the Case Data Store as `market_price` fields. In the Vertical Slice, the Price API Layer activates and becomes the authoritative price source for Case Browser UI and Market Browser UI. It fetches prices from an external API on demand, then caches the results locally (in-memory, with localStorage as a persistence layer) to stay within rate limits and to ensure prices remain available when the API is temporarily unreachable.

The external API source and CORS solution are implementation decisions deferred to a Technical Setup ADR. The three candidate sources — Steam Community Market API, CSFloat API, and Skinport API — differ in rate limits, CORS policy, and data completeness. This GDD specifies what the Price API Layer must do (the behavioral contract); the ADR will specify how it does it (technical approach). The Case Data Store's hardcoded `market_price` fields remain the fallback for any item whose live price cannot be fetched.

## Player Fantasy

The Price API Layer has no player fantasy of its own. Players never interact with it — it runs invisibly beneath the Market Browser UI and Case Browser UI. What players experience is the result of its work: every case priced at today's real Steam Market value, every skin sell producing the same proceeds they would see on the real market.

The Price API Layer is the fulfillment of Pillar 1 (Faithful Over Flashy). Without live prices, The Vault is a good simulator. With live prices, it is an authentic one. The difference is felt the moment a player notices that the Recoil Case costs what it actually costs today, not an approximation from launch. That fidelity — invisible infrastructure producing visible authenticity — is the only "fantasy" this system serves.

## Detailed Design

### Core Rules

**Rule 1 — Public Interface**

The Price API Layer exposes one public method:

```
PriceAPILayer.getPrice(itemId: string): PriceResult
```

`itemId` is the string ID of a case or skin item from the Case Data Store. The method **never throws**. It always returns a valid `PriceResult`.

`PriceResult` shape:

```
{
  price:     number,   // price in USD; always a valid, positive number
  status:    'live' | 'stale' | 'fallback',
  timestamp: number,   // Unix ms when price was last fetched (0 = hardcoded fallback)
  itemId:    string
}
```

| Status | Meaning |
|--------|---------|
| `live` | Fetched from the external API; age < 5 minutes |
| `stale` | Last known fetched price; TTL has expired; a background re-fetch has been triggered |
| `fallback` | No external price available; returning `CaseDataStore` hardcoded `market_price` |

**Rule 2 — Cache Lookup Sequence**

On every `getPrice(itemId)` call:

```
1. Check memory cache
   If found AND age < CACHE_TTL_MS (5 min) → return immediately, status: 'live'

2. Check localStorage (key: "vault_price_[itemId]")
   If found AND age < CACHE_TTL_MS → load into memory cache, return, status: 'live'

3. Stale check:
   If found anywhere AND age >= CACHE_TTL_MS
     → return current value, status: 'stale'
     → trigger background fetch (async, non-blocking)

4. Not found:
   → return fallback price (CaseDataStore.getItem/Case(itemId).market_price), status: 'fallback'
   → trigger background fetch (async, non-blocking)
```

**Rule 3 — Background Fetch**

When a background fetch is triggered:
- The fetch call is made to the external price API (source resolved by ADR)
- The caller receives the current best value immediately (stale or fallback) — no blocking
- On **success**: memory cache and localStorage entry are updated with `{ price, timestamp: Date.now() }`; a `price-updated` DOM custom event is fired on `document` with `detail: { itemId, price, status: 'live' }`
- On **failure** (network error, HTTP 429 rate-limit, CORS error, HTTP 4xx/5xx): the error is logged; the cache is not updated; no event fires; the next `getPrice()` call will trigger another attempt

**Rule 4 — Fallback Price Source**

When `status: 'fallback'` is returned:
- Case items: `CaseDataStore.getCase(itemId).market_price`
- Skin items: `CaseDataStore.getItem(itemId).market_price`
- Timestamp: `0` (signals to callers that this is a hardcoded value, not a fetched price)
- If the Case Data Store also has no `market_price` (null or undefined): return `{ price: 0.01, status: 'fallback', timestamp: 0 }` — never return `NaN` or null

**Rule 5 — localStorage Persistence**

Cache entries are persisted to localStorage so prices survive page reload:
- Storage key: `vault_price_[itemId]`
- Stored value: `JSON.stringify({ price: number, timestamp: number })`
- On module initialization, memory cache is pre-populated from all matching `vault_price_*` localStorage keys that are younger than `CACHE_TTL_MS`
- Keys older than `CACHE_MAX_AGE_MS` (24 hours) are pruned from localStorage on initialization to prevent unbounded growth

**Rule 6 — In-Flight Deduplication**

If a background fetch for `itemId` is already in progress when a second `getPrice(itemId)` call arrives, no second fetch is started. The second call returns the current best value as normal; both calls will benefit from the single in-flight fetch when it completes.

**Rule 7 — MVP Compatibility**

In MVP, `PriceAPILayer` does not exist. All systems that will use it in the Vertical Slice (Case Browser UI, Market Browser UI) use `CaseDataStore.getCase/Item().market_price` directly in MVP. The Price API Layer introduces no breaking changes — it adds an optional layer over the same data; the fallback path returns the same values as the MVP path.

### States and Transitions

Per-item cache state machine:

| State | Condition | Returns | On `getPrice()` call |
|-------|-----------|---------|---------------------|
| **Uncached** | No memory or localStorage entry | `status: 'fallback'` | Trigger background fetch |
| **Live** | Entry exists; age < 5 min | `status: 'live'` | Return cached value immediately |
| **Stale** | Entry exists; age ≥ 5 min | `status: 'stale'` | Return stale value; trigger background fetch |
| **Fetching** | Background fetch in flight | `status: 'stale'` or `'fallback'` | Return current best; no second fetch started |

State transitions (per item):

```
Uncached ──(fetch success)──► Live
Uncached ──(fetch fail)──────► Uncached (retry on next getPrice call)

Live ──(age ≥ TTL)──────────► Stale
Stale ──(fetch success)─────► Live
Stale ──(fetch fail)────────► Stale (cached value retained; retry on next call)
```

### Interactions with Other Systems

| System | Direction | Interface | Notes |
|--------|-----------|-----------|-------|
| **Case Data Store (#1)** | ↑ depends on | `getCase(id).market_price`, `getItem(id).market_price` | Fallback prices when external API is unreachable |
| **Case Browser UI (#15)** | ↓ depended on by | `getPrice(caseId)` | In VS, Case Browser UI should call Price API Layer instead of CaseDataStore directly (retrofit noted in OQ-1 below) |
| **Market Browser UI (#17)** | ↓ depended on by | `getPrice(itemId)` | Calls per-item as skin cards render; listens for `price-updated` event to refresh displayed prices |

The `price-updated` DOM custom event (fired on `document`) carries `{ itemId, price, status }`. Callers that need live-updating prices should listen for this event. Callers that do not need live updates (one-time loads) can ignore it.

## Formulas

#### F1: Cache Age Check

```
age_ms         = Date.now() - entry.timestamp
is_stale       = age_ms >= CACHE_TTL_MS
is_expired     = age_ms >= CACHE_MAX_AGE_MS
```

- `entry.timestamp`: Unix milliseconds when the price was last successfully fetched
- `CACHE_TTL_MS`: 300,000 ms (5 minutes) — determines live vs. stale status
- `CACHE_MAX_AGE_MS`: 86,400,000 ms (24 hours) — entries older than this are pruned from localStorage on init

*Example: entry fetched at T=1000ms. Called at T=400,000ms. age_ms = 399,000ms. is_stale = true (399,000 ≥ 300,000). is_expired = false (399,000 < 86,400,000). → Return stale value, trigger background fetch.*

#### F2: localStorage Key

```
storage_key = "vault_price_" + itemId
```

*Example: itemId = `"recoil_case"` → key = `"vault_price_recoil_case"`*
*Example: itemId = `"ak47_asiimov_fac_new"` → key = `"vault_price_ak47_asiimov_fac_new"`*

This formula ensures all Price API Layer keys share a prefix, enabling bulk pruning of expired entries without scanning all localStorage keys.

## Edge Cases

**E1: External API is down for an extended period (ongoing outage)**
*Handling*: Every `getPrice()` call for uncached items triggers a fetch attempt that fails. The system logs each failure and returns the fallback price from Case Data Store for every call. The memory cache is never updated during the outage. When the API recovers, the next `getPrice()` call triggers a fresh fetch that succeeds. The system degrades gracefully — the app continues to function at MVP price fidelity until the API recovers.

**E2: Rate limit hit (HTTP 429 from external API)**
*Handling*: Treated identically to any other fetch failure (E1). The failing requests are not retried immediately — retries only occur when the caller makes the next `getPrice()` call (lazy retry, not active backoff). The 5-minute TTL means most items will not be re-requested within the rate limit window once cached; only items with no prior cached value or expired TTLs trigger new requests.

**E3: `itemId` not found in Case Data Store**
*Handling*: If `CaseDataStore.getCase(itemId)` and `CaseDataStore.getItem(itemId)` both return `null`, the fallback price is `$0.01` (Rule 4 minimum). This is an upstream data integrity issue, not a Price API Layer failure. The module logs a warning. The caller receives `{ price: 0.01, status: 'fallback', timestamp: 0 }` — it is the caller's responsibility to handle this gracefully in UI.

**E4: localStorage is unavailable or throws QuotaExceededError**
*Handling*: The Price API Layer treats localStorage as a non-critical enhancement. If `localStorage.setItem()` throws (quota exceeded, browser security restrictions, private browsing), the exception is caught and logged. The memory cache continues to function normally. Prices are still cached in memory for the session; they are not persisted across page reloads. The app continues to function.

**E5: Fetched price from external API is zero, negative, or `NaN`**
*Handling*: Before storing a fetched value, the Price API Layer validates: `isFinite(price) && price > 0`. If this check fails, the fetch result is discarded (treated as failure), the error is logged, and the fallback path is used. `NaN`, `0`, negative values, and non-numeric responses are all invalid — the external API may return malformed data.

**E6: Multiple simultaneous `getPrice()` calls for the same uncached item**
*Handling*: Covered by Rule 6 (in-flight deduplication). Only one fetch is started per `itemId`, regardless of how many calls arrive before it completes. All callers receive the current best value (fallback or stale); all benefit from the single fetch result when it resolves.

**E7: Page unloads while a background fetch is in progress**
*Handling*: The in-flight fetch is abandoned by the browser. The partially-fetched price is not stored. On the next page load, the item's cache state is whatever it was before the fetch was triggered (stale or uncached). No action needed — this is standard browser behavior for async requests on page unload.

## Dependencies

**Upstream (this system depends on):**

| System | Why needed | Interface |
|--------|-----------|-----------|
| **Case Data Store (#1)** | Fallback price source when external API is unreachable | `getCase(id).market_price`, `getItem(id).market_price` |

**Downstream (systems that depend on this one):**

| System | Why they need it | What they rely on |
|--------|-----------------|------------------|
| **Market Browser UI (#17)** | Per-item live prices for skin cards | `getPrice(itemId)` — live/stale/fallback price; `price-updated` DOM event for live refresh |
| **Case Browser UI (#15)** | Live case prices in grid cards (Vertical Slice retrofit) | `getPrice(caseId)` — live/stale/fallback price; `price-updated` DOM event |

**External dependency (non-GDD):**

| Source | Type | Notes |
|--------|------|-------|
| External price API | Runtime dependency | Source TBD (Steam Community Market, CSFloat, or Skinport — resolved by Technical Setup ADR). Not a GDD system; architectural decision only. |

## Tuning Knobs

| Knob | Default | Safe Range | Effect |
|------|---------|------------|--------|
| `CACHE_TTL_MS` | 300,000 (5 min) | 60,000–3,600,000 | How long a fetched price is considered "live" before triggering a stale re-fetch. Lower = fresher prices, more API calls. Higher = more stale prices, fewer API calls. Floor of 1 min prevents rate-limit hammering. Ceiling of 1 hour keeps prices "same session" fresh. |
| `CACHE_MAX_AGE_MS` | 86,400,000 (24 hrs) | 3,600,000–604,800,000 | Maximum age of a localStorage entry before it is pruned on init. Prevents unbounded localStorage growth. Setting lower than `CACHE_TTL_MS` would be a misconfiguration — always keep `CACHE_MAX_AGE_MS > CACHE_TTL_MS`. |
| `FALLBACK_PRICE_FLOOR` | 0.01 | 0.01–1.00 | Minimum price returned when the fallback is `null`. Prevents `$0.00` prices appearing in UI. Should remain `$0.01` (one cent = "exists but unvalued") to avoid misleading displays. |
| `ENABLE_LOCALSTORAGE_CACHE` | true | true / false | If false, the localStorage persistence layer is disabled entirely. Memory-only caching. Useful during development to force fresh fetches each page reload. Leave true in production. |

## Visual/Audio Requirements

The Price API Layer produces no visual or audio output directly. It is a data module.

The one player-visible concern this system raises is **price staleness display** — when a price has `status: 'stale'` or `'fallback'`, callers should indicate this to the user. The visual treatment of staleness (e.g., a dimmed price, a clock icon, a "~" prefix) is the responsibility of the calling UI system (Market Browser UI, Case Browser UI), not this module. This GDD requires only that the `status` field is passed through faithfully.

## UI Requirements

The Price API Layer has no UI of its own.

**Developer/debug UI requirement (optional, Vertical Slice):** A debug overlay showing the current cache state for all loaded items (itemId, price, status, age) would accelerate API integration testing. This is not player-facing and is not required for the Vertical Slice launch — noted here as a developer tooling suggestion for the Technical Setup phase.

## Acceptance Criteria

| ID | Scenario | Expected Result | Gate |
|----|----------|-----------------|------|
| AC-PAL-01 | `getPrice("recoil_case")` called with no cache entry | Returns `{ price: [CDS fallback], status: 'fallback', timestamp: 0 }` immediately; background fetch triggered | BLOCKING |
| AC-PAL-02 | `getPrice()` called; background fetch succeeds | Cache entry created; next `getPrice()` returns `status: 'live'` with fetched price | BLOCKING |
| AC-PAL-03 | `getPrice()` called; cache entry is live (age < 5 min) | Returns cached value immediately; no new fetch triggered | BLOCKING |
| AC-PAL-04 | `getPrice()` called; cache entry is stale (age ≥ 5 min) | Returns stale value immediately with `status: 'stale'`; background fetch triggered | BLOCKING |
| AC-PAL-05 | Background fetch succeeds | `price-updated` DOM event fires on `document` | BLOCKING |
| AC-PAL-06 | Background fetch fails (network error) on uncached item | `price-updated` event does NOT fire; cache not updated; next `getPrice()` returns fallback | BLOCKING |
| AC-PAL-07 | Background fetch returns HTTP 429 (rate limited) | Treated as failure (same as AC-PAL-06) | BLOCKING |
| AC-PAL-08 | Background fetch returns price of `0` or `NaN` | Treated as failure; cache not updated; fallback returned | BLOCKING |
| AC-PAL-09 | `getPrice()` called while a fetch for the same itemId is already in progress | No second fetch triggered; returns current best value | BLOCKING |
| AC-PAL-10 | Successful fetch occurs | `localStorage.setItem("vault_price_[itemId]", ...)` called with `{ price, timestamp }` | BLOCKING |
| AC-PAL-11 | Page reloads with localStorage entry younger than 5 min | Memory cache pre-populated; first `getPrice()` returns `status: 'live'` without triggering a fetch | BLOCKING |
| AC-PAL-12 | Page reloads with localStorage entry older than 5 min, younger than 24h | First `getPrice()` returns `status: 'stale'` and triggers fetch | BLOCKING |
| AC-PAL-13 | `localStorage.setItem()` throws `QuotaExceededError` | Exception caught; memory cache updated normally; `getPrice()` returns correct price for session | BLOCKING |
| AC-PAL-14 | `getPrice()` called for itemId not found in Case Data Store | Returns `{ price: 0.01, status: 'fallback', timestamp: 0 }` — no throw | BLOCKING |
| AC-PAL-15 | `getPrice()` called under any condition | Never throws; always returns valid `PriceResult` with positive `price` | BLOCKING |
| AC-PAL-16 | localStorage entries older than 24h exist on page load | Pruned during init; no longer in localStorage after initialization | BLOCKING |
| AC-PAL-17 | Live price differs from CDS hardcoded price | `getPrice()` returns fetched price, `status: 'live'` | BLOCKING |
| AC-PAL-18 | Background fetch fails on an item with a prior stale cache entry | Cache entry NOT cleared; next `getPrice()` returns same stale price, `status: 'stale'`; no `price-updated` event | BLOCKING |
| AC-PAL-19 | Background fetch succeeds and fires `price-updated` event | `detail` contains exactly `{ itemId: string, price: number, status: 'live' }` — payload matches cache value | BLOCKING |
| AC-PAL-20 | `localStorage.getItem()` throws during module initialization | Exception caught silently; memory cache starts empty; `getPrice()` functions normally | BLOCKING |
| AC-PAL-21 | localStorage contains a malformed JSON entry for an itemId | Parse error caught silently; that entry skipped; other valid entries still loaded; `getPrice()` for malformed item returns fallback | BLOCKING |
| AC-PAL-22 | Background fetch returns a negative price (e.g., `-1.50`) | Treated as failure; cache not updated; fallback returned; `price-updated` does NOT fire | BLOCKING |
| AC-PAL-23 | localStorage entry age is exactly `CACHE_MAX_AGE_MS` (24h) on init | Entry pruned (`age >= CACHE_MAX_AGE_MS` qualifies); `getPrice()` returns fallback for that item | BLOCKING |

## Open Questions

**OQ-1 — API selection → ADR (Technical Setup blocker)**
Which external price API should the Price API Layer use? The three candidates are:

| Candidate | Pros | Cons |
|-----------|------|------|
| Steam Community Market API | Authoritative source; all CS2 items covered | CORS-blocked from browser; ~20 req/5 min rate limit; no bulk endpoint |
| CSFloat API | CS2-focused; community maintained; may have browser-accessible endpoints | Rate limits unknown; data completeness unknown |
| Skinport API | Market platform; structured price data | Pricing reflects Skinport market, not Steam Market; may differ from CDS reference prices |

Resolution: Technical Setup ADR. This GDD's behavioral contract is API-agnostic; the ADR picks the source and documents the CORS solution.

**OQ-2 — CORS solution → ADR (Technical Setup blocker)**
How is the browser CORS restriction resolved? Options: (a) CORS proxy (third-party or self-hosted), (b) serverless function (Vercel/Netlify edge function), (c) choose an API that allows browser access directly. Resolution: same ADR as OQ-1 — API selection and CORS solution are co-decisions.

**OQ-3 — Case Browser UI retrofit (implementation note)**
Case Browser UI (GDD #15) was designed to read `market_price` directly from `CaseDataStore`. In the Vertical Slice, it should call `PriceAPILayer.getPrice(caseId)` instead for live prices. This retrofit must be completed before the VS is considered feature-complete. No GDD change required — noted here and tracked as an implementation task.

**OQ-4 — External API price format**
Does the selected API return prices in USD decimal (`2.49`) or another format (pence, Steam "price string" like `"$2.49"`, integers representing cents)? This determines whether a parsing/conversion step is needed before storing in cache. Resolution: verified when the API is selected (OQ-1).

**OQ-5 — Bulk fetch optimization (post-VS consideration)**
Market Browser UI may render hundreds of skin cards simultaneously. With single-item lazy fetching, this generates many sequential fetch calls. If the chosen API supports bulk price queries (e.g., `getPrices([id1, id2, ...])` in one request), a `prefetchPrices(itemIds: string[]): void` method should be added to this module's interface. Deferred: evaluate after API selection (OQ-1). If bulk is available, raise as a VS design change before implementing.
