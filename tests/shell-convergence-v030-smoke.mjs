import assert from 'node:assert/strict';
import { solve } from '../web/src/solver/index.js';
import { runShellMeshConvergence, shellResponseMetrics } from '../web/src/core/shellConvergence.js';

const project={
  id:'shell-convergence',name:'Shell convergence smoke',version:13,schemaVersion:2,units:'kN-m-MPa',
  nodes:[{id:'N1',x:0,y:0,z:0,levelId:'L0'},{id:'N2',x:4,y:0,z:0,levelId:'L0'},{id:'N3',x:4,y:3,z:0,levelId:'L0'},{id:'N4',x:0,y:3,z:0,levelId:'L0'}],
  elements:[{id:'S1',type:'shell4',nodeIds:['N1','N2','N3','N4'],n1:'N1',n2:'N2',n3:'N3',n4:'N4',materialId:'C30',thickness:.20,levelId:'L0'}],
  materials:[{id:'C30',name:'C30',type:'concrete',E:30e6,nu:.2,density:25}],sections:[],
  supports:[{nodeId:'N1',ux:true,uy:true,uz:true,rx:true,ry:true,rz:true},{nodeId:'N4',ux:true,uy:true,uz:true,rx:true,ry:true,rz:true}],loads:[],
  elementLoads:[{id:'P',caseId:'G',elementId:'S1',kind:'surface',pressure:-10}],settlements:[],nodeSprings:[],nodalMasses:[],diaphragms:[],
  loadCases:[{id:'G',name:'G',type:'permanent'}],loadCombinations:[],connections:[],levels:[{id:'L0',name:'L0',elevation:0,index:0}],settings:{analysisType:'linear',analysisScenarioId:'G',activeLoadCaseId:'G'}
};

const baseResult=solve(project,'G'),baseMetrics=shellResponseMetrics(project,baseResult,{levelId:'L0'});assert.equal(baseMetrics.shellCount,1);assert.equal(baseMetrics.nodeCount,4);assert.ok(Number.isFinite(baseMetrics.maxAbsUz)&&baseMetrics.maxAbsUz>0);assert.ok(Number.isFinite(baseMetrics.maxAbsMx));
const study=runShellMeshConvergence(project,{solveModel:solve,scenarioId:'G',levelId:'L0',divisions:[1,2],tolerance:1e-6});
assert.equal(study.report.steps.length,2);assert.equal(study.report.steps[0].divisions,1);assert.equal(study.report.steps[1].divisions,2);assert.equal(study.report.recommendedDivisions,2);assert.ok(Number.isFinite(study.report.steps[1].relativeChange));assert.equal(study.report.steps[1].quality.counts.invalid,0);assert.equal(study.project.elements.filter(e=>e.type==='shell4').length,4);assert.equal(study.project.nodes.length,9);assert.equal(study.project.elementLoads.filter(l=>l.kind==='surface').length,4);assert.ok(study.project.elementLoads.filter(l=>l.kind==='surface').every(l=>l.pressure===-10));assert.ok(study.project.meta?.lastShellConvergenceReport);assert.ok(study.project.meta?.lastShellRefinementReport?.areaRelativeError<1e-12);
assert.throws(()=>runShellMeshConvergence({...project,settings:{...project.settings,analysisType:'modal'}},{solveModel:solve,divisions:[1,2]}),/análise linear estática/);
console.log('shell-convergence-v030-smoke: OK');
