import * as THREE from '../vendor/three.module.js';
import { turnMotion } from './motion.js';

export function createFlightActions(){
 const taps=new Map();let dash=null,turn=null,dashCooldown=0,turnCooldown=0;
 const up=new THREE.Vector3(0,1,0);
 function reset(){taps.clear();dash=null;turn=null;dashCooldown=turnCooldown=0;}
 function key(code,time,position,yaw,repeat=false,context={}){
  if(repeat)return null;
  code=({ArrowUp:'KeyW',ArrowDown:'KeyS',ArrowLeft:'KeyA',ArrowRight:'KeyD'})[code]||code;
  if(code==='ControlLeft'||code==='ControlRight'){
   if(turn||dash||turnCooldown>0)return null;
   dash={age:0,direction:new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw)),duration:.55,speed:180,preTurning:true,yaw};turnCooldown=5;taps.clear();return 'turn';
  }
  if(!['KeyW','KeyA','KeyS','KeyD'].includes(code))return null;
  const last=taps.get(code);taps.set(code,time);
  if(last===undefined||time-last>.28||time-last<.03||dash||turn||dashCooldown>0)return null;
  const direction=code==='KeyW'?up.clone():code==='KeyS'?up.clone().negate():new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw)).multiplyScalar(code==='KeyD'?1:-1);
  if(code==='KeyS'&&context.charging){dash={age:0,direction:(context.away||new THREE.Vector3(Math.sin(yaw),0,Math.cos(yaw))).clone().normalize(),duration:.55,speed:210,retreating:true};dashCooldown=.65;taps.clear();return 'retreat';}
  if(code==='KeyW'&&context.barrier){const dir=(context.toward||new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw))).clone().normalize();dash={age:0,direction:dir,duration:Math.min(2.5,Math.max(1.35,((context.toward?.length()||0)+100)/260)),speed:260,rushing:true,yaw:Math.atan2(-dir.x,-dir.z)};dashCooldown=1.5;taps.clear();return 'rush';}
  dash={age:0,direction,duration:.32,speed:140};dashCooldown=.65;taps.clear();return 'dash';
 }
 function autoTurn(position,yaw,targetPosition){
  if(turn||dash||turnCooldown>0)return false;
  turn={age:0,origin:position.clone(),yaw,radius:Math.min(24,Math.max(0,(310-position.y)/2)),forward:new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw)),targetPosition};turnCooldown=6;taps.clear();return true;
 }
 function update(dt,position){
  dashCooldown=Math.max(0,dashCooldown-dt);turnCooldown=Math.max(0,turnCooldown-dt);
  if(turn){
   turn.age=Math.min(2.4,turn.age+dt);const t=turn.age/2.4,motion=turnMotion(t),angle=motion.angle;
   position.copy(turn.origin).addScaledVector(turn.forward,turn.radius*Math.sin(angle));position.y+=turn.radius*(1-Math.cos(angle));
   const rollPhase=THREE.MathUtils.smoothstep(t,.76,1);position.addScaledVector(turn.forward,-rollPhase*24);
   let correction=0,aimPitch=0;
   if(turn.targetPosition){const d=turn.targetPosition.clone().sub(position),desired=Math.atan2(-d.x,-d.z),delta=Math.atan2(Math.sin(desired-turn.yaw-Math.PI),Math.cos(desired-turn.yaw-Math.PI));correction=delta*THREE.MathUtils.smoothstep(t,.5,1);aimPitch=Math.atan2(d.y,Math.hypot(d.x,d.z))*THREE.MathUtils.smoothstep(t,.76,1);}
   const result={turning:true,automatic:!!turn.targetPosition,yaw:turn.yaw+correction+(t>=.76?Math.PI:0),pitch:t>=.76?aimPitch:angle,roll:t>=1?0:motion.roll,dashing:false,motion,baseYaw:turn.yaw+correction};
   if(t>=1)turn=null;return result;
  }
  if(dash){const active=dash,step=Math.min(dt,active.duration-active.age);position.addScaledVector(active.direction,step*active.speed);active.age+=step;
   if(active.age>=active.duration-1e-6){dash=null;if(active.rushing||active.preTurning){turn={age:0,origin:position.clone(),yaw:active.yaw,radius:Math.min(28,Math.max(4,(310-position.y)/2)),forward:new THREE.Vector3(-Math.sin(active.yaw),0,-Math.cos(active.yaw))};turnCooldown=5;}}
   return {turning:false,dashing:true,rushing:!!active.rushing,preTurning:!!active.preTurning,retreating:!!active.retreating,yaw:active.yaw};}
  return {turning:false,dashing:false};
 }
 return {key,autoTurn,update,reset,clearTaps:()=>taps.clear(),get turning(){return !!turn},get dashing(){return !!dash},get dashCooldown(){return dashCooldown},get turnCooldown(){return turnCooldown}};
}

