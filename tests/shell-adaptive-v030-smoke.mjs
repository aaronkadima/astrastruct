import assert from 'node:assert/strict';
import {estimateShellRecoveryError,buildConformingShellSplitPlan,planAdaptiveShellRefinement,applyAdaptiveShellRefinement} from '../web/src/core/shellAdaptiveRefinement.js';

const g=1/Math.sqrt(3),gps=[[-g,-g],[g,-g],[g,g],[-g,g]];
const nodeId=(r,c)=>`N${r}${c}`;
const nodes=[];for(let r=0;r<4;r++)for(let c=0;c<4;c++)nodes.push({id:nodeId(r,c),x:c,y:r,z:0,levelId:'L0'});
const elements=[],elementLoads=[];for(let r=0;r<3;r++)for(let c=0;c<3;c++){const id=`S${r}${c}`,ids=[nodeId(r,c),nodeId(r,c+1),nodeId(r+1,c+1),nodeId(r+1,c)];elements.push({id,type:'shell4',nodeIds:ids,n1:ids[0],n2:ids[1],n3:ids[2],n4:ids[3],levelId:'L0',materialId:'C',thickness:.2});elementLoads.push({id:`P_${id}`,caseId:'G',elementId:id,kind:'surface',pressure:-5})}
const project={id:'adaptive-shell',name:'Adaptive shell',version:13,schemaVersion:2,units:'kN-m-MPa',nodes,elements,materials:[{id:'C',name:'C',type:'concrete',E:30e6,nu:.2,density:25}],sections:[],supports:[],loads:[],elementLoads,settlements:[],nodeSprings:[],nodalMasses:[],diaphragms:[],loadCases:[{id:'G',name:'G',type:'permanent'}],loadCombinations:[],connections:[],settings:{analysisType:'linear',analysisScenarioId:'G',activeLoadCaseId:'G'}};
const shellResponse=(id,values)=>({elementId:id,type:'shell4',area:1,bendingMoments:{Mx:values.reduce((a,b)=>a+b,0)/values.length,My:0,Mxy:0},membraneResultants:{Nx:0,Ny:0,Nxy:0},transverseShear:{Qx:0,Qy:0},gaussPoints:values.map((Mx,i)=>({index:i+1,naturalCoordinates:{xi:gps[i][0],eta:gps[i][1]},bendingMoments:{Mx,My:0,Mxy:0},membraneResultants:{Nx:0,Ny:0,Nxy:0},transverseShear:{Qx:0,Qy:0},membraneStress:{sx:0,sy:0,txy:0}}))});

// Uniform field is reproduced by the recovered nodal field and therefore has
// essentially zero recovery indicator.
{
  const result={elementForces:elements.map(e=>shellResponse(e.id,[10,10,10,10]))},e=estimateShellRecoveryError(project,result,{field:'Mx',tolerance:.1});
  assert.equal(e.shellCount,9);assert.equal(e.markedCount,0);assert.ok(e.globalRelativeError<1e-12,`uniform recovery error ${e.globalRelativeError}`);
}

// A localized gradient produces a non-zero indicator and can be used to build
// an adaptive plan without changing the model during estimation.
{
  const result={elementForces:elements.map(e=>shellResponse(e.id,e.id==='S11'?[1,7,7,1]:[1,1,1,1]))},e=estimateShellRecoveryError(project,result,{field:'Mx',tolerance:10,markFraction:.1});
  assert.ok(e.globalRelativeError>0);assert.equal(e.markedCount,1);assert.equal(e.items.length,9);assert.ok(e.items[0].relativeError>=e.items.at(-1).relativeError);
  const plan=planAdaptiveShellRefinement(project,result,{field:'Mx',tolerance:10,markFraction:.1});assert.equal(plan.splitPlan.markedIds.length,1);assert.ok(plan.splitPlan.refinedCount>=1);
}

// Refining the central panel requires four transition strips, but leaves the
// four corner panels untouched: 9 -> 16 shells instead of global 9 -> 36.
{
  const plan=buildConformingShellSplitPlan(project,['S11'],{levelId:'L0'});assert.deepEqual(plan.full,['S11']);assert.equal(plan.xOnly.length,2);assert.equal(plan.yOnly.length,2);assert.equal(plan.transitionIds.length,4);assert.equal(plan.predictedShellCount,16);assert.equal(plan.nonManifoldEdges.length,0);
  assert.deepEqual(new Set(plan.xOnly),new Set(['S01','S21']));assert.deepEqual(new Set(plan.yOnly),new Set(['S10','S12']));
  const out=applyAdaptiveShellRefinement(project,{field:'Mx',tolerance:.1,estimate:{source:'test',globalRelativeError:.2},splitPlan:plan});const p=out.project,shells=p.elements.filter(e=>e.type==='shell4');assert.equal(shells.length,16);assert.equal(out.report.shellCount,16);assert.equal(p.elementLoads.filter(l=>l.kind==='surface').length,16);assert.equal(p.nodes.length,25);
  const coordKeys=p.nodes.map(n=>`${n.x.toFixed(9)}|${n.y.toFixed(9)}|${n.z.toFixed(9)}`);assert.equal(new Set(coordKeys).size,coordKeys.length,'adaptive refinement created duplicate coincident nodes');
  const byId=new Map(p.nodes.map(n=>[n.id,n])),area=shells.reduce((sum,e)=>{const q=e.nodeIds.map(id=>byId.get(id));let a=0;for(let i=0;i<4;i++){const j=(i+1)%4;a+=q[i].x*q[j].y-q[j].x*q[i].y}return sum+Math.abs(a)/2},0);assert.ok(Math.abs(area-9)<1e-10,`area after adaptive refinement ${area}`);assert.ok(p.elementLoads.every(l=>l.kind!=='surface'||l.pressure===-5));
}

console.log('shell-adaptive-v030-smoke: OK');
