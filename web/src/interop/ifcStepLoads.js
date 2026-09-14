import {validateIfcGuid} from './ifcGuid.js';
import {validateIfcStructuralLoadMapping} from './ifcLoads.js';

export const IFC_STEP_LOAD_CONTRACT='ifc-step-loads/v1';
export const IFC_STEP_LOAD_VERSION='0.48.0-exp';

const ref=id=>`#${id}`;
const refs=ids=>`(${ids.map(ref).join(',')})`;
const enumValue=v=>`.${String(v).trim().toUpperCase()}.`;
const num=(value,name='number')=>{const n=Number(value);if(!Number.isFinite(n))throw new Error(`IFC STEP loads: ${name} deve ser finito.`);if(Number.isInteger(n))return`${n}.`;let s=String(n);if(!/[.eE]/.test(s))s+='.';return s.replace('e','E')};
function spfString(value){const source=String(value??'');let out='';for(const ch of source){const cp=ch.codePointAt(0);if(cp>=32&&cp<=126&&ch!=="'"&&ch!=='\\')out+=ch;else if(ch==="'")out+="''";else{const units=[];for(let i=0;i<ch.length;i++)units.push(ch.charCodeAt(i).toString(16).toUpperCase().padStart(4,'0'));out+=`\\X2\\${units.join('')}\\X0\\`;}}return`'${out}'`}
const optionalString=v=>v==null||v===''?'$':spfString(v);

function rooted(mapping){return[...(mapping.cases||[]),...(mapping.combinations||[]),...(mapping.actions||[]),...(mapping.relationships?.caseAssignments||[]),...(mapping.relationships?.combinationFactors||[]),...(mapping.relationships?.activityConnections||[])];}

export function validateIfcStepLoadReadiness(mapping,{loadGlobalIds={}}={}){
  validateIfcStructuralLoadMapping(mapping);
  if(!mapping.ready){const detail=(mapping.issues||[]).map(x=>x.code).join(', ');throw new Error(`IFC STEP loads: mapping possui bloqueios: ${detail}.`)}
  const ids=[],seen=new Set();
  for(const record of rooted(mapping)){
    const guid=loadGlobalIds?.[record.key];
    if(!validateIfcGuid(guid))throw new Error(`IFC STEP loads: GlobalId persistente obrigatório para ${record.key}.`);
    if(seen.has(guid))throw new Error(`IFC STEP loads: GlobalId duplicado ${guid}.`);seen.add(guid);ids.push(guid);
  }
  const topLevelKeys=(mapping.combinations||[]).length?mapping.combinations.map(x=>x.key):mapping.cases.map(x=>x.key);
  return{contract:IFC_STEP_LOAD_CONTRACT,version:IFC_STEP_LOAD_VERSION,loadCases:mapping.cases.length,loadCombinations:mapping.combinations.length,actions:mapping.actions.length,rootCount:ids.length,globalIds:ids,topLevelKeys};
}

export function emitIfcStepLoadGroups(emitter,mapping,{loadGlobalIds={},ownerHistoryId}={}){
  const ready=validateIfcStepLoadReadiness(mapping,{loadGlobalIds}),owner=ownerHistoryId?ref(ownerHistoryId):'$';
  for(const c of mapping.cases){
    emitter.add(`IFCSTRUCTURALLOADCASE(${spfString(loadGlobalIds[c.key])},${owner},${spfString(c.name)},$,$,${enumValue(c.predefinedType)},${enumValue(c.actionType)},${enumValue(c.actionSource)},${num(c.coefficient,`${c.sourceId}.Coefficient`)},${optionalString(c.purpose)},$)`,c.key);
  }
  for(const c of mapping.combinations){
    emitter.add(`IFCSTRUCTURALLOADGROUP(${spfString(loadGlobalIds[c.key])},${owner},${spfString(c.name)},$,$,${enumValue(c.predefinedType)},${enumValue(c.actionType)},${enumValue(c.actionSource)},${num(c.coefficient,`${c.sourceId}.Coefficient`)},${optionalString(c.purpose)})`,c.key);
  }
  return{...ready,topLevelEntityIds:ready.topLevelKeys.map(k=>emitter.id(k))};
}

