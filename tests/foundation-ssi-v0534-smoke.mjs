import assert from'node:assert/strict';
import{solve}from'../web/src/solver/index.js';
import{assembleDynamicSystem3D,solveBuckling3D}from'../web/src/solver/modalStability3d.js';
import{foundationSSIConfigFromProject,foundationSSIResults,withFoundationSSI}from'../web/src/foundation/ssi.js';
import{foundationSSIOverlayScene}from'../web/src/view/foundationSsiView3d.js';
import{characteristicLength3D,fitCamera3D}from'../web/src/view/spatialView3d.js';

const close=(a,b,tol,msg)=>assert.ok(Math.abs(a-b)<=tol,`${msg}: got ${a}, expected ${b}, err=${Math.abs(a-b)}`);
const base={id:'ssi-advanced',name:'SSI advanced',version:13,schemaVersion:2,units:'kN-m-MPa',nodes:[{id:'N1',x:0,y:0,z:0},{id:'N2',x:0,y:0,z:3}],elements:[{id:'C1',type:'frame3d',n1:'N1',n2:'N2',materialId:'C',sectionId:'S',orientation:{up:[0,1,0]}}],materials:[{id:'C',type:'concrete',E:30e6,nu:.2,density:25}],sections:[{id:'S',family:'rect',A:.30,Iy:.006,Iz:.008,J:.003,I:.008}],supports:[{nodeId:'N1',ux:true,uy:true,uz:true,rx:true,ry:true,rz:true}],loads:[{id:'P',caseId:'LC1',nodeId:'N2',fx:0,fy:0,fz:-100,mx:0,my:0,mz:0}],elementLoads:[],settlements:[],nodeSprings:[],nodalMasses:[],loadCases:[{id:'LC1',name:'Compressão',type:'user'}],loadCombinations:[],connections:[],settings:{analysisType:'linear',analysisScenarioId:'LC1',pDeltaMaxIterations:30,pDeltaTolerance:1e-9,modalModes:3,dynamicMassFormulation:'consistent'},foundationReview:{items:[{id:'F1',label:'Sapata F1',nodeId:'N1',type:'footing',x:0,y:0,z:0,geometry:{B:2,L:2,h:.5}}]}};
function configured(type){const p={...base,settings:{...base.settings,analysisType:type}},cfg=foundationSSIConfigFromProject(p);cfg.enabled=true;cfg.items[0].stiffness.kz=10000;cfg.items[0].source='rigidez explícita validada';return withFoundationSSI(p,cfg)}

// P-Delta: a mola participa de cada tangente e a reação física é recuperada.
const pdelta=configured('pdelta'),rp=solve(pdelta,'LC1');assert.equal(rp.analysisType,'pdelta');assert.ok(rp.pDelta.springCount>=1);const sp=rp.springForces.find(x=>x.springId==='SSI-F1');assert.ok(sp);close(sp.fz,100,5e-5,'P-Delta spring reaction');close(rp.displacements.find(x=>x.nodeId==='N1').uz,-.01,2e-8,'P-Delta settlement');
const postP=foundationSSIResults(pdelta,rp);assert.equal(postP.items[0].state,'READY');close(postP.items[0].averageContactPressureKPa,25,5e-5,'P-Delta average contact pressure');

// Modal: nodeSprings entram em K e a forma própria não é convertida em recalque/reação física.
const modal=configured('modal'),sys=assembleDynamicSystem3D(modal,{massFormulation:'consistent'});assert.equal(sys.springCount,1);const rm=solve(modal,'LC1');assert.equal(rm.analysisType,'modal');assert.equal(rm.springCount,1);assert.ok(rm.modes.length>=1&&rm.modes[0].frequencyHz>0);const postM=foundationSSIResults(modal,rm);assert.equal(postM.governance.resultNature,'eigen-shape');assert.equal(postM.items[0].state,'MODE_ONLY');assert.equal(postM.items[0].springReaction,null);assert.equal(postM.items[0].averageContactPressureKPa,null);

// Flambagem: a mola contribui somente à rigidez elástica K, nunca Kg.
const bucklingProject=configured('linear'),rb=solveBuckling3D(bucklingProject,'LC1',{modes:1});assert.ok(rb.criticalFactor>0);assert.equal(rb.stability.springCount,1);assert.equal(rb.stability.springsInGeometricStiffness,false);

// Canvas: cena SSI usa a câmera 3D, geometria explícita e resultados físicos do mesmo solver.
const camera=fitCamera3D(pdelta,'iso','perspective'),scene=foundationSSIOverlayScene(pdelta,rp,camera,{width:900,height:600},characteristicLength3D(pdelta));assert.equal(scene.contract,'foundation-ssi-overlay3d/v1');assert.equal(scene.summary.count,1);assert.equal(scene.resultNature,'physical');const item=scene.items[0];assert.ok(item.spring.length>=2);assert.ok(item.displacement);assert.ok(item.reaction);assert.ok(item.footprint?.length===4);close(item.settlementMm,-10,2e-5,'Canvas settlement label');close(item.averageContactPressureKPa,25,5e-5,'Canvas qbar label');

console.log('AstraStruct v0.53.4 SSI smoke: P-Delta/modal/buckling elastic spring integration, eigen-shape governance and synchronized 3D overlay OK.');