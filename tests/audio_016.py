"""Measure 5 x 16 synthesized voices in real browser OfflineAudioContext."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import re
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=b.new_page()
 page.add_script_tag(path=str(ROOT/'audio.js'))
 data=page.evaluate('''async()=>{
  const output=[];
  for(let kit=0;kit<5;kit++){
    const rate=22050,beat=.63,ctx=new OfflineAudioContext(2,Math.ceil(16*beat*rate),rate);
    const graph=WrongAudio.graph(ctx);
    for(let pad=0;pad<16;pad++)WrongAudio.scheduleKitVoice(graph,pad,.05+pad*beat,{kit,seed:10302,velocity:.85,color:{broken:.25,space:.26,shift:0}});
    const buffer=await ctx.startRendering(),channel=buffer.getChannelData(0);
    let minRms=999,maxPeak=0;
    const perPad=[];
    for(let pad=0;pad<16;pad++){
      let sum=0,p=0,n=0;
      const from=Math.floor((pad*beat+.06)*rate),to=Math.floor((pad*beat+.46)*rate);
      for(let i=from;i<to;i++){const v=channel[i];sum+=v*v;p=Math.max(p,Math.abs(v));n++;}
      let rms=Math.sqrt(sum/n);perPad.push(rms);minRms=Math.min(minRms,rms);maxPeak=Math.max(maxPeak,p);
    }
    output.push({name:WrongAudio.KIT_TITLES[kit],minRms,maxPeak,perPad});
  }
  return output;
}''')
 for item in data:
  print(item['name'],'min RMS',round(item['minRms'],5),'peak',round(item['maxPeak'],4))
  assert all(v>.0015 for v in item['perPad']),item
  assert item['maxPeak']<1.08,item
 b.close()
print('AUDIO PASS')
