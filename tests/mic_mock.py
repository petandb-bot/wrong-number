"""Exercise the MIC record/stop/import path with a simulated MediaRecorder.
This is an API-mock test, NOT iPhone / real-hardware microphone validation.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import re
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--autoplay-policy=no-user-gesture-required'])
 page=browser.new_page(viewport={'width':390,'height':844})
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 html=re.sub(r'<script src="(?:audio|sample|app)\.js" defer></script>','',(ROOT/'index.html').read_text())
 page.set_content(html);page.add_style_tag(path=str(ROOT/'style.css'))
 page.add_script_tag(path=str(ROOT/'audio.js'));page.add_script_tag(path=str(ROOT/'sample.js'));page.add_script_tag(path=str(ROOT/'app.js'))
 page.evaluate('''() => {
  Object.defineProperty(window,'isSecureContext',{configurable:true,value:true});
  const fakeStream={getTracks(){return [{stop(){}}]}};
  Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>fakeStream}});
  window.MediaRecorder=class {
   constructor(stream,options){this.stream=stream;this.mimeType='audio/wav';this.state='inactive';}
   static isTypeSupported(){return false;}
   start(){this.state='recording';}
   stop(){this.state='inactive';let n=44100,buf=new ArrayBuffer(44+n*2),dv=new DataView(buf);
    const str=(at,s)=>{for(let i=0;i<s.length;i++)dv.setUint8(at+i,s.charCodeAt(i));};
    str(0,'RIFF');dv.setUint32(4,36+n*2,true);str(8,'WAVE');str(12,'fmt ');dv.setUint32(16,16,true);
    dv.setUint16(20,1,true);dv.setUint16(22,1,true);dv.setUint32(24,44100,true);dv.setUint32(28,88200,true);
    dv.setUint16(32,2,true);dv.setUint16(34,16,true);str(36,'data');dv.setUint32(40,n*2,true);
    for(let i=0;i<n;i++)dv.setInt16(44+i*2,Math.floor(Math.sin(i*.09)*11000),true);
    this.ondataavailable({data:new Blob([buf],{type:'audio/wav'})});this.onstop();}
  };
 }''')
 page.locator('#btn-mic').click();page.wait_for_function("document.getElementById('btn-mic').getAttribute('aria-pressed')==='true'")
 print('MIC mock started',page.locator('#btn-mic').inner_text())
 page.locator('#btn-mic').click();page.wait_for_function('WrongNumberDebug.bankInfo().loaded',timeout=30000)
 print('MIC mock input bank',page.evaluate('WrongNumberDebug.bankInfo()'))
 assert page.evaluate('WrongNumberDebug.bankInfo().mode')=='SAMPLE'
 page.locator('.pad').nth(0).click()
 assert not errors,errors
 print('PASS: simulated MIC permission, start, stop, 16-slice import, SAMPLE pad / no page errors')
 browser.close()
