import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PRODUCT_VERSION,PROJECT_SCHEMA_VERSION,RESULT_CONTRACT_VERSION} from '../web/src/core/version.js';
import {LOAD_STAGE_ENGINE_CONTRACT,LOAD_STAGE_ENGINE_VERSION} from '../web/src/loadStage/index.js';
import {NONLINEAR_DYNAMICS_CONTRACT,NONLINEAR_DYNAMICS_VERSION} from '../web/src/dynamics/index.js';
import {DESIGN_ACTIONS_CONTRACT,LOAD_COMBINATIONS_CONTRACT,COMBINATION_ENVELOPE_CONTRACT,DESIGN_ACTIONS_VERSION} from '../web/src/designActions/index.js';

const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
assert.equal(pkg.version,'0.42.0','package.json deve declarar v0.42.0');
assert.equal(PRODUCT_VERSION,'0.42.0','PRODUCT_VERSION deve coincidir com package.json');
assert.equal(PROJECT_SCHEMA_VERSION,2,'v0.42 não altera o schema persistido');
assert.equal(RESULT_CONTRACT_VERSION,'1.0','v0.42 não altera structural-result/v1');
assert.equal(LOAD_STAGE_ENGINE_CONTRACT,'load-stage-engine/v1');
assert.equal(LOAD_STAGE_ENGINE_VERSION,'0.40.0-exp');
assert.equal(NONLINEAR_DYNAMICS_CONTRACT,'nonlinear-dynamics/v1');
assert.equal(NONLINEAR_DYNAMICS_VERSION,'0.41.0-exp');
assert.equal(DESIGN_ACTIONS_CONTRACT,'design-actions/v1');
assert.equal(LOAD_COMBINATIONS_CONTRACT,'load-combinations/v1');
assert.equal(COMBINATION_ENVELOPE_CONTRACT,'combination-envelope/v1');
assert.equal(DESIGN_ACTIONS_VERSION,'0.42.0-exp');

const mandatory=[
  'tests/design-actions-combinations-v042-smoke.mjs',
  'tests/nonlinear-dynamics-v041-smoke.mjs',
  'tests/load-stage-engine-v040-smoke.mjs',
  'tests/connections-anchors-v039-smoke.mjs',
  'tests/advanced-shell-contact-v038-smoke.mjs',
  'tests/nonlinear-rc-v037-smoke.mjs',
  'tests/advanced-element-library-v036-smoke.mjs',
  'tests/mesh-surface-engine-v035-smoke.mjs',
  'tests/section-engine-v034-smoke.mjs',
  'tests/component-element-api-v033-smoke.mjs',
  'tests/numerical-core-v032-smoke.mjs',
  'tests/release-gate-v042-smoke.mjs'
];
for(const test of mandatory)assert.ok(pkg.scripts.test.includes(test),`gate obrigatório ausente: ${test}`);
assert.ok(!pkg.scripts.test.includes('tests/release-gate-v041-smoke.mjs'),'gate histórico v0.41 não deve bloquear a versão corrente');
assert.ok(!pkg.scripts.test.includes('run-smoke.mjs'),'descoberta automática continua proibida no gate principal');
assert.ok(!pkg.scripts.test.includes('v043'),'nenhum teste de dimensionamento v0.43 pode ser antecipado no gate v0.42');

const docs=await readFile(new URL('../docs/design-actions-combinations-v042.md',import.meta.url),'utf8');
for(const phrase of ['design-actions/v1','load-combinations/v1','combination-envelope/v1','provenance','leading','accompanying','one-of','zero-or-one','v0.43 — RC/Steel/Foundation code design'])assert.ok(docs.includes(phrase),`documentação v0.42 incompleta: ${phrase}`);

console.log('AstraStruct v0.42 release gate: classified actions, explicit factors, deterministic combinations, v0.40 compilation and envelopes coherent.');
