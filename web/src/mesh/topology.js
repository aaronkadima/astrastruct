import {createSurfaceMesh,meshNodeMap} from './meshModel.js';

export const edgeKey=(a,b)=>[String(a),String(b)].sort().join('|');

function directedEdges(cell){return cell.nodeIds.map((a,i)=>({a:String(a),b:String(cell.nodeIds[(i+1)%cell.nodeIds.length]),cellId:cell.id,localEdge:i}))}

export function buildSurfaceTopology(mesh){
  const normalized=createSurfaceMesh(mesh),edgeMap=new Map(),cellAdjacency=new Map(normalized.cells.map(cell=>[cell.id,new Set()]));
  for(const cell of normalized.cells)for(const edge of directedEdges(cell)){
    const key=edgeKey(edge.a,edge.b);if(!edgeMap.has(key))edgeMap.set(key,{key,nodeIds:key.split('|'),uses:[]});edgeMap.get(key).uses.push(edge);
  }
  for(const edge of edgeMap.values())if(edge.uses.length===2){const [a,b]=edge.uses;cellAdjacency.get(a.cellId).add(b.cellId);cellAdjacency.get(b.cellId).add(a.cellId)}
  const boundaryEdges=[...edgeMap.values()].filter(edge=>edge.uses.length===1),interiorEdges=[...edgeMap.values()].filter(edge=>edge.uses.length===2),nonManifoldEdges=[...edgeMap.values()].filter(edge=>edge.uses.length>2),components=[];const unvisited=new Set(normalized.cells.map(cell=>cell.id));
  while(unvisited.size){const seed=unvisited.values().next().value,stack=[seed],component=[];unvisited.delete(seed);while(stack.length){const id=stack.pop();component.push(id);for(const neighbor of cellAdjacency.get(id)||[])if(unvisited.delete(neighbor))stack.push(neighbor)}components.push(component)}
  const boundaryAdj=new Map();for(const edge of boundaryEdges){const [a,b]=edge.nodeIds;if(!boundaryAdj.has(a))boundaryAdj.set(a,new Set());if(!boundaryAdj.has(b))boundaryAdj.set(b,new Set());boundaryAdj.get(a).add(b);boundaryAdj.get(b).add(a)}
  const openBoundaryNodes=[...boundaryAdj].filter(([,neighbors])=>neighbors.size!==2).map(([id])=>id),loops=[];
  if(!openBoundaryNodes.length){const unused=new Set(boundaryEdges.map(edge=>edge.key));while(unused.size){const firstKey=unused.values().next().value,[start,next0]=firstKey.split('|');let prev=start,current=next0,loop=[start,current];unused.delete(firstKey);while(current!==start){const candidates=[...(boundaryAdj.get(current)||[])].filter(id=>id!==prev&&unused.has(edgeKey(current,id)));if(!candidates.length)break;const next=candidates[0];unused.delete(edgeKey(current,next));prev=current;current=next;if(current!==start)loop.push(current)}if(current===start)loops.push(loop)}}
  return{contract:'surface-topology/v1',meshId:normalized.id,edges:[...edgeMap.values()],boundaryEdges,interiorEdges,nonManifoldEdges,cellAdjacency:Object.fromEntries([...cellAdjacency].map(([id,set])=>[id,[...set]])),components,boundaryLoops:loops,openBoundaryNodes,isManifold:nonManifoldEdges.length===0,isClosedBoundary:openBoundaryNodes.length===0};
}

function reverseCell(cell){const [first,...rest]=cell.nodeIds;return{...cell,nodeIds:[first,...rest.reverse()]}}
export function orientSurfaceMeshConsistently(mesh){
  let normalized=createSurfaceMesh(mesh),topology=buildSurfaceTopology(normalized);if(topology.nonManifoldEdges.length)throw new Error('SurfaceTopology: orientação consistente requer malha manifold.');
  const cells=new Map(normalized.cells.map(cell=>[cell.id,{...cell,nodeIds:[...cell.nodeIds]}])),visited=new Set(),flipped=[];
  for(const component of topology.components){const seed=component[0],queue=[seed];visited.add(seed);while(queue.length){const cellId=queue.shift(),cell=cells.get(cellId);for(const neighborId of topology.cellAdjacency[cellId]||[]){if(visited.has(neighborId))continue;let neighbor=cells.get(neighborId),shared=null;for(const edge of directedEdges(cell)){const key=edgeKey(edge.a,edge.b),match=directedEdges(neighbor).find(e=>edgeKey(e.a,e.b)===key);if(match){shared={edge,match};break}}if(!shared)continue;if(shared.edge.a===shared.match.a&&shared.edge.b===shared.match.b){neighbor=reverseCell(neighbor);cells.set(neighborId,neighbor);flipped.push(neighborId)}visited.add(neighborId);queue.push(neighborId)}}}
  normalized=createSurfaceMesh({...normalized,cells:normalized.cells.map(cell=>cells.get(cell.id))});topology=buildSurfaceTopology(normalized);return{mesh:normalized,flipped,topology};
}

export function meshBoundaryNodeIds(mesh){const topology=buildSurfaceTopology(mesh),ids=new Set();for(const edge of topology.boundaryEdges)edge.nodeIds.forEach(id=>ids.add(id));return[...ids]}

export function findCoincidentNodes(mesh,{tolerance=1e-9}={}){
  const normalized=createSurfaceMesh(mesh),tol=Math.max(1e-15,Math.abs(Number(tolerance)||1e-9)),map=meshNodeMap(normalized),pairs=[],ids=[...map.keys()];for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){const a=map.get(ids[i]),b=map.get(ids[j]),d=Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);if(d<=tol)pairs.push({a:a.id,b:b.id,distance:d})}return pairs;
}
