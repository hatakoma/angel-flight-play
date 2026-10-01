import {gameData,stage,dataVersion,loadGameData} from './game-data.js';
import { createDebugViewer } from './debug-viewer.js';
import { createTerrainMap } from './terrain-map.js';
import { createBattleLog } from './battle-log.js';
import { createNattoMagazine, createNattoFlight, steerNatto, createNattoVisuals, deflectNatto } from './natto.js';
import { createGameAudio } from './audio.js';
import { updateEnemyCombat, barrage } from './enemy-combat.js';
import { loadDebris } from './debris.js';
import { edgeIndicator, avoidPlayerMessage } from './hud-projection.js';
import { createFlightActions } from './flight-actions.js';
import { createAtmosphere } from './atmosphere.js';
import { loadEffects } from './effects.js';
import { WAVE_COUNT, TOTAL_TARGETS, TYPES, formation, bossOffset, refreshEncounter } from './encounter.js';
import { loadExpansion } from './expansion-assets.js';
import { loadCharacter } from './character.js';
import * as THREE from '../vendor/three.module.js';

const $=id=>document.getElementById(id), clamp=THREE.MathUtils.clamp;
const scene=new THREE.Scene(); scene.background=new THREE.Color('#8986b2');scene.fog=new THREE.FogExp2('#aba1c0',.0018);
const renderer=new THREE.WebGLRenderer({canvas:$('scene'),antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
const camera=new THREE.PerspectiveCamera(58,innerWidth/innerHeight,.2,5000);
const hemi=new THREE.HemisphereLight('#fff2da','#66619d',2.7);scene.add(hemi);const sun=new THREE.DirectionalLight('#fff1cd',3.1);sun.position.set(-300,450,-600);scene.add(sun);
const gradient=new THREE.DataTexture(new Uint8Array([65,145,230,255]),4,1,THREE.RedFormat);gradient.minFilter=gradient.magFilter=THREE.NearestFilter;gradient.needsUpdate=true;
const mat=(c)=>new THREE.MeshToonMaterial({color:c,gradientMap:gradient});
const white=mat('#fff4e1'),ivory=mat('#e5d5b6'),gold=mat('#c4a26b'),dark=mat('#26243f'),skin=mat('#f6d7cb'),hair=mat('#eee6e8'),stone=mat('#716e92'),roof=mat('#302d52'),pink=mat('#ce7693');
const basic=c=>new THREE.MeshBasicMaterial({color:c});
function mesh(g,m,p,x=0,y=0,z=0){let o=new THREE.Mesh(g,m);o.position.set(x,y,z);p.add(o);return o;}
const sphere=(p,m,x,y,z,sx,sy=sx,sz=sx)=>{let o=mesh(new THREE.SphereGeometry(1,12,10),m,p,x,y,z);o.scale.set(sx,sy,sz);return o;};
const box=(p,m,x,y,z,a,b,c)=>mesh(new THREE.BoxGeometry(a,b,c),m,p,x,y,z);
const cone=(p,m,x,y,z,r,h,n=8)=>mesh(new THREE.ConeGeometry(r,h,n),m,p,x,y,z);
function ring(p,r,t,m,x=0,y=0,z=0){let o=mesh(new THREE.TorusGeometry(r,t,8,64),m,p,x,y,z);return o;}
function angel(){const g=new THREE.Group();scene.add(g);const body=new THREE.Group();g.add(body);
 sphere(body,dark,0,0,0,.52,.8,.35);cone(body,dark,0,-.9,0,.86,1.05,12);ring(body,.49,.055,gold,0,-.2,0).rotation.x=Math.PI/2;
 sphere(body,skin,0,1.06,0,.49,.56,.46);sphere(body,hair,0,1.25,.1,.54,.53,.48);
 for(let i=-2;i<=2;i++){const h=sphere(body,hair,i*.19,.69,.36,.16,.6+Math.abs(i)*.09,.18);h.rotation.z=i*.08;}
 for(const s of [-1,1]){sphere(body,skin,s*.61,-.12,-.12,.16,.59,.17).rotation.z=s*.4; sphere(body,dark,s*.32,-1.65,.2,.19,.73,.2).rotation.x=-.22; sphere(body,gold,s*.32,-2.25,.05,.2,.17,.34);sphere(body,white,s*.48,.42,0,.25,.16,.26);}
 const halo=ring(body,.71,.045,basic('#ffe0a0'),0,2.01,0);halo.rotation.x=Math.PI/2;
 const wings=[];for(const s of [-1,1]){const wing=new THREE.Group();wing.position.set(s*.3,.5,.26);body.add(wing);wings.push(wing);for(let i=0;i<9;i++){let f=sphere(wing,i%3===0?ivory:white,s*(.45+i*.34),.55+Math.sin(i/8*Math.PI)*.52-i*.10,.05+i*.065,.26,1.1-i*.044,.12);f.rotation.z=-s*(.45+i*.11);}sphere(wing,white,s*1.2,.47,0,1.22,.3,.25).rotation.z=s*.18;}
 const ribbon=[];for(let s of [-1,1]){let o=box(body,gold,s*.32,-1.1,.6,.11,1.55,.035);o.rotation.x=.5;o.rotation.z=s*.16;ribbon.push(o);}
 return {g,body,wings,halo,ribbon};}
const player=angel();player.g.position.set(0,78,120);
loadCharacter(player,gradient).catch(error=>console.error('Character loading failed; using fallback',error));
// Floating pointed arches, buttresses, spires, and rose windows.
function arch(parent,x,y,z,w,h){const pts=[new THREE.Vector3(-w/2,0,0),new THREE.Vector3(-w/2,h*.58,0),new THREE.Vector3(-w*.3,h*.85,0),new THREE.Vector3(0,h,0),new THREE.Vector3(w*.3,h*.85,0),new THREE.Vector3(w/2,h*.58,0),new THREE.Vector3(w/2,0,0)];const curve=new THREE.CatmullRomCurve3(pts);const o=mesh(new THREE.TubeGeometry(curve,24,1.1,5,false),ivory,parent,x,y,z);return o;}
function cathedral(x,y,z,s){const g=new THREE.Group();g.position.set(x,y,z);g.scale.setScalar(s);g.userData.fallbackScenery=true;scene.add(g);
const rock=cone(g,mat('#69627c'),0,-42,0,47,83,7);rock.rotation.z=Math.PI;box(g,stone,0,-1,0,85,7,54);box(g,stone,0,20,0,45,42,34);const r=cone(g,roof,0,55,0,34,38,4);r.rotation.y=Math.PI/4;r.scale.z=.7;
for(const side of [-1,1]){for(let j=0;j<3;j++){let xx=side*(j===0?32:25),zz=20-j*20;box(g,stone,xx,28,zz,11,60,11);cone(g,roof,xx,74,zz,9,34,6);box(g,gold,xx,94,zz,.7,12,.7);box(g,gold,xx,97,zz,5,.7,.7);}for(let j=0;j<3;j++){arch(g,side*23,3,21-j*16,12,28).rotation.y=Math.PI/2;}}
arch(g,0,0,18,17,35);box(g,dark,0,14,17.5,12,28,1);const rose=ring(g,8,.75,gold,0,39,18.1);for(let i=0;i<8;i++){let o=box(g,gold,0,39,18.2,.45,15,.3);o.rotation.z=i*Math.PI/4;}sphere(g,basic('#c1d7dc'),0,39,17.8,7,7,.2);
for(let j=0;j<6;j++){let a=j/6*Math.PI*2;cone(g,stone,Math.cos(a)*35,-24,Math.sin(a)*24,8,42,5).rotation.z=Math.PI;}return g;}
cathedral(105,42,-240,1.6);cathedral(-300,28,-590,2.2);cathedral(490,12,-860,2.8);cathedral(-530,18,130,1.3);cathedral(430,24,340,1.5);cathedral(100,14,850,2);
for(let j=0;j<12;j++){let a=j/12*Math.PI*2;const g=new THREE.Group();g.position.set(Math.cos(a)*720,15,Math.sin(a)*720);g.rotation.y=-a+Math.PI/2;g.userData.fallbackScenery=true;scene.add(g);for(let k=-1;k<=1;k++){box(g,stone,k*27,32,0,5,75,5);cone(g,ivory,k*27,77,0,5,16,4);}arch(g,-13.5,8,0,27, sixty());arch(g,13.5,8,0,27,sixty());}function sixty(){return 60;}
const celestial=ring(scene,165,1.8,basic('#ead4af'),-150,340,-1400);const orbit=ring(scene,197,.6,basic('#d8c9bb'),-150,340,-1400);orbit.rotation.z=.4;const moon=sphere(scene,basic('#e9dbcf'),-150,340,-1410,150,150,5);
// Soft cloud sprites form a continuous sea below the flight area.
const cloudCanvas=document.createElement('canvas');cloudCanvas.width=cloudCanvas.height=128;const cc=cloudCanvas.getContext('2d');const cg=cc.createRadialGradient(64,64,0,64,64,64);cg.addColorStop(0,'rgba(255,255,255,.9)');cg.addColorStop(.4,'rgba(255,255,255,.65)');cg.addColorStop(1,'rgba(255,255,255,0)');cc.fillStyle=cg;cc.fillRect(0,0,128,128);const tex=new THREE.CanvasTexture(cloudCanvas);
let seed=48;function rand(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
const clouds=[];
for(let i=0;i<270;i++){let sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,color:i%3?'#e6d8e5':'#b8b3d3',transparent:true,opacity:.55,depthWrite:false}));sprite.position.set((rand()-.5)*3400,-38+rand()*34,(rand()-.5)*3400);sprite.scale.set(210+rand()*300,65+rand()*95,1);scene.add(sprite);clouds.push(sprite);}
const floor=mesh(new THREE.PlaneGeometry(12000,12000),new THREE.MeshBasicMaterial({color:'#b9adc9'}),scene,0,-64,0);floor.rotation.x=-Math.PI/2;
const particles= new THREE.BufferGeometry();let positions=[];for(let i=0;i<600;i++)positions.push((rand()-.5)*1800,rand()*350,(rand()-.5)*1800);particles.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));scene.add(new THREE.Points(particles,new THREE.PointsMaterial({color:'#fff1cc',size:1.1,transparent:true,opacity:.65})));
const atmosphere=createAtmosphere(scene,sun,hemi,floor,clouds),actions=createFlightActions();
let debris=null;loadDebris(scene,gradient).then(value=>debris=value).catch(error=>console.error("Debris loading failed",error));
let effects=null,manualTarget=null,victoryTime=null,hurtCooldown=0;
loadEffects(scene,player).then(fx=>effects=fx).catch(e=>console.error('Effects loading failed',e));
const playerVelocity=new THREE.Vector3();let barrierHits=0,barrierTime=0;const ramHits=new Set();
const barrierMesh=new THREE.Mesh(new THREE.SphereGeometry(3.8,24,16),new THREE.MeshBasicMaterial({color:'#a3fff0',transparent:true,opacity:.18,wireframe:true,blending:THREE.AdditiveBlending,depthWrite:false}));player.g.add(barrierMesh);barrierMesh.visible=false;
const nattoMagazine=createNattoMagazine(),nattoVisuals=createNattoVisuals(scene);
const enemies=[],bullets=[],sparks=[],fallingEnemies=[];const enemyMat=mat('#71546f'),enemyGlow=basic('#ff979d');
function devil(i){let g=new THREE.Group();scene.add(g);sphere(g,enemyMat,0,0,0,1.3,1.7,.85);sphere(g,pink,0,1.5,0,1.15,1,.9);for(let s of [-1,1]){cone(g,gold,s*.78,2.5,0,.28,1.35,5).rotation.z=-s*.3;sphere(g,enemyGlow,s*.42,1.6,-.8,.17,.18,.1);const sh=new THREE.Shape();sh.moveTo(0,0);sh.lineTo(s*3.9,1.9);sh.lineTo(s*3.2,-.7);sh.quadraticCurveTo(s*2.6,.1,s*2,-1.4);sh.quadraticCurveTo(s*1.4,-.4,s*.6,-1.7);sh.lineTo(0,0);mesh(new THREE.ShapeGeometry(sh),new THREE.MeshToonMaterial({color:'#4a365d',side:THREE.DoubleSide,gradientMap:gradient}),g,0,.3,.3);}const tail=ring(g,.8,.12,enemyMat,0,-1.6,.4);tail.scale.x=.5;g.scale.setScalar(1.4);const marker=document.createElement('div');marker.className='marker';marker.innerHTML=`<span>IMP ${String(i+1).padStart(2,'0')}</span><small></small><div class="enemy-health"><i></i></div><b class="edge-arrow">＞</b><div class="enemy-charge"><i></i><em></em></div>`;$('markers').append(marker);return {g,hp:3,marker,phase:i*2.4,fire:3+i*.7};}
const airspaceCenter=new THREE.Vector3();let airspaceRadius=stage.airspaceRadius;
let wave=0,nextWaveAt=0,bossTime=0,bossForward=new THREE.Vector3(0,0,-1);
function disposeEnemy(e){if(e.disposed)return;e.disposed=true;e.deathMaterials?.forEach(m=>m.dispose());scene.remove(e.g);e.marker.remove();e.g.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.dispose();if(o.isMesh&&!e.visual)o.geometry.dispose();});}
function clearEnemies(){for(const e of enemies){e.marker.remove();if(!fallingEnemies.includes(e))disposeEnemy(e);}enemies.length=0;}
function startDefeat(e){e.deathMaterials=[];const copies=new Map();e.g.traverse(o=>{if(!o.isMesh)return;const clone=m=>{if(!copies.has(m)){const c=m.clone();c.transparent=true;c.opacity=.5;c.depthWrite=false;copies.set(m,c);e.deathMaterials.push(c);}return copies.get(m);};o.material=Array.isArray(o.material)?o.material.map(clone):clone(o.material);});e.deathAge=0;e.deathDuration=e.type==='boss'?4.2:e.type==='captain'?3:2.4;e.deathScale=e.g.scale.clone();e.fallVelocity=(e.velocity||new THREE.Vector3()).clone().multiplyScalar(.2);e.fallVelocity.y=5;e.marker.style.display='none';fallingEnemies.push(e);}
function updateDefeats(dt){
 for(let i=fallingEnemies.length-1;i>=0;i--){const e=fallingEnemies[i];e.deathAge+=dt;
  e.fallVelocity.y-=dt*(e.type==='boss'?22:28);e.g.position.addScaledVector(e.fallVelocity,dt);
  const spin=e.type==='imp'?2.2:e.type==='captain'?.85:.35;e.g.rotateZ(dt*spin);e.g.rotateX(dt*(e.type==='boss'?.35:.7));
 expansion?.animateEnemy(e,worldTime,dt,player.g.position);
  const fade=1-THREE.MathUtils.smoothstep(e.deathAge,e.deathDuration-.55,e.deathDuration);e.g.scale.copy(e.deathScale).multiplyScalar(fade);e.deathMaterials?.forEach(m=>m.opacity=.5*fade);
  if(e.deathAge>=e.deathDuration){effects?.burst(e.g.position,'demon',e.type==='boss'?35:10,.6);disposeEnemy(e);fallingEnemies.splice(i,1);}
 }
}
function keepInAirspace(position){
 const dx=position.x-airspaceCenter.x,dz=position.z-airspaceCenter.z,distance=Math.hypot(dx,dz),limit=airspaceRadius-220;
 if(distance>limit){position.x=airspaceCenter.x+dx/distance*limit;position.z=airspaceCenter.z+dz/distance*limit;}
 return position;
}
function spawnWave(){
 clearEnemies();nextWaveAt=0;wave++;target=null;manualTarget=null;
 const entries=wave<=WAVE_COUNT?formation(wave):[{type:stage.boss.enemyId,slot:0,...stage.boss}];
 const dir=heading(),right=new THREE.Vector3().crossVectors(dir,up).normalize();
 for(const entry of entries){const e=devil(entry.slot),spec=TYPES[entry.type];Object.assign(e,entry,{hp:spec.hp,maxHp:spec.hp,radius:spec.radius,fire:spec.fireInterval+entry.slot*.8});e.g.scale.setScalar(entry.type==='boss'?4:entry.type==='captain'?1.7:1);e.g.position.copy(player.g.position).addScaledVector(dir,stage.spawnDistance+entry.z).addScaledVector(right,entry.x);e.g.position.y=clamp(player.g.position.y+entry.y,30,230);e.marker.querySelector('span').textContent=entry.type==='boss'?'ARCHDEMON':entry.type==='captain'?'LEADER / 中悪魔':`IMP ${entry.slot}`;e.marker.classList.toggle('leader',entry.type!=='imp');enemies.push(e);expansion?.attachEnemy(e);}
 // Each encounter owns an airspace centered on its actual spawn positions.
 airspaceCenter.set(0,0,0);for(const e of enemies)airspaceCenter.add(e.g.position);airspaceCenter.divideScalar(enemies.length);
 if(wave>WAVE_COUNT){gameAudio.music(stage.music.boss);gameAudio.play('boss-arrival');gameAudio.speak('voice-boss',{priority:2});bossTime=0;bossForward.copy(dir);effects?.burst(enemies[0].g.position,'demon',70,2);report('大悪魔接近。急降下と横薙ぎを回避して、魔力収束中に集中攻撃！');}else{report(`第${wave}編隊：${gameData.formations.find(f=>f.id===stage.waves[wave-1]).label}。全撃破で次の編隊へ。`);}
 if(wave>1&&wave<=WAVE_COUNT)gameAudio.play('wave');
 $('wave').textContent=wave<=WAVE_COUNT?`WAVE ${wave} / ${WAVE_COUNT}`:'FINAL / ARCHDEMON';$('boss-hud').classList.toggle('hidden',wave<=WAVE_COUNT);
}
let expansion=null;
loadExpansion(scene,gradient).then(assets=>{expansion=assets;enemies.filter(e=>e.hp>0).forEach(e=>assets.attachEnemy(e));}).catch(e=>console.error('Expansion asset loading failed',e));
let captainShake=0,hitStop=0;
let state='intro',elapsed=0,hp=gameData.player.maxHp,kills=0,shots=0,hits=0,yaw=0,pitch=0,speed=52,gunCd=0,missileCd=0,target=null,mouse={x:0,y:0,active:false},keys={},fire=false,worldTime=0,damageTime=0;
const forward=new THREE.Vector3(),up=new THREE.Vector3(0,1,0),temp=new THREE.Vector3();
function heading(){return new THREE.Vector3(-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));}
const terrainMap=createTerrainMap($('terrain-map'));
const battleLog=createBattleLog($('battle-log-lines'));
function report(text){$('message').textContent=text;battleLog.push(text);}
let musicTitleTimer;
function showMusicTitle(title){
 clearTimeout(musicTitleTimer);
 const el=$('music-title');
 el.textContent=title?`曲名：♪${title}`:'';
 el.classList.toggle('visible',Boolean(title));
 if(title)musicTitleTimer=setTimeout(()=>el.classList.remove('visible'),5000);
}
const gameAudio=createGameAudio({onStatus:text=>$('audio-status').textContent=text,onMusic:showMusicTitle});
let soundEnabled=true;

