import assert from 'node:assert/strict';
import {compressIfcGuid,prepareIfcExchange,createIfcImportStaging,parseIfcStepEntities,extractIfcStrengthMaterialProperties,IFC_MATERIAL_STRENGTH_CONTRACT,IFC_MATERIAL_STRENGTH_VERSION} from '../web/src/interop/index.js';

const baseProject={
  id:'IFC-STRENGTH-V047',name:'IFC material strength v0.47',units:'kN-m-MPa',schemaVersion:2,meta:{productVersion:'0.46.0'},
  nodes:[{id:'N1',x:0,y:0,z:0},{id:'N2',x:4,y:0,z:0},{id:'N3',x:4,y:3,z:0},{id:'N4',x:0,y:3,z:0}],
  materials:[
    {id:'S355',name:'Steel S355',type:'steel',E:200e6,nu:.3,fy:355,fu:510,density:78.5},
    {id:'C30',name:'Concrete C30',type:'concrete',E:30e6,nu:.2,fck:30,fctm:2.9,density:25}
  ],
  sections:[{id:'R30x50',name:'R 30x50',family:'rect',b:.30,h:.50,A:.15,Iy:.003125,Iz:.001125,J:.001},{id:'SHELL18',name:'Shell 18 cm',family:'shell',t:.18}],
  supports:[{id:'SUP1',nodeId:'N1',ux:true,uy:true,uz:true,rx:true,ry:true,rz:true}],nodeSprings:[],
  elements:[{id:'E1',type:'frame3d',n1:'N1',n2:'N2',materialId:'S355',sectionId:'R30x50'},{id:'E2',type:'shell4',nodeIds:['N1','N2','N3','N4'],n1:'N1',n2:'N2',n3:'N3',n4:'N4',materialId:'C30',sectionId:'SHELL18',thickness:.18}]
};
let sequence=4700;const guidFactory=()=>compressIfcGuid((++sequence).toString(16).padStart(32,'0'));
const ownerMetadata={person:{identification:'v047-ci',givenName:'AstraStruct',familyName:'CI'},organization:{identification:'ASTRASTRUCT',name:'AstraStruct'},application:{version:'0.46.0',fullName:'AstraStruct',identifier:'ASTRASTRUCT'}};
const exported=prepareIfcExchange(baseProject,{guidFactory,ownerMetadata,timestamp:'2026-09-14T03:10:00Z',fileName:'ifc-strength-v047.ifc'});

assert.match(exported.step,/IFCMATERIALPROPERTIES\('Pset_MaterialSteel'/,'aço deve exportar Pset_MaterialSteel');
assert.match(exported.step,/IFCMATERIALPROPERTIES\('Pset_MaterialConcrete'/,'concreto deve exportar Pset_MaterialConcrete');
assert.match(exported.step,/IFCPROPERTYSINGLEVALUE\('YieldStress',\$,IFCPRESSUREMEASURE\(355\.\),\$\)/);
assert.match(exported.step,/IFCPROPERTYSINGLEVALUE\('UltimateStress',\$,IFCPRESSUREMEASURE\(510\.\),\$\)/);
assert.match(exported.step,/IFCPROPERTYSINGLEVALUE\('CompressiveStrength',\$,IFCPRESSUREMEASURE\(30\.\),\$\)/);
assert.doesNotMatch(exported.step,/TensileStrength|fctm/i,'fctm não deve ser encaixado em propriedade IFC sem equivalência material direta');

const generic=parseIfcStepEntities(exported.step),strength=extractIfcStrengthMaterialProperties(generic);
assert.equal(strength.contract,IFC_MATERIAL_STRENGTH_CONTRACT);assert.equal(strength.version,IFC_MATERIAL_STRENGTH_VERSION);assert.equal(strength.unitSystem,'kN-m-MPa');
assert.equal(strength.byMaterialEntityId.size,2);

const staged=createIfcImportStaging(exported.step),steel=staged.project.materials.find(x=>x.name==='Steel S355'),concrete=staged.project.materials.find(x=>x.name==='Concrete C30');
assert.ok(steel);assert.ok(concrete);assert.equal(steel.fy,355);assert.equal(steel.fu,510);assert.equal(steel.fck,null);assert.equal(concrete.fck,30);assert.equal(concrete.fy,null);assert.equal(concrete.fu,null);
assert.equal(staged.readiness.analysisReady,true,'resistências adicionais não devem degradar readiness mecânico já válido');
assert.ok(steel.ifc.steelPropertySetEntityId);assert.ok(concrete.ifc.concretePropertySetEntityId);

const unknown={...baseProject,id:'IFC-STRENGTH-UNKNOWN',name:'No inference',nodes:baseProject.nodes.slice(0,2),materials:[{...baseProject.materials[0],id:'M1',name:'Untyped metal',type:'imported'}],sections:[baseProject.sections[0]],elements:[{...baseProject.elements[0],id:'E1',materialId:'M1'}]};
const unknownStep=prepareIfcExchange(unknown,{guidFactory,ownerMetadata,timestamp:'2026-09-14T03:11:00Z',fileName:'ifc-strength-unknown.ifc'}).step;
assert.doesNotMatch(unknownStep,/Pset_MaterialSteel|YieldStress|UltimateStress/,'material importado/indefinido não pode ser promovido a aço apenas por possuir fy/fu');

const bad={...baseProject,id:'IFC-STRENGTH-BAD',materials:[{...baseProject.materials[0],fy:510,fu:355},baseProject.materials[1]]};
assert.throws(()=>prepareIfcExchange(bad,{guidFactory,ownerMetadata,timestamp:'2026-09-14T03:12:00Z',fileName:'ifc-strength-bad.ifc'}),/fu não pode ser menor que fy/);

const wrongType=exported.step.replace('IFCPRESSUREMEASURE(355.)','IFCREAL(355.)');
assert.throws(()=>extractIfcStrengthMaterialProperties(parseIfcStepEntities(wrongType)),/YieldStress deve usar IFCPRESSUREMEASURE/,'tipo STEP incorreto deve ser rejeitado');

console.log('AstraStruct v0.47 IFC material strength smoke: steel/concrete standard Psets, conservative typing and strength round-trip coherent.');
