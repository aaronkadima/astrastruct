// Parametric, dimensioned shop-drawing rendering for rebar marks.
//
// The generic sheet builder in sheets.js (createRebarSheetsFromSchedule)
// draws every mark as a schematic zigzag whose segment lengths are only
// PROPORTIONAL to the real ones (a fixed-width box split by ratio) — good
// enough as a placeholder, but not a real bent-shape drawing and not drawn
// to the sheet's stated scale. This module draws the TRUE outline (straight
// legs + real arcs at the mark's own bend radius) at an actual drawing
// scale, with CAD-style linear dimensions for every leg — the "estilo
// parametrização e com cotas" piece.
//
// Scope note: this currently understands the rectangular-stirrup shape
// produced by rebarShapes.js's `rectangularStirrupGeometry` (the one shape
// this codebase can build a code-aware geometry for so far). Marks without
// a `stirrupGeometry` payload fall back to the existing schematic renderer
// in sheets.js — this module does not attempt to guess a real outline for
// shapes it has no geometry contract for.
import {normalizeEntity,createDrawingSheet,PAPER_SIZES_MM} from './sheets.js';

const finite=(name,v)=>{const n=Number(v);if(!Number.isFinite(n))throw new Error(`ShapeDrawing: ${name} deve ser finito.`);return n};
const positive=(name,v)=>{const n=finite(name,v);if(!(n>0))throw new Error(`ShapeDrawing: ${name} deve ser > 0.`);return n};

/** Parses a "1:N" drawing-scale string into the real-mm -> paper-mm factor (1/N). Accepts "1:1" for full scale. */
export function parseDrawingScale(scale){
  const m=String(scale||'').trim().match(/^(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)$/);
  if(!m)throw new Error(`ShapeDrawing: escala '${scale}' inválida — use o formato "1:N".`);
  const num=Number(m[1]),den=Number(m[2]);
  if(!(num>0)||!(den>0))throw new Error(`ShapeDrawing: escala '${scale}' inválida — os dois termos devem ser positivos.`);
  return num/den;
}

/**
 * True outline of a rectangular stirrup: 4 straight legs with the corners
 * rounded at the mark's own hook bend radius (arcs flattened into short
 * segments for simple polyline rendering — this is a drawing aid, not a
 * fabrication-precision path). One corner is deliberately left "open" with
 * the two hook tails sticking out, matching how a closed stirrup with two
 * hook ends is conventionally drawn (as an open-and-overlapping loop, not a
 * seamless closed rectangle) — a simplification: real hook tails commonly
 * alternate corners and point outward at an angle; here both are drawn
 * straight out from the same corner for legibility at small scale.
 */
export function stirrupOutlinePoints({stirrupGeometry,x0,y0,scaleFactor,arcSegments=8}){
  const g=stirrupGeometry;if(g?.contract!=='rebar-stirrup/v1')throw new Error('ShapeDrawing: stirrupGeometry deve ser rebar-stirrup/v1.');
  const f=positive('scaleFactor',scaleFactor),w=g.widthMm*f,h=g.heightMm*f,rRaw=g.hook.arc.centerlineRadiusMm*f,tail=g.hook.tailMm*f;
  const r=Math.max(0,Math.min(rRaw,w/2-.01,h/2-.01)); // never let corner rounding exceed the shape itself at tiny scales
  const pts=[],arc=(cx,cy,a0,a1)=>{for(let i=0;i<=arcSegments;i++){const t=a0+(a1-a0)*i/arcSegments;pts.push({x:cx+r*Math.cos(t),y:cy+r*Math.sin(t)});}};
  pts.push({x:x0+tail,y:y0}); // hook tail sticking out from the top-left corner
  pts.push({x:x0+r,y:y0});
  pts.push({x:x0+w-r,y:y0});arc(x0+w-r,y0+r,-Math.PI/2,0);
  pts.push({x:x0+w,y:y0+h-r});arc(x0+w-r,y0+h-r,0,Math.PI/2);
  pts.push({x:x0+r,y:y0+h});arc(x0+r,y0+h-r,Math.PI/2,Math.PI);
  pts.push({x:x0,y:y0+r});arc(x0+r,y0+r,Math.PI,1.5*Math.PI);
  pts.push({x:x0+tail,y:y0}); // second hook tail closes back at the same corner
  return pts;
}

/**
 * Builds the full set of drawing-sheet entities (outline + dimensions +
 * label) for one stirrup mark, anchored with its bounding box top-left at
 * (x0,y0). `scaleFactor` is real-mm -> paper-mm (see parseDrawingScale).
 */
