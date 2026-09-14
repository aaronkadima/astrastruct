import {validateIfcGuid} from './ifcGuid.js';

export const IFC_STEP_LOAD_PARSE_CONTRACT='ifc-step-load-parse/v1';
export const IFC_STEP_LOAD_PARSE_VERSION='0.48.0-exp';

const text=v=>String(v??'').trim();
const enumValue=token=>token&&typeof token==='object'&&typeof token.enum==='string'?token.enum:null;
const number=(value,name)=>{const n=Number(value);if(!Number.isFinite(n))throw new Error(`IFC load parser: ${name} deve ser finito.`);return n};
const list=token=>Array.isArray(token)?token:token==null?[]:(()=>{throw new Error('IFC load parser: lista esperada.')})();

function entity(parsed,token,expectedType=null){
  if(!token||!Number.isInteger(token.ref))throw new Error('IFC load parser: referência esperada.');
  const e=parsed.entities.get(token.ref);if(!e)throw new Error(`IFC load parser: entidade #${token.ref} ausente.`);
  if(expectedType&&e.type!==expectedType)throw new Error(`IFC load parser: esperado ${expectedType}, recebido ${e.type}.`);return e;
}
function globalId(e){const gid=e?.args?.[0];if(typeof gid!=='string'||!validateIfcGuid(gid))throw new Error(`IFC load parser: GlobalId inválido em #${e?.id||'?'}.`);return gid}
function uniqueRootGuids(records){const seen=new Set();for(const e of records){const gid=globalId(e);if(seen.has(gid))throw new Error(`IFC load parser: GlobalId duplicado ${gid}.`);seen.add(gid)}return seen}
function rootRecord(e){return{entityId:e.id,globalId:globalId(e),name:e.args?.[2]??null}}

function parseLoadCase(e){
  return{...rootRecord(e),predefinedType:enumValue(e.args?.[5]),actionType:enumValue(e.args?.[6]),actionSource:enumValue(e.args?.[7]),coefficient:number(e.args?.[8],`IfcStructuralLoadCase #${e.id}.Coefficient`),purpose:e.args?.[9]??null,selfWeightCoefficients:Array.isArray(e.args?.[10])?e.args[10].map((x,i)=>number(x,`SelfWeightCoefficients[${i}]`)):null};
}
function parseCombination(e){
  return{...rootRecord(e),predefinedType:enumValue(e.args?.[5]),actionType:enumValue(e.args?.[6]),actionSource:enumValue(e.args?.[7]),coefficient:number(e.args?.[8],`IfcStructuralLoadGroup #${e.id}.Coefficient`),purpose:e.args?.[9]??null,terms:[]};
}
function parseSingleForce(e){
  if(e.type!=='IFCSTRUCTURALLOADSINGLEFORCE')throw new Error(`IFC load parser: esperado IfcStructuralLoadSingleForce, recebido ${e.type}.`);
  return{entityId:e.id,ifcClass:'IfcStructuralLoadSingleForce',name:e.args?.[0]??null,forceX:number(e.args?.[1]??0,'ForceX'),forceY:number(e.args?.[2]??0,'ForceY'),forceZ:number(e.args?.[3]??0,'ForceZ'),momentX:number(e.args?.[4]??0,'MomentX'),momentY:number(e.args?.[5]??0,'MomentY'),momentZ:number(e.args?.[6]??0,'MomentZ')};
}
function parseLinearForce(e){
  if(e.type!=='IFCSTRUCTURALLOADLINEARFORCE')throw new Error(`IFC load parser: esperado IfcStructuralLoadLinearForce, recebido ${e.type}.`);
  return{entityId:e.id,ifcClass:'IfcStructuralLoadLinearForce',name:e.args?.[0]??null,linearForceX:number(e.args?.[1]??0,'LinearForceX'),linearForceY:number(e.args?.[2]??0,'LinearForceY'),linearForceZ:number(e.args?.[3]??0,'LinearForceZ'),linearMomentX:number(e.args?.[4]??0,'LinearMomentX'),linearMomentY:number(e.args?.[5]??0,'LinearMomentY'),linearMomentZ:number(e.args?.[6]??0,'LinearMomentZ')};
}
function parseAction(parsed,e,issues){
  const base={...rootRecord(e),globalOrLocal:enumValue(e.args?.[8]),destabilizingLoad:enumValue(e.args?.[9]),caseEntityId:null,targetEntityId:null,targetType:null,caseAssignmentGlobalId:null,activityConnectionGlobalId:null};
  try{
    const applied=entity(parsed,e.args?.[7]);
    if(e.type==='IFCSTRUCTURALPOINTACTION')return{...base,ifcClass:'IfcStructuralPointAction',appliedLoad:parseSingleForce(applied),projectedOrTrue:null,predefinedType:null};
    if(e.type==='IFCSTRUCTURALLINEARACTION')return{...base,ifcClass:'IfcStructuralLinearAction',appliedLoad:parseLinearForce(applied),projectedOrTrue:enumValue(e.args?.[10]),predefinedType:enumValue(e.args?.[11])};
  }catch(err){issues.push({severity:'BLOCKING',code:'LOAD_APPLIED_VALUE_UNSUPPORTED',entityId:e.id,message:err?.message||String(err)});return{...base,ifcClass:e.type,appliedLoad:null,projectedOrTrue:null,predefinedType:null}}
  issues.push({severity:'BLOCKING',code:'LOAD_ACTION_TYPE_UNSUPPORTED',entityId:e.id,message:`Ação IFC não suportada ${e.type}.`});return{...base,ifcClass:e.type,appliedLoad:null,projectedOrTrue:null,predefinedType:null};
}

