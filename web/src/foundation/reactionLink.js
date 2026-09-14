import{foundationReviewFromProject}from'./review.js';

export const FOUNDATION_REACTION_LINK_CONTRACT='foundation-reaction-link/v1';
export const FOUNDATION_REACTION_LINK_VERSION='0.53.12-exp';
const finite=v=>v!==''&&v!==null&&v!==undefined&&Number.isFinite(Number(v))?Number(v):null;
const text=(v,f='')=>String(v??f);
const clone=v=>v==null?v:typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v));

function reactionSource(reaction={}){
  const vector=Array.isArray(reaction.vector)?reaction.vector.slice(0,3).map(v=>finite(v)??0):null;
  return{nodeId:reaction.nodeId==null?null:text(reaction.nodeId),field:text(reaction.field),quantity:text(reaction.quantity),value:finite(reaction.value),magnitude:finite(reaction.magnitude),unit:text(reaction.unit),vector,governingCombinationId:reaction.governingCombinationId==null?null:text(reaction.governingCombinationId),restraints:reaction.restraints?clone(reaction.restraints):null};
}

export function foundationReactionLink(project={},reaction={}){
  const source=reactionSource(reaction),nodeId=source.nodeId,review=foundationReviewFromProject(project),foundations=nodeId?review.items.filter(x=>String(x.nodeId||'')===nodeId).map(x=>({foundationId:String(x.id),label:String(x.label||x.id),type:String(x.type||'foundation'),nodeId:String(x.nodeId)})):[];
  const status=!nodeId?'INVALID':foundations.length===0?'UNLINKED':foundations.length===1?'LINKED':'AMBIGUOUS',foundationId=status==='LINKED'?foundations[0].foundationId:null;
  return{contract:FOUNDATION_REACTION_LINK_CONTRACT,version:FOUNDATION_REACTION_LINK_VERSION,status,nodeId,foundationId,foundations,reaction:source,demandTransfer:{mode:'preview-only',persistent:false,mapping:null,reason:'A reação estrutural é preservada no sistema global do solver. A conversão para N/H/M da fundação exige convenção de sinais e eixos explicitamente revisada antes de persistir ações de dimensionamento.'},governance:{explicitNodeIdLinkOnly:true,noGeometryMatching:true,noSignConventionInference:true,noDemandPersistence:true,noCapacityInference:true,noNormativePassFail:true,sourceReactionOnly:true}};
}

export function foundationReactionLinks(project={},reactionView={}){
  const links=(reactionView?.items||[]).map(item=>foundationReactionLink(project,item));
  return{contract:'foundation-reaction-links/v1',version:FOUNDATION_REACTION_LINK_VERSION,links,summary:{count:links.length,linked:links.filter(x=>x.status==='LINKED').length,unlinked:links.filter(x=>x.status==='UNLINKED').length,ambiguous:links.filter(x=>x.status==='AMBIGUOUS').length,invalid:links.filter(x=>x.status==='INVALID').length},governance:{explicitNodeIdLinkOnly:true,noDemandPersistence:true,noCapacityInference:true,noSignConventionInference:true}};
}
