"""v0.1.8: deterministic browser checks. No physical iOS device here."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import re, tempfile, wave, statistics
ROOT=Path(__file__).resolve().parents[1]

def setup(browser, w=390, h=740):
    context=browser.new_context(viewport={'width':w,'height':h},is_mobile=True,has_touch=True,service_workers='block',accept_downloads=True)
    p=context.new_page();errors=[]
    p.on('pageerror',lambda e:errors.append(str(e)))
    html=re.sub(r'<script src="(?:audio|icons|app)\.js\?v=[^"]+" defer></script>','',(ROOT/'index.html').read_text())
    p.set_content(html)
    p.add_style_tag(path=str(ROOT/'style.css'))
    for f in ['audio.js','icons.js','app.js']:p.add_script_tag(path=str(ROOT/f))
    return context,p,errors

with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--autoplay-policy=no-user-gesture-required'])
    ctx,p,errors=setup(browser)
    assert p.locator('.pad').count()==16
    assert p.evaluate('WrongAudio.KIT_TITLES.length')==5
    counts=[]
    for k in range(5):
        p.evaluate(f'WrongNumberDebug.setKit({k})')
        for _ in range(6):
            p.locator('#btn-new').tap()
            s=p.evaluate('WrongNumberDebug.getScene()')
            assert s['groove']=='open'
            assert len(s['events'])<=16,(k,len(s['events']))
            assert len(s['events'])>=10,(k,len(s['events']))
            assert all(0<=e['step']<32 for e in s['events'])
            counts.append(len(s['events']))
    print('open counts',min(counts),max(counts),round(statistics.mean(counts),1))
    # Hold NEW: full generation and no touch-triggered double click.
    p.locator('#btn-new').dispatch_event('pointerdown',{'pointerId':77,'pointerType':'touch','button':0})
    p.wait_for_timeout(720)
    p.locator('#btn-new').dispatch_event('pointerup',{'pointerId':77,'pointerType':'touch','button':0})
    s=p.evaluate('WrongNumberDebug.getScene()')
    assert s['groove']=='full'
    full=len(s['events']);assert full>min(counts),full
    p.locator('#btn-new').tap()
    assert p.evaluate('WrongNumberDebug.getScene().groove')=='open'
    # Mutations rearrange but cannot progressively add notes.
    p.locator('#btn-loop').tap()
    assert p.evaluate('WrongNumberDebug.isPlaying()')
    for _ in range(18):
        a=p.evaluate('WrongNumberDebug.getScene().events')
        p.locator('#btn-mutate').tap()
        b=p.evaluate('WrongNumberDebug.getScene().events')
        assert len(b)<=len(a),(len(a),len(b))
        assert [(e['step'],e['pad']) for e in a]!=[(e['step'],e['pad']) for e in b],'mutation unchanged'
    # JAM is non-destructive; background ducks temporarily after a pad tap.
    before=p.evaluate('WrongNumberDebug.getScene().events')
    p.locator('.pad').nth(5).tap()
    assert before==p.evaluate('WrongNumberDebug.getScene().events')
    # DUB: replace a conflicting note, not stack one on top of it.
    p.locator('#btn-dub').tap();assert p.evaluate('WrongNumberDebug.isDubArmed()')
    # force a known collision by capturing at a controlled clock/phase
    p.evaluate('''() => { WrongNumberDebug.stopLoop(); WrongNumberDebug.startLoop(); }''')
    # stopLoop disarms DUB; arm again
    p.locator('#btn-dub').tap()
    if not p.evaluate('WrongNumberDebug.isDubArmed()'):p.locator('#btn-dub').tap()
    p.locator('.pad').nth(6).tap()
    assert len(p.evaluate('WrongNumberDebug.pendingDub()'))>=1
    p.locator('#btn-dub').tap()
    assert not p.evaluate('WrongNumberDebug.isDubArmed()')
    a=p.evaluate('WrongNumberDebug.getScene().events')
    for e in a:
        assert sum(1 for x in a if x['step']==e['step'])<=2
    assert len(a)<=28
    # LOOP WAV export
    p.locator('#btn-export').tap()
    p.wait_for_function('!document.querySelector("#download-link").hidden',timeout=80000)
    with tempfile.TemporaryDirectory() as d:
        with p.expect_download() as info:p.locator('#download-link').click()
        f=Path(d)/'loop.wav';info.value.save_as(f)
        with wave.open(str(f),'rb') as w:
            assert w.getframerate()==44100 and w.getnchannels()==2 and w.getnframes()>50000
        p.locator('#btn-close-export').tap()
        # Short TAPE captures both loop and manual pad.
        p.locator('#btn-tape').tap();p.locator('.pad').nth(1).tap();p.wait_for_timeout(200)
        p.locator('#btn-tape').tap()
        p.wait_for_function('!document.querySelector("#download-link").hidden',timeout=80000)
        with p.expect_download() as info:p.locator('#download-link').click()
        f=Path(d)/'tape.wav';info.value.save_as(f)
        with wave.open(str(f),'rb') as w:assert w.getframerate()==44100 and w.getnframes()>10000
    assert not errors,errors
    ctx.close()
    # Layout, touch targets, no horizontal overflow.
    for w,h in [(320,568),(375,667),(390,740),(430,800)]:
        ctx,p,errors=setup(browser,w,h)
        result=p.evaluate('''() => ({wide:document.documentElement.scrollWidth,viewport:innerWidth,
        bottom:document.querySelector('.shell').getBoundingClientRect().bottom,
        height:innerHeight, dub:document.querySelector('#btn-dub').getBoundingClientRect().width})''')
        assert result['wide']<=result['viewport']+1,(w,h,result)
        assert result['bottom']<=result['height']+1,(w,h,result)
        assert result['dub']>40
        assert not errors,errors
        p.screenshot(path=str(ROOT/f'v018_{w}x{h}.png'),full_page=True)
        print('layout',w,h,'OK')
        ctx.close()
    browser.close()
print('PASS v0.1.8 OPEN / FULL / MUTATE / DUB / EXPORT / TAPE / UI')
