import { bilinearSteelState, bilinearSteelFromModelMaterial } from '../web/src/solver/material1d.js';
import { rectangularFibers, iSectionFibers, rhsFibers, sectionFibersFromModel, fiberSectionState, rectangularSteelFiberSectionState, steelFiberSectionFromModel, fiberHingePureBendingState, fiberHingeSectionState } from '../web/src/solver/fiberSection2d.js';

function assert(condition,message){if(!condition)throw new Error(message)}
function near(actual,expected,tol,message){if(Math.abs(actual-expected)>tol)throw new Error(`${message}: esperado ${expected}, obtido ${actual}`)}

const E=200e6,fy=355e3,b=.2,h=.4,n=80,hardeningRatio=.01,ey=fy/E;

// 1) Aço bilinear simétrico: ramo elástico, escoamento e tangente pós-escoamento.
{
  const elastic=bilinearSteelState({strain:.5*ey,E,fy,hardeningRatio}),yieldPoint=bilinearSteelState({strain:ey,E,fy,hardeningRatio}),post=bilinearSteelState({strain:2*ey,E,fy,hardeningRatio}),compression=bilinearSteelState({strain:-2*ey,E,fy,hardeningRatio});
  near(elastic.stress,E*.5*ey,1e-8,'Aço bilinear: tensão elástica');near(elastic.tangent,E,1e-8,'Aço bilinear: tangente elástica');assert(!elastic.yielded,'Aço bilinear: estado elástico marcado como escoado');
  near(yieldPoint.stress,fy,1e-8,'Aço bilinear: tensão no escoamento');near(post.tangent,hardeningRatio*E,1e-8,'Aço bilinear: tangente pós-escoamento');assert(post.yielded,'Aço bilinear: pós-escoamento não identificado');
  near(compression.stress,-post.stress,1e-8,'Aço bilinear: simetria em compressão');near(compression.tangent,post.tangent,1e-8,'Aço bilinear: tangente simétrica');
  const fromModel=bilinearSteelFromModelMaterial({type:'steel',E,fy:355},.5*ey,{hardeningRatio});near(fromModel.stress,elastic.stress,1e-8,'Aço bilinear: conversão MPa -> kN/m²');
  console.log('v0.14 — aço bilinear OK','ey=',ey,'Et/E=',post.tangent/E);
}

// 2) Seção retangular elástica: N=0 e M=E*I_fibras*kappa.
{
  const fibers=rectangularFibers({width:b,height:h,nFibers:n}),Id=fibers.reduce((s,f)=>s+f.area*f.y*f.y,0),kappa=.001;
  const state=fiberSectionState({fibers,epsilon0:0,kappa,materialLaw:strain=>bilinearSteelState({strain,E,fy,hardeningRatio})});
  near(state.N,0,1e-7,'Seção de fibras elástica: N');near(state.M,E*Id*kappa,1e-6,'Seção de fibras elástica: EIκ');near(state.tangent[0][0],E*b*h,1e-5,'Seção de fibras elástica: EA');near(state.tangent[1][1],E*Id,1e-5,'Seção de fibras elástica: EI discreto');assert(state.yieldedFibers===0,'Seção de fibras elástica: fibras escoadas indevidas');
  console.log('v0.14 — seção de fibras elástica OK','I discreto=',Id,'M=',state.M);
}

// 3) Início e propagação do escoamento nas fibras extremas.
{
  const fibers=rectangularFibers({width:b,height:h,nFibers:n}),ymax=Math.max(...fibers.map(f=>Math.abs(f.y))),ky=ey/ymax;
  const justElastic=rectangularSteelFiberSectionState({width:b,height:h,nFibers:n,epsilon0:0,kappa:.999*ky,E,fy,hardeningRatio}),afterYield=rectangularSteelFiberSectionState({width:b,height:h,nFibers:n,epsilon0:0,kappa:1.05*ky,E,fy,hardeningRatio}),deep=rectangularSteelFiberSectionState({width:b,height:h,nFibers:n,epsilon0:0,kappa:5*ky,E,fy,hardeningRatio});
  assert(justElastic.yieldedFibers===0,'Seção de fibras: escoamento antes de ky');assert(afterYield.yieldedFibers>=2,'Seção de fibras: fibras extremas não escoaram após ky');assert(deep.yieldedFibers>afterYield.yieldedFibers,'Seção de fibras: zona escoada não se propagou');
  assert(deep.tangent[1][1]<justElastic.tangent[1][1]*.5,'Seção de fibras: rigidez flexional não caiu após escoamento');
  console.log('v0.14 — propagação de escoamento OK','ky=',ky,'fibras=',afterYield.yieldedFibers,'->',deep.yieldedFibers);
}

