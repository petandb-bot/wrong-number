"""Browser regression for the shipped v0.1.5 source (local synthetic origin).
Does not claim validation on actual iPhone hardware."""
import re, tempfile, wave
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--autoplay-policy=no-user-gesture-required'])
 ctx=browser.new_context(viewport={'width':390,'height':740},accept_downloads=True,service_workers='block')
 page=ctx.new_page()
 errors=[]
 page.on('pageerror',lambda err:errors.append(str(err)))
 html=re.sub(r'<script src="(?:audio|icons|app)\.js" defer></script>','',(ROOT/'index.html').read_text())
 page.set_content(html)
 page.add_style_tag(path=str(ROOT/'style.css'))
 page.add_script_tag(path=str(ROOT/'audio.js'))
 page.add_script_tag(path=str(ROOT/'icons.js'))
 page.evaluate('''() => {window.__played=[];const schedule=WrongAudio.scheduleKitVoice;WrongAudio.scheduleKitVoice=(...args)=>{__played.push({pad:args[1],kit:args[3]?.kit});return schedule(...args);};}''')
 page.add_script_tag(path=str(ROOT/'app.js'))
 assert page.locator('.pad').count()==16
 assert page.locator('.pad svg').count()==16
 assert page.locator('#btn-mic').count()==0
 assert page.locator('#btn-file').count()==0
 for kit in range(4):
  assert page.evaluate('WrongNumberDebug.audioState().kit')==kit
  page.locator('.pad').nth(kit).click()
  assert page.evaluate('__played.at(-1).kit')==kit
  if kit<3:page.locator('#kit-next').click()
 assert page.evaluate('WrongNumberDebug.getScene().kit')==3
 page.locator('#btn-new').click()
 page.locator('#btn-loop').click()
 page.wait_for_timeout(220)
 assert page.evaluate('WrongNumberDebug.isPlaying()')
 page.locator('#kit-prev').click()
 page.locator('.pad').nth(0).click()
 page.wait_for_timeout(220)
 assert page.evaluate('__played.some(x=>x.kit===2)')
 page.locator('#btn-mutate').click()
 page.locator('#btn-keep').click()
 kept=page.evaluate('WrongNumberDebug.getScene()')
 page.locator('#kit-next').click()
 page.locator('#btn-restore').click()
 assert page.evaluate('WrongNumberDebug.getScene().kit')==kept['kit']
 page.locator('#btn-loop').click()
 assert not page.evaluate('WrongNumberDebug.isPlaying()')
 with tempfile.TemporaryDirectory() as tmp:
  page.locator('#btn-export').click()
  page.wait_for_function('!document.getElementById("download-link").hidden',timeout=60000)
  with page.expect_download() as result:page.locator('#download-link').click()
  loop=Path(tmp)/'loop.wav';result.value.save_as(loop)
  with wave.open(str(loop),'rb') as w:
   assert w.getnchannels()==2 and w.getframerate()==44100 and w.getsampwidth()==2
   assert w.getnframes()>100000
   assert any(c for c in w.readframes(30000))
  print('LOOP WAV',loop.stat().st_size)
  page.locator('#btn-close-export').click()
  page.locator('#btn-tape').click()
  page.locator('.pad').nth(0).click()
  page.locator('#kit-next').click()
  page.locator('.pad').nth(12).click()
  page.wait_for_timeout(220)
  page.locator('#btn-tape').click()
  page.wait_for_function('!document.getElementById("download-link").hidden',timeout=60000)
  with page.expect_download() as result:page.locator('#download-link').click()
  tape=Path(tmp)/'tape.wav';result.value.save_as(tape)
  with wave.open(str(tape),'rb') as w:
   assert w.getnframes()>2*44100
   assert any(c for c in w.readframes(30000))
  print('TAPE WAV',tape.stat().st_size)
 assert not errors,errors
 print('BROWSER REGRESSION PASSED')
 browser.close()
