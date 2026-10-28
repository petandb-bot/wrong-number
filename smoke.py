"""Smoke test for WRONG NUMBER v0.1.2

Requires: pip install playwright; playwright install chromium
Optional: CHROMIUM_PATH=/usr/bin/chromium
The test loads project assets directly into a Chromium document, without a network dependency.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import contextlib
import os
import re
import tempfile
import wave
import math
import struct

ROOT = Path(__file__).resolve().parents[1]

with sync_playwright() as p:
    preferred_browser = os.getenv('CHROMIUM_PATH')
    if not preferred_browser and Path('/usr/bin/chromium').exists():
        preferred_browser = '/usr/bin/chromium'
    kwargs = {'headless': True, 'args': ['--autoplay-policy=no-user-gesture-required']}
    if preferred_browser:
        kwargs['executable_path'] = preferred_browser
    browser = p.chromium.launch(**kwargs)
    context = browser.new_context(viewport={'width': 390, 'height': 844}, accept_downloads=True)
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))

    html = (ROOT / 'index.html').read_text(encoding='utf-8')
    html = re.sub(r'<script src="(?:audio|app)\.js" defer></script>', '', html)
    page.set_content(html, wait_until='domcontentloaded')
    page.add_style_tag(path=str(ROOT / 'style.css'))
    page.add_script_tag(path=str(ROOT / 'audio.js'))
    page.add_script_tag(path=str(ROOT / 'sample.js'))
    page.add_script_tag(path=str(ROOT / 'app.js'))

    assert page.locator('.pad').count() == 16
    page.locator('.pad').first.click()
    page.locator('#btn-loop').click()
    assert page.locator('#btn-loop').get_attribute('aria-pressed') == 'true'
    before = page.evaluate('WrongNumberDebug.getScene()')
    assert len(before['events']) > 0

    page.locator('#btn-keep').click()
    page.locator('#btn-mutate').click()
    after = page.evaluate('WrongNumberDebug.getScene()')
    assert after != before
    page.locator('#btn-restore').click()
    assert page.evaluate('WrongNumberDebug.getScene()') == before
    # Hold RESTORE: a different, single-step mutation undo. KEEP stays untouched.
    page.locator('#btn-mutate').click()
    assert page.evaluate('WrongNumberDebug.getScene()') != before
    restore = page.locator('#btn-restore')
    restore.hover()
    page.mouse.down()
    page.wait_for_timeout(740)
    page.mouse.up()
    assert page.evaluate('WrongNumberDebug.getScene()') == before
    page.locator('#tempo-up').click()
    assert page.evaluate('WrongNumberDebug.getScene().bpm') == 94

    with tempfile.TemporaryDirectory() as temp_dir:
        page.screenshot(path=str(Path(temp_dir) / 'mobile-preview.png'), full_page=True)
        page.locator('#btn-export').click()
        page.wait_for_function("!document.getElementById('download-link').hidden", timeout=60000)
        with page.expect_download() as result:
            page.locator('#download-link').click()
        wav_path = Path(temp_dir) / 'test.wav'
        result.value.save_as(wav_path)
        with contextlib.closing(wave.open(str(wav_path), 'rb')) as wav:
            assert wav.getnchannels() == 2
            assert wav.getsampwidth() == 2
            assert wav.getframerate() == 44100
            assert wav.getnframes() > 150000
            print(f'WAV verified: {wav.getnframes()} frames, stereo, 44.1 kHz, 16-bit PCM')

    # TAPE records actual scheduled loop and manual pad events and renders full jam WAV.
    page.locator('#btn-tape').click()
    assert page.evaluate('WrongNumberDebug.isRecording()')
    page.locator('.pad').nth(8).click()
    page.locator('.pad').nth(3).click()
    page.wait_for_timeout(600)
    page.locator('#btn-tape').click()
    assert not page.evaluate('WrongNumberDebug.isRecording()')
    page.wait_for_function("!document.getElementById('download-link').hidden", timeout=60000)
    with tempfile.TemporaryDirectory() as tape_dir:
        with page.expect_download() as download:
            page.locator('#download-link').click()
        tape_path = Path(tape_dir) / 'tape.wav'
        download.value.save_as(tape_path)
        with wave.open(str(tape_path), 'rb') as w:
            assert (w.getnchannels(), w.getsampwidth(), w.getframerate()) == (2, 2, 44100)
            assert w.getnframes() > 2.5*44100
            frames = w.readframes(w.getnframes())
            assert any(b != 0 for b in frames[:32000]), 'tape begins silent'
            print(f'TAPE verified: {w.getnframes()} frames, stereo, 44.1 kHz, 16-bit PCM')

    # Import an actual WAV and verify 16-pad SAMPLE mode.
    with tempfile.TemporaryDirectory() as input_dir:
        audio_file = Path(input_dir) / 'input.wav'
        with wave.open(str(audio_file), 'wb') as wav:
            wav.setnchannels(1);wav.setsampwidth(2);wav.setframerate(22050)
            data = [int(12000 * math.sin(2*math.pi*(130 + (i//11025)*73)*i/22050)
                    * (0.5 if i%11025 > 8000 else 1)) for i in range(22050*4)]
            wav.writeframes(struct.pack('<'+'h'*len(data),*data))
        page.locator('#file-picker').set_input_files(str(audio_file))
        page.wait_for_function('WrongNumberDebug.bankInfo().loaded', timeout=30000)
        assert page.evaluate('WrongNumberDebug.bankInfo().mode') == 'SAMPLE'
        page.locator('.pad').nth(12).click()
        page.locator('#btn-export').click()
        page.wait_for_function("!document.getElementById('download-link').hidden", timeout=60000)
        with page.expect_download() as download:
            page.locator('#download-link').click()
        sampled = Path(input_dir) / 'sampled.wav'
        download.value.save_as(sampled)
        with wave.open(str(sampled), 'rb') as wav:
            assert (wav.getnchannels(), wav.getframerate(), wav.getsampwidth()) == (2,44100,2)
            assert wav.getnframes()>100000
            assert any(b!=0 for b in wav.readframes(40000)), 'sample rendering silent'
        # Reversible source switch keeps the original SYNTH kit and pattern.
        page.locator('#btn-source').click()
        assert page.evaluate('WrongNumberDebug.bankInfo().mode') == 'SYNTH'
        page.locator('#btn-source').click()
        assert page.evaluate('WrongNumberDebug.bankInfo().mode') == 'SAMPLE'
        page.locator('#btn-tape').click()
        page.locator('.pad').nth(6).click()
        page.wait_for_timeout(250)
        page.locator('#btn-tape').click()
        page.wait_for_function("!document.getElementById('download-link').hidden", timeout=60000)
        with page.expect_download() as download:
            page.locator('#download-link').click()
        recorded = Path(input_dir) / 'sample_tape.wav'
        download.value.save_as(recorded)
        with wave.open(str(recorded), 'rb') as wav:
            assert wav.getnframes()>2.5*44100
            assert any(b!=0 for b in wav.readframes(30000)), 'sample tape silent'
    assert not errors, errors
    print('PASS: v0.1.1 regression + FILE sample import / synth switch / SAMPLE loop WAV + SAMPLE TAPE WAV / no exceptions')
    browser.close()
