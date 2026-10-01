// Top-down schematic of the same floating castles used by the scene.
const islands=[[105,-240,1.6],[-300,-590,2.2],[490,-860,2.8],[-530,130,1.3],[430,340,1.5],[100,850,2]];
export function createTerrainMap(canvas){
 const c=canvas.getContext('2d');let clock=1;
 return {update(dt,center,player,yaw){
  clock+=dt;if(clock<.15)return;clock=0;
  const w=canvas.width,h=canvas.height,scale=w/2400,px=x=>w/2+(x-center.x)*scale,pz=z=>h/2+(z-center.z)*scale;
  c.clearRect(0,0,w,h);c.save();c.lineWidth=1;
  c.strokeStyle='#9acfc51b';
  for(let x=0;x<w;x+=24){c.beginPath();c.moveTo(x,0);c.lineTo(x,h);c.stroke();}
  for(let y=0;y<h;y+=24){c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();}
  islands.forEach(([x,z,size],index)=>{
   for(let level=0;level<5;level++){
    const radius=(65+level*22)*size;
    c.beginPath();for(let n=0;n<=40;n++){const a=n/40*Math.PI*2,r=radius*(1+.12*Math.sin(a*3+index)+.07*Math.cos(a*5-index));const xx=px(x+Math.cos(a)*r),yy=pz(z+Math.sin(a)*r*.7);if(n)c.lineTo(xx,yy);else c.moveTo(xx,yy);}c.closePath();
    c.strokeStyle=`rgba(135,212,197,${.5-level*.065})`;c.stroke();if(level===0){c.fillStyle='#88c6b918';c.fill();}
   }
   c.fillStyle='#eedbb0';c.fillRect(px(x)-2,pz(z)-2,4,4);c.font='8px Consolas,monospace';c.fillText('C'+(index+1),px(x)+5,pz(z)-4);
  });
  c.setLineDash([3,5]);c.strokeStyle='#dec78c66';c.beginPath();c.ellipse(w/2,h/2,1050*scale,1050*scale,0,0,Math.PI*2);c.stroke();c.setLineDash([]);
  c.save();c.translate(Math.max(5,Math.min(w-5,px(player.x))),Math.max(5,Math.min(h-5,pz(player.z))));c.rotate(-yaw);c.fillStyle='#dffff2';c.beginPath();c.moveTo(0,-6);c.lineTo(-4,4);c.lineTo(0,2);c.lineTo(4,4);c.closePath();c.fill();c.restore();
  c.fillStyle='#a6d5cf';c.font='8px Consolas,monospace';c.fillText('N ↑',w-24,11);c.fillText('CLOUD ALT / SCHEMATIC',5,h-6);c.restore();
 }};
}
