import assert from 'node:assert/strict';
import {normalizeFoundationItem,standardPileCapLayout} from '../web/src/foundation/review.js';
import {foundationItemSolidGeometry,foundationSolidScene3D,nodeHasSolidFoundation} from '../web/src/view/foundationSolid3d.js';

// --- standardPileCapLayout: generic textbook arrangements, not a normative table ---
for(const n of [1,2,3,4,5,6]){
  const layout=standardPileCapLayout(n,1);
  assert.equal(layout.length,n,`layout for ${n} piles has ${n} entries`);
  for(const p of layout){assert.ok(Number.isFinite(p.dx)&&Number.isFinite(p.dy),`pile offset finite for n=${n}`);}
}
// A count with no dedicated layout falls back to the 6-pile grid rather than throwing.
assert.equal(standardPileCapLayout(9,1).length,6,'unsupported count falls back to the 6-pile layout');

// --- normalizeFoundationItem: piles must survive normalization (regression for
// the bug where ssi.js already read item.piles but review.js silently dropped it) ---
const raw={id:'F1',nodeId:'N1',type:'pileCap',geometry:{B:1.6,L:1.6,h:0.8},piles:standardPileCapLayout(4,0.9).map(p=>({...p,diameter:0.4,length:12}))};
const item=normalizeFoundationItem(raw,{nodes:[{id:'N1',x:0,y:0,z:0}]});
assert.equal(item.type,'pileCap');
assert.equal(item.piles.length,4,'piles survive normalizeFoundationItem');
assert.ok(item.piles.every(p=>p.diameter===0.4&&p.length===12));
// Unknown type strings fall back to 'footing' rather than propagating garbage.
assert.equal(normalizeFoundationItem({type:'not-a-real-type'},{}).type,'footing');

// --- foundationItemSolidGeometry: geometric contract ---
const node={id:'N1',x:2,y:3,z:0};
const pileCapItem=normalizeFoundationItem({id:'F1',nodeId:'N1',type:'pileCap',geometry:{B:1.6,L:1.6,h:0.8},piles:[{dx:-0.45,dy:-0.45,diameter:0.4,length:12},{dx:0.45,dy:-0.45,diameter:0.4,length:12},{dx:0.45,dy:0.45,diameter:0.4,length:12},{dx:-0.45,dy:0.45,diameter:0.4,length:12}]},{nodes:[node]});
const solid=foundationItemSolidGeometry(pileCapItem,node);
assert.ok(solid,'pile cap with complete geometry produces a solid');
assert.equal(solid.builtPileCount,4);
assert.ok(solid.hasPiles);

const blockTop=solid.faces.find(f=>f.geometryType==='foundation-block'&&f.id.endsWith(':top'));
const blockBottom=solid.faces.find(f=>f.geometryType==='foundation-block'&&f.id.endsWith(':bottom'));
assert.ok(blockTop.points.every(p=>Math.abs(p[2]-node.z)<1e-9),'block top sits at the node elevation (block top = support top)');
assert.ok(blockBottom.points.every(p=>Math.abs(p[2]-(node.z-0.8))<1e-9),'block bottom sits h below the node');
assert.ok(blockTop.points.some(p=>Math.abs(p[0]-(node.x+0.8))<1e-9),'block half-width B/2 offset from node.x is correct');

const pileTop=solid.faces.find(f=>f.geometryType==='foundation-pile'&&f.id.includes('pile1')&&f.id.endsWith(':top'));
const pileBottom=solid.faces.find(f=>f.geometryType==='foundation-pile'&&f.id.includes('pile1')&&f.id.endsWith(':bottom'));
assert.ok(pileTop.points.every(p=>Math.abs(p[2]-(node.z-0.8))<1e-9),'pile top sits exactly at the block underside, not at the node');
assert.ok(pileBottom.points.every(p=>Math.abs(p[2]-(node.z-0.8-12))<1e-9),'pile bottom sits `length` below the block underside');
assert.ok(pileTop.points.every(p=>Math.hypot(p[0]-(node.x-0.45),p[1]-(node.y-0.45))<0.21),'pile is centered at its (dx,dy) offset within its own radius');

// --- Isolated footing with no piles at all still produces a solid (block only) ---
const footingItem=normalizeFoundationItem({id:'F2',nodeId:'N1',type:'footing',geometry:{B:1.2,L:1.2,h:0.5}},{nodes:[node]});
const footingSolid=foundationItemSolidGeometry(footingItem,node);
assert.ok(footingSolid&&!footingSolid.hasPiles&&footingSolid.builtPileCount===0,'footing with no piles produces a block-only solid');

// --- Incomplete geometry must return null so the caller keeps the schematic glyph ---
const incomplete=normalizeFoundationItem({id:'F3',nodeId:'N1',type:'footing',geometry:{B:1.2}},{nodes:[node]}); // missing L, h
assert.equal(foundationItemSolidGeometry(incomplete,node),null,'incomplete block geometry yields no solid (caller must fall back to schematic support)');
assert.equal(foundationItemSolidGeometry(pileCapItem,null),null,'missing node yields no solid');

// --- foundationSolidScene3D / nodeHasSolidFoundation: the mutual-exclusion contract ---
const project={
  nodes:[{id:'N1',x:0,y:0,z:0},{id:'N2',x:6,y:0,z:0},{id:'N3',x:12,y:0,z:0}],
  foundationReview:{items:[
    {id:'F1',nodeId:'N1',type:'pileCap',geometry:{B:1.6,L:1.6,h:0.8},piles:standardPileCapLayout(4,0.9).map(p=>({...p,diameter:0.4,length:12}))},
    {id:'F2',nodeId:'N2',type:'footing',geometry:{B:1.2,L:1.2,h:0.5}},
    {id:'F3',nodeId:'N3',type:'footing',geometry:{}}, // declared but incomplete
  ]}
};
const scene=foundationSolidScene3D(project);
assert.equal(scene.solids.length,2,'only nodes with complete geometry produce solids');
assert.ok(nodeHasSolidFoundation(scene,'N1'),'N1 (pile cap) has a solid foundation');
assert.ok(nodeHasSolidFoundation(scene,'N2'),'N2 (footing) has a solid foundation');
assert.ok(!nodeHasSolidFoundation(scene,'N3'),'N3 (incomplete geometry) has NO solid foundation — schematic glyph must remain');
assert.ok(!nodeHasSolidFoundation(scene,'N4'),'a node with no foundation item at all has no solid foundation');

console.log('foundation solid 3D (block/footing + piles) smoke: OK',{pileCapFaces:solid.faces.length,footingFaces:footingSolid.faces.length,sceneSolids:scene.solids.length});
