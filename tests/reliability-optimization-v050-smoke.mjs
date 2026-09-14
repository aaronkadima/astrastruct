import assert from 'node:assert/strict';
import {emptyProject} from '../web/src/core/model.js';
import {runMonteCarloReliability,runMvfosmReliability,optimizeProject} from '../web/src/reliability/index.js';
function axialBar(){
  const p=emptyProject();p.name='v0.50 axial reliability fixture';p.nodes=[{id:'N1',x:0,y:0},{id:'N2',x:2,y:0}];
  p.elements=[{id:'E1',type:'truss2d',n1:'N1',n2:'N2',materialId:'steel355',sectionId:'truss_generic',A:.01,I:0,label:'Bar'}];
  p.supports=[{nodeId:'N1',ux:true,uy:true,rz:false},{nodeId:'N2',ux:false,uy:true,rz:false}];
  p.loads=[{id:'P1',caseId:'LC1',nodeId:'N2',fx:100,fy:0,mz:0}];return p;
}
const loadVariable={id:'P',distribution:'normal',mean:100,standardDeviation:10,target:{kind:'entity',collection:'loads',id:'P1',property:'fx'}};
const limitState={selector:{type:'node-displacement',nodeId:'N2',component:'ux'},capacity:.00012};
{
  const p=axialBar(),a=runMonteCarloReliability(p,{variables:[loadVariable],limitState,samples:2048,seed:20260914}),b=runMonteCarloReliability(p,{variables:[loadVariable],limitState,samples:2048,seed:20260914});
  assert.equal(a.failures,b.failures,'Monte Carlo deve ser reproduzível pela seed');assert.equal(a.pf,b.pf);assert.ok(Math.abs(a.pf-0.0227501)<0.015,`Pf Monte Carlo fora da faixa: ${a.pf}`);assert.ok(a.interval95.lower<=a.pf&&a.interval95.upper>=a.pf,'intervalo de Wilson inválido');
}
{
  const r=runMvfosmReliability(axialBar(),{variables:[loadVariable],limitState});assert.ok(Math.abs(r.beta-2)<2e-3,`MVFOSM beta esperado ~2, obtido ${r.beta}`);assert.ok(Math.abs(r.pf-0.0227501)<3e-4,`MVFOSM Pf inesperado: ${r.pf}`);assert.ok(Math.abs(Math.abs(r.sensitivities[0].alpha)-1)<1e-8,'sensibilidade normalizada univariada deve ser unitária em módulo');
}
{
  const r=optimizeProject(axialBar(),{
    variables:[{id:'A',target:{kind:'entity',collection:'elements',id:'E1',property:'A'},lower:.001,upper:.02,initial:.01}],
    objective:{kind:'design-sum',terms:[{variableId:'A',coefficient:1}]},
    constraints:[{id:'SLS-u',selector:{type:'node-displacement',nodeId:'N2',component:'ux'},relation:'<=',limit:.0002}],
    initialStepFraction:.25,tolerance:1e-5,maxIterations:120,storeHistory:false,
  });
  assert.ok(r.best.feasible,'otimizador deve retornar solução factível');assert.ok(r.best.values.A>=.005-2e-6&&r.best.values.A<=.00503,`área ótima esperada ~0.005 m², obtida ${r.best.values.A}`);assert.ok(r.best.constraints[0].response<=.0002*(1+2e-5),'restrição de deslocamento violada');
}
console.log('AstraStruct v0.50 reliability/optimization smoke: seeded Monte Carlo, MVFOSM and bounded coordinate search coherent.');
