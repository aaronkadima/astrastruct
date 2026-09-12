import assert from 'node:assert/strict';
import { solve } from '../web/src/solver/index.js';
import { solveFramePDelta3D } from '../web/src/solver/pdelta3d.js';

const E=200e6,nu=.3,A=.012,Iy=7e-5,Iz=9e-5,J=1.6e-5,L=3,P=1000,e0mm=5;
const project={
  name:'v0.29 modal imperfection 3D benchmark',
  materials:[{id:'S',name:'Steel',type:'steel',E,nu,density:78.5}],
  sections:[{id:'SEC',name:'3D section',family:'i',A,Iy,Iz,J,I:Iz}],
  nodes:[{id:'N1',x:0,y:0,z:0},{id:'N2',x:L,y:0,z:0}],
  elements:[{id:'E1',type:'frame3d',n1:'N1',n2:'N2',materialId:'S',sectionId:'SEC',A,Iy,Iz,J,orientation:{up:[0,1,0]}}],
  supports:[{nodeId:'N1',ux:true,uy:true,uz:true,rx:true,ry:true,rz:true}],
  loadCases:[{id:'LC1',name:'Compression',type:'user'}],
  loadCombinations:[],
  loads:[{id:'L1',nodeId:'N2',caseId:'LC1',fx:-P,fy:0,fz:0,mx:0,my:0,mz:0}],
  elementLoads:[],
  nodalMasses:[],settlements:[],nodeSprings:[],
  settings:{analysisType:'pdelta',analysisScenarioId:'LC1',pDeltaMaxIterations:80,pDeltaTolerance:1e-11,imperfection:{enabled:true,source:'bucklingMode',mode:1,amplitudeMm:e0mm,scenarioId:'LC1'}}
};

const maxTranslation=rows=>Math.max(...rows.flatMap(d=>[Math.abs(Number(d.ux)||0),Math.abs(Number(d.uy)||0),Math.abs(Number(d.uz)||0)]));

// 1) Dispatcher deve gerar automaticamente a imperfeição pelo modo de flambagem 3D.
{
  const r=solve(project);
  assert.equal(r.dimension,'3d');
  assert.equal(r.analysisType,'pdelta');
  assert.equal(r.solverVersion,'0.29.0');
  assert.equal(r.pDelta?.imperfection?.enabled,true);
  assert.equal(r.pDelta?.imperfection?.mode,1);
  assert.ok(r.pDelta.imperfection.criticalFactor>1,`lambda_cr deve ser > 1; obtido ${r.pDelta.imperfection.criticalFactor}`);
  const e0=maxTranslation(r.initialDisplacements),inc=maxTranslation(r.displacements),total=maxTranslation(r.totalDisplacements);
  assert.ok(Math.abs(e0-e0mm/1000)<1e-10,`amplitude inicial: ${e0}`);
  assert.ok(inc>0,'a compressão deve produzir incremento lateral devido à imperfeição');
  assert.ok(total>e0,'deslocamento total deve ser maior que a imperfeição inicial');
  for(let i=0;i<r.displacements.length;i++){
    const a=r.initialDisplacements[i],d=r.displacements[i],t=r.totalDisplacements[i];
    for(const k of ['ux','uy','uz','rx','ry','rz']) assert.ok(Math.abs((Number(a[k])||0)+(Number(d[k])||0)-(Number(t[k])||0))<1e-12,`${k}: u0+du != total`);
  }
  const lambda=Number(r.pDelta.imperfection.criticalFactor),expected=e0*lambda/(lambda-1);
  const rel=Math.abs(total-expected)/Math.max(expected,1e-12);
  assert.ok(rel<0.08,`amplificação modal fora do esperado: total=${total}, teórico=${expected}, erro rel=${rel}`);
  console.log('v0.29 imperfection amplification', {lambda,e0,total,expected,rel});
}

// 2) Vetor imposto diretamente é validado e não pode violar DOFs de apoio.
{
  const clean={...project,settings:{...project.settings,imperfection:{enabled:false}}};
  assert.throws(()=>solveFramePDelta3D(clean,{initialImperfection:{vector:[0,1]}}),/vetor deve possuir/i);
  const bad=Array(12).fill(0);bad[0]=.001;bad[7]=.005;
  assert.throws(()=>solveFramePDelta3D(clean,{initialImperfection:{vector:bad}}),/incompatível com apoio/i);
}

// 3) Imperfeição manual admissível também deve amplificar sob compressão.
{
  const clean={...project,settings:{...project.settings,imperfection:{enabled:false}}};
  const v=Array(12).fill(0);v[7]=.004;v[11]=.004/L;
  const r=solveFramePDelta3D(clean,{initialImperfection:{source:'manual-test',mode:1,vector:v,criticalFactor:20}});
  assert.equal(r.solverVersion,'0.29.0');
  assert.equal(r.pDelta.imperfection.enabled,true);
  assert.ok(maxTranslation(r.totalDisplacements)>maxTranslation(r.initialDisplacements));
}

console.log('v0.29 P-Delta 3D modal imperfection smoke: OK');
