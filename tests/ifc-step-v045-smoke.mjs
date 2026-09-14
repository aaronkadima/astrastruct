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
assert.equal(ready.curveMembers,1);assert.equal(ready.nodes,2);assert.equal(ready.relationships,2);
assert.ok(ready.warnings.some(x=>x.includes('material/profile')));

const step=renderIfcStep(model,{declarationGlobalId,groupGlobalId,fileName:'step-bench.ifc',timestamp:'2026-09-13T21:45:00-03:00',author:'AstraStruct CI',organization:'AstraStruct'});
const envelope=validateIfcStepEnvelope(step);
assert.equal(envelope.schema,'IFC4X3_ADD2');
assert.equal(envelope.hasProject,true);assert.equal(envelope.hasAnalysisModel,true);assert.equal(envelope.hasPointConnections,true);assert.equal(envelope.hasCurveMembers,true);
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

const surface=createIfcInteroperabilityModel({...project,id:'SURFACE-BENCH',nodes:[...project.nodes,{id:'N3',x:1,y:0,z:3},{id:'N4',x:1,y:0,z:0}],elements:[{id:'S1',type:'shell4',n1:'N1',n2:'N2',n3:'N3',n4:'N4'}]});
seq=0;const surfaceIdentity=createIfcIdentityMap(surface,{uuidFactory:()=> (++seq).toString(16).padStart(32,'0')});
const identifiedSurface=assignIfcGlobalIds(surface,{identityMap:surfaceIdentity});
assert.throws(()=>validateIfcStepReadiness(identifiedSurface,{declarationGlobalId,groupGlobalId}),/apenas membros de curva/);
assert.throws(()=>renderIfcStep(model,{declarationGlobalId:'invalid',groupGlobalId}),/declarationGlobalId/);

console.log(`AstraStruct v0.45 IFC STEP smoke: ${envelope.entities} entities, curve topology, stiffness units/boundaries and guarded surface rejection coherent.`);
