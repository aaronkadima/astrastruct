import assert from 'node:assert/strict';
import {refineShell4Mesh} from '../web/src/core/shellRefinement.js';

const nodes=[
  {id:'N1',x:0,y:0,z:0,levelId:'L0'},{id:'N2',x:4,y:0,z:0,levelId:'L0'},{id:'N3',x:8,y:0,z:0,levelId:'L0'},
  {id:'N4',x:0,y:3,z:0,levelId:'L0'},{id:'N5',x:4,y:3,z:0,levelId:'L0'},{id:'N6',x:8,y:3,z:0,levelId:'L0'}
];
const project={nodes,elements:[
  {id:'S1',type:'shell4',nodeIds:['N1','N2','N5','N4'],n1:'N1',n2:'N2',n3:'N5',n4:'N4',materialId:'C',thickness:.2,levelId:'L0',label:'Painel 1'},
  {id:'S2',type:'shell4',nodeIds:['N2','N3','N6','N5'],n1:'N2',n2:'N3',n3:'N6',n4:'N5',materialId:'C',thickness:.2,levelId:'L0',label:'Painel 2'}
],elementLoads:[{id:'P1',caseId:'LC1',elementId:'S1',kind:'surface',pressure:-5},{id:'P2',caseId:'LC1',elementId:'S2',kind:'surface',pressure:-7}],settings:{analysisType:'modal'},meta:{}};

const refined=refineShell4Mesh(project,{levelId:'L0',divisionsX:2,divisionsY:2}),p=refined.project;
assert.equal(refined.report.sourceShells,2);
assert.equal(refined.report.childShells,8);
assert.equal(refined.report.createdNodes,9,'shared edge midpoint must be reused between adjacent parent panels');
assert.equal(p.nodes.length,15);
assert.equal(p.elements.length,8);
assert.equal(p.elementLoads.length,8);
assert.equal(p.settings.analysisType,'modal','modal analysis should remain selected after compatible refinement');
assert.ok(refined.report.areaRelativeError<1e-12);
assert.ok(Math.abs(refined.report.areaBefore-24)<1e-12);
assert.ok(Math.abs(refined.report.areaAfter-24)<1e-12);

const coordKey=n=>`${Number(n.x).toFixed(8)}|${Number(n.y).toFixed(8)}|${Number(n.z||0).toFixed(8)}`;
assert.equal(new Set(p.nodes.map(coordKey)).size,p.nodes.length,'refinement must not duplicate coincident nodes');
const shared=p.nodes.filter(n=>Math.abs(n.x-4)<1e-10&&Math.abs(n.y-1.5)<1e-10&&Math.abs((n.z||0))<1e-10);assert.equal(shared.length,1,'adjacent panels must share the same generated edge node');
assert.equal(p.elements.filter(e=>e.parentShellId==='S1').length,4);assert.equal(p.elements.filter(e=>e.parentShellId==='S2').length,4);
assert.equal(p.elementLoads.filter(l=>l.pressure===-5).length,4);assert.equal(p.elementLoads.filter(l=>l.pressure===-7).length,4);
for(const e of p.elements){assert.equal(e.nodeIds.length,4);assert.equal(new Set(e.nodeIds).size,4)}

const one=refineShell4Mesh(project,{elementIds:['S1'],divisionsX:3,divisionsY:1}).project;
assert.equal(one.elements.filter(e=>e.parentShellId==='S1').length,3);assert.ok(one.elements.some(e=>e.id==='S2'),'unselected shell must remain untouched');assert.equal(one.elementLoads.filter(l=>l.pressure===-5).length,3);assert.equal(one.elementLoads.filter(l=>l.elementId==='S2').length,1);
assert.throws(()=>refineShell4Mesh(project,{elementIds:['missing'],divisionsX:2,divisionsY:2}),/nenhum elemento selecionado/i);
assert.throws(()=>refineShell4Mesh(project,{divisionsX:1,divisionsY:1}),/pelo menos 2 divisões/i);
console.log('shell-refinement-v030-smoke: OK');
