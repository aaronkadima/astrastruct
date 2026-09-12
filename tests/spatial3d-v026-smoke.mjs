import assert from 'node:assert/strict';
import { solveSpatial3D, spatialAxes, frame3DLocalStiffness } from '../web/src/solver/spatial3d.js';

const close=(a,b,tol,msg)=>assert.ok(Math.abs(a-b)<=tol,`${msg}: got ${a}, expected ${b}, err ${Math.abs(a-b)}`);
const E=200e6,nu=.3,G=E/(2*(1+nu)),A=.012,Iy=7e-5,Iz=9e-5,J=1.6e-5,L=3,P=12,T=7;
const base={materials:[{id:'S',type:'steel',E,nu,density:78.5}],sections:[{id:'SEC',family:'i',A,Iy,Iz,J,I:Iz}],elementLoads:[],loads:[],supports:[]};

// 1) Cantilever bending about local z (global Y load) + torsion.
{
 const p={...base,nodes:[{id:'N1',x:0,y:0,z:0},{id:'N2',x:L,y:0,z:0}],elements:[{id:'E1',type:'frame3d',n1:'N1',n2:'N2',materialId:'S',sectionId:'SEC',A,Iy,Iz,J,orientation:{up:[0,1,0]}}],supports:[{nodeId:'N1',ux:true,uy:true,uz:true,rx:true,ry:true,rz:true}],loads:[{nodeId:'N2',fx:0,fy:-P,fz:0,mx:T,my:0,mz:0}],elementLoads:[]};
 const r=solveSpatial3D(p),d=r.displacements.find(x=>x.nodeId==='N2');
 close(d.uy,-P*L**3/(3*E*Iz),2e-12,'frame3d uy cantilever');
 close(d.rz,-P*L**2/(2*E*Iz),2e-12,'frame3d rz cantilever');
 close(d.rx,T*L/(G*J),2e-12,'frame3d torsion');
 const ef=r.elementForces[0];close(ef.Vy1,P,1e-8,'frame3d shear reaction');close(Math.abs(ef.Mz1),P*L,1e-8,'frame3d root bending');close(Math.abs(ef.T1),T,1e-8,'frame3d torsion force');
}

// 2) Cantilever bending in orthogonal plane uses Iy and the expected right-hand rotation sign.
{
 const p={...base,nodes:[{id:'N1',x:0,y:0,z:0},{id:'N2',x:L,y:0,z:0}],elements:[{id:'E1',type:'frame3d',n1:'N1',n2:'N2',materialId:'S',sectionId:'SEC',A,Iy,Iz,J,orientation:{up:[0,1,0]}}],supports:[{nodeId:'N1',ux:true,uy:true,uz:true,rx:true,ry:true,rz:true}],loads:[{nodeId:'N2',fz:-P}],elementLoads:[]};
 const d=solveSpatial3D(p).displacements[1];
 close(d.uz,-P*L**3/(3*E*Iy),2e-12,'frame3d uz cantilever');
 close(d.ry,P*L**2/(2*E*Iy),2e-12,'frame3d ry cantilever');
}

// 3) Axial response is invariant to arbitrary 3D orientation.
{
 const b={x:2.1,y:-1.4,z:2.6},LL=Math.hypot(b.x,b.y,b.z),ex=[b.x/LL,b.y/LL,b.z/LL],Q=35;
 const p={...base,nodes:[{id:'N1',x:0,y:0,z:0},{id:'N2',...b}],elements:[{id:'E1',type:'frame3d',n1:'N1',n2:'N2',materialId:'S',sectionId:'SEC',A,Iy,Iz,J,orientation:{up:[0,0,1]}}],supports:[{nodeId:'N1',ux:true,uy:true,uz:true,rx:true,ry:true,rz:true}],loads:[{nodeId:'N2',fx:Q*ex[0],fy:Q*ex[1],fz:Q*ex[2]}],elementLoads:[]};
 const r=solveSpatial3D(p),d=r.displacements[1],axial=d.ux*ex[0]+d.uy*ex[1]+d.uz*ex[2];
 close(axial,Q*LL/(E*A),2e-11,'frame3d arbitrary orientation axial displacement');
 close(r.elementForces[0].N2,Q,2e-7,'frame3d axial force');
 const ax=spatialAxes(p.nodes[0],p.nodes[1],p.elements[0]);
 close(ax.ex.reduce((s,v,i)=>s+v*ax.ey[i],0),0,1e-12,'axes ex·ey');
 close(ax.ex.reduce((s,v,i)=>s+v*ax.ez[i],0),0,1e-12,'axes ex·ez');
 close(ax.ey.reduce((s,v,i)=>s+v*ax.ez[i],0),0,1e-12,'axes ey·ez');
}

// 4) Truss 3D axial benchmark; rotations are automatically inactive.
{
 const p={...base,nodes:[{id:'N1',x:0,y:0,z:0},{id:'N2',x:L,y:0,z:0}],elements:[{id:'T1',type:'truss3d',n1:'N1',n2:'N2',materialId:'S',sectionId:'SEC',A}],supports:[{nodeId:'N1',ux:true,uy:true,uz:true},{nodeId:'N2',uy:true,uz:true}],loads:[{nodeId:'N2',fx:P}],elementLoads:[]};
 const r=solveSpatial3D(p),d=r.displacements[1];
 close(d.ux,P*L/(E*A),2e-12,'truss3d axial displacement');
 close(r.elementForces[0].axialForce,P,1e-9,'truss3d axial force');
 assert.equal(r.activeDofs,1);
}

// 5) Uniform local qy gives classical fixed-end balance on a fixed-fixed member.
{
 const q=-8;
 const p={...base,nodes:[{id:'N1',x:0,y:0,z:0},{id:'N2',x:L,y:0,z:0}],elements:[{id:'E1',type:'frame3d',n1:'N1',n2:'N2',materialId:'S',sectionId:'SEC',A,Iy,Iz,J,orientation:{up:[0,1,0]}}],supports:[{nodeId:'N1',ux:true,uy:true,uz:true,rx:true,ry:true,rz:true},{nodeId:'N2',ux:true,uy:true,uz:true,rx:true,ry:true,rz:true}],loads:[],elementLoads:[{elementId:'E1',kind:'uniform',qx:0,qy:q,qz:0}]};
 const r=solveSpatial3D(p);close(r.reactions[0].fy,-q*L/2,1e-9,'uniform reaction 1');close(r.reactions[1].fy,-q*L/2,1e-9,'uniform reaction 2');close(Math.abs(r.reactions[0].mz),Math.abs(q)*L*L/12,1e-9,'uniform fixed-end moment');
}

// 6) Local stiffness remains symmetric.
{
 const k=frame3DLocalStiffness({E,G,A,Iy,Iz,J,L});let max=0;for(let i=0;i<12;i++)for(let j=0;j<12;j++)max=Math.max(max,Math.abs(k[i][j]-k[j][i]));assert.ok(max<1e-12);
}
console.log('v0.26 spatial 3D smoke: OK');
