import assert from 'node:assert/strict';
import { assembleDynamicSystem2D, solveModal2D, solveTimeHistory2D, solveResponseSpectrum2D, responseSpectrumFromGroundMotion, cqcCorrelation, newmarkLinearSystem } from '../web/src/solver/dynamics2d.js';

const g=9.80665,L=2,E=200e6,A=.01,gamma=78.5;
const project={nodes:[{id:'N1',x:0,y:0},{id:'N2',x:L,y:0}],elements:[{id:'T1',type:'truss2d',n1:'N1',n2:'N2',materialId:'S',sectionId:'TR',A,I:0}],materials:[{id:'S',name:'Steel',type:'steel',E,density:gamma,alpha:12e-6,fy:355}],sections:[{id:'TR',name:'Truss',family:'truss',A,I:0}],supports:[{nodeId:'N1',ux:true,uy:true,rz:true},{nodeId:'N2',ux:false,uy:true,rz:false}],loads:[{id:'P',caseId:'LC1',nodeId:'N2',fx:10,fy:0,mz:0}],elementLoads:[],nodeSprings:[],nodalMasses:[],settlements:[],loadCases:[{id:'LC1',name:'Dynamic',type:'user'}],loadCombinations:[],settings:{activeLoadCaseId:'LC1',analysisScenarioId:'LC1'}};
const gm=[{t:0,accelG:0},{t:.04,accelG:.20},{t:.08,accelG:0},{t:.12,accelG:-.10},{t:.20,accelG:0}];

const modal=solveModal2D(project,{modes:3,massFormulation:'consistent'});assert.equal(modal.solverVersion,'0.24.0-exp');
const th=solveTimeHistory2D(project,'LC1',{massFormulation:'consistent',dampingRatio:.02,rayleighMode1:1,rayleighMode2:1,timeStep:.001,duration:.20,monitorNodeId:'N2',monitorDof:'ux',excitationType:'base-acceleration',groundMotionDirection:'x',groundMotionPoints:gm});
assert.equal(th.excitation.baseAcceleration,true);assert.equal(th.excitation.direction,'x');assert(Math.abs(th.excitation.pgaG-.20)<1e-12);assert(th.peakResponse.absDisplacement>0);assert(th.history.some(r=>Math.abs(r.groundAccelerationG)>.19));
const sys=assembleDynamicSystem2D(project,{massFormulation:'consistent'}),m=sys.Mf[0][0],k=sys.Kf[0][0],ray=th.rayleigh,c=ray.alphaM*m+ray.betaK*k,interp=t=>{for(let i=0;i<gm.length-1;i++){const a=gm[i],b=gm[i+1];if(t>=a.t&&t<=b.t)return (a.accelG+(b.accelG-a.accelG)*(t-a.t)/(b.t-a.t))*g}return 0},eq=newmarkLinearSystem({M:[[m]],C:[[c]],K:[[k]],forceAtTime:t=>[-m*interp(t)],dt:.001,duration:.20});
assert(Math.abs(eq.final.u[0]-th.history.at(-1).displacement)<1e-12,'base excitation must match equivalent inertial force in 1DOF benchmark');

const sp=responseSpectrumFromGroundMotion(gm,{dampingRatio:.05,timeStep:.001,periods:[modal.modes[0].period]});assert.equal(sp.values.length,1);assert(sp.values[0].sd>0);assert(Math.abs(sp.values[0].sa-sp.values[0].omega**2*sp.values[0].sd)<1e-12);assert(Math.abs(sp.pgaG-.20)<1e-12);
assert(Math.abs(cqcCorrelation(10,10,.05)-1)<1e-12);assert(Math.abs(cqcCorrelation(10,20,.05)-cqcCorrelation(20,10,.05))<1e-12);
const srss=solveResponseSpectrum2D(project,{massFormulation:'consistent',modes:3,dampingRatio:.05,timeStep:.001,direction:'x',groundMotionPoints:gm,combination:'srss',periodMin:.01,periodMax:.5,periodCount:30}),cqc=solveResponseSpectrum2D(project,{massFormulation:'consistent',modes:3,dampingRatio:.05,timeStep:.001,direction:'x',groundMotionPoints:gm,combination:'cqc',periodMin:.01,periodMax:.5,periodCount:30});
assert.equal(srss.solverVersion,'0.24.0-exp');assert(srss.combined.peakTranslationalDisplacement>0);assert(Math.abs(srss.combined.peakTranslationalDisplacement-cqc.combined.peakTranslationalDisplacement)<1e-12,'one-mode SRSS and CQC must coincide');assert.equal(srss.modalContributions.length,1);
console.log('v0.24 seismic base-motion / response-spectrum smoke: OK',{pgaG:sp.pgaG,peakTH:th.peakResponse.absDisplacement,peakSpectrum:srss.combined.peakTranslationalDisplacement});
