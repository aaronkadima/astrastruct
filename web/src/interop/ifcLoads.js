export const IFC_LOAD_EXCHANGE_CONTRACT='ifc-structural-loads/v1';
export const IFC_LOAD_EXCHANGE_VERSION='0.48.0-exp';

const text=v=>String(v??'').trim();
const finite=v=>Number.isFinite(Number(v));
const key=(kind,id)=>`${kind}:${text(id)}`;
const EPS=1e-15;

const ACTION_TYPE={permanent:'PERMANENT_G',variable:'VARIABLE_Q',extraordinary:'EXTRAORDINARY_A'};
const CURVE_TYPES=new Set(['frame2d','frame3d']);

function requireId(kind,value){const id=text(value);if(!id)throw new Error(`IFC loads: ${kind} requer id.`);return id}
function uniqueIds(items,kind){const seen=new Set();for(const item of items){const id=requireId(kind,item?.id);if(seen.has(id))throw new Error(`IFC loads: ${kind} duplicado ${id}.`);seen.add(id)}return seen}
function number(value,name){const n=Number(value??0);if(!Number.isFinite(n))throw new Error(`IFC loads: ${name} deve ser finito.`);return n}
function nonzero(values){return values.some(v=>Math.abs(Number(v)||0)>EPS)}
function actionTypeFor(loadCase){return ACTION_TYPE[text(loadCase?.type).toLowerCase()]||'NOTDEFINED'}

function resolveCaseId(load,cases,firstCaseId,warnings,issues){
  const explicit=text(load?.caseId);
  if(explicit){if(!cases.has(explicit)){issues.push({severity:'BLOCKING',code:'LOAD_CASE_UNRESOLVED',sourceId:load?.id??null,message:`Carga ${load?.id||'(sem id)'} referencia caso inexistente ${explicit}.`});return null}return explicit}
  if(firstCaseId){warnings.push({severity:'WARNING',code:'IMPLICIT_FIRST_LOAD_CASE',sourceId:load?.id??null,message:`Carga ${load?.id||'(sem id)'} sem caseId usa o primeiro caso ${firstCaseId}, conforme a semântica nativa do solver.`});return firstCaseId}
  issues.push({severity:'BLOCKING',code:'LOAD_CASE_MISSING',sourceId:load?.id??null,message:`Carga ${load?.id||'(sem id)'} não pode ser associada: o projeto não possui caso de carga.`});return null;
}

function caseRecord(source){
  const id=requireId('loadCase',source.id);
  return{
    key:key('load-case',id),ifcClass:'IfcStructuralLoadCase',sourceId:id,name:text(source.name)||id,
    predefinedType:'LOAD_CASE',actionType:actionTypeFor(source),actionSource:'NOTDEFINED',coefficient:1,purpose:null,selfWeightCoefficients:null,
    sourceType:text(source.type)||'user'
  };
}

function combinationRecords(project,caseSet,combinationSet,issues,warnings){
  const combinations=[],factorRelations=[];
  for(const combination of project.loadCombinations||[]){
    const id=requireId('loadCombination',combination.id);
    if(caseSet.has(id))throw new Error(`IFC loads: id ${id} é usado simultaneamente por caso e combinação.`);
    const combined=new Map();
    for(const [index,term] of (combination.terms||[]).entries()){
      const caseId=text(term?.caseId),factor=Number(term?.factor);
      if(!caseId||!caseSet.has(caseId)){issues.push({severity:'BLOCKING',code:'COMBINATION_CASE_UNRESOLVED',combinationId:id,index,message:`Combinação ${id} referencia caso inexistente ${caseId||'(vazio)'}.`});continue}
      if(!Number.isFinite(factor)){issues.push({severity:'BLOCKING',code:'COMBINATION_FACTOR_INVALID',combinationId:id,caseId,index,message:`Combinação ${id} possui fator não finito para ${caseId}.`});continue}
      combined.set(caseId,(combined.get(caseId)||0)+factor);
    }
    const terms=[];
    for(const [caseId,factor] of combined){
      if(Math.abs(factor)<=EPS){warnings.push({severity:'WARNING',code:'ZERO_COMBINATION_FACTOR_OMITTED',combinationId:id,caseId,message:`Termo ${caseId} da combinação ${id} resulta em fator zero e foi omitido.`});continue}
      terms.push({caseId,factor});
      factorRelations.push({key:key('rel-load-factor',`${id}:${caseId}`),ifcClass:'IfcRelAssignsToGroupByFactor',relatedObjectRefs:[key('load-case',caseId)],relatingGroupRef:key('load-combination',id),factor,source:{combinationId:id,caseId}});
    }
    if(!terms.length)issues.push({severity:'BLOCKING',code:'COMBINATION_EMPTY',combinationId:id,message:`Combinação ${id} não possui termos válidos não nulos.`});
    combinations.push({key:key('load-combination',id),ifcClass:'IfcStructuralLoadGroup',sourceId:id,name:text(combination.name)||id,predefinedType:'LOAD_COMBINATION',actionType:'NOTDEFINED',actionSource:'NOTDEFINED',coefficient:1,purpose:null,sourceType:text(combination.type)||'custom',terms});
  }
  return{combinations,factorRelations};
}

