/* WRONG NUMBER v0.1.1 — pocket instrument
 * Timing: Web Audio's currentTime, with a 25ms look-ahead scheduler.
 * Screen: p5.js v1.11.13 when available, local Canvas fallback offline.
 * Playback: all synthesis and mutations remain local to the browser.
 */
(()=>{'use strict';
const A=window.WrongAudio; if(!A){document.body.textContent='AUDIO ENGINE FAILED';return;}
const $=id=>document.getElementById(id), N=32, STORE='wrong-number-session-0.1', KEEP='wrong-number-kept-0.1';
const MAX_TAPE_SECONDS=30, TAPE_TAIL_SECONDS=2.5;
const randomSeed=()=>((Math.random()*0xffffffff)>>>0);
const deepCopy=v=>JSON.parse(JSON.stringify(v));
const getSaved=k=>{try{return JSON.parse(localStorage.getItem(k));}catch{return null;}};
const newScene=()=>({bpm:92,seed:randomSeed(),color:{broken:.24,space:.27,shift:0},events:[]});
function validateScene(raw){
 if(!raw||typeof raw!=='object'||!Array.isArray(raw.events))return null;
 return {bpm:A.clamp(Number(raw.bpm)||92,48,180),seed:(raw.seed>>>0)||3,color:{broken:A.clamp(Number(raw.color?.broken)||.18,0,1),space:A.clamp(Number(raw.color?.space)||.25,0,1),shift:A.clamp(Number(raw.color?.shift)||0,-2,2)},events:raw.events.slice(0,64).filter(e=>Number.isInteger(e.step)&&e.step>=0&&e.step<N&&Number.isInteger(e.pad)&&e.pad>=0&&e.pad<16).map(e=>({step:e.step,pad:e.pad,velocity:A.clamp(Number(e.velocity)||.85,.2,1),variant:(e.variant>>>0)||1}))};
}
let scene=validateScene(getSaved(STORE))||newScene(),checkpoint=validateScene(getSaved(KEEP));
let live=null,engine=null,isPlaying=false,scheduler=null,nextStep=0,nextTick=0,loopStarted=0,perfCounter=0,lastPadAt=new Map(),recent=[],downPointers=new Map(),pulseUntil=new Array(16).fill(0),lastPad=-1,displayMessage='READY / TOUCH A PAD',messageUntil=0,renderBusy=false,wavUrl=null,wavFile=null,tape=null,tapeClock=null,undoStack=[];
let stateAt=()=>live?.currentTime??0;
const stepSeconds=()=>60/scene.bpm/4,cycleSeconds=()=>N*stepSeconds();
function updateText(){
 $('tempo-value').innerHTML=String(scene.bpm).padStart(3,'0')+' <small>BPM</small>';
 $('lcd-mode').textContent=isPlaying?'LOOPING':(checkpoint?'MEMORY OK':'AWAKE?');
 $('btn-loop').setAttribute('aria-pressed',String(isPlaying));
 $('live-message').textContent=`${scene.events.length.toString().padStart(2,'0')} EVENTS / SEED ${scene.seed.toString(16).slice(-4).toUpperCase()}`;
}
function message(s,seconds=1.7){displayMessage=s;messageUntil=performance.now()+seconds*1000;$('status-text').textContent=s;}
function persist(){try{localStorage.setItem(STORE,JSON.stringify(scene));}catch{message('STORAGE UNAVAILABLE');}updateText();}
function ensureAudio(){
 try{
  if(!live||live.state==='closed'){
   live=new (window.AudioContext||window.webkitAudioContext)({latencyHint:'interactive'});engine=A.graph(live);
  }
  if(live.state!=='running')live.resume().catch(()=>message('AUDIO INTERRUPTED / TAP AGAIN',3));
  return true;
 }catch(err){console.error(err);message('AUDIO NOT SUPPORTED',4);return false;}
}
function pulse(pad,time=performance.now()){pulseUntil[pad]=time+125;lastPad=pad;const btn=$('pads').children[pad];if(btn){btn.classList.add('is-pulse');setTimeout(()=>{if(performance.now()>=pulseUntil[pad]-12)btn.classList.remove('is-pulse');},145);}}
function synth(pad,when,velocity=.9,options={}){
 if(!engine)return;
 const time=Math.max(when,live.currentTime+.001);
 const params={seed:options.seed??(scene.seed ^ (++perfCounter*98923)),velocity,color:{...(options.color||scene.color)},hold:!!options.hold,fire:!!options.fire};
 A.scheduleVoice(engine,pad,time,params);
 // TAPE stores the exact voice instructions, including live pad hits, repeats and
 // scheduled loop notes. No microphone and no compressed browser recording.
 if(tape && time>=tape.startedAt && time<tape.startedAt+MAX_TAPE_SECONDS){
  tape.events.push({pad,at:time-tape.startedAt,params});
 }
 const ms=(time-live.currentTime)*1000;
 if(ms>10)setTimeout(()=>pulse(pad),ms);else pulse(pad);
}
function playPad(pad,options={}){
 if(!ensureAudio())return;
 const now=stateAt(),last=lastPadAt.get(pad)??-100;
 const rapid=now-last<.25;lastPadAt.set(pad,now);
 synth(pad,now+.003,options.hold?.50:(rapid?.70:.92),{hold:options.hold,fire:rapid||options.hold});
 if(!options.hold){
  recent.push({pad,time:now,velocity:rapid?.72:.90,variant:perfCounter});
  recent=recent.filter(e=>e.time>=now-25).slice(-100);
  if(isPlaying){ // Add a quantized event to the loop, audible on the next cycle.
   const pos=((now-loopStarted)%cycleSeconds()+cycleSeconds())%cycleSeconds();
   const step=Math.round(pos/stepSeconds())%N;
   scene.events.push({pad,step,velocity:.88,variant:randomSeed()});
   scene.events=scene.events.slice(-64);persist();
  }
 }
 message(options.hold?`HOLD / ${A.KIT_NAMES[pad]}`:`${String(pad+1).padStart(2,'0')} / ${A.KIT_NAMES[pad]}`,1.1);
}
function renderPads(){
 const container=$('pads');container.innerHTML='';
 A.KIT_NAMES.forEach((name,index)=>{
  const b=document.createElement('button');b.className='pad';b.type='button';b.setAttribute('aria-label',`${index+1} ${name}`);
  b.innerHTML=`<span class="pad-no">${String(index+1).padStart(2,'0')}</span><span class="pad-tick"></span><span class="pad-name">${name}</span>`;
  b.addEventListener('pointerdown',event=>{
   if(event.button!==0&&event.pointerType==='mouse')return;
   event.preventDefault();try{b.setPointerCapture(event.pointerId);}catch{}
   b.classList.add('is-down');playPad(index);
   const item={pad:index,interval:null,timeout:null};
   item.timeout=setTimeout(()=>{
    item.interval=setInterval(()=>playPad(index,{hold:true}),125);
    playPad(index,{hold:true});
   },370);downPointers.set(event.pointerId,item);
  });
  const release=event=>{const item=downPointers.get(event.pointerId);if(!item)return;clearTimeout(item.timeout);clearInterval(item.interval);downPointers.delete(event.pointerId);b.classList.remove('is-down');};
  b.addEventListener('pointerup',release);b.addEventListener('pointercancel',release);b.addEventListener('lostpointercapture',release);
  container.appendChild(b);
 });
}
function generate(seed=randomSeed()){
 const r=A.rng(seed),events=[],add=(step,pad,velocity=.85)=>events.push({step,pad,velocity,variant:(r()*0xffffffff)>>>0});
 for(let bar=0;bar<2;bar++){
  const o=bar*16;
  add(o,bar===0?0:(r()<.65?0:1),.9);
  if(r()<.9)add(o+8,r()<.7?0:3,.88);
  if(r()<.66)add(o+11,r()<.65?2:1,.72);
  for(let s=0;s<16;s+=2)if(r()<.67)add(o+s+(r()<.1?1:0),r()<.52?4:5,.48+r()*.29);
  [4,12].forEach(s=>{if(r()<.91)add(o+s,r()<.57?7:6,.58+r()*.22);});
  for(let j=0;j<4;j++)if(r()<.6)add(o+Math.floor(r()*16),8+Math.floor(r()*8),.47+r()*.32);
 }
 return events.slice(0,56);
}
function captureRecent(){
 const now=stateAt(),input=recent.filter(x=>x.time>now-14);
 if(!input.length)return generate(scene.seed);
 const first=input[0].time,stepDur=stepSeconds();
 const fromHands=input.map(e=>({step:Math.round((e.time-first)/stepDur)%N,pad:e.pad,velocity:e.velocity,variant:e.variant}));
 // With very little input, build an unobtrusive supporting pattern.
 if(fromHands.length<4){const background=generate(scene.seed).filter(e=>(e.pad===4||e.pad===7||e.pad===14||(e.pad<4&&e.step>=8))).slice(0,14);return [...fromHands,...background];}
 return fromHands.slice(0,56);
}
function stopLoop(){isPlaying=false;clearInterval(scheduler);scheduler=null;nextStep=0;message('LOOP STOPPED');updateText();}
function startLoop(){
 if(!ensureAudio())return;
 if(scene.events.length===0)scene.events=captureRecent();
 isPlaying=true;nextStep=0;nextTick=stateAt()+.08;loopStarted=nextTick;
 scheduler=setInterval(scheduleAhead,25);scheduleAhead();persist();message('LOOP / 2 BARS');updateText();
}
function scheduleAhead(){
 if(!isPlaying||!live||live.state!=='running')return;
 if(nextTick<stateAt()-.40){nextTick=stateAt()+.07;nextStep=0;loopStarted=nextTick;}
 let guard=0;
 while(nextTick<stateAt()+.14 && guard++<12){
  const step=nextStep,time=nextTick;
  const stepEvents=scene.events.filter(e=>e.step===step);
  for(const e of stepEvents){synth(e.pad,time,e.velocity,{seed:(scene.seed^e.variant^e.step)>>>0,color:scene.color});}
  $('beat-readout').textContent=`${String(1+Math.floor(step/16))}:${String(1+Math.floor(step%16/4)).padStart(2,'0')}`;
  nextStep=(step+1)%N;nextTick+=stepSeconds();
  if(nextStep===0)loopStarted=nextTick;
 }
}
function rememberUndo(){undoStack.push(deepCopy(scene));if(undoStack.length>8)undoStack.shift();}
function resetPlayhead(){if(isPlaying){nextStep=0;nextTick=stateAt()+.07;loopStarted=nextTick;}}
function undo(){
 if(!undoStack.length){message('NO EARLIER MUTATION');return;}
 scene=undoStack.pop();resetPlayhead();persist();message('BACK / PREVIOUS VERSION');
}
function mutate(strong=false){
 rememberUndo();
 const r=A.rng(scene.seed^randomSeed());
 if(!scene.events.length)scene.events=generate(scene.seed);
 const old=scene.events,amount=strong?.64:.29,changed=[];
 for(const e of old){
  const anchor=e.pad<4&&(e.step%8===0);const chance=r();
  if(!anchor&&chance<amount*.28)continue;
  const item={...e};
  if(!anchor&&r()<amount){item.step=(item.step+(r()<.5?-1:1)*(1+Math.floor(r()*(strong?5:2)))+N)%N;}
  if(!anchor&&r()<amount*.42)item.pad=Math.floor(item.pad/4)*4+Math.floor(r()*4);
  item.velocity=A.clamp(item.velocity+(r()-.5)*(strong?.35:.16),.25,1);
  item.variant=((item.variant^((r()*0xffffffff)>>>0))>>>0);
  changed.push(item);
 }
 const extra=Math.max(2,Math.round(old.length*(strong?.36:.13)));
 for(let i=0;i<extra;i++){
  const group=r()<.23?0:r()<.45?1:r()<.7?2:3;
  changed.push({step:Math.floor(r()*N),pad:group*4+Math.floor(r()*4),velocity:.38+r()*.48,variant:(r()*0xffffffff)>>>0});
 }
 scene.events=changed.slice(0,64);
 scene.seed=randomSeed();scene.color.broken=A.clamp(scene.color.broken+(r()-.44)*(strong?.62:.29),.05,.92);
 scene.color.space=A.clamp(scene.color.space+(r()-.49)*(strong?.44:.23),.05,.85);
 scene.color.shift=A.clamp(scene.color.shift+(r()-.5)*(strong?2:.65),-1.6,1.6);
 persist();message(strong?'MUTATION / HEAVY':'MUTATION / LIGHT');
}
function keep(){checkpoint=deepCopy(scene);try{localStorage.setItem(KEEP,JSON.stringify(checkpoint));}catch{}message('SNAPSHOT KEPT');updateText();}
function restore(){if(!checkpoint){message('NO SNAPSHOT YET');return;}scene=deepCopy(checkpoint);resetPlayhead();persist();message('SNAPSHOT RESTORED');}
function fresh(){rememberUndo();scene={...newScene(),bpm:scene.bpm};scene.events=generate(scene.seed);resetPlayhead();persist();message('NEW GROOVE');}
function tempo(delta){scene.bpm=A.clamp(scene.bpm+delta,48,180);persist();message(`${scene.bpm} BPM`,.8);}
function bindControls(){
 $('btn-loop').addEventListener('click',()=>isPlaying?stopLoop():startLoop());
 $('tempo-down').addEventListener('click',()=>tempo(-2));$('tempo-up').addEventListener('click',()=>tempo(2));
 $('btn-keep').addEventListener('click',keep);$('btn-new').addEventListener('click',fresh);
 const restoreButton=$('btn-restore');let restoreDown=0;
 restoreButton.addEventListener('pointerdown',()=>{restoreDown=performance.now();});
 restoreButton.addEventListener('click',()=>{const long=restoreDown&&performance.now()-restoreDown>=650;restoreDown=0;if(long)undo();else restore();});
 $('btn-tape').addEventListener('click',()=>tape?stopTape():startTape());
 const m=$('btn-mutate');let holdStart=0;
 m.addEventListener('pointerdown',()=>{holdStart=performance.now();});
 m.addEventListener('click',()=>{const strong=holdStart&&performance.now()-holdStart>=650;holdStart=0;mutate(strong);});
 $('btn-export').addEventListener('click',exportWav);
 $('btn-share').addEventListener('click',async()=>{if(!wavFile)return;try{await navigator.share({files:[wavFile],title:'WRONG NUMBER LOOP'});}catch(err){if(err.name!=='AbortError')message('SHARE FAILED / USE DOWNLOAD',3);}});
 const keys='1234qwerasdfzxcv';const held=new Set();
 window.addEventListener('keydown',e=>{if(e.altKey||e.ctrlKey||e.metaKey||e.repeat||e.target.matches('input,textarea'))return;const k=e.key.toLowerCase(),pad=keys.indexOf(k);if(pad===-1||held.has(k))return;e.preventDefault();held.add(k);$('pads').children[pad].classList.add('is-down');playPad(pad);});
 window.addEventListener('keyup',e=>{const k=e.key.toLowerCase(),pad=keys.indexOf(k);held.delete(k);if(pad!==-1)$('pads').children[pad].classList.remove('is-down');});
 document.addEventListener('visibilitychange',()=>{
  if(document.hidden){if(tape)stopTape();if(isPlaying){stopLoop();message('PAUSED / RETURN & TAP LOOP',3);}}
  else if(live&&live.state!=='running'){message('TAP ANY PAD TO REARM AUDIO',4);}
 });
}
// Reusable WAV result UI. Both the seamless two-bar loop and TAPE share it.
function prepareRender(label){
 renderBusy=true;
 $('export-panel').hidden=false;$('download-link').hidden=true;$('btn-share').hidden=true;
 $('export-status').textContent=label;
 $('btn-export').disabled=true;$('btn-tape').disabled=true;
}
function completeRender(blob,filename,description){
 if(wavUrl)URL.revokeObjectURL(wavUrl);
 wavUrl=URL.createObjectURL(blob);
 wavFile=new File([blob],filename,{type:'audio/wav'});
 const link=$('download-link');link.href=wavUrl;link.download=filename;link.hidden=false;
 let canShare=false;
 try{canShare=!!(navigator.share&&navigator.canShare&&navigator.canShare({files:[wavFile]}));}catch{}
 $('btn-share').hidden=!canShare;
 $('export-status').textContent=`READY / ${(blob.size/1048576).toFixed(1)} MB / ${description}`;
 message('WAV READY / TAP DOWNLOAD',5);
}
function finishRender(){renderBusy=false;$('btn-export').disabled=false;$('btn-tape').disabled=false;}
async function exportWav(){
 if(renderBusy)return;
 if(tape){message('STOP TAPE BEFORE LOOP EXPORT',3);return;}
 if(!scene.events.length){scene.events=captureRecent();persist();}
 const snapshot=deepCopy(scene); // UI edits during render must not change the file.
 prepareRender('RENDERING LOOP / WAV...');message('RENDERING LOOP',3);
 await new Promise(resolve=>setTimeout(resolve,30));
 try{
  const sampleRate=44100,duration=N*60/snapshot.bpm/4,framesPerCycle=Math.round(duration*sampleRate);
  const ctx=new (window.OfflineAudioContext||window.webkitOfflineAudioContext)(2,framesPerCycle*3+Math.ceil(sampleRate*.12),sampleRate);
  const g=A.graph(ctx),stepDuration=60/snapshot.bpm/4,baseline=.035;
  // Use the middle cycle to preserve reverb and delay wrapping over the seam.
  for(let cycle=0;cycle<3;cycle++){
   for(const ev of snapshot.events){const t=baseline+cycle*duration+ev.step*stepDuration;
    A.scheduleVoice(g,ev.pad,t,{seed:(snapshot.seed^ev.variant^ev.step)>>>0,velocity:ev.velocity,color:snapshot.color});}
  }
  const rendered=await ctx.startRendering();
  const start=Math.round((baseline+duration)*sampleRate),end=start+framesPerCycle;
  const blob=A.audioBufferToWav(rendered,start,end);
  completeRender(blob,`wrong-number_${snapshot.bpm}bpm_${snapshot.seed.toString(16).slice(0,6)}.wav`,'TWO BARS');
 }catch(err){console.error(err);$('export-status').textContent='EXPORT FAILED / '+String(err?.message||err).slice(0,90);message('WAV EXPORT FAILED',4);}
 finally{finishRender();}
}
function updateTapeClock(){
 if(!tape)return;
 const elapsed=Math.min(MAX_TAPE_SECONDS,Math.max(0,stateAt()-tape.startedAt));
 $('btn-tape').textContent=`● ${String(Math.floor(elapsed)).padStart(2,'0')}s`;
 if(elapsed>=MAX_TAPE_SECONDS){stopTape();}
}
function startTape(){
 if(renderBusy||tape)return;
 if(!ensureAudio())return;
 tape={startedAt:stateAt(),events:[]};
 $('btn-tape').classList.add('is-recording');$('btn-tape').setAttribute('aria-pressed','true');
 $('btn-tape').textContent='● 00s';
 tapeClock=setInterval(updateTapeClock,200);
 message('TAPE / RECORDING / 30S MAX',2);
}
async function stopTape(){
 if(!tape)return;
 clearInterval(tapeClock);tapeClock=null;
 const recording=tape;tape=null;
 const length=Math.min(MAX_TAPE_SECONDS,Math.max(.10,stateAt()-recording.startedAt));
 $('btn-tape').classList.remove('is-recording');$('btn-tape').setAttribute('aria-pressed','false');
 $('btn-tape').textContent='● TAPE';
 if(!recording.events.length){message('TAPE EMPTY / NOTHING TO SAVE',3);return;}
 // A small time allowance includes notes scheduled just ahead of the stop tap.
 const notes=recording.events.filter(e=>e.at>=0 && e.at<length);
 if(!notes.length){message('TAPE EMPTY / NOTHING TO SAVE',3);return;}
 prepareRender('RENDERING TAPE / WAV...');message('RENDERING TAPE',3);
 await new Promise(resolve=>setTimeout(resolve,30));
 try{
  const sampleRate=44100,offset=.035,total=length+TAPE_TAIL_SECONDS;
  const frames=Math.ceil((offset+total)*sampleRate);
  const ctx=new (window.OfflineAudioContext||window.webkitOfflineAudioContext)(2,frames,sampleRate);
  const g=A.graph(ctx);
  for(const note of notes){
   A.scheduleVoice(g,note.pad,offset+note.at,{...note.params});
  }
  const rendered=await ctx.startRendering();
  const first=Math.floor(offset*sampleRate);
  const blob=A.audioBufferToWav(rendered,first,first+Math.floor(total*sampleRate));
  completeRender(blob,`wrong-number_tape_${Math.round(length)}s_${Date.now()}.wav`,`${Math.round(length)}S TAPE + TAIL`);
 }catch(err){console.error(err);$('export-status').textContent='TAPE EXPORT FAILED / '+String(err?.message||err).slice(0,90);message('TAPE EXPORT FAILED',4);}
 finally{finishRender();}
}
// LCD renderer. Uses a logical pixel grid to evoke LCD hardware without scanline-heavy decoration.
function paint(ctx,w,h){
 const t=performance.now()/1000;ctx.clearRect(0,0,w,h);
 const playing=isPlaying,active=pulseUntil.some(until=>until>performance.now());
 ctx.fillStyle='#aab89e';ctx.fillRect(0,0,w,h);
 ctx.globalAlpha=.19;ctx.fillStyle='#3a5743';
 for(let x=0;x<w;x+=10)ctx.fillRect(x,8,1,h-13);
 for(let y=8;y<h;y+=10)ctx.fillRect(0,y,w,1);
 ctx.globalAlpha=1;
 const yMid=h*.40;ctx.fillStyle='#3e5b43';
 for(let i=0;i<64;i++){
  const x=6+i*4.8,n=(i*.37)+t*(playing?2.7:1.1),beat=playing?Math.pow(Math.max(0,Math.sin((t*scene.bpm/60)*Math.PI*2)),13):.025;
  const a=Math.abs(Math.sin(n)*Math.sin(i*.11+t*.29))+Math.abs(Math.cos(i*1.13+n*.31))*.25;
  const level=3+24*a*(active?.93:playing?.60:.22)+beat*10;
  ctx.fillRect(Math.floor(x),Math.round(yMid-level/2),3,Math.max(2,Math.floor(level)));
 }
 const top=Math.floor(h*.66),cell=(w-14)/N;
 for(let step=0;step<N;step++){
  const events=scene.events.filter(e=>e.step===step),height=3+Math.min(4,events.length)*4;
  ctx.fillStyle=events.length?'#365440':'#7d927d';
  ctx.fillRect(7+Math.floor(step*cell),top+20-height,Math.max(3,Math.floor(cell-2)),height);
 }
 if(playing){const mark=(nextStep-1+N)%N;ctx.fillStyle='#263e31';ctx.fillRect(7+Math.floor(mark*cell)-1,top+23,Math.max(3,Math.floor(cell-1)),3);}
 ctx.fillStyle='#385342';ctx.font='bold 9px monospace';ctx.fillText('A  B  C  D  /  MEMORY SYSTEM',6,h-4);
}
let fallbackFrame=0;
function startCanvasFallback(){const canvas=$('display-fallback'),context=canvas.getContext('2d');if(!context)return;let last=0;const frame=(now)=>{if(canvas.hidden)return;if(now-last>40){paint(context,320,128);last=now;}fallbackFrame=requestAnimationFrame(frame);};fallbackFrame=requestAnimationFrame(frame);}
function attemptP5(){
 const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/p5@1.11.13/lib/p5.min.js';script.async=true;
 script.onload=()=>{if(!window.p5)return;try{new p5(p=>{p.setup=()=>{const canvas=p.createCanvas(320,128);canvas.parent('p5-container');p.pixelDensity(1);p.frameRate(24);$('display-fallback').hidden=true;cancelAnimationFrame(fallbackFrame);};p.draw=()=>paint(p.drawingContext,320,128);});}catch(err){console.warn('p5 fallback',err);$('display-fallback').hidden=false;startCanvasFallback();}};
 script.onerror=()=>console.info('p5 CDN unavailable; internal Canvas fallback active');
 document.head.appendChild(script);
}
function init(){renderPads();bindControls();updateText();startCanvasFallback();attemptP5();if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('./sw.js').catch(err=>console.warn('SW:',err));}
init();
window.WrongNumberDebug={getScene:()=>deepCopy(scene),isPlaying:()=>isPlaying,isRecording:()=>!!tape,captureRecent,mutate,fresh,undo,startLoop,stopLoop,startTape,stopTape,exportWav,renderPads};
})();
