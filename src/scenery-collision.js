import * as THREE from '../vendor/three.module.js';
// Conservative world-space mesh bounds; cached independently of VR visibility culling.
export function createSceneryCollision(scene){
 const roots=new Map(),ray=new THREE.Ray(),delta=new THREE.Vector3(),hit=new THREE.Vector3(),box=new THREE.Box3();
 function refresh(){
  for(const root of roots.keys())if(root.parent!==scene)roots.delete(root);
  for(const root of scene.children)if((root.userData.questScenery||root.userData.fallbackScenery)&&!roots.has(root)){
   root.updateWorldMatrix(true,true);const bounds=[];root.traverse(o=>{if(o.isMesh){if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();bounds.push(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));}});roots.set(root,bounds);
  }
 }
 function resolve(from,to,radius=3){
  refresh();const start=from.clone();let collided=false;
  // Handle assets appearing around an existing point and starts inside a collider.
  for(let pass=0;pass<4;pass++)for(const bounds of roots.values())for(const b of bounds){
   box.copy(b).expandByScalar(radius);if(!box.containsPoint(start))continue;
   let distance=Infinity,axis='x',edge=0;
   for(const a of ['x','y','z'])for(const side of ['min','max']){const d=Math.abs(start[a]-box[side][a]);if(d<distance){distance=d;axis=a;edge=box[side][a]+(side==='min'?-.02:.02);}}
   start[axis]=edge;collided=true;
  }
  delta.copy(to).sub(start);const length=delta.length();if(length<1e-8){to.copy(start);return collided;}
  ray.set(start,delta.divideScalar(length));let safe=length;
  for(const bounds of roots.values())for(const b of bounds){box.copy(b).expandByScalar(radius);if(ray.intersectBox(box,hit)){const d=hit.distanceTo(start);if(d<=safe){safe=Math.max(0,d-.03);collided=true;}}}
  to.copy(start).addScaledVector(delta,safe);return collided;
 }
 return {resolve};
}
