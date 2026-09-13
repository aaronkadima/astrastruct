import assert from 'node:assert/strict';
import {
  LOAD_STAGE_ENGINE_CONTRACT,LOAD_STAGE_ENGINE_VERSION,LOAD_ACTION_CONTRACT,MOVING_LOAD_CONTRACT,
  CONSTRUCTION_STAGE_CONTRACT,PRESTRESS_ACTION_CONTRACT,TIME_DEPENDENT_EFFECTS_CONTRACT,
  buildMovingLoadPath,movingLoadAt,movingLoadPositions,compileActionSet,buildConstructionStageSnapshots,
  prestressInitialState2D,prestressInitialState3D,creepCoefficient,shrinkageStrain,prestressRelaxation,
  ageAdjustedEffectiveModulus,timeDependentState
} from '../web/src/loadStage/index.js';
import {prepareFrameElement,recoverFrameEndForces} from '../web/src/solver/frameElement.js';
import {prepareCorotational3DDeadLoads} from '../web/src/solver/corotational3dLoads.js';

const close=(a,b,tol=1e-9,msg='')=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(b)),`${msg} esperado ${b}, obtido ${a}`);
const vclose=(a,b,tol=1e-9,msg='')=>{assert.equal(a.length,b.length);a.forEach((v,i)=>close(v,b[i],tol,`${msg}[${i}]`))};
assert.equal(LOAD_STAGE_ENGINE_CONTRACT,'load-stage-engine/v1');assert.equal(LOAD_STAGE_ENGINE_VERSION,'0.40.0-exp');

const project={
  nodes:[{id:'N1',x:0,y:0,z:0},{id:'N2',x:5,y:0,z:0},{id:'N3',x:10,y:0,z:0}],
  elements:[{id:'E1',type:'frame2d',n1:'N1',n2:'N2'},{id:'E2',type:'frame2d',n1:'N2',n2:'N3'}],
  supports:[{id:'S1',nodeId:'N1'},{id:'S2',nodeId:'N3'}],loads:[],elementLoads:[],settlements:[],materials:[],sections:[]
};

// Moving-load path and two-axle vehicle: station mapping and load conservation.
const path=buildMovingLoadPath(project,['E1','E2']);assert.equal(path.contract,MOVING_LOAD_CONTRACT);close(path.totalLength,10);const vehicle={id:'V1',axles:[{id:'front',offset:0,load:100},{id:'rear',offset:2,load:50}]},moving=movingLoadAt({project,pathElementIds:['E1','E2'],vehicle,position:6,actionId:'MOV'});assert.equal(moving.activeAxles,2);assert.equal(moving.axles[0].elementId,'E2');close(moving.axles[0].xi,.2);assert.equal(moving.axles[1].elementId,'E1');close(moving.axles[1].xi,.8);close(moving.elementLoads.reduce((s,l)=>s+l.py,0),-150,1e-12,'soma de cargas móveis');const boundary=movingLoadAt({project,pathElementIds:['E1','E2'],vehicle:{id:'one',axles:[{load:20}]},position:5});assert.equal(boundary.axles[0].elementId,'E2');close(boundary.axles[0].xi,0);const positions=movingLoadPositions({pathLength:10,step:3,vehicleLength:2});close(positions.at(-1),12);

// Action compilation is additive, scaled and immutable; no normative combination factors are hidden.
const actions=[
  {id:'NOD',type:'nodal',scale:2,loads:[{nodeId:'N2',fy:-10}]},
  {id:'UDL',type:'element',loads:[{elementId:'E1',kind:'uniform',qy:-4}]},
  {id:'PS',type:'prestress',scale:.8,loads:[{elementId:'E2',force:1000,eccentricity:.05}]},
  {id:'MOV',type:'moving',pathElementIds:['E1','E2'],vehicle}
];
const compiled=compileActionSet({project,actions,activeActionIds:['NOD','UDL','PS','MOV'],movingPositions:{MOV:6}});assert.equal(compiled.contract,LOAD_ACTION_CONTRACT);assert.equal(project.loads.length,0,'project original não pode ser mutado');close(compiled.project.loads[0].fy,-20);close(compiled.project.elementLoads.find(l=>l.actionId==='UDL').qy,-4);close(compiled.project.elementLoads.find(l=>l.actionId==='PS').force,800);assert.equal(compiled.project.elementLoads.filter(l=>l.actionId==='MOV').length,2);

// Prestress mechanics: self-equilibrated initial generalized strains and frame2d kernel integration.
const ps2=prestressInitialState2D({force:1000,eccentricity:.05,E:200e6,A:.01,I:1e-4});assert.equal(ps2.contract,PRESTRESS_ACTION_CONTRACT);close(ps2.eps0,-.0005);close(ps2.kappa0,.0025);vclose(ps2.equivalentLocal,[1000,0,-50,-1000,0,50],1e-12,'vetor local de protensão 2D');close(ps2.equivalentLocal[0]+ps2.equivalentLocal[3],0);close(ps2.equivalentLocal[2]+ps2.equivalentLocal[5],0);
const frame=prepareFrameElement({E:200e6,A:.01,I:1e-4,L:5,c:1,s:0,loads:[{kind:'prestress',force:1000,eccentricity:.05}]});vclose(frame.pOriginal,ps2.equivalentLocal,1e-12,'integração frame2d');const fixed=recoverFrameEndForces(frame,Array(6).fill(0));vclose(fixed.q,ps2.equivalentLocal.map(v=>-v),1e-12,'forças internas de protensão a u=0');

