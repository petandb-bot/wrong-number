from pathlib import Path
from playwright.sync_api import sync_playwright
import re,wave,struct,math
base=Path(__file__).resolve().parent.parent
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage','--autoplay-policy=no-user-gesture-required'])
 page=b.new_page(viewport={'width':390,'height':740},accept_downloads=True)
 page.set_content(re.sub(r'<script[^>]*src=[^>]*></script>','',(base/'index.html').read_text()))
 page.add_style_tag(content=(base/'style.css').read_text())
 for f in ['audio.js','icons.js','app.js']:page.add_script_tag(content=(base/f).read_text())
 page.evaluate('''()=>{const D=WrongNumberDebug;D.setKit(5);D.fresh(false);D.mutate(false);}''')
 page.evaluate('WrongNumberDebug.exportWav(true)')
 page.wait_for_function("!document.getElementById('download-link').hidden",timeout=20000)
 with page.expect_download() as d:page.locator('#download-link').click()
 download=d.value
 output=base/'WRONG_NUMBER_v0.3.0_BAD_SPELLING_FX_demo.wav'
 download.save_as(output)
 with wave.open(str(output),'rb') as w:
  pcm=w.readframes(w.getnframes());width=w.getsampwidth()
  assert width==2
  values=struct.unpack('<%dh'%(len(pcm)//2),pcm)
  rms=math.sqrt(sum(v*v for v in values[::32])/len(values[::32]))/32768
  peak=max(abs(v) for v in values[::32])/32768
  print('DEMO',str(output), 'seconds',w.getnframes()/w.getframerate(),'rms',round(rms,4),'sample peak',round(peak,4),'bytes',output.stat().st_size)
  assert rms>.001,'demo was silent'
 b.close()
