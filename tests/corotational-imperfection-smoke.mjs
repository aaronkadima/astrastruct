import { emptyProject, makeFrameElement } from '../web/src/core/model.js';
import { solve } from '../web/src/solver/index.js';
import { solveFrameCorotational2D } from '../web/src/solver/corotational2d.js';

function assert(condition,message){if(!condition)throw new Error(message)}
function near(actual,expected,tol,message){if(Math.abs(actual-expected)>tol)throw new Error(`${message}: esperado ${expected}, obtido ${actual}`)}

function pinColumn({ne=16,L=6,E=30e6,A=.15,I=.003125,P=0}={}){
  const p=emptyProject(),le=L/ne;
  p.name='Co-rotacional — coluna imperfeita';
  p.materials=(p.materials||[]).map(m=>m.id==='concrete30'?{...m,E}:m);
  p.nodes=Array.from({length:ne+1},(_,i)=>({id:`N${i}`,x:0,y:i*le}));
  p.elements=Array.from({length:ne},(_,i)=>makeFrameElement({id:`E${i+1}`,n1:`N${i}`,n2:`N${i+1}`,materialId:'concrete30',sectionId:'rc_30x50',A,I}));
  p.supports=[{nodeId:'N0',ux:true,uy:true,rz:false},{nodeId:`N${ne}`,ux:true,uy:false,rz:false}];
  p.loads=P?[{id:'P',caseId:'LC1',nodeId:`N${ne}`,fx:0,fy:-P,mz:0}]:[];
  p.elementLoads=[];p.nodeSprings=[];p.settlements=[];
  return p;
}

function sineImperfection(project,e0){
  const nodes=project.nodes||[],L=Math.max(...nodes.map(n=>Number(n.y)))-Math.min(...nodes.map(n=>Number(n.y))),vector=Array(nodes.length*3).fill(0);
  nodes.forEach((n,i)=>{const y=Number(n.y);vector[3*i]=e0*Math.sin(Math.PI*y/L)});
  return{source:'analytic-sine-benchmark',mode:1,amplitude:e0,amplitudeMm:e0*1000,vector};
}

// 1) A geometria imperfeita é referência sem tensões: e0 existe mesmo com Δu=0,
// mas não pode produzir esforços internos nem alterar as coordenadas nominais do projeto.
{
  const e0=.01,p=pinColumn({ne:12,P:0}),before=JSON.stringify(p.nodes),imp=sineImperfection(p,e0),r=solveFrameCorotational2D(p,'LC1',{initialImperfection:imp,steps:1,maxIterations:10,tolerance:1e-10});
  const mid=r.initialDisplacements[Math.floor(r.initialDisplacements.length/2)],total=r.totalDisplacements[Math.floor(r.totalDisplacements.length/2)],maxIncrement=Math.max(...r.displacements.flatMap(d=>[Math.abs(d.ux),Math.abs(d.uy),Math.abs(d.rz)])),maxForce=Math.max(...r.elementForces.flatMap(f=>[f.basicForces.N,f.basicForces.M1,f.basicForces.M2].map(Math.abs)));
  near(mid.ux,e0,1e-12,'Imperfeição co-rotacional sem carga: e0 no meio');near(total.ux,e0,1e-12,'Imperfeição co-rotacional sem carga: deslocamento total');assert(maxIncrement<1e-12,`Imperfeição co-rotacional sem carga: incremento espúrio ${maxIncrement}`);assert(maxForce<1e-7,`Imperfeição co-rotacional sem carga: força espúria ${maxForce}`);
  assert(JSON.stringify(p.nodes)===before,'Imperfeição co-rotacional: solver alterou as coordenadas nominais do projeto');
  assert(r.elementResponses.every(x=>x.initialGeometry),'Imperfeição co-rotacional: pós-processamento não marcou a geometria inicial');
  const station=r.elementResponses[Math.floor(r.elementResponses.length/2)].stations[0];assert(Number.isFinite(station.xr)&&Number.isFinite(station.xd)&&Number.isFinite(station.u0x),'Imperfeição co-rotacional: geometria nominal/referência/corrente incompleta');
  console.log('Co-rotacional — referência imperfeita sem tensões OK','e0 [mm]=',e0*1000,'max força=',maxForce);
}

// 2) Coluna biarticulada com imperfeição senoidal e compressão abaixo de Euler.
// No regime de pequenas rotações: e_total = e0/(1-P/Pcr).
{
  const L=6,E=30e6,I=.003125,A=.15,e0=.003,ratio=.15,Pcr=Math.PI*Math.PI*E*I/(L*L),P=ratio*Pcr,p=pinColumn({ne:24,L,E,A,I,P}),imp=sineImperfection(p,e0),r=solveFrameCorotational2D(p,'LC1',{initialImperfection:imp,steps:12,maxIterations:45,tolerance:1e-9}),mid=r.totalDisplacements[Math.floor(r.totalDisplacements.length/2)],expected=e0/(1-ratio),relative=Math.abs(Math.abs(mid.ux)-expected)/expected;
  assert(relative<.012,`Imperfeição co-rotacional: amplificação senoidal divergiu da teoria (${relative})`);assert(Math.abs(mid.ux)>e0,'Imperfeição co-rotacional: compressão não amplificou e0');
  console.log('Co-rotacional — amplificação de imperfeição senoidal OK','P/Pcr=',ratio,'e total [mm]=',Math.abs(mid.ux)*1000,'teórico [mm]=',expected*1000,'erro rel=',relative);
}

// 3) Integração real com o solver de flambagem: o dispatcher obtém φ1,
// normaliza para e0 e cria a referência imperfeita sem mutar o modelo nominal.
{
  const L=6,E=30e6,I=.003125,A=.15,Pcr=Math.PI*Math.PI*E*I/(L*L),p=pinColumn({ne:12,L,E,A,I,P:.10*Pcr}),before=JSON.stringify(p.nodes);
  p.settings={...(p.settings||{}),analysisType:'corotational',nonlinearSteps:10,nonlinearMaxIterations:40,nonlinearTolerance:1e-9,imperfection:{enabled:true,source:'bucklingMode',scenarioId:'LC1',mode:1,amplitudeMm:4}};
  const r=solve(p,'LC1'),maxInitial=Math.max(...r.initialDisplacements.flatMap(d=>[Math.abs(d.ux),Math.abs(d.uy)])),mid=r.totalDisplacements[Math.floor(r.totalDisplacements.length/2)];
  near(maxInitial,.004,2e-8,'Imperfeição modal co-rotacional: normalização e0');assert(r.imperfection?.source==='bucklingMode','Imperfeição modal co-rotacional: fonte modal ausente');assert(r.imperfection?.criticalFactor>1,'Imperfeição modal co-rotacional: λcr ausente');assert(Math.abs(mid.ux)>.004,'Imperfeição modal co-rotacional: resposta comprimida não amplificou a forma inicial');
  assert(r.elementResponses.every(x=>x.initialGeometry),'Imperfeição modal co-rotacional: geometria inicial ausente no pós-processamento');assert(JSON.stringify(p.nodes)===before,'Imperfeição modal co-rotacional: dispatcher alterou nós nominais');
  console.log('Co-rotacional — imperfeição modal via flambagem OK','lambda=',r.imperfection.criticalFactor,'e0 [mm]=',maxInitial*1000,'e total meio [mm]=',Math.abs(mid.ux)*1000);
}

console.log('Todos os smoke tests de imperfeição geométrica co-rotacional passaram.');
