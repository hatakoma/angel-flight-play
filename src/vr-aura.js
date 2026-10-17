import * as THREE from '../vendor/three.module.js';
// Shared soft cloud texture: normal blending keeps red mist visible against white clouds.
export function createMistTexture(){
 const size=64,data=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=(x+.5)/size*2-1,v=(y+.5)/size*2-1,r=Math.hypot(u,v);
  const noise=.72+.13*Math.sin(u*13+Math.sin(v*9))+.12*Math.cos(v*17-u*8);
  const a=Math.pow(Math.max(0,1-r*r),2)*noise,i=(y*size+x)*4;
  data[i]=data[i+1]=data[i+2]=255;data[i+3]=Math.round(a*255);
 }
 const texture=new THREE.DataTexture(data,size,size);texture.needsUpdate=true;return texture;
}
export function createChargeMist(texture){
 const group=new THREE.Group();group.name='vr-charge-aura';
 for(let i=0;i<8;i++){
  const material=new THREE.SpriteMaterial({map:texture,color:i%3===0?0xff314e:0xad082b,transparent:true,opacity:0,depthWrite:false,toneMapped:false});
  const puff=new THREE.Sprite(material);puff.name='vr-charge-mist';group.add(puff);
 }
 return {group,update(time,radius){
  group.scale.setScalar(radius*.5);
  group.children.forEach((puff,i)=>{
   const age=(time*(.48+i*.017)+i*.137)%1,angle=i*2.399+time*.45;
   const spread=.25+age*.65,wobble=Math.sin(time*2.1+i)*.13;
   puff.position.set(Math.cos(angle)*spread+wobble,-.75+age*2.5,Math.sin(angle)*spread);
   const size=.75+age*.95;puff.scale.set(size,size*(1.2+age*.4),1);
   puff.material.rotation=Math.sin(time*.7+i)*.35;
   puff.material.opacity=Math.sin(age*Math.PI)*(.36+.17*Math.sin(time*7+i*.4));
  });
 },dispose(){for(const puff of group.children)puff.material.dispose();group.removeFromParent();}};
}
