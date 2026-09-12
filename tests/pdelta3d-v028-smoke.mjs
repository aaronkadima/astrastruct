import assert from 'node:assert/strict';
import { solveSpatial3D } from '../web/src/solver/spatial3d.js';
import { solveFramePDelta3D } from '../web/src/solver/pdelta3d.js';
import { solve } from '../web/src/solver/index.js';

const close=(a,b,tol,msg)=>assert.ok(Math.abs(a-b)<=tol,`${msg}: got ${a}, expected ${b}, err ${Math.abs(a-b)}`);
const E=200e6,nu=.3,A=.012,Iy=7e-5,Iz=9e-5,J=1.6e-5,L=3,H=10;
const base={materials:[{id:'S',type:'steel',E,nu,density:78.5}],sections:[{id:'SEC',family:'i',A,Iy,Iz,J,I:Iz}],elementLoads:[],loads:[],supports:[],settings:{analysisType:'pdelta',pDeltaMaxIterations:60,pDeltaTolerance:1e-10}};

function cantilever({P=0,fy=-H,fz=0}={}){
  return {...base,nodes:[{id:'N1',x:0,y:0,z:0},{id:'N2',x:L,y:0,z:0}],elements:[{id:'E1',type:'frame3d',n1:'N1',n2:'N2',materialId:'S',sectionId:'SEC',A,Iy,Iz,J,orientation:{up:[0,1,0]}}],supports:[{nodeId:'N1',ux:true,uy:true,uz:true,rx:true,ry:true,rz:true}],loads:[{nodeId:'N2',fx:-P,fy,fz}],elementLoads:[]};
}

// 1) Sem esforço axial, P-Delta deve coincidir com a solução linear 3D.
{
  const p=cantilever({P:0}),lin=solveSpatial3D(p),pd=solveFramePDelta3D(p),dl=lin.displacements[1],dp=pd.displacements[1];
  close(dp.uy,dl.uy,1e-12,'P=0 uy');
  close(dp.rz,dl.rz,1e-12,'P=0 rz');
  assert.equal(pd.pDelta.converged,true);
}

// 2) Compressão subcrítica amplifica o deslocamento lateral no plano local y-z.
{
  const p=cantilever({P:1000}),lin=solveSpatial3D(p),pd=solveFramePDelta3D(p),dl=lin.displacements[1],dp=pd.displacements[1];
  assert.ok(Math.abs(dp.uy)>Math.abs(dl.uy)*1.02,`amplificação lateral insuficiente: linear=${dl.uy}, pdelta=${dp.uy}`);
  assert.ok(pd.pDelta.iterations>=2);
  const N=pd.pDelta.axialForces.find(x=>x.elementId==='E1')?.N;
  assert.ok(N<0,`compressão deve ser negativa, N=${N}`);
}

// 3) A amplificação também ocorre no plano ortogonal e usa Iy.
{
  const p=cantilever({P:1000,fy:0,fz:-H}),lin=solveSpatial3D(p),pd=solveFramePDelta3D(p),dl=lin.displacements[1],dp=pd.displacements[1];
  assert.ok(Math.abs(dp.uz)>Math.abs(dl.uz)*1.02,`amplificação ortogonal insuficiente: linear=${dl.uz}, pdelta=${dp.uz}`);
}

// 4) Integração pelo dispatcher principal reconhece P-Delta 3D.
{
  const p=cantilever({P:500}),r=solve(p);
  assert.equal(r.dimension,'3d');
  assert.equal(r.analysisType,'pdelta');
  assert.equal(r.solverVersion,'0.28.0');
  assert.equal(r.pDelta?.converged,true);
}

// 5) O escopo protegido rejeita truss3d/mistos e imperfeição modal 3D nesta versão.
{
  const p=cantilever({P:100});
  assert.throws(()=>solveFramePDelta3D({...p,elements:[{...p.elements[0],type:'truss3d'}]}),/somente.*frame3d/i);
  assert.throws(()=>solveFramePDelta3D({...p,settings:{...p.settings,imperfection:{enabled:true}}}),/imperfei/i);
}

console.log('v0.28 P-Delta 3D smoke: OK');
