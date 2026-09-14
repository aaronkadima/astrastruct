import assert from 'node:assert/strict';
import {
  createIfcInteroperabilityModel,createIfcIdentityMap,assignIfcGlobalIds,compressIfcGuid,
  validateIfcStepReadiness,renderIfcStep,validateIfcStepEnvelope
} from '../web/src/interop/index.js';

const ownerMetadata={
  person:{identification:'ci-user',familyName:'CI',givenName:'AstraStruct'},
  organization:{identification:'ASTRASTRUCT-CI',name:'AstraStruct CI',description:'Deterministic interoperability benchmark'},
  application:{version:'0.45.0-exp',fullName:'AstraStruct',identifier:'ASTRASTRUCT'},
  creationDate:1789346700
};

const project={
  id:'STEP-BENCH-001',name:'Pórtico linear — benchmark',units:'kN-m-MPa',schemaVersion:2,
  nodes:[{id:'N1',x:0,y:0,z:0},{id:'N2',x:0,y:0,z:3}],
  supports:[{id:'SUP-N1',nodeId:'N1',ux:true,uy:true,uz:true,rx:true,ry:true,rz:true}],
  nodeSprings:[{id:'SPR-N2',nodeId:'N2',kx:5000,krz:250}],
  materials:[{id:'steel',name:'Steel',type:'steel',E:200e6}],
  sections:[{id:'I1',name:'I section',family:'steel3d',A:.01,ifcProfile:{ifcClass:'IfcIShapeProfileDef',profileName:'I-BENCH',overallWidth:.20,overallDepth:.30,webThickness:.01,flangeThickness:.02,filletRadius:0}}],
  elements:[{id:'E1',type:'frame3d',n1:'N1',n2:'N2',materialId:'steel',sectionId:'I1'}]
};

const canonical=createIfcInteroperabilityModel(project);
let seq=0;
const identity=createIfcIdentityMap(canonical,{uuidFactory:()=> (++seq).toString(16).padStart(32,'0')});
const model=assignIfcGlobalIds(canonical,{identityMap:identity});
const declarationGlobalId=compressIfcGuid('00000000-0000-0000-0000-000000000100');
const groupGlobalId=compressIfcGuid('00000000-0000-0000-0000-000000000101');
const curveMaterialGlobalId=compressIfcGuid('00000000-0000-0000-0000-000000000102');
const curveOptions={declarationGlobalId,groupGlobalId,materialAssociationGlobalIds:{E1:curveMaterialGlobalId},ownerMetadata};
const ready=validateIfcStepReadiness(model,curveOptions);
assert.equal(ready.curveMembers,1);assert.equal(ready.surfaceMembers,0);assert.equal(ready.nodes,2);assert.equal(ready.relationships,2);
assert.deepEqual(ready.materialSummary,{total:1,ready:1,pending:0,directMaterial:0,profileSet:1,reasons:{}});
assert.deepEqual(ready.owner,{organization:'AstraStruct CI',application:'AstraStruct',applicationVersion:'0.45.0-exp',creationDate:1789346700});
assert.ok(ready.warnings.some(x=>x.includes('validação externa')));

