import assert from 'node:assert/strict';
import { solve } from '../web/src/solver/index.js';
import { solveFrameCorotational3DWithDeadLoads } from '../web/src/solver/corotational3dLoads.js';
import { buildStressFreeImperfectionReference3D } from '../web/src/solver/corotational3dImperfection.js';

const E=200e6,nu=.3,A=.012,Iy=7e-5,Iz=9e-5,J=1.6e-5,L=3,P=1000,e0mm=5;
const base={
  name:'v0.30 stress-free modal imperfection 3D',
  materials:[{id:'S',name:'Steel',type:'steel',E,nu,density:78.5}],
  sections:[{id:'SEC',name:'3D section',family:'i',A,Iy,Iz,J,I:Iz}],
  nodes:[{id:'N1',x:0,y:0,z:0},{id:'N2',x:L,y:0,z:0}],
  elements:[{id:'E1',type:'frame3d',n1:'N1',n2:'N2',materialId:'S',sectionId:'SEC',A,Iy,Iz,J,orientation:{up:[0,1,0]}}],
  supports:[{nodeId:'N1',ux:true,uy:true,uz:true,rx:true,ry:true,rz:true}],
  loadCases:[{id:'LC1',name:'Compression',type:'user'}],loadCombinations:[],
  loads:[{id:'L1',nodeId:'N2',caseId:'LC1',fx:-P,fy:0,fz:0,mx:0,my:0,mz:0}],
  elementLoads:[],nodalMasses:[],settlements:[],nodeSprings:[],
  settings:{analysisType:'corotational',analysisScenarioId:'LC1',activeLoadCaseId:'LC1',nonlinearControlMode:'load',nonlinearSteps:10,nonlinearMaxIterations:40,nonlinearTolerance:1e-8,nonlinearLineSearch:true,imperfection:{enabled:true,source:'bucklingMode',mode:1,amplitudeMm:e0mm,scenarioId:'LC1'}}
};
const maxTranslation=rows=>Math.max(0,...(rows||[]).map(d=>Math.hypot(Number(d.ux)||0,Number(d.uy)||0,Number(d.uz)||0)));
const maxForce=r=>Math.max(0,...(r.elementForces||[]).flatMap(f=>['N1','N2','Vy1','Vy2','Vz1','Vz2','T1','T2','My1','My2','Mz1','Mz2'].map(k=>Math.abs(Number(f[k])||0))));

// 1) An explicitly imperfect reference with no loads must remain naturally stress free.
{
  const clean={...base,loads:[],settings:{...base.settings,imperfection:{enabled:false}}};
  const vector=Array(12).fill(0);vector[7]=.005;vector[11]=.005/L;
  const ref=buildStressFreeImperfectionReference3D(clean,{source:'manual-test',mode:1,amplitudeMm:5,vector});
  const r=solveFrameCorotational3DWithDeadLoads(ref.project,{steps:2,tolerance:1e-9});
  assert.ok(maxTranslation(r.displacements)<1e-12,`referência sem carga deve ter Δu≈0; obtido ${maxTranslation(r.displacements)}`);
  assert.ok(maxForce(r)<1e-8,`referência sem carga deve ter forças≈0; obtido ${maxForce(r)}`);
  assert.ok(Math.abs(ref.project.nodes[1].y-.005)<1e-12,'geometria de referência deve conter u0');
}

// 2) Dispatcher generates the 3D buckling mode, solves on the stress-free imperfect reference and returns u0, Δu and total.
{
  const r=solve(base,'LC1');
  assert.equal(r.dimension,'3d');assert.equal(r.analysisType,'corotational');assert.equal(r.solverVersion,'0.30.0-exp');
  assert.equal(r.nonlinear?.imperfection?.enabled,true);assert.equal(r.nonlinear?.imperfection?.stressFreeReference,true);assert.equal(r.nonlinear?.imperfection?.mode,1);
  assert.ok(r.nonlinear.imperfection.criticalFactor>1,`lambda_cr=${r.nonlinear.imperfection.criticalFactor}`);
  const e0=maxTranslation(r.initialDisplacements),inc=maxTranslation(r.displacements),total=maxTranslation(r.totalDisplacements);
  assert.ok(Math.abs(e0-e0mm/1000)<1e-9,`e0=${e0}`);assert.ok(inc>1e-6,'compressão deve produzir incremento sobre a referência imperfeita');assert.ok(total>e0*1.02,`total=${total}, e0=${e0}`);
  for(let i=0;i<r.totalDisplacements.length;i++)for(const k of ['ux','uy','uz','rx','ry','rz']){const u0=Number(r.initialDisplacements[i][k])||0,du=Number(r.displacements[i][k])||0,ut=Number(r.totalDisplacements[i][k])||0;assert.ok(Math.abs(u0+du-ut)<1e-12,`${k}: u0+du != total`)}
  const root=r.reactions.find(x=>x.nodeId==='N1');assert.ok(Math.abs(root.fx-P)<1e-2,`equilíbrio axial: Rx=${root.fx}`);
  console.log('v0.30 stress-free modal imperfection integration',{lambda:r.nonlinear.imperfection.criticalFactor,e0,increment:inc,total,amplification:total/e0});
}

// 3) Support compatibility remains protected.
{
  const vector=Array(12).fill(0);vector[0]=.001;vector[7]=.005;
  assert.throws(()=>buildStressFreeImperfectionReference3D(base,{vector}),/incompatível com apoio/i);
}

console.log('v0.30 co-rotational 3D modal imperfection smoke: OK');
