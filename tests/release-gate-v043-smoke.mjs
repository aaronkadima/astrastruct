import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PRODUCT_VERSION,PROJECT_SCHEMA_VERSION,RESULT_CONTRACT_VERSION} from '../web/src/core/version.js';
import {CODE_DESIGN_CONTRACT,CODE_DESIGN_PROFILE_CONTRACT,CODE_DESIGN_CHECK_CONTRACT,CODE_DESIGN_VERSION} from '../web/src/codeDesign/index.js';
import {DESIGN_ACTIONS_CONTRACT,LOAD_COMBINATIONS_CONTRACT,COMBINATION_ENVELOPE_CONTRACT,DESIGN_ACTIONS_VERSION} from '../web/src/designActions/index.js';

const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
assert.equal(pkg.version,'0.43.0','package.json deve declarar v0.43.0');
assert.equal(PRODUCT_VERSION,'0.43.0','PRODUCT_VERSION deve coincidir com package.json');
assert.equal(PROJECT_SCHEMA_VERSION,2,'v0.43 não altera o schema persistido');
assert.equal(RESULT_CONTRACT_VERSION,'1.0','v0.43 não altera structural-result/v1');
assert.equal(CODE_DESIGN_CONTRACT,'code-design/v1');
assert.equal(CODE_DESIGN_PROFILE_CONTRACT,'code-design-profile/v1');
assert.equal(CODE_DESIGN_CHECK_CONTRACT,'code-design-check/v1');
assert.equal(CODE_DESIGN_VERSION,'0.43.0-exp');
assert.equal(DESIGN_ACTIONS_CONTRACT,'design-actions/v1');
assert.equal(LOAD_COMBINATIONS_CONTRACT,'load-combinations/v1');
assert.equal(COMBINATION_ENVELOPE_CONTRACT,'combination-envelope/v1');
assert.equal(DESIGN_ACTIONS_VERSION,'0.42.0-exp');

const mandatory=[
  'tests/code-design-v043-smoke.mjs',
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
  'tests/release-gate-v043-smoke.mjs'
];
for(const test of mandatory)assert.ok(pkg.scripts.test.includes(test),`gate obrigatório ausente: ${test}`);
assert.ok(!pkg.scripts.test.includes('tests/release-gate-v042-smoke.mjs'),'gate histórico v0.42 não deve bloquear a versão corrente');
assert.ok(!pkg.scripts.test.includes('run-smoke.mjs'),'descoberta automática continua proibida no gate principal');
assert.ok(!pkg.scripts.test.includes('v044'),'nenhum teste de detailing/report v0.44 pode ser antecipado no gate v0.43');

const docs=await readFile(new URL('../docs/code-design-v043.md',import.meta.url),'utf8');
for(const phrase of ['code-design/v1','Foundation','q(x,y)','PENDENTE','requiresLicensedParameters','automaticResistance','v0.44 — Detailing + professional calculation reports'])assert.ok(docs.includes(phrase),`documentação v0.43 incompleta: ${phrase}`);

console.log('AstraStruct v0.43 release gate: RC, steel, foundation, provenance, pending licensed data and v0.42 integration coherent.');