// 4) Tangente da seção não linear contra diferença central longe da descontinuidade de escoamento.
{
  const kappa=4.3*ey/(h/2),dh=1e-8,evalM=k=>rectangularSteelFiberSectionState({width:b,height:h,nFibers:n,epsilon0:0,kappa:k,E,fy,hardeningRatio}),base=evalM(kappa),plus=evalM(kappa+dh),minus=evalM(kappa-dh),numeric=(plus.M-minus.M)/(2*dh),analytic=base.tangent[1][1],relative=Math.abs(numeric-analytic)/Math.max(1,Math.abs(numeric));
  assert(relative<2e-7,`Seção de fibras: tangente flexional inconsistente (${relative})`);
  console.log('v0.14 — tangente da seção consistente OK','erro rel=',relative);
}

// 5) Rótula concentrada: M(theta) e dM/dtheta coerentes com a seção de fibras em flexão pura.
{
  const section={b,h,family:'rect'},material={type:'steel',E,fy:355},Lp=.35,theta=.012,dh=1e-7,args={hingeLength:Lp,section,material,nFibers:n,hardeningRatio},base=fiberHingePureBendingState({rotation:theta,...args}),plus=fiberHingePureBendingState({rotation:theta+dh,...args}),minus=fiberHingePureBendingState({rotation:theta-dh,...args}),numeric=(plus.moment-minus.moment)/(2*dh),relative=Math.abs(base.rotationalTangent-numeric)/Math.max(1,Math.abs(numeric));
  assert(base.yieldedFibers>0,'Rótula de fibras: estado deveria conter fibras escoadas');assert(relative<3e-7,`Rótula de fibras: tangente momento-rotação inconsistente (${relative})`);
  near(base.curvature,theta/Lp,1e-14,'Rótula de fibras: curvatura');
  console.log('v0.14 — rótula de fibras local OK','M=',base.moment,'kt=',base.rotationalTangent,'erro rel=',relative);
}

// 6) Rótula N-M: epsilon0 satisfaz o esforço normal alvo e a tangente a N constante
// coincide com a derivada numérica da curva momento-rotação reequilibrada.
{
  const section={b,h,family:'rect'},material={type:'steel',E,fy:355},Lp=.35,theta=.008,targetAxialForce=-.10*fy*b*h,dh=1e-7,args={hingeLength:Lp,targetAxialForce,section,material,nFibers:n,hardeningRatio};
  const base=fiberHingeSectionState({rotation:theta,...args}),plus=fiberHingeSectionState({rotation:theta+dh,...args}),minus=fiberHingeSectionState({rotation:theta-dh,...args}),numeric=(plus.moment-minus.moment)/(2*dh),relative=Math.abs(base.rotationalTangent-numeric)/Math.max(1,Math.abs(numeric));
  near(base.sectionState.N,targetAxialForce,Math.max(1e-6,Math.abs(targetAxialForce)*2e-9),'Rótula N-M: equilíbrio axial');
  assert(Math.abs(base.axialResidual)<Math.max(1e-6,Math.abs(targetAxialForce)*2e-9),'Rótula N-M: resíduo axial excessivo');
  assert(base.yieldedFibers>0,'Rótula N-M: estado de teste deveria plastificar fibras');
  assert(relative<2e-6,`Rótula N-M: tangente a N constante inconsistente (${relative})`);
  assert(base.rotationalTangent>0,'Rótula N-M: tangente rotacional deve permanecer positiva com encruamento');
  console.log('v0.14 — rótula de fibras N-M OK','N=',base.sectionState.N,'M=',base.moment,'epsilon0=',base.epsilon0,'fibras=',base.yieldedFibers,'erro rel=',relative);
}

