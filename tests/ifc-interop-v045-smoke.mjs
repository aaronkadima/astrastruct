import assert from 'node:assert/strict';
import {
  IFC_INTEROP_CONTRACT,IFC_INTEROP_VERSION,IFC_SCHEMA,IFC_STANDARD,
  ifcClassForElement,createIfcInteroperabilityModel,validateIfcInteroperabilityModel,
  renderIfcInteroperabilityJson,parseIfcInteroperabilityJson,restoreStructuralCoreFromIfcModel,summarizeIfcInteroperability,
  IFC_GUID_ALPHABET,validateIfcGuid,compressIfcGuid,expandIfcGuid,createIfcIdentityMap,assignIfcGlobalIds,validateIfcGlobalIds,
  IFC_CONTEXT_CONTRACT,unitsForAstraStruct,createIfcProjectContext,validateIfcProjectContext,
  summarizeIfcBoundaryNodeCondition
} from '../web/src/interop/index.js';

assert.equal(IFC_INTEROP_CONTRACT,'ifc-interoperability/v1');
assert.equal(IFC_INTEROP_VERSION,'0.45.0-exp');
assert.equal(IFC_SCHEMA,'IFC4X3_ADD2');
assert.equal(IFC_STANDARD,'ISO 16739-1:2024');
assert.equal(IFC_GUID_ALPHABET,'0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$');
assert.equal(IFC_CONTEXT_CONTRACT,'ifc-project-context/v1');
assert.equal(ifcClassForElement({type:'frame3d'}),'IfcStructuralCurveMember');
assert.equal(ifcClassForElement({type:'shell4'}),'IfcStructuralSurfaceMember');

// Public IfcOpenShell-compatible reference vector: UUID -> 22-character IFC GlobalId.
const referenceUuid='81b96203-fcdd-4046-921a-4f407ed029b7';
const referenceGuid='21kM83$Dr0Hf8QJq1_q2ct';
assert.equal(compressIfcGuid(referenceUuid),referenceGuid);
assert.equal(expandIfcGuid(referenceGuid,{hyphenated:true}),referenceUuid);
assert.equal(validateIfcGuid(referenceGuid),true);
assert.equal(validateIfcGuid(`4${referenceGuid.slice(1)}`),false,'primeiro dígito não pode exceder os 128 bits disponíveis');
assert.throws(()=>compressIfcGuid('not-a-uuid'),/128 bits/);
assert.throws(()=>expandIfcGuid('short'),/inválido/);

const units=unitsForAstraStruct('kN-m-MPa');
assert.equal(units.ifcClass,'IfcUnitAssignment');
assert.equal(units.units.find(x=>x.unitType==='LENGTHUNIT').name,'METRE');
assert.deepEqual(units.units.find(x=>x.unitType==='FORCEUNIT'),{key:'unit:force',ifcClass:'IfcSIUnit',unitType:'FORCEUNIT',name:'NEWTON',prefix:'KILO'});
assert.deepEqual(units.units.find(x=>x.unitType==='PRESSUREUNIT'),{key:'unit:pressure',ifcClass:'IfcSIUnit',unitType:'PRESSUREUNIT',name:'PASCAL',prefix:'MEGA'});
assert.throws(()=>unitsForAstraStruct('kip-ft-ksi'),/não suportado/);
const contextProbe=createIfcProjectContext({unitSystem:'kN-m-MPa',precision:1e-5,origin:[100,200,0]});
assert.equal(validateIfcProjectContext(contextProbe),true);
assert.equal(contextProbe.representationContexts[0].ifcClass,'IfcGeometricRepresentationContext');
assert.equal(contextProbe.representationContexts[0].coordinateSpaceDimension,3);
assert.deepEqual(contextProbe.representationContexts[0].worldCoordinateSystem.location,[100,200,0]);
assert.deepEqual(contextProbe.subContexts.map(x=>x.contextIdentifier),['Body','Axis']);

const project={
  id:'IFC-BENCH-001',name:'Pórtico + casca benchmark',units:'kN-m-MPa',schemaVersion:2,meta:{productVersion:'0.44.0'},
  nodes:[
    {id:'N1',x:0,y:0,z:0},{id:'N2',x:4,y:0,z:0},{id:'N3',x:4,y:3,z:0},{id:'N4',x:0,y:3,z:0}
  ],
  materials:[
    {id:'steel355',name:'Steel 355',type:'steel',E:200e6,nu:.3,density:78.5},
    {id:'concrete30',name:'Concrete C30',type:'concrete',E:30e6,nu:.2,density:25}
  ],
  sections:[
    {id:'S-BEAM',name:'Beam section',family:'steel3d',A:.012,Iy:.00018,Iz:.00022,J:.00003},
    {id:'S-SHELL',name:'Shell thickness',family:'shell',t:.18}
  ],
  supports:[{id:'SUP-N1',nodeId:'N1',ux:true,uy:true,uz:true,rx:true,ry:true,rz:true}],
  nodeSprings:[{id:'SPR-N2',nodeId:'N2',kx:5000,ky:0,kz:10000,krz:250}],
  elements:[
    {id:'E1',type:'frame3d',n1:'N1',n2:'N2',materialId:'steel355',sectionId:'S-BEAM'},
    {id:'E2',type:'shell4',n1:'N1',n2:'N2',n3:'N3',n4:'N4',materialId:'concrete30',sectionId:'S-SHELL',thickness:.18}
  ]
};

