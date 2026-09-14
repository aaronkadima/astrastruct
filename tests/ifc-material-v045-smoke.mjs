import assert from 'node:assert/strict';
import {
  createIfcInteroperabilityModel,IFC_MATERIAL_MAPPING_CONTRACT,IFC_MATERIAL_MAPPING_VERSION,
  validateExplicitIfcProfile,createIfcMaterialMapping,validateIfcMaterialMapping,summarizeIfcMaterialMapping
} from '../web/src/interop/index.js';

assert.equal(IFC_MATERIAL_MAPPING_CONTRACT,'ifc-material-mapping/v1');
assert.equal(IFC_MATERIAL_MAPPING_VERSION,'0.45.0-exp');
assert.deepEqual(validateExplicitIfcProfile({ifcClass:'IfcRectangleProfileDef',xDim:.30,yDim:.50,profileName:'R300x500'}),{
  ifcClass:'IfcRectangleProfileDef',profileType:'AREA',profileName:'R300x500',position:null,xDim:.30,yDim:.50
});
assert.throws(()=>validateExplicitIfcProfile({ifcClass:'IfcRectangleProfileDef',xDim:.30,yDim:0}),/yDim deve ser positivo/);
assert.throws(()=>validateExplicitIfcProfile({ifcClass:'IfcUnknownProfileDef',xDim:.30,yDim:.50}),/não suportado/);

const project={
  id:'MAT-BENCH',name:'Material mapping benchmark',units:'kN-m-MPa',schemaVersion:2,
  nodes:[
    {id:'N1',x:0,y:0,z:0},{id:'N2',x:0,y:0,z:3},{id:'N3',x:4,y:0,z:3},{id:'N4',x:4,y:0,z:0},{id:'N5',x:8,y:0,z:0}
  ],
  materials:[
    {id:'C30',name:'Concrete C30',type:'concrete',E:30e6},
    {id:'S355',name:'S355',type:'steel',E:200e6}
  ],
  sections:[
    {id:'SHELL180',name:'Shell 180 mm',family:'shell',t:.18},
    {id:'GENERIC',name:'Generic steel section',family:'steel3d',A:.01,Iy:1e-4,Iz:2e-4},
    {id:'RECT',name:'Rectangle 300x500',family:'rc3d',ifcProfile:{ifcClass:'IfcRectangleProfileDef',profileName:'R300x500',xDim:.30,yDim:.50}}
  ],
  elements:[
    {id:'SURF',type:'shell4',n1:'N1',n2:'N2',n3:'N3',n4:'N4',materialId:'C30',sectionId:'SHELL180'},
    {id:'CURVE-PENDING',type:'frame3d',n1:'N4',n2:'N5',materialId:'S355',sectionId:'GENERIC'},
    {id:'CURVE-READY',type:'frame3d',n1:'N1',n2:'N2',materialId:'C30',sectionId:'RECT'},
    {id:'NO-MAT',type:'frame3d',n1:'N3',n2:'N4',sectionId:'GENERIC'}
  ]
};

const model=createIfcInteroperabilityModel(project);
const mapping=createIfcMaterialMapping(model);
assert.equal(validateIfcMaterialMapping(mapping),true);
const surface=mapping.entries.find(x=>x.memberId==='SURF');
assert.equal(surface.status,'READY');assert.equal(surface.mode,'DIRECT_MATERIAL');
assert.equal(surface.material.ifcClass,'IfcMaterial');assert.equal(surface.material.name,'Concrete C30');assert.equal(surface.material.category,'concrete');
assert.equal(surface.thickness,.18);assert.equal(surface.relationship.ifcClass,'IfcRelAssociatesMaterial');assert.equal(surface.relationship.relatingMaterialRef,'material:C30');

const pendingCurve=mapping.entries.find(x=>x.memberId==='CURVE-PENDING');
assert.equal(pendingCurve.status,'PENDING');assert.equal(pendingCurve.reason,'IFC_PROFILE_MISSING');
assert.match(pendingCurve.note,/não infere geometria/);

const readyCurve=mapping.entries.find(x=>x.memberId==='CURVE-READY');
assert.equal(readyCurve.status,'READY');assert.equal(readyCurve.mode,'MATERIAL_PROFILE_SET');
assert.equal(readyCurve.profile.ifcClass,'IfcRectangleProfileDef');assert.equal(readyCurve.profile.xDim,.30);assert.equal(readyCurve.profile.yDim,.50);
assert.equal(readyCurve.materialProfile.ifcClass,'IfcMaterialProfile');assert.equal(readyCurve.materialProfileSet.ifcClass,'IfcMaterialProfileSet');
assert.equal(readyCurve.usage.ifcClass,'IfcMaterialProfileSetUsage');assert.equal(readyCurve.usage.cardinalPoint,10);
assert.equal(readyCurve.relationship.ifcClass,'IfcRelAssociatesMaterial');

const noMaterial=mapping.entries.find(x=>x.memberId==='NO-MAT');
assert.equal(noMaterial.status,'PENDING');assert.equal(noMaterial.reason,'MATERIAL_MISSING');
assert.deepEqual(summarizeIfcMaterialMapping(mapping),{total:4,ready:2,pending:2,directMaterial:1,profileSet:1,reasons:{IFC_PROFILE_MISSING:1,MATERIAL_MISSING:1}});

const invalidProfileProject={...project,id:'MAT-BAD-PROFILE',sections:project.sections.map(s=>s.id==='RECT'?{...s,ifcProfile:{ifcClass:'IfcRectangleProfileDef',xDim:.30,yDim:-.50}}:s)};
assert.throws(()=>createIfcMaterialMapping(createIfcInteroperabilityModel(invalidProfileProject)),/yDim deve ser positivo/);

console.log('AstraStruct v0.45 IFC material smoke: direct surface material, explicit curve profile sets and conservative PENDING states coherent.');
