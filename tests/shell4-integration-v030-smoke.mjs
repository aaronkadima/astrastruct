import assert from 'node:assert/strict';
import { solve } from '../web/src/solver/index.js';

const project={
  id:'shell-global',name:'Shell4 global integration',version:13,schemaVersion:2,units:'kN-m-MPa',
  nodes:[{id:'N1',x:0,y:0,z:0},{id:'N2',x:4,y:0,z:0},{id:'N3',x:4,y:3,z:0},{id:'N4',x:0,y:3,z:0}],
  elements:[{id:'S1',type:'shell4',nodeIds:['N1','N2','N3','N4'],materialId:'C30',sectionId:'SLAB',thickness:.20}],
  materials:[{id:'C30',name:'C30',type:'concrete',E:30e6,nu:.2,density:25}],sections:[{id:'SLAB',name:'Laje 20 cm',family:'shell',thickness:.20}],
  supports:[{nodeId:'N1',ux:true,uy:true,uz:true,rx:true,ry:true,rz:true},{nodeId:'N4',ux:true,uy:true,uz:true,rx:true,ry:true,rz:true}],loads:[],
  elementLoads:[{id:'P',caseId:'G',elementId:'S1',kind:'surface',pressure:-10}],settlements:[],nodeSprings:[],nodalMasses:[],diaphragms:[],
  loadCases:[{id:'G',name:'G',type:'permanent'}],loadCombinations:[{id:'ULS',name:'1.4G',type:'custom',terms:[{caseId:'G',factor:1.4}]}],connections:[],settings:{analysisType:'linear',analysisScenarioId:'ULS',activeLoadCaseId:'G'}
};

const r=solve(project,'ULS');assert.equal(r.dimension,'3d');assert.equal(r.type,'shell4');assert.equal(r.solverVersion,'0.30.0');assert.equal(r.contract.request.model.elementTypes[0],'shell4');
const d2=r.displacements.find(x=>x.nodeId==='N2'),d3=r.displacements.find(x=>x.nodeId==='N3');assert.ok(Number.isFinite(d2.uz)&&d2.uz<0);assert.ok(Number.isFinite(d3.uz)&&d3.uz<0);assert.ok(Math.abs(d2.uz-d3.uz)<1e-10);
const totalRz=r.reactions.reduce((s,x)=>s+x.fz,0),expectedLoad=-10*1.4*12;assert.ok(Math.abs(totalRz+expectedLoad)<1e-6,`surface-load equilibrium: Rz=${totalRz}, load=${expectedLoad}`);
const s=r.elementForces.find(x=>x.elementId==='S1');assert.equal(s.type,'shell4');assert.ok(Number.isFinite(s.bendingMoments.Mx));assert.ok(Number.isFinite(s.bendingMoments.My));assert.ok(Number.isFinite(s.transverseShear.Qx));assert.ok(Math.abs(s.loadSummary[0].pressure+14)<1e-12,'load combination must scale shell pressure');

console.log('shell4-integration-v030-smoke: OK');
