from pathlib import Path
from playwright.sync_api import sync_playwright
import re
base=Path(__file__).resolve().parent.parent
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage','--autoplay-policy=no-user-gesture-required'])
    page=browser.new_page(viewport={'width':390,'height':740},is_mobile=True,has_touch=True)
    errors=[];page.on('pageerror',lambda err:errors.append(str(err)))
    html=re.sub(r'<script[^>]*src=[^>]*></script>','',(base/'index.html').read_text())
    page.set_content(html,wait_until='domcontentloaded')
    page.add_style_tag(content=(base/'style.css').read_text())
    for f in ['audio.js','icons.js','app.js']:page.add_script_tag(content=(base/f).read_text())
    result=page.evaluate('''async()=>{
      const D=window.WrongNumberDebug;
      D.playPad(9); // initialize live audio context
      D.prewarmGesture(9);
      let success=false;
      for(let i=0;i<36;i++){
        await new Promise(resolve=>setTimeout(resolve,150));
        success=D.performGestureFx(9,awaitTime(),0,.8);
        if(success)break;
      }
      function awaitTime(){return window.WrongAudio?0.3:0.3;}
      return {success,slots:D.getSlots().length,steps:D.stepGroup()};
    }''')
    print('GESTURE',result)
    assert result['success'],'Performance FX failed to generate a real sound source'
    result=page.evaluate('''()=>{
      const D=window.WrongNumberDebug;
      D.startTape();
      for(let i=0;i<6;i++)D.playPad(9);
      return {kinds:D.getTapeEventKinds(), fx:D.getTapeEventKinds().filter(k=>k==='fx').length};
    }''')
    print('LIVE TAKE',result)
    assert result['fx']>=1, 'Gestural FX did not enter TAPE capture'
    page.wait_for_timeout(1000)
    page.evaluate('WrongNumberDebug.stopTape()')
    page.wait_for_function("document.getElementById('download-link').hidden === false",timeout=20000)
    print('TAPE',page.locator('#download-link').get_attribute('download'),page.locator('#export-status').inner_text())
    assert not errors,errors
    browser.close()
