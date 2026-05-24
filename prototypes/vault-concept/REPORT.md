# Concept Prototype Report: The Vault — CS2 Case Opening Simulator

> **Date**: 2026-05-18
> **Prototype Path**: HTML
> **Concept File**: design/gdd/game-concept.md

---

## Hypothesis

If a player clicks to open a CS2 case and sees an authentic reel animation with
matching sounds, they will feel satisfied enough to open 3+ cases unprompted —
evidenced by the player continuing to open without being prompted to do so.

---

## Riskiest Assumption Tested

That the reel animation + sound alone carry the satisfaction without real money
stakes. Confirmed — the "one more open" loop engaged naturally without financial
tension.

---

## Approach

Built a single self-contained `prototype.html` with: Recoil Case item pool, a
CS2-style horizontal reel using requestAnimationFrame + ease-out-quint easing
(~7.8 s spin), synthesized tick sounds via Web Audio API that fade as the reel
slows, and a rarity-colored reveal overlay. 50 virtual keys provided upfront.

**Path chosen:** HTML
**Reason for path:** The browser is the production platform — HTML results are
accurate, not distorted by engine vs. browser feel differences.

**Shortcuts taken (intentional):**
- No skin images (colored card backgrounds only)
- Synthesized audio (not authentic CS2 sounds)
- Single case only (Recoil Case)
- No virtual key economy / drip — flat 50 keys upfront
- No inventory or session history
- No mobile layout

---

## Result

- **Hypothesis CONFIRMED.** Player kept opening without prompting — the "one more"
  loop engaged immediately.
- **Reveal popup delay too long.** After the reel decelerates and stops, the pause
  before showing the reveal overlay felt too long. Needs to be tightened.
- **Wrong rarity tiers in item pool.** CS2 cases do not contain Consumer Grade
  (grey) or Industrial Grade (light blue) items — those only come from play drops.
  Regular cases only go from Mil-Spec (blue) through Rare Special Item (gold).
  Souvenir packages go blue through red but no gold/knife tier. Item pool must be
  corrected before production.
- **No images.** Acceptable for prototype validation; will need real skin images
  (Steam CDN) in production.
- **Core animation timing felt right.** No complaints about the speed, easing, or
  sound timing — the reel itself was validated.

---

## Metrics

| Metric | Value |
|--------|-------|
| Path used | HTML |
| Iterations to playable | N/A (single output) |
| Prototype duration | ~1 session |
| Playtesters | 1 internal |
| Feel assessment | Reel speed and easing felt authentic; reveal delay ~300ms too long |
| Hypothesis verdict | CONFIRMED |

---

## Recommendation: PROCEED

The core loop works. Opening a case produces the "one more" pull response without
any real money stakes, validating the central assumption of the concept. The two
correctible issues found (reveal timing, rarity tiers) are data/timing bugs, not
design problems — they don't challenge the concept itself and will be fixed in
production implementation.

---

## If Proceeding

**Core tuning values discovered:**
- Reel duration of ~7.8 s felt correct (no feedback suggesting it was too long or short)
- Reveal popup delay should be tightened to ~150 ms after reel stop (current 420 ms felt sluggish)
- Ease-out-quint easing validated — start blazing fast, long tail of deceleration

**Assumptions confirmed:**
- "One more open" psychology works without financial stakes when presentation is authentic
- Sound + animation together carry the dopamine trigger; neither alone was tested but both felt necessary

**Assumptions disproved / corrected:**
- Item pool for cases is blue→gold ONLY (no consumer grey or industrial blue)
- Souvenir packages have their own separate rarity structure (blue→red, no gold)
- These distinctions matter to players — surfaced immediately by a CS2 player

**Emergent findings:**
- The absence of skin images was noticed immediately but not blocking for the loop feel — images are important for production but not for the core mechanic validation
- The rarity sound differentiation (higher pitch = rarer) was not explicitly noticed but did not create confusion either

**What to carry into GDDs:**
- Reel: ease-out-quint, ~7–8 s duration, slight random stop offset (±20–40 px)
- Reveal delay: target 150 ms post-stop
- Rarity system: cases = Mil-Spec / Restricted / Classified / Covert / Rare Special only
- Audio: tick volume must fade proportionally to reel speed (not fixed volume)

**Next steps:**
1. Fix prototype: correct rarity tiers, tighten reveal delay
2. `/map-systems` — decompose into implementable systems
3. `/design-system reel-engine` — GDD for the core reel mechanic
4. `/art-bible` — formalize visual identity before UI build
5. `/gate-check` — validate readiness to advance to Systems Design

---

## Lessons Learned

- **What assumptions were broken by actually building this?**
  CS2's rarity system for cases vs. drops vs. souvenirs is more distinct than
  assumed — must treat each case type as a separate data schema.

- **What surprised us that didn't show up in the brainstorm?**
  Players notice incorrect rarity tiers immediately. Data accuracy is as important
  to authenticity as animation fidelity.

- **What would we test differently next time?**
  Include at least one real skin image per card, even placeholder-quality, to test
  whether visual fidelity changes the satisfaction loop.

---

> *Prototype code location: `prototypes/vault-concept/`*
> *This code is throwaway. Never refactor into production.*
