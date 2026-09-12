import { emptyProject } from '../web/src/core/model.js';
import { solve } from '../web/src/solver/index.js';

const assert=(c,m)=>{if(!c)throw new Error(m)};
const near=(a,b,t,m)=>{if(Math.abs(a-b)>t)throw new Error(`${m}: esperado ${b}, obtido ${a}`)};

function shallowArch(){
  const p=emptyProject(),E=200e6,A=1e-4,I=1e-8;
  p.materials=[{id:'S',name:'Steel',type:'steel',E,nu:.3,density:0,alpha:12e-6,fy:355}];
  p.sections=[{id:'SEC',name:'axial',family:'rect',b:.01,h:.01,A,I}];
  p.nodes=[{id:'L',x:-1,y:0},{id:'C',x:0,y:.1},{id:'R',x:1,y:0}];
  p.elements=[
    {id:'E1',type:'frame2d',n1:'L',n2:'C',materialId:'S',sectionId:'SEC',A,I,releases:{rz1:true,rz2:true},rotationalSprings:{rz1:0,rz2:0}},
    {id:'E2',type:'frame2d',n1:'C',n2:'R',materialId:'S',sectionId:'SEC',A,I,releases:{rz1:true,rz2:true},rotationalSprings:{rz1:0,rz2:0}}
  ];
  p.supports=[{nodeId:'L',ux:true,uy:true,rz:true},{nodeId:'R',ux:true,uy:true,rz:true},{nodeId:'C',ux:true,uy:false,rz:true}];
  p.loads=[{id:'P',caseId:'LC1',nodeId:'C',fx:0,fy:-10,mz:0}];p.elementLoads=[];p.nodeSprings=[];p.settlements=[];
  p.settings={...p.settings,analysisType:'corotational',analysisScenarioId:'LC1',nonlinearControlMode:'arc-length',arcLengthMonitorNodeId:'C',arcLengthMonitorDof:'uy',arcLengthInitialLoadIncrement:.08,arcLengthInitialSign:1,arcLengthTargetIterations:5,arcLengthMaxCutbacks:10,arcLengthMinRadiusFactor:.005,arcLengthMaxRadiusFactor:3,arcLengthConstraintTolerance:2e-6,nonlinearSteps:32,nonlinearMaxIterations:60,nonlinearTolerance:1e-9,nonlinearLineSearch:true};
  return p;
}

{
  const p=shallowArch(),r=solve(p,'LC1'),curve=r.arcLength?.curve||[],L0=Math.hypot(1,.1),EA=200e6*1e-4;
  assert(r.solverVersion==='0.18.0-exp',`arc-length: versão inesperada ${r.solverVersion}`);
  assert(r.arcLength?.enabled&&r.arcLength.method==='crisfield-spherical','arc-length: metadados ausentes');
  assert(curve.length===32,'arc-length: número de passos incorreto');
  for(const row of curve){
    const y=.1+row.monitoredDisplacement,l=Math.hypot(1,y),N=EA/L0*(l-L0),expected=-2*N*y/l/10;
    near(row.loadFactor,expected,Math.max(2e-3,Math.abs(expected)*4e-3),`arc-length: equilíbrio analítico no passo ${row.step}`);
  }
  const turning=(r.arcLength.turningPoints||[]).find(x=>x.type==='load-factor-turning');
  assert(turning,'arc-length: ponto-limite de carga não detectado');
  const i=curve.findIndex(x=>x.step===turning.step);assert(i>0&&i<curve.length-1,'arc-length: ponto-limite fora do interior da curva');
  assert(curve[i-1].loadFactor<curve[i].loadFactor&&curve[i+1].loadFactor<curve[i].loadFactor,'arc-length: lambda não atravessou o máximo local');
  assert(curve[i+1].monitoredDisplacement<curve[i].monitoredDisplacement,'arc-length: deslocamento deveria continuar no ramo pós-pico');
  assert(curve.some((x,j)=>j>i&&x.loadIncrement<0),'arc-length: fator de carga não reverteu após o ponto-limite');
  console.log('v0.17 — shallow arch snap-through OK','turning=',turning,'lambdaFinal=',r.arcLength.finalLoadFactor);
}

function fiberCantilever(){
  const p=emptyProject(),b=.2,h=.4,A=b*h,I=b*h**3/12;
  p.materials=[{id:'S355',name:'S355',type:'steel',E:200e6,nu:.3,density:0,alpha:12e-6,fy:355,fu:510}];
  p.sections=[{id:'R',name:'R200x400',family:'rect',b,h,A,I}];
  p.nodes=[{id:'N1',x:0,y:0},{id:'N2',x:2,y:0}];
  p.elements=[{id:'E1',type:'frame2d',n1:'N1',n2:'N2',materialId:'S355',sectionId:'R',A,I,releases:{rz1:false,rz2:false},rotationalSprings:{rz1:null,rz2:null},fiberHinges:{rz1:{enabled:true,hingeLength:.35,nFibers:80,hardeningRatio:.01},rz2:{enabled:false}}}];
  p.supports=[{nodeId:'N1',ux:true,uy:true,rz:true}];p.loads=[{id:'L',caseId:'LC1',nodeId:'N2',fx:0,fy:-800,mz:0}];p.elementLoads=[];p.nodeSprings=[];p.settlements=[];
  p.settings={...p.settings,analysisType:'corotational',analysisScenarioId:'LC1',nonlinearControlMode:'arc-length',arcLengthMonitorNodeId:'N2',arcLengthMonitorDof:'uy',arcLengthInitialLoadIncrement:.04,arcLengthTargetIterations:6,arcLengthMaxCutbacks:8,nonlinearSteps:10,nonlinearMaxIterations:50,nonlinearTolerance:1e-8,materialCoupling:'embedded',materialMaxIterations:45,materialTolerance:2e-5,materialRelaxation:.7};
  return p;
}
{
  const r=solve(fiberCantilever(),'LC1');
  assert(r.solverVersion==='0.18.0-exp','arc-length material: versão incorreta');
  assert(r.materialNonlinearity?.coupling==='embedded-local-newton','arc-length material: acoplamento local não preservado');
  assert(r.arcLength?.curve?.length===10,'arc-length material: curva ausente');
  assert(Number.isFinite(r.arcLength.finalLoadFactor),'arc-length material: lambda final inválido');
  console.log('v0.17 — arc-length + rótula de fibras OK','lambda=',r.arcLength.finalLoadFactor);
}

console.log('Todos os smoke tests de arc-length/Riks do AstraStruct v0.17 passaram.');
