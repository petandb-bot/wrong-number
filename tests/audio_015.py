"""Browser AudioContext rendering: ensure 64 pad voices are audible & distinct.
No assumption about native iOS volume / speakers."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import re
ROOT=Path(__file__).resolve().parents[1]

with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--autoplay-policy=no-user-gesture-required'])
 page=browser.new_page(viewport={'width':390,'height':740})
 errors=[];page.on('pageerror',lambda err:errors.append(str(err)))
 html=re.sub(r'<script src="(?:audio|icons|app)\.js" defer></script>','',(ROOT/'index.html').read_text())
 page.set_content(html)
 page.add_style_tag(path=str(ROOT/'style.css'))
 page.add_script_tag(path=str(ROOT/'audio.js'))
 page.add_script_tag(path=str(ROOT/'icons.js'))
 page.add_script_tag(path=str(ROOT/'app.js'))
 summary=page.evaluate('''async () => {
  const results=[];
  for(let k=0;k<4;k++){
   const duration=16*.55+.25,rate=22050;
   const ctx=new OfflineAudioContext(2,Math.ceil(rate*duration),rate);
   const graph=WrongAudio.graph(ctx);
   for(let n=0;n<16;n++) WrongAudio.scheduleKitVoice(graph,n,.05+n*.55,{kit:k,seed:20262026,velocity:.92,color:{broken:.24,space:.27,shift:0}});
   const rendered=await ctx.startRendering(),a=rendered.getChannelData(0);
   const powers=[]; const peaks=[];
   for(let n=0;n<16;n++){
    let sum=0,pk=0,count=0;
    for(let i=Math.floor((n*.55+.055)*rate);i<Math.floor((n*.55+.45)*rate);i++){
      const v=a[i];sum+=v*v;pk=Math.max(pk,Math.abs(v));count++;
    }
    powers.push(Math.sqrt(sum/count));peaks.push(pk);
   }
   results.push({kit:WrongAudio.KIT_TITLES[k],rms:powers.map(v=>+v.toFixed(4)),peaks:peaks.map(v=>+v.toFixed(4)),minRms:Math.min(...powers),maxPeak:Math.max(...peaks)});
  }
  return results;
 }''')
 for a in summary:
  print(a['kit'],'min rms',round(a['minRms'],5),'max pk',round(a['maxPeak'],4),'rms',[round(v,3) for v in a['rms']])
  assert all(v>0.002 for v in a['rms']),a
  assert a['maxPeak']<1.05,a
 assert not errors,errors
 browser.close()
