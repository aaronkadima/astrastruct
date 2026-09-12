import assert from 'node:assert/strict';
import {corotationalFrame3DKinematics,rigidBodyDisplacement3D,rotationVectorToMatrix,matrixToRotationVector} from '../web/src/solver/corotational3d.js';

const near=(a,b,t=1e-9,msg='')=>assert.ok(Math.abs(a-b)<=t,`${msg} got ${a}, expected ${b}`);
const maxAbs=a=>Math.max(0,...a.map(x=>Math.abs(Number(x)||0)));
const a={id:'N1',x:.4,y:-.7,z:1.2},b={id:'N2',x:3.4,y:-.7,z:1.2},e={id:'E1',orientation:{up:[0,1,0]}};

// 1) Exponential/logarithm maps must round-trip in the regular range.
{
  const r=[.23,-.17,.31],R=rotationVectorToMatrix(r),back=matrixToRotationVector(R);
  for(let i=0;i<3;i++)near(back[i],r[i],1e-10,`SO(3) component ${i}`);
}

// 2) Pure rigid translation produces no element deformation.
{
  const t=[1.7,-.8,.45],u=[...t,0,0,0,...t,0,0,0],k=corotationalFrame3DKinematics(a,b,e,u);
  near(k.axial,0,1e-12,'translation axial');assert.ok(maxAbs(k.endRotations.i)<1e-12);assert.ok(maxAbs(k.endRotations.j)<1e-12);
}

// 3) Arbitrary finite rigid-body rotation + translation must be filtered out.
{
  const r=[.31,-.24,.18],t=[.8,.2,-.35],ui=rigidBodyDisplacement3D(a,r,t),uj=rigidBodyDisplacement3D(b,r,t),k=corotationalFrame3DKinematics(a,b,e,[...ui,...uj]);
  near(k.currentLength,k.initialLength,1e-10,'rigid rotation length');near(k.axial,0,1e-10,'rigid rotation axial');
  assert.ok(maxAbs(k.endRotations.i)<2e-10,`rigid i rotations ${k.endRotations.i}`);assert.ok(maxAbs(k.endRotations.j)<2e-10,`rigid j rotations ${k.endRotations.j}`);
}

// 4) Pure axial extension is preserved while rotations remain zero.
{
  const delta=.012,u=Array(12).fill(0);u[6]=delta;const k=corotationalFrame3DKinematics(a,b,e,u);
  near(k.axial,delta,1e-12,'axial extension');assert.ok(maxAbs(k.endRotations.i)<1e-12);assert.ok(maxAbs(k.endRotations.j)<1e-12);
}

// 5) A transverse chord rotation with unrotated end sections becomes local bending rotation.
{
  const u=Array(12).fill(0);u[7]=.15;const k=corotationalFrame3DKinematics(a,b,e,u),slope=Math.atan2(.15,3);
  assert.ok(Math.abs(k.endRotations.i[2])>slope*.9,'end i must retain bending rotation relative to chord');
  assert.ok(Math.abs(k.endRotations.j[2])>slope*.9,'end j must retain bending rotation relative to chord');
  near(Math.abs(k.endRotations.i[2]),Math.abs(k.endRotations.j[2]),2e-4,'symmetric chord rotation');
}

// 6) Relative end twist is retained while common twist is filtered by the element frame.
{
  const u=Array(12).fill(0),theta=.08;u[3]=-theta/2;u[9]=theta/2;const k=corotationalFrame3DKinematics(a,b,e,u),twist=k.endRotations.j[0]-k.endRotations.i[0];
  near(twist,theta,2e-4,'relative twist');near(k.endRotations.i[0]+k.endRotations.j[0],0,2e-4,'mean twist');
}

console.log('v0.30 co-rotational 3D kinematics/objectivity smoke: OK');
