# Audio System

> **Status**: In Design
> **Author**: User + Claude Code
> **Last Updated**: 2026-05-19
> **Implements Pillar**: Sound Is Sacred · Faithful Over Flashy

## Overview

The Audio System is the sound synthesis layer for the simulator — a wrapper around
the browser's Web Audio API that produces all sound effects in code, with no audio
files loaded or distributed. From the player's perspective, the system is invisible
but unmissable: the rhythmic tick as the reel scrolls, the quickening cadence as it
decelerates, and the impact chord when the item locks are the primary dopamine
triggers in the simulator. These three sounds are not decorative — they are the
reward signal that makes one open feel like ten.

The system exposes a set of named playback events (`reel.tick`, `reel.reveal`) that
upstream systems fire without knowing how synthesis works. Timing precision is the
core constraint: tick sounds must be scheduled against `AudioContext.currentTime` —
the browser's sample-accurate audio clock — not against JavaScript timers, so audio
stays synchronized with reel animation frame by frame. The system also handles the
browser autoplay policy transparently: `AudioContext` starts in a suspended state
and is resumed on the first user interaction before any sound can play.

**MVP scope**: Synthesized sounds only (oscillator + gain envelope). Authentic CS2
audio files are explicitly cut from MVP. The "Sound Is Sacred" pillar defines
success — a knowledgeable CS2 player should hear the tick pattern and immediately
recognize it as the case opening sound.

## Player Fantasy

The Audio System has no menus, no controls, no player-facing surface. Its entire
output is the three-part audio sequence every CS2 player has heard hundreds of
times: the rhythmic tick as items pass center, the quickening cadence as the reel
decelerates, and the weighted impact chord when the item locks. For a player who
has opened real CS2 cases, these sounds carry a Pavlovian charge — hearing them
triggers the same anticipation as the real thing.

The system succeeds when a player closes their eyes during a reel spin and cannot
distinguish the simulator from the game. It fails the moment the sound feels "off"
— too musical, too harsh, too fast — and breaks the illusion that they're in the
real CS2 case opening UI.

The specific moment the Audio System must nail: **the escalating tick**. The reel
starts at a rhythm the brain can track. The cadence tightens. The gaps between
ticks shrink. The player leans forward, because they know what comes next. That
lean-in is the entire point. The reveal chord is the release of that tension — it
should land with enough weight that missing it would feel like pulling off a
headphone mid-note.

Pillar 4 defines the success bar directly: *"The click, the reel, the reveal sting
— these are the dopamine triggers. Wrong audio = failed simulator."*

## Detailed Design

### Core Rules

1. The `AudioContext` is created once at application startup (`init()`) and held
   for the entire session. It is never destroyed or recreated mid-session.

2. On creation, `AudioContext` is in `suspended` state — the browser's autoplay
   policy blocks audio until the user interacts with the page. The system exposes
   a `resume()` method that must be called on the first user click (any click).
   The caller (HUD / App Shell) is responsible for triggering `resume()`.

3. All sounds are synthesized at runtime using `OscillatorNode` and `GainNode`.
   No audio files are fetched, cached, or loaded. Network requests are zero.

4. Three named sound events are supported in MVP:
   - **`reel.tick`** — a short sharp click, pitch-variable, one per item crossing
     center. The caller supplies the pitch (Hz); the Audio System does not know
     reel speed or animation state.
   - **`reel.reveal`** — a multi-oscillator impact chord at fixed frequencies,
     played once when the item locks to center.
   - **`ui.click`** — a very short, low-frequency click used as feedback for
     interactive buttons (Open Case, Refill Keys).

5. If `AudioContext` is in `suspended` state when any sound method is called, the
   call is silently dropped — no error thrown, no queuing. The caller does not
   need to guard calls; silence is the correct behavior before first interaction.

6. Multiple sounds may play simultaneously without cancellation. A reveal chord
   can overlap a tick; a UI click can overlap a reveal.

7. All oscillator nodes are created fresh per-sound and disconnected when
   complete. No nodes are reused between calls. Memory from completed nodes is
   released automatically by the browser.

8. A master `GainNode` sits between all synthesis chains and the `AudioContext`
   destination. `setMasterVolume()` adjusts only this node, affecting all
   subsequent sounds proportionally.

### States and Transitions

