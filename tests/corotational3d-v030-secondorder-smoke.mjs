import assert from 'node:assert/strict';
import { solveSpatial3D } from '../web/src/solver/spatial3d.js';
import { solveFramePDelta3D } from '../web/src/solver/pdelta3d.js';
import { solveFrameCorotational3D } from '../web/src/solver/corotational3d.js';

const E=200e6,nu=.3,A=.02,Iy=7e-5,Iz=8e-5,J=2e-5,L=4,n=8;
const Pcr=Math.PI*Math.PI*E*Iz/(4*L*L),P=.12*Pcr,H=-5;
const nodes=Array.from({length:n+1},(_,i)=>({id:`N${i}`,x:L*i/n,y:0,z:0}));
const elements=Array.from({length:n},(_,i)=>({id:`E${i}`,type:'frame3d',n1:`N${i}`,n2:`N${i+1}`,materialId:'S',sectionId:'SEC',orientation:{up:[0,1,0]}}));
const project={nodes,elements,materials:[{id:'S',type:'steel',E,nu,density:78.5}],sections:[{id:'SEC',family:'i',A,Iy,Iz,J,I:Iz}],supports:[{nodeId:'N0',ux:true,uy:true,uz:true,rx:true,ry:true,rz:true}],loads:[{id:'AX',nodeId:`N${n}`,fx:-P},{id:'H',nodeId:`N${n}`,fy:H}],elementLoads:[],nodeSprings:[],settlements:[],settings:{nonlinearSteps:8,nonlinearMaxIterations:35,nonlinearTolerance:2e-8,pDeltaMaxIterations:40,pDeltaTolerance:1e-10}};

const linear=solveSpatial3D(project),pdelta=solveFramePDelta3D(project),cor=solveFrameCorotational3D(project,{steps:8,maxIterations:35,tolerance:2e-8,tangentScheme:'central'});
const ul=linear.displacements.at(-1).uy,up=pdelta.displacements.at(-1).uy,uc=cor.displacements.at(-1).uy;
assert.ok(Math.abs(up)>Math.abs(ul)*1.05,`P-Delta should amplify lateral response: linear=${ul}, pdelta=${up}`);
assert.ok(Math.abs(uc)>Math.abs(ul)*1.05,`co-rotational should amplify lateral response: linear=${ul}, cor=${uc}`);
const rel=Math.abs(uc-up)/Math.max(1e-12,Math.abs(up));assert.ok(rel<.05,`co-rotational vs P-Delta second-order response rel=${rel}, cor=${uc}, pdelta=${up}`);
assert.equal(cor.nonlinear.tangentScheme,'central');assert.ok(cor.nonlinear.history.every(h=>Number.isFinite(h.residualNorm)));assert.ok(cor.nonlinear.history.some(h=>h.tangentAsymmetry==null||Number.isFinite(h.tangentAsymmetry)));
const root=cor.reactions[0];assert.ok(Math.abs(root.fx-P)<2e-2,`axial equilibrium root.fx=${root.fx} P=${P}`);assert.ok(Math.abs(root.fy-H*-1)<2e-3,`lateral equilibrium root.fy=${root.fy}`);
console.log('v0.30 co-rotational 3D second-order benchmark: OK',{Pcr,P,linear:ul,pdelta:up,corotational:uc,relativeDifference:rel,iterations:cor.nonlinear.history.map(x=>x.iterations)});
