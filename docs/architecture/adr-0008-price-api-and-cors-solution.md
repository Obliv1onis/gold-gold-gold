# ADR-0008: Price API Source and CORS Solution

## Status
Proposed

## Date
2026-05-21

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Browser (HTML / CSS / JavaScript) |
| **Domain** | Networking / External API |
| **Knowledge Risk** | MEDIUM — third-party API CORS policies and rate limits may have changed post-training-cutoff |
| **References Consulted** | price-api-layer.md GDD (OQ-1, OQ-2), ADR-0001 (Vite dev proxy), ADR-0002 (Feature layer placement) |
| **Post-Cutoff APIs Used** | None (browser `fetch()` is stable) |
| **Verification Required** | (1) Confirm CSFloat API `https://csfloat.com/api/v1/` returns `Access-Control-Allow-Origin: *` headers for browser fetch requests before committing to the direct-fetch path. (2) Confirm CSFloat price format (USD decimal vs. cents vs. string). (3) Verify rate limit ceiling for unauthenticated requests. (4) If CORS is NOT confirmed: implement Netlify/Vercel serverless proxy before Vertical Slice sprint begins. |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-0001 (Vite dev proxy config), ADR-0002 (Feature layer: `src/feature/price-api-layer.js`) |
| **Enables** | PriceAPILayer implementation (`src/feature/price-api-layer.js`) |
| **Blocks** | Vertical Slice only — MVP uses hardcoded prices from CaseDataStore; PriceAPILayer does not exist in MVP. This ADR must be Accepted before the Vertical Slice sprint begins. |
| **Ordering Note** | Not needed before MVP coding begins. Flag as MUST RESOLVE before VS sprint kickoff. |

## Context

### Problem Statement
The price-api-layer.md GDD defers the external API source and CORS solution to this ADR (OQ-1 + OQ-2). The three candidate sources — Steam Community Market API, CSFloat API, and Skinport API — have meaningfully different CORS policies, rate limits, and data characteristics. The CORS solution drives the deployment architecture: if the chosen API allows browser access directly, no server-side infrastructure is needed; if not, a serverless proxy function must be created and maintained.

This is the only ADR in the set that introduces a potential external infrastructure dependency (a serverless function), which is why it carries MEDIUM risk.

### Constraints
- The app is a static web app (HTML/CSS/JS built by Vite) — no persistent server process
- Steam Community Market API is CORS-blocked for browser requests — fetching directly from the browser is impossible without a proxy
- Skinport API prices reflect the Skinport marketplace, not Steam Market; the GDD's fallback prices are sourced from Steam Market values, creating a discrepancy
- The Vite dev server (`vite.config.js`) already has a `server.proxy` block from ADR-0001 — dev CORS is solved regardless of API choice
- Rate limits must be manageable with a 5-minute TTL cache (CACHE_TTL_MS = 300,000 ms): at most 1 fetch per item per 5 minutes
- MVP does not use this module — PriceAPILayer does not exist until the Vertical Slice

### Requirements
- Must return USD prices for CS2 cases and skins by item identifier
- Must work in a browser fetch context (or be accessible via a thin proxy)
- Must have sufficient rate limits for a single-user simulator (~20-60 items per session, well-spaced)
- Must agree on price magnitude with the GDD's hardcoded fallback prices (Steam Market values)

## Decision

**Use CSFloat Market API as the primary price source. Fetch directly from the browser in production (CSFloat provides CORS headers). Use the Vite dev proxy in development for parity.**

**If CORS verification (see Verification Required above) fails, fall back to Alternative B (Netlify/Vercel thin proxy wrapping the Steam Community Market API).**

### Chosen API: CSFloat Market API

| Attribute | Value |
|-----------|-------|
| **Base URL** | `https://csfloat.com/api/v1/` |
| **CORS** | Allows browser origin (verify — see Verification Required) |
| **Coverage** | CS2 skins and cases |
| **Price source** | CSFloat marketplace prices (close to Steam Market; small variance) |
| **Rate limit** | Unauthenticated: verify before VS sprint |
| **Format** | JSON; price in USD; verify decimal vs. cents format |
| **Authentication** | None required for basic price lookup |

### Fallback: Steam Community Market API via Netlify Function

If CSFloat CORS verification fails, this ADR's decision changes to:

| Attribute | Value |
|-----------|-------|
| **Base URL** | `/.netlify/functions/price-proxy?name=[hash_name]` |
| **Proxy target** | `https://steamcommunity.com/market/priceoverview/?currency=1&appid=730&market_hash_name=` |
| **CORS** | Solved — Netlify Function runs server-side, no browser CORS restriction |
| **Price source** | Steam Market — exact match to GDD hardcoded fallback prices |
| **Deployment** | One `netlify/functions/price-proxy.js` file; zero additional cost under Netlify free tier |

