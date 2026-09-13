import assert from 'node:assert/strict';
import { solveSpatial3D } from '../web/src/solver/spatial3d.js';
import { solveFramePDelta3D } from '../web/src/solver/pdelta3d.js';
import { solveModal3D, solveBuckling3D } from '../web/src/solver/modalStability3d.js';

const E=200e6,nu=.3,A=.012,Iy=8e-5,Iz=1.1e-4,J=2e-5,L=3;
const material={id:'S',type:'steel',E,nu,density:78.5};
const section={id:'SEC',family:'steel3d',A,Iy,Iz,J,I:Iz};
const rigidSprings={rx1:null,ry1:null,rz1:null,rx2:null,ry2:null,rz2:null};
const releases={rx1:false,ry1:false,rz1:false,rx2:false,ry2:false,rz2:false};

function cantilever({semi=false,axial=0,lateral=-10,analysisType='linear'}={}){
  const rotationalSprings=semi?{...rigidSprings,ry1:3000,rz1:3000}:rigidSprings;
  return {
    id:'connection-analysis',name:'3D end connection benchmark',version:13,schemaVersion:2,units:'kN-m-MPa',
    nodes:[{id:'N1',x:0,y:0,z:0},{id:'N2',x:L,y:0,z:0}],
    elements:[{id:'E1',type:'frame3d',n1:'N1',n2:'N2',materialId:'S',sectionId:'SEC',A,Iy,Iz,J,orientation:{up:[0,0,1]},releases:{...releases},rotationalSprings}],
    materials:[material],sections:[section],supports:[{nodeId:'N1',ux:true,uy:true,uz:true,rx:true,ry:true,rz:true}],
    loads:[{id:'P',caseId:'LC1',nodeId:'N2',fx:-axial,fy:lateral,fz:0,mx:0,my:0,mz:0}],elementLoads:[],settlements:[],nodeSprings:[],nodalMasses:[],
    loadCases:[{id:'LC1',name:'Caso 1',type:'user'}],loadCombinations:[],connections:[],settings:{analysisType,analysisScenarioId:'LC1',activeLoadCaseId:'LC1',pDeltaMaxIterations:60,pDeltaTolerance:1e-10,dynamicMassFormulation:'consistent',modalModes:3}
  };
}

// With zero axial force, the connection-aware P-Delta tangent must collapse to the
// same statically-condensed elastic system used by the linear spatial solver.
{
  const p=cantilever({semi:true,axial:0,lateral:-10}),lin=solveSpatial3D(p),pd=solveFramePDelta3D({...p,settings:{...p.settings,analysisType:'pdelta'}}),a=lin.displacements[1],b=pd.displacements[1];
  assert.ok(Math.abs(a.uy-b.uy)<1e-10,`linear/P-Delta uy mismatch: ${a.uy} vs ${b.uy}`);
  assert.ok(Math.abs(a.rz-b.rz)<1e-10,`linear/P-Delta rz mismatch: ${a.rz} vs ${b.rz}`);
  assert.ok(pd.pDelta.semiRigidConnectionCount>=2);
}

// A finite rotational spring at the fixed support must soften the structure and
// therefore reduce the first natural frequency while keeping it strictly positive.
{
  const rigid=solveModal3D(cantilever({semi:false,lateral:0,analysisType:'modal'}),{modes:2}),semi=solveModal3D(cantilever({semi:true,lateral:0,analysisType:'modal'}),{modes:2});
  const fr=rigid.modes[0].frequencyHz,fs=semi.modes[0].frequencyHz;
  assert.ok(fr>0&&fs>0,`modal frequencies must be positive: rigid=${fr}, semi=${fs}`);
  assert.ok(fs<fr,`semi-rigid base should reduce first frequency: rigid=${fr}, semi=${fs}`);
  assert.equal(semi.connectionAware,true);
  assert.ok(semi.semiRigidConnectionCount>=2);
}

// The same semi-rigid base must reduce the elastic eigen-buckling load factor.
{
  const rigidProject=cantilever({semi:false,axial:100,lateral:0}),semiProject=cantilever({semi:true,axial:100,lateral:0});
  const rigid=solveBuckling3D(rigidProject,'LC1',{modes:2}),semi=solveBuckling3D(semiProject,'LC1',{modes:2});
  assert.ok(rigid.criticalFactor>0&&semi.criticalFactor>0);
  assert.ok(semi.criticalFactor<rigid.criticalFactor,`semi-rigid base should reduce buckling factor: rigid=${rigid.criticalFactor}, semi=${semi.criticalFactor}`);
  assert.equal(semi.stability.connectionAware,true);
  assert.ok(semi.stability.semiRigidConnectionCount>=2);
}

console.log('end-connections3d-analysis-v030-smoke: OK');
