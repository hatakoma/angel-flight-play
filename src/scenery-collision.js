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
 function place(position,radius=3){
  refresh();let overlaps=false;for(const bounds of roots.values())for(const b of bounds){box.copy(b).expandByScalar(radius);if(box.containsPoint(position)){overlaps=true;break;}}
  if(!overlaps)return false;
  const boxes=[...roots.values()].flat().map(b=>b.clone().expandByScalar(radius)),origin=position.clone();
  const clear=p=>boxes.every(b=>!b.containsPoint(p));if(clear(origin))return false;
  // Candidate faces include the outermost bounds, so even overlapping buildings have an exit.
  const candidates=[];
  for(const b of boxes)for(const axis of ['x','z'])for(const side of ['min','max']){
   const p=origin.clone();p[axis]=b[side][axis]+(side==='min'?-.1:.1);candidates.push(p);
  }
  candidates.sort((a,b)=>a.distanceToSquared(origin)-b.distanceToSquared(origin));
  const safe=candidates.find(clear);if(safe)position.copy(safe);return !!safe;
 }
 function clearLine(from,to,radius=1){
  refresh();delta.copy(to).sub(from);const length=delta.length();if(length<1e-6)return true;
  ray.set(from,delta.divideScalar(length));
  for(const bounds of roots.values())for(const b of bounds){box.copy(b).expandByScalar(radius);if(box.containsPoint(from)||box.containsPoint(to))return false;if(ray.intersectBox(box,hit)&&hit.distanceTo(from)<length)return false;}
  return true;
 }
 function free(p,radius){for(const bounds of roots.values())for(const b of bounds)if(box.copy(b).expandByScalar(radius).containsPoint(p))return false;return true;}
 function visiblePosition(observer,desired,radius){
  refresh();if(free(desired,radius)&&clearLine(observer,desired))return desired.clone();
  const distance=Math.max(60,Math.hypot(desired.x-observer.x,desired.z-observer.z)),angle=Math.atan2(desired.x-observer.x,desired.z-observer.z);
  for(const scale of [1,.7,1.25,.45])for(let i=0;i<24;i++){
   const offset=(i%2?1:-1)*Math.ceil(i/2)*Math.PI/12,a=angle+offset;
   const p=new THREE.Vector3(observer.x+Math.sin(a)*distance*scale,desired.y,observer.z+Math.cos(a)*distance*scale);
   if(free(p,radius)&&clearLine(observer,p))return p;
  }
  return null;
 }
 function sightWaypoint(observer,current,radius){
  refresh();const goal=visiblePosition(observer,current,radius);if(!goal)return null;
  if(clearLine(current,goal,radius))return goal;
  // Small visibility graph around nearby building corners; never route through a wall.
  const nearby=[...roots.values()].flat().filter(b=>b.min.y-radius<=current.y&&b.max.y+radius>=current.y).sort((a,b)=>a.distanceToPoint(current)-b.distanceToPoint(current)).slice(0,8);
  const nodes=[current.clone(),goal];
  for(const b of nearby)for(const x of [b.min.x-radius-1,b.max.x+radius+1])for(const z of [b.min.z-radius-1,b.max.z+radius+1]){const p=new THREE.Vector3(x,current.y,z);if(free(p,radius))nodes.push(p);}
  const distances=nodes.map(()=>Infinity),parents=nodes.map(()=>-1),visited=new Set();distances[0]=0;
  for(let step=0;step<nodes.length;step++){
   let index=-1;for(let i=0;i<nodes.length;i++)if(!visited.has(i)&&(index<0||distances[i]<distances[index]))index=i;
   if(index<0||!Number.isFinite(distances[index]))break;
   if(index===1){let next=1;while(parents[next]>0)next=parents[next];return nodes[next].clone();}
   visited.add(index);
   for(let j=1;j<nodes.length;j++){if(visited.has(j))continue;const d=distances[index]+nodes[index].distanceTo(nodes[j]);if(d<distances[j]&&clearLine(nodes[index],nodes[j],radius)){distances[j]=d;parents[j]=index;}}
  }
  return null;
 }
 return {resolve,place,clearLine,visiblePosition,sightWaypoint};
}
