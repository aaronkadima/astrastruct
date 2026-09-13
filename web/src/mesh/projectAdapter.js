import {surfaceMeshFromProject} from './meshModel.js';
import {refineSurfaceMeshConforming} from './refinement.js';

const clone=v=>typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v));
function uniqueId(base,used){let id=String(base),i=2;while(used.has(id))id=`${base}_${i++}`;used.add(id);return id}
const shellIds=element=>(Array.isArray(element?.nodeIds)&&element.nodeIds.length===4?element.nodeIds:[element?.n1,element?.n2,element?.n3,element?.n4]).filter(Boolean).map(String);

/**
 * Refines the shell4 surface through the generic v0.35 mesh engine and maps the
 * refined topology back into an AstraStruct project. Shell constitutive/element
 * properties are inherited from each source shell. Surface pressure loads are
 * duplicated onto children with identical pressure; unsupported element-load
 * kinds are rejected instead of being redistributed silently.
 */
export function refineProjectShellSurface(project,{cellIds=null,scope='component',nodePrefix='SMN',childSuffix='R'}={}){
  const p=clone(project||{}),originalShells=(p.elements||[]).filter(element=>element.type==='shell4'),shellById=new Map(originalShells.map(element=>[String(element.id),element]));if(!originalShells.length)throw new Error('SurfaceProjectAdapter: projeto sem elementos shell4.');
  const mesh0=surfaceMeshFromProject(p,{id:`${p.id||'project'}-surface`,elementTypes:['shell4']}),refined=refineSurfaceMeshConforming(mesh0,{cellIds,scope,nodePrefix,childSuffix}),mesh=refined.mesh,existingNodeIds=new Set((p.nodes||[]).map(node=>String(node.id))),addedNodes=[];
  for(const node of mesh.nodes)if(!existingNodeIds.has(String(node.id))){const created={id:String(node.id),x:node.x,y:node.y,z:node.z,...(node.group!=null?{levelId:node.group}:{})};p.nodes.push(created);existingNodeIds.add(created.id);addedNodes.push(created.id)}
  const rebuiltShells=mesh.cells.map(cell=>{
    if(cell.type!=='quad4')throw new Error(`SurfaceProjectAdapter: célula ${cell.id} é ${cell.type}; shell4 requer quad4.`);const sourceId=String(cell.sourceElementId||cell.id),source=shellById.get(sourceId);if(!source)throw new Error(`SurfaceProjectAdapter: shell de origem ${sourceId} não encontrado para ${cell.id}.`);const [n1,n2,n3,n4]=cell.nodeIds,unchanged=String(cell.id)===sourceId;
    return{...clone(source),id:String(cell.id),nodeIds:[n1,n2,n3,n4],n1,n2,n3,n4,...(!unchanged?{parentShellId:source.parentShellId||sourceId,meshRefinement:{sourceElementId:sourceId,parentCellId:cell.meta?.parentCellId||sourceId,refinementLevel:Number(cell.meta?.refinementLevel)||1}}:{}),...(cell.group!=null?{levelId:cell.group}:{})};
  });
  p.elements=(p.elements||[]).filter(element=>element.type!=='shell4').concat(rebuiltShells);
  const refinedParents=new Set(refined.report.refinedParentCellIds.map(String)),usedLoadIds=new Set((p.elementLoads||[]).map(load=>String(load.id))),nonShellLoads=(p.elementLoads||[]).filter(load=>!shellById.has(String(load.elementId))),rebuiltLoads=[];
  for(const load of (p.elementLoads||[]).filter(load=>shellById.has(String(load.elementId)))){
    const parentId=String(load.elementId),descendants=mesh.cells.filter(cell=>String(cell.sourceElementId||cell.id)===parentId);if(!descendants.length)continue;
    if(!refinedParents.has(parentId)){rebuiltLoads.push(clone(load));continue}
    if(!['surface','pressure'].includes(String(load.kind)))throw new Error(`SurfaceProjectAdapter: carga '${load.kind||'desconhecida'}' do shell ${parentId} não possui regra de transferência no refinamento.`);
    descendants.forEach((cell,index)=>rebuiltLoads.push({...clone(load),id:uniqueId(`${load.id||`LOAD_${parentId}`}_${index+1}`,usedLoadIds),elementId:String(cell.id)}));
  }
  p.elementLoads=[...nonShellLoads,...rebuiltLoads];const report={...refined.report,contract:'project-surface-refinement-report/v1',sourceShells:originalShells.length,resultShells:rebuiltShells.length,addedProjectNodes:addedNodes.length,sourceShellLoads:(project?.elementLoads||[]).filter(load=>shellById.has(String(load.elementId))).length,resultShellLoads:rebuiltLoads.length};p.meta={...(p.meta||{}),surfaceMeshEngineVersion:'0.35.0-exp',lastSurfaceMeshRefinement:report};
  return{project:p,mesh,report,topology:refined.topology};
}

export function projectShellSurfaceSummary(project){
  const shells=(project?.elements||[]).filter(element=>element.type==='shell4'),nodeIds=new Set();shells.forEach(element=>shellIds(element).forEach(id=>nodeIds.add(id)));return{shells:shells.length,shellNodes:nodeIds.size,surfaceLoads:(project?.elementLoads||[]).filter(load=>shells.some(element=>String(element.id)===String(load.elementId))&&['surface','pressure'].includes(String(load.kind))).length};
}
