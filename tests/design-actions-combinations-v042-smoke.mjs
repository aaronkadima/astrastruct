import assert from 'node:assert/strict';
import {
  DESIGN_ACTIONS_CONTRACT,LOAD_COMBINATIONS_CONTRACT,COMBINATION_ENVELOPE_CONTRACT,DESIGN_ACTIONS_VERSION,
  defineDesignActions,generateDesignCombinations,compileDesignCombination,envelopeCombinationResults
} from '../web/src/designActions/index.js';

const close=(a,b,tol=1e-12,msg='')=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(b)),`${msg} esperado ${b}, obtido ${a}`);
assert.equal(DESIGN_ACTIONS_VERSION,'0.42.0-exp');

const project={nodes:[{id:'N1',x:0,y:0},{id:'N2',x:5,y:0}],elements:[],supports:[],loads:[],elementLoads:[],settlements:[],materials:[],sections:[]};
const actions=[
  {id:'G',type:'nodal',designCategory:'permanent',factorClass:'G_STD',loads:[{nodeId:'N2',fy:-10}]},
  {id:'Q',type:'nodal',designCategory:'variable',loads:[{nodeId:'N2',fy:-5}]},
  {id:'W+',type:'nodal',designCategory:'variable',exclusiveGroup:'W',loads:[{nodeId:'N2',fx:4}]},
  {id:'W-',type:'nodal',designCategory:'variable',exclusiveGroup:'W',loads:[{nodeId:'N2',fx:-4}]}
];

const defined=defineDesignActions(actions);assert.equal(defined.contract,DESIGN_ACTIONS_CONTRACT);assert.equal(defined.actions.length,4);assert.throws(()=>defineDesignActions([actions[0],actions[0]]),/duplicado/);
const rule={
  id:'USER-ULS-01',limitState:'ULS',provenance:{kind:'user-supplied',source:'benchmark-v042'},leadingCategories:['variable'],exclusivity:{W:'one-of'},
  factors:{byClass:{G_STD:{default:1.35}},byCategory:{variable:{leading:1.5,accompanying:.9}}}
};
const generated=generateDesignCombinations({actions,rule});assert.equal(generated.contract,LOAD_COMBINATIONS_CONTRACT);assert.equal(generated.combinations.length,4,'2 variantes de vento x 2 ações variáveis líderes');
for(const combo of generated.combinations){const ids=combo.terms.map(t=>t.actionId);assert.ok(ids.includes('G')&&ids.includes('Q'));assert.equal(ids.includes('W+')&&ids.includes('W-'),false,'ações exclusivas não podem coexistir');assert.equal(combo.terms.filter(t=>t.role==='leading').length,1);close(combo.terms.find(t=>t.actionId==='G').factor,1.35);close(combo.terms.find(t=>t.role==='leading').factor,1.5);for(const t of combo.terms.filter(t=>t.designCategory==='variable'&&t.role!=='leading'))close(t.factor,.9)}
assert.throws(()=>generateDesignCombinations({actions,rule:{...rule,provenance:null}}),/provenance/);
assert.throws(()=>generateDesignCombinations({actions:[{...actions[0],factorClass:'UNKNOWN'}],rule}),/fator ausente/);

const qLead=generated.combinations.find(c=>c.leadingActionId==='Q'&&c.terms.some(t=>t.actionId==='W+'));
const compiled=compileDesignCombination({project,actions,combination:qLead});assert.equal(compiled.contract,'compiled-design-combination/v1');assert.equal(compiled.compiled.contract,'load-action/v1');
const gLoad=compiled.compiled.project.loads.find(l=>l.actionId==='G'),qLoad=compiled.compiled.project.loads.find(l=>l.actionId==='Q'),wLoad=compiled.compiled.project.loads.find(l=>l.actionId==='W+');close(gLoad.fy,-13.5);close(qLoad.fy,-7.5);close(wLoad.fx,3.6);assert.equal(project.loads.length,0,'compilação não pode mutar projeto original');

const zeroOptional=generateDesignCombinations({actions:[actions[0],{...actions[2],leadingEligible:false}],rule:{...rule,id:'OPT',leadingCategories:['variable'],exclusivity:{W:'zero-or-one'}}});assert.equal(zeroOptional.combinations.length,2,'zero-or-one deve criar variante sem e com a ação exclusiva');

const envelope=envelopeCombinationResults({cases:[
  {combinationId:'C1',result:{forces:{N:-20,M:8}}},
  {combinationId:'C2',result:{forces:{N:15,M:-12}}},
  {combinationId:'C3',result:{forces:{N:-5,M:20}}}
],paths:['forces.N','forces.M']});assert.equal(envelope.contract,COMBINATION_ENVELOPE_CONTRACT);assert.equal(envelope.paths['forces.N'].min.combinationId,'C1');assert.equal(envelope.paths['forces.N'].max.combinationId,'C2');assert.equal(envelope.paths['forces.M'].min.combinationId,'C2');assert.equal(envelope.paths['forces.M'].max.combinationId,'C3');

console.log('AstraStruct v0.42 Design Actions & Combinations smoke: factors, leaders, exclusivity, v0.40 compilation and envelopes OK.');