let preparingFlight=false;
function syncDataHud(){
 document.querySelector('.pilot h3').textContent=gameData.player.label;
 const weaponLabels=document.querySelectorAll('.weapons b');weaponLabels[0].textContent=gameData.weapons.gun.label;weaponLabels[1].textContent=gameData.weapons.spear.label;

 $('hp').textContent=gameData.player.maxHp+' / '+gameData.player.maxHp;
 $('health').setAttribute('aria-valuemax',gameData.player.maxHp);
 $('natto-charge').setAttribute('aria-valuemax',gameData.weapons.natto.capacity);
 document.querySelector('#natto-charge small').textContent='納豆 / '+gameData.weapons.natto.capacity;
 $('natto-ammo').textContent='納豆 '+gameData.weapons.natto.capacity+' / '+gameData.weapons.natto.capacity;
 document.querySelector('.mission h2').textContent=stage.label;
 document.querySelector('.mission p').textContent='全'+WAVE_COUNT+'編隊を突破し、大悪魔を撃破せよ';
 const brief=document.querySelectorAll('.brief b');brief[0].textContent=format(stage.timeLimit);brief[1].textContent=TOTAL_TARGETS;
 $('timer').textContent=format(stage.timeLimit);$('kills').textContent='00 / '+TOTAL_TARGETS;
 $('data-version').textContent=(new URLSearchParams(location.search).has('preview')?'下書きテスト / ':'DATA / ')+dataVersion.slice(0,12);
}
async function prepareFlight(){
 if(preparingFlight)return;preparingFlight=true;
 const previous=state;state='loading';keys={};fire=false;
 $('launch-status').textContent='最新のゲームデータを読み込み中…';
 try{await loadGameData();reset();$('launch-status').textContent='';$('error').classList.add('hidden');}
 catch(error){state=previous;const box=$('error');box.replaceChildren();const p=document.createElement('p');p.textContent=error.message;const retry=document.createElement('button');retry.textContent='再試行';retry.onclick=()=>{box.classList.add('hidden');prepareFlight();};box.append(p,retry);box.classList.remove('hidden');}
 finally{preparingFlight=false;}
}

