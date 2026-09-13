import assert from 'node:assert/strict';
import {csrFromDense} from '../web/src/numerics/sparseMatrix.js';
import {solveLinearSystem} from '../web/src/numerics/linearSolver.js';
import {createRegisteredElementComponent,hasElementComponentFactory} from '../web/src/core/elementRegistry.js';
import {
  ADVANCED_ELEMENT_LIBRARY_CONTRACT,ADVANCED_ELEMENT_LIBRARY_VERSION,registerAdvancedElementComponents,
  createTimoshenko2DComponent,createTimoshenko3DComponent,createCable2DComponent,createCable3DComponent,
  createNonlinearLink2DComponent,createRigidOffsetFrame2DComponent,createRigidOffsetFrame3DComponent
} from '../web/src/elements/index.js';

const close=(a,b,tol=1e-9,msg='')=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(b)),`${msg} esperado ${b}, obtido ${a}`);
const norm=a=>Math.hypot(...a);const symmetric=(A,tol=1e-10)=>A.every((row,i)=>row.every((v,j)=>Math.abs(v-A[j][i])<=tol*Math.max(1,Math.abs(v),Math.abs(A[j][i]))));
assert.equal(ADVANCED_ELEMENT_LIBRARY_CONTRACT,'advanced-element-library/v1');assert.equal(ADVANCED_ELEMENT_LIBRARY_VERSION,'0.36.0-exp');const types=registerAdvancedElementComponents();for(const type of types)assert.equal(hasElementComponentFactory(type),true);

const project2d={nodes:[{id:'N1',x:0,y:0},{id:'N2',x:2,y:0},{id:'N4',x:4,y:0}],materials:[{id:'steel',type:'steel',E:200e6,nu:.3}],sections:[{id:'S',A:.02,I:8e-5,As:.015}],elementLoads:[]};

// Timoshenko 2D cantilever: exact bending + shear deflection under tip shear.
const tim2=createTimoshenko2DComponent({element:{id:'TB2',type:'timoshenko2d',n1:'N1',n2:'N2',materialId:'steel',sectionId:'S',shearCorrection:5/6},project:project2d}),r2=tim2.response(Array(6).fill(0));assert.equal(tim2.dofCount,6);assert.equal(symmetric(r2.tangent),true);assert.ok(r2.outputs.phi>0);const free=[3,4,5],Kff=free.map(i=>free.map(j=>r2.tangent[i][j])),P=10,sol=solveLinearSystem(csrFromDense(Kff),[0,-P,0],{method:'direct'}).x,E=200e6,I=8e-5,G=E/(2*(1+.3)),As=.015,kappa=5/6,L=2,expected=-P*(L**3/(3*E*I)+L/(kappa*G*As));close(sol[1],expected,1e-9,'Timoshenko cantilever deflection');
const registeredTim=createRegisteredElementComponent({id:'TB2R',type:'timoshenko2d',n1:'N1',n2:'N2',materialId:'steel',sectionId:'S'},{project:project2d});assert.equal(registeredTim.type,'timoshenko2d');

// Timoshenko 3D: two independent shear-flexure planes + rigid-body invariance.
const project3d={nodes:[{id:'A',x:0,y:0,z:0},{id:'B',x:3,y:0,z:0}],materials:[{id:'steel',type:'steel',E:200e6,nu:.3}],sections:[{id:'S3',A:.025,Iy:9e-5,Iz:7e-5,J:2e-5,Ay:.018,Az:.017}],elementLoads:[]},tim3=createTimoshenko3DComponent({element:{id:'TB3',type:'timoshenko3d',n1:'A',n2:'B',materialId:'steel',sectionId:'S3'},project:project3d}),z3=tim3.response(Array(12).fill(0));assert.equal(tim3.dofCount,12);assert.equal(symmetric(z3.tangent),true);assert.ok(z3.outputs.phiY>0&&z3.outputs.phiZ>0);const rigid3=[0,0,0,0,0,.001,0,.003,0,0,0,.001],rigidResp3=tim3.response(rigid3);assert.ok(norm(rigidResp3.internalForce)<1e-6,'Timoshenko3D deve anular movimento rígido');

