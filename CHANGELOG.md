# v0.1.8 — PLAYABLE SPACE (2026-10-28)

## Playable groove generation
- **NEW (tap):** 10–16 beat events over two bars, with intentional rests and register separation.
- **NEW (hold):** full/busy algorithm from v0.1.7 remains available.
- Existing saved scenes load unchanged until edited; the mode follows the saved scene.

## Live performance
- Live pad sound is immediate and does not mutate the backing loop.
- Dedicated accompaniment bus is softly ducked when the player taps, leaving the live sound unaffected.
- TAPE renderer reconstructs foreground/background routing from captured role data.

## Overdub and mutation
- DUB gives priority to the player's own note at neighboring 16th positions in the same sound family, replaces competing notes, and limits density. It still commits at a loop boundary or on stop.
- MUTATE rearranges a pattern rather than adding 3–14 new notes every press.
- A moved MUTATE note is redirected to a free nearby slot instead of disappearing; repeated mutation is tested.

## Maintained
- Five synthesis kits and their 80 timbres; 16 pads and unified icons; 3 dancing rabbits.
- KEEP / RESTORE (and long-press undo), TAPE, LOOP WAV, English manual, PWA, legacy localStorage keys.

## Test coverage
- Chromium: OPEN and FULL, 18 successive mutations, live-JAM preservation, DUB pointer/click, 80 voices, 44.1kHz stereo WAV and TAPE, 320×568 / 375×667 / 390×740 / 430×800 layouts.
- Not verified on physical iPhone Safari.
