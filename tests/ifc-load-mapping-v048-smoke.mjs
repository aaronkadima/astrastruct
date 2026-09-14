import assert from 'node:assert/strict';
import {createIfcStructuralLoadMapping,validateIfcStructuralLoadMapping,summarizeIfcStructuralLoadMapping,IFC_LOAD_EXCHANGE_CONTRACT,IFC_LOAD_EXCHANGE_VERSION} from '../web/src/interop/index.js';

const project={
  id:'IFC-LOADS-V048',name:'IFC loads v0.48',units:'kN-m-MPa',
  nodes:[{id:'N1',x:0,y:0,z:0},{id:'N2',x:4,y:0,z:0},{id:'N3',x:4,y:3,z:0}],
  elements:[{id:'E1',type:'frame3d',n1:'N1',n2:'N2'},{id:'E2',type:'frame2d',n1:'N2',n2:'N3'}],
  loadCases:[{id:'G',name:'Permanent',type:'permanent'},{id:'Q',name:'Variable',type:'variable'},{id:'U',name:'User',type:'user'}],
  loads:[
    {id:'LG',caseId:'G',nodeId:'N2',fx:10,fy:-30,fz:-5,mx:1,my:2,mz:3},
    {id:'LQ',caseId:'Q',nodeId:'N3',fx:25,fy:0,fz:0,mx:0,my:0,mz:0}
  ],
  elementLoads:[{id:'EG',caseId:'G',elementId:'E1',kind:'uniform',qx:2,qy:-8,qz:-3}],
  loadCombinations:[{id:'ULS',name:'ULS custom',type:'custom',terms:[{caseId:'G',factor:1},{caseId:'G',factor:.2},{caseId:'Q',factor:1.5}]}],
  settlements:[]
};

const mapping=createIfcStructuralLoadMapping(project);
assert.equal(mapping.contract,IFC_LOAD_EXCHANGE_CONTRACT);assert.equal(mapping.version,IFC_LOAD_EXCHANGE_VERSION);assert.equal(validateIfcStructuralLoadMapping(mapping),true);assert.equal(mapping.ready,true);
assert.deepEqual(summarizeIfcStructuralLoadMapping(mapping),{cases:3,combinations:1,actions:3,pointActions:2,linearActions:1,caseAssignments:3,combinationFactors:2,activityConnections:3,pending:0,blocking:0,warnings:0,ready:true,unitSystem:'kN-m-MPa'});

const G=mapping.cases.find(x=>x.sourceId==='G'),Q=mapping.cases.find(x=>x.sourceId==='Q'),U=mapping.cases.find(x=>x.sourceId==='U');
assert.equal(G.actionType,'PERMANENT_G');assert.equal(Q.actionType,'VARIABLE_Q');assert.equal(U.actionType,'NOTDEFINED','tipo user não deve virar USERDEFINED sem ObjectType explícito');
assert.equal(G.actionSource,'NOTDEFINED');assert.equal(G.coefficient,1);

const point=mapping.actions.find(x=>x.sourceId==='LG');
assert.equal(point.ifcClass,'IfcStructuralPointAction');assert.equal(point.globalOrLocal,'GLOBAL_COORDS');assert.equal(point.targetRef,'node:N2');assert.equal(point.appliedLoad.ifcClass,'IfcStructuralLoadSingleForce');
assert.deepEqual([point.appliedLoad.forceX,point.appliedLoad.forceY,point.appliedLoad.forceZ,point.appliedLoad.momentX,point.appliedLoad.momentY,point.appliedLoad.momentZ],[10,-30,-5,1,2,3]);

const linear=mapping.actions.find(x=>x.sourceId==='EG');
assert.equal(linear.ifcClass,'IfcStructuralLinearAction');assert.equal(linear.predefinedType,'CONST');assert.equal(linear.globalOrLocal,'LOCAL_COORDS');assert.equal(linear.projectedOrTrue,null);assert.equal(linear.targetRef,'member:E1');assert.equal(linear.appliedLoad.ifcClass,'IfcStructuralLoadLinearForce');
assert.deepEqual([linear.appliedLoad.linearForceX,linear.appliedLoad.linearForceY,linear.appliedLoad.linearForceZ],[2,-8,-3]);

const uls=mapping.combinations[0];assert.deepEqual(uls.terms,[{caseId:'G',factor:1.2},{caseId:'Q',factor:1.5}]);assert.equal(uls.predefinedType,'LOAD_COMBINATION');
assert.equal(mapping.relationships.combinationFactors.find(x=>x.source.caseId==='G').factor,1.2);assert.ok(mapping.relationships.combinationFactors.every(x=>x.ifcClass==='IfcRelAssignsToGroupByFactor'));
assert.ok(mapping.relationships.caseAssignments.every(x=>x.ifcClass==='IfcRelAssignsToGroup'));assert.ok(mapping.relationships.activityConnections.every(x=>x.ifcClass==='IfcRelConnectsStructuralActivity'));

const implicit=createIfcStructuralLoadMapping({...project,loads:[{id:'L0',nodeId:'N1',fx:1}],elementLoads:[],loadCombinations:[]});
assert.equal(implicit.actions[0].caseRef,'load-case:G');assert.ok(implicit.warnings.some(x=>x.code==='IMPLICIT_FIRST_LOAD_CASE'));

const zero=createIfcStructuralLoadMapping({...project,loads:[{id:'LZ',caseId:'G',nodeId:'N1',fx:0,fy:0}],elementLoads:[],loadCombinations:[]});
assert.equal(zero.actions.length,0);assert.ok(zero.warnings.some(x=>x.code==='ZERO_LOAD_OMITTED'));

const unsupported=createIfcStructuralLoadMapping({...project,loads:[],elementLoads:[{id:'P1',caseId:'G',elementId:'E1',kind:'point',px:10,py:0,xi:.5}],loadCombinations:[]});
assert.equal(unsupported.ready,false);assert.ok(unsupported.issues.some(x=>x.code==='ELEMENT_LOAD_KIND_UNSUPPORTED'));assert.equal(unsupported.pending.length,1);

const trussUniform=createIfcStructuralLoadMapping({...project,elements:[{id:'T1',type:'truss3d',n1:'N1',n2:'N2'}],loads:[],elementLoads:[{id:'TU',caseId:'G',elementId:'T1',kind:'uniform',qx:2}],loadCombinations:[]});
assert.equal(trussUniform.ready,false);assert.ok(trussUniform.issues.some(x=>x.code==='UNIFORM_LOAD_TARGET_UNSUPPORTED'));

const settlement=createIfcStructuralLoadMapping({...project,loads:[],elementLoads:[],loadCombinations:[],settlements:[{id:'S1',caseId:'G',nodeId:'N1',uy:-.01}]});
assert.equal(settlement.ready,false);assert.ok(settlement.issues.some(x=>x.code==='SETTLEMENT_EXCHANGE_PENDING'));

const badCombo=createIfcStructuralLoadMapping({...project,loads:[],elementLoads:[],loadCombinations:[{id:'BAD',terms:[{caseId:'NOPE',factor:1.2}]}]});
assert.equal(badCombo.ready,false);assert.ok(badCombo.issues.some(x=>x.code==='COMBINATION_CASE_UNRESOLVED'));assert.ok(badCombo.issues.some(x=>x.code==='COMBINATION_EMPTY'));

assert.throws(()=>createIfcStructuralLoadMapping({...project,loadCases:[{id:'G'},{id:'G'}]}),/loadCase duplicado G/);

console.log('AstraStruct v0.48 IFC load mapping smoke: load cases, global nodal actions, local uniform curve actions and factored combinations coherent.');
