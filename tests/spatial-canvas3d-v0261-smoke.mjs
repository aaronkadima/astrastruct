import assert from 'node:assert/strict';
import {bounds3D,cameraBasis3D,characteristicLength3D,displacedPoint3D,elementAxes3D,elementResultScalar3D,fitCamera3D,maxFieldMagnitude3D,projectPoint3D,resolveShapeField3D} from '../web/src/view/spatialView3d.js';
import {frameSectionPrism3D,resolveSectionDimensions3D,shellSectionPrism3D,trueSectionScene3D} from '../web/src/view/spatialSectionGeometry3d.js';

const project={nodes:[{id:'N1',x:0,y:0,z:0},{id:'N2',x:4,y:2,z:3}],elements:[{id:'E1',type:'frame3d',n1:'N1',n2:'N2',orientation:{up:[0,0,1]}}]};
const b=bounds3D(project);assert.deepEqual(b.min,[0,0,0]);assert.deepEqual(b.max,[4,2,3]);assert.ok(characteristicLength3D(project)>=4);
const camera=fitCamera3D(project,'iso','perspective'),basis=cameraBasis3D(camera);assert.ok(Math.abs(Math.hypot(...basis.right)-1)<1e-12);assert.ok(Math.abs(Math.hypot(...basis.up)-1)<1e-12);assert.ok(Math.abs(basis.right[0]*basis.up[0]+basis.right[1]*basis.up[1]+basis.right[2]*basis.up[2])<1e-12);
for(const n of project.nodes){const p=projectPoint3D([n.x,n.y,n.z],camera,{width:1000,height:700});assert.equal(p.visible,true);assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.depth>0)}
const ax=elementAxes3D(project,project.elements[0]);assert.ok(ax);assert.ok(Math.abs(ax.ex[0]*ax.ey[0]+ax.ex[1]*ax.ey[1]+ax.ex[2]*ax.ey[2])<1e-12);assert.ok(Math.abs(ax.ex[0]*ax.ez[0]+ax.ex[1]*ax.ez[1]+ax.ex[2]*ax.ez[2])<1e-12);

const staticResult={dimension:'3d',analysisType:'linear',displacements:[{nodeId:'N1',ux:0,uy:0,uz:0},{nodeId:'N2',ux:.01,uy:-.02,uz:.03}],elementForces:[{elementId:'E1',N1:-10,N2:10,Vy1:3,Vz1:4,Vy2:-3,Vz2:-4,T1:2,T2:-2,My1:6,Mz1:8,My2:-6,Mz2:-8}]};
let field=resolveShapeField3D(staticResult,null,0);assert.equal(field.kind,'deformed');assert.ok(Math.abs(maxFieldMagnitude3D(field.map)-Math.hypot(.01,.02,.03))<1e-12);const pd=displacedPoint3D(project.nodes[1],field.map,10,1);assert.deepEqual(pd,[4.1,1.8,3.3]);assert.equal(elementResultScalar3D(staticResult,'E1','V'),5);assert.equal(elementResultScalar3D(staticResult,'E1','M'),10);assert.equal(elementResultScalar3D(staticResult,'E1','T'),2);assert.equal(elementResultScalar3D(staticResult,'E1','N'),10);

