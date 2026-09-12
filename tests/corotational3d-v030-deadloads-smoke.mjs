import assert from 'node:assert/strict';
import { solveSpatial3D } from '../web/src/solver/spatial3d.js';
import { solveFrameCorotational3DWithDeadLoads, uniformLoadVector3D, pointLoadVector3D } from '../web/src/solver/corotational3dLoads.js';

const close=(a,b,tol,msg)=>assert.ok(Math.abs(a-b)<=tol,`${msg}: got ${a}, expected ${b}, err=${Math.abs(a-b)}`);
const E=200e6,nu=.3,A=.02,Iy=8e-5,Iz=1.1e-4,J=2e-5,L=3,gamma=78.5;
function model(elementLoads=[]){return{nodes:[{id:'N1',x:0,y:0,z:0},{id:'N2',x:L,y:0,z:0}],elements:[{id:'E1',type:'frame3d',n1:'N1',n2:'N2',materialId:'S',sectionId:'SEC',orientation:{up:[0,1,0]}}],materials:[{id:'S',type:'steel',E,nu,density:gamma}],sections:[{id:'SEC',family:'i',A,Iy,Iz,J,I:Iz}],supports:[{nodeId:'N1',ux:true,uy:true,uz:true,rx:true,ry:true,rz:true}],loads:[],elementLoads,nodeSprings:[],settlements:[],settings:{nonlinearSteps:3,nonlinearMaxIterations:30,nonlinearTolerance:1e-8}}}

// Equivalent vectors preserve force and moment resultants in both bending planes.
{
 const q=uniformLoadVector3D(2,-3,4,L);close(q[0]+q[6],2*L,1e-12,'uniform axial resultant');close(q[1]+q[7],-3*L,1e-12,'uniform y resultant');close(q[2]+q[8],4*L,1e-12,'uniform z resultant');
 const p=pointLoadVector3D(5,-6,7,L,.4);close(p[0]+p[6],5,1e-12,'point axial resultant');close(p[1]+p[7],-6,1e-12,'point y resultant');close(p[2]+p[8],7,1e-12,'point z resultant');
}

// Small uniform local load must recover the existing linear 3D solution.
{
 const p=model([{id:'U',elementId:'E1',kind:'uniform',qy:-.20,qz:.12}]),lin=solveSpatial3D(p),cor=solveFrameCorotational3DWithDeadLoads(p,{steps:3,tolerance:1e-9}),ul=lin.displacements[1],uc=cor.displacements[1];
 assert.ok(Math.abs((uc.uy-ul.uy)/ul.uy)<.01,`uniform uy linear limit: ${uc.uy} vs ${ul.uy}`);assert.ok(Math.abs((uc.uz-ul.uz)/ul.uz)<.01,`uniform uz linear limit: ${uc.uz} vs ${ul.uz}`);
 const fl=lin.elementForces[0],fc=cor.elementForces[0];assert.ok(Math.abs(fc.Vy1-fl.Vy1)<.02,'uniform Vy1 recovery');assert.ok(Math.abs(fc.Mz1-fl.Mz1)<.03,'uniform Mz1 recovery');assert.ok(fc.loadSummary.some(x=>x.kind==='uniform'),'uniform load summary');
}

// Interior point load: compare tip displacement and fixed-end resultants with beam theory.
{
 const P=-1.2,xi=.4,a=xi*L,p=model([{id:'P',elementId:'E1',kind:'point',py:P,xi}]),r=solveFrameCorotational3DWithDeadLoads(p,{steps:3,tolerance:1e-9}),tip=r.displacements[1],expected=P*a*a*(3*L-a)/(6*E*Iz),f=r.elementForces[0];
 close(tip.uy,expected,Math.max(2e-8,Math.abs(expected)*.01),'interior point tip deflection');close(r.reactions[0].fy,-P,2e-6,'point load vertical reaction');close(Math.abs(f.Mz1),Math.abs(P*a),3e-5,'point load fixed moment');
}

// Self-weight is a dead load in global -Z and uses gamma [kN/m3] * A [m2].
{
 const p=model([{id:'SW',elementId:'E1',kind:'selfWeight',factor:1}]),w=gamma*A,r=solveFrameCorotational3DWithDeadLoads(p,{steps:4,tolerance:1e-9}),tip=r.displacements[1],expected=-w*L**4/(8*E*Iy),f=r.elementForces[0];
 close(tip.uz,expected,Math.max(2e-8,Math.abs(expected)*.01),'self-weight tip deflection');close(r.reactions[0].fz,w*L,2e-5,'self-weight reaction');close(Math.abs(f.My1),w*L*L/2,5e-4,'self-weight fixed moment');assert.equal(f.loadSummary[0].kind,'selfWeight');close(f.loadSummary[0].w,w,1e-12,'self-weight intensity');
}

// Unsupported thermal element action remains explicitly protected in v0.30.
{
 const p=model([{id:'T',elementId:'E1',kind:'thermal',dT:25}]);assert.throws(()=>solveFrameCorotational3DWithDeadLoads(p),/thermal.*ainda não é suportada|carga de barra 'thermal'/i);
}

console.log('v0.30 co-rotational 3D dead element loads smoke: OK');
