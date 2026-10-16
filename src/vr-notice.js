// VR remains unobstructed until an actionable warning or a menu is needed.
export function createVRNotice(){
 let previousHp=null,damageUntil=-1;
 return function notice(s,{rear=0}={}){
  const hp=Math.ceil(s.hp),time=Math.max(0,Math.ceil(s.time));
  if(s.state!=='playing'){previousHp=null;damageUntil=-1;
   if(s.state==='loading')return ['準備中…',''];
   if(s.state==='paused')return ['一時停止','A / X：再開　 Y：VR終了'];
   if(s.state==='result')return [s.result||'フライト終了','A：もう一度　 Y：VR終了'];
   if(s.state==='victory')return ['大悪魔 撃破',''];
   return ['A：出撃する','Y：VR終了'];
  }
  if(previousHp!==null&&s.hp<previousHp)damageUntil=s.elapsed+2.5;
  previousHp=s.hp;
  if(s.hp/Math.max(1,s.maxHp)<=.3)return [`体力低下　HP ${hp}`,'右スティック：緊急回避'];
  if(time<=20)return [`残り ${time} 秒`,''];
  if(s.elapsed<damageUntil)return [`被弾　HP ${hp}`,''];
  if(rear>0&&s.elapsed-s.lastHit>=6&&!s.maneuver?.turning)return ['後方に敵','B：ターン'];
  return null;
 };
}
