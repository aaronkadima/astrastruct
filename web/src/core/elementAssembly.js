import {SparseMatrixBuilder} from '../numerics/sparseMatrix.js';
import {validateElementComponent} from './elementComponent.js';

function resolveDofIndex(dofManager,descriptor){
  const index=dofManager.maybe(descriptor.owner,descriptor.label);
  if(index==null)throw new Error(`ElementAssembly: DOF não registrado ${descriptor.owner}.${descriptor.label}.`);
  return index;
}

export function registerComponentDofs(component,dofManager){
  validateElementComponent(component);
  const indices=[];
  for(const descriptor of component.dofs()){
    if(dofManager.maybe(descriptor.owner,descriptor.label)==null)dofManager.register(descriptor.owner,descriptor.label,{kind:'node',nodeId:descriptor.nodeId||descriptor.owner});
    indices.push(resolveDofIndex(dofManager,descriptor));
  }
  return indices;
}

export function componentDofIndices(component,dofManager){
  validateElementComponent(component);return component.dofs().map(d=>resolveDofIndex(dofManager,d));
}

export function assembleElementComponents({components=[],dofManager,displacements=null,context={}}={}){
  if(!dofManager)throw new Error('ElementAssembly: dofManager é obrigatório.');
  const list=Array.from(components||[]);for(const component of list)registerComponentDofs(component,dofManager);
  const nd=dofManager.count,u=displacements==null?Array(nd).fill(0):Array.from(dofManager.assertVector(Array.from(displacements,Number),'ElementAssembly displacement')),builder=new SparseMatrixBuilder(nd),residual=Array(nd).fill(0),internalForce=Array(nd).fill(0),externalForce=Array(nd).fill(0),responses=[];
  if(u.some(v=>!Number.isFinite(v)))throw new Error('ElementAssembly: deslocamentos globais devem ser finitos.');
  for(const component of list){
    const indices=componentDofIndices(component,dofManager),localU=indices.map(i=>u[i]),response=component.response(localU,{...context,dofManager,globalDisplacements:u});
    builder.addBlock(indices,indices,response.tangent);
    response.residual.forEach((v,i)=>{residual[indices[i]]+=v});
    response.internalForce?.forEach((v,i)=>{internalForce[indices[i]]+=v});
    response.externalForce?.forEach((v,i)=>{externalForce[indices[i]]+=v});
    responses.push({componentId:component.id,indices,response});
  }
  return{contract:'element-assembly/v1',dofs:nd,tangent:builder.build(),residual,internalForce,externalForce,responses};
}

export function commitElementComponents(components=[]){return Array.from(components).map(component=>({componentId:component.id,state:component.commit()}))}
export function rollbackElementComponents(components=[]){return Array.from(components).map(component=>({componentId:component.id,state:component.rollback()}))}
