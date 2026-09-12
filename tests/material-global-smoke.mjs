import { emptyProject } from '../web/src/core/model.js';
import { solve } from '../web/src/solver/index.js';

function assert(condition,message){if(!condition)throw new Error(message)}
function near(actual,expected,tol,message){if(Math.abs(actual-expected)>tol)throw new Error(`${message}: esperado ${expected}, obtido ${actual}`)}

function steelCantilever({axial=0,moment=2200}={}){
  const p=emptyProject(),b=.2,h=.4,A=b*h,I=b*h**3/12;
  p.name='v0.14 — cantilever com rótula de fibras';
  p.materials=[{id:'S355',name:'Steel S355 benchmark',type:'steel',E:200e6,nu:.3,density:78.5,alpha:12e-6,fy:355,fu:510,verified:false}];
  p.sections=[{id:'R200x400',name:'Retangular 200x400',family:'rect',b,h,A,I}];
  p.nodes=[{id:'N1',x:0,y:0},{id:'N2',x:2,y:0}];
  p.elements=[{id:'E1',type:'frame2d',n1:'N1',n2:'N2',materialId:'S355',sectionId:'R200x400',A,I,releases:{rz1:false,rz2:false},rotationalSprings:{rz1:null,rz2:null},fiberHinges:{rz1:{enabled:false},rz2:{enabled:true,hingeLength:.35,nFibers:100,hardeningRatio:.01}}}];
  p.supports=[{nodeId:'N1',ux:true,uy:true,rz:true}];
  p.loads=[{id:'L1',caseId:'LC1',nodeId:'N2',fx:axial,fy:0,mz:moment}];p.elementLoads=[];p.nodeSprings=[];p.settlements=[];
  p.settings={...p.settings,analysisType:'corotational',analysisScenarioId:'LC1',nonlinearSteps:12,nonlinearMaxIterations:45,nonlinearTolerance:1e-9,nonlinearLineSearch:true,materialMaxIterations:40,materialTolerance:2e-5,materialRelaxation:.7,imperfection:{...(p.settings.imperfection||{}),enabled:false}};
  return p;
}

// 1) Flexão monotônica: a rótula de fibras deve entrar em regime não linear,
// equilibrar o momento de ponta e preservar o equilíbrio global.
{
  const applied=2200,p=steelCantilever({moment:applied}),r=solve(p,'LC1');
  assert(r.solverVersion==='0.14.0-exp',`v0.14 global: solverVersion inesperada ${r.solverVersion}`);
  assert(r.materialNonlinearity?.enabled,'v0.14 global: metadado de não linearidade material ausente');
  assert(r.materialNonlinearity.hingeCount===1,'v0.14 global: contagem de rótulas incorreta');
  assert(r.materialNonlinearity.outerIterations>=2,'v0.14 global: iteração constitutiva externa não executada');
  const rec=r.materialNonlinearity.records[0],force=r.elementForces.find(x=>x.elementId==='E1'),conn=force.connectionRotations.find(x=>x.end===2),reaction=r.reactions.find(x=>x.nodeId==='N1');
  assert(conn?.type==='fiber-hinge','v0.14 global: ligação não foi marcada como fiber-hinge');
  assert(rec.yieldedFibers>0,'v0.14 global: benchmark deveria plastificar fibras');
  near(rec.constitutiveMoment,applied,Math.max(.15,Math.abs(applied)*5e-4),'v0.14 global: momento constitutivo');
  near(rec.elementMoment,rec.constitutiveMoment,Math.max(.15,Math.abs(applied)*5e-4),'v0.14 global: equilíbrio momento elemento-rótula');
  near(reaction.mz,-applied,Math.max(.2,Math.abs(applied)*5e-4),'v0.14 global: reação de momento');
  assert(Math.abs(rec.rotation)>1e-5,'v0.14 global: rotação plástica/relativa não desenvolvida');
  assert(rec.tangent<rec.secantStiffness,'v0.14 global: tangente pós-escoamento deveria ser inferior à secante');
  console.log('v0.14 — rótula de fibras global em flexão OK','M=',rec.constitutiveMoment,'theta=',rec.rotation,'fibras=',rec.yieldedFibers,'outer=',r.materialNonlinearity.outerIterations);
}

// 2) Interação N-M: o esforço normal recuperado pelo elemento é repassado à
// seção da rótula e o equilíbrio axial interno deve permanecer fechado.
{
  const axial=-1000,moment=2100,p=steelCantilever({axial,moment}),r=solve(p,'LC1'),rec=r.materialNonlinearity.records[0],reaction=r.reactions.find(x=>x.nodeId==='N1');
  near(rec.targetAxialForce,axial,Math.max(.2,Math.abs(axial)*1e-3),'v0.14 N-M: esforço normal alvo da rótula');
  assert(Math.abs(rec.axialResidual)<Math.max(1e-4,Math.abs(axial)*5e-8),`v0.14 N-M: resíduo axial excessivo ${rec.axialResidual}`);
  near(reaction.fx,-axial,Math.max(.2,Math.abs(axial)*1e-3),'v0.14 N-M: reação axial');
  near(rec.elementMoment,rec.constitutiveMoment,Math.max(.2,Math.abs(moment)*7e-4),'v0.14 N-M: equilíbrio de momento');
  assert(rec.yieldedFibers>0,'v0.14 N-M: benchmark deveria plastificar fibras');
  console.log('v0.14 — interação N-M global OK','N=',rec.targetAxialForce,'M=',rec.constitutiveMoment,'eps0=',rec.epsilon0,'fibras=',rec.yieldedFibers);
}

console.log('Todos os smoke tests globais de rótula de fibras do AstraStruct v0.14 passaram.');
