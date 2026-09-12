import assert from 'node:assert/strict';
import { solveModal2D, solveTimeHistory2D, newmarkLinearSystem, rayleighFromModes } from '../web/src/solver/dynamics2d.js';

const g=9.80665,L=2,E=200e6,A=.01,gamma=78.5;
const project={
  nodes:[{id:'N1',x:0,y:0},{id:'N2',x:L,y:0}],
  elements:[{id:'T1',type:'truss2d',n1:'N1',n2:'N2',materialId:'S',sectionId:'TR',A,I:0}],
  materials:[{id:'S',name:'Steel',type:'steel',E,density:gamma,alpha:12e-6,fy:355}],
  sections:[{id:'TR',name:'Truss',family:'truss',A,I:0}],
  supports:[{nodeId:'N1',ux:true,uy:true,rz:true},{nodeId:'N2',ux:false,uy:true,rz:false}],
  loads:[{id:'P',caseId:'LC1',nodeId:'N2',fx:10,fy:0,mz:0}],elementLoads:[],nodeSprings:[],nodalMasses:[],settlements:[],
  loadCases:[{id:'LC1',name:'Dynamic pattern',type:'user'}],loadCombinations:[],settings:{activeLoadCaseId:'LC1',analysisScenarioId:'LC1'}
};

const modal=solveModal2D(project,{modes:3,massFormulation:'consistent'});
assert.equal(modal.solverVersion,'0.23.0-exp');
assert.equal(modal.modes.length,1);
const physicalMass=gamma/g*A*L,expectedOmega=Math.sqrt((E*A/L)/(physicalMass/3));
assert(Math.abs(modal.modes[0].omega/expectedOmega-1)<1e-10,`consistent axial bar omega mismatch: ${modal.modes[0].omega} vs ${expectedOmega}`);
assert(Math.abs(modal.modes[0].participation.effectiveMassRatioX-1)<1e-10,'single x DOF must carry 100% effective x mass');
assert(Math.abs(modal.modes[0].generalizedMass-1)<1e-10,'mode must be mass normalized');

const lumped=solveModal2D(project,{modes:2,massFormulation:'lumped'}),expectedLumped=Math.sqrt((E*A/L)/(physicalMass/2));
assert(Math.abs(lumped.modes[0].omega/expectedLumped-1)<1e-10,'lumped axial bar benchmark failed');
assert(lumped.modes[0].frequencyHz>0&&lumped.modes[0].period>0,'frequency and period must be positive');

const omega=10,dt=.001,duration=.5,free=newmarkLinearSystem({M:[[1]],C:[[0]],K:[[omega*omega]],forceAtTime:()=>[0],dt,duration,u0:[1],v0:[0]}),uEnd=free.final.u[0];
const discretePhase=2*Math.atan(omega*dt/2),exactDiscrete=Math.cos(free.steps*discretePhase),exactContinuum=Math.cos(omega*duration);
assert(Math.abs(uEnd-exactDiscrete)<2e-11,`Newmark discrete amplification mismatch: ${uEnd} vs ${exactDiscrete}`);
assert(Math.abs(uEnd-exactContinuum)<5e-5,`Newmark phase-dispersion error exceeded O(dt²) benchmark: ${uEnd} vs ${exactContinuum}`);
const energies=free.history.map(r=>r.totalMechanicalEnergy),energyDrift=(Math.max(...energies)-Math.min(...energies))/energies[0];
assert(energyDrift<2e-8,`average-acceleration energy drift too high: ${energyDrift}`);

const rayleigh=rayleighFromModes([{mode:1,omega:10},{mode:2,omega:30}],{dampingRatio:.02,mode1:1,mode2:2});
const z1=rayleigh.alphaM/(2*10)+rayleigh.betaK*10/2,z2=rayleigh.alphaM/(2*30)+rayleigh.betaK*30/2;
assert(Math.abs(z1-.02)<1e-12&&Math.abs(z2-.02)<1e-12,'Rayleigh damping targets must be exact at calibration modes');

const th=solveTimeHistory2D(project,'LC1',{massFormulation:'consistent',dampingRatio:.02,rayleighMode1:1,rayleighMode2:1,timeStep:.002,duration:.2,monitorNodeId:'N2',monitorDof:'ux',historyPoints:[{t:0,scale:0},{t:.04,scale:1},{t:.12,scale:-.5},{t:.2,scale:0}]});
assert.equal(th.solverVersion,'0.23.0-exp');
assert.equal(th.newmark.steps,100);
assert.equal(th.history.length,101);
assert(th.peakResponse.absDisplacement>0,'time history must develop response');
assert(Number.isFinite(th.history.at(-1).acceleration),'final acceleration must be finite');
assert.equal(th.excitation.baseAcceleration,false);
assert.equal(th.monitor.nodeId,'N2');
console.log('v0.23 structural dynamics smoke: OK', {fHz:modal.modes[0].frequencyHz, peak:th.peakResponse.absDisplacement});
