import assert from 'node:assert/strict';
import {prepareIfcExchange,compressIfcGuid,parseIfcStepEntities,extractIfcStructuralLoads,IFC_STEP_LOAD_PARSE_CONTRACT,IFC_STEP_LOAD_PARSE_VERSION} from '../web/src/interop/index.js';

const project={
  id:'LOAD-PARSE-V048',name:'Load parser v0.48',units:'kN-m-MPa',schemaVersion:2,
  nodes:[{id:'N1',x:0,y:0,z:0},{id:'N2',x:4,y:0,z:0},{id:'N3',x:8,y:0,z:0}],
  materials:[{id:'S355',name:'Steel S355',type:'steel',E:200e6,nu:.3,fy:355,fu:510}],
  sections:[{id:'R',name:'R 300x500',family:'rect',b:.30,h:.50,A:.15,Iy:.003125,Iz:.001125,J:.001}],
  elements:[{id:'E1',type:'frame3d',n1:'N1',n2:'N2',materialId:'S355',sectionId:'R'},{id:'E2',type:'frame3d',n1:'N2',n2:'N3',materialId:'S355',sectionId:'R'}],
  supports:[],nodeSprings:[],settlements:[],
  loadCases:[{id:'G',name:'Permanent',type:'permanent'},{id:'Q',name:'Variable',type:'variable'}],
  loads:[{id:'LG',caseId:'G',nodeId:'N2',fx:0,fy:-30,fz:-5,mx:1,my:0,mz:2},{id:'LQ',caseId:'Q',nodeId:'N3',fx:25,fy:0,fz:0,mx:0,my:0,mz:0}],
  elementLoads:[{id:'EG',caseId:'G',elementId:'E1',kind:'uniform',qx:2,qy:-8,qz:-3}],
  loadCombinations:[{id:'ULS',name:'ULS',type:'custom',terms:[{caseId:'G',factor:1.2},{caseId:'Q',factor:1.5}]}]
};

let seq=7000;const guidFactory=()=>compressIfcGuid((++seq).toString(16).padStart(32,'0'));
const ownerMetadata={person:{identification:'load-parser-ci',familyName:'CI',givenName:'AstraStruct'},organization:{identification:'ASTRASTRUCT',name:'AstraStruct'},application:{version:'0.47.0',fullName:'AstraStruct',identifier:'ASTRASTRUCT'}};
const exported=prepareIfcExchange(project,{guidFactory,ownerMetadata,timestamp:'2026-09-14T01:00:00-03:00',fileName:'load-parse-v048.ifc'});
const generic=parseIfcStepEntities(exported.step),parsed=extractIfcStructuralLoads(generic);

assert.equal(parsed.contract,IFC_STEP_LOAD_PARSE_CONTRACT);assert.equal(parsed.version,IFC_STEP_LOAD_PARSE_VERSION);assert.equal(parsed.ready,true);assert.equal(parsed.issues.length,0);
assert.deepEqual(parsed.summary,{loadCases:2,loadCombinations:1,actions:3,pointActions:2,linearActions:1,caseAssignments:3,combinationFactors:2,activityConnections:3,blocking:0});
assert.equal(parsed.loadedByGlobalIds.length,1);assert.equal(parsed.loadedByGlobalIds[0],exported.state.loadGlobalIds['load-combination:ULS']);

const G=parsed.loadCases.find(x=>x.name==='Permanent'),Q=parsed.loadCases.find(x=>x.name==='Variable'),ULS=parsed.loadCombinations[0];
assert.equal(G.globalId,exported.state.loadGlobalIds['load-case:G']);assert.equal(Q.globalId,exported.state.loadGlobalIds['load-case:Q']);assert.equal(ULS.globalId,exported.state.loadGlobalIds['load-combination:ULS']);
assert.equal(G.actionType,'PERMANENT_G');assert.equal(Q.actionType,'VARIABLE_Q');assert.deepEqual(ULS.terms.map(x=>x.factor).sort(),[1.2,1.5]);

const LG=parsed.actions.find(x=>x.name==='LG'),LQ=parsed.actions.find(x=>x.name==='LQ'),EG=parsed.actions.find(x=>x.name==='EG');
assert.equal(LG.globalId,exported.state.loadGlobalIds['load-action:LG']);assert.equal(LQ.globalId,exported.state.loadGlobalIds['load-action:LQ']);assert.equal(EG.globalId,exported.state.loadGlobalIds['load-action:EG']);
assert.equal(LG.ifcClass,'IfcStructuralPointAction');assert.equal(LG.globalOrLocal,'GLOBAL_COORDS');assert.deepEqual([LG.appliedLoad.forceX,LG.appliedLoad.forceY,LG.appliedLoad.forceZ,LG.appliedLoad.momentX,LG.appliedLoad.momentY,LG.appliedLoad.momentZ],[0,-30,-5,1,0,2]);
assert.equal(EG.ifcClass,'IfcStructuralLinearAction');assert.equal(EG.globalOrLocal,'LOCAL_COORDS');assert.equal(EG.predefinedType,'CONST');assert.deepEqual([EG.appliedLoad.linearForceX,EG.appliedLoad.linearForceY,EG.appliedLoad.linearForceZ],[2,-8,-3]);
assert.ok(LG.caseEntityId);assert.ok(LG.targetEntityId);assert.equal(LG.targetType,'IFCSTRUCTURALPOINTCONNECTION');assert.equal(EG.targetType,'IFCSTRUCTURALCURVEMEMBER');
assert.equal(LG.caseAssignmentGlobalId,exported.state.loadGlobalIds['rel-load-case:LG']);assert.equal(LG.activityConnectionGlobalId,exported.state.loadGlobalIds['rel-load-activity:LG']);
const factorG=parsed.relationships.combinationFactors.find(x=>x.factor===1.2);assert.equal(factorG.relationGlobalId,exported.state.loadGlobalIds['rel-load-factor:ULS:G']);

console.log('AstraStruct v0.48 IFC load parser smoke: STEP load hierarchy, targets, factors, LoadedBy and persistent GlobalIds round-trip coherently.');
