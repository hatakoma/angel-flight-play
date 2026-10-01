import {gameData,stage} from './game-data.js';
export let WAVE_COUNT,TOTAL_TARGETS,TYPES,MINIONS_PER_WAVE;
export function refreshEncounter(){TYPES=gameData.enemies;WAVE_COUNT=stage.waves.length;TOTAL_TARGETS=stage.waves.reduce((n,id)=>n+gameData.formations.find(f=>f.id===id).slots.length,1);MINIONS_PER_WAVE=gameData.formations[0].slots.filter(s=>s.enemyId==='imp').length;}
refreshEncounter();
export function formation(wave){return gameData.formations.find(f=>f.id===stage.waves[wave-1]).slots.map((s,slot)=>({type:s.enemyId,slot,x:s.x,y:s.y,z:s.z}));}
// Sweeping figure-eight, dives and lateral rushes, with aimable recovery periods.
export function bossOffset(t){
  const phase=t%12;
  if(phase<3)return {x:Math.sin(t*.65)*50,y:25+Math.cos(t*.6)*18,z:250+Math.sin(t*.5)*15,mode:'横薙ぎ',attack:3};
  if(phase<6)return {x:Math.sin(t*.5)*35,y:45-Math.sin((phase-3)/3*Math.PI)*55,z:240,mode:'急降下',attack:5};
  if(phase<9)return {x:Math.sin(t*.55)*60,y:20+Math.sin(t*.5)*22,z:265,mode:'旋回',attack:3};
  return {x:Math.sin(t*.3)*20,y:15+Math.sin(t*.5)*8,z:255,mode:'魔力収束',attack:7};
}

