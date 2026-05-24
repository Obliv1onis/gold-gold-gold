# ADR-0001: Web Stack and Module System

## Status
Proposed

## Date
2026-05-21

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Browser (HTML / CSS / JavaScript) |
| **Domain** | Core / Web Platform |
| **Knowledge Risk** | LOW — all APIs are stable, pre-training-data |
| **References Consulted** | Browser platform APIs (Godot engine-reference is not applicable to this project) |
| **Post-Cutoff APIs Used** | None |
| **Verification Required** | Confirm Vite 6.x and Vitest 3.x build/test pipeline runs on target dev machines before first sprint |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | None |
| **Enables** | ADR-0002 (file structure), ADR-0003 (event architecture), ADR-0004 (audio), ADR-0005 (persistence), ADR-0006 (animation loop), ADR-0007 (image loading), ADR-0008 (Price API), ADR-0009 (test framework) |
| **Blocks** | All 17 modules — no source file may be written until this ADR is Accepted |
| **Ordering Note** | This is the root decision. Every other Technical Setup ADR depends on the module system being settled first. |

## Context

### Problem Statement
The Vault is a browser-based JavaScript application with 17 modules across 5 architecture layers. Before any source file is written, we need a settled strategy for how modules are loaded, how npm packages are consumed, how the dev server works, and which test runner integrates with the project. Getting this wrong means rewiring import paths and test config across all 17 modules mid-sprint.

### Constraints
- game-concept.md already anticipates npm packages: "GSAP or CSS custom easing; Audio: Howler.js or Web Audio API" — any approach must support npm dependencies
- The Price API Layer (ADR-0008) will need a CORS proxy or pass-through during local development
- The test framework (ADR-0009) must run the same module syntax as the source — no transpilation mismatch
- Target: runs in modern desktop browsers (Chrome, Firefox, Edge, Safari) — no legacy targets

### Requirements
- Must support ES module syntax (`import`/`export`) throughout source files
- Must support npm packages (Howler.js, GSAP, or equivalents)
- Must provide a local dev server with fast reload
- Must produce a production build suitable for static hosting
- Must integrate naturally with the chosen test framework (ADR-0009)

## Decision

**Use Vite as the build tool and dev server.**

- **Module syntax**: ES modules throughout all source files
- **Dev server**: `vite` (HMR, `localhost:5173` default)
- **Production build**: `vite build` → `dist/` (bundled + minified)
- **Entry point**: `index.html` at project root with `<script type="module" src="/src/main.js">`
- **Package manager**: npm (lock file committed)
- **Test runner**: Vitest (natural Vite companion — see ADR-0009; shares `vite.config.js`, no duplicate config)
- **CORS proxy (dev only)**: Vite's built-in `server.proxy` in `vite.config.js` forwards `/api/*` to the price API origin, enabling Price API development without a separate proxy process

### Architecture Diagram

```
index.html
  └── <script type="module" src="/src/main.js">
        src/main.js  (entry — imports and initialises all layers)
        ├── src/foundation/
        │     case-data-store.js
        │     audio-system.js
        │     persistence.js
        ├── src/core/
        │     drop-rate-engine.js
        │     reel-animation-engine.js
        │     virtual-economy.js
        │     case-inventory.js
        │     skin-inventory.js
        ├── src/feature/
        │     case-opening-orchestrator.js
        │     skin-image-loader.js
        │     price-api-layer.js
        └── src/presentation/
              hud-app-shell.js
              reel-ui.js
              reveal-ui.js
              inventory-ui.js
              case-browser-ui.js
              market-browser-ui.js
```

(Final subdirectory names settled in ADR-0002)

### Key Interfaces

```js
// vite.config.js (minimal)
export default {
  server: {
    proxy: {
      '/api': { target: 'https://[price-api-origin]', changeOrigin: true }
    }
  }
}

// package.json scripts
"scripts": {
  "dev":        "vite",
  "build":      "vite build",
  "test":       "vitest run",
  "test:watch": "vitest"
}
```

## Alternatives Considered

