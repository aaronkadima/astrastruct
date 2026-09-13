import assert from 'node:assert/strict';
import { inspectDxfPlan, dxfToPlan } from '../web/src/core/dxfPlan.js';
import { createPlanBuilding3D } from '../web/src/core/exampleModels.js';

const dxf=`0
SECTION
2
HEADER
9
$INSUNITS
70
4
0
ENDSEC
0
SECTION
2
ENTITIES
0
LINE
8
GRID
10
0
20
0
11
5000
21
0
0
LINE
8
GRID
10
5000
20
0
11
5000
21
4000
0
LWPOLYLINE
8
BEAM
90
4
70
1
10
0
20
0
10
5000
20
0
10
5000
20
4000
10
0
20
4000
0
CIRCLE
8
ARCH
10
2500
20
2000
40
500
0
ENDSEC
0
EOF`;

const info=inspectDxfPlan(dxf);assert.equal(info.unitsCode,4);assert.equal(info.unitsLabel,'mm');assert.deepEqual(info.layers,['BEAM','GRID']);assert.equal(info.stats.supportedEntities,3);assert.equal(info.stats.segments,6);assert.equal(info.stats.unsupported.CIRCLE,1);
const plan=dxfToPlan(dxf,{layers:['BEAM'],tolerance:.01});assert.equal(plan.planNodes.length,4);assert.equal(plan.planEdges.length,4);assert.ok(Math.abs(plan.bounds.width-5)<1e-12);assert.ok(Math.abs(plan.bounds.height-4)<1e-12);
const all=dxfToPlan(dxf,{tolerance:.01});assert.equal(all.planEdges.length,4,'duplicate LINE/LWPOLYLINE edges should merge');
const building=createPlanBuilding3D({name:'DXF smoke',planNodes:plan.planNodes,planEdges:plan.planEdges,storeys:2,storeyHeight:3});assert.equal(building.nodes.length,12);assert.equal(building.supports.length,4);assert.equal(building.elements.length,16);assert.equal(building.meta.exampleKind,'building-plan');
console.log('dxf-plan-v030-smoke: OK');