// 7) Perfil I/H: área analítica exata, I discreto convergente e EIκ no regime elástico.
{
  const section={family:'i',h:.4,b:.2,tw:.01,tf:.016},nf=180,fibers=iSectionFibers({height:section.h,width:section.b,webThickness:section.tw,flangeThickness:section.tf,nFibers:nf}),area=fibers.reduce((s,f)=>s+f.area,0),Id=fibers.reduce((s,f)=>s+f.area*f.y*f.y,0),hi=section.h-2*section.tf,bi=section.b-section.tw,A=2*section.b*section.tf+hi*section.tw,I=(section.b*section.h**3-bi*hi**3)/12,kappa=.001,state=steelFiberSectionFromModel({section,material:{type:'steel',E,fy:355},nFibers:nf,epsilon0:0,kappa,hardeningRatio});
  near(area,A,1e-14,'Perfil I/H: área da malha');assert(Math.abs(Id-I)/I<2e-5,`Perfil I/H: I discreto não convergiu (${Id} vs ${I})`);near(state.N,0,1e-7,'Perfil I/H: N elástico');near(state.M,E*Id*kappa,1e-6,'Perfil I/H: EIκ');assert(state.sectionFamily==='i','Perfil I/H: família não rastreada');assert(new Set(fibers.map(f=>f.region)).size===3,'Perfil I/H: mesas/alma não foram discretizadas separadamente');
  console.log('v0.14.2 — perfil I/H elástico OK','A=',area,'I=',Id,'erro I=',Math.abs(Id-I)/I);
}

// 8) Perfil I/H plastificado com interação N-M: equilíbrio axial e tangente reequilibrada.
{
  const section={family:'i',h:.4,b:.2,tw:.01,tf:.016},material={type:'steel',E,fy:355},Lp=.30,nFibers=180,area=2*section.b*section.tf+(section.h-2*section.tf)*section.tw,targetAxialForce=-.10*fy*area,theta=.010,dh=5e-8,args={hingeLength:Lp,targetAxialForce,section,material,nFibers,hardeningRatio},base=fiberHingeSectionState({rotation:theta,...args}),plus=fiberHingeSectionState({rotation:theta+dh,...args}),minus=fiberHingeSectionState({rotation:theta-dh,...args}),numeric=(plus.moment-minus.moment)/(2*dh),relative=Math.abs(base.rotationalTangent-numeric)/Math.max(1,Math.abs(numeric));
  near(base.sectionState.N,targetAxialForce,Math.max(1e-6,Math.abs(targetAxialForce)*3e-9),'Perfil I/H N-M: equilíbrio axial');assert(base.yieldedFibers>0,'Perfil I/H N-M: deveria plastificar fibras');assert(base.sectionFamily==='i','Perfil I/H N-M: família incorreta');assert(relative<3e-6,`Perfil I/H N-M: tangente inconsistente (${relative})`);
  console.log('v0.14.2 — perfil I/H N-M OK','N=',base.sectionState.N,'M=',base.moment,'fibras=',base.yieldedFibers,'erro rel=',relative);
}

// 9) RHS: área analítica exata, simetria e integração das duas paredes laterais.
{
  const section={family:'rhs',h:.30,b:.20,t:.012},nf=160,fibers=rhsFibers({height:section.h,width:section.b,thickness:section.t,nFibers:nf}),area=fibers.reduce((s,f)=>s+f.area,0),Id=fibers.reduce((s,f)=>s+f.area*f.y*f.y,0),hi=section.h-2*section.t,bi=section.b-2*section.t,A=section.b*section.h-bi*hi,I=(section.b*section.h**3-bi*hi**3)/12,centroid=fibers.reduce((s,f)=>s+f.area*f.y,0)/area,generic=sectionFibersFromModel({section,nFibers:nf});
  near(area,A,1e-14,'RHS: área da malha');near(centroid,0,1e-14,'RHS: centroide da malha');assert(Math.abs(Id-I)/I<2e-5,`RHS: I discreto não convergiu (${Id} vs ${I})`);assert(generic.some(f=>f.region==='side-walls'),'RHS: paredes laterais não identificadas');
  console.log('v0.14.2 — RHS elástico OK','A=',area,'I=',Id,'erro I=',Math.abs(Id-I)/I);
}

console.log('Todos os smoke tests constitutivos do AstraStruct v0.14.2 passaram.');
