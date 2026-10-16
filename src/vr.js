import * as THREE from '../vendor/three.module.js';
import {readQuestInput,createQuestEdges} from './vr-input.js';
import {createVRNotice} from './vr-notice.js';

// A separate XR camera keeps headset tracking out of desktop chase-camera logic.
export function createQuestVR({renderer,scene,camera,clouds,getState,onInput,onAction,onPause,onEnd}){
 const rig=new THREE.Group(),view=new THREE.PerspectiveCamera(70,1,.15,5000);
 rig.scale.setScalar(3);rig.add(view);scene.add(rig);
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256;
 const ctx=canvas.getContext('2d'),texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.minFilter=THREE.LinearFilter;texture.generateMipmaps=false;
 // A shallow curved tabletop below the flight view, not a front-facing window.
 const positions=[],uvs=[],indices=[],segments=48;
 for(let row=0;row<2;row++)for(let i=0;i<=segments;i++){
  const angle=(i/segments-.5)*1.2,radius=row?1.8:2.45;
  positions.push(Math.sin(angle)*radius,-1.02+(radius-1.8)*.18,-Math.cos(angle)*radius);
  uvs.push(i/segments,1-row);
 }
 for(let i=0;i<segments;i++){const a=i,b=i+1,c=i+segments+1,d=c+1;indices.push(a,c,b,b,c,d);}
 const tableGeometry=new THREE.BufferGeometry();tableGeometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));tableGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));tableGeometry.setIndex(indices);tableGeometry.computeVertexNormals();
 const hud=new THREE.Mesh(tableGeometry,new THREE.MeshBasicMaterial({map:texture,transparent:true,side:THREE.DoubleSide,depthTest:false,depthWrite:false,toneMapped:false}));
 hud.name='vr-warning-table';hud.visible=false;hud.renderOrder=10000;hud.frustumCulled=false;view.add(hud);rig.visible=false;
 const notice=createVRNotice();let lastNotice='';
 const veilCanvas=document.createElement('canvas');veilCanvas.width=veilCanvas.height=128;const vc=veilCanvas.getContext('2d'),grad=vc.createRadialGradient(64,64,24,64,64,64);grad.addColorStop(0,'#0000');grad.addColorStop(.65,'#0002');grad.addColorStop(1,'#000e');vc.fillStyle=grad;vc.fillRect(0,0,128,128);
 const veil=new THREE.Mesh(new THREE.PlaneGeometry(7,7),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(veilCanvas),transparent:true,depthWrite:false,depthTest:false,toneMapped:false,opacity:.3}));veil.position.z=-2.8;veil.renderOrder=9999;view.add(veil);
 const button=document.createElement('button');button.id='enter-vr';button.className='secondary';button.textContent='VR対応を確認中…';button.disabled=true;document.getElementById('start').after(button);
 const help=document.createElement('p');help.className='hint vr-help';help.textContent='Quest 2：左スティック 操縦 / 右トリガー 射撃 / 右グリップ 聖槍 / A 出撃・敵切替 / B ターン / X 停止 / Y VR終了';button.after(help);
 const status=document.createElement('p');status.className='hint';status.setAttribute('role','status');help.after(status);
 const edges=createQuestEdges(),direction=new THREE.Vector3(),local=new THREE.Vector3();
 let session=null,entering=false,lastHud=-1,headOffset=new THREE.Vector3(),needsCenter=true,visibility=new Map();
 renderer.xr.enabled=true;renderer.xr.setReferenceSpaceType('local-floor');renderer.xr.setFramebufferScaleFactor(.8);renderer.xr.setFoveation(1);
 function setQuality(active){
  scene.userData.questVR=active;rig.visible=active;document.body.classList.toggle('in-vr',active);
  if(active){clouds.forEach((o,i)=>{visibility.set(o,o.visible);o.visible=i%4===0;});}
  else{for(const [o,v] of visibility)o.visible=v;visibility.clear();}
 }
 function clear(){onInput(readQuestInput([]));edges.reset();}
 function ended(){session=null;entering=false;clear();setQuality(false);onEnd();button.disabled=false;button.textContent='VRで遊ぶ / Quest 2';status.textContent='VRを終了しました。通常画面から再開できます。';}
 async function enter(){
  if(entering||session)return;entering=true;button.disabled=true;status.textContent='ヘッドセットの許可を確認してください。';
  try{
   session=await navigator.xr.requestSession('immersive-vr',{requiredFeatures:['local-floor']});
   session.addEventListener('end',ended,{once:true});
   session.addEventListener('visibilitychange',()=>{if(session?.visibilityState!=='visible'){clear();onPause();}});
   await renderer.xr.setSession(session);setQuality(true);needsCenter=true;lastHud=-1;clear();onPause();
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
  const q=view.getWorldQuaternion(new THREE.Quaternion()).invert(),p=view.getWorldPosition(new THREE.Vector3());let rear=0,charging=false;
  for(const e of s.enemies){if(e.hp<=0)continue;local.copy(e.g.position).sub(p).applyQuaternion(q);if(local.z>=0)rear++;if(e.charge>0&&local.length()<450)charging=true;}
  const lines=notice(s,{rear,charging});hud.visible=!!lines;
  const signature=JSON.stringify(lines);if(signature===lastNotice)return;lastNotice=signature;
  ctx.clearRect(0,0,1024,256);
  if(lines){
   ctx.fillStyle='#122b38b3';ctx.fillRect(0,0,1024,256);
   ctx.strokeStyle='#9ce5ed80';ctx.lineWidth=3;ctx.strokeRect(2,2,1020,252);
   ctx.textAlign='center';ctx.fillStyle='#e1fff8';ctx.font='bold 46px sans-serif';ctx.fillText(lines[0],512,lines[1]?112:145,940);
   if(lines[1]){ctx.fillStyle='#abdfe5';ctx.font='32px sans-serif';ctx.fillText(lines[1],512,185,940);}
  }
  texture.needsUpdate=true;
 }
 function render(dt,now){
  if(!renderer.xr.isPresenting){renderer.render(scene,camera);return;}
  const s=getState();camera.getWorldDirection(direction);const yaw=Math.atan2(-direction.x,-direction.z);
  // No forced pitch, roll, shake or loop rotation of the headset camera.
  rig.rotation.set(0,yaw,0);rig.position.copy(camera.position);rig.updateMatrixWorld(true);
  renderer.xr.updateCamera(view);
  if(needsCenter){headOffset.copy(view.position);needsCenter=false;}
  const offset=headOffset.clone().multiplyScalar(3).applyQuaternion(rig.quaternion);rig.position.sub(offset);rig.updateMatrixWorld(true);
  renderer.xr.updateCamera(view);view.updateMatrixWorld(true);
  veil.material.opacity=(s.maneuver?.turning||s.maneuver?.dashing)? .9:.3;
  if(now-lastHud>=100||lastHud<0){quality();drawHud(s);lastHud=now;}
  renderer.render(scene,view);
 }
 return {input,render,get active(){return renderer.xr.isPresenting;}};
}
