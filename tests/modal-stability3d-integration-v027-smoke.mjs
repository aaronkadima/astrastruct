import assert from 'node:assert/strict';
import { demoSpatialFrame } from '../web/src/core/model.js';
import { findSolver } from '../web/src/core/solverRegistry.js';
import { solve } from '../web/src/solver/index.js';
import { solveBuckling3D } from '../web/src/solver/modalStability3d.js';

const productAtLeast=(version,major,minor)=>{const [M,m]=String(version).split('.').map(Number);return Number.isFinite(M)&&Number.isFinite(m)&&(M>major||(M===major&&m>=minor));};

const modal=demoSpatialFrame();modal.settings={...modal.settings,analysisType:'modal',modalModes:4,dynamicMassFormulation:'consistent'};
const def=findSolver({analysisType:'modal',dimension:'3d',elementSet:'frame3d'});assert.equal(def?.id,'modal-3d');
const r=solve(modal,'LC1');assert.equal(r.analysisType,'modal');assert.equal(r.dimension,'3d');assert.equal(r.contract.request.solverId,'modal-3d');assert.ok(productAtLeast(r.contract.provenance.productVersion,0,27),`productVersion ${r.contract.provenance.productVersion} deve ser >= 0.27`);assert.ok(r.modes.length>=1);assert.ok(r.modes[0].frequencyHz>0);assert.ok('cumulativeMassRatioZ' in r.modes[0].participation);

const p=demoSpatialFrame();p.loads=[{id:'P',caseId:'LC1',nodeId:'N4',fz:-100}];
// The demo is not a pure column benchmark, but the direct buckling API must return a spatial result when compression exists.
const b=solveBuckling3D(p,'LC1',{modes:2});assert.equal(b.dimension,'3d');assert.ok(b.criticalFactor>0);assert.ok(b.modes[0].displacements[0] && 'uz' in b.modes[0].displacements[0]);
console.log('v0.27 3D modal/stability integration: OK',{f1:r.modes[0].frequencyHz,lambda1:b.criticalFactor});
