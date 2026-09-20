import assert from 'node:assert/strict';
import {
  stirrupRebarMark,parseDrawingScale,stirrupOutlinePoints,stirrupDetailEntities,
  createStirrupDetailSheet,exportDrawingSheetSvg
} from '../web/src/detailing/index.js';

const near=(a,b,tol=1e-9)=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(b)),`${a} != ${b}`);

const profile={parameters:{detailing:{
  bend:{mainBarMultiplier:8,stirrupMultiplier:4},
  hook:{stirrupTailPhi:5,stirrupTailMinMm:50},
}}};

// --- parseDrawingScale ---
near(parseDrawingScale('1:5'),.2);
near(parseDrawingScale('1:1'),1);
assert.throws(()=>parseDrawingScale('bogus'),/inválida/);
assert.throws(()=>parseDrawingScale('1:0'),/inválida/);

// --- stirrupOutlinePoints: real geometry, not a proportional zigzag ---
const mark=stirrupRebarMark({id:'N1',profile,widthMm:150,heightMm:250,diameterMm:6.3,quantity:40,grade:'CA-60'});
const f=parseDrawingScale('1:5'),pts=stirrupOutlinePoints({stirrupGeometry:mark.stirrupGeometry,x0:0,y0:0,scaleFactor:f});
// The outline's bounding box must match width*f / height*f exactly — this is
// the whole point versus the old zigzag, which never respected real scale.
const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y);
near(Math.max(...xs)-Math.min(...xs),150*f,1e-6);
near(Math.max(...ys)-Math.min(...ys),250*f,1e-6);
assert.ok(pts.length>8,'corners are flattened into multiple arc points, not a single sharp bend');

// A bigger stirrup at the same scale must produce a proportionally bigger outline.
const mark2=stirrupRebarMark({id:'N2',profile,widthMm:300,heightMm:500,diameterMm:6.3,quantity:10,grade:'CA-60'});
const pts2=stirrupOutlinePoints({stirrupGeometry:mark2.stirrupGeometry,x0:0,y0:0,scaleFactor:f});
near(Math.max(...pts2.map(p=>p.x))-Math.min(...pts2.map(p=>p.x)),300*f,1e-6);

// --- stirrupDetailEntities: dimension VALUES are always true mm, regardless of scaleFactor ---
const entities=stirrupDetailEntities({mark,x0:10,y0:10,scaleFactor:f});
const dimW=entities.find(e=>e.id.endsWith('-DIM-W')),dimH=entities.find(e=>e.id.endsWith('-DIM-H')),dimTail=entities.find(e=>e.id.endsWith('-DIM-TAIL'));
near(dimW.valueMm,150);near(dimH.valueMm,250);near(dimTail.valueMm,mark.stirrupGeometry.hook.tailMm);
// but the on-paper LINE length must scale down with the drawing scale.
near(Math.hypot(dimW.x2-dimW.x,dimW.y2-dimW.y),150*f,1e-6);
const outline=entities.find(e=>e.id.endsWith('-OUTLINE'));
assert.ok(outline&&outline.kind==='rebar'&&outline.points.length>8);

// A mark with no stirrupGeometry must be refused explicitly, not silently misdrawn.
assert.throws(()=>stirrupDetailEntities({mark:{id:'X',contract:'rebar-mark/v1'},x0:0,y0:0,scaleFactor:f}),/stirrupGeometry/);

// --- createStirrupDetailSheet: drawable vs skipped marks, SVG contains real values ---
const plainMark={id:'B1',contract:'rebar-mark/v1',diameterMm:16,quantity:4,segmentsMm:[800],totalLengthM:3.2,totalMassKg:5,grade:'CA-50'};
const sheet=createStirrupDetailSheet({marks:[mark,mark2,plainMark],projectId:'ASTRA-001',drawingScale:'1:5'});
assert.equal(sheet.contract,'engineering-drawing-sheet/v1');
assert.deepEqual(sheet.source.markIds,['N1','N2']);
assert.deepEqual(sheet.source.skippedMarkIds,['B1']);

const svg=exportDrawingSheetSvg(sheet);
assert.ok(svg.includes('>150<')&&svg.includes('>250<'),'true dimension values (not scaled pixels) appear as SVG text');
assert.ok(svg.includes('>300<')&&svg.includes('>500<'));
assert.ok(svg.includes('N1-OUTLINE')&&svg.includes('N2-OUTLINE'));
assert.ok(svg.includes('B1'),'skipped mark is still listed by id so nothing silently disappears');
assert.ok(/<polygon/.test(svg),'dimension lines render arrowheads');

console.log('rebar shape drawing (real outline + true dimensions) smoke: OK',{svgLength:svg.length,paper:sheet.paper,scale:sheet.scale});
