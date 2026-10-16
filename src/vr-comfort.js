import * as THREE from '../vendor/three.module.js';
// Head-centre gaze, not eye tracking. Keep selection stable without targeting behind the viewer.
export function selectGazeTarget(enemies,view,current=null){
 const origin=view.getWorldPosition(new THREE.Vector3()),forward=view.getWorldDirection(new THREE.Vector3());
 let best=null,score=Infinity;
 for(const e of enemies){if(e.hp<=0)continue;const delta=e.g.getWorldPosition(new THREE.Vector3()).sub(origin),distance=delta.length();if(distance<.01||distance>650)continue;
  const angle=Math.acos(THREE.MathUtils.clamp(delta.normalize().dot(forward),-1,1));
  const limit=Math.min(.22,.10+Math.atan2(e.radius||3,distance));if(angle>limit+(e===current ? .035 : 0))continue;
  const value=angle-(e===current ? .025 : 0);if(value<score){score=value;best=e;}
 }
 return best;
}
// Correction is delayed, speed-limited and suspended during voluntary head motion.
export function createViewRecovery(){
 let hidden=0,recovering=false,headRest=0;
 return {reset(){hidden=0;recovering=false;headRest=0;},update(dt,{x,y,z,headSpeed=0,enabled=true}){
  dt=Math.min(Math.max(dt,0),.05);
  if(!enabled||headSpeed>.26){hidden=0;recovering=false;headRest=.6;return {yaw:0,height:0,active:false};}
  headRest=Math.max(0,headRest-dt);if(headRest>0)return {yaw:0,height:0,active:false};
  const horizontal=Math.atan2(x,-z),vertical=Math.atan2(y,Math.hypot(x,z));
  const outside=z>=0||Math.abs(horizontal)>.87||Math.abs(vertical)>.61;
  hidden=outside?hidden+dt:0;if(hidden>=1.2)recovering=true;
  if(Math.abs(horizontal)<.35&&Math.abs(vertical)<.26)recovering=false;
  if(!recovering)return {yaw:0,height:0,active:false};
  return {yaw:Math.abs(horizontal)>.35?-Math.sign(horizontal)*Math.min(Math.abs(horizontal)-.35,THREE.MathUtils.degToRad(8)*dt):0,height:Math.abs(vertical)>.26?-Math.sign(vertical)*4*dt:0,active:true};
 }};
}
