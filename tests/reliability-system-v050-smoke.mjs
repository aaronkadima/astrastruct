import assert from 'node:assert/strict';
import {emptyProject} from '../web/src/core/model.js';
import {runSystemMonteCarloReliability,runImportanceSamplingReliability} from '../web/src/reliability/index.js';
function axialBar(){const p=emptyProject();p.nodes=[{id:'N1',x:0,y:0},{id:'N2',x:2,y:0}];p.elements=[{id:'E1',type:'truss2d',n1:'N1',n2:'N2',materialId:'steel355',sectionId:'truss_generic',A:.01,I:0}];p.supports=[{nodeId:'N1',ux:true,uy:true,rz:false},{nodeId:'N2',ux:false,uy:true,rz:false}];p.loads=[{id:'P1',caseId:'LC1',nodeId:'N2',fx:100,fy:0,mz:0}];return p;}
const variable={id:'P',distribution:'normal',mean:100,standardDeviation:10,target:{kind:'entity',collection:'loads',id:'P1',property:'fx'}};
const limitStates=[{id:'SLS115',selector:{type:'node-displacement',nodeId:'N2',component:'ux'},capacity:.000115},{id:'SLS120',selector:{type:'node-displacement',nodeId:'N2',component:'ux'},capacity:.00012}];
{
  const series=runSystemMonteCarloReliability(axialBar(),{variables:[variable],limitStates,systemMode:'series',samples:1024,seed:50050}),parallel=runSystemMonteCarloReliability(axialBar(),{variables:[variable],limitStates,systemMode:'parallel',samples:1024,seed:50050});
  assert.equal(series.components.length,2);assert.equal(series.failures,series.components[0].failures,'eventos aninhados: série deve coincidir com o estado limite mais restritivo');assert.equal(parallel.failures,parallel.components[1].failures,'eventos aninhados: paralelo deve coincidir com o estado limite menos provável');assert.ok(series.pf>=parallel.pf,'Pf série deve ser >= Pf paralelo');
}
{
  const rare={id:'RARE',selector:{type:'node-displacement',nodeId:'N2',component:'ux'},capacity:.00012},rareVariable={...variable,standardDeviation:5};
  const r=runImportanceSamplingReliability(axialBar(),{variables:[rareVariable],limitState:rare,samples:2048,seed:5050});
  const exact=3.1671241833e-5;assert.ok(r.form&&Math.abs(r.form.beta-4)<5e-3,`FORM center beta esperado ~4: ${r.form?.beta}`);assert.ok(r.pf>1e-5&&r.pf<8e-5,`importance sampling Pf fora de faixa: ${r.pf}`);assert.ok(Math.abs(r.pf-exact)/exact<.65,`importance sampling erro relativo excessivo: ${r.pf}`);assert.ok(r.standardError>0&&Number.isFinite(r.standardError),'importance sampling deve reportar erro-padrão');assert.ok(r.diagnostics.failureSamples>100,'proposal centrada no design point deve observar falhas suficientes');
}
console.log('AstraStruct v0.50 system/rare-event smoke: series/parallel system reliability and FORM-centered importance sampling coherent.');
