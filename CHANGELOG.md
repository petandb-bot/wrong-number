# Changelog

## v0.1.2
- New soft-hardware visual identity: pastel moulded shell and four complementary pad banks.
- All in-app help/manual text in English.
- MIC captures up to 12 seconds using the MediaRecorder API, stops all microphone tracks afterward.
- FILE imports audio decoded locally by the browser (up to 25 MB, first 12 seconds used).
- Onset-biased slicing and per-pad filtering / playback rate / reverse variations across 16 pads.
- SOUND BANK switch: keeps the original SYNTH instrument intact; SAMPLE is an optional layer.
- SAMPLE-compatible loop playback, mutation, TAPE, and two-bar WAV rendering.
- Sample bank cached locally in IndexedDB when available; clear control inside MANUAL.
- Cache version bumped; PWA icons recolored to match the enclosure.
- Regression tests and simulated microphone API test.

## v0.1.1
- Added TAPE performance-to-WAV rendering (30-second maximum).
- Added RESTORE long-press undo stack (8 states).
- Existing synthesized timbres unchanged.