| State | Description |
|-------|-------------|
| **Uninitialized** | `init()` not yet called; no `AudioContext` exists; all method calls throw |
| **Suspended** | `AudioContext` created; awaiting first user interaction; sound calls silently dropped |
| **Active** | `AudioContext` running; all sound methods work |
| **Closed** | `AudioContext` destroyed on page unload (terminal — no recovery) |

**Transitions:**

- `Uninitialized → Suspended`: on `init()` at application startup
- `Suspended → Active`: on `resume()` called during first user interaction
- `Active → Closed`: on page unload (browser-managed; no application logic needed)
- No path from `Closed` back to any other state

### Interactions with Other Systems

| System | Direction | What flows |
|--------|-----------|------------|
| **HUD / App Shell** | HUD → Audio | Calls `resume()` on first user click; calls `playUIClick()` on button press |
| **Case Opening Orchestrator** | Orchestrator → Audio | Calls `playTick(pitch)` on each reel tick event; calls `playReveal()` when reel stops |
| **Reveal UI** | Reveal UI → Audio | Calls `playReveal()` if reveal is triggered from the UI layer (exact caller TBD in Orchestrator GDD) |
| **Persistence** | Audio → Persistence | `setMasterVolume()` *may* write volume preference — deferred to post-MVP |
| **Case Data Store** | None | Audio System has no dependency on Case Data Store |

**Interface contract** — all methods synchronous except `resume()`:

| Method | Signature | Behavior |
|--------|-----------|----------|
| `init()` | `(): void` | Creates `AudioContext` and master `GainNode` |
| `resume()` | `(): Promise<void>` | Resumes suspended context; resolves when active |
| `playTick(pitch)` | `(pitch: number): void` | Synthesize tick at given Hz; silent if suspended |
| `playReveal()` | `(): void` | Synthesize reveal chord; silent if suspended |
| `playUIClick()` | `(): void` | Synthesize UI click; silent if suspended |
| `setMasterVolume(v)` | `(volume: number): void` | 0.0–1.0; clamps out-of-range |
| `isActive()` | `(): boolean` | Returns `true` when context state is `"running"` |

## Formulas

*(Note: `audio-director` not consulted — Lean mode. Recommend manual audio review
before production tuning.)*

### Tick Sound Synthesis

The tick sound synthesis is defined as:

`tick_gain(t) = TICK_GAIN × (1 - t/TICK_DECAY)`

A square-wave oscillator at the caller-supplied `pitch` Hz, with an instantaneous
attack and linear decay to silence.

**Parameters:**

| Parameter | Symbol | Type | Value | Description |
|-----------|--------|------|-------|-------------|
| Waveform type | — | string | `"square"` | Square wave for sharp, clicky character |
| Pitch input | `pitch` | float | 220–880 Hz | Supplied by caller; out-of-range valid but untuned |
| Attack time | — | float | 0 ms | Instantaneous onset |
| Decay time | `TICK_DECAY` | float | 30 ms | Time from peak to silence |
| Sustain | — | float | 0.0 | No sustain after decay |
| Release | — | float | 0 ms | No release phase |
| Sound duration | — | float | 30 ms | Total node lifetime |
| Gain | `TICK_GAIN` | float | 0.3 | Relative to master gain (0.0–1.0 scale) |

**Output**: A 30 ms click at `pitch` Hz. Inaudible after 30 ms.
**Example**: `playTick(440)` produces a 30 ms square wave at 440 Hz, peak gain 0.3,
decaying linearly to 0.

---

### Reveal Chord Synthesis

The reveal chord synthesis is defined as:

`chord_gain(t) = CHORD_GAIN × (1 - t/CHORD_DECAY)`

Three simultaneous sine-wave oscillators at fixed frequencies, with a short attack
and long decay.

**Parameters:**

| Parameter | Symbol | Type | Value | Description |
|-----------|--------|------|-------|-------------|
| Waveform type | — | string | `"sine"` | Sine wave for resonant, weighted character |
| Oscillator 1 frequency | `f1` | float | 220 Hz | Root tone (A3) |
| Oscillator 2 frequency | `f2` | float | 330 Hz | Fifth above root (E4) |
| Oscillator 3 frequency | `f3` | float | 440 Hz | Octave above root (A4) |
| Attack time | — | float | 5 ms | Fast but not instantaneous |
| Decay time | `CHORD_DECAY` | float | 800 ms | Slow fade to silence |
| Sustain | — | float | 0.0 | No sustain after decay |
| Sound duration | — | float | 800 ms | Total node lifetime |
| Gain | `CHORD_GAIN` | float | 0.5 | Louder than tick; relative to master gain |

