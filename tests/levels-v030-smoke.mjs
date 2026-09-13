import assert from 'node:assert/strict';
import { createGridBuilding3D } from '../web/src/core/exampleModels.js';
import { assignLevels, deriveLevels, duplicateLevel, levelSummary } from '../web/src/core/levels.js';

const base=createGridBuilding3D({name:'Levels smoke',xSpans:[5],ySpans:[4],storeys:2,storeyHeight:3,floorLoadPerNode:-10});
const assigned=assignLevels(base),levels=deriveLevels(assigned);assert.equal(levels.length,3);assert.deepEqual(levels.map(x=>x.elevation),[0,3,6]);assert.ok(assigned.nodes.every(n=>n.levelId));
const summary=levelSummary(assigned);assert.equal(summary[0].nodeCount,4);assert.equal(summary[1].horizontalElementCount,4);assert.equal(summary[2].horizontalElementCount,4);
const top=levels[2];const next=duplicateLevel(assigned,{sourceLevelId:top.id,targetElevation:9,targetName:'Cobertura',copyLoads:true,connectVertical:true});
assert.equal(next.levels.length,4);assert.equal(next.nodes.length,16);assert.equal(next.elements.length,24);assert.equal(next.loads.length,12);assert.equal(next.levels.at(-1).name,'Cobertura');assert.ok(next.nodes.filter(n=>n.levelId===next.levels.at(-1).id).every(n=>Math.abs(n.z-9)<1e-12));
assert.throws(()=>duplicateLevel(next,{sourceLevelId:top.id,targetElevation:9}),/Já existe um nível/);
console.log('levels-v030-smoke: OK');