### Alternative A: Native ES Modules (no build tool)
- **Description**: Each module loaded via `<script type="module">` or bare relative imports. File server only (`npx serve`). No bundling.
- **Pros**: Zero config. No build step. Fastest possible setup.
- **Cons**: npm packages require CDN imports (`esm.sh`) or manual copying — no `node_modules`. No HMR. No bundling → 17+ HTTP requests per page load in production. No native dev CORS proxy. Test runner must support browser-native modules (more complex setup).
- **Rejection Reason**: game-concept.md already anticipates Howler.js and GSAP as npm packages. Eliminating npm support means CDN-only dependencies (version lock risk) or manual vendor copies. The CORS proxy advantage is significant for ADR-0008.

### Alternative B: Rollup
- **Description**: Module bundler focused on library output. Requires manual dev server and test runner plugins.
- **Pros**: Best tree-shaking in the industry. Excellent for library builds.
- **Cons**: Not designed as an app dev server — requires additional plugins for HMR. Vitest is a Vite companion, not a Rollup companion. More config overhead for an app use case.
- **Rejection Reason**: App-dev ergonomics (dev server + HMR + test runner) are the primary need. Rollup excels at library output, which is not this project's target.

### Alternative C: Webpack 5
- **Description**: Mature, full-featured bundler with extensive plugin ecosystem.
- **Pros**: Industry standard. Every edge case solved. Huge community.
- **Cons**: Significantly more config overhead than Vite. Slower cold start and HMR (Vite uses native ES modules in dev — no compile step). Jest is the natural companion (separate config, unlike Vitest/Vite). Overkill for a 17-module single-page web app.
- **Rejection Reason**: Config complexity and slower DX relative to Vite for this project's scope.

## Consequences

### Positive
- Single `vite.config.js` serves both build and Vitest test config — no duplication (ADR-0009)
- HMR in development: module-level changes hot-reload without full page refresh
- npm packages fully supported (Howler.js, GSAP, etc. — resolved in ADR-0004, ADR-0006)
- Vite's `server.proxy` handles CORS in dev without a separate proxy server (ADR-0008)
- Production `dist/` is a static folder deployable to any CDN or GitHub Pages

### Negative
- Adds a build step: `npm run build` required before production deployment
- Node.js must be installed on all developer machines

### Risks
- **Vite major version**: Vite 6 was current at authoring time. Future major versions may introduce breaking config changes. Mitigation: pin `"vite": "^6.x"` in `package.json`.
- **Vitest DOM support**: DOM-dependent modules (ReelUI, HUD) require `environment: 'jsdom'` or `happy-dom` in Vitest config. Mitigation: documented in ADR-0009.

## GDD Requirements Addressed

| GDD System | Requirement | How This ADR Addresses It |
|------------|-------------|--------------------------|
| All 17 systems | Each GDD describes a named module that other modules import | ES module syntax + Vite resolves named imports across all 17 modules |
| game-concept.md | "GSAP or CSS custom easing; Audio: Howler.js or Web Audio API" | npm package support confirmed — both installable via `npm install` |
| price-api-layer.md | OQ-2: CORS solution needed for local development | Vite `server.proxy` provides a dev-only CORS bypass (ADR-0008 locks the production strategy) |

## Performance Implications
- **CPU**: None at runtime — Vite output is standard bundled JS
- **Memory**: None — bundle size is determined by application code, not the module system
- **Load Time**: Production bundle reduces 17+ HTTP requests to 1–2 JS files
- **Network**: `vite build` produces gzip-friendly ESM output; suitable for CDN delivery

## Migration Plan
No existing source code — greenfield. `package.json` and `vite.config.js` are the first files written.

## Validation Criteria
- `npm run dev` starts a dev server at `localhost:5173`
- `npm run build` produces a `dist/` directory with `index.html` and bundled assets
- `npm test` runs Vitest and exits with code 0 on an empty test suite
- Importing a module from `src/foundation/` in `src/main.js` resolves without errors

## Related Decisions
- ADR-0002: Module file structure and naming conventions (depends on this ADR)
- ADR-0008: Price API and CORS solution (dev proxy defined here; production strategy there)
- ADR-0009: Test framework and CI setup (Vitest — natural companion to this decision)