function enemySound(name,e){const d=e.g.position.clone().sub(player.g.position),distance=d.length();gameAudio.play(name,{gain:Math.max(.15,1-distance/700),pan:Math.max(-.8,Math.min(.8,(d.x*Math.cos(yaw)-d.z*Math.sin(yaw))/300))});}

let climbTime=0,climbEnemy=null,climbConsumed=false,autoTurnEnemy=null;
function reset(){refreshEncounter();airspaceRadius=stage.airspaceRadius;syncDataHud();climbTime=0;climbEnemy=autoTurnEnemy=null;climbConsumed=false;hitStop=0;captainShake=0;player.rushing=false;battleLog.reset();nattoMagazine.reset();$('natto-ammo').textContent='納豆 '+gameData.weapons.natto.capacity+' / '+gameData.weapons.natto.capacity;gameAudio.reset();gameAudio.setPaused(false);gameAudio.music(stage.music.battle,true);gameAudio.play('start');gameAudio.speak('voice-start',{priority:2});barrierHits=0;barrierTime=0;barrierMesh.visible=false;ramHits.clear();playerVelocity.set(0,0,0);for(const e of fallingEnemies)disposeEnemy(e);fallingEnemies.length=0;player.maneuver=null;player.body.rotation.set(-.14,0,0);player.g.rotation.set(0,0,0);debris?.clear();actions.reset();effects?.clear();manualTarget=null;victoryTime=null;hurtCooldown=0;damageTime=0;elapsed=0;hp=gameData.player.maxHp;kills=0;shots=0;hits=0;yaw=0;pitch=0;speed=gameData.player.speed;gunCd=0;missileCd=0;target=null;keys={};fire=false;mouse.active=false;player.g.position.set(stage.spawn.x,stage.spawn.y,stage.spawn.z);wave=0;spawnWave();for(let b of bullets){b.nattoVisual?.dispose();scene.remove(b.g);effects?.release(b.g);if(b.g.userData.spear)b.g.material.dispose();}bullets.length=0;for(let s of sparks){scene.remove(s.g);s.g.geometry.dispose();s.g.material.dispose();}sparks.length=0;$('intro').classList.add('hidden');$('pause').classList.add('hidden');$('result').classList.add('hidden');$('app').classList.add('playing');state='playing';updateHealth();}
function finish(reason){state='result';fire=false;let win=reason==='clear';battleLog.push(win?'MISSION COMPLETE':reason==='time'?'TIME LIMIT':'SIGNAL LOST / GAME OVER',win?'success':'danger');$('result-title').textContent=win?'MISSION COMPLETE':reason==='time'?'TIME LIMIT':'GAME OVER';$('result-copy').textContent=win?'全編隊と大悪魔を撃破。聖域に静寂が戻った。':reason==='time'?'テストフライト終了。次は、大悪魔の撃破を。':'翼の力が尽きた。もう一度、空へ。';$('rank').textContent=win?(hp/gameData.player.maxHp>=.7&&elapsed<stage.timeLimit*.84?'S':hp/gameData.player.maxHp>=.4?'A':'B'):'C';$('stats').innerHTML=`<span>撃破数<b>${kills} / ${TOTAL_TARGETS}</b></span><span>フライト時間<b>${format(elapsed)}</b></span><span>残り耐久値<b>${Math.ceil(hp/gameData.player.maxHp*100)}%</b></span><span>命中率<b>${shots?Math.min(100,Math.round(hits/shots*100)):0}%</b></span>`;$('result').classList.remove('hidden');gameAudio.music(win?stage.music.victory:stage.music.defeat);if(!win)gameAudio.speak(reason==='time'?'voice-timeout':'voice-defeat',{priority:3});}
function format(t){return `${Math.floor(t/60).toString().padStart(2,'0')}:${Math.floor(t%60).toString().padStart(2,'0')}`;}
function pause(){if(state==='playing'){state='paused';gameAudio.setPaused(true);actions.clearTaps();keys={};fire=false;mouse.active=false;$('pause').classList.remove('hidden');}else if(state==='paused'){state='playing';gameAudio.setPaused(false);$('pause').classList.add('hidden');}}
let soundRequest=Promise.resolve(false),defaultSoundPending=true;
async function setSound(value){
 soundEnabled=value;const requested=value;
 $('launch-sound-on').checked=value;$('launch-sound-off').checked=!value;
 $('sound').textContent=value?'SOUND …':'SOUND OFF';
 $('launch-status').textContent=value?'音源を準備しています…':'';
 const active=await gameAudio.setEnabled(requested);
 if(requested===soundEnabled){soundEnabled=active;$('sound').textContent=active?'SOUND ON':'SOUND OFF';$('sound').setAttribute('aria-pressed',String(active));$('launch-sound-on').checked=active;$('launch-sound-off').checked=!active;$('launch-status').textContent=requested&&!active?'音源を読み込めませんでした。ONを選ぶと再試行できます。':'';}
 return active;
}
function chooseSound(value){defaultSoundPending=false;document.removeEventListener('pointerdown',startDefaultSound,true);document.removeEventListener('keydown',startDefaultSound,true);soundRequest=setSound(value);return soundRequest;}
function startDefaultSound(event){if(defaultSoundPending&&!event.target.closest?.('.launch-sound,#sound'))chooseSound(true);}
document.addEventListener('pointerdown',startDefaultSound,true);document.addEventListener('keydown',startDefaultSound,true);
let launching=false;
async function startFlight(){
 if(launching)return;launching=true;$('start').disabled=true;
 try{if(defaultSoundPending)chooseSound(true);await soundRequest;await prepareFlight();}
 finally{launching=false;$('start').disabled=false;}
}
$('launch-sound-on').onchange=()=>chooseSound(true);$('launch-sound-off').onchange=()=>chooseSound(false);$('launch-sound-on').onclick=()=>{if(defaultSoundPending)chooseSound(true);};
$('start').onclick=startFlight;$('restart').onclick=()=>prepareFlight();$('restart-pause').onclick=()=>prepareFlight();$('resume').onclick=pause;$('sound').onclick=()=>chooseSound(!soundEnabled);
for(const bus of ['music','sfx','voice'])$(bus+'-volume').addEventListener('input',e=>gameAudio.setVolume(bus,Number(e.target.value)/100));

