import assert from 'node:assert/strict';
import {
  createIfcInteroperabilityModel,createIfcIdentityMap,assignIfcGlobalIds,compressIfcGuid,
  validateIfcStepReadiness,renderIfcStep,validateIfcStepEnvelope
} from '../web/src/interop/index.js';

const project={
  id:'STEP-BENCH-001',name:'Pórtico linear — benchmark',units:'kN-m-MPa',schemaVersion:2,
  nodes:[{id:'N1',x:0,y:0,z:0},{id:'N2',x:0,y:0,z:3}],
  supports:[{id:'SUP-N1',nodeId:'N1',ux:true,uy:true,uz:true,rx:true,ry:true,rz:true}],
  nodeSprings:[{id:'SPR-N2',nodeId:'N2',kx:5000,krz:250}],
  materials:[{id:'steel',name:'Steel',type:'steel',E:200e6}],
  sections:[{id:'I1',name:'I section',family:'steel3d',A:.01}],
  elements:[{id:'E1',type:'frame3d',n1:'N1',n2:'N2',materialId:'steel',sectionId:'I1'}]
};

const canonical=createIfcInteroperabilityModel(project);
let seq=0;
const identity=createIfcIdentityMap(canonical,{uuidFactory:()=> (++seq).toString(16).padStart(32,'0')});
const model=assignIfcGlobalIds(canonical,{identityMap:identity});
const declarationGlobalId=compressIfcGuid('00000000-0000-0000-0000-000000000100');
const groupGlobalId=compressIfcGuid('00000000-0000-0000-0000-000000000101');
const ready=validateIfcStepReadiness(model,{declarationGlobalId,groupGlobalId});
assert.equal(ready.curveMembers,1);assert.equal(ready.surfaceMembers,0);assert.equal(ready.nodes,2);assert.equal(ready.relationships,2);
assert.ok(ready.warnings.some(x=>x.includes('material/profile')));

