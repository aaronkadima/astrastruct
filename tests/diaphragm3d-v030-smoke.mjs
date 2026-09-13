import assert from 'node:assert/strict';
import { solveSpatial3D } from '../web/src/solver/spatial3d.js';
import { buildRigidDiaphragmTransform3D } from '../web/src/solver/diaphragm3d.js';

const E=30e6,nu=.2,A=.20,Iy=.004,Iz=.006,J=.0025,H=3;
const xy=[[0,0],[4,0],[4,3],[0,3]];
const nodes=[];for(let i=0;i<4;i++){nodes.push({id:`B${i+1}`,x:xy[i][0],y:xy[i][1],z:0,levelId:'L0'},{id:`T${i+1}`,x:xy[i][0],y:xy[i][1],z:H,levelId:'L1'})}
const elements=Array.from({length:4},(_,i)=>({id:`C${i+1}`,type:'frame3d',n1:`B${i+1}`,n2:`T${i+1}`,materialId:'C',sectionId:'SEC',A,Iy,Iz,J}));
const supports=Array.from({length:4},(_,i)=>({nodeId:`B${i+1}`,ux:true,uy:true,uz:true,rx:true,ry:true,rz:true}));
const base={id:'dia3d',nodes,elements,materials:[{id:'C',type:'concrete',E,nu,density:25}],sections:[{id:'SEC',A,Iy,Iz,J,I:Iz}],supports,loads:[{id:'L',caseId:'LC1',nodeId:'T1',fx:10,fy:4,fz:0,mx:0,my:0,mz:0}],elementLoads:[],settlements:[],nodeSprings:[],nodalMasses:[],loadCases:[{id:'LC1',name:'Caso 1',type:'user'}],loadCombinations:[],settings:{analysisType:'linear',analysisScenarioId:'LC1',activeLoadCaseId:'LC1'},levels:[{id:'L0',name:'Base',elevation:0,index:0},{id:'L1',name:'Pavimento 1',elevation:H,index:1}],diaphragms:[{id:'D1',levelId:'L1',plane:'xy',rigid:true,enabled:true}]};

// The transformation eliminates three in-plane DOFs for every slave node.
{
  const tr=buildRigidDiaphragmTransform3D(base,nodes);assert.equal(tr.active,true);assert.equal(tr.groups.length,1);assert.equal(tr.groups[0].nodeIds.length,4);assert.equal(tr.eliminated.size,9);assert.equal(tr.T.length,48);assert.equal(tr.T[0].length,39);
}

// Linear analysis must satisfy exact rigid-body in-plane kinematics and keep
// diaphragm constraint forces separate from physical support reactions.
{
  const r=solveSpatial3D(base);assert.equal(r.diaphragms.active,true);assert.equal(r.diaphragms.count,1);assert.equal(r.reducedDofs,39);
  const g=r.diaphragms.groups[0],disp=new Map(r.displacements.map(d=>[d.nodeId,d])),coord=new Map(nodes.map(n=>[n.id,n])),m=disp.get(g.masterNodeId),mc=coord.get(g.masterNodeId);
  for(const id of g.nodeIds){const d=disp.get(id),n=coord.get(id),dx=n.x-mc.x,dy=n.y-mc.y;assert.ok(Math.abs(d.ux-(m.ux-dy*m.rz))<1e-10,`${id} ux diaphragm kinematics`);assert.ok(Math.abs(d.uy-(m.uy+dx*m.rz))<1e-10,`${id} uy diaphragm kinematics`);assert.ok(Math.abs(d.rz-m.rz)<1e-10,`${id} rz diaphragm kinematics`)}
  const sumFx=r.reactions.reduce((s,x)=>s+x.fx,0),sumFy=r.reactions.reduce((s,x)=>s+x.fy,0);assert.ok(Math.abs(sumFx+10)<1e-7,`support equilibrium Fx ${sumFx}`);assert.ok(Math.abs(sumFy+4)<1e-7,`support equilibrium Fy ${sumFy}`);
  const cf=r.diaphragms.constraintForces,fx=cf.reduce((s,x)=>s+x.fx,0),fy=cf.reduce((s,x)=>s+x.fy,0),mz=cf.reduce((s,x)=>{const n=coord.get(x.nodeId);return s+x.mz-(n.y-mc.y)*x.fx+(n.x-mc.x)*x.fy},0);assert.ok(Math.abs(fx)<1e-7);assert.ok(Math.abs(fy)<1e-7);assert.ok(Math.abs(mz)<1e-7);
}

// A planar support at a diaphragm node would impose a general MPC constraint;
// v0.30 rejects it explicitly instead of silently over-constraining the floor.
{
  const bad={...base,supports:[...supports,{nodeId:'T1',ux:true,uy:false,uz:false,rx:false,ry:false,rz:false}]};assert.throws(()=>solveSpatial3D(bad),/diafragma rígido.*apoio\/deslocamento prescrito/i);
}

console.log('diaphragm3d-v030-smoke: OK');
