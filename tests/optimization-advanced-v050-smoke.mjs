import assert from 'node:assert/strict';
import {emptyProject} from '../web/src/core/model.js';
import {optimizeProject,optimizeParetoProject} from '../web/src/reliability/index.js';

function axialBar(){
  const p=emptyProject();p.name='v0.50 advanced optimization fixture';
  p.nodes=[{id:'N1',x:0,y:0},{id:'N2',x:2,y:0}];
  p.elements=[{id:'E1',type:'truss2d',n1:'N1',n2:'N2',materialId:'steel355',sectionId:'truss_generic',A:.01,I:0,label:'Bar'}];
  p.supports=[{nodeId:'N1',ux:true,uy:true,rz:false},{nodeId:'N2',ux:false,uy:true,rz:false}];
  p.loads=[{id:'P1',caseId:'LC1',nodeId:'N2',fx:100,fy:0,mz:0}];
  return p;
}
const design=[{id:'A',target:{kind:'entity',collection:'elements',id:'E1',property:'A'},lower:.003,upper:.012,initial:.01}];
const loadRv={id:'P',distribution:'normal',mean:100,standardDeviation:10,target:{kind:'entity',collection:'loads',id:'P1',property:'fx'}};

// RBDO analítico: u=P L/(EA), u_lim=0.2 mm => P_lim=20000 A; beta=(P_lim-100)/10.
// beta=3 implica A=0.0065 m².
{
  const r=optimizeProject(axialBar(),{
    variables:design,
    objective:{kind:'design-sum',terms:[{variableId:'A',coefficient:1}]},
    constraints:[{id:'RBDO-u',kind:'reliability',method:'form',variables:[loadRv],limitState:{selector:{type:'node-displacement',nodeId:'N2',component:'ux'},capacity:.0002},minBeta:3}],
    initialStepFraction:.25,tolerance:1e-5,maxIterations:160,storeHistory:false,
  });
  assert.ok(r.best.feasible,'RBDO deve retornar solução factível');
  assert.ok(Math.abs(r.best.values.A-.0065)<3e-5,`RBDO A esperada ~0.0065, obtida ${r.best.values.A}`);
  const c=r.best.constraints[0];assert.equal(c.kind,'reliability');assert.equal(c.method,'form');assert.ok(c.converged,'FORM interno deve convergir');assert.ok(c.beta>=2.999,'beta alvo deve ser atendido');
}

// Pareto explícito: minimizar simultaneamente A e deslocamento axial.
{
  const p=axialBar(),variables=[{...design[0],lower:.002,upper:.02}],objectives=[
    {id:'area',direction:'minimize',scale:.01,objective:{kind:'design-sum',terms:[{variableId:'A',coefficient:1}]}},
    {id:'disp',direction:'minimize',scale:.0002,objective:{kind:'response',selector:{type:'node-displacement',nodeId:'N2',component:'ux'},factor:1}},
  ],weightSets=[{area:1,disp:0},{area:.75,disp:.25},{area:.5,disp:.5},{area:.25,disp:.75},{area:0,disp:1}];
  const r=optimizeParetoProject(p,{variables,objectives,weightSets,initialStepFraction:.25,tolerance:1e-5,maxIterations:140});
  assert.equal(r.method,'explicit-weighted-sum-pareto');assert.ok(r.front.length>=2,`front Pareto deve conter ao menos 2 pontos, obtido ${r.front.length}`);
  const areas=r.front.map(x=>x.designValues.A);assert.ok(Math.min(...areas)<=.00201,'front deve conter extremo de menor área');assert.ok(Math.max(...areas)>=.0199,'front deve conter extremo de menor deslocamento');assert.ok(r.front.every(x=>x.feasible),'front só deve conter pontos factíveis');
  assert.throws(()=>optimizeParetoProject(p,{variables,objectives:[{...objectives[0],scale:null},objectives[1]],weightSets}),/scale positivo/,'Pareto não deve inferir escala ausente');
}
console.log('AstraStruct v0.50 advanced optimization smoke: FORM-based RBDO and explicit weighted Pareto front coherent.');
