import { buildingLevelInventory } from './marketParityAdvanced.js';

export const COMBINATION_ENVELOPE_CONTRACT='combination-envelope-explorer/v1';
export const COMBINATION_ENVELOPE_VERSION='0.53.11-exp';

const finite=v=>v!==''&&v!==null&&v!==undefined&&Number.isFinite(Number(v))?Number(v):null;
const text=(v,f='')=>String(v??f);
const norm=v=>text(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const abs=n=>Math.abs(Number(n)||0);

export function classifyCombination(combination={}){
  const explicit=norm(combination.limitStateCategory||combination.limitStateType||combination.category||combination.designSituation);
  if(/^(elu|uls|ultimate)$/.test(explicit)||/\b(elu|uls|ultimate)\b/.test(explicit))return{category:'ELU',source:'explicit'};
  if(/^(els|sls|serviceability)$/.test(explicit)||/\b(els|sls|serviceability)\b/.test(explicit))return{category:'ELS',source:'explicit'};
  const hay=norm(`${combination.id||''} ${combination.name||''} ${combination.type||''}`);
  if(/\b(elu|uls|ultimate|estado limite ultimo)\b/.test(hay))return{category:'ELU',source:'semantic'};
  if(/\b(els|sls|service|serviceability|estado limite de servico)\b/.test(hay))return{category:'ELS',source:'semantic'};
  return{category:'UNKNOWN',source:'unknown'};
}

export function combinationDescriptors(project={}){
  return(project.loadCombinations||[]).map(c=>{
    const cls=classifyCombination(c);
    return{id:text(c.id),name:text(c.name,c.id),type:text(c.type,'custom'),category:cls.category,categorySource:cls.source,terms:Array.isArray(c.terms)?c.terms.map(t=>({caseId:text(t.caseId),factor:finite(t.factor)})):[]};
  });
}

function displacementRows(result){return result?.totalDisplacements||result?.displacements||result?.combined?.displacements||[]}
function reactionRows(result){return Array.isArray(result?.reactions)?result.reactions:[]}
function resultNature(result){const k=norm(`${result?.analysisType||''} ${result?.type||''}`);return/modal|buckling|eigen/.test(k)?'eigen-shape':'physical'}
function forceRows(result){return Array.isArray(result?.elementForces)?result.elementForces:[]}
function displacementVectorMm(row){const ux=finite(row?.ux),uy=finite(row?.uy),uz=finite(row?.uz);if(ux==null&&uy==null&&uz==null)return null;const uxMm=1000*(ux??0),uyMm=1000*(uy??0),uzMm=1000*(uz??0);return{uxMm,uyMm,uzMm,magnitudeMm:Math.hypot(uxMm,uyMm,uzMm)}}

function componentValues(force,key){
  const map={N:['N1','N2','axialForce'],V:['Vy1','Vy2','Vz1','Vz2'],M:['My1','My2','Mz1','Mz2'],T:['T1','T2'],shellN:['membraneResultants.Nx','membraneResultants.Ny','membraneResultants.Nxy'],shellM:['bendingMoments.Mx','bendingMoments.My','bendingMoments.Mxy'],shellV:['transverseShear.Qx','transverseShear.Qy']};
  const out=[];for(const path of map[key]||[]){let v=force;for(const p of path.split('.'))v=v?.[p];const n=finite(v);if(n!=null)out.push({component:path.split('.').at(-1),value:n})}return out;
}
function updateEnvelope(env,values,combinationId){for(const item of values){const v=item.value;if(env.min==null||v<env.min){env.min=v;env.minCombinationId=combinationId;env.minComponent=item.component}if(env.max==null||v>env.max){env.max=v;env.maxCombinationId=combinationId;env.maxComponent=item.component}if(env.absMax==null||abs(v)>abs(env.absMax)){env.absMax=v;env.governingCombinationId=combinationId;env.governingComponent=item.component}}}
function emptyEnvelope(){return{min:null,max:null,absMax:null,minCombinationId:null,maxCombinationId:null,governingCombinationId:null,governingComponent:null}}
function emptyResultantEnvelope(){return{absMax:null,governingCombinationId:null,vector:null,components:null}}
function updateResultantEnvelope(env,components,combinationId){const values=components.map(finite);if(values.every(v=>v==null))return;const vector=values.map(v=>v??0),magnitude=Math.hypot(...vector);if(env.absMax==null||magnitude>env.absMax){env.absMax=magnitude;env.governingCombinationId=combinationId;env.vector=vector;env.components=components.map((_,i)=>values[i])}}

function supportMap(project){
  const out=new Map();for(const s of project.supports||[]){const id=String(s?.nodeId??'');if(!id)continue;const prev=out.get(id)||{nodeId:id,ux:false,uy:false,uz:false,rx:false,ry:false,rz:false};for(const k of ['ux','uy','uz','rx','ry','rz'])prev[k]=!!(prev[k]||s?.[k]);out.set(id,prev)}return out;
}

export function supportReactionAtCombination(explorer={},nodeId,combinationId){
  const id=text(nodeId),combo=text(combinationId);if(!id||!combo)return null;
  const entry=(explorer.combinations||[]).find(e=>e?.status==='READY'&&text(e?.combinationId)===combo),env=(explorer.supportReactionEnvelopes||[]).find(e=>text(e?.nodeId)===id);if(!entry||!env)return null;
  const row=reactionRows(entry.result).find(r=>text(r?.nodeId)===id);if(!row)return null;
  const restraints={ux:!!env?.restraints?.ux,uy:!!env?.restraints?.uy,uz:!!env?.restraints?.uz,rx:!!env?.restraints?.rx,ry:!!env?.restraints?.ry,rz:!!env?.restraints?.rz},components={};
  for(const [key,field,dof] of [['Fx','fx','ux'],['Fy','fy','uy'],['Fz','fz','uz'],['Mx','mx','rx'],['My','my','ry'],['Mz','mz','rz']])components[key]=restraints[dof]?finite(row?.[field]):0;
  const complete=Object.values(components).every(v=>v!==null&&Number.isFinite(Number(v)));
  return{contract:'support-reaction-at-combination/v1',version:COMBINATION_ENVELOPE_VERSION,nodeId:id,combinationId:combo,components,forceUnit:'kN',momentUnit:'kN·m',restraints,complete,governance:{singlePhysicalCombination:true,restrainedComponentsOnly:true,unrestrainedComponentsZeroed:true,noEnvelopeComponentMixing:true}};
}

function updateSupportReaction(env,row,support,combinationId){
  const fields=[['Fx','fx','ux'],['Fy','fy','uy'],['Fz','fz','uz'],['Mx','mx','rx'],['My','my','ry'],['Mz','mz','rz']];
  for(const [key,field,dof] of fields){if(!support[dof])continue;const v=finite(row?.[field]);if(v!=null)updateEnvelope(env[key],[{component:key,value:v}],combinationId)}
  const force=[support.ux?finite(row?.fx):null,support.uy?finite(row?.fy):null,support.uz?finite(row?.fz):null],moment=[support.rx?finite(row?.mx):null,support.ry?finite(row?.my):null,support.rz?finite(row?.mz):null];
  updateResultantEnvelope(env.R,force,combinationId);updateResultantEnvelope(env.M,moment,combinationId);
}

function nodeLevelMap(project,inventory){
  const levels=(inventory.levels||[]).filter(l=>Number.isFinite(Number(l.elevation))).map(l=>({id:String(l.id),elevation:Number(l.elevation)})),map=new Map();
  for(const n of project.nodes||[]){if(n.levelId!=null){map.set(String(n.id),String(n.levelId));continue}const z=finite(n.z);if(z==null||!levels.length)continue;let best=levels[0],d=Math.abs(z-best.elevation);for(const l of levels.slice(1)){const q=Math.abs(z-l.elevation);if(q<d){best=l;d=q}}const span=Math.max(1,...levels.map(l=>Math.abs(l.elevation)));if(d<=Math.max(1e-6,span*1e-6))map.set(String(n.id),best.id)}return map;
}
function storyDrifts(project,inventory,result){
  if(resultNature(result)!=='physical')return[];
  const levels=(inventory.levels||[]).filter(l=>finite(l.elevation)!=null).map(l=>({...l,elevation:Number(l.elevation)})).sort((a,b)=>a.elevation-b.elevation),nodeToLevel=nodeLevelMap(project,inventory),dmap=new Map(displacementRows(result).map(d=>[String(d.nodeId),d])),means=new Map();
  for(const l of levels){const ds=(project.nodes||[]).filter(n=>nodeToLevel.get(String(n.id))===String(l.id)).map(n=>dmap.get(String(n.id))).filter(Boolean);if(!ds.length)continue;means.set(String(l.id),{ux:ds.reduce((s,d)=>s+(finite(d.ux)??0),0)/ds.length,uy:ds.reduce((s,d)=>s+(finite(d.uy)??0),0)/ds.length,count:ds.length})}
  const rows=[];for(let i=1;i<levels.length;i++){const low=levels[i-1],high=levels[i],a=means.get(String(low.id)),b=means.get(String(high.id)),h=high.elevation-low.elevation;if(!a||!b||!(h>0))continue;const dx=b.ux-a.ux,dy=b.uy-a.uy,mag=Math.hypot(dx,dy);rows.push({levelId:String(high.id),levelLabel:text(high.name,high.id),fromLevelId:String(low.id),heightM:h,driftX:dx/h,driftY:dy/h,driftRatio:mag/h,driftMm:mag*1000,nodeCount:b.count})}return rows;
}
function maxDisplacement(result){if(!result||resultNature(result)!=='physical')return{magnitudeMm:null,nodeId:null};let best=null;for(const d of displacementRows(result)){const v=displacementVectorMm(d);if(!v)continue;if(!best||v.magnitudeMm>best.magnitudeMm)best={magnitudeMm:v.magnitudeMm,nodeId:String(d.nodeId)}}return best||{magnitudeMm:null,nodeId:null}}

export function buildCombinationEnvelopeExplorer(project={},solvedEntries=[]){
  const inventory=buildingLevelInventory(project),descriptors=combinationDescriptors(project),descById=new Map(descriptors.map(d=>[d.id,d])),solvedById=new Map();
  for(let i=0;i<(solvedEntries||[]).length;i++){const entry=solvedEntries[i],id=text(entry?.combinationId||entry?.id||entry?.result?.scenario?.id,`comb-${i+1}`);solvedById.set(id,entry)}
  const ids=[...descriptors.map(d=>d.id),...solvedById.keys()].filter((id,i,a)=>a.indexOf(id)===i),entries=ids.map(id=>{const entry=solvedById.get(id)||{},descriptor=descById.get(id)||{id,name:text(entry?.name,id),category:'UNKNOWN',categorySource:'unknown',terms:[]},result=entry?.result||null,error=entry?.error?text(entry.error):null,nature=result?resultNature(result):null,disp=maxDisplacement(result),drifts=result?storyDrifts(project,inventory,result):[];return{combinationId:id,name:descriptor.name,category:descriptor.category,categorySource:descriptor.categorySource,terms:descriptor.terms,status:error?'ERROR':result?(nature==='physical'?'READY':'MODE_ONLY'):'PENDING',error,nature,result,displacement:disp,storyDrifts:drifts}});
  const elementById=new Map((project.elements||[]).map(e=>[String(e.id),e])),nodeById=new Map((project.nodes||[]).map(n=>[String(n.id),n])),supports=supportMap(project),envByElement=new Map(),nodeDispById=new Map(),reactionBySupport=new Map();
  for(const entry of entries){if(entry.status!=='READY')continue;
    for(const f of forceRows(entry.result)){const id=String(f.elementId||'');if(!id||!elementById.has(id))continue;let env=envByElement.get(id);if(!env){const element=elementById.get(id),shell=String(element?.type)==='shell4';env={elementId:id,label:text(element?.label||element?.name,id),type:text(element?.type),kind:shell?'shell':'bar',N:emptyEnvelope(),V:emptyEnvelope(),M:emptyEnvelope(),T:emptyEnvelope()};envByElement.set(id,env)}const shell=env.kind==='shell';updateEnvelope(env.N,componentValues(f,shell?'shellN':'N'),entry.combinationId);updateEnvelope(env.V,componentValues(f,shell?'shellV':'V'),entry.combinationId);updateEnvelope(env.M,componentValues(f,shell?'shellM':'M'),entry.combinationId);if(!shell)updateEnvelope(env.T,componentValues(f,'T'),entry.combinationId)}
    for(const d of displacementRows(entry.result)){const id=String(d?.nodeId||'');if(!id||!nodeById.has(id))continue;const v=displacementVectorMm(d);if(!v)continue;const prev=nodeDispById.get(id);if(!prev||v.magnitudeMm>prev.magnitudeMm){const node=nodeById.get(id);nodeDispById.set(id,{nodeId:id,label:text(node?.label||node?.name,id),levelId:node?.levelId!=null?String(node.levelId):null,...v,governingCombinationId:entry.combinationId})}}
    for(const r of reactionRows(entry.result)){const id=String(r?.nodeId||'');const support=supports.get(id),node=nodeById.get(id);if(!support||!node)continue;let env=reactionBySupport.get(id);if(!env){env={nodeId:id,label:text(node?.label||node?.name,id),levelId:node?.levelId!=null?String(node.levelId):null,restraints:{ux:!!support.ux,uy:!!support.uy,uz:!!support.uz,rx:!!support.rx,ry:!!support.ry,rz:!!support.rz},Fx:emptyEnvelope(),Fy:emptyEnvelope(),Fz:emptyEnvelope(),Mx:emptyEnvelope(),My:emptyEnvelope(),Mz:emptyEnvelope(),R:emptyResultantEnvelope(),M:emptyResultantEnvelope()};reactionBySupport.set(id,env)}updateSupportReaction(env,r,support,entry.combinationId)}
  }
  const driftByLevel=new Map();for(const entry of entries)for(const d of entry.storyDrifts){let env=driftByLevel.get(d.levelId);if(!env){env={levelId:d.levelId,levelLabel:d.levelLabel,fromLevelId:d.fromLevelId,heightM:d.heightM,maxDriftRatio:null,maxDriftMm:null,governingCombinationId:null,driftX:null,driftY:null};driftByLevel.set(d.levelId,env)}if(env.maxDriftRatio==null||d.driftRatio>env.maxDriftRatio){env.maxDriftRatio=d.driftRatio;env.maxDriftMm=d.driftMm;env.governingCombinationId=entry.combinationId;env.driftX=d.driftX;env.driftY=d.driftY}}
  const nodeDisplacementEnvelopes=[...nodeDispById.values()].sort((a,b)=>a.nodeId.localeCompare(b.nodeId)),supportReactionEnvelopes=[...reactionBySupport.values()].sort((a,b)=>a.nodeId.localeCompare(b.nodeId)),displacementEnvelope=nodeDisplacementEnvelopes.reduce((best,x)=>!best||x.magnitudeMm>best.magnitudeMm?{magnitudeMm:x.magnitudeMm,nodeId:x.nodeId,governingCombinationId:x.governingCombinationId}:best,null)||{magnitudeMm:null,nodeId:null,governingCombinationId:null},ready=entries.filter(e=>e.status==='READY');
  return{contract:COMBINATION_ENVELOPE_CONTRACT,version:COMBINATION_ENVELOPE_VERSION,combinations:entries,descriptors,elementEnvelopes:[...envByElement.values()].sort((a,b)=>a.elementId.localeCompare(b.elementId)),nodeDisplacementEnvelopes,supportReactionEnvelopes,storyDriftEnvelopes:[...driftByLevel.values()].sort((a,b)=>String(a.levelId).localeCompare(String(b.levelId))),displacementEnvelope,summary:{defined:descriptors.length,solved:entries.filter(e=>e.status!=='PENDING').length,ready:ready.length,error:entries.filter(e=>e.status==='ERROR').length,pending:entries.filter(e=>e.status==='PENDING').length,elu:entries.filter(e=>e.category==='ELU').length,els:entries.filter(e=>e.category==='ELS').length,unknown:entries.filter(e=>e.category==='UNKNOWN').length,elements:envByElement.size,nodes:nodeDispById.size,supports:reactionBySupport.size,stories:driftByLevel.size},governance:{resultsOnly:true,noSyntheticResponses:true,noNormativeDriftPass:true,unknownCombinationCategoryNeverPromoted:true,eigenShapesExcludedFromPhysicalEnvelopes:true,perNodeDisplacementKeepsGoverningCombination:true,solverReactionsOnly:true,supportNodesOnly:true,restrainedReactionComponentsOnly:true,noNormativeReactionPassFail:true}};
}
