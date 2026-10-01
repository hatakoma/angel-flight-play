import * as THREE from '../vendor/three.module.js';
// Damped spring: gravity pulls toward world-down, flight motion keeps the legs loose.
export function createLegSway(seed=0){
 const down=new THREE.Vector3(),q=new THREE.Quaternion();
 const limbs=[{x:-.28,z:.23,vx:0,vz:0},{x:.08,z:-.38,vx:0,vz:0}];
 return (object,time,dt,tuck=0)=>{
  down.set(0,-1,0).applyQuaternion(object.getWorldQuaternion(q).invert());
  const gx=THREE.MathUtils.clamp(-Math.atan2(down.z,Math.max(.15,-down.y)),-.85,.85),gz=THREE.MathUtils.clamp(Math.atan2(down.x,Math.max(.15,-down.y)),-.75,.75);
  return limbs.map((s,i)=>{const phase=time*(i?2.05:1.73)+seed+i*1.8;
   const tx=(i?.08:-.28)+gx*.65+Math.sin(phase)*.19+Math.sin(phase*.57)*.08;
   const tz=(i?-.38:.23)+gz*.65+Math.sin(phase*.83)*.10;
   const step=Math.min(Math.max(dt,0),.1),n=Math.max(1,Math.ceil(step*120)),h=step/n;
   for(let j=0;j<n;j++){s.vx+=((tx-s.x)*20-s.vx*4.8)*h;s.vz+=((tz-s.z)*20-s.vz*4.8)*h;s.x+=s.vx*h;s.z+=s.vz*h;}
   const free=1-THREE.MathUtils.clamp(tuck,0,1);
   return {x:s.x*free,z:s.z*free,knee:(.24+Math.sin(phase-.7)*.14+Math.abs(s.vx)*.12)*free,foot:Math.sin(phase-1.1)*.1*free};
  });
 };
}
