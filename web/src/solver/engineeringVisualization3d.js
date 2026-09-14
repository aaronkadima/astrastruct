export const ENGINEERING_VISUALIZATION_3D_CONTRACT='engineering-visualization-3d/v1';
export const ENGINEERING_VISUALIZATION_3D_VERSION='0.54.0-exp';

const finite=v=>v!==''&&v!==null&&v!==undefined&&Number.isFinite(Number(v))?Number(v):null;
const text=(v,f='')=>String(v??f);
const mag3=(x,y,z)=>Math.hypot(Number(x)||0,Number(y)||0,Number(z)||0);

function displacementRows(result={}){return result.totalDisplacements||result.displacements||result.combined?.displacements||[]}
function reactionRows(result={}){return Array.isArray(result.reactions)?result.reactions:[]}
function elementForces(result={}){return Array.isArray(result.elementForces)?result.elementForces:[]}

function inferredLevels(project={}){
  const explicit=(project.levels||[]).filter(l=>finite(l?.elevation)!=null).map(l=>({id:text(l.id),label:text(l.name,l.id),elevation:Number(l.elevation)})).sort((a,b)=>a.elevation-b.elevation);
  if(explicit.length)return explicit;
  const zs=[...(project.nodes||[])].map(n=>finite(n?.z)).filter(v=>v!=null).sort((a,b)=>a-b),unique=[];
  for(const z of zs)if(!unique.length||Math.abs(z-unique[unique.length-1])>1e-6)unique.push(z);
  return unique.map((z,i)=>({id:`Z${i}`,label:i===0?'Base':`Nível ${i}`,elevation:z}));
}
function nodeLevel(project,levels,node){
  if(node?.levelId!=null&&levels.some(l=>l.id===String(node.levelId)))return String(node.levelId);
  const z=finite(node?.z);if(z==null||!levels.length)return null;let best=levels[0],d=Math.abs(z-best.elevation);for(const l of levels){const q=Math.abs(z-l.elevation);if(q<d){best=l;d=q}}return best.id;
}

function buildFloorSummaries(project,result){
  const levels=inferredLevels(project),dmap=new Map(displacementRows(result).map(d=>[String(d.nodeId),d])),nodes=project.nodes||[],out=[];
  for(const level of levels){const rows=nodes.filter(n=>nodeLevel(project,levels,n)===level.id).map(n=>({n,d:dmap.get(String(n.id))})).filter(x=>x.d);if(!rows.length){out.push({...level,nodeCount:0,uxMm:null,uyMm:null,uzMm:null,resultantMm:null});continue}
    const avg=k=>1000*rows.reduce((s,x)=>s+(Number(x.d?.[k])||0),0)/rows.length,uxMm=avg('ux'),uyMm=avg('uy'),uzMm=avg('uz');out.push({...level,nodeCount:rows.length,uxMm,uyMm,uzMm,resultantMm:Math.hypot(uxMm,uyMm,uzMm)});
  }
  const story=[];for(let i=1;i<out.length;i++){const a=out[i-1],b=out[i],h=b.elevation-a.elevation;if(!(h>0)||a.uxMm==null||b.uxMm==null)continue;const dx=(b.uxMm-a.uxMm)/1000,dy=(b.uyMm-a.uyMm)/1000;story.push({levelId:b.id,levelLabel:b.label,fromLevelId:a.id,heightM:h,driftX:dx/h,driftY:dy/h,driftRatio:Math.hypot(dx,dy)/h,driftMm:1000*Math.hypot(dx,dy)});}
  return{levels:out,storyDrifts:story};
}

function buildDisplacementScene(project,result){
  const dmap=new Map(displacementRows(result).map(d=>[String(d.nodeId),d])),nodes=[],scaleBase=[];
  for(const n of project.nodes||[]){const d=dmap.get(String(n.id)),ux=Number(d?.ux)||0,uy=Number(d?.uy)||0,uz=Number(d?.uz)||0,magnitude=mag3(ux,uy,uz);nodes.push({nodeId:String(n.id),x:Number(n.x)||0,y:Number(n.y)||0,z:Number(n.z)||0,ux,uy,uz,magnitude,deformed:{x:(Number(n.x)||0)+ux,y:(Number(n.y)||0)+uy,z:(Number(n.z)||0)+uz}});scaleBase.push(magnitude)}
  const maxMagnitude=Math.max(0,...scaleBase),coords=(project.nodes||[]).flatMap(n=>[Number(n.x)||0,Number(n.y)||0,Number(n.z)||0]),extent=coords.length?Math.max(...coords)-Math.min(...coords):1,autoScale=maxMagnitude>1e-12?Math.max(1,Math.min(100,0.12*Math.max(1,extent)/maxMagnitude)):1;
  const governing=nodes.slice().sort((a,b)=>b.magnitude-a.magnitude)[0]||null;
  return{nodes,maxMagnitudeMm:maxMagnitude*1000,governingNodeId:governing?.nodeId||null,autoDeformationScale:autoScale};
}

