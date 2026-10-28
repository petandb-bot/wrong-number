# WRONG NUMBER v0.1.6 — ROTTEN CARROT

A small pink portable instrument for iPhone and desktop. 16 colorful pads, five fully synthesized sound kits, a three-rabbit Game & Watch-style LCD, immediate LOOP/MUTATE, KEEP/RESTORE, TAPE and two-bar WAV export.

## Publish with GitHub Pages

1. Unzip this archive and upload **the contents** of `wrong-number-v0.1.6/` into the root of your existing GitHub repository, replacing earlier files.
2. Use **Settings → Pages → Deploy from a branch → main → /(root)**.
3. Open the HTTPS site in iPhone Safari. Use **Share → Add to Home Screen** if desired.
4. If an old installed app is still loaded, reload Safari and close/reopen the Home Screen app. The service worker cache name is updated to `wrong-number-v0.1.6`.

No server, build tools, audio uploads or accounts are required. `p5.js@1.11.13` is loaded from a CDN for the LCD when online; a locally implemented Canvas fallback keeps the screen functional offline. The sound engine uses the Web Audio API and does not need `p5.sound`.

## How to play

- **PADS**: Tap 01–16 to trigger sounds. Repeated touches create different attacks; holding a pad produces short repeated fragments.
- **SOUND KIT**: Use the arrows or the kit-name button to switch between CANDY KIT, TOY MALFUNCTION, SUGAR POISON, ROTTEN CARROT and WORM PARADE.
- **LOOP**: Capture a recent gesture; when no gestures exist, generate a two-bar beat. Tap again to stop. Playing pads during a loop adds quantized events to the pattern.
- **MUTATE**: Tap to change audible notes, timing and accents. If no loop is playing, MUTATE starts it automatically. Hold at least 0.6 seconds for a heavier change. A brief status message reports the new note count. On touchscreen, the operation runs from `pointerup` rather than depending on a long-press click event.
- **KEEP**: Save a snapshot. **RESTORE**: Recall the saved snapshot; long-press for the previous pattern (up to eight changes).
- **NEW**: Generate a new beat in the selected kit.
- **TAPE**: Record live playing and the running loop for up to 30 seconds; export a WAV with release tail. The kit selected for each recorded note is preserved in export.
- **WAV**: Render a seamless two-bar PCM WAV (44.1 kHz, 16-bit stereo).
- **− / +**: Change tempo. **Desktop keys**: 1–4, QWER, ASDF, ZXCV.

## Sound kits

| Kit | Character |
| --- | --- |
| CANDY KIT | Original v0.1.5 synth instruments, kept unchanged |
| TOY MALFUNCTION | Elastic FM taps and toy circuits |
| SUGAR POISON | Cold resonances and unstable glass-like tones |
| ROTTEN CARROT | Sour rubber, squelching lows, chittering and lopsided percussion; replaces GHOST OFFICE |
| WORM PARADE | New fifth kit: crooked chirps, jumpy digital percussion and silly unstable intervals |

Kit index 3, formerly GHOST OFFICE, now plays ROTTEN CARROT if loaded from an old session. All other kit indices and saved events remain compatible. This changes only that kit's timbre by design; the saved pattern data is not deleted.

## Graphics and device UI

The three rabbits are redrawn from local, hand-coded pixel graphics with different faces and 2–4 discrete poses. LOOP, MUTATE, KEEP and NEW affect their behavior. There is no waveform display. The 16 pad icons retain their unified vector illustrations. The layout remains single-screen oriented, with no horizontal overflow at tested sizes.

## Technical changes and limitations

- MUTATE previously wrote new pattern data without starting playback from STOP; now it starts playback so the change is audible immediately. Mutations alter event placement and pad selection rather than only random seeds or DSP parameters.
- The MUTATE button uses explicit pointer-up handling and suppression of duplicate click events, plus a keyboard-click fallback.
- LOOP, KEEP, RESTORE, NEW, TAPE, offline WAV rendering, localStorage session persistence and the four sound groups remain intact.
- MIC / FILE / imported SAMPLE playback remain deliberately disabled; old imported audio data is **not erased**.
- Browser tests validate 80 generated voices, repeated MUTATE, long-press, WAV export, TAPE and mobile layouts. These are not substitutes for real iPhone Safari and home-screen testing. iOS audio routing, touch latency and system playback volume have **not** been tested on hardware.

## Files

- `index.html`: UI, accessible controls, short English manual
- `style.css`: compact colored enclosure and responsive touch controls
- `app.js`: live scheduler, generation, mutation, rabbits, recording, WAV export
- `audio.js`: Web Audio instruments and WAV encoder
- `icons.js`: unified pad icons
- `sw.js`, `manifest.webmanifest`, `assets/`: installable PWA
- `tests/regression_016.py`: Chromium UI/gesture/export checks
- `tests/audio_016.py`: Web Audio voice-level checks

Run tests (if Python Playwright, Chromium and their dependencies are installed):

```bash
python tests/regression_016.py
python tests/audio_016.py
```

For local use, serve the folder over `localhost` instead of opening `index.html` as a file.