function cycleTarget(){
 const candidates=enemies.filter(e=>e.hp>0&&e.g.position.distanceTo(player.g.position)<650);
 if(!candidates.length){manualTarget=null;target=null;return;}
 manualTarget=candidates[(candidates.indexOf(target)+1)%candidates.length];target=manualTarget;gameAudio.play('lock');
}
const debugViewer=createDebugViewer({gradient,getExpansion:()=>expansion,getSnapshot:()=>({hp,time:stage.timeLimit-elapsed,wave,kills,enemies}),onClose:closeDebug});
function closeDebug(){if(state!=='debug')return;debugViewer.close();$('app').inert=false;state='playing';keys={};fire=false;mouse.active=false;actions.clearTaps();gameAudio.setPaused(false);$('scene').focus();}
function openDebug(){if(state!=='playing')return;state='debug';$('app').inert=true;keys={};fire=false;mouse.active=false;actions.clearTaps();gameAudio.setPaused(true);debugViewer.open();}
function handleKeyDown(e){
 if(state==='debug'){if(e.code==='Escape'){e.preventDefault();closeDebug();}return;}
 if(e.target?.matches?.('input,select,textarea'))return;
 if(state==='playing'&&!e.repeat&&((e.code==='KeyB'&&keys.KeyD)||(e.code==='KeyD'&&keys.KeyB))){e.preventDefault();openDebug();return;}
 if(state==='playing'&&['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab','ControlLeft','ControlRight'].includes(e.code))e.preventDefault();
 keys[e.code]=true;if(e.code==='Escape'&&!e.repeat){pause();return;}if(state!=='playing'||e.repeat)return;
 if(e.code==='Tab'){cycleTarget();return;}
 if(e.code==='KeyE'){launch(true);return;}
 const threat=enemies.filter(x=>x.hp>0&&x.charge>0&&x.g.position.distanceTo(player.g.position)<500).sort((a,b)=>a.g.position.distanceToSquared(player.g.position)-b.g.position.distanceToSquared(player.g.position))[0];
 const rushTarget=target?.hp>0?target:enemies.filter(x=>x.hp>0).sort((a,b)=>a.g.position.distanceToSquared(player.g.position)-b.g.position.distanceToSquared(player.g.position))[0];
 const action=actions.key(e.code,elapsed,player.g.position,yaw,e.repeat,{charging:!!threat,away:threat?player.g.position.clone().sub(threat.g.position):null,barrier:barrierHits>0&&barrierTime>0,toward:rushTarget?rushTarget.g.position.clone().sub(player.g.position):heading()});
 if(action==='turn'){barrierHits=gameData.player.barrierHits;barrierTime=gameData.player.barrierDuration;gameAudio.play('barrier');gameAudio.play('dash');report('前方ダッシュ → ターン / バリア展開');}
 if(action==='retreat'){barrierHits=gameData.player.barrierHits;barrierTime=gameData.player.barrierDuration;report('後退回避！ バリア2発分 / W・↑を2回で突撃');}
 if(action==='rush'){ramHits.clear();report('突撃！ 小・中悪魔を撃破／大悪魔をひるませ、通過後にターン');}
 if(action){gameAudio.speak(action==='turn'?'voice-turn':action==='rush'?'voice-rush':'voice-dash',{priority:action==='turn'||action==='rush'?1:0,cooldown:3});effects?.burst(player.g.position,'halo',action==='turn'?9:6,.6);if(action!=='turn')gameAudio.play(action==='retreat'?'barrier':action==='rush'?'rush':'dash');}
}
addEventListener('keydown',handleKeyDown);addEventListener('keyup',e=>keys[e.code]=false);addEventListener('blur',()=>{if(state==='playing')pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='playing')pause();gameAudio.setPaused(document.hidden||state==='paused'||state==='debug');});
addEventListener('mousemove',e=>{if(state!=='playing')return;mouse.x=(e.clientX/innerWidth-.5)*2;mouse.y=(e.clientY/innerHeight-.46)*2;mouse.active=true;});
// Mouse events report each button transition, including chorded presses.
function handleMouseDown(e){if(state!=='playing')return;if(e.button===0){fire=true;launch();}else if(e.button===2){e.preventDefault();launch(true);}}
function handleMouseUp(e){if(e.button===0)fire=false;}
$('scene').addEventListener('mousedown',handleMouseDown);addEventListener('mouseup',handleMouseUp);addEventListener('pointercancel',()=>fire=false);addEventListener('contextmenu',e=>e.preventDefault());
document.querySelectorAll('#touch button').forEach(b=>{b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);keys[b.dataset.key]=true;};b.onpointerup=b.onpointercancel=()=>keys[b.dataset.key]=false;});
function burst(pos,color){const arr=[];for(let i=0;i<54;i++)arr.push((rand()-.5)*2,(rand()-.5)*2,(rand()-.5)*2);let geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(arr,3));let g=new THREE.Points(geo,new THREE.PointsMaterial({color,size:1.2,transparent:true}));g.position.copy(pos);scene.add(g);sparks.push({g,life:1});}
function updateHealth(){
 $('health').style.width=(hp/gameData.player.maxHp*100)+'%';$('health').setAttribute('aria-valuenow',hp);$('hp').textContent=hp+' / '+gameData.player.maxHp;$('app').classList.toggle('critical',hp/gameData.player.maxHp<=.3);
}
function takeDamage(){
 if(state!=='playing'||hurtCooldown>0||actions.dashing)return false;
 hp=Math.max(0,hp-gameData.player.hitDamage);battleLog.push(`DAMAGE −${gameData.player.hitDamage} / HP ${hp}%`,'danger','damage');hurtCooldown=gameData.player.invulnerability;damageTime=.3;updateHealth();effects?.burst(player.g.position,'demon',6,.35);gameAudio.play('damage');if(hp>0)gameAudio.speak('voice-damage',{priority:1,cooldown:4});
 if(hp===0)finish('dead');return true;
}
function beginVictory(){
 state='victory';gameAudio.music(stage.music.victory);gameAudio.speak('voice-victory',{priority:3});victoryTime=0;keys={};fire=false;actions.reset();manualTarget=target=null;
 for(const b of bullets){b.nattoVisual?.dispose();effects?.release(b.g);scene.remove(b.g);if(b.g.userData.spear)b.g.material.dispose();}bullets.length=0;
 $('boss-hud').classList.add('hidden');report('大悪魔消滅――聖域に、朝が戻る。');effects?.burst(enemies[0].g.position,'halo',100,2.5);
}
function updateVictory(dt){victoryTime+=dt;if(victoryTime>=stage.sky.sunriseSeconds){victoryTime=stage.sky.sunriseSeconds;finish('clear');}}
function hurtEnemy(e,n){if(e.hp<=0)return;e.hp=Math.max(0,e.hp-n);if((e.damageAge??2)>.22)e.damageAge=0;hits++;enemySound(n>=6?'spear-hit':'hit',e);if(n>=6){effects?.impact(e.g.position);effects?.burst(e.g.position,'halo',32,.7);effects?.burst(e.g.position,'lumen',24,.5);}if(debris)debris.burst(e.g.position,e.type==='boss');else burst(e.g.position,e.type==='boss'?'#eac1ff':'#ffdeb0');effects?.burst(e.g.position,e.hp<=0?'halo':'lumen',e.hp<=0?18:6,.45);if(e.hp<=0){if(e.type==='captain'||e.type==='boss')hitStop=Math.max(hitStop,e.type==='boss'?.22:.12);if(e.type==='captain'){captainShake=.45;gameAudio.speak('voice-captain',{priority:2,cooldown:1});}startDefeat(e);kills++;battleLog.push(`${e.type.toUpperCase()} DESTROYED / ${kills}`,'success',`kill-${kills}`);enemySound(e.type+'-down',e);if(enemies.every(x=>x.hp<=0)){if(wave>WAVE_COUNT)beginVictory();else{nextWaveAt=elapsed+stage.waveDelay;report(wave===WAVE_COUNT?'全編隊の撃破を確認。巨大な魔力反応が接近中！':'編隊撃破。次の敵が接近中。');}}else report(e.type==='captain'?'中悪魔リーダー撃破！ 残敵を掃討して。':`目標撃破。編隊残り ${enemies.filter(x=>x.hp>0).length} 体。`);}}
function hostileVolley(e,pattern='aimed'){
 enemySound(pattern,e);e.attackAge=0;for(const shot of barrage(e.g.position,player.g.position,playerVelocity,pattern)){
  const g=mesh(shotGeo,hostileMat,scene);g.scale.setScalar(3);g.position.copy(shot.position);effects?.attach(g,'demon');bullets.push({g,v:shot.velocity,life:5,hostile:true,damage:10});
 }
 if(e.type!=='imp')report(pattern==='vertical'?'縦弾幕！ A/D・←/→を2回で横回避':'横弾幕！ W/S・↑/↓を2回で縦回避');
}
function blockProjectile(b){if(barrierHits<=0||barrierTime<=0)return false;barrierHits--;battleLog.push(`BARRIER / 弾を反射 · ${barrierHits}/${gameData.player.barrierHits}`,'success');gameAudio.play(barrierHits?'reflect':'barrier-end');b.hostile=false;b.v.multiplyScalar(-1);b.damage=1;b.life=1.5;effects?.burst(player.g.position,'halo',9,.35);return true;}

