import {gameData} from './game-data.js';
import * as THREE from '../vendor/three.module.js';

export function createNattoMagazine(){
 let ammo=gameData.weapons.natto.capacity,cooldown=0,serial=0;
 return {get ammo(){return ammo;},reset(){ammo=gameData.weapons.natto.capacity;cooldown=0;serial=0;},
  update(dt,held){cooldown=Math.max(0,cooldown-dt);if(!held){ammo=Math.min(gameData.weapons.natto.capacity,ammo+dt*gameData.weapons.natto.capacity/gameData.weapons.natto.rechargeSeconds);return null;}
   if(ammo<1||cooldown>0)return null;ammo-=1;cooldown=gameData.weapons.natto.cooldown;return serial++;
  }};
}
const noise=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
export function createNattoFlight(id,origin,forward,enemies){
 const nearby=enemies.filter(e=>e.hp>0&&e.g.position.distanceTo(origin)<600).sort((a,b)=>a.g.position.distanceToSquared(origin)-b.g.position.distanceToSquared(origin));
 const right=new THREE.Vector3().crossVectors(forward,new THREE.Vector3(0,1,0)).normalize();if(right.lengthSq()<.1)right.set(1,0,0);
 const vertical=new THREE.Vector3().crossVectors(right,forward).normalize(),phase=noise(id+1)*Math.PI*2;
 const scatter=forward.clone().multiplyScalar(.4).addScaledVector(right,Math.cos(phase)*1.4).addScaledVector(vertical,Math.sin(phase)*1.1+.4).normalize();
 return {age:0,cutoff:gameData.weapons.natto.homingSeconds+noise(id+2)*gameData.weapons.natto.homingVariance,scatterTime:.22+noise(id+3)*.28,phase,frequency:5+noise(id+4)*6,
  amplitude:9+noise(id+5)*17,speed:gameData.weapons.natto.speedMin+noise(id+6)*(gameData.weapons.natto.speedMax-gameData.weapons.natto.speedMin),right,vertical,scatter,target:nearby[id%nearby.length]||null,
  v:scatter.clone().multiplyScalar(145),coasting:false};
}
export function steerNatto(f,position,dt){
 f.age+=dt;if(f.coasting)return;
 if(f.age>=f.cutoff||(f.age>=f.scatterTime&&(!f.target||f.target.hp<=0))){f.coasting=true;f.target=null;return;}
 let desired=f.scatter.clone();
 if(f.age>=f.scatterTime){
  const fade=Math.max(0,1-(f.age-f.scatterTime)/(f.cutoff-f.scatterTime));
  desired.copy(f.target.g.position).addScaledVector(f.right,Math.sin(f.phase+f.age*f.frequency)*f.amplitude*fade)
   .addScaledVector(f.vertical,Math.cos(f.phase+f.age*f.frequency*.73)*f.amplitude*.8*fade).sub(position).normalize();
 }
 f.v.lerp(desired.multiplyScalar(f.speed),1-Math.exp(-dt*(f.age<f.scatterTime?3:4.2))).normalize().multiplyScalar(f.speed);
}

