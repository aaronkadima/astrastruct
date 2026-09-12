import { emptyProject } from '../web/src/core/model.js';
import { solve } from '../web/src/solver/index.js';
import { distributedSteelFiberBasicState } from '../web/src/solver/distributedPlasticity2d.js';

const assert=(c,m)=>{if(!c)throw new Error(m)};
const rel=(a,b)=>Math.abs(a-b)/Math.max(1,Math.abs(b));

const E=200e6,b=.1,h=.2,A=b*h,I=b*h**3/12,L=2;
const section={id:'R',name:'Rect',family:'rect',b,h,A,I};

{
  const material={id:'S',type:'steel',E,fy:1e6},d=[2e-4,1e-3,-5e-4],r=distributedSteelFiberBasicState({elasticBasic:d,L0:L,section,material,config:{integrationPoints:5,nFibers:160,hardeningRatio:.01}}),kb=[[E*A/L,0,0],[0,4*E*I/L,2*E*I/L],[0,2*E*I/L,4*E*I/L]],q=kb.map(row=>row.reduce((s,v,i)=>s+v*d[i],0));
  assert(rel(r.basicForces[0],q[0])<2e-5,`v0.20 elastic N mismatch ${r.basicForces[0]} vs ${q[0]}`);
  assert(rel(r.basicForces[1],q[1])<5e-4,`v0.20 elastic M1 mismatch ${r.basicForces[1]} vs ${q[1]}`);
  assert(rel(r.basicForces[2],q[2])<5e-4,`v0.20 elastic M2 mismatch ${r.basicForces[2]} vs ${q[2]}`);
  assert(r.yieldedPointCount===0,'v0.20 elastic benchmark yielded unexpectedly');
  console.log('v0.20 — limite elástico distribuído OK',r.basicForces);
}

{
  const material={id:'S',type:'steel',E,fy:355},d=[0,-.02,.01],r=distributedSteelFiberBasicState({elasticBasic:d,L0:L,section,material,config:{integrationPoints:5,nFibers:160,hardeningRatio:.01}}),root=r.sections[0],tip=r.sections.at(-1);
  assert(root.yieldedFibers>0,`v0.20 spread: raiz deveria plastificar, yielded=${root.yieldedFibers}`);
  assert(tip.yieldedFibers===0,`v0.20 spread: ponta deveria permanecer elástica, yielded=${tip.yieldedFibers}`);
  assert(r.yieldedPointCount>=1&&r.yieldedPointCount<r.integrationPoints,`v0.20 spread: distribuição de plastificação inesperada ${r.yieldedPointCount}/${r.integrationPoints}`);
  assert(r.basicTangent[1][1]<4*E*I/L,'v0.20 spread: tangente flexional não reduziu após plastificação');
  console.log('v0.20 — propagação espacial de plastificação OK',r.sections.map(s=>({xi:s.xi,y:s.yieldedFibers,M:s.M})));
}

function cantileverProject(){
  const p=emptyProject();p.name='v0.20 distributed cantilever';p.materials=[{id:'S',name:'S355',type:'steel',E,nu:.3,density:0,alpha:12e-6,fy:355}];p.sections=[section];p.nodes=[{id:'N1',x:0,y:0},{id:'N2',x:L,y:0}];p.elements=[{id:'E1',type:'frame2d',n1:'N1',n2:'N2',materialId:'S',sectionId:'R',A,I,releases:{rz1:false,rz2:false},rotationalSprings:{rz1:null,rz2:null},distributedPlasticity:{enabled:true,integrationPoints:5,nFibers:120,hardeningRatio:.02}}];p.supports=[{nodeId:'N1',ux:true,uy:true,rz:true}];p.loads=[{id:'P',caseId:'LC1',nodeId:'N2',fx:0,fy:-100,mz:0}];p.elementLoads=[];p.nodeSprings=[];p.settlements=[];p.settings={...p.settings,analysisType:'corotational',analysisScenarioId:'LC1',nonlinearControlMode:'displacement',displacementControlNodeId:'N2',displacementControlDof:'uy',displacementControlTarget:-.04,displacementControlTolerance:1e-7,nonlinearSteps:20,nonlinearMaxIterations:70,nonlinearTolerance:1e-9,nonlinearLineSearch:true,imperfection:{...p.settings.imperfection,enabled:false}};return p;
}

{
  const r=solve(cantileverProject(),'LC1'),dp=r.distributedPlasticity,rec=dp?.records?.find(x=>x.elementId==='E1'),tip=r.displacements.find(x=>x.nodeId==='N2');
  assert(r.solverVersion==='0.20.0-exp',`v0.20 global: versão ${r.solverVersion}`);assert(dp?.enabled,'v0.20 global: metadados distribuídos ausentes');assert(rec?.yieldedPointCount>0,`v0.20 global: nenhum ponto plastificado ${JSON.stringify(rec)}`);assert(Math.abs(tip.uy+.04)<2e-7,`v0.20 global: alvo de deslocamento não atingido ${tip.uy}`);assert(Number.isFinite(r.pushover?.finalLoadFactor),'v0.20 global: lambda final inválido');
  console.log('v0.20 — cantilever distribuído + pushover OK','lambda=',r.pushover.finalLoadFactor,'yielded=',rec.yieldedPointCount,'plasticLength=',rec.plasticLengthEstimate);
}

{
  const p=cantileverProject();p.elements[0].releases.rz2=true;let ok=false;try{solve(p,'LC1')}catch(e){ok=String(e?.message||e).includes('extremidades rígidas')}assert(ok,'v0.20 guard: release + plasticidade distribuída deveria ser recusado');console.log('v0.20 — guarda de compatibilidade OK');
}

console.log('Todos os smoke tests de plasticidade distribuída do AstraStruct v0.20 passaram.');
