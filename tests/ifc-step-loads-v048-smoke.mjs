import assert from 'node:assert/strict';
import {prepareIfcExchange,compressIfcGuid,IFC_STEP_LOAD_CONTRACT,IFC_STEP_LOAD_VERSION,IFC_STEP_WRITER_VERSION} from '../web/src/interop/index.js';

const project={
  id:'STEP-LOADS-V048',name:'AstraStruct IFC load exchange v0.48',units:'kN-m-MPa',schemaVersion:2,
  nodes:[{id:'N1',x:0,y:0,z:0},{id:'N2',x:4,y:0,z:0},{id:'N3',x:8,y:0,z:0}],
  materials:[{id:'S355',name:'Steel S355',type:'steel',E:200e6,nu:.3,fy:355,fu:510}],
  sections:[{id:'R',name:'R 300x500',family:'rect',b:.30,h:.50,A:.15,Iy:.003125,Iz:.001125,J:.001}],
  elements:[
    {id:'E1',type:'frame3d',n1:'N1',n2:'N2',materialId:'S355',sectionId:'R'},
    {id:'E2',type:'frame3d',n1:'N2',n2:'N3',materialId:'S355',sectionId:'R'}
  ],
  supports:[],nodeSprings:[],
  loadCases:[{id:'G',name:'Permanent',type:'permanent'},{id:'Q',name:'Variable',type:'variable'}],
  loads:[
    {id:'LG',caseId:'G',nodeId:'N2',fx:0,fy:-30,fz:-5,mx:1,my:0,mz:2},
    {id:'LQ',caseId:'Q',nodeId:'N3',fx:25,fy:0,fz:0,mx:0,my:0,mz:0}
  ],
  elementLoads:[{id:'EG',caseId:'G',elementId:'E1',kind:'uniform',qx:2,qy:-8,qz:-3}],
  loadCombinations:[{id:'ULS',name:'ULS',type:'custom',terms:[{caseId:'G',factor:1.2},{caseId:'Q',factor:1.5}]}],
  settlements:[],meta:{productVersion:'0.47.0'}
};

let sequence=5000;
const guidFactory=()=>compressIfcGuid((++sequence).toString(16).padStart(32,'0'));
const ownerMetadata={person:{identification:'ifc-load-ci',familyName:'CI',givenName:'AstraStruct'},organization:{identification:'ASTRASTRUCT',name:'AstraStruct'},application:{version:'0.47.0',fullName:'AstraStruct',identifier:'ASTRASTRUCT'}};
const first=prepareIfcExchange(project,{state:null,guidFactory,ownerMetadata,timestamp:'2026-09-14T00:30:00-03:00',fileName:'loads-v048.ifc'});

assert.equal(IFC_STEP_LOAD_CONTRACT,'ifc-step-loads/v1');assert.equal(IFC_STEP_LOAD_VERSION,'0.48.0-exp');assert.equal(IFC_STEP_WRITER_VERSION,'0.48.0-exp');
assert.equal(first.loadMapping.ready,true);assert.equal(first.readiness.loadSummary.loadCases,2);assert.equal(first.readiness.loadSummary.loadCombinations,1);assert.equal(first.readiness.loadSummary.actions,3);assert.equal(first.readiness.loadSummary.rootCount,14);
assert.equal(Object.keys(first.state.loadGlobalIds).length,14);assert.deepEqual(first.readiness.loadSummary.topLevelKeys,['load-combination:ULS']);
assert.equal(first.envelope.hasLoadCases,true);assert.equal(first.envelope.hasLoadGroups,true);assert.equal(first.envelope.hasPointActions,true);assert.equal(first.envelope.hasLinearActions,true);assert.equal(first.envelope.hasStructuralActivityConnections,true);assert.equal(first.envelope.hasFactoredLoadGroups,true);

const lines=first.step.split('\n'),entityId=line=>Number(line.match(/^#(\d+)=/)[1]);
const caseLines=lines.filter(line=>line.includes('IFCSTRUCTURALLOADCASE(')),comboLines=lines.filter(line=>line.includes('IFCSTRUCTURALLOADGROUP(')),analysisLine=lines.find(line=>line.includes('IFCSTRUCTURALANALYSISMODEL('));
assert.equal(caseLines.length,2);assert.equal(comboLines.length,1);assert.ok(analysisLine);
const comboId=entityId(comboLines[0]),caseIds=caseLines.map(entityId);
assert.match(analysisLine,new RegExp(`\\.LOADING_3D\\.,\\$,\\(#${comboId}\\),\\$,#\\d+\\)`),'LoadedBy deve referenciar somente a combinação de topo');
for(const id of caseIds)assert.ok(!analysisLine.includes(`#${id}`),'Load cases não devem aparecer diretamente em LoadedBy quando existe combinação');
assert.equal((first.step.match(/IFCSTRUCTURALPOINTACTION\(/g)||[]).length,2);assert.equal((first.step.match(/IFCSTRUCTURALLINEARACTION\(/g)||[]).length,1);
assert.equal((first.step.match(/IFCRELASSIGNSTOGROUPBYFACTOR\(/g)||[]).length,2);assert.equal((first.step.match(/IFCRELCONNECTSSTRUCTURALACTIVITY\(/g)||[]).length,3);
assert.match(first.step,/IFCSTRUCTURALLOADSINGLEFORCE\('LG',0\.,-30\.,-5\.,1\.,0\.,2\.\)/);
assert.match(first.step,/IFCSTRUCTURALLOADLINEARFORCE\('EG',2\.,-8\.,-3\.,0\.,0\.,0\.\)/);
assert.match(first.step,/IFCSTRUCTURALPOINTACTION\('[^']+',#\d+,'LG',\$,\$,\$,\$,#\d+,\.GLOBAL_COORDS\.,\$\)/);
assert.match(first.step,/IFCSTRUCTURALLINEARACTION\('[^']+',#\d+,'EG',\$,\$,\$,\$,#\d+,\.LOCAL_COORDS\.,\$,\$,\.CONST\.\)/);

const second=prepareIfcExchange(project,{state:first.state,guidFactory,ownerMetadata,timestamp:'2026-09-14T00:31:00-03:00',fileName:'loads-v048.ifc'});
assert.deepEqual(second.state.loadGlobalIds,first.state.loadGlobalIds,'GlobalIds de casos, ações, combinações e relações devem persistir');
assert.deepEqual(second.state.ids,first.state.ids,'GlobalIds estruturais também permanecem estáveis');
assert.equal(second.state.creationDate,first.state.creationDate,'CreationDate permanece vinculada à criação do intercâmbio');

const noCombination={...project,id:'STEP-LOADS-NO-COMB',loadCombinations:[]};
const withoutCombination=prepareIfcExchange(noCombination,{state:null,guidFactory,ownerMetadata,timestamp:'2026-09-14T00:32:00-03:00',fileName:'loads-no-comb.ifc'});
const noCombLines=withoutCombination.step.split('\n'),noCombAnalysis=noCombLines.find(line=>line.includes('IFCSTRUCTURALANALYSISMODEL(')),noCombCaseIds=noCombLines.filter(line=>line.includes('IFCSTRUCTURALLOADCASE(')).map(entityId);
assert.equal(noCombCaseIds.length,2);for(const id of noCombCaseIds)assert.ok(noCombAnalysis.includes(`#${id}`),'Sem combinações, LoadedBy deve referenciar os load cases de topo');

console.log('AstraStruct v0.48 IFC STEP load smoke: persistent load identities, top-level LoadedBy, nodal/global and uniform/local actions plus factored combinations coherent.');
