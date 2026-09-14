import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PRODUCT_VERSION,PROJECT_SCHEMA_VERSION,RESULT_CONTRACT_VERSION} from '../web/src/core/version.js';
import {
  IFC_SCHEMA,IFC_STANDARD,
  IFC_STEP_MATERIAL_CONTRACT,IFC_STEP_MATERIAL_VERSION,
  IFC_IMPORT_STAGING_CONTRACT,IFC_IMPORT_STAGING_VERSION,
  IFC_MATERIAL_STRENGTH_CONTRACT,IFC_MATERIAL_STRENGTH_VERSION,
  IFC_MECHANICAL_EXCHANGE_CONTRACT,IFC_MECHANICAL_EXCHANGE_VERSION
} from '../web/src/interop/index.js';

const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
assert.equal(pkg.version,'0.46.0','v0.47 permanece experimental: package.json deve ficar em v0.46.0 até o gate final');
assert.equal(PRODUCT_VERSION,'0.46.0','PRODUCT_VERSION só muda no fechamento formal da v0.47');
assert.equal(PROJECT_SCHEMA_VERSION,2,'v0.47 não altera o schema persistido');
assert.equal(RESULT_CONTRACT_VERSION,'1.0','v0.47 não altera structural-result/v1');
assert.equal(IFC_SCHEMA,'IFC4X3_ADD2');assert.equal(IFC_STANDARD,'ISO 16739-1:2024');
assert.equal(IFC_STEP_MATERIAL_CONTRACT,'ifc-step-material/v1');assert.equal(IFC_STEP_MATERIAL_VERSION,'0.47.0-exp');
assert.equal(IFC_IMPORT_STAGING_CONTRACT,'ifc-import-staging/v1');assert.equal(IFC_IMPORT_STAGING_VERSION,'0.47.0-exp');
assert.equal(IFC_MATERIAL_STRENGTH_CONTRACT,'ifc-material-strength/v1');assert.equal(IFC_MATERIAL_STRENGTH_VERSION,'0.47.0-exp');
assert.equal(IFC_MECHANICAL_EXCHANGE_CONTRACT,'ifc-mechanical-exchange/v1');assert.equal(IFC_MECHANICAL_EXCHANGE_VERSION,'0.46.0-exp','contrato mecânico elástico permanece estável');

for(const test of ['tests/development-gate-v047-smoke.mjs','tests/ifc-material-strength-v047-smoke.mjs','tests/ifc-import-staging-v046-smoke.mjs','tests/ifc-step-v045-smoke.mjs'])assert.ok(pkg.scripts.test.includes(test),`gate obrigatório ausente: ${test}`);
assert.ok(!pkg.scripts.test.includes('tests/release-gate-v046-smoke.mjs'),'release gate histórico não deve ser o gate frontal da v0.47 experimental');
assert.ok(!pkg.scripts.test.includes('run-smoke.mjs'),'descoberta automática continua proibida no gate principal');

const docs=await readFile(new URL('../docs/ifc-material-strength-v047.md',import.meta.url),'utf8');
for(const phrase of ['Pset_MaterialSteel','YieldStress','UltimateStress','Pset_MaterialConcrete','CompressiveStrength','fctm','IFCPRESSUREMEASURE','Nenhuma promoção para `main`'])assert.ok(docs.includes(phrase),`documentação v0.47 incompleta: ${phrase}`);

console.log('AstraStruct v0.47 development gate: standard IFC steel/concrete strength exchange active while product remains formally v0.46.0.');
