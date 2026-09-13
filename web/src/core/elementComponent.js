export const ELEMENT_COMPONENT_CONTRACT='element-component/v1';

function cloneValue(value){
  if(value==null||typeof value!=='object')return value;
  if(typeof structuredClone==='function')return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function finiteVector(value,n,label){
  const out=Array.from(value||[],Number);
  if(out.length!==n||out.some(v=>!Number.isFinite(v)))throw new Error(`ElementComponent: ${label} deve ter ${n} valores finitos.`);
  return out;
}

function finiteMatrix(value,n,label){
  if(!Array.isArray(value)||value.length!==n)throw new Error(`ElementComponent: ${label} deve ser matriz ${n}×${n}.`);
  return value.map((row,i)=>finiteVector(row,n,`${label}[${i}]`));
}

function normalizeDofDescriptor(raw,index){
  const owner=String(raw?.owner??raw?.nodeId??'').trim(),label=String(raw?.label||'').trim();
  if(!owner||!label)throw new Error(`ElementComponent: DOF ${index} requer owner/nodeId e label.`);
  return Object.freeze({owner,label,nodeId:raw?.nodeId!=null?String(raw.nodeId):undefined});
}

export class ElementStateTransaction{
  constructor(initialState={}){this._committed=cloneValue(initialState);this._trial=cloneValue(initialState);this._revision=0;this._trialRevision=0}
  get revision(){return this._revision}
  get trialRevision(){return this._trialRevision}
  committed(){return cloneValue(this._committed)}
  trial(){return cloneValue(this._trial)}
  setTrial(next){this._trial=cloneValue(next??{});this._trialRevision++;return this.trial()}
  rollback(){this._trial=cloneValue(this._committed);this._trialRevision++;return this.trial()}
  commit(){this._committed=cloneValue(this._trial);this._revision++;return this.committed()}
  reset(next={}){this._committed=cloneValue(next);this._trial=cloneValue(next);this._revision++;this._trialRevision++;return this.snapshot()}
  snapshot(){return{revision:this._revision,trialRevision:this._trialRevision,committed:this.committed(),trial:this.trial()}}
}

export function createElementComponent({id,type,dofs,initialState={},evaluate,metadata={}}={}){
  const componentId=String(id||'').trim(),elementType=String(type||'').trim();
  if(!componentId)throw new Error('ElementComponent: id é obrigatório.');
  if(!elementType)throw new Error(`ElementComponent ${componentId}: type é obrigatório.`);
  if(typeof evaluate!=='function')throw new Error(`ElementComponent ${componentId}: evaluate() é obrigatório.`);
  const descriptors=Object.freeze(Array.from(dofs||[],normalizeDofDescriptor));
  if(!descriptors.length)throw new Error(`ElementComponent ${componentId}: ao menos um DOF é obrigatório.`);
  const state=new ElementStateTransaction(initialState);
  let lastResponse=null;

  function response(localDisplacements,context={}){
    const u=finiteVector(localDisplacements,descriptors.length,'deslocamentos locais');
    const committedState=state.committed(),trialState=state.trial();
    const raw=evaluate({u,committedState,trialState,context,component:api})||{};
    const residual=finiteVector(raw.residual,descriptors.length,'residual');
    const tangent=finiteMatrix(raw.tangent,descriptors.length,'tangent');
    if(raw.state!==undefined)state.setTrial(raw.state);
    const result={
      contract:'element-response/v1',componentId,elementType,residual,tangent,
      internalForce:raw.internalForce==null?null:finiteVector(raw.internalForce,descriptors.length,'internalForce'),
      externalForce:raw.externalForce==null?null:finiteVector(raw.externalForce,descriptors.length,'externalForce'),
      outputs:cloneValue(raw.outputs||{}),state:state.snapshot(),
    };
    lastResponse=result;return result;
  }

  const api={
    contract:ELEMENT_COMPONENT_CONTRACT,id:componentId,type:elementType,metadata:Object.freeze({...metadata}),
    dofs:()=>descriptors.map(d=>({...d})),dofCount:descriptors.length,response,
    residual:(u,context={})=>response(u,context).residual,
    tangent:(u,context={})=>response(u,context).tangent,
    commit:()=>state.commit(),rollback:()=>state.rollback(),resetState:(next={})=>state.reset(next),
    committedState:()=>state.committed(),trialState:()=>state.trial(),stateSnapshot:()=>state.snapshot(),
    lastResponse:()=>lastResponse?cloneValue(lastResponse):null,
  };
  return Object.freeze(api);
}

export function validateElementComponent(component){
  if(component?.contract!==ELEMENT_COMPONENT_CONTRACT)throw new Error(`ElementComponent: contrato inválido: ${component?.contract||'(ausente)'}.`);
  if(typeof component.response!=='function'||typeof component.commit!=='function'||typeof component.rollback!=='function')throw new Error(`ElementComponent ${component?.id||'(sem id)'}: interface incompleta.`);
  const dofs=component.dofs?.();if(!Array.isArray(dofs)||!dofs.length)throw new Error(`ElementComponent ${component?.id||'(sem id)'}: DOFs inválidos.`);
  return true;
}