// Corotational cables: prestress, extension, slackening and spatial objectivity.
const cable2=createCable2DComponent({element:{id:'C2',type:'cable2d',n1:'N1',n2:'N2',materialId:'steel',A:.001,initialForce:100},project:project2d});close(cable2.response([0,0,0,0]).outputs.N,100,1e-12,'cable prestress');close(cable2.response([0,0,.001,0]).outputs.N,200,1e-9,'cable extension');const slack=createCable2DComponent({element:{id:'CS',type:'cable2d',n1:'N1',n2:'N2',materialId:'steel',A:.001},project:project2d}).response([0,0,-.01,0]);assert.equal(slack.outputs.active,false);close(slack.outputs.N,0,1e-12);assert.ok(slack.tangent.flat().every(v=>Math.abs(v)<1e-14));
const cable3=createCable3DComponent({element:{id:'C3',type:'cable3d',n1:'A',n2:'B',materialId:'steel',A:.001,initialForce:50},project:project3d}),rotate=cable3.response([0,0,0,-3,3,0]);close(rotate.outputs.currentLength,3,1e-12);close(rotate.outputs.N,50,1e-10);close(rotate.outputs.direction[1],1,1e-12);

// Stateful nonlinear link: trial/rollback/commit and Bauschinger-like kinematic translation.
const link=createNonlinearLink2DComponent({element:{id:'L1',type:'link2d',n1:'N1',n2:'N2',components:[{label:'ux',law:'bilinear-kinematic',k:1000,yieldForce:10,hardeningRatio:.1},{label:'rz',law:'gap-tension',k:200,gap:.01}]}}),lr=link.response([0,0,.02,.005]);close(lr.outputs.components[0].force,11,1e-12,'link first plastic force');close(lr.outputs.components[0].tangent,100,1e-12);assert.equal(lr.outputs.components[1].branch,'open-gap');assert.ok(link.trialState().components.ux.plasticDeformation>0);close(link.committedState().components.ux.plasticDeformation,0,1e-12);link.rollback();close(link.trialState().components.ux.plasticDeformation,0,1e-12);link.response([0,0,.02,.02]);link.commit();const reverse=link.response([0,0,-.02,0]);close(reverse.outputs.components[0].force,-11,1e-12,'link reversal force');assert.ok(reverse.outputs.totalDissipatedEnergy>lr.outputs.totalDissipatedEnergy);

// 2D rigid offsets/zones: deformable length and exact small rigid-body mode.
const offsetProject2={...project2d,nodes:[{id:'R1',x:0,y:0},{id:'R2',x:4,y:0}],sections:[{id:'SO',A:.02,I:8e-5}],elementLoads:[]},off2=createRigidOffsetFrame2DComponent({element:{id:'O2',type:'frame2d-offset',n1:'R1',n2:'R2',materialId:'steel',sectionId:'SO',offset1:{x:0,y:.1},offset2:{x:0,y:.1},rigidZone1:.2,rigidZone2:.3},project:offsetProject2}),rb2=off2.response([0,0,.001,0,.004,.001]);close(rb2.outputs.deformableLength,3.5,1e-12);assert.ok(norm(rb2.internalForce)<1e-6,'offset frame2d deve anular movimento rígido');assert.equal(symmetric(rb2.tangent),true);

// 3D rigid offsets/zones: same virtual-work transformation in space.
const offsetProject3={nodes:[{id:'R1',x:0,y:0,z:0},{id:'R2',x:4,y:0,z:0}],materials:[{id:'steel',type:'steel',E:200e6,nu:.3}],sections:[{id:'SO3',A:.02,Iy:8e-5,Iz:7e-5,J:2e-5}],elementLoads:[]},off3=createRigidOffsetFrame3DComponent({element:{id:'O3',type:'frame3d-offset',n1:'R1',n2:'R2',materialId:'steel',sectionId:'SO3',offset1:{y:.1},offset2:{y:.1},rigidZone1:.2,rigidZone2:.3},project:offsetProject3}),rb3=off3.response([0,0,0,0,0,.001,0,.004,0,0,0,.001]);close(rb3.outputs.deformableLength,3.5,1e-12);assert.ok(norm(rb3.internalForce)<1e-6,'offset frame3d deve anular movimento rígido');assert.equal(symmetric(rb3.tangent),true);

console.log('AstraStruct v0.36 Advanced Element Library smoke: Timoshenko 2D/3D, corotational cables, stateful nonlinear links and rigid offsets/zones OK.');
