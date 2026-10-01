import {loadGameData} from './game-data.js';
const status=document.getElementById('launch-status'),start=document.getElementById('start');
async function boot(){
 start.disabled=true;status.textContent='ゲームデータを読み込み中…';
 try{await loadGameData();await import('./main.js');start.disabled=false;status.textContent='';}
 catch(error){status.textContent=error.message;start.disabled=false;start.textContent='再読み込み';start.onclick=()=>location.reload();}
}
boot();
