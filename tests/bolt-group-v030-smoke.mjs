import assert from 'node:assert/strict';
import {generateRectangularBoltGroup,solveRigidPlateBoltGroup} from '../web/src/solver/boltGroup2d.js';

const close=(a,b,tol=1e-9,msg='')=>assert.ok(Math.abs(a-b)<=tol,`${msg} ${a} vs ${b}`);
const bolts=generateRectangularBoltGroup({nx:2,ny:2,spacingX:.20,spacingY:.16,kx:200000,ky:200000,shearCapacity:100});

// Symmetric direct shear must distribute equally among four identical bolts.
{
  const r=solveRigidPlateBoltGroup({bolts,loads:{fx:100,fy:0,mz:0}});assert.equal(r.bolts.length,4);for(const b of r.bolts){close(b.force.fx,25,1e-9,'equal Fx');close(b.force.fy,0,1e-9,'zero Fy')}
  close(r.equilibrium.transferred.fx,100,1e-9);close(r.equilibrium.transferred.fy,0,1e-9);close(r.equilibrium.transferred.mz,0,1e-9);close(r.centerOfRigidity.x,0,1e-12);close(r.centerOfRigidity.y,0,1e-12);
}

// Pure moment follows theta=M/sum(k*r²) and produces tangential bolt forces.
{
  const M=12,k=200000,sumR2=bolts.reduce((s,b)=>s+b.x*b.x+b.y*b.y,0),expectedTheta=M/(k*sumR2),r=solveRigidPlateBoltGroup({bolts,loads:{fx:0,fy:0,mz:M}});close(r.plateDisplacement.theta,expectedTheta,1e-12,'theta');close(r.equilibrium.transferred.mz,M,1e-9,'moment equilibrium');for(const b of r.bolts){close(b.force.fx,-k*expectedTheta*b.y,1e-9,'torsion Fx');close(b.force.fy,k*expectedTheta*b.x,1e-9,'torsion Fy')}
}

// Eccentric force at y=e is exactly equivalent to adding Mz=-e*Fx at the origin.
{
  const e=.12,a=solveRigidPlateBoltGroup({bolts,loads:{fx:80,fy:0,mz:0,loadPointY:e}}),b=solveRigidPlateBoltGroup({bolts,loads:{fx:80,fy:0,mz:-80*e}});close(a.loads.totalMz,-80*e,1e-12);close(a.plateDisplacement.ux,b.plateDisplacement.ux,1e-12);close(a.plateDisplacement.theta,b.plateDisplacement.theta,1e-12);for(let i=0;i<4;i++){close(a.bolts[i].force.fx,b.bolts[i].force.fx,1e-9);close(a.bolts[i].force.fy,b.bolts[i].force.fy,1e-9)}}

// Capacity is user-defined and used only for demand ratio.
{
  const r=solveRigidPlateBoltGroup({bolts,loads:{fx:200,fy:0,mz:0}});close(r.maxUtilization,.5,1e-12);assert.equal(r.maxBolt.force.magnitude,50);
}

// Coincident bolts at the reference origin have no rotational stiffness.
assert.throws(()=>solveRigidPlateBoltGroup({bolts:[{id:'A',x:0,y:0,kx:1,ky:1},{id:'B',x:0,y:0,kx:1,ky:1}],loads:{mz:1}}),/singular/i);

console.log('bolt-group-v030-smoke: OK');
