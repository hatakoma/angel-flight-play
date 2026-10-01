import {stage} from './game-data.js';
import * as THREE from '../vendor/three.module.js';
const palettes={
 day:['#8986b2','#aba1c0','#fff2da','#66619d','#fff1cd','#b9adc9',2.7,3.1],
 dusk:['#75435f','#b9817b','#ffd0a0','#513761','#ffae66','#967481',1.9,4.8],
 night:['#080f25','#1a2340','#899de3','#171c37','#9baee8','#27314d',.75,.65],
 dawn:['#b6a1bd','#ecc7b1','#fff1d2','#7778a5','#fff1a3','#d6bdd0',2.6,3.3]
};
export function skyState(bossTime,victoryTime){
 if(victoryTime!==null)return {from:'night',to:'dawn',mix:THREE.MathUtils.smoothstep(victoryTime,0,stage.sky.sunriseSeconds),stage:'SUNRISE'};
 if(bossTime===null)return {from:'day',to:'day',mix:0,stage:'DAY'};
 if(bossTime<stage.sky.sunsetSeconds)return {from:'day',to:'dusk',mix:THREE.MathUtils.smoothstep(bossTime,0,stage.sky.sunsetSeconds),stage:'SUNSET'};
 return {from:'dusk',to:'night',mix:THREE.MathUtils.smoothstep(bossTime,stage.sky.sunsetSeconds,stage.sky.nightSeconds),stage:'NIGHTFALL'};
}
export function createAtmosphere(scene,sun,hemi,floor,clouds){
 const colors=Object.fromEntries(Object.entries(palettes).map(([k,v])=>[k,v.slice(0,6).map(c=>new THREE.Color(c))]));
 const solar=new THREE.Mesh(new THREE.SphereGeometry(1,32,20),new THREE.MeshBasicMaterial({color:'#fff0b0',fog:false,transparent:true,opacity:0}));solar.scale.setScalar(65);scene.add(solar,sun.target);
 solar.material.toneMapped=false;
 const glow=new THREE.Sprite(new THREE.SpriteMaterial({color:'#ffc681',transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false,fog:false}));
 // A radial texture avoids a rectangular glow around the rising sun.
 const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const c=canvas.getContext('2d'),g=c.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'#fff');g.addColorStop(.25,'#fff8');g.addColorStop(1,'#fff0');c.fillStyle=g;c.fillRect(0,0,128,128);glow.material.map=new THREE.CanvasTexture(canvas);glow.scale.set(400,400,1);scene.add(glow);
 let sunriseStart=null;
 // A white-hot core and thin optical rays give the sunset an overexposed sun.
 const raysCanvas=document.createElement('canvas');raysCanvas.width=raysCanvas.height=512;
 const rc=raysCanvas.getContext('2d');rc.translate(256,256);
 for(let i=0;i<8;i++){rc.save();rc.rotate(i*Math.PI/4+.18);const beam=rc.createLinearGradient(0,0,245,0);beam.addColorStop(0,'#fff7dd');beam.addColorStop(.18,'#ffd397b0');beam.addColorStop(1,'#ffa76700');rc.fillStyle=beam;rc.beginPath();rc.moveTo(0,-(i%2?6:11));rc.lineTo(i%2?165:245,0);rc.lineTo(0,i%2?6:11);rc.fill();rc.restore();}
 const rays=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(raysCanvas),color:'#fff0ce',transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false,fog:false}));rays.scale.set(950,950,1);scene.add(rays);
 function update(bossTime,victoryTime,position,heading){
  const current=[scene.background,scene.fog.color,hemi.color,hemi.groundColor,sun.color,floor.material.color];
  if(victoryTime===null)sunriseStart=null;
  else if(!sunriseStart)sunriseStart={colors:current.map(c=>c.clone()),hemi:hemi.intensity,sun:sun.intensity};
  const state=skyState(bossTime,victoryTime),a=sunriseStart?.colors||colors[state.from],b=colors[state.to],t=state.mix,values=palettes[state.from].slice(),next=palettes[state.to];
  if(sunriseStart){values[6]=sunriseStart.hemi;values[7]=sunriseStart.sun;}
  [scene.background,scene.fog.color,hemi.color,hemi.groundColor,sun.color,floor.material.color].forEach((c,i)=>c.copy(a[i]).lerp(b[i],t));
  hemi.intensity=THREE.MathUtils.lerp(values[6],next[6],t);sun.intensity=THREE.MathUtils.lerp(values[7],next[7],t);
  const night=state.to==='night'?t:state.to==='dawn'?1-t:0;
  for(const cloud of clouds)cloud.material.color.copy(scene.fog.color).multiplyScalar(1.1-night*.35);
  solar.visible=glow.visible=rays.visible=bossTime!==null||victoryTime!==null;
  const rise=victoryTime!==null?t:bossTime===null?0:1-Math.min(1,bossTime/30);
  solar.position.copy(position).addScaledVector(heading,1400);solar.position.y=position.y-180+rise*430;
  solar.material.color.set(victoryTime!==null?'#fff6d3':'#fff1cd');solar.material.opacity=rise;
  const glare=Math.sqrt(rise)*(victoryTime!==null?.5:1);
  glow.position.copy(solar.position);glow.scale.set(780,780,1);glow.material.opacity=glare*.85;
  rays.position.copy(solar.position);rays.material.opacity=glare*.72;
  sun.position.copy(solar.position);sun.target.position.copy(position);
  if(bossTime===null&&victoryTime===null)sun.position.set(-300,450,-600);
  return state.stage;
 }
 return {update};
}
