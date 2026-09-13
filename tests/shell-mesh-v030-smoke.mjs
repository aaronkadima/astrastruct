import assert from 'node:assert/strict';
import { createGridBuilding3D } from '../web/src/core/exampleModels.js';
import { assignLevels, deriveLevels } from '../web/src/core/levels.js';
import { detectRectangularShellCells, addRectangularShellPanels } from '../web/src/core/shellMesh.js';

const base=assignLevels(createGridBuilding3D({name:'Shell mesh smoke',xSpans:[5,5],ySpans:[4,4],storeys:1,storeyHeight:3,floorLoadPerNode:0})),top=deriveLevels(base).at(-1);
const cells=detectRectangularShellCells(base,{levelId:top.id,requireBoundaryElements:true});assert.equal(cells.length,4);assert.ok(cells.every(c=>c.boundaryClosed));assert.equal(cells.reduce((s,c)=>s+c.area,0),80);for(const c of cells)assert.equal(new Set(c.nodeIds).size,4);
const generated=addRectangularShellPanels(base,{levelId:top.id,materialId:'concrete30',thickness:.20,pressure:-6,caseId:'LC1'});assert.equal(generated.report.created,4);assert.equal(generated.report.totalArea,80);assert.equal(generated.project.elements.filter(e=>e.type==='shell4').length,4);assert.equal(generated.project.elementLoads.filter(l=>l.kind==='surface').length,4);assert.ok(generated.project.elements.filter(e=>e.type==='shell4').every(e=>e.thickness===.20&&e.nodeIds.length===4));assert.ok(generated.project.elementLoads.filter(l=>l.kind==='surface').every(l=>l.pressure===-6));assert.equal(generated.project.settings.analysisType,'linear');
assert.throws(()=>addRectangularShellPanels(generated.project,{levelId:top.id,materialId:'concrete30'}),/Nenhum painel retangular fechado/,'existing shells must not be duplicated');
const broken=JSON.parse(JSON.stringify(base)),edge=broken.elements.find(e=>e.type==='frame3d'&&e.n1.includes('_1_0_1')&&e.n2.includes('_1_1_1'));if(edge)broken.elements=broken.elements.filter(e=>e.id!==edge.id);const reduced=detectRectangularShellCells(broken,{levelId:top.id,requireBoundaryElements:true});assert.ok(reduced.length<4,'missing beam edge must suppress at least one panel');
console.log('shell-mesh-v030-smoke: OK');
