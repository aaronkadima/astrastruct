import assert from 'node:assert/strict';
import {buildShellContourData,isDisplacementShellField,shellContourValueAt,shellFieldUnit} from '../app/src/spatialShellContours.ts';

const shell={id:'S1',type:'shell4',nodeIds:['N1','N2','N3','N4']};
const project={
  nodes:[
    {id:'N1',x:0,y:0,z:0},{id:'N2',x:4,y:0,z:0},
    {id:'N3',x:4,y:3,z:0},{id:'N4',x:0,y:3,z:0},
    {id:'FRAME_ONLY',x:20,y:20,z:20},
  ],
  elements:[shell,{id:'E1',type:'frame3d',n1:'N1',n2:'FRAME_ONLY'}],
};
const result={displacements:[
  {nodeId:'N1',ux:0,uy:0,uz:0},
  {nodeId:'N2',ux:.01,uy:0,uz:-.02},
  {nodeId:'N3',ux:.02,uy:.01,uz:-.02},
  {nodeId:'N4',ux:0,uy:.01,uz:-.01},
  {nodeId:'FRAME_ONLY',ux:999,uy:999,uz:999},
]};

assert.equal(isDisplacementShellField('Ux'),true);
assert.equal(isDisplacementShellField('Mx'),false);
assert.equal(shellFieldUnit('Umag'),'m');

const ux=buildShellContourData(project,result,'Ux','nodal');
assert.equal(ux.source,'nodal-displacement-exact');
assert.equal(ux.isDisplacement,true);
assert.deepEqual(ux.range,{min:0,max:.02,maxAbs:.02},'range must use shell-connected nodes only');
assert.equal(shellContourValueAt(ux,shell,0,0),.0075,'center follows bilinear shell interpolation');
assert.ok(Math.abs(shellContourValueAt(ux,shell,1,1)-.02)<1e-12,'natural corner maps to the exact nodal DOF');

const magnitude=buildShellContourData(project,result,'Umag','nodal');
assert.equal(magnitude.range.min,0);
assert.ok(Math.abs(magnitude.range.max-.03)<1e-12,'total displacement is the nodal vector magnitude');

const translated=buildShellContourData(project,result,'Uz','center',node=>[node.x+10,node.y-2,node.z+5]);
assert.deepEqual(translated.extrema[0].point,[12,-.5,5],'contour extrema follow transformed/deformed geometry');
assert.equal(shellContourValueAt(translated,shell,.8,-.4),translated.center.S1,'center display remains constant per element');

console.log('v0.30 shell displacement contour smoke: OK');
