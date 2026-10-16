import * as THREE from '../vendor/three.module.js';
const up=new THREE.Vector3(0,1,0),right=new THREE.Vector3(1,0,0),front=new THREE.Vector3(0,0,1);
// Camera forward is -Z: positive pitch looks up. Tracking is applied afterward by XR.
export function flightViewQuaternion(yaw,pitch,maneuver,out=new THREE.Quaternion()){
 if(maneuver?.turning)return out.setFromAxisAngle(up,maneuver.baseYaw).multiply(new THREE.Quaternion().setFromAxisAngle(right,maneuver.motion.angle)).multiply(new THREE.Quaternion().setFromAxisAngle(front,maneuver.motion.roll));
 return out.setFromEuler(new THREE.Euler(pitch,yaw,0,'YXZ'));
}
// Head pose is local to the rig, never the already world-rotated camera quaternion.
export function flightTravelDirection(yaw,pitch,head,neutralInverse,out=new THREE.Vector3()){
 const relative=neutralInverse.clone().multiply(head),angles=new THREE.Euler().setFromQuaternion(relative,'YXZ');
 const y=yaw+angles.y,p=THREE.MathUtils.clamp(pitch+angles.x,-Math.PI/2+.01,Math.PI/2-.01);
 return out.set(-Math.sin(y)*Math.cos(p),Math.sin(p),-Math.cos(y)*Math.cos(p));
}

// Two cascaded quaternion filters ease into abrupt action changes without filtering tracking.
export function createFlightRotationSmoother(){
 const intermediate=new THREE.Quaternion(),current=new THREE.Quaternion();let ready=false;
 return {reset(q){intermediate.copy(q);current.copy(q);ready=true;return current;},update(target,dt){
  if(!ready)return this.reset(target);
  const step=Math.min(.05,Math.max(0,dt)),alpha=1-Math.exp(-12*step);
  intermediate.slerp(target,alpha);
  const angle=current.angleTo(intermediate);
  current.slerp(intermediate,angle>1e-8?Math.min(alpha,Math.PI*step/angle):alpha);
  return current;
 }};
}
