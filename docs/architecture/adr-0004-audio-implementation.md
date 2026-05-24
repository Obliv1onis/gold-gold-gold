# ADR-0004: Audio Implementation

## Status
Proposed

## Date
2026-05-21

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Browser (HTML / CSS / JavaScript) |
| **Domain** | Audio |
| **Knowledge Risk** | LOW — Web Audio API is stable, widely supported, and pre-training-data |
| **References Consulted** | audio-system.md GDD, game-concept.md, ADR-0001 (module system) |
| **Post-Cutoff APIs Used** | None |
| **Verification Required** | Confirm AudioContext.resume() resolves correctly after user gesture in Safari (known historical quirk); confirm OscillatorNode.stop() does not throw after node has already stopped |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-0001, ADR-0002 |
| **Enables** | Audio System module implementation |
| **Blocks** | Audio System (`src/foundation/audio-system.js`) — cannot be written until library choice is locked |
| **Ordering Note** | Audio System is Foundation layer; it must be Accepted before Case Opening Orchestrator (Feature) wires audio callbacks. |

## Context

### Problem Statement
`game-concept.md` lists "Howler.js or Web Audio API" as the audio option. The audio-system GDD fully specifies runtime sound synthesis using `OscillatorNode` and `GainNode` — no audio files are loaded anywhere in the design. The implementation approach must be locked before the Audio System module is written.

### Constraints
- All sounds are synthesized at runtime — no `.mp3`, `.ogg`, or `.wav` files exist or are planned
- `AudioContext` must be created lazily on the first user gesture (browser autoplay policy)
- The Pillar 4 ("Sound Is Sacred") design principle requires sample-accurate scheduling: tick pitch must track reel velocity in real time, and the reveal chord must fire at a precise offset after reel completion
- No audio files means no file loading, no format detection, no preloading pipeline

### Requirements
- Must support `OscillatorNode` (waveform synthesis) and `GainNode` (amplitude envelope)
- Must support sample-accurate scheduling via `AudioContext.currentTime`
- Must handle the suspended `AudioContext` state gracefully (no errors before `resume()`)
- Must be importable as an ES module (ADR-0001)

## Decision

**Use the raw Web Audio API directly. No audio library.**

- **AudioContext**: one instance, created lazily on first user gesture
- **Synthesis**: `OscillatorNode` + `GainNode` per sound event, created and discarded per play
- **Scheduling**: `AudioContext.currentTime` for all timing (sample-accurate)
- **Library**: none — no npm dependency for audio
- **AudioContext lifecycle**: Uninitialized → Suspended (on create) → Active (after `resume()`) → Closed (on page unload, optional)

### Synthesis Specs (from audio-system.md GDD)

| Sound | Waveform | Frequency | Decay | Trigger |
|-------|----------|-----------|-------|---------|
| `tick` | square | 220–880 Hz (velocity-mapped) | 30ms | per reel velocity event |
| `reveal` | 3× sine | 220 + 330 + 440 Hz (chord) | 800ms | on animation complete |
| `ui.click` | square | 150 Hz | 15ms | on button press |

Constants: `TICK_PITCH_LOW = 220 Hz`, `TICK_PITCH_HIGH = 880 Hz`, `CHORD_DECAY_MS = 800 ms`

### Architecture Diagram

```
User gesture (any click)
  └─▶ AudioSystem.resume()
        └─▶ _audioContext.resume()   [Suspended → Active]

Orchestrator.spin() → RAE.onTick(pitch)
  └─▶ AudioSystem.playTick(pitch)
        ├─ _ctx.createOscillator()  [type: 'square']
        ├─ _ctx.createGain()        [envelope: 0 → 1 → 0 over 30ms]
        └─ osc.start() / osc.stop(currentTime + 0.030)

Orchestrator onComplete → AudioSystem.playReveal()
  └─ 3× sine oscillators at 220/330/440 Hz
     GainNode envelope: 0 → 0.5 → 0 over 800ms
```

### Key Interfaces

