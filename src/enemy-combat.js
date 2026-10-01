import * as THREE from '../vendor/three.module.js';
import {gameData} from './game-data.js';
export const CHARGE_TIME=new Proxy({}, {get:(_,key)=>gameData.enemies[key]?.chargeTime});
export function updateEnemyCombat(e,dt,distance,emit){
 e.stagger=Math.max(0,(e.stagger||0)-dt);
 if(e.stagger>0){e.charge=0;e.pendingCross=null;e.fighting=0;return;}
 e.fighting=THREE.MathUtils.damp(e.fighting||0,distance<gameData.enemies[e.type].combatRange?1:0,5,dt);
 if(e.pendingCross!==null&&e.pendingCross!==undefined){e.pendingCross-=dt;if(e.pendingCross<=0){emit('horizontal');e.pendingCross=null;}}
 if(e.charge>0){e.charge+=dt;e.chargeRatio=Math.min(1,e.charge/CHARGE_TIME[e.type]);
  if(e.charge>=CHARGE_TIME[e.type]){const shot=e.type==='imp'?'aimed':e.type==='boss'?'vertical':(e.volleyIndex||0)%2?'horizontal':'vertical';emit(shot);e.volleyIndex=(e.volleyIndex||0)+1;if(e.type==='boss')e.pendingCross=gameData.weapons.enemy.crossDelay;e.charge=0;e.chargeRatio=0;e.fire=gameData.enemies[e.type].fireInterval;}
 }else{e.fire-=dt;if(e.fire<=0&&distance<gameData.enemies[e.type].combatRange){e.charge=.001;e.chargeRatio=0;}}
}
export function barrage(origin,player,velocity,pattern){
 const aim=player.clone().addScaledVector(velocity,Math.min(.65,origin.distanceTo(player)/145*.65));
 const direction=aim.sub(origin).normalize(),right=new THREE.Vector3().crossVectors(direction,new THREE.Vector3(0,1,0)).normalize();if(right.lengthSq()<.1)right.set(1,0,0);
 const vertical=new THREE.Vector3().crossVectors(right,direction).normalize();
 const axis=pattern==='horizontal'?right:vertical,count=pattern==='aimed'?1:gameData.weapons.enemy.count;
 return Array.from({length:count},(_,i)=>({position:origin.clone().addScaledVector(axis,(i-(count-1)/2)*gameData.weapons.enemy.spacing),velocity:direction.clone().multiplyScalar(pattern==='aimed'?gameData.weapons.enemy.aimedSpeed:gameData.weapons.enemy.barrageSpeed)}));
}
