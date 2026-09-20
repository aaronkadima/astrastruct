import assert from 'node:assert/strict';
import {elementAxes3D,add3,scale3,norm3} from '../web/src/view/spatialView3d.js';
import {elementRebarCage3d,projectRebarCages3d} from '../web/src/view/rebarCage3d.js';
import {rectangularSectionBarLayout} from '../web/src/detailing/rebarLayout.js';
import {rectangularStirrupGeometry} from '../web/src/detailing/rebarShapes.js';

const near=(a,b,tol=1e-6)=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const profile={parameters:{detailing:{bend:{mainBarMultiplier:8,stirrupMultiplier:4},hook:{stirrupTailPhi:5,stirrupTailMinMm:50}}}};

// A 4m beam along global X, with an "up" reference of +Z (typical beam orientation).
const project={nodes:[{id:'N1',x:0,y:0,z:0},{id:'N2',x:4,y:0,z:0}],elements:[{id:'V1',type:'frame3d',n1:'N1',n2:'N2',orientation:{up:[0,0,1]}}]};
const element=project.elements[0],axes=elementAxes3D(project,element);

const layout=rectangularSectionBarLayout({widthMm:300,heightMm:500,coverMm:30,stirrupDiameterMm:8,barDiameterMm:20,totalBars:6});
const stirrup=rectangularStirrupGeometry({profile,widthMm:300-2*30-8,heightMm:500-2*30-8,diameterMm:8,hookAngleDeg:135});
const cage=elementRebarCage3d({project,element,layout,stirrup,stirrupSpacingMm:200,startCoverMm:30,endCoverMm:30});

assert.equal(cage.barCount,6);
// stirrup count: (4m - 0.06m) / 0.2m + 1, floored, matches the spacing contract.
near(cage.stirrupCount,Math.floor((4-0.06)/0.2)+1,0);

// --- Longitudinal bar 1 (a corner bar) must run exactly from startCover to length-endCover,
// centered at its own (y,z) local offset — computed the SAME way the module
// does (via elementAxes3D + local->global), not by guessing which global axis
// a local offset lands on (that depends on the member's own orientation).
const bar1=layout.positions[0],pointAt=(xM,yMm,zMm)=>add3(add3(axes.a,scale3(axes.ex,xM)),add3(scale3(axes.ey,yMm/1000),scale3(axes.ez,zMm/1000)));
const expectedStart=pointAt(0.03,bar1.y,bar1.z),expectedEnd=pointAt(axes.length-0.03,bar1.y,bar1.z);
const bar1Faces=cage.faces.filter(f=>f.elementId==='REBAR-V1-BAR1'&&f.kind==='cap');
assert.equal(bar1Faces.length,2,'one start cap + one end cap for a straight tube');
function capCentroid(f){return f.points.reduce((a,p)=>add3(a,scale3(p,1/f.points.length)),[0,0,0]);}
const centroids=bar1Faces.map(capCentroid),matchesStart=centroids.some(c=>norm3([c[0]-expectedStart[0],c[1]-expectedStart[1],c[2]-expectedStart[2]])<1e-6),matchesEnd=centroids.some(c=>norm3([c[0]-expectedEnd[0],c[1]-expectedEnd[1],c[2]-expectedEnd[2]])<1e-6);
assert.ok(matchesStart,'bar1 start cap matches the expected local->global position exactly');
assert.ok(matchesEnd,'bar1 end cap matches the expected local->global position exactly');

// --- Every longitudinal bar's tube radius must match its OWN declared diameter. ---
for(const bar of layout.positions){
  const faces=cage.faces.filter(f=>f.elementId===`REBAR-V1-BAR${bar.id}`&&f.kind==='cap'),cap=faces[0],c=capCentroid(cap);
  const radii=cap.points.map(p=>norm3([p[0]-c[0],p[1]-c[1],p[2]-c[2]]));
  for(const r of radii)near(r,bar.diameterMm/2000,1e-6);
}

// --- A stirrup leg must span the stirrup's own width/height exactly (mm->m). ---
const leg0Faces=cage.faces.filter(f=>f.id.startsWith('REBAR-V1-STIRRUP1-L0:cap')),legCentroids=leg0Faces.map(capCentroid);
const legLengthM=norm3([legCentroids[1][0]-legCentroids[0][0],legCentroids[1][1]-legCentroids[0][1],legCentroids[1][2]-legCentroids[0][2]]);
near(legLengthM,stirrup.widthMm/1000,1e-6);

// --- Cover setback: no bar geometry should exist beyond [startCoverMm, length-endCoverMm]. ---
const allLongitudinalPoints=cage.faces.filter(f=>f.geometryType==='rebar-longitudinal').flatMap(f=>f.points);
const projectedX=allLongitudinalPoints.map(p=>{
  const rel=[p[0]-axes.a[0],p[1]-axes.a[1],p[2]-axes.a[2]];return rel[0]*axes.ex[0]+rel[1]*axes.ex[1]+rel[2]*axes.ex[2];
});
assert.ok(Math.min(...projectedX)>=0.03-1e-6&&Math.max(...projectedX)<=axes.length-0.03+1e-6,'no longitudinal geometry falls outside the declared start/end cover');

// --- Excessive cover must be refused, not silently clipped to a degenerate cage. ---
assert.throws(()=>elementRebarCage3d({project,element,layout,stirrup,stirrupSpacingMm:200,startCoverMm:2500,endCoverMm:2500}),/cobrimento/);

// --- projectRebarCages3d: only elements with an explicit spec get a cage. ---
const project2={nodes:project.nodes.concat([{id:'N3',x:8,y:0,z:0}]),elements:project.elements.concat([{id:'V2',type:'frame3d',n1:'N2',n2:'N3',orientation:{up:[0,0,1]}}])};
const scene=projectRebarCages3d({project:project2,cageByElementId:{V1:{layout,stirrup,stirrupSpacingMm:200,startCoverMm:30,endCoverMm:30}}});
assert.equal(scene.cages.length,1);
assert.ok(scene.elementIdsWithCage.has('V1'));
assert.ok(!scene.elementIdsWithCage.has('V2'),'an element with no cage spec gets no guessed geometry');

console.log('rebar cage 3D (longitudinal + stirrups, unit-correct local->global) smoke: OK',{barCount:cage.barCount,stirrupCount:cage.stirrupCount,faceCount:cage.faces.length});
