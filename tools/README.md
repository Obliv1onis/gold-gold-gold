# Data maintenance

The JSON files in `public/data/` are runtime assets. Treat them as generated
catalogues rather than hand-editing large item pools.

## Canonical workflow

1. Download the current `crates.json` from the upstream CS2 catalogue.
2. Run both catalogue syncs:

   ```bash
   npm run data:sync:cases -- --source /path/to/crates.json --write
   npm run data:sync:containers -- --source /path/to/crates.json --write
   ```
3. Run `npm run data:audit`, `npm test`, and `npm run build`.
4. Run `npm run docs:reference` to regenerate every Markdown catalogue under
   `design/reference/` from the validated runtime data.

Use `npm run docs:reference:check` in review or CI to fail when those generated
documents no longer match the JSON catalogues.

`tools/catalog/sync-cases.mjs` updates container names, images, and normal skin
pools while retaining local prices and the project's compact legacy
rare-special pools. It imports full rare-special data for newly supported
containers such as Gallery Case and Dead Hand Terminal.

`tools/catalog/sync-containers.mjs` refreshes sticker contents, rebuilds the
souvenir catalogue, and synchronizes music boxes, patch collections, and pin
capsules. Local prices and stable IDs are retained when a source container can
be matched. Cologne 2026 is deliberately excluded because Valve replaced
traditional capsules/packages with direct sticker purchases and crafted
souvenirs for that event.

## Legacy scripts

The Python files at the root of `tools/` document earlier one-off imports and
price/image patches. They are retained for provenance, but new catalogue work
should use the scripts in `tools/catalog/` so updates stay repeatable.
