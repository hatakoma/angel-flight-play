import * as THREE from '../vendor/three.module.js';
const ease=t=>{t=THREE.MathUtils.clamp(t,0,1);return t*t*(3-2*t);};
export function turnMotion(progress){
 const t=THREE.MathUtils.clamp(progress,0,1),loop=ease(t/.76),roll=ease((t-.58)/.42);
 return {progress:t,angle:Math.PI*loop,roll:Math.PI*roll,tuck:Math.sin(Math.PI*ease(t/.88))**2,open:Math.sin(Math.PI*ease((t-.7)/.3)),cameraTurn:Math.PI*ease(t)};
}
export function bossMotion(time,attack=0,damage=0){
 const phase=((time%12)+12)%12;
 const inversion=phase>=3&&phase<6?Math.sin(Math.PI*ease((phase-3)/3))**2:0;
 const bank=phase<3?Math.sin(time*.65)*.8:phase<9&&phase>=6?Math.sin(time*.55)*1.05:0;
 return {bank,roll:bank+inversion*Math.PI,yaw:phase>=6&&phase<9?Math.sin((phase-6)/3*Math.PI)*.75:0,
  lean:.12+inversion*.35-attack*.32+damage*.6,tuck:inversion*.8,attack,damage,
  label:damage>.1?'被弾':attack>.1?'攻撃':inversion>.5?'逆さま':Math.abs(bank)>.4?'横向き':'移動'};
}
