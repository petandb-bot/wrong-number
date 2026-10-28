# CHANGELOG

## v0.1.6 — ROTTEN CARROT

### Fixed
- MUTATE from STOP now starts the mutated loop, rather than quietly editing an inactive pattern.
- Strengthened note-position and instrument replacement for audible, repeatable changes even on sparse patterns.
- Long-press MUTATE on touch devices no longer depends on an iOS-generated click following the press; keyboard click remains supported.
- The MUTATE status provides an event count and the button briefly responds visually.

### Improved
- GHOST OFFICE is replaced by ROTTEN CARROT (sour, rubbery, unsettling sound palette).
- Added WORM PARADE as a fifth, deliberately weird kit.
- Replaced previous rabbit silhouettes with larger chibi-style pixel rabbits using contrasting interiors, faces, different personalities and stepwise poses.
- Updated PWA icons to reflect the new characters; refreshed the offline cache.
- Updated the English MANUAL and version number.

### Preserved
- Original CANDY instruments and TOY / SUGAR signal chains.
- 16-pad controls, loop timing, KEEP/RESTORE/undo, TAPE and WAV output.
- Saved patterns and earlier session keys (kit #4 changes from GHOST OFFICE to ROTTEN CARROT by design).

### Validation
- Chromium tests: repeated short/long mutations, STOP → MUTATE auto-play, 5-kit switching, KEEP/RESTORE, TAPE and WAV export, and 320×568 through 430×800 viewports.
- Offline Web Audio: 80 voices audible and no clipping beyond test limit.
- iPhone Safari and Home Screen real-device behavior remains unverified.
