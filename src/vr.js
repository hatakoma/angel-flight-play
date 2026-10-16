import * as THREE from '../vendor/three.module.js';
import {readQuestInput,createQuestEdges} from './vr-input.js';
import {guidanceEmphasis} from './hud-projection.js';

// A separate XR camera keeps headset tracking out of desktop chase-camera logic.
export function createQuestVR({renderer,scene,camera,clouds,getState,onInput,onAction,onPause,onEnd}){
 const rig=new THREE.Group(),view=new THREE.PerspectiveCamera(70,1,.15,5000);
 rig.scale.setScalar(3);rig.add(view);scene.add(rig);
 const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;
 const ctx=canvas.getContext('2d'),texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.minFilter=THREE.LinearFilter;texture.generateMipmaps=false;
 const hud=new THREE.Mesh(new THREE.PlaneGeometry(2.8,1.575),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthTest:false,depthWrite:false,toneMapped:false}));
 hud.position.set(0,0,-2.6);hud.renderOrder=10000;hud.frustumCulled=false;view.add(hud);rig.visible=false;
 const veilCanvas=document.createElement('canvas');veilCanvas.width=veilCanvas.height=128;const vc=veilCanvas.getContext('2d'),grad=vc.createRadialGradient(64,64,24,64,64,64);grad.addColorStop(0,'#0000');grad.addColorStop(.65,'#0002');grad.addColorStop(1,'#000e');vc.fillStyle=grad;vc.fillRect(0,0,128,128);
 const veil=new THREE.Mesh(new THREE.PlaneGeometry(7,7),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(veilCanvas),transparent:true,depthWrite:false,depthTest:false,toneMapped:false,opacity:.3}));veil.position.z=-2.8;veil.renderOrder=9999;view.add(veil);
 const button=document.createElement('button');button.id='enter-vr';button.className='secondary';button.textContent='VR対応を確認中…';button.disabled=true;document.getElementById('start').after(button);
 const help=document.createElement('p');help.className='hint vr-help';help.textContent='Quest 2：左スティック 操縦 / 右トリガー 射撃 / 右グリップ 聖槍 / A 出撃・敵切替 / B ターン / X 停止 / Y VR終了';button.after(help);
 const status=document.createElement('p');status.className='hint';status.setAttribute('role','status');help.after(status);
 const edges=createQuestEdges(),direction=new THREE.Vector3(),local=new THREE.Vector3();
 let session=null,entering=false,lastHud=-1,headOffset=new THREE.Vector3(),needsCenter=true,visibility=new Map(),fps=72,lastFrame=0;
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
   await renderer.xr.setSession(session);setQuality(true);needsCenter=true;lastHud=-1;lastFrame=0;clear();onPause();
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
 function text(line,x,y,size=26,color='#d7fff3',align='center'){ctx.font=`${size}px sans-serif`;ctx.fillStyle=color;ctx.textAlign=align;ctx.fillText(line,x,y);}
 function drawHud(s){
  ctx.clearRect(0,0,1280,720);ctx.fillStyle='#101a2bd9';ctx.fillRect(230,530,820,152);
  const maxHp=Math.max(1,s.maxHp),remaining=Math.max(0,Math.ceil(s.time));
  text(`HP ${Math.ceil(s.hp)} / ${maxHp}    ${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}    撃破 ${s.kills}/${s.total}`,640,563,29);
  ctx.fillStyle='#273943';ctx.fillRect(270,582,740,9);ctx.fillStyle=s.hp/maxHp<.3?'#ff9bac':'#b6ffdf';ctx.fillRect(270,582,740*Math.max(0,s.hp/maxHp),9);
  text(`納豆 ${Math.floor(s.ammo)} / ${s.capacity}     聖槍 ${Math.round(s.spear*100)}%     バリア ${s.barrier}`,640,626,26);
  text(`左スティック 操縦・左グリップ 加速 / 右スティック 緊急回避`,640,662,20,'#a9bcbc');
  if(s.state!=='playing'&&s.state!=='victory'){
   ctx.fillStyle='#11192bec';ctx.fillRect(170,95,940,390);
   text(s.state==='paused'?'一時停止':s.state==='result'?s.result:'ANGEL // 03 · VR',640,155,40,'#ffe3b2');
   text(s.state==='loading'?'データを読み込み中…':s.state==='result'?'A：もう一度出撃':s.state==='paused'?'A / X：再開':'A：出撃する',640,217,32);
   text('右トリガー：通常弾＋納豆 / 右グリップ：聖槍',640,280,25);
   text('A：敵切替 / B：バリア＋ダッシュターン',640,325,25);
   text('X：一時停止 / Y：VR終了 / 右スティック押込：視点調整',640,370,24);
   text(s.error||'座った姿勢で開始。首の動きは照準や操縦に影響しません。',640,423,23);
  }else{
   const q=view.getWorldQuaternion(new THREE.Quaternion()).invert(),p=view.getWorldPosition(new THREE.Vector3());let rear=0;
   for(const e of s.enemies){if(e.hp<=0)continue;local.copy(e.g.position).sub(p).applyQuaternion(q);if(local.z>=0){rear++;continue;}
    const x=local.x/-local.z,y=-local.y/-local.z,outside=Math.abs(x)>.48||Math.abs(y)>.25;
    const angle=Math.atan2(y,x),emphasis=guidanceEmphasis(s.elapsed-s.lastHit),cx=640+(outside?Math.cos(angle)*180:x*1188),cy=360+(outside?Math.sin(angle)*180:y*1188);
    ctx.save();ctx.translate(cx,cy);ctx.globalAlpha=outside?emphasis.opacity:1;
    if(outside){ctx.rotate(angle);text('＞',0,0,26*emphasis.scale,e===s.target?'#ffe09b':'#f6a5c2');}
    else{ctx.strokeStyle=e===s.target?'#ffe09b':'#f6a5c2';ctx.strokeRect(-13,-13,26,26);ctx.fillStyle='#f6a5c2';ctx.fillRect(-22,20,44*Math.max(0,e.hp/e.maxHp),4);if(e.charge>0){ctx.fillStyle='#ffa85f';ctx.fillRect(-22,29,44*(e.chargeRatio||0),4);}}
    ctx.restore();
   }
   if(rear){const a=guidanceEmphasis(s.elapsed-s.lastHit);ctx.globalAlpha=a.opacity;text(`後方に敵 ${rear}体 · Bでターン`,640,491,22*a.scale,'#ffe0a0');ctx.globalAlpha=1;}
   if(s.aim){local.copy(s.aim).sub(p).applyQuaternion(q);if(local.z<0)text('＋',640+THREE.MathUtils.clamp(local.x/-local.z*1188,-420,420),360+THREE.MathUtils.clamp(-local.y/-local.z*1188,-280,120),28,'#d3fff1');}
   if(s.target)text(`${s.target.type==='boss'?'大悪魔':s.target.type==='captain'?'中悪魔':'小悪魔'}  HP ${Math.ceil(s.target.hp)} / ${s.target.maxHp}`,640,75,24,'#ffe0a0');
  }
  text(`QUEST · ${Math.round(fps)} fps`,1110,690,16,'#829795');texture.needsUpdate=true;
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
  if(lastFrame&&now>lastFrame)fps=THREE.MathUtils.lerp(fps,1000/(now-lastFrame),.03);lastFrame=now;
  if(now-lastHud>=100||lastHud<0){quality();drawHud(s);lastHud=now;}
  renderer.render(scene,view);
 }
 return {input,render,get active(){return renderer.xr.isPresenting;}};
}
