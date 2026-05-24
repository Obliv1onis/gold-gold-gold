# Game Concept: The Vault — CS2 Economy Simulator

*Created: 2026-05-18*
*Status: Draft — Updated 2026-05-19 (economy pivot)*

---

## Elevator Pitch

> A CS2 economy simulator for the web — every case ever released at real market
> prices, live skin prices from the Steam Market, a $2,000 virtual budget to start,
> and a full buy/sell inventory. Open cases hoping for profit. Buy skins directly.
> Trade your way up. No real wallet required.

---

## Core Identity

| Aspect | Detail |
| ---- | ---- |
| **Genre** | Simulator / Fan project |
| **Platform** | Web / Browser |
| **Target Audience** | CS2 players who love the item economy but want to open without real money |
| **Player Count** | Single-player |
| **Session Length** | 5–30 minutes (open until satisfied) |
| **Monetization** | None — free fan project |
| **Estimated Scope** | Small–Medium (2–3 weeks MVP, 6–10 weeks full vision) |
| **Comparable Titles** | CSGOEmpire case simulator, case-clicker fan sites |

---

## Core Fantasy

You have $2,000 in the CS2 economy. Every case is priced at its real Steam Market
value. Every key costs $2.49. Every skin you pull from a case — or buy directly from
the market — can be sold back at live market prices. The fantasy is twofold: the
dopamine hit of the case opening moment, and the meta-game of whether you can beat
the odds. Open cases chasing value. Buy skins you think will rise. Sell strategically.
See if you can grow your virtual bankroll. No real wallet required.

---

## Unique Hook

Like CS2 case opening AND ALSO a simulated trading economy — every case and skin
priced at real market rates, a $2,000 starting budget, and the full buy/sell loop.
You can play as a case opener, a skin trader, or both.

---

## Visual Identity Anchor

**Direction: CS2 Dark Arsenal**

*Visual rule*: Every pixel should look like it was lifted from the CS2 item panel.

