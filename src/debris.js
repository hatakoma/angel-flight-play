import * as THREE from '../vendor/three.module.js';
import { GLTFLoader } from '../vendor/GLTFLoader.js';

export async function loadDebris(scene,gradient){
 const gltf=await new GLTFLoader().loadAsync(new URL('../assets/impact-shards.glb',import.meta.url).href);
 const templates=[];gltf.scene.updateMatrixWorld(true);
 gltf.scene.traverse(o=>{if(o.isMesh){const geometry=o.geometry.clone().applyMatrix4(o.matrixWorld);geometry.computeBoundingSphere();templates.push({geometry,color:o.material.color.clone()});}});
 const active=[];
 function remove(index){const p=active[index];scene.remove(p.mesh);p.mesh.material.dispose();active.splice(index,1);}
 function burst(position,boss=false){
  for(let i=0;i<(boss?16:10);i++){
   if(active.length>=128)remove(0);
   const t=templates[i%templates.length],material=new THREE.MeshToonMaterial({color:t.color,gradientMap:gradient,transparent:true,side:THREE.DoubleSide});
   const mesh=new THREE.Mesh(t.geometry,material);mesh.position.copy(position);mesh.rotation.set(Math.random()*6,Math.random()*6,Math.random()*6);mesh.scale.setScalar((boss?1.5:1)*(.65+Math.random()*.9));scene.add(mesh);
   active.push({mesh,age:0,life:.65+Math.random()*.45,v:new THREE.Vector3(Math.random()-.5,Math.random()*.8,Math.random()-.5).normalize().multiplyScalar(12+Math.random()*16),spin:new THREE.Vector3(Math.random()*8,Math.random()*8,Math.random()*8)});
  }
 }
 function update(dt){for(let i=active.length-1;i>=0;i--){const p=active[i];p.age+=dt;p.v.y-=16*dt;p.mesh.position.addScaledVector(p.v,dt);p.mesh.rotation.x+=p.spin.x*dt;p.mesh.rotation.y+=p.spin.y*dt;p.mesh.rotation.z+=p.spin.z*dt;p.mesh.material.opacity=Math.max(0,1-p.age/p.life);if(p.age>=p.life)remove(i);}}
 function clear(){while(active.length)remove(active.length-1);}
 document.getElementById('scene').dataset.debris='blender-four-variants';return {burst,update,clear};
}
