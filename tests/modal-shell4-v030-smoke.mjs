import assert from 'node:assert/strict';
import { assembleDynamicSystem3D, solveModal3D } from '../web/src/solver/modalStability3d.js';
import { solve } from '../web/src/solver/index.js';

const fixed=nodeId=>({nodeId,ux:true,uy:true,uz:true,rx:true,ry:true,rz:true});
const project={id:'modal-shell',name:'Modal shell4',version:13,schemaVersion:2,units:'kN-m-MPa',nodes:[{id:'N1',x:0,y:0,z:0},{id:'N2',x:2,y:0,z:0},{id:'N3',x:2,y:2,z:0},{id:'N4',x:0,y:2,z:0}],elements:[{id:'S1',type:'shell4',nodeIds:['N1','N2','N3','N4'],n1:'N1',n2:'N2',n3:'N3',n4:'N4',materialId:'C',thickness:.18,shearCorrection:5/6,drillingFactor:1e-6}],materials:[{id:'C',name:'Concrete',type:'concrete',E:30e6,nu:.2,density:25}],sections:[],supports:[fixed('N1'),fixed('N2'),fixed('N4')],loads:[],elementLoads:[],settlements:[],nodeSprings:[],nodalMasses:[],loadCases:[{id:'LC1',name:'Modal ref',type:'user'}],loadCombinations:[],connections:[],diaphragms:[],settings:{analysisType:'modal',analysisScenarioId:'LC1',activeLoadCaseId:'LC1',modalModes:4,dynamicMassFormulation:'consistent'},meta:{productVersion:'0.30.0',schemaVersion:2}};

const sys=assembleDynamicSystem3D(project,{massFormulation:'consistent'});assert.equal(sys.shellCount,1);assert.equal(sys.hasShell,true);assert.equal(sys.free.length,6,'only the fourth shell node should remain free');assert.equal(sys.Kf.length,6);assert.equal(sys.Mf.length,6);assert.ok(sys.Mf.flat().some(v=>Math.abs(v)>0));
const modal=solveModal3D(project,{modes:4,massFormulation:'consistent'});assert.equal(modal.solverVersion,'0.30.0');assert.equal(modal.shellCount,1);assert.ok(modal.modes.length>=1);assert.ok(modal.modes.every(m=>Number.isFinite(m.frequencyHz)&&m.frequencyHz>0));assert.ok(modal.modal.shellMass?.includes('rho*t'));
const lumped=solveModal3D(project,{modes:4,massFormulation:'lumped'});assert.equal(lumped.massFormulation,'lumped');assert.ok(lumped.modes[0].frequencyHz>0);assert.ok(Math.abs(lumped.modes[0].frequencyHz-modal.modes[0].frequencyHz)>1e-8,'consistent and lumped shell mass should not collapse to identical spectra');
const dispatched=solve(project,'LC1');assert.equal(dispatched.analysisType,'modal');assert.equal(dispatched.dimension,'3d');assert.equal(dispatched.shellCount,1);assert.equal(dispatched.contract?.provenance?.solverVersion,'0.30.0');assert.ok(dispatched.modes[0].frequencyHz>0);
console.log('modal-shell4-v030-smoke: OK');
