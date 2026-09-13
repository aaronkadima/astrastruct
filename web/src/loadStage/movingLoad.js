import {spatialAxes} from '../solver/spatial3d.js';

export const MOVING_LOAD_CONTRACT='moving-load/v1';
const EPS=1e-10;
const p3=n=>[Number(n?.x)||0,Number(n?.y)||0,Number(n?.z)||0];
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const norm=a=>Math.hypot(...a);
const mv=(A,x)=>A.map(r=>r.reduce((s,v,i)=>s+v*x[i],0));
function byId(rows,id,label){const x=(rows||[]).find(r=>String(r.id)===String(id));if(!x)throw new Error(`MovingLoad: ${label} ${id} não encontrado.`);return x}

export function buildMovingLoadPath(project,elementIds=[]){
  if(!Array.isArray(elementIds)||!elementIds.length)throw new Error('MovingLoad: pathElementIds vazio.');let station=0;const segments=[];
  for(const id of elementIds){const e=byId(project.elements,id,'elemento');if(!['frame2d','frame3d'].includes(e.type))throw new Error(`MovingLoad: elemento ${id} deve ser frame2d ou frame3d.`);const a=byId(project.nodes,e.n1,'nó'),b=byId(project.nodes,e.n2,'nó'),d=sub(p3(b),p3(a)),L=norm(d);if(!(L>EPS))throw new Error(`MovingLoad: elemento ${id} possui comprimento nulo.`);segments.push({elementId:e.id,type:e.type,n1:e.n1,n2:e.n2,start:station,end:station+L,length:L,a,b,element:e});station+=L}
  return{contract:MOVING_LOAD_CONTRACT,segments,totalLength:station};
}
function locate(path,s){if(s<-EPS||s>path.totalLength+EPS)return null;const station=Math.max(0,Math.min(path.totalLength,s));for(let i=0;i<path.segments.length;i++){const seg=path.segments[i];if(station<seg.end-EPS||i===path.segments.length-1){const xi=Math.max(0,Math.min(1,(station-seg.start)/seg.length));return{segment:seg,station,xi}}}return null}
function globalForce(axle,elementType){if(Array.isArray(axle.globalForce)){const f=axle.globalForce.map(Number);if(f.length!==3||f.some(v=>!Number.isFinite(v)))throw new Error('MovingLoad: globalForce deve ter 3 valores finitos.');return f}const P=Math.max(0,Number(axle.load)||0);return elementType==='frame2d'?[0,-P,0]:[0,0,-P]}
function localForce(loc,force){const s=loc.segment;if(s.type==='frame3d')return mv(spatialAxes(s.a,s.b,s.element).R,force);const dx=Number(s.b.x)-Number(s.a.x),dy=Number(s.b.y)-Number(s.a.y),L=Math.hypot(dx,dy),c=dx/L,ss=dy/L;return[c*force[0]+ss*force[1],-ss*force[0]+c*force[1],0]}

/** Vehicle position is the station of the reference/leading axle. Positive axle.offset is behind the reference axle. */
export function movingLoadAt({project,pathElementIds,vehicle,position,actionId=null,caseId=null}={}){
  const path=buildMovingLoadPath(project,pathElementIds),pos=Number(position);if(!Number.isFinite(pos))throw new Error('MovingLoad: position deve ser finito.');if(!Array.isArray(vehicle?.axles)||!vehicle.axles.length)throw new Error('MovingLoad: veículo deve possuir axles.');const elementLoads=[],axles=[];
  vehicle.axles.forEach((axle,i)=>{const axleStation=pos-(Number(axle.offset)||0),loc=locate(path,axleStation),id=String(axle.id||`AX${i+1}`);if(!loc){axles.push({id,station:axleStation,onPath:false});return}const fg=globalForce(axle,loc.segment.type),fl=localForce(loc,fg),load={id:`${actionId||'moving'}_${id}_${loc.segment.elementId}`,kind:'point',elementId:loc.segment.elementId,xi:loc.xi,px:fl[0],py:fl[1],caseId,actionId};if(loc.segment.type==='frame3d')load.pz=fl[2];elementLoads.push(load);axles.push({id,station:axleStation,onPath:true,elementId:loc.segment.elementId,xi:loc.xi,globalForce:fg,localForce:fl})});
  return{contract:MOVING_LOAD_CONTRACT,position:pos,path,vehicleId:String(vehicle.id||'vehicle'),elementLoads,axles,activeAxles:axles.filter(a=>a.onPath).length};
}

export function movingLoadPositions({pathLength,step=0.25,vehicleLength=0}={}){const L=Math.max(0,Number(pathLength)||0),h=Number(step);if(!(h>0))throw new Error('MovingLoad: step deve ser positivo.');const start=0,end=L+Math.max(0,Number(vehicleLength)||0),out=[];for(let x=start;x<end-EPS;x+=h)out.push(x);out.push(end);return out}
