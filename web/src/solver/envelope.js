import { solve } from './index.js';
import { listScenarios } from './scenario.js';

function range(value){return Number.isFinite(Number(value))?{min:Number(value),max:Number(value)}:null}
function initStationEnvelope(station){return{xi:station.xi,x:station.x,N:range(station.N),V:range(station.V),M:range(station.M),vLocal:range(station.vLocal),ux:range(station.ux),uy:range(station.uy),sigmaAxial:range(station.sigmaAxial),sigmaTop:range(station.sigmaTop),sigmaBottom:range(station.sigmaBottom),sigmaAbs:range(station.sigmaAbs)}}
function extend(target,value){const n=Number(value);if(!Number.isFinite(n))return target;if(!target)return{min:n,max:n};target.min=Math.min(target.min,n);target.max=Math.max(target.max,n);return target}

export function solveEnvelope(project,scenarioIds=null){
  const ids=scenarioIds?.length?scenarioIds:listScenarios(project).map(s=>s.id);if(!ids.length)throw new Error('Nenhum cenário disponível para envelope.');
  const solved=ids.map(id=>solve(project,id)),nodeMap=new Map(),elementMap=new Map();
  for(const result of solved){
    for(const d of result.displacements||[]){let env=nodeMap.get(d.nodeId);if(!env){env={nodeId:d.nodeId,ux:range(d.ux),uy:range(d.uy),rz:range(d.rz)};nodeMap.set(d.nodeId,env)}else{env.ux=extend(env.ux,d.ux);env.uy=extend(env.uy,d.uy);env.rz=extend(env.rz,d.rz)}}
    for(const response of result.elementResponses||[]){
      let env=elementMap.get(response.elementId);
      if(!env){env={elementId:response.elementId,type:response.type,L:response.L,stress:response.stress,stations:response.stations.map(initStationEnvelope)};elementMap.set(response.elementId,env)}
      else response.stations.forEach((st,i)=>{const target=env.stations[i];if(!target)return;for(const field of ['N','V','M','vLocal','ux','uy','sigmaAxial','sigmaTop','sigmaBottom','sigmaAbs'])target[field]=extend(target[field],st[field])});
    }
  }
  return{type:'linear-envelope',scenarioIds:ids,scenarios:solved.map(r=>r.scenario),nodeDisplacements:[...nodeMap.values()],elementResponses:[...elementMap.values()],solverVersion:'0.9.0'};
}
