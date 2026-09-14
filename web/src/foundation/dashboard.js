import{reviewFoundationProject}from'./review.js';
import{foundationSSIResults}from'./ssi.js';
import{foundationGeotechnicalModelFromProject}from'./geotechnical.js';

export const FOUNDATION_DECISION_DASHBOARD_CONTRACT='foundation-decision-dashboard/v1';
export const FOUNDATION_DECISION_DASHBOARD_VERSION='0.53.6-exp';
const finite=v=>v!==''&&v!==null&&v!==undefined&&Number.isFinite(Number(v))?Number(v):null;
const idOf=(x,i)=>String(x?.id||x?.nodeId||`F${i+1}`);
const text=(v,f='')=>String(v??f);
const PRIORITY={FAIL:0,INVALID:1,PENDING:2,READY_FOR_REVIEW:3};
function countGeoParameters(profile){let count=0;for(const l of profile?.layers||[])for(const v of Object.values(l.parameters||{}))if(finite(v)!=null)count++;return count;}
function uniqueMessages(items){return[...new Set(items.filter(Boolean).map(String))];}
function decisionLabel(status){return{FAIL:'Falha normativa',INVALID:'Dados inválidos',PENDING:'Pendências',READY_FOR_REVIEW:'Pronto para revisão integrada'}[status]||status;}

