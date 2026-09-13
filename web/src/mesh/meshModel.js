export const MESH_ENGINE_CONTRACT='mesh-surface/v1';
export const SURFACE_MESH_CONTRACT='surface-mesh/v1';

const clone=v=>typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v));
const finite=(name,value)=>{const n=Number(value);if(!Number.isFinite(n))throw new Error(`SurfaceMesh: ${name} deve ser finito.`);return n};

export function normalizeMeshNode(node,index=0){
  const id=String(node?.id??'').trim();if(!id)throw new Error(`SurfaceMesh: node[${index}].id é obrigatório.`);
  return{id,x:finite(`node ${id}.x`,node.x),y:finite(`node ${id}.y`,node.y),z:finite(`node ${id}.z`,node.z??0),...(node.group!=null?{group:String(node.group)}:{}),...(node.meta?{meta:clone(node.meta)}:{})};
}

export function normalizeSurfaceCell(cell,index=0){
  const id=String(cell?.id??'').trim(),type=String(cell?.type||'').toLowerCase(),expected=type==='tri3'?3:type==='quad4'?4:0;if(!id)throw new Error(`SurfaceMesh: cell[${index}].id é obrigatório.`);if(!expected)throw new Error(`SurfaceMesh: tipo ${cell?.type||'(ausente)'} não suportado; use tri3 ou quad4.`);
  const nodeIds=Array.from(cell.nodeIds||[],String);if(nodeIds.length!==expected||new Set(nodeIds).size!==expected)throw new Error(`SurfaceMesh: ${id} requer ${expected} nós distintos.`);
  return{id,type,nodeIds,...(cell.group!=null?{group:String(cell.group)}:{}),...(cell.sourceElementId!=null?{sourceElementId:String(cell.sourceElementId)}:{}),...(cell.meta?{meta:clone(cell.meta)}:{})};
}

export function createSurfaceMesh({id='mesh',nodes=[],cells=[],groups={},metadata={}}={}){
  const normalizedNodes=Array.from(nodes,normalizeMeshNode),normalizedCells=Array.from(cells,normalizeSurfaceCell),nodeIds=new Set(),cellIds=new Set();
  for(const node of normalizedNodes){if(nodeIds.has(node.id))throw new Error(`SurfaceMesh: nó duplicado ${node.id}.`);nodeIds.add(node.id)}
  for(const cell of normalizedCells){if(cellIds.has(cell.id))throw new Error(`SurfaceMesh: célula duplicada ${cell.id}.`);cellIds.add(cell.id);for(const nodeId of cell.nodeIds)if(!nodeIds.has(nodeId))throw new Error(`SurfaceMesh: célula ${cell.id} referencia nó inexistente ${nodeId}.`)}
  return{contract:SURFACE_MESH_CONTRACT,id:String(id),nodes:normalizedNodes,cells:normalizedCells,groups:clone(groups||{}),metadata:clone(metadata||{})};
}

export function validateSurfaceMesh(mesh){createSurfaceMesh(mesh);return true}
export function cloneSurfaceMesh(mesh){return createSurfaceMesh(clone(mesh))}
export function meshNodeMap(mesh){return new Map((mesh?.nodes||[]).map(node=>[String(node.id),node]))}
export function meshCellMap(mesh){return new Map((mesh?.cells||[]).map(cell=>[String(cell.id),cell]))}

export function surfaceMeshFromProject(project,{id='project-surface',elementTypes=['shell4']}={}){
  const allowed=new Set(elementTypes.map(String)),source=(project?.elements||[]).filter(element=>allowed.has(String(element.type))),usedNodeIds=new Set(),cells=[];
  for(const element of source){
    const ids=element.type==='shell4'?(Array.isArray(element.nodeIds)&&element.nodeIds.length===4?element.nodeIds:[element.n1,element.n2,element.n3,element.n4]):element.nodeIds;
    const nodeIds=Array.from(ids||[]).filter(Boolean).map(String),type=nodeIds.length===3?'tri3':nodeIds.length===4?'quad4':null;if(!type)throw new Error(`SurfaceMesh: elemento ${element.id} não pode ser adaptado para tri3/quad4.`);nodeIds.forEach(nodeId=>usedNodeIds.add(nodeId));cells.push({id:String(element.id),type,nodeIds,sourceElementId:String(element.id),group:element.levelId??null,meta:{elementType:element.type}})
  }
  const nodes=(project?.nodes||[]).filter(node=>usedNodeIds.has(String(node.id))).map(node=>({id:String(node.id),x:node.x,y:node.y,z:node.z??0,group:node.levelId??null}));
  return createSurfaceMesh({id,nodes,cells,metadata:{source:'project',elementTypes:[...allowed]}});
}

export function shell4ElementsFromSurfaceMesh(mesh,{materialId=null,thickness=.18,shearCorrection=5/6,drillingFactor=1e-6,labelPrefix='Surface'}={}){
  validateSurfaceMesh(mesh);const out=[];for(const cell of mesh.cells){if(cell.type!=='quad4')continue;const [n1,n2,n3,n4]=cell.nodeIds;out.push({id:cell.sourceElementId||cell.id,type:'shell4',nodeIds:[n1,n2,n3,n4],n1,n2,n3,n4,...(materialId?{materialId}:{}),thickness:Number(thickness),shearCorrection:Number(shearCorrection),drillingFactor:Number(drillingFactor),label:`${labelPrefix} ${cell.id}`})}return out;
}
