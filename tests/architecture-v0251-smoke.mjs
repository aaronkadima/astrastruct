import assert from 'node:assert/strict';
import { demoFrame, normalizeProject } from '../web/src/core/model.js';
import { PRODUCT_VERSION, PROJECT_SCHEMA_VERSION } from '../web/src/core/version.js';
import { analysisConfigFromSettings, settingsFromAnalysisConfig } from '../web/src/core/analysisConfig.js';
import { classifyElementSet, getElementDefinition, inferProjectDimension } from '../web/src/core/elementRegistry.js';
import { findSolver, getSolverDefinition } from '../web/src/core/solverRegistry.js';
import { createAnalysisRequest } from '../web/src/core/contracts.js';
import { registerRuleSet, evaluateRuleSet } from '../web/src/core/ruleEngine.js';
import { solve } from '../web/src/solver/index.js';

const legacy = demoFrame();
delete legacy.schemaVersion;
delete legacy.analysis;
legacy.meta = { solverVersion: '0.13.6-exp', createdAt: legacy.meta?.createdAt };
const migrated = normalizeProject(legacy);
assert.equal(migrated.schemaVersion, PROJECT_SCHEMA_VERSION);
assert.equal(migrated.meta.productVersion, PRODUCT_VERSION);
assert.equal(migrated.analysis.contract, 'analysis-config/v1');
assert.equal(migrated.analysis.static.analysisType, 'linear');
assert.ok(migrated.meta.migrations.includes('project-schema-v1-to-v2'));

const grouped = analysisConfigFromSettings({ analysisType:'modal', modalModes:8, dynamicDampingRatio:.05, groundMotionScaleFactor:1.4, grid:.5 });
const roundTrip = settingsFromAnalysisConfig(grouped, {});
assert.equal(roundTrip.analysisType, 'modal');
assert.equal(roundTrip.modalModes, 8);
assert.equal(roundTrip.dynamicDampingRatio, .05);
assert.equal(roundTrip.groundMotionScaleFactor, 1.4);
assert.equal(roundTrip.grid, .5);

assert.equal(getElementDefinition('frame2d').dimension, '2d');
assert.equal(getElementDefinition('truss2d').nodeCount, 2);
assert.equal(classifyElementSet(migrated), 'frame2d');
assert.equal(inferProjectDimension(migrated), '2d');
assert.equal(getSolverDefinition('linear-frame2d').analysisType, 'linear');
assert.equal(findSolver({analysisType:'linear',dimension:'2d',elementSet:'frame2d'}).id, 'linear-frame2d');

const request = createAnalysisRequest(migrated, 'LC1');
assert.equal(request.analysis.solverId, 'linear-frame2d');
assert.equal(request.model.dimension, '2d');
const result = solve(migrated, 'LC1');
assert.equal(result.contract?.name, 'structural-result/v1');
assert.equal(result.contract?.provenance?.productVersion, PRODUCT_VERSION);
assert.equal(result.contract?.request?.solverId, 'linear-frame2d');

registerRuleSet({
  id:'TEST-DEMO', code:'TEST', edition:'2026', scope:['smoke'], provenance:'architecture-v0251-smoke',
  evaluate(input){ return { id:'demo-check', demand:Number(input.demand), resistance:Number(input.resistance), utilization:Number(input.demand)/Number(input.resistance), status:Number(input.demand)<=Number(input.resistance)?'pass':'fail' }; }
});
const ruleResult=evaluateRuleSet('TEST-DEMO',{demand:80,resistance:100});
assert.equal(ruleResult.contract,'rule-result/v1');
assert.equal(ruleResult.checks[0].status,'pass');
assert.equal(ruleResult.checks[0].utilization,.8);

assert.throws(()=>normalizeProject({...legacy,schemaVersion:PROJECT_SCHEMA_VERSION+1}),/superior ao suportado/);
console.log('v0.25.1 architecture consolidation smoke: OK', { schema:migrated.schemaVersion, product:migrated.meta.productVersion, solver:request.analysis.solverId });
