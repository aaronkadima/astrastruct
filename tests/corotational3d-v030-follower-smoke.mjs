import assert from 'node:assert/strict';
import { followerExternalVector3D, numericalFollower3DTangent, rigidBodyDisplacement3D, solveFrameCorotational3D } from '../web/src/solver/corotational3d.js';
import { solveFrameCorotational3DWithDeadLoads } from '../web/src/solver/corotational3dLoads.js';

const close=(a,b,tol,msg)=>assert.ok(Math.abs(a-b)<=tol,`${msg}: got ${a}, expected ${b}, err=${Math.abs(a-b)}`);
const E=200e6,nu=.3,A=.02,Iy=8e-5,Iz=1.1e-4,J=2e-5,L=3;
function model({follower=null,nodal=null}={}){return{nodes:[{id:'N1',x:0,y:0,z:0},{id:'N2',x:L,y:0,z:0}],elements:[{id:'E1',type:'frame3d',n1:'N1',n2:'N2',materialId:'S',sectionId:'SEC',orientation:{up:[0,1,0]}}],materials:[{id:'S',type:'steel',E,nu,density:78.5}],sections:[{id:'SEC',family:'i',A,Iy,Iz,J,I:Iz}],supports:[{nodeId:'N1',ux:true,uy:true,uz:true,rx:true,ry:true,rz:true}],loads:nodal?[{id:'N',nodeId:'N2',fx:nodal.fx||0,fy:nodal.fy||0,fz:nodal.fz||0,mx:0,my:0,mz:0}]:[],elementLoads:follower?[{id:'F',elementId:'E1',kind:'followerEnd',end:2,px:follower.px||0,py:follower.py||0,pz:follower.pz||0}]:[],nodeSprings:[],settlements:[],settings:{nonlinearSteps:6,nonlinearMaxIterations:40,nonlinearTolerance:1e-8}}}

// 1) A local follower vector must rotate with a finite rigid-body rotation of the member.
{
 const p=model({follower:{px:10}}),theta=[0,0,Math.PI/2],u=[...rigidBodyDisplacement3D(p.nodes[0],theta),...rigidBodyDisplacement3D(p.nodes[1],theta)],F=followerExternalVector3D(p,u);
 close(F[6],0,1e-8,'rigid rotation follower Fx');close(F[7],10,1e-8,'rigid rotation follower Fy');close(F[8],0,1e-8,'rigid rotation follower Fz');
}

// 2) Small local transverse follower load must recover the fixed-direction linear limit.
{
 const q=-.20,pf=model({follower:{py:q}}),pn=model({nodal:{fy:q}}),rf=solveFrameCorotational3DWithDeadLoads(pf,{steps:5,tolerance:1e-9}),rn=solveFrameCorotational3D(pn,{steps:5,tolerance:1e-9});
 const rel=Math.abs(rf.displacements[1].uy-rn.displacements[1].uy)/Math.max(1e-12,Math.abs(rn.displacements[1].uy));assert.ok(rel<.01,`follower small-load limit rel=${rel}`);
 assert.equal(rf.nonlinear.nonconservativeFollower,true);assert.equal(rf.nonlinear.followerCount,1);assert.ok(rf.nonlinear.history.every(x=>x.followerLoadFactor>0));
}

// 3) The follower external Jacobian must be configuration-dependent and non-symmetric.
{
 const p=model({follower:{px:-30,py:-4,pz:2}}),u=Array(12).fill(0);u[7]=-.08;u[8]=.04;u[11]=-.03;const K=numericalFollower3DTangent(p,u,{fdStep:2e-7});let max=0,asym=0;for(let i=0;i<12;i++)for(let j=0;j<12;j++){max=Math.max(max,Math.abs(K[i][j]));asym=Math.max(asym,Math.abs(K[i][j]-K[j][i]))}assert.ok(max>1e-4,'follower tangent must be nonzero');assert.ok(asym/Math.max(1e-12,max)>1e-3,`follower tangent should be non-symmetric, ratio=${asym/max}`);
}

// 4) End 1 and follower moments remain protected until their work-conjugate formulation is implemented.
{
 const p=model({follower:{py:-1}});p.elementLoads[0].end=1;assert.throws(()=>solveFrameCorotational3DWithDeadLoads(p),/somente a extremidade 2/i);
 const m=model({follower:{py:-1}});m.elementLoads[0].mz=2;assert.throws(()=>solveFrameCorotational3DWithDeadLoads(m),/momentos seguidores/i);
}

console.log('v0.30 co-rotational 3D follower-force smoke: OK');