const pdeltaImperfection={dimension:'3d',analysisType:'pdelta',displacements:[{nodeId:'N1',ux:0,uy:0,uz:0},{nodeId:'N2',ux:0,uy:.002,uz:0}],totalDisplacements:[{nodeId:'N1',ux:0,uy:0,uz:0},{nodeId:'N2',ux:0,uy:.007,uz:0}],pDelta:{imperfection:{enabled:true}}};
field=resolveShapeField3D(pdeltaImperfection,null,0);assert.equal(field.kind,'deformed');assert.match(field.label,/total/i);assert.equal(field.map.get('N2')[1],.007,'Canvas 3D deve usar u0 + Δu quando a imperfeição P-Delta estiver ativa');
const corotImperfection={dimension:'3d',analysisType:'corotational',displacements:[{nodeId:'N1',ux:0,uy:0,uz:0},{nodeId:'N2',ux:0,uy:.0015,uz:0}],totalDisplacements:[{nodeId:'N1',ux:0,uy:0,uz:0},{nodeId:'N2',ux:0,uy:.0065,uz:0}],nonlinear:{imperfection:{enabled:true,stressFreeReference:true}}};
field=resolveShapeField3D(corotImperfection,null,0);assert.equal(field.kind,'deformed');assert.match(field.label,/total/i);assert.equal(field.map.get('N2')[1],.0065,'Canvas 3D deve usar u0 + Δu no co-rotacional imperfeito');

const modal={dimension:'3d',analysisType:'modal',modes:[{mode:1,displacements:[{nodeId:'N1',ux:0,uy:0,uz:0},{nodeId:'N2',ux:1,uy:0,uz:.2}]}]};field=resolveShapeField3D(modal,null,0);assert.equal(field.kind,'modal');assert.equal(field.mode.mode,1);assert.equal(field.map.get('N2')[0],1);
const bucklingView={modeIndex:0,result:{dimension:'3d',modes:[{mode:1,factor:2.5,displacements:[{nodeId:'N1',ux:0,uy:0,uz:0},{nodeId:'N2',ux:0,uy:1,uz:0}]}]}};field=resolveShapeField3D(modal,bucklingView,0);assert.equal(field.kind,'buckling');assert.equal(field.mode.factor,2.5);assert.equal(field.map.get('N2')[1],1);

// True-section geometry must preserve real b×h and slab thickness, including deformed coordinates.
const trueProject={
 nodes:[{id:'A',x:0,y:0,z:0},{id:'B',x:5,y:0,z:0},{id:'C',x:5,y:4,z:0},{id:'D',x:0,y:4,z:0},{id:'E',x:0,y:0,z:3}],
 sections:[{id:'R',b:.30,h:.60,A:.18}],
 elements:[{id:'F',type:'frame3d',n1:'A',n2:'B',sectionId:'R',orientation:{up:[0,0,1]}},{id:'S',type:'shell4',nodeIds:['A','B','C','D'],n1:'A',n2:'B',n3:'C',n4:'D',thickness:.15}]
};
const dim=resolveSectionDimensions3D(trueProject,trueProject.elements[0]);assert.equal(dim.b,.30);assert.equal(dim.h,.60);
const prism=frameSectionPrism3D(trueProject,trueProject.elements[0]);assert.equal(prism.faces.length,6);assert.equal(prism.dimensions.b,.30);assert.equal(prism.dimensions.h,.60);assert.ok(Math.abs(prism.corners.a10[2]-.30)<1e-12,'beam half-depth must follow local ey');
const slab=shellSectionPrism3D(trueProject,trueProject.elements[1]);assert.equal(slab.faces.length,6);assert.equal(slab.thickness,.15);assert.ok(Math.abs(slab.top[0][2]-.075)<1e-12);assert.ok(Math.abs(slab.bottom[0][2]+.075)<1e-12);
const moved=new Map([['A',[0,0,.1]],['B',[0,0,.2]],['C',[0,0,.3]],['D',[0,0,.2]],['E',[0,0,0]]]),scene=trueSectionScene3D(trueProject,{pointForNode:n=>{const d=moved.get(n.id)||[0,0,0];return[n.x+d[0],n.y+d[1],n.z+d[2]]}});assert.equal(scene.frames.length,1);assert.equal(scene.shells.length,1);assert.equal(scene.faces.length,12);assert.ok(scene.frames[0].axes.a[2]>.09&&scene.frames[0].axes.b[2]>.19,'deformed prism endpoints must follow result coordinates');
console.log('v0.26.1/v0.30 Canvas 3D math/analysis/true-section smoke: OK');