const step=renderIfcStep(model,{declarationGlobalId,groupGlobalId,fileName:'step-bench.ifc',timestamp:'2026-09-13T21:45:00-03:00',author:'AstraStruct CI',organization:'AstraStruct'});
const envelope=validateIfcStepEnvelope(step);
assert.equal(envelope.schema,'IFC4X3_ADD2');
assert.equal(envelope.hasProject,true);assert.equal(envelope.hasAnalysisModel,true);assert.equal(envelope.hasPointConnections,true);assert.equal(envelope.hasCurveMembers,true);
assert.equal(envelope.hasSurfaceMembers,false);assert.equal(envelope.hasFaceSurface,false);
assert.match(step,/FILE_SCHEMA\(\('IFC4X3_ADD2'\)\);/);
assert.match(step,/IFCDERIVEDUNIT\(\([^\n]+\.LINEARSTIFFNESSUNIT\./);
assert.match(step,/IFCDERIVEDUNIT\(\([^\n]+\.ROTATIONALSTIFFNESSUNIT\./);
assert.match(step,/IFCBOUNDARYNODECONDITION\('Boundary N1',IFCBOOLEAN\(\.T\.\)/);
assert.match(step,/IFCLINEARSTIFFNESSMEASURE\(5000\.\)/);
assert.match(step,/IFCROTATIONALSTIFFNESSMEASURE\(250\.\)/);
assert.match(step,/IFCTOPOLOGYREPRESENTATION\([^\n]+,'Reference','Vertex'/);
assert.match(step,/IFCTOPOLOGYREPRESENTATION\([^\n]+,'Reference','Edge'/);
assert.match(step,/IFCSTRUCTURALCURVEMEMBER\(/);
assert.match(step,/IFCRELCONNECTSSTRUCTURALMEMBER\(/);
assert.match(step,/IFCRELASSIGNSTOGROUP\(/);
assert.ok(!step.includes('IFCSTRUCTURALSURFACEMEMBER'));

const surfaceProject={
  ...project,
  id:'SURFACE-BENCH',name:'Casca planar — benchmark',
  nodes:[
    {id:'N1',x:0,y:0,z:0},{id:'N2',x:0,y:0,z:3},{id:'N3',x:1,y:0,z:3},{id:'N4',x:1,y:0,z:0}
  ],
  supports:[],nodeSprings:[],
  materials:[{id:'concrete',name:'Concrete',type:'concrete',E:30e6}],
  sections:[{id:'SHELL-180',name:'Shell 180 mm',family:'shell',t:.18}],
  elements:[{id:'S1',type:'shell4',n1:'N1',n2:'N2',n3:'N3',n4:'N4',materialId:'concrete',sectionId:'SHELL-180',thickness:.18}]
};
const surface=createIfcInteroperabilityModel(surfaceProject);
seq=0;const surfaceIdentity=createIfcIdentityMap(surface,{uuidFactory:()=> (++seq).toString(16).padStart(32,'0')});
const identifiedSurface=assignIfcGlobalIds(surface,{identityMap:surfaceIdentity});
const surfaceReady=validateIfcStepReadiness(identifiedSurface,{declarationGlobalId,groupGlobalId});
assert.equal(surfaceReady.curveMembers,0);assert.equal(surfaceReady.surfaceMembers,1);assert.equal(surfaceReady.nodes,4);assert.equal(surfaceReady.relationships,4);
const surfaceStep=renderIfcStep(identifiedSurface,{declarationGlobalId,groupGlobalId,fileName:'surface-bench.ifc',timestamp:'2026-09-13T21:45:00-03:00'});
const surfaceEnvelope=validateIfcStepEnvelope(surfaceStep);
assert.equal(surfaceEnvelope.hasCurveMembers,false);assert.equal(surfaceEnvelope.hasSurfaceMembers,true);assert.equal(surfaceEnvelope.hasFaceSurface,true);
assert.match(surfaceStep,/IFCPOLYLOOP\(\(#\d+,#\d+,#\d+,#\d+\)\)/);
assert.match(surfaceStep,/IFCFACEOUTERBOUND\(#\d+,\.T\.\)/);
assert.match(surfaceStep,/IFCPLANE\(#\d+\)/);
assert.match(surfaceStep,/IFCFACESURFACE\(\(#\d+\),#\d+,\.T\.\)/);
assert.match(surfaceStep,/IFCTOPOLOGYREPRESENTATION\([^\n]+,'Reference','Face'/);
assert.match(surfaceStep,/IFCSTRUCTURALSURFACEMEMBER\([^\n]+\.SHELL\.,0\.18\)/);
assert.equal((surfaceStep.match(/IFCRELCONNECTSSTRUCTURALMEMBER\(/g)||[]).length,4);

const nonPlanarProject={...surfaceProject,id:'SURFACE-NONPLANAR',nodes:surfaceProject.nodes.map(n=>n.id==='N4'?{...n,y:.01}:n)};
const nonPlanar=createIfcInteroperabilityModel(nonPlanarProject);
seq=0;const nonPlanarIdentity=createIfcIdentityMap(nonPlanar,{uuidFactory:()=> (++seq).toString(16).padStart(32,'0')});
const identifiedNonPlanar=assignIfcGlobalIds(nonPlanar,{identityMap:nonPlanarIdentity});
assert.throws(()=>validateIfcStepReadiness(identifiedNonPlanar,{declarationGlobalId,groupGlobalId}),/não planar/);

const degenerateProject={...surfaceProject,id:'SURFACE-DEGENERATE',nodes:[{id:'N1',x:0,y:0,z:0},{id:'N2',x:1,y:0,z:0},{id:'N3',x:2,y:0,z:0}],elements:[{id:'S1',type:'shell3',n1:'N1',n2:'N2',n3:'N3',thickness:.18}],materials:[],sections:[]};
const degenerate=createIfcInteroperabilityModel(degenerateProject);
seq=0;const degenerateIdentity=createIfcIdentityMap(degenerate,{uuidFactory:()=> (++seq).toString(16).padStart(32,'0')});
const identifiedDegenerate=assignIfcGlobalIds(degenerate,{identityMap:degenerateIdentity});
assert.throws(()=>validateIfcStepReadiness(identifiedDegenerate,{declarationGlobalId,groupGlobalId}),/degenerada\/colinear/);
assert.throws(()=>renderIfcStep(model,{declarationGlobalId:'invalid',groupGlobalId}),/declarationGlobalId/);

console.log(`AstraStruct v0.45 IFC STEP smoke: curves + planar surfaces, Vertex/Edge/Face topology, stiffness boundaries and nonplanar/degenerate guards coherent.`);
