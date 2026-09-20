# The Vault — CS2 Case Simulator

A bilingual, browser-based Counter-Strike 2 case-opening simulator built with
vanilla JavaScript and Vite.

## What is included

- 42 weapon cases and 2 terminals, including Gallery, Genesis, and Dead Hand
- 150 souvenir packages, 122 sticker capsules, and 26 other cosmetic containers
- Case reels, terminal offers, inventory, market, trade-up, live price fallbacks,
  daily bonuses, StatTrak™ items, wear, and float simulation
- English and Simplified Chinese UI
- Search and sorting for large container catalogues

## Development

```bash
npm install
npm run dev
```

Quality checks:

```bash
npm run data:audit
npm run docs:reference:check
npm test
npm run build
```

The application is split by responsibility under `src/`:

- `foundation/` — data stores, persistence, float generation, and i18n
- `core/` — economy and opening/trade-up rules
- `feature/` — pricing, images, audio-adjacent features, and bonuses
- `presentation/` — DOM rendering and user interaction

## Updating the catalogue

Case data is generated rather than maintained by hand. See
[`tools/README.md`](tools/README.md) for the repeatable sync and audit workflow.
The catalogue is cross-checked against
[ByMykel/CSGO-API](https://github.com/ByMykel/CSGO-API), with recent release
details verified against official Counter-Strike announcements.

## Disclaimer

Counter-Strike, CS2, item names, and imagery are property of Valve.
This is an independent simulator and is not affiliated with or endorsed by
Valve. It does not award real items or involve real-money transactions.

Released under the [MIT License](LICENSE).