### API Fetch Pattern

```js
// src/feature/price-api-layer.js

// Development: Vite proxy rewrites /api/price → CSFloat API
// Production: Direct fetch to CSFloat (CORS verified) OR to Netlify function

const PRICE_API_BASE = import.meta.env.VITE_PRICE_API_BASE ?? 'https://csfloat.com/api/v1';

async function _fetchPrice(itemId) {
  const url = `${PRICE_API_BASE}/listings?market_hash_name=${encodeURIComponent(itemId)}&limit=1`;
  const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  // Extract price from CSFloat response format — verify field names before VS sprint
  const price = data?.data?.[0]?.price;
  if (!Number.isFinite(price) || price <= 0) throw new Error('Invalid price in response');
  return price / 100; // CSFloat prices are in cents — verify this
}
```

### Vite Dev Proxy Config (already in ADR-0001)

```js
// vite.config.js — already set up by ADR-0001
server: {
  proxy: {
    '/api/price': {
      target: 'https://csfloat.com/api/v1',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api\/price/, ''),
    }
  }
}
```

### Environment Variable Strategy

| Variable | Dev Value | Production Value |
|----------|-----------|-----------------|
| `VITE_PRICE_API_BASE` | `/api/price` (Vite proxy) | `https://csfloat.com/api/v1` (direct) OR `/.netlify/functions/price-proxy` (if proxy path) |

Set `VITE_PRICE_API_BASE` in `.env.development` and `.env.production`. The PriceAPILayer module reads it at runtime via `import.meta.env.VITE_PRICE_API_BASE`.

### Architecture Diagram

```
PriceAPILayer.getPrice(itemId)
  │
  ├── [dev]  fetch('/api/price/listings?...')
  │             └── Vite proxy → https://csfloat.com/api/v1/listings?...
  │
  └── [prod] fetch('https://csfloat.com/api/v1/listings?...')  [CORS allowed]
               OR
             fetch('/.netlify/functions/price-proxy?name=...')
               └── Netlify Function → steamcommunity.com/market/priceoverview?...
```

## Alternatives Considered

### Alternative A: Steam Community Market API with no proxy (direct browser fetch)
- **Description**: `https://steamcommunity.com/market/priceoverview/?currency=1&appid=730&market_hash_name=[name]`
- **Pros**: Authoritative — exact Steam Market prices; matches GDD hardcoded fallback values precisely; widely documented.
- **Cons**: CORS-blocked. Steam's CDN and market API do not include `Access-Control-Allow-Origin` headers for arbitrary browser origins. Any fetch attempt from a non-Steam domain will fail with a CORS error in every browser.
- **Rejection Reason**: Cannot be used for direct browser fetch. Requires a proxy (Alternative B).

### Alternative B: Steam Community Market API via serverless proxy
- **Description**: A single Netlify Function or Vercel Edge Function that proxies requests from the browser to Steam Market API. The function runs server-side, so CORS does not apply.
- **Pros**: Exact Steam prices; matches fallback values precisely; Netlify/Vercel free tier handles the low request volume.
- **Cons**: Introduces infrastructure dependency — the app is no longer purely static; requires a Netlify/Vercel account; adds a deployment step. Serverless cold starts add ~100-300ms to the first fetch (acceptable given the 5-minute TTL).
- **Rejection Reason**: Infrastructure overhead not justified if CSFloat's browser CORS verification passes. This becomes the fallback decision if CSFloat fails.

### Alternative C: Skinport API
- **Description**: `https://api.skinport.com/v1/items?app_id=730&currency=USD`
- **Pros**: Provides bulk price data for all CS2 items in one request; allows browser CORS.
- **Cons**: Skinport prices reflect the Skinport marketplace, which runs at a discount to Steam Market (typically 15-30% lower). This would make the simulator's economy inconsistent — the fallback prices (from GDD, based on Steam values) would be higher than the live prices, creating price jumps when the API activates. Also, Skinport's bulk endpoint returns a different data structure from a per-item lookup.
- **Rejection Reason**: Price discrepancy with Steam Market creates inconsistency in the economy simulation. The GDD's fallback prices are Steam-based; the live prices should match the same market.

### Alternative D: No live prices — hardcoded only (MVP stays in production)
- **Description**: Skip the Price API Layer entirely; keep hardcoded market_price fields from CaseDataStore as the permanent price source.
- **Pros**: Zero infrastructure complexity; works offline; no rate limits.
- **Cons**: Prices become stale over time — a 6-month-old build shows prices from launch day. Contradicts Pillar 1 ("Faithful Over Flashy") — authenticity of live prices is a stated design goal for the Vertical Slice.
- **Rejection Reason**: Violates VS design goal. Acceptable for MVP (which has no Price API Layer), but the VS explicitly introduces live pricing.

