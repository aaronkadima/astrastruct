import assert from 'node:assert/strict';
import { solveSpatial3D } from '../web/src/solver/spatial3d.js';
import { solveFrameCorotational3D } from '../web/src/solver/corotational3d.js';
import { solve } from '../web/src/solver/index.js';

const close=(a,b,tol,msg)=>assert.ok(Math.abs(a-b)<=tol,`${msg}: got ${a}, expected ${b}, err ${Math.abs(a-b)}`);
const E=200e6,nu=.3,A=.02,Iy=8e-5,Iz=1.1e-4,J=2e-5,L=3;
function model(load={}){return{nodes:[{id:'N1',x:0,y:0,z:0},{id:'N2',x:L,y:0,z:0}],elements:[{id:'E1',type:'frame3d',n1:'N1',n2:'N2',materialId:'S',sectionId:'SEC',orientation:{up:[0,1,0]}}],materials:[{id:'S',type:'steel',E,nu,density:78.5}],sections:[{id:'SEC',family:'i',A,Iy,Iz,J,I:Iz}],supports:[{nodeId:'N1',ux:true,uy:true,uz:true,rx:true,ry:true,rz:true}],loads:[{id:'L',nodeId:'N2',fx:0,fy:0,fz:0,mx:0,my:0,mz:0,...load}],elementLoads:[],nodeSprings:[],settlements:[],settings:{nonlinearSteps:4,nonlinearMaxIterations:30,nonlinearTolerance:1e-7}}}

// 1) Axial small-deformation limit must recover PL/EA.
{
 const P=120,p=model({fx:P}),r=solveFrameCorotational3D(p,{steps:2,tolerance:1e-8}),u=r.displacements[1].ux,expected=P*L/(E*A);
 close(u,expected,5e-8,'axial PL/EA');assert.equal(r.nonlinear.converged,true);close(r.reactions[0].fx,-P,1e-5,'axial reaction');
}

// 2) Small transverse load must converge to the linear spatial solution.
{
 const H=-.5,p=model({fy:H}),lin=solveSpatial3D(p),cor=solveFrameCorotational3D(p,{steps:3,tolerance:1e-8}),ul=lin.displacements[1],uc=cor.displacements[1];
 const rel=Math.abs(uc.uy-ul.uy)/Math.max(1e-12,Math.abs(ul.uy));assert.ok(rel<.01,`linear-limit uy rel=${rel}, linear=${ul.uy}, corot=${uc.uy}`);
 const relR=Math.abs(uc.rz-ul.rz)/Math.max(1e-12,Math.abs(ul.rz));assert.ok(relR<.01,`linear-limit rz rel=${relR}`);
}

// 3) Orthogonal flexure uses Iy and must also recover the linear limit.
{
 const H=-.4,p=model({fz:H}),lin=solveSpatial3D(p),cor=solveFrameCorotational3D(p,{steps:3,tolerance:1e-8}),ul=lin.displacements[1],uc=cor.displacements[1];
 const rel=Math.abs(uc.uz-ul.uz)/Math.max(1e-12,Math.abs(ul.uz));assert.ok(rel<.01,`orthogonal linear-limit uz rel=${rel}`);
}

// 4) Moderate 3D transverse loading must converge with finite rotations and balanced reactions.
{
 const p=model({fy:-25,fz:15,mx:2}),r=solveFrameCorotational3D(p,{steps:12,maxIterations:35,tolerance:2e-7}),u=r.displacements[1];
 for(const key of ['ux','uy','uz','rx','ry','rz'])assert.ok(Number.isFinite(u[key]),`${key} must be finite`);
 assert.ok(Math.hypot(u.uy,u.uz)>1e-4,'moderate load should produce transverse displacement');
 close(r.reactions[0].fy,25,2e-3,'Fy equilibrium');close(r.reactions[0].fz,-15,2e-3,'Fz equilibrium');
 assert.equal(r.solverVersion,'0.30.0-exp');
}

// 5) Dispatcher resolves the load case before invoking the experimental spatial solver.
{
 const p=model({fy:-.8,fz:.35});p.id='corot3d-dispatch';p.version=13;p.schemaVersion=2;p.loadCases=[{id:'LC1',name:'LC1'}];p.loadCombinations=[];p.loads=p.loads.map(l=>({...l,caseId:'LC1'}));p.settings={...p.settings,analysisType:'corotational',analysisScenarioId:'LC1',activeLoadCaseId:'LC1',nonlinearControlMode:'load',imperfection:{enabled:false}};
 const r=solve(p);assert.equal(r.dimension,'3d');assert.equal(r.analysisType,'corotational');assert.equal(r.solverVersion,'0.30.0-exp');assert.equal(r.scenario?.id,'LC1');assert.equal(r.nonlinear?.converged,true);
}

// 6) Protected scope rejects distributed loads until the follower/dead-load formulation is added.
{
 const p=model({fy:-1});p.elementLoads=[{id:'q',elementId:'E1',kind:'uniform',qy:-1}];assert.throws(()=>solveFrameCorotational3D(p),/cargas de barra/i);
}

console.log('v0.30 global elastic co-rotational frame3d smoke: OK');
