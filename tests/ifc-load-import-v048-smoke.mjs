import assert from 'node:assert/strict';
import {prepareIfcExchange,createIfcImportStaging,validateIfcImportStaging,summarizeIfcImportStaging,compressIfcGuid,IFC_IMPORT_STAGING_VERSION} from '../web/src/interop/index.js';

const project={
  id:'LOAD-IMPORT-SOURCE',name:'IFC load import source',units:'kN-m-MPa',schemaVersion:2,
  nodes:[{id:'N1',x:0,y:0,z:0},{id:'N2',x:4,y:0,z:0},{id:'N3',x:8,y:0,z:0}],
  materials:[{id:'S355',name:'Steel S355',type:'steel',E:200e6,nu:.3,fy:355,fu:510}],
  sections:[{id:'R',name:'R 300x500',family:'rect',b:.30,h:.50,A:.15,Iy:.003125,Iz:.001125,J:.001}],
  elements:[{id:'E1',name:'Beam A',type:'frame3d',n1:'N1',n2:'N2',materialId:'S355',sectionId:'R'},{id:'E2',name:'Beam B',type:'frame3d',n1:'N2',n2:'N3',materialId:'S355',sectionId:'R'}],
  supports:[],nodeSprings:[],settlements:[],
  loadCases:[{id:'G',name:'Permanent',type:'permanent'},{id:'Q',name:'Variable',type:'variable'}],
  loads:[{id:'LG',name:'Permanent node force',caseId:'G',nodeId:'N2',fx:0,fy:-30,fz:-5,mx:1,my:0,mz:2},{id:'LQ',name:'Variable node force',caseId:'Q',nodeId:'N3',fx:25,fy:0,fz:0,mx:0,my:0,mz:0}],
  elementLoads:[{id:'EG',name:'Permanent line load',caseId:'G',elementId:'E1',kind:'uniform',qx:2,qy:-8,qz:-3}],
  loadCombinations:[{id:'ULS',name:'ULS',type:'custom',terms:[{caseId:'G',factor:1.2},{caseId:'Q',factor:1.5}]}],
  meta:{productVersion:'0.47.0'}
};

let sequence=9000;const guidFactory=()=>compressIfcGuid((++sequence).toString(16).padStart(32,'0'));
const ownerMetadata={person:{identification:'load-import-ci',familyName:'CI',givenName:'AstraStruct'},organization:{identification:'ASTRASTRUCT',name:'AstraStruct'},application:{version:'0.47.0',fullName:'AstraStruct',identifier:'ASTRASTRUCT'}};
const source=prepareIfcExchange(project,{guidFactory,ownerMetadata,timestamp:'2026-09-14T01:30:00-03:00',fileName:'load-import-source.ifc'});
const staging=createIfcImportStaging(source.step,{projectId:'IMPORTED-V048',projectName:'Imported v0.48'});

assert.equal(IFC_IMPORT_STAGING_VERSION,'0.48.0-exp');assert.equal(validateIfcImportStaging(staging),true);
assert.equal(staging.readiness.geometryReady,true);assert.equal(staging.readiness.loadReady,true);assert.equal(staging.readiness.commitReady,true);assert.equal(staging.readiness.analysisReady,true);
assert.deepEqual(summarizeIfcImportStaging(staging),{nodes:3,elements:2,curves:2,surfaces:0,materials:1,sections:1,supports:0,nodeSprings:0,loadCases:2,loadCombinations:1,nodalLoads:2,elementLoads:1,loadBlocking:0,geometryBlocking:0,analysisBlocking:0,schema:'IFC4X3_ADD2',geometryReady:true,loadReady:true,commitReady:true,analysisReady:true});

