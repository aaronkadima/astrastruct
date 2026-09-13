import assert from 'node:assert/strict';
import {emptyProject,makeFrame3DElement,normalizeProject} from '../web/src/core/model.js';

const p=emptyProject();p.nodes=[{id:'N1',x:0,y:0,z:0},{id:'N2',x:1,y:0,z:0}];p.elements=[makeFrame3DElement({id:'E1',n1:'N1',n2:'N2'})];
p.nodeSprings=[{id:'SZ',nodeId:'N2',kz:321.5},{id:'SR',nodeId:'N1',krx:11,kry:12,krz:13}];
p.nodalMasses=[{id:'MZ',nodeId:'N2',mz:2.3,mrx:.4,mry:.5,mrz:.6}];
p.elementLoads=[{id:'F',caseId:'LC1',elementId:'E1',kind:'followerEnd',end:2,px:1,py:2,pz:3}];
p.elements[0].releases={ry1:true,rz2:true};p.elements[0].rotationalSprings={rx1:100,ry1:200,rz1:300,rx2:400,ry2:500,rz2:600};
const n=normalizeProject(p);
assert.equal(n.nodeSprings.length,2,'3D-only springs must not be filtered');
assert.equal(n.nodeSprings.find(x=>x.id==='SZ').kz,321.5);assert.equal(n.nodeSprings.find(x=>x.id==='SR').krx,11);assert.equal(n.nodeSprings.find(x=>x.id==='SR').kry,12);assert.equal(n.nodeSprings.find(x=>x.id==='SR').krz,13);
assert.equal(n.nodalMasses.length,1,'3D-only nodal mass must not be filtered');const m=n.nodalMasses[0];assert.equal(m.mz,2.3);assert.equal(m.mrx,.4);assert.equal(m.mry,.5);assert.equal(m.mrz,.6);
assert.equal(n.elementLoads[0].pz,3,'follower pz must be normalized');
const e=n.elements[0];for(const key of ['rx1','ry1','rz1','rx2','ry2','rz2'])assert.ok(key in e.releases,`release ${key} missing`);assert.equal(e.releases.ry1,true);assert.equal(e.releases.rz2,true);assert.equal(e.rotationalSprings.ry1,0,'release overrides spring');assert.equal(e.rotationalSprings.rz2,0,'release overrides spring');assert.equal(e.rotationalSprings.rx1,100);assert.equal(e.rotationalSprings.rx2,400);
const fresh=makeFrame3DElement({id:'E2',n1:'N1',n2:'N2'});for(const key of ['rx1','ry1','rz1','rx2','ry2','rz2']){assert.equal(fresh.releases[key],false);assert.equal(fresh.rotationalSprings[key],null)}
console.log('v0.30 3D model normalization smoke: OK');
