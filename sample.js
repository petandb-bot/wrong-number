/* WRONG NUMBER v0.1.2 — local SAMPLE instrument.
 * Recording / decoding happens in app.js. This module transforms decoded audio
 * into 16 playable fragments and schedules it through the ORIGINAL audio graph.
 * No uploaded files, cloud calls, or external sample dependencies.
 */
(()=>{'use strict';
const RATE=22050, LIMIT=12, DB='wrong-number-inputs-v1', STORE='samples';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const bufferCache=new WeakMap();
function fromAudioBuffer(decoded,name='UNTITLED'){
 const rate=decoded.sampleRate,srcLen=Math.min(decoded.length,Math.floor(rate*LIMIT));
 if(srcLen<rate*.12)throw new Error('AUDIO TOO SHORT (MIN 0.12S)');
 const channels=Array.from({length:Math.min(decoded.numberOfChannels,2)},(_,i)=>decoded.getChannelData(i));
 const len=Math.max(1,Math.floor(srcLen*RATE/rate)),pcm=new Float32Array(len);
 let peak=0;
 for(let i=0;i<len;i++){
  const p=i*rate/RATE,a=Math.floor(p),frac=p-a;
  let v=0;
  for(const ch of channels)v+=(ch[a]||0)* (1-frac)+(ch[Math.min(a+1,srcLen-1)]||0)*frac;
  v/=channels.length;pcm[i]=v;peak=Math.max(peak,Math.abs(v));
 }
 if(peak<.003)throw new Error('INPUT IS SILENT');
 // Controlled makeup gain rather than peak normalization of near-silence.
 const gain=Math.min(4,.90/peak);
 for(let i=0;i<len;i++)pcm[i]=clamp(pcm[i]*gain,-.97,.97);
 const slot=len/16,window=Math.max(32,Math.floor(RATE*.008)),slices=[];
 // Light onset-aware slicing: move each segment's start toward its most
 // pronounced transient, but never into the next segment.
 for(let pad=0;pad<16;pad++){
  const lo=Math.floor(pad*slot),hi=Math.min(len-1,Math.floor((pad+1)*slot));
  let start=lo,best=0;
  const searchEnd=Math.min(hi-16,lo+Math.max(1,Math.floor(slot*.48)));
  for(let j=lo;j<searchEnd;j+=window){
   const prev=pcm[Math.max(0,j-window)]||0,at=pcm[j]||0;
   const delta=Math.abs(at-prev)+Math.abs(at)*.3;
   if(delta>best){best=delta;start=j;}
  }
  slices.push({start,end:Math.max(start+1,hi)});
 }
 return {pcm,sampleRate:RATE,slices,name:String(name).replace(/[^\w .()\-]/g,'').slice(0,42)||'INPUT',duration:len/RATE,created:Date.now()};
}
function buffers(ctx,bank){
 let perContext=bufferCache.get(ctx);
 if(!perContext){perContext=new WeakMap();bufferCache.set(ctx,perContext);}
 let pair=perContext.get(bank);
 if(!pair){
  const a=ctx.createBuffer(1,bank.pcm.length,bank.sampleRate),b=ctx.createBuffer(1,bank.pcm.length,bank.sampleRate);
  a.copyToChannel(bank.pcm,0);const rev=new Float32Array(bank.pcm.length);
  for(let i=0;i<rev.length;i++)rev[i]=bank.pcm[rev.length-1-i];b.copyToChannel(rev,0);
  pair={normal:a,reverse:b};perContext.set(bank,pair);
 }
 return pair;
}
function schedule(g,pad,time,params={},bank){
 if(!bank?.pcm?.length)return;
 const ctx=g.ctx,i=pad|0,group=Math.floor(i/4),r=(params.seed>>>0)/4294967296;
 const part=bank.slices[i],all=buffers(ctx,bank),velocity=clamp(params.velocity??.85,.14,1.25);
 const color=params.color||{},broken=clamp(color.broken??.24,0,1),space=clamp(color.space??.27,0,1);
 const reverse=group===3&&(i%2===0||r>.77);
 const rates=[[.53,.70,.84,1.0],[1.0,1.2,1.55,1.88],[.74,.95,1.23,1.55],[.5,.75,1.12,1.46]];
 const pitch=Math.pow(2,clamp(color.shift??0,-2,2)/12);
 const rate=clamp(rates[group][i%4]*pitch*(1+(r-.5)*broken*.16),.32,2.4);
 const begin=part.start/bank.sampleRate,available=(part.end-part.start)/bank.sampleRate;
 const duration=Math.min(group===3?.95:group===0?.74:.48,Math.max(.03,available/rate));
 // The reverse buffer has the same length and uses mirrored slice boundaries.
 const offset=reverse?Math.max(0,bank.duration-part.end/bank.sampleRate):begin;
 const src=ctx.createBufferSource(),f=ctx.createBiquadFilter(),amp=ctx.createGain(),dry=ctx.createGain(),wet=ctx.createGain(),echo=ctx.createGain();
 src.buffer=reverse?all.reverse:all.normal;src.playbackRate.value=rate;
 f.type=group===1?'highpass':group===2?'bandpass':'lowpass';
 f.frequency.value=group===0?[390,620,850,1400][i%4]:group===1?[300,900,1700,3000][i%4]:group===2?[550,950,1550,2400][i%4]:[550,800,1600,2700][i%4];
 f.Q.value=group===2?1.4:.72;
 dry.gain.value=.70;wet.gain.value=.08+space*(group===3?.48:.2);
 echo.gain.value=.02+space*(group===3?.24:.12);
 src.connect(f);f.connect(amp);amp.connect(dry);amp.connect(wet);amp.connect(echo);
 dry.connect(g.dry);wet.connect(g.reverbIn);echo.connect(g.delayIn);
 const t=Math.max(.001,time),fade=Math.min(.018,duration*.28),release=Math.min(.045,duration*.25);
 const strength=velocity*(group===0?.85:group===1?.67:group===2?.70:.60)*(params.hold?.69:1);
 amp.gain.setValueAtTime(.00001,t);
 amp.gain.linearRampToValueAtTime(Math.max(.0001,strength),t+fade);
 amp.gain.setValueAtTime(Math.max(.0001,strength),t+Math.max(fade,duration-release));
 amp.gain.linearRampToValueAtTime(.00001,t+duration);
 src.start(t,Math.max(0,offset),Math.min(available, duration*rate));src.stop(t+duration+.012);
}
function openDb(){return new Promise((resolve,reject)=>{
 if(!('indexedDB' in window)){reject(new Error('LOCAL STORAGE NOT AVAILABLE'));return;}
 const req=indexedDB.open(DB,1);
 req.onupgradeneeded=()=>req.result.createObjectStore(STORE);
 req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
});}
async function save(bank){const db=await openDb();try{return await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(bank,'current');tx.oncomplete=()=>resolve(true);tx.onerror=()=>reject(tx.error);});}finally{db.close();}}
async function load(){const db=await openDb();try{return await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly'),req=tx.objectStore(STORE).get('current');req.onsuccess=()=>{const b=req.result;resolve(b?.pcm?.length ? {...b,pcm:new Float32Array(b.pcm)} : null);};req.onerror=()=>reject(req.error);});}finally{db.close();}}
async function clear(){const db=await openDb();try{return await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).delete('current');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}finally{db.close();}}
window.WrongSamples={fromAudioBuffer,schedule,save,load,clear,LIMIT};
})();
