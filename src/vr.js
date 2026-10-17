import * as THREE from '../vendor/three.module.js';
import {readQuestInput,createQuestEdges} from './vr-input.js';
import {createVRNotice} from './vr-notice.js';
import {createVRCombatSignals} from './vr-combat.js';
import {createViewRecovery} from './vr-comfort.js';
import {flightViewQuaternion,flightTravelDirection,createFlightRotationSmoother} from './vr-flight.js';

// A separate XR camera keeps headset tracking out of desktop chase-camera logic.
export function createQuestVR({renderer,scene,camera,clouds,resolveScenery=()=>false,getState,onInput,onAction,onPause,onEnd}){
 const rig=new THREE.Group(),view=new THREE.PerspectiveCamera(70,1,.15,5000);
 rig.scale.setScalar(3);rig.add(view);scene.add(rig);
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256;
 const ctx=canvas.getContext('2d'),texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.minFilter=THREE.LinearFilter;texture.generateMipmaps=false;
 // A translucent curved warning strip just above the horizon (about 3–9 degrees).
 const positions=[],uvs=[],indices=[],segments=48;
 for(let row=0;row<2;row++)for(let i=0;i<=segments;i++){
  const angle=(i/segments-.5)*1.2,radius=3.8;
  positions.push(Math.sin(angle)*radius,(.38-row*.26)*(3.8/2.45),-Math.cos(angle)*radius);
  uvs.push(i/segments,1-row);
 }
 for(let i=0;i<segments;i++){const a=i,b=i+1,c=i+segments+1,d=c+1;indices.push(a,c,b,b,c,d);}
 const tableGeometry=new THREE.BufferGeometry();tableGeometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));tableGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));tableGeometry.setIndex(indices);tableGeometry.computeVertexNormals();
 const hud=new THREE.Mesh(tableGeometry,new THREE.MeshBasicMaterial({map:texture,transparent:true,side:THREE.DoubleSide,depthTest:false,depthWrite:false,toneMapped:false}));
 hud.name='vr-warning-table';hud.visible=false;hud.renderOrder=10000;hud.frustumCulled=false;view.add(hud);rig.visible=false;
 const resultCanvas=document.createElement('canvas');resultCanvas.width=1024;resultCanvas.height=256;
 const resultCtx=resultCanvas.getContext('2d'),resultTexture=new THREE.CanvasTexture(resultCanvas);resultTexture.colorSpace=THREE.SRGBColorSpace;resultTexture.minFilter=THREE.LinearFilter;resultTexture.generateMipmaps=false;
 const resultHud=new THREE.Mesh(tableGeometry,hud.material.clone());resultHud.material.map=resultTexture;resultHud.name='vr-result-lower';resultHud.position.y=-1.65;resultHud.visible=false;resultHud.renderOrder=10000;resultHud.frustumCulled=false;view.add(resultHud);
 // Menu curtains cover the upper/lower field while leaving the central scene open.
 const curtains=new THREE.Group();curtains.name='vr-menu-curtains';curtains.visible=false;view.add(curtains);
 for(const sign of [1,-1]){const panel=new THREE.Mesh(new THREE.PlaneGeometry(120,60),new THREE.MeshBasicMaterial({color:0x11152e,transparent:true,opacity:.72,depthTest:false,depthWrite:false,toneMapped:false}));panel.position.set(0,sign>0?30.95:-31.9,-8.3);panel.renderOrder=9999.5;curtains.add(panel);}
 const combatSignals=createVRCombatSignals(scene,view);
 const notice=createVRNotice();let lastNotice='';
 const veilCanvas=document.createElement('canvas');veilCanvas.width=veilCanvas.height=128;const vc=veilCanvas.getContext('2d'),grad=vc.createRadialGradient(64,64,14,64,64,64);grad.addColorStop(0,'#0000');grad.addColorStop(.4,'#0005');grad.addColorStop(1,'#000e');vc.fillStyle=grad;vc.fillRect(0,0,128,128);
 const veil=new THREE.Mesh(new THREE.PlaneGeometry(7,7),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(veilCanvas),transparent:true,depthWrite:false,depthTest:false,toneMapped:false,opacity:.3}));veil.position.z=-2.8;veil.renderOrder=9999;view.add(veil);
 const button=document.createElement('button');button.id='enter-vr';button.className='secondary';button.textContent='VR対応を確認中…';button.disabled=true;document.getElementById('start').after(button);
 const help=document.createElement('p');help.className='hint vr-help';help.textContent='Quest 2：左スティック 操縦 / 右トリガー 射撃 / 左トリガー・右グリップ 聖槍 / A 出撃・敵切替 / B ターン / X 停止 / Y VR終了';button.after(help);
 const assistLabel=document.createElement('label'),assist=document.createElement('input');assist.type='checkbox';assist.checked=true;assistLabel.className='vr-help';assistLabel.append(assist,document.createTextNode(' VR：天使ちゃんが視界外ならゆっくり視点補正'));help.after(assistLabel);
 const status=document.createElement('p');status.className='hint';status.setAttribute('role','status');help.after(status);
 const rotationSmoother=createFlightRotationSmoother(),orbitSmoother=createFlightRotationSmoother(),orbitRotation=new THREE.Quaternion();
 const recovery=createViewRecovery(),anchor=new THREE.Vector3(),followOffset=new THREE.Vector3(),headPrevious=new THREE.Quaternion(),neutralInverse=new THREE.Quaternion(),flightRotation=new THREE.Quaternion(),yawRotation=new THREE.Quaternion(),up=new THREE.Vector3(0,1,0),offset=new THREE.Vector3(),goal=new THREE.Vector3();
 let anchorReady=false,headReady=false,viewYaw=0,followYaw=0,previousState=null,previousSpeed=0,fade=0;
 const transition=new THREE.Mesh(new THREE.PlaneGeometry(8,8),new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0,depthTest:false,depthWrite:false}));transition.position.z=-.8;transition.renderOrder=10010;transition.visible=false;view.add(transition);
 const edges=createQuestEdges(),local=new THREE.Vector3();
 let session=null,entering=false,lastHud=-1,headOffset=new THREE.Vector3(),needsCenter=true,visibility=new Map();
 renderer.xr.enabled=true;renderer.xr.setReferenceSpaceType('local-floor');renderer.xr.setFramebufferScaleFactor(.8);renderer.xr.setFoveation(1);
 function setQuality(active){
  scene.userData.questVR=active;rig.visible=active;document.body.classList.toggle('in-vr',active);
  if(active){clouds.forEach((o,i)=>{visibility.set(o,o.visible);o.visible=i%4===0;});}
  else{combatSignals.hide();for(const [o,v] of visibility)o.visible=v;visibility.clear();}
 }
 function clear(){onInput(readQuestInput([]));edges.reset();}
 function ended(){session=null;entering=false;clear();setQuality(false);onEnd();button.disabled=false;button.textContent='VRで遊ぶ / Quest 2';status.textContent='VRを終了しました。通常画面から再開できます。';}
 async function enter(){
  if(entering||session)return;entering=true;button.disabled=true;status.textContent='ヘッドセットの許可を確認してください。';
  try{
   session=await navigator.xr.requestSession('immersive-vr',{requiredFeatures:['local-floor']});
   session.addEventListener('end',ended,{once:true});
   session.addEventListener('visibilitychange',()=>{if(session?.visibilityState!=='visible'){clear();onPause();}});
   await renderer.xr.setSession(session);setQuality(true);anchorReady=false;headReady=false;recovery.reset();needsCenter=true;lastHud=-1;clear();onPause();
   if(session.supportedFrameRates?.includes(72)&&session.updateTargetFrameRate)await session.updateTargetFrameRate(72).catch(()=>{});
   status.textContent='VR接続中。Aで出撃・再開、Yで終了。';button.textContent='VR接続中';
  }catch(error){const failed=session;if(failed)await failed.end().catch(()=>{});session=null;setQuality(false);entering=false;button.disabled=false;button.textContent='VRで遊ぶ / Quest 2';status.textContent='VRを開始できませんでした。Questブラウザーと権限を確認して再試行してください。';console.warn('XR session failed',error);}
 }
 button.onclick=enter;
 if(!window.isSecureContext||!navigator.xr){button.textContent='VRはQuestのブラウザーで開いてください';status.textContent='この端末では通常画面で遊べます。VRはHTTPS接続が必要です。';}
 else navigator.xr.isSessionSupported('immersive-vr').then(supported=>{button.disabled=!supported;button.textContent=supported?'VRで遊ぶ / Quest 2':'この端末はVR非対応です';}).catch(()=>{button.textContent='VR対応を確認できません';});
 function input(){
  if(!session)return;
  if(session.visibilityState!=='visible'){clear();return;}
  const next=readQuestInput(session.inputSources);onInput(next);
  for(const event of edges.update(next)){
   if(event==='exit'){session.end().catch(()=>{});continue;}
   if(event==='recenter'){needsCenter=true;continue;}
   onAction(event);
  }
 }
 function quality(){
  // Cull decorative architecture only; enemies and collision logic are unchanged.
  for(const o of scene.children)if(o.userData.questScenery){if(!visibility.has(o))visibility.set(o,o.visible);o.visible=o.position.distanceToSquared(camera.position)<1000*1000;}
 }
 function drawHud(s){
  const q=view.getWorldQuaternion(new THREE.Quaternion()).invert(),p=view.getWorldPosition(new THREE.Vector3());let rear=0;
  for(const e of s.enemies){if(e.hp<=0)continue;local.copy(e.g.position).sub(p).applyQuaternion(q);if(local.z>=0)rear++;}
  const lines=notice(s,{rear}),result=s.state==='result',menu=result||s.state==='intro'||s.state==='loading';hud.visible=!!lines;hud.position.y=menu?.75:0;hud.scale.setScalar(menu?2:1);resultHud.scale.setScalar(2);resultHud.position.y=-3.3;resultHud.visible=menu;curtains.visible=menu;
  const signature=JSON.stringify([result,menu,lines]);if(signature===lastNotice)return;lastNotice=signature;
  function paint(context,rows,strong){
   context.clearRect(0,0,1024,256);if(!rows)return;
   context.fillStyle=strong?'#11152e00':'#122b3829';context.fillRect(0,0,1024,256);
   context.strokeStyle=strong?'#e4bf7088':'#9ce5ed33';context.lineWidth=3;context.strokeRect(2,2,1020,252);
   context.textAlign='center';context.lineJoin='round';
   const visibleLines=rows.filter(Boolean),spacing=visibleLines.length>2?62:82;
   visibleLines.forEach((line,i)=>{
    context.fillStyle=strong?(i===0?'#ffe4a0':'#ffffff'):(i===0?'#d3eee6':'#a4c9d0');context.font=(i===0?'bold 44':'bold 32')+'px sans-serif';
    const y=140+(i-(visibleLines.length-1)/2)*spacing;
    if(strong){context.strokeStyle='#070b1c';context.lineWidth=7;context.strokeText(line,512,y,940);}
    context.fillText(line,512,y,940);
   });
  }
  if(result){
   paint(ctx,[lines[0],`評価 ${s.rank||'—'}`],true);
   paint(resultCtx,[`撃破 ${s.kills}/${s.total}　時間 ${s.flightTime||'—'}`,`耐久 ${Math.ceil(s.hp/Math.max(1,s.maxHp)*100)}%　命中 ${s.accuracy??0}%`,lines[3]],true);
  }else if(menu){paint(ctx,['ANGEL FLIGHT','天使ちゃん — 出撃準備'],true);paint(resultCtx,[lines[0],'右トリガー：射撃　左トリガー：聖槍','A：出撃　Y：VR終了'],true);}
  else{paint(ctx,lines,false);paint(resultCtx,null,false);}
  texture.needsUpdate=true;resultTexture.needsUpdate=true;
 }

 function render(dt,now){
  if(!renderer.xr.isPresenting){renderer.render(scene,camera);return;}
  const s=getState();
  const player=s.playerPosition,step=Math.min(.05,Math.max(0,dt));
  const newFlight=s.state==='playing'&&['intro','result','loading'].includes(previousState);
  const resetRotation=!anchorReady||newFlight||needsCenter;
  if(!anchorReady){
   viewYaw=0;followYaw=s.facingYaw||0;anchor.copy(camera.position);
   if(player)followOffset.copy(camera.position).sub(player);else followOffset.set(0,5.3,18);
   followOffset.y=5.3;anchorReady=true;fade=1;recovery.reset();
  }
  const orbitYaw=s.maneuver?.turning?s.maneuver.baseYaw+s.maneuver.motion.cameraTurn:(s.facingYaw||0);
  orbitRotation.setFromAxisAngle(up,orbitYaw);
  if(resetRotation)orbitSmoother.reset(orbitRotation);
  const orbit=orbitSmoother.update(orbitRotation,step);
  local.set(0,0,-1).applyQuaternion(orbit);
  const smoothOrbitYaw=Math.atan2(-local.x,-local.z);
  followOffset.applyAxisAngle(up,smoothOrbitYaw-followYaw);followYaw=smoothOrbitYaw;
  if(newFlight&&player){anchor.copy(player).add(followOffset);fade=1;recovery.reset();}
  else if(player&&s.state!=='paused'){
   goal.copy(player).add(followOffset);
   anchor.x=THREE.MathUtils.damp(anchor.x,goal.x,6,step);anchor.z=THREE.MathUtils.damp(anchor.z,goal.z,6,step);
   anchor.y=THREE.MathUtils.damp(anchor.y,goal.y,s.maneuver?.turning ? .9 : 2,step);
   // Limit chase lag so boosting toward the observer cannot carry the avatar through the camera.
   local.copy(anchor).sub(goal);const lag=Math.hypot(local.x,local.z);if(lag>3){anchor.x=goal.x+local.x/lag*3;anchor.z=goal.z+local.z/lag*3;}anchor.y=THREE.MathUtils.clamp(anchor.y,goal.y-8,goal.y+8);
  }
  previousState=s.state;
  // Flight rotation belongs to the rig; the physical head pose remains untouched.
  flightViewQuaternion(s.facingYaw||0,s.facingPitch||0,s.maneuver,flightRotation);
  flightRotation.multiply(yawRotation.setFromAxisAngle(up,viewYaw));
  if(resetRotation)rotationSmoother.reset(flightRotation);
  const smoothRotation=rotationSmoother.update(flightRotation,step);
  function orient(){rig.quaternion.copy(smoothRotation).multiply(neutralInverse);}
  orient();rig.position.copy(anchor);rig.updateMatrixWorld(true);renderer.xr.updateCamera(view);
  if(needsCenter){
   headOffset.copy(view.position);neutralInverse.copy(view.quaternion).invert();viewYaw=0;needsCenter=false;recovery.reset();fade=1;orient();
  }
  offset.copy(headOffset).multiplyScalar(3).applyQuaternion(rig.quaternion);rig.position.copy(anchor).sub(offset);rig.updateMatrixWorld(true);renderer.xr.updateCamera(view);view.updateMatrixWorld(true);
  const headSpeed=headReady&&step>0?view.quaternion.angleTo(headPrevious)/step:0;headPrevious.copy(view.quaternion);headReady=true;
  let correction={active:false,yaw:0,height:0};
  if(player){local.copy(player);view.worldToLocal(local);correction=recovery.update(step,{x:local.x,y:local.y,z:local.z,headSpeed,enabled:assist.checked&&s.state==='playing'&&!s.maneuver?.turning&&!s.steering});viewYaw+=correction.yaw;followOffset.y=THREE.MathUtils.clamp(followOffset.y+correction.height,-18,18);}
  // Apply recovery through the same rotation filter on the next frame.
  // Resolve the actual tracked head position too, including physical leaning.
  if(player){const head=view.getWorldPosition(new THREE.Vector3()),safe=head.clone();
   if(resolveScenery(player,safe,1.2)){rig.position.add(safe.sub(head));rig.updateMatrixWorld(true);renderer.xr.updateCamera(view);view.updateMatrixWorld(true);}
  }
  combatSignals.update(s);
  const moving=s.state==='playing',speed=s.speed||0,acceleration=step>0?Math.abs(speed-previousSpeed)/step:0;previousSpeed=speed;
  const intense=s.maneuver?.turning||s.dashing||s.rushing||correction.active||s.steering||speed>80||acceleration>30;
  veil.material.opacity=THREE.MathUtils.damp(veil.material.opacity,intense ? .98 : moving ? .52 : .12,8,step);
  transition.visible=fade>.01;transition.material.opacity=fade;fade=Math.max(0,fade-step*2.5);
  if(now-lastHud>=100||lastHud<0){quality();drawHud(s);lastHud=now;}
  renderer.render(scene,view);
 }
 return {input,render,travelDirection(yaw,pitch,out){return flightTravelDirection(yaw,pitch,view.quaternion,neutralInverse,out);},get gazeTarget(){const e=combatSignals.gazeTarget;return e?.hp>0?e:null;},get active(){return renderer.xr.isPresenting;}};
}
