import{deriveLevels}from'../core/levels.js';
import{structuralElementGroup}from'../visualization/appearance.js';
import{reviewFoundationProject}from'../foundation/review.js';
import{designBasisFromProject,drawingSheetIndexFromProject}from'./marketParity.js';

export const MARKET_PARITY_ADVANCED_VERSION='0.53.1-exp';
export const FOUNDATION_SCENE_CONTRACT='foundation-soil-scene/v1';
export const RESULT_DASHBOARD_CONTRACT='market-parity-result-dashboard/v1';
export const BUILDING_INVENTORY_CONTRACT='building-level-inventory/v1';

const clone=v=>v==null?v:typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v));
const finite=(v,f=null)=>v!==''&&v!==null&&v!==undefined&&Number.isFinite(Number(v))?Number(v):f;
const text=(v,f='')=>String(v??f);
const nodeIds=e=>Array.isArray(e?.nodeIds)&&e.nodeIds.length?e.nodeIds:[e?.n1,e?.n2,e?.n3,e?.n4].filter(Boolean);
const point=(project,id)=>(project?.nodes||[]).find(n=>String(n.id)===String(id));
const nearestLevel=(levels,z)=>levels.reduce((best,l)=>!best||Math.abs(Number(l.elevation)-z)<Math.abs(Number(best.elevation)-z)?l:best,null);
function elementLevel(project,levels,e){if(e?.levelId){const hit=levels.find(l=>String(l.id)===String(e.levelId));if(hit)return hit}const pts=nodeIds(e).map(id=>point(project,id)).filter(Boolean);if(!pts.length)return null;const z=pts.reduce((s,p)=>s+(Number(p.z)||0),0)/pts.length;return nearestLevel(levels,z)}
function countBy(rows,key){const out={};for(const r of rows)out[r[key]]=(out[r[key]]||0)+1;return out}

export function buildingLevelInventory(project={}){
  const levels=deriveLevels(project),elements=project?.elements||[],rows=elements.map(e=>{const group=structuralElementGroup(project,e),level=elementLevel(project,levels,e);return{id:String(e.id),type:String(e.type||''),group,levelId:level?.id||null,levelLabel:level?.name||'Sem nível',sectionId:e.sectionId||null,materialId:e.materialId||null}});
  const levelRows=levels.map(level=>{const items=rows.filter(r=>String(r.levelId)===String(level.id)),groups=countBy(items,'group');return{id:String(level.id),name:String(level.name),elevation:Number(level.elevation)||0,total:items.length,groups,items}});
  const unassigned=rows.filter(r=>!r.levelId);if(unassigned.length)levelRows.push({id:'UNASSIGNED',name:'Sem nível',elevation:null,total:unassigned.length,groups:countBy(unassigned,'group'),items:unassigned});
  return{contract:BUILDING_INVENTORY_CONTRACT,version:MARKET_PARITY_ADVANCED_VERSION,levels:levelRows,summary:{levels:levels.length,elements:rows.length,groups:countBy(rows,'group')}};
}

