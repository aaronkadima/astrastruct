// 3D rebar-cage geometry for one frame3d element: longitudinal bar tubes
// running the member's length + stirrup loops spaced along it. Reuses the
// SAME face format ({id,points,kind,center,elementId,geometryType}) as
// spatialSectionGeometry3d.js and view/foundationSolid3d.js, so it plugs
// into the existing projectedSectionFaces/drawSectionFaces rendering
// pipeline in SpatialCanvas3DCore.tsx without new canvas code.
//
// UNIT NOTE: the structural solver (elementAxes3D, node coordinates) works
// in SI meters, while rebar layout/geometry (rebarLayout.js, rebarShapes.js)
// works in millimeters, matching each layer's own established convention
// elsewhere in this codebase. Every mm quantity here is explicitly divided
// by 1000 before being combined with the solver's meter-space geometry —
// getting this wrong would silently place bars 1000x too far from the
// member, so the conversion happens in exactly one place (`mm` below).
import {elementAxes3D,add3,scale3,sub3,unit3,cross3,norm3} from './spatialView3d.js';

const mm=v=>Number(v)/1000; // mm -> m
const finite=(name,v)=>{const n=Number(v);if(!Number.isFinite(n))throw new Error(`RebarCage3D: ${name} deve ser finito.`);return n};
const positive=(name,v)=>{const n=finite(name,v);if(!(n>0))throw new Error(`RebarCage3D: ${name} deve ser > 0.`);return n};

function face(id,points,kind,extra={}){return{id,points,kind,center:points.reduce((a,p)=>add3(a,scale3(p,1/points.length)),[0,0,0]),...extra};}

/** A cylindrical tube between two arbitrary 3D points (meters), diameter in mm. Works for any direction — not limited to a vertical axis like the foundation-pile generator. */
function tubeFaces(id,p0,p1,diameterMm,segments=8){
  const axis=sub3(p1,p0),len=norm3(axis);if(!(len>1e-9))return[];
  const dir=unit3(axis),ref=Math.abs(dir[2])<.9?[0,0,1]:[0,1,0],u=unit3(cross3(ref,dir)),v=cross3(dir,u),r=mm(diameterMm)/2,top=[],bottom=[];
  for(let i=0;i<segments;i++){const a=2*Math.PI*i/segments,offset=add3(scale3(u,r*Math.cos(a)),scale3(v,r*Math.sin(a)));top.push(add3(p1,offset));bottom.push(add3(p0,offset));}
  const faces=[face(`${id}:cap0`,bottom,'cap'),face(`${id}:cap1`,[...top].reverse(),'cap')];
  for(let i=0;i<segments;i++){const j=(i+1)%segments;faces.push(face(`${id}:side${i}`,[bottom[i],bottom[j],top[j],top[i]],'side'));}
  return faces;
}

/**
 * Full rebar-cage geometry for one frame3d element: `layout` (see
 * rebarLayout.js) places the longitudinal bars, `stirrup` (see
 * rebarShapes.js's rectangularStirrupGeometry) sizes the closed loop drawn
 * every `stirrupSpacingMm` along the member. Each stirrup is drawn as 4
 * straight tube legs meeting at its corners — a schematic simplification
 * (no corner fillet in 3D, unlike the 2D shop-drawing outline) appropriate
 * for a structural visualization rather than a fabrication drawing.
 */
export function elementRebarCage3d({project,element,layout,stirrup,stirrupSpacingMm,startCoverMm=0,endCoverMm=0,segments=8}){
  const axes=elementAxes3D(project,element);if(!axes)return null;
  const spacing=positive('stirrupSpacingMm',stirrupSpacingMm),lengthM=axes.length,startM=mm(startCoverMm),endM=lengthM-mm(endCoverMm);
  if(!(endM>startM))throw new Error('RebarCage3D: cobrimento de topo+base excede o comprimento do elemento.');
  const pointAt=(xM,yMm,zMm)=>add3(add3(axes.a,scale3(axes.ex,xM)),add3(scale3(axes.ey,mm(yMm)),scale3(axes.ez,mm(zMm)))),elId=element.id;
  const longitudinalFaces=(layout?.positions||[]).flatMap(bar=>tubeFaces(`REBAR-${elId}-BAR${bar.id}`,pointAt(startM,bar.y,bar.z),pointAt(endM,bar.y,bar.z),bar.diameterMm,segments).map(f=>({...f,elementId:`REBAR-${elId}-BAR${bar.id}`,geometryType:'rebar-longitudinal'})));
  const halfW=stirrup.widthMm/2,halfH=stirrup.heightMm/2,corners=[[-halfW,-halfH],[halfW,-halfH],[halfW,halfH],[-halfW,halfH]];
  const stirrupCount=Math.max(0,Math.floor((endM-startM)/mm(spacing)))+1,stirrupFaces=[];
  for(let s=0;s<stirrupCount;s++){
    const xM=Math.min(endM,startM+s*mm(spacing)),pts=corners.map(([y,z])=>pointAt(xM,y,z)),sid=`REBAR-${elId}-STIRRUP${s+1}`;
    for(let i=0;i<4;i++){const j=(i+1)%4;stirrupFaces.push(...tubeFaces(`${sid}-L${i}`,pts[i],pts[j],stirrup.diameterMm,Math.max(4,Math.round(segments/2))).map(f=>({...f,elementId:sid,geometryType:'rebar-stirrup'})));}
  }
  return{type:'rebar-cage-3d',elementId:elId,barCount:(layout?.positions||[]).length,stirrupCount,faces:[...longitudinalFaces,...stirrupFaces]};
}

/** Builds cages for every frame3d element that has a cage spec in `cageByElementId` (Map or plain object keyed by element id, each value the {layout,stirrup,stirrupSpacingMm,...} options above). Elements without a spec are skipped, not guessed. */
export function projectRebarCages3d({project,cageByElementId}){
  const get=id=>cageByElementId instanceof Map?cageByElementId.get(id):cageByElementId?.[id],elements=(project?.elements||[]).filter(e=>e.type==='frame3d'&&get(e.id));
  const cages=elements.map(e=>elementRebarCage3d({project,element:e,...get(e.id)})).filter(Boolean);
  return{type:'rebar-cages-scene-3d',cages,faces:cages.flatMap(c=>c.faces),elementIdsWithCage:new Set(cages.map(c=>c.elementId))};
}
