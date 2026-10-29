/* WRONG NUMBER audio engine v0.2.3 — procedural instruments and short rhythmic FX. */
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
 const backingDry=ctx.createGain();backingDry.gain.value=1;backingDry.connect(dry);
 const compressor=ctx.createDynamicsCompressor();compressor.threshold.value=-14;compressor.knee.value=15;compressor.ratio.value=3;compressor.attack.value=.005;compressor.release.value=.18;
 const output=ctx.createGain();output.gain.value=.87;dry.connect(compressor);compressor.connect(output);output.connect(ctx.destination);
 const reverbIn=ctx.createGain(),convolver=ctx.createConvolver(),reverbOut=ctx.createGain();convolver.buffer=makeImpulse(ctx);reverbOut.gain.value=.42;reverbIn.connect(convolver);convolver.connect(reverbOut);reverbOut.connect(compressor);
 const delayIn=ctx.createGain(),delay=ctx.createDelay(1),tone=ctx.createBiquadFilter(),fb=ctx.createGain(),delayOut=ctx.createGain();delay.delayTime.value=.294;tone.type='lowpass';tone.frequency.value=2700;fb.gain.value=.27;delayOut.gain.value=.28;delayIn.connect(delay);delay.connect(tone);tone.connect(fb);fb.connect(delay);tone.connect(delayOut);delayOut.connect(compressor);
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
const KIT_TITLES=['CANDY KIT','TOY MALFUNCTION','SUGAR POISON','ROTTEN CARROT','WORM PARADE','BAD SPELLING'];
const KIT_SHORT=['CANDY','TOY','SUGAR','CARROT','WORMS','SPELL'];
const KIT_PAD_NAMES=[null,null,null,null,null,['AH','UU','EH','OH','IH','YAH','WAH','EH?','BA','BU','BE','BO','YEE','WEE','UH-OH','NO']];
function scheduleKitVoice(g,pad,time,params={}){
 const kit=clamp(Math.floor(Number(params.kit)||0),0,KIT_TITLES.length-1);
 if(kit===0)return scheduleVoice(g,pad,time,params);
 if(kit===5)return scheduleSpeech(g,pad,time,params);
 const id=pad|0,t=Math.max(.001,time),r=rng(((params.seed||1)^Math.imul((id+23),(kit+1)*0x9e3779b1))>>>0);
 const rand=()=>r(),color=params.color||{},hold=!!params.hold,fire=!!params.fire;
 const broken=clamp(color.broken??.24,0,1),space=clamp(color.space??.26,0,1);
 const trans=clamp((color.shift||0)*1.7+(fire?rand()-.5:0)*4,-7,7);
 const p=Math.pow(2,trans/12),vol=clamp(params.velocity??.85,.18,1.1)*(hold?.70:1);
 const v=bus(g,t,vol*(kit===3?.77:kit===4?.68:kit===5?.79:.73),kit===2?.24+space*.25:kit===3?.09+space*.17:kit===4?.15+space*.18:kit===5?.12+space*.20:.07+space*.13,kit===1?.035:kit===2?.14:kit===3?.075:kit===5?.092:.06);
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
 return v;
}


