import assert from 'node:assert/strict';
import {buildShellGaussEnvelopes,shellFieldEnvelope,shellFieldSamples,shellMaxAbsValue} from '../web/src/core/shellPostprocess.js';

const gp=(index,xi,eta,Nx,Mx,Qx)=>({index,naturalCoordinates:{xi,eta},membraneResultants:{Nx,Ny:Nx/2,Nxy:-Nx/4},bendingMoments:{Mx,My:Mx/2,Mxy:-Mx/3},transverseShear:{Qx,Qy:-Qx/2},membraneStress:{sx:Nx*10,sy:Nx*5,txy:-Nx*2.5}});
const responseA={elementId:'S1',type:'shell4',gaussPoints:[gp(1,-.577,-.577,-8,3,2),gp(2,.577,-.577,12,-5,-4),gp(3,.577,.577,7,9,6),gp(4,-.577,.577,-15,4,1)]};
const responseB={elementId:'S2',type:'shell4',gaussPoints:[gp(1,-.577,-.577,5,-12,3),gp(2,.577,-.577,9,6,2),gp(3,.577,.577,-4,7,-8),gp(4,-.577,.577,3,2,1)]};
const result={elementForces:[responseA,responseB,{elementId:'E1',type:'frame3d'}]};

const samples=shellFieldSamples(responseA,'Nx');assert.equal(samples.length,4);assert.equal(samples[1].value,12);assert.equal(samples[3].pointIndex,4);
const env=shellFieldEnvelope(responseA,'Nx');assert.equal(env.min.value,-15);assert.equal(env.min.pointIndex,4);assert.equal(env.max.value,12);assert.equal(env.maxAbs.value,-15);assert.equal(shellMaxAbsValue(responseA,'Mx'),9);
const all=buildShellGaussEnvelopes(result,{fields:['Nx','Mx','Qx']});assert.equal(all.source,'gauss');assert.equal(all.shellCount,2);assert.equal(all.items.length,2);assert.equal(all.global.Nx.min.elementId,'S1');assert.equal(all.global.Nx.min.value,-15);assert.equal(all.global.Mx.min.elementId,'S2');assert.equal(all.global.Mx.min.value,-12);assert.equal(all.global.Qx.maxAbs.elementId,'S2');assert.equal(all.global.Qx.maxAbs.value,-8);
const fallback={elementId:'S3',type:'shell4',membraneResultants:{Nx:4},bendingMoments:{Mx:-2},transverseShear:{Qx:1},membraneStress:{sx:20}};assert.equal(shellFieldSamples(fallback,'Nx').length,1);assert.equal(shellFieldEnvelope(fallback,'Nx').max.value,4);assert.throws(()=>shellFieldSamples(responseA,'banana'),/campo 'banana' desconhecido/);
console.log('shell-postprocess-v030-smoke: OK');
