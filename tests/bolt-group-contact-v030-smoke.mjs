import assert from 'node:assert/strict';
import {generateRectangularBoltGroup,solveRigidPlateBoltGroup} from '../web/src/solver/boltGroup2d.js';
import {generateContactBoltGroup,solveBoltGroupClearanceContact} from '../web/src/solver/boltGroupContact2d.js';
const close=(a,b,tol=1e-8,msg='')=>assert.ok(Math.abs(a-b)<=tol,`${msg} ${a} vs ${b}`);

// Zero clearance reproduces the elastic rigid-plate bolt-group solution.
{
  const linearBolts=generateRectangularBoltGroup({nx:2,ny:2,spacingX:.20,spacingY:.16,kx:200000,ky:200000}),contactBolts=generateContactBoltGroup({nx:2,ny:2,spacingX:.20,spacingY:.16,bearingStiffness:200000,gap:0}),loads={fx:80,fy:35,mz:9},a=solveRigidPlateBoltGroup({bolts:linearBolts,loads}),b=solveBoltGroupClearanceContact({bolts:contactBolts,loads,steps:4});close(b.plateDisplacement.ux,a.plateDisplacement.ux,1e-8,'ux');close(b.plateDisplacement.uy,a.plateDisplacement.uy,1e-8,'uy');close(b.plateDisplacement.theta,a.plateDisplacement.theta,1e-8,'theta');close(b.equilibrium.transferred.fx,loads.fx,1e-7);close(b.equilibrium.transferred.fy,loads.fy,1e-7);close(b.equilibrium.transferred.mz,loads.mz,1e-7);
}

// Direct shear closes the radial gap first, then four identical bolts share load equally.
{
  const k=200000,g=.001,F=100,bolts=generateContactBoltGroup({nx:2,ny:2,spacingX:.20,spacingY:.16,bearingStiffness:k,gap:g}),r=solveBoltGroupClearanceContact({bolts,loads:{fx:F},steps:8}),expectedU=g+F/(4*k);close(r.plateDisplacement.ux,expectedU,2e-8,'gap+elastic displacement');close(r.plateDisplacement.uy,0,1e-8);close(r.plateDisplacement.theta,0,1e-8);assert.equal(r.activeBolts,4);for(const b of r.bolts)close(b.force.fx,F/4,1e-6,'equal contact force');close(r.equilibrium.residual.fx,0,1e-6);
}

// Pure moment in a symmetric equal-radius group has a closed-form rotation.
{
  const k=180000,g=.0008,M=10,bolts=generateContactBoltGroup({nx:2,ny:2,spacingX:.20,spacingY:.20,bearingStiffness:k,gap:g}),rad=Math.hypot(bolts[0].x,bolts[0].y),expectedTheta=g/rad+M/(bolts.length*k*rad*rad),r=solveBoltGroupClearanceContact({bolts,loads:{mz:M},steps:10});close(r.plateDisplacement.theta,expectedTheta,2e-7,'pure moment theta');close(r.equilibrium.transferred.mz,M,1e-6);assert.equal(r.activeBolts,4);
}

// Bilinear bearing law enters post-yield branch but preserves equilibrium.
{
  const k=200000,g=.001,F=120,bolts=generateContactBoltGroup({nx:2,ny:2,spacingX:.20,spacingY:.16,bearingStiffness:k,gap:g,yieldForce:20,postYieldRatio:.10}),r=solveBoltGroupClearanceContact({bolts,loads:{fx:F},steps:12});for(const b of r.bolts){close(b.force.magnitude,30,2e-5,'postyield force');assert.equal(b.state,'bearing-postyield')}const expected=g+20/k+(30-20)/(.1*k);close(r.plateDisplacement.ux,expected,3e-7,'postyield displacement');close(r.equilibrium.transferred.fx,F,2e-5);
}

// An eccentric force must generate the corresponding moment and asymmetric contact demand.
{
  const bolts=generateContactBoltGroup({nx:2,ny:2,spacingX:.24,spacingY:.16,bearingStiffness:220000,gap:.0006}),r=solveBoltGroupClearanceContact({bolts,loads:{fx:90,loadPointY:.10},steps:12});close(r.loads.totalMz,-9,1e-12);close(r.equilibrium.transferred.fx,90,1e-5);close(r.equilibrium.transferred.mz,-9,1e-5);const forces=r.bolts.map(b=>b.force.magnitude);assert.ok(Math.max(...forces)-Math.min(...forces)>1,'eccentric action should redistribute bolt forces');
}

console.log('bolt-group-contact-v030-smoke: OK');
