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
const KIT_NAMES=['PRESS','FALL','CORNER','BEND','TICK','WOOD','TIN','SNAP','VOWEL','GLASS','ERROR','CUT','REVERSE','HOLLOW','AIR','GHOST'];
window.WrongAudio={graph,scheduleVoice,audioBufferToWav,rng,clamp,KIT_NAMES};
})();
