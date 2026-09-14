import{deriveLevels}from'../core/levels.js';

export const BUILDING_DESIGN_BASIS_CONTRACT='building-design-basis/v1';
export const DRAWING_ORGANIZATION_CONTRACT='drawing-organization/v1';
export const MARKET_PARITY_VERSION='0.53.0-exp';
export const DRAWING_CATEGORIES=Object.freeze([
  {id:'general',label:'Geral / implantação'},
  {id:'formwork',label:'Formas / geometria'},
  {id:'slabs',label:'Lajes'},
  {id:'beams',label:'Vigas'},
  {id:'columns',label:'Pilares / paredes'},
  {id:'foundations',label:'Fundações'},
  {id:'reinforcement',label:'Armaduras'},
  {id:'loads-results',label:'Cargas / resultados'},
  {id:'details',label:'Detalhes / ligações'},
]);
const clone=v=>v==null?v:typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v));
const n=v=>v!==''&&v!==null&&v!==undefined&&Number.isFinite(Number(v))?Number(v):null;
const text=v=>v===null||v===undefined?'':String(v);
const bool=(v,f=false)=>v===undefined?f:v!==false;
const deepMerge=(a,b)=>{if(!b||typeof b!=='object'||Array.isArray(b))return b===undefined?clone(a):clone(b);const out={...(a||{})};for(const[k,v]of Object.entries(b))out[k]=v&&typeof v==='object'&&!Array.isArray(v)?deepMerge(out[k]||{},v):clone(v);return out};
const allowedAnalysis=new Set(['linear','pdelta','corotational','modal','time-history','response-spectrum']);

export function defaultDesignBasis(project={}){
  return{contract:BUILDING_DESIGN_BASIS_CONTRACT,version:MARKET_PARITY_VERSION,
    general:{designCode:null,codeEdition:null,units:project?.units||'kN-m-MPa',designLifeYears:null,projectClass:null,notes:''},
    durability:{exposureClass:null,environment:null,fireResistanceMinutes:null,rebarFykMpa:null,concrete:{slabFckMpa:null,beamFckMpa:null,columnFckMpa:null,wallFckMpa:null,foundationFckMpa:null},coversMm:{slab:null,beam:null,column:null,wall:null,foundation:null,soilContact:null}},
    structuralDefaults:{beam:{bM:null,hM:null},column:{bM:null,hM:null},wall:{thicknessM:null},slab:{type:null,thicknessM:null,dropPanelThicknessM:null},diaphragmModel:null},
    foundation:{system:null,soilModel:null,qAllowableKPa:null,subgradeModulusKPaM:null,waterTableDepthM:null,pile:{type:null,diameterM:null,lengthM:null,axialSpringKNM:null,capacityKN:null},soilLayers:[],boringReference:null,notes:''},
    actions:{selfWeight:true,superimposedDeadKPa:null,liveKPa:null,wind:{enabled:false,basicSpeedMS:null,directionsDeg:[],terrain:null,topography:null,dynamic:false},seismic:{enabled:false,method:null,spectrumId:null},temperature:{enabled:false,deltaC:null},constructionStages:false},
    analysis:{type:allowedAnalysis.has(project?.settings?.analysisType)?project.settings.analysisType:null,pDelta:false,crackedStiffness:{beam:null,column:null,slab:null,wall:null},meshTargetM:null,soilStructureInteraction:false},
    outputs:{deformed3D:true,beamColumnDiagrams:true,shellContours:true,foundationStatus:true,soilPressure:true,pileReactions:true,drifts:true},
    governance:{criticalValuesSource:'user/project supplied',normativeCoefficientsInferred:false,reviewRequired:true}};
}
function normalizeBasis(value={},project={}){
  const d=deepMerge(defaultDesignBasis(project),value||{});d.contract=BUILDING_DESIGN_BASIS_CONTRACT;d.version=MARKET_PARITY_VERSION;
  d.general.designLifeYears=n(d.general.designLifeYears);d.durability.fireResistanceMinutes=n(d.durability.fireResistanceMinutes);d.durability.rebarFykMpa=n(d.durability.rebarFykMpa);
  for(const k of Object.keys(d.durability.concrete))d.durability.concrete[k]=n(d.durability.concrete[k]);for(const k of Object.keys(d.durability.coversMm))d.durability.coversMm[k]=n(d.durability.coversMm[k]);
  for(const branch of['beam','column'])for(const k of Object.keys(d.structuralDefaults[branch]))d.structuralDefaults[branch][k]=n(d.structuralDefaults[branch][k]);for(const k of['thicknessM'])d.structuralDefaults.wall[k]=n(d.structuralDefaults.wall[k]);for(const k of['thicknessM','dropPanelThicknessM'])d.structuralDefaults.slab[k]=n(d.structuralDefaults.slab[k]);
  for(const k of['qAllowableKPa','subgradeModulusKPaM','waterTableDepthM'])d.foundation[k]=n(d.foundation[k]);for(const k of['diameterM','lengthM','axialSpringKNM','capacityKN'])d.foundation.pile[k]=n(d.foundation.pile[k]);
  d.foundation.soilLayers=Array.isArray(d.foundation.soilLayers)?d.foundation.soilLayers.map((x,i)=>({id:text(x?.id||`SL${i+1}`),name:text(x?.name||`Camada ${i+1}`),topM:n(x?.topM),bottomM:n(x?.bottomM),description:text(x?.description),gammaKNM3:n(x?.gammaKNM3),phiDeg:n(x?.phiDeg),cohesionKPa:n(x?.cohesionKPa),modulusMPa:n(x?.modulusMPa)})):[];
  d.actions.selfWeight=bool(d.actions.selfWeight,true);d.actions.superimposedDeadKPa=n(d.actions.superimposedDeadKPa);d.actions.liveKPa=n(d.actions.liveKPa);d.actions.wind.enabled=bool(d.actions.wind.enabled,false);d.actions.wind.basicSpeedMS=n(d.actions.wind.basicSpeedMS);d.actions.wind.dynamic=bool(d.actions.wind.dynamic,false);d.actions.wind.directionsDeg=Array.isArray(d.actions.wind.directionsDeg)?d.actions.wind.directionsDeg.map(Number).filter(Number.isFinite):[];d.actions.seismic.enabled=bool(d.actions.seismic.enabled,false);d.actions.temperature.enabled=bool(d.actions.temperature.enabled,false);d.actions.temperature.deltaC=n(d.actions.temperature.deltaC);d.actions.constructionStages=bool(d.actions.constructionStages,false);
  d.analysis.type=allowedAnalysis.has(d.analysis.type)?d.analysis.type:null;d.analysis.pDelta=bool(d.analysis.pDelta,false);d.analysis.meshTargetM=n(d.analysis.meshTargetM);d.analysis.soilStructureInteraction=bool(d.analysis.soilStructureInteraction,false);for(const k of Object.keys(d.analysis.crackedStiffness))d.analysis.crackedStiffness[k]=n(d.analysis.crackedStiffness[k]);
  d.governance={criticalValuesSource:'user/project supplied',normativeCoefficientsInferred:false,reviewRequired:true};return d;
}
export function designBasisFromProject(project={}){return normalizeBasis(project?.designBasis||{},project)}
export function withDesignBasis(project,basis){const p=clone(project||{});p.designBasis=normalizeBasis(basis,p);p.meta={...(p.meta||{}),designBasisUpdatedAt:new Date().toISOString()};return p}
export function synchronizeCompatibleDesignBasis(project,basisInput=null){let p=withDesignBasis(project,basisInput||designBasisFromProject(project));const b=p.designBasis;if(b.analysis.type){p.settings={...(p.settings||{}),analysisType:b.analysis.type};if(b.analysis.pDelta&&b.analysis.type==='linear')p.settings.analysisType='pdelta';}return p}

