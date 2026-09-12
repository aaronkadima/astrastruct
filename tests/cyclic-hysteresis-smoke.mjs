import assert from 'node:assert/strict';
import { cyclicSteelState } from '../web/src/solver/material1d.js';
import { distributedSteelFiberBasicState } from '../web/src/solver/distributedPlasticity2d.js';
import { solveFrameCorotationalDisplacementControl2D } from '../web/src/solver/corotational2d.js';

const E=200e6,fy=355e3,b=.01;
let committed=null;
const path=[0,.004,0,-.004,0,.004];
const states=[];
for(const strain of path){const s=cyclicSteelState({strain,E,fy,hardeningRatio:b,kinematicFraction:1,committed});states.push(s);committed=s.history;}
assert(states[1].yielded,'tension excursion should yield');
assert(states[2].stress<0,'unloading to zero strain should retain compressive residual stress');
assert(states[3].yielded,'reverse excursion should yield');
assert(states[5].dissipatedEnergyDensity>0,'cyclic plasticity should dissipate energy');
assert(Math.abs(states[5].backstress)>0,'kinematic hardening should translate the yield surface');

const section={id:'R',family:'rect',b:.2,h:.4,A:.08,I:.0010666666666666667};
const material={id:'S355',type:'steel',E,fy:355};
const cfg={enabled:true,integrationPoints:5,nFibers:80,hardeningRatio:.01,cyclic:true,kinematicFraction:1};
let history=null;
const seq=[[0,.035,0],[0,-.035,0],[0,.035,0]];
let basic=null;
for(const elasticBasic of seq){basic=distributedSteelFiberBasicState({elasticBasic,L0:2,section,material,config:cfg,committedHistory:history});history=basic.historyTrial;}
assert(basic.cumulativeDissipatedEnergy>0,'distributed fibers should accumulate hysteretic dissipation');
assert(basic.sections.some(s=>s.maxEquivalentPlasticStrain>0),'section history should retain plastic strain');

const project={
  nodes:[{id:'N1',x:0,y:0},{id:'N2',x:2,y:0}],
  elements:[{id:'E1',type:'frame2d',n1:'N1',n2:'N2',materialId:'S355',sectionId:'R',A:section.A,I:section.I,releases:{rz1:false,rz2:false},rotationalSprings:{rz1:null,rz2:null},distributedPlasticity:cfg}],
  materials:[material],sections:[section],supports:[{nodeId:'N1',ux:true,uy:true,rz:true}],
  loads:[{id:'L1',caseId:'LC1',nodeId:'N2',fx:0,fy:-1000,mz:0}],elementLoads:[],nodeSprings:[],settlements:[],
  loadCases:[{id:'LC1',name:'Cyclic',type:'user'}],loadCombinations:[],settings:{activeLoadCaseId:'LC1'}
};
const result=solveFrameCorotationalDisplacementControl2D(project,'LC1',{steps:12,maxIterations:70,tolerance:1e-8,absoluteTolerance:1e-9,lineSearch:true,displacementTolerance:1e-7,displacementControl:{nodeId:'N2',dof:'uy',targetDisplacement:-.03},cyclicProtocol:{enabled:true,targets:[-.03,.03,-.03,0],stepsPerSegment:5}});
assert.equal(result.solverVersion,'0.21.0-exp');
assert.equal(result.pushover.cyclicProtocol.enabled,true);
assert.equal(result.pushover.curve.length,20);
assert(result.pushover.curve.some((r,i,a)=>i>0&&Math.sign(r.controlledDisplacement)!==Math.sign(a[i-1].controlledDisplacement)),'path should reverse displacement sign');
assert(result.distributedPlasticity.cyclicHistory,'distributed result should report cyclic history');
assert(result.pushover.cumulativeDissipatedEnergy>0,'global cyclic solution should dissipate energy');
assert(Math.abs(result.displacements.find(d=>d.nodeId==='N2').uy)<1e-6,'final protocol target should return near zero displacement');
console.log('v0.21 cyclic hysteresis smoke: OK');
