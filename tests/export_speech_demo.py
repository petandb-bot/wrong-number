from pathlib import Path
import base64
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent.parent
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=b.new_page()
 page.set_content('<html></html>')
 page.add_script_tag(content=(root/'audio.js').read_text())
 audio=page.evaluate('''async()=>{
 const sr=44100,dur=8.6,ctx=new OfflineAudioContext(2,Math.ceil(dur*sr),sr),g=WrongAudio.graph(ctx);
 const pattern=[0,1,2,3,8,9,10,11,4,5,6,7,12,13,14,15,0,8,4,10,2,14,6,12];
 pattern.forEach((pad,i)=>WrongAudio.scheduleKitVoice(g,pad,.10+i*.32,{kit:5,seed:345+pad,velocity:i%4===0?.85:.68,color:{broken:.28,space:.2,shift:0}}));
 const rendered=await ctx.startRendering(),blob=WrongAudio.audioBufferToWav(rendered,0,Math.floor(dur*sr));
 const bytes=new Uint8Array(await blob.arrayBuffer());let str='';for(let i=0;i<bytes.length;i+=8192)str+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(str);
 }''')
 out=root/'WRONG_NUMBER_v0.3.1_BAD_SPELLING_chip_voices.wav'
 out.write_bytes(base64.b64decode(audio))
 print('WAV',out,'size',out.stat().st_size)
 b.close()
