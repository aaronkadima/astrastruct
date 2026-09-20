// Solid 3D geometry for foundations (isolated footings and pile caps), built
// from `project.foundationReview.items` (see web/src/foundation/review.js).
// Convention: Z is vertical (gravity = [0,0,-1], see corotational3dLoads.js);
// B (x) × L (y) is the footing's plan footprint; the foundation node sits at
// the TOP of the block, which extends downward by `h` to the block's
// underside, from which piles (if any) extend further down by their length.
//
// This module intentionally has NO opinion on which arrangement is "correct"
// for a given pile count — `standardPileCapLayout` in review.js only supplies
// a reasonable starting point; the actual pile positions/dimensions always
// come from the normalized `piles` array on the item.
import {add3,scale3} from './spatialView3d.js';
import {foundationReviewFromProject} from '../foundation/review.js';

const EPS=1e-9;
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const positive=(v,f=0)=>{const x=finite(v,NaN);return Number.isFinite(x)&&x>EPS?x:f};
function face(id,points,kind='side',extra={}){return{id,points,kind,center:points.reduce((a,p)=>add3(a,scale3(p,1/points.length)),[0,0,0]),...extra};}

function boxFaces(id,cx,cy,zTop,B,L,h){
  const x0=cx-B/2,x1=cx+B/2,y0=cy-L/2,y1=cy+L/2,zt=zTop,zb=zTop-h;
  const t=[[x0,y0,zt],[x1,y0,zt],[x1,y1,zt],[x0,y1,zt]],b=[[x0,y0,zb],[x1,y0,zb],[x1,y1,zb],[x0,y1,zb]];
  return[
    face(`${id}:top`,t,'top'),
    face(`${id}:bottom`,[b[3],b[2],b[1],b[0]],'bottom'),
    face(`${id}:x-`,[b[0],b[3],t[3],t[0]],'side'),
    face(`${id}:x+`,[b[1],b[2],t[2],t[1]],'side'),
    face(`${id}:y-`,[b[0],b[1],t[1],t[0]],'side'),
    face(`${id}:y+`,[b[3],b[2],t[2],t[3]],'side'),
  ];
}

/** Approximates a cylinder as an N-sided prism (N=12 by default — enough to read as round at typical zoom levels without inflating face count too much when many piles are present). */
function cylinderFaces(id,cx,cy,zTop,diameter,length,segments=12){
  const r=diameter/2,zt=zTop,zb=zTop-length,top=[],bottom=[];
  for(let i=0;i<segments;i++){const a=2*Math.PI*i/segments,x=cx+r*Math.cos(a),y=cy+r*Math.sin(a);top.push([x,y,zt]);bottom.push([x,y,zb]);}
  const faces=[face(`${id}:top`,top,'top'),face(`${id}:bottom`,[...bottom].reverse(),'bottom')];
  for(let i=0;i<segments;i++){const j=(i+1)%segments;faces.push(face(`${id}:side${i}`,[bottom[i],bottom[j],top[j],top[i]],'side'));}
  return faces;
}

/**
 * Builds the solid geometry for a single (already-normalized) foundation item.
 * Returns null when the block geometry (B,L,h) is incomplete — the caller
 * should fall back to the schematic support glyph in that case, since there
 * is nothing physically meaningful to draw yet.
 */
export function foundationItemSolidGeometry(item,node){
  if(!item||!node)return null;
  const B=positive(item.geometry?.B),L=positive(item.geometry?.L),h=positive(item.geometry?.h);
  if(!(B>0&&L>0&&h>0))return null;
  const cx=finite(node.x),cy=finite(node.y),zTop=finite(node.z),blockId=`FOUND-${item.id}`;
  const blockFaces=boxFaces(blockId,cx,cy,zTop,B,L,h).map(f=>({...f,elementId:blockId,foundationId:item.id,geometryType:'foundation-block'}));
  const piles=Array.isArray(item.piles)?item.piles:[],zBlockBottom=zTop-h;
  const pileFaces=piles.flatMap((pile,i)=>{
    const d=positive(pile.diameter),len=positive(pile.length);
    if(!(d>0&&len>0))return[];
    const pileId=`${blockId}:pile${i+1}`;
    return cylinderFaces(pileId,cx+finite(pile.dx),cy+finite(pile.dy),zBlockBottom,d,len).map(f=>({...f,elementId:pileId,foundationId:item.id,geometryType:'foundation-pile'}));
  });
  const builtPileCount=piles.filter(p=>positive(p.diameter)>0&&positive(p.length)>0).length;
  return{type:'foundation-solid-3d',foundationId:item.id,nodeId:item.nodeId,foundationType:item.type,hasPiles:pileFaces.length>0,declaredPileCount:piles.length,builtPileCount,faces:[...blockFaces,...pileFaces]};
}

/**
 * Builds the solid geometry for every foundation item in the project that has
 * complete block geometry. Also returns the set of node ids that ended up
 * with a solid, so the caller can suppress the schematic support glyph for
 * exactly those nodes (see the mutual-exclusion note in foundationReview.js /
 * SpatialCanvas3DCore.tsx) instead of duplicating both representations.
 */
export function foundationSolidScene3D(project={}){
  const review=foundationReviewFromProject(project),nodes=new Map((project?.nodes||[]).map(n=>[String(n.id),n]));
  const solids=review.items.map(item=>foundationItemSolidGeometry(item,item.nodeId!=null?nodes.get(String(item.nodeId)):null)).filter(Boolean);
  const nodesWithSolidFoundation=new Set(solids.filter(s=>s.nodeId!=null).map(s=>String(s.nodeId)));
  return{type:'foundation-solid-scene-3d',solids,faces:solids.flatMap(s=>s.faces),nodesWithSolidFoundation};
}

export function nodeHasSolidFoundation(scene,nodeId){return!!scene?.nodesWithSolidFoundation?.has(String(nodeId));}
