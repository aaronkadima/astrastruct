import{rectangularFootingContact,foundationSlidingDesign,foundationOverturningDesign,foundationPunchingDesign,foundationOneWayShearDesign,foundationFlexureStripDesign}from'../codeDesign/foundation.js';
export const FOUNDATION_REVIEW_CONTRACT='foundation-review/v1';
export const FOUNDATION_REVIEW_VERSION='0.52.0-exp';
const clone=v=>v==null?v:typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v));
const finite=v=>v!==''&&v!==null&&v!==undefined&&Number.isFinite(Number(v))?Number(v):null;
const text=(v,f='')=>String(v??f);
const labels={bearing:'Pressão de contato',sliding:'Deslizamento',overturning:'Tombamento',punching:'Punção',oneWayShear:'Cisalhamento unidirecional',flexure:'Flexão'};
function pending(id,message){return{id:`foundation-${id}`,discipline:'Foundation',limitState:labels[id]||id,demand:null,resistance:null,utilization:null,ok:null,unit:'-',clause:null,notes:[message],details:{pending:true}}}
function profileComplete(profile,branch){const p=profile?.parameters?.foundation?.[branch];return !!p&&Object.values(p).every(v=>v!==null&&v!==undefined&&v!=='');}


// Foundation type is explicit while pile geometry remains independent.
export const FOUNDATION_TYPES=Object.freeze(['footing','pileCap']);
export function normalizeFoundationType(t){const v=text(t,'footing');return FOUNDATION_TYPES.includes(v)?v:'footing'}
function normalizePile(p={}){return{dx:finite(p.dx)??0,dy:finite(p.dy)??0,diameter:finite(p.diameter),length:finite(p.length)}}
export function standardPileCapLayout(pileCount,spacing=1){
  const s=positive1(spacing),layouts={1:[[0,0]],2:[[-s/2,0],[s/2,0]],3:[[0,s/Math.sqrt(3)],[-s/2,-s/(2*Math.sqrt(3))],[s/2,-s/(2*Math.sqrt(3))]],4:[[-s/2,-s/2],[s/2,-s/2],[s/2,s/2],[-s/2,s/2]],5:[[-s/2,-s/2],[s/2,-s/2],[s/2,s/2],[-s/2,s/2],[0,0]],6:[[-s,-s/2],[0,-s/2],[s,-s/2],[-s,s/2],[0,s/2],[s,s/2]]};
  const n=Math.max(1,Math.round(Number(pileCount)||1)),base=layouts[n]||layouts[6];return base.map(([dx,dy])=>({dx,dy,diameter:null,length:null}));
}
function positive1(v){const x=Number(v);return Number.isFinite(x)&&x>0?x:1}
export function normalizeFoundationItem(item={},project={}){
  const node=(project?.nodes||[]).find(n=>String(n.id)===String(item.nodeId));
  return{id:text(item.id||item.nodeId||'F-UNASSIGNED'),label:text(item.label,item.id||'Fundação'),nodeId:item.nodeId==null?null:text(item.nodeId),x:finite(item.x)??finite(node?.x)??0,y:finite(item.y)??finite(node?.y)??0,type:normalizeFoundationType(item.type),geometry:{B:finite(item.geometry?.B),L:finite(item.geometry?.L),h:finite(item.geometry?.h),b0:finite(item.geometry?.b0),d:finite(item.geometry?.d),bw:finite(item.geometry?.bw)},piles:Array.isArray(item.piles)?item.piles.map(normalizePile):[],demand:{N:finite(item.demand?.N),Mx:finite(item.demand?.Mx)??0,My:finite(item.demand?.My)??0,Hx:finite(item.demand?.Hx)??0,Hy:finite(item.demand?.Hy)??0,VuPunching:finite(item.demand?.VuPunching),VuOneWay:finite(item.demand?.VuOneWay),Mu:finite(item.demand?.Mu),stabilizingMoment:finite(item.demand?.stabilizingMoment),overturningMoment:finite(item.demand?.overturningMoment)},soil:{qDesign:finite(item.soil?.qDesign)},materials:{fc:finite(item.materials?.fc),fy:finite(item.materials?.fy),lambda:finite(item.materials?.lambda)??1},reinforcement:{As:finite(item.reinforcement?.As)},enabledChecks:{bearing:true,sliding:true,overturning:true,punching:true,oneWayShear:true,flexure:true,...(item.enabledChecks||{})},metadata:clone(item.metadata||{})};
}
export function normalizeFoundationProfile(profile={}){
  return{id:text(profile.id,'foundation-profile'),code:text(profile.code,'Perfil normativo informado pelo usuário'),edition:profile.edition==null?null:text(profile.edition),provenance:{source:'user/project supplied',requiresLicensedParameters:true,...clone(profile.provenance||{})},clauses:clone(profile.clauses||{}),parameters:{foundation:{sliding:{frictionCoefficient:finite(profile.parameters?.foundation?.sliding?.frictionCoefficient),cohesionKPa:finite(profile.parameters?.foundation?.sliding?.cohesionKPa)??0,resistanceFactor:finite(profile.parameters?.foundation?.sliding?.resistanceFactor)},stability:{requiredOverturningFS:finite(profile.parameters?.foundation?.stability?.requiredOverturningFS)},punching:{phi:finite(profile.parameters?.foundation?.punching?.phi),concreteCoefficient:finite(profile.parameters?.foundation?.punching?.concreteCoefficient)},oneWayShear:{phi:finite(profile.parameters?.foundation?.oneWayShear?.phi),concreteCoefficient:finite(profile.parameters?.foundation?.oneWayShear?.concreteCoefficient)},flexure:{phi:finite(profile.parameters?.foundation?.flexure?.phi),leverArmRatio:finite(profile.parameters?.foundation?.flexure?.leverArmRatio)}}}};
}
export function foundationReviewFromProject(project){
  const stored=project?.foundationReview||{},items=Array.isArray(stored.items)?stored.items:[];
  return{contract:FOUNDATION_REVIEW_CONTRACT,version:FOUNDATION_REVIEW_VERSION,profile:normalizeFoundationProfile(stored.profile||{}),items:items.map(x=>normalizeFoundationItem(x,project)),notes:Array.from(stored.notes||[],String)};
}
export function itemsFromSupports(project,existing=[]){
  const used=new Set((existing||[]).map(x=>String(x.nodeId||''))),nodes=new Map((project?.nodes||[]).map(n=>[String(n.id),n]));
  return(project?.supports||[]).filter(s=>!used.has(String(s.nodeId))).map((s,i)=>{const n=nodes.get(String(s.nodeId));return normalizeFoundationItem({id:`F-${s.nodeId||i+1}`,label:`Fundação ${s.nodeId||i+1}`,nodeId:s.nodeId,x:n?.x,y:n?.y},project)});
}
function has(values){return values.every(v=>v!==null&&v!==undefined&&Number.isFinite(Number(v)))}
export function evaluateFoundationItem(itemInput,profileInput){
  const item=normalizeFoundationItem(itemInput),profile=normalizeFoundationProfile(profileInput),g=item.geometry,d=item.demand,s=item.soil,m=item.materials,r=item.reinforcement,checks=[];
  const run=(key,ready,fn,pendingMessage)=>{if(item.enabledChecks?.[key]===false)return;try{checks.push(ready?fn():pending(key,pendingMessage));}catch(e){checks.push(pending(key,e?.message||String(e)));}};
  run('bearing',has([g.B,g.L,d.N,s.qDesign]),()=>rectangularFootingContact({profile,demand:{N:d.N,Mx:d.Mx,My:d.My},footing:{B:g.B,L:g.L},soil:{qDesign:s.qDesign}}),'Informe B, L, N e qDesign.');
  run('sliding',has([g.B,g.L,d.N,d.Hx,d.Hy])&&profileComplete(profile,'sliding'),()=>foundationSlidingDesign({profile,demand:{N:d.N,Hx:d.Hx,Hy:d.Hy},footing:{B:g.B,L:g.L}}),'Informe geometria, ações horizontais e parâmetros de deslizamento do profile.');
  run('overturning',has([d.stabilizingMoment,d.overturningMoment])&&profileComplete(profile,'stability'),()=>foundationOverturningDesign({profile,stabilizingMoment:d.stabilizingMoment,overturningMoment:d.overturningMoment}),'Informe momentos estabilizante/tombamento e FS requerido do profile.');
  run('punching',has([d.VuPunching,g.b0,g.d,m.fc,m.lambda])&&profileComplete(profile,'punching'),()=>foundationPunchingDesign({profile,demand:{Vu:d.VuPunching},geometry:{b0:g.b0,d:g.d},materials:{fc:m.fc,lambda:m.lambda}}),'Informe Vu de punção, b0, d, fc e parâmetros de punção do profile.');
  run('oneWayShear',has([d.VuOneWay,g.bw,g.d,m.fc,m.lambda])&&profileComplete(profile,'oneWayShear'),()=>foundationOneWayShearDesign({profile,demand:{Vu:d.VuOneWay},geometry:{bw:g.bw,d:g.d},materials:{fc:m.fc,lambda:m.lambda}}),'Informe Vu unidirecional, bw, d, fc e parâmetros do profile.');
  run('flexure',has([d.Mu,r.As,m.fy,g.d])&&profileComplete(profile,'flexure'),()=>foundationFlexureStripDesign({profile,demand:{Mu:d.Mu},strip:{d:g.d},reinforcement:{As:r.As},materials:{fy:m.fy}}),'Informe Mu, As, fy, d e parâmetros de flexão do profile.');
  const evaluated=checks.filter(c=>c.ok!==null),failed=checks.filter(c=>c.ok===false),pendingChecks=checks.filter(c=>c.ok===null),governing=evaluated.length?evaluated.reduce((a,b)=>(Number(b.utilization)||0)>(Number(a.utilization)||0)?b:a):null,status=failed.length?'FAIL':pendingChecks.length?'PENDING':evaluated.length?'PASS':'PENDING';
  return{contract:'foundation-item-review/v1',version:FOUNDATION_REVIEW_VERSION,item:clone(item),status,checks,governing,summary:{pass:checks.filter(c=>c.ok===true).length,fail:failed.length,pending:pendingChecks.length,maxUtilization:governing?.utilization??null},suggestions:foundationSuggestions({item,checks,status})};
}
export function foundationSuggestions({item,checks=[]}={}){
  const out=[],failed=new Set(checks.filter(c=>c.ok===false).map(c=>c.id)),pendingChecks=checks.filter(c=>c.ok===null);
  if(failed.has('foundation-bearing'))out.push({id:'bearing-plan',priority:'high',message:'Aumentar B e/ou L, revisar excentricidades e confirmar qDesign com o estudo geotécnico; recalcular antes de aceitar a solução.'});
  if(failed.has('foundation-sliding'))out.push({id:'sliding',priority:'high',message:'Rever área/peso estabilizante, ligação por vigas de equilíbrio e parâmetros de interface; não adicionar resistência passiva sem justificativa geotécnica.'});
  if(failed.has('foundation-overturning'))out.push({id:'overturning',priority:'high',message:'Aumentar braço/peso estabilizante ou revisar a distribuição de ações e vínculos; verificar simultaneamente contato da base.'});
  if(failed.has('foundation-punching'))out.push({id:'punching-depth',priority:'high',message:'Avaliar aumento de d/espessura ou pedestal e, quando permitido pelo código aplicável, armadura específica de punção.'});
  if(failed.has('foundation-one-way-shear'))out.push({id:'shear-depth',priority:'high',message:'Avaliar aumento da altura útil d e/ou dimensões em planta; recomputar a seção crítica conforme o plugin normativo.'});
  if(failed.has('foundation-flexure'))out.push({id:'flexure-rebar',priority:'high',message:'Revisar As, d e dimensões da sapata; detalhar ancoragem, cobrimento e espaçamentos conforme o código selecionado.'});
  if(pendingChecks.length)out.push({id:'pending-data',priority:'medium',message:`Completar ${pendingChecks.length} verificação(ões) pendente(s) antes da aprovação normativa.`});
  if(!out.length&&checks.length)out.push({id:'pass-review',priority:'info',message:'Verificações configuradas atendidas. Confirmar detalhamento, geotecnia, combinações governantes e requisitos fora do escopo antes da emissão.'});
  return out;
}
export function reviewFoundationProject(project,reviewInput=null){
  const review=reviewInput?.contract===FOUNDATION_REVIEW_CONTRACT?clone(reviewInput):foundationReviewFromProject(project),results=review.items.map(x=>evaluateFoundationItem(x,review.profile));
  return{contract:'foundation-project-review/v1',version:FOUNDATION_REVIEW_VERSION,profile:clone(review.profile),results,summary:{count:results.length,pass:results.filter(x=>x.status==='PASS').length,fail:results.filter(x=>x.status==='FAIL').length,pending:results.filter(x=>x.status==='PENDING').length}};
}
export function withFoundationReview(project,review){const p=clone(project||{});p.foundationReview={...foundationReviewFromProject({...p,foundationReview:review}),items:(review?.items||[]).map(x=>normalizeFoundationItem(x,p)),profile:normalizeFoundationProfile(review?.profile||{})};return p;}