export function foundationDecisionDashboard(project={},resultInput=null){
  const normative=reviewFoundationProject(project),ssi=foundationSSIResults(project,resultInput),geo=foundationGeotechnicalModelFromProject(project),ssiById=new Map(ssi.items.map(x=>[String(x.foundationId),x])),linksByFoundation=new Map(geo.links.map(x=>[String(x.foundationId),x])),profilesById=new Map(geo.profiles.map(x=>[String(x.id),x])),globalSsiEnabled=project?.foundationSSI?.enabled===true;
  const rows=normative.results.map((norm,i)=>{
    const foundationId=idOf(norm.item,i),ssiItem=ssiById.get(foundationId)||null,link=linksByFoundation.get(foundationId)||null,profile=link?profilesById.get(String(link.profileId))||null:null;
    const geoState=!link?'PENDING':link.state==='INVALID'?'INVALID':!profile?'PENDING':profile.state;
    const ssiState=ssiItem?.state||(globalSsiEnabled?'PENDING':'DISABLED'),issues=[],suggestions=(norm.suggestions||[]).map(x=>({discipline:'normative',priority:x.priority||'medium',message:x.message}));
    let invalid=false,pending=false;
    if(norm.status==='FAIL')issues.push('Existe pelo menos uma verificação normativa com falha.');
    if(norm.status==='PENDING'){pending=true;issues.push('Existem verificações normativas pendentes por falta de dados ou parâmetros.');}
    if(geoState==='INVALID'){invalid=true;issues.push('O vínculo ou perfil geotécnico associado contém dados inválidos.');suggestions.push({discipline:'geotechnical',priority:'high',message:'Corrigir o vínculo/perfil geotécnico inválido antes da revisão integrada.'});}
    else if(geoState!=='READY'){pending=true;issues.push(link?'O perfil geotécnico associado ainda está incompleto.':'Nenhum perfil geotécnico foi vinculado à fundação.');suggestions.push({discipline:'geotechnical',priority:'medium',message:link?'Completar coordenadas, fonte e estratigrafia do perfil geotécnico vinculado.':'Vincular explicitamente um perfil/sondagem à fundação.'});}
    if(globalSsiEnabled){
      if(ssiState==='INVALID'){invalid=true;issues.push('A configuração SSI contém rigidez inválida.');suggestions.push({discipline:'ssi',priority:'high',message:'Corrigir as rigidezes SSI inválidas antes de executar a análise.'});}
      else if(ssiState==='UNSOLVED'){pending=true;issues.push('SSI configurada, mas ainda sem resposta de análise.');suggestions.push({discipline:'ssi',priority:'medium',message:'Executar uma análise física compatível para obter recalques e reações das molas.'});}
      else if(ssiState==='MODE_ONLY'){pending=true;issues.push('O resultado atual é uma forma própria e não fornece recalque/reação física.');suggestions.push({discipline:'ssi',priority:'medium',message:'Executar caso estático/P-Delta/co-rotacional quando forem necessários recalques e pressões físicas.'});}
      else if(ssiState!=='READY'){pending=true;issues.push('SSI ativa, porém esta fundação ainda não possui resposta física completa.');suggestions.push({discipline:'ssi',priority:'medium',message:'Completar K explícito, vínculo nodal e análise da fundação na SSI.'});}
    }
    if(ssiItem?.pileReactionState==='PENDING_DISTRIBUTION_MODEL'){pending=true;issues.push('Fundações profundas ainda não possuem distribuição explícita de reações entre estacas.');suggestions.push({discipline:'foundation',priority:'high',message:'Definir modelo explícito bloco–estacas–solo antes de interpretar reações individuais de estacas.'});}
    if(globalSsiEnabled&&ssiState==='READY'&&ssiItem?.averageContactPressureKPa==null&&!/pile|estaca|barrete|tubul/i.test(text(norm.item.type))){issues.push('Resposta SSI disponível, mas q̄ não foi calculada; verificar B/L explícitos.');suggestions.push({discipline:'ssi',priority:'medium',message:'Informar B e L da fundação superficial para calcular q̄ = Rz/(B·L).'});pending=true;}
    const status=norm.status==='FAIL'?'FAIL':invalid?'INVALID':pending?'PENDING':'READY_FOR_REVIEW',profileSource=profile?.source||null,settlementMm=ssiItem?.displacement?1000*(Number(ssiItem.displacement.uz)||0):null;
    return{contract:'foundation-decision-row/v1',version:FOUNDATION_DECISION_DASHBOARD_VERSION,foundationId,label:norm.item.label||foundationId,nodeId:norm.item.nodeId,type:norm.item.type,status,statusLabel:decisionLabel(status),priority:PRIORITY[status],normative:{status:norm.status,pass:norm.summary.pass,fail:norm.summary.fail,pending:norm.summary.pending,maxUtilization:norm.summary.maxUtilization,governing:norm.governing?.limitState||null},ssi:{globalEnabled:globalSsiEnabled,state:ssiState,source:ssiItem?.source||null,settlementMm,verticalReactionKN:ssiItem?.springReaction?finite(ssiItem.springReaction.fz):null,averageContactPressureKPa:finite(ssiItem?.averageContactPressureKPa),pileReactionState:ssiItem?.pileReactionState||'NOT_AVAILABLE',stiffnessDefined:ssiItem?.stiffness?Object.values(ssiItem.stiffness).filter(v=>finite(v)!=null&&Number(v)>0).length:0},geotechnical:{state:geoState,linkState:link?.state||'MISSING',profileId:profile?.id||link?.profileId||null,profileLabel:profile?.label||null,profileSource,method:profile?.method||null,layers:profile?.layers?.length||0,explicitParameters:countGeoParameters(profile)},issues:uniqueMessages(issues),suggestions:suggestions.filter((x,j,a)=>a.findIndex(y=>y.discipline===x.discipline&&y.message===x.message)===j)};
  }).sort((a,b)=>a.priority-b.priority||String(a.label).localeCompare(String(b.label)));
  const summary={count:rows.length,fail:rows.filter(x=>x.status==='FAIL').length,invalid:rows.filter(x=>x.status==='INVALID').length,pending:rows.filter(x=>x.status==='PENDING').length,readyForReview:rows.filter(x=>x.status==='READY_FOR_REVIEW').length,normativePass:rows.filter(x=>x.normative.status==='PASS').length,ssiPhysicalReady:rows.filter(x=>x.ssi.state==='READY').length,geotechnicalReady:rows.filter(x=>x.geotechnical.state==='READY').length};
  return{contract:FOUNDATION_DECISION_DASHBOARD_CONTRACT,version:FOUNDATION_DECISION_DASHBOARD_VERSION,rows,summary,scope:{integratedApproval:false,decisionMeaning:'READY_FOR_REVIEW indica evidência suficiente nos módulos configurados para revisão humana; não é emissão ou aprovação de projeto.',ssiEnabled:globalSsiEnabled,resultNature:ssi.governance.resultNature},governance:{missingDataNeverPasses:true,normativeAndGeotechnicalStatesRemainSeparate:true,ssiStiffnessInference:false,geotechnicalInterpolation:false,pileDistributionInference:false}};
}
