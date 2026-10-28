/* WRONG NUMBER audio engine v0.1.0
   No audio files or pre-recorded loops: all 16 timbres are synthesized.
   Live and WAV export call the same scheduleVoice() functions.
*/
(()=>{'use strict';
const TAU=Math.PI*2, clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function rng(seed){let a=seed>>>0;return ()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
function makeNoise(ctx){
 const frames=Math.round(ctx.sampleRate*2),b=ctx.createBuffer(1,frames,ctx.sampleRate),data=b.getChannelData(0);let state=1784421;
 for(let i=0;i<frames;i++){state^=state<<13;state^=state>>>17;state^=state<<5;data[i]=((state>>>0)/2147483648-1)*.82;}return b;
}
function makeImpulse(ctx){const len=Math.round(ctx.sampleRate*1.35),b=ctx.createBuffer(2,len,ctx.sampleRate);for(let ch=0;ch<2;ch++){const a=b.getChannelData(ch),r=rng(911+ch*17);for(let i=0;i<len;i++){const t=i/ctx.sampleRate;const density=Math.pow(1-t/1.35,2.7);a[i]=(r()*2-1)*density*.19;}}return b;}
function graph(ctx){
 const dry=ctx.createGain();dry.gain.value=.77;
 const compressor=ctx.createDynamicsCompressor();compressor.threshold.value=-14;compressor.knee.value=15;compressor.ratio.value=3;compressor.attack.value=.005;compressor.release.value=.18;
 const output=ctx.createGain();output.gain.value=.87;dry.connect(compressor);compressor.connect(output);output.connect(ctx.destination);
 const reverbIn=ctx.createGain(),convolver=ctx.createConvolver(),reverbOut=ctx.createGain();convolver.buffer=makeImpulse(ctx);reverbOut.gain.value=.42;reverbIn.connect(convolver);convolver.connect(reverbOut);reverbOut.connect(compressor);
 const delayIn=ctx.createGain(),delay=ctx.createDelay(1),tone=ctx.createBiquadFilter(),fb=ctx.createGain(),delayOut=ctx.createGain();delay.delayTime.value=.294;tone.type='lowpass';tone.frequency.value=2700;fb.gain.value=.27;delayOut.gain.value=.28;delayIn.connect(delay);delay.connect(tone);tone.connect(fb);fb.connect(delay);tone.connect(delayOut);delayOut.connect(compressor);
 return {ctx,dry,reverbIn,delayIn,noise:makeNoise(ctx)};
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
function scheduleVoice(g,pad,time,params={}){
 const seed=params.seed??1,id=(pad|0),r=rng((seed^((id+1)*2654435761))>>>0),color=params.color||{broken:.2,space:.3,shift:0};
 const vel=clamp(params.velocity??.85,.14,1.25),hold=params.hold||false,fire=params.fire||false;
 const transpose=clamp((color.shift||0)*2+((fire?r()-.5:0)*5),-8,8),pitch=Math.pow(2,transpose/12);
 const broken=clamp(color.broken??.2,0,1),space=clamp(color.space??.3,0,1);
 const tonal=1+(r()-.5)*(.018+broken*.12),v=vel*(hold?.67:1),t=Math.max(.001,time),voice=bus(g,t,v*.74,.10+space*.2,.03+space*.15),u=()=>r();
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
 return voice;
}
function audioBufferToWav(buffer,startFrame,endFrame){
 const sampleRate=buffer.sampleRate,channels=2,n=endFrame-startFrame,ab=new ArrayBuffer(44+n*channels*2),view=new DataView(ab);let pos=0;
 const u8=s=>{for(let i=0;i<s.length;i++)view.setUint8(pos++,s.charCodeAt(i));};
 const u16=x=>{view.setUint16(pos,x,true);pos+=2;};const u32=x=>{view.setUint32(pos,x,true);pos+=4;};
 u8('RIFF');u32(36+n*4);u8('WAVE');u8('fmt ');u32(16);u16(1);u16(2);u32(sampleRate);u32(sampleRate*4);u16(4);u16(16);u8('data');u32(n*4);
 const left=buffer.getChannelData(0),right=buffer.numberOfChannels>1?buffer.getChannelData(1):left;
 let peak=0;for(let i=startFrame;i<endFrame;i++){peak=Math.max(peak,Math.abs(left[i]),Math.abs(right[i]));}
 const gain=peak>0.00001?Math.min(2.3,.891/peak):1;
 for(let i=startFrame;i<endFrame;i++){let l=clamp(left[i]*gain,-1,1),r=clamp(right[i]*gain,-1,1);view.setInt16(pos,l<0?l*32768:l*32767,true);pos+=2;view.setInt16(pos,r<0?r*32768:r*32767,true);pos+=2;}
 return new Blob([ab],{type:'audio/wav'});
}
/* Three additional synthesized instruments. All voices use the same graph and
   offline render paths; nothing is streamed, sampled or downloaded. */
const KIT_TITLES=['CANDY KIT','TOY MALFUNCTION','SUGAR POISON','GHOST OFFICE'];
const KIT_SHORT=['CANDY','TOY','SUGAR','GHOST'];
function scheduleKitVoice(g,pad,time,params={}){
 const kit=clamp(Math.floor(Number(params.kit)||0),0,3);
 if(kit===0)return scheduleVoice(g,pad,time,params); // Preserve v0.1.4's proven synth voice.
 const id=pad|0,t=Math.max(.001,time),r=rng(((params.seed||1)^Math.imul((id+23),(kit+1)*0x9e3779b1))>>>0);
 const rand=()=>r(),color=params.color||{},hold=!!params.hold,fire=!!params.fire;
 const broken=clamp(color.broken??.24,0,1),space=clamp(color.space??.26,0,1);
 const trans=clamp((color.shift||0)*1.7+(fire?rand()-.5:0)*4,-7,7);
 const p=Math.pow(2,trans/12),vol=clamp(params.velocity??.85,.18,1.1)*(hold?.70:1);
 const v=bus(g,t,vol*(kit===3?.82:.73),kit===2?.24+space*.25:kit===3?.20+space*.19:.07+space*.13,kit===1?.035:kit===2?.14:.08);
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
 }else{ // GHOST OFFICE — muted machine room, hollow rhythm, distant signals
  if(id<4){
   if(id===0){osc(105,.50,.51,'sine',45);osc(53,.26,.17,'triangle',44);hit(.017,.07,2500);}
   if(id===1){osc(67,.67,.30,'sine',43);band(.15,.06,230,.7);}
   if(id===2){mod(92,1.63,85,.35,.24,.78);osc(46,.42,.23,'sine',44);}
   if(id===3){osc(152,.15,.14,'triangle',52);mod(78,2.8,170,.50,.27,.62);}
  }else if(id<8){
   const n=id-4;
   if(n===0){hit(.028,.13,4500);osc(1010,.019,.08,'sine',610);}
   if(n===1){band(.10,.20,710,3.2);osc(325,.061,.13,'triangle',300);}
   if(n===2){[385,553,849].forEach((q,i)=>osc(q,.11+i*.04,.10-i*.02,'sine',q*f(.97)));}
   if(n===3){band(.19,.20,1640,1.15);osc(151,.10,.12,'sine',104);}
  }else if(id<12){
   const n=id-8;
   if(n===0){mod(123,2.27,75,.24,.19,.89);band(.045,.07,960,1.3);}
   if(n===1){[532,812].forEach((q,i)=>osc(q,.49+i*.11,.11,'sine',q*f(.99)));}
   if(n===2){for(let i=0;i<3;i++){hit(.014,.16,1300+i*1400);osc(239+i*143,.035,.07,'square',170+i*60,i*.082);}}
   if(n===3){band(.24,.21,1050,1.1);osc(310,.07,.07,'triangle',110);}
  }else{
   const n=id-12;
   if(n===0){band(.59,.22,540,.68);osc(324,.26,.06,'sine',175,.31);}
   if(n===1){mod(208,1.18,87,.98,.18,.90);osc(106,.67,.075,'triangle',108);}
   if(n===2){band(.82,.20,820,.43);osc(176,.47,.065,'sine',141,.22);}
   if(n===3){[84,126,189,282].forEach((q,i)=>osc(q,.95+i*.08,.08,'sine',q*f(.985),i*.038));}
  }
 }
 return v;
}

const KIT_NAMES=['PRESS','FALL','CORNER','BEND','TICK','WOOD','TIN','SNAP','VOWEL','GLASS','ERROR','CUT','REVERSE','HOLLOW','AIR','GHOST'];
window.WrongAudio={graph,scheduleVoice,scheduleKitVoice,audioBufferToWav,rng,clamp,KIT_NAMES,KIT_TITLES,KIT_SHORT};
})();
