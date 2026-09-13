import assert from 'node:assert/strict';
import {generateSlipBearingBoltGroup,solveSlipCriticalToBearing} from '../web/src/solver/connectionSlipBearing2d.js';
import {solveTStubPrying} from '../web/src/solver/tstubPrying1d.js';
import {makeSymmetricCyclicHistory,solveHoleBearingDamage} from '../web/src/solver/holeBearingDamage1d.js';
import {solveAnchorConcreteInteraction} from '../web/src/solver/anchorConcreteInteraction.js';

const bolts=generateSlipBearingBoltGroup({nx:2,ny:2,spacingX:.16,spacingY:.12,mu:.3,preload:50,slipStiffness:8e5,gap:.001,bearingStiffness:2e5});
const slip=solveSlipCriticalToBearing({bolts,loads:{fx:80,fy:0,mz:0},steps:20});
assert.equal(slip.type,'bolt-group-slip-bearing-2d');assert.equal(slip.solverVersion,'0.31.0');assert.ok(slip.events.firstSlip);assert.ok(slip.events.firstBearing);assert.equal(slip.bolts.filter(b=>b.slipped).length,4);assert.equal(slip.bolts.filter(b=>b.bearingActive).length,4);assert.ok(slip.equilibrium.residualNorm<1e-6);assert.ok(slip.plateDisplacement.ux>.001);

const prying=solveTStubPrying({m:.06,n:.12,stripWidth:.10,thickness:.010,boltArea:157e-6,gripLength:.05,boltYieldForce:100,maxUplift:.003,steps:12,toeContactStiffness:2e7});
assert.equal(prying.type,'tstub-prying-1d');assert.ok(prying.final.converged);assert.ok(prying.final.appliedTension>0);assert.ok(prying.final.boltTension>0);assert.ok(prying.final.pryingReaction>=0);assert.ok(Math.abs(prying.final.equilibrium.relative)<1e-5);

const history=makeSymmetricCyclicHistory({amplitudes:[.0005,.002,.0035],cycles:1});
const damage=solveHoleBearingDamage({history,config:{gap:.001,bearingStiffness:2e5,yieldForce:40,damageLength:.003}});
assert.equal(damage.type,'hole-bearing-damage-1d');assert.ok(damage.permanentOvalization>0);assert.ok(damage.damage>0);assert.ok(damage.dissipatedEnergy>0);assert.ok(damage.path.some(p=>p.status==='bearing-plastic'));

const anchor=solveAnchorConcreteInteraction({steelYield:120,steelUltimate:150,bondPeak:95,concretePeak:70,edgeFactor:1,maxDisplacement:.01,steps:30});
assert.equal(anchor.type,'anchor-concrete-component-interaction');assert.equal(anchor.controllingMode,'concrete');assert.ok(Math.abs(anchor.peakForce-70)<1e-9);assert.ok(anchor.curve.some(p=>p.status==='post-peak'));assert.ok(anchor.peakDisplacement>0);
console.log('advanced-connection-mechanics-v0310-smoke: ok');
