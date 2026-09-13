import {movingLoadAt} from './movingLoad.js';
import {prestressElementLoad} from './prestress.js';

export const LOAD_ACTION_CONTRACT='load-action/v1';
const clone=v=>typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v));
const finite=(name,v,f=0)=>{const n=Number(v??f);if(!Number.isFinite(n))throw new Error(`LoadAction: ${name} deve ser finito.`);return n};
function scaleFields(row,fields,s){const out={...row};for(const k of fields)if(row[k]!=null)out[k]=finite(k,row[k])*s;return out}
function scaleNodal(row,s){return scaleFields(row,['fx','fy','fz','mx','my','mz'],s)}
function scaleSettlement(row,s){return scaleFields(row,['ux','uy','uz','rx','ry','rz'],s)}
function scaleElement(row,s){
  if(row.kind==='uniform')return scaleFields(row,['qx','qy','qz'],s);
  if(row.kind==='point')return scaleFields(row,['px','py','pz'],s);
  if(row.kind==='thermal')return scaleFields(row,['dT','dTGradient','dTGradientY','dTGradientZ'],s);
  if(row.kind==='selfWeight')return{...row,weightFactor:finite('weightFactor',row.weightFactor??row.factor,1)*s};
  if(row.kind==='followerEnd')return scaleFields(row,['fx','fy','fz'],s);
  if(row.kind==='prestress')return{...row,force:Math.max(0,finite('prestress force',row.force))*s};
  throw new Error(`LoadAction: element load '${row.kind||'(ausente)'}' não suportado.`);
}
function selected(actions,activeActionIds){const ids=activeActionIds==null?null:new Set(activeActionIds.map(String));return(actions||[]).filter(a=>ids==null||ids.has(String(a.id)))}

export function compileActionSet({project,actions=[],activeActionIds=null,movingPositions={}}={}){
  if(!project)throw new Error('LoadAction: project é obrigatório.');const out=clone(project),compiled=[];out.loads=Array.isArray(out.loads)?out.loads:[];out.elementLoads=Array.isArray(out.elementLoads)?out.elementLoads:[];out.settlements=Array.isArray(out.settlements)?out.settlements:[];
  for(const action of selected(actions,activeActionIds)){
    const id=String(action.id||'').trim();if(!id)throw new Error('LoadAction: toda ação requer id.');const type=String(action.type||''),s=finite(`${id}.scale`,action.scale,1),caseId=action.caseId??null;let additions={loads:[],elementLoads:[],settlements:[]};
    if(type==='nodal')additions.loads=(action.loads||[]).map((r,i)=>({...scaleNodal(r,s),id:r.id||`${id}_N${i+1}`,actionId:id,caseId:r.caseId??caseId}));
    else if(type==='element')additions.elementLoads=(action.loads||[]).map((r,i)=>({...scaleElement(r,s),id:r.id||`${id}_E${i+1}`,actionId:id,caseId:r.caseId??caseId}));
    else if(type==='settlement')additions.settlements=(action.settlements||[]).map((r,i)=>({...scaleSettlement(r,s),id:r.id||`${id}_S${i+1}`,actionId:id,caseId:r.caseId??caseId}));
    else if(type==='prestress')additions.elementLoads=(action.loads||[]).map((r,i)=>prestressElementLoad({...r,id:r.id||`${id}_P${i+1}`,force:Math.max(0,finite(`${id}.force`,r.force))*s,caseId:r.caseId??caseId,actionId:id}));
    else if(type==='moving'){
      const position=movingPositions[id]??action.position??0,m=movingLoadAt({project:out,pathElementIds:action.pathElementIds,vehicle:action.vehicle,position,actionId:id,caseId});additions.elementLoads=m.elementLoads;additions.moving=m;
    }else throw new Error(`LoadAction: tipo '${type||'(ausente)'}' não suportado.`);
    out.loads.push(...additions.loads);out.elementLoads.push(...additions.elementLoads);out.settlements.push(...additions.settlements);compiled.push({id,type,scale:s,caseId,counts:{nodal:additions.loads.length,element:additions.elementLoads.length,settlement:additions.settlements.length},moving:additions.moving||null});
  }
  return{contract:LOAD_ACTION_CONTRACT,project:out,compiled,activeActionIds:compiled.map(a=>a.id)};
}
