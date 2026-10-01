import {createLegSway} from './leg-sway.js';
import {bindPoseFrame,rigPose} from './rig-pose.js';
import * as THREE from '../vendor/three.module.js';
import { GLTFLoader } from '../vendor/GLTFLoader.js';
import { clone } from '../vendor/SkeletonUtils.js';
import { TYPES } from './encounter.js';
import { bossMotion } from './motion.js';

export async function loadExpansion(scene,gradient){
 const loader=new GLTFLoader(),models={};
 await Promise.all(['imp','captain','boss','castle','gate','spear'].map(async name=>{
  const gltf=await loader.loadAsync(new URL(`../assets/${name}.glb`,import.meta.url).href);
  gltf.scene.traverse(o=>{if(o.isMesh){const convert=m=>new THREE.MeshToonMaterial({color:m.color,map:m.map,gradientMap:gradient,side:THREE.DoubleSide});o.material=Array.isArray(o.material)?o.material.map(convert):convert(o.material);o.frustumCulled=false;}});
  models[name]=gltf.scene;
 }));
 function instance(name,height,rigged=false){
  const model=rigged?clone(models[name]):models[name].clone(true);
  model.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(model),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
  const scale=height/Math.max(size.y,.001);model.scale.multiplyScalar(scale);model.position.addScaledVector(center,-scale);
  const group=new THREE.Group();group.add(model);return group;
 }
 for(const object of [...scene.children])if(object.userData.fallbackScenery)scene.remove(object);
 for(const [x,y,z,height] of [[150,35,-350,230],[-420,50,-720,330],[550,65,-1100,440],[-650,30,220,210],[600,30,470,240],[50,20,950,300],[-1050,100,-1750,620],[1200,130,-2100,720]]){
  const castle=instance('castle',height);castle.position.set(x,y,z);castle.rotation.y=Math.atan2(x,z)*.3;scene.add(castle);
 }
 for(let i=0;i<10;i++){const angle=i/10*Math.PI*2,gate=instance('gate',95+i%3*20);gate.position.set(Math.sin(angle)*740,35,Math.cos(angle)*740);gate.rotation.y=angle;scene.add(gate);}
 const delta=new THREE.Quaternion(),goal=new THREE.Quaternion(),poseEuler=new THREE.Euler();
 function attachEnemy(e){
  if(e.visual)return;
  for(const child of [...e.g.children]){child.traverse(o=>{if(o.isMesh)o.geometry.dispose();});e.g.remove(child);}e.g.scale.setScalar(1);
  e.visual=instance(e.type,TYPES[e.type].height,true);e.g.add(e.visual);e.bones=[];
  e.g.updateWorldMatrix(true,true);
  const basis=e.visual.getWorldQuaternion(new THREE.Quaternion());
  e.visual.traverse(o=>{if(o.isBone){const inverse=o.getWorldQuaternion(new THREE.Quaternion()).invert();e.bones.push({bone:o,rest:o.quaternion.clone(),axis:new THREE.Vector3(0,0,1).applyQuaternion(basis).applyQuaternion(inverse),aimPitch:new THREE.Vector3(1,0,0).applyQuaternion(basis).applyQuaternion(inverse),sweep:new THREE.Vector3(0,1,0).applyQuaternion(basis).applyQuaternion(inverse)});}});
  for(const b of e.bones)bindPoseFrame(b,basis);
 }
 function animateEnemy(e,time,dt,playerPosition=null){
  if(!e.visual)return;
  e.legSway??=createLegSway(e.phase||0);e.looseLegs=e.legSway(e.visual,time,dt);
  if(e.deathAge!==undefined){animateDefeat(e,dt);return;}
  e.attackAge=(e.attackAge??2)+dt;e.damageAge=(e.damageAge??2)+dt;
  const attack=e.attackAge<.8?Math.sin(Math.PI*e.attackAge/.8):0,damage=e.damageAge<.55?Math.sin(Math.PI*e.damageAge/.55):0;
  const guard=e.fighting||0,charging=e.charge>0?1:0;
  const motion=e.type==='boss'?bossMotion(e.motionTime??time,attack,Math.max(damage,e.stagger>0?.8:0)):{lean:guard*.2+(e.stagger>0?.5:0),yaw:0,roll:0,tuck:guard*.15,attack,damage,label:'構え'};
  if(motion){goal.setFromEuler(poseEuler.set(motion.lean,motion.yaw,motion.roll));e.visual.quaternion.slerp(goal,1-Math.exp(-dt*7));e.poseLabel=motion.label;}
  e.visual.position.y=Math.sin(time*2+e.phase)*.3;
  let aimYaw=0,aimPitch=0;
  if(playerPosition&&(e.type==='captain'||e.type==='boss')){
   e.visual.updateWorldMatrix(true,true);
   const local=e.visual.worldToLocal(playerPosition.clone());
   aimYaw=THREE.MathUtils.clamp(Math.atan2(local.x,local.z),-1.1,1.1);
   aimPitch=THREE.MathUtils.clamp(-Math.atan2(local.y,Math.hypot(local.x,local.z)),-.65,.65);
  }
  e.aimYaw=THREE.MathUtils.damp(e.aimYaw||0,aimYaw,6,dt);e.aimPitch=THREE.MathUtils.damp(e.aimPitch||0,aimPitch,6,dt);
  for(const b of e.bones){
   const wing=b.bone.name.match(/EnemyWing(Root|Mid|Tip)(L|R)/);
   if(wing){const lag={Root:0,Mid:.6,Tip:1.15}[wing[1]],side=wing[2]==='L'?1:-1,phase=time*(e.type==='boss'?3.4:5)+e.phase-lag;delta.setFromAxisAngle(b.axis,side*(.07+Math.sin(phase)*(.16+lag*.06)+(motion?motion.tuck*.45-attack*.4+damage*.3:0)));goal.copy(b.rest).multiply(delta);delta.setFromAxisAngle(b.sweep,side*(Math.cos(phase)*(.12+lag*.05)+(motion?attack*.3:0)));goal.multiply(delta);b.bone.quaternion.slerp(goal,1-Math.exp(-dt*14));}
   else if(b.bone.name.startsWith('EnemyTail')){delta.setFromAxisAngle(b.axis,Math.sin(time*2+e.phase)*.18);b.bone.quaternion.copy(b.rest).multiply(delta);}
   else if(motion){
    const name=b.bone.name.replace(/^mixamorig:?/,''),side=name.startsWith('Left')?1:-1;
    const leg=e.looseLegs[side===1?0:1];
    let angles=null;
    if(name==='Spine'||name==='Spine1')angles=[motion.tuck*.18-attack*.16+damage*.3,0,damage*.12];
    else if(name==='Head')angles=[-attack*.22-damage*.35,Math.sin(time*.6)*.1,0];
    else if(/^(Left|Right)Arm$/.test(name))angles=[-attack*.95+damage*.3-guard*.45-charging*.25,attack*side*.3,side*(.2+motion.tuck*.35+attack*.65+guard*.35)];
    else if(/^(Left|Right)ForeArm$/.test(name))angles=[-.2-attack*.6-motion.tuck*.5-guard*.75-charging*.2,0,0];
    else if(/^(Left|Right)UpLeg$/.test(name))angles=[-motion.tuck*.6+leg.x,0,leg.z];
    else if(/^(Left|Right)Leg$/.test(name))angles=[leg.knee+motion.tuck*.8+attack*.2,0,0];
    if(angles){rigPose(b,...angles,goal);
     const weight=name==='Spine'?.55:name==='Spine1'?.35:name==='Head'?.10:0;
     if(weight){delta.setFromAxisAngle(b.sweep,e.aimYaw*weight);goal.multiply(delta);delta.setFromAxisAngle(b.aimPitch,e.aimPitch*weight);goal.multiply(delta);}
     b.bone.quaternion.slerp(goal,1-Math.exp(-dt*10));}
   }
  }
 }
 function animateDefeat(e,dt){
  const t=e.deathAge,imp=e.type==='imp',boss=e.type==='boss',collapse=THREE.MathUtils.smoothstep(t,0,boss?1.1:.65);
  for(const b of e.bones){
   const name=b.bone.name.replace(/^mixamorig:?/,''),wing=name.match(/EnemyWing(Root|Mid|Tip)(L|R)/),side=name.startsWith('Left')?1:-1;
   if(wing){const sign=wing[2]==='L'?1:-1,lag={Root:0,Mid:.3,Tip:.6}[wing[1]];
    const angle=imp?Math.sin(t*15-lag)*.45*Math.exp(-t)+collapse*.65:boss?-.65*(1-collapse)+collapse*(.4+lag):collapse*(.85+lag);
    delta.setFromAxisAngle(b.axis,sign*angle);goal.copy(b.rest).multiply(delta);b.bone.quaternion.slerp(goal,1-Math.exp(-dt*9));continue;}
   const leg=e.looseLegs[side===1?0:1];
    let angles=null;
   if(name==='Spine'||name==='Spine1')angles=[boss?-.45*(1-collapse)+collapse*.5:collapse*(imp?.3:.65),0,imp?Math.sin(t*9)*.12:0];
   else if(name==='Head')angles=[collapse*.45,0,imp?.2:0];
   else if(/^(Left|Right)Arm$/.test(name))angles=[imp?Math.sin(t*12+side)*.5:boss?-.8*(1-collapse)+collapse*.35:.4,0,side*(imp?.65:boss?.85*(1-collapse)+.2:.1)];
   else if(/^(Left|Right)ForeArm$/.test(name))angles=[imp?-.65:-.35-collapse*.4,0,0];
   else if(/^(Left|Right)UpLeg$/.test(name))angles=[leg.x+collapse*-.25,0,leg.z];
   else if(/^(Left|Right)Leg$/.test(name))angles=[leg.knee+collapse*(imp?.8:.45),0,0];
   if(angles){rigPose(b,...angles,goal);b.bone.quaternion.slerp(goal,1-Math.exp(-dt*8));}
  }
 }
 function attachSpear(projectile){
  projectile.visible=true;projectile.material=projectile.material.clone();projectile.material.visible=false;projectile.scale.setScalar(1);
  const spear=instance('spear',5.5);spear.rotation.x=Math.PI/2;projectile.add(spear);
 }
 document.getElementById('scene').dataset.expansion='ready';
 return {attachEnemy,animateEnemy,attachSpear};
}

