import assert from'node:assert/strict';
import{elementAppearance,withElementAppearance,applyAppearanceToType,appearanceSummary}from'../web/src/visualization/appearance.js';
import{createRebarSheetsFromSchedule,updateSheetEntity,exportDrawingSheetSvg,withDrawingSheets}from'../web/src/detailing/sheets.js';
import{foundationReviewFromProject,itemsFromSupports,reviewFoundationProject,withFoundationReview}from'../web/src/foundation/review.js';

const project={id:'P52',nodes:[{id:'N1',x:0,y:0,z:0},{id:'N2',x:4,y:0,z:0},{id:'N3',x:4,y:4,z:0},{id:'N4',x:0,y:4,z:0}],elements:[{id:'E1',type:'frame3d',n1:'N1',n2:'N2'},{id:'E2',type:'frame3d',n1:'N2',n2:'N3'},{id:'S1',type:'shell4',nodeIds:['N1','N2','N3','N4']}],supports:[{nodeId:'N1',ux:true,uy:true,uz:true}]};
const styled=withElementAppearance(project,'E1',{color:'#ff5500',opacity:.35});
assert.equal(elementAppearance(styled,'E1').color,'#ff5500');assert.equal(elementAppearance(styled,'E1').opacity,.35);
const typed=applyAppearanceToType(styled,'E1');assert.equal(elementAppearance(typed,'E2').color,'#ff5500');assert.equal(appearanceSummary(typed).custom,2);

const schedule={contract:'rebar-schedule/v1',marks:[{id:'B1',diameterMm:12.5,quantity:4,segmentsMm:[1200,450],arcs:[],cutLengthMm:1650,totalLengthM:6.6,totalMassKg:6.36,grade:'CA-50',location:'Sapata F1'},{id:'B2',diameterMm:10,quantity:8,segmentsMm:[900],arcs:[],cutLengthMm:900,totalLengthM:7.2,totalMassKg:4.44,grade:'CA-50',location:'Viga V1'}]};
const sheets=createRebarSheetsFromSchedule({schedule,projectId:'P52',marksPerSheet:8});assert.equal(sheets.length,1);assert.equal(sheets[0].contract,'engineering-drawing-sheet/v1');assert.ok(sheets[0].entities.some(e=>e.kind==='rebar'));
const bar=sheets[0].entities.find(e=>e.kind==='rebar'),moved=updateSheetEntity(sheets[0],bar.id,{x:77,label:'B1 editável'});assert.equal(moved.entities.find(e=>e.id===bar.id).x,77);assert.match(exportDrawingSheetSvg(moved),/B1 editável/);assert.equal(withDrawingSheets(project,[moved]).drawingSheets.length,1);

const baseReview=foundationReviewFromProject(project),adopted=itemsFromSupports(project,baseReview.items);assert.equal(adopted.length,1);assert.equal(adopted[0].nodeId,'N1');
const profile={id:'test-profile',code:'TEST ONLY',edition:'0',provenance:{source:'unit test'},parameters:{foundation:{sliding:{frictionCoefficient:.5,cohesionKPa:0,resistanceFactor:.8},stability:{requiredOverturningFS:1.5},punching:{phi:.75,concreteCoefficient:.17},oneWayShear:{phi:.75,concreteCoefficient:.17},flexure:{phi:.9,leverArmRatio:.9}}}};
const passItem={id:'F1',label:'F1',nodeId:'N1',x:0,y:0,geometry:{B:2,L:2,h:.6,b0:4000,d:500,bw:2000},demand:{N:400,Mx:0,My:0,Hx:20,Hy:0,VuPunching:500,VuOneWay:300,Mu:300,stabilizingMoment:500,overturningMoment:100},soil:{qDesign:200},materials:{fc:30,fy:500,lambda:1},reinforcement:{As:3000}};
const failItem={...passItem,id:'F2',label:'F2',x:4,geometry:{...passItem.geometry,B:1,L:1}};
const review={contract:'foundation-review/v1',version:'0.52.0-exp',profile,items:[passItem,failItem]};
const reviewed=reviewFoundationProject(project,review);assert.equal(reviewed.summary.count,2);assert.equal(reviewed.results[0].status,'PASS');assert.equal(reviewed.results[1].status,'FAIL');assert.ok(reviewed.results[1].suggestions.some(s=>s.id==='bearing-plan'));
const stored=withFoundationReview(project,review);assert.equal(stored.foundationReview.items.length,2);
console.log('AstraStruct v0.52 visualization/detailing/foundation smoke: appearance persistence, editable rebar sheets and auditable foundation PASS/FAIL/PENDING coherent.');
