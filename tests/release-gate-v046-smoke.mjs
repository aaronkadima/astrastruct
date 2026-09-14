import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PRODUCT_VERSION,PROJECT_SCHEMA_VERSION,RESULT_CONTRACT_VERSION} from '../web/src/core/version.js';
import {
  IFC_INTEROP_CONTRACT,IFC_INTEROP_VERSION,IFC_SCHEMA,IFC_STANDARD,
  IFC_STEP_WRITER_CONTRACT,IFC_STEP_WRITER_VERSION,
  IFC_STEP_PARSER_CONTRACT,IFC_STEP_PARSER_VERSION,
  IFC_EXCHANGE_STATE_CONTRACT,IFC_EXCHANGE_VERSION,
  IFC_IMPORT_STAGING_CONTRACT,IFC_IMPORT_STAGING_VERSION,
  IFC_MECHANICAL_EXCHANGE_CONTRACT,IFC_MECHANICAL_EXCHANGE_VERSION
} from '../web/src/interop/index.js';

const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
assert.equal(pkg.version,'0.46.0','package.json deve declarar v0.46.0');
assert.equal(PRODUCT_VERSION,'0.46.0','PRODUCT_VERSION deve coincidir com package.json');
assert.equal(PROJECT_SCHEMA_VERSION,2,'v0.46 não altera o schema persistido');
assert.equal(RESULT_CONTRACT_VERSION,'1.0','v0.46 não altera structural-result/v1');

assert.equal(IFC_INTEROP_CONTRACT,'ifc-interoperability/v1');
assert.equal(IFC_INTEROP_VERSION,'0.45.0-exp','modelo canônico v0.45 permanece retrocompatível');
assert.equal(IFC_SCHEMA,'IFC4X3_ADD2');
assert.equal(IFC_STANDARD,'ISO 16739-1:2024');
assert.equal(IFC_STEP_WRITER_CONTRACT,'ifc-step-writer/v1');
assert.equal(IFC_STEP_WRITER_VERSION,'0.45.0-exp','writer mantém contrato v1 enquanto v0.46 adiciona conteúdo compatível');
assert.equal(IFC_STEP_PARSER_CONTRACT,'ifc-step-parser/v1');
assert.equal(IFC_STEP_PARSER_VERSION,'0.45.0-exp');
assert.equal(IFC_EXCHANGE_STATE_CONTRACT,'ifc-exchange-state/v1');
assert.equal(IFC_EXCHANGE_VERSION,'0.45.0-exp','estado persistente de exportação não deve migrar sem necessidade');
assert.equal(IFC_IMPORT_STAGING_CONTRACT,'ifc-import-staging/v1');
assert.equal(IFC_IMPORT_STAGING_VERSION,'0.46.0-exp');
assert.equal(IFC_MECHANICAL_EXCHANGE_CONTRACT,'ifc-mechanical-exchange/v1');
assert.equal(IFC_MECHANICAL_EXCHANGE_VERSION,'0.46.0-exp');

const mandatory=[
  'tests/release-gate-v046-smoke.mjs',
  'tests/ifc-import-staging-v046-smoke.mjs',
  'tests/ifc-interop-v045-smoke.mjs',
  'tests/ifc-units-v045-smoke.mjs',
  'tests/ifc-material-v045-smoke.mjs',
  'tests/ifc-step-v045-smoke.mjs',
  'tests/ifc-step-roundtrip-v045-smoke.mjs',
  'tests/ifc-exchange-ui-v045-smoke.mjs',
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
assert.ok(!pkg.scripts.test.includes('tests/release-gate-v045-smoke.mjs'),'gate histórico v0.45 não deve bloquear a versão corrente');
assert.ok(!pkg.scripts.test.includes('run-smoke.mjs'),'descoberta automática continua proibida no gate principal');

const docs=await readFile(new URL('../docs/ifc-import-v046.md',import.meta.url),'utf8');
for(const phrase of [
  'ifc-import-staging/v1',
  'ifc-mechanical-exchange/v1',
  'Pset_MaterialMechanical',
  'PIN_JOINED_MEMBER',
  'RIGID_JOINED_MEMBER',
  'analysisReady',
  'astrastruct.ifc.import.backup.v046',
  'IfcOpenShell',
  'desktop, Android e tablet',
  'PRODUCT_VERSION = 0.46.0',
  'Nenhuma promoção para `main`'
])assert.ok(docs.includes(phrase),`documentação v0.46 incompleta: ${phrase}`);

console.log('AstraStruct v0.46 release gate: controlled IFC import, mechanical property round-trip, unit guards, backup workflow, solver guard and publication boundary coherent.');