function nodalActions(project,nodeSet,caseSet,firstCaseId,issues,warnings){
  const actions=[],caseAssignments=[],activityConnections=[];
  for(const load of project.loads||[]){
    const id=requireId('nodal load',load.id),caseId=resolveCaseId(load,caseSet,firstCaseId,warnings,issues),nodeId=text(load.nodeId);
    if(!nodeId||!nodeSet.has(nodeId)){issues.push({severity:'BLOCKING',code:'LOAD_NODE_UNRESOLVED',sourceId:id,nodeId:nodeId||null,message:`Carga nodal ${id} referencia nó inexistente ${nodeId||'(vazio)'}.`});continue}
    const values={forceX:number(load.fx,`${id}.fx`),forceY:number(load.fy,`${id}.fy`),forceZ:number(load.fz,`${id}.fz`),momentX:number(load.mx,`${id}.mx`),momentY:number(load.my,`${id}.my`),momentZ:number(load.mz,`${id}.mz`)};
    if(!nonzero(Object.values(values))){warnings.push({severity:'WARNING',code:'ZERO_LOAD_OMITTED',sourceId:id,message:`Carga nodal ${id} possui todos os componentes nulos e foi omitida.`});continue}
    if(!caseId)continue;
    const actionKey=key('load-action',id);
    actions.push({key:actionKey,ifcClass:'IfcStructuralPointAction',sourceId:id,name:text(load.name)||id,caseRef:key('load-case',caseId),targetRef:key('node',nodeId),globalOrLocal:'GLOBAL_COORDS',destabilizingLoad:null,appliedLoad:{ifcClass:'IfcStructuralLoadSingleForce',name:text(load.name)||id,...values},source:{kind:'nodal',caseId,nodeId}});
    caseAssignments.push({key:key('rel-load-case',id),ifcClass:'IfcRelAssignsToGroup',relatedObjectRefs:[actionKey],relatingGroupRef:key('load-case',caseId),source:{loadId:id,caseId}});
    activityConnections.push({key:key('rel-load-activity',id),ifcClass:'IfcRelConnectsStructuralActivity',relatingElementRef:key('node',nodeId),relatedStructuralActivityRef:actionKey,source:{loadId:id,nodeId}});
  }
  return{actions,caseAssignments,activityConnections};
}

