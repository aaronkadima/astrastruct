const RULESETS = new Map();

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

export function getRuleSet(id) {
  return RULESETS.get(id) || null;
}

export function listRuleSets() {
  return [...RULESETS.values()];
}

export function evaluateRuleSet(id, input, context = {}) {
  const ruleset = getRuleSet(id);
  if (!ruleset) throw new Error(`RuleEngine: conjunto de regras não registrado: ${id}.`);
  const checks = ruleset.evaluate(input, context);
  return {
    contract: 'rule-result/v1',
    ruleSetId: ruleset.id,
    code: ruleset.code,
    edition: ruleset.edition,
    provenance: ruleset.provenance,
    checks: Array.isArray(checks) ? checks : [checks],
  };
}
