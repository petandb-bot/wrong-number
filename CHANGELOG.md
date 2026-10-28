# v0.1.7.1 — DUB Touch Fix

- Fixed iPhone-sensitive DUB activation: direct pointerup handler with pointer capture.
- Suppressed duplicate synthetic clicks; retained keyboard and accessibility click support.
- Unlocked audio on pointerdown inside a trusted touch gesture.
- Added visible pressed/recording feedback, clearer screen-reader state, >=44px touch height.
- Cache-busted app/CSS/audio/icons scripts and versioned the PWA service worker to avoid stale JavaScript with a new UI.
- All audio kits and other performance features remain unchanged.

# CHANGELOG

## v0.1.7 — LIVE JAM

### Added
- Non-destructive LIVE JAM while LOOP runs; live taps do not modify the two-bar pattern.
- An explicit **● DUB** button, with visible recording state and immediate sound plus 16th-note quantized capture.
- Pending overdub staging to avoid same-cycle echo; automatic commit at the next cycle, or when DUB/LOOP is stopped.
- Undo history for a DUB recording session, integrated with RESTORE long press.
- BPM-aware, pad-group-specific HOLD REPEAT; repeat hits can be overdubbed.
- Rabbits and LCD progress indicators now follow the audio loop's beat rather than a free-running animation clock.

### Fixed / preserved
- Fixed previous-kit arrow: it now moves back one kit rather than two after adding the fifth kit.
- Prior background behavior that silently appended live hits to a pattern during LOOP is replaced by an explicit toggle.
- A playhead anchor keeps quantization aligned with the Web Audio clock even as the scheduler looks ahead.
- Tempo changes reset the playhead and finish a recording before the change.
- Preserves 5 kit synth voices, MUTATE audible variation, KEEP/RESTORE, WAV, TAPE, previous localStorage session keys, original sticker-style pads and compact phone layout.
- p5.js 1.11.13 / Canvas fallback, no MIC or imported samples.

### Tested
- Chromium touch interactions, DUB/undo, mutate, TAPE and WAV export, offline audio voice-level checks, 320×568 / 375×667 / 390×740 / 430×800 CSS px layout.
- Physical iPhone Safari and Home Screen PWA behavior remains untested.
