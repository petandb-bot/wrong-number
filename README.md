# WRONG NUMBER v0.1.8 — PLAYABLE SPACE

A small pocket instrument, built with p5.js, Web Audio and GitHub Pages. Five distinct synthesized kits, 16 touch pads, three dancing Game & Watch rabbits, LIVE JAM, OVERDUB, MUTATE, TAPE and WAV export.

## Install on GitHub Pages

1. Extract `WRONG_NUMBER_v0.1.8_PLAYABLE_SPACE_GitHub_Pages.zip`.
2. Upload **everything inside** `wrong-number-v0.1.8/` to the **root** of your existing GitHub repository, replacing older files. Do not upload only the HTML. In particular, `app.js`, `audio.js`, `sw.js` and the `assets/` folder must be replaced.
3. Enable **Settings → Pages → Deploy from a branch → main → /(root)** if needed.
4. Visit the HTTPS GitHub Pages site on your iPhone using Safari. In Safari's sharing menu choose **Add to Home Screen**.
5. If the previous app is still displayed, load the Pages URL in Safari while connected, refresh, close the Home Screen app and reopen it. All code asset URLs and the service worker cache are versioned to 0.1.8.

## Start here: play with the machine

1. **NEW (tap)** — create an **OPEN** two-bar groove with 10–16 notes. It intentionally leaves silence for you.
2. **LOOP** — start playback. The three rabbits follow the beat.
3. **PADS** — jam on top. Your taps are immediate and don't overwrite the pattern. While playing, the backing drops slightly in level so your notes can be heard.
4. **DUB** — tap once to record your part. Tap a few accents or hold a pad. Tap DUB again to finish. New notes replace nearby notes in the same sound family instead of accumulating endlessly.
5. **MUTATE** — change positions and sounds without growing the number of notes. Hold for a wilder variation.
6. **KEEP / RESTORE** — save a favorite groove and bring it back. Hold RESTORE to undo up to eight recent mutations, new grooves or overdubs.
7. **TAPE / WAV** — record a live performance (up to 30 seconds) or export the current two-bar loop as a 44.1 kHz, stereo 16-bit WAV.

### Other gestures

- **NEW (hold ~0.6 s)** — generate a busy **FULL** groove, similar to the earlier versions, for listening rather than jamming. The LCD footer indicates `FULL` or `SPACE`.
- **PADS (hold)** — tempo-following repeat; release to stop. Different pad groups have different repeat patterns.
- **− / +** — tempo changes, 48–180 BPM.
- **SOUND KIT / arrows** — change among CANDY KIT, TOY MALFUNCTION, SUGAR POISON, ROTTEN CARROT and WORM PARADE.
- **DESKTOP** — play pads with `1 2 3 4`, `Q W E R`, `A S D F`, `Z X C V`.
- **KEEP** stores a separate snapshot; **RESTORE** short press restores it, long press rolls back the latest edit.

## What changed from v0.1.7.1

- A short press of NEW makes a deliberately sparse, playable groove (roughly 10–16 steps/events over two bars); holding NEW brings back a fuller pattern. The 16 original pad voices in each of the five kits are unchanged.
- JAM stays immediate. While live pads play, accompaniment-only dry audio is gently ducked (not the entire master output), and recovers automatically. No microphone or sample permissions are needed.
- DUB uses 16th-note quantization for saved events but does not delay your live hits. Notes in the same register and adjacent grid positions are replaced, not stacked; OPEN grooves are capped at 28 events and full grooves at 40. A 2-voice-per-grid-step limit keeps the mix less cluttered.
- MUTATE moves pitches/positions and subtly varies timbre, without adding events. It tries new free positions when two notes would collide, preserving the groove through successive mutations.
- Offline TAPE WAV recreates the same backing/foreground routing as live playback. Seamless loop WAV exports only the backing pattern, as before.
- Existing scenes and KEEP snapshots use the same localStorage keys. An older stored busy groove remains unchanged until you press NEW or edit it; press **NEW** once to experience the new SPACE behavior.
- No additional screen buttons, no removed kits, no replacement of the rabbits or custom icons.

## Implementation

`index.html`, `style.css`, `app.js`, `audio.js`, `icons.js`, `sw.js`, `manifest.webmanifest`, `assets/`. The English in-app manual is under **MANUAL / HOW TO PLAY**. Web Audio and offline rendering do all synthesis locally. p5.js 1.11.13 is loaded from CDN if available; a Canvas fallback keeps the LCD running offline.

To preview locally, run `python -m http.server 8000` from the app directory, then open `http://localhost:8000` on your computer.

## Testing and limitations

Automated tests used headless **Chromium** for all 5×16 synthesized pads, short and long NEW, consecutive MUTATE, DUB touch, LOOP, WAV export, TAPE and 320–430px viewports. Physical iPhone Safari / installed Home Screen behavior **has not been tested**. The browser can pause audio when you switch apps or lock the screen. Start at moderate headphone volume.

Previous MIC/FILE sample banks are not used in v0.1.8. Data previously saved in local storage is not intentionally deleted. Keep a backup of your existing repository before overwriting.
