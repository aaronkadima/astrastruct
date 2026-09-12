import { emptyProject } from '../web/src/core/model.js';
import { solve } from '../web/src/solver/index.js';
import { solveBuckling2D } from '../web/src/solver/buckling2d.js';

const assert=(c,m)=>{if(!c)throw new Error(m)};
const nearRel=(a,b,r,m)=>{if(Math.abs(a-b)>r*Math.max(1,Math.abs(b)))throw new Error(`${m}: esperado ~${b}, obtido ${a}`)};

function eulerColumn(branchSwitchEnabled=false){
  const p=emptyProject(),L=4,n=8,P=10000,E=200e6,I=8e-5,A=.01;
  p.materials=[{id:'S',name:'Steel elastic',type:'steel',E,nu:.3,density:0,alpha:12e-6,fy:355}];
  p.sections=[{id:'SEC',name:'Column',family:'rect',b:.1,h:.8,A,I}];
  p.nodes=Array.from({length:n+1},(_,i)=>({id:`N${i}`,x:0,y:L*i/n}));p.elements=[];
  for(let i=0;i<n;i++)p.elements.push({id:`E${i+1}`,type:'frame2d',n1:`N${i}`,n2:`N${i+1}`,materialId:'S',sectionId:'SEC',A,I,releases:{rz1:false,rz2:false},rotationalSprings:{rz1:null,rz2:null}});
  p.supports=[{nodeId:'N0',ux:true,uy:true,rz:false},{nodeId:`N${n}`,ux:true,uy:false,rz:false}];
  p.loads=[{id:'P',caseId:'LC1',nodeId:`N${n}`,fx:0,fy:-P,mz:0}];p.elementLoads=[];p.nodeSprings=[];p.settlements=[];
  p.settings={...p.settings,analysisType:'corotational',analysisScenarioId:'LC1',nonlinearControlMode:'arc-length',arcLengthMonitorNodeId:`N${n/2}`,arcLengthMonitorDof:'ux',arcLengthInitialLoadIncrement:.06,arcLengthInitialSign:1,arcLengthTargetIterations:5,arcLengthMaxCutbacks:12,arcLengthMinRadiusFactor:.001,arcLengthMaxRadiusFactor:1.5,arcLengthConstraintTolerance:1e-6,nonlinearSteps:30,nonlinearMaxIterations:70,nonlinearTolerance:1e-9,nonlinearLineSearch:true,stabilityTracking:true,stabilityEigenTolerance:.08,stabilityAsymmetryTolerance:1e-7,stabilityMaxDofs:120,branchSwitchEnabled,branchSwitchSign:1,branchSwitchAmplitude:.12};
  return p;
}

{
  const p=eulerColumn(false),linear=solveBuckling2D(p,'LC1',{modes:1}),r=solve(p,'LC1'),events=r.arcLength?.stability?.events||[],bif=events.find(e=>e.type==='bifurcation-candidate');
  assert(r.solverVersion==='0.18.0-exp',`v0.18: versão inesperada ${r.solverVersion}`);
  assert(r.arcLength?.stability?.enabled,'v0.18: diagnóstico espectral ausente');
  assert(bif,'v0.18: bifurcação da coluna de Euler não detectada');
  nearRel(bif.criticalLoadFactor,linear.criticalFactor,.12,'v0.18: fator crítico não acompanha flambagem linear');
  assert(bif.dominant?.dof==='ux',`v0.18: modo crítico deveria ser lateral ux, obtido ${bif.dominant?.dof}`);
  assert(Math.abs(bif.tangentAsymmetry)<1e-7,'v0.18: coluna conservativa apareceu não simétrica');
  console.log('v0.18 — classificação de bifurcação Euler OK','arc=',bif.criticalLoadFactor,'linear=',linear.criticalFactor,'dominante=',bif.dominant);
}

{
  const r=solve(eulerColumn(true),'LC1'),sw=r.arcLength?.stability?.branchSwitch?.switches||[],bif=(r.arcLength?.stability?.events||[]).find(e=>e.type==='bifurcation-candidate'),curve=r.arcLength?.curve||[],maxUx=Math.max(0,...curve.map(x=>Math.abs(Number(x.monitoredDisplacement)||0)));
  assert(bif,'v0.18 branch switch: bifurcação não detectada');
  assert(sw.length>=1,'v0.18 branch switch: perturbação modal não foi aplicada');
  assert(sw[0].predictor?.orientation==='critical-eigenmode-orthogonal-perturbation','v0.18 branch switch: metadado do preditor ausente');
  assert(maxUx>1e-5,`v0.18 branch switch: ramo lateral não foi excitado, maxUx=${maxUx}`);
  console.log('v0.18 — branch switch modal experimental OK','switch=',sw[0],'maxUx [mm]=',maxUx*1000);
}

// The shallow-arch limit point from the v0.17 benchmark should not be mislabeled as a pitchfork bifurcation.
{
  const p=emptyProject(),E=200e6,A=1e-4,I=1e-8;p.materials=[{id:'S',name:'Steel',type:'steel',E,nu:.3,density:0,alpha:12e-6,fy:355}];p.sections=[{id:'SEC',name:'axial',family:'rect',b:.01,h:.01,A,I}];p.nodes=[{id:'L',x:-1,y:0},{id:'C',x:0,y:.1},{id:'R',x:1,y:0}];p.elements=[{id:'E1',type:'frame2d',n1:'L',n2:'C',materialId:'S',sectionId:'SEC',A,I,releases:{rz1:true,rz2:true},rotationalSprings:{rz1:0,rz2:0}},{id:'E2',type:'frame2d',n1:'C',n2:'R',materialId:'S',sectionId:'SEC',A,I,releases:{rz1:true,rz2:true},rotationalSprings:{rz1:0,rz2:0}}];p.supports=[{nodeId:'L',ux:true,uy:true,rz:true},{nodeId:'R',ux:true,uy:true,rz:true},{nodeId:'C',ux:true,uy:false,rz:true}];p.loads=[{id:'P',caseId:'LC1',nodeId:'C',fx:0,fy:-10,mz:0}];p.settings={...p.settings,analysisType:'corotational',nonlinearControlMode:'arc-length',arcLengthMonitorNodeId:'C',arcLengthMonitorDof:'uy',arcLengthInitialLoadIncrement:.08,arcLengthTargetIterations:5,arcLengthMaxCutbacks:10,arcLengthMinRadiusFactor:.005,arcLengthMaxRadiusFactor:3,nonlinearSteps:32,nonlinearMaxIterations:60,nonlinearTolerance:1e-9,stabilityTracking:true};
  const r=solve(p,'LC1'),events=r.arcLength?.stability?.events||[];
  assert(events.some(e=>e.type==='limit-point'),`v0.18: ponto-limite do arco raso não foi classificado; eventos=${JSON.stringify(events.map(e=>e.type))}`);
  console.log('v0.18 — classificação de ponto-limite OK',events.filter(e=>e.type==='limit-point').map(e=>e.criticalLoadFactor));
}

console.log('Todos os smoke tests de estabilidade/bifurcação do AstraStruct v0.18 passaram.');
