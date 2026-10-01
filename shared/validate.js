export function validateData(d){
 const errors=[];
 const err=(p,m)=>errors.push(`${p}: ${m}`);
 const obj=(v,p)=>{if(!v||typeof v!=='object'||Array.isArray(v)){err(p,'オブジェクトが必要です');return {}; }return v;};
 const str=(v,p,max=80)=>{if(typeof v!=='string'||!v.trim()||v.length>max)err(p,`1〜${max}文字で入力してください`);};
 const num=(v,p,min,max,int=false)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max||(int&&!Number.isInteger(v)))err(p,`${min}〜${max}${int?'の整数':''}が必要です`);};
 const id=(v,p)=>{if(typeof v!=='string'||!/^[a-z][a-z0-9_-]{0,39}$/.test(v))err(p,'半角小文字で始まる40文字以内のIDが必要です');};
 const fields=(v,p,spec)=>{v=obj(v,p);for(const [k,b] of Object.entries(spec))num(v[k],`${p}.${k}`,...b);};
 const list=(v,p,max)=>{if(!Array.isArray(v)||v.length<1||v.length>max){err(p,`1〜${max}件が必要です`);return [];}return v;};
 d=obj(d,'data');if(d.schemaVersion!==1)err('schemaVersion','対応する版は1です');
 fields(d.player,'player',{maxHp:[1,10000],hitDamage:[.1,1000],speed:[1,150],boostSpeed:[1,300],turnRate:[.1,5],pitchRate:[.1,3],maxPitch:[.1,1.2],invulnerability:[0,5],barrierHits:[1,20,true],barrierDuration:[.1,30],autoLoopHold:[.5,10]});str(d.player?.label,'player.label');
 const enemies=obj(d.enemies,'enemies');for(const name of ['imp','captain','boss']){const p=`enemies.${name}`;fields(enemies[name],p,{hp:[.1,100000],height:[1,40],radius:[.2,30],chargeTime:[.2,20],fireInterval:[.2,60],combatRange:[50,650],chaseSpeed:[0,120],retreatSpeed:[0,120],strafeSpeed:[0,80]});str(enemies[name]?.label,p+'.label');}
 const w=obj(d.weapons,'weapons');for(const name of ['gun','spear']){fields(w[name],`weapons.${name}`,{damage:[.01,10000],cooldown:[.05,30],speed:[10,1000],lifetime:[.1,10]});str(w[name]?.label,`weapons.${name}.label`);}
 fields(w.natto,'weapons.natto',{damage:[.01,10000],capacity:[1,60,true],rechargeSeconds:[.1,20],cooldown:[.05,5],lifetime:[.5,10],speedMin:[10,500],speedMax:[10,700],homingSeconds:[.1,8],homingVariance:[0,2]});if(w.natto?.speedMin>w.natto?.speedMax)err('weapons.natto.speedMax','最低速度以上にしてください');
 fields(w.enemy,'weapons.enemy',{aimedSpeed:[10,500],barrageSpeed:[10,500],count:[1,31,true],spacing:[1,30],crossDelay:[.1,5]});for(const name of ['natto','enemy'])str(w[name]?.label,`weapons.${name}.label`);
 const formations=list(d.formations,'formations',50),ids=new Set();formations.forEach((f,i)=>{f=obj(f,`formations[${i}]`);id(f.id,`formations[${i}].id`);if(ids.has(f.id))err('formations','IDが重複しています');ids.add(f.id);str(f.label,`formations[${i}].label`);list(f.slots,`formations[${i}].slots`,40).forEach((v,j)=>{const p=`formations[${i}].slots[${j}]`;v=obj(v,p);if(!['imp','captain'].includes(v.enemyId))err(p+'.enemyId','imp / captainから選択してください');fields(v,p,{x:[-300,300],y:[-150,150],z:[-200,300]});});});
 const stages=list(d.stages,'stages',20),stageIds=new Set();stages.forEach((s,i)=>{const p=`stages[${i}]`;s=obj(s,p);id(s.id,p+'.id');if(stageIds.has(s.id))err(p+'.id','IDが重複しています');stageIds.add(s.id);str(s.label,p+'.label');fields(s,p,{timeLimit:[10,1800,true],waveDelay:[0,30],spawnDistance:[220,450],airspaceRadius:[800,3000]});fields(s.spawn,p+'.spawn',{x:[-10000,10000],y:[18,250],z:[-10000,10000]});const waves=list(s.waves,p+'.waves',50);waves.forEach((v,j)=>{if(!ids.has(v))err(`${p}.waves[${j}]`,'編隊IDが存在しません');});if(s.boss?.enemyId!=='boss')err(p+'.boss.enemyId','bossが必要です');fields(s.boss,p+'.boss',{x:[-200,200],y:[-100,100],z:[-100,200]});const music=obj(s.music,p+'.music');for(const k of ['title','battle','boss','victory','defeat'])if(!['title','battle','boss','victory','defeat'].includes(music[k]))err(p+'.music.'+k,'登録済みBGMから選択してください');fields(s.sky,p+'.sky',{sunsetSeconds:[.5,20],nightSeconds:[1,600],sunriseSeconds:[1,20]});if(s.sky?.nightSeconds<=s.sky?.sunsetSeconds)err(p+'.sky.nightSeconds','夕方への移行時間より長くしてください');});
 if(!stageIds.has(d.activeStage))err('activeStage','ステージIDが存在しません');
 return errors;
}
export function assertData(data){const errors=validateData(data);if(errors.length){const e=new Error(errors.slice(0,30).join('\n'));e.status=422;e.details=errors;throw e;}return data;}
