import { bilinearSteelState, bilinearSteelFromModelMaterial } from '../web/src/solver/material1d.js';
import { rectangularFibers, fiberSectionState, rectangularSteelFiberSectionState, fiberHingePureBendingState } from '../web/src/solver/fiberSection2d.js';

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
  const fibers=rectangularFibers({width:b,height:h,nFibers:n}),Id= fibers.reduce((s,f)=>s+f.area*f.y*f.y,0),kappa=.001;
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

// 5) Rótula concentrada: M(theta) e dM/dtheta coerentes com a seção de fibras.
{
  const section={b,h},material={type:'steel',E,fy:355},Lp=.35,theta=.012,dh=1e-7,args={hingeLength:Lp,section,material,nFibers:n,hardeningRatio},base=fiberHingePureBendingState({rotation:theta,...args}),plus=fiberHingePureBendingState({rotation:theta+dh,...args}),minus=fiberHingePureBendingState({rotation:theta-dh,...args}),numeric=(plus.moment-minus.moment)/(2*dh),relative=Math.abs(base.rotationalTangent-numeric)/Math.max(1,Math.abs(numeric));
  assert(base.yieldedFibers>0,'Rótula de fibras: estado deveria conter fibras escoadas');assert(relative<3e-7,`Rótula de fibras: tangente momento-rotação inconsistente (${relative})`);
  near(base.curvature,theta/Lp,1e-14,'Rótula de fibras: curvatura');
  console.log('v0.14 — rótula de fibras local OK','M=',base.moment,'kt=',base.rotationalTangent,'erro rel=',relative);
}

console.log('Todos os smoke tests constitutivos do AstraStruct v0.14 passaram.');