// Short single-vowel toy speech: no long words, long tails, or overlapping syllables.
const VOWELS={
 A:[820,1380,2800],E:[490,2070,2850],I:[300,2500,3200],
 O:[510,950,2500],U:[350,1080,2350],Y:[580,1750,2850]
};
// vowel, fundamental, glide in semitones, duration, onset consonant, brightness
const PHONEMES=[
 ['A',158, 3,.18,'',1], ['U',125,-5,.22,'',.8], ['E',168, 5,.24,'',1], ['O',138,-3,.21,'',.9],
 ['I',190, 1,.16,'',.9], ['A',220, 5,.18,'y',1], ['A',150,-4,.23,'w',.7], ['E',165, 7,.23,'',1],
 ['A',145,-2,.20,'b',.9], ['U',136,-4,.20,'b',.8], ['E',187, 3,.19,'b',1], ['O',158,-3,.22,'b',.75],
 ['I',218, 6,.19,'y',1], ['I',205,-5,.25,'w',.8], ['U',124, 7,.26,'',.6], ['O',145,-6,.23,'n',.75]
];
function scheduleSpeech(g,pad,time,params={}){
 const c=g.ctx,id=clamp(pad|0,0,15),t=Math.max(.001,time);
 const color=params.color||{},broken=clamp(color.broken??.24,0,1);
 const seed=((params.seed||1)^Math.imul(id+37,0x45d9f3b))>>>0,r=rng(seed);
 const [vowel,base,glide,duration,consonant,brightness]=PHONEMES[id];
 const vel=clamp(params.velocity??.85,.2,1.1)*(params.hold?.72:1);
 const pitch=Math.pow(2,clamp(color.shift||0,-2,2)/12);
 const dur=Math.min(.215,duration)+(params.fire?-.025:0),end=t+dur;
 // Intentionally short dry source so 16th-note sequences remain articulated.
 const out=bus(g,t,vel*.72,.035+clamp(color.space??.25,0,1)*.04,.008);
 const tone=c.createBiquadFilter();tone.type='lowpass';tone.frequency.value=3100+broken*700;tone.Q.value=.48;tone.connect(out);
 const carrier=c.createOscillator(),thin=c.createOscillator(),blend=c.createGain(),env=c.createGain();
 carrier.type='sawtooth';thin.type='square';blend.gain.value=.22;
 const startF=base*pitch*(.995+r()*.01),endF=startF*Math.pow(2,(glide+((r()-.5)*broken*1.2))/12);
 carrier.frequency.setValueAtTime(startF,t);carrier.frequency.linearRampToValueAtTime(endF,t+dur*.84);
 thin.frequency.setValueAtTime(startF*.997,t);thin.frequency.linearRampToValueAtTime(endF*.998,t+dur*.84);
 carrier.connect(blend);thin.connect(blend);
 const frequencies=VOWELS[vowel];
 for(let i=0;i<3;i++){
  const filter=c.createBiquadFilter(),level=c.createGain();
  filter.type='bandpass';filter.Q.value=[4.4,5.8,7.0][i];
  filter.frequency.setValueAtTime(frequencies[i]*(.99+r()*.02),t);
  filter.frequency.linearRampToValueAtTime(frequencies[i]*(1+(glide>0?.055:-.04)+broken*.025),t+dur*.76);
  level.gain.value=[.91,.58,.33][i]*brightness;
  blend.connect(filter);filter.connect(level);level.connect(env);
 }
 const attack=consonant?.017:.022,release=Math.min(.065,dur*.26);
 env.gain.setValueAtTime(.0001,t);
 env.gain.linearRampToValueAtTime(.72,t+attack);
 env.gain.setValueAtTime(.72,t+dur-release);
 env.gain.linearRampToValueAtTime(.0001,end);
 env.connect(tone);
 carrier.start(t);thin.start(t);carrier.stop(end+.012);thin.stop(end+.012);
 // Very short consonant onset, never a second syllable or a drum-like hit.
 if(consonant==='b'||consonant==='n'){
  noise(g,tone,t,{d:.009,a:.022,lp:1600,offset:r()});
 }else if(consonant==='y'||consonant==='w'){
  const lead=c.createOscillator(),e=c.createGain();lead.type='triangle';
  lead.frequency.setValueAtTime(startF*.7,t);lead.frequency.linearRampToValueAtTime(startF,t+.035);
  e.gain.setValueAtTime(.0001,t);e.gain.linearRampToValueAtTime(.06,t+.012);e.gain.linearRampToValueAtTime(.0001,t+.038);
  lead.connect(e);e.connect(tone);lead.start(t);lead.stop(t+.045);
 }
 return out;
}

