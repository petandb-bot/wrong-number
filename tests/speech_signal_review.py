from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent.parent
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page()
 page.set_content('<html></html>')
 page.add_script_tag(content=(root/'audio.js').read_text())
 data=page.evaluate('''async()=>{let results=[];for(let pad=0;pad<16;pad++){
 const c=new OfflineAudioContext(2,Math.floor(44100*.60),44100),g=WrongAudio.graph(c);
 WrongAudio.scheduleKitVoice(g,pad,.018,{kit:5,velocity:.85,seed:1234,color:{broken:.25,space:.27,shift:0}});
 const b=await c.startRendering(),a=b.getChannelData(0);
 let peak=0,sum=0,last=0,activeRms=0,count=0;
 for(let i=0;i<a.length;i++){
  if(Math.abs(a[i])>.005)last=i;
  if(i>900 && i<11000){activeRms+=a[i]*a[i];count++}
  peak=Math.max(peak,Math.abs(a[i]));sum+=a[i]*a[i];
 }
 results.push({pad,name:WrongAudio.KIT_PAD_NAMES[5][pad],peak:+peak.toFixed(3),rms:+Math.sqrt(sum/a.length).toFixed(3),active:+Math.sqrt(activeRms/count).toFixed(3),last:+(last/44100).toFixed(3)});
 }return results;}''')
 for entry in data: print(entry)
 assert all(d['peak']>0.03 and d['peak']<0.90 for d in data)
 assert all(d['last']<.40 for d in data)
 assert all(d['active']>.006 for d in data)
 print('PASS: 16 audible bounded short speech voices')
 browser.close()
