import { buildingLevelInventory } from './marketParityAdvanced.js';

export const COMBINATION_ENVELOPE_CONTRACT='combination-envelope-explorer/v1';
export const COMBINATION_ENVELOPE_VERSION='0.53.8-exp';

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
function resultNature(result){const k=norm(`${result?.analysisType||''} ${result?.type||''}`);return/modal|buckling|eigen/.test(k)?'eigen-shape':'physical'}
function forceRows(result){return Array.isArray(result?.elementForces)?result.elementForces:[]}

function componentValues(force,key){
  const map={
    N:['N1','N2','axialForce'],
    V:['Vy1','Vy2','Vz1','Vz2'],
    M:['My1','My2','Mz1','Mz2'],
    T:['T1','T2'],
    shellN:['membraneResultants.Nx','membraneResultants.Ny','membraneResultants.Nxy'],
    shellM:['bendingMoments.Mx','bendingMoments.My','bendingMoments.Mxy'],
    shellV:['transverseShear.Qx','transverseShear.Qy']
  };
  const out=[];
  for(const path of map[key]||[]){let v=force;for(const p of path.split('.'))v=v?.[p];const n=finite(v);if(n!=null)out.push({component:path.split('.').at(-1),value:n})}
  return out;
}

function updateEnvelope(env,values,combinationId){
  for(const item of values){const v=item.value;if(env.min==null||v<env.min){env.min=v;env.minCombinationId=combinationId;env.minComponent=item.component}if(env.max==null||v>env.max){env.max=v;env.maxCombinationId=combinationId;env.maxComponent=item.component}if(env.absMax==null||abs(v)>abs(env.absMax)){env.absMax=v;env.governingCombinationId=combinationId;env.governingComponent=item.component}}
}
function emptyEnvelope(){return{min:null,max:null,absMax:null,minCombinationId:null,maxCombinationId:null,governingCombinationId:null,governingComponent:null}}

function nodeLevelMap(project,inventory){
  const levels=(inventory.levels||[]).filter(l=>Number.isFinite(Number(l.elevation))).map(l=>({id:String(l.id),elevation:Number(l.elevation)}));
  const map=new Map();
  for(const n of project.nodes||[]){if(n.levelId!=null){map.set(String(n.id),String(n.levelId));continue}const z=finite(n.z);if(z==null||!levels.length)continue;let best=levels[0],d=Math.abs(z-best.elevation);for(const l of levels.slice(1)){const q=Math.abs(z-l.elevation);if(q<d){best=l;d=q}}const span=Math.max(1,...levels.map(l=>Math.abs(l.elevation)));if(d<=Math.max(1e-6,span*1e-6))map.set(String(n.id),best.id)}
  return map;
}

function storyDrifts(project,inventory,result){
  if(resultNature(result)!=='physical')return[];
  const levels=(inventory.levels||[]).filter(l=>finite(l.elevation)!=null).map(l=>({...l,elevation:Number(l.elevation)})).sort((a,b)=>a.elevation-b.elevation),nodeToLevel=nodeLevelMap(project,inventory),dmap=new Map(displacementRows(result).map(d=>[String(d.nodeId),d])),means=new Map();
  for(const l of levels){const ds=(project.nodes||[]).filter(n=>nodeToLevel.get(String(n.id))===String(l.id)).map(n=>dmap.get(String(n.id))).filter(Boolean);if(!ds.length)continue;means.set(String(l.id),{ux:ds.reduce((s,d)=>s+(Number(d.ux)||0),0)/ds.length,uy:ds.reduce((s,d)=>s+(Number(d.uy)||0),0)/ds.length,count:ds.length})}
  const rows=[];for(let i=1;i<levels.length;i++){const low=levels[i-1],high=levels[i],a=means.get(String(low.id)),b=means.get(String(high.id)),h=high.elevation-low.elevation;if(!a||!b||!(h>0))continue;const dx=b.ux-a.ux,dy=b.uy-a.uy,mag=Math.hypot(dx,dy);rows.push({levelId:String(high.id),levelLabel:text(high.name,high.id),fromLevelId:String(low.id),heightM:h,driftX:dx/h,driftY:dy/h,driftRatio:mag/h,driftMm:mag*1000,nodeCount:b.count})}
  return rows;
}

function maxDisplacement(result){
  if(!result||resultNature(result)!=='physical')return{magnitudeMm:null,nodeId:null};let best=null;
  for(const d of displacementRows(result)){const m=1000*Math.hypot(Number(d.ux)||0,Number(d.uy)||0,Number(d.uz)||0);if(!best||m>best.magnitudeMm)best={magnitudeMm:m,nodeId:String(d.nodeId)}}
  return best||{magnitudeMm:null,nodeId:null};
}

