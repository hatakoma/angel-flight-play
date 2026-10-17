import * as THREE from '../vendor/three.module.js';
import {selectGazeTarget} from './vr-comfort.js';
import {createMistTexture,createChargeMist} from './vr-aura.js';
import {guidanceEmphasis} from './hud-projection.js';

export function createVRCombatSignals(scene,view){
 const world=new THREE.Group(),directions=new THREE.Group();world.name='vr-combat-signals';directions.name='vr-direction-signals';scene.add(world);view.add(directions);world.visible=directions.visible=false;
 const mistTexture=createMistTexture();
 const chevron=new THREE.Shape();chevron.moveTo(-.09,.11);chevron.lineTo(-.035,.14);chevron.lineTo(.105,0);chevron.lineTo(-.035,-.14);chevron.lineTo(-.09,-.11);chevron.lineTo(.02,0);chevron.closePath();
 const arrowGeometry=new THREE.ExtrudeGeometry(chevron,{depth:.035,bevelEnabled:false});
 const records=new Map(),position=new THREE.Vector3(),local=new THREE.Vector3(),inverse=new THREE.Quaternion();
 const chainGeometry=new THREE.TorusGeometry(.105,.022,5,12);
 const grayMaterial=new THREE.MeshBasicMaterial({color:'#858991',transparent:true,opacity:.75,depthWrite:false,toneMapped:false});
 const whiteMaterial=new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.95,depthWrite:false,toneMapped:false});
 function makeChains(name,rings,material){
  const mesh=new THREE.InstancedMesh(chainGeometry,material,rings*32);mesh.name=name;mesh.frustumCulled=false;mesh.visible=false;world.add(mesh);
  const transform=new THREE.Object3D(),rotation=new THREE.Quaternion(),linkRotation=new THREE.Quaternion();
  for(let ring=0;ring<rings;ring++){
   rotation.setFromEuler(new THREE.Euler(rings===1?Math.PI/2:.25,rings===1?0:ring?-.8:.8,rings===1?0:ring?-.4:.4));
   for(let i=0;i<32;i++){const angle=i/32*Math.PI*2;transform.position.set(Math.cos(angle),Math.sin(angle),0).applyQuaternion(rotation);transform.quaternion.setFromAxisAngle(new THREE.Vector3(0,0,1),angle);linkRotation.setFromAxisAngle(new THREE.Vector3(0,1,0),i%2?Math.PI/2:0);transform.quaternion.multiply(linkRotation).premultiply(rotation);transform.scale.set(1,1.35,1);transform.updateMatrix();mesh.setMatrixAt(ring*32+i,transform.matrix);}
  }
  mesh.instanceMatrix.needsUpdate=true;return mesh;
 }
 const chains=makeChains('vr-lock-chains',1,grayMaterial),gazeChains=makeChains('vr-gaze-chains',2,whiteMaterial);let gazeTarget=null;
 function remove(e){const r=records.get(e);if(!r)return;r.aura.removeFromParent();r.arrow.removeFromParent();r.mist.dispose();r.arrow.material.dispose();records.delete(e);}
 function make(e){
  const mist=createChargeMist(mistTexture),aura=mist.group;world.add(aura);
  const arrow=new THREE.Mesh(arrowGeometry,new THREE.MeshBasicMaterial({color:'#e5ffff',transparent:true,depthTest:false,depthWrite:false,toneMapped:false}));arrow.name='vr-direction-chevron';arrow.renderOrder=9998;directions.add(arrow);
  const r={aura,arrow,mist,since:null};records.set(e,r);return r;
 }
 function hide(){world.visible=directions.visible=false;chains.visible=gazeChains.visible=false;gazeTarget=null;for(const e of [...records.keys()])remove(e);}
 function update(s){
  if(s.state!=='playing'){hide();return;}
  world.visible=directions.visible=true;view.getWorldPosition(position);view.getWorldQuaternion(inverse).invert();
  const alive=new Set(s.enemies.filter(e=>e.hp>0));for(const e of records.keys())if(!alive.has(e))remove(e);
  for(const e of alive){
   const r=records.get(e)||make(e),radius=Math.max(2,e.radius||3.6);e.g.getWorldPosition(local);r.aura.position.copy(local);
   r.aura.visible=e.charge>0;
   if(r.aura.visible)r.mist.update(s.elapsed,radius);
   local.sub(position).applyQuaternion(inverse);const behind=local.z>=0,offscreen=behind||Math.abs(local.x/-local.z)>.58||Math.abs(local.y/-local.z)>.42;r.arrow.visible=offscreen;
   if(offscreen){r.since??=s.elapsed;const angle=behind?(local.x<0?Math.PI:0):Math.atan2(local.y,local.x),emphasis=guidanceEmphasis(s.elapsed-Math.max(s.lastHit||0,r.since));r.arrow.position.set(Math.cos(angle)*.94,Math.sin(angle)*.94,-2);r.arrow.rotation.z=angle;r.arrow.scale.setScalar(.55*emphasis.scale);r.arrow.material.opacity=emphasis.opacity;r.arrow.material.color.set(e.type==='captain'||e.type==='boss'?'#c18aff':e===s.target?'#ffffff':'#a8e8ed');}
   else r.since=null;
  }
  gazeTarget=selectGazeTarget([...alive],view,gazeTarget);
  chains.visible=alive.has(s.target);
  if(chains.visible){s.target.g.getWorldPosition(chains.position);chains.scale.setScalar(Math.max(2.8,(s.target.radius||3.6)*1.05));chains.rotation.set(0,0,0);}
  gazeChains.visible=!!gazeTarget;if(gazeTarget){gazeTarget.g.getWorldPosition(gazeChains.position);gazeChains.scale.setScalar(Math.max(3.6,(gazeTarget.radius||3.6)*1.4));}
 }
 return {update,hide,get gazeTarget(){return gazeTarget;},dispose(){hide();world.removeFromParent();directions.removeFromParent();for(const geometry of [arrowGeometry,chainGeometry])geometry.dispose();chains.dispose();gazeChains.dispose();grayMaterial.dispose();whiteMaterial.dispose();mistTexture.dispose();}};
}
