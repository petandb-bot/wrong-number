"""v0.1.9 release checks: clean beat, manual overdub, undo, UI and WAV."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import re, tempfile, wave
ROOT=Path(__file__).resolve().parents[1]

def setup(browser,w=390,h=740):
    ctx=browser.new_context(viewport={'width':w,'height':h},is_mobile=True,has_touch=True,service_workers='block',accept_downloads=True)
    p=ctx.new_page();errors=[]
    p.on('pageerror',lambda e:errors.append(str(e)))
    html=re.sub(r'<script src="(?:audio|icons|app)\.js\?v=[^"]+" defer></script>','',(ROOT/'index.html').read_text())
    p.set_content(html)
    p.add_style_tag(path=str(ROOT/'style.css'))
    for f in ['audio.js','icons.js','app.js']: p.add_script_tag(path=str(ROOT/f))
    p.wait_for_function('typeof WrongNumberDebug !== "undefined"')
    return ctx,p,errors

with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--autoplay-policy=no-user-gesture-required'])
    ctx,p,errors=setup(browser)
    assert p.locator('.pad').count()==16
    assert p.evaluate('WrongAudio.KIT_TITLES.length')==5
    assert p.locator('#btn-keep').count()==0
    assert p.locator('#btn-blank').count()==1
    # Previous preloaded pattern persists after NEW and LOOP.
    p.locator('#btn-new').tap()
    assert p.locator('#btn-new').evaluate("b=>b.classList.contains('is-new-flash')")
    generated=p.evaluate('WrongNumberDebug.getScene()')
    assert generated['groove']=='open' and len(generated['events'])>=10
    p.locator('#btn-blank').tap()
    empty=p.evaluate('WrongNumberDebug.getScene()')
    assert empty['groove']=='empty' and len(empty['events'])==0
    assert p.evaluate('WrongNumberDebug.isPlaying()') and p.evaluate('WrongNumberDebug.isDubArmed()')
    assert p.locator('#lcd-mode').inner_text() in ('BLANK / BUILD','BUILD ●')
    # No auto-generation when restarting an empty pattern.
    p.locator('#btn-loop').tap()
    assert not p.evaluate('WrongNumberDebug.isPlaying()')
    p.locator('#btn-loop').tap()
    assert p.evaluate('WrongNumberDebug.isPlaying()')
    assert p.evaluate('WrongNumberDebug.getScene().events.length')==0
    p.locator('#btn-dub').tap()
    assert p.evaluate('WrongNumberDebug.isDubArmed()')
    for i in [0,5,7,9,3]: p.locator('.pad').nth(i).tap()
    assert len(p.evaluate('WrongNumberDebug.pendingDub()'))>=2
    p.locator('#btn-dub').tap()
    saved=p.evaluate('WrongNumberDebug.getScene()')
    assert not p.evaluate('WrongNumberDebug.isDubArmed()')
    assert len(saved['events'])>=2 and saved['groove']=='empty'
    # Undo the overdub without breaking blank mode; redo by playing again.
    p.locator('#btn-undo').tap()
    assert p.evaluate('WrongNumberDebug.getScene().events.length')==0
    p.locator('#btn-dub').tap();p.locator('.pad').nth(1).tap();p.locator('#btn-dub').tap()
    added=p.evaluate('WrongNumberDebug.getScene()')
    assert len(added['events'])>=1
    p.locator('#btn-mutate').tap()
    assert p.evaluate('WrongNumberDebug.getScene().events.length')>=1
    p.locator('#btn-undo').tap()
    assert p.evaluate('WrongNumberDebug.getScene().events')==added['events']
    # Export a manually recorded loop.
    p.locator('#btn-export').tap()
    p.wait_for_function('!document.querySelector("#download-link").hidden',timeout=75000)
    with tempfile.TemporaryDirectory() as d:
        with p.expect_download() as info: p.locator('#download-link').click()
        path=Path(d)/'manual.wav';info.value.save_as(path)
        with wave.open(str(path),'rb') as audio:
            assert audio.getframerate()==44100 and audio.getnchannels()==2 and audio.getnframes()>1000
    p.locator('#btn-close-export').tap()
    # After NEW, short and long press still work, including button flash.
    p.locator('#btn-new').tap()
    assert p.evaluate('WrongNumberDebug.getScene().groove')=='open'
    p.locator('#btn-new').dispatch_event('pointerdown',{'pointerId':17,'pointerType':'touch','button':0})
    p.wait_for_timeout(710)
    p.locator('#btn-new').dispatch_event('pointerup',{'pointerId':17,'pointerType':'touch','button':0})
    assert p.evaluate('WrongNumberDebug.getScene().groove')=='full'
    # Undo NEW long hold should return to the preceding open pattern.
    p.locator('#btn-undo').tap()
    assert p.evaluate('WrongNumberDebug.getScene().groove')=='open'
    assert not errors,errors
    ctx.close()
    for w,h in [(320,568),(375,667),(390,740),(430,800)]:
        ctx,p,errors=setup(browser,w,h)
        box=p.evaluate('''() => ({wide:document.documentElement.scrollWidth,viewport:innerWidth,
        bottom:document.querySelector('.shell').getBoundingClientRect().bottom,
        height:innerHeight, blank:document.querySelector('#btn-blank').getBoundingClientRect().width})''')
        assert box['wide']<=box['viewport']+1,(w,h,box)
        assert box['bottom']<=box['height']+1,(w,h,box)
        assert box['blank']>40
        assert not errors,errors
        p.screenshot(path=str(ROOT/f'v019_{w}x{h}.png'),full_page=True)
        ctx.close()
        print('layout',w,h,'OK',box)
    browser.close()
print('BLANK, NEW, DUB, MUTATE, UNDO, WAV and layouts OK')
