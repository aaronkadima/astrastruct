const clone=v=>v==null?v:typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v));
const finite=v=>v!==''&&v!==null&&v!==undefined&&Number.isFinite(Number(v))?Number(v):null;
const text=(v,f='')=>String(v??f);
const color=v=>/^#[0-9a-f]{6}$/i.test(String(v||''))?String(v):null;

export const FOUNDATION_GEOTECHNICAL_VERSION='0.53.5-exp';
export const FOUNDATION_GEOTECHNICAL_CONTRACT='foundation-geotechnical-model/v1';
export const FOUNDATION_GEOTECHNICAL_PROFILE_CONTRACT='foundation-geotechnical-profile/v1';
export const FOUNDATION_GEOTECHNICAL_LAYER_CONTRACT='foundation-geotechnical-layer/v1';

export function normalizeGeotechnicalLayer(raw={},index=0){
  return{contract:FOUNDATION_GEOTECHNICAL_LAYER_CONTRACT,id:text(raw.id,`L${index+1}`),label:text(raw.label,`Camada ${index+1}`),topDepthM:finite(raw.topDepthM??raw.topDepth),bottomDepthM:finite(raw.bottomDepthM??raw.bottomDepth),soilClass:text(raw.soilClass??raw.material),description:text(raw.description),color:color(raw.color),source:text(raw.source),parameters:{nSpt:finite(raw.parameters?.nSpt??raw.nSpt),unitWeightKNm3:finite(raw.parameters?.unitWeightKNm3??raw.unitWeight),youngModulusKPa:finite(raw.parameters?.youngModulusKPa??raw.EsKPa),poisson:finite(raw.parameters?.poisson??raw.nu),subgradeModulusKNm3:finite(raw.parameters?.subgradeModulusKNm3??raw.kSubgrade),admissiblePressureKPa:finite(raw.parameters?.admissiblePressureKPa??raw.qAdmissible)}};
}
export function normalizeGeotechnicalProfile(raw={},index=0){
  return{contract:FOUNDATION_GEOTECHNICAL_PROFILE_CONTRACT,id:text(raw.id,`SP-${index+1}`),label:text(raw.label,raw.id||`Perfil ${index+1}`),x:finite(raw.x),y:finite(raw.y),groundZ:finite(raw.groundZ),source:text(raw.source),method:text(raw.method),date:raw.date==null?'':text(raw.date),layers:(Array.isArray(raw.layers)?raw.layers:[]).map((x,i)=>normalizeGeotechnicalLayer(x,i)),metadata:clone(raw.metadata||{})};
}
export function normalizeFoundationGeotechnical(raw={}){
  return{contract:FOUNDATION_GEOTECHNICAL_CONTRACT,version:FOUNDATION_GEOTECHNICAL_VERSION,profiles:(Array.isArray(raw.profiles)?raw.profiles:[]).map((x,i)=>normalizeGeotechnicalProfile(x,i)),links:(Array.isArray(raw.links)?raw.links:[]).map(x=>({foundationId:text(x.foundationId),profileId:text(x.profileId),note:text(x.note)})).filter(x=>x.foundationId||x.profileId),governance:{profileGeometry:'explicit-only',lateralLayerExtrapolation:false,resultInterpolation:false,ssiStiffnessInference:false,...clone(raw.governance||{})}};
}
export function foundationGeotechnicalFromProject(project={}){return normalizeFoundationGeotechnical(project.foundationGeotechnical||{});}

