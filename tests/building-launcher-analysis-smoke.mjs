import assert from 'node:assert/strict';
import {createGridBuilding3D,createPlanBuilding3D} from '../web/src/core/exampleModels.js';
import {solve} from '../web/src/solver/index.js';

function mustSolve(project,label){
  let result;
  try{result=solve(project,project.settings?.analysisScenarioId||project.loadCases?.[0]?.id)}
  catch(error){throw new Error(`${label}: solver failed -> ${error?.message||error}`)}
  assert.ok(result?.displacements?.length, `${label}: displacements missing`);
  assert.equal(result.dimension,'3d', `${label}: expected 3d result`);
  return result;
}

const defaultGrid=createGridBuilding3D();
mustSolve(defaultGrid,'default launcher grid');

const configuredGrid=createGridBuilding3D({
  xSpans:[4,6],ySpans:[5],storeys:2,storeyHeights:[3.2,3],
  columnWidth:.35,columnHeight:.65,beamXWidth:.25,beamXHeight:.55,beamYWidth:.30,beamYHeight:.50,
  slabThickness:.18,concreteFck:40,concreteE:34e6,analysisType:'linear',baseSupport:'fixed',
  foundation:{type:'pileCap',B:1.8,L:2,h:.8,pileCount:4,pileDiameter:.45,pileLength:10,pileSpacing:1.35,qDesign:250}
});
const configuredResult=mustSolve(configuredGrid,'configured launcher grid');
assert.ok(Math.max(...configuredResult.displacements.map(d=>Math.abs(Number(d.ux)||0)))<1e-10,'gravity-only configured grid should keep Ux approximately zero');
const requestedPDeltaWithSlabs=createGridBuilding3D({storeys:2,analysisType:'pdelta',includeSlabs:true});assert.equal(requestedPDeltaWithSlabs.settings.analysisType,'linear');mustSolve(requestedPDeltaWithSlabs,'pdelta request with shell fallback');
const lateralRigid=createGridBuilding3D({xSpans:[4,4],ySpans:[4],storeys:3,includeSlabs:true,diaphragmMode:'rigid',floorLoadXPerNode:5});
assert.equal(lateralRigid.settings.analysisScenarioId,'SERV_X');assert.equal(lateralRigid.diaphragms.length,3);
const lateralRigidResult=mustSolve(lateralRigid,'rigid-diaphragm lateral X launcher grid');
assert.ok(Math.max(...lateralRigidResult.displacements.map(d=>Math.abs(Number(d.ux)||0)))>1e-8,'lateral X case must produce nonzero Ux');
assert.equal(lateralRigidResult.diaphragms?.active,true);
const elasticBase=createGridBuilding3D({xSpans:[4],ySpans:[4],storeys:1,includeSlabs:false,floorLoadXPerNode:3,baseSupport:'elastic',baseSpring:{kx:120000,ky:120000,kz:300000,krx:0,kry:0,krz:0}});
const elasticResult=mustSolve(elasticBase,'elastic-base lateral X launcher grid');
assert.ok(elasticResult.springForces.length===elasticBase.nodeSprings.length);
assert.ok(Math.max(...elasticResult.displacements.map(d=>Math.abs(Number(d.ux)||0)))>1e-8);
const frameOnlyPDelta=createGridBuilding3D({storeys:2,analysisType:'pdelta',includeSlabs:false,floorLoadXPerNode:2});assert.equal(frameOnlyPDelta.settings.analysisType,'pdelta');const frameOnlyPDeltaResult=mustSolve(frameOnlyPDelta,'frame-only pdelta launcher grid');assert.equal(frameOnlyPDeltaResult.diaphragms?.active,true);assert.equal(frameOnlyPDeltaResult.diaphragms?.count,2);assert.ok(Math.max(...frameOnlyPDeltaResult.displacements.map(d=>Math.abs(Number(d.ux)||0)))>1e-8);
const unsupportedCorotRigid=createGridBuilding3D({xSpans:[4],ySpans:[4],storeys:1,includeSlabs:false,analysisType:'linear',diaphragmMode:'rigid'});unsupportedCorotRigid.settings.analysisType='corotational';assert.throws(()=>solve(unsupportedCorotRigid,unsupportedCorotRigid.settings.analysisScenarioId),/diafragma rígido MPC/);

const plan=createPlanBuilding3D({
  planNodes:[{id:'A',x:0,y:0},{id:'B',x:5,y:0},{id:'C',x:5,y:4}],
  planEdges:[{n1:'A',n2:'B'},{n1:'B',n2:'C'}],
  storeys:2,columnWidth:.35,columnHeight:.60,beamWidth:.25,beamHeight:.50,
  foundation:{type:'footing',B:1.5,L:1.5,h:.5,qDesign:220}
});
mustSolve(plan,'configured launcher plan');

console.log('building launcher analysis smoke: OK');