function elementActions(project,elementById,caseSet,firstCaseId,issues,warnings){
  const actions=[],caseAssignments=[],activityConnections=[],pending=[];
  for(const load of project.elementLoads||[]){
    const id=requireId('element load',load.id),caseId=resolveCaseId(load,caseSet,firstCaseId,warnings,issues),elementId=text(load.elementId),element=elementById.get(elementId),kind=text(load.kind);
    if(!element){issues.push({severity:'BLOCKING',code:'LOAD_ELEMENT_UNRESOLVED',sourceId:id,elementId:elementId||null,message:`Carga de elemento ${id} referencia elemento inexistente ${elementId||'(vazio)'}.`});continue}
    if(kind!=='uniform'){
      pending.push({sourceId:id,elementId,kind:kind||'unknown',reason:'ELEMENT_LOAD_KIND_UNSUPPORTED'});
      issues.push({severity:'BLOCKING',code:'ELEMENT_LOAD_KIND_UNSUPPORTED',sourceId:id,elementId,kind:kind||'unknown',message:`Carga ${id} do tipo ${kind||'(vazio)'} ainda não possui mapeamento IFC v0.48 seguro.`});continue;
    }
    if(!CURVE_TYPES.has(text(element.type).toLowerCase())){
      pending.push({sourceId:id,elementId,kind,reason:'UNIFORM_LOAD_TARGET_UNSUPPORTED'});
      issues.push({severity:'BLOCKING',code:'UNIFORM_LOAD_TARGET_UNSUPPORTED',sourceId:id,elementId,message:`Carga uniforme ${id} só é mapeada nesta etapa em frame2d/frame3d; alvo ${element.type||'(sem tipo)'}.`});continue;
    }
    const values={linearForceX:number(load.qx,`${id}.qx`),linearForceY:number(load.qy,`${id}.qy`),linearForceZ:number(load.qz,`${id}.qz`),linearMomentX:0,linearMomentY:0,linearMomentZ:0};
    if(!nonzero(Object.values(values))){warnings.push({severity:'WARNING',code:'ZERO_LOAD_OMITTED',sourceId:id,message:`Carga uniforme ${id} possui todos os componentes nulos e foi omitida.`});continue}
    if(!caseId)continue;
    const actionKey=key('load-action',id);
    actions.push({key:actionKey,ifcClass:'IfcStructuralLinearAction',sourceId:id,name:text(load.name)||id,caseRef:key('load-case',caseId),targetRef:key('member',elementId),globalOrLocal:'LOCAL_COORDS',destabilizingLoad:null,projectedOrTrue:null,predefinedType:'CONST',appliedLoad:{ifcClass:'IfcStructuralLoadLinearForce',name:text(load.name)||id,...values},source:{kind:'uniform',caseId,elementId}});
    caseAssignments.push({key:key('rel-load-case',id),ifcClass:'IfcRelAssignsToGroup',relatedObjectRefs:[actionKey],relatingGroupRef:key('load-case',caseId),source:{loadId:id,caseId}});
    activityConnections.push({key:key('rel-load-activity',id),ifcClass:'IfcRelConnectsStructuralActivity',relatingElementRef:key('member',elementId),relatedStructuralActivityRef:actionKey,source:{loadId:id,elementId}});
  }
  return{actions,caseAssignments,activityConnections,pending};
}

export function createIfcStructuralLoadMapping(project={}){
  const unitSystem=text(project.units)||'kN-m-MPa',issues=[],warnings=[],nodes=Array.isArray(project.nodes)?project.nodes:[],elements=Array.isArray(project.elements)?project.elements:[],loadCases=Array.isArray(project.loadCases)?project.loadCases:[],loadCombinations=Array.isArray(project.loadCombinations)?project.loadCombinations:[];
  if(unitSystem!=='kN-m-MPa')issues.push({severity:'BLOCKING',code:'UNIT_SYSTEM_UNSUPPORTED',message:`IFC loads v0.48 aceita somente kN-m-MPa; recebido ${unitSystem}.`});
  const nodeSet=uniqueIds(nodes,'node'),elementSet=uniqueIds(elements,'element'),caseSet=uniqueIds(loadCases,'loadCase'),combinationSet=uniqueIds(loadCombinations,'loadCombination');
  const elementById=new Map(elements.map(e=>[e.id,e])),cases=loadCases.map(caseRecord),firstCaseId=loadCases[0]?.id||null;
  const combined=combinationRecords({loadCombinations},caseSet,combinationSet,issues,warnings),nodal=nodalActions(project,nodeSet,caseSet,firstCaseId,issues,warnings),element=elementActions(project,elementById,caseSet,firstCaseId,issues,warnings);
  if((project.settlements||[]).length){issues.push({severity:'BLOCKING',code:'SETTLEMENT_EXCHANGE_PENDING',count:project.settlements.length,message:'Assentamentos nodais ainda não são materializados no contrato IFC de cargas v0.48.'})}
  const actions=[...nodal.actions,...element.actions],caseAssignments=[...nodal.caseAssignments,...element.caseAssignments],activityConnections=[...nodal.activityConnections,...element.activityConnections];
  const mapping={contract:IFC_LOAD_EXCHANGE_CONTRACT,version:IFC_LOAD_EXCHANGE_VERSION,unitSystem,cases,combinations:combined.combinations,actions,relationships:{caseAssignments,combinationFactors:combined.factorRelations,activityConnections},pending:element.pending,issues,warnings,ready:issues.length===0};
  validateIfcStructuralLoadMapping(mapping);return mapping;
}