const model=createIfcInteroperabilityModel(project,{analysisModelName:'Benchmark analysis model',purpose:'STRUCTURAL_ANALYSIS',provenance:{benchmark:'ifc-v045'}});
assert.equal(validateIfcInteroperabilityModel(model),true);
assert.equal(model.schema,'IFC4X3_ADD2');
assert.equal(model.project.ifcClass,'IfcProject');
assert.equal(model.analysisModel.ifcClass,'IfcStructuralAnalysisModel');
assert.equal(model.context.contract,'ifc-project-context/v1');
assert.equal(model.project.unitsInContextRef,'context:units');
assert.deepEqual(model.project.representationContextRefs,['context:model3d']);
assert.equal(model.context.representationContexts[0].precision,1e-6);
assert.equal(model.nodes.length,4);assert.equal(model.members.length,2);assert.equal(model.relationships.length,6);
const n1=model.nodes.find(x=>x.sourceId==='N1'),n2=model.nodes.find(x=>x.sourceId==='N2');
assert.equal(n1.ifcClass,'IfcStructuralPointConnection');
assert.equal(n1.condition.ifcClass,'IfcBoundaryNodeCondition');
assert.deepEqual(summarizeIfcBoundaryNodeCondition(n1.condition),{fixed:6,released:0,springs:0});
assert.equal(n1.condition.translationalStiffnessX,true);
assert.equal(n1.condition.rotationalStiffnessZ,true);
assert.deepEqual(summarizeIfcBoundaryNodeCondition(n2.condition),{fixed:0,released:3,springs:3});
assert.equal(n2.condition.translationalStiffnessX,5000);
assert.equal(n2.condition.translationalStiffnessY,false);
assert.equal(n2.condition.translationalStiffnessZ,10000);
assert.equal(n2.condition.rotationalStiffnessZ,250);
assert.equal(model.members.find(x=>x.sourceId==='E1').ifcClass,'IfcStructuralCurveMember');
assert.equal(model.members.find(x=>x.sourceId==='E2').ifcClass,'IfcStructuralSurfaceMember');
assert.equal(model.members.find(x=>x.sourceId==='E2').nodeRefs.length,4);
assert.equal(model.exchange.stepWriterReady,false);
assert.ok(model.limitations.some(x=>x.includes('STEP')));

const json=renderIfcInteroperabilityJson(model),parsed=parseIfcInteroperabilityJson(json),summary=summarizeIfcInteroperability(parsed);
assert.deepEqual(summary,{schema:'IFC4X3_ADD2',projectId:'IFC-BENCH-001',nodes:4,members:2,curves:1,surfaces:1,materials:2,sections:2,relationships:6,stepWriterReady:false});
const restored=restoreStructuralCoreFromIfcModel(parsed);
assert.equal(restored.id,project.id);assert.equal(restored.nodes.length,4);assert.equal(restored.elements.length,2);
assert.equal(restored.elements.find(x=>x.id==='E1').n2,'N2');
assert.equal(restored.elements.find(x=>x.id==='E2').n4,'N4');
assert.equal(restored.elements.find(x=>x.id==='E2').materialId,'concrete30');
assert.equal(restored.elements.find(x=>x.id==='E2').sectionId,'S-SHELL');

// Identities are created once, attached to IfcRoot-like records, serialized, and must then remain unchanged.
let identitySequence=0;
const identityMap=createIfcIdentityMap(model,{uuidFactory:()=> (++identitySequence).toString(16).padStart(32,'0')});
assert.equal(identityMap.contract,'ifc-identity-map/v1');
assert.equal(Object.keys(identityMap.ids).length,14);
const identified=assignIfcGlobalIds(model,{identityMap});
assert.equal(validateIfcGlobalIds(identified),true);
assert.equal(identified.identity.persistent,true);
assert.equal(identified.identity.count,14);
assert.equal(identified.project.globalId,identityMap.ids['project:IFC-BENCH-001']);
assert.equal(identified.members.find(x=>x.sourceId==='E1').globalId,identityMap.ids['member:E1']);
const identifiedParsed=parseIfcInteroperabilityJson(renderIfcInteroperabilityJson(identified));
assert.equal(validateIfcGlobalIds(identifiedParsed),true);
assert.equal(identifiedParsed.project.globalId,identified.project.globalId,'GlobalId deve sobreviver ao round-trip sem regeneração');
assert.throws(()=>assignIfcGlobalIds(model,{}),/GlobalId ausente/);
const duplicateMap={...identityMap,ids:{...identityMap.ids,'member:E1':identityMap.ids['node:N1']}};
assert.throws(()=>assignIfcGlobalIds(model,{identityMap:duplicateMap}),/duplicado/);

assert.throws(()=>createIfcInteroperabilityModel({...project,elements:[{id:'BAD',type:'frame3d',n1:'N1',n2:'NX'}]}),/nó inexistente NX/);
assert.throws(()=>createIfcInteroperabilityModel({...project,elements:[{id:'BAD',type:'frame3d',n1:'N1',n2:'N2',materialId:'ghost'}]}),/material inexistente/);
assert.throws(()=>createIfcInteroperabilityModel({...project,units:'kip-ft-ksi'}),/não suportado/);

console.log('AstraStruct v0.45 IFC interop smoke: IFC4X3 mapping, units/context, boundary conditions, GlobalId persistence, connectivity, provenance and canonical JSON round-trip coherent.');
