import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PRODUCT_VERSION,PROJECT_SCHEMA_VERSION,RESULT_CONTRACT_VERSION} from '../web/src/core/version.js';
import {DETAILING_MODEL_CONTRACT,REBAR_SCHEDULE_CONTRACT,STEEL_SCHEDULE_CONTRACT,DETAILING_VERSION} from '../web/src/detailing/index.js';
import {CALCULATION_REPORT_CONTRACT,CALCULATION_REPORT_VERSION} from '../web/src/reports/index.js';
import {CODE_DESIGN_CONTRACT,CODE_DESIGN_VERSION} from '../web/src/codeDesign/index.js';
import {DESIGN_ACTIONS_CONTRACT,DESIGN_ACTIONS_VERSION} from '../web/src/designActions/index.js';

const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
assert.equal(pkg.version,'0.44.0','package.json deve declarar v0.44.0');
assert.equal(PRODUCT_VERSION,'0.44.0','PRODUCT_VERSION deve coincidir com package.json');
assert.equal(PROJECT_SCHEMA_VERSION,2,'v0.44 não altera o schema persistido');
assert.equal(RESULT_CONTRACT_VERSION,'1.0','v0.44 não altera structural-result/v1');

assert.equal(DETAILING_MODEL_CONTRACT,'detailing-model/v1');
assert.equal(REBAR_SCHEDULE_CONTRACT,'rebar-schedule/v1');
assert.equal(STEEL_SCHEDULE_CONTRACT,'steel-schedule/v1');
assert.equal(DETAILING_VERSION,'0.44.0-exp');
assert.equal(CALCULATION_REPORT_CONTRACT,'calculation-report/v1');
assert.equal(CALCULATION_REPORT_VERSION,'0.44.0-exp');
assert.equal(CODE_DESIGN_CONTRACT,'code-design/v1');
assert.equal(CODE_DESIGN_VERSION,'0.43.0-exp');
assert.equal(DESIGN_ACTIONS_CONTRACT,'design-actions/v1');
assert.equal(DESIGN_ACTIONS_VERSION,'0.42.0-exp');

const mandatory=[
  'tests/release-gate-v044-smoke.mjs',
  'tests/detailing-report-v044-smoke.mjs',
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
  'tests/numerical-core-v032-smoke.mjs'
];
for(const test of mandatory)assert.ok(pkg.scripts.test.includes(test),`gate obrigatório ausente: ${test}`);
assert.ok(!pkg.scripts.test.includes('tests/release-gate-v043-smoke.mjs'),'gate histórico v0.43 não deve bloquear a versão corrente');
assert.ok(!pkg.scripts.test.includes('run-smoke.mjs'),'descoberta automática continua proibida no gate principal');

const docs=await readFile(new URL('../docs/detailing-calculation-report-v044.md',import.meta.url),'utf8');
for(const phrase of [
  'detailing-model/v1',
  'rebar-schedule/v1',
  'steel-schedule/v1',
  'calculation-report/v1',
  'PENDENTE',
  'PROJECT_SCHEMA_VERSION',
  'RESULT_CONTRACT_VERSION',
  'v0.45 — interoperabilidade BIM/IFC',
  'Nenhuma promoção para `main`'
])assert.ok(docs.includes(phrase),`documentação v0.44 incompleta: ${phrase}`);

console.log('AstraStruct v0.44 release gate: product metadata, detailing/report contracts, deterministic validation chain and v0.45 IFC boundary coherent.');
