import { emptyProject } from '../web/src/core/model.js';
import { solve } from '../web/src/solver/index.js';

function assert(condition,message){if(!condition)throw new Error(message)}
function near(actual,expected,tol,message){if(Math.abs(actual-expected)>tol)throw new Error(`${message}: esperado ${expected}, obtido ${actual}`)}

function sectionProperties(section){
  if(section.family==='i'){
    const hi=section.h-2*section.tf,bi=section.b-section.tw;
    return{A:2*section.b*section.tf+hi*section.tw,I:(section.b*section.h**3-bi*hi**3)/12};
  }
  if(section.family==='rhs'){
    const hi=section.h-2*section.t,bi=section.b-2*section.t;
    return{A:section.b*section.h-bi*hi,I:(section.b*section.h**3-bi*hi**3)/12};
  }
  return{A:section.b*section.h,I:section.b*section.h**3/12};
}

function steelCantilever({axial=0,moment=2200,section={id:'R200x400',name:'Retangular 200x400',family:'rect',b:.2,h:.4},nFibers=100}={}){
  const p=emptyProject(),{A,I}=sectionProperties(section),sec={...section,A,I};
  p.name='v0.14.2 — cantilever com rótula de fibras';
  p.materials=[{id:'S355',name:'Steel S355 benchmark',type:'steel',E:200e6,nu:.3,density:78.5,alpha:12e-6,fy:355,fu:510,verified:false}];
  p.sections=[sec];
  p.nodes=[{id:'N1',x:0,y:0},{id:'N2',x:2,y:0}];
  p.elements=[{id:'E1',type:'frame2d',n1:'N1',n2:'N2',materialId:'S355',sectionId:sec.id,A,I,releases:{rz1:false,rz2:false},rotationalSprings:{rz1:null,rz2:null},fiberHinges:{rz1:{enabled:false},rz2:{enabled:true,hingeLength:.35,nFibers,hardeningRatio:.01}}}];
  p.supports=[{nodeId:'N1',ux:true,uy:true,rz:true}];
  p.loads=[{id:'L1',caseId:'LC1',nodeId:'N2',fx:axial,fy:0,mz:moment}];p.elementLoads=[];p.nodeSprings=[];p.settlements=[];
  p.settings={...p.settings,analysisType:'corotational',analysisScenarioId:'LC1',nonlinearSteps:12,nonlinearMaxIterations:45,nonlinearTolerance:1e-9,nonlinearLineSearch:true,materialMaxIterations:40,materialTolerance:2e-5,materialRelaxation:.7,imperfection:{...(p.settings.imperfection||{}),enabled:false}};
  return p;
}

// 1) Flexão monotônica retangular: a rótula de fibras deve entrar em regime não linear,
// equilibrar o momento de ponta e preservar o equilíbrio global.
{
  const applied=2200,p=steelCantilever({moment:applied}),r=solve(p,'LC1');
  assert(r.solverVersion==='0.15.0-exp',`v0.14.2 global: solverVersion inesperada ${r.solverVersion}`);
  assert(r.materialNonlinearity?.enabled,'v0.14 global: metadado de não linearidade material ausente');
  assert(String(r.materialNonlinearity.linearization||'').includes('tangent-affine'),'v0.15 global: linearização tangente-afim não foi ativada');
  assert(String(r.materialNonlinearity.globalStrategy||'').includes('embedded'),'v0.15 global: estratégia material embutida não registrada');
  assert(r.materialNonlinearity.supportedSectionFamilies?.includes('i'),'v0.14.2 global: perfil I/H não declarado no escopo');
  assert(r.materialNonlinearity.hingeCount===1,'v0.14 global: contagem de rótulas incorreta');
  assert(r.materialNonlinearity.coupling==='embedded-local-newton','v0.15 global: acoplamento material embutido não ativado');assert(r.materialNonlinearity.outerIterations===0,'v0.15 global: não deveria existir iteração material global externa');assert(r.materialNonlinearity.maxLocalIterations>=2,'v0.15 global: Newton constitutivo local não foi executado');
  const rec=r.materialNonlinearity.records[0],force=r.elementForces.find(x=>x.elementId==='E1'),conn=force.connectionRotations.find(x=>x.end===2),reaction=r.reactions.find(x=>x.nodeId==='N1');
  assert(conn?.type==='fiber-hinge','v0.14 global: ligação não foi marcada como fiber-hinge');
  assert(rec.sectionFamily==='rect','v0.14.2 global: família retangular não rastreada');
  assert(rec.yieldedFibers>0,'v0.14 global: benchmark deveria plastificar fibras');
  assert(Number.isFinite(rec.appliedStiffness)&&rec.appliedStiffness>0,'v0.14.2 global: rigidez tangente aplicada inválida');
  assert(Number.isFinite(rec.appliedOffsetMoment),'v0.14.2 global: termo afim M0 ausente');
  near(rec.constitutiveMoment,applied,Math.max(.15,Math.abs(applied)*5e-4),'v0.14 global: momento constitutivo');
  near(rec.elementMoment,rec.constitutiveMoment,Math.max(.15,Math.abs(applied)*5e-4),'v0.14 global: equilíbrio momento elemento-rótula');
  near(reaction.mz,-applied,Math.max(.2,Math.abs(applied)*5e-4),'v0.14 global: reação de momento');
  assert(Math.abs(rec.rotation)>1e-5,'v0.14 global: rotação plástica/relativa não desenvolvida');
  assert(rec.tangent<rec.secantStiffness,'v0.14 global: tangente pós-escoamento deveria ser inferior à secante');
  console.log('v0.15 — rótula retangular global em flexão OK','M=',rec.constitutiveMoment,'theta=',rec.rotation,'fibras=',rec.yieldedFibers,'outer=',r.materialNonlinearity.outerIterations);
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
  console.log('v0.14.2 — interação N-M global OK','N=',rec.targetAxialForce,'M=',rec.constitutiveMoment,'eps0=',rec.epsilon0,'fibras=',rec.yieldedFibers);
}

