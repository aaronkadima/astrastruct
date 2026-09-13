import assert from 'node:assert/strict';
import {generateExplicitHoleBoltGroup} from '../web/src/solver/connectionPlateHoleContact2d.js';
import {runHoleContactVerification,verificationSummaryCsv} from '../web/src/solver/localVerification.js';

const kn=3e8;
const bolts=generateExplicitHoleBoltGroup({nx:1,ny:1,centerX:.25,centerY:0,boltDiameter:.020,gap:.0005,contactNormalStiffness:kn});
const result=runHoleContactVerification({length:.50,width:.30,thickness:.012,E:200e6,nu:.3,fy:800e3,meshX:6,meshY:4,cutIntegrationOrder:6,boundarySegments:32,contactNormalStiffness:kn,edgeDisplacementMax:.0025,steps:4,bolts},{meshLevels:[[4,4],[6,4]],quadratureOrders:[4,8],boundarySegments:[24,48],knFactors:[.75,1,1.25]});
assert.equal(result.type,'local-verification-hole-contact');assert.equal(result.version,'0.30.9');assert.equal(result.provenance.solverVersion,'0.30.5');assert.equal(result.studies.mesh.length,2);assert.equal(result.studies.quadrature.length,2);assert.equal(result.studies.angular.length,2);assert.equal(result.studies.kn.length,3);assert.ok(result.reference.converged);assert.ok(Number.isFinite(result.reference.load)&&Math.abs(result.reference.load)>1e-3);assert.ok(result.indicators.forceResidual<1e-2);assert.ok(result.indicators.areaError>=0);assert.ok(result.indicators.meshDelta>=0&&result.indicators.angularDelta>=0&&result.indicators.knSpread>=0);assert.ok(result.energyAccounting.externalWork>0);assert.ok(result.energyAccounting.contactSpringEnergy>=0);assert.equal(result.energyAccounting.closed,false);assert.ok(Array.isArray(result.warnings));
const csv=verificationSummaryCsv(result);assert.match(csv,/study,parameter,converged/);assert.match(csv,/mesh,/);assert.match(csv,/quadrature,/);assert.match(csv,/angular,/);assert.match(csv,/kn,/);
console.log('local-verification-v0309-smoke: ok');
