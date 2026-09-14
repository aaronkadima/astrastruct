import assert from'node:assert/strict';
import{foundationReactionLink,foundationReactionLinks,FOUNDATION_REACTION_LINK_CONTRACT,FOUNDATION_REACTION_LINK_VERSION}from'../web/src/foundation/reactionLink.js';

const reaction={kind:'support',nodeId:'N1',label:'Apoio N1',field:'R',quantity:'force',value:125,magnitude:125,unit:'kN',vector:[30,-40,114.127],governingCombinationId:'ULS1',restraints:{ux:true,uy:true,uz:true,rx:true,ry:true,rz:true}};
const linkedProject={nodes:[{id:'N1',x:0,y:0,z:0}],foundationReview:{profile:{},items:[{id:'F1',label:'Sapata F1',nodeId:'N1',type:'footing',geometry:{B:2,L:2},demand:{N:200,Mx:10,My:5,Hx:4,Hy:3},soil:{qDesign:100}}]}};
const before=JSON.stringify(linkedProject);
let link=foundationReactionLink(linkedProject,reaction);assert.equal(link.contract,FOUNDATION_REACTION_LINK_CONTRACT);assert.equal(link.version,FOUNDATION_REACTION_LINK_VERSION);assert.equal(link.status,'LINKED');assert.equal(link.foundationId,'F1');assert.equal(link.reaction.governingCombinationId,'ULS1');assert.deepEqual(link.reaction.vector,[30,-40,114.127]);assert.equal(link.demandTransfer.persistent,false);assert.equal(link.demandTransfer.mapping,null);assert.equal(link.governance.noSignConventionInference,true);assert.equal(link.governance.noCapacityInference,true);assert.equal(JSON.stringify(linkedProject),before);
const unlinked=foundationReactionLink({...linkedProject,foundationReview:{profile:{},items:[]} },reaction);assert.equal(unlinked.status,'UNLINKED');assert.equal(unlinked.foundationId,null);
const ambiguous=foundationReactionLink({...linkedProject,foundationReview:{profile:{},items:[linkedProject.foundationReview.items[0],{...linkedProject.foundationReview.items[0],id:'F2'}]}},reaction);assert.equal(ambiguous.status,'AMBIGUOUS');assert.equal(ambiguous.foundations.length,2);assert.equal(ambiguous.foundationId,null);
const invalid=foundationReactionLink(linkedProject,{field:'R',value:12});assert.equal(invalid.status,'INVALID');
const batch=foundationReactionLinks(linkedProject,{items:[reaction,{...reaction,nodeId:'N9'}]});assert.equal(batch.summary.count,2);assert.equal(batch.summary.linked,1);assert.equal(batch.summary.unlinked,1);assert.equal(batch.governance.noDemandPersistence,true);
console.log('foundation reaction link v0.53.12 smoke: explicit nodeId linking is read-only and does not infer sign conventions, capacities or PASS/FAIL.');
