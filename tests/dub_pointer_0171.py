"""DUB v0.1.7.1 — touch targeting, input de-duplication, recording, accessibility.

Chromium mobile/touch emulation. Not a physical iPhone/WebKit test.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import re

ROOT = Path(__file__).resolve().parents[1]

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox','--autoplay-policy=no-user-gesture-required'])
    for w,h in ((320,568), (375,667), (390,740), (430,800)):
        context = browser.new_context(viewport={'width':w,'height':h},is_mobile=True,has_touch=True,service_workers='block')
        page=context.new_page()
        errors=[]
        page.on('pageerror', lambda exc:errors.append(str(exc)))
        html=(ROOT/'index.html').read_text()
        html=re.sub(r'<script src="(?:audio|icons|app)\.js(?:\?v=[^"]+)?" defer></script>','',html)
        page.set_content(html)
        page.add_style_tag(path=str(ROOT/'style.css'))
        for src in ('audio.js','icons.js','app.js'):
            page.add_script_tag(path=str(ROOT/src))
        dub=page.locator('#btn-dub')
        assert not page.evaluate('WrongNumberDebug.isDubArmed()')
        # Confirm the control really is the topmost hit target at its center.
        target=page.evaluate('''() => {const b=document.querySelector('#btn-dub');const r=b.getBoundingClientRect();
            const x=r.left+r.width/2,y=r.top+r.height/2;
            const hit=document.elementFromPoint(x,y);
            return {x,y,height:r.height,top:y>=0&&y<=innerHeight,
                found:!!(hit&&(hit===b||b.contains(hit))), hit:hit?.id||hit?.tagName};}''')
        assert target['top'] and target['found'] and target['height']>=44,(w,h,target)
        # A tap fires pointerup followed by synthetic click. Result must be ONE toggle.
        dub.tap()
        assert page.evaluate('WrongNumberDebug.isDubArmed()'),(w,h,'tap did not arm')
        assert dub.get_attribute('aria-pressed')=='true'
        assert 'RECORDING' in dub.inner_text()
        assert page.evaluate('WrongNumberDebug.isPlaying()')
        page.locator('.pad').nth(9).tap()
        assert page.evaluate('WrongNumberDebug.pendingDub().length')>=1
        dub.tap()
        assert not page.evaluate('WrongNumberDebug.isDubArmed()'),(w,h,'tap did not disarm')
        assert dub.get_attribute('aria-pressed')=='false'
        assert page.evaluate('WrongNumberDebug.pendingDub().length')==0
        # A drag/cancel must never toggle the recording state.
        for action in ('pointercancel','pointerup'):
            dub.dispatch_event('pointerdown',{'pointerId':901,'pointerType':'touch','button':0,'clientX':10,'clientY':10})
            dub.dispatch_event(action,{'pointerId':901,'pointerType':'touch','button':0,'clientX':150,'clientY':150})
            assert not page.evaluate('WrongNumberDebug.isDubArmed()'),(w,h,action)
        # Keyboard/accessibility clicks still toggle even without any pointerdown.
        dub.focus()
        page.keyboard.press('Enter')
        assert page.evaluate('WrongNumberDebug.isDubArmed()'),(w,h,'keyboard did not arm')
        page.keyboard.press('Enter')
        assert not page.evaluate('WrongNumberDebug.isDubArmed()'),(w,h,'keyboard did not disarm')
        assert not errors,(w,h,errors)
        print('PASS touch/pointer/keyboard + screen hit target',w,h,target)
        context.close()
    browser.close()
print('PASS DUB v0.1.7.1')
