import assert from 'node:assert/strict';
import {validateInspectionField,inspectionFieldRange,inspectionFieldCsv} from '../web/src/core/inspectionField.js';
import {anchorBondInspectionField,punchingDemandInspectionField,holeContactPressureInspectionField,plateVonMisesInspectionField} from '../web/src/view/inspectionFieldAdapters.js';
import {solveBondedAnchorPullout} from '../web/src/solver/anchorPullout1d.js';
import {rectangularCriticalPerimeter,solvePunchingPerimeterDemand} from '../web/src/solver/punchingPerimeter.js';
import {generateExplicitHoleBoltGroup,solveConnectionPlateHoleAtDisplacement} from '../web/src/solver/connectionPlateHoleContact2d.js';

const anchor=solveBondedAnchorPullout({embedment:.12,diameter:.012,segments:12,tauMax:6000,displacementMax:.003,steps:8});
assert.equal(anchor.diagnostics.converged,true);
const bond=anchorBondInspectionField(anchor);
assert.equal(validateInspectionField(bond),true);assert.equal(bond.contract,'inspection-field/v1');assert.equal(bond.fieldType,'bond-stress');assert.equal(bond.unit,'MPa');assert.equal(bond.samples.length,13);assert.ok(inspectionFieldRange(bond).max>0);assert.ok(inspectionFieldCsv(bond).includes('slipMm'));

const perimeter=rectangularCriticalPerimeter({columnX:.3,columnY:.4,offset:.4});
const punching=solvePunchingPerimeterDemand({perimeter,effectiveDepth:.2,V:500,Mx:30,My:-20,samplesPerEdge:12});
const punchField=punchingDemandInspectionField(punching);
assert.equal(validateInspectionField(punchField),true);assert.equal(punchField.geometry.closed,true);assert.equal(punchField.scale.symmetric,true);assert.equal(punchField.unit,'MPa');assert.ok(punchField.samples.some(p=>p.value>0));assert.ok(Math.abs(punchField.samples[0].value-punching.samples[0].tau/1000)<1e-12);

const cfg={length:.40,width:.24,thickness:.012,E:200e6,nu:.30,fy:355e3,hardeningRatio:.02,meshX:8,meshY:6,maxIterations:70,cutIntegrationOrder:12,boundarySegments:48,contactNormalStiffness:5e8,edgeDisplacementMax:.003};
const bolts=generateExplicitHoleBoltGroup({nx:1,ny:1,centerX:.20,centerY:0,boltDiameter:.020,gap:.001,contactNormalStiffness:5e8});
const zero=solveConnectionPlateHoleAtDisplacement({...cfg,bolts},0),free=solveConnectionPlateHoleAtDisplacement({...cfg,bolts},.0008,zero.u),bearing=solveConnectionPlateHoleAtDisplacement({...cfg,bolts},.0020,free.u);
assert.equal(bearing.converged,true);
const pressure=holeContactPressureInspectionField(bearing,{holeId:'B1'}),vm=plateVonMisesInspectionField(bearing);
assert.equal(validateInspectionField(pressure),true);assert.equal(validateInspectionField(vm),true);assert.equal(pressure.samples.length,48);assert.ok(pressure.samples.some(p=>p.active&&p.value>0));assert.ok(inspectionFieldRange(pressure).max>1);assert.equal(vm.fieldType,'von-mises-stress');assert.ok(inspectionFieldRange(vm).max>0);assert.equal(pressure.provenance.solverVersion,'0.30.5');

console.log('inspection-field-v0307-smoke: ok');
