import assert from 'node:assert/strict';
import {generateFlexiblePlateBoltGroup,solveFlexibleConnectionPlateAtDisplacement,solveFlexibleConnectionPlate} from '../web/src/solver/connectionPlateMembrane2d.js';

const base={length:.40,width:.24,thickness:.012,E:200e6,nu:.30,fy:355e3,hardeningRatio:.02,meshX:4,meshY:4,steps:12,maxIterations:60};
const bolts=generateFlexiblePlateBoltGroup({nx:2,ny:2,spacingX:.08,spacingY:.08,centerX:.20,bearingStiffness:150000,gap:.001,boltDiameter:.020});

// Before the radial gap closes, the plate can translate essentially as a rigid body.
const free=solveFlexibleConnectionPlateAtDisplacement({...base,bolts},.0008);
assert.equal(free.converged,true);
assert.equal(free.state.bolts.filter(b=>b.state!=='gap').length,0);
assert.ok(Math.abs(free.appliedLoad)<1e-4,`pre-contact reaction ${free.appliedLoad}`);
assert.ok(free.maxVm/1000<1e-3,`pre-contact vm ${free.maxVm/1000} MPa`);

// After gap closure, bearing develops and edge reaction balances bolt transfer.
const bearing=solveFlexibleConnectionPlateAtDisplacement({...base,bolts},.0020,free.u);
assert.equal(bearing.converged,true);
assert.equal(bearing.state.bolts.filter(b=>b.state!=='gap').length,4);
assert.ok(bearing.appliedLoad>1,`bearing load ${bearing.appliedLoad}`);
assert.ok(Math.abs(bearing.equilibrium.relativeFxResidual)<2e-5,JSON.stringify(bearing.equilibrium));
assert.ok(Math.abs(bearing.totalBoltFy)<1e-5,`symmetry Fy ${bearing.totalBoltFy}`);
const forces=bearing.state.bolts.map(b=>b.force.magnitude);
assert.ok(Math.max(...forces)-Math.min(...forces)<1e-3,`symmetric bolt forces ${forces.join(',')}`);

// Lower yield strength must create a yielded zone and reduce the monotonic tangent/load.
const elastic=solveFlexibleConnectionPlate({...base,bolts,fy:1e9,edgeDisplacementMax:.005,steps:10});
const plastic=solveFlexibleConnectionPlate({...base,bolts,fy:55e3,hardeningRatio:.01,edgeDisplacementMax:.005,steps:10});
assert.equal(elastic.diagnostics.converged,true);
assert.equal(plastic.diagnostics.converged,true);
assert.ok(plastic.diagnostics.yieldedAreaFraction>0,`yielded fraction ${plastic.diagnostics.yieldedAreaFraction}`);
assert.ok(plastic.final.appliedLoad<elastic.final.appliedLoad,`${plastic.final.appliedLoad} !< ${elastic.final.appliedLoad}`);
assert.ok(plastic.events.firstContact,'missing first contact event');
assert.ok(plastic.events.firstYield,'missing first yield event');
assert.ok(plastic.final.state.elements.every(e=>Number.isFinite(e.maxVm)&&Number.isFinite(e.center.x)&&Number.isFinite(e.center.y)));
assert.ok(plastic.final.state.bolts.every(b=>Number.isFinite(b.bearingStressEquivalentMPa)));

console.log('connection-plate-membrane-v0304-smoke: ok');