export function validateIfcStructuralLoadMapping(mapping){
  if(mapping?.contract!==IFC_LOAD_EXCHANGE_CONTRACT||mapping?.version!==IFC_LOAD_EXCHANGE_VERSION)throw new Error('IFC loads: contrato/versão incompatível.');
  const caseKeys=new Set((mapping.cases||[]).map(x=>x.key)),combinationKeys=new Set((mapping.combinations||[]).map(x=>x.key)),actionKeys=new Set((mapping.actions||[]).map(x=>x.key));
  if(caseKeys.size!==(mapping.cases||[]).length)throw new Error('IFC loads: caso duplicado no mapping.');
  if(combinationKeys.size!==(mapping.combinations||[]).length)throw new Error('IFC loads: combinação duplicada no mapping.');
  if(actionKeys.size!==(mapping.actions||[]).length)throw new Error('IFC loads: ação duplicada no mapping.');
  for(const c of mapping.cases||[]){if(c.ifcClass!=='IfcStructuralLoadCase'||c.predefinedType!=='LOAD_CASE'||c.coefficient!==1)throw new Error(`IFC loads: caso inválido ${c.sourceId}.`)}
  for(const c of mapping.combinations||[]){if(c.ifcClass!=='IfcStructuralLoadGroup'||c.predefinedType!=='LOAD_COMBINATION'||c.coefficient!==1)throw new Error(`IFC loads: combinação inválida ${c.sourceId}.`)}
  for(const a of mapping.actions||[]){
    if(!caseKeys.has(a.caseRef))throw new Error(`IFC loads: ação ${a.sourceId} sem caso válido.`);
    if(a.ifcClass==='IfcStructuralPointAction'){if(a.globalOrLocal!=='GLOBAL_COORDS'||a.appliedLoad?.ifcClass!=='IfcStructuralLoadSingleForce')throw new Error(`IFC loads: ação pontual inválida ${a.sourceId}.`)}
    else if(a.ifcClass==='IfcStructuralLinearAction'){if(a.globalOrLocal!=='LOCAL_COORDS'||a.predefinedType!=='CONST'||a.appliedLoad?.ifcClass!=='IfcStructuralLoadLinearForce')throw new Error(`IFC loads: ação linear inválida ${a.sourceId}.`)}
    else throw new Error(`IFC loads: classe de ação não suportada ${a.ifcClass}.`);
  }
  for(const r of mapping.relationships?.caseAssignments||[])if(r.ifcClass!=='IfcRelAssignsToGroup'||!caseKeys.has(r.relatingGroupRef)||r.relatedObjectRefs.some(x=>!actionKeys.has(x)))throw new Error(`IFC loads: atribuição a caso inválida ${r.key}.`);
  for(const r of mapping.relationships?.combinationFactors||[])if(r.ifcClass!=='IfcRelAssignsToGroupByFactor'||!combinationKeys.has(r.relatingGroupRef)||r.relatedObjectRefs.length!==1||!caseKeys.has(r.relatedObjectRefs[0])||!finite(r.factor)||Math.abs(Number(r.factor))<=EPS)throw new Error(`IFC loads: fator de combinação inválido ${r.key}.`);
  if(mapping.ready!==(mapping.issues||[]).length===0)throw new Error('IFC loads: ready incoerente com issues.');
  return true;
}

export function summarizeIfcStructuralLoadMapping(mapping){
  validateIfcStructuralLoadMapping(mapping);
  return{cases:mapping.cases.length,combinations:mapping.combinations.length,actions:mapping.actions.length,pointActions:mapping.actions.filter(x=>x.ifcClass==='IfcStructuralPointAction').length,linearActions:mapping.actions.filter(x=>x.ifcClass==='IfcStructuralLinearAction').length,caseAssignments:mapping.relationships.caseAssignments.length,combinationFactors:mapping.relationships.combinationFactors.length,activityConnections:mapping.relationships.activityConnections.length,pending:mapping.pending.length,blocking:mapping.issues.length,warnings:mapping.warnings.length,ready:mapping.ready,unitSystem:mapping.unitSystem};
}
