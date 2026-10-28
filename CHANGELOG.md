# v0.1.5 — LITTLE ACCIDENTS

- Rebuilt UI as a compact, candy-toxic, 16-pad retro instrument with minimal one-line title and reduced decorative copy.
- LCD now prioritizes kit, mode (READY / LOOPING / MUTATING / SAVED / TAPE REC), message and BPM/bar position.
- Replaced waveform/large bunny with three tiny Game & Watch-style pixel rabbits with alternating dance frames, blinks and mutate glitches.
- Replaced mixed unicode/emoji motifs with 16 original, visually consistent hand-drawn SVG sticker icons.
- Removed unstable MIC, FILE, SAMPLE toggle and associated live/import code, without removing historical user-imported browser data.
- Added four distinct internally synthesized kits: CANDY KIT (original v0.1.4 sounds), TOY MALFUNCTION, SUGAR POISON and GHOST OFFICE.
- Added kit-aware groove generation and mutation; kit selection persists as part of the session/checkpoint.
- Kept STOP / LOOP, TAPE, KEEP / RESTORE, NEW, tempo, live pads and both WAV outputs.
- TAPE captures kit information per note, so a mid-take kit change is faithfully exported.
- Preserved existing scene and checkpoint storage keys and interprets older scenes as CANDY KIT.
- Implemented CSS compact mode and safe-area padding for mobile home-screen use.
- Bumped PWA cache to v0.1.5. Updated app icons to show the rabbit trio.
- Manual and README are in English.

Validation: Chromium browser functional regression, WAV checks, 4x16-voice offline output levels, and 320×568 / 375×667 / 390×740 / 430×800 screenshots. iPhone Safari not hardware-tested.
