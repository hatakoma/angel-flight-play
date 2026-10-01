import defaults from '../shared/default-data.js';
import {assertData} from '../shared/validate.js';
import runtime from './runtime-config.js';
const freeze=o=>{if(o&&typeof o==='object'){Object.freeze(o);Object.values(o).forEach(freeze);}return o;};
export let gameData=freeze(structuredClone(defaults));
export let stage=gameData.stages.find(s=>s.id===gameData.activeStage);
export let dataVersion='initial-v1';
export function applyGameData(data,version,stageId){
 assertData(data);const copy=structuredClone(data),selected=copy.stages.find(s=>s.id===(stageId||copy.activeStage));
 if(!selected)throw Error('指定されたステージがありません');
 gameData=freeze(copy);stage=selected;dataVersion=version;
}
export async function loadGameData(){
 const params=new URLSearchParams(location.search),preview=params.get('preview');
 if(preview&&runtime.mode==='pages')throw Error('下書きのテスト飛行は管理ページから開いてください。');
 const url=runtime.mode==='pages'?(runtime.dataUrl||new URL('../data/published.json',import.meta.url).href):preview?'/api/admin/preview?revision='+encodeURIComponent(preview):'/api/game-data';
 const response=await fetch(url,{cache:'no-store',credentials:runtime.mode==='pages'?'omit':'same-origin',signal:AbortSignal.timeout(12000)});
 if(!response.ok){let message='ゲームデータを読み込めません。再試行してください。';try{message=(await response.json()).error||message;}catch{}throw Error(message);}
 const result=await response.json();applyGameData(result.data,result.id,params.get('stage'));
 return {version:dataVersion,preview:!!preview};
}
