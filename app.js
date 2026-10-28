/* WRONG NUMBER v0.1.7.1 — LIVE JAM / DUB touch fix
 * Timing: Web Audio's currentTime, with a 25ms look-ahead scheduler.
 * Screen: p5.js v1.11.13 when available, local Canvas fallback offline.
 * Playback: all synthesis and mutations remain local to the browser.
 */
(()=>{'use strict';
const A=window.WrongAudio,I=window.WrongIcons; if(!A||!I){document.body.textContent='AUDIO ENGINE FAILED';return;}
const $=id=>document.getElementById(id), N=32, STORE='wrong-number-session-0.1', KEEP='wrong-number-kept-0.1';
const MAX_TAPE_SECONDS=30, TAPE_TAIL_SECONDS=2.5;
const randomSeed=()=>((Math.random()*0xffffffff)>>>0);
const deepCopy=v=>JSON.parse(JSON.stringify(v));
const getSaved=k=>{try{return JSON.parse(localStorage.getItem(k));}catch{return null;}};
const newScene=()=>({bpm:92,seed:randomSeed(),color:{broken:.24,space:.27,shift:0},kit:0,events:[]});
function validateScene(raw){
 if(!raw||typeof raw!=='object'||!Array.isArray(raw.events))return null;
 return {bpm:A.clamp(Number(raw.bpm)||92,48,180),seed:(raw.seed>>>0)||3,kit:A.clamp(Math.floor(Number(raw.kit)||0),0,4),color:{broken:A.clamp(Number(raw.color?.broken)||.18,0,1),space:A.clamp(Number(raw.color?.space)||.25,0,1),shift:A.clamp(Number(raw.color?.shift)||0,-2,2)},events:raw.events.slice(0,64).filter(e=>Number.isInteger(e.step)&&e.step>=0&&e.step<N&&Number.isInteger(e.pad)&&e.pad>=0&&e.pad<16).map(e=>({step:e.step,pad:e.pad,velocity:A.clamp(Number(e.velocity)||.85,.2,1),variant:(e.variant>>>0)||1}))};
}
let scene=validateScene(getSaved(STORE))||newScene(),checkpoint=validateScene(getSaved(KEEP));
let live=null,engine=null,isPlaying=false,scheduler=null,nextStep=0,nextTick=0,loopStarted=0,cycleAnchor=0,perfCounter=0,lastPadAt=new Map(),recent=[],downPointers=new Map(),pulseUntil=new Array(16).fill(0),lastPad=-1,displayMessage='READY / TOUCH A PAD',messageUntil=0,renderBusy=false,wavUrl=null,wavFile=null,tape=null,tapeClock=null,undoStack=[];
// JAM is always live and non-destructive. DUB is armed explicitly and stores
// quantized events for the NEXT pass, never doubling the currently played tap.
let dubArmed=false,pendingDub=[],dubUndoSaved=false,dubSessionCount=0;

// The previous session and 16-pad layout remain compatible with v0.1.4.
let stateAt=()=>live?.currentTime??0;
let transientStatus='READY',glitchUntil=0,keepUntil=0,newUntil=0,visualBeat=0;
const kitLabel=()=>A.KIT_TITLES[scene.kit]||A.KIT_TITLES[0];
function updateKitUi(){
 const name=kitLabel();
 $('btn-source').textContent=name;
 $('btn-source').title=`Sound kit ${scene.kit+1} of ${A.KIT_TITLES.length}: ${name}. Tap to select next.`;
 $('lcd-kit').textContent=`0${scene.kit+1} / ${name}`;
}
function setKit(index){
 scene.kit=(index+A.KIT_TITLES.length)%A.KIT_TITLES.length;
 updateKitUi();persist();message(`${kitLabel()} / LOADED`,2);
}
const stepSeconds=()=>60/scene.bpm/4,cycleSeconds=()=>N*stepSeconds();
function displayMode(){
 if(tape)return 'TAPE REC';
 if(performance.now()<glitchUntil)return 'MUTATING';
 if(performance.now()<keepUntil)return 'SAVED';
 if(performance.now()<newUntil)return 'NEW BEAT';
 return dubArmed?'DUB ●':isPlaying?'JAM / LOOP':'READY';
}
function updateText(){
 $('tempo-value').innerHTML=String(scene.bpm).padStart(3,'0')+' <small>BPM</small>';
 $('lcd-mode').textContent=displayMode();
 $('beat-readout').textContent=`${scene.bpm} BPM · ${isPlaying?`${1+Math.floor(visualBeat/16)}:${String(1+Math.floor(visualBeat%16/4)).padStart(2,'0')}`:'--:--'}`;
 $('btn-loop').setAttribute('aria-pressed',String(isPlaying));
 $('btn-dub').setAttribute('aria-pressed',String(dubArmed));
 $('btn-dub').setAttribute('aria-label',dubArmed?'Stop overdub recording':'Start overdub recording');
 $('btn-dub').querySelector('small').textContent=dubArmed?'● RECORDING':'OVERDUB';
 $('live-message').textContent=`${dubArmed?'● DUB +'+pendingDub.length:isPlaying?'JAM':'READY'} / ${A.KIT_SHORT[scene.kit]} / ${scene.events.length.toString().padStart(2,'0')} NOTES`; 
 updateKitUi();
}
function message(s,seconds=1.7){displayMessage=s;messageUntil=performance.now()+seconds*1000;$('status-text').textContent=s;updateText();}
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
 const kit=Number.isInteger(options.kit)?options.kit:scene.kit;
 const params={seed:options.seed??(scene.seed ^ (++perfCounter*98923)),velocity,color:{...(options.color||scene.color)},kit,hold:!!options.hold,fire:!!options.fire};
 A.scheduleKitVoice(engine,pad,time,params);
 // Capture the exact kit per event. Switching kits during TAPE remains audible in export.
 if(tape && time>=tape.startedAt && time<tape.startedAt+MAX_TAPE_SECONDS){tape.events.push({pad,at:time-tape.startedAt,params});}
 const ms=(time-live.currentTime)*1000;
 if(ms>10)setTimeout(()=>pulse(pad),ms);else pulse(pad);
}
// Snap to the nearest 16th note for stored notes only; live sound is immediate.
function snapToStep(at){
 const sec=stepSeconds(),cycle=cycleSeconds();
 const phase=((at-cycleAnchor)%cycle+cycle)%cycle;
 return Math.round(phase/sec)%N;
}
function queueDub(pad,velocity,at){
 if(!isPlaying||!dubArmed)return;
 const step=snapToStep(at);
 // Repeated hits on the same pad and grid step should not stack and clip.
 const found=pendingDub.find(e=>e.pad===pad&&e.step===step);
 if(found){found.velocity=Math.max(found.velocity,velocity);return;}
 if(!dubUndoSaved){rememberUndo();dubUndoSaved=true;}
 pendingDub.push({pad,step,velocity,variant:randomSeed()});
 dubSessionCount++;
 updateText();
}
function commitDub(){
 if(!pendingDub.length)return 0;
 const count=pendingDub.length;
 // Limit polyphony while retaining existing downbeat anchors and recent performance.
 const joined=[...scene.events,...pendingDub];
 if(joined.length>64){
  const anchors=joined.filter(e=>e.pad<4&&e.step%8===0);
  const others=joined.filter(e=>!(e.pad<4&&e.step%8===0));
  scene.events=[...anchors.slice(-16),...others.slice(-Math.max(0,64-Math.min(16,anchors.length)))].slice(-64);
 }else scene.events=joined;
 pendingDub=[];persist();
 return count;
}
function setDub(armed){
 if(armed){
  if(!isPlaying)startLoop();
  if(!isPlaying)return;
  dubArmed=true;dubUndoSaved=false;dubSessionCount=0;
  message('● DUB / TAP TO RECORD',2);
 }else{
  commitDub();
  dubArmed=false;dubUndoSaved=false;
  message(dubSessionCount?`DUB SAVED / +${dubSessionCount} HITS`:'JAM / PLAY FREELY',2);
 }
 updateText();
}
function playPad(pad,options={}){
 if(!ensureAudio())return;
 const now=stateAt(),last=lastPadAt.get(pad)??-100;
 const rapid=now-last<.25;lastPadAt.set(pad,now);
 const velocity=options.hold?.50:(rapid?.70:.92);
 synth(pad,now+.003,velocity,{hold:options.hold,fire:rapid||options.hold});
 if(!options.hold){
  recent.push({pad,time:now,velocity:rapid?.72:.90,variant:perfCounter});
  recent=recent.filter(e=>e.time>=now-25).slice(-100);
 }
 // DUB records repeats too; JAM always leaves the underlying pattern untouched.
 if(dubArmed)queueDub(pad,options.hold?.53:.88,now);
 message(dubArmed?`● DUB / ${A.KIT_NAMES[pad]}`:options.hold?`HOLD / ${A.KIT_NAMES[pad]}`:`${String(pad+1).padStart(2,'0')} / ${A.KIT_NAMES[pad]}`,1.1);
}
// A rhythmic repeat that follows tempo and timbre instead of a fixed 125ms timer.
// The first attack stays untouched; repeats start only after a deliberate hold.
function holdInterval(pad,hit){
 const group=Math.floor(pad/4);
 const subdivision=group===0?(hit%4===3?2:1):group===1?1:group===2?(hit%3===2?1:2):(hit%4===3?1:1.5);
 return Math.max(.095,Math.min(.33,stepSeconds()*subdivision));
}
function beginHold(token,pad){
 const item={pad,timeout:null,count:0};
 const repeat=()=>{
  if(downPointers.get(token)!==item)return;
  playPad(pad,{hold:true});
  item.count++;
  item.timeout=setTimeout(repeat,holdInterval(pad,item.count)*1000);
 };
 downPointers.set(token,item);
 item.timeout=setTimeout(repeat,330);
}
function endHold(token){
 const item=downPointers.get(token);if(!item)return;
 clearTimeout(item.timeout);downPointers.delete(token);
}

function renderPads(){
 const container=$('pads');container.innerHTML='';
 A.KIT_NAMES.forEach((name,index)=>{
  const b=document.createElement('button');b.className='pad';b.type='button';b.setAttribute('aria-label',`${index+1} ${name}`);
  b.innerHTML=`<span class="pad-no">${String(index+1).padStart(2,'0')}</span><span class="pad-icon" aria-hidden="true">${I.icon(index)}</span><span class="pad-tick"></span><span class="pad-name">${name}</span>`;
  b.addEventListener('pointerdown',event=>{
   if(event.button!==0&&event.pointerType==='mouse')return;
   event.preventDefault();try{b.setPointerCapture(event.pointerId);}catch{}
   b.classList.add('is-down');playPad(index);
   beginHold(`ptr:${event.pointerId}`,index);
  });
  const release=event=>{endHold(`ptr:${event.pointerId}`);b.classList.remove('is-down');};
  b.addEventListener('pointerup',release);b.addEventListener('pointercancel',release);b.addEventListener('lostpointercapture',release);
  container.appendChild(b);
 });
}
function generate(seed=randomSeed()){
 const r=A.rng(seed ^ (scene.kit * 657913)),events=[],add=(step,pad,velocity=.85)=>events.push({step,pad,velocity,variant:(r()*0xffffffff)>>>0});
 const kit=scene.kit;
 for(let bar=0;bar<2;bar++){
  const o=bar*16;
  add(o,bar===0?0:(r()<.76?0:kit===3?1:2),.90);
  if(r()<(kit===3?.86:kit===4?.97:.93))add(o+8,r()<.65?0:3,.82);
  if(kit===1){
   [2,6,10,14].forEach(s=>{if(r()<.76)add(o+s+(r()<.22?1:0),4+Math.floor(r()*4),.47+r()*.3);});
   for(let j=0;j<6;j++)if(r()<.58)add(o+Math.floor(r()*16),8+Math.floor(r()*8),.43+r()*.27);
  }else if(kit===2){
   [4,12].forEach(s=>add(o+s,r()<.6?7:6,.56+r()*.23));
   [3,7,11,15].forEach(s=>{if(r()<.58)add(o+s,4+Math.floor(r()*4),.43+r()*.29);});
   for(let j=0;j<4;j++)if(r()<.57)add(o+Math.floor(r()*16),9+Math.floor(r()*7),.44+r()*.23);
  }else if(kit===3){
   [3,6,10,13].forEach(s=>{if(r()<.84)add(o+s,4+Math.floor(r()*4),.53+r()*.26);});
   for(let j=0;j<6;j++)if(r()<.64)add(o+Math.floor(r()*16),8+Math.floor(r()*8),.40+r()*.31);
  }else if(kit===4){
   [2,5,9,14].forEach(s=>{if(r()<.87)add(o+s+(r()<.18?1:0),4+Math.floor(r()*4),.44+r()*.37);});
   for(let j=0;j<9;j++)if(r()<.74)add(o+Math.floor(r()*16),8+Math.floor(r()*8),.35+r()*.35);
  }else{
   for(let s=0;s<16;s+=2)if(r()<.67)add(o+s+(r()<.12?1:0),r()<.52?4:5,.48+r()*.29);
   [4,12].forEach(s=>{if(r()<.91)add(o+s,r()<.57?7:6,.58+r()*.22);});
   for(let j=0;j<4;j++)if(r()<.60)add(o+Math.floor(r()*16),8+Math.floor(r()*8),.47+r()*.32);
  }
  if(r()<.7)add(o+11,r()<.67?2:1,.59+r()*.18);
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
function stopLoop(){if(dubArmed){commitDub();dubArmed=false;dubUndoSaved=false;}isPlaying=false;clearInterval(scheduler);scheduler=null;nextStep=0;message('LOOP STOPPED / JAM READY');updateText();}
function startLoop(){
 if(!ensureAudio())return;
 if(scene.events.length===0)scene.events=captureRecent();
 isPlaying=true;nextStep=0;nextTick=stateAt()+.08;loopStarted=nextTick;cycleAnchor=nextTick;
 scheduler=setInterval(scheduleAhead,25);scheduleAhead();persist();message('LOOP / 2 BARS');updateText();
}
function scheduleAhead(){
 if(!isPlaying||!live||live.state!=='running')return;
 if(nextTick<stateAt()-.40){nextTick=stateAt()+.07;nextStep=0;loopStarted=nextTick;cycleAnchor=nextTick;}
 let guard=0;
 while(nextTick<stateAt()+.14 && guard++<12){
  // At the next loop boundary, DUB notes become audible as part of the pattern.
  if(nextStep===0&&pendingDub.length)commitDub();
  const step=nextStep,time=nextTick;
  const stepEvents=scene.events.filter(e=>e.step===step);
  for(const e of stepEvents){synth(e.pad,time,e.velocity,{seed:(scene.seed^e.variant^e.step)>>>0,color:scene.color});}
  visualBeat=step; $('beat-readout').textContent=`${scene.bpm} BPM · ${1+Math.floor(step/16)}:${String(1+Math.floor(step%16/4)).padStart(2,'0')}`;
  nextStep=(step+1)%N;nextTick+=stepSeconds();
  if(nextStep===0)loopStarted=nextTick;
 }
}
function rememberUndo(){undoStack.push(deepCopy(scene));if(undoStack.length>8)undoStack.shift();}
function resetPlayhead(){if(isPlaying){nextStep=0;nextTick=stateAt()+.07;loopStarted=nextTick;cycleAnchor=nextTick;}}
function undo(){
 if(dubArmed){pendingDub=[];dubArmed=false;dubUndoSaved=false;}
 if(!undoStack.length){message('NO EARLIER MUTATION');return;}
 scene=undoStack.pop();resetPlayhead();persist();message('BACK / PREVIOUS VERSION');
}
function mutate(strong=false){
 if(dubArmed)setDub(false);
 // v0.1.6: one press must create a new AUDIBLE groove, not just change saved data.
 // Protect primary downbeats while guaranteeing several changed notes each time.
 rememberUndo();
 if(!scene.events.length)scene.events=captureRecent();
 const previous=scene.events.map(e=>({...e}));
 const r=A.rng((scene.seed ^ randomSeed())>>>0);
 const kit=scene.kit,changed=[];
 const openness=[.37,.52,.41,.57,.64][kit],density=[.18,.25,.17,.26,.32][kit];
 const amount=strong?.79:openness;
 let moved=0;
 for(let i=0;i<previous.length;i++){
  const e=previous[i],anchor=e.pad<4&&e.step%8===0;
  if(!anchor&&r()<amount*.16)continue;
  const item={...e};
  // A predictable fraction changes onsets or instrument, even when the random draws are quiet.
  if(!anchor&&(i%4===1 || r()<amount*.70)){
   const direction=r()<.5?-1:1;
   const distance=strong?2+Math.floor(r()*5):1+Math.floor(r()*3);
   item.step=(item.step+direction*distance+N)%N;
   moved++;
  }
  if(!anchor&&(i%5===2||r()<amount*.40)){
   const group=Math.floor(item.pad/4);
   const next=(item.pad+1+Math.floor(r()*3))%4;
   item.pad=group*4+next;
   moved++;
  }
  item.velocity=A.clamp(item.velocity+(r()-.47)*(strong?.40:.24),.31,1);
  item.variant=((item.variant^((r()*0xffffffff)>>>0))>>>0);
  changed.push(item);
 }
 // Guaranteed cross-register accents. Light mutates 3–8 notes; heavy ones add more.
 const additions=Math.min(strong?14:8,Math.max(3,Math.round(previous.length*density*(strong?1.65:1))));
 for(let i=0;i<additions;i++){
  const groups=kit===3?[1,2,2,3,0]:kit===4?[2,1,2,3,0]:[0,1,2,3];
  const group=groups[Math.floor(r()*groups.length)];
  changed.push({step:Math.floor(r()*N),pad:group*4+Math.floor(r()*4),velocity:.43+r()*.42,variant:(r()*0xffffffff)>>>0});
 }
 // Remove only excess duplicates; capped to keep mobile audio rendering responsive.
 scene.events=changed.slice(0,64);
 scene.seed=randomSeed();
 scene.color.broken=A.clamp(scene.color.broken+(r()-.43)*(strong?.62:.28),.07,.92);
 scene.color.space=A.clamp(scene.color.space+(r()-.48)*(strong?.43:.22),.06,.85);
 scene.color.shift=A.clamp(scene.color.shift+(r()-.5)*(strong?1.9:.6),-1.6,1.6);
 glitchUntil=performance.now()+(strong?1200:720);
 persist();
 const wasPlaying=isPlaying;
 if(!wasPlaying)startLoop(); // Immediately hear the result even from IDLE.
 message(`${strong?'WILD':'MUTATE'} / ${previous.length}→${scene.events.length} NOTES`,1.8);
 const m=$('btn-mutate');m.classList.add('is-mutating');
 setTimeout(()=>m.classList.remove('is-mutating'),420);
}

function keep(){checkpoint=deepCopy(scene);keepUntil=performance.now()+1200;try{localStorage.setItem(KEEP,JSON.stringify(checkpoint));}catch{}message('SNAPSHOT KEPT');updateText();}
function restore(){if(dubArmed){pendingDub=[];dubArmed=false;dubUndoSaved=false;}if(!checkpoint){message('NO SNAPSHOT YET');return;}scene=deepCopy(checkpoint);resetPlayhead();persist();message('SNAPSHOT RESTORED');}
function fresh(){if(dubArmed)setDub(false);rememberUndo();scene={...newScene(),bpm:scene.bpm,kit:scene.kit};scene.events=generate(scene.seed);newUntil=performance.now()+1000;resetPlayhead();persist();message('NEW GROOVE');}
function tempo(delta){if(dubArmed)setDub(false);scene.bpm=A.clamp(scene.bpm+delta,48,180);resetPlayhead();persist();message(`${scene.bpm} BPM`,.8);}
function bindControls(){
 $('btn-source').addEventListener('click',()=>setKit(scene.kit+1));
 $('kit-prev').addEventListener('click',()=>setKit(scene.kit-1));
 $('kit-next').addEventListener('click',()=>setKit(scene.kit+1));
 $('btn-loop').addEventListener('click',()=>isPlaying?stopLoop():startLoop());
 // DUB must not rely on synthesized click on mobile Safari.
 // Trigger on pointerup (the same path as MUTATE), capture a pointer that
 // slips onto the label while the finger is down, and suppress its follow-up
 // synthesized click. Keep click for keyboard / assistive technology.
 const dubButton=$('btn-dub');
 let dubPointer=null, lastDubPointerAction=-10000;
 const clearDubPointer=()=>{dubPointer=null;dubButton.classList.remove('is-touching');};
 dubButton.addEventListener('contextmenu',event=>event.preventDefault());
 dubButton.addEventListener('pointerdown',event=>{
  if(event.pointerType==='mouse'&&event.button!==0)return;
  if(dubPointer!==null)return; // Ignore additional fingers on the same button.
  dubPointer={id:event.pointerId,x:event.clientX,y:event.clientY};
  dubButton.classList.add('is-touching');
  try{dubButton.setPointerCapture(event.pointerId);}catch{}
  // Request audio while iOS has a direct trusted user activation.
  // Playing is only started on release so accidental scrolls do not arm DUB.
  ensureAudio();
 });
 dubButton.addEventListener('pointerup',event=>{
  if(!dubPointer||event.pointerId!==dubPointer.id)return;
  const moved=Math.hypot(event.clientX-dubPointer.x,event.clientY-dubPointer.y)>38;
  clearDubPointer();
  lastDubPointerAction=performance.now();
  if(!moved)setDub(!dubArmed);
 });
 dubButton.addEventListener('pointercancel',event=>{
  if(dubPointer&&event.pointerId===dubPointer.id){clearDubPointer();lastDubPointerAction=performance.now();}
 });
 dubButton.addEventListener('lostpointercapture',()=>{
  // pointerup already handled the tap; lost capture merely clears stale visuals.
  clearDubPointer();
 });
 dubButton.addEventListener('click',event=>{
  if(event.detail!==0 && performance.now()-lastDubPointerAction<650){event.preventDefault();return;}
  // Keyboard activation and accessibility-generated clicks do not require
  // pointerdown/pointerup, and remain supported.
  setDub(!dubArmed);
 });
 $('tempo-down').addEventListener('click',()=>tempo(-2));$('tempo-up').addEventListener('click',()=>tempo(2));
 $('btn-keep').addEventListener('click',keep);$('btn-new').addEventListener('click',fresh);
 const restoreButton=$('btn-restore');let restoreDown=0,lastRestorePointer=0;
 restoreButton.addEventListener('contextmenu',e=>e.preventDefault());
 restoreButton.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;restoreDown=performance.now();});
 restoreButton.addEventListener('pointerup',()=>{if(!restoreDown)return;const long=performance.now()-restoreDown>=600;restoreDown=0;lastRestorePointer=performance.now();if(long)undo();else restore();});
 restoreButton.addEventListener('pointercancel',()=>{restoreDown=0;});
 restoreButton.addEventListener('click',()=>{if(performance.now()-lastRestorePointer<500)return;restore();});
 $('btn-tape').addEventListener('click',()=>tape?stopTape():startTape());
 // Pointerup triggers the action directly (long press is not a dependable click on iOS).
 // A following synthetic click is suppressed; keyboard activation still works.
 const m=$('btn-mutate');let holdStart=0,lastPointer=0;
 m.addEventListener('contextmenu',e=>e.preventDefault());
 m.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;holdStart=performance.now();});
 m.addEventListener('pointerup',()=>{if(!holdStart)return;const strong=performance.now()-holdStart>=600;holdStart=0;lastPointer=performance.now();mutate(strong);});
 m.addEventListener('pointercancel',()=>{holdStart=0;});
 m.addEventListener('click',()=>{if(performance.now()-lastPointer<500)return;mutate(false);});
 $('btn-export').addEventListener('click',exportWav);
 $('btn-close-export').addEventListener('click',()=>{$('export-panel').hidden=true;});
 $('btn-share').addEventListener('click',async()=>{if(!wavFile)return;try{await navigator.share({files:[wavFile],title:'WRONG NUMBER LOOP'});}catch(err){if(err.name!=='AbortError')message('SHARE FAILED / USE DOWNLOAD',3);}});
 const keys='1234qwerasdfzxcv';const held=new Set();
 window.addEventListener('keydown',e=>{if(e.altKey||e.ctrlKey||e.metaKey||e.repeat||e.target.matches('input,textarea'))return;const k=e.key.toLowerCase(),pad=keys.indexOf(k);if(pad===-1||held.has(k))return;e.preventDefault();held.add(k);$('pads').children[pad].classList.add('is-down');playPad(pad);beginHold(`key:${k}`,pad);});
 window.addEventListener('keyup',e=>{const k=e.key.toLowerCase(),pad=keys.indexOf(k);held.delete(k);if(pad!==-1){endHold(`key:${k}`);$('pads').children[pad].classList.remove('is-down');}});
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
 if(renderBusy){message('FINISH EXPORT FIRST',3);return;}
 if(tape){message('STOP TAPE BEFORE LOOP EXPORT',3);return;}
 if(!scene.events.length){scene.events=captureRecent();persist();}
 const snapshot=deepCopy(scene); // Freeze kit, pattern and color during export.
 prepareRender('RENDERING LOOP / WAV...');message('RENDERING LOOP',3);
 await new Promise(resolve=>setTimeout(resolve,30));
 try{
  const sampleRate=44100,duration=N*60/snapshot.bpm/4,framesPerCycle=Math.round(duration*sampleRate);
  const ctx=new (window.OfflineAudioContext||window.webkitOfflineAudioContext)(2,framesPerCycle*3+Math.ceil(sampleRate*.12),sampleRate);
  const g=A.graph(ctx),stepDuration=60/snapshot.bpm/4,baseline=.035;
  // Use the middle cycle to preserve reverb and delay wrapping over the seam.
  for(let cycle=0;cycle<3;cycle++){
   for(const ev of snapshot.events){const t=baseline+cycle*duration+ev.step*stepDuration;
    const params={seed:(snapshot.seed^ev.variant^ev.step)>>>0,velocity:ev.velocity,color:snapshot.color,kit:snapshot.kit};
    A.scheduleKitVoice(g,ev.pad,t,params);}
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
   A.scheduleKitVoice(g,note.pad,offset+note.at,{...note.params});
  }
  const rendered=await ctx.startRendering();
  const first=Math.floor(offset*sampleRate);
  const blob=A.audioBufferToWav(rendered,first,first+Math.floor(total*sampleRate));
  completeRender(blob,`wrong-number_tape_${Math.round(length)}s_${Date.now()}.wav`,`${Math.round(length)}S TAPE + TAIL`);
 }catch(err){console.error(err);$('export-status').textContent='TAPE EXPORT FAILED / '+String(err?.message||err).slice(0,90);message('TAPE EXPORT FAILED',4);}
 finally{finishRender();}
}
// Three Game & Watch rabbits. All graphics are hand-coded pixels, no fonts or emojis.
// Each state uses 2–4 stepped poses rather than smooth waveforms or animation assets.
function paint(ctx,w,h){
 const now=performance.now(),bpm=scene.bpm,beatMs=60000/bpm;
 // Align visual pose transitions to the AudioContext clock while LOOP runs.
 const beat=isPlaying?Math.floor(Math.max(0,(stateAt()-cycleAnchor)/stepSeconds())/2):Math.floor(now/640);
 const glitch=now<glitchUntil,keeping=now<keepUntil,brandNew=now<newUntil;
 const hit=pulseUntil.some(x=>x>now),mode=displayMode();
 if($('lcd-mode').textContent!==mode)$('lcd-mode').textContent=mode;
 if(now>messageUntil){const neutral=tape?'TAPE / RECORDING':dubArmed?`● OVERDUB / ${pendingDub.length} QUEUED`:isPlaying?'JAM / PLAY ALONG':'TAP TO PLAY';if($('status-text').textContent!==neutral)$('status-text').textContent=neutral;}
 const dark='#2a4930',light='#b9eb90',inner='#8bbc66',medium='#668a4b';
 ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,w,h);ctx.fillStyle=light;ctx.fillRect(0,0,w,h);
 // Dot paper texture remains stationary; no waveform or oscillogram.
 ctx.globalAlpha=.11;ctx.fillStyle=medium;
 for(let x=7;x<w;x+=9)for(let y=5;y<h;y+=9)ctx.fillRect(x,y,1,1);
 ctx.globalAlpha=1;
 const s=2.9,draw=(x,y,pw,ph,color=dark)=>{ctx.fillStyle=color;ctx.fillRect(Math.round(x*s),Math.round(y*s),Math.round(pw*s),Math.round(ph*s));};
 // Each bunny occupies a small 23x28 pixel world, with two ears, plump cheeks, paws and tail.
 const bunny=(px,py,n,pose)=>{
  const x=px/s,y=py/s;const p=(a,b,c,d,col=dark)=>draw(x+a,y+b,c,d,col);
  const hopped=pose%4===1||pose%4===3,lean=pose%4===1?-1:pose%4===3?1:0;
  // The silhouette is an outline, not a solid blob: internal space defines the face.
  const earLeft=(n===1&&pose%4===2)?-2:0;
  p(4+earLeft,1,6,10);p(6+earLeft,0,4,2);p(6+earLeft,2,2,7,inner);
  p(15,1+(n===2&&hopped?2:0),6,10);p(16,0+(n===2&&hopped?2:0),4,2);p(17,2+(n===2&&hopped?2:0),2,7,inner);
  // Head and cheek outline.
  p(5,9,15,1);p(3,10,19,2);p(2,12,21,7);p(4,19,17,2);p(6,21,13,1);
  p(4,12,17,6,light);p(5,10,15,2,light);p(6,18,13,2,light);
  p(3,15,2,2,inner);p(20,15,2,2,inner);
  // Wide spaced button eyes, or deliberately silly MUTATE face.
  const blink=(Math.floor(now/230+13*n)%31===0);
  if(glitch && n===(beat%3)){
   p(7,13,3,1);p(8,12,1,3);p(16,13,3,1);p(17,12,1,3);
   p(12,17,2,2);
  }else if(!blink){p(7,13,2,3);p(16,13,2,3);p(8,13,1,1,light);p(17,13,1,1,light);}
  else {p(7,15,2,1);p(16,15,2,1);}
  p(12,15,2,1);p(11,17,1,1);p(14,17,1,1);
  p(6,17,2,1,inner);p(18,17,2,1,inner);
  // Tiny rounded torso: much smaller than the head for chibi proportions.
  p(7+lean,22,12,5);p(8+lean,27,10,1);p(9+lean,22,8,5,light);
  p(6+lean,23,3,3);p(18+lean,23,3,3);
  if(hopped){p(4+lean,20,4,3);p(19+lean,22,4,3);p(8+lean,28,4,2);p(16+lean,27,4,2);}
  else {p(4+lean,23,4,3);p(19+lean,20,4,3);p(7+lean,28,5,2);p(15+lean,28,5,2);}
  if(n===0){ // Pink-bow silhouette, expressed in LCD green.
   p(18,9,3,3);p(22,8,3,3);p(21,10,2,2,inner);
  } else if(n===1){ // Forelock makes the middle bunny distinct.
   p(11,9,4,2);p(13,10,2,2);
  } else { // An off-center cheek mole.
   p(20,18,1,1);
  }
 };
 const start=[28,129,230];
 for(let n=0;n<3;n++){
  const phase=keeping?0:glitch?(beat+n*2)%4:brandNew?(beat+3-n)%4:(beat+n)%4;
  let dy=(phase===1||phase===3)?-3:0,dx=phase===1?-2:phase===3?2:0;
  if(!isPlaying&&!hit&&!glitch&&!brandNew){dy=n===1&&beat%3===0?-1:0;dx=0;}
  if(keeping){dy=0;dx=0;}
  bunny(start[n]+dx,7+dy,n,phase);
 }
 // Small stepped indicators mark the current quarter-note and kit only.
 for(let i=0;i<8;i++){
  const active=isPlaying&&Math.floor((((stateAt()-cycleAnchor)/stepSeconds()%N)+N)%N/4)===i;
  ctx.fillStyle=active?dark:inner;ctx.fillRect(12+i*11,h-6,active?5:3,active?4:2);
 }
 for(let i=0;i<A.KIT_TITLES.length;i++){
  ctx.fillStyle=i===scene.kit?dark:inner;ctx.fillRect(w-13-(A.KIT_TITLES.length-i)*8,h-6,i===scene.kit?5:3,3);
 }
 if(dubArmed){ctx.fillStyle=dark;ctx.fillRect(151,4,12,5);ctx.fillStyle=light;ctx.fillRect(154,5,6,3);}
 if(glitch){ctx.fillStyle=medium;ctx.fillRect(155,8,7,2);ctx.fillRect(70,80,9,2);}
}
let fallbackFrame=0;
function startCanvasFallback(){const canvas=$('display-fallback'),context=canvas.getContext('2d');if(!context)return;let last=0;const frame=(now)=>{if(canvas.hidden)return;if(now-last>65){paint(context,320,100);last=now;}fallbackFrame=requestAnimationFrame(frame);};fallbackFrame=requestAnimationFrame(frame);}
function attemptP5(){
 const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/p5@1.11.13/lib/p5.min.js';script.async=true;
 script.onload=()=>{if(!window.p5)return;try{new p5(p=>{p.setup=()=>{const canvas=p.createCanvas(320,100);canvas.parent('p5-container');p.pixelDensity(1);p.frameRate(15);$('display-fallback').hidden=true;cancelAnimationFrame(fallbackFrame);};p.draw=()=>paint(p.drawingContext,320,100);});}catch(err){console.warn('p5 fallback',err);$('display-fallback').hidden=false;startCanvasFallback();}};
 script.onerror=()=>console.info('p5 CDN unavailable; internal Canvas fallback active');
 document.head.appendChild(script);
}
function init(){renderPads();bindControls();updateText();startCanvasFallback();attemptP5();if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('./sw.js?v=0.1.7.1', {updateViaCache:'none'}).catch(err=>console.warn('SW:',err));}
init();
window.WrongNumberDebug={getScene:()=>deepCopy(scene),isPlaying:()=>isPlaying,isRecording:()=>!!tape,isDubArmed:()=>dubArmed,pendingDub:()=>deepCopy(pendingDub),setDub,commitDub,snapToStep,cycleAnchor:()=>cycleAnchor,playPad,captureRecent,mutate,fresh,undo,startLoop,stopLoop,startTape,stopTape,exportWav,renderPads,setKit,kitLabel,audioState:()=>({context:live?.state||'none',kit:scene.kit,master:engine?.dry?.gain?.value??null})};
})();
