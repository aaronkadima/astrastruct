import assert from'node:assert/strict';
import{buildingEluElsDashboard,ELU_ELS_DASHBOARD_CONTRACT,ELU_ELS_DASHBOARD_VERSION}from'../web/src/projectWorkflow/eluElsDashboard.js';

const project={
  levels:[{id:'L0',name:'Base',elevation:0},{id:'L1',name:'Pavimento 1',elevation:3}],
  nodes:[{id:'N0',x:0,y:0,z:0},{id:'N1',x:0,y:0,z:3},{id:'N2',x:5,y:0,z:3},{id:'N3',x:5,y:4,z:3}],
  elements:[
    {id:'B1',label:'Viga B1',type:'frame3d',n1:'N1',n2:'N2',levelId:'L1'},
    {id:'C1',label:'Pilar C1',type:'frame3d',n1:'N0',n2:'N1',levelId:'L1'},
    {id:'S1',label:'Laje S1',type:'shell4',nodeIds:['N1','N2','N3','N1'],levelId:'L1'}
  ],
  codeChecks:[
    {contract:'code-design-check/v1',id:'B1-ULS',elementId:'B1',discipline:'RC',limitState:'Flexão resistente',details:{limitStateCategory:'ELU'},demand:80,resistance:100,utilization:.8,ok:true,unit:'kN·m'},
    {contract:'code-design-check/v1',id:'B1-SLS',elementId:'B1',discipline:'RC',limitState:'Flecha em serviço',details:{limitStateCategory:'ELS'},demand:12,resistance:20,utilization:.6,ok:true,unit:'mm'},
    {contract:'code-design-check/v1',id:'C1-ULS',elementId:'C1',discipline:'RC',limitState:'Compressão ELU',details:{limitStateCategory:'ELU'},demand:110,resistance:100,utilization:1.1,ok:false,unit:'kN'}
  ],
  settings:{analysisType:'linear'},
  results:{analysisType:'linear',type:'linear3d',dimension:'3d',displacements:[{nodeId:'N0',ux:0,uy:0,uz:0},{nodeId:'N1',ux:.001,uy:0,uz:0},{nodeId:'N2',ux:.001,uy:-.006,uz:0},{nodeId:'N3',ux:.001,uy:-.004,uz:0}],elementForces:[{elementId:'B1',type:'frame3d',N1:40,Vy1:25,Vz1:5,My1:30,Mz1:80,T1:2},{elementId:'S1',type:'shell4',membraneResultants:{Nx:30,Ny:20,Nxy:4},bendingMoments:{Mx:8,My:6,Mxy:1},transverseShear:{Qx:12,Qy:9}}]}
};
const d=buildingEluElsDashboard(project);
assert.equal(d.contract,ELU_ELS_DASHBOARD_CONTRACT);assert.equal(d.version,ELU_ELS_DASHBOARD_VERSION);
const b=d.rows.find(r=>r.entityId==='B1'),c=d.rows.find(r=>r.entityId==='C1'),s=d.rows.find(r=>r.entityId==='S1');
assert.equal(b.group,'beam');assert.equal(b.elu.status,'PASS');assert.equal(b.els.status,'PASS');assert.equal(b.status,'READY_FOR_REVIEW');assert.equal(b.response.state,'READY');assert.ok(b.response.uMaxMm>6&&b.response.uMaxMm<6.1);assert.ok(b.response.relativeEndMm>5.9);assert.equal(b.governing.id,'B1-ULS');
assert.equal(c.group,'column');assert.equal(c.elu.status,'FAIL');assert.equal(c.els.status,'PENDING');assert.equal(c.status,'FAIL');
assert.equal(s.group,'slab');assert.equal(s.elu.status,'PENDING');assert.equal(s.els.status,'PENDING');assert.equal(s.status,'PENDING');assert.equal(s.response.force.kind,'shell');
assert.ok(d.tree.some(l=>l.id==='L1'&&l.groups.some(g=>g.id==='beam')));assert.equal(d.summary.readyForReview,1);assert.equal(d.summary.fail,1);assert.ok(d.governance.missingElsNeverPasses);
const modal=buildingEluElsDashboard(project,{analysisType:'modal',type:'modal3d',displacements:[{nodeId:'N1',ux:1,uy:0,uz:0},{nodeId:'N2',ux:1,uy:1,uz:0}]});const bm=modal.rows.find(r=>r.entityId==='B1');assert.equal(bm.response.state,'MODE_ONLY');assert.equal(bm.status,'PENDING');assert.equal(bm.response.uMaxMm,null);
const noChecks=buildingEluElsDashboard({...project,codeChecks:[],results:project.results});assert.ok(noChecks.rows.filter(r=>r.group!=='foundation').every(r=>r.status==='PENDING'));
console.log('AstraStruct v0.53.7 ELU/ELS dashboard smoke: level/category indexing, explicit ULS/SLS checks, physical deformation evidence and no-pass-on-missing-data rules coherent.');
