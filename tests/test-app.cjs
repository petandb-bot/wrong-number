const fs=require('fs'),vm=require('vm'),assert=require('assert');
const path=require('path');const base=path.resolve(__dirname,'..')+'/';
class Element {
 constructor(id=''){this.id=id;this.children=[];this.style={};this.listeners={};this.className='';this._html='';this._text='';this.attributes={};this.clientWidth=334;this.clientHeight=75;this.hidden=false;this.classList={add(){},remove(){},contains(){return false}};this.small={textContent:''};this.label={textContent:''};}
 set textContent(t){this._text=t}get textContent(){return this._text}
 set innerHTML(t){this._html=t;this.label={textContent:''}}get innerHTML(){return this._html}
 appendChild(c){this.children.push(c);c.parentNode=this;return c}
 addEventListener(name,fn){(this.listeners[name]??=[]).push(fn)}
 dispatch(name,extra={}){for(let fn of this.listeners[name]||[])fn({key:'',detail:0,preventDefault(){},...extra});}
 setAttribute(a,b){this.attributes[a]=b}getAttribute(a){return this.attributes[a]}
 querySelector(s){return s==='.pad-name'?this.label:s==='small'?this.small:null}
 getContext(){return canvasctx}
 getBoundingClientRect(){return {width:this.clientWidth,height:this.clientHeight}}
}
let rects=0;
const canvasctx={imageSmoothingEnabled:false,fillStyle:'',font:'',textBaseline:'',textAlign:'',globalAlpha:1,fillRect(){rects++},clearRect(){},fillText(){rects++},save(){},restore(){},translate(){},rotate(){},setTransform(){}};

const mkparam=()=>({value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},setTargetAtTime(){},cancelScheduledValues(){}});
class AudioNode {constructor(){for(const f of ['gain','frequency','detune','Q','delayTime','threshold','knee','ratio','attack','release','playbackRate'])this[f]=mkparam();}connect(x){assert(x);return x;}start(){}stop(){}}
class FakeAudioContext {constructor(){this.sampleRate=22050;this.currentTime=.2;this.destination=new AudioNode();this.state='running';FakeAudioContext.last=this;if(new.target===FakeAudioContext)FakeAudioContext.live=this}
 createBuffer(n,size,rate){const a=Array.from({length:n},()=>new Float32Array(size));return{length:size,numberOfChannels:n,sampleRate:rate,getChannelData:i=>a[i]}}
 createGain(){return new AudioNode()}createOscillator(){return new AudioNode()}createBufferSource(){return new AudioNode()}createBiquadFilter(){return new AudioNode()}createConvolver(){return new AudioNode()}createDynamicsCompressor(){return new AudioNode()}createDelay(){return new AudioNode()}createWaveShaper(){return new AudioNode()}
 resume(){return Promise.resolve()}}