## Consequences

### Positive
- If CSFloat CORS verification passes: zero infrastructure dependencies — app remains purely static
- Vite dev proxy pattern (from ADR-0001) means dev and prod fetch paths are parallel — no dev-only hacks
- `VITE_PRICE_API_BASE` environment variable makes the API target swappable without code changes

### Negative
- If CSFloat CORS fails: must implement and deploy a Netlify/Vercel function before VS sprint — this is the "MEDIUM risk" the ADR carries
- CSFloat prices have small variance from Steam Market prices (~1-5%) — not a gameplay issue for a simulator but worth noting in the VS release notes
- CSFloat API response schema must be verified — field names and price units are not confirmed pre-training-cutoff

### Risks
- **CSFloat CORS fails**: The whole direct-fetch strategy fails. Mitigation: verify before VS sprint begins (see Verification Required). If it fails, Alternative B is the immediate fallback — one `netlify/functions/price-proxy.js` file.
- **CSFloat rate limit**: Unknown for unauthenticated requests. Mitigation: the 5-minute TTL means the simulator will rarely make more than 1 request per item per session; total requests per session ~20-60. This should be well within any reasonable rate limit.
- **CSFloat price format change**: The response JSON format may differ from training data. Mitigation: the `_fetchPrice()` extraction is isolated — one place to update if the schema differs.

## GDD Requirements Addressed

| GDD System | Requirement | How This ADR Addresses It |
|------------|-------------|--------------------------|
| price-api-layer.md OQ-1 | External API source TBD | CSFloat Market API selected as primary |
| price-api-layer.md OQ-2 | CORS solution TBD | Direct browser fetch (CSFloat) with Vite proxy in dev; Netlify function as fallback |
| price-api-layer.md OQ-4 | Price format: USD decimal vs. cents | CSFloat: cents (divide by 100); verify before VS sprint |
| price-api-layer.md | Fallback to CaseDataStore when fetch fails | PriceAPILayer already specifies fallback path; this ADR adds no new fallback logic |
| price-api-layer.md | 5-min TTL cache prevents rate limit hammering | TTL means ~20-60 total requests/session — within CSFloat's unauthenticated limit |

## Performance Implications
- **CPU**: Single `fetch()` call per item per 5 minutes; async/non-blocking; no main-thread impact
- **Memory**: One response object per fetch, immediately parsed and discarded
- **Load Time**: No impact — PriceAPILayer fetches lazily on first `getPrice()` call; not at page load
- **Network**: ~20-60 fetch requests per session; ~1KB per response; negligible bandwidth

## Migration Plan
**MVP → Vertical Slice transition:**
1. Verify CSFloat CORS (manual browser test before VS sprint)
2. If CORS passes: set `.env.production` to direct CSFloat URL; no other work needed
3. If CORS fails: implement `netlify/functions/price-proxy.js` and deploy to Netlify; set `.env.production` to `/.netlify/functions/price-proxy`
4. Write `src/feature/price-api-layer.js` using this ADR's fetch pattern
5. Retrofit Case Browser UI to call `PriceAPILayer.getPrice(caseId)` instead of `CaseDataStore.getCase(caseId).market_price` (GDD OQ-3)

## Validation Criteria
- `PriceAPILayer.getPrice("Recoil Case")` returns `{ price: [number], status: 'live', timestamp: [ms] }` with a positive price
- `PriceAPILayer.getPrice("unknown_item_xyz")` returns `{ price: 0.01, status: 'fallback', timestamp: 0 }` without throwing
- A second `getPrice()` call within 5 minutes returns `status: 'live'` from cache (no new fetch)
- A second `getPrice()` call after 5 minutes returns `status: 'stale'` and triggers a background fetch
- `price-updated` CustomEvent on `document` fires after a successful background fetch with `{ itemId, price, source: 'csfloat' }`
- All fetch calls use the `VITE_PRICE_API_BASE` env var — no hardcoded API URL in `price-api-layer.js`

## Related Decisions
- ADR-0001: Vite dev proxy at `/api/price` — dev CORS solved regardless of production strategy
- ADR-0003: `price-updated` event fires on `document` (not `window`) using `Events.PRICE_UPDATED`
- ADR-0005: PriceAPILayer uses `Persistence.save('price_' + itemId, price)` for localStorage cache
- price-api-layer.md: GDD behavioral contract this ADR implements
