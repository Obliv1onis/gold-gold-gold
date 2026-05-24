import { CaseDataStore }           from './foundation/case-data-store.js';
import { AudioSystem }             from './core/audio-system.js';
import { CaseOpeningOrchestrator } from './core/case-opening-orchestrator.js';
import { HudAppShell }             from './presentation/hud-app-shell.js';
import { CaseBrowserUI }           from './presentation/case-browser-ui.js';
import { ReelUI }                  from './presentation/reel-ui.js';
import { RevealUI }                from './presentation/reveal-ui.js';
import { InventoryUI }             from './presentation/inventory-ui.js';
import { MarketUI }                from './presentation/market-ui.js';

async function main() {
  const appEl = document.getElementById('app');

  // 1. Fetch and validate case data
  await CaseDataStore.init('/data/cases.json');

  // 2. Web Audio — context resumed on first user gesture
  AudioSystem.init();
  document.addEventListener('click', () => AudioSystem.resume(), { once: true });

  // 3. Build layout; wire Open button → Orchestrator
  const { caseBrowserContainer, reelContainer, overlayContainer, marketContainer, inventoryContainer } =
    HudAppShell.init(appEl, {
      onShowInventory: () => InventoryUI.show(),
      onHideInventory: () => InventoryUI.hide(),
      onShowMarket:    () => MarketUI.show(),
      onHideMarket:    () => MarketUI.hide(),
      onOpenClick: (caseId, casePrice) => {
        CaseOpeningOrchestrator.open(caseId, casePrice, ReelUI.viewportWidth, {
          onFrame:   (offset, strip) => ReelUI.render(offset, strip),
          onReveal:  (entry)         => RevealUI.show(entry),
          onBlocked: (reason)        => HudAppShell.onBlocked(reason),
          onReady:   ()              => { ReelUI.resetSpin(); HudAppShell.onReady(); },
        });
      },
    });

  // 4. Case browser — shown on startup
  CaseBrowserUI.init(caseBrowserContainer, {
    onSelect: async (caseId, casePrice) => {
      HudAppShell.showCaseOpening(caseId, casePrice);
      await ReelUI.initialize(reelContainer, caseId);
    },
  });

  // 5. Reveal overlay, market, and inventory
  RevealUI.init(overlayContainer, () => HudAppShell.onRevealDismissed());
  MarketUI.init(marketContainer);
  InventoryUI.init(inventoryContainer);
}

main().catch(err => {
  console.error('[The Vault] Boot failed:', err);
  document.getElementById('app').textContent = 'Failed to load. Please refresh.';
});