const step=renderIfcStep(model,{...curveOptions,fileName:'step-bench.ifc',timestamp:'2026-09-13T21:45:00-03:00'});
const envelope=validateIfcStepEnvelope(step);
assert.equal(envelope.schema,'IFC4X3_ADD2');
assert.equal(envelope.hasProject,true);assert.equal(envelope.hasAnalysisModel,true);assert.equal(envelope.hasPointConnections,true);assert.equal(envelope.hasCurveMembers,true);
assert.equal(envelope.hasSurfaceMembers,false);assert.equal(envelope.hasFaceSurface,false);
assert.equal(envelope.hasMaterial,true);assert.equal(envelope.hasMaterialAssociations,true);assert.equal(envelope.hasProfileSetUsage,true);
assert.equal(envelope.hasOwnerHistory,true);assert.equal(envelope.hasApplication,true);
assert.match(step,/FILE_SCHEMA\(\('IFC4X3_ADD2'\)\);/);
assert.match(step,/FILE_NAME\('step-bench\.ifc','2026-09-13T21:45:00-03:00',\('AstraStruct CI'\),\('AstraStruct CI'\)/);
assert.match(step,/IFCPERSON\('ci-user','CI','AstraStruct',\$,\$,\$,\$,\$\)/);
assert.match(step,/IFCORGANIZATION\('ASTRASTRUCT-CI','AstraStruct CI','Deterministic interoperability benchmark',\$,\$\)/);
assert.match(step,/IFCPERSONANDORGANIZATION\(#\d+,#\d+,\$\)/);
assert.match(step,/IFCAPPLICATION\(#\d+,'0\.45\.0-exp','AstraStruct','ASTRASTRUCT'\)/);
assert.match(step,/IFCOWNERHISTORY\(#\d+,#\d+,\$,\$,\$,\$,\$,1789346700\)/);
assert.match(step,/IFCPROJECT\('[^']+',#\d+,'Pórtico linear/);
assert.match(step,/IFCSTRUCTURALANALYSISMODEL\('[^']+',#\d+,'Pórtico linear/);
assert.match(step,/IFCDERIVEDUNIT\(\([^\n]+\.LINEARSTIFFNESSUNIT\./);
assert.match(step,/IFCDERIVEDUNIT\(\([^\n]+\.ROTATIONALSTIFFNESSUNIT\./);
assert.match(step,/IFCBOUNDARYNODECONDITION\('Boundary N1',IFCBOOLEAN\(\.T\.\)/);
assert.match(step,/IFCLINEARSTIFFNESSMEASURE\(5000\.\)/);
assert.match(step,/IFCROTATIONALSTIFFNESSMEASURE\(250\.\)/);
assert.match(step,/IFCTOPOLOGYREPRESENTATION\([^\n]+,'Reference','Vertex'/);
assert.match(step,/IFCTOPOLOGYREPRESENTATION\([^\n]+,'Reference','Edge'/);
assert.match(step,/IFCSTRUCTURALCURVEMEMBER\('[^']+',#\d+/);
assert.match(step,/IFCMATERIAL\('Steel',\$,'steel'\)/);
assert.match(step,/IFCISHAPEPROFILEDEF\(\.AREA\.,'I-BENCH',\$,0\.2,0\.3,0\.01,0\.02,0\.,\$,\$\)/);
assert.match(step,/IFCMATERIALPROFILE\('I section',\$,#\d+,#\d+,\$,'LoadBearing'\)/);
assert.match(step,/IFCMATERIALPROFILESET\('I section',\$,\(#\d+\),\$\)/);
assert.match(step,/IFCMATERIALPROFILESETUSAGE\(#\d+,10,\$\)/);
assert.match(step,new RegExp(`IFCRELASSOCIATESMATERIAL\\('${curveMaterialGlobalId}',#\\d+`));
assert.match(step,/IFCRELCONNECTSSTRUCTURALMEMBER\('[^']+',#\d+/);
assert.match(step,/IFCRELASSIGNSTOGROUP\('[^']+',#\d+/);
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
const surfaceMaterialGlobalId=compressIfcGuid('00000000-0000-0000-0000-000000000103');
const surfaceOptions={declarationGlobalId,groupGlobalId,materialAssociationGlobalIds:{S1:surfaceMaterialGlobalId},ownerMetadata};
const surfaceReady=validateIfcStepReadiness(identifiedSurface,surfaceOptions);
assert.equal(surfaceReady.curveMembers,0);assert.equal(surfaceReady.surfaceMembers,1);assert.equal(surfaceReady.nodes,4);assert.equal(surfaceReady.relationships,4);
assert.deepEqual(surfaceReady.materialSummary,{total:1,ready:1,pending:0,directMaterial:1,profileSet:0,reasons:{}});
const surfaceStep=renderIfcStep(identifiedSurface,{...surfaceOptions,fileName:'surface-bench.ifc',timestamp:'2026-09-13T21:45:00-03:00'});
const surfaceEnvelope=validateIfcStepEnvelope(surfaceStep);
assert.equal(surfaceEnvelope.hasCurveMembers,false);assert.equal(surfaceEnvelope.hasSurfaceMembers,true);assert.equal(surfaceEnvelope.hasFaceSurface,true);
assert.equal(surfaceEnvelope.hasMaterial,true);assert.equal(surfaceEnvelope.hasMaterialAssociations,true);assert.equal(surfaceEnvelope.hasProfileSetUsage,false);
assert.equal(surfaceEnvelope.hasOwnerHistory,true);assert.equal(surfaceEnvelope.hasApplication,true);
assert.match(surfaceStep,/IFCPOLYLOOP\(\(#\d+,#\d+,#\d+,#\d+\)\)/);
assert.match(surfaceStep,/IFCFACEOUTERBOUND\(#\d+,\.T\.\)/);
assert.match(surfaceStep,/IFCPLANE\(#\d+\)/);
assert.match(surfaceStep,/IFCFACESURFACE\(\(#\d+\),#\d+,\.T\.\)/);
assert.match(surfaceStep,/IFCTOPOLOGYREPRESENTATION\([^\n]+,'Reference','Face'/);
assert.match(surfaceStep,/IFCSTRUCTURALSURFACEMEMBER\('[^']+',#\d+,[^\n]+\.SHELL\.,0\.18\)/);
assert.match(surfaceStep,/IFCMATERIAL\('Concrete',\$,'concrete'\)/);
assert.match(surfaceStep,new RegExp(`IFCRELASSOCIATESMATERIAL\\('${surfaceMaterialGlobalId}',#\\d+`));
assert.equal((surfaceStep.match(/IFCRELCONNECTSSTRUCTURALMEMBER\(/g)||[]).length,4);

const nonPlanarProject={...surfaceProject,id:'SURFACE-NONPLANAR',nodes:surfaceProject.nodes.map(n=>n.id==='N4'?{...n,y:.01}:n)};
const nonPlanar=createIfcInteroperabilityModel(nonPlanarProject);
seq=0;const nonPlanarIdentity=createIfcIdentityMap(nonPlanar,{uuidFactory:()=> (++seq).toString(16).padStart(32,'0')});
const identifiedNonPlanar=assignIfcGlobalIds(nonPlanar,{identityMap:nonPlanarIdentity});
assert.throws(()=>validateIfcStepReadiness(identifiedNonPlanar,surfaceOptions),/não planar/);

const degenerateProject={...surfaceProject,id:'SURFACE-DEGENERATE',nodes:[{id:'N1',x:0,y:0,z:0},{id:'N2',x:1,y:0,z:0},{id:'N3',x:2,y:0,z:0}],elements:[{id:'S1',type:'shell3',n1:'N1',n2:'N2',n3:'N3',materialId:'concrete',thickness:.18}],sections:[]};
const degenerate=createIfcInteroperabilityModel(degenerateProject);
seq=0;const degenerateIdentity=createIfcIdentityMap(degenerate,{uuidFactory:()=> (++seq).toString(16).padStart(32,'0')});
const identifiedDegenerate=assignIfcGlobalIds(degenerate,{identityMap:degenerateIdentity});
assert.throws(()=>validateIfcStepReadiness(identifiedDegenerate,surfaceOptions),/degenerada\/colinear/);

const pendingProject={...project,id:'PENDING-MATERIAL',sections:[{id:'I1',name:'I section',family:'steel3d',A:.01}]};
const pendingCanonical=createIfcInteroperabilityModel(pendingProject);seq=0;
const pendingModel=assignIfcGlobalIds(pendingCanonical,{identityMap:createIfcIdentityMap(pendingCanonical,{uuidFactory:()=> (++seq).toString(16).padStart(32,'0')})});
assert.throws(()=>validateIfcStepReadiness(pendingModel,curveOptions),/mapeamentos PENDING/);
assert.throws(()=>validateIfcStepReadiness(model,{declarationGlobalId,groupGlobalId,materialAssociationGlobalIds:{},ownerMetadata}),/IfcRelAssociatesMaterial obrigatório/);
assert.throws(()=>validateIfcStepReadiness(model,{...curveOptions,ownerMetadata:{}}),/IFC owner/);
assert.throws(()=>renderIfcStep(model,{declarationGlobalId:'invalid',groupGlobalId,materialAssociationGlobalIds:{E1:curveMaterialGlobalId},ownerMetadata}),/declarationGlobalId/);

console.log(`AstraStruct v0.45 IFC STEP smoke: owner/application metadata, curves + planar surfaces, material/profile associations, topology and guards coherent.`);
