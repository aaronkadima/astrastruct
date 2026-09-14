import assert from 'node:assert/strict';
import {compressIfcGuid,prepareIfcExchange,createIfcImportStaging,validateIfcImportStaging,summarizeIfcImportStaging,IFC_IMPORT_STAGING_CONTRACT,IFC_IMPORT_STAGING_VERSION} from '../web/src/interop/index.js';

const project={
  id:'IFC-IMPORT-V046',name:'Importação IFC v0.46',units:'kN-m-MPa',schemaVersion:2,meta:{productVersion:'0.45.0'},
  nodes:[{id:'N1',x:0,y:0,z:0},{id:'N2',x:4,y:0,z:0},{id:'N3',x:4,y:3,z:0},{id:'N4',x:0,y:3,z:0}],
  materials:[{id:'steel355',name:'Steel S355',type:'steel',E:200e6,nu:.3,density:78.5},{id:'concrete30',name:'Concrete C30',type:'concrete',E:30e6,nu:.2,density:25}],
  sections:[{id:'R30x50',name:'R 30x50',family:'rect',b:.30,h:.50,A:.15,Iy:.003125,Iz:.001125,J:.001},{id:'SHELL18',name:'Shell 18 cm',family:'shell',t:.18}],
  supports:[{id:'SUP1',nodeId:'N1',ux:true,uy:true,uz:true,rx:true,ry:true,rz:true}],
  nodeSprings:[{id:'SPR2',nodeId:'N2',kx:5000,ky:0,kz:0,krx:0,kry:0,krz:250}],
  elements:[{id:'E_FRAME',type:'frame3d',n1:'N1',n2:'N2',materialId:'steel355',sectionId:'R30x50'},{id:'E_SHELL',type:'shell4',n1:'N1',n2:'N2',n3:'N3',n4:'N4',nodeIds:['N1','N2','N3','N4'],materialId:'concrete30',sectionId:'SHELL18',thickness:.18}]
};
let sequence=3000;const guidFactory=()=>compressIfcGuid((++sequence).toString(16).padStart(32,'0'));
const ownerMetadata={person:{identification:'import-ci',familyName:'CI',givenName:'AstraStruct'},organization:{identification:'ASTRASTRUCT',name:'AstraStruct'},application:{version:'0.45.0-exp',fullName:'AstraStruct',identifier:'ASTRASTRUCT'}};
const exported=prepareIfcExchange(project,{guidFactory,ownerMetadata,timestamp:'2026-09-13T23:30:00-03:00',fileName:'import-v046.ifc'});
const stage=createIfcImportStaging(exported.step);

assert.equal(stage.contract,IFC_IMPORT_STAGING_CONTRACT);assert.equal(stage.version,IFC_IMPORT_STAGING_VERSION);assert.equal(stage.schema,'IFC4X3_ADD2');
assert.equal(stage.readiness.geometryReady,true);assert.equal(stage.readiness.analysisReady,false,'propriedades mecânicas não devem ser inventadas pelo importador');
assert.equal(validateIfcImportStaging(stage),true);assert.throws(()=>validateIfcImportStaging(stage,{requireAnalysisReady:true}),/análise possui/);
assert.deepEqual(summarizeIfcImportStaging(stage),{nodes:4,elements:2,curves:1,surfaces:1,materials:2,sections:2,supports:1,nodeSprings:1,geometryBlocking:0,analysisBlocking:3,schema:'IFC4X3_ADD2',geometryReady:true,analysisReady:false});
assert.equal(stage.project.nodes.find(x=>x.id==='N1').ifcGlobalId,exported.canonical.nodes.find(x=>x.sourceId==='N1').globalId);
assert.equal(stage.project.elements.find(x=>x.id==='E_FRAME').type,'frame3d');
assert.equal(stage.project.elements.find(x=>x.id==='E_SHELL').type,'shell4');
assert.equal(stage.project.elements.find(x=>x.id==='E_SHELL').thickness,.18);
assert.equal(stage.project.supports[0].nodeId,'N1');assert.equal(stage.project.supports[0].rz,true);
assert.equal(stage.project.nodeSprings[0].nodeId,'N2');assert.equal(stage.project.nodeSprings[0].kx,5000);assert.equal(stage.project.nodeSprings[0].krz,250);
assert.ok(stage.project.sections.find(x=>x.id==='R_30x50')?.ifcProfile,'perfil explícito deve sobreviver ao staging');
assert.equal(stage.project.materials.find(x=>x.id==='Steel_S355').E,null,'E não pode ser inferido de nome/categoria');
assert.ok(stage.readiness.analysisIssues.some(x=>x.code==='YOUNG_MODULUS_MISSING'));

const pinStep=exported.step.replace('.RIGID_JOINED_MEMBER.','.PIN_JOINED_MEMBER.');
const pinStage=createIfcImportStaging(pinStep);
assert.equal(pinStage.readiness.geometryReady,true);assert.equal(pinStage.project.elements.find(x=>x.id==='E_FRAME').type,'truss3d','PIN_JOINED_MEMBER deve importar como barra axial');

const unsupportedStep=exported.step.replace('.RIGID_JOINED_MEMBER.','.CABLE.');
const unsupported=createIfcImportStaging(unsupportedStep);
assert.equal(unsupported.readiness.geometryReady,false);assert.ok(unsupported.readiness.geometryIssues.some(x=>x.code==='CURVE_PREDEFINED_TYPE_UNSUPPORTED'));
assert.throws(()=>validateIfcImportStaging(unsupported),/geometria possui/);

console.log('AstraStruct v0.46 IFC import staging smoke: geometry, GlobalIds, supports/springs, member semantics and conservative analysis readiness coherent.');