**Output**: An ~800 ms three-tone chord, starting at gain 0.5 and decaying to silence.
**Example**: `playReveal()` starts 3 oscillators at 220/330/440 Hz simultaneously,
peak combined gain 0.5, decaying over 800 ms.

---

### UI Click Synthesis

The UI click uses the same pattern as the tick sound at a fixed low pitch.

**Parameters:**

| Parameter | Symbol | Type | Value | Description |
|-----------|--------|------|-------|-------------|
| Waveform type | — | string | `"square"` | Same waveform as tick |
| Pitch | — | float | 150 Hz | Fixed; lower than tick range to feel distinct |
| Attack time | — | float | 0 ms | Instantaneous |
| Decay time | — | float | 15 ms | Shorter than tick; crisper feel |
| Sustain | — | float | 0.0 | None |
| Sound duration | — | float | 15 ms | Total node lifetime |
| Gain | — | float | 0.2 | Quieter than tick; background UI feel |

**Output**: A 15 ms click at 150 Hz. Subtler than a reel tick.
**Example**: `playUIClick()` produces a 15 ms square wave at 150 Hz, gain 0.2.

---

### Volume Clamp

`effective_volume = clamp(volume, 0.0, 1.0)`

**Variables:**

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| Input volume | `volume` | float | any | Value passed to `setMasterVolume()` |
| Effective volume | `effective_volume` | float | 0.0–1.0 | Value applied to master `GainNode` |

**Output Range**: 0.0 (silent) to 1.0 (full gain).
**Example**: `setMasterVolume(1.5)` → effective_volume = 1.0.
`setMasterVolume(-0.1)` → effective_volume = 0.0.

## Edge Cases

- **If `playTick()`, `playReveal()`, or `playUIClick()` is called while `AudioContext`
  is in `Suspended` state**: The call is silently dropped. No error is thrown, no
  sound is queued. Silence before first interaction is the correct behavior.

- **If `init()` is called a second time**: The second call is a no-op. The existing
  `AudioContext` and master `GainNode` are kept; no new context is created.

- **If `resume()` is called while `AudioContext` is already `Active`**: The call is a
  no-op — the returned `Promise` resolves immediately. Safe to call on every user
  interaction without guarding.

- **If `playTick()` is called with `pitch ≤ 0`**: Clamp to 1 Hz before creating the
  oscillator. An oscillator at 1 Hz produces no audible output but does not throw.
  The call completes silently.

- **If `playReveal()` is called while a previous reveal chord is still decaying**:
  Two chord stacks overlap. Both play to completion — no cancellation. The result
  is a louder, slightly richer chord. This is acceptable behavior; double-reveals
  are not a meaningful gameplay state.

- **If `setMasterVolume(0)` is set and sounds are triggered**: All sounds synthesize
  and schedule normally but produce no audible output. The system is still `Active`.
  Setting volume > 0 via a subsequent `setMasterVolume()` restores audio immediately
  for the next sound.

- **If the browser hides the tab (document visibility change)**: Some browsers
  auto-suspend `AudioContext` when the tab is not visible. The system moves to
  `Suspended` silently without any action from the application. When the tab becomes
  visible again and the user interacts, calling `resume()` restores `Active` state.

- **If `AudioContext` creation throws** (browser does not support Web Audio API): The
  system logs the error and all subsequent sound methods become no-ops. The
  application continues without audio. No crash, no visible error to the player.

- **If the `resume()` Promise rejects** (browser policy enforcement): System remains
  in `Suspended` state. On the next user interaction, `resume()` is retried. No
  error is shown to the player.

## Dependencies

### Upstream Dependencies

None. The Audio System is a Foundation-layer system with zero upstream
dependencies. It wraps the browser's native Web Audio API directly — no other
simulator system must exist before the Audio System can be initialized.

### Downstream Dependents

All dependencies below are **hard** — each system cannot produce audio without
the Audio System being in `Active` state. (The graceful degradation is silence,
not a crash.)

| System | What it needs | Hard/Soft | Pending GDD |
|--------|--------------|-----------|-------------|
| **Case Opening Orchestrator** | `playTick(pitch)`, `playReveal()` | Hard | Not yet designed |
| **HUD / App Shell** | `resume()` on first click; `playUIClick()` on button press | Hard | Not yet designed |
| **Reveal UI** | `playReveal()` if triggered from UI layer (caller TBD in Orchestrator GDD) | Hard | Not yet designed |

