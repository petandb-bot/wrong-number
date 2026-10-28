"""Local Chromium checks for v0.1.6, not an iPhone hardware test."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import re, tempfile, wave, math
ROOT=Path(__file__).resolve().parents[1]

def page_setup(browser,w=390,h=740,touch=True):
 context=browser.new_context(viewport={'width':w,'height':h},is_mobile=touch,has_touch=touch,accept_downloads=True,service_workers='block')
 page=context.new_page()
 issues=[];page.on('pageerror',lambda e:issues.append(str(e)))
 html=re.sub(r'<script src="(?:audio|icons|app)\.js" defer></script>','',(ROOT/'index.html').read_text())
 page.set_content(html)
 for file in ['style.css','audio.js','icons.js','app.js']:
  (page.add_style_tag if file.endswith('css') else page.add_script_tag)(path=str(ROOT/file))
 return page,context,issues

with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--autoplay-policy=no-user-gesture-required'])
 page,ctx,issues=page_setup(b)
 assert page.locator('.pad').count()==16
 assert page.evaluate('WrongAudio.KIT_TITLES.length')==5
 assert page.evaluate('WrongAudio.KIT_TITLES[3]')=='ROTTEN CARROT'
 assert page.locator('svg').count()==16
 # Regression: MUTATE from stop creates real, playing events.
 assert not page.evaluate('WrongNumberDebug.isPlaying()')
 page.locator('#btn-mutate').tap()
 assert page.evaluate('WrongNumberDebug.isPlaying()'),'MUTATE from idle did not start playback'
 first=page.evaluate('WrongNumberDebug.getScene()')
 assert first['events']
 assert 'MUTATE' in page.locator('#status-text').inner_text()
 # Mutation while playing must alter rhythm or instrument, not merely metadata/seed.
 for _ in range(4):
  page.locator('#btn-mutate').tap()
  nxt=page.evaluate('WrongNumberDebug.getScene()')
  f=lambda scene:sorted((e['step'],e['pad']) for e in scene['events'])
  assert f(first)!=f(nxt), 'MUTATE did not alter the audible pattern'
  assert page.evaluate('WrongNumberDebug.isPlaying()')
  first=nxt
 # Hold long enough to reach 'wild' mutation (touch pointer).
 page.locator('#btn-mutate').dispatch_event('pointerdown',{'pointerId':12,'pointerType':'touch','button':0})
 page.wait_for_timeout(660)
 page.locator('#btn-mutate').dispatch_event('pointerup',{'pointerId':12,'pointerType':'touch','button':0})
 assert 'WILD' in page.locator('#status-text').inner_text()
 # Undo, snapshot, kit switches: all keep pattern and tempo compatible.
 page.locator('#btn-keep').tap()
 page.locator('#btn-loop').tap()
 assert not page.evaluate('WrongNumberDebug.isPlaying()')
 for kit in range(5):
  assert page.evaluate('WrongNumberDebug.getScene().kit')==kit
  page.locator('.pad').nth(kit).tap()
  if kit<4:page.locator('#kit-next').tap()
 assert page.locator('#btn-source').inner_text()=='WORM PARADE'
 page.locator('#btn-restore').tap()
 assert page.evaluate('WrongNumberDebug.getScene().kit')==0
 # Export and tape still work.
 page.locator('#btn-export').tap()
 page.wait_for_function('!document.querySelector("#download-link").hidden',timeout=60000)
 with tempfile.TemporaryDirectory() as d:
  with page.expect_download() as task:page.locator('#download-link').click()
  loop=Path(d)/'loop.wav';task.value.save_as(loop)
  with wave.open(str(loop),'rb') as wf:
   assert wf.getframerate()==44100 and wf.getnchannels()==2 and wf.getnframes()>100000
  page.locator('#btn-close-export').tap()
  page.locator('#btn-tape').tap();page.locator('#kit-next').tap();page.locator('.pad').nth(0).tap()
  page.wait_for_timeout(170)
  page.locator('#btn-tape').tap()
  page.wait_for_function('!document.querySelector("#download-link").hidden',timeout=60000)
  with page.expect_download() as task:page.locator('#download-link').click()
  tape=Path(d)/'tape.wav';task.value.save_as(tape)
  with wave.open(str(tape),'rb') as wf:assert wf.getnframes()>88200
  print('LOOP bytes',loop.stat().st_size,'TAPE bytes',tape.stat().st_size)
 assert not issues,issues
 ctx.close()
 # Visuals in narrow/mobile viewports. Full-page screenshot and shell bounds.
 for w,h in [(320,568),(375,667),(390,740),(430,800)]:
  pg,cx,errs=page_setup(b,w,h)
  pg.wait_for_timeout(330)
  result=pg.evaluate('''() => ({w:innerWidth,scroll:document.documentElement.scrollWidth,deviceBottom:document.querySelector('.shell').getBoundingClientRect().bottom,viewport:innerHeight})''')
  print('FIT',w,h,result)
  assert result['scroll']<=result['w']+1,result
  assert result['deviceBottom']<=h+3,(w,h,result)
  pg.screenshot(path=str(ROOT/f'v016_{w}x{h}.png'),full_page=True)
  assert not errs,errs
  cx.close()
 b.close()
print('REGRESSION PASS')
