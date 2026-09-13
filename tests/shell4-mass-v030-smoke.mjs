import assert from 'node:assert/strict';
import { shell4MassMatrix } from '../web/src/solver/shell4.js';

const nodes=[{id:'N1',x:0,y:0,z:0},{id:'N2',x:4,y:0,z:0},{id:'N3',x:4,y:3,z:0},{id:'N4',x:0,y:3,z:0}],rho=25/9.80665,t=.20,total=rho*t*12;
const sumDirection=(M,dof)=>{let s=0;for(let i=0;i<4;i++)for(let j=0;j<4;j++)s+=M[6*i+dof][6*j+dof];return s};
const symmetric=M=>M.every((r,i)=>r.every((v,j)=>Math.abs(v-M[j][i])<1e-10*Math.max(1,Math.abs(v),Math.abs(M[j][i]))));

const c=shell4MassMatrix({nodes,massDensity:rho,thickness:t,formulation:'consistent'});assert.equal(c.formulation,'consistent');assert.ok(Math.abs(c.area-12)<1e-12);assert.ok(Math.abs(c.totalMass-total)<1e-12);assert.ok(symmetric(c.ml)&&symmetric(c.mg));for(const d of [0,1,2])assert.ok(Math.abs(sumDirection(c.ml,d)-total)<1e-10,`consistent translational mass direction ${d}`);const rotationalExpected=rho*t**3/12*12;for(const d of [3,4])assert.ok(Math.abs(sumDirection(c.ml,d)-rotationalExpected)<1e-12,`consistent rotary mass ${d}`);
const rigid=Array(24).fill(0);for(let i=0;i<4;i++)rigid[6*i]=1;const kinetic=c.ml.reduce((s,row,i)=>s+rigid[i]*row.reduce((q,v,j)=>q+v*rigid[j],0),0);assert.ok(Math.abs(kinetic-total)<1e-10,'rigid translation must recover total mass');

const l=shell4MassMatrix({nodes,massDensity:rho,thickness:t,formulation:'lumped'});assert.equal(l.formulation,'lumped');for(const d of [0,1,2])assert.ok(Math.abs(sumDirection(l.ml,d)-total)<1e-12);assert.ok(l.ml.every((r,i)=>r.every((v,j)=>i===j||Math.abs(v)<1e-15)),'lumped matrix should be diagonal locally');

// Rotate the same plate into a vertical plane; global transform must preserve symmetry and total translational trace.
const vertical=[{id:'A',x:0,y:0,z:0},{id:'B',x:4,y:0,z:0},{id:'C',x:4,y:0,z:3},{id:'D',x:0,y:0,z:3}],v=shell4MassMatrix({nodes:vertical,massDensity:rho,thickness:t,formulation:'consistent'});assert.ok(symmetric(v.mg));let traceT=0;for(let i=0;i<4;i++)for(const d of [0,1,2])traceT+=v.mg[6*i+d][6*i+d];let traceLocal=0;for(let i=0;i<4;i++)for(const d of [0,1,2])traceLocal+=c.ml[6*i+d][6*i+d];assert.ok(Math.abs(traceT-traceLocal)<1e-10,'orthogonal transform must preserve translational trace');
console.log('shell4-mass-v030-smoke: OK');
