import {foundationSSIResults} from '../foundation/ssi.js';
import {add3,nodePoint,norm3,projectPoint3D,scale3,unit3} from './spatialView3d.js';

export const FOUNDATION_SSI_VIEW3D_VERSION='0.53.4-exp';
export const FOUNDATION_SSI_VIEW3D_CONTRACT='foundation-ssi-overlay3d/v1';

const finite=v=>v!==''&&v!==null&&v!==undefined&&Number.isFinite(Number(v))?Number(v):null;
const stateColor=state=>({READY:'#2f8b68',UNSOLVED:'#2f70ad',MODE_ONLY:'#765e92',PENDING:'#c79237',INVALID:'#c84d55'}[String(state||'PENDING').toUpperCase()]||'#687983');
const reviewId=(x,i)=>String(x?.id||x?.nodeId||`F${i+1}`);
function springPolyline(a,b){
  if(!a?.visible||!b?.visible)return[];
  const dx=b.x-a.x,dy=b.y-a.y,L=Math.hypot(dx,dy);if(L<1e-6)return[a,b];
  const nx=-dy/L,ny=dx/L,out=[];for(let i=0;i<=8;i++){const t=i/8,amp=i===0||i===8?0:(i%2?3.5:-3.5);out.push({x:a.x+dx*t+nx*amp,y:a.y+dy*t+ny*amp})}return out;
}
function projectedArrow(base,vector,maxMagnitude,worldLength,camera,size){
  const mag=norm3(vector);if(!(mag>1e-12)||!(maxMagnitude>1e-12))return null;
  const len=worldLength*(.35+.65*mag/maxMagnitude),end=add3(base,scale3(unit3(vector),len)),a=projectPoint3D(base,camera,size),b=projectPoint3D(end,camera,size);return a.visible&&b.visible?{a,b,magnitude:mag,vector}:null;
}
function footprint(review,node,camera,size){
  const B=finite(review?.geometry?.B),L=finite(review?.geometry?.L);if(!(B>0&&L>0))return null;
  const x=finite(review?.x)??(Number(node.x)||0),y=finite(review?.y)??(Number(node.y)||0),z=finite(review?.z)??(Number(node.z)||0);
  const pts=[[x-B/2,y-L/2,z],[x+B/2,y-L/2,z],[x+B/2,y+L/2,z],[x-B/2,y+L/2,z]].map(p=>projectPoint3D(p,camera,size));
  return pts.every(p=>p.visible)?pts:null;
}

export function foundationSSIOverlayScene(project={},result=null,camera,size,charLength=1){
  const post=foundationSSIResults(project,result),nodes=project.nodes||[],reviews=Array.isArray(project?.foundationReview?.items)?project.foundationReview.items:[],reviewMap=new Map(reviews.map((x,i)=>[reviewId(x,i),x]));
  const active=post.items.filter(x=>x.state!=='DISABLED'),maxDisp=Math.max(0,...active.map(x=>x.displacement?norm3([x.displacement.ux,x.displacement.uy,x.displacement.uz]):0)),maxReaction=Math.max(0,...active.map(x=>x.springReaction?norm3([x.springReaction.fx,x.springReaction.fy,x.springReaction.fz]):0)),L=Math.max(Number(charLength)||1,1e-6);
  const items=active.map(item=>{const node=nodes.find(n=>String(n.id)===String(item.nodeId));if(!node)return null;const base=nodePoint(node),anchor=projectPoint3D(base,camera,size);if(!anchor.visible)return null;const review=reviewMap.get(String(item.foundationId))||reviews.find(x=>String(x.nodeId)===String(item.nodeId))||null,ground=projectPoint3D(add3(base,[0,0,-L*.10]),camera,size),disp=item.displacement?[Number(item.displacement.ux)||0,Number(item.displacement.uy)||0,Number(item.displacement.uz)||0]:[0,0,0],reaction=item.springReaction?[Number(item.springReaction.fx)||0,Number(item.springReaction.fy)||0,Number(item.springReaction.fz)||0]:[0,0,0];return{foundationId:item.foundationId,nodeId:item.nodeId,label:item.label,state:item.state,color:stateColor(item.state),anchor,footprint:footprint(review,node,camera,size),spring:springPolyline(anchor,ground),displacement:post.governance.resultNature==='physical'?projectedArrow(base,disp,maxDisp,L*.12,camera,size):null,reaction:post.governance.resultNature==='physical'?projectedArrow(base,reaction,maxReaction,L*.15,camera,size):null,averageContactPressureKPa:item.averageContactPressureKPa,settlementMm:item.displacement?1000*(Number(item.displacement.uz)||0):null,stiffness:item.stiffness||null,source:item.source||null,pileReactionState:item.pileReactionState};}).filter(Boolean);
  return{contract:FOUNDATION_SSI_VIEW3D_CONTRACT,version:FOUNDATION_SSI_VIEW3D_VERSION,enabled:project?.foundationSSI?.enabled===true,resultNature:post.governance.resultNature,items,summary:{count:items.length,ready:items.filter(x=>x.state==='READY').length,modeOnly:items.filter(x=>x.state==='MODE_ONLY').length,withResults:items.filter(x=>x.displacement||x.reaction).length},legend:{spring:'Rigidez SSI',displacement:'Recalque/deslocamento translacional (direção global; comprimento visual escalado)',reaction:'Reação translacional da mola (direção global; comprimento visual escalado)'}};
}
