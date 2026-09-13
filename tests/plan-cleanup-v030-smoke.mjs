import assert from 'node:assert/strict';
import { cleanPlanGeometry } from '../web/src/core/planCleanup.js';

const nodes=[
  {id:'P1',x:.0004,y:.0004},
  {id:'P2',x:2.0004,y:.0007},
  {id:'P3',x:4.0002,y:.0003},
  {id:'P4',x:2.004,y:.0006}
];
const edges=[
  {id:'L1',n1:'P1',n2:'P2',layer:'GRID'},
  {id:'L2',n1:'P2',n2:'P3',layer:'GRID'},
  {id:'L3',n1:'P2',n2:'P4',layer:'GRID'},
  {id:'L4',n1:'P3',n2:'P2',layer:'GRID'}
];

// Snap + merge + duplicate/short removal + collinear simplification collapses a
// noisy straight structural axis to one auditable centerline.
{
  const c=cleanPlanGeometry(nodes,edges,{snapGrid:.001,mergeTolerance:.01,minLength:.02,orthogonalAngleDeg:1,mergeCollinear:true,collinearAngleDeg:1});
  assert.equal(c.planNodes.length,2);
  assert.equal(c.planEdges.length,1);
  assert.ok(c.stats.snappedNodes>=1);
  assert.ok(c.stats.mergedVertices>=1);
  assert.ok(c.stats.duplicateEdgesRemoved+c.stats.degenerateEdgesRemoved>=1);
  assert.ok(c.stats.collinearVerticesRemoved>=1);
  assert.ok(Math.abs(c.bounds.width-4)<=.002);
}

// Layer boundaries are semantic: two collinear members on different layers must
// remain separate, because layers may encode different structural families.
{
  const c=cleanPlanGeometry(
    [{id:'A',x:0,y:0},{id:'B',x:2,y:0},{id:'C',x:4,y:0}],
    [{id:'AB',n1:'A',n2:'B',layer:'BEAM'},{id:'BC',n1:'B',n2:'C',layer:'WALL'}],
    {mergeTolerance:.001,minLength:.01,mergeCollinear:true}
  );
  assert.equal(c.planNodes.length,3);
  assert.equal(c.planEdges.length,2);
  assert.equal(c.stats.collinearVerticesRemoved,0);
}

// Orthogonal correction acts only inside the requested angular tolerance and
// keeps the plan finite and connected.
{
  const c=cleanPlanGeometry(
    [{id:'A',x:0,y:0},{id:'B',x:5,y:.04},{id:'C',x:5.03,y:4}],
    [{id:'H',n1:'A',n2:'B',layer:'AXIS'},{id:'V',n1:'B',n2:'C',layer:'AXIS'}],
    {orthogonalAngleDeg:1,mergeTolerance:.001,minLength:.01,mergeCollinear:false}
  );
  assert.ok(c.stats.orthogonalizedNodes>=2);
  assert.equal(c.planEdges.length,2);
  for(const n of c.planNodes){assert.ok(Number.isFinite(n.x));assert.ok(Number.isFinite(n.y))}
}

console.log('plan-cleanup-v030-smoke: OK');
