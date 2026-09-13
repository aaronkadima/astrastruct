import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PRODUCT_VERSION,PROJECT_SCHEMA_VERSION,RESULT_CONTRACT_VERSION} from '../web/src/core/version.js';
import {ELEMENT_COMPONENT_CONTRACT} from '../web/src/core/elementComponent.js';
import {CONNECTIONS_ANCHORS_CONTRACT,CONNECTIONS_ANCHORS_VERSION} from '../web/src/connections/index.js';
import {ADVANCED_SHELL_CONTACT_CONTRACT,ADVANCED_SHELL_CONTACT_VERSION} from '../web/src/shellContact/index.js';
import {
  LOAD_STAGE_ENGINE_CONTRACT,LOAD_STAGE_ENGINE_VERSION,LOAD_ACTION_CONTRACT,MOVING_LOAD_CONTRACT,
  CONSTRUCTION_STAGE_CONTRACT,PRESTRESS_ACTION_CONTRACT,TIME_DEPENDENT_EFFECTS_CONTRACT
} from '../web/src/loadStage/index.js';

const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
assert.equal(pkg.version,'0.40.0','package.json deve declarar v0.40.0');
assert.equal(PRODUCT_VERSION,'0.40.0','PRODUCT_VERSION deve coincidir com package.json');
assert.equal(PROJECT_SCHEMA_VERSION,2,'v0.40 não altera o schema persistido');
assert.equal(RESULT_CONTRACT_VERSION,'1.0','v0.40 não altera structural-result/v1');
assert.equal(ELEMENT_COMPONENT_CONTRACT,'element-component/v1');
assert.equal(CONNECTIONS_ANCHORS_CONTRACT,'connections-anchors/v1');
assert.equal(CONNECTIONS_ANCHORS_VERSION,'0.39.0-exp');
assert.equal(ADVANCED_SHELL_CONTACT_CONTRACT,'advanced-shell-contact/v1');
assert.equal(ADVANCED_SHELL_CONTACT_VERSION,'0.38.0-exp');
assert.equal(LOAD_STAGE_ENGINE_CONTRACT,'load-stage-engine/v1');
assert.equal(LOAD_STAGE_ENGINE_VERSION,'0.40.0-exp');
assert.equal(LOAD_ACTION_CONTRACT,'load-action/v1');
assert.equal(MOVING_LOAD_CONTRACT,'moving-load/v1');
assert.equal(CONSTRUCTION_STAGE_CONTRACT,'construction-stages/v1');
assert.equal(PRESTRESS_ACTION_CONTRACT,'prestress-action/v1');
assert.equal(TIME_DEPENDENT_EFFECTS_CONTRACT,'time-dependent-effects/v1');

const mandatory=[
  'tests/load-stage-engine-v040-smoke.mjs',
  'tests/connections-anchors-v039-smoke.mjs',
  'tests/advanced-shell-contact-v038-smoke.mjs',
  'tests/node-surface-contact-v038-smoke.mjs',
  'tests/nonlinear-rc-v037-smoke.mjs',
  'tests/advanced-element-library-v036-smoke.mjs',
  'tests/mesh-surface-engine-v035-smoke.mjs',
  'tests/section-engine-v034-smoke.mjs',
  'tests/component-element-api-v033-smoke.mjs',
  'tests/numerical-core-v032-smoke.mjs',
  'tests/local-verification-v0309-smoke.mjs',
  'tests/advanced-connection-mechanics-v0310-smoke.mjs',
  'tests/rule-engine-code-plugins-v0311-smoke.mjs',
  'tests/release-gate-v040-smoke.mjs'
];
for(const test of mandatory)assert.ok(pkg.scripts.test.includes(test),`gate obrigatório ausente: ${test}`);
assert.ok(!pkg.scripts.test.includes('tests/release-gate-v039-smoke.mjs'),'gate histórico v0.39 não deve bloquear a versão corrente');
assert.ok(!pkg.scripts.test.includes('run-smoke.mjs'),'descoberta automática continua proibida no gate principal');
assert.ok(!pkg.scripts.test.includes('v041'),'nenhum teste da v0.41 pode ser antecipado no gate v0.40');

const docs=await readFile(new URL('../docs/load-stage-engine-v040.md',import.meta.url),'utf8');
for(const phrase of ['load-stage-engine/v1','Moving Load Engine','Construction Stage Engine','deformação inicial','time-dependent-effects/v1','combinações normativas','v0.41 — Nonlinear Dynamics/Seismic'])assert.ok(docs.includes(phrase),`documentação v0.40 incompleta: ${phrase}`);

console.log('AstraStruct v0.40 release gate: actions, moving loads, construction stages, prestress and time-dependent effects coherent.');
