import assert from 'node:assert/strict';
import { solveSpatial3D } from '../web/src/solver/spatial3d.js';
import { corotationalFrame3DInternalForce } from '../web/src/solver/corotational3d.js';
import { condenseEndConnections3D } from '../web/src/solver/endConnections3d.js';
import { frame3DLocalStiffness } from '../web/src/solver/spatial3d.js';

const material={id:'S',type:'steel',E:200e6,nu:.3,density:78.5};
const section={id:'SEC',A:.012,Iy:.00018,Iz:.00022,J:.00003,I:.00022};
const baseElement=(patch={})=>({id:'E1',type:'frame3d',n1:'N1',n2:'N2',materialId:'S',sectionId:'SEC',A:section.A,Iy:section.Iy,Iz:section.Iz,J:section.J,releases:{rx1:false,ry1:false,rz1:false,rx2:false,ry2:false,rz2:false},rotationalSprings:{rx1:null,ry1:null,rz1:null,rx2:null,ry2:null,rz2:null},...patch});
const project=(element)=>({nodes:[{id:'N1',x:0,y:0,z:0},{id:'N2',x:6,y:0,z:0}],elements:[element],materials:[material],sections:[section],supports:[{nodeId:'N1',ux:true,uy:true,uz:true,rx:true,ry:true,rz:true},{nodeId:'N2',ux:true,uy:true,uz:true,rx:true,ry:true,rz:true}],loads:[],elementLoads:[{id:'Q',caseId:'LC1',elementId:'E1',kind:'uniform',qy:-10,qx:0,qz:0}],nodeSprings:[],settlements:[],settings:{analysisType:'linear'}});

// Linear fixed-fixed reference and released end benchmark.
const rigid=solveSpatial3D(project(baseElement())).elementForces[0];
const released=solveSpatial3D(project(baseElement({releases:{rx1:false,ry1:false,rz1:false,rx2:false,ry2:false,rz2:true}}))).elementForces[0];
assert.ok(Math.abs(rigid.Mz2)>1e-4,'rigid fixed-fixed end moment should be non-zero');
assert.ok(Math.abs(released.Mz2)<1e-8,'released Rz2 must recover zero end moment');
assert.ok(Array.isArray(released.connectionRotations)&&released.connectionRotations.some(x=>x.key==='rz2'),'released rotation recovery missing');

// Semi-rigid end lies between hinge and rigid behavior.
const semi=solveSpatial3D(project(baseElement({rotationalSprings:{rx1:null,ry1:null,rz1:null,rx2:null,ry2:null,rz2:2500}}))).elementForces[0];
assert.ok(Math.abs(semi.Mz2)>1e-8,'semi-rigid connection should transmit moment');
assert.ok(Math.abs(semi.Mz2)<Math.abs(rigid.Mz2),'semi-rigid moment should be below rigid end moment for this benchmark');
const sr=semi.connectionRotations.find(x=>x.key==='rz2');assert.ok(sr&&Math.abs(sr.relativeRotation)>0,'semi-rigid connection must recover relative rotation');

// Corotational constitutive response honors release and semi-rigid spring.
const a={id:'N1',x:0,y:0,z:0},b={id:'N2',x:6,y:0,z:0},u=[0,0,0,0,0,.01,0,0,0,0,0,-.005];
const cp={nodes:[a,b],materials:[material],sections:[section],elementLoads:[]};
const cr=corotationalFrame3DInternalForce(cp,baseElement(),a,b,u);
const ch=corotationalFrame3DInternalForce(cp,baseElement({releases:{rx1:false,ry1:false,rz1:true,rx2:false,ry2:false,rz2:false}}),a,b,u);
const cs=corotationalFrame3DInternalForce(cp,baseElement({rotationalSprings:{rx1:null,ry1:null,rz1:5000,rx2:null,ry2:null,rz2:null}}),a,b,u);
assert.ok(Math.abs(cr.Mz1)>1e-4);assert.ok(Math.abs(ch.Mz1)<1e-8);assert.ok(Math.abs(cs.Mz1)>1e-8&&Math.abs(cs.Mz1)<Math.abs(cr.Mz1));

// Both torsional ends released must not create a singular condensation block.
const L=6,E=material.E,G=E/(2*(1+material.nu)),kl=frame3DLocalStiffness({E,G,A:section.A,Iy:section.Iy,Iz:section.Iz,J:section.J,L});
const bothTorsion=condenseEndConnections3D(kl,Array(12).fill(0),{rx1:true,rx2:true},{});assert.equal(bothTorsion.kEff[3][3],0);assert.equal(bothTorsion.kEff[9][9],0);

console.log('end-connections3d-v030-smoke: OK');
