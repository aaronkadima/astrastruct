import assert from 'node:assert/strict';
import { fiberHingeCyclicSectionState } from '../web/src/solver/fiberSection2d.js';
import { solveFrameCorotationalFiberHinges2D } from '../web/src/solver/materialNonlinear2d.js';

const section={id:'R',family:'rect',b:.2,h:.4,A:.08,I:.0010666666666666667};
const material={id:'S355',type:'steel',E:200e6,fy:355};
let history=null;const rotations=[0,.012,0,-.012,0,.012];const local=[];
for(const rotation of rotations){const state=fiberHingeCyclicSectionState({rotation,hingeLength:.35,targetAxialForce:0,section,material,nFibers:80,hardeningRatio:.01,kinematicFraction:1,committedHistory:history});local.push(state);history=state.historyTrial;}
assert(local[1].yieldedFibers>0,'positive hinge excursion should yield fibers');
assert(local[3].yieldedFibers>0,'reverse hinge excursion should yield fibers');
assert(local[5].cumulativeDissipatedEnergy>0,'cyclic hinge should dissipate energy');
assert(local[5].maxEquivalentPlasticStrain>0,'cyclic hinge should retain plastic demand');
assert(local[5].maxReversalCount>=2,'reversal counter should accumulate in the prescribed local rotation history');
assert(local[2].moment<0,'return to zero rotation should exhibit residual moment under kinematic hardening');

const project={nodes:[{id:'N1',x:0,y:0},{id:'N2',x:2,y:0}],elements:[{id:'E1',type:'frame2d',n1:'N1',n2:'N2',materialId:'S355',sectionId:'R',A:section.A,I:section.I,releases:{rz1:false,rz2:false},rotationalSprings:{rz1:null,rz2:null},fiberHinges:{rz1:{enabled:true,hingeLength:.35,nFibers:80,hardeningRatio:.01,cyclic:true,kinematicFraction:1},rz2:{enabled:false}}}],materials:[material],sections:[section],supports:[{nodeId:'N1',ux:true,uy:true,rz:true}],loads:[{id:'P',caseId:'LC1',nodeId:'N2',fx:0,fy:-900,mz:0}],elementLoads:[],nodeSprings:[],settlements:[],loadCases:[{id:'LC1',name:'Cyclic hinge',type:'user'}],loadCombinations:[],settings:{activeLoadCaseId:'LC1'}};
const targets=[-.06,.06,-.06];
const result=solveFrameCorotationalFiberHinges2D(project,'LC1',{controlMode:'displacement',steps:15,maxIterations:100,tolerance:1e-8,absoluteTolerance:1e-9,lineSearch:true,displacementTolerance:1e-7,displacementControl:{nodeId:'N2',dof:'uy',targetDisplacement:-.06},cyclicProtocol:{enabled:true,targets,stepsPerSegment:5},materialMaxIterations:50,materialTolerance:1e-5,materialRelaxation:.75});
assert.equal(result.solverVersion,'0.22.0-exp');
assert.equal(result.materialNonlinearity.cyclic,true);
assert(result.materialNonlinearity.cumulativeDissipatedEnergy>0,'global cyclic hinge should dissipate energy');
assert(result.materialNonlinearity.maxEquivalentPlasticStrain>0,'global cyclic hinge should accumulate plastic demand');
const virgin=solveFrameCorotationalFiberHinges2D(project,'LC1',{controlMode:'displacement',steps:5,maxIterations:100,tolerance:1e-8,absoluteTolerance:1e-9,lineSearch:true,displacementTolerance:1e-7,displacementControl:{nodeId:'N2',dof:'uy',targetDisplacement:-.06},cyclicProtocol:{enabled:true,targets:[-.06],stepsPerSegment:5},materialMaxIterations:50,materialTolerance:1e-5,materialRelaxation:.75});
assert(result.materialNonlinearity.cumulativeDissipatedEnergy>virgin.materialNonlinearity.cumulativeDissipatedEnergy,'prior reversals must increase committed dissipated energy');
assert(result.pushover.cyclicProtocol.enabled,'cyclic protocol metadata should be retained');
assert.equal(result.pushover.curve.length,15);
assert(Math.abs(result.displacements.find(d=>d.nodeId==='N2').uy-targets.at(-1))<1e-6,'final displacement should reach last cyclic target');
console.log('v0.22 cyclic concentrated hinge smoke: OK');
