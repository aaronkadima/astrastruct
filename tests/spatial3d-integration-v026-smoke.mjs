import assert from 'node:assert/strict';
import { demoSpatialFrame, normalizeProject } from '../web/src/core/model.js';
import { classifyElementSet, inferProjectDimension, getElementDefinition } from '../web/src/core/elementRegistry.js';
import { findSolver } from '../web/src/core/solverRegistry.js';
import { solve } from '../web/src/solver/index.js';

const p=demoSpatialFrame();
assert.equal(inferProjectDimension(p),'3d');
assert.equal(classifyElementSet(p),'frame3d');
assert.equal(getElementDefinition('frame3d').dofsPerNode.length,6);
assert.equal(findSolver({analysisType:'linear',dimension:'3d',elementSet:'frame3d'}).id,'linear-frame3d');
const r=solve(p,'LC1');
assert.equal(r.dimension,'3d');
assert.equal(r.contract.request.model.dimension,'3d');
assert.equal(r.contract.request.solverId,'linear-frame3d');
assert.equal(r.elementForces.length,3);
assert.ok(r.displacements.some(d=>Math.abs(d.uz)>1e-12));

const c=normalizeProject({...p,loadCases:[{id:'G',name:'G'},{id:'Q',name:'Q'}],loadCombinations:[{id:'U',name:'U',terms:[{caseId:'G',factor:1.2},{caseId:'Q',factor:1.5}]}],loads:[{id:'G1',caseId:'G',nodeId:'N4',fz:-10},{id:'Q1',caseId:'Q',nodeId:'N4',fy:-4}],settings:{...p.settings,analysisScenarioId:'U'}});
const rc=solve(c,'U');
const rr=rc.reactions.find(x=>x.nodeId==='N1');
assert.ok(Math.abs(rr.fz-12)<1e-8,`combination Fz reaction ${rr.fz}`);
assert.ok(Math.abs(rr.fy-6)<1e-8,`combination Fy reaction ${rr.fy}`);
// A v0.30 passou a aceitar co-rotacional elástico frame3d; modos dinâmicos 3D adicionais seguem protegidos.
assert.throws(()=>solve({...p,settings:{...p.settings,analysisType:'time-history'}},'LC1'),/ainda não é suportada em 3D/);
console.log('v0.26/v0.30 3D integration smoke: OK',{solver:r.type,maxUz:Math.max(...r.displacements.map(d=>Math.abs(d.uz)))})