function shellScalar(f,key){
  const paths={Nx:['membraneResultants','Nx'],Ny:['membraneResultants','Ny'],Nxy:['membraneResultants','Nxy'],Mx:['bendingMoments','Mx'],My:['bendingMoments','My'],Mxy:['bendingMoments','Mxy'],Qx:['transverseShear','Qx'],Qy:['transverseShear','Qy'],sx:['membraneStress','sx'],sy:['membraneStress','sy'],txy:['membraneStress','txy']},p=paths[key];if(!p)return null;return finite(f?.[p[0]]?.[p[1]]);
}
function buildShellFields(result){
  const rows=elementForces(result).filter(f=>f?.type==='shell4'),fields={};for(const key of ['Nx','Ny','Nxy','Mx','My','Mxy','Qx','Qy','sx','sy','txy']){const values=rows.map(f=>({elementId:String(f.elementId),value:shellScalar(f,key)})).filter(x=>x.value!=null),maxAbs=Math.max(0,...values.map(x=>Math.abs(x.value))),governing=values.slice().sort((a,b)=>Math.abs(b.value)-Math.abs(a.value))[0]||null;fields[key]={values,maxAbs,governingElementId:governing?.elementId||null,governingValue:governing?.value??null}}
  return{elementCount:rows.length,fields,units:{Nx:'kN/m',Ny:'kN/m',Nxy:'kN/m',Mx:'kN·m/m',My:'kN·m/m',Mxy:'kN·m/m',Qx:'kN/m',Qy:'kN/m',sx:'kN/m²',sy:'kN/m²',txy:'kN/m²'}};
}

function buildFoundationReactions(project,result){
  const supports=new Set((project.supports||[]).map(s=>String(s.nodeId))),rows=reactionRows(result).filter(r=>supports.has(String(r.nodeId))).map(r=>({nodeId:String(r.nodeId),Fx:finite(r.fx)??0,Fy:finite(r.fy)??0,Fz:finite(r.fz)??0,Mx:finite(r.mx)??0,My:finite(r.my)??0,Mz:finite(r.mz)??0,resultantKN:Math.hypot(Number(r.fx)||0,Number(r.fy)||0,Number(r.fz)||0)}));
  const governing=rows.slice().sort((a,b)=>b.resultantKN-a.resultantKN)[0]||null;return{rows,governingNodeId:governing?.nodeId||null,maxResultantKN:governing?.resultantKN||0,foundationCount:Math.max((project.foundationReview?.items||[]).length,supports.size),displayRequired:true};
}

export function buildEngineeringVisualization3D(project={},result={}){
  const floors=buildFloorSummaries(project,result),displacement=buildDisplacementScene(project,result),shells=buildShellFields(result),foundation=buildFoundationReactions(project,result),hasPhysical=displacement.nodes.some(n=>n.magnitude>0)||foundation.rows.length>0;
  return{contract:ENGINEERING_VISUALIZATION_3D_CONTRACT,version:ENGINEERING_VISUALIZATION_3D_VERSION,analysisType:result.analysisType||'linear',scenarioId:result.scenario?.id||project?.settings?.analysisScenarioId||null,physicalResult:hasPhysical,displacement,floors,shells,foundation,detailReadiness:{analysisComplete:hasPhysical,automaticDetailingAllowed:hasPhysical,requiresEngineerReview:true},displayDefaults:{mode:'skeleton+slabs',showSlabs:true,showFoundation:true,showDeformed:hasPhysical,showStressContours:shells.elementCount>0,deformationScale:displacement.autoDeformationScale},governance:{noSyntheticResponses:true,sameSolverResult:true,noNormativePassFailInference:true,foundationAlwaysVisibleInWorkspace:true,slabsRemainVisibleInSkeletonMode:true}};
}