function normalizePile(p,i,item){return{id:text(p?.id,`${item.id}-P${i+1}`),x:finite(p?.x,item.x),y:finite(p?.y,item.y),zTop:finite(p?.zTop,0),lengthM:finite(p?.lengthM),diameterM:finite(p?.diameterM),capacityKN:finite(p?.capacityKN),status:text(p?.status,'configured')}}
function soilLayersFromBasis(basis){return(basis?.foundation?.soilLayers||[]).map((l,i)=>({id:text(l?.id,`SL${i+1}`),name:text(l?.name,`Camada ${i+1}`),topM:finite(l?.topM),bottomM:finite(l?.bottomM),gammaKNM3:finite(l?.gammaKNM3),phiDeg:finite(l?.phiDeg),cohesionKPa:finite(l?.cohesionKPa),modulusMPa:finite(l?.modulusMPa),description:text(l?.description)}))}
export function foundationSoilSceneFromProject(project={}){
  const basis=designBasisFromProject(project),rawItems=Array.isArray(project?.foundationReview?.items)?project.foundationReview.items:[],review=project?.foundationReview?reviewFoundationProject(project):{results:[],summary:{count:0,pass:0,fail:0,pending:0}},statusMap=new Map((review.results||[]).map(r=>[String(r.item?.id),r.status]));
  const system=text(basis?.foundation?.system),pileSystem=/pile|estaca|piled|barrete|tubul/i.test(system),items=rawItems.map((raw,i)=>{const id=text(raw?.id||raw?.nodeId,`F${i+1}`),node=point(project,raw?.nodeId),x=finite(raw?.x,finite(node?.x,0)),y=finite(raw?.y,finite(node?.y,0)),geometry={B:finite(raw?.geometry?.B),L:finite(raw?.geometry?.L),h:finite(raw?.geometry?.h),d:finite(raw?.geometry?.d)},type=text(raw?.type,system||'foundation'),piles=Array.isArray(raw?.piles)?raw.piles.map((p,j)=>normalizePile(p,j,{id,x,y})):[],localPileSystem=/pile|estaca|piled|barrete|tubul/i.test(type)||pileSystem;return{id,label:text(raw?.label,id),nodeId:raw?.nodeId||null,x,y,z:finite(raw?.z,0),type,geometry,status:statusMap.get(id)||'PENDING',piles,pileLayoutPending:localPileSystem&&piles.length===0,soil:clone(raw?.soil||{}),metadata:clone(raw?.metadata||{})}});
  const allX=[...(project?.nodes||[]).map(n=>finite(n.x,0)),...items.map(x=>x.x)],allY=[...(project?.nodes||[]).map(n=>finite(n.y,0)),...items.map(x=>x.y)],bounds={minX:Math.min(0,...allX),maxX:Math.max(1,...allX),minY:Math.min(0,...allY),maxY:Math.max(1,...allY)};
  return{contract:FOUNDATION_SCENE_CONTRACT,version:MARKET_PARITY_ADVANCED_VERSION,system:system||null,soilModel:basis?.foundation?.soilModel||null,waterTableDepthM:finite(basis?.foundation?.waterTableDepthM),soilLayers:soilLayersFromBasis(basis),items,bounds,summary:{...review.summary,pileLayoutPending:items.filter(x=>x.pileLayoutPending).length},governance:{geometrySource:'project/foundationReview',soilSource:'building-design-basis/v1',inventedEngineeringValues:false}};
}

function latestResult(project){return project?.results||project?.lastResult||project?.analysisResults||null}
function hasElementForce(result,predicate){return Array.isArray(result?.elementForces)&&result.elementForces.some(predicate)}
export function resultCapabilityDashboard(project={}){
  const inventory=buildingLevelInventory(project),groups=inventory.summary.groups||{},result=latestResult(project),levels=inventory.levels.filter(l=>l.id!=='UNASSIGNED').length,hasBars=(groups.beam||0)+(groups.column||0)+(groups.brace||0)>0,hasShells=(groups.slab||0)+(groups.wall||0)>0,has3D=(project?.elements||[]).some(e=>['frame3d','truss3d','shell4'].includes(String(e.type))),foundationScene=foundationSoilSceneFromProject(project),sheets=drawingSheetIndexFromProject(project),codeChecks=project?.codeChecks||project?.designChecks||project?.verificationResults||null;
  const rows=[
    {id:'deformed-3d',label:'Deformada 3D de vigas, pilares e placas',scope:'Estrutura',state:result&&has3D?'ready':has3D?'available':'configure',detail:result?'resultado carregado':has3D?'Canvas 3D disponível após análise':'modele elementos 3D'},
    {id:'bar-diagrams',label:'Diagramas N/V/M/T de barras',scope:'Barras',state:result&&hasBars&&hasElementForce(result,f=>String(f?.type)!=='shell4')?'ready':hasBars?'available':'configure',detail:hasBars?'vigas/pilares/contraventamentos detectados':'sem barras estruturais'},
    {id:'shell-contours',label:'Contornos de lajes/placas/paredes',scope:'Superfícies',state:result&&hasShells&&hasElementForce(result,f=>String(f?.type)==='shell4')?'ready':hasShells?'available':'configure',detail:hasShells?'Nx, Ny, Nxy, Mx, My, Mxy, Qx, Qy':'sem shell4'},
    {id:'drifts',label:'Deslocamentos e drifts por pavimento',scope:'Edifício',state:result&&Array.isArray(result?.storyDrifts)?'ready':levels>1?'available':'configure',detail:levels>1?`${levels} níveis cadastrados`:'cadastre pavimentos'},
    {id:'foundation-checks',label:'Status global das fundações',scope:'Fundações',state:foundationScene.summary.count?'ready':'configure',detail:`${foundationScene.summary.pass||0} PASS · ${foundationScene.summary.fail||0} FAIL · ${foundationScene.summary.pending||0} PENDING`},
    {id:'soil-pressure',label:'Pressões de contato / solo',scope:'Geotecnia',state:foundationScene.items.some(x=>finite(x?.soil?.qDesign)!=null)?'available':'configure',detail:foundationScene.soilLayers.length?`${foundationScene.soilLayers.length} camada(s) de solo`:'perfil de solo não cadastrado'},
    {id:'pile-reactions',label:'Reações por estaca',scope:'Fundações profundas',state:Array.isArray(project?.foundationResults?.pileReactions)&&project.foundationResults.pileReactions.length?'ready':foundationScene.items.some(x=>x.piles.length)?'available':'configure',detail:foundationScene.items.some(x=>x.pileLayoutPending)?'há blocos/estacas sem layout explícito':'sem dados inventados'},
    {id:'elu-els',label:'Dashboard ELU/ELS por nível e categoria',scope:'Dimensionamento',state:codeChecks?'ready':'available',detail:codeChecks?'verificações detectadas':'infraestrutura disponível; depende dos plugins normativos'},
    {id:'drawings',label:'Pranchas por categoria, nível e revisão',scope:'Documentação',state:sheets.count?'ready':'configure',detail:`${sheets.count} prancha(s)`},
  ];
  return{contract:RESULT_DASHBOARD_CONTRACT,version:MARKET_PARITY_ADVANCED_VERSION,hasRuntimeResult:!!result,rows,summary:{ready:rows.filter(r=>r.state==='ready').length,available:rows.filter(r=>r.state==='available').length,configure:rows.filter(r=>r.state==='configure').length}};
}

