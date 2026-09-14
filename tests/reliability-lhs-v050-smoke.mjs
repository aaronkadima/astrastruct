import assert from 'node:assert/strict';
import {emptyProject} from '../web/src/core/model.js';
import {runLatinHypercubeReliability,executeReliabilityStudy,RELIABILITY_METHODS} from '../web/src/reliability/index.js';

function axialBar(){
  const p=emptyProject();p.name='v0.50 LHS reliability fixture';p.nodes=[{id:'N1',x:0,y:0},{id:'N2',x:2,y:0}];
  p.elements=[{id:'E1',type:'truss2d',n1:'N1',n2:'N2',materialId:'steel355',sectionId:'truss_generic',A:.01,I:0,label:'Bar'}];
  p.supports=[{nodeId:'N1',ux:true,uy:true,rz:false},{nodeId:'N2',ux:false,uy:true,rz:false}];
  p.loads=[{id:'P1',caseId:'LC1',nodeId:'N2',fx:100,fy:0,mz:0}];return p;
}
const variable={id:'P',distribution:'normal',mean:100,standardDeviation:10,target:{kind:'entity',collection:'loads',id:'P1',property:'fx'}};
const limitState={id:'LS1',selector:{type:'node-displacement',nodeId:'N2',component:'ux'},capacity:.00012,sense:'demand<=capacity'};
assert.ok(RELIABILITY_METHODS.includes('latin-hypercube'),'study deve expor latin-hypercube');
{
  const cfg={variables:[variable],limitState,samples:2048,seed:20260914},a=runLatinHypercubeReliability(axialBar(),cfg),b=runLatinHypercubeReliability(axialBar(),cfg);
  assert.equal(a.method,'latin-hypercube');assert.equal(a.failures,b.failures,'LHS deve ser reproduzível pela seed');assert.equal(a.pf,b.pf);
  assert.ok(Math.abs(a.pf-0.0227501)<.003,`LHS Pf fora da faixa analítica: ${a.pf}`);assert.ok(a.interval95.lower<=a.pf&&a.interval95.upper>=a.pf,'intervalo Wilson inválido');
}
{
  const study={method:'latin-hypercube',variables:[variable],limitStates:[limitState],activeLimitStateId:'LS1',samples:1024,seed:50050,correlationMatrix:null},r=executeReliabilityStudy(axialBar(),study);
  assert.equal(r.method,'latin-hypercube','executeReliabilityStudy deve rotear LHS');
}
assert.throws(()=>runLatinHypercubeReliability(axialBar(),{variables:[variable],limitState,samples:32,correlationMatrix:[[1]]}),/independentes|correlationMatrix/,'LHS v0.50 deve rejeitar correlação não implementada');
console.log('AstraStruct v0.50 Latin Hypercube smoke: seeded stratified sampling, study routing and explicit correlation guard coherent.');
