import{foundationReviewFromProject,withFoundationReview}from'./review.js';

export const FOUNDATION_REACTION_LINK_CONTRACT='foundation-reaction-link/v1';
export const FOUNDATION_REACTION_LINK_VERSION='0.53.12-exp';
export const FOUNDATION_REACTION_TRANSFER_CONTRACT='foundation-reaction-demand-transfer/v1';
export const FOUNDATION_REACTION_TRANSFER_VERSION='0.53.13-exp';
const finite=v=>v!==''&&v!==null&&v!==undefined&&Number.isFinite(Number(v))?Number(v):null;
const text=(v,f='')=>String(v??f);
const clone=v=>v==null?v:typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v));
const TRANSFER_FIELDS=['Fx','Fy','Fz','Mx','My','Mz'];

function reactionSource(reaction={}){
  const vector=Array.isArray(reaction.vector)?reaction.vector.slice(0,3).map(v=>finite(v)??0):null,sourceCombinationReaction=reaction.sourceCombinationReaction?clone(reaction.sourceCombinationReaction):null;
  return{nodeId:reaction.nodeId==null?null:text(reaction.nodeId),field:text(reaction.field),quantity:text(reaction.quantity),value:finite(reaction.value),magnitude:finite(reaction.magnitude),unit:text(reaction.unit),vector,governingCombinationId:reaction.governingCombinationId==null?null:text(reaction.governingCombinationId),restraints:reaction.restraints?clone(reaction.restraints):null,sourceCombinationReaction};
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

function transferSource(link){
  const raw=link?.reaction?.sourceCombinationReaction;if(!raw)return null;
  const components={};for(const key of TRANSFER_FIELDS)components[key]=finite(raw?.components?.[key]);
  return{contract:text(raw.contract),nodeId:raw.nodeId==null?null:text(raw.nodeId),combinationId:raw.combinationId==null?null:text(raw.combinationId),components,forceUnit:text(raw.forceUnit,'kN'),momentUnit:text(raw.momentUnit,'kN·m'),restraints:clone(raw.restraints||{}),complete:TRANSFER_FIELDS.every(key=>components[key]!=null)};
}

export function prepareFoundationDemandTransfer(project={},reaction={},reviewInput={}){
  const link=foundationReactionLink(project,reaction),source=transferSource(link),axisMappingConfirmed=reviewInput?.axisMappingConfirmed===true,signMode=['same-sign','opposite-sign'].includes(reviewInput?.signMode)?reviewInput.signMode:null,mzTolerance=1e-9;
  const sourceMatches=!!source&&source.nodeId===link.nodeId&&source.combinationId===link.reaction.governingCombinationId;
  let status='READY',reason='Transferência revisada pronta para aplicação explícita.';
  if(link.status!=='LINKED'){status='BLOCKED_LINK';reason='É necessário um único vínculo explícito entre o nó de apoio e a fundação.'}
  else if(!sourceMatches){status='BLOCKED_SOURCE';reason='Não existe vetor físico completo da mesma combinação governante para o apoio selecionado.'}
  else if(!source.complete){status='BLOCKED_INCOMPLETE';reason='A reação da combinação possui componente restringida ausente ou não numérica.'}
  else if(Math.abs(source.components.Mz)>mzTolerance){status='BLOCKED_MZ';reason='Mz não é representado pelo modelo atual de demanda da fundação; a transferência foi bloqueada para evitar descarte silencioso de torção.'}
  else if(!axisMappingConfirmed){status='REVIEW_AXES';reason='Confirme explicitamente o mapeamento global X/Y/Z → Hx/Hy/N e Mx/My.'}
  else if(!signMode){status='REVIEW_SIGN';reason='Selecione explicitamente se a ação na fundação mantém ou inverte o sinal da reação do solver.'}
  const factor=signMode==='opposite-sign'?-1:1,demand=status==='READY'?{Hx:factor*source.components.Fx,Hy:factor*source.components.Fy,N:factor*source.components.Fz,Mx:factor*source.components.Mx,My:factor*source.components.My}:null;
  return{contract:FOUNDATION_REACTION_TRANSFER_CONTRACT,version:FOUNDATION_REACTION_TRANSFER_VERSION,status,reason,foundationId:link.foundationId,nodeId:link.nodeId,combinationId:source?.combinationId||link.reaction.governingCombinationId||null,source,demand,mapping:{Fx:'Hx',Fy:'Hy',Fz:'N',Mx:'Mx',My:'My',Mz:null,axisSystem:'solver-global'},review:{axisMappingConfirmed,signMode,mzTolerance},governance:{singlePhysicalCombination:true,explicitAxisReviewRequired:true,explicitSignReviewRequired:true,noMzDiscard:true,noCapacityInference:true,noNormativePassFail:true,noAutomaticPersistence:true}};
}

export function applyFoundationDemandTransfer(project={},transfer={}){
  if(transfer?.contract!==FOUNDATION_REACTION_TRANSFER_CONTRACT||transfer?.version!==FOUNDATION_REACTION_TRANSFER_VERSION||transfer?.status!=='READY'||!transfer?.foundationId||!transfer?.demand)return{status:'BLOCKED',project:clone(project),reason:'A transferência precisa estar em estado READY e pertencer ao contrato v0.53.13.'};
  const demand={};for(const key of ['N','Hx','Hy','Mx','My']){const value=finite(transfer.demand?.[key]);if(value==null)return{status:'BLOCKED',project:clone(project),reason:`Demanda ${key} ausente ou inválida.`};demand[key]=value}
  const review=foundationReviewFromProject(project),index=review.items.findIndex(x=>String(x.id)===String(transfer.foundationId));if(index<0)return{status:'BLOCKED',project:clone(project),reason:'Fundação vinculada não encontrada no projeto atual.'};
  const item=review.items[index],audit={contract:FOUNDATION_REACTION_TRANSFER_CONTRACT,version:FOUNDATION_REACTION_TRANSFER_VERSION,nodeId:transfer.nodeId,combinationId:transfer.combinationId,mapping:clone(transfer.mapping),signMode:transfer.review?.signMode||null,sourceComponents:clone(transfer.source?.components||{}),sourceUnits:{force:transfer.source?.forceUnit||'kN',moment:transfer.source?.momentUnit||'kN·m'}};
  review.items[index]={...item,demand:{...item.demand,...demand},metadata:{...(item.metadata||{}),reactionDemandTransfer:audit}};
  return{status:'APPLIED',project:withFoundationReview(project,review),foundationId:String(item.id),demand:clone(demand),audit};
}
