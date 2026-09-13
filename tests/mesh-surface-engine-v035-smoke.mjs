import assert from 'node:assert/strict';
import {
  MESH_ENGINE_CONTRACT,MESH_SURFACE_ENGINE_VERSION,createSurfaceMesh,createBilinearPatchMesh,triangulatePlanarPolygon,
  buildSurfaceTopology,orientSurfaceMeshConsistently,evaluateSurfaceMeshQuality,refineSurfaceMeshConforming,
  createShellFrameCouplingConstraints,refineProjectShellSurface
} from '../web/src/mesh/index.js';
import {DofManager} from '../web/src/numerics/dofManager.js';

const close=(a,b,tol=1e-10,msg='')=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(b)),`${msg} esperado ${b}, obtido ${a}`);
assert.equal(MESH_ENGINE_CONTRACT,'mesh-surface/v1');assert.equal(MESH_SURFACE_ENGINE_VERSION,'0.35.0-exp');

// Structured bilinear patch: exact topology and area.
const patch=createBilinearPatchMesh({id:'P',corners:[{id:'A',x:0,y:0,z:0},{id:'B',x:2,y:0,z:0},{id:'C',x:2,y:1,z:0},{id:'D',x:0,y:1,z:0}],divisionsU:2,divisionsV:1,group:'L1'}),top=buildSurfaceTopology(patch),quality=evaluateSurfaceMeshQuality(patch);
assert.equal(patch.nodes.length,6);assert.equal(patch.cells.length,2);assert.equal(top.interiorEdges.length,1);assert.equal(top.boundaryEdges.length,6);assert.equal(top.nonManifoldEdges.length,0);assert.equal(top.components.length,1);assert.equal(top.boundaryLoops.length,1);close(quality.area,2,1e-12,'patch area');assert.equal(quality.ok,true);

// Orientation correction across a shared edge.
const reversed=createSurfaceMesh({...patch,cells:[patch.cells[0],{...patch.cells[1],nodeIds:[patch.cells[1].nodeIds[0],...patch.cells[1].nodeIds.slice(1).reverse()]}]}),oriented=orientSurfaceMeshConsistently(reversed);assert.equal(oriented.flipped.length,1);assert.equal(oriented.topology.nonManifoldEdges.length,0);

// Non-manifold edge detection must be explicit.
const nm=createSurfaceMesh({id:'NM',nodes:[{id:'n1',x:0,y:0,z:0},{id:'n2',x:1,y:0,z:0},{id:'n3',x:.5,y:1,z:0},{id:'n4',x:.5,y:-1,z:0},{id:'n5',x:.5,y:0,z:1}],cells:[{id:'t1',type:'tri3',nodeIds:['n1','n2','n3']},{id:'t2',type:'tri3',nodeIds:['n2','n1','n4']},{id:'t3',type:'tri3',nodeIds:['n1','n2','n5']}]});assert.equal(buildSurfaceTopology(nm).nonManifoldEdges.length,1);

// Conforming quad refinement: shared edge midpoint reused and total area conserved.
assert.throws(()=>refineSurfaceMeshConforming(patch,{cellIds:[patch.cells[0].id],scope:'selected'}),/seleção não conforme/i);
const refined=refineSurfaceMeshConforming(patch,{cellIds:[patch.cells[0].id],scope:'component'});assert.equal(refined.report.refinedParents,2);assert.equal(refined.mesh.cells.length,8);assert.equal(refined.mesh.nodes.length,15);assert.equal(refined.topology.nonManifoldEdges.length,0);close(refined.report.areaBefore,2,1e-12);close(refined.report.areaAfter,2,1e-12);close(refined.report.areaRelativeError,0,1e-12);assert.ok(refined.mesh.nodes.filter(n=>n.group==='L1').length>=patch.nodes.length);

// Planar polygon triangulation + tri3 refinement.
const polygon=triangulatePlanarPolygon({id:'poly',vertices:[{id:'p1',x:0,y:0,z:0},{id:'p2',x:2,y:0,z:0},{id:'p3',x:2,y:1,z:0},{id:'p4',x:1,y:.5,z:0},{id:'p5',x:0,y:1,z:0}]});assert.equal(polygon.cells.length,3);const polyArea=evaluateSurfaceMeshQuality(polygon).area;close(polyArea,1.5,1e-12,'concave polygon area');const triRefined=refineSurfaceMeshConforming(polygon);assert.equal(triRefined.mesh.cells.length,12);close(evaluateSurfaceMeshQuality(triRefined.mesh).area,polyArea,1e-12,'tri refined area');

// Shell-frame MPC: interpolation + rigid arm theta x r.
const couplingMesh=createSurfaceMesh({id:'coupling',nodes:[{id:'S',x:1,y:.1,z:0},{id:'Q1',x:1.2,y:.1,z:0},{id:'Q2',x:1.1,y:.2,z:0}],cells:[{id:'T',type:'tri3',nodeIds:['S','Q1','Q2']}]});const dm=new DofManager(),coupling=createShellFrameCouplingConstraints({mesh:couplingMesh,frameNodes:[{id:'F1',x:0,y:0,z:0},{id:'F2',x:2,y:0,z:0}],frameSegments:[{id:'F',n1:'F1',n2:'F2'}],dofManager:dm,shellNodeIds:['S'],tolerance:.11});assert.equal(coupling.report.matchedNodes,1);assert.equal(coupling.report.equationsAdded,6);close(coupling.matches[0].t,.5,1e-12);close(coupling.matches[0].rigidArm.y,.1,1e-12);const expressions=coupling.constraints.resolveExpressions(dm.count),ux=expressions[dm.get('S','ux')].coefficients;close(ux.get(dm.get('F1','ux')),0.5,1e-12);close(ux.get(dm.get('F2','ux')),0.5,1e-12);close(ux.get(dm.get('F1','rz')),-0.05,1e-12);close(ux.get(dm.get('F2','rz')),-0.05,1e-12);

// Real shell4 project adapter: preserve shell properties and pressure intensity.
const project={id:'demo',nodes:[{id:'N1',x:0,y:0,z:3,levelId:'L1'},{id:'N2',x:2,y:0,z:3,levelId:'L1'},{id:'N3',x:2,y:1,z:3,levelId:'L1'},{id:'N4',x:0,y:1,z:3,levelId:'L1'}],elements:[{id:'S1',type:'shell4',nodeIds:['N1','N2','N3','N4'],n1:'N1',n2:'N2',n3:'N3',n4:'N4',materialId:'C30',thickness:.2,shearCorrection:5/6,drillingFactor:1e-6,levelId:'L1'}],elementLoads:[{id:'P1',elementId:'S1',caseId:'LC1',kind:'surface',pressure:-5}],meta:{}};const projected=refineProjectShellSurface(project);assert.equal(projected.project.elements.filter(e=>e.type==='shell4').length,4);assert.equal(projected.project.nodes.length,9);assert.equal(projected.project.elementLoads.length,4);for(const e of projected.project.elements.filter(e=>e.type==='shell4')){close(e.thickness,.2,1e-12);assert.equal(e.materialId,'C30');assert.equal(e.levelId,'L1')}for(const l of projected.project.elementLoads){assert.equal(l.kind,'surface');close(l.pressure,-5,1e-12)}close(projected.report.areaBefore,2,1e-12);close(projected.report.areaAfter,2,1e-12);

console.log('AstraStruct v0.35 Mesh & Surface Engine smoke: topology, quality, generators, conforming refinement, shell-frame MPC and shell4 project adapter OK.');
