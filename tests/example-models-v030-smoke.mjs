import assert from 'node:assert/strict';
import {createGridBuilding3D,createPlanBuilding3D,demoFiveStoreyBuilding3D,demoSteelWarehouse3D,demoWaterTank3D,demoIsolatedBeamLab3D,demoIsolatedColumnLab3D,demoSpringLab3D} from '../web/src/core/exampleModels.js';

function validateSpatial(p,label,{allowShells=false}={}){
 assert.ok(p.nodes.length>1,`${label}: nodes`);assert.ok(p.elements.length>0,`${label}: elements`);
 const allowed=allowShells?new Set(['frame3d','shell4']):new Set(['frame3d']);assert.ok(p.elements.every(e=>allowed.has(e.type)),`${label}: allowed element types`);
 const ids=new Set(p.nodes.map(n=>n.id));assert.equal(ids.size,p.nodes.length,`${label}: unique nodes`);
 for(const e of p.elements){
  if(e.type==='shell4'){
   assert.equal(e.nodeIds.length,4,`${label}: shell topology ${e.id}`);assert.equal(new Set(e.nodeIds).size,4,`${label}: unique shell nodes ${e.id}`);for(const id of e.nodeIds)assert.ok(ids.has(id),`${label}: shell node ${id}`);assert.ok(Number(e.thickness)>0,`${label}: shell thickness ${e.id}`);
  }else{assert.ok(ids.has(e.n1)&&ids.has(e.n2),`${label}: connected element ${e.id}`);assert.notEqual(e.n1,e.n2,`${label}: nonzero topology ${e.id}`)}
 }
 for(const s of p.supports)assert.ok(ids.has(s.nodeId),`${label}: support node`);for(const l of p.loads)assert.ok(ids.has(l.nodeId),`${label}: load node`);
 assert.equal(p.settings.analysisScenarioId,p.loadCases[0].id,`${label}: scenario`);
}

const five=demoFiveStoreyBuilding3D();validateSpatial(five,'five storey',{allowShells:true});assert.equal(five.meta.exampleKind,'building-grid');assert.equal(five.nodes.length,4*3*6);assert.equal(five.supports.length,12);
const fiveFrames=five.elements.filter(e=>e.type==='frame3d'),fiveSlabs=five.elements.filter(e=>e.type==='shell4');assert.ok(fiveFrames.length>100);assert.equal(fiveSlabs.length,30);assert.equal(five.meta.slabPanels,30);assert.equal(five.meta.slabThickness,.15);assert.ok(fiveSlabs.every(e=>e.role==='slab'&&e.materialId==='concrete30'&&Math.abs(e.thickness-.15)<1e-12));for(let k=1;k<=5;k++)assert.equal(fiveSlabs.filter(e=>e.levelId===`L${k}`).length,6,`six slab panels at L${k}`);
const custom=createGridBuilding3D({xSpans:[4,6],ySpans:[5],storeys:2,storeyHeight:3.2,floorLoadPerNode:-10});validateSpatial(custom,'grid custom',{allowShells:true});assert.equal(custom.nodes.length,3*2*3);assert.equal(custom.supports.length,6);assert.ok(custom.nodes.some(n=>Math.abs(n.z-6.4)<1e-12));assert.equal(custom.elements.filter(e=>e.type==='shell4').length,4);
const noSlabs=createGridBuilding3D({xSpans:[4,6],ySpans:[5],storeys:2,includeSlabs:false});validateSpatial(noSlabs,'grid no slabs');assert.equal(noSlabs.elements.filter(e=>e.type==='shell4').length,0);assert.equal(noSlabs.meta.slabPanels,0);
const plan=createPlanBuilding3D({planNodes:[{id:'A',x:0,y:0},{id:'B',x:5,y:0},{id:'C',x:5,y:4}],planEdges:[{n1:'A',n2:'B'},{n1:'B',n2:'C'}],storeys:3,storeyHeight:3});validateSpatial(plan,'plan');assert.equal(plan.meta.exampleKind,'building-plan');assert.equal(plan.nodes.length,12);assert.equal(plan.supports.length,3);assert.equal(plan.meta.plan.edges.length,2);
for(const [name,f] of [['warehouse',demoSteelWarehouse3D],['tank',demoWaterTank3D],['beam lab',demoIsolatedBeamLab3D],['column lab',demoIsolatedColumnLab3D],['spring lab',demoSpringLab3D]])validateSpatial(f(),name);
const spring=demoSpringLab3D();assert.equal(spring.nodeSprings[0].kz,2500);assert.equal(spring.nodeSprings[0].kry,800);
assert.throws(()=>createPlanBuilding3D({planNodes:[{id:'A',x:0,y:0}],planEdges:[]}),/pelo menos dois nós/i);
console.log('v0.30 example models and building generators smoke: OK');
