import {compileActionSet} from './actionEngine.js';
import {timeDependentState} from './timeDependent.js';

export const CONSTRUCTION_STAGE_CONTRACT='construction-stages/v1';
const clone=v=>typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v));
const asSet=(value,all)=>value==='all'?new Set(all.map(String)):new Set((value||[]).map(String));
function applyTransition(set,activate=[],deactivate=[]){for(const id of deactivate||[])set.delete(String(id));for(const id of activate||[])set.add(String(id))}
function assertKnown(set,known,label){for(const id of set)if(!known.has(id))throw new Error(`ConstructionStages: ${label} ${id} não existe.`)}

export function buildConstructionStageSnapshots({project,actions=[],stages=[],initialState={},movingPositions={},timeEffects=null}={}){
  if(!project)throw new Error('ConstructionStages: project é obrigatório.');const elementIds=(project.elements||[]).map(e=>String(e.id)),supportIds=(project.supports||[]).map(s=>String(s.id)),actionIds=(actions||[]).map(a=>String(a.id)),knownE=new Set(elementIds),knownS=new Set(supportIds),knownA=new Set(actionIds),activeE=asSet(initialState.elements??'all',elementIds),activeS=asSet(initialState.supports??'all',supportIds),activeA=asSet(initialState.actions??[],actionIds);assertKnown(activeE,knownE,'elemento');assertKnown(activeS,knownS,'apoio');assertKnown(activeA,knownA,'ação');let time=Number(initialState.timeDays)||0;const snapshots=[];
  for(let i=0;i<(stages||[]).length;i++){
    const stage=stages[i],id=String(stage.id||`ST${i+1}`),duration=Math.max(0,Number(stage.durationDays)||0);applyTransition(activeE,stage.activateElements,stage.deactivateElements);applyTransition(activeS,stage.activateSupports,stage.deactivateSupports);applyTransition(activeA,stage.activateActions,stage.deactivateActions);assertKnown(activeE,knownE,'elemento');assertKnown(activeS,knownS,'apoio');assertKnown(activeA,knownA,'ação');
    const base=clone(project);base.elements=(base.elements||[]).filter(e=>activeE.has(String(e.id)));base.supports=(base.supports||[]).filter(s=>activeS.has(String(s.id)));const eSet=new Set(base.elements.map(e=>String(e.id)));base.elementLoads=(base.elementLoads||[]).filter(l=>!l.elementId||eSet.has(String(l.elementId)));const compiled=compileActionSet({project:base,actions,activeActionIds:[...activeA],movingPositions:{...movingPositions,...(stage.movingPositions||{})}}),timeStart=time,timeEnd=time+duration,effects=timeEffects?timeDependentState({timeDays:time+duration,...timeEffects}):null;
    snapshots.push({contract:CONSTRUCTION_STAGE_CONTRACT,index:i,id,name:stage.name||id,timeStartDays:timeStart,timeEndDays:timeEnd,durationDays:duration,active:{elements:[...activeE],supports:[...activeS],actions:[...activeA]},project:compiled.project,compiledActions:compiled.compiled,timeEffects:effects});time=timeEnd;
  }
  return{contract:CONSTRUCTION_STAGE_CONTRACT,initialTimeDays:Number(initialState.timeDays)||0,finalTimeDays:time,snapshots};
}
