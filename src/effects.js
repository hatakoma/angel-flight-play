import * as THREE from '../vendor/three.module.js';

export async function loadEffects(scene,player){
 const loader=new THREE.TextureLoader(),maps={};
 await Promise.all(['halo','lumen','trail','demon'].map(async name=>{maps[name]=await loader.loadAsync(new URL(`../assets/fx/${name}.jpg`,import.meta.url).href);maps[name].colorSpace=THREE.SRGBColorSpace;}));
 const base=Object.fromEntries(Object.entries(maps).map(([name,map])=>[name,new THREE.SpriteMaterial({map,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false,opacity:.8})]));
 const pool=[],shockwaves=[];
 const rush=new THREE.Group();player.g.add(rush);rush.visible=false;
 for(let i=0;i<5;i++){const ring=new THREE.Mesh(new THREE.TorusGeometry(2.6+i*.55,.075,6,48),new THREE.MeshBasicMaterial({color:i%2?'#ffe8a4':'#ffbf48',transparent:true,opacity:.7,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));ring.position.z=2+i*2;ring.rotation.y=i*.15;rush.add(ring);}
 const cone=new THREE.Mesh(new THREE.ConeGeometry(3.8,15,12,1,true),new THREE.MeshBasicMaterial({color:'#fbc768',transparent:true,opacity:.18,side:THREE.DoubleSide,depthWrite:false,blending:THREE.NormalBlending}));cone.rotation.x=-Math.PI/2;cone.position.z=-3;rush.add(cone);
 function impact(position){for(let i=0;i<3;i++){const o=new THREE.Mesh(new THREE.TorusGeometry(1,.04,6,48),new THREE.MeshBasicMaterial({color:i===1?'#573050':'#ffcf71',transparent:true,opacity:.8,depthWrite:false,blending:THREE.NormalBlending}));o.position.copy(position);o.rotation.set(i*.9,i*.7,0);scene.add(o);shockwaves.push({o,age:0});}while(shockwaves.length>30){const p=shockwaves.shift();p.o.removeFromParent();p.o.geometry.dispose();p.o.material.dispose();}}

 function sprite(name,size,parent=scene){const o=new THREE.Sprite(base[name].clone());o.scale.setScalar(size);parent.add(o);return o;}
 const haloGeometry=new THREE.PlaneGeometry(2.5,2.5),halo=new THREE.Mesh(haloGeometry,new THREE.MeshBasicMaterial({map:maps.halo,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,opacity:.8}));halo.rotation.x=-Math.PI/2;halo.position.y=2.7;player.g.add(halo);
 function burst(position,kind='lumen',size=12,life=.5){if(pool.length>=96){const old=pool.shift();old.sprite.removeFromParent();old.sprite.material.dispose();}const o=sprite(kind,size);o.position.copy(position);pool.push({sprite:o,age:0,life,size});}
 function attach(projectile,kind){
  if(kind==='trail'){
   const geometry=new THREE.PlaneGeometry(5,20);geometry.rotateX(Math.PI/2);
   projectile.userData.effectSprites=[];projectile.userData.effectGeometry=geometry;
   projectile.userData.solidGeometry=[];
   for(const [radius,length,color] of [[.66,9,'#543454'],[.38,11,'#fff0b0']]){const geo=new THREE.ConeGeometry(radius,length,8);geo.rotateX(Math.PI/2);const core=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color,blending:THREE.NormalBlending,depthWrite:true}));core.scale.set(1/projectile.scale.x,1/projectile.scale.y,1/projectile.scale.z);projectile.add(core);projectile.userData.effectSprites.push(core);projectile.userData.solidGeometry.push(geo);}

   for(let i=0;i<2;i++){const material=new THREE.MeshBasicMaterial({map:maps.trail,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,opacity:1});const plane=new THREE.Mesh(geometry,material);plane.rotation.z=i*Math.PI/2;plane.position.z=-2;projectile.add(plane);projectile.userData.effectSprites.push(plane);}return;
  }
  const size=kind==='trail'?8:kind==='demon'?7:3;const o=sprite(kind,size,projectile);o.scale.divide(projectile.scale);if(kind==='trail')o.scale.x*=.4;
  projectile.userData.effectSprites??=[];projectile.userData.effectSprites.push(o);
 }
 function release(projectile){for(const g of projectile.userData.solidGeometry||[])g.dispose();projectile.userData.solidGeometry=[];for(const o of projectile.userData.effectSprites||[])o.material.dispose();projectile.userData.effectSprites=[];projectile.userData.effectGeometry?.dispose();delete projectile.userData.effectGeometry;}
 function clear(){rush.visible=false;for(const p of shockwaves){p.o.removeFromParent();p.o.geometry.dispose();p.o.material.dispose();}shockwaves.length=0;for(const p of pool){p.sprite.removeFromParent();p.sprite.material.dispose();}pool.length=0;}
 let trailTime=0;
 function update(time,dt,dashing,rushing=false){rush.visible=rushing;rush.rotation.z=time*4;for(let i=0;i<5;i++){rush.children[i].scale.setScalar(1+Math.sin(time*18-i)*.14);}for(let i=shockwaves.length-1;i>=0;i--){const p=shockwaves[i];p.age+=dt;p.o.scale.setScalar(3+p.age*45);p.o.material.opacity=Math.max(0,.8-p.age);if(p.age>=.8){p.o.removeFromParent();p.o.geometry.dispose();p.o.material.dispose();shockwaves.splice(i,1);}}halo.position.set(0,2.7,0).applyQuaternion(player.body.quaternion).add(player.body.position);halo.quaternion.copy(player.body.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2)).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),time*.3));halo.material.opacity=.65+Math.sin(time*2)*.15;
  trailTime-=dt;if(dashing&&trailTime<=0){trailTime=.045;burst(player.g.position,'trail',rushing?20:7,rushing?.65:.4);if(rushing)burst(player.g.position,'halo',14,.45);}
  for(let i=pool.length-1;i>=0;i--){const p=pool[i];p.age+=dt;const t=p.age/p.life;p.sprite.scale.setScalar(p.size*(.45+t));p.sprite.material.opacity=Math.max(0,(1-t)*.85);p.sprite.material.rotation+=dt*.4;if(t>=1){p.sprite.removeFromParent();p.sprite.material.dispose();pool.splice(i,1);}}
 }
 document.getElementById('scene').dataset.effects='niji-additive';return {burst,impact,attach,release,clear,update};
}


