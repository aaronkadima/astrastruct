import assert from 'node:assert/strict';
import {
  SECTION_ENGINE_CONTRACT,polygonSectionProperties,rectangleSectionProperties,iSectionProperties,rhsSectionProperties,
  createSteelSection,createRCSection,createCompositeSection,fiberSectionResponse3D,solveSectionEquilibrium3D,
  concreteSectionMaterial
} from '../web/src/sections/index.js';

const close=(a,b,tol=1e-8,msg='')=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(b)),`${msg} esperado ${b}, obtido ${a}`);
const symmetric=(A,tol=1e-10)=>A.every((row,i)=>row.every((v,j)=>Math.abs(v-A[j][i])<=tol*Math.max(1,Math.abs(v),Math.abs(A[j][i]))));
assert.equal(SECTION_ENGINE_CONTRACT,'section-engine/v1');

// Exact arbitrary-polygon benchmark against a centered rectangle.
const b=.3,h=.5,vertices=[{y:-b/2,z:-h/2},{y:b/2,z:-h/2},{y:b/2,z:h/2},{y:-b/2,z:h/2}],poly=polygonSectionProperties(vertices),rect=rectangleSectionProperties({width:b,height:h});
close(poly.area,b*h,1e-12,'polygon area');close(poly.centroid.y,0,1e-12);close(poly.centroid.z,0,1e-12);close(poly.Iy,b*h**3/12,1e-12,'polygon Iy');close(poly.Iz,h*b**3/12,1e-12,'polygon Iz');close(poly.Iyz,0,1e-12);close(rect.Iy,poly.Iy,1e-12);

// Exact standard steel geometry benchmarks.
const iGeom=iSectionProperties({height:.4,width:.2,webThickness:.01,flangeThickness:.016});close(iGeom.area,2*.2*.016+.01*(.4-2*.016),1e-12,'I area');assert.ok(iGeom.Iy>iGeom.Iz);
const rhs=rhsSectionProperties({height:.3,width:.2,thickness:.01});close(rhs.area,.3*.2-(.3-.02)*(.2-.02),1e-12,'RHS area');close(rhs.centroid.y,0,1e-12);close(rhs.centroid.z,0,1e-12);

const steel={id:'steel355',type:'steel',E:200e6,fy:355},steelSection=createSteelSection({id:'S',family:'rect',material:steel,width:.2,height:.4,ny:10,nz:20});
close(steelSection.geometry.area,.08,1e-12);close(steelSection.discreteGeometry.area,.08,1e-12);close(steelSection.discreteGeometry.Iy,steelSection.geometry.Iy,1e-12,'fiber Iy with local cell inertia');close(steelSection.discreteGeometry.Iz,steelSection.geometry.Iz,1e-12,'fiber Iz with local cell inertia');

// Elastic axial + biaxial bending resultants and symmetric section tangent.
const eps=.0005,ky=.001,kz=-.0007,response=fiberSectionResponse3D({fibers:steelSection.fibers,materials:steelSection.materials,generalizedStrain:{epsilon0:eps,kappaY:ky,kappaZ:kz}});
close(response.resultants.N,steel.E*steelSection.geometry.area*eps,1e-10,'EA epsilon');close(response.resultants.My,steel.E*steelSection.geometry.Iy*ky,1e-10,'EIy ky');close(response.resultants.Mz,steel.E*steelSection.geometry.Iz*kz,1e-10,'EIz kz');assert.equal(symmetric(response.tangent),true);assert.equal(response.yieldedFibers,0);

// Inverse N-My-Mz equilibrium must recover the generalized strain field.
const referenceStrain={epsilon0:1e-4,kappaY:5e-4,kappaZ:-3e-4},reference=fiberSectionResponse3D({fibers:steelSection.fibers,materials:steelSection.materials,generalizedStrain:referenceStrain}),inverse=solveSectionEquilibrium3D({fibers:steelSection.fibers,materials:steelSection.materials,target:reference.resultants,initial:{epsilon0:0,kappaY:0,kappaZ:0},tolerances:{absoluteResidual:1e-7,relativeResidual:1e-11}});
close(inverse.generalizedStrain.epsilon0,referenceStrain.epsilon0,1e-9,'inverse eps0');close(inverse.generalizedStrain.kappaY,referenceStrain.kappaY,1e-9,'inverse ky');close(inverse.generalizedStrain.kappaZ,referenceStrain.kappaZ,1e-9,'inverse kz');assert.ok(inverse.iterations<=2);

// RC builder: reinforcement replaces equal concrete area, preserving gross geometry.
const concrete={id:'C30',type:'concrete',E:30e6,fck:30,fctm:2.9},rebar={id:'CA500',type:'rebar',E:200e6,fy:500},bars=[[-.1,-.2],[.1,-.2],[-.1,.2],[.1,.2]].map(([y,z],i)=>({id:`B${i+1}`,y,z,diameter:.016})),rc=createRCSection({id:'RC',width:.3,height:.5,concreteMaterial:concrete,rebarMaterial:rebar,bars,ny:12,nz:20});
close(rc.geometry.area,.15,1e-12,'RC gross area');close(rc.discreteGeometry.area,.15,1e-12,'RC material area conservation');assert.equal(rc.fibers.filter(f=>f.materialId===rebar.id).length,4);assert.ok(rc.metadata.rebarArea>0);
const rcCompression=fiberSectionResponse3D({fibers:rc.fibers,materials:rc.materials,generalizedStrain:{epsilon0:-.001,kappaY:0,kappaZ:0}});assert.ok(rcCompression.resultants.N<0);assert.equal(rcCompression.crushedFibers,0);
const rcBending=fiberSectionResponse3D({fibers:rc.fibers,materials:rc.materials,generalizedStrain:{epsilon0:0,kappaY:.004,kappaZ:0}});assert.ok(rcBending.crackedFibers>0);assert.ok(Number.isFinite(rcBending.resultants.My));

// Concrete law explicit limit states.
const c1=concreteSectionMaterial(concrete,-.002);close(c1.stress,-30000,1e-12,'concrete peak');assert.equal(c1.crushed,false);assert.equal(concreteSectionMaterial(concrete,-.004).crushed,true);assert.equal(concreteSectionMaterial(concrete,.0001).cracked,true);

// Generic composite section with different elastic materials and offsets.
const m1={id:'m1',type:'elastic',E:30e6},m2={id:'m2',type:'elastic',E:200e6},composite=createCompositeSection({id:'COMP',regions:[
  {id:'slab',shape:'rect',width:.6,height:.12,cz:.12,ny:12,nz:4,material:m1},
  {id:'plate',shape:'rect',width:.25,height:.02,cz:0,ny:10,nz:2,material:m2}
]});
const ea=30e6*(.6*.12)+200e6*(.25*.02),compResponse=fiberSectionResponse3D({fibers:composite.fibers,materials:composite.materials,generalizedStrain:{epsilon0:1e-5,kappaY:0,kappaZ:0}});close(compResponse.resultants.N,ea*1e-5,1e-10,'composite EA');assert.equal(compResponse.fiberCount,composite.fibers.length);

console.log('AstraStruct v0.34 Section Engine smoke: arbitrary geometry, steel/RC/composite fibers and N-My-Mz equilibrium OK.');