export function marketParityCoverageMatrix(project={}){
  const inventory=buildingLevelInventory(project),basis=designBasisFromProject(project),scene=foundationSoilSceneFromProject(project),results=resultCapabilityDashboard(project),sheets=drawingSheetIndexFromProject(project),has=(v)=>v!==null&&v!==undefined&&v!=='';
  const rows=[
    {domain:'Base do projeto',feature:'Norma, vida útil, exposição, fck/fyk e cobrimentos',state:has(basis.general.designCode)&&has(basis.durability.exposureClass)?'configured':'configure'},
    {domain:'Modelagem',feature:'Pavimentos/níveis + vigas/pilares/lajes/paredes',state:inventory.summary.levels&&inventory.summary.elements?'configured':'configure'},
    {domain:'Ações',feature:'Peso próprio, permanentes, uso, vento, sismo, temperatura',state:(project.loadCases||[]).length?'configured':'configure'},
    {domain:'Análise',feature:'Linear, P-Delta, não linear, modal, espectro e história no tempo',state:project?.settings?.analysisType?'available':'configure'},
    {domain:'Resultados',feature:'Deformada 3D, diagramas de barras e contornos de casca',state:results.rows.some(r=>r.state==='ready')?'configured':'available'},
    {domain:'Fundações',feature:'Sapatas/blocos/radier/estacas + revisão PASS/FAIL/PENDING',state:scene.items.length?'configured':'configure'},
    {domain:'Geotecnia',feature:'Camadas de solo, água, apoio elástico/SSI e reações',state:scene.soilLayers.length?'configured':'configure'},
    {domain:'Documentação',feature:'Pranchas editáveis por categoria, nível e revisão',state:sheets.count?'configured':'configure'},
    {domain:'Paridade pendente',feature:'Geração normativa auditável de vento e perfis normativos completos',state:'planned'},
    {domain:'Paridade pendente',feature:'SSI espacial iterativo e resultados geotécnicos de campo',state:'planned'},
  ];
  return{contract:'market-parity-coverage/v1',version:MARKET_PARITY_ADVANCED_VERSION,rows,summary:{configured:rows.filter(r=>r.state==='configured').length,available:rows.filter(r=>r.state==='available').length,configure:rows.filter(r=>r.state==='configure').length,planned:rows.filter(r=>r.state==='planned').length}};
}
