import assert from'node:assert/strict';
import{buildCombinationEnvelopeExplorer,classifyCombination,COMBINATION_ENVELOPE_CONTRACT,COMBINATION_ENVELOPE_VERSION}from'../web/src/projectWorkflow/combinationEnvelopeExplorer.js';

const project={
  levels:[{id:'L0',name:'Base',elevation:0},{id:'L1',name:'Pavimento 1',elevation:3}],
  nodes:[{id:'N0',x:0,y:0,z:0},{id:'N1',x:0,y:0,z:3},{id:'N2',x:5,y:0,z:3}],
  elements:[{id:'B1',label:'Viga B1',type:'frame3d',n1:'N1',n2:'N2',levelId:'L1'}],
  loadCases:[{id:'G',name:'Permanente'},{id:'Q',name:'Variável'}],
  loadCombinations:[
    {id:'ULS1',name:'ELU fundamental',limitStateCategory:'ELU',terms:[{caseId:'G',factor:1.4},{caseId:'Q',factor:1.4}]},
    {id:'SLS1',name:'ELS rara',limitStateCategory:'ELS',terms:[{caseId:'G',factor:1},{caseId:'Q',factor:1}]},
    {id:'CUST',name:'Combinação customizada',terms:[{caseId:'G',factor:1}]}
  ]
};
const result=(id,ux,uy,N,M)=>({analysisType:'linear',type:'linear3d',dimension:'3d',scenario:{id},displacements:[{nodeId:'N0',ux:0,uy:0,uz:0},{nodeId:'N1',ux,uy,uz:0},{nodeId:'N2',ux,uy,uz:0}],elementForces:[{elementId:'B1',type:'frame3d',N1:N,N2:-N,Vy1:5,Vz1:-7,My1:M,Mz1:-M,T1:2}]});
const x=buildCombinationEnvelopeExplorer(project,[{combinationId:'ULS1',result:result('ULS1',.006,.003,120,80)},{combinationId:'SLS1',result:result('SLS1',.003,.004,70,45)},{combinationId:'CUST',error:'não convergiu'}]);
assert.equal(x.contract,COMBINATION_ENVELOPE_CONTRACT);assert.equal(x.version,COMBINATION_ENVELOPE_VERSION);assert.equal(x.summary.defined,3);assert.equal(x.summary.ready,2);assert.equal(x.summary.error,1);assert.equal(x.summary.elu,1);assert.equal(x.summary.els,1);assert.equal(x.summary.unknown,1);
assert.equal(classifyCombination({name:'ULS accidental'}).category,'ELU');assert.equal(classifyCombination({name:'SLS frequent'}).category,'ELS');assert.equal(classifyCombination({name:'custom'}).category,'UNKNOWN');
const e=x.elementEnvelopes.find(r=>r.elementId==='B1');assert.equal(e.N.governingCombinationId,'ULS1');assert.equal(Math.abs(e.N.absMax),120);assert.equal(e.M.governingCombinationId,'ULS1');assert.equal(Math.abs(e.M.absMax),80);
assert.equal(x.displacementEnvelope.governingCombinationId,'ULS1');assert.ok(x.displacementEnvelope.magnitudeMm>6.7&&x.displacementEnvelope.magnitudeMm<6.8);
const drift=x.storyDriftEnvelopes.find(r=>r.levelId==='L1');assert.equal(drift.governingCombinationId,'ULS1');assert.ok(drift.maxDriftRatio>0.0022&&drift.maxDriftRatio<0.0023);assert.ok(x.governance.noNormativeDriftPass);assert.ok(x.governance.eigenShapesExcludedFromPhysicalEnvelopes);
const modal=buildCombinationEnvelopeExplorer(project,[{combinationId:'ULS1',result:{analysisType:'modal',dimension:'3d',displacements:[{nodeId:'N1',ux:1,uy:0,uz:0}],elementForces:[{elementId:'B1',N1:999}]}}]);assert.equal(modal.combinations[0].status,'MODE_ONLY');assert.equal(modal.elementEnvelopes.length,0);assert.equal(modal.displacementEnvelope.magnitudeMm,null);
console.log('AstraStruct v0.53.8 combination envelope smoke: real solved-result envelopes, ELU/ELS classification, story drift and eigen-shape exclusion coherent.');