export function buildCombinationEnvelopeExplorer(project={},solvedEntries=[]){
  const inventory=buildingLevelInventory(project),descriptors=combinationDescriptors(project),descById=new Map(descriptors.map(d=>[d.id,d])),solvedById=new Map();
  for(let i=0;i<(solvedEntries||[]).length;i++){const entry=solvedEntries[i],id=text(entry?.combinationId||entry?.id||entry?.result?.scenario?.id,`comb-${i+1}`);solvedById.set(id,entry)}
  const ids=[...descriptors.map(d=>d.id),...solvedById.keys()].filter((id,i,a)=>a.indexOf(id)===i),entries=ids.map(id=>{
    const entry=solvedById.get(id)||{},descriptor=descById.get(id)||{id,name:text(entry?.name,id),category:'UNKNOWN',categorySource:'unknown',terms:[]},result=entry?.result||null,error=entry?.error?text(entry.error):null,nature=result?resultNature(result):null,disp=maxDisplacement(result),drifts=result?storyDrifts(project,inventory,result):[];
    return{combinationId:id,name:descriptor.name,category:descriptor.category,categorySource:descriptor.categorySource,terms:descriptor.terms,status:error?'ERROR':result?(nature==='physical'?'READY':'MODE_ONLY'):'PENDING',error,nature,result,displacement:disp,storyDrifts:drifts};
  });
  const elementById=new Map((project.elements||[]).map(e=>[String(e.id),e])),envByElement=new Map();
  for(const entry of entries){if(entry.status!=='READY')continue;for(const f of forceRows(entry.result)){const id=String(f.elementId||'');if(!id||!elementById.has(id))continue;let env=envByElement.get(id);if(!env){const element=elementById.get(id),shell=String(element?.type)==='shell4';env={elementId:id,label:text(element?.label||element?.name,id),type:text(element?.type),kind:shell?'shell':'bar',N:emptyEnvelope(),V:emptyEnvelope(),M:emptyEnvelope(),T:emptyEnvelope()};envByElement.set(id,env)}const shell=env.kind==='shell';updateEnvelope(env.N,componentValues(f,shell?'shellN':'N'),entry.combinationId);updateEnvelope(env.V,componentValues(f,shell?'shellV':'V'),entry.combinationId);updateEnvelope(env.M,componentValues(f,shell?'shellM':'M'),entry.combinationId);if(!shell)updateEnvelope(env.T,componentValues(f,'T'),entry.combinationId)}}
  const driftByLevel=new Map();for(const entry of entries)for(const d of entry.storyDrifts){let env=driftByLevel.get(d.levelId);if(!env){env={levelId:d.levelId,levelLabel:d.levelLabel,fromLevelId:d.fromLevelId,heightM:d.heightM,maxDriftRatio:null,maxDriftMm:null,governingCombinationId:null,driftX:null,driftY:null};driftByLevel.set(d.levelId,env)}if(env.maxDriftRatio==null||d.driftRatio>env.maxDriftRatio){env.maxDriftRatio=d.driftRatio;env.maxDriftMm=d.driftMm;env.governingCombinationId=entry.combinationId;env.driftX=d.driftX;env.driftY=d.driftY}}
  const displacementEnvelope={magnitudeMm:null,nodeId:null,governingCombinationId:null};for(const e of entries){const m=e.displacement?.magnitudeMm;if(m!=null&&(displacementEnvelope.magnitudeMm==null||m>displacementEnvelope.magnitudeMm)){displacementEnvelope.magnitudeMm=m;displacementEnvelope.nodeId=e.displacement.nodeId;displacementEnvelope.governingCombinationId=e.combinationId}}
  const ready=entries.filter(e=>e.status==='READY');
  return{contract:COMBINATION_ENVELOPE_CONTRACT,version:COMBINATION_ENVELOPE_VERSION,combinations:entries,descriptors,elementEnvelopes:[...envByElement.values()].sort((a,b)=>a.elementId.localeCompare(b.elementId)),storyDriftEnvelopes:[...driftByLevel.values()].sort((a,b)=>String(a.levelId).localeCompare(String(b.levelId))),displacementEnvelope,summary:{defined:descriptors.length,solved:entries.filter(e=>e.status!=='PENDING').length,ready:ready.length,error:entries.filter(e=>e.status==='ERROR').length,pending:entries.filter(e=>e.status==='PENDING').length,elu:entries.filter(e=>e.category==='ELU').length,els:entries.filter(e=>e.category==='ELS').length,unknown:entries.filter(e=>e.category==='UNKNOWN').length,elements:envByElement.size,stories:driftByLevel.size},governance:{resultsOnly:true,noSyntheticResponses:true,noNormativeDriftPass:true,unknownCombinationCategoryNeverPromoted:true,eigenShapesExcludedFromPhysicalEnvelopes:true}};
}