const imported=staging.project;
assert.deepEqual(imported.loadCases.map(x=>x.id),['IFC_LC_1','IFC_LC_2']);assert.deepEqual(imported.loadCases.map(x=>x.name),['Permanent','Variable']);assert.deepEqual(imported.loadCases.map(x=>x.type),['permanent','variable']);
assert.equal(imported.loads.length,2);assert.equal(imported.elementLoads.length,1);assert.equal(imported.loadCombinations.length,1);
const lg=imported.loads.find(x=>x.name==='Permanent node force'),lq=imported.loads.find(x=>x.name==='Variable node force'),eg=imported.elementLoads[0],uls=imported.loadCombinations[0];
assert.ok(lg&&lq);assert.deepEqual([lg.fx,lg.fy,lg.fz,lg.mx,lg.my,lg.mz],[0,-30,-5,1,0,2]);assert.deepEqual([lq.fx,lq.fy,lq.fz],[25,0,0]);assert.equal(lg.nodeId,imported.nodes.find(x=>x.name==='N2')?.id);assert.equal(lq.nodeId,imported.nodes.find(x=>x.name==='N3')?.id);
assert.equal(eg.kind,'uniform');assert.deepEqual([eg.qx,eg.qy,eg.qz],[2,-8,-3]);assert.equal(eg.elementId,imported.elements.find(x=>x.name==='Beam A')?.id);
assert.deepEqual(uls.terms,[{caseId:'IFC_LC_1',factor:1.2,ifcRelationGlobalId:source.state.loadGlobalIds['rel-load-factor:ULS:G']},{caseId:'IFC_LC_2',factor:1.5,ifcRelationGlobalId:source.state.loadGlobalIds['rel-load-factor:ULS:Q']}]);

const seed=imported.ifcImport.exchangeStateSeed;
assert.equal(seed.projectId,'IMPORTED-V048');assert.equal(seed.ids['project:IMPORTED-V048'],source.canonical.project.globalId);assert.equal(seed.ids['analysis:IMPORTED-V048'],source.canonical.analysisModel.globalId);
assert.equal(seed.loadGlobalIds['load-case:IFC_LC_1'],source.state.loadGlobalIds['load-case:G']);assert.equal(seed.loadGlobalIds['load-case:IFC_LC_2'],source.state.loadGlobalIds['load-case:Q']);assert.equal(seed.loadGlobalIds['load-combination:IFC_COMB_1'],source.state.loadGlobalIds['load-combination:ULS']);
assert.equal(seed.loadGlobalIds[`load-action:${lg.id}`],source.state.loadGlobalIds['load-action:LG']);assert.equal(seed.loadGlobalIds[`load-action:${eg.id}`],source.state.loadGlobalIds['load-action:EG']);
assert.equal(seed.declarationGlobalId,source.state.declarationGlobalId);assert.equal(seed.groupGlobalId,source.state.groupGlobalId);assert.equal(seed.creationDate,source.state.creationDate);

const reexported=prepareIfcExchange(imported,{state:seed,guidFactory,ownerMetadata,timestamp:'2026-09-14T01:31:00-03:00',fileName:'load-import-reexport.ifc'});
assert.equal(reexported.canonical.project.globalId,source.canonical.project.globalId);assert.equal(reexported.canonical.analysisModel.globalId,source.canonical.analysisModel.globalId);
assert.equal(reexported.state.loadGlobalIds['load-case:IFC_LC_1'],source.state.loadGlobalIds['load-case:G']);assert.equal(reexported.state.loadGlobalIds['load-case:IFC_LC_2'],source.state.loadGlobalIds['load-case:Q']);assert.equal(reexported.state.loadGlobalIds['load-combination:IFC_COMB_1'],source.state.loadGlobalIds['load-combination:ULS']);
assert.equal(reexported.state.loadGlobalIds[`load-action:${lg.id}`],source.state.loadGlobalIds['load-action:LG']);assert.equal(reexported.state.loadGlobalIds[`rel-load-case:${lg.id}`],source.state.loadGlobalIds['rel-load-case:LG']);assert.equal(reexported.state.loadGlobalIds[`rel-load-activity:${lg.id}`],source.state.loadGlobalIds['rel-load-activity:LG']);assert.equal(reexported.state.loadGlobalIds['rel-load-factor:IFC_COMB_1:IFC_LC_1'],source.state.loadGlobalIds['rel-load-factor:ULS:G']);
assert.equal(reexported.state.creationDate,source.state.creationDate);

console.log('AstraStruct v0.48 IFC load import smoke: load cases/actions/combinations reconstruct and re-export with source GlobalIds preserved.');