function validateLayer(layer){
  const issues=[],a=layer.topDepthM,b=layer.bottomDepthM,missing=a==null||b==null;
  if(missing)issues.push('Informe profundidades superior e inferior.');
  else{if(a<0)issues.push('Profundidade superior não pode ser negativa.');if(!(b>a))issues.push('Profundidade inferior deve ser maior que a superior.');}
  const p=layer.parameters||{};if(p.nSpt!=null&&p.nSpt<0)issues.push('NSPT não pode ser negativo.');if(p.unitWeightKNm3!=null&&p.unitWeightKNm3<=0)issues.push('Peso específico deve ser positivo.');if(p.youngModulusKPa!=null&&p.youngModulusKPa<=0)issues.push('Módulo de Young deve ser positivo.');if(p.poisson!=null&&(p.poisson<0||p.poisson>=.5))issues.push('Poisson deve estar em 0 ≤ ν < 0,5.');if(p.subgradeModulusKNm3!=null&&p.subgradeModulusKNm3<0)issues.push('Módulo de reação não pode ser negativo.');if(p.admissiblePressureKPa!=null&&p.admissiblePressureKPa<0)issues.push('Pressão admissível não pode ser negativa.');
  const invalid=issues.some(x=>!/Informe profundidades/.test(x));return{...layer,state:invalid?'INVALID':missing?'PENDING':'READY',issues};
}
export function validateGeotechnicalProfile(profileInput={}){
  const profile=normalizeGeotechnicalProfile(profileInput),issues=[];
  if(profile.x==null||profile.y==null||profile.groundZ==null)issues.push('Informe x, y e cota do terreno explicitamente.');
  if(!profile.source.trim())issues.push('Registre a fonte/identificação do perfil ou sondagem.');
  if(!profile.layers.length)issues.push('Cadastre ao menos uma camada.');
  const layers=profile.layers.map(validateLayer),validIntervals=layers.filter(x=>x.topDepthM!=null&&x.bottomDepthM!=null&&x.bottomDepthM>x.topDepthM).sort((a,b)=>a.topDepthM-b.topDepthM);
  for(let i=1;i<validIntervals.length;i++)if(validIntervals[i].topDepthM<validIntervals[i-1].bottomDepthM-1e-9)issues.push(`Camadas ${validIntervals[i-1].id} e ${validIntervals[i].id} se sobrepõem.`);
  if(layers.some(x=>x.state==='INVALID'))issues.push('Existem camadas com dados geométricos ou parâmetros inválidos.');
  if(layers.some(x=>x.state==='PENDING'))issues.push('Existem camadas com dados pendentes.');
  const invalid=issues.some(x=>/sobrepõem|inválid|negativ|maior/i.test(x)),state=invalid?'INVALID':issues.length?'PENDING':'READY';
  return{...profile,layers,state,issues,maxDepthM:validIntervals.length?Math.max(...validIntervals.map(x=>x.bottomDepthM)):null};
}
export function foundationGeotechnicalModelFromProject(project={}){
  const config=foundationGeotechnicalFromProject(project),profiles=config.profiles.map(validateGeotechnicalProfile),profileIds=new Set(profiles.map(x=>String(x.id))),foundationIds=new Set((project?.foundationReview?.items||[]).map((x,i)=>String(x.id||x.nodeId||`F${i+1}`)));
  const links=config.links.map(x=>{const issues=[];if(!foundationIds.has(String(x.foundationId)))issues.push('Fundação não encontrada.');if(!profileIds.has(String(x.profileId)))issues.push('Perfil geotécnico não encontrado.');return{...x,state:issues.length?'INVALID':'READY',issues};});
  const linkedFoundations=new Set(links.filter(x=>x.state==='READY').map(x=>String(x.foundationId))),foundationCount=foundationIds.size;
  return{...config,profiles,links,summary:{profiles:profiles.length,readyProfiles:profiles.filter(x=>x.state==='READY').length,pendingProfiles:profiles.filter(x=>x.state==='PENDING').length,invalidProfiles:profiles.filter(x=>x.state==='INVALID').length,links:links.length,validLinks:links.filter(x=>x.state==='READY').length,unlinkedFoundations:Math.max(0,foundationCount-linkedFoundations.size)},governance:{...config.governance,profileGeometry:'explicit-only',lateralLayerExtrapolation:false,resultInterpolation:false,ssiStiffnessInference:false}};
}
export function withFoundationGeotechnical(project={},input={}){const p=clone(project||{});p.foundationGeotechnical=normalizeFoundationGeotechnical(input);p.foundationGeotechnical.updatedAt=new Date().toISOString();return p;}
export function linkedProfileForFoundation(project={},foundationId){const model=foundationGeotechnicalModelFromProject(project),link=model.links.find(x=>x.state==='READY'&&String(x.foundationId)===String(foundationId));return link?model.profiles.find(x=>String(x.id)===String(link.profileId))||null:null;}
