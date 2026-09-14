import assert from 'node:assert/strict';
import {emptyProject,normalizeProject} from '../web/src/core/model.js';
import {
  OPTIMIZATION_STUDY_CONTRACT,
  OPTIMIZATION_STUDY_VERSION,
  defaultOptimizationStudy,
  normalizeOptimizationStudy,
  withOptimizationStudy,
  optimizationStudyFromProject,
  executeOptimizationStudy,
  applyOptimizationBest,
} from '../web/src/reliability/index.js';

function axialBar(){
  const p=emptyProject();p.name='v0.50 optimization study fixture';
  p.nodes=[{id:'N1',x:0,y:0},{id:'N2',x:2,y:0}];
  p.elements=[{id:'E1',type:'truss2d',n1:'N1',n2:'N2',materialId:'steel355',sectionId:'truss_generic',A:.01,I:0,label:'Bar'}];
  p.supports=[{nodeId:'N1',ux:true,uy:true,rz:false},{nodeId:'N2',ux:false,uy:true,rz:false}];
  p.loads=[{id:'P1',caseId:'LC1',nodeId:'N2',fx:100,fy:0,mz:0}];
  return p;
}

const study=normalizeOptimizationStudy({
  ...defaultOptimizationStudy(),
  name:'Minimizar área com limite de deslocamento',
  variables:[{id:'A',target:{kind:'entity',collection:'elements',id:'E1',property:'A'},lower:.001,upper:.02,initial:.01}],
  objective:{kind:'design-sum',terms:[{variableId:'A',coefficient:1,power:1}]},
  constraints:[{id:'SLS-u',selector:{type:'node-displacement',nodeId:'N2',component:'ux'},relation:'<=',limit:.0002}],
  tolerance:1e-5,
  maxIterations:120,
});
assert.equal(study.contract,OPTIMIZATION_STUDY_CONTRACT);assert.equal(study.version,OPTIMIZATION_STUDY_VERSION);
{
  const p=withOptimizationStudy(axialBar(),study),round=normalizeProject(JSON.parse(JSON.stringify(p))),loaded=optimizationStudyFromProject(round);
  assert.equal(loaded.contract,OPTIMIZATION_STUDY_CONTRACT,'contrato deve sobreviver ao normalizeProject');
  assert.equal(loaded.variables[0].target.property,'A','target de variável deve sobreviver ao round-trip');
}
{
  const p=axialBar(),r=executeOptimizationStudy(p,study);
  assert.ok(r.best.feasible,'estudo deve encontrar solução factível');
  assert.ok(r.best.values.A>=.005-2e-6&&r.best.values.A<=.00503,`área ótima esperada ~0.005 m², obtida ${r.best.values.A}`);
  const stored=withOptimizationStudy(p,study,r),summary=optimizationStudyFromProject(stored).lastResult;
  assert.equal(summary.best.feasible,true);assert.ok(!('bestProject' in summary),'resumo persistido não deve duplicar o projeto ótimo completo');
  assert.ok(summary.historySummary?.count>0,'resumo deve registrar tamanho do histórico sem persistir todas as avaliações');
  const applied=applyOptimizationBest(p,study,r);
  assert.ok(Math.abs(applied.elements[0].A-r.best.values.A)<1e-12,'aplicação deve transferir o melhor ponto ao projeto');
  assert.equal(applied.optimizationStudy.lastResult.best.feasible,true,'aplicação deve persistir o resumo do resultado');
}
console.log('AstraStruct v0.50 optimization study smoke: contract, project round-trip, execution, compact summary and best-project application coherent.');
