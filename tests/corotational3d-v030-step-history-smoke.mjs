import assert from 'node:assert/strict';
import { solveFrameCorotational3D } from '../web/src/solver/corotational3d.js';
import { interpolateHistoryField3D } from '../web/src/view/spatialView3d.js';

// Cantilever frame3d under a tip transverse load, large-rotation regime.
const E=200e6,nu=.3,A=.02,Iy=7e-5,Iz=8e-5,J=2e-5,L=4,n=6,steps=6;
const nodes=Array.from({length:n+1},(_,i)=>({id:`N${i}`,x:L*i/n,y:0,z:0}));
const elements=Array.from({length:n},(_,i)=>({id:`E${i}`,type:'frame3d',n1:`N${i}`,n2:`N${i+1}`,materialId:'S',sectionId:'SEC',orientation:{up:[0,1,0]}}));
const project={nodes,elements,materials:[{id:'S',type:'steel',E,nu,density:78.5}],sections:[{id:'SEC',family:'i',A,Iy,Iz,J,I:Iz}],supports:[{nodeId:'N0',ux:true,uy:true,uz:true,rx:true,ry:true,rz:true}],loads:[{id:'TIP',nodeId:`N${n}`,fy:-40}],elementLoads:[],nodeSprings:[],settlements:[]};

const result=solveFrameCorotational3D(project,{steps,maxIterations:40,tolerance:2e-8});

// Contract: one history entry per converged load step, in order, each carrying
// a full nodal displacement snapshot with the same shape as the final result.
assert.equal(result.nonlinear.history.length,steps,'one history entry per step');
assert.equal(result.nonlinear.stepDisplacementsAvailable,true,'capability flag exposed');
assert.ok(result.nonlinear.history.every((h,i)=>h.step===i+1),'steps are in order starting at 1');
assert.ok(result.nonlinear.history.every(h=>Math.abs(h.lambda-h.step/steps)<1e-12),'lambda matches step/steps');

for(const h of result.nonlinear.history){
  assert.ok(Array.isArray(h.displacements),`step ${h.step}: displacements array present`);
  assert.equal(h.displacements.length,nodes.length,`step ${h.step}: one entry per node`);
  for(const d of h.displacements){
    assert.equal(typeof d.nodeId,'string');
    for(const k of ['ux','uy','uz','rx','ry','rz'])assert.ok(Number.isFinite(d[k]),`step ${h.step} node ${d.nodeId}.${k} finite`);
  }
}

// The last step's snapshot must match the top-level converged displacements exactly
// (same equilibrium state, just recorded twice: once as history tail, once as result).
const last=result.nonlinear.history.at(-1).displacements;
for(let i=0;i<nodes.length;i++){
  for(const k of ['ux','uy','uz','rx','ry','rz']){
    assert.equal(last[i][k],result.displacements[i][k],`final step snapshot matches top-level displacements (${nodes[i].id}.${k})`);
  }
}

// The post-processor must reproduce exact stored states and interpolate only
// between adjacent converged steps. Lambda zero is the undeformed state.
const zeroField=interpolateHistoryField3D(result.nonlinear.history,0);
assert.deepEqual(zeroField.get(`N${n}`),[0,0,0],'lambda zero is undeformed');
const exactStep=result.nonlinear.history[2],exactField=interpolateHistoryField3D(result.nonlinear.history,exactStep.lambda),exactTip=exactStep.displacements.find(d=>d.nodeId===`N${n}`);
assert.deepEqual(exactField.get(`N${n}`),[exactTip.ux,exactTip.uy,exactTip.uz],'stored equilibrium step is reproduced exactly');
const left=result.nonlinear.history[1],right=result.nonlinear.history[2],betweenLambda=(left.lambda+right.lambda)/2,betweenField=interpolateHistoryField3D(result.nonlinear.history,betweenLambda),leftTip=left.displacements.find(d=>d.nodeId===`N${n}`),rightTip=right.displacements.find(d=>d.nodeId===`N${n}`);
const expectedBetween=[(leftTip.ux+rightTip.ux)/2,(leftTip.uy+rightTip.uy)/2,(leftTip.uz+rightTip.uz)/2],actualBetween=betweenField.get(`N${n}`);
assert.ok(actualBetween.every((v,i)=>Math.abs(v-expectedBetween[i])<1e-14),'between-step field uses adjacent equilibrium states');

// Physical sanity: the tip transverse displacement should grow monotonically in
// magnitude with lambda for this monotonic proportional-loading case, since the
// path has no snap-through/limit point in this regime.
const tipUy=result.nonlinear.history.map(h=>h.displacements.find(d=>d.nodeId===`N${n}`).uy);
for(let i=1;i<tipUy.length;i++){
  assert.ok(Math.abs(tipUy[i])>=Math.abs(tipUy[i-1])-1e-9,`tip |uy| should grow monotonically with load factor: step ${i} -> ${i+1}, ${tipUy[i-1]} -> ${tipUy[i]}`);
}

// Nonlinear path check: because the formulation is geometrically nonlinear, the
// intermediate deformed shape must NOT equal a naive linear scaling of the final
// state by lambda. This is the physical justification for storing real per-step
// snapshots instead of interpolating/scaling the final displacement by phase.
const finalUy=tipUy.at(-1),midIndex=Math.floor(tipUy.length/2),midLambda=result.nonlinear.history[midIndex].lambda;
const naiveLinearScaledUy=finalUy*midLambda,actualMidUy=tipUy[midIndex];
const deviation=Math.abs(actualMidUy-naiveLinearScaledUy)/Math.max(1e-12,Math.abs(finalUy));
assert.ok(deviation>1e-6,`intermediate step should deviate from naive linear-scaled final displacement (deviation=${deviation}); if this fails the nonlinear path collapsed to a proportional one for this case and step-history animation would offer no benefit over phase-scaling`);

console.log('v0.30 co-rotational 3D step-history smoke: OK',{steps,tipUy,finalUy,midLambda,naiveLinearScaledUy,actualMidUy,deviation});
