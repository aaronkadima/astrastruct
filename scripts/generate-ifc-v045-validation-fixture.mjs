import {mkdir,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {
  createIfcInteroperabilityModel,createIfcIdentityMap,assignIfcGlobalIds,compressIfcGuid,
  renderIfcStep,validateIfcStepEnvelope,parseIfcStructuralStep,validateIfcStructuralRoundTrip
} from '../web/src/interop/index.js';
import {PRODUCT_VERSION} from '../web/src/core/version.js';

const output=resolve(process.argv[2]||'artifacts/ifc/astrastruct-v045-validation.ifc');
const project={
  id:'IFC-EXTERNAL-VALIDATION',name:'AstraStruct IFC4X3 — external validation',units:'kN-m-MPa',schemaVersion:2,
  nodes:[
    {id:'N1',x:0,y:0,z:0},
    {id:'N2',x:0,y:0,z:3},
    {id:'N3',x:2,y:0,z:3},
    {id:'N4',x:2,y:0,z:0}
  ],
  supports:[{id:'SUP-N1',nodeId:'N1',ux:true,uy:true,uz:true,rx:true,ry:true,rz:true}],
  nodeSprings:[{id:'SPR-N2',nodeId:'N2',kx:7500,kz:12000,krz:300}],
  materials:[
    {id:'S355',name:'Steel S355',type:'steel',E:200e6,nu:.3,fy:355,fu:510},
    {id:'C30',name:'Concrete C30',type:'concrete',E:30e6,nu:.2,fck:30,fctm:2.9}
  ],
  sections:[
    {id:'I200',name:'I 200 validation profile',family:'steel3d',ifcProfile:{ifcClass:'IfcIShapeProfileDef',profileName:'I200-VALIDATION',overallWidth:.20,overallDepth:.30,webThickness:.01,flangeThickness:.02,filletRadius:.006}},
    {id:'SHELL180',name:'Shell 180 mm',family:'shell',t:.18}
  ],
  elements:[
    {id:'E1',type:'frame3d',n1:'N1',n2:'N2',materialId:'S355',sectionId:'I200'},
    {id:'S1',type:'shell4',n1:'N1',n2:'N2',n3:'N3',n4:'N4',materialId:'C30',sectionId:'SHELL180',thickness:.18}
  ]
};

const canonical=createIfcInteroperabilityModel(project,{analysisModelName:'AstraStruct IFC4X3 external validation model'});
let sequence=0;
const identityMap=createIfcIdentityMap(canonical,{uuidFactory:()=> (++sequence).toString(16).padStart(32,'0')});
const model=assignIfcGlobalIds(canonical,{identityMap});
const options={
  declarationGlobalId:compressIfcGuid('00000000-0000-0000-0000-0000000002fe'),
  groupGlobalId:compressIfcGuid('00000000-0000-0000-0000-0000000002ff'),
  materialAssociationGlobalIds:{
    E1:compressIfcGuid('00000000-0000-0000-0000-000000000300'),
    S1:compressIfcGuid('00000000-0000-0000-0000-000000000301')
  },
  ownerMetadata:{
    person:{identification:'astrastruct-ci',familyName:'CI',givenName:'AstraStruct'},
    organization:{identification:'ASTRASTRUCT',name:'AstraStruct',description:'IFC4X3 external validation fixture'},
    application:{version:PRODUCT_VERSION,fullName:'AstraStruct',identifier:'ASTRASTRUCT'},
    creationDate:1789347600
  },
  fileName:'astrastruct-v045-validation.ifc',timestamp:'2026-09-13T22:00:00-03:00'
};

const step=renderIfcStep(model,options),envelope=validateIfcStepEnvelope(step),parsed=parseIfcStructuralStep(step),roundTrip=validateIfcStructuralRoundTrip(model,parsed);
if(!envelope.hasCurveMembers||!envelope.hasSurfaceMembers||!envelope.hasMaterialAssociations||!envelope.hasOwnerHistory)throw new Error('IFC validation fixture: envelope incompleto.');
if(!step.includes("Pset_MaterialSteel")||!step.includes("Pset_MaterialConcrete"))throw new Error('IFC validation fixture: property sets resistentes v0.47 ausentes.');
if(roundTrip.nodes!==4||roundTrip.members!==2||roundTrip.materialAssociations!==2)throw new Error('IFC validation fixture: round-trip interno incompleto.');
await mkdir(dirname(output),{recursive:true});
await writeFile(output,step,'utf8');
console.log(JSON.stringify({output,schema:envelope.schema,productVersion:PRODUCT_VERSION,entities:envelope.entities,nodes:roundTrip.nodes,members:roundTrip.members,materialAssociations:roundTrip.materialAssociations,materialStrengthPsets:true},null,2));
