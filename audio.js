/* WRONG NUMBER audio engine v0.3.5 — calibrated voices, controlled peaks and smoother FX. */
(()=>{'use strict';
const TAU=Math.PI*2, clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function rng(seed){let a=seed>>>0;return ()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
function makeNoise(ctx){
 const frames=Math.round(ctx.sampleRate*2),b=ctx.createBuffer(1,frames,ctx.sampleRate),data=b.getChannelData(0);let state=1784421;
 for(let i=0;i<frames;i++){state^=state<<13;state^=state>>>17;state^=state<<5;data[i]=((state>>>0)/2147483648-1)*.82;}return b;
}
function makeImpulse(ctx){const len=Math.round(ctx.sampleRate*1.35),b=ctx.createBuffer(2,len,ctx.sampleRate);for(let ch=0;ch<2;ch++){const a=b.getChannelData(ch),r=rng(911+ch*17);for(let i=0;i<len;i++){const t=i/ctx.sampleRate;const density=Math.pow(1-t/1.35,2.7);a[i]=(r()*2-1)*density*.19;}}return b;}
// Shared signal path for live playback and offline export. The EQ manages
// sub-bass buildup and high-frequency fatigue; a short safety stage prevents
// coincident pad/FX transients from exceeding the PCM ceiling.
function graph(ctx){
 const dry=ctx.createGain();dry.gain.value=.77;
 const backingDry=ctx.createGain();backingDry.gain.value=1;backingDry.connect(dry);
 const subCut=ctx.createBiquadFilter();subCut.type='highpass';subCut.frequency.value=29;subCut.Q.value=.707;
 const lowShelf=ctx.createBiquadFilter();lowShelf.type='lowshelf';lowShelf.frequency.value=185;lowShelf.gain.value=-1.5;
 const treble=ctx.createBiquadFilter();treble.type='highshelf';treble.frequency.value=4000;treble.gain.value=-3.0;
 const compressor=ctx.createDynamicsCompressor();compressor.threshold.value=-14;compressor.knee.value=15;compressor.ratio.value=3;compressor.attack.value=.005;compressor.release.value=.18;
 const safety=ctx.createWaveShaper();const curve=new Float32Array(4097);
 for(let i=0;i<curve.length;i++){
  const x=i/2048-1,a=Math.abs(x);
  curve[i]=Math.sign(x)*(a<=.70?a:.70+.22*(1-Math.exp(-(a-.70)/.22)));
 }
 safety.curve=curve;safety.oversample='2x';
 const output=ctx.createGain();output.gain.value=.89;
 dry.connect(subCut);subCut.connect(lowShelf);lowShelf.connect(treble);
 treble.connect(compressor);compressor.connect(safety);safety.connect(output);output.connect(ctx.destination);
 const reverbIn=ctx.createGain(),convolver=ctx.createConvolver(),reverbOut=ctx.createGain();
 convolver.buffer=makeImpulse(ctx);reverbOut.gain.value=.32;
 reverbIn.connect(convolver);convolver.connect(reverbOut);reverbOut.connect(subCut);
 const delayIn=ctx.createGain(),delay=ctx.createDelay(1),tone=ctx.createBiquadFilter(),fb=ctx.createGain(),delayOut=ctx.createGain();
 delay.delayTime.value=.294;tone.type='lowpass';tone.frequency.value=2400;fb.gain.value=.23;delayOut.gain.value=.22;
 delayIn.connect(delay);delay.connect(tone);tone.connect(fb);fb.connect(delay);tone.connect(delayOut);delayOut.connect(subCut);
 return {ctx,dry,backingDry,reverbIn,delayIn,noise:makeNoise(ctx)};
}
function bus(g,time,level,space=.12,echo=.1){const ctx=g.ctx,b=ctx.createGain(),send=ctx.createGain(),ed=ctx.createGain();b.gain.value=level;b.connect(g.dry);send.gain.value=space;ed.gain.value=echo;b.connect(send);b.connect(ed);send.connect(g.reverbIn);ed.connect(g.delayIn);return b;}
function adsr(param,time,peak,dur,attack=.004,decay=.08){
 const t=Math.max(.0001,time),d=Math.max(.023,dur),a=Math.min(attack,d*.25),tail=Math.max(.009,Math.min(decay,d*.38));
 param.setValueAtTime(.00001,t);param.exponentialRampToValueAtTime(Math.max(.0001,peak),t+a);param.setValueAtTime(Math.max(.0001,peak),t+a+.001);param.exponentialRampToValueAtTime(.00001,t+d);return d;
}
function oscillator(g,out,time,{f=220,endF=f,d=.2,a=.2,type='sine',attack=.003,detune=0,filter=0,q=.8}={}){
 const c=g.ctx,osc=c.createOscillator(),amp=c.createGain();osc.type=type;osc.frequency.setValueAtTime(Math.max(25,f),time);if(endF!==f)osc.frequency.exponentialRampToValueAtTime(Math.max(25,endF),time+Math.max(.014,d*.66));osc.detune.value=detune;
 let target=out;
 if(filter){const flt=c.createBiquadFilter();flt.type='lowpass';flt.frequency.value=filter;flt.Q.value=q;amp.connect(flt);flt.connect(target);}else amp.connect(target);
 adsr(amp.gain,time,a,d,attack);osc.connect(amp);osc.start(time);osc.stop(time+d+.015);
 return osc;
}
function noise(g,out,time,{d=.14,a=.25,hp=0,lp=0,bp=0,q=.8,attack=.001,offset=.14}={}){
 const ctx=g.ctx,source=ctx.createBufferSource(),amp=ctx.createGain();source.buffer=g.noise;let node=source;
 if(hp||lp||bp){const filter=ctx.createBiquadFilter();filter.type=bp?'bandpass':(hp?'highpass':'lowpass');filter.frequency.value=bp||hp||lp;filter.Q.value=q;node.connect(filter);node=filter;}
 node.connect(amp);amp.connect(out);adsr(amp.gain,time,a,d,attack);source.start(time,clamp(offset,0,1.1),d+.01);source.stop(time+d+.015);
 return source;
}
function fm(g,out,time,{f=160,m=3,index=90,d=.22,a=.23,attack=.003,drop=1}={}){
 const ctx=g.ctx,carrier=ctx.createOscillator(),mod=ctx.createOscillator(),depth=ctx.createGain(),amp=ctx.createGain();
 carrier.type='sine';mod.type='sine';carrier.frequency.setValueAtTime(f,time);carrier.frequency.exponentialRampToValueAtTime(Math.max(28,f*drop),time+d*.72);mod.frequency.value=f*m;depth.gain.setValueAtTime(index,time);depth.gain.exponentialRampToValueAtTime(.01,time+d);mod.connect(depth);depth.connect(carrier.frequency);
 adsr(amp.gain,time,a,d,attack);carrier.connect(amp);amp.connect(out);carrier.start(time);mod.start(time);carrier.stop(time+d+.02);mod.stop(time+d+.02);
}
// Conservative relative balances: percussion transients retain dynamics, while
// very long low notes and piercing special hits are kept behind the player's lead.
const PAD_LEVELS=[
 [.96,.73,.98,.96,1.02,1.06,1.02,1.00,1.18,1.00,1.04,1.06,.98,.88,.98,.86],
 [.97,.83,.96,.96,.99,1.04,1.00,1.01,.95,1.00,.90,.95,.98,.88,.97,.88],
 [.96,.75,.96,.94,1.02,1.02,.95,1.00,.88,.92,.86,.92,1.00,.80,.94,.83],
 [.97,.83,.98,.93,1.03,1.01,1.03,.98,1.00,.99,.88,.91,.99,.82,.96,.86],
 [.97,.90,.95,.95,1.01,1.00,1.00,.99,.97,.95,.91,.93,.98,.88,.96,.87],
 [.69,.68,.70,.68,.69,.70,.67,.69,.68,.68,.68,.67,.68,.68,.70,.68]
];
const padGain=(kit,pad)=>PAD_LEVELS[Math.max(0,Math.min(5,kit|0))][Math.max(0,Math.min(15,pad|0))];
// Machine-generated patterns leave room for the next note. The full tails
// remain available in live pad performance, so this is not a global gate.
function tameLoopTail(voice,t,role,pad){
 if(role!=='loop'||!(pad===1||pad>=13))return;
 const cutoff=pad===1?.48:.61,level=voice.gain.value;
 voice.gain.setValueAtTime(level,t);
 voice.gain.setValueAtTime(level,t+cutoff*.66);
 voice.gain.linearRampToValueAtTime(.0001,t+cutoff);
}
function scheduleVoice(g,pad,time,params={}){
 const seed=params.seed??1,id=(pad|0),r=rng((seed^((id+1)*2654435761))>>>0),color=params.color||{broken:.2,space:.3,shift:0};
 const vel=clamp(params.velocity??.85,.14,1.25),hold=params.hold||false,fire=params.fire||false;
 const transpose=clamp((color.shift||0)*2+((fire?r()-.5:0)*5),-8,8),pitch=Math.pow(2,transpose/12);
 const broken=clamp(color.broken??.2,0,1),space=clamp(color.space??.3,0,1);
 const tonal=1+(r()-.5)*(.018+broken*.12),v=vel*(hold?.67:1),t=Math.max(.001,time),voice=bus(g,t,v*.74*padGain(0,id),.075+space*.15,.024+space*.10),u=()=>r();
 switch(id){
  case 0: // Deep pressure kick, pitch decay and little beater
   oscillator(g,voice,t,{f:149*pitch,endF:46*pitch,d:.42,a:.49,type:'sine',attack:.002});
   oscillator(g,voice,t,{f:60*pitch,endF:48*pitch,d:.25,a:.24,type:'sine',attack:.006});
   noise(g,voice,t,{d:.018,a:.2,hp:3500,offset:u()});break;
  case 1: // Rounded sub with a beating partial
   oscillator(g,voice,t,{f:74*pitch*tonal,endF:48*pitch,d:.63,a:.42,attack:.006});
   oscillator(g,voice,t,{f:75.4*pitch,endF:49*pitch,d:.49,a:.19,type:'triangle',attack:.013});break;
  case 2: // Muted saw bass
   oscillator(g,voice,t,{f:93*pitch,endF:69*pitch,d:.32,a:.23,type:'sawtooth',filter:370+u()*160,attack:.002});
   oscillator(g,voice,t,{f:46*pitch,endF:45*pitch,d:.37,a:.31,attack:.007});break;
  case 3: // Rubber FM low hit
   fm(g,voice,t,{f:113*pitch,m:2.91,index:157+broken*160,d:.27,a:.40,drop:.48});
   oscillator(g,voice,t,{f:49*pitch,d:.35,a:.12});break;
  case 4: // Micro transient
   noise(g,voice,t,{d:.034,a:.24,hp:5300,offset:u()});
   oscillator(g,voice,t,{f:2190*pitch,endF:1200*pitch,d:.018,a:.06});break;
  case 5: // Wood/ceramic block
   fm(g,voice,t,{f:335*pitch,m:1.44,index:110,d:.085,a:.32,drop:.71});
   noise(g,voice,t,{d:.04,a:.09,bp:1450,q:2,offset:u()});break;
  case 6: // Inharmonic scraps
   [547,778,1211,1937].forEach((f,i)=>oscillator(g,voice,t,{f:f*pitch*tonal,endF:f*pitch*.99,d:.13+i*.058,a:.075-i*.008,type:'sine',attack:.001}));
   noise(g,voice,t,{d:.045,a:.10,hp:4400,offset:u()});break;
  case 7: // Thin snare
   noise(g,voice,t,{d:.16+u()*.06,a:.33,bp:2400,q:.62,offset:u()});
   oscillator(g,voice,t,{f:192*pitch,endF:133*pitch,d:.105,a:.14});break;
  case 8: // Broken formant voice
   [380,820,1430].forEach((f,i)=>{const filter=g.ctx.createBiquadFilter();filter.type='bandpass';filter.frequency.value=f*(.87+u()*.23);filter.Q.value=4+i*2;filter.connect(voice);oscillator(g,filter,t,{f:129*pitch*tonal,d:.20+i*.025,a:.21,type:'sawtooth'});});break;
  case 9: // Dusty glass
   [721,1117,1779].forEach((f,i)=>oscillator(g,voice,t,{f:f*pitch*tonal,d:.36+i*.12,a:.12/(1+i*.45),attack:.002}));break;
  case 10: // Transmission error; actual short micro phrase
   for(let i=0;i<5;i++){const bt=t+i*(.027+broken*.006),freq=(208+u()*1100)*pitch;
    oscillator(g,voice,bt,{f:freq,endF:freq*(.48+u()*.9),d:.019+u()*.025,a:.13,type:i%2?'square':'triangle',attack:.001});}break;
  case 11: // Jittered grain cluster
   for(let i=0;i<7;i++){const bt=t+i*(.024+broken*.012)+u()*.009,f=(215+u()*840)*pitch;
    oscillator(g,voice,bt,{f,endF:f*(.7+u()*.6),d:.029+u()*.029,a:.09,type:'triangle',attack:.002});}
   noise(g,voice,t,{d:.16,a:.07,bp:1200+u()*2200,offset:u()});break;
  case 12: { // Reverse envelope with bright end, not a sample playback
   const src=g.ctx.createBufferSource(),flt=g.ctx.createBiquadFilter(),amp=g.ctx.createGain();src.buffer=g.noise;flt.type='bandpass';flt.frequency.setValueAtTime(540,t);flt.frequency.exponentialRampToValueAtTime(4300,t+.42);flt.Q.value=.8;
   src.connect(flt);flt.connect(amp);amp.connect(voice);amp.gain.setValueAtTime(.0001,t);amp.gain.linearRampToValueAtTime(.27,t+.36);amp.gain.exponentialRampToValueAtTime(.0001,t+.51);src.start(t,u(),.53);src.stop(t+.54);
   oscillator(g,voice,t+.37,{f:344*pitch,endF:152*pitch,d:.21,a:.11,attack:.013});break;
  }
  case 13: // Hollow ghost bell
   fm(g,voice,t,{f:336*pitch,m:1.37,index:66,d:.62,a:.21,attack:.005,drop:.92});
   oscillator(g,voice,t,{f:229*pitch,d:.76,a:.09,type:'triangle',attack:.016});break;
  case 14: // Air and residue
   noise(g,voice,t,{d:.53,a:.17,bp:1100+u()*700,q:.42,attack:.11,offset:u()});
   oscillator(g,voice,t+.09,{f:184*pitch,d:.32,a:.055,attack:.10});break;
  case 15: // Suspended, cold harmonic cloud
   [110,164.8,247.8,333].forEach((f,i)=>oscillator(g,voice,t+i*.015,{f:f*pitch*(1+(u()-.5)*.019),d:.81+i*.075,a:.063,attack:.055+i*.012,type:i===1?'triangle':'sine'}));break;
 }
 tameLoopTail(voice,t,params.role,id);
 return voice;
}
function audioBufferToWav(buffer,startFrame,endFrame){
 const sampleRate=buffer.sampleRate,channels=2,n=endFrame-startFrame,ab=new ArrayBuffer(44+n*channels*2),view=new DataView(ab);let pos=0;
 const u8=s=>{for(let i=0;i<s.length;i++)view.setUint8(pos++,s.charCodeAt(i));};
 const u16=x=>{view.setUint16(pos,x,true);pos+=2;};const u32=x=>{view.setUint32(pos,x,true);pos+=4;};
 u8('RIFF');u32(36+n*4);u8('WAVE');u8('fmt ');u32(16);u16(1);u16(2);u32(sampleRate);u32(sampleRate*4);u16(4);u16(16);u8('data');u32(n*4);
 const left=buffer.getChannelData(0),right=buffer.numberOfChannels>1?buffer.getChannelData(1):left;
 let peak=0;for(let i=startFrame;i<endFrame;i++){peak=Math.max(peak,Math.abs(left[i]),Math.abs(right[i]));}
 const gain=peak>.90?.90/peak:1;
 for(let i=startFrame;i<endFrame;i++){let l=clamp(left[i]*gain,-1,1),r=clamp(right[i]*gain,-1,1);view.setInt16(pos,l<0?l*32768:l*32767,true);pos+=2;view.setInt16(pos,r<0?r*32768:r*32767,true);pos+=2;}
 return new Blob([ab],{type:'audio/wav'});
}
/* Three additional synthesized instruments. All voices use the same graph and
   offline render paths; nothing is streamed, sampled or downloaded. */
const KIT_TITLES=['CANDY KIT','TOY MALFUNCTION','SUGAR POISON','ROTTEN CARROT','WORM PARADE','BAD SPELLING'];
const KIT_SHORT=['CANDY','TOY','SUGAR','CARROT','WORMS','SPELL'];
const KIT_PAD_NAMES=[null,null,null,null,null,['AH!','UH','EH↑','OH?','IH','WU','YEH','MM','BA!','BU','BE?','BO','WEE','YOW','EHK','NO!']];
function scheduleKitVoice(g,pad,time,params={}){
 const kit=clamp(Math.floor(Number(params.kit)||0),0,KIT_TITLES.length-1);
 if(kit===0)return scheduleVoice(g,pad,time,params);
 if(kit===5)return scheduleSpeech(g,pad,time,params);
 const id=pad|0,t=Math.max(.001,time),r=rng(((params.seed||1)^Math.imul((id+23),(kit+1)*0x9e3779b1))>>>0);
 const rand=()=>r(),color=params.color||{},hold=!!params.hold,fire=!!params.fire;
 const broken=clamp(color.broken??.24,0,1),space=clamp(color.space??.26,0,1);
 const trans=clamp((color.shift||0)*1.7+(fire?rand()-.5:0)*4,-7,7);
 const p=Math.pow(2,trans/12),vol=clamp(params.velocity??.85,.18,1.1)*(hold?.70:1);
 const v=bus(g,t,vol*padGain(kit,id)*(kit===3?.77:kit===4?.68:.73),
  kit===2?.16+space*.15:kit===3?.07+space*.12:kit===4?.10+space*.12:.055+space*.11,
  kit===1?.027:kit===2?.09:kit===3?.05:.045);
 const osc=(f,d,a,kind='sine',to=f,offset=0)=>oscillator(g,v,t+offset,{f:f*p,endF:to*p,d,a,type:kind,attack:kind==='sawtooth'?.002:.004});
 const hit=(d,a,hp=2400,offset=0)=>noise(g,v,t,{d,a,hp,offset:rand()*.87+offset});
 const band=(d,a,f,q=.8)=>noise(g,v,t,{d,a,bp:f,q,offset:rand()*.81});
 const mod=(f,m,index,d,a,drop=1,offset=0)=>fm(g,v,t+offset,{f:f*p,m,index,d,a,drop});
 const f=(factor=1)=>factor*(1+(rand()-.5)*(.02+broken*.035));

 if(kit===1){ // TOY MALFUNCTION — elastic circuits, intentionally awkward intervals
  if(id<4){
   if(id===0){mod(111,2.5,185,.28,.43,.39);osc(66,.29,.17,'triangle',44);hit(.012,.085,5100);}
   if(id===1){osc(92,.42,.32,'square',49);osc(46,.40,.18,'sine',40);}
   if(id===2){mod(154,4.7,185,.27,.35,.48);osc(61,.35,.11);}
   if(id===3){osc(204,.14,.15,'square',63);mod(98,2.9,270,.31,.31,.62);}
  }else if(id<8){
   const ix=id-4;
   if(ix===0){hit(.022,.24,6100);osc(1530,.025,.13,'square',640);}
   if(ix===1){mod(450,1.2,78,.09,.31,.62);hit(.025,.07,3900);}
   if(ix===2){[550,884,1340].forEach((n,i)=>osc(n,.065+i*.033,.10-i*.015,'square',n*.76));}
   if(ix===3){band(.11,.29,1650,2);osc(250,.09,.16,'triangle',110);}
  }else if(id<12){
   const n=id-8;
   if(n===0){mod(240,2.4,155,.27,.30,.8);osc(123,.13,.10,'sawtooth',115);}
   if(n===1){[395,596,987].forEach((q,i)=>osc(q,.25+i*.08,.1,'triangle',q*f(.97),i*.009));}
   if(n===2){for(let i=0;i<4;i++)osc(280+rand()*1600,.022,.15,'square',160+rand()*600,i*.035);}
   if(n===3){for(let i=0;i<6;i++)mod(260+i*92,1.8,110,.036,.092,.5,i*.028);}
  }else{
   const n=id-12;
   if(n===0){band(.43,.23,680,1.2);osc(410,.29,.09,'triangle',230,.17);}
   if(n===1){mod(275,1.3,90,.61,.17,.78);osc(184,.48,.09,'triangle',170);}
   if(n===2){band(.54,.18,1900,.46);mod(640,1.9,27,.37,.11,1);}
   if(n===3){[147,220,294].forEach((q,i)=>osc(q,.60+i*.1,.077,'square',q*f(.99),i*.022));}
  }
 }else if(kit===2){ // SUGAR POISON — cold, fragile, smeared aftertaste
  if(id<4){
   if(id===0){osc(127,.49,.46,'sine',42);osc(78,.38,.20,'triangle',48);hit(.013,.09,4700);}
   if(id===1){mod(72,1.8,63,.74,.35,.61);osc(51,.64,.15);}
   if(id===2){osc(98,.44,.30,'sawtooth',71);mod(106,1.4,110,.35,.13,.72);}
   if(id===3){mod(135,3.9,200,.48,.30,.59);osc(53,.34,.14);}
  }else if(id<8){
   const n=id-4;
   if(n===0){band(.061,.30,3900,1.9);osc(2670,.025,.07);}
   if(n===1){[437,711].forEach((q,i)=>osc(q,.20+i*.05,.17,'sine',q*f(.99)));}
   if(n===2){[631,987,1633].forEach((q,i)=>osc(q,.3+i*.07,.12/(1+i*.42)));}
   if(n===3){band(.22,.28,3050,1);osc(206,.085,.11,'sine',139);}
  }else if(id<12){
   const n=id-8;
   if(n===0){mod(174,2.17,160,.37,.22,.9);osc(346,.18,.12,'sawtooth',230);}
   if(n===1){[785,1190,1890].forEach((q,i)=>osc(q,.48+i*.12,.13/(1+i*.55),'sine',q*f(.99)));}
   if(n===2){for(let i=0;i<6;i++)osc(500+rand()*1900,.018+rand()*.028,.072,'triangle',200+rand()*700,i*.044);}
   if(n===3){band(.17,.21,1200,2);for(let i=0;i<4;i++)osc(830+i*173,.035,.07,'sine',260+i*41,i*.032);}
  }else{
   const n=id-12;
   if(n===0){band(.46,.18,1800,.5);osc(420,.22,.13,'sine',180,.21);}
   if(n===1){mod(268,1.34,78,.91,.20,.94);osc(397,.52,.072);}
   if(n===2){band(.76,.18,1100,.42);osc(295,.39,.075,'triangle',232,.1);}
   if(n===3){[164,247,369,515].forEach((q,i)=>osc(q,.84+i*.09,.074/(1+i*.25),'sine',q*f(.97),i*.029));}
  }
 }else if(kit===3){ // ROTTEN CARROT — sticky rubber, sour organics and insect-like chirps.
  if(id<4){
   if(id===0){osc(132,.31,.46,'sine',43);mod(92,2.32,180,.29,.24,.43);hit(.014,.06,4000);}
   if(id===1){mod(78,1.78,210,.52,.31,.62);osc(42,.45,.21,'triangle',39);}
   if(id===2){osc(102,.26,.27,'sawtooth',63);mod(88,5.4,142,.41,.20,.68);}
   if(id===3){mod(186,3.37,275,.45,.32,.35);osc(61,.38,.13,'sine',39);}
  }else if(id<8){
   const n=id-4;
   if(n===0){band(.054,.27,2600,3.1);osc(890,.033,.13,'triangle',360);}
   if(n===1){mod(430,2.6,165,.13,.27,.36);hit(.027,.10,3200);}
   if(n===2){band(.13,.29,1750,1.5);osc(681,.13,.10,'square',415);}
   if(n===3){hit(.068,.24,4800);mod(210,1.3,110,.11,.20,.63);}
  }else if(id<12){
   const n=id-8;
   if(n===0){for(let i=0;i<3;i++)mod(166+i*95,2.8,105,.078,.14,.54,i*.058);}
   if(n===1){[317,494,713].forEach((q,i)=>osc(q,.32+i*.065,.10,'triangle',q*(.76+rand()*.22),i*.018));}
   if(n===2){for(let i=0;i<6;i++)osc(360+rand()*1300,.018+rand()*.02,.095,'square',125+rand()*470,i*.026);}
   if(n===3){band(.22,.21,950,2.2);for(let i=0;i<4;i++)mod(500+i*110,1.63,50,.042,.076,.41,i*.042);}
  }else{
   const n=id-12;
   if(n===0){band(.51,.19,930,.61);osc(460,.29,.10,'triangle',190,.18);}
   if(n===1){mod(195,2.27,150,.69,.25,.77);osc(102,.55,.08,'triangle',87);}
   if(n===2){band(.64,.20,2300,.53);for(let i=0;i<3;i++)osc(830+i*117,.13,.052,'sine',420+i*55,i*.12);}
   if(n===3){[104,151,237,355].forEach((q,i)=>osc(q,.76+i*.13,.079,'triangle',q*f(.9),i*.035));}
  }
 }else{ // WORM PARADE — rubber chirps, irregular chirrup runs, and crooked carnival tones.
  if(id<4){
   if(id===0){osc(165,.30,.39,'sine',47);mod(128,3.44,135,.34,.28,.39);}
   if(id===1){osc(89,.50,.34,'triangle',37);mod(67,6.2,115,.22,.20,.45);}
   if(id===2){mod(119,4.1,240,.37,.34,.58);osc(52,.34,.19);}
   if(id===3){osc(266,.20,.20,'square',60);mod(136,3.8,260,.33,.26,.54);}
  }else if(id<8){
   const n=id-4;
   if(n===0){hit(.021,.23,6200);osc(2170,.024,.09,'square',420);}
   if(n===1){for(let i=0;i<2;i++)mod(460+i*275,3.15,160,.067,.23,.5,i*.06);}
   if(n===2){[590,1090,1653].forEach((q,i)=>osc(q,.10+i*.025,.10,'triangle',q*(.41+i*.08)));}
   if(n===3){band(.15,.25,1900,.72);osc(215,.09,.11,'sine',125);}
  }else if(id<12){
   const n=id-8;
   if(n===0){for(let i=0;i<4;i++)mod(340+i*93,2.74,180,.044,.11,.63,i*.054);}
   if(n===1){[650,900,1210].forEach((q,i)=>osc(q,.23+i*.07,.12,'square',q*(.76+rand()*.11),i*.011));}
   if(n===2){for(let i=0;i<7;i++)osc(210+rand()*1430,.013+rand()*.02,.082,'triangle',90+rand()*300,i*.023);}
   if(n===3){for(let i=0;i<4;i++){hit(.014,.13,1700+i*330);osc(650+i*190,.036,.085,'square',290,i*.05);}}
  }else{
   const n=id-12;
   if(n===0){band(.38,.22,710,.7);osc(515,.22,.10,'square',180,.14);}
   if(n===1){mod(331,3.5,220,.65,.19,.88);osc(165,.57,.07,'triangle');}
   if(n===2){band(.59,.16,1610,.41);for(let i=0;i<3;i++)osc(715+i*150,.13,.08,'triangle',320,i*.1);}
   if(n===3){[145,215,324,485].forEach((q,i)=>osc(q,.75+i*.11,.077,'triangle',q*(.93+rand()*.06),i*.017));}
  }
 }
 tameLoopTail(v,t,params.role,id);
 return v;
}


// BAD SPELLING: short speech-chip one-shots. Each pad has one articulation;
// neither a long spoken word nor a transient drum voice.
const SPEECH_TABLE=[
 // vowel, Hz, pitch bend in semitones, seconds, attack type, brightness, grit
 ['A',135, 4,.185,'v',.91,.20], ['U',105,-6,.205,'v',.81,.40],
 ['E',170, 7,.185,'v',1.00,.20], ['O',124,-3,.195,'v',.80,.42],
 ['I',197, 2,.130,'s',.96,.45], ['U',154, 4,.145,'w',.86,.37],
 ['E',173,-4,.155,'y',.99,.34], ['M',112, 2,.190,'n',.68,.18],
 ['A',150,-5,.150,'b',.94,.34], ['U',129, 5,.155,'b',.82,.38],
 ['E',185, 6,.165,'b',1.00,.22],['O',141,-5,.165,'b',.84,.40],
 ['I',228, 5,.140,'w',1.01,.23],['A',190,-7,.175,'y',.95,.46],
 ['E',143,-8,.120,'k',1.02,.62],['O',106,-6,.180,'n',.72,.36]
];
const SPEECH_FORMANTS={
 A:[800,1370,2730],U:[360,1180,2300],E:[515,1920,2720],
 I:[315,2380,3120],O:[505,920,2500],M:[260,1030,2100]
};
const speechBank=new WeakMap();
function makeSpeechBuffer(ctx,id){
 let bank=speechBank.get(ctx);
 if(!bank){bank=new Map();speechBank.set(ctx,bank);}
 if(bank.has(id))return bank.get(id);
 const [vowel,base,bend,duration,onset,brightness,grit]=SPEECH_TABLE[id];
 const sr=ctx.sampleRate,n=Math.ceil((duration+.015)*sr);
 const buf=ctx.createBuffer(1,n,sr),data=buf.getChannelData(0);
 const dest=SPEECH_FORMANTS[vowel],r=rng(0x9e3779b9^Math.imul(id+1,2673));
 // A deterministic glottal pulse feeds three resonances. The periodic excitation
 // and quantized pitch changes give it cheap speech-synth character.
 const poles=dest.map((f,i)=>{
  const bw=[115,175,260][i],decay=Math.exp(-Math.PI*bw/sr);
  return {a:2*decay*Math.cos(2*Math.PI*f/sr),b:decay*decay,g:[.75,.59,.35][i]*brightness,y1:0,y2:0};
 });
 let phase=0,hold=0,peak=0;
 for(let i=0;i<n;i++){
  const t=i/sr,u=t/duration;
  if(u>=1){data[i]=0;continue;}
  // Fourteen-millisecond pitch steps, like an inexpensive phoneme ROM.
  const stair=Math.floor(t/.014),fraction=Math.min(1,stair*.014/duration);
  const semis=bend*(fraction<.6?fraction*.72:fraction*1.2-.288);
  const f0=base*Math.pow(2,semis/12)*(1+.007*Math.sin(stair*1.91));
  phase+=f0/sr;
  if(phase>=1)phase-=1;
  // Glottal pulses have several harmonics, with a small alternating buzz.
  const glottal=(phase<.18?Math.sin(Math.PI*phase/.18):0)-.1146;
  let excite=glottal*.68+.035*Math.sin(phase*Math.PI*2);
  // A softened consonant transition, not a second percussive event.
  if(t<.021){
   if(onset==='s'||onset==='k')excite+=(r()*2-1)*.22*(1-t/.021);
   if(onset==='b')excite*=.24+.76*t/.021;
   if(onset==='w'||onset==='y')excite*=.50+.50*t/.021;
   if(onset==='n')excite*=.75;
  }
  let sample=0;
  for(let j=0;j<3;j++){
   const q=poles[j];
   // Light phoneme onset / release movement gives a single vowel some articulation.
   const transition=t<.032?(t/.032):1;
   const x=excite*(.40+.60*transition);
   const y=x+q.a*q.y1-q.b*q.y2;
   q.y2=q.y1;q.y1=y;
   sample+=y*q.g;
  }
  const attack=Math.min(1,t/.008),release=Math.min(1,(duration-t)/.029);
  const shaped=sample*attack*release*(.83+.17*Math.sin(Math.PI*u));
  // Digital stepping is restrained: audible texture without harsh clipping.
  if(i%2===0)hold=Math.round(shaped*(140-grit*65))/(140-grit*65);
  data[i]=hold;
  peak=Math.max(peak,Math.abs(hold));
 }
 // Each pad is level-matched while preserving stronger/weaker articulation.
 const scale=Math.min(3.5,.37/Math.max(.001,peak));
 for(let i=0;i<n;i++)data[i]*=scale;
 bank.set(id,buf);
 return buf;
}
function scheduleSpeech(g,pad,time,params={}){
 const ctx=g.ctx,id=clamp(pad|0,0,15),t=Math.max(.001,time);
 const color=params.color||{},vel=clamp(params.velocity??.85,.18,1.1)*(params.hold?.76:1);
 const source=ctx.createBufferSource(),out=bus(g,t,vel*.50*padGain(5,id),.003,0);
 const env=ctx.createGain(),filter=ctx.createBiquadFilter(),[vowel,base,bend,dur,onset,bright,grit]=SPEECH_TABLE[id];
 source.buffer=makeSpeechBuffer(ctx,id);
 filter.type='lowpass';filter.frequency.value=clamp(3200+(color.broken??.24)*900,1700,5200);
 filter.Q.value=.35;
 const shift=clamp((color.shift||0)*1.4+(params.fire?.35:0),-5,5);
 source.playbackRate.value=Math.pow(2,shift/12);
 env.gain.setValueAtTime(.0001,t);
 env.gain.linearRampToValueAtTime(1,t+.004);
 const end=t+(source.buffer.length/source.buffer.sampleRate)/source.playbackRate.value;
 env.gain.setValueAtTime(1,Math.max(t+.008,end-.013));
 env.gain.linearRampToValueAtTime(.0001,end);
 source.connect(filter);filter.connect(env);env.connect(out);
 source.start(t);source.stop(end+.002);
 return out;
}

// Real accidents are transformations of an actual rendered pad voice. The buffer
// is generated before the event so no asynchronous work is done in the scheduler.
const ACCIDENT_NAMES=['STUTTER','REVERSE','TAPE BEND','CRUSH'];
const FX_SAMPLE_SECONDS=1.05;
async function renderFxSource(pad,params={}){
 const Offline=window.OfflineAudioContext||window.webkitOfflineAudioContext;
 if(!Offline)throw new Error('OfflineAudioContext unavailable');
 const rate=22050,ctx=new Offline(2,Math.ceil(rate*FX_SAMPLE_SECONDS),rate);
 const g=graph(ctx);
 scheduleKitVoice(g,pad,.015,{...params,hold:false,fire:false,role:'fx-source'});
 return ctx.startRendering();
}
function sliceBuffer(ctx,original,from,duration,{reverse=false,crush=false}={}){
 const sr=original.sampleRate,start=Math.max(0,Math.floor(from*sr));
 const n=Math.max(1,Math.min(Math.ceil(duration*sr),original.length-start));
 const b=ctx.createBuffer(2,n,sr);
 for(let channel=0;channel<2;channel++){
  const input=original.getChannelData(Math.min(channel,original.numberOfChannels-1));
  const out=b.getChannelData(channel);
  if(crush){
   // True sample-and-hold decimation plus low-bit-depth quantization.
   let held=0;
   for(let i=0;i<n;i++){
    if(i%6===0)held=Math.round(input[start+i]*23)/23;
    out[i]=held*.68+input[start+i]*.32;
   }
  }else{
   for(let i=0;i<n;i++)out[i]=input[start+(reverse?n-1-i:i)];
  }
 }
 return b;
}
function scheduleAccident(g,pad,at,kind,params={},bpm=100,source){
 if(!source||!source.length)return false;
 const c=g.ctx,t=Math.max(.001,at),beat=60/clamp(bpm,48,180),velocity=clamp(params.velocity??.7,.2,1.1);
 const r=rng(((params.seed||1)^Math.imul(pad+1,0x9e3779b1))>>>0);
 // Level the transformed one-shot conservatively so short stutters stay audible.
 let sourcePeak=0;const probe=source.getChannelData(0),scan=Math.min(probe.length,Math.floor(source.sampleRate*.55));
 for(let i=0;i<scan;i+=4)sourcePeak=Math.max(sourcePeak,Math.abs(probe[i]));
 const gainMatch=clamp(.17/Math.max(.065,sourcePeak),.72,1.42);
 const level=c.createGain();level.gain.value=clamp(velocity*gainMatch*.94,.24,1.02);level.connect(g.dry);
 const start=.014,usable=Math.max(.045,source.duration-start-.025);
 const clip=(offset,duration,when,rate=1,reverse=false,crush=false,volume=1,fade=.008)=>{
  const length=Math.max(.025,Math.min(duration,usable-offset)),sample=sliceBuffer(c,source,start+offset,length,{reverse,crush});
  const src=c.createBufferSource(),amp=c.createGain(),end=when+(length/rate);
  src.buffer=sample;src.playbackRate.value=rate;
  amp.gain.setValueAtTime(.00001,when);
  const fadeTime=Math.min(Math.max(.006,fade),length/rate*.24);
  amp.gain.linearRampToValueAtTime(Math.max(.0001,volume),when+fadeTime);
  amp.gain.setValueAtTime(Math.max(.0001,volume),Math.max(when+fadeTime+.001,end-fadeTime));
  amp.gain.linearRampToValueAtTime(.00001,end);
  src.connect(amp);amp.connect(level);src.start(when);src.stop(end+.002);
  return {src,amp,end};
 };
 if(kind===0){
  // Repeat an actual transient of the selected note; each hit replaces it.
  const stride=Math.max(.043,beat/8),duration=Math.min(stride*.73,.085,usable);
  // Catch the recognizable body of the sound instead of repeatedly sampling
  // a silent onset. Keep the search short to avoid work on the audio scheduler.
  const samples=source.getChannelData(0),sr=source.sampleRate;
  let offset=0,best=-1;
  const searchEnd=Math.min(.15,Math.max(0,usable-duration)),windowSize=Math.max(16,Math.floor(Math.min(.020,duration*.55)*sr));
  for(let s=0;s<=searchEnd;s+=.012){
   let energy=0;const from=Math.floor((start+s)*sr);
   for(let k=0;k<windowSize;k+=3){const v=samples[from+k]||0;energy+=v*v;}
   if(energy>best){best=energy;offset=s;}
  }
  for(let i=0;i<4;i++)clip(offset,duration,t+i*stride,1,false,false,.78-i*.10,.007);
 }else if(kind===1){
  // Reverse real sound including its formants and texture, not synthesized noise.
  const duration=Math.min(.40,beat*.78,usable);
  clip(0,duration,t,1,true,false,.69,.011);
 }else if(kind===2){
  // Natural pitch/speed fall using a tape-style playback-rate envelope.
  const duration=Math.min(.70,beat*1.12,usable),sample=sliceBuffer(c,source,start,duration);
  const src=c.createBufferSource(),amp=c.createGain(),lowpass=c.createBiquadFilter();
  src.buffer=sample;src.playbackRate.setValueAtTime(1.10,t);
  src.playbackRate.exponentialRampToValueAtTime(.50,t+Math.min(.48,beat*.95));
  lowpass.type='lowpass';lowpass.frequency.setValueAtTime(3800,t);
  lowpass.frequency.exponentialRampToValueAtTime(680,t+Math.min(.55,beat));
  const playDuration=Math.min(.72,beat*1.5);
  amp.gain.setValueAtTime(.00001,t);amp.gain.linearRampToValueAtTime(.72,t+.016);
  amp.gain.setValueAtTime(.72,t+playDuration*.55);
  amp.gain.linearRampToValueAtTime(.00001,t+playDuration);
  src.connect(lowpass);lowpass.connect(amp);amp.connect(level);
  src.start(t);src.stop(t+playDuration+.006);
 }else if(kind===3){
  const duration=Math.min(.40,beat*.68,usable);
  // A real PCM bitcrush rather than a waveshaper imitation.
  clip(0,duration,t,1,false,true,.70,.012);
 }
 return {kind,pad,time:t,source:'rendered-pad'};
}

const KIT_NAMES=['PRESS','FALL','CORNER','BEND','TICK','WOOD','TIN','SNAP','VOWEL','GLASS','ERROR','CUT','REVERSE','HOLLOW','AIR','GHOST'];
window.WrongAudio={graph,scheduleVoice,scheduleKitVoice,audioBufferToWav,rng,clamp,KIT_NAMES,KIT_TITLES,KIT_SHORT,KIT_PAD_NAMES,ACCIDENT_NAMES,scheduleAccident,scheduleSpeech,renderFxSource,sliceBuffer};
})();
