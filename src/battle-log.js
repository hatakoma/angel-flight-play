// Hard line steps: new events push immediately; idle ticks insert a blank row.
export function createBattleLog(root){
 const rows=[],recent=new Map();let clock=0,time=0,sequence=0;
 function render(){
  root.replaceChildren(...rows.map((entry,index)=>{
   const row=document.createElement('div');row.className='battle-log-line '+(entry?.kind||'empty');row.style.opacity=String(Math.max(.2,1-index*.12));
   if(entry){const stamp=document.createElement('span');stamp.className='battle-log-stamp';stamp.textContent=entry.stamp;const text=document.createElement('span');text.textContent=entry.text;row.title=entry.text;row.append(stamp,text);}
   return row;
  }));
 }
 function shift(entry){rows.unshift(entry);rows.length=Math.min(rows.length,7);render();}
 return {reset(){rows.length=0;recent.clear();clock=time=sequence=0;render();},
  push(text,kind='info',key=text){
   if(time-(recent.get(key)??-10)<1.5)return;
   recent.set(key,time);if(recent.size>80)recent.delete(recent.keys().next().value);
   const seconds=Math.floor(time);shift({text,kind,stamp:`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')} ${String(++sequence).padStart(3,'0')}`});clock=0;
  },
  update(dt){time+=dt;clock+=dt;if(clock>=2){clock%=2;shift(null);}},
 };
}
