import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PRODUCT_VERSION,PROJECT_SCHEMA_VERSION,RESULT_CONTRACT_VERSION} from '../web/src/core/version.js';
import {
  IFC_SCHEMA,IFC_STANDARD,
  IFC_LOAD_EXCHANGE_CONTRACT,IFC_LOAD_EXCHANGE_VERSION,
  IFC_STEP_LOAD_CONTRACT,IFC_STEP_LOAD_VERSION,
  IFC_STEP_LOAD_PARSE_CONTRACT,IFC_STEP_LOAD_PARSE_VERSION,
  IFC_STEP_WRITER_CONTRACT,IFC_STEP_WRITER_VERSION,
  IFC_EXCHANGE_STATE_CONTRACT,IFC_EXCHANGE_VERSION,
  IFC_IMPORT_STAGING_CONTRACT,IFC_IMPORT_STAGING_VERSION,
  IFC_MATERIAL_STRENGTH_VERSION,IFC_MECHANICAL_EXCHANGE_VERSION
} from '../web/src/interop/index.js';

const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
assert.equal(pkg.version,'0.48.0','package.json deve declarar v0.48.0');
assert.equal(PRODUCT_VERSION,'0.48.0','PRODUCT_VERSION deve coincidir com package.json');
assert.equal(PROJECT_SCHEMA_VERSION,2,'v0.48 não altera o schema persistido');
assert.equal(RESULT_CONTRACT_VERSION,'1.0','v0.48 não altera structural-result/v1');
assert.equal(IFC_SCHEMA,'IFC4X3_ADD2');assert.equal(IFC_STANDARD,'ISO 16739-1:2024');
assert.equal(IFC_LOAD_EXCHANGE_CONTRACT,'ifc-structural-loads/v1');assert.equal(IFC_LOAD_EXCHANGE_VERSION,'0.48.0-exp');
assert.equal(IFC_STEP_LOAD_CONTRACT,'ifc-step-loads/v1');assert.equal(IFC_STEP_LOAD_VERSION,'0.48.0-exp');
assert.equal(IFC_STEP_LOAD_PARSE_CONTRACT,'ifc-step-load-parse/v1');assert.equal(IFC_STEP_LOAD_PARSE_VERSION,'0.48.0-exp');
assert.equal(IFC_STEP_WRITER_CONTRACT,'ifc-step-writer/v1');assert.equal(IFC_STEP_WRITER_VERSION,'0.48.0-exp');
assert.equal(IFC_EXCHANGE_STATE_CONTRACT,'ifc-exchange-state/v1');assert.equal(IFC_EXCHANGE_VERSION,'0.48.0-exp');
assert.equal(IFC_IMPORT_STAGING_CONTRACT,'ifc-import-staging/v1');assert.equal(IFC_IMPORT_STAGING_VERSION,'0.48.0-exp');
assert.equal(IFC_MATERIAL_STRENGTH_VERSION,'0.47.0-exp');assert.equal(IFC_MECHANICAL_EXCHANGE_VERSION,'0.46.0-exp');

const mandatory=[
  'tests/release-gate-v048-smoke.mjs',
  'tests/ifc-load-import-v048-smoke.mjs',
  'tests/ifc-load-parse-v048-smoke.mjs',
  'tests/ifc-step-loads-v048-smoke.mjs',
  'tests/ifc-load-mapping-v048-smoke.mjs',
  'tests/ifc-material-strength-v047-smoke.mjs',
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
assert.ok(!pkg.scripts.test.includes('tests/development-gate-v048-smoke.mjs'),'development gate não deve permanecer ativo após o fechamento');
assert.ok(!pkg.scripts.test.includes('tests/release-gate-v047-smoke.mjs'),'release gate histórico v0.47 não deve bloquear a versão corrente');
assert.ok(!pkg.scripts.test.includes('run-smoke.mjs'),'descoberta automática continua proibida');

const docs=await readFile(new URL('../docs/ifc-loads-v048.md',import.meta.url),'utf8');
for(const phrase of [
  'PRODUCT_VERSION = 0.48.0','IfcStructuralLoadCase','IfcStructuralPointAction','IfcStructuralLinearAction',
  'IfcRelAssignsToGroupByFactor','IfcRelConnectsStructuralActivity','LoadedBy','loadGlobalIds','exchangeStateSeed',
  'commitReady','IfcOpenShell','desktop, Android e tablet','Nenhuma promoção para `main`'
])assert.ok(docs.includes(phrase),`documentação v0.48 incompleta: ${phrase}`);

console.log('AstraStruct v0.48 release gate: IFC load mapping, STEP, external validation, import staging and identity-preserving round-trip coherent.');
