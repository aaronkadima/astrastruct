import assert from 'node:assert/strict';
import {generateExplicitHoleBoltGroup,solveConnectionPlateHoleAtDisplacement,solveConnectionPlateHoleContact} from '../web/src/solver/connectionPlateHoleContact2d.js';

const base={
  length:.40,width:.24,thickness:.012,E:200e6,nu:.30,fy:355e3,hardeningRatio:.02,
  meshX:8,meshY:6,steps:12,maxIterations:70,cutIntegrationOrder:12,boundarySegments:72,
  contactNormalStiffness:5e8
};
const bolts=generateExplicitHoleBoltGroup({
  nx:2,ny:2,spacingX:.08,spacingY:.08,centerX:.20,
  boltDiameter:.020,gap:.001,contactNormalStiffness:5e8
});

// Embedded/cut-cell void integration must approximate the analytical circular area.
const zero=solveConnectionPlateHoleAtDisplacement({...base,bolts},0);
assert.equal(zero.converged,true);
assert.ok(zero.area.analyticalVoid>0);
const areaErr=Math.abs(zero.area.void-zero.area.analyticalVoid)/zero.area.analyticalVoid;
assert.ok(areaErr<.08,`void area error ${areaErr}: ${JSON.stringify(zero.area)}`);

// Before radial clearance closes, the plate translates essentially rigidly.
const free=solveConnectionPlateHoleAtDisplacement({...base,bolts},.0008,zero.u);
assert.equal(free.converged,true);
assert.ok(Math.abs(free.appliedLoad)<2e-3,`pre-contact load ${free.appliedLoad}`);
assert.ok(free.state.holes.every(h=>h.activeArcLength===0&&h.peakPressureMPa===0));
assert.ok(free.maxVmMPa<.01,`pre-contact vm ${free.maxVmMPa}`);

// After closure, pressure is distributed over a finite rear-side contact arc.
const bearing=solveConnectionPlateHoleAtDisplacement({...base,bolts},.0020,free.u);
assert.equal(bearing.converged,true);
assert.ok(bearing.appliedLoad>1,`bearing load ${bearing.appliedLoad}`);
assert.ok(Math.abs(bearing.equilibrium.relativeFxResidual)<5e-4,JSON.stringify(bearing.equilibrium));
assert.ok(Math.abs(bearing.totalFy)<1e-6,`symmetry Fy ${bearing.totalFy}`);
assert.equal(bearing.state.holes.filter(h=>h.activeArcLength>0).length,4);
for(const h of bearing.state.holes){
  assert.ok(h.peakPressureMPa>1,`${h.id} peak pressure ${h.peakPressureMPa}`);
  assert.ok(h.activeArcDegrees>30&&h.activeArcDegrees<220,`${h.id} active arc ${h.activeArcDegrees}`);
  assert.ok(h.contactCentroidAngleDeg!=null&&Math.abs(h.contactCentroidAngleDeg-180)<25,`${h.id} contact centroid ${h.contactCentroidAngleDeg}`);
  assert.ok(h.ovalizationMm>0,`${h.id} ovalization ${h.ovalizationMm}`);
  assert.ok(h.segments.some(s=>s.active&&s.pressureMPa>0));
}

// Reflection symmetry must hold exactly enough for engineering regression while flexibility redistributes load in x.
const [b1,b2,b3,b4]=bearing.state.holes;
assert.ok(Math.abs(b1.resultant.magnitude-b3.resultant.magnitude)<1e-6,`left-column mirror mismatch ${b1.resultant.magnitude}, ${b3.resultant.magnitude}`);
assert.ok(Math.abs(b2.resultant.magnitude-b4.resultant.magnitude)<1e-6,`right-column mirror mismatch ${b2.resultant.magnitude}, ${b4.resultant.magnitude}`);
assert.ok(Math.abs(b1.peakPressureMPa-b3.peakPressureMPa)<1e-6,`left pmax mirror mismatch`);
assert.ok(Math.abs(b2.peakPressureMPa-b4.peakPressureMPa)<1e-6,`right pmax mirror mismatch`);
assert.ok(Math.abs(b1.ovalizationMm-b3.ovalizationMm)<1e-9,`left ovalization mirror mismatch`);
assert.ok(Math.abs(b2.ovalizationMm-b4.ovalizationMm)<1e-9,`right ovalization mirror mismatch`);
assert.ok(Math.abs(b1.resultant.magnitude-b2.resultant.magnitude)>1e-3,'expected flexible-column redistribution');

// Reduced fy must yield the plate and converge through the softened branch with distributed contact intact.
const elastic=solveConnectionPlateHoleContact({...base,bolts,fy:1e9,edgeDisplacementMax:.0045,steps:9});
const plastic=solveConnectionPlateHoleContact({...base,bolts,fy:95e3,hardeningRatio:.01,edgeDisplacementMax:.0045,steps:9});
assert.equal(elastic.diagnostics.converged,true);
assert.equal(plastic.diagnostics.converged,true);
assert.ok(plastic.diagnostics.yieldedAreaFraction>0,`yielded fraction ${plastic.diagnostics.yieldedAreaFraction}`);
assert.ok(plastic.final.appliedLoad<elastic.final.appliedLoad,`${plastic.final.appliedLoad} !< ${elastic.final.appliedLoad}`);
assert.ok(plastic.events.firstContact,'missing first contact');
assert.ok(plastic.events.firstYield,'missing first yield');
assert.ok(plastic.final.peakPressureMPa>0);
assert.ok(plastic.final.maxOvalizationMm>0);
assert.ok(Math.abs(plastic.final.totalFy)<1e-5,`plastic transverse equilibrium ${plastic.final.totalFy}`);
assert.ok(plastic.final.state.holes.every(h=>Number.isFinite(h.bearingStressEquivalentMPa)&&h.segments.every(s=>Number.isFinite(s.pressureMPa))));

console.log('connection-plate-hole-contact-v0305-smoke: ok');
