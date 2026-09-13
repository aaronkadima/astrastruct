import assert from 'node:assert/strict';
import {evaluateShell4Quality,evaluateShellMeshQuality} from '../web/src/core/shellQuality.js';

const base=(nodes,elements)=>({nodes,elements});
const rect=base([
  {id:'N1',x:0,y:0,z:0},{id:'N2',x:4,y:0,z:0},{id:'N3',x:4,y:3,z:0},{id:'N4',x:0,y:3,z:0}
],[{id:'S1',type:'shell4',nodeIds:['N1','N2','N3','N4'],n1:'N1',n2:'N2',n3:'N3',n4:'N4'}]);
const good=evaluateShell4Quality(rect,rect.elements[0]);assert.equal(good.status,'good');assert.ok(good.minJacobian>0);assert.ok(good.minScaledJacobian>.9);assert.ok(Math.abs(good.aspectRatio-4/3)<1e-12);assert.ok(good.warpage<1e-12);

const skew=base([
  {id:'A',x:0,y:0,z:0},{id:'B',x:8,y:0,z:0},{id:'C',x:8.2,y:.8,z:0},{id:'D',x:0,y:3,z:0}
],[{id:'S2',type:'shell4',nodeIds:['A','B','C','D'],n1:'A',n2:'B',n3:'C',n4:'D'}]);
const warning=evaluateShell4Quality(skew,skew.elements[0]);assert.equal(warning.status,'warning');assert.ok(warning.issues.length>0);

const crossed=base([
  {id:'A',x:0,y:0,z:0},{id:'B',x:4,y:3,z:0},{id:'C',x:4,y:0,z:0},{id:'D',x:0,y:3,z:0}
],[{id:'S3',type:'shell4',nodeIds:['A','B','C','D'],n1:'A',n2:'B',n3:'C',n4:'D'}]);
const bad=evaluateShell4Quality(crossed,crossed.elements[0]);assert.equal(bad.status,'invalid');assert.ok(bad.minJacobian<=0||bad.minScaledJacobian<=0);

const warped=base([
  {id:'A',x:0,y:0,z:0},{id:'B',x:4,y:0,z:0},{id:'C',x:4,y:3,z:.01},{id:'D',x:0,y:3,z:0}
],[{id:'S4',type:'shell4',nodeIds:['A','B','C','D'],n1:'A',n2:'B',n3:'C',n4:'D'}]);
const warp=evaluateShell4Quality(warped,warped.elements[0]);assert.equal(warp.status,'invalid');assert.ok(warp.warpage>warp.planarityLimit);

const missing=base([{id:'A',x:0,y:0,z:0}], [{id:'S5',type:'shell4',nodeIds:['A','B','C','D']}]);assert.equal(evaluateShell4Quality(missing,missing.elements[0]).status,'invalid');
const mesh=evaluateShellMeshQuality({...rect,elements:[rect.elements[0],skew.elements[0]],nodes:[...rect.nodes,...skew.nodes]});assert.equal(mesh.total,2);assert.equal(mesh.counts.good,1);assert.equal(mesh.counts.warning,1);assert.equal(mesh.counts.invalid,0);assert.equal(mesh.ok,true);
console.log('shell-quality-v030-smoke: OK');
