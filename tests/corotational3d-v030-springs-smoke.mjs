import assert from 'node:assert/strict';
import {numericalCorotational3DTangent} from '../web/src/solver/corotational3d.js';
import {solveFrameCorotational3DWithDeadLoads} from '../web/src/solver/corotational3dLoads.js';

const close=(a,b,tol,msg)=>assert.ok(Math.abs(a-b)<=tol,`${msg}: got ${a}, expected ${b}, err=${Math.abs(a-b)}`);
const E=200e6,nu=.3,A=.02,Iy=8e-5,Iz=1.1e-4,J=2e-5,L=3;
function model({loads=[],springs=[]}={}){return{nodes:[{id:'N1',x:0,y:0,z:0},{id:'N2',x:L,y:0,z:0}],elements:[{id:'E1',type:'frame3d',n1:'N1',n2:'N2',materialId:'S',sectionId:'SEC',orientation:{up:[0,1,0]}}],materials:[{id:'S',type:'steel',E,nu,density:78.5}],sections:[{id:'SEC',family:'i',A,Iy,Iz,J,I:Iz}],supports:[{nodeId:'N1',ux:true,uy:true,uz:true,rx:true,ry:true,rz:true}],loads,elementLoads:[],nodeSprings:springs,settlements:[],settings:{nonlinearSteps:4,nonlinearMaxIterations:35,nonlinearTolerance:1e-10}}}

// Axial tip spring acts in parallel with EA/L in the small-displacement limit.
{
 const P=10,k=9000,p=model({loads:[{id:'P',nodeId:'N2',fx:P}],springs:[{id:'S1',nodeId:'N2',kx:k}]}),r=solveFrameCorotational3DWithDeadLoads(p,{steps:4,tolerance:1e-10}),expected=P/(E*A/L+k);
 close(r.displacements[1].ux,expected,Math.max(1e-10,Math.abs(expected)*2e-5),'axial spring displacement');
 const sf=r.springForces[0];close(sf.fx,-k*r.displacements[1].ux,1e-9,'axial spring recovered force');assert.equal(r.nonlinear.springCount,1);
}

// Global Z spring combines with cantilever bending stiffness 3EIy/L^3.
{
 const P=-.8,kz=120,p=model({loads:[{id:'P',nodeId:'N2',fz:P}],springs:[{id:'S1',nodeId:'N2',kz}]}),r=solveFrameCorotational3DWithDeadLoads(p,{steps:4,tolerance:1e-10}),kb=3*E*Iy/L**3,expected=P/(kb+kz);
 close(r.displacements[1].uz,expected,Math.max(2e-8,Math.abs(expected)*.003),'z spring displacement');close(r.springForces[0].fz,-kz*r.displacements[1].uz,2e-8,'z spring force');
}

// Legacy 2D field kr remains a backwards-compatible alias for global krz.
{
 const M=.6,kr=2500,p=model({loads:[{id:'M',nodeId:'N2',mz:M}],springs:[{id:'S1',nodeId:'N2',kr}]}),r=solveFrameCorotational3DWithDeadLoads(p,{steps:4,tolerance:1e-10}),theta=r.displacements[1].rz;
 assert.ok(Math.abs(theta)>0,'legacy kr must restrain rz');close(r.springForces[0].mz,-kr*theta,2e-8,'legacy kr recovered moment');close(r.springForces[0].krz,kr,1e-12,'legacy kr alias');
}

// All six optional spatial spring terms are added exactly to the numerical tangent diagonal.
{
 const ks={kx:101,ky:102,kz:103,krx:104,kry:105,krz:106},base=model(),withS=model({springs:[{id:'S6',nodeId:'N2',...ks}]}),u=[0,0,0,0,0,0,.001,-.002,.003,.004,-.005,.006],K0=numericalCorotational3DTangent(base,u),K1=numericalCorotational3DTangent(withS,u),vals=[ks.kx,ks.ky,ks.kz,ks.krx,ks.kry,ks.krz];
 for(let d=0;d<6;d++){close(K1[6+d][6+d]-K0[6+d][6+d],vals[d],2e-5,`spring tangent dof ${d}`);for(let c=0;c<12;c++)if(c!==6+d)close(K1[6+d][c]-K0[6+d][c],0,2e-5,`spring off-diagonal ${d},${c}`)}
}

// Negative stiffness remains invalid.
{
 const p=model({springs:[{id:'BAD',nodeId:'N2',kz:-1}]});assert.throws(()=>solveFrameCorotational3DWithDeadLoads(p),/rigidez não pode ser negativa/i);
}

console.log('v0.30 co-rotational 3D nodal springs smoke: OK');
