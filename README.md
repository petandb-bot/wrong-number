# WRONG NUMBER v0.1.7 — LIVE JAM

A tiny candy-poison portable instrument for phones and desktop browsers. Five synthesized sound kits, 16 illustrated performance pads, three dancing pixel rabbits, live jam, 16th-note overdubbing, mutate, snapshots, tape and loop WAV export.

## Publish on GitHub Pages

1. Unzip `WRONG_NUMBER_v0.1.7_LIVE_JAM_GitHub_Pages.zip`.
2. Upload **all files and folders inside** `wrong-number-v0.1.7/` to the root of your existing GitHub repository. Replace old files.
3. In GitHub **Settings → Pages**, select **Deploy from a branch**, **main**, **/(root)** if you have not enabled Pages already.
4. Open the HTTPS URL in Safari. To use it like an app, select **Share → Add to Home Screen**.
5. If your previous PWA remains visible, close and reopen it. The service worker has a new versioned cache (`wrong-number-v0.1.7`).

This is a static, local-only instrument. No microphone permissions, uploads, login or build tools are needed. The audio engine uses Web Audio. p5.js 1.11.13 paints the display if its CDN is available, with an internal Canvas fallback offline.

## PLAY / LIVE JAM / DUB

- **PLAY:** Tap one of the 16 pads for immediate sound, tap rapidly for varying attacks, or hold for tempo-related repeating fragments. Playing multiple pads at once is supported.
- **LOOP:** Starts a two-bar loop using the last free performance; if none is available, starts a generated beat. Tap LOOP again to stop.
- **JAM (normal):** While LOOP is playing, all pad taps are live only. They **never modify the underlying loop**. You can experiment without damaging the pattern.
- **● DUB:** Tap the fourth large button to arm overdubbing. This also starts LOOP if it was stopped. Tap or hold pads to add hits to the **next pass** of the pattern. Live hits sound immediately; the *recorded positions* are rounded to the nearest 16th note. Tap ● DUB again to finish and save pending notes. Tapping LOOP to stop also saves pending notes.
- **HOLD REPEAT:** Press and hold any pad. After a short intentional hold, the pad produces repeated fragments paced according to BPM and pad group. Holding during DUB can record these fragments. Release to stop.
- **MUTATE:** Evolves a pattern and starts it if stopped. Hold MUTATE for a stronger mutation. When DUB is active, MUTATE finishes that overdub before transforming the pattern.
- **KEEP:** Saves the current pattern and kit. **RESTORE:** Recalls it. Holding RESTORE undoes previous mutations, new grooves and overdubs, up to eight snapshots.
- **NEW:** Generates a kit-aware two-bar groove. **TAPE:** Records the loop plus live taps as performed for up to 30 seconds, then renders WAV. **↓ WAV:** Exports the current two-bar pattern as seamless stereo 44.1kHz/16-bit PCM. **− / +:** Changes BPM.
- **KITS:** CANDY KIT / TOY MALFUNCTION / SUGAR POISON / ROTTEN CARROT / WORM PARADE. Tap the kit name or arrows to change the sound world. The loop uses whichever kit is currently selected; TAPE preserves the kit at each performed hit.
- **DESKTOP KEYS:** `1234`, `QWER`, `ASDF`, `ZXCV` for the 16 pads. Keyboard holds repeat too.

### Example session

1. Tap **NEW**, then **LOOP** (or just **LOOP** with an empty scene).
2. Tap extra sounds freely while the loop runs — this is **JAM**.
3. Tap **● DUB**. Play a few extra taps or hold a pad for a rhythmic roll.
4. Tap **● DUB** again. Your recorded additions loop automatically.
5. Press **KEEP**, explore **MUTATE**, and use **RESTORE** if needed.
6. Tap **TAPE** to record improvisation, or **↓ WAV** to export the loop.

## Technical design

- The live sound fires instantly (no audible quantization latency). Quantization only affects recording.
- DUB notes are staged until the next cycle boundary to prevent a second hit on the current pass; switching DUB off flushes any remaining notes into the saved pattern.
- Duplicate hits from the same pad on a grid step are merged to avoid digital clipping. The stored pattern has a 64-event limit; important low-frequency anchors are prioritized when full.
- Loop timing uses `AudioContext.currentTime` and a 25ms scheduler with lookahead. Rabbit dance phase follows the same beat clock while looping.
- Changing tempo while DUB is armed finishes the DUB first and restarts the scheduled playhead. The short restart is intentional to avoid a timing mismatch.
- TAPE records the scheduled voices *and* manual live voices. Loop WAV renders the current loop events, not temporary JAM notes. The file generator works without a server.
- Previous session and KEEP localStorage keys are preserved. Existing patterns still load. No previously stored samples are deleted, though MIC/FILE/SAMPLE are not available in this version.

## Test and support

Chromium desktop automation checks LIVE JAM isolation, armed DUB, quantization, undo, mutate, kit audio, TAPE/WAV and 320×568 through 430×800 mobile viewports. **No physical iPhone Safari/Home Screen testing was possible here.** The audio should be played in the foreground; iOS may suspend background audio. Avoid very loud headphones while testing an unfamiliar sound kit.

The short English manual is also available from **MANUAL / HOW TO PLAY** beneath the instrument.

Files: `index.html`, `style.css`, `app.js`, `audio.js`, `icons.js`, `sw.js`, `manifest.webmanifest`, `assets/`, `tests/`.

For local preview, serve this directory over HTTP (`python -m http.server 8000`) and open `http://localhost:8000`.
