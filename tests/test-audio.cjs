const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const root=path.resolve(__dirname,'..');
const env={window:{},console,Math,Float32Array,ArrayBuffer,DataView,Blob};
vm.runInNewContext(fs.readFileSync(root+'/audio.js','utf8'),env);
const A=env.window.WrongAudio;
assert.equal(A.KIT_TITLES.length,6);
assert.equal(A.ACCIDENT_NAMES.length,4);
let num=0;
function param(){return {value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},setTargetAtTime(){},cancelScheduledValues(){}};}
class Node {
 constructor(){for(const f of ['gain','frequency','detune','Q','delayTime','threshold','knee','ratio','attack','release','playbackRate'])this[f]=param();this.buffer=null;this.type='';this.oversample='none';this.curve=null;this.loop=false;this.loopEnd=0;}
 connect(target){assert(target);return target;}start(t){assert(Number.isFinite(t));}stop(t){assert(Number.isFinite(t));}
}
class Audio {
 constructor(){this.sampleRate=16000;this.destination=new Node();this.currentTime=0;this.count=0;}
 createBuffer(n,frames,rate){const ch=Array.from({length:n},()=>new Float32Array(frames));return {length:frames,sampleRate:rate,numberOfChannels:n,getChannelData:i=>ch[i]};}
 make(){this.count++;return new Node();}
 createGain(){return this.make()}createBiquadFilter(){return this.make()}createOscillator(){return this.make()}
 createBufferSource(){return this.make()}createDynamicsCompressor(){return this.make()}createConvolver(){return this.make()}
 createDelay(){return this.make()}createWaveShaper(){return this.make()}
}
const params={kit:5,seed:911,velocity:.75,color:{broken:.3,space:.3,shift:0}};
for(let kit=0;kit<6;kit++){
 const c=new Audio(),g=A.graph(c);
 for(let pad=0;pad<16;pad++){
  A.scheduleKitVoice(g,pad,.3+pad*1.1,{...params,kit,seed:111+pad});num++;
 }
 console.log(`kit ${kit} ${A.KIT_SHORT[kit]}: ${c.count} audio nodes`);
 assert(c.count>100);
}
let fxNodes=[];
for(let kind=0;kind<4;kind++){
 const c=new Audio(),g=A.graph(c);
 A.scheduleAccident(g,9,.5,kind,params,108);
 fxNodes.push(c.count);
 assert(c.count>14,`kind ${kind}`);
}
console.log('FX nodes:',fxNodes.join(', '));
assert(A.scheduleSpeech,'Speech synthesis missing');
const wav=A.audioBufferToWav(new Audio().createBuffer(2,100,16000),0,100);
assert(wav.size===44+100*4);
console.log('PASS',num,'pads + four FX + WAV encoding');