// Dedicated gold additive plume, independent of the holy spear's effect.
export function createNattoVisuals(scene){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const c=canvas.getContext('2d');
 const gradient=c.createRadialGradient(32,32,0,32,32,32);gradient.addColorStop(0,'#fff7bf');gradient.addColorStop(.14,'#ffd550');gradient.addColorStop(.45,'rgba(255,155,12,.45)');gradient.addColorStop(1,'rgba(255,100,0,0)');c.fillStyle=gradient;c.fillRect(0,0,64,64);
 const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
 const coreMaterial=new THREE.SpriteMaterial({map,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true,toneMapped:false});
 const vaporCanvas=document.createElement('canvas');vaporCanvas.width=64;vaporCanvas.height=128;const vc=vaporCanvas.getContext('2d');
 const across=vc.createLinearGradient(0,0,64,0);across.addColorStop(0,'rgba(255,248,225,0)');across.addColorStop(.5,'rgba(255,248,225,1)');across.addColorStop(1,'rgba(255,248,225,0)');vc.fillStyle=across;vc.fillRect(0,0,64,128);
 vc.globalCompositeOperation='destination-in';const along=vc.createLinearGradient(0,0,0,128);along.addColorStop(0,'rgba(255,255,255,0)');along.addColorStop(.15,'white');along.addColorStop(.55,'rgba(255,255,255,.6)');along.addColorStop(1,'rgba(255,255,255,0)');vc.fillStyle=along;vc.fillRect(0,0,64,128);
 const vaporMap=new THREE.CanvasTexture(vaporCanvas);vaporMap.colorSpace=THREE.SRGBColorSpace;
 function create(position){
  const g=new THREE.Group(),core=new THREE.Sprite(coreMaterial);core.scale.setScalar(2.6);g.add(core);g.position.copy(position);scene.add(g);
  const blur=Array.from({length:4},(_,i)=>{const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map,blending:THREE.AdditiveBlending,transparent:true,opacity:.16/(1+i*.6),depthWrite:false,toneMapped:false}));sprite.scale.setScalar(4.8+i*.7);sprite.position.copy(position);scene.add(sprite);return sprite;});
  const previous=position.clone();
  const puff=new THREE.Sprite(new THREE.SpriteMaterial({map:vaporMap,transparent:true,opacity:.25,depthWrite:false,blending:THREE.NormalBlending}));puff.position.copy(position);puff.scale.setScalar(3);scene.add(puff);
  const points=Array.from({length:28},()=>position.clone()),array=new Float32Array(27*18),uv=new Float32Array(27*12);
  for(let i=0;i<27;i++){const a=i/27,b=(i+1)/27;uv.set([0,a,1,a,0,b,1,a,1,b,0,b],i*12);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(array,3));geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));
  const material=new THREE.MeshBasicMaterial({map:vaporMap,blending:THREE.NormalBlending,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
  const trail=new THREE.Mesh(geometry,material);trail.frustumCulled=false;scene.add(trail);let clock=0,age=0;
  return {g,update(dt){blur.forEach((sprite,i)=>sprite.position.lerpVectors(g.position,previous,(i+1)/4));previous.lerp(g.position,1-Math.exp(-dt*32));age+=dt;clock+=dt;puff.scale.setScalar(3+Math.min(age,.4)*12);puff.material.opacity=Math.max(0,.25*(1-age/.4));if(age>.4)puff.removeFromParent();
   // Do not anchor a bright ribbon at the launch point beside the camera.
   if(age<.16){points.forEach(p=>p.copy(g.position));return;}material.opacity=Math.min(.68,(age-.16)*1.8);
   if(clock>=.035){clock=0;points.pop();points.unshift(g.position.clone());}points[0].copy(g.position);
   for(let i=0;i<27;i++){const a=points[i],b=points[i+1],side=b.clone().sub(a).cross(new THREE.Vector3(0,1,0)).normalize().multiplyScalar(1.1+i*.085);
    const vertices=[a.clone().add(side),a.clone().sub(side),b.clone().add(side),a.clone().sub(side),b.clone().sub(side),b.clone().add(side)];vertices.forEach((v,j)=>v.toArray(array,i*18+j*3));}
   geometry.attributes.position.needsUpdate=true;
  },dispose(){blur.forEach(sprite=>{sprite.removeFromParent();sprite.material.dispose();});g.removeFromParent();puff.removeFromParent();puff.material.dispose();trail.removeFromParent();geometry.dispose();material.dispose();}};
 }
 return {create};
}

// Boss armor scatters homing missiles; spent missiles coast harmlessly away.
export function deflectNatto(projectile,enemy,previous){
 if(!projectile.natto||projectile.deflected||enemy.type!=='boss'||enemy.hp<=0)return false;
 const normal=previous.clone().sub(enemy.g.position);
 if(normal.lengthSq()<.00001)normal.copy(projectile.v).negate();
 if(normal.lengthSq()<.00001)normal.set(0,1,0);normal.normalize();
 const speed=Math.max(120,projectile.v.length());projectile.v.reflect(normal);
 if(projectile.v.dot(normal)<=0)projectile.v.copy(normal).multiplyScalar(speed);
 projectile.v.addScaledVector(normal,speed*.35).normalize().multiplyScalar(speed);
 projectile.g.position.copy(enemy.g.position).addScaledVector(normal,enemy.radius+.8);
 projectile.natto.coasting=true;projectile.natto.target=null;projectile.natto.v.copy(projectile.v);
 projectile.target=null;projectile.damage=0;projectile.deflected=true;projectile.life=Math.min(projectile.life,1.2);
 return true;
}
