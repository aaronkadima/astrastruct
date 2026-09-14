import assert from'node:assert/strict';
import{buildCombinationEnvelopeExplorer,supportReactionAtCombination}from'../web/src/projectWorkflow/combinationEnvelopeExplorer.js';
import{buildReactionVisualization}from'../web/src/projectWorkflow/envelopeVisualization.js';
import{FOUNDATION_REACTION_TRANSFER_VERSION,prepareFoundationDemandTransfer,applyFoundationDemandTransfer}from'../web/src/foundation/reactionLink.js';
import{foundationReviewFromProject}from'../web/src/foundation/review.js';

const project={
  nodes:[{id:'N0',x:0,y:0,z:0},{id:'N1',x:4,y:0,z:0}],elements:[],
  supports:[{nodeId:'N0',ux:true,uy:true,uz:true,rx:true,ry:true,rz:false},{nodeId:'N1',ux:true,uy:true,uz:true,rx:true,ry:true,rz:true}],
  loadCombinations:[{id:'ULS1',name:'ELU 1',limitStateCategory:'ELU'},{id:'ULS2',name:'ELU 2',limitStateCategory:'ELU'}],
  foundationReview:{items:[
    {id:'F0',label:'Fundação N0',nodeId:'N0',demand:{N:1,Hx:2,Hy:3,Mx:4,My:5,VuPunching:77}},
    {id:'F1',label:'Fundação N1',nodeId:'N1',demand:{N:1}}
  ]}
};
const result=(id,n0,n1)=>({analysisType:'linear',type:'linear3d',scenario:{id},displacements:[],elementForces:[],reactions:[{nodeId:'N0',...n0},{nodeId:'N1',...n1}]});
const explorer=buildCombinationEnvelopeExplorer(project,[
  {combinationId:'ULS1',result:result('ULS1',{fx:12,fy:-4,fz:30,mx:5,my:6,mz:999},{fx:4,fy:3,fz:20,mx:2,my:1,mz:4})},
  {combinationId:'ULS2',result:result('ULS2',{fx:50,fy:0,fz:1,mx:100,my:2,mz:999},{fx:1,fy:1,fz:10,mx:1,my:1,mz:2})}
]);

assert.equal(FOUNDATION_REACTION_TRANSFER_VERSION,'0.53.13-exp');
const sameCombo=supportReactionAtCombination(explorer,'N0','ULS1');
assert.equal(sameCombo.combinationId,'ULS1');
assert.deepEqual(sameCombo.components,{Fx:12,Fy:-4,Fz:30,Mx:5,My:6,Mz:0});
assert.equal(sameCombo.complete,true);assert.equal(sameCombo.governance.noEnvelopeComponentMixing,true);
const restrainedMz=supportReactionAtCombination(explorer,'N1','ULS1');assert.equal(restrainedMz.components.Mz,4);

const fz=buildReactionVisualization(explorer,'Fz'),reaction=fz.items.find(x=>x.nodeId==='N0'),torsionReaction=fz.items.find(x=>x.nodeId==='N1');
assert.equal(reaction.governingCombinationId,'ULS1');
assert.deepEqual(reaction.sourceCombinationReaction.components,{Fx:12,Fy:-4,Fz:30,Mx:5,My:6,Mz:0});
assert.notEqual(reaction.sourceCombinationReaction.components.Mx,explorer.supportReactionEnvelopes.find(x=>x.nodeId==='N0').Mx.absMax,'must not mix Mx envelope from ULS2 into ULS1 source');
assert.equal(torsionReaction.sourceCombinationReaction.components.Mz,4);

let transfer=prepareFoundationDemandTransfer(project,reaction,{});assert.equal(transfer.status,'REVIEW_AXES');
transfer=prepareFoundationDemandTransfer(project,reaction,{axisMappingConfirmed:true});assert.equal(transfer.status,'REVIEW_SIGN');
transfer=prepareFoundationDemandTransfer(project,reaction,{axisMappingConfirmed:true,signMode:'opposite-sign'});assert.equal(transfer.status,'READY');
assert.deepEqual(transfer.demand,{Hx:-12,Hy:4,N:-30,Mx:-5,My:-6});assert.equal(transfer.combinationId,'ULS1');assert.equal(transfer.mapping.Mz,null);
const before=JSON.stringify(project),applied=applyFoundationDemandTransfer(project,transfer);assert.equal(applied.status,'APPLIED');assert.equal(JSON.stringify(project),before,'source project must remain immutable');
const persisted=foundationReviewFromProject(applied.project).items.find(x=>x.id==='F0');
assert.deepEqual({N:persisted.demand.N,Hx:persisted.demand.Hx,Hy:persisted.demand.Hy,Mx:persisted.demand.Mx,My:persisted.demand.My},{N:-30,Hx:-12,Hy:4,Mx:-5,My:-6});
assert.equal(persisted.demand.VuPunching,77);assert.equal(persisted.metadata.reactionDemandTransfer.combinationId,'ULS1');assert.equal(persisted.metadata.reactionDemandTransfer.signMode,'opposite-sign');assert.deepEqual(persisted.metadata.reactionDemandTransfer.sourceComponents,{Fx:12,Fy:-4,Fz:30,Mx:5,My:6,Mz:0});

const torsionTransfer=prepareFoundationDemandTransfer(project,torsionReaction,{axisMappingConfirmed:true,signMode:'same-sign'});assert.equal(torsionTransfer.status,'BLOCKED_MZ');assert.equal(torsionTransfer.demand,null);
const incomplete={...reaction,sourceCombinationReaction:{...reaction.sourceCombinationReaction,components:{...reaction.sourceCombinationReaction.components,My:null}}};assert.equal(prepareFoundationDemandTransfer(project,incomplete,{axisMappingConfirmed:true,signMode:'same-sign'}).status,'BLOCKED_INCOMPLETE');
const wrongCombo={...reaction,sourceCombinationReaction:{...reaction.sourceCombinationReaction,combinationId:'ULS2'}};assert.equal(prepareFoundationDemandTransfer(project,wrongCombo,{axisMappingConfirmed:true,signMode:'same-sign'}).status,'BLOCKED_SOURCE');

console.log('AstraStruct v0.53.13 foundation reaction transfer smoke: same-combination vectors only, explicit axis/sign review, Mz blocking, immutable audited persistence.');
