# WRONG NUMBER v0.1.5 — LITTLE ACCIDENTS

A tiny, candy-colored, slightly haunted pocket instrument. Four independent synth kits, 16 pads, loop memory, mutation, live TAPE recording, and downloadable WAV. No server, account, microphone, audio upload, or sound samples needed.

## Publish to GitHub Pages

1. Create or open your GitHub repository.
2. Extract the supplied ZIP and upload the **contents of `wrong-number-v0.1.5`** to the repository root, replacing previous files. Do not upload the containing folder as a folder unless Pages is configured accordingly.
3. In GitHub **Settings → Pages**, select **Deploy from a branch → main → /(root)**.
4. Open the published HTTPS address in Safari. From the Share menu, select **Add to Home Screen**.
5. For updates, replace `index.html`, `style.css`, `audio.js`, `icons.js`, `app.js`, `sw.js`, `manifest.webmanifest`, and `assets/` together. The old `sample.js` and `toxic.css` may remain in the repository but are not loaded by v0.1.5; remove these unused files to keep the repository clean.

## How to play

- Tap / hold the 16 colored pads; different taps produce varied attacks and short repeated fragments.
- Switch SOUND KIT with the arrows or by tapping the kit name: CANDY KIT, TOY MALFUNCTION, SUGAR POISON, GHOST OFFICE. Switching kits does not erase the current pattern.
- LOOP captures a recent gesture or generates two bars. Tap again to stop.
- MUTATE makes a kit-dependent modification of the current groove. Hold for a stronger mutation.
- KEEP stores the groove and kit. RESTORE recalls it, and long-press RESTORE undoes up to eight mutations.
- NEW generates a fresh groove without changing the selected kit or BPM.
- TAPE records the current live performance for up to 30 seconds, plus an additional release tail.
- WAV creates a seamless, two-bar 44.1 kHz / 16-bit / stereo file. On iPhone, use the download or share link to save to Files.
- Desktop keyboard: 1-4, QWER, ASDF, ZXCV.

## Sound design

CANDY KIT preserves the original synthesis recipes from v0.1.4. TOY MALFUNCTION uses elastic FM impacts, short digital bleeps and geometric microfragments. SUGAR POISON uses glassy inharmonic tones and cold residue. GHOST OFFICE uses subdued motor-like lows, dry clicks and hollow, floating tones. All four kits have different 16-pad synthesis paths while preserving the four sound roles: BODY (01–04), HIT (05–08), WEIRD (09–12), and AIR / TAIL (13–16).

Each kit also has a distinct groove density and mutation range; the core timing/loop engine remains compatible with older scene data. Instruments are synthesized with the Web Audio API; no audio files are fetched. p5.js 1.11.13 is used only for the screen when available, and the Canvas fallback is fully usable offline.

## Upgrade / compatibility

The existing session and KEEP localStorage keys are retained. A missing `kit` field in older sessions defaults to CANDY KIT, preserving the existing sound. Imported SAMPLE data from v0.1.4 is not accessed or deleted. MIC, FILE and SAMPLE input have been deliberately removed from the UI and playback path due to observed instability on iPhone.

The service worker uses network-first update behavior for same-origin assets and a fresh v0.1.5 cache name. If the prior home-screen app is stuck on an older interface, reload in Safari, then fully close/reopen the home-screen app, or remove/re-add the home-screen shortcut after updating.

## Tested and untested

Chromium headless browser tests cover 16 pad clicks, four kit switching, LOOP, MUTATE, KEEP / RESTORE, stereo WAV export, TAPE (including kit switches mid-recording), the 64 synth voices' output levels, and screenshot fit on multiple mobile viewport sizes. **Real iPhone Safari / Home Screen, audio routing, and touch latency were not hardware tested.** The layout may be affected by Safari chrome and display text scaling. At extremely small viewports, vertical scrolling may be preferable to shrinking pads below a comfortable touch target.

## Files

- `index.html`: controls, compact console and English manual
- `style.css`: colorful mechanical UI and responsive layout
- `audio.js`: Web Audio synthesis and offline PCM WAV encoder
- `icons.js`: 16 original, stylistically unified vector icons
- `app.js`: loop scheduler, kit management, persistence, animation, export
- `manifest.webmanifest`, `sw.js`, `assets/`: PWA support
- `tests/`: scripts for smoke, regression, audio, and icon checks

No build tooling or backend required. Open the app over HTTPS. For development, use a local web server rather than opening `index.html` as a file.
