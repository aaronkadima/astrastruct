import assert from 'node:assert/strict';
import {
  NONLINEAR_DYNAMICS_CONTRACT,NONLINEAR_DYNAMICS_VERSION,GROUND_MOTION_CONTRACT,
  rayleighDampingMatrix,piecewiseLinearGroundMotion,baseExcitationForce,absoluteAcceleration,
  createComponentRestoringModel,newmarkNonlinearSystem
} from '../web/src/dynamics/index.js';
import {newmarkLinearSystem} from '../web/src/solver/dynamics2d.js';
import {DofManager} from '../web/src/numerics/dofManager.js';
import {createNonlinearLink2DComponent} from '../web/src/elements/nonlinearLink.js';

const close=(a,b,tol=1e-8,msg='')=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(b)),`${msg} esperado ${b}, obtido ${a}`);
const vclose=(a,b,tol=1e-8,msg='')=>{assert.equal(a.length,b.length);a.forEach((v,i)=>close(v,b[i],tol,`${msg}[${i}]`))};
assert.equal(NONLINEAR_DYNAMICS_CONTRACT,'nonlinear-dynamics/v1');
assert.equal(NONLINEAR_DYNAMICS_VERSION,'0.41.0-exp');

// 1) Elastic limit: nonlinear Newmark must reproduce the existing linear Newmark solver.
{
  const M=[[2]],C=[[.8]],K=[[200]],forceAtTime=t=>[10*Math.sin(Math.PI*t)],dt=.01,duration=1.2;
  const linear=newmarkLinearSystem({M,C,K,forceAtTime,dt,duration});
  const model={response:u=>({internalForce:[200*u[0]],tangent:[[200]],outputs:{branch:'elastic'}}),commit(){},rollback(){}};
  const nonlinear=newmarkNonlinearSystem({M,C,restoringModel:model,forceAtTime,dt,duration,newton:{tolerances:{absoluteResidual:1e-11,relativeResidual:1e-11,absoluteIncrement:1e-12,relativeIncrement:1e-11,maxIterations:12}}});
  assert.equal(nonlinear.contract,NONLINEAR_DYNAMICS_CONTRACT);assert.equal(nonlinear.steps,linear.steps);
  vclose(nonlinear.final.u,linear.final.u,2e-8,'u final elástico');vclose(nonlinear.final.v,linear.final.v,2e-8,'v final elástico');vclose(nonlinear.final.a,linear.final.a,2e-7,'a final elástico');
}

// 2) Average-acceleration Newmark conserves mechanical energy for an undamped linear oscillator.
{
  const M=[[1]],C=[[0]],model={response:u=>({internalForce:[100*u[0]],tangent:[[100]],outputs:{}}),commit(){},rollback(){}};
  const out=newmarkNonlinearSystem({M,C,restoringModel:model,forceAtTime:()=>[0],dt:.005,duration:2,u0:[.01],v0:[0],newton:{tolerances:{absoluteResidual:1e-12,relativeResidual:1e-12,absoluteIncrement:1e-13,relativeIncrement:1e-12,maxIterations:8}}});
  const e0=.5*100*.01**2,ef=.5*out.final.v[0]**2+.5*100*out.final.u[0]**2;
  close(ef,e0,2e-8,'energia mecânica');assert.ok(Math.abs(out.final.energy.balanceResidual)<2e-8,'balanço de energia deve permanecer fechado');
}

// 3) Ground-motion interpolation, inertia sign and absolute acceleration reconstruction.
{
  const gm=piecewiseLinearGroundMotion({times:[0,.2,.4,.6],accelerations:[0,2,-2,0],scale:1.5});assert.equal(gm.contract,GROUND_MOTION_CONTRACT);close(gm.accelerationAtTime(.1),1.5);close(gm.accelerationAtTime(.3),0);close(gm.accelerationAtTime(.5),-1.5);
  const f=baseExcitationForce({M:[[2,0],[0,1]],influence:[1,1],accelerationAtTime:()=>3});vclose(f(.2),[-6,-3],1e-12,'força sísmica efetiva');vclose(absoluteAcceleration([1,-2],[1,1],3),[4,1],1e-12,'aceleração absoluta');
  const C=rayleighDampingMatrix({M:[[2,0],[0,1]],K:[[10,-2],[-2,5]],alphaM:.1,betaK:.02});vclose(C[0],[.4,-.04],1e-12,'Rayleigh linha 1');vclose(C[1],[-.04,.2],1e-12,'Rayleigh linha 2');
}

// 4) Inelastic seismic response through the universal Element/Component API.
{
  const dm=new DofManager();dm.registerNode('B',['ux']);dm.registerNode('M',['ux']);
  const link=createNonlinearLink2DComponent({element:{id:'L1',type:'nonlinear-link-2d',n1:'B',n2:'M',components:[{label:'ux',law:'bilinear-kinematic',k:100,yieldForce:.5,hardeningRatio:.02}]}}),free=[dm.get('M','ux')],model=createComponentRestoringModel({components:[link],dofManager:dm,freeDofs:free});
  const gm=piecewiseLinearGroundMotion({times:[0,.15,.30,.45,.60,.80,1.0],accelerations:[0,4,-4,4,-4,0,0]}),forceAtTime=baseExcitationForce({M:[[1]],influence:[1],accelerationAtTime:gm.accelerationAtTime});
  const out=newmarkNonlinearSystem({M:[[1]],C:[[.15]],restoringModel:model,forceAtTime,dt:.005,duration:1,newton:{strategy:'line-search',tolerances:{absoluteResidual:1e-9,relativeResidual:1e-9,absoluteIncrement:1e-11,relativeIncrement:1e-9,maxIterations:30}}});
  const state=model.committedStates()[0].state.components.ux;assert.ok(state.cumulativePlasticDeformation>0,'excitação deve produzir plasticidade');assert.ok(state.dissipatedEnergy>0,'histerese deve dissipar energia');assert.ok(out.history.some(row=>row.outputs.assembly?.[0]?.outputs?.components?.some(c=>c.branch==='plastic-return')),'histórico deve registrar ramo plástico');assert.ok(out.history.every(row=>row.iterations<=30),'todos os passos devem convergir');assert.ok(Number.isFinite(out.final.energy.balanceResidual));
}

console.log('AstraStruct v0.41 nonlinear dynamics smoke: elastic limit, energy, ground motion and inelastic component response OK.');
