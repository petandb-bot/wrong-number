"""Browser-level regression checks for LIVE JAM (Chromium, not iPhone hardware)."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import re, math, tempfile, wave, struct
ROOT=Path(__file__).resolve().parents[1]
def setup(browser,w=390,h=740):
    ctx=browser.new_context(viewport={'width':w,'height':h},is_mobile=True,has_touch=True,service_workers='block',accept_downloads=True)
    pg=ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    html=re.sub(r'<script src="(?:audio|icons|app)\.js(?:\?v=[^"]+)?" defer></script>','',(ROOT/'index.html').read_text())
    pg.set_content(html)
    pg.add_style_tag(path=str(ROOT/'style.css'))
    for src in ['audio.js','icons.js','app.js']:pg.add_script_tag(path=str(ROOT/src))
    return pg,ctx,errs

with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--autoplay-policy=no-user-gesture-required'])
 pg,c,e=setup(b)
 assert pg.locator('.pad').count()==16
 assert pg.locator('#btn-dub').count()==1
 assert pg.evaluate('WrongAudio.KIT_TITLES.length')==5
 pg.locator('#kit-prev').tap()
 assert pg.evaluate('WrongNumberDebug.getScene().kit')==4,'Previous-kit arrow did not wrap one kit'
 pg.locator('#kit-next').tap()
 assert pg.evaluate('WrongNumberDebug.getScene().kit')==0
 # Stop -> loop generated; live jam does not alter stored notes.
 pg.locator('#btn-loop').tap()
 assert pg.evaluate('WrongNumberDebug.isPlaying()')
 before=pg.evaluate('WrongNumberDebug.getScene()')
 pg.locator('.pad').nth(6).tap();pg.locator('.pad').nth(9).tap()
 after=pg.evaluate('WrongNumberDebug.getScene()')
 assert before['events']==after['events'],'LIVE JAM unexpectedly edited pattern'
 # Arm DUB, record from pad and note that it is only queued for NEXT pass.
 pg.locator('#btn-dub').tap()
 assert pg.evaluate('WrongNumberDebug.isDubArmed()')
 initial=pg.evaluate('WrongNumberDebug.getScene().events.length')
 pg.locator('.pad').nth(8).tap()
 assert len(pg.evaluate('WrongNumberDebug.pendingDub()'))>=1
 assert pg.evaluate('WrongNumberDebug.getScene().events.length')==initial,'DUB prematurely committed'
 # Tap twice near the same step: should not stack duplicates.
 pg.locator('.pad').nth(8).tap()
 assert pg.evaluate('WrongNumberDebug.pendingDub().length')<=2
 pg.locator('#btn-dub').tap()
 assert not pg.evaluate('WrongNumberDebug.isDubArmed()')
 assert pg.evaluate('WrongNumberDebug.getScene().events.length')>initial
 assert not pg.evaluate('WrongNumberDebug.pendingDub().length')
 # Undo DUB, then restore snapshot behavior.
 pg.locator('#btn-loop').tap()
 assert not pg.evaluate('WrongNumberDebug.isPlaying()')
 pg.locator('#btn-restore').dispatch_event('pointerdown',{'pointerType':'touch','pointerId':18,'button':0})
 pg.wait_for_timeout(630)
 pg.locator('#btn-restore').dispatch_event('pointerup',{'pointerType':'touch','pointerId':18,'button':0})
 assert pg.evaluate('WrongNumberDebug.getScene().events.length')==initial,'Undo did not remove DUB'
 # DUB from STOP starts loop; tapping LOOP stops and saves queued events.
 pg.locator('#btn-dub').tap()
 assert pg.evaluate('WrongNumberDebug.isPlaying() && WrongNumberDebug.isDubArmed()')
 pg.locator('.pad').nth(1).tap()
 pg.locator('#btn-loop').tap()
 assert not pg.evaluate('WrongNumberDebug.isPlaying() || WrongNumberDebug.isDubArmed()')
 assert pg.evaluate('WrongNumberDebug.pendingDub().length')==0
 # Mutate from idle still starts, while playing still changes actual notes.
 pg.locator('#btn-mutate').tap()
 assert pg.evaluate('WrongNumberDebug.isPlaying()')
 first=pg.evaluate('WrongNumberDebug.getScene().events')
 pg.locator('#btn-mutate').tap()
 second=pg.evaluate('WrongNumberDebug.getScene().events')
 assert sorted((x['pad'],x['step']) for x in first)!=sorted((x['pad'],x['step']) for x in second)
 # DUB notes become part of wave export and TAPE.
 pg.locator('#btn-export').tap()
 pg.wait_for_function('!document.querySelector("#download-link").hidden',timeout=75000)
 with tempfile.TemporaryDirectory() as d:
  with pg.expect_download() as task:pg.locator('#download-link').click()
  f=Path(d)/'loop.wav';task.value.save_as(f)
  with wave.open(str(f),'rb') as wav:
   assert wav.getframerate()==44100 and wav.getnchannels()==2
   assert wav.getnframes()>100000
  pg.locator('#btn-close-export').tap()
  pg.locator('#btn-tape').tap();pg.locator('.pad').nth(0).tap();pg.wait_for_timeout(250);pg.locator('#btn-tape').tap()
  pg.wait_for_function('!document.querySelector("#download-link").hidden',timeout=75000)
  with pg.expect_download() as task:pg.locator('#download-link').click()
  f=Path(d)/'tape.wav';task.value.save_as(f)
  with wave.open(str(f),'rb') as wav:assert wav.getframerate()==44100 and wav.getnframes()>20000
  pg.locator('#btn-close-export').tap()
 assert not e,e
 c.close()
 # Layout screenshots and overlap bounds.
 for w,h in [(320,568),(375,667),(390,740),(430,800)]:
  pg,c,e=setup(b,w,h)
  assert not e,e
  dims=pg.evaluate('''() => ({docWidth:document.documentElement.scrollWidth, innerWidth:window.innerWidth,
    shellBottom:document.querySelector('.shell').getBoundingClientRect().bottom,
    screenHeight:innerHeight, buttons:[...document.querySelectorAll('.command')].map(b=>({w:b.getBoundingClientRect().width,scroll:b.scrollWidth}))})''')
  assert dims['docWidth']<=dims['innerWidth']+1,(w,h,dims)
  assert dims['shellBottom']<=dims['screenHeight']+1,(w,h,dims)
  assert all(x['scroll']<=x['w']+1 for x in dims['buttons']),(w,h,dims)
  pg.screenshot(path=str(ROOT/f'v017_{w}x{h}.png'),full_page=True)
  print('layout',w,h,dims)
  c.close()
 b.close()
print('PASS LIVE JAM / DUB / UNDO / MUTATE / WAV / TAPE / LAYOUT')