- **Mood**: Cinematic dark UI, high-contrast item cards, weapon skin glow on reveal
- **Shape language**: Sharp, rectangular, military-utilitarian — matching CS2's UI geometry
- **Color philosophy**: Dark background (#1b2838 Steam dark), rarity colors are exact CS2 rarity hex values (Consumer grey → Contraband gold). Rarity color IS the primary visual feedback system.
- **Animation language**: Smooth deceleration curves matching CS2's reel easing; no bouncy or cartoony motion

---

## Player Experience Analysis (MDA Framework)

### Target Aesthetics

| Aesthetic | Priority | How We Deliver It |
| ---- | ---- | ---- |
| **Sensation** (sensory pleasure) | 1 | Authentic sound design; reel animation tuned to CS2's easing; rarity-color glow on reveal |
| **Submission** (relaxation, flow) | 2 | No-stakes opening; infinite virtual supply; no failure states |
| **Discovery** (exploration) | 3 | Browsing historical cases; seeing items from cases you never opened in real life |
| **Fantasy** (make-believe) | 4 | "I have unlimited money in the CS2 economy" |
| **Expression** | 5 | Building a virtual inventory you can browse and reflect on |
| **Challenge** | N/A | Not a goal |
| **Narrative** | N/A | Not a goal |
| **Fellowship** | N/A | Not a goal |

### Key Dynamics

- Players will naturally gravitate toward cases tied to their real CS2 experience (cases during their active playing period)
- Players will chase specific skins they've always wanted, opening the same case repeatedly
- Players will browse older cases as a form of CS2 history exploration
- Players will open "just one more" due to the key drip and low friction

### Core Mechanics

1. **Case purchasing** — browse all CS2 cases at real market prices; buy to add to case inventory
2. **Case opening** — spend a case from inventory + $2.49 key to trigger the reel animation
3. **Reel animation** — CS2-accurate horizontal scroll, deceleration, and item highlight
4. **Rarity reveal** — item lands with rarity-color flash and sound sting; item added to skin inventory
5. **Direct skin purchase** — browse all CS2 skins at market prices; buy any skin directly into inventory
6. **Sell mechanic** — sell any inventory skin at current market price; balance updates immediately
7. **Live pricing** — skin and case prices fetched from Steam Market or community price API; updated periodically

---

## Player Motivation Profile

### Primary Psychological Needs Served

| Need | How This Game Satisfies It | Strength |
| ---- | ---- | ---- |
| **Autonomy** | Choose any case, open as many as you want, no gating | Supporting |
| **Competence** | Not applicable — no skill component | Minimal |
| **Relatedness** | Connects to real CS2 identity and item culture | Core |

### Player Type Appeal

- [x] **Achievers** — collecting every skin type, completing case collections — How: inventory fills over time
- [x] **Explorers** — discovering historical cases and items they've never seen — How: full case archive browsing
- [ ] **Socializers** — not served (solo experience by design)
- [ ] **Competitors** — not served (no skill or PvP element)

### Flow State Design

- **Onboarding curve**: Zero — the case is there, the button says "Open". No tutorial needed.
- **Difficulty scaling**: No difficulty. The flow state is maintained by audio/visual reward, not challenge.
- **Feedback clarity**: Rarity color flash + sound sting = immediate, unambiguous reward signal
- **Recovery from failure**: No failure state exists. Key drip ensures there's always another open available soon.

---

## Core Loop

### Moment-to-Moment (30 seconds)
Select a case → click "Open" → spend one virtual key → watch the reel spin → item reveal with rarity glow and sound → item added to inventory. Repeat.

### Short-Term (5–15 minutes)
Open multiple cases in one sitting. Earn keys passively as you open. Chase a specific skin by opening the same case repeatedly. Browse inventory to see what you've accumulated.

### Session-Level (30 minutes)
Pick a case type you're feeling. Burn through your key stack. Reflect on your best pulls. No natural end point — the session ends when the player decides.

### Long-Term Progression
The virtual inventory grows over time. The long-term goal is self-defined: "collect one of every knife," "get a red from every case," "see what's in cases I never opened IRL." No explicit win state.

### Retention Hooks

- **Curiosity**: Historical cases with items the player has never seen before
- **Investment**: Growing virtual inventory they've built up over sessions
- **Mastery**: Not applicable
- **Social**: Not applicable (solo experience)

---

## Game Pillars

### Pillar 1: Faithful Over Flashy
Every UI element, sound, and animation should match the CS2 source as closely as
possible. When we debate between "cooler" and "authentic," we choose authentic.

*Design test*: If debating between a custom reel animation and CS2's exact reel
behavior — choose CS2's.

### Pillar 2: Zero Friction
The path from "I want to open a case" to "the item is revealed" must be as short
as possible. No mandatory menus, no loading gates, no upsells.

*Design test*: If debating adding a step to the opening flow, ask "does this make
opening *feel better*?" If not, cut it.

### Pillar 3: Every Case Counts
All CS2 cases that have ever been released must be present. Completeness is part
of the fantasy. No cherry-picking popular ones.

*Design test*: If debating whether to include an older, obscure case — include it.

### Pillar 4: Sound Is Sacred
The audio must match CS2 as closely as possible. The click, the reel, the reveal
sting — these are the dopamine triggers. Wrong audio = failed simulator.

*Design test*: If debating cutting a sound effect for development speed — keep it
and cut something else instead.

### Anti-Pillars

- **NOT a real-money platform** — no real-money transactions, no real wallet integration, no payment processing; all money is virtual and starts at $2,000
- **NOT a dark-pattern machine** — no manufactured "near miss" manipulation beyond what CS2's own design already contains; no artificial scarcity or timed pressure
- **NOT original content** — no invented cases, skins, prices, or items that don't exist in the real CS2; all prices, drop rates, and item data mirror real CS2 faithfully

---

## Inspiration and References

| Reference | What We Take From It | What We Do Differently | Why It Matters |
| ---- | ---- | ---- | ---- |
| CS2 (in-game case opening) | Exact UI layout, reel animation, sound design, rarity colors | No real money, virtual economy | The source of truth for fidelity |
| EA FC Ultimate Team pack opening | Pack reveal pacing, anticipation build | Not sports-themed, no duplicates mechanic | Confirms "reveal pacing" as a proven dopamine system |
| Existing case simulators (CSGOEmpire, etc.) | Proves audience appetite | Full case archive + authentic sounds — most existing sims cut corners here | Market validation |

**Non-game inspirations**: ASMR unboxing videos; the psychological literature on variable reward schedules (Skinner box, slot machine design); CS2 community wikis and item databases.

---

## Target Player Profile

| Attribute | Detail |
| ---- | ---- |
| **Age range** | 16–28 |
| **Gaming experience** | Mid-core to hardcore — active or lapsed CS2 players |
| **Time availability** | 5–30 minute sessions; background / wind-down activity |
| **Platform preference** | PC browser (primary), mobile browser (secondary) |
| **Current games they play** | CS2, FC/FIFA, Valorant |
| **What they're looking for** | The case opening experience without the real-money cost |
| **What would turn them away** | Ads, real-money prompts, dark patterns, laggy animation, wrong sounds |

---

## Technical Considerations

| Consideration | Assessment |
| ---- | ---- |
| **Stack** | HTML + CSS + JavaScript; React optional for UI state management |
| **Animation** | GSAP or CSS custom easing for reel; must match CS2 deceleration curve exactly |
| **Audio** | Howler.js or Web Audio API; sound timing is critical — must sync to animation frame |
| **Case data** | Community CS2 databases (JSON); all cases, items, rarities, and odds are documented |
| **Skin images** | Steam CDN — skin images linkable directly via community API |
| **Price data (MVP)** | Hardcoded approximate prices in cases.json; updated manually |
| **Price data (post-MVP)** | Live API: Steam Community Market API, CSFloat API, or Skinport API; CORS proxy may be required for browser access |
| **Economy persistence** | localStorage for MVP; stores balance, case inventory, skin inventory |
| **Deployment** | GitHub Pages / Vercel / Netlify — free, zero-config |
| **Art Style** | CS2 dark UI — exact rarity color hex values, dark background, sharp geometry |
| **Audio Needs** | Sound-critical — reel spin, reveal sting, rarity-specific cues |
| **Networking** | None for MVP; price API calls added in Vertical Slice |
| **Content Volume** | MVP: ~10 cases; Full: ~100+ cases, all skins directly purchasable |
| **Procedural Systems** | Weighted random — item pull follows CS2 rarity odds |

---

## Risks and Open Questions

### Design Risks
- **No-stakes tension**: The thrill of case opening in CS2 partly comes from real money. Does the experience hold without it? Mitigation: authentic animation and sound carry significant weight — lean in hard on fidelity.
- **Session depth**: With no win state or long-term goals, players may find sessions shallow. Mitigation: virtual key drip creates a small "next open" carrot; inventory growth adds accumulation satisfaction.

### Technical Risks
- **Reel animation fidelity**: Matching CS2's exact easing curve and deceleration timing is finicky. This will likely be the most iteration-heavy piece of development.
- **Sound synchronization**: The reveal sting must land exactly on the item stop frame. Web Audio API timing is more reliable than HTML5 `<audio>` for this.
- **Case data accuracy**: Community odds are estimates — Valve has never officially published drop rates. The community consensus odds are the best available source.

### Market Risks
- **IP / Legal**: Using CS2 skin names and images is technically Valve IP. Fan/non-commercial projects in this space have historically been tolerated, but there is no guarantee. Keep the project non-commercial and credit the source.
- **Existing competition**: Several case simulators already exist. Differentiator is completeness (all cases) and fidelity (authentic sounds and animation).

### Scope Risks
- **Content volume**: 100+ cases × all items per case is a significant data entry task. Community JSON databases reduce this, but data validation is still required.
- **Audio rights**: CS2 sound files are extracted by the community; using them directly in a fan project is tolerated but not licensed.

### Open Questions
- Which community case database is most complete and up-to-date? (Answer: investigate cs2inspect.net, GitHub community repos)
- Can Steam CDN skin images be hot-linked reliably, or do we need to mirror them?
- What is CS2's exact reel easing function? (Answer: capture via video frame analysis or community reverse-engineering)

---

## MVP Definition

**Core hypothesis**: Players find the CS2 economy simulation engaging when prices are authentic and the case opening presentation matches CS2 fidelity.

**Required for MVP**:
1. $2,000 virtual starting balance (displayed in dollars)
2. At least 10 popular CS2 cases with correct items, rarity distribution, and approximate market prices
3. Case purchasing: buy cases at market price; case inventory stores owned cases
4. Case opening: spend one owned case + $2.49 key; triggers reel animation
5. CS2-accurate reel animation (horizontal scroll, deceleration, item highlight box)
6. Authentic sound effects (reel spin, reveal sting, rarity-specific audio cues)
7. Skin inventory: stores all items received from case opens
8. Sell mechanic: sell any inventory item at current market price; balance updates
9. Approximate hardcoded prices for MVP (live API integration in Vertical Slice)

**Explicitly NOT in MVP**:
- All 100+ cases (post-MVP content expansion)
- Direct skin purchase (browse and buy skins without opening cases) — post-MVP
- Live price API (prices are hardcoded approximations in MVP)
- Float/wear value system
- StatTrak counter simulation
- Mobile-optimized layout
- Sticker capsule opening

### Scope Tiers

| Tier | Content | Features | Timeline |
| ---- | ---- | ---- | ---- |
| **MVP** | 10 popular cases, hardcoded prices | $2,000 start, buy case, reel animation, sell items, skin inventory | 3–4 weeks |
| **Vertical Slice** | 25 cases, live price API | Direct skin purchase, market browser, case browser, odds display | 5–7 weeks |
| **Alpha** | All cases (~100+), live prices | Full inventory UI, portfolio view, price history | 8–12 weeks |
| **Full Vision** | All cases + sticker capsules, all skins | Float system, StatTrak, inspect viewer, mobile layout, price charts | 4+ months, solo |

---

## Next Steps

- [ ] Run `/setup-engine` — but note: this is a **web app**, not a game engine project. Skip engine setup; use HTML/CSS/JS stack instead.
- [ ] Run `/art-bible` to formalize the CS2 Dark Arsenal visual identity before building UI
- [ ] Run `/design-review design/gdd/game-concept.md` to validate concept completeness
- [ ] Run `/map-systems` to decompose into implementable systems (reel engine, case data, audio, inventory, economy)
- [ ] Run `/prototype` — build the reel animation and one case as a throwaway spike to validate the feel
- [ ] Research community case databases and confirm data source
- [ ] Investigate CS2 reel easing curve (frame analysis or community documentation)
