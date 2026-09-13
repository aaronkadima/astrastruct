const RULESETS = new Map();
const finiteOrNull=v=>{
  if(v===null||v===undefined)return null;
  if(typeof v==='string'&&v.trim()==='')return null;
  const n=Number(v);
  return Number.isFinite(n)?n:null;
};

function normalizeCheck(check,index){
  const raw=check&&typeof check==='object'?check:{value:check};
  const demand=finiteOrNull(raw.demand),resistance=finiteOrNull(raw.resistance);
  let utilization=finiteOrNull(raw.utilization);
  if(utilization===null&&demand!==null&&resistance!==null&&resistance>0)utilization=demand/resistance;
  const ok=raw.ok===null?null:raw.ok!==undefined?Boolean(raw.ok):utilization===null?null:utilization<=1+1e-12;
  return Object.freeze({
    ...raw,
    id:String(raw.id||`check-${index+1}`),
    limitState:String(raw.limitState||raw.id||`check-${index+1}`),
    demand,
    resistance,
    utilization,
    ok,
    unit:String(raw.unit||'kN'),
    clause:raw.clause??null,
    equation:raw.equation??null,
    source:raw.source??null,
    notes:Array.isArray(raw.notes)?raw.notes:raw.notes?[String(raw.notes)]:[],
  });
}

export function registerRuleSet(definition) {
  if (!definition?.id) throw new Error('RuleEngineRegistry: definition.id é obrigatório.');
  if (typeof definition.evaluate !== 'function') throw new Error(`RuleEngineRegistry: ${definition.id} precisa de evaluate(input, context).`);
  const normalized = Object.freeze({
    code: 'custom',
    edition: null,
    scope: [],
    provenance: null,
    ...definition,
  });
  RULESETS.set(normalized.id, normalized);
  return normalized;
}

export function unregisterRuleSet(id){return RULESETS.delete(String(id||''))}
export function clearRuleSets(){RULESETS.clear()}
export function getRuleSet(id) {return RULESETS.get(id) || null;}
export function listRuleSets() {return [...RULESETS.values()];}

export function evaluateRuleSet(id, input, context = {}) {
  const ruleset = getRuleSet(id);
  if (!ruleset) throw new Error(`RuleEngine: conjunto de regras não registrado: ${id}.`);
  const evaluated=ruleset.evaluate(input, context),rawChecks=Array.isArray(evaluated)?evaluated:[evaluated];
  const checks=rawChecks.filter(v=>v!==undefined&&v!==null).map(normalizeCheck);
  return {
    contract: 'rule-result/v1',
    ruleSetId: ruleset.id,
    code: ruleset.code,
    edition: ruleset.edition,
    scope: ruleset.scope,
    provenance: ruleset.provenance,
    checks,
    summary:{count:checks.length,pass:checks.filter(c=>c.ok===true).length,fail:checks.filter(c=>c.ok===false).length,pending:checks.filter(c=>c.ok===null).length,maxUtilization:Math.max(0,...checks.map(c=>c.utilization??0))},
  };
}
