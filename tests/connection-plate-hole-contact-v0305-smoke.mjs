import assert from 'node:assert/strict';
import {generateExplicitHoleBoltGroup,solveConnectionPlateHoleAtDisplacement,solveConnectionPlateHoleContact} from '../web/src/solver/connectionPlateHoleContact2d.js';

const base={length:.40,width:.24,thickness:.012,E:200e6,nu:.30,fy:355e3,hardeningRatio:.02,meshX:8,meshY:6,steps:12,maxIterations:70,cutIntegrationOrder:12,boundarySegments:72,contactNormalStiffness:5e8};
const bolts=generateExplicitHoleBoltGroup({nx:2,ny:2,spacingX:.08,spacingY:.08,centerX:.20,boltDiameter:.020,gap:.001,contactNormalStiffness:5e8});

const zero=solveConnectionPlateHoleAtDisplacement({...base,bolts},0);
assert.equal(zero.converged,true);
assert.ok(zero.area.analyticalVoid>0);
const areaErr=Math.abs(zero.area.void-zero.area.analyticalVoid)/zero.area.analyticalVoid;
assert.ok(areaErr<.08,`void area error ${areaErr}: ${JSON.stringify(zero.area)}`);

const free=solveConnectionPlateHoleAtDisplacement({...base,bolts},.0008,zero.u);
assert.equal(free.converged,true);
assert.ok(Math.abs(free.appliedLoad)<2e-3,`pre-contact load ${free.appliedLoad}`);
assert.ok(free.state.holes.every(h=>h.activeArcLength===0&&h.peakPressureMPa===0));
assert.ok(free.maxVmMPa<.01,`pre-contact vm ${free.maxVmMPa}`);

const bearing=solveConnectionPlateHoleAtDisplacement({...base,bolts},.0020,free.u);
console.log('hole-contact diagnostic',JSON.stringify({
  appliedLoad:bearing.appliedLoad,totalFx:bearing.totalFx,totalFy:bearing.totalFy,residual:bearing.equilibrium,
  holes:bearing.state.holes.map(h=>({id:h.id,x:h.x,y:h.y,Fx:h.resultant.fx,Fy:h.resultant.fy,V:h.resultant.magnitude,pmax:h.peakPressureMPa,arc:h.activeArcDegrees,theta:h.contactCentroidAngleDeg,ux:h.meanBoundaryDisplacement.x,uy:h.meanBoundaryDisplacement.y,oval:h.ovalizationMm}))
}));
assert.equal(bearing.converged,true);
assert.ok(bearing.appliedLoad>1,`bearing load ${bearing.appliedLoad}`);
assert.ok(Math.abs(bearing.equilibrium.relativeFxResidual)<5e-4,JSON.stringify(bearing.equilibrium));
assert.ok(Math.abs(bearing.totalFy)<1e-3,`symmetry Fy ${bearing.totalFy}`);
assert.equal(bearing.state.holes.filter(h=>h.activeArcLength>0).length,4);
for(const h of bearing.state.holes){
  assert.ok(h.peakPressureMPa>1,`${h.id} peak pressure ${h.peakPressureMPa}`);
  assert.ok(h.activeArcDegrees>30&&h.activeArcDegrees<220,`${h.id} active arc ${h.activeArcDegrees}`);
  const a=h.contactCentroidAngleDeg;
  assert.ok(a!=null&&Math.abs(a-180)<25,`${h.id} contact centroid ${a}`);
  assert.ok(h.ovalizationMm>0,`${h.id} ovalization ${h.ovalizationMm}`);
  assert.ok(h.segments.some(s=>s.active&&s.pressureMPa>0));
}

const fs=bearing.state.holes.map(h=>h.resultant.magnitude);
assert.ok(Math.abs(fs[0]-fs[2])<2e-2,`left-column y symmetry ${fs}`);
assert.ok(Math.abs(fs[1]-fs[3])<2e-2,`right-column y symmetry ${fs}`);
assert.ok(Math.abs(fs[0]-fs[1])>1e-3,`expected flexible-column redistribution ${fs}`);

const elastic=solveConnectionPlateHoleContact({...base,bolts,fy:1e9,edgeDisplacementMax:.0045,steps:9});
const plastic=solveConnectionPlateHoleContact({...base,bolts,fy:95e3,hardeningRatio:.01,edgeDisplacementMax:.0045,steps:9});
assert.equal(elastic.diagnostics.converged,true);
assert.equal(plastic.diagnostics.converged,true);
assert.ok(plastic.diagnostics.yieldedAreaFraction>0,`yielded fraction ${plastic.diagnostics.yieldedAreaFraction}`);
assert.ok(plastic.events.firstContact,'missing first contact');
assert.ok(plastic.events.firstYield,'missing first yield');
assert.ok(plastic.final.peakPressureMPa>0);
assert.ok(plastic.final.maxOvalizationMm>0);
assert.ok(plastic.final.state.holes.every(h=>Number.isFinite(h.bearingStressEquivalentMPa)&&h.segments.every(s=>Number.isFinite(s.pressureMPa))));

console.log('connection-plate-hole-contact-v0305-smoke: ok');