const required=[
 ['general.designCode','Norma principal'],['general.designLifeYears','Vida útil de projeto'],['durability.exposureClass','Classe de exposição/agressividade'],['durability.rebarFykMpa','fyk da armadura'],
 ['durability.concrete.slabFckMpa','fck das lajes'],['durability.concrete.beamFckMpa','fck das vigas'],['durability.concrete.columnFckMpa','fck dos pilares'],['durability.concrete.foundationFckMpa','fck das fundações'],
 ['durability.coversMm.slab','Cobrimento das lajes'],['durability.coversMm.beam','Cobrimento das vigas'],['durability.coversMm.column','Cobrimento dos pilares'],['durability.coversMm.foundation','Cobrimento das fundações'],
 ['structuralDefaults.beam.bM','Largura padrão de viga'],['structuralDefaults.beam.hM','Altura padrão de viga'],['structuralDefaults.column.bM','Dimensão padrão de pilar'],['structuralDefaults.slab.type','Tipologia de laje'],['structuralDefaults.slab.thicknessM','Espessura padrão de laje'],
 ['foundation.system','Sistema de fundação'],['foundation.soilModel','Modelo de solo'],['analysis.type','Tipo de análise']
];
const get=(o,path)=>path.split('.').reduce((a,k)=>a?.[k],o);const filled=v=>v!==null&&v!==undefined&&v!=='';
export function designBasisCompleteness(projectOrBasis={}){const b=projectOrBasis?.contract===BUILDING_DESIGN_BASIS_CONTRACT?normalizeBasis(projectOrBasis):designBasisFromProject(projectOrBasis),checks=required.map(([path,label])=>({path,label,ok:filled(get(b,path))}));if(b.actions.wind.enabled)checks.push({path:'actions.wind.basicSpeedMS',label:'Velocidade básica do vento',ok:filled(b.actions.wind.basicSpeedMS)});if(b.foundation.system&&/pile|estaca|piled/i.test(b.foundation.system)){checks.push({path:'foundation.pile.type',label:'Tipo de estaca',ok:filled(b.foundation.pile.type)},{path:'foundation.pile.diameterM',label:'Diâmetro de estaca',ok:filled(b.foundation.pile.diameterM)})}const complete=checks.filter(x=>x.ok).length;return{contract:'building-design-basis-completeness/v1',version:MARKET_PARITY_VERSION,total:checks.length,complete,missing:checks.filter(x=>!x.ok),ratio:checks.length?complete/checks.length:0,checks}}