```js
// src/foundation/audio-system.js

let _ctx = null;  // AudioContext, lazy-init

export const AudioSystem = {
  // Call from any user-gesture handler (first click on document)
  resume() {
    if (!_ctx) _ctx = new AudioContext();
    return _ctx.resume();           // Promise<void>
  },

  // pitch: number in range [220, 880] (mapped from reel velocity by RAE)
  playTick(pitch) {
    if (!_ctx || _ctx.state !== 'running') return;
    const osc  = _ctx.createOscillator();
    const gain = _ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = pitch;
    gain.gain.setValueAtTime(0, _ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.3, _ctx.currentTime + 0.005);
    gain.gain.linearRampToValueAtTime(0,   _ctx.currentTime + 0.030);
    osc.connect(gain).connect(_ctx.destination);
    osc.start(_ctx.currentTime);
    osc.stop(_ctx.currentTime + 0.030);
  },

  // 3-oscillator chord — called once per case open on animation complete
  playReveal() {
    if (!_ctx || _ctx.state !== 'running') return;
    const decaySec = 0.800;  // CHORD_DECAY_MS
    [220, 330, 440].forEach(freq => {
      const osc  = _ctx.createOscillator();
      const gain = _ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, _ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.5, _ctx.currentTime + 0.020);
      gain.gain.exponentialRampToValueAtTime(0.001, _ctx.currentTime + decaySec);
      osc.connect(gain).connect(_ctx.destination);
      osc.start(_ctx.currentTime);
      osc.stop(_ctx.currentTime + decaySec);
    });
  },

  playUI(type) { /* square 150Hz 15ms for 'click'; adapt for 'hover' */ },
  playAmbient() { /* reserved — ambient loop if designed */ },
  stopAmbient() { /* reserved */ },
  setVolume(v)  { /* master gain node, 0.0–1.0 */ },
};
```

## Alternatives Considered

### Alternative A: Howler.js
- **Description**: Popular npm audio library (`npm install howler`). Primary use case: loading and playing audio files (mp3/ogg/wav) with cross-browser compatibility, sprite sheets, positional audio.
- **Pros**: Handles audio format detection, preloading, and mobile Safari quirks automatically. Large community.
- **Cons**: Designed for file-based playback — does not expose `OscillatorNode`, `GainNode`, or synthesis APIs. Adding Howler.js and then using raw Web Audio API anyway would add a dependency without using its primary feature. Howler.js wraps `AudioContext` internally, which means the `AudioContext` instance is inaccessible for direct synthesis scheduling.
- **Rejection Reason**: The audio-system GDD requires runtime synthesis. Howler.js cannot do runtime synthesis. Using it would mean importing a dependency to handle file-based audio while still writing raw Web Audio API code for the actual synthesis — all cost, no benefit.

### Alternative B: Tone.js
- **Description**: npm library that provides a high-level synthesis and music API over Web Audio API. Exposes synthesizers, effects chains, sequencers, and timing abstractions.
- **Pros**: Much simpler synthesis code. `new Tone.Synth().toDestination().triggerAttackRelease("C4", "8n")` vs. 15 lines of raw Web Audio API. Handles `AudioContext` resumption automatically.
- **Cons**: 75KB+ minified dependency for 3 synthesized sounds. Tone.js's timing model (`Tone.Transport`) is designed for musical sequencing, not real-time velocity-mapped pitch (which is what the reel tick requires). Adds a conceptual layer over `AudioContext.currentTime` that the GDD doesn't need.
- **Rejection Reason**: Significant dependency size for 3 simple synthesized sounds. The GDD synthesis specs are already fully defined at the raw Web Audio API level — adding Tone.js would mean re-learning its abstraction rather than implementing the spec directly.

### Alternative C: No abstraction (inline Web Audio API calls in Orchestrator)
- **Description**: Place audio calls directly in the Case Opening Orchestrator rather than wrapping in an AudioSystem module.
- **Pros**: Zero abstraction, slightly less code.
- **Cons**: Violates the Architecture Principle "Sound Is First Class" — audio must be wired at Feature layer (Orchestrator), not scattered inline. Untestable in isolation. Contradicts the layered module structure (ADR-0002).
- **Rejection Reason**: Architecture Principle 3 and ADR-0002 require audio to be in its own Foundation-layer module.

