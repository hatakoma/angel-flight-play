const dead=v=>Math.abs(v||0)<.18?0:Math.sign(v)*Math.min(1,(Math.abs(v)-.18)/.82);
export function readQuestInput(sources){
 const out={turn:0,climb:0,fire:false,spear:false,boost:false,action:false,turnBack:false,pause:false,exit:false,recenter:false,dash:null};
 for(const source of sources){
  const g=source.gamepad;if(!g||g.mapping!=='xr-standard')continue;
  const pressed=i=>!!g.buttons[i]?.pressed;
  const x=g.axes.length>=4?g.axes[2]:g.axes[0]||0,y=g.axes.length>=4?g.axes[3]:g.axes[1]||0;
  if(source.handedness==='left'){out.turn=-dead(x);out.climb=-dead(y);out.boost=pressed(1);out.spear=out.spear||pressed(0);out.pause=pressed(4);out.exit=pressed(5);}
  if(source.handedness==='right'){
   out.fire=pressed(0);out.spear=out.spear||pressed(1);out.action=pressed(4);out.turnBack=pressed(5);out.recenter=pressed(3);
   if(Math.max(Math.abs(x),Math.abs(y))>.7)out.dash=Math.abs(x)>Math.abs(y)?(x>0?'KeyD':'KeyA'):(y>0?'KeyS':'KeyW');
  }
 }
 return out;
}
export function createQuestEdges(){
 let previous={};return {reset(){previous={};},update(input){const events=[];for(const key of ['action','turnBack','pause','exit','recenter'])if(input[key]&&!previous[key])events.push(key);if(input.dash&&!previous.dash)events.push(input.dash);previous={...input};return events;}};
}
