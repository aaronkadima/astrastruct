import assert from 'node:assert/strict';
import { createGridBuilding3D } from '../web/src/core/exampleModels.js';
import { assignLevels, deriveLevels, duplicateLevel, levelSummary } from '../web/src/core/levels.js';

const base=createGridBuilding3D({name:'Levels smoke',xSpans:[5],ySpans:[4],storeys:2,storeyHeight:3,floorLoadPerNode:-10,includeSlabs:false});
const assigned=assignLevels(base),levels=deriveLevels(assigned);assert.equal(levels.length,3);assert.deepEqual(levels.map(x=>x.elevation),[0,3,6]);assert.ok(assigned.nodes.every(n=>n.levelId));
const summary=levelSummary(assigned);assert.equal(summary[0].nodeCount,4);assert.equal(summary[1].horizontalElementCount,4);assert.equal(summary[2].horizontalElementCount,4);
const top=levels[2];const next=duplicateLevel(assigned,{sourceLevelId:top.id,targetElevation:9,targetName:'Cobertura',copyLoads:true,connectVertical:true});
assert.equal(next.levels.length,4);assert.equal(next.nodes.length,16);assert.equal(next.elements.length,24);assert.equal(next.loads.length,12);assert.equal(next.levels.at(-1).name,'Cobertura');assert.ok(next.nodes.filter(n=>n.levelId===next.levels.at(-1).id).every(n=>Math.abs(n.z-9)<1e-12));
assert.throws(()=>duplicateLevel(next,{sourceLevelId:top.id,targetElevation:9}),/Já existe um nível/);

// Shell4 must be duplicated atomically with all four vertices and its surface load.
const shellBase=assignLevels(JSON.parse(JSON.stringify(base))),shellTop=deriveLevels(shellBase).at(-1),topNodes=shellBase.nodes.filter(n=>n.levelId===shellTop.id);assert.equal(topNodes.length,4);
shellBase.elements.push({id:'S_TOP',type:'shell4',nodeIds:topNodes.map(n=>n.id),n1:topNodes[0].id,n2:topNodes[1].id,n3:topNodes[2].id,n4:topNodes[3].id,materialId:'concrete30',thickness:.18,label:'Laje topo'});shellBase.elementLoads.push({id:'P_TOP',caseId:'LC1',elementId:'S_TOP',kind:'surface',pressure:-5});
const shellNext=duplicateLevel(shellBase,{sourceLevelId:shellTop.id,targetElevation:9,targetName:'Cobertura shell',copyLoads:true,connectVertical:false}),newLevel=shellNext.levels.at(-1),newIds=new Set(shellNext.nodes.filter(n=>n.levelId===newLevel.id).map(n=>n.id)),copiedShell=shellNext.elements.find(e=>e.type==='shell4'&&e.id!=='S_TOP');
assert.ok(copiedShell,'shell4 should be copied to the new level');assert.equal(copiedShell.nodeIds.length,4);assert.ok(copiedShell.nodeIds.every(id=>newIds.has(id)),'all four shell vertices must point to new-level nodes');assert.deepEqual([copiedShell.n1,copiedShell.n2,copiedShell.n3,copiedShell.n4],copiedShell.nodeIds);assert.equal(copiedShell.levelId,newLevel.id);const copiedPressure=shellNext.elementLoads.find(l=>l.elementId===copiedShell.id&&l.kind==='surface');assert.equal(copiedPressure?.pressure,-5,'surface pressure must follow duplicated shell');
console.log('levels-v030-smoke: OK');
