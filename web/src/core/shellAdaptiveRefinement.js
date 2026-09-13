import { buildShellNodalContour } from './shellContour.js';
import { shellFieldSamples } from './shellPostprocess.js';
import { refineShell4Mesh } from './shellRefinement.js';

const EPS=1e-12;
const clone=v=>JSON.parse(JSON.stringify(v));
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const shellIds=e=>(Array.isArray(e?.nodeIds)&&e.nodeIds.length===4?e.nodeIds:[e?.n1,e?.n2,e?.n3,e?.n4]).filter(Boolean);
const shape=(xi,eta)=>[.25*(1-xi)*(1-eta),.25*(1+xi)*(1-eta),.25*(1+xi)*(1+eta),.25*(1-xi)*(1+eta)];
const edgeKey=(a,b)=>[String(a),String(b)].sort().join('|');
const edgeBit=i=>(i===0||i===2)?1:2; // 1 => split local u (edges 0/2); 2 => split local v (edges 1/3)
const splitEdges=bits=>{const out=[];if(bits&1)out.push(0,2);if(bits&2)out.push(1,3);return out};
const elementEdges=e=>{const ids=shellIds(e);return ids.length===4?[[ids[0],ids[1]],[ids[1],ids[2]],[ids[2],ids[3]],[ids[3],ids[0]]]:[]};

function scopedShells(project,{levelId=null,elementIds=null}={}){
  const selected=Array.isArray(elementIds)&&elementIds.length?new Set(elementIds.map(String)):null,nodeMap=new Map((project?.nodes||[]).map(n=>[String(n.id),n]));
  return(project?.elements||[]).filter(e=>{
    if(e.type!=='shell4')return false;
    if(selected&&!selected.has(String(e.id)))return false;
    if(levelId!=null){const first=nodeMap.get(String(shellIds(e)[0]));if(String(e.levelId??first?.levelId??'')!==String(levelId))return false}
    return true;
  });
}

/**
 * Recovery-based indicator for shell4 result fields. The FE response at the 2x2
 * Gauss points is compared with the area-weighted, nodally-smoothed recovered
 * field interpolated back to the same points. It is an engineering refinement
 * indicator, not a formal energy-norm error bound.
 */
export function estimateShellRecoveryError(project,result,{field='Mx',levelId=null,elementIds=null,tolerance=.15,markFraction=0,weighting='area'}={}){
  const shells=scopedShells(project,{levelId,elementIds}),shellMap=new Map(shells.map(e=>[String(e.id),e])),responses=(result?.elementForces||[]).filter(r=>r?.type==='shell4'&&shellMap.has(String(r.elementId))),nodal=buildShellNodalContour(project,result,field,{weighting}),byNode=nodal?.byNode||{};
  const allSamples=responses.flatMap(r=>shellFieldSamples(r,field)),globalReference=Math.max(0,...allSamples.map(x=>Math.abs(finite(x.value)))),tol=Math.max(0,Math.min(10,Math.abs(finite(tolerance,.15)))),items=[];
  let globalErr2=0,globalRef2=0;
  for(const response of responses){
    const e=shellMap.get(String(response.elementId)),ids=shellIds(e);if(ids.length!==4)continue;const center=allSamples.length?finite(shellFieldSamples(response,field)[0]?.value):0,q=ids.map(id=>finite(byNode[String(id)],center)),samples=shellFieldSamples(response,field);if(!samples.length)continue;
    let err2=0,ref2=0,maxAbsError=0,maxAbsReference=0;
    for(const s of samples){const xi=finite(s.naturalCoordinates?.xi),eta=finite(s.naturalCoordinates?.eta),N=shape(xi,eta),smooth=N.reduce((sum,w,i)=>sum+w*q[i],0),raw=finite(s.value),d=raw-smooth;err2+=d*d;ref2+=raw*raw;maxAbsError=Math.max(maxAbsError,Math.abs(d));maxAbsReference=Math.max(maxAbsReference,Math.abs(raw))}
    const n=Math.max(1,samples.length),rmsError=Math.sqrt(err2/n),rmsReference=Math.sqrt(ref2/n),den=Math.max(rmsReference,globalReference*1e-6,EPS),relativeError=rmsError/den;globalErr2+=err2;globalRef2+=ref2;
    items.push({elementId:e.id,relativeError,rmsError,rmsReference,maxAbsError,maxAbsReference,samples:samples.length,marked:relativeError>=tol});
  }
  items.sort((a,b)=>b.relativeError-a.relativeError);
  const fraction=Math.max(0,Math.min(1,finite(markFraction,0)));if(fraction>0&&items.length){const count=Math.max(1,Math.ceil(items.length*fraction));for(let i=0;i<count;i++)items[i].marked=true}
  const markedIds=items.filter(x=>x.marked).map(x=>x.elementId),globalRelativeError=Math.sqrt(globalErr2)/Math.max(Math.sqrt(globalRef2),globalReference*1e-6,EPS);
  return{field,tolerance:tol,weighting,levelId:levelId??null,source:'gauss-2x2-vs-smoothed-nodal',globalReference,globalRelativeError,items,markedIds,markedCount:markedIds.length,shellCount:items.length};
}