function inferredCategory(sheet){const key=`${sheet?.title||''} ${sheet?.id||''} ${sheet?.source?.type||''}`.toLowerCase();if(/fund|sapata|estaca|bloco|radier/.test(key))return'foundations';if(/armadura|rebar|ferro|aço/.test(key))return'reinforcement';if(/laje|slab/.test(key))return'slabs';if(/viga|beam/.test(key))return'beams';if(/pilar|column|parede|wall/.test(key))return'columns';if(/forma|formwork/.test(key))return'formwork';if(/carga|result/.test(key))return'loads-results';return'general'}
export function drawingOrganizationFromProject(project={}){const stored=project?.documentation?.drawingOrganization||{};return{contract:DRAWING_ORGANIZATION_CONTRACT,version:MARKET_PARITY_VERSION,groupOrder:Array.isArray(stored.groupOrder)?stored.groupOrder:DRAWING_CATEGORIES.map(x=>x.id),assignments:clone(stored.assignments||{}),revision:text(stored.revision||'R0')}}
export function withDrawingAssignment(project,sheetId,patch={}){const p=clone(project||{}),org=drawingOrganizationFromProject(p);org.assignments[String(sheetId)]={...(org.assignments[String(sheetId)]||{}),...clone(patch)};p.documentation={...(p.documentation||{}),drawingOrganization:org};return p}
export function drawingSheetIndexFromProject(project={}){const org=drawingOrganizationFromProject(project),levels=deriveLevels(project),levelMap=new Map(levels.map(x=>[String(x.id),x])),rows=(project?.drawingSheets||[]).map(s=>{const a=org.assignments[String(s.id)]||{},category=a.category||s.category||inferredCategory(s),levelId=a.levelId??s.levelId??null,level=levelId?levelMap.get(String(levelId)):null;return{id:String(s.id),title:String(s.title||s.id),category,categoryLabel:DRAWING_CATEGORIES.find(x=>x.id===category)?.label||category,levelId:levelId||null,levelLabel:level?.name||'Geral',revision:s.revision||org.revision}});const groups=[];for(const r of rows){let g=groups.find(x=>x.category===r.category&&x.levelLabel===r.levelLabel);if(!g){g={category:r.category,categoryLabel:r.categoryLabel,levelId:r.levelId,levelLabel:r.levelLabel,sheets:[]};groups.push(g)}g.sheets.push(r)}return{contract:'drawing-sheet-index/v1',version:MARKET_PARITY_VERSION,count:rows.length,rows,groups}}
export function marketParityStatus(project={}){const c=designBasisCompleteness(project),levels=deriveLevels(project),foundationCount=project?.foundationReview?.items?.length||0,sheets=project?.drawingSheets?.length||0,has3d=(project?.elements||[]).some(e=>['frame3d','truss3d','shell4'].includes(e.type));return{contract:'market-parity-status/v1',version:MARKET_PARITY_VERSION,completeness:c,rows:[{id:'basis',label:'Critérios e durabilidade',state:c.ratio===1?'ready':'configure',detail:`${c.complete}/${c.total}`},{id:'levels',label:'Pavimentos e níveis',state:levels.length?'ready':'configure',detail:`${levels.length} nível(is)`},{id:'actions',label:'Ações e combinações',state:(project.loadCases||[]).length?'ready':'configure',detail:`${(project.loadCases||[]).length} caso(s)`},{id:'analysis',label:'Análise estrutural',state:project.settings?.analysisType?'ready':'configure',detail:project.settings?.analysisType||'—'},{id:'deformed3d',label:'Deformada 3D de barras e placas',state:has3d?'ready':'available',detail:has3d?'modelo 3D detectado':'disponível ao modelar em 3D'},{id:'foundations',label:'Fundações e solo',state:foundationCount?'ready':'configure',detail:`${foundationCount} item(ns)`},{id:'sheets',label:'Pranchas editáveis organizadas',state:sheets?'ready':'configure',detail:`${sheets} prancha(s)`}]}}
