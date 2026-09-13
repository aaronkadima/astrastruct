import assert from 'node:assert/strict';
import {solve} from '../web/src/solver/index.js';
import {solveFrameCorotational3D} from '../web/src/solver/corotational3d.js';

const close=(a,b,tol,msg)=>assert.ok(Math.abs(a-b)<=tol,`${msg}: got ${a}, expected ${b}, err=${Math.abs(a-b)}`);
const E=200e6,nu=.3,A=.018,Iy=8e-5,Iz=1.0e-4,J=2e-5,L=3,delta=.003;
function model(){return{
 id:'settlement3d',name:'Settlement 3D',version:13,schemaVersion:2,units:'kN-m-MPa',
 nodes:[{id:'N1',x:0,y:0,z:0},{id:'N2',x:L,y:0,z:0}],
 elements:[{id:'E1',type:'frame3d',n1:'N1',n2:'N2',materialId:'S',sectionId:'SEC',orientation:{up:[0,1,0]}}],
 materials:[{id:'S',type:'steel',E,nu,density:78.5,alpha:1.2e-5}],sections:[{id:'SEC',family:'i',A,Iy,Iz,J,I:Iz,h:.3,b:.2}],
 supports:[{nodeId:'N1',ux:true,uy:true,uz:true,rx:true,ry:true,rz:true},{nodeId:'N2',ux:true,uy:false,uz:false,rx:false,ry:false,rz:false}],
 loads:[],elementLoads:[],nodeSprings:[],
 settlements:[{id:'ST1',caseId:'LC1',nodeId:'N2',ux:delta,uy:0,uz:0,rx:0,ry:0,rz:0}],
 loadCases:[{id:'LC1',name:'Recalque'},{id:'LC2',name:'Vazio'}],
 loadCombinations:[{id:'COMB_HALF',name:'0.5 recalque',terms:[{caseId:'LC1',factor:.5},{caseId:'LC2',factor:1}]}],
 settings:{analysisType:'corotational',analysisScenarioId:'LC1',nonlinearControlMode:'load',nonlinearSteps:4,nonlinearMaxIterations:35,nonlinearTolerance:5e-10,nonlinearLineSearch:true},meta:{},connections:[],nodalMasses:[]
}}

// Scenario Engine converts a settlement into a nonzero prescribed support DOF.
{
 const p=model(),r=solve(p,'LC1'),expectedN=E*A/L*delta;
 close(r.displacements.find(x=>x.nodeId==='N2').ux,delta,2e-12,'prescribed axial settlement');
 close(Math.abs(r.elementForces[0].N2),expectedN,2e-5,'settlement axial force');
 close(r.reactions.find(x=>x.nodeId==='N1').fx,-expectedN,2e-5,'left settlement reaction');
 close(r.reactions.find(x=>x.nodeId==='N2').fx,expectedN,2e-5,'right settlement reaction');
 assert.equal(r.nonlinear.prescribedDofCount,7,'six fixed DOFs at N1 plus prescribed ux at N2');
 assert.equal(r.nonlinear.prescribedLoading,'proportional');
 close(r.nonlinear.history.at(-1).prescribedDisplacementFactor,1,1e-12,'final prescribed load factor');
}

// Load-combination factor scales the imposed motion itself, not an equivalent force.
{
 const p=model(),r=solve(p,'COMB_HALF'),u=r.displacements.find(x=>x.nodeId==='N2').ux,expected=.5*delta;
 close(u,expected,2e-12,'combination-scaled settlement');
 close(Math.abs(r.elementForces[0].N2),E*A/L*expected,2e-5,'combination-scaled axial force');
}

// A directly resolved project with a support value is accepted by the lower-level solver.
{
 const p=model();p.settlements=[];p.supports[1].uxValue=-delta;const r=solveFrameCorotational3D(p,{steps:5,tolerance:5e-10});
 close(r.displacements[1].ux,-delta,2e-12,'direct prescribed ux');close(Math.abs(r.elementForces[0].N2),E*A/L*delta,2e-5,'direct prescribed force');
}

// Fully constrained models remain valid: reactions are recovered even with no free DOFs.
{
 const p=model();p.settlements=[];p.supports[1]={nodeId:'N2',ux:true,uy:true,uz:true,rx:true,ry:true,rz:true,uxValue:delta};const r=solveFrameCorotational3D(p,{steps:3,tolerance:5e-10});
 assert.equal(r.activeDofs,0);close(r.displacements[1].ux,delta,2e-12,'fully constrained prescribed ux');close(Math.abs(r.reactions[0].fx),E*A/L*delta,2e-5,'fully constrained reaction');
}

console.log('v0.30 co-rotational 3D prescribed displacement/settlement smoke: OK');
