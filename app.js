/* WRONG NUMBER v0.1.9 — BLANK BEAT */
(()=>{'use strict';
const A=window.WrongAudio,I=window.WrongIcons; if(!A||!I){document.body.textContent='AUDIO ENGINE FAILED';return;}
const $=id=>document.getElementById(id), N=32, STORE='wrong-number-session-0.1';
const MAX_TAPE_SECONDS=30, TAPE_TAIL_SECONDS=2.5;
const randomSeed=()=>((Math.random()*0xffffffff)>>>0);
const deepCopy=v=>JSON.parse(JSON.stringify(v));
const getSaved=k=>{try{return JSON.parse(localStorage.getItem(k));}catch{return null;}};
const newScene=()=>({bpm:92,seed:randomSeed(),groove:'open',color:{broken:.24,space:.27,shift:0},kit:0,events:[]});
function validateScene(raw){
 if(!raw||typeof raw!=='object'||!Array.isArray(raw.events))return null;
 return {bpm:A.clamp(Number(raw.bpm)||92,48,180),seed:(raw.seed>>>0)||3,groove:['open','full','classic','empty'].includes(raw.groove)?raw.groove:'classic',kit:A.clamp(Math.floor(Number(raw.kit)||0),0,4),color:{broken:A.clamp(Number(raw.color?.broken)||.18,0,1),space:A.clamp(Number(raw.color?.space)||.25,0,1),shift:A.clamp(Number(raw.color?.shift)||0,-2,2)},events:raw.events.slice(0,64).filter(e=>Number.isInteger(e.step)&&e.step>=0&&e.step<N&&Number.isInteger(e.pad)&&e.pad>=0&&e.pad<16).map(e=>({step:e.step,pad:e.pad,velocity:A.clamp(Number(e.velocity)||.85,.2,1),variant:(e.variant>>>0)||1,origin:e.origin==='dub'?'dub':e.origin==='auto'?'auto':'legacy'}))};
}
let scene=validateScene(getSaved(STORE))||newScene();
let live=null,engine=null,isPlaying=false,scheduler=null,nextStep=0,nextTick=0,loopStarted=0,cycleAnchor=0,perfCounter=0,lastPadAt=new Map(),recent=[],downPointers=new Map(),pulseUntil=new Array(16).fill(0),lastPad=-1,displayMessage='READY / TOUCH A PAD',messageUntil=0,renderBusy=false,wavUrl=null,wavFile=null,tape=null,tapeClock=null,undoStack=[];
// JAM is always live and non-destructive. DUB is armed explicitly and stores
// quantized events for the NEXT pass, never doubling the currently played tap.
let dubArmed=false,pendingDub=[],dubUndoSaved=false,dubSessionCount=0,backingGraph=null;

// The previous session and 16-pad layout remain compatible with v0.1.4.
let stateAt=()=>live?.currentTime??0;
let glitchUntil=0,blankUntil=0,newUntil=0,visualBeat=0,newFlashTimer=null;
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
 if(performance.now()<blankUntil)return 'BLANK / BUILD';
 if(performance.now()<newUntil)return 'NEW BEAT';
 return dubArmed?(scene.groove==='empty'?'BUILD ●':'DUB ●'):isPlaying?(scene.groove==='empty'?'BLANK / LOOP':'JAM / LOOP'):(scene.groove==='empty'?'BLANK / READY':'READY');
}
function updateText(){
 $('tempo-value').innerHTML=String(scene.bpm).padStart(3,'0')+' <small>BPM</small>';
 $('lcd-mode').textContent=displayMode();
 $('beat-readout').textContent=`${scene.bpm} BPM · ${isPlaying?`${1+Math.floor(visualBeat/16)}:${String(1+Math.floor(visualBeat%16/4)).padStart(2,'0')}`:'--:--'}`;
 $('btn-loop').setAttribute('aria-pressed',String(isPlaying));
 $('btn-dub').setAttribute('aria-pressed',String(dubArmed));
 $('btn-dub').setAttribute('aria-label',dubArmed?'Stop overdub recording':'Start overdub recording');
 $('btn-dub').querySelector('small').textContent=dubArmed?'● RECORDING':'OVERDUB';
 $('live-message').textContent=`${dubArmed?'● DUB +'+pendingDub.length:isPlaying?'JAM':'READY'} / ${A.KIT_SHORT[scene.kit]} / ${scene.events.length.toString().padStart(2,'0')} HITS / ${scene.groove==='full'?'FULL':scene.groove==='empty'?'BLANK':'SPACE'}`; 
 updateKitUi();
}
function message(s,seconds=1.7){displayMessage=s;messageUntil=performance.now()+seconds*1000;$('status-text').textContent=s;updateText();}
function persist(){try{localStorage.setItem(STORE,JSON.stringify(scene));}catch{message('STORAGE UNAVAILABLE');}updateText();}
function ensureAudio(){
 try{
  if(!live||live.state==='closed'){
   live=new (window.AudioContext||window.webkitAudioContext)({latencyHint:'interactive'});engine=A.graph(live);backingGraph={...engine,dry:engine.backingDry};
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
 const params={seed:options.seed??(scene.seed ^ (++perfCounter*98923)),velocity,color:{...(options.color||scene.color)},kit,hold:!!options.hold,fire:!!options.fire,role:options.role||'jam'};
 A.scheduleKitVoice(options.role==='loop'&&backingGraph?backingGraph:engine,pad,time,params);
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
// Preserve musical breathing room. Two nearby attacks in one sound family
// generally compete; the most recently overdubbed one wins instead of stacking.
const family=pad=>Math.floor(pad/4);
const circularDistance=(a,b)=>Math.min(Math.abs(a-b),N-Math.abs(a-b));
function balancePattern(input,limit=28,reposition=false){
 const ranked=input.map((event,i)=>({...event,_i:i})).sort((a,b)=>{
  const rank=e=>(e.origin==='dub'?100:0)+(e.pad<4&&e.step%8===0?30:0)+(e.origin==='legacy'?10:0);
  return rank(b)-rank(a)||b._i-a._i;
 });
 const kept=[];
 for(const e of ranked){
  if(kept.length>=limit)break;
  const near=family(e.pad)===3?2:1;
  const free=step=>!kept.some(x=>family(x.pad)===family(e.pad)&&circularDistance(step,x.step)<=near)
   &&kept.filter(x=>x.step===step).length<2;
  if(!free(e.step)){
   if(!reposition)continue; // DUB replaces nearby accompaniment; never move it unexpectedly.
   // MUTATE keeps its event budget instead of slowly erasing the pattern after many presses.
   const offsets=[-2,2,-3,3,-4,4,-5,5,-6,6,-8,8,-10,10,-12,12,-14,14,16];
   const target=offsets.map(d=>(e.step+d+N)%N).find(free);
   if(target===undefined)continue;
   e.step=target;
  }
  kept.push(e);
 }
 return kept.map(({_i,...event})=>event).sort((a,b)=>a.step-b.step||a.pad-b.pad);
}
function duckBacking(at){
 if(!isPlaying||!engine?.backingDry)return;
 const gain=engine.backingDry.gain;
 // Duck accompaniment only; never the player's voice or the master output.
 gain.cancelScheduledValues(at);
 gain.setTargetAtTime(.56,at,.025);
 gain.setTargetAtTime(1,at+.23,.10);
}
function queueDub(pad,velocity,at){
 if(!isPlaying||!dubArmed)return;
 const step=snapToStep(at);
 // Repeated hits on the same pad and grid step should not stack and clip.
 const found=pendingDub.find(e=>family(e.pad)===family(pad)&&circularDistance(e.step,step)<=1);
 if(found){found.pad=pad;found.step=step;found.velocity=Math.max(found.velocity,velocity);updateText();return;}
 if(!dubUndoSaved){rememberUndo();dubUndoSaved=true;}
 pendingDub.push({pad,step,velocity,variant:randomSeed(),origin:'dub'});
 dubSessionCount++;
 updateText();
}
function commitDub(){
 if(!pendingDub.length)return 0;
 const count=pendingDub.length;
 // Human performance replaces near-simultaneous sounds in its register.
 // It cannot silently push the whole groove towards 64 overlapping events.
 const joined=[...scene.events,...pendingDub];
 const cap=scene.groove==='full'?40:28;
 scene.events=balancePattern(joined,cap);
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
 duckBacking(now);
 synth(pad,now+.003,velocity,{hold:options.hold,fire:rapid||options.hold,role:'jam'});
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
function generateFull(seed=randomSeed()){
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
// NEW (short tap): 10–16 notes in two bars. The deliberate holes are the instrument.
// Families: body (0–3), hit (4–7), weird (8–11), tail (12–15).
function generateOpen(seed=randomSeed()){
 const r=A.rng((seed ^ Math.imul(scene.kit+1,0x45d9f3b))>>>0),kit=scene.kit;
 const events=[],add=(step,pad,velocity=.85)=>events.push({step:step%N,pad,velocity,variant:(r()*0xffffffff)>>>0,origin:'auto'});
 for(let bar=0;bar<2;bar++){
  const o=bar*16;
  // One reliable anchor, an occasional offbeat kick and an asymmetric backbeat.
  add(o,bar===0?0:(kit===3?1:kit===4?2:0),.78+r()*.13);
  if(r()<(kit===2?.47:.68))add(o+8,kit===4?3:r()<.72?0:2,.66+r()*.18);
  const backbeat=kit===3?(r()<.5?5:7):kit===4?6:7;
  add(o+(kit===4?6:4),backbeat,.52+r()*.25);
  // Deliberate rest after the backbeat: the player can answer.
  if(r()<.52)add(o+(kit===1?11:12),4+Math.floor(r()*4),.43+r()*.24);
  if(r()<.84)add(o+[3,7,11,14][Math.floor(r()*4)],8+Math.floor(r()*4),.42+r()*.23);
  if(r()<.70)add(o+[5,10,13][Math.floor(r()*3)],12+Math.floor(r()*4),.36+r()*.21);
  if(r()<.65)add(o+[2,9,15][Math.floor(r()*3)],4+Math.floor(r()*4),.42+r()*.22);
 }
 // Sparse motifs vary with kit without becoming fill-heavy.
 if(kit===1){add(11,10,.48);add(27,5,.54);}
 else if(kit===2){add(15,13,.40);}
 else if(kit===3){add(10,9,.55);add(23,6,.50);}
 else if(kit===4){add(7,10,.55);add(29,11,.53);}
 let playable=balancePattern(events,16);
 // A quiet base should still have enough rhythmic information to respond to.
 // Fill a few genuinely unused slots; never compensate with overlapping attacks.
 for(let i=0;i<48 && playable.length<10;i++){
  const step=(i*7+1+Math.floor(r()*3))%N;
  const group=i%4===0?3:i%3===0?1:2;
  const candidate={step,pad:group*4+Math.floor(r()*4),velocity:.40+r()*.22,variant:(r()*0xffffffff)>>>0,origin:'auto'};
  const next=balancePattern([...playable,candidate],16);
  if(next.length>playable.length)playable=next;
 }
 return playable;
}
function generate(seed=randomSeed(),full=false){return full?generateFull(seed):generateOpen(seed);}

function captureRecent(){
 const now=stateAt(),input=recent.filter(x=>x.time>now-14);
 if(!input.length)return generate(scene.seed,scene.groove==='full');
 const first=input[0].time,stepDur=stepSeconds();
 const fromHands=input.map(e=>({step:Math.round((e.time-first)/stepDur)%N,pad:e.pad,velocity:e.velocity,variant:e.variant}));
 // With very little input, build an unobtrusive supporting pattern.
 if(fromHands.length<4){const background=generateOpen(scene.seed).filter(e=>e.pad<4||e.pad===7).slice(0,5);return balancePattern([...fromHands.map(e=>({...e,origin:'dub'})),...background],16);}
 return balancePattern(fromHands.map(e=>({...e,origin:'dub'})),24);
}
function stopLoop(){if(dubArmed){commitDub();dubArmed=false;dubUndoSaved=false;}isPlaying=false;clearInterval(scheduler);scheduler=null;nextStep=0;message('LOOP STOPPED / JAM READY');updateText();}
function startLoop(){
 if(!ensureAudio())return;
 if(scene.events.length===0&&scene.groove!=='empty')scene.events=captureRecent();
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
  for(const e of stepEvents){synth(e.pad,time,e.velocity,{seed:(scene.seed^e.variant^e.step)>>>0,color:scene.color,role:'loop'});}
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
 rememberUndo();
 if(!scene.events.length&&scene.groove==='empty'){message('BLANK / RECORD SOME PADS FIRST',2);return;}
 if(!scene.events.length)scene.events=captureRecent();
 const original=scene.events.map(e=>({...e}));
 const r=A.rng((scene.seed^randomSeed())>>>0);
 // Rearrange a phrase, not layer new notes on top of it.
 const changed=original.map(e=>({...e}));
 let edits=0;
 for(let i=0;i<changed.length;i++){
  const item=changed[i],anchor=item.pad<4&&item.step%8===0;
  if(anchor)continue;
  if(r()<(strong?.75:.43)){
   const distance=strong?2+Math.floor(r()*5):1+Math.floor(r()*3);
   item.step=(item.step+(r()<.5?-distance:distance)+N)%N;
   edits++;
  }
  if(r()<(strong?.52:.27)){
   item.pad=family(item.pad)*4+Math.floor(r()*4);
   edits++;
  }
  item.velocity=A.clamp(item.velocity+(r()-.5)*(strong?.27:.17),.36,.98);
  item.variant=(item.variant^((r()*0xffffffff)>>>0))>>>0;
 }
 if(!edits && changed.length){const e=changed.find(e=>e.pad>=4)||changed[0];e.step=(e.step+2)%N;edits++;}
 const cap=scene.groove==='full'?40:28;
 scene.events=balancePattern(changed,cap,true);
 // Ensure every press is audibly/structurally different, even if all randomly
 // shifted notes happened to collide and were removed by the density guard.
 const signature=events=>events.map(e=>`${e.step}:${e.pad}`).sort().join('|');
 if(signature(scene.events)===signature(original)&&scene.events.length){
  const chosen=scene.events.find(e=>e.pad>=4)||scene.events[0];
  for(let offset=2;offset<N;offset++){
   const candidate=(chosen.step+offset)%N;
   if(scene.events.every(e=>e===chosen||family(e.pad)!==family(chosen.pad)||circularDistance(candidate,e.step)>1)){
    chosen.step=candidate;break;
   }
  }
  scene.events.sort((a,b)=>a.step-b.step||a.pad-b.pad);
 }
 // If an older dense pattern is loaded, each mutation thins it instead of growing it.
 if(scene.groove==='classic'&&scene.events.length>28)scene.events=scene.events.slice(0,Math.max(28,Math.floor(scene.events.length*.84)));
 scene.seed=randomSeed();
 scene.color.broken=A.clamp(scene.color.broken+(r()-.5)*(strong?.38:.14),.07,.85);
 scene.color.space=A.clamp(scene.color.space+(r()-.5)*(strong?.24:.10),.06,.80);
 scene.color.shift=A.clamp(scene.color.shift+(r()-.5)*(strong?1.1:.42),-1.6,1.6);
 glitchUntil=performance.now()+(strong?1200:720);
 persist();
 if(!isPlaying)startLoop();
 message(`${strong?'WILD':'MUTATE'} / ${original.length}→${scene.events.length} HITS`,1.8);
 const m=$('btn-mutate');m.classList.add('is-mutating');
 setTimeout(()=>m.classList.remove('is-mutating'),420);
}

function flashNew(){
 const button=$('btn-new');button.classList.remove('is-new-flash');void button.offsetWidth;
 button.classList.add('is-new-flash');clearTimeout(newFlashTimer);
 newFlashTimer=setTimeout(()=>button.classList.remove('is-new-flash'),430);
}
function fresh(full=false){
 if(dubArmed)setDub(false);
 rememberUndo();scene={...newScene(),bpm:scene.bpm,kit:scene.kit,groove:full?'full':'open'};
 scene.events=generate(scene.seed,full);newUntil=performance.now()+1000;
 flashNew();resetPlayhead();persist();message(full?'FULL BEAT / LISTEN':'SPACE BEAT / YOUR TURN',2);
}
function blank(){
 if(renderBusy){message('FINISH EXPORT FIRST',2);return;}
 rememberUndo();
 // BLANK clears the musical pattern but keeps the chosen kit and tempo.
 scene={...newScene(),bpm:scene.bpm,kit:scene.kit,groove:'empty',events:[]};
 recent=[];pendingDub=[];dubArmed=false;dubUndoSaved=false;dubSessionCount=0;
 blankUntil=performance.now()+1400;
 if(isPlaying)resetPlayhead();else startLoop();
 if(!isPlaying){message('AUDIO / TAP BLANK AGAIN',3);persist();return;}
 setDub(true);persist();message('BLANK / TAP PADS TO BUILD',2.4);
}

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
 $('btn-blank').addEventListener('click',blank);
 // Short NEW = playable space; deliberate long hold = busy full demo groove.
 const newButton=$('btn-new');let newDown=0,lastNewPointer=0;
 newButton.addEventListener('contextmenu',e=>e.preventDefault());
 newButton.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;newDown=performance.now();});
 newButton.addEventListener('pointerup',()=>{if(!newDown)return;const full=performance.now()-newDown>=620;newDown=0;lastNewPointer=performance.now();fresh(full);});
 newButton.addEventListener('pointercancel',()=>{newDown=0;});
 newButton.addEventListener('click',()=>{if(performance.now()-lastNewPointer<650)return;fresh(false);});
 $('btn-undo').addEventListener('click',undo);
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
 if(!scene.events.length&&scene.groove==='empty'){message('BLANK / ADD NOTES BEFORE EXPORT',2.5);return;}
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
  const g=A.graph(ctx),backing={...g,dry:g.backingDry};
  for(const note of notes){
   const at=offset+note.at;
   if(note.params.role==='jam'){
    const gain=g.backingDry.gain;
    // In the offline copy, faithfully reproduce accompaniment ducking.
    gain.setTargetAtTime(.56,at,.015);
    gain.setTargetAtTime(1,at+.20,.12);
   }
   A.scheduleKitVoice(note.params.role==='loop'?backing:g,note.pad,at,{...note.params});
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
 const now=performance.now();
 // Align visual pose transitions to the AudioContext clock while LOOP runs.
 const beat=isPlaying?Math.floor(Math.max(0,(stateAt()-cycleAnchor)/stepSeconds())/2):Math.floor(now/640);
 const glitch=now<glitchUntil,building=now<blankUntil,brandNew=now<newUntil;
 const hit=pulseUntil.some(x=>x>now),mode=displayMode();
 if($('lcd-mode').textContent!==mode)$('lcd-mode').textContent=mode;
 if(now>messageUntil){const neutral=tape?'TAPE / RECORDING':dubArmed?`● OVERDUB / ${pendingDub.length} QUEUED`:isPlaying?'JAM / PLAY ALONG':'TAP TO PLAY';if($('status-text').textContent!==neutral)$('status-text').textContent=neutral;}
 const dark='#2a4930',light='#b9eb90',inner='#8bbc66',medium='#668a4b';
 ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,w,h);ctx.fillStyle=light;ctx.fillRect(0,0,w,h);
 // Dot paper texture remains stationary; no waveform or oscillogram.
 ctx.globalAlpha=.11;ctx.fillStyle=medium;
 for(let x=7;x<w;x+=9)for(let y=5;y<h;y+=9)ctx.fillRect(x,y,1,1);
 ctx.globalAlpha=1;
 // Whole-body 8-bit rabbits: broad cheeks, tiny torsos, dancing feet and paws.
 const scale=2.45;
 function bunny(n,pose,accident=false){
  const sx=17+n*44,sy=5,step=pose%4,hop=step===1||step===3;
  // Everything is placed in sprite pixels, including the legs; no bottom clipping.
  ctx.save();ctx.translate(Math.round(sx*scale),Math.round((sy+(hop?-2:0))*scale));
  if(accident){ctx.translate(13*scale,27*scale);ctx.rotate(Math.PI/2);ctx.translate(-13*scale,-27*scale);}
  const p=(x,y,w,h,col=dark)=>rectLocal(x,y,w,h,col);
  const rectLocal=(x,y,w,h,col)=>{ctx.fillStyle=col;ctx.fillRect(Math.round(x*scale),Math.round(y*scale),Math.round(w*scale),Math.round(h*scale));};
  const sway=step===3?1:step===1?-1:0;
  // Ears with individual tilts; one rabbit can suddenly lose its straight ear.
  p(5,0,5,11);p(17,0,5,11);
  p(6,2,2,7,inner);p(18,2,2,7,inner);
  if(step===2){p(4,2,3,2);p(20,2,3,2);}
  // Square-round head silhouette and light LCD face.
  p(4,8,19,2);p(2,10,23,3);p(1,13,25,10);p(3,23,21,3);p(6,26,15,2);
  p(4,12,19,11,light);p(6,10,15,3,light);p(6,23,15,3,light);
  p(2,18,2,3,inner);p(23,18,2,3,inner);
  // Bouncy cheek shape; black eyes can blink and occasionally turn into Xs.
  const blink=Math.floor(now/240+7*n)%29===0;
  const freak=glitch&&(n+beat)%3===0;
  if(freak){p(7,16,4,1);p(8,15,2,3);p(17,16,4,1);p(18,15,2,3);p(12,19,3,3);}
  else if(blink){p(7,19,3,1);p(17,19,3,1);}
  else {p(8,16,2,3);p(17,16,2,3);p(8,16,1,1,light);p(17,16,1,1,light);}
  p(12,19,3,2);p(11,22,2,1);p(15,22,2,1);
  p(5,21,3,1,inner);p(19,21,3,1,inner);
  // Little body, separate arms, rounded belly, visible knees and feet.
  p(8+sway,27,11,8);p(10+sway,29,7,5,light);
  if(step===1){p(4+sway,27,5,2);p(18+sway,25,6,2);}
  else if(step===3){p(4+sway,25,6,2);p(18+sway,27,5,2);}
  else {p(5+sway,29,4,4);p(18+sway,29,4,4);}
  p(7+sway,35,5,3);p(16+sway,35,5,3);
  if(step===2){p(6+sway,35,5,3);p(17+sway,33,5,3);}
  p(21+sway,31,3,3); // Tail.
  if(n===0){p(19,10,4,3);p(22,9,4,3);p(22,11,1,2,inner);}
  else if(n===1){p(12,9,3,2);p(14,10,2,2);}
  else{p(21,22,1,1);}
  ctx.restore();
 }
 const cycleStep=isPlaying?((Math.floor((stateAt()-cycleAnchor)/stepSeconds())%N+N)%N):0;
 const cycles=isPlaying?Math.floor(Math.max(0,stateAt()-cycleAnchor)/cycleSeconds()):0;
 // Rare, deterministic missteps: the third bunny trips for one 16th-note at the end of every fourth cycle.
 const trip=isPlaying&&cycles%4===3&&cycleStep>=27&&cycleStep<=31;
 for(let n=0;n<3;n++){
  const pose=building?(beat+n)%4:glitch?(beat+n*2)%4:brandNew?(beat+3-n)%4:(beat+n)%4;
  bunny(n,pose,(trip&&n===1)||(glitch&&n===(beat%3)&&cycleStep%8===0));
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
function init(){renderPads();bindControls();updateText();startCanvasFallback();attemptP5();if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('./sw.js?v=0.1.9', {updateViaCache:'none'}).catch(err=>console.warn('SW:',err));}
init();
window.WrongNumberDebug={blank,flashNew,balancePattern,generateOpen,generateFull,getScene:()=>deepCopy(scene),isPlaying:()=>isPlaying,isRecording:()=>!!tape,isDubArmed:()=>dubArmed,pendingDub:()=>deepCopy(pendingDub),setDub,commitDub,snapToStep,cycleAnchor:()=>cycleAnchor,visualState:()=>({blankUntil,newUntil,glitchUntil}),playPad,captureRecent,mutate,fresh,undo,startLoop,stopLoop,startTape,stopTape,exportWav,renderPads,setKit,kitLabel,audioState:()=>({context:live?.state||'none',kit:scene.kit,master:engine?.dry?.gain?.value??null})};
})();
