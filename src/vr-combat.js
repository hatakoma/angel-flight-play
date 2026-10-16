import * as THREE from '../vendor/three.module.js';
import {guidanceEmphasis} from './hud-projection.js';

export function createVRCombatSignals(scene,view){
 const world=new THREE.Group(),directions=new THREE.Group();world.name='vr-combat-signals';directions.name='vr-direction-signals';scene.add(world);view.add(directions);world.visible=directions.visible=false;
 const ringGeometry=new THREE.TorusGeometry(1,.035,5,32),shellGeometry=new THREE.SphereGeometry(1,12,8);
 const chevron=new THREE.Shape();chevron.moveTo(-.09,.11);chevron.lineTo(-.035,.14);chevron.lineTo(.105,0);chevron.lineTo(-.035,-.14);chevron.lineTo(-.09,-.11);chevron.lineTo(.02,0);chevron.closePath();
 const arrowGeometry=new THREE.ExtrudeGeometry(chevron,{depth:.035,bevelEnabled:false});
 const records=new Map(),position=new THREE.Vector3(),local=new THREE.Vector3(),inverse=new THREE.Quaternion();
 const chainGeometry=new THREE.TorusGeometry(.105,.022,5,12),chainMaterial=new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.9,depthWrite:false,toneMapped:false});
 const chains=new THREE.InstancedMesh(chainGeometry,chainMaterial,64);chains.name='vr-lock-chains';chains.frustumCulled=false;chains.visible=false;world.add(chains);
 const transform=new THREE.Object3D(),ringRotation=new THREE.Quaternion(),linkRotation=new THREE.Quaternion(),axis=new THREE.Vector3(0,1,0);
 for(let ring=0;ring<2;ring++){
  ringRotation.setFromEuler(new THREE.Euler(.25,ring?-.8:.8,ring?-.4:.4));
  for(let i=0;i<32;i++){const angle=i/32*Math.PI*2;transform.position.set(Math.cos(angle),Math.sin(angle),0).applyQuaternion(ringRotation);
   transform.quaternion.setFromAxisAngle(new THREE.Vector3(0,0,1),angle);linkRotation.setFromAxisAngle(axis,i%2?Math.PI/2:0);transform.quaternion.multiply(linkRotation).premultiply(ringRotation);transform.scale.set(1,1.35,1);transform.updateMatrix();chains.setMatrixAt(ring*32+i,transform.matrix);
  }
 }
 chains.instanceMatrix.needsUpdate=true;
 function remove(e){const r=records.get(e);if(!r)return;r.aura.removeFromParent();r.arrow.removeFromParent();r.red.dispose();r.shell.dispose();r.arrow.material.dispose();records.delete(e);}
 function make(e){
  const aura=new THREE.Group();aura.name='vr-charge-aura';world.add(aura);
  const red=new THREE.MeshBasicMaterial({color:'#ff1838',transparent:true,opacity:.45,depthWrite:false,toneMapped:false});
  const shell=new THREE.MeshBasicMaterial({color:'#ff1230',transparent:true,opacity:.08,depthWrite:false,side:THREE.BackSide,toneMapped:false});aura.add(new THREE.Mesh(shellGeometry,shell));
  for(let i=0;i<3;i++){const ring=new THREE.Mesh(ringGeometry,red);ring.rotation.set(i*.85,i*.7,0);aura.add(ring);}
  const arrow=new THREE.Mesh(arrowGeometry,new THREE.MeshBasicMaterial({color:'#e5ffff',transparent:true,depthTest:false,depthWrite:false,toneMapped:false}));arrow.name='vr-direction-chevron';arrow.renderOrder=9998;directions.add(arrow);
  const r={aura,arrow,red,shell,since:null};records.set(e,r);return r;
 }
 function hide(){world.visible=directions.visible=false;chains.visible=false;for(const e of [...records.keys()])remove(e);}
 function update(s){
  if(s.state!=='playing'){hide();return;}
  world.visible=directions.visible=true;view.getWorldPosition(position);view.getWorldQuaternion(inverse).invert();
  const alive=new Set(s.enemies.filter(e=>e.hp>0));for(const e of records.keys())if(!alive.has(e))remove(e);
  for(const e of alive){
   const r=records.get(e)||make(e),radius=Math.max(2,e.radius||3.6);e.g.getWorldPosition(local);r.aura.position.copy(local);
   r.aura.visible=e.charge>0;
   if(r.aura.visible){const pulse=.5+.5*Math.sin(s.elapsed*Math.PI*3);r.red.opacity=.15+pulse*.55;r.shell.opacity=.025+pulse*.11;r.aura.scale.setScalar(radius*(1.15+.12*pulse));r.aura.rotation.y=s.elapsed*.6;}
   local.sub(position).applyQuaternion(inverse);const behind=local.z>=0,offscreen=behind||Math.abs(local.x/-local.z)>.58||Math.abs(local.y/-local.z)>.42;r.arrow.visible=offscreen;
   if(offscreen){r.since??=s.elapsed;const angle=behind?(local.x<0?Math.PI:0):Math.atan2(local.y,local.x),emphasis=guidanceEmphasis(s.elapsed-Math.max(s.lastHit||0,r.since));r.arrow.position.set(Math.cos(angle)*.94,Math.sin(angle)*.94,-2);r.arrow.rotation.z=angle;r.arrow.scale.setScalar(.55*emphasis.scale);r.arrow.material.opacity=emphasis.opacity;r.arrow.material.color.set(e===s.target?'#ffffff':'#a8e8ed');}
   else r.since=null;
  }
  chains.visible=alive.has(s.target);
  if(chains.visible){s.target.g.getWorldPosition(chains.position);chains.scale.setScalar(Math.max(2.8,(s.target.radius||3.6)*1.05));chains.rotation.set(0,s.elapsed*.12,0);}
 }
 return {update,hide,dispose(){hide();world.removeFromParent();directions.removeFromParent();for(const geometry of [ringGeometry,shellGeometry,arrowGeometry,chainGeometry])geometry.dispose();chainMaterial.dispose();}};
}
