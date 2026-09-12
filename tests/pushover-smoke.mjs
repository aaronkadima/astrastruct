import { emptyProject } from '../web/src/core/model.js';
import { solve } from '../web/src/solver/index.js';

const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const near=(actual,expected,tol,message)=>{if(Math.abs(actual-expected)>tol)throw new Error(`${message}: esperado ${expected}, obtido ${actual}`)};

function elasticCantilever(){
  const p=emptyProject();
  p.materials=[{id:'S',name:'Steel',type:'steel',E:200e6,nu:.3,density:78.5,alpha:12e-6,fy:355}];
  p.sections=[{id:'SEC',name:'sec',family:'rect',b:.1,h:.2,A:.02,I:.00006666666666666667}];
  p.nodes=[{id:'N1',x:0,y:0},{id:'N2',x:2,y:0}];
  p.elements=[{id:'E1',type:'frame2d',n1:'N1',n2:'N2',materialId:'S',sectionId:'SEC',A:.02,I:.00006666666666666667,releases:{rz1:false,rz2:false},rotationalSprings:{rz1:null,rz2:null}}];
  p.supports=[{nodeId:'N1',ux:true,uy:true,rz:true}];
  p.loads=[{id:'L',caseId:'LC1',nodeId:'N2',fx:0,fy:-10,mz:0}];p.elementLoads=[];p.nodeSprings=[];p.settlements=[];
  p.settings={...p.settings,analysisType:'corotational',analysisScenarioId:'LC1',nonlinearControlMode:'displacement',displacementControlNodeId:'N2',displacementControlDof:'uy',displacementControlTarget:-0.0005,displacementControlTolerance:1e-7,nonlinearSteps:5,nonlinearMaxIterations:30,nonlinearTolerance:1e-10,nonlinearLineSearch:true};
  return p;
}

{
  const p=elasticCantilever(),r=solve(p,'LC1'),tip=r.displacements.find(x=>x.nodeId==='N2'),reaction=r.reactions.find(x=>x.nodeId==='N1'),EI=200e6*.00006666666666666667,L=2,P=10,unitDisp=P*L**3/(3*EI),expectedLambda=.0005/unitDisp;
  assert(r.solverVersion==='0.16.0-exp',`pushover: solverVersion inesperada ${r.solverVersion}`);
  assert(r.pushover?.enabled&&r.pushover.method==='displacement-control','pushover: metadados ausentes');
  near(tip.uy,-.0005,2e-9,'pushover elástico: deslocamento controlado');
  near(r.pushover.finalLoadFactor,expectedLambda,Math.max(5e-4,Math.abs(expectedLambda)*3e-3),'pushover elástico: fator de carga');
  near(reaction.fy,10*r.pushover.finalLoadFactor,Math.max(1e-4,Math.abs(reaction.fy)*2e-4),'pushover elástico: reação');
  assert(r.pushover.curve.length===5,'pushover elástico: número de pontos da curva');
  assert(r.pushover.curve.every((x,i,a)=>i===0||Math.abs(x.controlledDisplacement)>=Math.abs(a[i-1].controlledDisplacement)-1e-12),'pushover elástico: caminho de deslocamento não monotônico');
  console.log('v0.16 — pushover elástico OK','lambda=',r.pushover.finalLoadFactor,'uy [mm]=',tip.uy*1000);
}

function fiberCantilever(){
  const p=emptyProject(),b=.2,h=.4,A=b*h,I=b*h**3/12;
  p.materials=[{id:'S355',name:'S355',type:'steel',E:200e6,nu:.3,density:78.5,alpha:12e-6,fy:355,fu:510}];
  p.sections=[{id:'R',name:'R200x400',family:'rect',b,h,A,I}];
  p.nodes=[{id:'N1',x:0,y:0},{id:'N2',x:2,y:0}];
  p.elements=[{id:'E1',type:'frame2d',n1:'N1',n2:'N2',materialId:'S355',sectionId:'R',A,I,releases:{rz1:false,rz2:false},rotationalSprings:{rz1:null,rz2:null},fiberHinges:{rz1:{enabled:true,hingeLength:.35,nFibers:100,hardeningRatio:.01},rz2:{enabled:false}}}];
  p.supports=[{nodeId:'N1',ux:true,uy:true,rz:true}];
  p.loads=[{id:'L',caseId:'LC1',nodeId:'N2',fx:0,fy:-1000,mz:0}];p.elementLoads=[];p.nodeSprings=[];p.settlements=[];
  p.settings={...p.settings,analysisType:'corotational',analysisScenarioId:'LC1',nonlinearControlMode:'displacement',displacementControlNodeId:'N2',displacementControlDof:'uy',displacementControlTarget:-.04,displacementControlTolerance:1e-6,nonlinearSteps:20,nonlinearMaxIterations:50,nonlinearTolerance:1e-8,nonlinearLineSearch:true,materialCoupling:'embedded',materialMaxIterations:50,materialTolerance:2e-5,materialRelaxation:.7};
  return p;
}

{
  const p=fiberCantilever(),r=solve(p,'LC1'),tip=r.displacements.find(x=>x.nodeId==='N2'),rec=r.materialNonlinearity.records[0];
  assert(r.solverVersion==='0.16.0-exp','pushover material: versão incorreta');
  near(tip.uy,-.04,5e-7,'pushover material: deslocamento final');
  assert(r.pushover.firstYield?.step>0,'pushover material: primeira plastificação não detectada');
  assert(r.pushover.curve.some(x=>x.yieldedHingeCount>0),'pushover material: curva não registrou rótula plastificada');
  assert(rec.yieldedFibers>0,'pushover material: estado final deveria possuir fibras escoadas');
  assert(r.materialNonlinearity.coupling==='embedded-local-newton'&&r.materialNonlinearity.outerIterations===0,'pushover material: acoplamento embutido ausente');
  assert(Number.isFinite(r.pushover.finalLoadFactor)&&r.pushover.finalLoadFactor>0,'pushover material: fator final inválido');
  console.log('v0.16 — pushover com rótula de fibras OK','lambda=',r.pushover.finalLoadFactor,'firstYield=',r.pushover.firstYield.step,'yielded=',rec.yieldedFibers);
}

{
  const p=elasticCantilever();p.settings.displacementControlNodeId='N1';p.settings.displacementControlDof='uy';let failed=false;
  try{solve(p,'LC1')}catch(e){failed=String(e?.message||e).includes('DOF livre')||String(e?.message||e).includes('restringido')}
  assert(failed,'pushover: DOF restringido deveria ser recusado');
  console.log('v0.16 — validação do DOF controlado OK');
}

console.log('Todos os smoke tests de pushover por controle de deslocamento do AstraStruct v0.16 passaram.');