// FX are extra rhythmic ornaments, never changes to the saved MIDI-like pattern.
// The same routine is called for live playback and offline TAPE rendering.
const ACCIDENT_NAMES=['STUTTER','REVERSE','TAPE BEND','CRUSH'];
function scheduleAccident(g,pad,at,kind,params={},bpm=100){
 const c=g.ctx,t=Math.max(.001,at),beat=60/clamp(bpm,48,180);
 const seed=(params.seed||1)>>>0,r=rng(seed^Math.imul((pad|0)+1,0x9e3779b1));
 const kit=params.kit|0,velocity=clamp(params.velocity??.55,.15,.9);
 const fx=c.createGain();fx.gain.value=.7;
 fx.connect(g.dry);
 const dryGraph={...g,dry:fx,reverbIn:g.reverbIn,delayIn:g.delayIn};
 if(kind===0){ // 16th/32nd-note stutters: a deliberately short decaying fill.
  const stride=Math.max(.046,beat/8);
  for(let i=0;i<4;i++){
   const st=t+i*stride,gate=c.createGain();gate.gain.setValueAtTime(0,st);
   gate.gain.linearRampToValueAtTime(.72-i*.14,st+.003);
   gate.gain.setValueAtTime(.72-i*.14,st+stride*.55);
   gate.gain.linearRampToValueAtTime(0,st+stride*.73);
   gate.connect(fx);
   const mini={...dryGraph,dry:gate};
   scheduleKitVoice(mini,pad,st,{...params,velocity:velocity*(.82-i*.13),hold:false,fire:false});
  }
 }else if(kind===1){ // True reverse of a synthesized tonal/noise fragment.
  const duration=Math.min(.52,beat*.85),frames=Math.ceil(c.sampleRate*duration);
  const buffer=c.createBuffer(1,frames,c.sampleRate),data=buffer.getChannelData(0);
  const fundamental=(pad<4?100:pad<8?330:pad<12?510:230)*(1+kit*.06);
  let noiseState=seed|0;
  for(let i=0;i<frames;i++){
   const u=i/frames,x=1-u;
   noiseState^=noiseState<<13;noiseState^=noiseState>>>17;noiseState^=noiseState<<5;
   const grain=((noiseState>>>0)/2147483648-1)*.19;
   const phase=2*Math.PI*fundamental*duration*x;
   // Reverse an ordinary decaying synthetic hit (small at first, strong at end).
   data[i]=Math.sin(phase)*Math.pow(u,2.1)*.59+grain*Math.pow(u,1.5);
  }
  const src=c.createBufferSource(),env=c.createGain(),fl=c.createBiquadFilter();
  fl.type='bandpass';fl.frequency.value=650+pad*75;fl.Q.value=.7;
  env.gain.setValueAtTime(.0001,t);env.gain.linearRampToValueAtTime(velocity*.9,t+duration*.90);env.gain.linearRampToValueAtTime(.0001,t+duration);
  src.buffer=buffer;src.connect(fl);fl.connect(env);env.connect(fx);src.start(t);src.stop(t+duration+.01);
 }else if(kind===2){ // Audible analogue-tape-like pitch and speed bend.
  const duration=Math.min(.60,beat*1.0),samples=Math.ceil(c.sampleRate*.28);
  const buffer=c.createBuffer(1,samples,c.sampleRate),wave=buffer.getChannelData(0);
  const f=(kit===5?185:pad<4?93:pad<8?300:510)*(1+kit*.027);
  for(let i=0;i<samples;i++){
   const sec=i/c.sampleRate,edge=Math.min(1,i/90,(samples-i)/380);
   wave[i]=(Math.sin(2*Math.PI*f*sec)+.23*Math.sin(2*Math.PI*f*sec*2.02))*edge*.55;
  }
  const src=c.createBufferSource(),env=c.createGain(),fl=c.createBiquadFilter();
  src.buffer=buffer;src.loop=true;src.loopEnd=samples/c.sampleRate;
  src.playbackRate.setValueAtTime(1.1,t);src.playbackRate.exponentialRampToValueAtTime(.43,t+duration*.83);
  fl.type='lowpass';fl.frequency.setValueAtTime(2600,t);fl.frequency.exponentialRampToValueAtTime(430,t+duration);
  env.gain.setValueAtTime(.0001,t);env.gain.linearRampToValueAtTime(velocity*.48,t+.018);
  env.gain.setValueAtTime(velocity*.48,t+duration*.60);env.gain.linearRampToValueAtTime(.0001,t+duration);
  src.connect(fl);fl.connect(env);env.connect(fx);src.start(t);src.stop(t+duration+.02);
 }else if(kind===3){ // Quantized waveshaper + stepped retrigger, not master clipping.
  const crush=c.createWaveShaper(),curve=new Float32Array(1024),levels=16;
  for(let i=0;i<curve.length;i++){
   const x=i/(curve.length-1)*2-1;curve[i]=Math.round(Math.tanh(x*2.7)*levels)/levels;
  }
  crush.curve=curve;crush.oversample='none';
  const gate=c.createGain();gate.gain.setValueAtTime(.0001,t);
  gate.gain.linearRampToValueAtTime(.78,t+.008);
  gate.gain.setValueAtTime(.78,t+Math.min(.17,beat*.3));
  gate.gain.linearRampToValueAtTime(.0001,t+Math.min(.25,beat*.5));
  gate.connect(crush);crush.connect(fx);
  scheduleKitVoice({...dryGraph,dry:gate},pad,t,{...params,velocity:velocity*.82,fire:false});
 }
 return {kind,pad,time:t};
}

const KIT_NAMES=['PRESS','FALL','CORNER','BEND','TICK','WOOD','TIN','SNAP','VOWEL','GLASS','ERROR','CUT','REVERSE','HOLLOW','AIR','GHOST'];
window.WrongAudio={graph,scheduleVoice,scheduleKitVoice,audioBufferToWav,rng,clamp,KIT_NAMES,KIT_TITLES,KIT_SHORT,KIT_PAD_NAMES,ACCIDENT_NAMES,scheduleAccident,scheduleSpeech};
})();