// 3D prestress is mapped to the existing corotational initial-strain variables exactly.
const p3={nodes:[{id:'A',x:0,y:0,z:0},{id:'B',x:4,y:0,z:0}],elements:[{id:'F3',type:'frame3d',n1:'A',n2:'B',materialId:'M',sectionId:'SEC'}],materials:[{id:'M',E:200e6,nu:.3,alpha:12e-6,density:78.5}],sections:[{id:'SEC',A:.01,Iy:2e-4,Iz:3e-4,J:1e-5,h:.4,b:.3}],loads:[],elementLoads:[{id:'P3',kind:'prestress',elementId:'F3',force:900,eccentricityY:.04,eccentricityZ:-.03}],supports:[],settlements:[],nodeSprings:[]},ps3=prestressInitialState3D({force:900,eccentricityY:.04,eccentricityZ:-.03,E:200e6,A:.01,Iy:2e-4,Iz:3e-4}),prepared3=prepareCorotational3DDeadLoads(p3),eq3=prepared3.prestressConversions[0];assert.equal(prepared3.prestressConversions.length,1);assert.equal(eq3.sourceKind,'prestress');close(12e-6*eq3.dT,ps3.eps0,1e-10,'eps0 3D equivalente');close(-12e-6*eq3.dTGradientY/.4,ps3.kappaZ,1e-10,'kappaZ 3D equivalente');close(12e-6*eq3.dTGradientZ/.3,ps3.kappaY,1e-10,'kappaY 3D equivalente');

// Time-dependent laws: correct origin, monotonic evolution and asymptotic bounds.
const cr0=creepCoefficient({timeDays:28,loadingAgeDays:28,ultimate:2,timeConstantDays:100}),cr1=creepCoefficient({timeDays:128,loadingAgeDays:28,ultimate:2,timeConstantDays:100}),cr2=creepCoefficient({timeDays:1028,loadingAgeDays:28,ultimate:2,timeConstantDays:100});assert.equal(cr0.contract,TIME_DEPENDENT_EFFECTS_CONTRACT);close(cr0.value,0);assert.ok(cr1.value>0&&cr2.value>cr1.value&&cr2.value<2.000001);const sh=shrinkageStrain({timeDays:365,startDay:7,ultimate:-.0004,timeConstantDays:100});assert.ok(sh.value<0&&Math.abs(sh.value)<.000401);const rel=prestressRelaxation({timeDays:1000,initialForce:1000,ultimateLossRatio:.12,timeConstantDays:200});assert.ok(rel.effectiveForce<1000&&rel.effectiveForce>879);const aa=ageAdjustedEffectiveModulus({E:30e6,creep:2,agingCoefficient:.8});close(aa.effectiveModulus,30e6/2.6,1e-12);const td=timeDependentState({timeDays:365,loadingAgeDays:28,E:30e6,creep:{ultimate:2,timeConstantDays:100},shrinkage:{startDay:7,ultimate:-.0004,timeConstantDays:100},prestress:{startDay:0,initialForce:1000,ultimateLossRatio:.12,timeConstantDays:200}});assert.equal(td.contract,TIME_DEPENDENT_EFFECTS_CONTRACT);assert.ok(td.creepCoefficient>0&&td.ageAdjusted.effectiveModulus<30e6);

// Construction stages are cumulative snapshots with activation/deactivation and elapsed time.
const stageActions=[{id:'G',type:'element',loads:[{elementId:'E1',kind:'selfWeight',gamma:25,weightFactor:1}]},{id:'Q',type:'nodal',loads:[{nodeId:'N2',fy:-10}]}],staged=buildConstructionStageSnapshots({project,actions:stageActions,initialState:{elements:[],supports:[],actions:[],timeDays:0},stages:[{id:'ST1',durationDays:7,activateElements:['E1'],activateSupports:['S1'],activateActions:['G']},{id:'ST2',durationDays:21,activateElements:['E2'],activateSupports:['S2'],activateActions:['Q']},{id:'ST3',durationDays:30,deactivateActions:['Q']}],timeEffects:{loadingAgeDays:1,E:30e6,creep:{ultimate:2,timeConstantDays:100}}});assert.equal(staged.contract,CONSTRUCTION_STAGE_CONTRACT);assert.equal(staged.snapshots.length,3);assert.deepEqual(staged.snapshots[0].active.elements,['E1']);assert.equal(staged.snapshots[0].project.elements.length,1);assert.equal(staged.snapshots[0].project.supports.length,1);assert.equal(staged.snapshots[0].project.elementLoads.some(l=>l.actionId==='G'),true);assert.equal(staged.snapshots[1].project.elements.length,2);assert.equal(staged.snapshots[1].project.loads.some(l=>l.actionId==='Q'),true);assert.equal(staged.snapshots[2].project.loads.some(l=>l.actionId==='Q'),false);close(staged.finalTimeDays,58);assert.ok(staged.snapshots[2].timeEffects.creepCoefficient>staged.snapshots[0].timeEffects.creepCoefficient);

console.log('AstraStruct v0.40 Load/Stage Engine smoke: actions, moving loads, construction stages, prestress and time-dependent effects OK.');