function emitAppliedLoad(emitter,action){
  const load=action.appliedLoad,key=`step:applied-load:${action.sourceId}`;
  if(load.ifcClass==='IfcStructuralLoadSingleForce')return emitter.add(`IFCSTRUCTURALLOADSINGLEFORCE(${optionalString(load.name)},${num(load.forceX,'ForceX')},${num(load.forceY,'ForceY')},${num(load.forceZ,'ForceZ')},${num(load.momentX,'MomentX')},${num(load.momentY,'MomentY')},${num(load.momentZ,'MomentZ')})`,key);
  if(load.ifcClass==='IfcStructuralLoadLinearForce')return emitter.add(`IFCSTRUCTURALLOADLINEARFORCE(${optionalString(load.name)},${num(load.linearForceX,'LinearForceX')},${num(load.linearForceY,'LinearForceY')},${num(load.linearForceZ,'LinearForceZ')},${num(load.linearMomentX,'LinearMomentX')},${num(load.linearMomentY,'LinearMomentY')},${num(load.linearMomentZ,'LinearMomentZ')})`,key);
  throw new Error(`IFC STEP loads: AppliedLoad não suportado ${load.ifcClass}.`);
}

export function emitIfcStepLoadActions(emitter,mapping,{loadGlobalIds={},ownerHistoryId}={}){
  validateIfcStepLoadReadiness(mapping,{loadGlobalIds});const owner=ownerHistoryId?ref(ownerHistoryId):'$';
  for(const action of mapping.actions){
    const applied=emitAppliedLoad(emitter,action),guid=loadGlobalIds[action.key];
    if(action.ifcClass==='IfcStructuralPointAction')emitter.add(`IFCSTRUCTURALPOINTACTION(${spfString(guid)},${owner},${spfString(action.name)},$,$,$,$,${ref(applied)},${enumValue(action.globalOrLocal)},$)`,action.key);
    else if(action.ifcClass==='IfcStructuralLinearAction')emitter.add(`IFCSTRUCTURALLINEARACTION(${spfString(guid)},${owner},${spfString(action.name)},$,$,$,$,${ref(applied)},${enumValue(action.globalOrLocal)},$,${action.projectedOrTrue?enumValue(action.projectedOrTrue):'$'},${enumValue(action.predefinedType)})`,action.key);
    else throw new Error(`IFC STEP loads: ação não suportada ${action.ifcClass}.`);
  }
  for(const relation of mapping.relationships.caseAssignments){
    const related=relation.relatedObjectRefs.map(k=>emitter.id(k));
    emitter.add(`IFCRELASSIGNSTOGROUP(${spfString(loadGlobalIds[relation.key])},${owner},$,$,${refs(related)},$,${ref(emitter.id(relation.relatingGroupRef))})`,relation.key);
  }
  for(const relation of mapping.relationships.combinationFactors){
    const related=relation.relatedObjectRefs.map(k=>emitter.id(k));
    emitter.add(`IFCRELASSIGNSTOGROUPBYFACTOR(${spfString(loadGlobalIds[relation.key])},${owner},$,$,${refs(related)},$,${ref(emitter.id(relation.relatingGroupRef))},${num(relation.factor,'combination factor')})`,relation.key);
  }
  for(const relation of mapping.relationships.activityConnections){
    emitter.add(`IFCRELCONNECTSSTRUCTURALACTIVITY(${spfString(loadGlobalIds[relation.key])},${owner},$,$,${ref(emitter.id(relation.relatingElementRef))},${ref(emitter.id(relation.relatedStructuralActivityRef))})`,relation.key);
  }
  return{actions:mapping.actions.length,caseAssignments:mapping.relationships.caseAssignments.length,combinationFactors:mapping.relationships.combinationFactors.length,activityConnections:mapping.relationships.activityConnections.length};
}
