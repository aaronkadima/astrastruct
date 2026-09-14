const clone=v=>v==null?v:typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v));
const finite=v=>v!==''&&v!==null&&v!==undefined&&Number.isFinite(Number(v))?Number(v):null;
const text=(v,f='')=>String(v??f);

export const FOUNDATION_SSI_VERSION='0.53.3-exp';
export const FOUNDATION_SSI_CONTRACT='foundation-ssi-model/v1';
export const FOUNDATION_SSI_RESULT_CONTRACT='foundation-ssi-result/v1';
export const FOUNDATION_SSI_GENERATOR='astrastruct-foundation-ssi-v0533';
export const SSI_DOF_FIELDS=Object.freeze(['kx','ky','kz','krx','kry','krz']);
export const SSI_SUPPORT_FIELDS=Object.freeze(['ux','uy','uz','rx','ry','rz']);

function reviewItems(project){return Array.isArray(project?.foundationReview?.items)?project.foundationReview.items:[]}
function stiffness(raw={}){const out={};for(const key of SSI_DOF_FIELDS)out[key]=finite(raw?.[key]);return out}
function stiffnessState(k){const vals=SSI_DOF_FIELDS.map(key=>k[key]);if(vals.some(v=>v!=null&&v<0))return'INVALID';return vals.some(v=>v!=null&&v>0)?'READY':'PENDING'}
function reviewId(raw,i){return text(raw?.id||raw?.nodeId,`F${i+1}`)}