const shotGeo=new THREE.SphereGeometry(.38,6,5),missileGeo=new THREE.SphereGeometry(.72,8,6),shotMat=basic('#dcfff1'),missileMat=basic('#ffdfa0'),hostileMat=basic('#ff779f');
function launch(missile=false){if(state!=='playing'||(missile?missileCd>0:gunCd>0))return;if(missile&&!target){report('聖槍の目標がありません。敵を照準に捉えて。');return;}if(missile)missileCd=gameData.weapons.spear.cooldown;else gunCd=gameData.weapons.gun.cooldown;shots++;player.attack?.(missile);let dir=heading();if(target){const distance=target.g.position.distanceTo(player.g.position);dir.copy(target.g.position).addScaledVector(target.velocity||new THREE.Vector3(),missile?0:distance/gameData.weapons.gun.speed).sub(player.g.position).normalize();}let g=mesh(missile?missileGeo:shotGeo,missile?missileMat:shotMat,scene);g.position.copy(player.g.position).addScaledVector(heading(),2);g.scale.set(1,1,missile?3:4);if(missile){expansion?.attachSpear(g);g.userData.spear=!!expansion;}effects?.attach(g,missile?'trail':'lumen');effects?.burst(g.position,'halo',missile?12:1.8,missile?.4:.18);if(missile){effects?.burst(g.position.clone().addScaledVector(dir,5),'lumen',9,.3);effects?.burst(g.position.clone().addScaledVector(dir,9),'halo',17,.45);}bullets.push({g,v:dir.multiplyScalar(missile?gameData.weapons.spear.speed:gameData.weapons.gun.speed),life:missile?gameData.weapons.spear.lifetime:gameData.weapons.gun.lifetime,target:missile?target:null,hostile:false,damage:missile?gameData.weapons.spear.damage:gameData.weapons.gun.damage});gameAudio.play(missile?'spear':'shot');gameAudio.speak(missile?'voice-spear':'voice-shot',{priority:missile?1:0,cooldown:missile?2:3});if(missile)battleLog.push('SERAPH / 聖槍発射','weapon');}
function launchNatto(id){gameAudio.play('natto');const position=player.g.position.clone().addScaledVector(heading(),2),flight=createNattoFlight(id,position,heading(),enemies),visual=nattoVisuals.create(position);bullets.push({g:visual.g,v:flight.v,life:gameData.weapons.natto.lifetime,hostile:false,damage:gameData.weapons.natto.damage,natto:flight,nattoVisual:visual});shots++;}
function update(dt){const playerBefore=player.g.position.clone();barrierTime=Math.max(0,barrierTime-dt);if(!barrierTime&&barrierHits){barrierHits=0;gameAudio.play('barrier-end');}elapsed+=dt;if(elapsed>=stage.timeLimit){elapsed=stage.timeLimit;finish('time');return;}if(nextWaveAt&&elapsed>=nextWaveAt)spawnWave();gunCd-=dt;missileCd-=dt;damageTime-=dt;hurtCooldown=Math.max(0,hurtCooldown-dt);$('app').classList.toggle('damage',damageTime>0);if(elapsed>=stage.timeLimit){elapsed=stage.timeLimit;finish('time');return;}
let turn=(keys.KeyA||keys.ArrowLeft?1:0)-(keys.KeyD||keys.ArrowRight?1:0),vertical=(keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0);if(!turn&&mouse.active)turn=-mouse.x*.8;if(!vertical&&mouse.active)vertical=-mouse.y*.65;if(vertical<=.35){climbTime=0;climbEnemy=null;climbConsumed=false;}
else if(!actions.turning&&!actions.dashing&&!climbConsumed){
 if(target?.hp>0)climbEnemy=target;
 if(!climbEnemy||climbEnemy.hp<=0)climbEnemy=enemies.filter(e=>e.hp>0&&e.g.position.y>player.g.position.y&&e.g.position.distanceTo(player.g.position)<650).sort((a,b)=>a.g.position.distanceToSquared(player.g.position)-b.g.position.distanceToSquared(player.g.position))[0]||null;
 climbTime=climbEnemy&&pitch>.45?climbTime+dt:0;
 if(climbTime>=gameData.player.autoLoopHold&&actions.autoTurn(player.g.position,yaw,climbEnemy.g.position)){
  autoTurnEnemy=climbEnemy;climbConsumed=true;climbTime=0;
  effects?.burst(player.g.position,'halo',32,.8);effects?.burst(player.g.position,'lumen',20,.6);gameAudio.play('turn');gameAudio.speak('voice-turn',{priority:1});report('天空宙返り — 追尾目標を正面へ！');
 }
}
const maneuver=actions.update(dt,player.g.position);
if(maneuver.automatic&&maneuver.motion.progress>=1){
 if(autoTurnEnemy?.hp>0){manualTarget=target=autoTurnEnemy;gameAudio.play('lock');effects?.burst(player.g.position,'halo',20,.5);report('目標を再捕捉！');}autoTurnEnemy=null;mouse.active=false;
}player.rushing=!!maneuver.rushing;player.maneuver=maneuver.turning?maneuver:null;
if(maneuver.turning){yaw=maneuver.yaw;pitch=maneuver.pitch;}
else if(maneuver.rushing||maneuver.preTurning){yaw=maneuver.yaw;pitch=0;}else{yaw+=turn*dt*gameData.player.turnRate;pitch=clamp(pitch+vertical*dt*gameData.player.pitchRate,-gameData.player.maxPitch,gameData.player.maxPitch);if(Math.abs(vertical)<.08)pitch*=Math.exp(-dt*.65);}
speed=THREE.MathUtils.damp(speed,keys.ShiftLeft||keys.ShiftRight?gameData.player.boostSpeed:gameData.player.speed,3,dt);forward.copy(heading());if(!maneuver.turning&&!maneuver.rushing&&!maneuver.preTurning&&!maneuver.retreating)player.g.position.addScaledVector(forward,speed*dt);player.g.position.y=clamp(player.g.position.y,18,310);

if(!maneuver.turning&&Math.hypot(player.g.position.x-airspaceCenter.x,player.g.position.z-airspaceCenter.z)>airspaceRadius){yaw=Math.atan2(player.g.position.x-airspaceCenter.x,player.g.position.z-airspaceCenter.z);forward.copy(heading());report('作戦空域の外縁です。現在の敵出現エリアへ帰投します。');}
if(maneuver.turning){
 player.g.rotation.set(0,maneuver.baseYaw,0);
 const pose=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-maneuver.motion.angle).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),maneuver.motion.roll));
 player.body.quaternion.slerp(pose,1-Math.exp(-dt*18));
 if(maneuver.motion.progress>=1){player.g.rotation.y=yaw;player.body.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(up,-Math.PI));}
}else{player.g.rotation.set(0,yaw,0);const pose=new THREE.Quaternion().setFromEuler(new THREE.Euler(-pitch-.14,0,turn*.48));player.body.quaternion.slerp(pose,1-Math.exp(-dt*5));}
if(manualTarget&&(manualTarget.hp<=0||manualTarget.g.position.distanceTo(player.g.position)>=650))manualTarget=null;
target=manualTarget;let best=.74;
if(wave>WAVE_COUNT)bossTime+=dt;
for(const e of enemies){
 if(e.hp<=0)continue;
 const previous=e.g.position.clone();
 if(e.stagger>0||e.charge>0||maneuver.rushing){e.g.lookAt(player.g.position);}else if(e.type==='boss'){
  const facing=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw));bossForward.lerp(facing,1-Math.exp(-dt*.65)).normalize();
  e.motionTime=bossTime;const maneuver=bossOffset(bossTime),right=new THREE.Vector3().crossVectors(bossForward,up).normalize();
  const destination=player.g.position.clone().addScaledVector(bossForward,maneuver.z).addScaledVector(right,maneuver.x);destination.y=clamp(player.g.position.y+maneuver.y,28,260);
  e.g.position.lerp(keepInAirspace(destination),1-Math.exp(-dt*1.5));e.g.lookAt(player.g.position);e.g.rotation.z=0;


 }else{
  const chase=player.g.position.clone().sub(e.g.position),distance=chase.length();
  e.g.position.addScaledVector(chase.normalize(),dt*(distance>190?TYPES[e.type].chaseSpeed:distance<100?-TYPES[e.type].retreatSpeed:5));
  e.g.position.x+=Math.cos(worldTime*.7+e.phase)*dt*TYPES[e.type].strafeSpeed;e.g.position.y=clamp(e.g.position.y+Math.sin(worldTime+e.phase)*dt*5,25,245);e.g.lookAt(player.g.position);

 }
 keepInAirspace(e.g.position);
 if(e.type==='boss'&&!maneuver.rushing&&!e.stagger&&e.g.position.distanceTo(player.g.position)<160){
  const away=e.g.position.clone().sub(player.g.position);away.y=0;if(away.lengthSq()<.001)away.copy(bossForward);away.normalize();
  const candidate=player.g.position.clone().addScaledVector(away,170);candidate.y=e.g.position.y;keepInAirspace(candidate);
  if(candidate.distanceTo(player.g.position)<160){away.copy(airspaceCenter).sub(player.g.position);away.y=0;away.normalize();candidate.copy(player.g.position).addScaledVector(away,170);candidate.y=e.g.position.y;}
  e.g.position.copy(keepInAirspace(candidate));
 }
 if(e.type==='boss'){$('boss-name').textContent=`大悪魔 / ${e.charge>0?'魔力収束':e.stagger>0?'怯み':bossOffset(bossTime).mode}`;$('boss-health').style.width=(e.hp/e.maxHp*100)+'%';$('boss-hp').textContent=Number(e.hp.toFixed(1))+' / '+e.maxHp;}
 e.velocity=e.g.position.clone().sub(previous).divideScalar(Math.max(dt,.001));
 const wasCharging=e.charge>0;updateEnemyCombat(e,dt,e.g.position.distanceTo(player.g.position),pattern=>hostileVolley(e,pattern));if(!wasCharging&&e.charge>0)enemySound('charge',e);
 if(maneuver.rushing&&!ramHits.has(e)&&new THREE.Line3(playerBefore,player.g.position).closestPointToPoint(e.g.position,true,temp).distanceTo(e.g.position)<e.radius+5){ramHits.add(e);enemySound('stagger',e);e.stagger=1.8;e.charge=0;e.chargeRatio=0;e.pendingCross=null;e.damageAge=0;effects?.burst(e.g.position,'halo',48,.9);effects?.burst(e.g.position,'lumen',32,.65);effects?.impact(e.g.position);if(e.type!=='boss'){hurtEnemy(e,e.hp);report('突撃撃破！');}else report('突撃命中！ 大悪魔がひるんでいる');}
 if(e.hp<=0)continue;
 expansion?.animateEnemy(e,worldTime,dt,player.g.position);
 const d=temp.copy(e.g.position).sub(player.g.position),dist=d.length(),dot=d.normalize().dot(forward);
 if(!manualTarget&&dot>best&&dist<650){best=dot;target=e;}if(dist<e.radius+2&&!maneuver.rushing&&!e.stagger)takeDamage();if(state!=='playing')return;
}

