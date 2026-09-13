import {createSurfaceMesh,meshNodeMap} from './meshModel.js';
import {buildSurfaceTopology,edgeKey} from './topology.js';
import {evaluateSurfaceMeshQuality} from './surfaceGeometry.js';

const clone=v=>typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v));
const midpoint=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2,z:(a.z+b.z)/2});
const centroid=points=>({x:points.reduce((s,p)=>s+p.x,0)/points.length,y:points.reduce((s,p)=>s+p.y,0)/points.length,z:points.reduce((s,p)=>s+p.z,0)/points.length});
function safe(value){return String(value).replace(/[^a-zA-Z0-9_.-]+/g,'_')}
function uniqueId(base,used){let id=String(base),i=2;while(used.has(id))id=`${base}_${i++}`;used.add(id);return id}
function commonGroup(a,b){return a?.group!=null&&b?.group!=null&&String(a.group)===String(b.group)?String(a.group):null}

function selectedCellsForScope(mesh,topology,cellIds,scope){
  const allIds=new Set(mesh.cells.map(cell=>cell.id));
  if(!Array.isArray(cellIds)||!cellIds.length)return new Set(allIds);
  const requested=new Set(cellIds.map(String));for(const id of requested)if(!allIds.has(id))throw new Error(`SurfaceRefinement: célula ${id} não existe.`);
  if(scope==='all')return new Set(allIds);
  if(scope==='component'){
    const selected=new Set();for(const component of topology.components)if(component.some(id=>requested.has(id)))component.forEach(id=>selected.add(id));return selected;
  }
  if(scope==='selected'){
    for(const edge of topology.interiorEdges){const ids=edge.uses.map(use=>use.cellId),count=ids.filter(id=>requested.has(id)).length;if(count===1)throw new Error(`SurfaceRefinement: seleção não conforme na aresta ${edge.key}; use scope='component' ou refine o vizinho.`)}
    return requested;
  }
  throw new Error(`SurfaceRefinement: scope desconhecido '${scope}'.`);
}

/**
 * One-level conforming h-refinement for tri3/quad4 surface meshes.
 * tri3 -> 4 tri3 by shared edge midpoints.
 * quad4 -> 4 quad4 by shared edge midpoints + one cell center.
 *
 * For partial requests the default scope='component' expands the request to the
 * whole connected component, so hanging nodes are never introduced silently.
 * scope='selected' is accepted only when the selected set has no refined/unrefined
 * interior interface.
 */
export function refineSurfaceMeshConforming(mesh,{cellIds=null,scope='component',nodePrefix='RMN',childSuffix='R'}={}){
  const normalized=createSurfaceMesh(mesh),topology=buildSurfaceTopology(normalized);if(topology.nonManifoldEdges.length)throw new Error('SurfaceRefinement: malha não-manifold não pode ser refinada de forma conforme.');
  const selected=selectedCellsForScope(normalized,topology,cellIds,scope),nodeMap=meshNodeMap(normalized),nodes=normalized.nodes.map(clone),usedNodeIds=new Set(nodes.map(node=>node.id)),usedCellIds=new Set(normalized.cells.map(cell=>cell.id)),midpointByEdge=new Map();let createdEdgeNodes=0,createdCellNodes=0;
  const edgeMidpoint=(aId,bId)=>{
    const key=edgeKey(aId,bId);if(midpointByEdge.has(key))return midpointByEdge.get(key);const a=nodeMap.get(String(aId)),b=nodeMap.get(String(bId));if(!a||!b)throw new Error(`SurfaceRefinement: aresta ${key} referencia nó ausente.`);
    const group=commonGroup(a,b),id=uniqueId(`${nodePrefix}_${safe(aId)}_${safe(bId)}`,usedNodeIds),node={id,...midpoint(a,b),...(group!=null?{group}:{}),meta:{generatedBy:'surface-refinement',edgeNodeIds:[String(aId),String(bId)]}};nodes.push(node);nodeMap.set(id,node);midpointByEdge.set(key,id);createdEdgeNodes++;return id;
  };
  const children=[],kept=[];
  for(const cell of normalized.cells){
    if(!selected.has(cell.id)){kept.push(clone(cell));continue}
    const level=Math.max(0,Number(cell.meta?.refinementLevel)||0)+1,sourceElementId=cell.sourceElementId||cell.id,baseMeta={...(cell.meta||{}),parentCellId:cell.id,refinementLevel:level,generatedBy:'surface-refinement'};
    if(cell.type==='tri3'){
      const [a,b,c]=cell.nodeIds,mab=edgeMidpoint(a,b),mbc=edgeMidpoint(b,c),mca=edgeMidpoint(c,a),defs=[[a,mab,mca],[mab,b,mbc],[mca,mbc,c],[mab,mbc,mca]];
      defs.forEach((ids,i)=>children.push({id:uniqueId(`${cell.id}_${childSuffix}${i+1}`,usedCellIds),type:'tri3',nodeIds:ids,...(cell.group!=null?{group:cell.group}:{}),sourceElementId,meta:{...baseMeta,childIndex:i}}));
      continue;
    }
    const [a,b,c,d]=cell.nodeIds,mab=edgeMidpoint(a,b),mbc=edgeMidpoint(b,c),mcd=edgeMidpoint(c,d),mda=edgeMidpoint(d,a),centerId=uniqueId(`${nodePrefix}_${safe(cell.id)}_C`,usedNodeIds),centerNode={id:centerId,...centroid(cell.nodeIds.map(id=>nodeMap.get(String(id)))),...(cell.group!=null?{group:cell.group}:{}),meta:{generatedBy:'surface-refinement',parentCellId:cell.id}};nodes.push(centerNode);nodeMap.set(centerId,centerNode);createdCellNodes++;
    const defs=[[a,mab,centerId,mda],[mab,b,mbc,centerId],[centerId,mbc,c,mcd],[mda,centerId,mcd,d]];
    defs.forEach((ids,i)=>children.push({id:uniqueId(`${cell.id}_${childSuffix}${i+1}`,usedCellIds),type:'quad4',nodeIds:ids,...(cell.group!=null?{group:cell.group}:{}),sourceElementId,meta:{...baseMeta,childIndex:i}}));
  }
  const refined=createSurfaceMesh({...normalized,nodes,cells:[...kept,...children],metadata:{...(normalized.metadata||{}),lastRefinement:{scope,requestedCellIds:cellIds?cellIds.map(String):null,refinedParentCellIds:[...selected]}}}),qualityBefore=evaluateSurfaceMeshQuality(normalized),qualityAfter=evaluateSurfaceMeshQuality(refined),topologyAfter=buildSurfaceTopology(refined),areaRelativeError=Math.abs(qualityAfter.area-qualityBefore.area)/Math.max(1e-15,qualityBefore.area);
  if(topologyAfter.nonManifoldEdges.length)throw new Error('SurfaceRefinement: refinamento produziu aresta não-manifold.');
  return{mesh:refined,report:{contract:'surface-refinement-report/v1',scope,requestedCellIds:cellIds?cellIds.map(String):null,refinedParentCellIds:[...selected],sourceCells:normalized.cells.length,refinedParents:selected.size,childCells:children.length,resultCells:refined.cells.length,createdEdgeNodes,createdCellNodes,sourceNodes:normalized.nodes.length,resultNodes:refined.nodes.length,areaBefore:qualityBefore.area,areaAfter:qualityAfter.area,areaRelativeError,qualityBefore:qualityBefore.counts,qualityAfter:qualityAfter.counts,isManifold:topologyAfter.isManifold},topology:topologyAfter};
}
