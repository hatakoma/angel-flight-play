// Place off-screen cues on a circle centered on the viewport, preserving bearing.
export function edgeIndicator(x,y,z,width,height){
 let dx=x,dy=-y;if(Math.hypot(dx,dy)<.001){dx=z>0?1:0;dy=z>0?0:-1;}
 const radius=Math.max(20,Math.min(width*.38,height*.34,width/2-45,height/2-70));
 const factor=radius/Math.hypot(dx,dy);
 return {x:width/2+dx*factor,y:height/2+dy*factor,angle:Math.atan2(dy,dx)};
}

// Prefer the player's feet; use the upper side only when the lower side cannot fit.
export function avoidPlayerMessage(rect,player,height,atFeet=false){
 const gap=14,minTop=90,maxTop=Math.max(minTop,height-78-rect.height);
 const overlaps=rect.left<player.right+gap&&rect.right>player.left-gap&&rect.top<player.bottom+gap&&rect.bottom>player.top-gap;
 if(!atFeet&&!overlaps)return {offset:0,side:0};
 const above=player.top-gap-rect.height,below=player.bottom+gap;
 const side=below<=maxTop?1:-1;
 const top=Math.max(minTop,Math.min(maxTop,side===1?below:above));
 return {offset:top-rect.top,side};
}