export function extractIfcStructuralLoads(parsed){
  if(!parsed?.entities||!parsed?.byType)throw new Error('IFC load parser: resultado genérico de parse inválido.');
  const issues=[],caseEntities=parsed.byType.get('IFCSTRUCTURALLOADCASE')||[],combinationEntities=(parsed.byType.get('IFCSTRUCTURALLOADGROUP')||[]).filter(e=>enumValue(e.args?.[5])==='LOAD_COMBINATION'),pointEntities=parsed.byType.get('IFCSTRUCTURALPOINTACTION')||[],linearEntities=parsed.byType.get('IFCSTRUCTURALLINEARACTION')||[];
  const loadCases=caseEntities.map(parseLoadCase),loadCombinations=combinationEntities.map(parseCombination),actions=[...pointEntities.map(e=>parseAction(parsed,e,issues)),...linearEntities.map(e=>parseAction(parsed,e,issues))];
  const caseByEntity=new Map(loadCases.map(x=>[x.entityId,x])),comboByEntity=new Map(loadCombinations.map(x=>[x.entityId,x])),actionByEntity=new Map(actions.map(x=>[x.entityId,x]));
  const rootEntities=[...caseEntities,...combinationEntities,...pointEntities,...linearEntities];

  const caseAssignments=[];
  for(const rel of parsed.byType.get('IFCRELASSIGNSTOGROUP')||[]){
    const group=entity(parsed,rel.args?.[6]);if(group.type!=='IFCSTRUCTURALLOADCASE')continue;
    const related=list(rel.args?.[4]);
    for(const token of related){const target=entity(parsed,token);const action=actionByEntity.get(target.id);if(!action){issues.push({severity:'BLOCKING',code:'LOAD_CASE_MEMBER_UNSUPPORTED',entityId:rel.id,message:`IfcRelAssignsToGroup #${rel.id} associa ao load case uma entidade ${target.type} não suportada.`});continue}if(action.caseEntityId&&action.caseEntityId!==group.id)issues.push({severity:'BLOCKING',code:'LOAD_MULTIPLE_CASE_ASSIGNMENTS',entityId:action.entityId,message:`Ação #${action.entityId} pertence a mais de um load case.`});action.caseEntityId=group.id;action.caseAssignmentGlobalId=globalId(rel)}
    caseAssignments.push({...rootRecord(rel),caseEntityId:group.id,relatedActionEntityIds:related.map(x=>entity(parsed,x).id)});rootEntities.push(rel);
  }

  const activityConnections=[];
  for(const rel of parsed.byType.get('IFCRELCONNECTSSTRUCTURALACTIVITY')||[]){
    const target=entity(parsed,rel.args?.[4]),activity=entity(parsed,rel.args?.[5]),action=actionByEntity.get(activity.id);
    if(!action){issues.push({severity:'BLOCKING',code:'STRUCTURAL_ACTIVITY_UNSUPPORTED',entityId:rel.id,message:`IfcRelConnectsStructuralActivity #${rel.id} referencia atividade ${activity.type} não suportada.`});continue}
    if(action.targetEntityId&&action.targetEntityId!==target.id)issues.push({severity:'BLOCKING',code:'LOAD_MULTIPLE_TARGETS',entityId:action.entityId,message:`Ação #${action.entityId} está conectada a mais de um alvo estrutural.`});
    action.targetEntityId=target.id;action.targetType=target.type;action.activityConnectionGlobalId=globalId(rel);activityConnections.push({...rootRecord(rel),targetEntityId:target.id,targetType:target.type,actionEntityId:action.entityId});rootEntities.push(rel);
  }

  const combinationFactors=[];
  for(const rel of parsed.byType.get('IFCRELASSIGNSTOGROUPBYFACTOR')||[]){
    const combo=entity(parsed,rel.args?.[6]);if(!comboByEntity.has(combo.id)){issues.push({severity:'BLOCKING',code:'LOAD_FACTOR_GROUP_UNSUPPORTED',entityId:rel.id,message:`Relação fatorada #${rel.id} não aponta para uma LOAD_COMBINATION suportada.`});continue}
    const factor=number(rel.args?.[7],`IfcRelAssignsToGroupByFactor #${rel.id}.Factor`),related=list(rel.args?.[4]);
    for(const token of related){const loadCase=entity(parsed,token);if(!caseByEntity.has(loadCase.id)){issues.push({severity:'BLOCKING',code:'LOAD_FACTOR_CASE_UNSUPPORTED',entityId:rel.id,message:`Relação fatorada #${rel.id} referencia ${loadCase.type} em vez de IfcStructuralLoadCase.`});continue}const term={relationEntityId:rel.id,relationGlobalId:globalId(rel),combinationEntityId:combo.id,caseEntityId:loadCase.id,factor};combinationFactors.push(term);comboByEntity.get(combo.id).terms.push({caseEntityId:loadCase.id,factor,relationGlobalId:term.relationGlobalId})}
    rootEntities.push(rel);
  }

  for(const action of actions){if(!action.caseEntityId)issues.push({severity:'BLOCKING',code:'LOAD_CASE_ASSIGNMENT_MISSING',entityId:action.entityId,message:`Ação #${action.entityId} não está associada a IfcStructuralLoadCase.`});if(!action.targetEntityId)issues.push({severity:'BLOCKING',code:'LOAD_TARGET_MISSING',entityId:action.entityId,message:`Ação #${action.entityId} não está conectada a item estrutural.`})}
  for(const combo of loadCombinations)if(!combo.terms.length)issues.push({severity:'BLOCKING',code:'LOAD_COMBINATION_EMPTY',entityId:combo.entityId,message:`Combinação #${combo.entityId} não possui casos fatorados.`});

  const analysis=(parsed.byType.get('IFCSTRUCTURALANALYSISMODEL')||[])[0]||null,loadedByEntityIds=analysis?list(analysis.args?.[7]).map(token=>entity(parsed,token).id):[],loadedByGlobalIds=loadedByEntityIds.map(id=>{const e=parsed.entities.get(id);return globalId(e)});
  if(loadCombinations.length&&loadedByEntityIds.some(id=>!comboByEntity.has(id)))issues.push({severity:'BLOCKING',code:'LOADED_BY_NOT_TOP_LEVEL_COMBINATION',message:'IfcStructuralAnalysisModel.LoadedBy contém item que não é LOAD_COMBINATION enquanto existem combinações.'});
  if(!loadCombinations.length&&loadCases.length&&loadedByEntityIds.some(id=>!caseByEntity.has(id)))issues.push({severity:'BLOCKING',code:'LOADED_BY_NOT_LOAD_CASE',message:'IfcStructuralAnalysisModel.LoadedBy contém item que não é IfcStructuralLoadCase.'});

  uniqueRootGuids(rootEntities);
  return{contract:IFC_STEP_LOAD_PARSE_CONTRACT,version:IFC_STEP_LOAD_PARSE_VERSION,loadCases,loadCombinations,actions,relationships:{caseAssignments,combinationFactors,activityConnections},loadedByEntityIds,loadedByGlobalIds,issues,ready:issues.length===0,summary:{loadCases:loadCases.length,loadCombinations:loadCombinations.length,actions:actions.length,pointActions:actions.filter(x=>x.ifcClass==='IfcStructuralPointAction').length,linearActions:actions.filter(x=>x.ifcClass==='IfcStructuralLinearAction').length,caseAssignments:caseAssignments.length,combinationFactors:combinationFactors.length,activityConnections:activityConnections.length,blocking:issues.length}};
}
