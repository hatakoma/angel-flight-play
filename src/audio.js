// Licensed gothic BGM and GameSynth effects. One context, bounded SFX voices and separate buses.
const ROOT=new URL('../assets/audio/',import.meta.url);
export function audioDeadline(promise,ms){
 let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Audio timeout')),ms);})]).finally(()=>clearTimeout(timer));
}
export function createGameAudio({onStatus=()=>{},onMusic=()=>{},loadTimeoutMs=15000,resumeTimeoutMs=3000}={}){
 let ctx,master,musicBus,sfxBus,voiceBus,windBus,wind,loading,enabled=false,paused=false;
 let enableRequest=0;
 let mode='title',music=null,manifest={},buffers=new Map(),voices=new Set(),last=new Map();
 let wingClock=0,warningClock=0,previousCd=0,wasTurning=false;
 const volumes={music:.38,sfx:.65,voice:.8};
 let speech=null;const speechLast=new Map();
 function stopSpeech(){speech?.stop();speech=null;}
 function speak(name,{priority=1,cooldown=2}={}){
  if(!enabled||paused||!ctx||ctx.state!=='running'||!buffers.has(name))return false;
  const now=ctx.currentTime;if(now-(speechLast.get(name)??-100)<cooldown)return false;
  if(speech&&priority<=speech.priority)return false;
  stopSpeech();const v=source(name,voiceBus,.85);if(!v)return false;
  speech=v;v.priority=priority;speechLast.set(name,now);const end=v.src.onended;
  v.src.onended=()=>{end();if(speech===v)speech=null;};return true;
 }
 function ramp(node,value,seconds=.08){const t=ctx.currentTime;node.gain.cancelScheduledValues(t);node.gain.setValueAtTime(node.gain.value,t);node.gain.linearRampToValueAtTime(value,t+seconds);}
 function source(name,bus,level=1,loop=false){
  if(!buffers.has(name))return null;
  const src=ctx.createBufferSource(),gain=ctx.createGain();src.buffer=buffers.get(name);src.loop=loop;gain.gain.value=level;src.connect(gain);gain.connect(bus);
  const voice={src,gain,stop(){try{src.stop();}catch{}}};
  src.onended=()=>{src.disconnect();gain.disconnect();voices.delete(voice);};src.start();return voice;
 }
 async function unlock(){
  if(!ctx){
   const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;
   if(!Audio){onStatus('このブラウザーは音声に未対応です');return false;}
   ctx=new Audio();master=ctx.createGain();musicBus=ctx.createGain();sfxBus=ctx.createGain();voiceBus=ctx.createGain();windBus=ctx.createGain();
   const limiter=ctx.createDynamicsCompressor();limiter.threshold.value=-12;limiter.knee.value=12;limiter.ratio.value=5;limiter.attack.value=.005;limiter.release.value=.18;
   musicBus.connect(master);sfxBus.connect(master);voiceBus.connect(master);windBus.connect(sfxBus);master.connect(limiter);limiter.connect(ctx.destination);
   master.gain.value=0;musicBus.gain.value=volumes.music;sfxBus.gain.value=volumes.sfx;voiceBus.gain.value=volumes.voice;windBus.gain.value=0;
  }
  await audioDeadline(ctx.resume(),resumeTimeoutMs);
  if(!loading){
   onStatus('音源を読み込み中…（出撃できます）');
   const controller=new AbortController(),signal=controller.signal;
   const task=(async()=>{
    if(!Object.keys(manifest).length){const response=await fetch(new URL('manifest.json',ROOT),{signal});if(!response.ok)throw Error('Audio manifest');manifest=await response.json();}
    const queue=Object.keys(manifest).filter(name=>!buffers.has(name));
    // Bound simultaneous decoding on standalone headsets. One failed file does not block the others.
    await Promise.all(Array.from({length:3},async()=>{
     while(queue.length&&!signal.aborted){const name=queue.shift();try{
      const r=await fetch(new URL(manifest[name].file||name+'.wav',ROOT),{signal});if(!r.ok)throw Error(name);
      const buffer=await ctx.decodeAudioData(await r.arrayBuffer());if(signal.aborted)return;
      buffers.set(name,buffer);
      if(manifest[name].kind==='bgm'){let sum=0,count=0;for(let c=0;c<buffer.numberOfChannels;c++){const data=buffer.getChannelData(c);for(let i=0;i<data.length;i+=64){sum+=data[i]*data[i];count++;}}manifest[name].level=Math.min(1,.12/Math.max(.001,Math.sqrt(sum/Math.max(1,count))));}
     }catch{/* Missing assets remain retryable on the next Sound ON. */}}
    }));
   })();
   loading=audioDeadline(task,loadTimeoutMs).catch(()=>{}).finally(()=>{controller.abort();loading=null;});
  }
  await loading;
  const complete=Object.keys(manifest).length>0&&buffers.size===Object.keys(manifest).length;
  onStatus(complete?'音源の準備完了':buffers.size?'一部の音源で再生中。SOUND ONで再読込できます':'音源を読み込めません。SOUND ONで再試行できます');
  return buffers.size>0;
 }

 function switchMusic(next,force=false){
  mode=next;if(!enabled||!ctx||!buffers.has(next)||(!force&&music?.name===next))return;
  const changed=music?.name!==next;
  const fade=force&&music?.name===next?(manifest[next].crossfade||.85):.85;
  if(music){const old=music;ramp(old.gain,0,fade);old.src.stop(ctx.currentTime+fade+.05);}
  music=source(next,musicBus,0,manifest[next].loop&&!manifest[next].crossfade);music.name=next;music.startedAt=ctx.currentTime;ramp(music.gain,manifest[next].level??1,fade);
  if(changed)onMusic(manifest[next].label);
  return changed;
 }
 function play(name,{gain=1,pan=0}={}){
  if(!enabled||paused||!ctx||ctx.state!=='running')return;
  const now=ctx.currentTime,cooldown={natto:.11,shot:.09,hit:.07,charge:.7,wing:.18,warning:2.5}[name]??.05;
  if(now-(last.get(name)??-100)<cooldown)return;
  const levels={natto:.12,shot:.18,hit:.24,wing:.07,charge:.48,warning:.35,'boss-arrival':.7,spear:.55,'spear-hit':.55};
  if(voices.size>=24){const old=voices.values().next().value;old.stop();voices.delete(old);}
  let bus=sfxBus,panner;
  if(pan&&ctx.createStereoPanner){panner=ctx.createStereoPanner();panner.pan.value=Math.max(-1,Math.min(1,pan));panner.connect(sfxBus);bus=panner;}
  const v=source(name,bus,(levels[name]??.4)*gain);if(!v){panner?.disconnect();return;}
  voices.add(v);last.set(name,now);
  if(panner){const end=v.src.onended;v.src.onended=()=>{end();panner.disconnect();};}
 }
 return {
  async setEnabled(value){
   const request=++enableRequest;enabled=value;
   if(!value){stopSpeech();if(ctx)ramp(master,0);onStatus('消音');onMusic(null);return false;}
   try{if(!await unlock()){if(request===enableRequest)enabled=false;return false;}}catch{if(request===enableRequest){enabled=false;onStatus('音声を開始できません。SOUND ONで再試行できます');}return false;}
   if(request!==enableRequest||!enabled)return false;
   ramp(master,.8);if(!switchMusic(mode)&&music)onMusic(manifest[music.name].label);if(!wind)wind=source('wind',windBus,1,true);
   if(paused)ctx.suspend().catch(()=>{});else play('ui');return true;
  },
  setVolume(bus,value){if(!(bus in volumes))return;volumes[bus]=Math.max(0,Math.min(1,Number(value)||0));if(ctx)ramp(bus==='music'?musicBus:bus==='voice'?voiceBus:sfxBus,volumes[bus]);},
  setPaused(value){paused=value;if(!ctx)return;if(value)ctx.suspend().catch(()=>{});else if(enabled)ctx.resume().catch(()=>{});},
  music:switchMusic,play,speak,
  reset(){stopSpeech();speechLast.clear();for(const v of voices)v.stop();voices.clear();last.clear();wingClock=warningClock=0;previousCd=0;wasTurning=false;},
  update(dt,{flying=false,speed=52,hp=100,time=180,spearCd=0,turning=false}={}){
   if(!ctx||!enabled||paused)return;
   if(music&&manifest[music.name].loop&&manifest[music.name].crossfade&&ctx.currentTime-music.startedAt>=music.src.buffer.duration-manifest[music.name].crossfade)switchMusic(music.name,true);
   windBus.gain.setTargetAtTime(flying?.025+Math.max(0,speed-52)*.0008:0,ctx.currentTime,.3);
   if(flying){
    wingClock+=dt;warningClock+=dt;
    if(wingClock>Math.max(.24,.8-speed*.004)){wingClock=0;play('wing');}
    if((hp<=30||time<=20)&&warningClock>4){warningClock=0;play('warning');}
    if(previousCd>0&&spearCd<=0)play('ready');
    if(turning&&!wasTurning)play('turn');
   }
   previousCd=spearCd;wasTurning=turning;
  }
 };
}
