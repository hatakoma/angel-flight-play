import {createLegSway} from './leg-sway.js';
import {bindPoseFrame,rigPose} from './rig-pose.js';
import * as THREE from '../vendor/three.module.js';
import { GLTFLoader } from '../vendor/GLTFLoader.js';

// The downloaded Tripo GLB retains its Mixamo skin and embedded 2K texture.
export async function loadCharacter(player, gradient) {
  const {scene:model} = await new GLTFLoader().loadAsync(new URL('../assets/tenshi-chan-wing-rig.glb',import.meta.url).href);
  model.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(model);
  const center=bounds.getCenter(new THREE.Vector3());
  const scale=4.8/bounds.getSize(new THREE.Vector3()).y;
  model.scale.setScalar(scale);
  model.position.set(-center.x*scale,-center.y*scale,-center.z*scale);
  const facing=new THREE.Group();
  facing.rotation.y=Math.PI;
  facing.add(model);
  const bones=new Map();
  const clothTime={value:0},clothStrength={value:.018};
  model.traverse(o=>{
    if(o.isBone) bones.set(o.name.replace(/^mixamorig:?/,''),{bone:o,rest:o.quaternion.clone()});
    if(o.isMesh){
      const toon=m=>new THREE.MeshToonMaterial({map:m.map,color:m.color,gradientMap:gradient,side:THREE.DoubleSide});
      const old=Array.isArray(o.material)?o.material:[o.material];
      o.material=Array.isArray(o.material)?old.map(toon):toon(old[0]);
      // Only lower dress vertices weighted to the pelvis/thighs receive cloth flutter.
      if(o.isSkinnedMesh){
        const positions=o.geometry.attributes.position,joints=o.geometry.attributes.skinIndex,weights=o.geometry.attributes.skinWeight,mask=new Float32Array(positions.count);
        for(let i=0;i<positions.count;i++){
          const y=positions.getY(i),radius=Math.hypot(positions.getX(i),positions.getZ(i));let dressWeight=0;
          for(let k=0;k<4;k++){const name=o.skeleton.bones[joints.getComponent(i,k)]?.name||'';if(/Hips|UpLeg|Spine/.test(name))dressWeight+=weights.getComponent(i,k);}
          const hem=THREE.MathUtils.smoothstep(y,.27,.33)*(1-THREE.MathUtils.smoothstep(y,.37,.52));
          mask[i]=hem*THREE.MathUtils.smoothstep(radius,.065,.12)*THREE.MathUtils.smoothstep(dressWeight,.55,.95);
        }
        o.geometry.setAttribute('skirtFlutter',new THREE.BufferAttribute(mask,1));
        for(const material of (Array.isArray(o.material)?o.material:[o.material])){
          material.onBeforeCompile=shader=>{shader.uniforms.clothTime=clothTime;shader.uniforms.clothStrength=clothStrength;
            shader.vertexShader='attribute float skirtFlutter; uniform float clothTime; uniform float clothStrength;\n'+shader.vertexShader;
            shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
              float azimuth=atan(position.z,position.x);
              float clothWave=sin(clothTime*4.6+azimuth*3.0)+0.45*sin(clothTime*7.3-azimuth*5.0);
              vec2 radial=normalize(position.xz+vec2(0.0001));
              transformed.xz+=radial*clothWave*clothStrength*skirtFlutter;
              transformed.y+=cos(clothTime*4.6+azimuth*3.0)*clothStrength*skirtFlutter*0.55;`);
          };
          material.customProgramCacheKey=()=> 'angel-skirt-flutter-v1';
        }
      }
      old.forEach(m=>m.dispose());
      o.frustumCulled=false;
    }
  });
  if(!bones.size)throw new Error('The character has no skeleton');
  const modelWorld=model.getWorldQuaternion(new THREE.Quaternion());
  for(const b of bones.values())bindPoseFrame(b,modelWorld);
  for(const side of ['L','R'])for(const part of ['Root','Mid','Tip']){
    // GLTFLoader removes dots from node names for animation binding.
    const b=bones.get(`Wing${part}${side}`)||bones.get(`Wing${part}.${side}`);
    if(!b)throw new Error('Missing wing joint');
    bones.set(`Wing${part}${side}`,b);
    const inverse=b.bone.getWorldQuaternion(new THREE.Quaternion()).invert();
    b.flapAxis=new THREE.Vector3(0,0,1).applyQuaternion(modelWorld).applyQuaternion(inverse);
    b.sweepAxis=new THREE.Vector3(0,1,0).applyQuaternion(modelWorld).applyQuaternion(inverse);
  }
  player.body.children.forEach(o=>o.visible=false);
  player.body.add(facing);
  const delta=new THREE.Quaternion(),euler=new THREE.Euler();
  function pose(name,x,y=0,z=0){const b=bones.get(name);if(b){rigPose(b,x,y,z,b.bone.quaternion);}}
  const legSway=createLegSway();
  let flap=0,vertical=0,attackAge=1,attackPower=1;
  player.attack=(strong=false)=>{
    if(attackAge<.36&&!strong)return;
    attackAge=0;attackPower=strong?1.3:1;
  };
  player.animate=(time,speed,dt,pitch=0,maneuver=null)=>{
    const tuck=maneuver?.tuck||0,open=maneuver?.open||0;
    vertical=THREE.MathUtils.damp(vertical,Math.sin(pitch),4,dt);
    const rise=THREE.MathUtils.clamp(Math.max(0,vertical)/.61,0,1),fall=THREE.MathUtils.clamp(Math.max(0,-vertical)/.61,0,1);
    const boost=THREE.MathUtils.clamp((speed-52)/48,0,1);
    clothTime.value=time;clothStrength.value=THREE.MathUtils.damp(clothStrength.value,.018+boost*.014+rise*.009+tuck*.01,4,dt);
    flap+=dt*(4.5+boost*5+rise*4-fall*1.5);
    attackAge+=dt;
    const strike=attackAge<.5?Math.sin(Math.PI*Math.min(1,attackAge/.5))**2*attackPower:0;
    const sway=Math.sin(time*2.1),flutter=Math.sin(flap);
    facing.position.y=(sway*.22+Math.sin(time*3.7)*.055+flutter*.04*rise)*(1-tuck*.8);
    facing.position.x=Math.sin(time*1.05)*.075;
    facing.rotation.z=Math.sin(time*1.4)*.035;
    // Curl around raised knees for the turn; open the chest on ascent and brace for descent.
    facing.rotation.x=-rise*.16+fall*.16;
    const flight=1-tuck,legs=legSway(model,time,dt,tuck);
    pose('Spine',(.04+sway*.025-rise*.32+fall*.22)*flight+tuck*.48-open*.12);
    pose('Spine1',(-rise*.22+fall*.12)*flight+tuck*.24);
    pose('Head',(-.04-rise*.22-fall*.10)*flight+tuck*.25);
    for(const [name,side] of [['Left',1],['Right',-1]]){
      pose(name+'Arm',(-rise*.28-fall*.45)*flight-tuck*.85,side*tuck*.15,side*((.12+rise*.25+fall*.60+flutter*.035)*flight+tuck*.10-open*.15));
      pose(name+'ForeArm',(-.10-rise*.12-fall*.48)*flight-tuck*1.5);
      const leg=legs[side===1?0:1];
      pose(name+'UpLeg',(rise*.18-fall*.42)*flight+leg.x-tuck*1.55,0,leg.z+side*tuck*.05);
      pose(name+'Leg',(rise*.42+boost*.12+fall*.65)*flight+leg.knee+tuck*2.1);
      pose(name+'Foot',(-.06+rise*.12-fall*.22)*flight+leg.foot-tuck*.30);
    }
    // Three-joint wings: the tips trail the root on each stroke.
    const effort=.24+boost*.13+rise*.18-fall*.07;
    for(const [side,sign] of [['L',1],['R',-1]]){
      const phase=flap+Math.sin(time*.7)*.08*sign;
      for(const [part,lag,base,amplitude] of [['Root',0,.56,effort],['Mid',.65,.12,effort*.65],['Tip',1.25,.04,effort*.75]]){
        const b=bones.get(`Wing${part}${side}`);
        const attack=Math.sin(attackAge*Math.PI*10-lag)*strike*.24;
        const bend=sign*(base+Math.sin(phase-lag)*amplitude*(1-tuck*.75)+attack+tuck*(.55+lag*.2)-open*.22);
        delta.setFromAxisAngle(b.flapAxis,bend);
        b.bone.quaternion.copy(b.rest).multiply(delta);
        // Fore/aft sweep opens the wing on the power stroke and folds its tip on recovery.
        delta.setFromAxisAngle(b.sweepAxis,sign*Math.cos(phase-lag)*(.04+boost*.035+rise*.03));
        b.bone.quaternion.multiply(delta);
      }
    }
  };
  document.getElementById('scene').dataset.character='tenshi-chan-rigged';
  document.getElementById('scene').dataset.bones=String(bones.size);
}
