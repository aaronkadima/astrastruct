import assert from 'node:assert/strict';
import {
  IFC_INTEROP_CONTRACT,IFC_INTEROP_VERSION,IFC_SCHEMA,IFC_STANDARD,
  ifcClassForElement,createIfcInteroperabilityModel,validateIfcInteroperabilityModel,
  renderIfcInteroperabilityJson,parseIfcInteroperabilityJson,restoreStructuralCoreFromIfcModel,summarizeIfcInteroperability
} from '../web/src/interop/index.js';

assert.equal(IFC_INTEROP_CONTRACT,'ifc-interoperability/v1');
assert.equal(IFC_INTEROP_VERSION,'0.45.0-exp');
assert.equal(IFC_SCHEMA,'IFC4X3_ADD2');
assert.equal(IFC_STANDARD,'ISO 16739-1:2024');
assert.equal(ifcClassForElement({type:'frame3d'}),'IfcStructuralCurveMember');
assert.equal(ifcClassForElement({type:'shell4'}),'IfcStructuralSurfaceMember');

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
assert.equal(model.nodes.length,4);assert.equal(model.members.length,2);assert.equal(model.relationships.length,6);
assert.equal(model.nodes[0].ifcClass,'IfcStructuralPointConnection');
assert.equal(model.nodes[0].condition.ifcClass,'IfcBoundaryNodeCondition');
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

assert.throws(()=>createIfcInteroperabilityModel({...project,elements:[{id:'BAD',type:'frame3d',n1:'N1',n2:'NX'}]}),/nó inexistente NX/);
assert.throws(()=>createIfcInteroperabilityModel({...project,elements:[{id:'BAD',type:'frame3d',n1:'N1',n2:'N2',materialId:'ghost'}]}),/material inexistente/);

console.log('AstraStruct v0.45 IFC interop smoke: IFC4X3 structural mapping, connectivity, provenance and canonical JSON round-trip coherent.');
