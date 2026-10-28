"""Check next-cycle DUB commit, sound-ready touch repeats and beat-driven LCD frames."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import re
R=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--autoplay-policy=no-user-gesture-required'])
 ctx=b.new_context(viewport={'width':390,'height':740},is_mobile=True,has_touch=True)
 page=ctx.new_page();errors=[];page.on('pageerror',lambda err:errors.append(str(err)))
 html=re.sub(r'<script src="(?:audio|icons|app)\.js" defer></script>','',(R/'index.html').read_text())
 page.set_content(html);page.add_style_tag(path=str(R/'style.css'))
 for js in ('audio.js','icons.js','app.js'):page.add_script_tag(path=str(R/js))
 page.locator('#btn-loop').tap()
 page.locator('#btn-dub').tap()
 n0=page.evaluate('WrongNumberDebug.getScene().events.length')
 page.locator('.pad').nth(13).tap()
 assert page.evaluate('WrongNumberDebug.pendingDub().length')==1
 # Wait until next two-bar downbeat schedules the pending notes.
 page.wait_for_function('WrongNumberDebug.pendingDub().length===0',timeout=8500)
 n1=page.evaluate('WrongNumberDebug.getScene().events.length')
 assert n1==n0+1,(n0,n1)
 assert page.evaluate('WrongNumberDebug.isDubArmed()')
 page.locator('#btn-dub').tap()
 assert not page.evaluate('WrongNumberDebug.isDubArmed()')
 # Hold during DUB: repeat hits are captured on the grid.
 page.locator('#btn-dub').tap()
 page.locator('.pad').nth(5).dispatch_event('pointerdown',{'pointerId':91,'pointerType':'touch','button':0})
 page.wait_for_timeout(1100)
 page.locator('.pad').nth(5).dispatch_event('pointerup',{'pointerId':91,'pointerType':'touch','button':0})
 held=page.evaluate('WrongNumberDebug.pendingDub()')
 assert len([e for e in held if e['pad']==5])>=2,held
 page.locator('#btn-dub').tap()
 assert page.evaluate('WrongNumberDebug.getScene().events.length')>n1
 assert not errors,errors
 print('PASS automatic cycle commit and hold-overdub, additions:',len(held))
 ctx.close();b.close()