### Interface Contract

The Audio System exposes 7 synchronous methods (plus `resume()` which is async).
All are defined in the Detailed Design section above. No system may call
`AudioContext` directly — all audio interaction must go through this interface.

**Bidirectionality note**: When the Case Opening Orchestrator, HUD/App Shell, and
Reveal UI GDDs are authored, each must list the Audio System under its upstream
dependencies. The exact caller of `playReveal()` (Orchestrator vs. Reveal UI)
must be resolved in the Orchestrator GDD.

## Tuning Knobs

All tunable values live in a single constants object in the implementation
(e.g., `AudioSystem.Config`). No code changes required for any of the following.

| Knob | Current Value | Safe Range | Too High → | Too Low → |
|------|--------------|------------|------------|-----------|
| **Tick pitch low (Hz)** | 220 | 100–400 | Escalation starts too high; early ticks feel strained | Ticks sound like thuds rather than clicks; loses tick character |
| **Tick pitch high (Hz)** | 880 | 500–1200 | Ear-piercing at reel end; players mute the game | Escalation barely perceptible; reel deceleration loses tension |
| **Tick decay time (ms)** | 30 | 10–80 | Ticks blur into a buzz at high reel speed | Near-inaudible click; sounds like a broken sound |
| **Tick gain** | 0.3 | 0.1–0.6 | Overpowers the reveal chord; fatiguing over many opens | Barely audible; tick pattern loses its rhythm |
| **Reveal chord decay (ms)** | 800 | 300–1500 | Chord lingers past the next open button click | Reveal lands but doesn't resonate; anticlimactic |
| **Reveal chord gain** | 0.5 | 0.2–0.8 | Clipping risk (3 oscillators sum); distorted on some speakers | Reveal feels weak; fails the "Sound Is Sacred" success bar |
| **UI click pitch (Hz)** | 150 | 80–250 | Approaches tick territory; click feels like a mini-tick | Ultrasonic low; felt more than heard on some speakers |
| **UI click decay (ms)** | 15 | 8–40 | UI feel becomes heavy; each button feels weighty | Inaudible on most speakers |
| **UI click gain** | 0.2 | 0.05–0.4 | Distracts from reel; UI sounds as loud as the game | Might as well be silent |
| **Default master volume** | 1.0 | 0.0–1.0 | N/A (clamped at 1.0) | 0.0 = silent; any value is valid by design |

**Interaction notes:**
- Tick pitch low and tick pitch high define the escalation range. Narrowing the
  gap (e.g., 400–500 Hz) reduces perceived pitch escalation; widening it
  (e.g., 150–1200 Hz) makes escalation very dramatic.
- Tick gain and reveal chord gain should maintain a ratio of approximately 1:1.5
  to 1:2. If tick gain is raised to match reveal gain, the reveal loses its
  punctuation.
- Reveal chord decay is the most subjective knob — tune by ear against real
  CS2 case opening video reference.

## Acceptance Criteria

*(Reviewed by `qa-lead` — lean mode Section H gate.)*

- **GIVEN** `init()` has not yet been called, **WHEN** any method (`playTick`,
  `playReveal`, `playUIClick`, `setMasterVolume`, `isActive`) is called, **THEN**
  an error is thrown.

- **GIVEN** the application starts, **WHEN** `init()` is called, **THEN**
  `AudioContext` is created in `suspended` state and `isActive()` returns `false`.

- **GIVEN** `AudioContext` is Suspended, **WHEN** `resume()` is called, **THEN**
  `AudioContext` transitions to `running` state and `isActive()` returns `true`.

- **GIVEN** `AudioContext` is Suspended, **WHEN** `playTick(440)`, `playReveal()`,
  or `playUIClick()` is called, **THEN** no error is thrown and no sound is
  produced.

- **GIVEN** `AudioContext` is Active, **WHEN** `playTick(440)` is called, **THEN**
  an `OscillatorNode` of type `"square"` is created with `frequency.value === 440`.

- **GIVEN** `AudioContext` is Active, **WHEN** `playTick(440)` is called, **THEN**
  the associated `GainNode` decays from 0.3 to 0 over 30 ms and the oscillator
  node stops at `AudioContext.currentTime + 0.030`.

