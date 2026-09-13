import assert from 'node:assert/strict';
import {NODE_SURFACE_CONTACT_CONTRACT,createNodeSegmentContact2DComponent,createNodeTriangleContact3DComponent,registerAdvancedShellContactComponents} from '../web/src/shellContact/index.js';
import {hasElementComponentFactory,getElementDefinition} from '../web/src/core/elementRegistry.js';

const close=(a,b,tol=1e-9,msg='')=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(b)),`${msg} esperado ${b}, obtido ${a}`);
const norm=a=>Math.hypot(...a);
registerAdvancedShellContactComponents();
for(const type of ['contact-node-segment2d','contact-node-triangle3d']){assert.equal(hasElementComponentFactory(type),true);assert.equal(getElementDefinition(type).capabilities.nodeToSurface,true)}

// 2D node-to-segment, initial projection at midspan, normal equilibrium and friction cap.
const project2={nodes:[{id:'M1',x:0,y:0},{id:'M2',x:2,y:0},{id:'S',x:1,y:.1}]};
const c2=createNodeSegmentContact2DComponent({element:{id:'NS2',type:'contact-node-segment2d',masterNodes:['M1','M2'],slaveNode:'S',normalStiffness:1000,tangentialStiffness:200,frictionCoefficient:.5},project:project2});
assert.equal(c2.metadata.contract,NODE_SURFACE_CONTACT_CONTRACT);const open=c2.response([0,0,0,0,0,0]);assert.equal(open.outputs.active,false);close(open.outputs.initialGap,.1);close(open.outputs.projectionCoordinate,.5);
const stick=c2.response([0,0,0,0,.001,-.11]);assert.equal(stick.outputs.active,true);assert.equal(stick.outputs.branch,'stick');close(stick.outputs.penetration,.01);close(stick.outputs.normalCompression,10);close(Math.abs(stick.outputs.tangentialForce[0]),.2);close(stick.internalForce[0]+stick.internalForce[2]+stick.internalForce[4],0,1e-12,'2D Fx equilibrium');close(stick.internalForce[1]+stick.internalForce[3]+stick.internalForce[5],0,1e-12,'2D Fy equilibrium');
const slip=c2.response([0,0,0,0,.1,-.11]);assert.equal(slip.outputs.branch,'slip');close(norm(slip.outputs.tangentialForce),5,1e-8,'2D Coulomb cap');assert.ok(slip.outputs.dissipatedEnergy>0);

// 3D node-to-triangle: barycentric distribution, compression and two tangential directions.
const project3={nodes:[{id:'A',x:0,y:0,z:0},{id:'B',x:1,y:0,z:0},{id:'C',x:0,y:1,z:0},{id:'S',x:.25,y:.25,z:.2}]};
const c3=createNodeTriangleContact3DComponent({element:{id:'NS3',type:'contact-node-triangle3d',masterNodes:['A','B','C'],slaveNode:'S',normalStiffness:2000,tangentialStiffness:500,frictionCoefficient:.25},project:project3});
const r0=c3.response(Array(12).fill(0));assert.equal(r0.outputs.active,false);close(r0.outputs.initialGap,.2);const w=r0.outputs.masterWeights;close(w.reduce((a,b)=>a+b,0),1);close(w[0],.5);close(w[1],.25);close(w[2],.25);
const u3=Array(12).fill(0);u3[9]=.01;u3[10]=.02;u3[11]=-.21;const r3=c3.response(u3);assert.equal(r3.outputs.active,true);close(r3.outputs.penetration,.01);close(r3.outputs.normalCompression,20);assert.ok(norm(r3.outputs.tangentialForce)<=5+1e-8);close(r3.internalForce[0]+r3.internalForce[3]+r3.internalForce[6]+r3.internalForce[9],0,1e-12,'3D Fx equilibrium');close(r3.internalForce[1]+r3.internalForce[4]+r3.internalForce[7]+r3.internalForce[10],0,1e-12,'3D Fy equilibrium');close(r3.internalForce[2]+r3.internalForce[5]+r3.internalForce[8]+r3.internalForce[11],0,1e-12,'3D Fz equilibrium');

c3.commit();const committed=c3.committedState();const rev=[...u3];rev[9]=-.02;c3.response(rev);assert.notDeepEqual(c3.trialState(),committed);c3.rollback();assert.deepEqual(c3.trialState(),committed);

console.log('AstraStruct v0.38 node-to-surface contact smoke: node-segment 2D and node-triangle 3D unilateral/frictional contact OK.');