export function normalizeFoundationSSIItem(raw={},fallback={}){
  const k=stiffness(raw.stiffness||raw);
  return{foundationId:text(raw.foundationId??fallback.foundationId),nodeId:raw.nodeId??fallback.nodeId??null,label:text(raw.label??fallback.label,raw.foundationId??fallback.foundationId??'Fundação'),enabled:raw.enabled!==false,stiffness:k,source:text(raw.source),note:text(raw.note)};
}
export function normalizeFoundationSSIConfig(raw={}){
  return{contract:FOUNDATION_SSI_CONTRACT,version:FOUNDATION_SSI_VERSION,enabled:raw.enabled===true,mode:'replace-support-dofs',items:Array.isArray(raw.items)?raw.items.map(x=>normalizeFoundationSSIItem(x)):[],managedSupports:Array.isArray(raw.managedSupports)?clone(raw.managedSupports):[],governance:{stiffnessSource:'explicit-user-input',inferredSoilStiffness:false,automaticPileDistribution:false,...clone(raw.governance||{})}};
}
export function foundationSSIConfigFromProject(project={}){
  const stored=normalizeFoundationSSIConfig(project.foundationSSI||{}),byId=new Map(stored.items.map(x=>[String(x.foundationId),x]));
  const items=reviewItems(project).map((raw,i)=>{const foundationId=reviewId(raw,i),saved=byId.get(foundationId);return normalizeFoundationSSIItem(saved||{foundationId,nodeId:raw.nodeId,label:raw.label||foundationId,enabled:true},{foundationId,nodeId:raw.nodeId,label:raw.label||foundationId})});
  for(const saved of stored.items)if(!items.some(x=>String(x.foundationId)===String(saved.foundationId)))items.push(saved);
  return{...stored,items};
}
function supportConflict(project,item){const s=(project.supports||[]).find(x=>String(x.nodeId)===String(item.nodeId));if(!s)return[];return SSI_DOF_FIELDS.flatMap((k,i)=>Number(item.stiffness[k])>0&&s[SSI_SUPPORT_FIELDS[i]]===true?[SSI_SUPPORT_FIELDS[i]]:[])}
export function foundationSSIModelFromProject(project={}){
  const config=foundationSSIConfigFromProject(project),nodes=new Set((project.nodes||[]).map(n=>String(n.id))),reviewMap=new Map(reviewItems(project).map((x,i)=>[reviewId(x,i),x]));
  const items=config.items.map(item=>{const state=stiffnessState(item.stiffness),missingNode=!item.nodeId||!nodes.has(String(item.nodeId)),conflicts=supportConflict(project,item),active=item.enabled&&config.enabled;return{...item,state:missingNode?'PENDING':state,active,missingNode,supportConflicts:conflicts,reviewItem:clone(reviewMap.get(item.foundationId)||null)}});
  const active=items.filter(x=>x.active),ready=active.filter(x=>x.state==='READY'&&!x.missingNode),invalid=active.filter(x=>x.state==='INVALID'),pending=active.filter(x=>x.state==='PENDING'||x.missingNode);
  const analysisType=text(project?.settings?.analysisType,'linear'),analysisSupported=['linear','corotational'].includes(analysisType);
  return{contract:FOUNDATION_SSI_CONTRACT,version:FOUNDATION_SSI_VERSION,enabled:config.enabled,mode:config.mode,analysisType,analysisSupported,items,summary:{count:items.length,active:active.length,ready:ready.length,pending:pending.length,invalid:invalid.length,conflicts:active.reduce((s,x)=>s+x.supportConflicts.length,0)},governance:{stiffnessSource:'explicit-user-input',inferredSoilStiffness:false,automaticPileDistribution:false,generatedSpringContract:'nodeSprings'}};
}
function restoreManagedSupports(project,managed=[]){
  for(const entry of managed||[]){const s=(project.supports||[]).find(x=>String(x.nodeId)===String(entry.nodeId));if(!s)continue;for(const [field,value] of Object.entries(entry.fields||{})){s[field]=value.fixed===true;if(value.value===null||value.value===undefined)delete s[`${field}Value`];else s[`${field}Value`]=value.value}}
}
function validateConfig(config){for(const item of config.items){for(const key of SSI_DOF_FIELDS){const v=item.stiffness[key];if(v!=null&&v<0)throw new Error(`SSI ${item.foundationId}: ${key} não pode ser negativo.`)}}}
export function withFoundationSSI(project={},configInput={}){
  const p=clone(project||{}),previous=normalizeFoundationSSIConfig(p.foundationSSI||{});p.supports=Array.isArray(p.supports)?clone(p.supports):[];p.nodeSprings=Array.isArray(p.nodeSprings)?clone(p.nodeSprings):[];
  restoreManagedSupports(p,previous.managedSupports);p.nodeSprings=p.nodeSprings.filter(s=>s?.metadata?.generator!==FOUNDATION_SSI_GENERATOR);
  const config=normalizeFoundationSSIConfig(configInput);validateConfig(config);const managed=[];
  if(config.enabled){
    const analysisType=text(p?.settings?.analysisType,'linear');if(!['linear','corotational'].includes(analysisType))throw new Error(`SSI v0.53.3: análise '${analysisType}' ainda não usa o contrato espacial de molas. Selecione análise linear ou co-rotacional antes de ativar a SSI.`);
    const nodes=new Set((p.nodes||[]).map(n=>String(n.id)));
    for(const item of config.items){if(!item.enabled)continue;if(!item.nodeId||!nodes.has(String(item.nodeId)))continue;const positive=SSI_DOF_FIELDS.filter(k=>Number(item.stiffness[k])>0);if(!positive.length)continue;
      p.nodeSprings.push({id:`SSI-${item.foundationId}`,nodeId:item.nodeId,...Object.fromEntries(SSI_DOF_FIELDS.map(k=>[k,Number(item.stiffness[k])||0])),metadata:{generator:FOUNDATION_SSI_GENERATOR,contract:FOUNDATION_SSI_CONTRACT,foundationId:item.foundationId,source:item.source||null}});
      const s=p.supports.find(x=>String(x.nodeId)===String(item.nodeId));if(!s)continue;const fields={};for(const k of positive){const field=SSI_SUPPORT_FIELDS[SSI_DOF_FIELDS.indexOf(k)];if(s[field]!==true)continue;fields[field]={fixed:true,value:s[`${field}Value`]??null};s[field]=false;delete s[`${field}Value`]}
      if(Object.keys(fields).length)managed.push({foundationId:item.foundationId,nodeId:item.nodeId,fields});
    }
  }
  p.foundationSSI={...config,managedSupports:managed,updatedAt:new Date().toISOString()};return p;
}
function displacementFor(result,nodeId){return(result?.displacements||[]).find(d=>String(d.nodeId)===String(nodeId))||null}
function springForceFor(result,foundationId,nodeId){return(result?.springForces||[]).find(f=>String(f.springId)===`SSI-${foundationId}`)||(result?.springForces||[]).find(f=>String(f.nodeId)===String(nodeId)&&String(f.springId||'').startsWith('SSI-'))||null}
function computedSpringForce(item,d){if(!d)return null;const k=item.stiffness;return{springId:`SSI-${item.foundationId}`,nodeId:item.nodeId,kx:k.kx||0,ky:k.ky||0,kz:k.kz||0,krx:k.krx||0,kry:k.kry||0,krz:k.krz||0,fx:-(k.kx||0)*(Number(d.ux)||0),fy:-(k.ky||0)*(Number(d.uy)||0),fz:-(k.kz||0)*(Number(d.uz)||0),mx:-(k.krx||0)*(Number(d.rx)||0),my:-(k.kry||0)*(Number(d.ry)||0),mz:-(k.krz||0)*(Number(d.rz)||0),derived:true}}
function shallowContactGeometry(review){const type=text(review?.type).toLowerCase(),deep=/pile|estaca|barrete|tubul/.test(type)||Array.isArray(review?.piles)&&review.piles.length>0,B=finite(review?.geometry?.B),L=finite(review?.geometry?.L);return{deep,B,L,area:!deep&&B>0&&L>0?B*L:null}}
export function foundationSSIResults(project={},resultInput=null){
  const model=foundationSSIModelFromProject(project),result=resultInput||project.results||project.lastResult||project.analysisResults||null;
  const items=model.items.map(item=>{const d=displacementFor(result,item.nodeId),f=springForceFor(result,item.foundationId,item.nodeId)||computedSpringForce(item,d),contact=shallowContactGeometry(item.reviewItem),q=f&&contact.area?Number(f.fz||0)/contact.area:null,piles=Array.isArray(item.reviewItem?.piles)?item.reviewItem.piles:[];return{foundationId:item.foundationId,nodeId:item.nodeId,label:item.label,state:!item.active?'DISABLED':item.state!=='READY'?item.state:!result?'UNSOLVED':d&&f?'READY':'PENDING',displacement:d?{ux:Number(d.ux)||0,uy:Number(d.uy)||0,uz:Number(d.uz)||0,rx:Number(d.rx)||0,ry:Number(d.ry)||0,rz:Number(d.rz)||0}:null,springReaction:f?{fx:Number(f.fx)||0,fy:Number(f.fy)||0,fz:Number(f.fz)||0,mx:Number(f.mx)||0,my:Number(f.my)||0,mz:Number(f.mz)||0}:null,contactAreaM2:contact.area,averageContactPressureKPa:q,pileReactionState:piles.length?'PENDING_DISTRIBUTION_MODEL':'NOT_APPLICABLE',notes:[contact.deep?'Pressão média de contato pelo bloco não calculada para fundação profunda.':contact.area?'q médio = Rz/(B·L); não representa distribuição de tensões.':'B/L explícitos ausentes: pressão média não calculada.',piles.length?'Reações por estaca exigem modelo de distribuição/rigidez explícito; divisão igualitária não é inferida.':null].filter(Boolean)}});
  return{contract:FOUNDATION_SSI_RESULT_CONTRACT,version:FOUNDATION_SSI_VERSION,solverResultAvailable:!!result,items,summary:{ready:items.filter(x=>x.state==='READY').length,unsolved:items.filter(x=>x.state==='UNSOLVED').length,pending:items.filter(x=>['PENDING','INVALID'].includes(x.state)).length,disabled:items.filter(x=>x.state==='DISABLED').length},governance:{reactionFormula:'R=-K*u',averageContactPressureFormula:'q=Rz/(B*L)',inferredSoilStiffness:false,inferredPileDistribution:false}};
}
