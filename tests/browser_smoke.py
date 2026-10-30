from pathlib import Path
import json, time, re
from playwright.sync_api import sync_playwright
base=Path(__file__).resolve().parent.parent
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox','--disable-dev-shm-usage','--autoplay-policy=no-user-gesture-required'])
    for width,height in [(320,568),(375,667),(390,740),(430,800)]:
        page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=1,is_mobile=True,has_touch=True)
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        html=(base/'index.html').read_text()
        html=re.sub(r'<script[^>]*src=[^>]*></script>', '', html)
        page.set_content(html,wait_until='domcontentloaded')
        page.add_style_tag(content=(base/'style.css').read_text())
        for name in ['audio.js','icons.js','app.js']:
            page.add_script_tag(content=(base/name).read_text())
        page.wait_for_timeout(400)
        dimensions=page.evaluate('''()=>({scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,shellHeight:document.querySelector('.shell').getBoundingClientRect().height,innerHeight:innerHeight,pads:document.querySelectorAll('.pad').length,slots:document.querySelectorAll('.slot').length})''')
        print('VIEW',width,height,dimensions)
        assert dimensions['pads']==16 and dimensions['slots']==3
        assert dimensions['scrollWidth']<=width+1, f'horizontal overflow {dimensions}'
        assert not errors,errors
        if width==390:
            path=base/'WRONG_NUMBER_v0.3.1_390x740.png'
            page.screenshot(path=str(path),full_page=True)
            page.locator('#display-view').click()
            assert page.locator('#lcd-mode').inner_text()=='PADS 01-04'
            for expected in ['PADS 05-08','PADS 09-12','PADS 13-16']:
                page.locator('#display-view').click()
                assert page.locator('#lcd-mode').inner_text()==expected
            page.locator('#display-view').click()
            assert page.evaluate('WrongNumberDebug.lcdScreen()')=='rabbits'
            page.locator('#btn-new').click()
            page.locator('#slot-a').click()
            assert page.evaluate('WrongNumberDebug.getSlots()[0] !== null')
            page.locator('#kit-next').click()
            page.locator('#slot-b').click()
            assert page.evaluate('WrongNumberDebug.getSlots()[1] !== null')
            # slot recall changes to the previous kit when stopped
            page.locator('#slot-a').click()
            assert page.evaluate('WrongNumberDebug.getSelectedSlot()')==0
            # Rapid hits stress performer and audio cache
            for _ in range(4):
                page.locator('.pad').nth(7).dispatch_event('pointerdown',{'pointerId':17,'pointerType':'touch','button':0})
                page.locator('.pad').nth(7).dispatch_event('pointerup',{'pointerId':17,'pointerType':'touch','button':0})
            # Start a BLANK take and verify undo/dub still respond
            page.locator('#btn-blank').click()
            assert page.evaluate('WrongNumberDebug.isDubArmed()')
            page.locator('#btn-dub').click()
            assert not page.evaluate('WrongNumberDebug.isDubArmed()')
            assert not errors,errors
            # Export has a real offline render; confirm download link is populated
            page.evaluate('WrongNumberDebug.fresh(false)')
            page.evaluate('WrongNumberDebug.exportWav(false)')
            try:
                page.wait_for_function("document.getElementById('download-link').hidden === false",timeout=12000)
                print('EXPORT',page.locator('#download-link').get_attribute('download'))
            except Exception as e:
                print('EXPORT NOT READY',page.locator('#export-status').inner_text(),repr(e))
                raise
            print('390 smoke: passed, errors',errors)
        page.close()
    browser.close()