- **GIVEN** `AudioContext` is Active, **WHEN** `playReveal()` is called, **THEN**
  exactly three `OscillatorNode` instances of type `"sine"` are created with
  `frequency.value` values of 220 Hz, 330 Hz, and 440 Hz respectively.

- **GIVEN** `AudioContext` is Active, **WHEN** `playReveal()` is called, **THEN**
  the chord `GainNode` ramps from 0 to 0.5 over 5 ms (verified against the gain
  schedule, not instantaneous).

- **GIVEN** `AudioContext` is Active, **WHEN** `playReveal()` is called, **THEN**
  the chord decays to silence within 800 ms (± 50 ms tolerance).

- **GIVEN** `AudioContext` is Active, **WHEN** `playUIClick()` is called, **THEN**
  a `"square"` `OscillatorNode` at 150 Hz is created and its `GainNode` decays to
  0 within 15 ms.

- **GIVEN** `playReveal()` is called twice within 100 ms, **THEN** both chord
  instances play to completion — neither is cancelled.

- **GIVEN** `setMasterVolume(0.5)` is called, **THEN** the master `GainNode`'s
  `gain.value` equals 0.5.

- **GIVEN** `setMasterVolume(1.5)` is called, **THEN** the master `GainNode`'s
  `gain.value` equals 1.0 (clamped).

- **GIVEN** `setMasterVolume(-0.5)` is called, **THEN** the master `GainNode`'s
  `gain.value` equals 0.0 (clamped).

- **GIVEN** `AudioContext` is Active, **WHEN** `playTick`, `playReveal`, and
  `playUIClick` are each called, **THEN** their peak `GainNode` values satisfy:
  `ui.click (0.2) < reel.tick (0.3) < reel.reveal (0.5)`.

- **GIVEN** `AudioContext` is Active, **WHEN** `playTick(-10)` is called with a
  negative pitch, **THEN** no error is thrown and an `OscillatorNode` is created
  with `frequency.value === 1` (clamped to 1 Hz, not silently dropped).

- **GIVEN** `AudioContext` is Active, **WHEN** `playTick(220)` then `playTick(880)`
  are called, **THEN** the first oscillator's `frequency.value` is 220 and the
  second's is 880 (verified by code-level inspection).

- **GIVEN** `init()` has already been called, **WHEN** `init()` is called a second
  time, **THEN** no new `AudioContext` is created and the existing context is
  unchanged.

- **GIVEN** `AudioContext` is already Active, **WHEN** `resume()` is called,
  **THEN** the returned `Promise` resolves immediately and `isActive()` remains
  `true`.

- **GIVEN** `AudioContext` constructor throws at startup, **WHEN** any subsequent
  sound method is called, **THEN** the call completes silently without throwing.
  The application continues without audio.

- **GIVEN** `setMasterVolume(0.0)` has been called, **WHEN** `playTick(440)`,
  `playReveal()`, and `playUIClick()` are called, **THEN** all produce no audible
  output. After `setMasterVolume(1.0)`, the next call to each produces audible
  output.

## Open Questions

- **Who owns the tick pitch formula?** The Audio System accepts `pitch` as a
  caller-supplied Hz value. The formula that maps reel animation progress (0.0–1.0)
  to a pitch in the range [220, 880] Hz belongs to the caller — tentatively the
  Case Opening Orchestrator. *Resolution: define in the Orchestrator GDD when
  designed.*

- **Howler.js vs. raw Web Audio API?** The game concept lists both as candidates.
  The current design assumes raw Web Audio API (synthesized sounds require no
  file-loading abstraction that Howler.js provides). This should be locked as an
  ADR before implementation begins. *Resolution: run `/architecture-decision
  audio-library` after the MVP GDDs are complete.*

- **Should the Audio System auto-resume on first click?** Currently, `HUD / App
  Shell` must call `resume()` on first user interaction. An alternative: the Audio
  System adds its own `document` click listener and self-resumes. Simpler for
  callers, but introduces a DOM dependency into an otherwise pure audio module.
  *Resolution: design decision for the HUD/App Shell GDD.*

- **Should master volume be persisted?** `setMasterVolume()` is currently session-
  only — volume resets to 1.0 on page reload. Persistence across sessions requires
  a dependency on the Persistence system (deferred). *Resolution: revisit when
  Persistence GDD is authored.*

- **Background music / ambient audio?** The game concept does not mention background
  music. CS2's case opening is silent between opens (no ambient music). Confirm
  whether any ambient layer is wanted for Full Vision scope.
  *Resolution: open — low priority.*
