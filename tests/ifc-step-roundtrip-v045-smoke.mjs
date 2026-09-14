import assert from 'node:assert/strict';
import {
  createIfcInteroperabilityModel,createIfcIdentityMap,assignIfcGlobalIds,compressIfcGuid,
  renderIfcStep,validateIfcStepEnvelope,parseIfcStepEntities,parseIfcStructuralStep,validateIfcStructuralRoundTrip,
  IFC_STEP_PARSER_CONTRACT,IFC_STEP_PARSER_VERSION
} from '../web/src/interop/index.js';

assert.equal(IFC_STEP_PARSER_CONTRACT,'ifc-step-parser/v1');
assert.equal(IFC_STEP_PARSER_VERSION,'0.45.0-exp');

const project={
  id:'ROUNDTRIP-BENCH',name:'Pórtico misto — benchmark',units:'kN-m-MPa',schemaVersion:2,
  nodes:[
    {id:'N1',x:0,y:0,z:0},
    {id:'N2',x:0,y:0,z:3},
    {id:'N3',x:2,y:0,z:3},
    {id:'N4',x:2,y:0,z:0}
  ],
  supports:[{id:'SUP-N1',nodeId:'N1',ux:true,uy:true,uz:true,rx:true,ry:true,rz:true}],
  materials:[
    {id:'S355',name:'Aço S355',type:'steel',E:200e6},
    {id:'C30',name:'Concreto C30',type:'concrete',E:30e6}
  ],
  sections:[
    {id:'I200',name:'Perfil I 200',family:'steel3d',ifcProfile:{ifcClass:'IfcIShapeProfileDef',profileName:'I200',overallWidth:.20,overallDepth:.30,webThickness:.01,flangeThickness:.02,filletRadius:.006}},
    {id:'SHELL180',name:'Casca 180 mm',family:'shell',t:.18}
  ],
  elements:[
    {id:'E1',type:'frame3d',n1:'N1',n2:'N2',materialId:'S355',sectionId:'I200'},
    {id:'S1',type:'shell4',n1:'N1',n2:'N2',n3:'N3',n4:'N4',materialId:'C30',sectionId:'SHELL180',thickness:.18}
  ]
};

const canonical=createIfcInteroperabilityModel(project,{analysisModelName:'Análise estrutural — round-trip'});
let seq=0;
const identity=createIfcIdentityMap(canonical,{uuidFactory:()=> (++seq).toString(16).padStart(32,'0')});
const model=assignIfcGlobalIds(canonical,{identityMap:identity});
const options={
  declarationGlobalId:compressIfcGuid('00000000-0000-0000-0000-0000000001fe'),
  groupGlobalId:compressIfcGuid('00000000-0000-0000-0000-0000000001ff'),
  materialAssociationGlobalIds:{
    E1:compressIfcGuid('00000000-0000-0000-0000-000000000200'),
    S1:compressIfcGuid('00000000-0000-0000-0000-000000000201')
  },
  ownerMetadata:{
    person:{identification:'roundtrip-ci',familyName:'CI',givenName:'AstraStruct'},
    organization:{identification:'ASTRASTRUCT-CI',name:'AstraStruct CI',description:'STEP round-trip benchmark'},
    application:{version:'0.45.0-exp',fullName:'AstraStruct',identifier:'ASTRASTRUCT'},
    creationDate:1789347000
  },
  fileName:'roundtrip-bench.ifc',timestamp:'2026-09-13T21:50:00-03:00'
};

const step=renderIfcStep(model,options),envelope=validateIfcStepEnvelope(step),raw=parseIfcStepEntities(step),parsed=parseIfcStructuralStep(step);
assert.equal(raw.contract,'ifc-step-parser/v1');
assert.equal(raw.schema,'IFC4X3_ADD2');
assert.equal(raw.entities.size,envelope.entities);
assert.equal(parsed.schema,'IFC4X3_ADD2');
assert.equal(parsed.project.name,'Pórtico misto — benchmark','SPF Unicode deve ser decodificado para o nome original');
assert.equal(parsed.analysisModel.name,'Análise estrutural — round-trip');
assert.equal(parsed.nodes.length,4);assert.equal(parsed.members.length,2);assert.equal(parsed.connections.length,6);assert.equal(parsed.materials.length,2);
assert.equal(parsed.owner.person.identification,'roundtrip-ci');
assert.equal(parsed.owner.organization.name,'AstraStruct CI');
assert.equal(parsed.owner.application.fullName,'AstraStruct');
assert.equal(parsed.owner.application.version,'0.45.0-exp');
assert.equal(parsed.owner.creationDate,1789347000);