## Consequences

### Positive
- Zero npm dependency for audio — no version lock risk, no bundle size impact
- AudioSystem module is the only file in the codebase that touches `AudioContext` — clean boundary
- All synthesis specs from the GDD (frequencies, decay times, waveforms) map 1:1 to Web Audio API calls
- `playTick()` / `playReveal()` are fire-and-forget — no state to manage between calls

### Negative
- More verbose than Tone.js: ~15 lines per sound event vs. ~3 with a library
- Safari `AudioContext` behavior requires testing (historically quirky with autoplay)
- No automatic format detection or fallback — acceptable since there are no audio files

### Risks
- **Safari AudioContext**: Safari has historically had quirks with `AudioContext.resume()` and the autoplay policy. Mitigation: call `AudioSystem.resume()` from a `'click'` event on `document` (the HUD/AppShell does this on first click). Manual verification required on Safari before release.
- **OscillatorNode stop() exception**: Calling `osc.stop()` on an already-stopped oscillator throws in some browsers. Mitigation: wrap in try/catch or use `osc.onended` to guard.
- **AudioContext garbage collection**: Creating a new `AudioContext` per session is fine; creating one per sound event would exhaust resources. The single `_ctx` instance handles this correctly.

## GDD Requirements Addressed

| GDD System | Requirement | How This ADR Addresses It |
|------------|-------------|--------------------------|
| audio-system.md | Runtime synthesis via OscillatorNode + GainNode; no audio files | Raw Web Audio API — OscillatorNode and GainNode used directly as specified |
| audio-system.md | AudioContext lazy init on first user gesture | `_ctx = new AudioContext()` deferred until `AudioSystem.resume()` called |
| audio-system.md | `TICK_PITCH_LOW = 220 Hz`, `TICK_PITCH_HIGH = 880 Hz` | Direct `osc.frequency.value = pitch` — no library translation layer |
| audio-system.md | `CHORD_DECAY_MS = 800 ms` reveal chord | `exponentialRampToValueAtTime` at `currentTime + 0.800` |
| case-opening-orchestrator.md | `onTick: (pitch) → Audio.playTick(pitch)` | `AudioSystem.playTick(pitch)` call directly in Orchestrator callback |
| case-opening-orchestrator.md | `Audio.playReveal()` on animation complete | `AudioSystem.playReveal()` — fire-and-forget |
| hud-app-shell.md | `AudioSystem.resume()` on first click | HUD calls `AudioSystem.resume()` in first-click handler on `document` |
| game-concept.md | Pillar 4: Sound Is Sacred; sample-accurate scheduling | `AudioContext.currentTime` scheduling — sub-millisecond accuracy |

## Performance Implications
- **CPU**: OscillatorNode processing is on the browser's audio thread — no main-thread impact
- **Memory**: One `AudioContext` for the session; OscillatorNode instances are GC'd after `osc.stop()`
- **Load Time**: Zero — no audio files to preload, no library to load
- **Network**: None

## Migration Plan
No existing source code — greenfield. `src/foundation/audio-system.js` is written to this spec.

## Validation Criteria
- `AudioSystem.resume()` resolves the `AudioContext` to `'running'` state after a click event
- `AudioSystem.playTick(440)` produces an audible tick at 440 Hz with no console errors
- `AudioSystem.playReveal()` produces an audible 3-note chord that decays over ~800ms
- `AudioSystem.playTick(220)` called before `resume()` completes with no error (silent no-op)
- Safari: all three sounds play after a single click event (autoplay policy satisfied)

## Related Decisions
- ADR-0001: Web stack — raw Web Audio API requires no npm install
- ADR-0002: Module structure — `src/foundation/audio-system.js`
- ADR-0003: DOM events — no events fired by AudioSystem (pure imperative calls)
- audio-system.md: GDD with full synthesis specs this ADR implements
