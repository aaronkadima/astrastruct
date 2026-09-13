import {compileActionSet} from '../loadStage/actionEngine.js';

export const DESIGN_ACTIONS_CONTRACT='design-actions/v1';
export const LOAD_COMBINATIONS_CONTRACT='load-combinations/v1';
export const COMBINATION_ENVELOPE_CONTRACT='combination-envelope/v1';
export const DESIGN_ACTIONS_VERSION='0.42.0-exp';

const clone=v=>typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v));
const finite=(label,v)=>{const n=Number(v);if(!Number.isFinite(n))throw new Error(`DesignActions: ${label} deve ser finito.`);return n};
const nonEmpty=(label,v)=>{const s=String(v??'').trim();if(!s)throw new Error(`DesignActions: ${label} é obrigatório.`);return s};

function normalizeAction(action,index){
  const id=nonEmpty(`ação ${index+1}.id`,action?.id),category=nonEmpty(`${id}.designCategory`,action.designCategory??action.category??'other'),exclusiveGroup=action.exclusiveGroup==null?null:String(action.exclusiveGroup).trim()||null;
  return{...action,id,designCategory:category,factorClass:action.factorClass==null?null:String(action.factorClass),exclusiveGroup,leadingEligible:action.leadingEligible!==false,baseScale:finite(`${id}.scale`,action.scale??1)};
}
export function defineDesignActions(actions=[]){const rows=Array.from(actions||[],normalizeAction),ids=new Set();for(const row of rows){if(ids.has(row.id))throw new Error(`DesignActions: id duplicado '${row.id}'.`);ids.add(row.id)}return{contract:DESIGN_ACTIONS_CONTRACT,version:DESIGN_ACTIONS_VERSION,actions:rows}}

function validateRule(rule={}){
  const id=nonEmpty('rule.id',rule.id),limitState=nonEmpty(`${id}.limitState`,rule.limitState??'unspecified'),factors=rule.factors||{},provenance=rule.provenance||null;
  if(!provenance)throw new Error(`DesignActions: regra '${id}' requer provenance explícita; fatores normativos não podem ser anônimos.`);
  return{...rule,id,limitState,factors,provenance,leadingCategories:Array.from(rule.leadingCategories||['variable'],String),exclusivity:{...(rule.exclusivity||{})}};
}
function factorDefinition(action,rule){return rule.factors.byAction?.[action.id]??(action.factorClass?rule.factors.byClass?.[action.factorClass]:undefined)??rule.factors.byCategory?.[action.designCategory]??rule.factors.default}
function factorFor(action,rule,role){const raw=factorDefinition(action,rule);if(raw==null)throw new Error(`DesignActions: fator ausente para ação '${action.id}' (${action.factorClass||action.designCategory}).`);if(typeof raw==='number')return finite(`${action.id}.factor`,raw);const candidate=raw[role]??raw.default;if(candidate==null)throw new Error(`DesignActions: fator '${role}' ausente para ação '${action.id}'.`);return finite(`${action.id}.${role}`,candidate)}

function exclusiveVariants(actions,rule){
  const plain=actions.filter(a=>!a.exclusiveGroup),groups=new Map();for(const a of actions)if(a.exclusiveGroup){if(!groups.has(a.exclusiveGroup))groups.set(a.exclusiveGroup,[]);groups.get(a.exclusiveGroup).push(a)}
  let variants=[plain];for(const [group,rows] of groups){const mode=rule.exclusivity[group]??'one-of';if(!['one-of','zero-or-one'].includes(mode))throw new Error(`DesignActions: exclusivity '${group}' usa modo inválido '${mode}'.`);const choices=mode==='zero-or-one'?[null,...rows]:rows;variants=variants.flatMap(base=>choices.map(choice=>choice?[...base,choice]:[...base]))}return variants;
}
function stableId(rule,variantIndex,leader,terms){const suffix=terms.map(t=>`${t.actionId}:${Number(t.factor).toPrecision(8)}`).join('|');let h=2166136261;for(const ch of suffix)h=Math.imul(h^ch.charCodeAt(0),16777619);return `${rule.id}-V${variantIndex+1}-${leader||'NOLEAD'}-${(h>>>0).toString(16).padStart(8,'0')}`}

export function generateDesignCombinations({actions=[],rule}={}){
  const defined=defineDesignActions(actions),r=validateRule(rule),variants=exclusiveVariants(defined.actions,r),combinations=[];
  variants.forEach((selected,variantIndex)=>{
    const eligible=selected.filter(a=>a.leadingEligible&&r.leadingCategories.includes(a.designCategory)),leaders=eligible.length?eligible:[null];
    for(const leader of leaders){
      const terms=selected.map(action=>{const role=leader&&action.id===leader.id?'leading':eligible.includes(action)?'accompanying':'default',factor=factorFor(action,r,role);return{actionId:action.id,designCategory:action.designCategory,factorClass:action.factorClass,exclusiveGroup:action.exclusiveGroup,role,factor,baseScale:action.baseScale,effectiveScale:action.baseScale*factor}});
      combinations.push({id:stableId(r,variantIndex,leader?.id||null,terms),ruleId:r.id,limitState:r.limitState,variant:variantIndex+1,leadingActionId:leader?.id||null,terms,provenance:clone(r.provenance)});
    }
  });
  return{contract:LOAD_COMBINATIONS_CONTRACT,version:DESIGN_ACTIONS_VERSION,rule:{id:r.id,limitState:r.limitState,provenance:clone(r.provenance)},actions:defined.actions.map(a=>({id:a.id,designCategory:a.designCategory,factorClass:a.factorClass,exclusiveGroup:a.exclusiveGroup,leadingEligible:a.leadingEligible})),combinations};
}

export function compileDesignCombination({project,actions=[],combination,movingPositions={}}={}){
  if(!combination?.terms?.length)throw new Error('DesignActions: combination com terms é obrigatória.');const byId=new Map(actions.map(a=>[String(a.id),a])),scaled=[];
  for(const term of combination.terms){const base=byId.get(String(term.actionId));if(!base)throw new Error(`DesignActions: ação '${term.actionId}' da combinação não foi fornecida.`);scaled.push({...base,scale:finite(`${term.actionId}.effectiveScale`,term.effectiveScale)})}
  const compiled=compileActionSet({project,actions:scaled,activeActionIds:scaled.map(a=>a.id),movingPositions});
  return{contract:'compiled-design-combination/v1',combinationId:combination.id,limitState:combination.limitState,provenance:clone(combination.provenance),terms:clone(combination.terms),compiled};
}

function valueAtPath(obj,path){let v=obj;for(const key of String(path).split('.'))v=v?.[key];const n=Number(v);return Number.isFinite(n)?n:null}
export function envelopeCombinationResults({cases=[],paths=[]}={}){
  const rows=Array.from(cases||[]);if(!rows.length)throw new Error('DesignActions envelope: cases é obrigatório.');const result={};
  for(const path of paths){let min=null,max=null;for(const row of rows){const value=valueAtPath(row.result,path);if(value==null)continue;const point={value,combinationId:String(row.combinationId),caseId:row.caseId==null?null:String(row.caseId)};if(!min||value<min.value)min=point;if(!max||value>max.value)max=point}if(!min)throw new Error(`DesignActions envelope: nenhum valor finito em '${path}'.`);result[path]={min,max}}
  return{contract:COMBINATION_ENVELOPE_CONTRACT,version:DESIGN_ACTIONS_VERSION,count:rows.length,paths:result};
}
