import { CaseDataStore }           from './foundation/case-data-store.js';
import { CapsuleDataStore }        from './foundation/capsule-data-store.js';
import { SkinInventory }           from './core/skin-inventory.js';
import { AudioSystem }             from './core/audio-system.js';
import { CaseOpeningOrchestrator }    from './core/case-opening-orchestrator.js';
import { CapsuleOpeningOrchestrator } from './core/capsule-opening-orchestrator.js';
import { HudAppShell }             from './presentation/hud-app-shell.js';
import { CaseBrowserUI }           from './presentation/case-browser-ui.js';
import { CapsuleBrowserUI }        from './presentation/capsule-browser-ui.js';
import { ReelUI }                  from './presentation/reel-ui.js';
import { CapsuleReelUI }           from './presentation/capsule-reel-ui.js';
import { RevealUI }                from './presentation/reveal-ui.js';
import { CapsuleRevealUI }         from './presentation/capsule-reveal-ui.js';
import { InventoryUI }             from './presentation/inventory-ui.js';
import { MarketUI }                from './presentation/market-ui.js';
import { PriceAPILayer }          from './feature/price-api-layer.js';
import { TradeUpUI }               from './presentation/trade-up-ui.js';

async function main() {
  const appEl = document.getElementById('app');

  // 1. Fetch and validate case + capsule data
  await CaseDataStore.init('/data/cases.json');
  await CapsuleDataStore.init('/data/capsules.json', '/data/others.json');
  SkinInventory.migrateMissingCaseIds(id => CaseDataStore.findCaseForItem(id));

  // 2. Web Audio — context resumed on first user gesture
  AudioSystem.init();
  document.addEventListener('click', () => AudioSystem.resume(), { once: true });

  // 3. Build layout; wire Open button → Orchestrator
  const allWeaponCases  = CaseDataStore.getCaseList('weapon_case');
  const allSouvenirs    = CaseDataStore.getCaseList('souvenir_package');
  const allCapsules     = CapsuleDataStore.getCapsuleList('sticker_capsule');
  const allOthers       = CapsuleDataStore.getCapsuleList(['charm_capsule', 'patch_pack', 'pin_capsule', 'music_kit_box']);
  const heroCase        = [...allWeaponCases].reverse().find(c => c.image_url);
  const heroSouvenir    = [...allSouvenirs].reverse().find(s => s.image_url);
  const heroCapsule     = [...allCapsules].reverse().find(c => c.image_url);
  const heroOther       = allOthers.find(c => c.image_url);

  const categories = [
    { id: 'weapon_case',      title: 'Weapon Cases',      subtitle: `${allWeaponCases.length} Cases`,       image: heroCase?.image_url },
    { id: 'souvenir_package', title: 'Souvenir Packages', subtitle: `${allSouvenirs.length} Packages`,      image: heroSouvenir?.image_url },
    { id: 'sticker_capsule',  title: 'Sticker Capsules',  subtitle: `${allCapsules.length} Capsules`,       image: heroCapsule?.image_url },
    { id: 'other',            title: 'Others',             subtitle: `${allOthers.length} Containers`,      image: heroOther?.image_url },
  ];

  const { caseBrowserContainer, reelContainer, overlayContainer, marketContainer, tradeUpContainer, inventoryContainer } =
    HudAppShell.init(appEl, {
      categories,
      onShowBrowser: (filter) => {
        if (filter === 'sticker_capsule') CapsuleBrowserUI.show('sticker_capsule');
        else if (filter === 'other')      CapsuleBrowserUI.show('other');
        else                              CaseBrowserUI.show(filter);
      },
      onHideBrowser:   () => { CaseBrowserUI.hide(); CapsuleBrowserUI.hide(); },
      onShowInventory: () => InventoryUI.show(),
      onHideInventory: () => InventoryUI.hide(),
      onShowMarket:    () => MarketUI.show(),
      onHideMarket:    () => MarketUI.hide(),
      onShowTradeUp:   () => TradeUpUI.show(),
      onHideTradeUp:   () => TradeUpUI.hide(),
      onOpenClick: (itemId, price, category) => {
        if (category === 'sticker_capsule' || category === 'other') {
          CapsuleOpeningOrchestrator.open(itemId, price, CapsuleReelUI.viewportWidth, {
            onFrame:   (offset, strip) => CapsuleReelUI.render(offset, strip),
            onReveal:  (entry)         => CapsuleRevealUI.show(entry),
            onBlocked: (reason)        => HudAppShell.onBlocked(reason),
            onReady:   ()              => { CapsuleReelUI.resetSpin(); HudAppShell.onReady(); },
          });
        } else {
          CaseOpeningOrchestrator.open(itemId, price, ReelUI.viewportWidth, {
            onFrame:   (offset, strip) => ReelUI.render(offset, strip),
            onReveal:  (entry)         => RevealUI.show(entry),
            onBlocked: (reason)        => HudAppShell.onBlocked(reason),
            onReady:   ()              => { ReelUI.resetSpin(); HudAppShell.onReady(); },
          });
        }
      },
    });

  // 4. Case + capsule browsers share the same container
  CaseBrowserUI.init(caseBrowserContainer, {
    onSelect: async (caseId, casePrice) => {
      HudAppShell.showCaseOpening(caseId, casePrice);
      await ReelUI.initialize(reelContainer, caseId);
    },
  });

  CapsuleBrowserUI.init(caseBrowserContainer, {
    onSelect: (capsuleId, capsulePrice) => {
      HudAppShell.showCaseOpening(capsuleId, capsulePrice);
      CapsuleReelUI.initialize(reelContainer, capsuleId);
    },
  });

  // 5. Start price bulk-load in background immediately (warms cache before market opens)
  PriceAPILayer.warmup();

  // 6. Reveal overlays, market, and inventory
  RevealUI.init(overlayContainer, () => HudAppShell.onRevealDismissed());
  CapsuleRevealUI.init(overlayContainer, () => HudAppShell.onReady());
  MarketUI.init(marketContainer);
  TradeUpUI.init(tradeUpContainer);
  InventoryUI.init(inventoryContainer);
}

main().catch(err => {
  console.error('[The Vault] Boot failed:', err);
  document.getElementById('app').textContent = 'Failed to load. Please refresh.';
});