class FakeOfflineAudioContext extends FakeAudioContext {
 constructor(ch,frames,rate){super();this.sampleRate=rate;this.frames=frames;this.channels=ch;}
 async startRendering(){const arr=Array.from({length:this.channels},()=>new Float32Array(this.frames));return {length:this.frames,duration:this.frames/this.sampleRate,sampleRate:this.sampleRate,numberOfChannels:this.channels,getChannelData:i=>arr[i]};}
}
const nodes=new Map();function elt(id){if(!nodes.has(id))nodes.set(id,new Element(id));return nodes.get(id)}
const ids=['btn-source','lcd-kit','lcd-mode','beat-readout','tempo-value','btn-loop','btn-dub','live-message','status-text','pads','kit-prev','kit-next','tempo-down','tempo-up','btn-mutate','btn-blank','btn-undo','btn-tape','btn-new','btn-export','btn-close-export','btn-share','export-panel','export-status','download-link','display-view','display-fallback','p5-container'];ids.forEach(elt);
const doc={getElementById:elt,createElement:tag=>new Element(tag),addEventListener(){},head:new Element('head'),body:new Element('body')};
const store=new Map();
const ctx={window:{addEventListener(){},AudioContext:FakeAudioContext,OfflineAudioContext:FakeOfflineAudioContext},document:doc,console,Math,JSON,performance:{now:()=>123456},setTimeout:(fn,ms)=>{if(ms===30)fn();return 1},clearTimeout:()=>{},setInterval:()=>1,clearInterval:()=>{},requestAnimationFrame:()=>1,cancelAnimationFrame:()=>{},localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},location:{protocol:'file:'},navigator:{},Blob,File:class {},ArrayBuffer,DataView,Float32Array,URL,Date};
vm.createContext(ctx);
for(let f of ['audio.js','icons.js','app.js'])vm.runInContext(fs.readFileSync(base+f,'utf8'),ctx,{filename:f});
const D=ctx.window.WrongNumberDebug;
assert(D,'app loaded');
assert.strictEqual(elt('pads').children.length,16);
assert.strictEqual(ctx.window.WrongAudio.KIT_TITLES.length,6);
elt('display-view').dispatch('click');
assert.strictEqual(elt('lcd-mode').textContent,'BEAT / VIEW');
elt('display-view').dispatch('keydown',{key:'Enter'});
assert.notStrictEqual(elt('lcd-mode').textContent,'BEAT / VIEW');
D.setKit(5);
assert.strictEqual(D.getScene().kit,5);
assert.strictEqual(elt('pads').children[0].label.textContent,'AH');
D.fresh(false);
const ev=D.getScene().events;
assert(ev.length>=10&&ev.length<=16,`NEW sparse ${ev.length}`);
assert(ev.every(x=>x.step>=0&&x.step<32&&x.pad>=0&&x.pad<16));
D.mutate(false);
assert.strictEqual(D.isPlaying(),true);
assert(D.getScene().events.length>0);
D.undo();
assert.strictEqual(D.getScene().events.length,ev.length);
D.blank(false);assert.strictEqual(D.isDubArmed(),true);assert.strictEqual(D.getScene().groove,'empty');
D.setDub(false);assert.strictEqual(D.isDubArmed(),false);
console.log('PASS APP: LCD toggle, 6-kit switch, dynamic pad labels, NEW, MUTATE, UNDO. Event count:',ev.length);
const pattern=D.getScene();
assert.strictEqual(D.chooseAccident(pattern,0),null);
assert.strictEqual(D.chooseAccident(pattern,2),null);
const choice=D.chooseAccident(pattern,1);
assert(choice===null || (choice.step>=0&&choice.step<32&&choice.kind>=0&&choice.kind<4));
if(choice){D.scheduleFx(choice,0.4,pattern,ctx.window.WrongAudio.graph(new FakeAudioContext()),false);}
console.log('PASS: accident choice deterministic, speech labels, audio synthesis and legacy controls');

// The first overdub hit appears instantly as a pending note. UNDO removes
// only the last uncommitted hit and leaves the recording running.
D.startLoop();
D.setDub(true);
const countBefore=D.getUndoCount();
D.queueDub(0,.85,D.cycleAnchor()+.12);
assert.strictEqual(D.pendingDub().length,1);
assert.strictEqual(D.getUndoCount(),countBefore+1);
D.undo();
assert.strictEqual(D.pendingDub().length,0);
assert(D.isDubArmed());
assert.strictEqual(D.getUndoCount(),countBefore);
D.queueDub(1,.85,D.cycleAnchor()+.40);
D.commitDub();
assert.strictEqual(D.getScene().events.length,1);
D.undo();
assert.strictEqual(D.getScene().events.length,0);
assert(D.isDubArmed());
D.setDub(false);
assert(Array.isArray(JSON.parse(store.get('wrong-number-undo-0.2.3'))));
console.log('PASS: DUB pending note, per-take UNDO, history persistence');


(async()=>{
 D.fresh(false);const scene=D.getScene();
 await D.exportWav(false);
 assert(elt('download-link').download.includes('loop'));
 await D.exportWav(true);
 assert(elt('download-link').download.includes('fx-4bars'));
 console.log('PASS: 2-bar clean WAV and 4-bar FX WAV rendering paths');
 D.startTape();
 const live=FakeAudioContext.live;
 const current=D.getScene();
 const fx=D.chooseAccident(current,1);
 assert(fx,'FX candidate must exist for sparse pattern');
 const source=await ctx.window.WrongAudio.renderFxSource(fx.pad,{kit:current.kit,seed:fx.sourceSeed,velocity:fx.velocity,color:current.color});
 assert(D.scheduleFx(fx,live.currentTime+.13,current,ctx.window.WrongAudio.graph(live),true,source));
 live.currentTime+=1.2;
 await D.stopTape();
 assert(elt('download-link').download.includes('tape'));
 console.log('PASS: real-time FX event retained for TAPE offline WAV');
})().catch(e=>{console.error(e);process.exitCode=1});