/**
 * Expand marked shells into the minimum 2x1/1x2 transition strips required to
 * avoid hanging edge-midpoint nodes. A marked shell receives 2x2. Neighbours
 * receive only the local split direction needed by the shared edge; propagation
 * continues until every split edge is matched on both sides.
 */
export function buildConformingShellSplitPlan(project,markedIds,{levelId=null}={}){
  const shells=(project?.elements||[]).filter(e=>e.type==='shell4'),shellMap=new Map(shells.map(e=>[String(e.id),e])),edgeMap=new Map(),nonManifold=[];
  for(const e of shells){const edges=elementEdges(e);for(let i=0;i<edges.length;i++){const key=edgeKey(edges[i][0],edges[i][1]);if(!edgeMap.has(key))edgeMap.set(key,[]);edgeMap.get(key).push({elementId:String(e.id),edgeIndex:i})}}
  for(const [key,entries] of edgeMap)if(entries.length>2)nonManifold.push({edge:key,count:entries.length,elements:entries.map(x=>x.elementId)});
  const requested=[...new Set((markedIds||[]).map(String).filter(id=>shellMap.has(id)))],requirements=new Map(),queue=[];
  const add=(id,bits)=>{const old=requirements.get(id)||0,next=old|bits;if(next!==old){requirements.set(id,next);queue.push(id)}};for(const id of requested)add(id,3);
  while(queue.length){const id=queue.shift(),e=shellMap.get(id);if(!e)continue;const bits=requirements.get(id)||0,edges=elementEdges(e);for(const ei of splitEdges(bits)){const edge=edges[ei],entries=edgeMap.get(edgeKey(edge[0],edge[1]))||[];for(const n of entries){if(n.elementId===id)continue;add(n.elementId,edgeBit(n.edgeIndex))}}}
  const full=[],xOnly=[],yOnly=[];for(const [id,bits] of requirements){if(bits===3)full.push(id);else if(bits===1)xOnly.push(id);else if(bits===2)yOnly.push(id)}
  const requestedSet=new Set(requested),transitionIds=[...requirements.keys()].filter(id=>!requestedSet.has(id)),refinedCount=requirements.size,predictedShellCount=shells.length-refinedCount+4*full.length+2*xOnly.length+2*yOnly.length;
  return{kind:'shell4-conforming-adaptive-plan',levelId:levelId??null,markedIds:requested,full,xOnly,yOnly,transitionIds,refinedCount,predictedShellCount,sourceShellCount:shells.length,nonManifoldEdges:nonManifold,requirements:Object.fromEntries([...requirements.entries()].map(([id,bits])=>[id,bits===3?'2x2':bits===1?'2x1':'1x2']))};
}

export function planAdaptiveShellRefinement(project,result,options={}){
  const estimate=estimateShellRecoveryError(project,result,options),splitPlan=buildConformingShellSplitPlan(project,estimate.markedIds,{levelId:options.levelId??null});
  return{kind:'shell4-adaptive-plan',field:estimate.field,tolerance:estimate.tolerance,estimate,splitPlan,createdAt:new Date().toISOString()};
}

export function applyAdaptiveShellRefinement(project,plan,{tolerance=1e-7}={}){
  if(!plan?.splitPlan)throw new Error('Refinamento adaptativo shell4: plano inválido.');const sp=plan.splitPlan;if(!(sp.refinedCount>0))return{project:clone(project),report:{...plan,applied:false,reason:'no-elements-marked'}};
  let p=clone(project);const passes=[];
  const apply=(ids,divisionsX,divisionsY,label)=>{if(!ids?.length)return;const out=refineShell4Mesh(p,{elementIds:ids,divisionsX,divisionsY,tolerance});p=out.project;passes.push({label,elementIds:[...ids],...out.report})};
  // 2x2 first creates all four edge midpoints. Transition strips then reuse
  // those exact nodes through the geometric node index in refineShell4Mesh.
  apply(sp.full,2,2,'2x2');apply(sp.xOnly,2,1,'2x1');apply(sp.yOnly,1,2,'1x2');
  const shellCount=(p.elements||[]).filter(e=>e.type==='shell4').length,report={kind:'shell4-adaptive-refinement',applied:true,field:plan.field,tolerance:plan.tolerance,indicatorSource:plan.estimate?.source,globalRelativeError:plan.estimate?.globalRelativeError,markedIds:[...(sp.markedIds||[])],transitionIds:[...(sp.transitionIds||[])],full:[...(sp.full||[])],xOnly:[...(sp.xOnly||[])],yOnly:[...(sp.yOnly||[])],sourceShellCount:sp.sourceShellCount,predictedShellCount:sp.predictedShellCount,shellCount,passes,nonManifoldEdges:sp.nonManifoldEdges||[],createdAt:new Date().toISOString()};
  p.meta={...(p.meta||{}),shellAdaptiveRefinementUpdatedAt:new Date().toISOString(),lastShellAdaptiveRefinementReport:report};return{project:p,report};
}
