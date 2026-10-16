// Licensed gothic BGM and GameSynth effects. One context, bounded SFX voices and separate buses.
const ROOT=new URL('../assets/audio/',import.meta.url);
export function audioDeadline(promise,ms){
 let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Audio timeout')),ms);})]).finally(()=>clearTimeout(timer));
}
export function createGameAudio({onStatus=()=>{},onMusic=()=>{},loadTimeoutMs=45000,resumeTimeoutMs=8000}={}){
 let ctx,master,musicBus,sfxBus,voiceBus,windBus,wind,loading,enabled=false,paused=false;
 let enableRequest=0,lastError='';const pending=new Map();
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
  if(!Object.keys(manifest).length){
   const controller=new AbortController();
   try{manifest=await audioDeadline((async()=>{const r=await fetch(new URL('manifest.json',ROOT),{signal:controller.signal});if(!r.ok)throw Error('音源一覧 HTTP '+r.status);return r.json();})(),loadTimeoutMs);}
   finally{controller.abort();}
  }
  startLoading();return true;
 }
 function audioStatus(){
  const ready=[...buffers.keys()].filter(n=>manifest[n]?.kind!=='bgm').length,total=Object.values(manifest).filter(m=>m.kind!=='bgm').length;
  onStatus(lastError?lastError:`効果音 ${ready}/${total} · BGMは使用する曲だけ読み込み`);
 }
 function loadAsset(name){
  if(buffers.has(name))return Promise.resolve(buffers.get(name));
  if(pending.has(name))return pending.get(name);
  const item=manifest[name];if(!item)return Promise.reject(Error('未登録音源 '+name));
  const controller=new AbortController();
  const task=(async()=>{const r=await fetch(new URL(item.file||name+'.wav',ROOT),{signal:controller.signal});if(!r.ok)throw Error('HTTP '+r.status);
   const buffer=await ctx.decodeAudioData(await r.arrayBuffer());if(controller.signal.aborted)throw Error('期限切れ');
   // Discard obsolete music; never retain all five full-length decoded tracks on Quest.
   if(item.kind==='bgm'&&name!==mode)return buffer;
   buffers.set(name,buffer);
   if(item.kind==='bgm'){let sum=0,count=0;for(let c=0;c<buffer.numberOfChannels;c++){const data=buffer.getChannelData(c);for(let i=0;i<data.length;i+=64){sum+=data[i]*data[i];count++;}}item.level=Math.min(1,.12/Math.max(.001,Math.sqrt(sum/Math.max(1,count))));}
   return buffer;
  })();
  const job=audioDeadline(task,loadTimeoutMs).catch(error=>{lastError=`${item.label||name}：${error.message} / SOUND ONで再試行`;throw error;}).finally(()=>{controller.abort();pending.delete(name);audioStatus();});pending.set(name,job);return job;
 }
 function startLoading(){
  if(loading)return;lastError='';const queue=Object.keys(manifest).filter(n=>manifest[n].kind!=='bgm'&&!buffers.has(n));
  loading=Promise.all(Array.from({length:2},async()=>{while(queue.length){const name=queue.shift();try{await loadAsset(name);if(name==='wind'&&enabled&&!wind)wind=source('wind',windBus,1,true);}catch{}}})).finally(()=>{loading=null;audioStatus();});
 }
 // Only one long music decode at a time, including when stages change during loading.
 let musicLoading=false;
 function requestMusic(){
  if(musicLoading||!manifest[mode]||buffers.has(mode))return;
  musicLoading=true;const requested=mode;
  loadAsset(requested).then(()=>{if(enabled&&requested===mode)switchMusic(mode);}).catch(()=>{}).finally(()=>{musicLoading=false;if(enabled&&mode!==requested)requestMusic();});
 }

 function switchMusic(next,force=false){
  mode=next;if(!enabled||!ctx)return;if(!buffers.has(next)){requestMusic();return;}if(!force&&music?.name===next)return;
  for(const name of buffers.keys())if(manifest[name]?.kind==='bgm'&&name!==next)buffers.delete(name);
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
  get error(){return lastError;},
  async setEnabled(value){
   const request=++enableRequest;enabled=value;
   if(!value){stopSpeech();if(ctx)ramp(master,0);onStatus('消音');onMusic(null);return false;}
   try{if(!await unlock()){if(request===enableRequest)enabled=false;return false;}}catch{if(request===enableRequest){enabled=false;lastError=ctx?.state!=='running'?'音声の開始許可が必要です。画面のSound ONをクリックしてください':'音源一覧を取得できません。SOUND ONで再試行してください';onStatus(lastError);}return false;}
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