export function stirrupDetailEntities({mark,x0,y0,scaleFactor,idPrefix=null}){
  const g=mark?.stirrupGeometry;if(g?.contract!=='rebar-stirrup/v1')throw new Error('ShapeDrawing: mark.stirrupGeometry ausente ou inválido — use stirrupRebarMark.');
  const prefix=idPrefix||mark.id,points=stirrupOutlinePoints({stirrupGeometry:g,x0,y0,scaleFactor}),entities=[];
  entities.push(normalizeEntity({id:`${prefix}-OUTLINE`,kind:'rebar',x:x0,y:y0,points,label:'',diameterMm:g.diameterMm,quantity:mark.quantity,stroke:'#2c3a44',strokeWidth:Math.max(.5,g.diameterMm*scaleFactor*3)}));
  // Width dimension (top leg), true value = g.widthMm regardless of drawing scale.
  entities.push(normalizeEntity({id:`${prefix}-DIM-W`,kind:'dim',x:x0,y:y0,x2:x0+g.widthMm*scaleFactor,y2:y0,offset:-8,valueMm:g.widthMm,precision:0,stroke:'#3a4a55',strokeWidth:.4,fontSize:3}));
  // Height dimension (right leg).
  entities.push(normalizeEntity({id:`${prefix}-DIM-H`,kind:'dim',x:x0+g.widthMm*scaleFactor,y:y0,x2:x0+g.widthMm*scaleFactor,y2:y0+g.heightMm*scaleFactor,offset:8,valueMm:g.heightMm,precision:0,stroke:'#3a4a55',strokeWidth:.4,fontSize:3}));
  // Hook tail dimension, drawn near the open corner.
  entities.push(normalizeEntity({id:`${prefix}-DIM-TAIL`,kind:'dim',x:x0,y:y0,x2:x0+g.hook.tailMm*scaleFactor,y2:y0,offset:8,valueMm:g.hook.tailMm,precision:0,stroke:'#3a4a55',strokeWidth:.4,fontSize:3}));
  entities.push(normalizeEntity({id:`${prefix}-LABEL`,kind:'text',x:x0,y:y0+g.heightMm*scaleFactor+16,text:g.legend,fontSize:3.4,stroke:'#26343e'}));
  return entities;
}

/**
 * A full sheet of stirrup detail drawings, one per mark, laid out in a grid.
 * Marks without stirrupGeometry are skipped with a listed note rather than
 * silently dropped or force-fit into a shape this module cannot draw yet.
 */
export function createStirrupDetailSheet({marks=[],projectId='',title='Detalhamento de estribos',paper='A2',drawingScale='1:5',revision='R0',columns=3,cellWidthMm=180,cellHeightMm=140,marginMm=25}={}){
  const scaleFactor=parseDrawingScale(drawingScale),list=Array.from(marks||[]),drawable=list.filter(m=>m?.stirrupGeometry?.contract==='rebar-stirrup/v1'),skipped=list.filter(m=>m?.stirrupGeometry?.contract!=='rebar-stirrup/v1').map(m=>m?.id);
  const entities=[normalizeEntity({id:'TITLE',kind:'text',x:marginMm,y:marginMm+6,text:`${title} · escala ${drawingScale}`,fontSize:6,stroke:'#1f2b33'})];
  if(skipped.length)entities.push(normalizeEntity({id:'SKIPPED',kind:'text',x:marginMm,y:marginMm+14,text:`Sem geometria de estribo (não desenhadas aqui): ${skipped.join(', ')}`,fontSize:3,stroke:'#8a5a1f'}));
  drawable.forEach((mark,i)=>{
    const col=i%columns,row=Math.floor(i/columns),x0=marginMm+col*cellWidthMm+10,y0=marginMm+24+row*cellHeightMm+10;
    entities.push(...stirrupDetailEntities({mark,x0,y0,scaleFactor}));
  });
  const [pw,ph]=PAPER_SIZES_MM[String(paper).toUpperCase()]||PAPER_SIZES_MM.A2,rows=Math.max(1,Math.ceil(drawable.length/columns)),neededHeight=marginMm*2+24+rows*cellHeightMm,paperPick=neededHeight>Math.max(pw,ph)?'A1':paper;
  return createDrawingSheet({id:'REB-STIRRUPS-01',title,paper:paperPick,orientation:'landscape',scale:drawingScale,revision,projectId,entities,source:{type:'stirrup-detail',markIds:drawable.map(m=>m.id),skippedMarkIds:skipped}});
}