playerVelocity.copy(player.g.position).sub(playerBefore).divideScalar(Math.max(dt,.001));
barrierMesh.visible=barrierHits>0&&barrierTime>0;barrierMesh.rotation.y+=dt;barrierMesh.material.opacity=.12+Math.sin(worldTime*6)*.04;
$('barrier-status').textContent=barrierHits>0?`BARRIER ${barrierHits}/${gameData.player.barrierHits} · ${barrierTime.toFixed(1)}s / W↑×2 突撃`:'';
const firing=!!(fire||keys.Space);if(firing)launch();if(keys.KeyE)launch(true);const nattoId=nattoMagazine.update(dt,firing);if(nattoId!==null)launchNatto(nattoId);$('natto-ammo').textContent=`納豆 ${Math.floor(nattoMagazine.ammo)} / ${gameData.weapons.natto.capacity}${!firing&&nattoMagazine.ammo<gameData.weapons.natto.capacity?' · 補充中':''}`;
for(let i=bullets.length-1;i>=0;i--){let b=bullets[i];b.life-=dt;let before=b.g.position.clone();if(b.natto)steerNatto(b.natto,b.g.position,dt);else if(b.target&&b.target.hp>0)b.v.lerp(temp.copy(b.target.g.position).sub(b.g.position).normalize().multiplyScalar(gameData.weapons.spear.speed),1-Math.exp(-dt*7));b.g.position.addScaledVector(b.v,dt);b.g.lookAt(temp.copy(b.g.position).add(b.v));b.nattoVisual?.update(dt);let line=new THREE.Line3(before,b.g.position);if(b.hostile){if(line.closestPointToPoint(player.g.position,true,temp).distanceTo(player.g.position)<2.8){if(!blockProjectile(b)){takeDamage();b.life=0;}}}else if(!b.deflected)for(let e of enemies){if(e.hp>0&&line.closestPointToPoint(e.g.position,true,temp).distanceTo(e.g.position)<e.radius){if(deflectNatto(b,e,before)){effects?.burst(b.g.position,'demon',7,.22);effects?.burst(b.g.position,'halo',5,.18);enemySound('reflect',e);if(worldTime-(e.lastDeflectLog??-100)>.8){e.lastDeflectLog=worldTime;battleLog.push('BOSS ARMOR / 納豆ミサイルを弾いた','warning');}break;}hurtEnemy(e,b.damage);b.life=0;break;}}if(b.life<=0){b.nattoVisual?.dispose();scene.remove(b.g);effects?.release(b.g);if(b.g.userData.spear)b.g.material.dispose();bullets.splice(i,1);}if(state!=='playing')break;}
if(hp<=0&&state==='playing')finish('dead');
$('kills').textContent=`${String(kills).padStart(2,'0')} / ${TOTAL_TARGETS}`;$('timer').textContent=format(Math.max(0,stage.timeLimit-elapsed));$('speed').textContent=Math.round(speed*3.6);$('altitude').textContent=Math.round(2322+player.g.position.y).toLocaleString();$('heading').textContent=`N · ${String((Math.round(-yaw*180/Math.PI)%360+360)%360).padStart(3,'0')}`;updateHealth();$('dash-status').textContent=actions.dashCooldown>0?actions.dashCooldown.toFixed(1)+'s':'READY';$('turn-status').textContent=actions.turnCooldown>0?actions.turnCooldown.toFixed(1)+'s':'READY';$('missile').textContent=missileCd>0?missileCd.toFixed(1)+'s':'READY';$('lock').textContent=target?(manualTarget?'MANUAL LOCK / TAB':'LOCK ON / TAB'):'SEEKING';}
function radar(){const c=$('radar').getContext('2d');c.clearRect(0,0,180,180);c.strokeStyle='#a4f5d966';c.fillStyle='#13263d88';c.beginPath();c.arc(90,90,77,0,Math.PI*2);c.fill();c.stroke();for(let r of [25,51]){c.beginPath();c.arc(90,90,r,0,Math.PI*2);c.stroke();}c.beginPath();c.moveTo(13,90);c.lineTo(167,90);c.moveTo(90,13);c.lineTo(90,167);c.stroke();c.fillStyle='#d6ffea';c.beginPath();c.moveTo(90,84);c.lineTo(86,95);c.lineTo(94,95);c.fill();for(let e of enemies){if(e.hp<=0)continue;let dx=e.g.position.x-player.g.position.x,dz=e.g.position.z-player.g.position.z;let x=(dx*Math.cos(yaw)-dz*Math.sin(yaw))*.11,y=(dx*Math.sin(yaw)+dz*Math.cos(yaw))*.11;let length=Math.hypot(x,y);if(length>71){x*=71/length;y*=71/length;}c.fillStyle=e===target?'#ffe5a3':'#eea0b6';c.fillRect(88+x,88+y,4,4);}c.fillStyle='#b6eadd';c.font='10px sans-serif';c.fillText('N',87,10);}
const messageAvoidance=new Map();
const playerHudCorners=[];
for(const x of [-3.8,3.8])for(const y of [-3,3])for(const z of [-2,2])playerHudCorners.push(new THREE.Vector3(x,y,z));
const projectedHudPoint=new THREE.Vector3();
function avoidPlayerMessages(){
 const bounds={left:Infinity,right:-Infinity,top:Infinity,bottom:-Infinity};
 for(const corner of playerHudCorners){
  projectedHudPoint.copy(corner).applyMatrix4(player.body.matrixWorld).project(camera);
  if(projectedHudPoint.z>=1||projectedHudPoint.z<=-1)return;
  const x=(projectedHudPoint.x*.5+.5)*innerWidth,y=(-projectedHudPoint.y*.5+.5)*innerHeight;
  bounds.left=Math.min(bounds.left,x);bounds.right=Math.max(bounds.right,x);bounds.top=Math.min(bounds.top,y);bounds.bottom=Math.max(bounds.bottom,y);
 }
 const pending=[];
 for(const id of ['rear-threat','message','barrier-status','boss-charge']){
  const node=id==='message'?$('message').parentElement:$(id);
  if(!node?.getBoundingClientRect)continue;
  const rect=node.getBoundingClientRect(),previous=messageAvoidance.get(id)||{offset:0,side:0};
  if(!rect.width||!rect.height)continue;
  const base={left:rect.left,right:rect.right,top:rect.top-previous.offset,bottom:rect.bottom-previous.offset,height:rect.height};
  const next=avoidPlayerMessage(base,bounds,innerHeight,id==='rear-threat');
  pending.push({id,node,next});
 }
 for(const {id,node,next} of pending){node.style.setProperty('--player-avoid-y',next.offset+'px');messageAvoidance.set(id,next);}
}
function markers(){
 let rearCount=0;const facing=heading();
 for(const e of enemies){
  if(state!=='playing'||e.hp<=0){e.marker.style.display='none';continue;}
  const view=e.g.position.clone().applyMatrix4(camera.matrixWorldInverse),v=e.g.position.clone().project(camera);
  if(view.z>=0||e.g.position.clone().sub(player.g.position).dot(facing)<0){rearCount++;e.marker.style.display='none';continue;}
  const visible=view.z<0&&v.z<1&&Math.abs(v.x)<.91&&Math.abs(v.y)<.78;
  e.marker.style.display='block';e.marker.classList.toggle('offscreen',!visible);e.marker.classList.toggle('locked',e===target);
  e.marker.querySelector('.enemy-health').style.display=e.type==='boss'?'none':'';
  const charge=e.marker.querySelector('.enemy-charge');charge.classList.toggle('active',e.charge>0||e.stagger>0);charge.querySelector('i').style.width=((e.chargeRatio||0)*100)+'%';charge.querySelector('em').textContent=e.stagger>0?'STAGGER':e.type==='boss'?'CHARGE 十字':e.type==='captain'?((e.volleyIndex||0)%2?'CHARGE 横':'CHARGE 縦'):'CHARGE';
  e.marker.querySelector('.enemy-health i').style.width=(e.hp/e.maxHp*100)+'%';
  const distance=Math.round(e.g.position.distanceTo(player.g.position));
  e.marker.querySelector('small').textContent=distance+' M';
  if(visible){e.marker.style.left=(v.x*.5+.5)*innerWidth+'px';e.marker.style.top=(-v.y*.5+.5)*innerHeight+'px';}
  else{const edge=edgeIndicator(view.x,view.y,view.z,innerWidth,innerHeight);e.marker.style.left=edge.x+'px';e.marker.style.top=edge.y+'px';e.marker.querySelector('.edge-arrow').style.transform=`rotate(${edge.angle}rad)`;}
 }
 const boss=enemies.find(e=>e.type==='boss'&&e.hp>0);$('boss-charge').textContent=boss?(boss.stagger>0?'STAGGER / ひるみ':boss.charge>0?`CHARGE ${Math.round((boss.chargeRatio||0)*100)}% · 縦→横 / 横回避→縦回避`:boss.pendingCross?'次は横弾幕 / 縦回避':''):'';
 $('rear-threat').classList.toggle('hidden',state!=='playing'||rearCount===0||actions.turning);$('rear-threat').textContent=actions.turnCooldown>0?`後方に敵 ${rearCount}体 · Ctrlターン ${actions.turnCooldown.toFixed(1)}秒後`:`後方に敵 ${rearCount}体 · Ctrlでターン ↶`;
 const charge=$('spear-charge'),percent=Math.round(clamp(1-missileCd/gameData.weapons.spear.cooldown,0,1)*100);
 const anchor=player.g.position.clone().add(new THREE.Vector3(0,1,0)).project(camera);
 charge.style.left=clamp((anchor.x*.5+.5)*innerWidth+85,55,innerWidth-55)+'px';charge.style.top=clamp((-anchor.y*.5+.5)*innerHeight-20,145,innerHeight-95)+'px';
 const ammoRing=$('natto-charge'),ammo=nattoMagazine.ammo;ammoRing.style.left=clamp((anchor.x*.5+.5)*innerWidth-85,55,innerWidth-55)+'px';ammoRing.style.top=charge.style.top;ammoRing.style.setProperty('--charge',(ammo/gameData.weapons.natto.capacity*100)+'%');ammoRing.setAttribute('aria-valuenow',Math.floor(ammo));ammoRing.classList.toggle('ready',ammo>=gameData.weapons.natto.capacity);$('natto-value').textContent=Math.floor(ammo);
 avoidPlayerMessages();
 charge.style.setProperty('--charge',percent+'%');charge.setAttribute('aria-valuenow',percent);charge.classList.toggle('ready',percent===100);$('charge-value').textContent=percent===100?'READY':percent+'%';
}
const cameraAim=new THREE.Vector3(-2,79,110),cameraDirection=new THREE.Vector3(0,0,-1);
let last=performance.now();function frame(now){requestAnimationFrame(frame);const dt=Math.min((now-last)/1000,.05);last=now;if(state==='debug'){debugViewer.update(dt);return;}if(hitStop>0&&(state==='playing'||state==='victory')){hitStop=Math.max(0,hitStop-dt);renderer.render(scene,camera);return;}if(state!=='paused'){worldTime+=dt;player.animate?.(worldTime,speed,dt,state==='playing'&&!player.maneuver?pitch:0,player.maneuver?.motion);player.wings.forEach((w,i)=>{w.rotation.y=Math.sin(worldTime*4)*(i?-.12:.12);w.rotation.z=Math.sin(worldTime*4)*(i?.08:-.08);});player.halo.rotation.z=worldTime*.2;player.ribbon.forEach((r,i)=>r.rotation.x=.5+Math.sin(worldTime*4+i)*.12);if(state==='playing'){battleLog.update(dt);update(dt);}else if(state==='victory'){battleLog.update(dt);updateVictory(dt);}updateDefeats(dt);effects?.update(worldTime,dt,actions.dashing,state==='playing'&&player.rushing);debris?.update(dt);for(let i=sparks.length-1;i>=0;i--){let s=sparks[i];s.life-=dt;s.g.scale.addScalar(dt*15);s.g.material.opacity=Math.max(0,s.life);if(s.life<=0){scene.remove(s.g);s.g.geometry.dispose();s.g.material.dispose();sparks.splice(i,1);}}}
if(state==='intro'){player.g.position.set(0,78+Math.sin(worldTime)*.4,120);player.g.rotation.y=-.25;camera.position.set(7,82,137);camera.lookAt(-2,79,110);}else{
 const m=player.maneuver,orbitYaw=m?m.baseYaw+m.motion.cameraTurn:yaw;
 const dir=m?new THREE.Vector3(-Math.sin(orbitYaw),.12*Math.sin(m.motion.progress*Math.PI),-Math.cos(orbitYaw)).normalize():heading();
 cameraDirection.lerp(dir,1-Math.exp(-dt*5)).normalize();
 const desired=player.g.position.clone().addScaledVector(cameraDirection,m?-21:-15).add(new THREE.Vector3(0,m?7:5.3,0));
 camera.position.lerp(desired,1-Math.exp(-dt*4));
 cameraAim.lerp(player.g.position.clone().addScaledVector(cameraDirection,25).add(new THREE.Vector3(0,4,0)),1-Math.exp(-dt*5));camera.lookAt(cameraAim);
}$('sky-phase').textContent=atmosphere.update(wave>WAVE_COUNT?bossTime:null,victoryTime,player.g.position,heading());gameAudio.update(dt,{flying:state==='playing',speed,hp,time:stage.timeLimit-elapsed,spearCd:missileCd,turning:!!player.maneuver?.turning});if(state==='playing')terrainMap.update(dt,airspaceCenter,player.g.position,yaw);if(captainShake>0){if(state!=='paused')captainShake=Math.max(0,captainShake-dt);const a=(captainShake/.45)**2*.009;camera.rotateX(Math.sin(worldTime*71)*a);camera.rotateY(Math.sin(worldTime*89+.8)*a);camera.rotateZ(Math.sin(worldTime*57)*a*.45);}renderer.render(scene,camera);markers();radar();}
reset();state='intro';gameAudio.music(stage.music.title);$('intro').classList.remove('hidden');$('app').classList.remove('playing');requestAnimationFrame(frame);
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});





