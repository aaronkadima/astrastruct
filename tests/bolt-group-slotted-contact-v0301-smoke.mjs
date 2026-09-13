import assert from 'node:assert/strict';
import {generateContactBoltGroup,solveBoltGroupClearanceContact} from '../web/src/solver/boltGroupContact2d.js';
import {generateSlottedContactBoltGroup,solveBoltGroupSlottedClearanceContact} from '../web/src/solver/boltGroupSlottedContact2d.js';

const close=(a,b,tol=1e-8,msg='')=>assert.ok(Math.abs(a-b)<=tol,`${msg} ${a} vs ${b}`);

// Zero slot length must recover the already validated circular-hole contact kernel.
{
  const base=generateContactBoltGroup({nx:2,ny:2,spacingX:.20,spacingY:.16,bearingStiffness:200000,gap:.0008}),
    slots=generateSlottedContactBoltGroup({nx:2,ny:2,spacingX:.20,spacingY:.16,bearingStiffness:200000,gap:.0008,slotLength:0}),
    loads={fx:80,fy:35,mz:7},a=solveBoltGroupClearanceContact({bolts:base,loads,steps:8}),b=solveBoltGroupSlottedClearanceContact({bolts:slots,loads,steps:8});
  close(b.plateDisplacement.ux,a.plateDisplacement.ux,2e-8,'circular limit ux');
  close(b.plateDisplacement.uy,a.plateDisplacement.uy,2e-8,'circular limit uy');
  close(b.plateDisplacement.theta,a.plateDisplacement.theta,2e-8,'circular limit theta');
  close(b.equilibrium.transferred.fx,loads.fx,2e-6);
  close(b.equilibrium.transferred.fy,loads.fy,2e-6);
  close(b.equilibrium.transferred.mz,loads.mz,2e-6);
}

// Horizontal slotted holes permit free travel along the slot before end bearing develops.
{
  const k=200000,g=.001,slot=.012,a=slot/2,F=80,bolts=generateSlottedContactBoltGroup({nx:2,ny:2,spacingX:.20,spacingY:.16,bearingStiffness:k,gap:g,slotLength:slot,slotAngle:0}),
    r=solveBoltGroupSlottedClearanceContact({bolts,loads:{fx:F},steps:10}),expected=a+g+F/(4*k);
  close(r.plateDisplacement.ux,expected,3e-7,'longitudinal slot travel');
  close(r.plateDisplacement.uy,0,1e-8);
  close(r.plateDisplacement.theta,0,1e-8);
  assert.equal(r.activeBolts,4);
  for(const b of r.bolts){close(b.force.fx,F/4,2e-5,'equal end-bearing force');close(b.slotCoordinate,a,2e-7,'slot end coordinate')}
  close(r.equilibrium.residual.fx,0,2e-5);
}

// Rotating the same slots by 90 degrees removes the additional free travel for Fx.
{
  const k=200000,g=.001,F=80,bolts=generateSlottedContactBoltGroup({nx:2,ny:2,spacingX:.20,spacingY:.16,bearingStiffness:k,gap:g,slotLength:.012,slotAngle:Math.PI/2}),
    r=solveBoltGroupSlottedClearanceContact({bolts,loads:{fx:F},steps:10}),expected=g+F/(4*k);
  close(r.plateDisplacement.ux,expected,3e-7,'transverse slot response');
  assert.ok(r.plateDisplacement.ux<.002,'transverse response should not consume longitudinal slot travel');
  close(r.equilibrium.transferred.fx,F,2e-5);
}

// Bilinear end bearing remains available after the slot is consumed.
{
  const k=200000,g=.001,slot=.010,a=slot/2,F=120,bolts=generateSlottedContactBoltGroup({nx:2,ny:2,spacingX:.20,spacingY:.16,bearingStiffness:k,gap:g,slotLength:slot,slotAngle:0,yieldForce:20,postYieldRatio:.1}),
    r=solveBoltGroupSlottedClearanceContact({bolts,loads:{fx:F},steps:12}),expected=a+g+20/k+(30-20)/(.1*k);
  for(const b of r.bolts){close(b.force.magnitude,30,3e-5,'post-yield force');assert.equal(b.state,'bearing-postyield')}
  close(r.plateDisplacement.ux,expected,5e-7,'post-yield slotted displacement');
  close(r.equilibrium.transferred.fx,F,3e-5);
}

// Eccentric action must still balance the externally generated moment.
{
  const bolts=generateSlottedContactBoltGroup({nx:2,ny:2,spacingX:.24,spacingY:.16,bearingStiffness:220000,gap:.0006,slotLength:.006,slotAngle:0}),
    r=solveBoltGroupSlottedClearanceContact({bolts,loads:{fx:90,loadPointY:.10},steps:14});
  close(r.loads.totalMz,-9,1e-12);
  close(r.equilibrium.transferred.fx,90,3e-5);
  close(r.equilibrium.transferred.mz,-9,3e-5);
  assert.ok(r.bolts.some(b=>Math.abs(b.contactNormal.y)>1e-4),'eccentric action should rotate at least one contact normal');
}

console.log('bolt-group-slotted-contact-v0301-smoke: OK');
