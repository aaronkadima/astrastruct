import assert from 'node:assert/strict';
import {demoFrame} from '../web/src/core/model.js';
import {
  explicitIfcProfileFromSection,enrichProjectSectionsForIfc,inspectIfcExchangeReadiness,
  prepareIfcExchange,safeIfcFilename,compressIfcGuid,parseIfcStructuralStep
} from '../web/src/interop/index.js';

assert.deepEqual(explicitIfcProfileFromSection({id:'R',name:'R 30x50',family:'rect',b:.30,h:.50}),{ifcClass:'IfcRectangleProfileDef',profileName:'R 30x50',xDim:.30,yDim:.50});
assert.deepEqual(explicitIfcProfileFromSection({id:'C',name:'C 40',family:'circle',d:.40}),{ifcClass:'IfcCircleProfileDef',profileName:'C 40',radius:.20});
assert.deepEqual(explicitIfcProfileFromSection({id:'I',name:'I',family:'i',b:.20,h:.40,tw:.01,tf:.016}),{ifcClass:'IfcIShapeProfileDef',profileName:'I',overallWidth:.20,overallDepth:.40,webThickness:.01,flangeThickness:.016});
assert.equal(explicitIfcProfileFromSection({id:'G',family:'steel3d',A:.01,Iy:1e-4,Iz:2e-4}),null,'A/I/J não devem gerar geometria IFC');

const project=demoFrame();project.name='Pórtico UI IFC';
const enriched=enrichProjectSectionsForIfc(project),rect=enriched.sections.find(x=>x.id==='rc_30x50');
assert.equal(rect.ifcProfile.ifcClass,'IfcRectangleProfileDef');
const inspection=inspectIfcExchangeReadiness(project);
assert.equal(inspection.ready,true);assert.equal(inspection.summary.pending,0);assert.ok(inspection.summary.profileSet>=1);

let sequence=1000;
const guidFactory=()=>compressIfcGuid((++sequence).toString(16).padStart(32,'0'));
const ownerMetadata={person:{identification:'ui-ci',familyName:'CI',givenName:'AstraStruct'},organization:{identification:'ASTRASTRUCT',name:'AstraStruct'},application:{version:'0.45.0-exp',fullName:'AstraStruct',identifier:'ASTRASTRUCT'}};
const first=prepareIfcExchange(project,{state:null,guidFactory,ownerMetadata,timestamp:'2026-09-13T22:10:00-03:00',fileName:'ui.ifc'});
assert.equal(first.envelope.hasProject,true);assert.equal(first.envelope.hasProfileSetUsage,true);assert.equal(first.readiness.materialSummary.pending,0);
const parsed=parseIfcStructuralStep(first.step);assert.equal(parsed.project.name,'Pórtico UI IFC');
const second=prepareIfcExchange(project,{state:first.state,guidFactory,ownerMetadata,timestamp:'2026-09-13T22:11:00-03:00',fileName:'ui.ifc'});
assert.deepEqual(second.state.ids,first.state.ids,'GlobalIds dos objetos devem persistir entre exportações');
assert.equal(second.state.declarationGlobalId,first.state.declarationGlobalId);
assert.equal(second.state.groupGlobalId,first.state.groupGlobalId);
assert.deepEqual(second.state.materialAssociationGlobalIds,first.state.materialAssociationGlobalIds);
assert.equal(second.state.creationDate,first.state.creationDate,'CreationDate deve representar a criação do intercâmbio, não cada download');
assert.equal(safeIfcFilename({name:'Pórtico estrutural / revisão 01'}),'Portico-estrutural-revisao-01.ifc');

const pending={...project,id:'PENDING-UI',sections:[{id:'steel_generic',name:'Genérica',family:'steel3d',A:.01,Iy:1e-4,Iz:2e-4}],elements:[{id:'E1',type:'frame3d',n1:project.nodes[0].id,n2:project.nodes[1].id,materialId:'steel355',sectionId:'steel_generic'}]};
const pendingInspection=inspectIfcExchangeReadiness(pending);assert.equal(pendingInspection.ready,false);assert.equal(pendingInspection.summary.reasons.IFC_PROFILE_MISSING,1);
assert.throws(()=>prepareIfcExchange(pending,{guidFactory,ownerMetadata,timestamp:'2026-09-13T22:10:00-03:00'}),/elementos pendentes/);

console.log('AstraStruct v0.45 IFC UI exchange smoke: explicit profile enrichment, persistent identities and conservative readiness coherent.');
