# CHANGELOG

## 0.1.1 — Tape & Step Back

- Added single-button TAPE for hands-on performance to 30-second 44.1kHz/16-bit stereo WAV. Uses recorded synthesis commands, not MediaRecorder.
- Added hold RESTORE to undo up to eight mutations/new grooves, leaving original single-tap checkpoint restore intact.
- Ensured original 16-pad audio.js is byte-identical to v0.1.0.
- Ensured existing localStorage keys remain unchanged for upgrade safety.
- Existing two-bar WAV export now snapshots its scene at the start of rendering.
- Updated UI version, service worker cache, instructions, and smoke tests.

No change to sound design, musical engine, primary button arrangement, or keep/restore semantics.