const curve=model.members.find(x=>x.sourceId==='E1'),surface=model.members.find(x=>x.sourceId==='S1');
const curveParsed=parsed.members.find(x=>x.globalId===curve.globalId),surfaceParsed=parsed.members.find(x=>x.globalId===surface.globalId);
assert.equal(curveParsed.type,'curve');
assert.deepEqual(curveParsed.nodeGlobalIds,curve.nodeRefs.map(k=>model.nodes.find(n=>n.key===k).globalId));
assert.equal(surfaceParsed.type,'surface');assert.equal(surfaceParsed.predefinedType,'SHELL');assert.equal(surfaceParsed.thickness,.18);
assert.deepEqual(surfaceParsed.nodeGlobalIds,surface.nodeRefs.map(k=>model.nodes.find(n=>n.key===k).globalId));

const materialModes=parsed.materials.map(x=>x.mode).sort();
assert.deepEqual(materialModes,['DIRECT_MATERIAL','MATERIAL_PROFILE_SET']);
const profileAssociation=parsed.materials.find(x=>x.mode==='MATERIAL_PROFILE_SET');
assert.equal(profileAssociation.material.name,'Aço S355');
assert.equal(profileAssociation.material.category,'steel');
assert.equal(profileAssociation.profile.type,'IFCISHAPEPROFILEDEF');
assert.equal(profileAssociation.cardinalPoint,10);
const directAssociation=parsed.materials.find(x=>x.mode==='DIRECT_MATERIAL');
assert.equal(directAssociation.material.name,'Concreto C30');assert.equal(directAssociation.material.category,'concrete');

assert.deepEqual(validateIfcStructuralRoundTrip(model,parsed),{project:true,nodes:4,members:2,materialAssociations:2,owner:true});
assert.deepEqual(validateIfcStructuralRoundTrip(model,step),{project:true,nodes:4,members:2,materialAssociations:2,owner:true});

const n1Parsed=parsed.nodes.find(x=>x.globalId===model.nodes.find(x=>x.sourceId==='N1').globalId);
const pointPattern=new RegExp(`#${n1Parsed.pointEntityId}=IFCCARTESIANPOINT\\(\\(0\\.,0\\.,0\\.\\)\\);`);
const tamperedCoordinate=step.replace(pointPattern,`#${n1Parsed.pointEntityId}=IFCCARTESIANPOINT((0.125,0.,0.));`);
assert.notEqual(tamperedCoordinate,step,'benchmark precisa localizar a coordenada nodal para adulteração controlada');
assert.throws(()=>validateIfcStructuralRoundTrip(model,tamperedCoordinate),/coordenadas divergiram/);

const firstConnection=parsed.connections[0];
const brokenReference=step.replace(new RegExp(`(#${firstConnection.entityId}=IFCRELCONNECTSSTRUCTURALMEMBER\\([^\\n]+?,)(#\\d+)(,#\\d+,\\$,\\$,\\$,\\$\\);)`),`$1#999999$3`);
assert.notEqual(brokenReference,step,'benchmark precisa localizar uma referência estrutural para adulteração controlada');
assert.throws(()=>parseIfcStepEntities(brokenReference),/referencia #999999 inexistente/);

const duplicateGuid=step.replace(model.members.find(x=>x.sourceId==='S1').globalId,model.members.find(x=>x.sourceId==='E1').globalId);
assert.throws(()=>parseIfcStructuralStep(duplicateGuid),/GlobalId duplicado/);

console.log(`AstraStruct v0.45 IFC STEP round-trip smoke: ${envelope.entities} entities, Unicode, owner, curve/surface topology, material associations and tamper guards coherent.`);