// 3) Perfil I/H: a mesma ligação tangente-afim deve funcionar com mesas e alma
// discretizadas independentemente e conservar o equilíbrio global pós-escoamento.
{
  const section={id:'I400x200',name:'I 400x200 benchmark',family:'i',h:.4,b:.2,tw:.01,tf:.016},applied=530,p=steelCantilever({moment:applied,section,nFibers:180}),r=solve(p,'LC1'),rec=r.materialNonlinearity.records[0],force=r.elementForces.find(x=>x.elementId==='E1'),conn=force.connectionRotations.find(x=>x.end===2),reaction=r.reactions.find(x=>x.nodeId==='N1');
  assert(rec.sectionFamily==='i','v0.14.2 I/H global: família não rastreada');assert(conn?.sectionFamily==='i','v0.14.2 I/H global: metadado da ligação ausente');assert(rec.yieldedFibers>0,'v0.14.2 I/H global: perfil deveria plastificar fibras');assert(rec.fiberCount===180,'v0.14.2 I/H global: número de fibras inesperado');
  near(rec.constitutiveMoment,applied,Math.max(.08,Math.abs(applied)*8e-4),'v0.14.2 I/H global: momento constitutivo');near(rec.elementMoment,rec.constitutiveMoment,Math.max(.08,Math.abs(applied)*8e-4),'v0.14.2 I/H global: equilíbrio elemento-rótula');near(reaction.mz,-applied,Math.max(.1,Math.abs(applied)*8e-4),'v0.14.2 I/H global: reação de momento');
  assert(rec.tangent<rec.secantStiffness,'v0.14.2 I/H global: tangente pós-escoamento deveria cair');
  console.log('v0.14.2 — perfil I/H global OK','M=',rec.constitutiveMoment,'theta=',rec.rotation,'fibras=',rec.yieldedFibers,'outer=',r.materialNonlinearity.outerIterations);
}

// 4) Regressão embedded vs modo externo legado.
{
  const pEmbedded=steelCantilever({axial:-600,moment:1900}),rEmbedded=solve(pEmbedded,'LC1'),pOuter=steelCantilever({axial:-600,moment:1900});
  pOuter.settings.materialCoupling='outer';
  const rOuter=solve(pOuter,'LC1'),a=rEmbedded.materialNonlinearity.records[0],b=rOuter.materialNonlinearity.records[0],uA=rEmbedded.displacements.find(x=>x.nodeId==='N2'),uB=rOuter.displacements.find(x=>x.nodeId==='N2');
  near(a.constitutiveMoment,b.constitutiveMoment,Math.max(.2,Math.abs(a.constitutiveMoment)*8e-4),'v0.15 regressão: momento embedded vs outer');
  near(a.rotation,b.rotation,Math.max(2e-6,Math.abs(a.rotation)*2e-3),'v0.15 regressão: rotação embedded vs outer');
  near(uA.rz,uB.rz,Math.max(2e-6,Math.abs(uA.rz)*2e-3),'v0.15 regressão: rotação nodal embedded vs outer');
  assert(rOuter.materialNonlinearity.coupling==='outer-compatibility','v0.15 regressão: fallback externo não identificado');
  console.log('v0.15 — embedded vs outer OK','M=',a.constitutiveMoment,'theta=',a.rotation,'local=',rEmbedded.materialNonlinearity.maxLocalIterations,'outer=',rOuter.materialNonlinearity.outerIterations);
}

console.log('Todos os smoke tests globais de rótula de fibras do AstraStruct v0.15 passaram.');
